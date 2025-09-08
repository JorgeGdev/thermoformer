// src/lib/nzTime.ts
const TZ = "Pacific/Auckland";

/** Convierte un Date real a sus componentes *locales NZ*. */
function nzParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const obj = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value])
  ) as any;
  return {
    year: Number(obj.year),
    month: Number(obj.month), // 01-12
    day: Number(obj.day),     // 01-31
    hour: Number(obj.hour),
    minute: Number(obj.minute),
    second: Number(obj.second),
  };
}

/** Devuelve el índice de día de la semana en NZ ('sun'..'sat'). */
function nzWeekdayStr(d = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  })
    .format(d)
    .toLowerCase(); // 'sun'...'sat'
}

/** Construye un Date UTC a partir de una fecha *local NZ* (YYYY,MM,DD hh:mm:ss). */
function dateUTCFromNZ(
  y: number,
  m1_12: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0
) {
  // m1_12 es 1..12; en Date.UTC el mes es 0..11
  return new Date(Date.UTC(y, m1_12 - 1, d, h, mi, s));
}

/** Rango [startUTC, endUTC) para el *día* NZ actual. */
export function nzDayRangeUTC(now = new Date()) {
  const { year, month, day } = nzParts(now);
  const start = dateUTCFromNZ(year, month, day, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Rango [startUTC, endUTC) para la *semana* NZ actual (lunes→domingo). */
export function nzWeekRangeUTC(now = new Date()) {
  const wd = nzWeekdayStr(now); // 'sun'...'sat'
  const map: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };
  const idx = map[wd];
  // queremos lunes como inicio ⇒ delta días desde *lunes*
  const deltaFromMonday = (idx + 6) % 7;

  const p = nzParts(now);
  let startNZ = dateUTCFromNZ(p.year, p.month, p.day, 0, 0, 0);
  startNZ.setUTCDate(startNZ.getUTCDate() - deltaFromMonday);

  const endNZ = new Date(startNZ);
  endNZ.setUTCDate(endNZ.getUTCDate() + 7);

  return { start: startNZ.toISOString(), end: endNZ.toISOString() };
}

/** Rango [startUTC, endUTC) para el *mes* NZ actual. */
export function nzMonthRangeUTC(now = new Date()) {
  const { year, month } = nzParts(now);
  const start = dateUTCFromNZ(year, month, 1, 0, 0, 0);
  const end = dateUTCFromNZ(year, month + 1, 1, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Helper general: 'day' | 'week' | 'month' en NZ → [startUTC,endUTC) */
export function nzRangeUTC(kind: "day" | "week" | "month", now = new Date()) {
  if (kind === "day") return nzDayRangeUTC(now);
  if (kind === "week") return nzWeekRangeUTC(now);
  return nzMonthRangeUTC(now);
}

/** Formatea una fecha ISO/UTC a 'HH' *en NZ*, para agrupar por hora. */
export function nzHourLabel(isoUtc: string) {
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(d); // '00'..'23'
}
