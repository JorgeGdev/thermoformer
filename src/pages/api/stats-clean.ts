export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE!;
const NZ_TZ = "Pacific/Auckland";

function nowInNZ(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: NZ_TZ }));
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { range } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    
    const packetsCountRes = await supabase.from("packets").select("id", { count: "exact", head: true });
    const packetsTotal = packetsCountRes.count || 0;

    return new Response(JSON.stringify({
      ok: true,
      kpis: { packetsTotal, palletsOpened: 0, palletsClosed: 0 },
      hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[stats] error:", err?.message || err);
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
