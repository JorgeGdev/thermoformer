// Diagnóstico para verificar datos en stats
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

export async function POST({ request }: { request: Request }) {
  try {
    console.log("🔍 [DEBUG] Iniciando diagnóstico de datos...");
    console.log("🔍 [DEBUG] SUPABASE_URL:", SUPABASE_URL ? "✅ Configurado" : "❌ No configurado");
    console.log("🔍 [DEBUG] SUPABASE_SERVICE_ROLE:", SUPABASE_SERVICE_ROLE ? "✅ Configurado" : "❌ No configurado");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Verificar conexión básica
    console.log("🔍 [DEBUG] Testeando conexión a Supabase...");
    
    // Contar total de packets
    console.log("🔍 [DEBUG] Contando packets...");
    const packetsResult = await supabase
      .from("packets")
      .select("*", { count: "exact", head: true });
    
    console.log("🔍 [DEBUG] Packets count result:", packetsResult);
    const packetsCount = packetsResult.count || 0;

    // Contar total de pallets
    console.log("🔍 [DEBUG] Contando pallets...");
    const palletsResult = await supabase
      .from("pallets")
      .select("*", { count: "exact", head: true });
    
    console.log("🔍 [DEBUG] Pallets count result:", palletsResult);
    const palletsCount = palletsResult.count || 0;

    // Contar total de rolls
    console.log("🔍 [DEBUG] Contando rolls...");
    const rollsResult = await supabase
      .from("rolls")
      .select("*", { count: "exact", head: true });
    
    console.log("🔍 [DEBUG] Rolls count result:", rollsResult);
    const rollsCount = rollsResult.count || 0;

    // Obtener algunos ejemplos de packets recientes
    console.log("🔍 [DEBUG] Obteniendo últimos 5 packets...");
    const recentPackets = await supabase
      .from("packets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    console.log("🔍 [DEBUG] Recent packets:", recentPackets);

    // Obtener algunos ejemplos de pallets recientes
    console.log("🔍 [DEBUG] Obteniendo últimos 5 pallets...");
    const recentPallets = await supabase
      .from("pallets")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(5);

    console.log("🔍 [DEBUG] Recent pallets:", recentPallets);

    // Verificar vista v_packets_full
    console.log("🔍 [DEBUG] Verificando vista v_packets_full...");
    const vPacketsResult = await supabase
      .from("v_packets_full")
      .select("*", { count: "exact", head: true });

    console.log("🔍 [DEBUG] v_packets_full count result:", vPacketsResult);

    // Probar rangos de fecha
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    console.log("🔍 [DEBUG] Buscando packets de hoy...");
    console.log("🔍 [DEBUG] Rango: desde", today, "hasta", tomorrow);

    const todayPackets = await supabase
      .from("packets")
      .select("*", { count: "exact" })
      .gte("created_at", today)
      .lt("created_at", tomorrow);

    console.log("🔍 [DEBUG] Packets de hoy:", todayPackets);

    const diagnostic = {
      ok: true,
      environment: {
        supabaseUrlConfigured: !!SUPABASE_URL,
        serviceRoleConfigured: !!SUPABASE_SERVICE_ROLE,
        currentTime: now.toISOString(),
        todayRange: { from: today, to: tomorrow }
      },
      counts: {
        totalPackets: packetsCount,
        totalPallets: palletsCount,
        totalRolls: rollsCount,
        vPacketsFull: vPacketsResult.count || 0,
        packetsToday: todayPackets.count || 0
      },
      samples: {
        recentPackets: recentPackets.data || [],
        recentPallets: recentPallets.data || [],
        todayPacketsData: todayPackets.data?.slice(0, 3) || []
      },
      errors: {
        packetsError: packetsResult.error,
        palletsError: palletsResult.error,
        rollsError: rollsResult.error,
        vPacketsError: vPacketsResult.error,
        todayPacketsError: todayPackets.error
      }
    };

    console.log("🔍 [DEBUG] Diagnóstico completo:", diagnostic);

    return json(diagnostic);

  } catch (err: any) {
    console.error("❌ [DEBUG] Error en diagnóstico:", err);
    return json({ 
      ok: false, 
      error: err?.message || "Error desconocido",
      stack: err?.stack 
    }, 500);
  }
}