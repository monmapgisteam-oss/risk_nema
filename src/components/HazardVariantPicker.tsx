import { hazardLabel, type HazardZone } from "@/lib/riskConfig";
import styles from "./HazardVariantPicker.module.css";

const WIND_SPEED_FIELDS = new Set(["h03b", "h03c", "h03d", "h03e"]);

// Clear display names; layer identifiers and selection indices stay unchanged.
const OPTION_LABELS: Record<string, string> = {
  h03a: "Шуурганы бүс",
  h03f: "Салхины даралт",
  h03b: "1 жил",
  h03c: "5 жил",
  h03d: "10 жил",
  h03e: "20 жил",
  h04a: "Шуурганы бүс",
  h07b: "Борооны үер",
  h07c: "Цасны үер",
  h07a: "Гэнэтийн үер",
  h08a: "Ойн түймэр",
  h08b: "Хээрийн түймэр",
  h09b: "Тарваган тахал",
  h11a: "Аянгын бүс",
  h11b: "Аянгын эрчим",
};

type Props = {
  hazard: string;
  variants: HazardZone[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export default function HazardVariantPicker({
  hazard,
  variants,
  selectedIndex,
  onSelect,
}: Props) {
  const options = variants.map((zone, index) => ({ zone, index }));
  const isSpeed = (field: string) =>
    hazard === "ws" && WIND_SPEED_FIELDS.has(field);
  const groups = [
    {
      label: hazard === "eq" ? "Газар хөдлөлтийн эрчим" : null,
      speed: false,
      options: options.filter(({ zone }) => !isSpeed(zone.field)),
    },
    {
      label: "Салхины хурд",
      speed: true,
      options: options.filter(({ zone }) => isSpeed(zone.field)),
    },
  ].filter((group) => group.options.length > 0);

  return (
    <div
      className={styles.picker}
      role="group"
      aria-label={`${hazardLabel(hazard)}: дэд сонголт`}
    >
      {groups.map((group) => (
        <fieldset className={styles.group} key={String(group.speed)}>
          {group.label && <legend>{group.label}</legend>}
          <div className={styles.options} data-speed={group.speed || undefined}>
            {group.options.map(({ zone, index }, position) => (
              <button
                key={`${zone.layerId}:${zone.field}`}
                type="button"
                className={styles.option}
                data-wide={
                  (group.options.length % 2 === 1 && position === 0) ||
                  undefined
                }
                aria-pressed={selectedIndex === index}
                aria-label={zone.label}
                title={zone.label}
                onClick={() => onSelect(index)}
              >
                <span>{OPTION_LABELS[zone.field] ?? zone.short}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
