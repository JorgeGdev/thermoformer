export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE!;
const NZ_TZ = "Pacific/Auckland";

function nowInNZ(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: NZ_TZ }));
}

function getTodayRangeUTC() {
  const nzNow = nowInNZ();
  const now = new Date();
  const offsetMs = nzNow.getTime() - now.getTime();

  const startNZ = new Date(nzNow);
  startNZ.setHours(0, 0, 0, 0);
  
  const endNZ = new Date(startNZ);
  endNZ.setDate(endNZ.getDate() + 1);

  const fromUTC = new Date(startNZ.getTime() - offsetMs);
  const toUTC = new Date(endNZ.getTime() - offsetMs);
  
  return { fromUTC, toUTC };
}

export async function POST({ request }: { request: Request }) {
  try {
    const { fromUTC, toUTC } = getTodayRangeUTC();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Get today's packets by size
    const { data: packetsData } = await supabase
      .from("packets")
      .select("size")
      .gte("created_at", fromUTC.toISOString())
      .lt("created_at", toUTC.toISOString());

    // Count by size
    const sizeCounts = {
      22: packetsData?.filter(p => p.size === 22).length || 0,
      25: packetsData?.filter(p => p.size === 25).length || 0,
      27: packetsData?.filter(p => p.size === 27).length || 0,
      30: packetsData?.filter(p => p.size === 30).length || 0,
    };

    const totalPackets = Object.values(sizeCounts).reduce((sum, count) => sum + count, 0);

    // Get recent ISOs created today
    const { data: recentISOs } = await supabase
      .from("iso_numbers")
      .select("iso_number, size, thermoformer_number, created_at")
      .gte("created_at", fromUTC.toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      ok: true,
      summary: {
        totalPackets,
        totalISOs: recentISOs?.length || 0
      },
      bySizes: sizeCounts,
      recentISOs: recentISOs || []
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[iso-stats] error:", err?.message || err);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err?.message || "iso-stats error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}