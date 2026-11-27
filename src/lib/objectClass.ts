import {
  OVERLAY_SERVICE,
  overlayWhere,
  type Mode,
  type Overlay,
} from "./riskConfig";

/**
 * Fields that hold a feature's own class for the hazard, best first:
 * per-object CVI (points/lines) or the element's own class (polygons:
 * `_vl45`, `_el345`), then the soum element class, then
 * the soum's class for the hazard (exposure layers carry only that).
 * For "all" the multi-hazard object class comes first.
 */
export function objectClassFields(
  o: Overlay,
  hazard: string,
  available: string[],
): string[] {
  const wanted =
    hazard === "all"
      ? [
          "cvi_mhei",
          "cvi",
          "mh_expclas",
          "mh_expcl",
          "mh_vl45",
          "mh_el345",
          "all_soumcl",
        ]
      : [
          `${hazard}_cvi`,
          `cvi_${hazard}`,
          `${hazard}_vl45`,
          `${hazard}_el345`,
          `${hazard}_${o.el}_el`,
          `${hazard}_soumcl`,
        ];
  return wanted.filter((f) => available.includes(f));
}

/**
 * The fields the map colours an object layer by (same rule as RiskMap):
 * polygons, and points/lines once an area is chosen, use the object's own
 * class; otherwise points/lines use the soum element class `<hz>_<el>_el`.
 */
export function mapClassFields(
  o: Overlay,
  hazard: string,
  areaFocus: boolean,
  available: string[],
): string[] {
  if (areaFocus || o.geometry === "polygon")
    return objectClassFields(o, hazard, available);
  const f = `${hazard}_${o.el}_el`;
  return available.includes(f) ? [f] : [];
}

const NAMES: Record<string, number> = {
  "very low": 1,
  low: 2,
  moderate: 3,
  high: 4,
  "very high": 5,
};

/** Class of a feature: first non-empty field, read like the map's Arcade. */
export function classOfAttrs(
  attrs: Record<string, unknown>,
  fields: string[],
): number | null {
  for (const f of fields) {
    const v = attrs[f];
    if (v == null || v === "") continue;
    if (typeof v === "number") return v;
    const t = String(v).trim().toLowerCase();
    const n = Number(t.slice(0, 1));
    if (!Number.isNaN(n)) return n;
    if (t in NAMES) return NAMES[t];
  }
  return null;
}

/** Class bucket of an object: "0"–"5", or "nd" when drawn as no data. */
export type ObjectBucket = "0" | "1" | "2" | "3" | "4" | "5" | "nd";

export type ObjectDistribution = {
  /** Objects per class 0–5 (0 only counts for polygons, as on the map). */
  counts: number[];
  /** Object ids per bucket (to filter the map by class). */
  ids: Partial<Record<ObjectBucket, number[]>>;
  /** Object id field of the layer. */
  oid: string;
  /** Objects drawn grey on the map ("Өгөгдөлгүй"). */
  noData: number;
  total: number;
  /** False when the layer has no class field for the hazard. */
  classified: boolean;
};

type LayerInfo = { fields: string[]; oid: string };
const infoCache = new Map<string, Promise<LayerInfo>>();
const layerInfo = (url: string) => {
  let p = infoCache.get(url);
  if (!p) {
    p = fetch(`${url}?f=json`)
      .then((r) => r.json())
      .then((d) => ({
        fields: (d.fields ?? []).map((f: { name: string }) => f.name),
        oid: d.objectIdField ?? "fid",
      }));
    p.catch(() => infoCache.delete(url));
    infoCache.set(url, p);
  }
  return p;
};

/**
 * Objects of a layer inside the matched soums, counted per class the way
 * the map draws them.
 */
export async function loadObjectDistribution(
  o: Overlay,
  mode: Mode,
  hazard: string,
  areaFocus: boolean,
  codes: number[] | null,
  signal?: AbortSignal,
): Promise<ObjectDistribution> {
  const url = `${OVERLAY_SERVICE[mode]}/${o.layerId}`;
  const info = await layerInfo(url);
  const fields = mapClassFields(o, hazard, areaFocus, info.fields);
  const where = overlayWhere(o, codes) || "1=1";
  const counts = [0, 0, 0, 0, 0, 0];
  const ids: Partial<Record<ObjectBucket, number[]>> = {};
  let noData = 0;
  let total = 0;
  const page = 2000;
  for (let offset = 0; ; offset += page) {
    const q = new URLSearchParams({
      where,
      outFields: [...fields, info.oid].join(","),
      returnGeometry: "false",
      resultOffset: String(offset),
      resultRecordCount: String(page),
      orderByFields: info.oid,
      f: "json",
    });
    const d = await (await fetch(`${url}/query?${q}`, { signal })).json();
    if (d.error) throw new Error(d.error.message);
    for (const f of d.features ?? []) {
      total++;
      const c = fields.length ? classOfAttrs(f.attributes, fields) : null;
      let bucket: ObjectBucket;
      if (c != null && c >= 1 && c <= 5) {
        counts[c]++;
        bucket = String(c) as ObjectBucket;
      } else if (c === 0 && o.geometry === "polygon") {
        counts[0]++;
        bucket = "0";
      } else {
        noData++;
        bucket = "nd";
      }
      (ids[bucket] ??= []).push(f.attributes[info.oid]);
    }
    if (!d.exceededTransferLimit && (d.features?.length ?? 0) < page) break;
  }
  return { counts, ids, oid: info.oid, noData, total, classified: fields.length > 0 };
}
