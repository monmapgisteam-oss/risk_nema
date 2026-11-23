const BASE = "https://arcgis.ubhub.mn/arcgis/rest/services/Hosted";

export const SOUM_LAYER_URL = `${BASE}/NEMA_VulExp_bySoum_Full/FeatureServer/0`;

/** Reference boundaries (ZTHT base data): national border and aimag borders. */
const ZTHT = "https://services.arcgis.com/HJzgwvlNIXssnQar/arcgis/rest/services/ZTHT_ALL_Data/FeatureServer";
export const BORDER_URLS = {
  national: `${ZTHT}/5`,
  aimag: `${ZTHT}/11`,
} as const;
export const OVERLAY_SERVICE = {
  v: `${BASE}/Vul_risk/FeatureServer`,
  e: `${BASE}/exp_risk/FeatureServer`,
} as const;

/** Hazard zoning: per-hazard polygon layers with a 1–5 class field. */
export const HAZARD_SERVICE = `${BASE}/Hazard/FeatureServer`;
export type HazardZone = {
  layerId: number;
  /** Class field (1–5); one layer can carry several variants' fields. */
  field: string;
  label: string;
  /** Short name for the variant picker. */
  short: string;
};
/**
 * Zoning variants per hazard; the first is the default. Layers without a
 * usable 1–5 class field (6, 11, 13, 14, 27, 29) are left out.
 */
export const HAZARD_VARIANTS: Record<string, HazardZone[]> = {
  eq: [
    { layerId: 23, field: "h01a", label: "Газар хөдлөлтийн эрчим (500 жил)", short: "500 жил" },
    { layerId: 22, field: "h01b", label: "Газар хөдлөлтийн эрчим (2500 жил)", short: "2500 жил" },
  ],
  ds: [{ layerId: 24, field: "h02", label: "Шороон шуурганы бүс", short: "Эмзэг бүс" }],
  ws: [
    { layerId: 25, field: "h03a", label: "Салхин шуурганы бүс", short: "Эмзэг бүс" },
    { layerId: 17, field: "h03f", label: "Салхины даралтын эрчим", short: "Даралт" },
    { layerId: 21, field: "h03b", label: "Салхины хурд (1 жил)", short: "Хурд · 1 жил" },
    { layerId: 20, field: "h03c", label: "Салхины хурд (5 жил)", short: "Хурд · 5 жил" },
    { layerId: 19, field: "h03d", label: "Салхины хурд (10 жил)", short: "Хурд · 10 жил" },
    { layerId: 18, field: "h03e", label: "Салхины хурд (20 жил)", short: "Хурд · 20 жил" },
  ],
  ss: [
    { layerId: 26, field: "h04a", label: "Цасан шуурганы бүс", short: "Эмзэг бүс" },
    { layerId: 16, field: "h04b", label: "Цасны ачааллын эрчим", short: "Цасны ачаалал" },
  ],
  dr: [{ layerId: 15, field: "h05", label: "Гангийн бүс", short: "Эмзэг бүс" }],
  dz: [
    { layerId: 28, field: "h06b", label: "Зудын нэгдсэн бүс", short: "Нэгдсэн" },
    { layerId: 28, field: "h06a", label: "Цагаан зудын бүс", short: "Цагаан зуд" },
    { layerId: 28, field: "h06d", label: "Хар зудын бүс", short: "Хар зуд" },
  ],
  fl: [
    { layerId: 31, field: "h07d", label: "Үерийн нэгдсэн бүс", short: "Нэгдсэн" },
    { layerId: 30, field: "h07b", label: "Борооны үерийн бүс", short: "Бороо" },
    { layerId: 10, field: "h07c", label: "Цасны үерийн бүс", short: "Цас" },
    { layerId: 12, field: "h07a", label: "Гэнэтийн үерийн бүс", short: "Гэнэтийн" },
  ],
  wf: [
    { layerId: 7, field: "h08c", label: "Түймрийн нэгдсэн бүс", short: "Нэгдсэн" },
    { layerId: 9, field: "h08a", label: "Ойн түймрийн бүс", short: "Ой" },
    { layerId: 8, field: "h08b", label: "Хээрийн түймрийн бүс", short: "Хээр" },
  ],
  zd: [
    { layerId: 3, field: "h09d", label: "Зоонозын нэгдсэн бүс", short: "Нэгдсэн" },
    { layerId: 5, field: "h09b", label: "Тарваган тахлын бүс", short: "Тахал" },
    { layerId: 4, field: "h09c", label: "Галзуугийн бүс", short: "Галзуу" },
  ],
  lt: [
    { layerId: 2, field: "h11a", label: "Аянгын бүс", short: "Эмзэг бүс" },
    { layerId: 1, field: "h11b", label: "Аянгын эрчим", short: "Эрчим" },
  ],
};
/** Unique id of a zoning variant (dzud variants share one layer). */
export const zoneKey = (z: HazardZone) => `${z.layerId}:${z.field}`;

export type Mode = "v" | "e";
export const MODES: { id: Mode; label: string }[] = [
  { id: "v", label: "Эмзэг байдал" },
  { id: "e", label: "Өртөх байдал" },
];

export const HAZARDS = [
  { id: "all", label: "Нийт" },
  { id: "eq", label: "Газар хөдлөлт" },
  { id: "ds", label: "Шороон шуурга" },
  { id: "ws", label: "Салхин шуурга" },
  { id: "ss", label: "Цасан шуурга" },
  { id: "dr", label: "Ган" },
  { id: "dz", label: "Зуд" },
  { id: "fl", label: "Үер" },
  { id: "wf", label: "Түймэр" },
  { id: "zd", label: "Зооноз" },
  { id: "lt", label: "Аянга" },
] as const;
export type HazardId = (typeof HAZARDS)[number]["id"];

export const hazardLabel = (id: string) =>
  HAZARDS.find((h) => h.id === id.toLowerCase())?.label ?? id;

export const ELEMENTS: Record<string, string> = {
  com: "Суурин газар",
  hh: "Өрх",
  pop: "Хүн ам",
  hsar: "Орон сууц (талбай)",
  hsdw: "Орон сууц (төрөл)",
  edu: "Боловсрол",
  hlth: "Эрүүл мэнд",
  brdg: "Гүүр",
  culv: "Хоолой",
  gas: "ШТС",
  wh: "Агуулах",
  term: "Терминал",
  cmf: "Холбооны байгууламж",
  trf: "Дэд станц",
  cult: "Соёлын өв",
  mine: "Уурхай",
  road: "Улсын зам",
  pwr: "Цахилгааны шугам",
  comm: "Холбооны шугам",
  farm: "Тариалангийн талбай",
  past: "Бэлчээр",
  crop: "Ургац",
  crhh: "Тариаланч өрх",
  cren: "Тариалангийн ААН",
  ls: "Мал",
  ent: "Аж ахуйн нэгж",
  mnts: "Засвар үйлчилгээ",
  brdp: "Хилийн боомт",
  rail: "Төмөр зам",
};

/** Class 1–5 colours; 0 = no exposure; null = no data. */
export const CLASS_COLORS: Record<number, string> = {
  // Official NEMA risk scale colors.
  1: "#00b050", // 0, 176, 80
  2: "#92d050", // 146, 208, 80
  3: "#ffff00", // 255, 255, 0
  4: "#ffc000", // 255, 192, 0
  5: "#ff0000", // 255, 0, 0
};
export const NOEXP_COLOR = "#cfd6dd";
export const NODATA_COLOR = "#eef1f4";
export const CLASS_LABELS: Record<number, string> = {
  0: "Өртөлтгүй",
  1: "Маш бага",
  2: "Бага",
  3: "Дунд",
  4: "Өндөр",
  5: "Маш өндөр",
};

export type Overlay = {
  /** Unique within a mode; equals `el` except for the section layers. */
  id: string;
  el: string;
  layerId: number;
  geometry: "point" | "line" | "polygon";
  nameField: string;
  /** Field holding the soum code the feature was joined to ("" = none). */
  soumField: string;
  label?: string;
};

const ov = (
  el: string,
  layerId: number,
  geometry: Overlay["geometry"],
  nameField: string,
  soumField: string,
): Overlay => ({ id: el, el, layerId, geometry, nameField, soumField });
const poly = (el: string, layerId: number) =>
  ov(el, layerId, "polygon", "soumname", "soumid");

/** Every element layer of the Vul_risk and exp_risk services. */
export const OVERLAYS: Record<Mode, Overlay[]> = {
  v: [
    ov("edu", 1, "point", "name_mon", "soum_code"),
    ov("trf", 0, "point", "station_na", "soum_cod_1"),
    ov("brdg", 3, "point", "bridgename", "soum_cod_2"),
    ov("culv", 2, "point", "cul_type", "soum_cod_1"),
    ov("road", 4, "line", "roadname", "soum_cod_1"),
    {
      ...ov("road", 5, "line", "rdsec_name", ""),
      id: "road_sec",
      label: "Улсын зам (хэсэг)",
    },
    poly("com", 11),
    poly("hh", 8),
    poly("pop", 6),
    poly("farm", 9),
    poly("past", 7),
    poly("ent", 10),
  ],
  e: [
    ov("edu", 6, "point", "name_mon", "soum_code"),
    ov("hlth", 4, "point", "name", "soum_cod_1"),
    ov("trf", 0, "point", "station_na", "soum_code"),
    ov("gas", 5, "point", "name_of_st", "soum_code"),
    ov("term", 1, "point", "name_mon", "soum_code"),
    ov("cmf", 9, "point", "type", "soum_cod_1"),
    ov("cult", 8, "point", "name", "soum_code"),
    ov("mine", 3, "point", "areaname", "soum_code"),
    ov("brdg", 11, "point", "bridgename", "soum_cod_1"),
    ov("culv", 7, "point", "cul_type", "soum_cod_1"),
    ov("mnts", 2, "point", "azza_name", "soum_code"),
    ov("brdp", 10, "point", "name", "soum_code"),
    ov("road", 12, "line", "roadname", "soum_cod_2"),
    {
      ...ov("road", 13, "line", "rdsec_name", ""),
      id: "road_sec",
      label: "Улсын зам (хэсэг)",
    },
    ov("rail", 14, "line", "name", "soum_cod_1"),
    {
      ...ov("rail", 15, "line", "rwsection", ""),
      id: "rail_sec",
      label: "Төмөр зам (хэсэг)",
    },
    poly("com", 27),
    poly("hh", 21),
    poly("pop", 16),
    poly("hsar", 20),
    poly("hsdw", 19),
    poly("farm", 22),
    poly("past", 17),
    poly("crop", 24),
    poly("crhh", 25),
    poly("cren", 26),
    poly("ls", 18),
    poly("ent", 23),
  ],
};

export const overlayLabel = (o: Overlay) => o.label ?? ELEMENTS[o.el];

/** Layers offered in the panel; the road/rail section layers are hidden. */
export const panelOverlays = (mode: Mode) =>
  OVERLAYS[mode].filter((o) => !o.id.endsWith("_sec"));

/** A feature of an element layer picked on the map. */
export type Picked = {
  mode: Mode;
  overlay: Overlay;
  fid: number;
  attrs: Record<string, unknown>;
};

const CLASS_BY_NAME: Record<string, number> = {
  "very low": 1,
  low: 2,
  moderate: 3,
  high: 4,
  "very high": 5,
};

/** "4. High" / "High" / 4 → 4; anything else → null. */
export function parseClass(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = /^\s*([0-5])\s*\./.exec(v);
  if (m) return Number(m[1]);
  return CLASS_BY_NAME[v.trim().toLowerCase()] ?? null;
}

/** Soum codes that differ between the source layers and the boundary layer. */
const SOUM_CODE_FIX: Record<number, number> = { 8337: 8340 };

/** SQL filter keeping only the features of an element layer in the given soums. */
export function overlayWhere(o: Overlay, codes: number[] | null): string {
  if (!codes || !o.soumField) return "";
  if (!codes.length) return "1=0";
  const all = [...codes];
  for (const [from, to] of Object.entries(SOUM_CODE_FIX))
    if (codes.includes(to)) all.push(Number(from));
  return `${o.soumField} IN (${all.join(",")})`;
}

export function soumOfPicked(rows: SoumRow[], p: Picked): SoumRow | null {
  if (!p.overlay.soumField) return null;
  const raw = Number(p.attrs[p.overlay.soumField]);
  if (!raw) return null;
  const code = SOUM_CODE_FIX[raw] ?? raw;
  return rows.find((r) => Number(r.code) === code) ?? null;
}

export type SoumRow = Record<string, string | number | null> & { fid: number };

export type Filters = {
  mode: Mode;
  hazard: HazardId;
  element: string; // "" = hazard score
  classes: number[]; // empty = all
  otherClasses: number[]; // class of the other indicator, empty = all
  aimag: string; // aimag_code, "" = all
  soums: number[]; // selected soum fids, empty = all
  q: string;
  topHaz: string; // "" = all
  minHigh: number;
};

export const DEFAULT_FILTERS: Filters = {
  mode: "v",
  hazard: "all",
  element: "",
  classes: [],
  otherClasses: [],
  aimag: "",
  soums: [],
  q: "",
  topHaz: "",
  minHigh: 0,
};

/** Field holding the class that is drawn on the map. */
export const classField = (f: Pick<Filters, "mode" | "hazard" | "element">) =>
  f.element && f.hazard !== "all"
    ? `${f.hazard}_${f.element}_${f.mode}`
    : `${f.hazard}_${f.mode}_cls`;

export const scoreField = (f: Pick<Filters, "mode" | "hazard">) =>
  `${f.hazard}_${f.mode}_sc`;

/** Elements available per mode and hazard, derived from the layer's field names. */
export function elementCombos(row: SoumRow | undefined) {
  const out: Record<string, string[]> = {};
  if (!row) return out;
  for (const k of Object.keys(row)) {
    const m = /^([a-z]{2})_([a-z]+)_(v|e)$/.exec(k);
    if (m && ELEMENTS[m[2]]) (out[`${m[3]}:${m[1]}`] ??= []).push(m[2]);
  }
  return out;
}

export function applyFilters(rows: SoumRow[], f: Filters): SoumRow[] {
  const cf = classField(f);
  const other = `${f.hazard}_${f.mode === "v" ? "e" : "v"}_cls`;
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.classes.length && !f.classes.includes(r[cf] as number)) return false;
    if (f.otherClasses.length && !f.otherClasses.includes(r[other] as number))
      return false;
    if (f.aimag && r.aimag_code !== f.aimag) return false;
    if (f.soums.length && !f.soums.includes(r.fid)) return false;
    if (f.topHaz && r[`top_${f.mode}_haz`] !== f.topHaz) return false;
    if (f.minHigh && ((r[`n_${f.mode}_high`] as number) ?? 0) < f.minHigh)
      return false;
    if (
      q &&
      !String(r.soum_name ?? "").toLowerCase().includes(q) &&
      !String(r.s_name_eng ?? "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}
