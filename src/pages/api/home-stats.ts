export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE!;
const NZ_TZ = "Pacific/Auckland";

// Get current date/time in NZ timezone
function nowInNZ(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: NZ_TZ }));
}

// Get current shift based on NZ time
function getCurrentShift() {
  const now = nowInNZ();
  const currentTime = now.toTimeString().substring(0, 5); // "HH:mm"
  
  // Day Shift: 06:00 - 14:30
  // Twilight: 14:30 - 23:00  
  // Night: 23:00 - 06:00
  if (currentTime >= "06:00" && currentTime < "14:30") {
    return { code: "DS", label: "Day Shift", target: 42 };
  } else if (currentTime >= "14:30" && currentTime < "23:00") {
    return { code: "TW", label: "Twilight", target: 42 };
  } else {
    return { code: "NS", label: "Night Shift", target: 42 };
  }
}

// Get shift start time in UTC
function getShiftStartUTC() {
  const now = nowInNZ();
  const currentShift = getCurrentShift();
  const today = new Date(now);
  
  if (currentShift.code === "DS") {
    today.setHours(6, 0, 0, 0);
  } else if (currentShift.code === "TW") {
    today.setHours(14, 30, 0, 0);
  } else { // NS - started yesterday at 23:00
    if (now.getHours() < 6) {
      today.setDate(today.getDate() - 1);
    }
    today.setHours(23, 0, 0, 0);
  }
  
  // Convert NZ time to UTC
  const utcOffset = now.getTime() - new Date().getTime();
  return new Date(today.getTime() - utcOffset);
}

export async function POST({ request }: { request: Request }) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const currentShift = getCurrentShift();
    const shiftStartUTC = getShiftStartUTC();
    const nowUTC = new Date();

    // Get packets for current shift by thermoformer
    const { data: packetsData } = await supabase
      .from("packets")
      .select("thermoformer_number")
      .gte("created_at", shiftStartUTC.toISOString())
      .lte("created_at", nowUTC.toISOString());

    // Count by thermoformer
    const thermo1Count = packetsData?.filter(p => p.thermoformer_number === 1).length || 0;
    const thermo2Count = packetsData?.filter(p => p.thermoformer_number === 2).length || 0;
    const totalPackets = thermo1Count + thermo2Count;
    const totalPlixies = totalPackets * 432;

    // Get packets for last 24 hours for trending
    const last24h = new Date(nowUTC.getTime() - 24 * 60 * 60 * 1000);
    const { data: trendData } = await supabase
      .from("packets")
      .select("created_at, thermoformer_number")
      .gte("created_at", last24h.toISOString())
      .order("created_at", { ascending: true });

    // Group by hour for trending chart
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      thermo1: 0,
      thermo2: 0,
      total: 0
    }));

    const nzOffset = nowInNZ().getTime() - nowUTC.getTime();
    for (const packet of trendData || []) {
      const utcDate = new Date(packet.created_at);
      const nzDate = new Date(utcDate.getTime() + nzOffset);
      const hour = nzDate.getHours();
      
      if (packet.thermoformer_number === 1) {
        hourlyData[hour].thermo1++;
      } else if (packet.thermoformer_number === 2) {
        hourlyData[hour].thermo2++;
      }
      hourlyData[hour].total++;
    }

    // Calculate progress toward shift target (42 total per shift, ~21 per thermoformer)
    const shiftTarget = 42; // Total packets per shift (combined)
    const idealPerThermo = 21; // Ideal split per thermoformer  
    const progressPercent = Math.round((totalPackets / shiftTarget) * 100);

    return new Response(JSON.stringify({
      ok: true,
      currentShift: {
        ...currentShift,
        shiftTarget,
        progressPercent
      },
      thermoformers: {
        thermo1: { 
          count: thermo1Count, 
          idealTarget: idealPerThermo,
          percentOfShift: totalPackets > 0 ? Math.round((thermo1Count / totalPackets) * 100) : 0
        },
        thermo2: { 
          count: thermo2Count, 
          idealTarget: idealPerThermo,
          percentOfShift: totalPackets > 0 ? Math.round((thermo2Count / totalPackets) * 100) : 0
        }
      },
      summary: {
        totalPackets,
        totalPlixies,
        shiftProgress: progressPercent,
        shiftTarget,
        remainingToTarget: Math.max(0, shiftTarget - totalPackets)
      },
      trending: hourlyData
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[home-stats] error:", err?.message || err);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err?.message || "home-stats error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}