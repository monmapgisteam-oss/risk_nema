"use client";

import { useEffect, useState } from "react";
import {
  CLASS_LABELS,
  HAZARDS,
  HAZARD_SERVICE,
  hazardLabel,
  zoneKey,
  type HazardZone,
} from "@/lib/riskConfig";
import { colorOf } from "@/lib/stats";
import aimagAreas from "@/data/hazardAimagAreas.json";
import Icon from "./Icon";
import styles from "./HazardStats.module.css";

const CLASSES = [1, 2, 3, 4, 5];

type Areas = Record<number, number>;

type AimagAreas = { code: string; name: string; km2: number[] };

/** km² per zoning class, summed on the server; one request per layer. */
const cache = new Map<string, Promise<Areas>>();

function loadAreas(zone: HazardZone): Promise<Areas> {
  const key = zoneKey(zone);
  let p = cache.get(key);
  if (!p) {
    const params = new URLSearchParams({
      where: "1=1",
      groupByFieldsForStatistics: zone.field,
      outStatistics: JSON.stringify([
        {
          statisticType: "sum",
          onStatisticField: "area_km2",
          outStatisticFieldName: "km2",
        },
      ]),
      f: "json",
    });
    p = fetch(`${HAZARD_SERVICE}/${zone.layerId}/query?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error || !Array.isArray(d.features)) throw new Error("query");
        const out: Areas = {};
        for (const { attributes: a } of d.features) {
          const cls = Number(a[zone.field]);
          out[cls] = (out[cls] ?? 0) + (Number(a.km2) || 0);
        }
        return out;
      });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const km2 = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const pct = (n: number) => (n >= 10 || n === 0 ? n.toFixed(1) : n.toFixed(2));

/** Area and share per class: one row per zoning class. */
function ClassTable({ values, share }: { values: number[]; share: number[] }) {
  return (
    <table
      className={styles.table}
      aria-label="Ангилал тус бүрийн талбай ба эзлэх хувь"
    >
      <colgroup>
        <col className={styles.classColumn} />
        <col className={styles.areaColumn} />
        <col className={styles.shareColumn} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Ангилал</th>
          <th scope="col">Талбай, км²</th>
          <th scope="col">Эзлэх хувь</th>
        </tr>
      </thead>
      <tbody>
        {CLASSES.map((c, i) => (
          <tr key={c}>
            <th scope="row">
              <span className={styles.classLabel}>
                <i
                  style={{ background: colorOf(c) }}
                  aria-hidden="true"
                />
                {CLASS_LABELS[c]}
              </span>
              <span className={styles.track} aria-hidden="true">
                <i
                  style={{
                    width: `${share[i]}%`,
                    background: colorOf(c),
                  }}
                />
              </span>
            </th>
            <td className={styles.areaValue}>{km2(values[i])}</td>
            <td>
              <span className={styles.shareValue}>
                {pct(share[i])}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = {
  zone: HazardZone;
  hazard: string;
  /** Aimag whose class table is open (and outlined on the map). */
  openAimag: string | null;
  /** Opens an aimag (zooming the map to it), or closes it with null. */
  onOpenAimag: (code: string | null) => void;
};

export default function HazardStats({
  zone,
  hazard,
  openAimag,
  onOpenAimag,
}: Props) {
  const [state, setState] = useState<{
    id: string;
    areas: Areas | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    loadAreas(zone).then(
      (areas) => live && setState({ id: zoneKey(zone), areas }),
      () => live && setState({ id: zoneKey(zone), areas: null }),
    );
    return () => {
      live = false;
    };
  }, [zone]);

  // Precomputed by scripts/hazard_aimag_areas.py (zoning clipped by aimag).
  const aimagRows = (
    (aimagAreas.zones as Record<string, AimagAreas[]>)[zoneKey(zone)] ?? []
  )
    .map((r) => {
      const sum = r.km2.reduce((s, v) => s + v, 0);
      const shares = r.km2.map((v) => (sum ? (v / sum) * 100 : 0));
      return { ...r, sum, shares, high: shares[3] + shares[4] };
    })
    .filter((r) => r.sum > 0)
    .sort((a, b) => b.high - a.high);

  const ready = state?.id === zoneKey(zone);
  const areas = ready ? state.areas : null;
  const values = CLASSES.map((c) => areas?.[c] ?? 0);
  const total = values.reduce((s, v) => s + v, 0);
  const share = values.map((v) => (total ? (v / total) * 100 : 0));
  const status = !ready
    ? "Ачаалж байна…"
    : !areas
      ? "Өгөгдөл ачаалагдсангүй"
      : null;
  const hazardIcon = HAZARDS.find((h) => h.id === hazard)?.id ?? "chart";

  return (
    <section
      className={styles.panel}
      aria-label="Аюулын бүсчлэл"
      aria-busy={!ready}
    >
      <header className={styles.header}>
        <span className={styles.hazardIcon}>
          <Icon name={hazardIcon} size={19} />
        </span>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Аюулын бүсчлэл · {zone.short}</p>
          <h2>{hazardLabel(hazard)}</h2>
        </div>
        <span className={styles.scope}>
          <Icon name="pin" size={12} />
          Монгол Улс
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.overview}>
          <div className={styles.overviewLabel}>
            <span>Аюулын бүсийн нийт талбай</span>
          </div>
          <div className={styles.total} aria-live="polite" aria-atomic="true">
            <Icon name="map" size={16} />
            <strong>{status ? "—" : km2(total)}</strong>
            <span>км²</span>
          </div>
        </div>

        <details className={styles.distribution} open>
          <summary>
            <span className={styles.sectionTitle}>
              <Icon name="chevron" size={13} />
              Ангиллын тархалт
            </span>
            <span className={styles.classCount}>5 ангилал</span>
          </summary>
          {status ? (
            <p className={styles.status} role="status">
              <Icon name={ready ? "info" : "chart"} size={17} />
              {status}
            </p>
          ) : (
            <>
              {total > 0 ? (
                <div className={styles.shareOverview}>
                  <div className={styles.shareCaption}>
                    <span>Нийт талбайд эзлэх хувь</span>
                    <span>100%</span>
                  </div>
                  <div className={styles.stack} aria-hidden="true">
                    {CLASSES.map((c, i) =>
                      share[i] > 0 ? (
                        <i
                          key={c}
                          title={`${CLASS_LABELS[c]}: ${pct(share[i])}%`}
                          style={{ flexGrow: share[i], background: colorOf(c) }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              ) : (
                <p className={styles.empty}>
                  Бүртгэгдсэн талбай байхгүй байна.
                </p>
              )}
              <ClassTable values={values} share={share} />
            </>
          )}
        </details>

        <details className={styles.distribution} open>
          <summary>
            <span className={styles.sectionTitle}>
              <Icon name="chevron" size={13} />
              Аймгаар
            </span>
            <span className={styles.classCount}>
              {aimagRows.length ? `${aimagRows.length} аймаг` : "аймаг"}
            </span>
          </summary>
          {aimagRows.length ? (
            <div className={styles.aimagList}>
              <div className={styles.aimagHead}>
                <span>Аймаг</span>
                <span>Ангиллын тархалт</span>
              </div>
              {aimagRows.map((r) => {
                const open = openAimag === r.code;
                return (
                  <div key={r.code} className={styles.aimagItem}>
                    <button
                      type="button"
                      className={styles.aimagRow}
                      aria-expanded={open}
                      onClick={() => onOpenAimag(open ? null : r.code)}
                    >
                      <span className={styles.aimagName}>{r.name}</span>
                      <span className={styles.stack} aria-hidden="true">
                        {CLASSES.map((c, i) =>
                          r.shares[i] > 0 ? (
                            <i
                              key={c}
                              style={{
                                flexGrow: r.shares[i],
                                background: colorOf(c),
                              }}
                            />
                          ) : null,
                        )}
                      </span>
                    </button>
                    {open && (
                      <div className={styles.aimagDetail}>
                        <ClassTable values={r.km2} share={r.shares} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>Өгөгдөлгүй</p>
          )}
        </details>
      </div>
    </section>
  );
}
