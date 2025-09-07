// src/pages/api/stats-table.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.SUPABASE_URL!;
const service = import.meta.env.SUPABASE_SERVICE_ROLE!;
const supabase = createClient(url, service);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// helper para calcular rangos de fechas
function getRangeBounds(range: string) {
  const now = new Date();

  // usamos UTC para evitar problemas, después ajustas a NZ si prefieres
  let start: Date;
  let end: Date;

  if (range === "day") {
    start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (range === "week") {
    const day = now.getUTCDay(); // 0 = domingo
    start = new Date(now);
    start.setUTCDate(start.getUTCDate() - day);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (range === "month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else {
    // sin filtro
    start = new Date(0);
    end = new Date();
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export async function POST({ request }: { request: Request }) {
  try {
    const { page = 1, limit = 10, range, thermo, size, shift } =
      await request.json();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("v_packets_full")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // filtros
    if (thermo && thermo !== "all") query = query.eq("thermoformer_number", thermo);
    if (size && size !== "all") query = query.eq("size", size);
    if (shift && shift !== "all") query = query.eq("shift", shift);

    // rango de fechas
    if (range && range !== "all") {
      const { start, end } = getRangeBounds(range);
      query = query.gte("created_at", start).lt("created_at", end);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return json({ ok: true, data, count });
  } catch (err: any) {
    console.error("[stats-table] error:", err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}
