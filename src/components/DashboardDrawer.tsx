"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CLASS_LABELS,
  ELEMENTS,
  HAZARDS,
  MODES,
  OVERLAYS,
  classField,
  hazardLabel,
  type Filters,
  type SoumRow,
} from "@/lib/riskConfig";
import { colorOf, fmt, mean, rankField, type AimagRank } from "@/lib/stats";
import ObjectClassCard from "./ObjectClassCard";
import type { ObjectDistributionState } from "./useObjectDistribution";
import type { ObjectBucket } from "@/lib/objectClass";
import Icon from "./Icon";
import styles from "./DashboardDrawer.module.css";

type Props = {
  /** Docked: the dashboard is the right-hand panel itself (always open). */
  docked?: boolean;
  open?: boolean;
  onClose?: () => void;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  total: number;
  matched: SoumRow[];
  /** Soums passing every filter except the class one (class distribution). */
  classBase?: SoumRow[];
  scopeLabel: string;
  aimagRanks: AimagRank[];
  /** Elements per "mode:hazard", from elementCombos(). */
  combos: Record<string, string[]>;
  /** Object layers currently on the map. */
  overlays: string[];
  /** Class counts of the object layers on the map. */
  objectDist?: ObjectDistributionState;
  /** Object class buckets that filter the map. */
  objectClasses?: ObjectBucket[];
  onToggleObjectClass?: (bucket: ObjectBucket) => void;
  /** Show an element of the current indicator (and optionally its classes) on the map. */
  onShowElement: (el: string, classes?: number[]) => void;
  /** Reports how many px of the map the open drawer covers. */
  onCover?: (px: number) => void;
  onSelectSoum: (fid: number) => void;
  onSelectAimag: (code: string) => void;
};

// "No exposure" (0) sits after the 1–5 scale, as the last column.
const LEVELS = [1, 2, 3, 4, 5, 0];
/** Exposure elements that have an object layer on the map. */
const layerIds = {
  v: new Set(OVERLAYS.v.map((o) => o.id)),
  e: new Set(OVERLAYS.e.map((o) => o.id)),
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Slide-in sidebar summarising the soums that pass the current filters. */
export default function DashboardDrawer({
  docked = false,
  open: openProp = false,
  onClose,
  filters,
  update,
  total,
  matched,
  classBase = matched,
  scopeLabel,
  aimagRanks,
  combos,
  overlays,
  objectDist,
  objectClasses = [],
  onToggleObjectClass,
  onShowElement,
  onCover,
  onSelectSoum,
  onSelectAimag,
}: Props) {
  const open = docked || openProp;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // Tell the map how much of it is hidden (none on phones: full-screen sheet).
  useEffect(() => {
    const el = rootRef.current;
    if (!onCover) return;
    if (docked || !open || !el) {
      onCover(0);
      return;
    }
    const phone = window.matchMedia("(max-width: 900px)");
    const report = () => onCover(phone.matches ? 0 : el.offsetWidth + 8);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    phone.addEventListener("change", report);
    return () => {
      ro.disconnect();
      phone.removeEventListener("change", report);
    };
  }, [open, docked, onCover]);

  useEffect(() => {
    if (!open || docked || !onClose) return;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, docked, onClose]);

  const mode = filters.mode;
  const other = mode === "v" ? "e" : "v";
  const cf = classField(filters);
  const sf = rankField(filters);
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? "";
  const otherLabel = MODES.find((m) => m.id === other)?.label ?? "";
  const classes = filters.element ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];

  const stats = useMemo(() => {
    // The distribution ignores the class filter itself, so every class keeps
    // its real count and the chosen ones are only highlighted.
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let classified = 0;
    for (const r of classBase) {
      const v = r[cf];
      if (typeof v === "number" && v in counts) {
        counts[v]++;
        classified++;
      }
    }
    const topHaz = new Map<string, number>();
    for (const r of matched) {
      const h = r[`top_${mode}_haz`];
      if (typeof h === "string" && h) topHaz.set(h, (topHaz.get(h) ?? 0) + 1);
    }
    const lead = [...topHaz].sort((a, b) => b[1] - a[1])[0];
    return {
      counts,
      classified,
      avg: mean(matched, sf),
      high: matched.filter((r) => r[cf] === 4 || r[cf] === 5).length,
      matchedClassified: matched.filter(
        (r) => typeof r[cf] === "number" && (r[cf] as number) <= 5,
      ).length,
      lead: lead ? { id: lead[0], n: lead[1] } : null,
    };
  }, [matched, classBase, cf, sf, mode]);

  // Mean score of every hazard for the current indicator.
  const byHazard = useMemo(
    () =>
      HAZARDS.filter((h) => h.id !== "all")
        .map((h) => ({
          id: h.id,
          label: h.label,
          score: mean(matched, `${h.id}_${mode}_sc`),
        }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [matched, mode],
  );

  // Vulnerability × exposure class cross-tab for the chosen hazard.
  const cross = useMemo(() => {
    const m: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    let max = 0;
    for (const r of matched) {
      const a = r[`${filters.hazard}_${mode}_cls`];
      const b = r[`${filters.hazard}_${other}_cls`];
      if (typeof a === "number" && typeof b === "number" && a >= 1 && b >= 1) {
        const v = ++m[a - 1][b - 1];
        if (v > max) max = v;
      }
    }
    return { m, max };
  }, [matched, filters.hazard, mode, other]);

  // Elements of the current indicator (vulnerability or exposure): soums per
  // class level. With "all" hazards each soum counts at its highest level of
  // that element over every hazard.
  const exposure = useMemo(() => {
    const hz = filters.hazard;
    const hazards =
      hz === "all"
        ? HAZARDS.filter((h) => h.id !== "all").map((h) => h.id as string)
        : [hz as string];
    const els = new Set<string>();
    for (const h of hazards) for (const el of combos[`${mode}:${h}`] ?? []) els.add(el);
    return [...els]
      .map((el) => {
        const counts = [0, 0, 0, 0, 0, 0];
        let n = 0;
        for (const r of matched) {
          let best: number | null = null;
          for (const h of hazards) {
            const v = r[`${h}_${el}_${mode}`];
            if (typeof v === "number" && v >= 0 && v <= 5 && (best == null || v > best))
              best = v;
          }
          if (best != null) {
            counts[best]++;
            n++;
          }
        }
        return { el, counts, n, high: counts[4] + counts[5] };
      })
      .filter((e) => e.n > 0)
      .sort((a, b) => b.high / b.n - a.high / a.n || b.n - a.n);
  }, [matched, combos, filters.hazard, mode]);
  // Vulnerability has no "no exposure" (0) level.
  const levels = mode === "e" ? LEVELS : LEVELS.filter((c) => c !== 0);
  // Elements can only be filtered by within a single hazard.
  const exposureClickable = filters.hazard !== "all";

  const topAimags = useMemo(
    () =>
      aimagRanks
        .filter((a) => a.matched > 0 && a.score != null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10),
    [aimagRanks],
  );

  const topSoums = useMemo(
    () =>
      [...matched]
        .filter((r) => typeof r[sf] === "number")
        .sort((a, b) => (b[sf] as number) - (a[sf] as number))
        .slice(0, 10),
    [matched, sf],
  );

  const hazMax = Math.max(1, ...byHazard.map((h) => h.score ?? 0));
  const aimagMax = Math.max(1, ...topAimags.map((a) => a.score ?? 0));
  const scoreName = filters.element ? "Дундаж ангилал" : "Дундаж оноо";
  // Clicking a cross-tab cell filters by both classes, which only maps onto
  // the hazard-level classes (not an element's).
  const crossClickable = !filters.element;

  return (
    <aside
      ref={rootRef}
      id="risk-dashboard"
      className={styles.drawer}
      data-open={open}
      data-docked={docked}
      aria-label="Дашбоард"
      aria-hidden={!open}
      inert={!open}
    >
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>
            <Icon name="chart" size={13} />
            Дашбоард · {modeLabel} ·{" "}
            {filters.hazard === "all"
              ? "Нэгдсэн үнэлгээ"
              : hazardLabel(filters.hazard)}
          </p>
          <h2>{scopeLabel}</h2>
        </div>
        {!docked && (
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Дашбоард хаах"
            title="Хаах (Esc)"
          >
            ×
          </button>
        )}
      </header>

      <div className={styles.body}>
        <section className={styles.kpis} aria-label="Гол үзүүлэлт">
          <div className={styles.kpi}>
            <span>Сумын тоо</span>
            <strong>{matched.length}</strong>
            <small>нийт {total} сумаас</small>
          </div>
          <div className={styles.kpi}>
            <span>{scoreName}</span>
            <strong>
              {stats.avg == null ? "–" : stats.avg.toFixed(2)}
            </strong>
            <small>1–5 шатлалаар</small>
          </div>
          <div className={styles.kpi}>
            <span>Өндөр ба маш өндөр</span>
            <strong>{stats.high}</strong>
            <small>{pct(stats.high, stats.matchedClassified)}% сум</small>
          </div>
          <div className={styles.kpi}>
            <span>Гол аюул</span>
            <strong className={styles.kpiText}>
              {stats.lead ? hazardLabel(stats.lead.id) : "–"}
            </strong>
            <small>
              {stats.lead ? `${stats.lead.n} суманд тэргүүлсэн` : "Өгөгдөлгүй"}
            </small>
          </div>
        </section>

        <details className={`${styles.card} ${styles.dist}`} open>
          <summary>
            <span className={styles.distTitle}>
              <Icon name="chevron" size={13} />
              Сумын ангиллын тархалт
            </span>
            <span>Сумын тоо</span>
          </summary>
          {(() => {
            const top = Math.max(1, ...classes.map((c) => stats.counts[c]));
            return classes.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.distRow}
                aria-pressed={filters.classes.includes(c)}
                data-off={
                  (filters.classes.length > 0 && !filters.classes.includes(c)) ||
                  undefined
                }
                title={`${CLASS_LABELS[c]}: ${stats.counts[c]} сум (${pct(stats.counts[c], stats.classified)}%)`}
                onClick={() =>
                  update({
                    classes: filters.classes.includes(c)
                      ? filters.classes.filter((x) => x !== c)
                      : [...filters.classes, c],
                  })
                }
              >
                <span>{CLASS_LABELS[c]}</span>
                <span className={styles.distTrack}>
                  <i
                    style={{
                      width: `${(stats.counts[c] / top) * 100}%`,
                      background: colorOf(c),
                    }}
                  />
                </span>
                <b>{stats.counts[c]}</b>
              </button>
            ));
          })()}
        </details>

        {objectDist && onToggleObjectClass && (
          <ObjectClassCard
            dist={objectDist}
            selected={objectClasses}
            onToggle={onToggleObjectClass}
          />
        )}

        <section className={styles.card}>
          <h3>
            Аюулт үзэгдлээр
            <span>{modeLabel} · дундаж оноо</span>
          </h3>
          <div className={styles.hbars}>
            {byHazard.map((h) => (
              <button
                key={h.id}
                type="button"
                className={styles.hbar}
                aria-pressed={filters.hazard === h.id}
                title={`${h.label}: ${fmt(h.score)} — энэ аюулыг сонгох`}
                onClick={() => update({ hazard: h.id })}
              >
                <span className={styles.hbarLabel}>{h.label}</span>
                <span className={styles.hbarTrack}>
                  <i style={{ width: `${((h.score ?? 0) / hazMax) * 100}%` }} />
                </span>
                <b>{fmt(h.score)}</b>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3>
            {modeLabel} · элементээр
            <span>
              {filters.hazard === "all"
                ? "Бүх аюулын дээд түвшин"
                : hazardLabel(filters.hazard)}{" "}
              · сумын тоо
            </span>
          </h3>
          {exposure.length ? (
            <div className={styles.expScroll}>
              <table className={styles.exp}>
                <thead>
                  <tr>
                    <th scope="col">Элемент</th>
                    {levels.map((c) => (
                      <th key={c} scope="col" title={CLASS_LABELS[c]}>
                        <i style={{ background: colorOf(c) }} />
                        {CLASS_LABELS[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exposure.map((e) => {
                    const hasLayer = layerIds[mode].has(e.el);
                    const current =
                      filters.element === e.el ||
                      (hasLayer && overlays.includes(e.el));
                    return (
                      <tr key={e.el} aria-current={current || undefined}>
                        <th scope="row">
                          {exposureClickable || hasLayer ? (
                            <button
                              type="button"
                              className={styles.expName}
                              aria-pressed={current}
                              title={
                                current
                                  ? `${ELEMENTS[e.el]} — газрын зураг дээрээс нуух`
                                  : `${ELEMENTS[e.el]} — газрын зураг дээр харуулах`
                              }
                              onClick={() => onShowElement(e.el)}
                            >
                              {hasLayer && (
                                <Icon
                                  name="layers"
                                  size={12}
                                  style={{ marginRight: 5, verticalAlign: -2 }}
                                />
                              )}
                              {ELEMENTS[e.el]}
                            </button>
                          ) : (
                            <span className={styles.expName}>
                              {ELEMENTS[e.el]}
                            </span>
                          )}
                          <span className={styles.expBar} aria-hidden="true">
                            {levels.map((c) =>
                              e.counts[c] ? (
                                <i
                                  key={c}
                                  style={{
                                    flexGrow: e.counts[c],
                                    background: colorOf(c),
                                  }}
                                />
                              ) : null,
                            )}
                          </span>
                        </th>
                        {levels.map((c) => {
                          const n = e.counts[c];
                          const label = `${ELEMENTS[e.el]} · ${CLASS_LABELS[c]}: ${n} сум (${pct(n, e.n)}%)`;
                          const active =
                            filters.element === e.el &&
                            filters.classes.includes(c);
                          return (
                            <td key={c}>
                              {exposureClickable && n ? (
                                <button
                                  type="button"
                                  aria-pressed={active}
                                  title={`${label} — шүүх`}
                                  style={{ "--c": colorOf(c) } as React.CSSProperties}
                                  onClick={() =>
                                    onShowElement(e.el, active ? [] : [c])
                                  }
                                >
                                  {n}
                                </button>
                              ) : (
                                <span
                                  title={label}
                                  data-empty={!n || undefined}
                                  style={{ "--c": colorOf(c) } as React.CSSProperties}
                                >
                                  {n || "·"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.hint}>
              Сонгосон нутаг дэвсгэрт өртөх байдлын элементийн мэдээлэл алга.
            </p>
          )}
        </section>

        <section className={styles.card}>
          <h3>
            {modeLabel} × {otherLabel}
            <span>
              {filters.hazard === "all"
                ? "Нэгдсэн"
                : hazardLabel(filters.hazard)}{" "}
              · сумын тоо
            </span>
          </h3>
          <div className={styles.matrixWrap}>
            <span className={styles.axisY}>{modeLabel} →</span>
            <table className={styles.heat}>
              <tbody>
                {[5, 4, 3, 2, 1].map((a) => (
                  <tr key={a}>
                    <th scope="row" title={CLASS_LABELS[a]}>
                      <i style={{ background: colorOf(a) }} />
                      {a}
                    </th>
                    {[1, 2, 3, 4, 5].map((b) => {
                      const n = cross.m[a - 1][b - 1];
                      const active =
                        filters.classes.includes(a) &&
                        filters.otherClasses.includes(b);
                      return (
                        <td key={b}>
                          <button
                            type="button"
                            disabled={!crossClickable || !n}
                            aria-pressed={active}
                            style={{
                              background: n
                                ? `rgba(27, 52, 76, ${0.08 + (n / cross.max) * 0.82})`
                                : undefined,
                              color: n / cross.max > 0.45 ? "#fff" : undefined,
                            }}
                            title={`${modeLabel}: ${CLASS_LABELS[a]}, ${otherLabel}: ${CLASS_LABELS[b]} — ${n} сум`}
                            onClick={() =>
                              active
                                ? update({ classes: [], otherClasses: [] })
                                : update({ classes: [a], otherClasses: [b] })
                            }
                          >
                            {n || ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th />
                  {[1, 2, 3, 4, 5].map((b) => (
                    <th key={b} scope="col" title={CLASS_LABELS[b]}>
                      <i style={{ background: colorOf(b) }} />
                      {b}
                    </th>
                  ))}
                </tr>
              </tfoot>
            </table>
            <span className={styles.axisX}>{otherLabel} →</span>
          </div>
        </section>

        <details className={`${styles.card} ${styles.foldCard}`}>
          <summary>
            <h3>
              <span className={styles.foldTitle}>
                <Icon name="chevron" size={13} />
                Аймаг, сумын эрэмбэ
              </span>
              <span>Топ 10</span>
            </h3>
          </summary>
          <div className={styles.twoCol}>
          <section className={styles.rankCol}>
            <h4>Аймаг</h4>
            <ol className={styles.rankList}>
              {topAimags.map((a, i) => (
                <li key={a.code}>
                  <button
                    type="button"
                    aria-current={filters.aimag === a.code}
                    title={`${a.name}: ${scoreName.toLowerCase()} ${fmt(a.score)}`}
                    onClick={() => onSelectAimag(a.code)}
                  >
                    <span className={styles.rankNo}>{i + 1}</span>
                    <span className={styles.rankName}>
                      {a.name}
                      <span className={styles.rankTrack}>
                        <i
                          style={{
                            width: `${((a.score ?? 0) / aimagMax) * 100}%`,
                            background: colorOf(a.cls),
                          }}
                        />
                      </span>
                    </span>
                    <b>{fmt(a.score)}</b>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.rankCol}>
            <h4>Сум</h4>
            <ol className={styles.rankList}>
              {topSoums.map((r, i) => (
                <li key={r.fid}>
                  <button
                    type="button"
                    aria-current={
                      filters.soums.length === 1 && filters.soums[0] === r.fid
                    }
                    title={
                      filters.soums.length === 1 && filters.soums[0] === r.fid
                        ? "Сумын шүүлтүүрийг цуцлах"
                        : `${r.soum_name}, ${r.aimag_name ?? ""} — газрын зургийг энэ сумаар шүүх`
                    }
                    onClick={() => onSelectSoum(r.fid)}
                  >
                    <span className={styles.rankNo}>{i + 1}</span>
                    <span className={styles.rankName}>
                      {r.soum_name}
                      <small>{r.aimag_name ?? ""}</small>
                    </span>
                    <b>
                      <i style={{ background: colorOf(r[cf]) }} />
                      {fmt(r[sf])}
                    </b>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          </div>
        </details>
      </div>
    </aside>
  );
}
