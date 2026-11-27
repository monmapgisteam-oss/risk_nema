"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CLASS_COLORS, CLASS_LABELS, NOEXP_COLOR } from "@/lib/riskConfig";
import Icon from "./Icon";
import styles from "./ClassPicker.module.css";

type Props = {
  value: number[];
  onChange: (classes: number[]) => void;
  withZero?: boolean;
};

export default function ClassPicker({ value, onChange, withZero }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const classes = withZero ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
  const label =
    value.length === 0
      ? "Бүх ангилал"
      : value.length === 1
        ? CLASS_LABELS[value[0]]
        : `${value.length} ангилал`;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      className={styles.picker}
      ref={root}
      onBlur={(event) => {
        // Clicking an option's name moves focus nowhere (relatedTarget null);
        // only close when focus goes to another control. Outside clicks are
        // handled by the pointerdown listener.
        const next = event.relatedTarget;
        if (next && !event.currentTarget.contains(next)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={`Үнэлгээний ангилал: ${label}`}
        aria-expanded={open}
        aria-controls={open ? optionsId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.selection}>
          {value.length === 1 && (
            <i
              className={styles.dot}
              aria-hidden="true"
              style={{
                background: value[0] ? CLASS_COLORS[value[0]] : NOEXP_COLOR,
              }}
            />
          )}
          <span>{label}</span>
        </span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div
          id={optionsId}
          className={styles.popover}
          role="group"
          aria-label="Үнэлгээний ангилал сонгох"
        >
          {classes.map((classification) => (
            <label className={styles.option} key={classification}>
              <input
                type="checkbox"
                checked={value.includes(classification)}
                onChange={() =>
                  onChange(
                    value.includes(classification)
                      ? value.filter((item) => item !== classification)
                      : [...value, classification],
                  )
                }
              />
              <i
                className={styles.dot}
                aria-hidden="true"
                style={{
                  background: classification
                    ? CLASS_COLORS[classification]
                    : NOEXP_COLOR,
                }}
              />
              <span>{CLASS_LABELS[classification]}</span>
            </label>
          ))}
          {value.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                onChange([]);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Ангилал цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  );
}
