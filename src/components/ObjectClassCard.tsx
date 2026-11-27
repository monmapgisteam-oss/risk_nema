"use client";

import { CLASS_LABELS, overlayLabel } from "@/lib/riskConfig";
import type { ObjectBucket } from "@/lib/objectClass";
import { colorOf } from "@/lib/stats";
import type { ObjectDistributionState } from "./useObjectDistribution";
import Icon from "./Icon";
import styles from "./DashboardDrawer.module.css";

type Props = {
  dist: ObjectDistributionState;
  /** Chosen class buckets (empty = all objects on the map). */
  selected: ObjectBucket[];
  onToggle: (bucket: ObjectBucket) => void;
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/**
 * Objects of the layers on the map per class, counted like the map draws
 * them. Rows filter the objects on the map (several can be chosen).
 */
export default function ObjectClassCard({ dist, selected, onToggle }: Props) {
  const { layers, data, error } = dist;
  if (!layers.length) return null;

  return (
    <details className={`${styles.card} ${styles.dist}`} open>
      <summary>
        <span className={styles.distTitle}>
          <Icon name="chevron" size={13} />
          Объектын ангиллын тархалт
        </span>
        <span>Объектын тоо</span>
      </summary>
      {error ? (
        <p className={styles.objNote}>Объектын өгөгдөл ачаалагдсангүй.</p>
      ) : !data ? (
        <p className={styles.objNote}>Ачаалж байна…</p>
      ) : (
        layers.map((o) => {
          const d = data[o.id];
          if (!d) return null;
          const levels: ObjectBucket[] =
            o.geometry === "polygon"
              ? ["1", "2", "3", "4", "5", "0"]
              : ["1", "2", "3", "4", "5"];
          const rows = [
            ...levels.map((b) => ({
              bucket: b,
              label: CLASS_LABELS[Number(b)],
              n: d.counts[Number(b)],
              color: colorOf(Number(b)),
            })),
            ...(d.noData
              ? [
                  {
                    bucket: "nd" as ObjectBucket,
                    label: "Өгөгдөлгүй",
                    n: d.noData,
                    color: colorOf(null),
                  },
                ]
              : []),
          ];
          const top = Math.max(1, ...rows.map((r) => r.n));
          return (
            <div key={o.id} className={styles.objLayer}>
              <span className={styles.objLayerName}>
                {overlayLabel(o)}
                <small>{d.total} объект</small>
              </span>
              {!d.classified ? (
                <p className={styles.objNote}>Энэ аюулаар ангилагдаагүй.</p>
              ) : (
                rows.map((r) => {
                  const on = selected.includes(r.bucket);
                  return (
                    <button
                      key={r.bucket}
                      type="button"
                      className={styles.distRow}
                      aria-pressed={on}
                      data-off={(selected.length > 0 && !on) || undefined}
                      title={`${overlayLabel(o)} · ${r.label}: ${r.n} объект (${pct(r.n, d.total)}%) — газрын зураг дээр шүүх`}
                      onClick={() => onToggle(r.bucket)}
                    >
                      <span>{r.label}</span>
                      <span className={styles.distTrack}>
                        <i
                          style={{
                            width: `${(r.n / top) * 100}%`,
                            background: r.color,
                          }}
                        />
                      </span>
                      <b>{r.n}</b>
                    </button>
                  );
                })
              )}
            </div>
          );
        })
      )}
    </details>
  );
}
