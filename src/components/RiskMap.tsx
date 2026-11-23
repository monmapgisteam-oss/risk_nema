"use client";

// Calcite design tokens and map-component base styles; without these the
// component panels (e.g. basemap gallery) render without backgrounds.
import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";

import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-home";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-basemap-gallery";

import { useEffect, useMemo, useRef, useState } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import HighlightOptions from "@arcgis/core/views/support/HighlightOptions";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import GroupLayer from "@arcgis/core/layers/GroupLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import Basemap from "@arcgis/core/Basemap";
import * as unionOperator from "@arcgis/core/geometry/operators/unionOperator";
import * as labelPointOperator from "@arcgis/core/geometry/operators/labelPointOperator";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import type { GeometryUnion } from "@arcgis/core/unionTypes";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import type Geometry from "@arcgis/core/geometry/Geometry";
import Viewpoint from "@arcgis/core/Viewpoint";
import type Extent from "@arcgis/core/geometry/Extent";
import type MapView from "@arcgis/core/views/MapView";
import type FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView";

import {
  CLASS_COLORS,
  CLASS_LABELS,
  NODATA_COLOR,
  NOEXP_COLOR,
  OVERLAYS,
  OVERLAY_SERVICE,
  HAZARD_SERVICE,
  SOUM_LAYER_URL,
  BORDER_URLS,
  overlayLabel,
  overlayWhere,
  type Mode,
  type Overlay,
  type Picked,
  type HazardZone,
} from "@/lib/riskConfig";
import {
  objectClassFields,
  overlayFocusRenderer,
  overlayLegendSvg,
  overlayRenderer,
} from "@/lib/mapSymbols";
import styles from "./RiskMap.module.css";
import Icon from "./Icon";

const HOME = { center: [103.8, 46.9], zoom: 5 };
const CLASSES = [1, 2, 3, 4, 5];
const SOUM_OUTLINE_HIGHLIGHT = "soum-outline";

type Props = {
  mode: Mode;
  hazard: string;
  field: string;
  showNoExp: boolean;
  matchedIds: number[] | null; // null = no filter
  matchedCodes: number[] | null; // soum codes of the same soums
  overlays: string[]; // overlay ids
  selectedFid: number | null;
  selectedCode: number | null; // soum code of selectedFid
  onSelect: (fid: number | null) => void;
  picked: Picked | null;
  onPick: (picked: Picked) => void;
  focus: { ids: number[] | null; key: number };
  onFocusMatched: () => void;
  /** An aimag or soums are chosen: color objects by class and pulse them. */
  areaFocus: boolean;
  /** Hazard zoning layer drawn under the soum outlines ("Аюул" view). */
  hazardZone: HazardZone | null;
  /** Soum layer visibility (the hazard view can switch outlines off). */
  showSoums: boolean;
  /** Aimag borders (the national border is always on). */
  showAimags: boolean;
  /** Width (px) of the map covered on the right, e.g. by the dashboard. */
  padRight?: number;
  /** Aimag code whose border is drawn bold (chosen in the hazard panel). */
  outlineAimag?: string | null;
  /** Zoning classes to show; empty shows all. */
  zoneClasses?: number[];
};

/** "#rrggbb" → [r, g, b, alpha]. */
const rgba = (hex: string, alpha: number): number[] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  alpha,
];

const fill = (color: string, alpha = 1) =>
  new SimpleFillSymbol({
    color: rgba(color, alpha),
    outline:
      alpha < 1
        ? { color: [255, 255, 255, 0.55], width: 0.6 }
        : { color: [255, 255, 255, 0.9], width: 0.5 },
  });

/**
 * Soums coloured by class. With `alpha` < 1 (object layers on) the classes
 * stay visible as a faint wash under the objects.
 */
function soumRenderer(field: string, showNoExp: boolean, alpha = 1) {
  return new UniqueValueRenderer({
    field,
    defaultSymbol: fill(NODATA_COLOR, alpha * 0.5),
    uniqueValueInfos: [
      ...(showNoExp ? [{ value: 0, symbol: fill(NOEXP_COLOR, alpha) }] : []),
      ...CLASSES.map((c) => ({
        value: c,
        symbol: fill(CLASS_COLORS[c], alpha),
      })),
    ],
  });
}

/** Soums as outlines only (object layers on, or the hazard view). */
function soumBoundaryRenderer() {
  return new SimpleRenderer({
    label: "Сумын хил",
    symbol: new SimpleFillSymbol({
      // A transparent solid fill preserves clicks inside the soum polygon.
      style: "solid",
      color: [0, 0, 0, 0],
      outline: { color: [226, 232, 240, 0.65], width: 0.65 },
    }),
  });
}

const SELECTION_COLOR = "#38e1ff";

/** Draws a selection outline as a view graphic; returns the cleanup. */
function drawSelection(view: MapView, load: () => Promise<Geometry | null>) {
  let alive = true;
  let graphic: Graphic | null = null;
  load()
    .then((geometry) => {
      if (!alive || !geometry) return;
      const symbol =
        geometry.type === "point"
          ? new SimpleMarkerSymbol({
              size: 30,
              color: [56, 225, 255, 0.25],
              outline: { color: SELECTION_COLOR, width: 2.5 },
            })
          : geometry.type === "polyline"
            ? new SimpleLineSymbol({ color: [56, 225, 255, 0.7], width: 5 })
            : new SimpleFillSymbol({
                color: [56, 225, 255, 0.12],
                outline: { color: SELECTION_COLOR, width: 2.5 },
              });
      graphic = new Graphic({ geometry, symbol });
      view.graphics.add(graphic);
    })
    .catch(() => {});
  return () => {
    alive = false;
    if (graphic) view.graphics.remove(graphic);
  };
}

type OverlayEntry = {
  layer: FeatureLayer;
  overlay: Overlay;
  mode: Mode;
  /** Layers without a soum code (road/rail sections) are clipped to the
   * filtered soums: they sit in a group with a `destination-in` mask. */
  container?: GroupLayer;
  mask?: GraphicsLayer;
};

const added = (e: OverlayEntry) => e.container ?? e.layer;

const NO_CLASSES: number[] = [];

export default function RiskMap({
  mode,
  hazard,
  field,
  showNoExp,
  matchedIds,
  matchedCodes,
  overlays,
  selectedFid,
  selectedCode,
  onSelect,
  picked,
  onPick,
  focus,
  onFocusMatched,
  areaFocus,
  hazardZone,
  showSoums,
  showAimags,
  padRight = 0,
  outlineAimag = null,
  zoneClasses = NO_CLASSES,
}: Props) {
  const mapRef = useRef<HTMLArcgisMapElement | null>(null);
  const homeRef = useRef<HTMLArcgisHomeElement | null>(null);
  const fullExtent = useRef<Extent | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [layerView, setLayerView] = useState<FeatureLayerView | null>(null);
  const [classifiedFields, setClassifiedFields] = useState<
    Record<string, string>
  >({});
  const selectedOverlays = OVERLAYS[mode].filter((o) =>
    overlays.includes(o.id),
  );
  const hasOverlays = selectedOverlays.length > 0;
  const classifiedOverlays = selectedOverlays.filter(
    (o) =>
      classifiedFields[`${mode}:${o.id}`] === `${hazard}:${areaFocus ? 1 : 0}`,
  );
  // Under object layers the soums are outlines only, so the class legend
  // describes the objects.
  const showClassLegend = !hasOverlays || classifiedOverlays.length > 0;
  const showNoExpLegend = hasOverlays
    ? classifiedOverlays.some((o) => o.geometry === "polygon")
    : showNoExp;
  const classLegendTitle = hasOverlays ? "Объектын үнэлгээ" : "Сумын үнэлгээ";
  const tipRef = useRef<HTMLDivElement | null>(null);
  const layerViewRef = useRef<FeatureLayerView | null>(null);
  useEffect(() => {
    layerViewRef.current = layerView;
  }, [layerView]);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPickRef.current = onPick;
  });

  const soumLayer = useMemo(
    () =>
      new FeatureLayer({
        url: SOUM_LAYER_URL,
        title: "Сумын үнэлгээ",
        outFields: ["fid", "soum_name", "aimag_name"],
        popupEnabled: false,
        opacity: 0.82,
      }),
    [],
  );
  const overlayLayers = useRef(new Map<string, OverlayEntry>());
  // Mongolian aimag names, toggled from the map (built on first use).
  const [aimagNames, setAimagNames] = useState(false);
  const nameLayer = useMemo(
    () => new GraphicsLayer({ title: "Аймгийн нэр", visible: false }),
    [],
  );
  useEffect(() => {
    nameLayer.set("visible", aimagNames);
    if (!aimagNames || nameLayer.graphics.length) return;
    let alive = true;
    soumLayer
      .queryFeatures({
        where: "1=1",
        outFields: ["aimag_code", "aimag_name"],
        returnGeometry: true,
        maxAllowableOffset: 0.01,
      })
      .then(({ features }) => {
        if (!alive) return;
        const groups = new Map<string, { name: string; parts: GeometryUnion[] }>();
        for (const f of features) {
          const code = String(f.attributes.aimag_code ?? "");
          const g = groups.get(code) ?? { name: "", parts: [] };
          g.name ||= String(f.attributes.aimag_name ?? "");
          if (f.geometry) g.parts.push(f.geometry as GeometryUnion);
          groups.set(code, g);
        }
        for (const { name, parts } of groups.values()) {
          const area = name && parts.length ? unionOperator.executeMany(parts) : null;
          if (!area) continue;
          nameLayer.add(
            new Graphic({
              geometry: labelPointOperator.execute(area as GeometryUnion),
              symbol: new TextSymbol({
                text: name,
                color: "#1b344c",
                haloColor: [255, 255, 255, 0.95],
                haloSize: 1.2,
                font: { size: 8, weight: "bold", family: "sans-serif" },
              }),
            }),
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [aimagNames, nameLayer, soumLayer]);

  // Border of the aimag chosen in the hazard panel (soums dissolved).
  const aimagLine = useMemo(
    () => new GraphicsLayer({ title: "Сонгосон аймаг" }),
    [],
  );
  useEffect(() => {
    aimagLine.removeAll();
    if (!outlineAimag || !/^\w+$/.test(outlineAimag)) return;
    let alive = true;
    soumLayer
      .queryFeatures({
        where: `aimag_code = '${outlineAimag}'`,
        // Full detail: generalized soums leave slivers inside the union.
        returnGeometry: true,
      })
      .then(({ features }) => {
        const parts = features
          .map((f) => f.geometry as GeometryUnion | null)
          .filter((g): g is GeometryUnion => !!g);
        const area = alive && parts.length ? unionOperator.executeMany(parts) : null;
        if (!area) return;
        aimagLine.removeAll();
        // White casing under a dark line, so it reads on every zone color.
        const casing: [number[] | string, number][] = [
          [[255, 255, 255, 0.9], 3],
          ["#10263a", 1.3],
        ];
        for (const [color, width] of casing)
          aimagLine.add(
            new Graphic({
              geometry: area,
              symbol: new SimpleFillSymbol({
                color: [0, 0, 0, 0],
                outline: new SimpleLineSymbol({ color, width }),
              }),
            }),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [outlineAimag, aimagLine, soumLayer]);

  // National and aimag borders, drawn just above the soums in every view.
  const borders = useMemo(
    () =>
      new GroupLayer({
        title: "Хил",
        layers: [
          new FeatureLayer({
            url: BORDER_URLS.aimag,
            title: "Аймгийн хил",
            popupEnabled: false,
            renderer: new SimpleRenderer({
              symbol: new SimpleLineSymbol({
                color: [250, 245, 225, 0.95],
                width: 1.1,
              }),
            }),
          }),
          new FeatureLayer({
            url: BORDER_URLS.national,
            title: "Улсын хил",
            popupEnabled: false,
            renderer: new SimpleRenderer({
              symbol: new SimpleLineSymbol({ color: "#2f3b47", width: 2 }),
            }),
          }),
        ],
      }),
    [],
  );

  // Add the soum layer and wire map clicks once the view is ready.
  useEffect(() => {
    if (!view) return;
    view.map?.add(soumLayer, 0);
    view.map?.add(borders, 1);
    view.map?.add(aimagLine);
    view.map?.add(nameLayer);
    const outlineHighlight = new HighlightOptions({
      name: SOUM_OUTLINE_HIGHLIGHT,
      color: "#b8ddf7",
      haloOpacity: 1,
      fillOpacity: 0,
    });
    view.highlights.add(outlineHighlight);
    let alive = true;
    view.set("constraints.snapToZoom", false);
    view
      .whenLayerView(soumLayer)
      .then((lv) => {
        if (alive) setLayerView(lv);
      })
      .catch(() => {});
    soumLayer
      .queryExtent()
      .then(({ extent }) => {
        if (!alive || !extent) return;
        fullExtent.current = extent.expand(1.12);
        if (homeRef.current)
          homeRef.current.viewpoint = new Viewpoint({
            targetGeometry: fullExtent.current,
          });
        return view.goTo(fullExtent.current, { animate: false });
      })
      .catch(() => {});
    const click = view.on("click", async (event) => {
      const entries = [...overlayLayers.current.values()];
      const hit = await view.hitTest(event, {
        include: [soumLayer, ...entries.map((e) => e.layer)],
      });
      // Results come topmost first. While element layers are on, only their
      // point/line features are clickable: soums (and the polygon element
      // layers, which are the soum polygons) just show their outline.
      const objectsOn = entries.length > 0;
      for (const r of hit.results) {
        if (r.type !== "graphic") continue;
        const entry = entries.find((e) => e.layer === r.graphic.layer);
        if (entry?.overlay.geometry === "polygon") continue;
        if (objectsOn && r.graphic.layer === soumLayer) continue;
        if (entry) {
          onPickRef.current({
            mode: entry.mode,
            overlay: entry.overlay,
            fid: r.graphic.attributes.fid as number,
            attrs: { ...r.graphic.attributes },
          });
          return;
        }
        if (r.graphic.layer === soumLayer) {
          onSelectRef.current(r.graphic.attributes.fid as number);
          return;
        }
      }
      onSelectRef.current(null);
    });
    // Soum name follows the cursor. A client-side point query works whatever
    // the soum symbol is (it may be fully transparent) and honours the filter.
    let busy = false;
    let pending: { x: number; y: number } | null = null;
    let inside = false;
    let lastFid: number | null = null;
    const hideTip = () => {
      lastFid = null;
      if (tipRef.current) tipRef.current.hidden = true;
    };
    const lookup = (x: number, y: number) => {
      const tip = tipRef.current;
      const lv = layerViewRef.current;
      const point = view.toMap({ x, y });
      if (!tip || !lv || !point) return hideTip();
      busy = true;
      lv.queryFeatures({
        geometry: point,
        outFields: ["fid", "soum_name", "aimag_name"],
        returnGeometry: false,
      })
        .then(({ features }) => {
          const a = features[0]?.attributes;
          if (!a || !inside) return hideTip();
          if (a.fid !== lastFid) {
            lastFid = a.fid;
            tip.replaceChildren(
              Object.assign(document.createElement("strong"), {
                textContent: a.soum_name ?? "",
              }),
              Object.assign(document.createElement("span"), {
                textContent: a.aimag_name ?? "",
              }),
            );
          }
          tip.hidden = false;
        })
        .catch(hideTip)
        .finally(() => {
          busy = false;
          // The cursor moved on while querying: look up where it is now.
          if (pending) {
            const next = pending;
            pending = null;
            lookup(next.x, next.y);
          }
        });
    };
    const move = view.on("pointer-move", (event) => {
      const tip = tipRef.current;
      if (!tip) return;
      inside = true;
      tip.style.transform = `translate(${event.x + 14}px, ${event.y + 14}px)`;
      if (busy) pending = { x: event.x, y: event.y };
      else lookup(event.x, event.y);
    });
    const leave = view.on("pointer-leave", () => {
      inside = false;
      pending = null;
      hideTip();
    });
    return () => {
      alive = false;
      click.remove();
      move.remove();
      leave.remove();
      view.highlights.remove(outlineHighlight);
      // Take the layers off again so a remount (or hot reload) never stacks
      // a second copy of the borders and aimag names.
      view.map?.removeMany([soumLayer, borders, aimagLine, nameLayer]);
    };
  }, [view, soumLayer, borders, aimagLine, nameLayer]);

  useEffect(() => {
    soumLayer.set(
      "renderer",
      hasOverlays || hazardZone
        ? soumBoundaryRenderer()
        : soumRenderer(field, showNoExp),
    );
    soumLayer.set(
      "title",
      hasOverlays || hazardZone ? "Сумын хил" : "Сумын үнэлгээ",
    );
  }, [soumLayer, field, showNoExp, hasOverlays, hazardZone]);

  useEffect(() => {
    soumLayer.set("visible", showSoums);
  }, [soumLayer, showSoums]);

  useEffect(() => {
    const aimag = borders.layers.find((l) => l.title === "Аймгийн хил");
    if (!aimag) return;
    aimag.set("visible", showAimags);
    // Light lines on the grey hazard relief; a dark navy line on the
    // satellite V/E maps so they stand apart from the white soum outlines.
    aimag.set(
      "renderer",
      new SimpleRenderer({
        symbol: new SimpleLineSymbol(
          hazardZone
            ? { color: [250, 245, 225, 0.95], width: 1.1 }
            : { color: "#0d2f57", width: 1.8 },
        ),
      }),
    );
  }, [borders, showAimags, hazardZone]);

  // Hazard zoning: one polygon layer per hazard, colored by its 1–5 class.
  const zoneLayerRef = useRef<FeatureLayer | null>(null);
  useEffect(() => {
    if (!view?.map || !hazardZone) return;
    const map = view.map;
    const layer = new FeatureLayer({
      url: `${HAZARD_SERVICE}/${hazardZone.layerId}`,
      title: hazardZone.label,
      outFields: [hazardZone.field],
      popupEnabled: false,
      opacity: 0.72,
      renderer: new UniqueValueRenderer({
        field: hazardZone.field,
        // Areas outside the zoning (class 0 / empty) stay see-through.
        defaultSymbol: new SimpleFillSymbol({
          color: [0, 0, 0, 0],
          outline: { width: 0 },
        }),
        uniqueValueInfos: CLASSES.map((c) => ({
          value: c,
          label: CLASS_LABELS[c],
          symbol: new SimpleFillSymbol({
            color: CLASS_COLORS[c],
            outline: { width: 0 },
          }),
        })),
      }),
    });
    map.add(layer, 0);
    zoneLayerRef.current = layer;
    return () => {
      if (zoneLayerRef.current === layer) zoneLayerRef.current = null;
      map.remove(layer);
      layer.destroy();
    };
  }, [view, hazardZone]);

  // Class filter from the hazard panel: only the chosen classes are drawn.
  const classKey = zoneClasses.join(",");
  useEffect(() => {
    const layer = zoneLayerRef.current;
    if (!layer || !hazardZone) return;
    layer.set(
      "definitionExpression",
      classKey ? `${hazardZone.field} IN (${classKey})` : "",
    );
  }, [view, hazardZone, classKey]);

  // Hazard maps read best on a grey shaded-relief base; restore the
  // previous basemap when leaving the hazard view.
  const hazardOn = !!hazardZone;
  useEffect(() => {
    const map = view?.map;
    if (!map || !hazardOn) return;
    const previous = map.basemap;
    map.set(
      "basemap",
      new Basemap({
        title: "Рельеф",
        baseLayers: [
          new TileLayer({
            url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
            // A mid-grey relief like the printed hazard maps.
            effect: "brightness(0.82) contrast(1.15)",
          }),
        ],
      }),
    );
    return () => {
      map.set("basemap", previous);
    };
  }, [view, hazardOn]);

  // Hide soums that do not match the filters.
  useEffect(() => {
    if (!layerView) return;
    layerView.set(
      "filter",
      matchedIds
        ? new FeatureFilter(
            matchedIds.length ? { objectIds: matchedIds } : { where: "1=0" },
          )
        : null,
    );
  }, [layerView, matchedIds]);

  // Any active highlight stops CIM symbol animations on the whole view, so
  // while objects pulse (areaFocus) selections are drawn as graphics instead.
  useEffect(() => {
    if (!view || !layerView || selectedFid == null) return;
    if (!areaFocus) {
      const h = layerView.highlight(selectedFid, {
        name: hasOverlays ? SOUM_OUTLINE_HIGHLIGHT : "default",
      });
      return () => h.remove();
    }
    return drawSelection(view, () =>
      soumLayer
        .queryFeatures({ objectIds: [selectedFid], returnGeometry: true })
        .then((r) => r.features[0]?.geometry ?? null),
    );
  }, [view, layerView, soumLayer, selectedFid, hasOverlays, areaFocus]);

  // Polygon element layers cover the soums, so highlight the soum there too.
  useEffect(() => {
    if (!view || selectedCode == null || areaFocus) return;
    const handles: { remove(): void }[] = [];
    let alive = true;
    for (const { layer, overlay } of overlayLayers.current.values()) {
      if (overlay.geometry !== "polygon") continue;
      view
        .whenLayerView(layer)
        .then((lv) =>
          lv
            .queryObjectIds({ where: overlayWhere(overlay, [selectedCode]) })
            .then((ids) => {
              if (alive && ids.length)
                handles.push(
                  lv.highlight(ids, { name: SOUM_OUTLINE_HIGHLIGHT }),
                );
            }),
        )
        .catch(() => {});
    }
    return () => {
      alive = false;
      handles.forEach((h) => h.remove());
    };
  }, [view, selectedCode, mode, overlays, areaFocus]);

  // Highlight the picked element feature.
  useEffect(() => {
    if (!view || !picked) return;
    const entry = overlayLayers.current.get(
      `${picked.mode}:${picked.overlay.id}`,
    );
    if (!entry) return;
    if (areaFocus)
      return drawSelection(view, () =>
        entry.layer
          .queryFeatures({ objectIds: [picked.fid], returnGeometry: true })
          .then((r) => r.features[0]?.geometry ?? null),
      );
    let handle: { remove(): void } | null = null;
    let alive = true;
    view
      .whenLayerView(entry.layer)
      .then((lv) => {
        if (alive) handle = lv.highlight(picked.fid);
      })
      .catch(() => {});
    return () => {
      alive = false;
      handle?.remove();
    };
  }, [view, picked, areaFocus]);

  // Keep zooms inside the part of the map that is not covered.
  useEffect(() => {
    if (!view) return;
    view.set("padding", { ...view.padding, right: padRight });
  }, [view, padRight]);

  useEffect(() => {
    if (!view || focus.key === 0) return;
    if (!focus.ids) {
      view.goTo(fullExtent.current ?? HOME).catch(() => {});
      return;
    }
    if (!focus.ids.length) return;
    let alive = true;
    soumLayer
      .queryExtent({ objectIds: focus.ids })
      .then((r) => {
        if (alive && r.extent) return view.goTo(r.extent.expand(1.25));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [view, soumLayer, focus]);

  // Element layers: polygons sit just above the soums, lines and points on top.
  useEffect(() => {
    if (!view?.map) return;
    const map = view.map;
    let alive = true;
    const wanted = new Set(overlays.map((id) => `${mode}:${id}`));
    for (const [key, entry] of overlayLayers.current) {
      if (!wanted.has(key)) {
        map.remove(added(entry));
        overlayLayers.current.delete(key);
      }
    }
    for (const o of OVERLAYS[mode]) {
      const key = `${mode}:${o.id}`;
      // Per-element marker size offsets (px smaller than the default).
      // Vulnerability markers start 1px smaller than exposure ones.
      const extra: Record<Mode, Record<string, number>> = {
        v: { brdg: 1, culv: 2 },
        e: { cmf: 1, mine: 1, culv: 2 },
      };
      const shrink = (mode === "v" ? 1 : 0) + (extra[mode][o.el] ?? 0);
      if (!wanted.has(key)) continue;
      let entry = overlayLayers.current.get(key);
      if (!entry) {
        const layer = new FeatureLayer({
          url: `${OVERLAY_SERVICE[mode]}/${o.layerId}`,
          title: overlayLabel(o),
          outFields: ["*"],
          popupEnabled: false,
          opacity: 1,
          renderer: overlayRenderer(o, null, shrink),
        });
        entry = { layer, overlay: o, mode };
        if (!o.soumField) {
          const mask = new GraphicsLayer({
            blendMode: "destination-in",
            visible: false,
          });
          entry.mask = mask;
          entry.container = new GroupLayer({
            title: overlayLabel(o),
            layers: [layer, mask],
          });
        }
        overlayLayers.current.set(key, entry);
        if (o.geometry === "polygon") map.add(added(entry), 1);
        else map.add(added(entry));
      }
      const target = entry.layer;
      target
        .load()
        .then(() => {
          if (!alive || overlayLayers.current.get(key)?.layer !== target)
            return;
          const names = target.fields.map((x) => x.name);
          let has: boolean;
          // Polygons always show their own 5-level class; points and lines
          // switch to it once an aimag or soums are chosen.
          if (areaFocus || o.geometry === "polygon") {
            const fields = objectClassFields(o, hazard, names);
            has = fields.length > 0;
            target.renderer = has
              ? overlayFocusRenderer(o, fields, shrink)
              : overlayRenderer(o, null, shrink);
          } else {
            const f = `${hazard}_${o.el}_el`;
            has = names.includes(f);
            target.renderer = overlayRenderer(o, has ? f : null, shrink);
          }
          const tag = has ? `${hazard}:${areaFocus ? 1 : 0}` : "";
          setClassifiedFields((current) =>
            current[key] === tag ? current : { ...current, [key]: tag },
          );
        })
        .catch(() => {});
    }
    // Keep markers readable even when a polygon or line is enabled later.
    const order = { polygon: 0, line: 1, point: 2 };
    [...overlayLayers.current.values()]
      .sort((a, b) => order[a.overlay.geometry] - order[b.overlay.geometry])
      .forEach((entry, index) => map.reorder(added(entry), index + 1));
    // Borders stay right above the soums, under every object layer;
    // aimag names stay on top.
    map.reorder(borders, map.layers.indexOf(soumLayer) + 1);
    map.reorder(nameLayer, map.layers.length - 1);
    return () => {
      alive = false;
    };
  }, [view, mode, hazard, overlays, areaFocus, soumLayer, borders, nameLayer]);

  // Element features follow the soum filter (server-side definition query).
  useEffect(() => {
    for (const { layer, overlay } of overlayLayers.current.values())
      layer.definitionExpression = overlayWhere(overlay, matchedCodes);
  }, [view, matchedCodes, mode, overlays]);

  // Section layers have no soum code: clip them to the filtered soums.
  useEffect(() => {
    if (!view) return;
    const masked = [...overlayLayers.current.values()].filter((e) => e.mask);
    if (!masked.length) return;
    const reset = () =>
      masked.forEach((e) => {
        e.mask!.visible = false;
        e.mask!.removeAll();
        view
          .whenLayerView(e.layer)
          .then((lv) => lv.set("filter", null))
          .catch(() => {});
      });
    if (!matchedIds) {
      reset();
      return;
    }
    let alive = true;
    soumLayer
      .queryFeatures({
        objectIds: matchedIds.length ? matchedIds : [-1],
        returnGeometry: true,
        maxAllowableOffset: 0.002,
      })
      .then(({ features }) => {
        if (!alive) return;
        const area = features.length
          ? unionOperator.executeMany(
              features.map((f) => f.geometry as GeometryUnion),
            )
          : null;
        for (const e of masked) {
          e.mask!.removeAll();
          if (area)
            e.mask!.add(
              new Graphic({
                geometry: area,
                symbol: new SimpleFillSymbol({
                  color: [0, 0, 0, 1],
                  outline: { width: 0 },
                }),
              }),
            );
          e.mask!.visible = true;
          // Only sections that cross the area stay clickable.
          view
            .whenLayerView(e.layer)
            .then((lv) =>
              lv.set(
                "filter",
                new FeatureFilter(
                  area
                    ? { geometry: area, spatialRelationship: "intersects" }
                    : { where: "1=0" },
                ),
              ),
            )
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [view, soumLayer, matchedIds, mode, overlays]);

  return (
    <>
      <arcgis-map
        ref={mapRef}
        className={styles.map}
        basemap="satellite"
        center={HOME.center.join(",")}
        zoom={HOME.zoom}
        onarcgisViewReadyChange={() => setView(mapRef.current?.view ?? null)}
      >
        <arcgis-zoom slot="top-left" />
        <arcgis-home ref={homeRef} slot="top-left" />
        <button
          type="button"
          slot="top-left"
          className={styles.mapButton}
          title="Зурагт төвлөрүүлэх"
          aria-label="Зурагт төвлөрүүлэх"
          onClick={onFocusMatched}
        >
          <Icon name="focus" size={16} />
        </button>
        <arcgis-expand
          slot="top-left"
          expand-tooltip="Суурь зураг"
          collapse-tooltip="Хаах"
        >
          <arcgis-basemap-gallery />
        </arcgis-expand>
        <button
          type="button"
          slot="top-left"
          className={styles.mapButton}
          title="Аймгийн нэр"
          aria-label="Аймгийн нэр"
          aria-pressed={aimagNames}
          onClick={() => setAimagNames((on) => !on)}
        >
          <Icon name="label" size={16} />
        </button>
        <div slot="bottom-right" className={styles.legend}>
          {hasOverlays && (
            <details className={styles.objectLegend} open>
              <summary>
                Объектын тэмдэглэгээ <span>{overlays.length}</span>
              </summary>
              <div className={styles.objectLegendList}>
                {selectedOverlays.map((o) => (
                  <div key={o.id} className={styles.objectLegendItem}>
                    {/* The preview is generated from the same symbols as the map. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={overlayLegendSvg(o)}
                      alt=""
                      width={26}
                      height={26}
                    />
                    <span>{overlayLabel(o)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {showClassLegend && (
            <>
              <strong>{classLegendTitle}</strong>
              {CLASSES.map((c) => (
                <span key={c} className={styles.legendItem}>
                  <i style={{ background: CLASS_COLORS[c] }} />
                  {CLASS_LABELS[c]}
                </span>
              ))}
              {showNoExpLegend && (
                <span className={styles.legendItem}>
                  <i style={{ background: NOEXP_COLOR }} />
                  {CLASS_LABELS[0]}
                </span>
              )}
              <span className={styles.legendItem}>
                <i style={{ background: NODATA_COLOR }} />
                Өгөгдөлгүй
              </span>
          </>
        )}
      </div>
    </arcgis-map>
    <div ref={tipRef} className={styles.hoverTip} hidden />
    </>
  );
}
