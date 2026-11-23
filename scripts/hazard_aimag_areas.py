"""Hazard zoning area per class inside each aimag -> src/data/hazardAimagAreas.json.

Clips every zoning layer of the Hazard service by aimag polygons (soums
dissolved on aimag_code) and sums equal-area km² per class 1-5. Re-run when a
hazard layer or the soum layer changes:

    pip install shapely pyproj
    python scripts/hazard_aimag_areas.py
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from pyproj import Transformer
import numpy as np
from shapely import make_valid, transform, union_all
from shapely.geometry import shape
from shapely.strtree import STRtree

BASE = "https://arcgis.ubhub.mn/arcgis/rest/services/Hosted"
SOUM_URL = f"{BASE}/NEMA_VulExp_bySoum_Full/FeatureServer/0"
HAZARD_URL = f"{BASE}/Hazard/FeatureServer"

# Zoning variants ("layerId:field"), read from HAZARD_VARIANTS so the two
# never drift apart.
CONFIG = Path(__file__).resolve().parent.parent / "src" / "lib" / "riskConfig.ts"
ZONES = list(
    dict.fromkeys(
        re.findall(r'layerId:\s*(\d+),\s*field:\s*"(\w+)"', CONFIG.read_text(encoding="utf-8"))
    )
)

# Albers equal-area fitted to Mongolia, so planar area is true area.
TO_AEA = Transformer.from_crs(
    "EPSG:4326",
    "+proj=aea +lat_0=47 +lon_0=104 +lat_1=43 +lat_2=51 +datum=WGS84 +units=m",
    always_xy=True,
).transform

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "hazardAimagAreas.json"


def features(url, fields):
    """All features of a layer as GeoJSON, paged by the service limit."""
    out, offset = [], 0
    while True:
        q = urllib.parse.urlencode(
            {
                "where": "1=1",
                "outFields": ",".join(fields),
                "returnGeometry": "true",
                "outSR": 4326,
                "resultOffset": offset,
                "f": "geojson",
            }
        )
        with urllib.request.urlopen(f"{url}/query?{q}", timeout=300) as r:
            page = json.load(r)
        batch = page.get("features", [])
        out += batch
        if not batch or not page.get("properties", {}).get("exceededTransferLimit"):
            return out
        offset += len(batch)


def area_shape(geom):
    return make_valid(
        transform(shape(geom), lambda xy: np.column_stack(TO_AEA(xy[:, 0], xy[:, 1])))
    )


def main():
    groups = {}
    for f in features(SOUM_URL, ["aimag_code", "aimag_name"]):
        p = f["properties"]
        if not f.get("geometry") or p.get("aimag_code") is None:
            continue
        g = groups.setdefault(str(p["aimag_code"]), {"name": p.get("aimag_name") or "", "parts": []})
        g["parts"].append(area_shape(f["geometry"]))
    aimags = [(code, g["name"], union_all(g["parts"])) for code, g in sorted(groups.items())]
    print(f"{len(aimags)} aimags", file=sys.stderr)

    result = {}
    for layer, field in ZONES:
        feats = [
            (int(f["properties"][field]), area_shape(f["geometry"]))
            for f in features(f"{HAZARD_URL}/{layer}", [field])
            if f.get("geometry") and f["properties"].get(field) in (1, 2, 3, 4, 5)
        ]
        tree = STRtree([g for _, g in feats])
        rows = []
        for code, name, aimag in aimags:
            km2 = [0.0] * 5
            for i in tree.query(aimag, predicate="intersects"):
                cls, g = feats[i]
                km2[cls - 1] += aimag.intersection(g).area / 1e6
            rows.append({"code": code, "name": name, "km2": [round(v, 1) for v in km2]})
        total = sum(sum(r["km2"]) for r in rows)
        key = f"{layer}:{field}"
        print(f"{key}: {len(feats)} polygons, {total:,.0f} km2", file=sys.stderr)
        result[key] = rows

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # One aimag per line: small, and diffs stay readable.
    lines = [f'{{"generated": "{date.today().isoformat()}", "zones": {{']
    for n, (key, rows) in enumerate(result.items()):
        lines.append(f' "{key}": [')
        lines += [
            "  " + json.dumps(r, ensure_ascii=False) + ("," if i < len(rows) - 1 else "")
            for i, r in enumerate(rows)
        ]
        lines.append(" ]" + ("," if n < len(result) - 1 else ""))
    lines.append("}}")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
