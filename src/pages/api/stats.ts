// Disable prerendering for this API route
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = import.meta.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE!;

// New Zealand timezone
const NZ_TZ = "Pacific/Auckland";

// Get current date/time in NZ timezone
function nowInNZ(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: NZ_TZ }));
}

// Convert NZ date range to UTC for database queries
function nzRangeToUTC(range: "today" | "week" | "month") {
  const nzNow = nowInNZ();
  const now = new Date();
  const offsetMs = nzNow.getTime() - now.getTime();

  const startNZ = new Date(nzNow);
  
  if (range === "today") {
    startNZ.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    const day = startNZ.getDay();
    const delta = (day + 6) % 7; // Monday = 0
    startNZ.setDate(startNZ.getDate() - delta);
    startNZ.setHours(0, 0, 0, 0);
  } else { // month
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

// POST handler
export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { range, thermo, size, shift } = body;

    // Get date range in UTC
    const { fromUTC, toUTC } = nzRangeToUTC(range);
    
    // Connect to Supabase with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Helper to apply common filters
    const applyFilters = (query: any) => {
      query = query.gte("created_at", fromUTC.toISOString())
                  .lt("created_at", toUTC.toISOString());
      if (thermo !== "all") query = query.eq("thermoformer_number", Number(thermo));
      if (size !== "all") query = query.eq("size", Number(size));  
      if (shift !== "all") query = query.eq("shift", shift);
      return query;
    };

    // Count packets in date range with filters
    const packetsQuery = applyFilters(supabase.from("packets").select("id", { count: "exact", head: true }));
    const packetsCountRes = await packetsQuery;
    const packetsTotal = packetsCountRes.count || 0;

    // Count pallets opened in date range
    let palletsOpenedQuery = supabase.from("pallets")
      .select("id", { count: "exact", head: true })
      .gte("opened_at", fromUTC.toISOString())
      .lt("opened_at", toUTC.toISOString());
    if (thermo !== "all") palletsOpenedQuery = palletsOpenedQuery.eq("thermoformer_number", Number(thermo));
    if (size !== "all") palletsOpenedQuery = palletsOpenedQuery.eq("size", Number(size));
    const palletsOpenedRes = await palletsOpenedQuery;
    const palletsOpened = palletsOpenedRes.count || 0;

    // Count pallets closed in date range  
    let palletsClosedQuery = supabase.from("pallets")
      .select("id", { count: "exact", head: true })
      .gte("closed_at", fromUTC.toISOString())
      .lt("closed_at", toUTC.toISOString());
    if (thermo !== "all") palletsClosedQuery = palletsClosedQuery.eq("thermoformer_number", Number(thermo));
    if (size !== "all") palletsClosedQuery = palletsClosedQuery.eq("size", Number(size));
    const palletsClosedRes = await palletsClosedQuery;
    const palletsClosed = palletsClosedRes.count || 0;

    // Get packets for hourly breakdown
    const packetsDataQuery = applyFilters(supabase.from("packets").select("created_at"));
    const packetsDataRes = await packetsDataQuery;
    
    // Initialize hours array (0-23)
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    
    // Count packets by hour in NZ timezone
    const offsetMs = nowInNZ().getTime() - new Date().getTime();
    for (const packet of packetsDataRes.data || []) {
      const utcDate = new Date(packet.created_at);
      const nzDate = new Date(utcDate.getTime() + offsetMs);
      const hour = nzDate.getHours();
      if (hour >= 0 && hour < 24) {
        hours[hour].count++;
      }
    }

    // Return JSON response
    return new Response(
      JSON.stringify({
        ok: true,
        kpis: { packetsTotal, palletsOpened, palletsClosed },
        hours,
        range: { fromUTC, toUTC }
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[stats] error:", err?.message || err);

    return new Response(
      JSON.stringify({ ok: false, error: err?.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
