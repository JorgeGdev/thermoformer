// src/pages/api/stats-table.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const NZ_TZ = "Pacific/Auckland";
function nowInNZ() {
  const now = new Date();
  return new Date(now.toLocaleString("en-NZ", { timeZone: NZ_TZ }));
}
function nzRangeToUTC(range: "today" | "week" | "month") {
  const nzNow = nowInNZ();
  const offsetMs = nzNow.getTime() - new Date().getTime();

  const startNZ = new Date(nzNow);
  if (range === "today") {
    startNZ.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    const day = startNZ.getDay();
    const delta = (day + 6) % 7;
    startNZ.setDate(startNZ.getDate() - delta);
    startNZ.setHours(0, 0, 0, 0);
  } else {
    startNZ.setDate(1);
    startNZ.setHours(0, 0, 0, 0);
  }
  const endNZ = new Date(startNZ);
  if (range === "today") endNZ.setDate(endNZ.getDate() + 1);
  else if (range === "week") endNZ.setDate(endNZ.getDate() + 7);
  else endNZ.setMonth(endNZ.getMonth() + 1);

  const fromUTC = new Date(startNZ.getTime() - offsetMs);
  const toUTC = new Date(endNZ.getTime() - offsetMs);
  return { fromUTC, toUTC };
}

type Body = {
  range: "today" | "week" | "month";
  thermo: "all" | "1" | "2";
  size: "all" | 22 | 25 | 27 | 30;
  shift: "all" | "DS" | "TW" | "NS";
  page?: number; // no lo usamos, la paginación es local
  limit?: number;
};

export async function POST({ request }: { request: Request }) {
  try {
    const { range, thermo, size, shift } = (await request.json()) as Body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { fromUTC, toUTC } = nzRangeToUTC(range);

    let q = supabase
      .from("v_packets_full") // vista enriquecida
      .select("*")
      .gte("created_at", fromUTC.toISOString())
      .lt("created_at", toUTC.toISOString())
      .order("created_at", { ascending: false });

    if (thermo !== "all") q = q.eq("thermoformer_number", Number(thermo));
    if (size !== "all") q = q.eq("size", Number(size));
    if (shift !== "all") q = q.eq("shift", shift);

    // traemos “muchos” y la tabla pagina en el cliente
    const { data, error } = await q.limit(2000);
    if (error) throw error;

    return json({ ok: true, data, count: data?.length ?? 0 });
  } catch (err: any) {
    console.error("[stats-table] error:", err?.message || err);
    return json({ ok: false, error: err?.message || "stats-table error" }, 500);
  }
}
