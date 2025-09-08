// src/pages/api/stats.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";
import { nzRangeUTC, nzHourLabel } from "../../lib/nzTime";

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RangeKind = "day" | "week" | "month";
type Shift = "DS" | "TW" | "NS";
type MaybeAllNum = number | "all" | null | undefined;
type MaybeAllText = string | "all" | null | undefined;

type StatsRequest = {
  range?: RangeKind;
  thermo?: MaybeAllNum; // 1 | 2 | "all"
  size?: MaybeAllNum;   // 22|25|27|30 | "all"
  shift?: MaybeAllText; // "DS"|"TW"|"NS" | "all"
  page?: number;
  limit?: number;
};

function applyThermoFilter<T extends { eq: Function }>(
  q: T,
  thermo: MaybeAllNum
) {
  if (thermo !== undefined && thermo !== null && thermo !== "all") {
    const n = Number(thermo);
    if (!Number.isNaN(n)) {
      // @ts-ignore
      q = q.eq("thermoformer_number", n);
    }
  }
  return q;
}

function applySizeFilter<T extends { eq: Function }>(q: T, size: MaybeAllNum) {
  if (size !== undefined && size !== null && size !== "all") {
    const n = Number(size);
    if (!Number.isNaN(n)) {
      // @ts-ignore
      q = q.eq("size", n);
    }
  }
  return q;
}

function applyShiftFilter<T extends { eq: Function }>(
  q: T,
  shift: MaybeAllText
) {
  if (shift && shift !== "all") {
    // @ts-ignore
    q = q.eq("shift", shift);
  }
  return q;
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as StatsRequest;

    const range: RangeKind = (body.range as RangeKind) ?? "day";
    const thermo = body.thermo ?? "all";
    const size = body.size ?? "all";
    const shift = (body.shift as MaybeAllText) ?? "all";

    const page = Math.max(1, Number(body.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(body.limit ?? 20)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Rango NZ en UTC
    const { start, end } = nzRangeUTC(range);

    // ---------- 1) KPIs: packets total ----------
    let packetsQ = supabase
      .from("packets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end);

    packetsQ = applyThermoFilter(packetsQ, thermo);
    packetsQ = applySizeFilter(packetsQ, size);
    packetsQ = applyShiftFilter(packetsQ, shift);

    const packetsRes = await packetsQ;
    const packetsTotal = packetsRes.count ?? 0;

    // ---------- 2) Pallets abiertos en rango ----------
    let palletsOpenedQ = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .gte("opened_at", start)
      .lt("opened_at", end);

    palletsOpenedQ = applyThermoFilter(palletsOpenedQ, thermo);
    palletsOpenedQ = applySizeFilter(palletsOpenedQ, size);

    const palletsOpenedRes = await palletsOpenedQ;
    const palletsOpened = palletsOpenedRes.count ?? 0;

    // ---------- 3) Pallets cerrados en rango ----------
    let palletsClosedQ = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .not("closed_at", "is", null)
      .gte("closed_at", start)
      .lt("closed_at", end);

    palletsClosedQ = applyThermoFilter(palletsClosedQ, thermo);
    palletsClosedQ = applySizeFilter(palletsClosedQ, size);

    const palletsClosedRes = await palletsClosedQ;
    const palletsClosed = palletsClosedRes.count ?? 0;

    // ---------- 4) Hourly (en NZ) ----------
    let hourlyQ = supabase
      .from("packets")
      .select("created_at")
      .gte("created_at", start)
      .lt("created_at", end);

    hourlyQ = applyThermoFilter(hourlyQ, thermo);
    hourlyQ = applySizeFilter(hourlyQ, size);
    hourlyQ = applyShiftFilter(hourlyQ, shift);

    const hourlyRes = await hourlyQ;

    const byHour = new Map<string, number>();
    for (let h = 0; h < 24; h++) byHour.set(String(h).padStart(2, "0"), 0);

    (hourlyRes.data ?? []).forEach((r) => {
      const hh = nzHourLabel(r.created_at as string); // '00'..'23' en NZ
      byHour.set(hh, (byHour.get(hh) ?? 0) + 1);
    });

    const hourly = Array.from(byHour.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // ---------- 5) Tabla detallada (con paginación) ----------
    let tableQ = supabase
      .from("packets")
      .select(
        "id, iso_number, size, shift, thermoformer_number, raw_materials, batch_number, box_number, packet_index, iso_date, created_at, pallet_id, pallets(pallet_number)",
        { count: "exact" }
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .range(from, to);

    tableQ = applyThermoFilter(tableQ, thermo);
    tableQ = applySizeFilter(tableQ, size);
    tableQ = applyShiftFilter(tableQ, shift);

    const tableRes = await tableQ;
    if (tableRes.error) throw tableRes.error;

    const total = tableRes.count ?? 0;

    const rows = (tableRes.data ?? []).map((r: any) => {
      const pallet_number =
        Array.isArray(r.pallets) && r.pallets.length
          ? r.pallets[0].pallet_number
          : null;

      const dt = new Date(r.created_at);
      const dateNZ = new Intl.DateTimeFormat("en-NZ", {
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dt);
      const hourNZ = new Intl.DateTimeFormat("en-NZ", {
        timeZone: "Pacific/Auckland",
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dt);

      return {
        id: r.id,
        iso_number: r.iso_number,
        thermoformer_number: r.thermoformer_number,
        raw_materials: r.raw_materials,
        batch_number: r.batch_number,
        box_number: r.box_number,
        size: r.size,
        shift: r.shift,
        pallet: pallet_number,
        packet_index: r.packet_index, // 1..24
        iso_date: r.iso_date,
        date: dateNZ,
        hour: hourNZ,
      };
    });

    return json({
      ok: true,
      kpis: { packetsTotal, palletsOpened, palletsClosed },
      hourly,
      table: { rows, total, page, limit },
      range: { start, end }, // útil para debug de fronteras NZ→UTC
    });
  } catch (err: any) {
    console.error("[stats] error:", err?.message);
    return json({ ok: false, error: err?.message ?? "stats error" }, 500);
  }
}
