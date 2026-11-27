"use client";

import {
  HAZARDS,
  HAZARD_VARIANTS,
  MODES,
  panelOverlays,
  overlayAssessed,
  overlayLabel,
  type Filters,
  type Overlay,
} from "@/lib/riskConfig";
import { Fragment } from "react";
import styles from "./Dashboard.module.css";
import Icon, { type IconName } from "./Icon";
import ClassChips from "./ClassChips";
import HazardVariantPicker from "./HazardVariantPicker";

const OVERLAY_ICONS: Record<string, IconName> = {
  edu: "school",
  hlth: "hospital",
  trf: "lt",
  brdg: "bridge",
  culv: "pipe",
  road: "road",
  rail: "train",
  com: "building",
  hh: "home",
  pop: "users",
  hsar: "building",
  hsdw: "home",
  farm: "wheat",
  past: "grass",
  crop: "wheat",
  crhh: "home",
  cren: "building",
  ls: "livestock",
  ent: "building",
  gas: "fuel",
  term: "warehouse",
  cmf: "tower",
  cult: "landmark",
  mine: "pickaxe",
  mnts: "wrench",
  brdp: "gate",
};

type Props = {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  overlays: string[];
  setOverlays: (els: string[]) => void;
  /** Elements per "mode:hazard" (which hazards assess which layers). */
  combos: Record<string, string[]>;
  hazardView: boolean;
  setHazardView: (on: boolean) => void;
  /** Chosen zoning variant per hazard, and its setter. */
  variantOf: Record<string, number>;
  setVariant: (hazard: string, index: number) => void;
  soumOutlines: boolean;
  setSoumOutlines: (on: boolean) => void;
  aimagOutlines: boolean;
  setAimagOutlines: (on: boolean) => void;
};

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** Advanced filters (other indicator, top hazard, high-class count); hidden for now. */
const SHOW_ADVANCED = false;

const OVERLAY_GROUPS: { geometry: Overlay["geometry"]; label: string }[] = [
  { geometry: "point", label: "Цэг" },
  { geometry: "line", label: "Шугам" },
  { geometry: "polygon", label: "Полигон" },
];

/** Panel order: wildfire and earthquake swap places (wildfire first). */
const PANEL_HAZARDS = HAZARDS.map((h) =>
  h.id === "eq"
    ? HAZARDS.find((x) => x.id === "wf")!
    : h.id === "wf"
      ? HAZARDS.find((x) => x.id === "eq")!
      : h,
);

export default function FilterPanel({
  filters,
  update,
  overlays,
  setOverlays,
  combos,
  hazardView,
  setHazardView,
  variantOf,
  setVariant,
  soumOutlines,
  setSoumOutlines,
  aimagOutlines,
  setAimagOutlines,
}: Props) {
  const other = MODES.find((m) => m.id !== filters.mode)!;
  return (
    <aside
      className={`${styles.panel} ${styles.filterPanel}`}
      aria-label="Шүүлтүүр"
    >
      <div className={styles.filterBody}>
        <div
          className={`${styles.segmented} ${styles.segmented3}`}
          role="group"
          aria-label="Үзүүлэлт"
        >
          <button
            type="button"
            aria-pressed={hazardView}
            onClick={() => {
              setHazardView(true);
              // Zoning exists per hazard only, so start from the first one.
              if (filters.hazard === "all") update({ hazard: "wf" });
            }}
          >
            Аюул
          </button>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={!hazardView && filters.mode === m.id}
              onClick={() => {
                setHazardView(false);
                update({ mode: m.id });
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.sectionLabel}>
            <span className={styles.caps}>Аюулт үзэгдэл</span>
            <span>10 төрөл</span>
          </span>
          <div
            className={`${styles.hazardGrid} ${hazardView ? styles.hazardList : ""}`}
          >
            {PANEL_HAZARDS.filter((h) => !hazardView || h.id !== "all").map((h) => {
              const variants = HAZARD_VARIANTS[h.id] ?? [];
              const active = filters.hazard === h.id;
              return (
                <Fragment key={h.id}>
                  <button
                    type="button"
                    className={styles.hazardChip}
                    aria-pressed={active}
                    data-expanded={
                      (hazardView && active && variants.length > 1) || undefined
                    }
                    onClick={() => update({ hazard: h.id })}
                  >
                    <Icon name={h.id} size={16} />
                    {h.id === "all" ? "Бүх аюулт үзэгдэл" : h.label}
                    {active && <span className={styles.selectedDot} />}
                  </button>
                  {hazardView && active && variants.length > 1 && (
                    <HazardVariantPicker
                      hazard={h.id}
                      variants={variants}
                      selectedIndex={variantOf[h.id] ?? 0}
                      onSelect={(index) => setVariant(h.id, index)}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {SHOW_ADVANCED && (
          <details className={styles.advanced}>
            <summary>
              Нарийвчилсан шүүлтүүр <Icon name="chevron" size={14} />
            </summary>
            <div className={styles.advancedBody}>
              <div className={styles.group}>
                <span className={styles.label}>{other.label}</span>
                <ClassChips
                  label={other.label}
                  value={filters.otherClasses}
                  onChange={(otherClasses) => update({ otherClasses })}
                />
              </div>

              <div className={styles.group}>
                <label className={styles.group}>
                  <span className={styles.label}>Тэргүүлэх аюул</span>
                  <select
                    value={filters.topHaz}
                    onChange={(e) => update({ topHaz: e.target.value })}
                  >
                    <option value="">Бүгд</option>
                    {HAZARDS.filter((h) => h.id !== "all").map((h) => (
                      <option key={h.id} value={h.id.toUpperCase()}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.group}>
                <span className={styles.label}>
                  Өндөр ангилалтай аюул ≥ {filters.minHigh}
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={filters.minHigh}
                  onChange={(e) => update({ minHigh: Number(e.target.value) })}
                />
                <span className={styles.rangeLabels}>
                  <span>0 · Бүгд</span>
                  <span>10</span>
                </span>
              </label>
            </div>
          </details>
        )}

        {hazardView && (
          <div className={styles.group}>
            <span className={styles.sectionLabel}>
              <span className={styles.caps}>Давхарга</span>
            </span>
            <div className={styles.overlayGrid}>
              <button
                type="button"
                className={styles.hazardChip}
                aria-pressed={aimagOutlines}
                onClick={() => setAimagOutlines(!aimagOutlines)}
              >
                <Icon name="map" size={16} />
                <span className={styles.optionLabel}>Аймгийн хил</span>
                {aimagOutlines && <span className={styles.selectedDot} />}
              </button>
              <button
                type="button"
                className={styles.hazardChip}
                aria-pressed={soumOutlines}
                onClick={() => setSoumOutlines(!soumOutlines)}
              >
                <Icon name="map" size={16} />
                <span className={styles.optionLabel}>Сумын хил</span>
                {soumOutlines && <span className={styles.selectedDot} />}
              </button>

            </div>
          </div>
        )}

        {!hazardView && (
          <div className={styles.group}>
            <span className={styles.sectionLabel}>
              <span className={styles.caps}>Объектын давхарга</span>
              <span>
                {overlays.length
                  ? `${overlays.length} / ${panelOverlays(filters.mode).length}`
                  : `${panelOverlays(filters.mode).length} төрөл`}
              </span>
            </span>
            {OVERLAY_GROUPS.map(({ geometry, label }) => {
              const items = panelOverlays(filters.mode).filter(
                (o) => o.geometry === geometry,
              );
              if (!items.length) return null;
              return (
                <div key={geometry} className={styles.overlayGroup}>
                  <span className={styles.overlayGroupLabel}>
                    {label}
                    <span>{items.length}</span>
                  </span>
                  <div
                    className={styles.overlayGrid}
                    role="group"
                    aria-label={label}
                  >
                    {items.map((o) => {
                      const assessed = overlayAssessed(
                        o,
                        filters.mode,
                        filters.hazard,
                        combos,
                      );
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={styles.hazardChip}
                          disabled={!assessed}
                          title={
                            assessed
                              ? undefined
                              : `${overlayLabel(o)}: ${
                                  HAZARDS.find((h) => h.id === filters.hazard)?.label
                                } аюулаар үнэлэгдээгүй`
                          }
                          aria-pressed={overlays.includes(o.id)}
                          onClick={() =>
                            setOverlays(
                              geometry === "polygon"
                                ? // Only one polygon layer at a time (they all
                                  // cover the same soums); points/lines stack.
                                  overlays.includes(o.id)
                                  ? overlays.filter((id) => id !== o.id)
                                  : [
                                      ...overlays.filter(
                                        (id) => !items.some((x) => x.id === id),
                                      ),
                                      o.id,
                                    ]
                                : toggle(overlays, o.id),
                            )
                          }
                        >
                          <Icon name={OVERLAY_ICONS[o.el] ?? "layers"} size={16} />
                          <span className={styles.optionLabel}>
                            {overlayLabel(o)}
                          </span>
                          {overlays.includes(o.id) && (
                            <span className={styles.selectedDot} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
