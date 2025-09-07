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

// Convierte rango a [start, end] en JS Date (UTC ISO para la DB)
function rangeToDates(range: Range) {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  if (range === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    // Lunes como inicio de semana (ajusta si prefieres domingo)
    const day = (now.getDay() + 6) % 7; // 0..6 -> lunes=0
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const thermo: Thermo = (body?.thermo ?? "1") as Thermo;
    const range: Range = (body?.range ?? "day") as Range;

    const { start, end } = rangeToDates(range);

    // -----------------------------
    // 1) Datos base para charts/tabla
    // -----------------------------
    let packetsQuery = supabase
      .from("v_packets_full")
      .select(
        `
        id,
        iso_number,
        size,
        shift,
        thermoformer_number,
        raw_materials,
        batch_number,
        box_number,
        packet_index,
        pallet_number,
        iso_date,
        created_at
      `
      )
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true });

    if (thermo === "1" || thermo === "2") {
      packetsQuery = packetsQuery.eq("thermoformer_number", Number(thermo));
    }

    const { data: rows, error: rowsError } = await packetsQuery;
    if (rowsError) {
      console.error("[stats] packets query error:", rowsError);
      return json({ error: rowsError.message }, 500);
    }

    // -----------------------------
    // 2) KPIs
    // -----------------------------
    const packetsTotal = rows?.length ?? 0;

    // Pallets activos / cerrados — si filtras por thermo, aplicamos el mismo filtro
    let palletsActiveQuery = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .is("closed_at", null);

    let palletsClosedQuery = supabase
      .from("pallets")
      .select("id", { count: "exact", head: true })
      .not("closed_at", "is", null);

    if (thermo === "1" || thermo === "2") {
      palletsActiveQuery = palletsActiveQuery.eq("thermoformer_number", Number(thermo));
      palletsClosedQuery = palletsClosedQuery.eq("thermoformer_number", Number(thermo));
    }

    const [{ count: activeCount }, { count: closedCount }] = await Promise.all([
      palletsActiveQuery,
      palletsClosedQuery,
    ]);

    const kpis = {
      packetsTotal,
      palletsActive: activeCount ?? 0,
      palletsClosed: closedCount ?? 0,
    };

    // -----------------------------
    // 3) Datasets para gráficos
    // -----------------------------

    // 3.a) Por hora (útil en "day", pero funciona para cualquier rango)
    const byHour: Record<string, number> = {};
    for (const r of rows ?? []) {
      const d = new Date(r.created_at);
      const hour = d.getHours().toString().padStart(2, "0");
      byHour[hour] = (byHour[hour] ?? 0) + 1;
    }
    const hourly = Object.keys(byHour)
      .sort()
      .map((h) => ({ hour: h, count: byHour[h] }));

    // 3.b) Por día (YYYY-MM-DD)
    const byDay: Record<string, number> = {};
    for (const r of rows ?? []) {
      const d = new Date(r.created_at);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = (byDay[key] ?? 0) + 1;
    }
    const daily = Object.keys(byDay)
      .sort()
      .map((d) => ({ day: d, count: byDay[d] }));

    // 3.c) Por shift (DS/TW/NS)
    const byShift: Record<string, number> = {};
    for (const r of rows ?? []) {
      const s = r.shift || "UNK";
      byShift[s] = (byShift[s] ?? 0) + 1;
    }
    const shifts = Object.keys(byShift).map((s) => ({ shift: s, count: byShift[s] }));

    // -----------------------------
    // 4) Tabla detallada
    // -----------------------------
    const table = (rows ?? []).map((r) => ({
      iso_number: r.iso_number,
      thermoformer_number: r.thermoformer_number,
      raw_materials: r.raw_materials,
      batch_number: r.batch_number,
      box_number: r.box_number,
      size: r.size,
      shift: r.shift,
      pallet: r.pallet_number ?? null,         // 👈 ya viene plano de la vista
      packet_of_24: `${r.packet_index}/24`,
      date: new Date(r.created_at).toISOString().slice(0, 10),
      time: new Date(r.created_at).toTimeString().slice(0, 5),
    }));

    return json({
      ok: true,
      kpis,
      charts: { hourly, daily, shifts },
      table,
    });
  } catch (e: any) {
    console.error("[stats] unexpected:", e?.message);
    return json({ error: e?.message ?? "stats error" }, 500);
  }
}
