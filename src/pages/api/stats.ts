// src/pages/api/stats.ts
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

// ---- Helpers de tiempo (NZ -> UTC) ----
const NZ_TZ = "Pacific/Auckland";

/** Convierte ahora a “fecha/hora en NZ” como Date del sistema */
function nowInNZ(): Date {
  const now = new Date();
  const nzStr = now.toLocaleString("en-NZ", { timeZone: NZ_TZ });
  return new Date(nzStr);
}
/** Devuelve {fromUTC, toUTC} en UTC para hoy/semana/mes según NZ */
function nzRangeToUTC(range: "today" | "week" | "month") {
  const nzNow = nowInNZ();
  const offsetMs = nzNow.getTime() - new Date().getTime();

  const startNZ = new Date(nzNow);
  if (range === "today") {
    startNZ.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    // Semana tipo ISO (Lunes=1)
    const day = startNZ.getDay(); // 0..6 (Domingo=0)
    const delta = (day + 6) % 7;  // días hacia atrás hasta lunes
    startNZ.setDate(startNZ.getDate() - delta);
    startNZ.setHours(0, 0, 0, 0);
  } else {
    // month
    startNZ.setDate(1);
    startNZ.setHours(0, 0, 0, 0);
  }

  const endNZ = new Date(startNZ);
  if (range === "today") endNZ.setDate(endNZ.getDate() + 1);
  else if (range === "week") endNZ.setDate(endNZ.getDate() + 7);
  else endNZ.setMonth(endNZ.getMonth() + 1);

  // Pasamos “fechas NZ” a UTC deshaciendo el offset
  const fromUTC = new Date(startNZ.getTime() - offsetMs);
  const toUTC = new Date(endNZ.getTime() - offsetMs);
  return { fromUTC, toUTC };
}

type Body = {
  range: "today" | "week" | "month";
  thermo: "all" | "1" | "2";
  size: "all" | 22 | 25 | 27 | 30;
  shift: "all" | "DS" | "TW" | "NS";
};

export async function POST({ request }: { request: Request }) {
  try {
    const { range, thermo, size, shift } = (await request.json()) as Body;

    if (!["today", "week", "month"].includes(range)) {
      return json({ error: "Invalid range" }, 400);
    }

    const { fromUTC, toUTC } = nzRangeToUTC(range);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // ---------- Filtros comunes ----------
    const filters = (q: any) => {
      q.gte("created_at", fromUTC.toISOString()).lt("created_at", toUTC.toISOString());
      if (thermo !== "all") q.eq("thermoformer_number", Number(thermo));
      if (size !== "all") q.eq("size", Number(size));
      if (shift !== "all") q.eq("shift", shift);
      return q;
    };

    // ---------- KPI: packets total ----------
    const packetsCountRes = await filters(
      supabase.from("packets").select("id", { count: "exact", head: true })
    );
    if (packetsCountRes.error) throw packetsCountRes.error;
    const packetsTotal = packetsCountRes.count || 0;

    // ---------- KPI: pallets abiertos / cerrados ----------
    const palletsOpenedRes = await ((): any => {
      let q = supabase.from("pallets").select("id", { count: "exact", head: true })
        .gte("opened_at", fromUTC.toISOString())
        .lt("opened_at", toUTC.toISOString());
      if (thermo !== "all") q = q.eq("thermoformer_number", Number(thermo));
      if (size !== "all") q = q.eq("size", Number(size));
      return q;
    })();
    if (palletsOpenedRes.error) throw palletsOpenedRes.error;
    const palletsOpened = palletsOpenedRes.count || 0;

    const palletsClosedRes = await ((): any => {
      let q = supabase.from("pallets").select("id", { count: "exact", head: true })
        .gte("closed_at", fromUTC.toISOString())
        .lt("closed_at", toUTC.toISOString());
      if (thermo !== "all") q = q.eq("thermoformer_number", Number(thermo));
      if (size !== "all") q = q.eq("size", Number(size));
      return q;
    })();
    if (palletsClosedRes.error) throw palletsClosedRes.error;
    const palletsClosed = palletsClosedRes.count || 0;

    // ---------- Serie: “por hora” ----------
    // Traemos sólo created_at y contamos por hora en NZ del lado del servidor
    const createdRes = await filters(
      supabase.from("packets").select("created_at").order("created_at", { ascending: true })
    );
    if (createdRes.error) throw createdRes.error;
    const rawTimes: string[] = (createdRes.data || []).map((r: any) => r.created_at);

    // buckets por hora 00..23
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    const nzOffset = nowInNZ().getTime() - new Date().getTime();
    for (const iso of rawTimes) {
      const utc = new Date(iso);
      const nz = new Date(utc.getTime() + nzOffset);
      const h = nz.getHours();
      hours[h].count++;
    }

    return json({
      ok: true,
      kpis: {
        packetsTotal,
        palletsOpened,
        palletsClosed,
      },
      hours, // [{hour:0..23,count:n}]
      range: { fromUTC, toUTC },
    });
  } catch (err: any) {
    console.error("[stats] error:", err?.message || err);
    return json({ ok: false, error: err?.message || "stats error" }, 500);
  }
}
