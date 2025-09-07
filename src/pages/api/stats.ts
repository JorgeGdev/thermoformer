// src/pages/api/stats.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE!
);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Range = "day" | "week" | "month";
type Thermo = "1" | "2" | "all";
type Size = 22 | 25 | 27 | 30 | "all";
type Shift = "DS" | "TW" | "NS" | "all";

/** Calcula el rango en UTC */
function rangeUTC(range: Range) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (range === "day") {
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (range === "week") {
    const dow = now.getUTCDay(); // domingo=0
    start.setUTCDate(now.getUTCDate() - dow);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
  return { startUTC: start, endUTC: end };
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const thermo: Thermo = body?.thermo ?? "1";
    const range: Range = body?.range ?? "day";
    const size: Size = body?.size ?? "all";
    const shift: Shift = body?.shift ?? "all";
    const page = Number(body?.page ?? 1);
    const limit = Math.min(Math.max(Number(body?.limit ?? 50), 10), 200);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { startUTC, endUTC } = rangeUTC(range);

    // 1) Query base
    let q = supabase
      .from("v_packets_full")
      .select(
        `id, iso_number, size, shift, thermoformer_number,
         raw_materials, batch_number, box_number,
         packet_index, pallet_number, iso_date, created_at`,
        { count: "exact" }
      )
      .gte("created_at", startUTC.toISOString())
      .lt("created_at", endUTC.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to);

    if (thermo === "1" || thermo === "2") q = q.eq("thermoformer_number", Number(thermo));
    if (size !== "all") q = q.eq("size", Number(size));
    if (shift !== "all") q = q.eq("shift", shift);

    const { data: rows, error, count } = await q;
    if (error) return json({ error: error.message }, 500);

    // 2) KPIs
    const packetsTotal = count ?? 0;

    let palletsOpenedQ = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .gte("opened_at", startUTC.toISOString())
      .lt("opened_at", endUTC.toISOString());

    let palletsClosedQ = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .gte("closed_at", startUTC.toISOString())
      .lt("closed_at", endUTC.toISOString());

    if (thermo === "1" || thermo === "2") {
      palletsOpenedQ = palletsOpenedQ.eq("thermoformer_number", Number(thermo));
      palletsClosedQ = palletsClosedQ.eq("thermoformer_number", Number(thermo));
    }

    const [pOpen, pClosed] = await Promise.all([palletsOpenedQ, palletsClosedQ]);

    const kpis = {
      packetsTotal,
      palletsOpenedInRange: pOpen.count ?? 0,
      palletsClosedInRange: pClosed.count ?? 0,
    };

    // 3) Gráficos (convertimos UTC → NZ solo para mostrar)
    const byHour: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byShift: Record<string, number> = {};

    for (const r of rows ?? []) {
      const nz = new Date(new Date(r.created_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" }));
      const hour = String(nz.getHours()).padStart(2, "0");
      byHour[hour] = (byHour[hour] ?? 0) + 1;

      const day = nz.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;

      const s = r.shift || "UNK";
      byShift[s] = (byShift[s] ?? 0) + 1;
    }

    const hourly = Object.keys(byHour).sort().map((h) => ({ hour: h, count: byHour[h] }));
    const daily = Object.keys(byDay).sort().map((d) => ({ day: d, count: byDay[d] }));
    const shifts = Object.keys(byShift).map((s) => ({ shift: s, count: byShift[s] }));

    // 4) Tabla
    const table = (rows ?? []).map((r) => {
      const nz = new Date(new Date(r.created_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" }));
      const date = nz.toISOString().slice(0, 10);
      const time = nz.toTimeString().slice(0, 5);
      return {
        iso_number: r.iso_number,
        thermoformer_number: r.thermoformer_number,
        raw_materials: r.raw_materials,
        batch_number: r.batch_number,
        box_number: r.box_number,
        size: r.size,
        shift: r.shift,
        pallet: r.pallet_number ?? null,
        packet_of_24: `${r.packet_index}/24`,
        date,
        time,
      };
    });

    return json({
      ok: true,
      kpis,
      charts: { hourly, daily, shifts },
      table,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        pages: Math.ceil((count ?? 0) / limit),
        startUTC: startUTC.toISOString(),
        endUTC: endUTC.toISOString(),
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "stats error" }, 500);
  }
}
