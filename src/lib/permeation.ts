export type PipeCategory =
  | "barrier-area"   // расчёт по площади: mg/(m²·day)
  | "nonbarrier-vol" // расчёт по объёму воды: g/(m³·day)
  | "airtight";      // пренебрегаем диффузией

export interface Material {
  id: string;
  name: string;
  category: PipeCategory;
  note?: string;
  // Для барьерных (по площади): две опорные точки
  rateArea40_mg_m2_day?: number; // @40°C
  rateArea80_mg_m2_day?: number; // @80°C
  // Для небарьерных (по объёму): опорная точка
  rateVol40_g_m3_day?: number;   // @40°C
}

export const MATERIALS: Material[] = [
  // Барьерные EVOH (площадная модель, опорные точки 40°C / 80°C)
  {
    id: "pex-pert-evoh-3",
    name: "PEX/PE-RT, 3-сл. (тонкий EVOH)",
    category: "barrier-area",
    rateArea40_mg_m2_day: 0.20, // в диапазоне 0.10–0.30
    rateArea80_mg_m2_day: 2.0,  // в диапазоне 1.0–3.0
  },
  {
    id: "pex-pert-evoh-5",
    name: "PEX/PE-RT, 5-сл. (усиленный EVOH)",
    category: "barrier-area",
    rateArea40_mg_m2_day: 0.06, // в диапазоне 0.02–0.10
    rateArea80_mg_m2_day: 0.7,  // в диапазоне 0.2–1.2
  },
  {
  },
  // Небарьерные (объёмная модель @40°C)
  { id: "pex-a", name: "PEX-a (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 5 }, // 3–7
  { id: "pex-b", name: "PEX-b (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 5 }, // 3–7
  { id: "pex-c", name: "PEX-c (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 5 }, // 3–7
  { id: "pert-i", name: "PE-RT I (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 6 }, // 4–8
  { id: "pert-ii", name: "PE-RT II (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 6 }, // 4–8
  { id: "ppr", name: "PP-R (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 0.8 }, // 0.3–1.2
  // ppr-faser убран из выбора
  { id: "hdpe", name: "ПНД / HDPE (без барьера)", category: "nonbarrier-vol", rateVol40_g_m3_day: 7 }, // 4–10
  // pb1 без EVOH убран из выбора
  // Полностью кислородонепроницаемые
  { id: "mlc", name: "PEX-AL-PEX / MLC (с алюминием)", category: "airtight" },
  { id: "metal", name: "Металл (сталь/медь)", category: "airtight" },
];

export interface Inputs {
  materialId: string;
  temperatureC: number;     // средняя рабочая
  length_m: number;         // длина одного контура
  loops: number;            // число контуров
  od_mm: number;            // наружный диаметр
  wall_mm: number;          // толщина стенки
  useManualVolume: boolean; // вручную задать объём системы
  systemVolume_m3?: number; // если вручную
  days: number;             // горизонт расчёта
}

export interface Outputs {
  mass_g_total: number;    // масса O₂ за период
  mass_g_per_year: number; // экстраполировано к году
  volume_L_STP: number;    // объём газа при Н.У.
  volume_L_STP_day: number; // объём газа при Н.У. в сутки
  iron_oxidized_g: number; // эквивалентная масса Fe
  rv_g_m3_day: number | null; // приведённая скор. g/(m³·day) на 40°C-экв.
  risk: "Low" | "Medium" | "High" | "None";
  warnings: string[];
}

const DAYS_PER_YEAR = 365;
const PI = Math.PI;

const scaleFactor_T = (T: number, r40: number, r80: number) => {
  // Лог-линейная (экспоненциальная) зависимость; для T<40 и T>80 используем экстраполяцию
  const k = Math.log(r80 / r40) / (80 - 40);
  return Math.exp(k * (T - 40));
};

export function compute(inputs: Inputs): Outputs {
  const mat = MATERIALS.find(m => m.id === inputs.materialId)!;
  const Ltot = inputs.length_m * Math.max(1, inputs.loops);
  const Do = inputs.od_mm / 1000; // m
  const t = inputs.wall_mm / 1000; // m
  const Di = Math.max(Do - 2 * t, 0.0001);
  const area = PI * Do * Ltot; // внешняя площадь, м²
  const volGeom = (PI * (Di ** 2) / 4) * Ltot; // м³
  const Vsys = inputs.useManualVolume && inputs.systemVolume_m3 ? inputs.systemVolume_m3 : volGeom;

  const warn: string[] = [];
  if (inputs.temperatureC < 40 || inputs.temperatureC > 80) {
    warn.push("Температура вне диапазона опорных данных (40–80 °C): используется экстраполяция.");
  }

  let m_g_day = 0; // масса O2 в день

  if (mat.category === "airtight") {
    m_g_day = 0;
  } else if (mat.category === "barrier-area" && mat.rateArea40_mg_m2_day && mat.rateArea80_mg_m2_day) {
    const fT = scaleFactor_T(inputs.temperatureC, mat.rateArea40_mg_m2_day, mat.rateArea80_mg_m2_day);
    const rate_mg_m2_day = mat.rateArea40_mg_m2_day * fT;
    m_g_day = (rate_mg_m2_day * area) / 1000; // mg→g
  } else if (mat.category === "nonbarrier-vol" && mat.rateVol40_g_m3_day) {
    // Масштабируем температурой, используя тот же профиль, что и для EVOH (0.32→3.60)
    const fT = scaleFactor_T(inputs.temperatureC, 0.32, 3.60);
    const rate_g_m3_day = mat.rateVol40_g_m3_day * fT;
    m_g_day = rate_g_m3_day * (Vsys > 0 ? Vsys : volGeom);
  }

  const m_g_total = m_g_day * inputs.days;
  const m_g_year = m_g_day * DAYS_PER_YEAR;
  const vol_L_STP = (m_g_year / 32) * 22.414;
  const vol_L_STP_day = (m_g_day / 32) * 22.414;
  const m_fe_g = m_g_year * (223.38 / 96); // 2.327 г Fe / г O2

  // Приведённая скорость на единицу объёма
  const rv = Vsys > 0 ? (m_g_year / DAYS_PER_YEAR) / Vsys : null; // g/(m³·day)

  // Риск по DIN 4726 (порог 0.1 г/(м³·сут) при 40 °C)
  let risk: Outputs["risk"] = "None";
  if (mat.category !== "airtight") {
    if (rv !== null && rv > 0.1) risk = "High";
    else if (rv !== null && rv > 0.05) risk = "Medium";
    else risk = "Low";
  }

  return {
    mass_g_total: m_g_total,
    mass_g_per_year: m_g_year,
    volume_L_STP: vol_L_STP,
    volume_L_STP_day: vol_L_STP_day,
    iron_oxidized_g: m_fe_g,
    rv_g_m3_day: rv,
    risk,
    warnings: warn,
  };
}


