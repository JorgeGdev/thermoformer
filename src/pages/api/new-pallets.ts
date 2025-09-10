// src/pages/apis/new-pallets.ts
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

// ENV (Astro + fallback)
const SUPABASE_URL =
  (import.meta as any).env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY ??
  (import.meta as any).env?.SUPABASE_SERVICE_ROLE ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || (SUPABASE_ANON_KEY as string),
  { auth: { persistSession: false } }
);

// LIST: pallets + agregados desde packets (sin pallets.number)
async function listPallets(page: number, limit: number) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // 1) contar pallets
  const { count } = await supabase.from("pallets").select("*", { count: "exact", head: true });

  // 2) página de pallets (todas las columnas necesarias)
  const { data: pals, error } = await supabase
    .from("pallets")
    .select("id, pallet_number, size, thermoformer_number, opened_at, closed_at")
    .order("opened_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  // 3) agregados por pallet desde packets
  const ids = (pals ?? []).map((p) => p.id);
  let aggByPallet: Record<string, any> = {};

  if (ids.length > 0) {
    const { data: pk, error: e2 } = await supabase
      .from("packets")
      .select("pallet_id, iso_number, packet_index, size, thermoformer_number")
      .in("pallet_id", ids);

    if (e2) throw e2;

    for (const r of pk ?? []) {
      const k = r.pallet_id as string;
      const a = (aggByPallet[k] ||= {
        iso_start: null as number | null,
        iso_end: null as number | null,
        completed: false,
        packets_count: 0,
        size: null as number | null,
        thermoformer_number: null as number | null,
        indexSet: new Set<number>(),
      });
      a.iso_start = a.iso_start == null ? r.iso_number : Math.min(a.iso_start, r.iso_number);
      a.iso_end = a.iso_end == null ? r.iso_number : Math.max(a.iso_end, r.iso_number);
      a.packets_count++;
      if (typeof r.packet_index === "number") a.indexSet.add(r.packet_index);
      if (r.size != null) a.size = r.size;
      if (r.thermoformer_number != null) a.thermoformer_number = r.thermoformer_number;
    }

    // completed = 24 posiciones 1..24
    for (const k of Object.keys(aggByPallet)) {
      const s: Set<number> = aggByPallet[k].indexSet;
      aggByPallet[k].completed = s.size === 24;
      delete aggByPallet[k].indexSet;
    }
  }

  const rows = (pals ?? []).map((p) => ({
    id: p.id,
    number: p.pallet_number, // usar la columna real pallet_number
    created_at: p.opened_at, // usar opened_at como created_at para el frontend
    closed_at: p.closed_at, // incluir fecha de cierre
    iso_start: aggByPallet[p.id]?.iso_start ?? null,
    iso_end: aggByPallet[p.id]?.iso_end ?? null,
    completed: aggByPallet[p.id]?.completed ?? false,
    packets_count: aggByPallet[p.id]?.packets_count ?? 0,
    size: p.size ?? aggByPallet[p.id]?.size ?? null, // usar size de pallets, fallback a packets
    thermoformer_number: p.thermoformer_number ?? aggByPallet[p.id]?.thermoformer_number ?? null, // usar th de pallets, fallback a packets
  }));

  return { rows, count: count ?? 0 };
}

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const action = new URL(url).searchParams.get("action") ?? "list";

    if (action === "list") {
      const body = await request.json().catch(() => ({}));
      const page = Math.max(1, Number(body.page || 1));
      const limit = Math.max(1, Number(body.limit || 12));
      const { rows, count } = await listPallets(page, limit);
      return new Response(JSON.stringify({ ok: true, data: rows, count }), { status: 200 });
    }

    if (action === "create") {
      const body = await request.json().catch(() => ({}));
      const { size, thermoformer_number } = body;
      
      // Validaciones básicas
      if (!size || !thermoformer_number) {
        return new Response(
          JSON.stringify({ ok: false, error: "size and thermoformer_number are required" }), 
          { status: 400 }
        );
      }

      // Generar número consecutivo desde pallet_counter
      // 1) leer current
      const { data: cur, error: r1 } = await supabase
        .from("pallet_counter")
        .select("last_value")
        .eq("id", 1)
        .single();
      if (r1) throw r1;

      const next = (cur!.last_value as number) + 1;

      // 2) actualizar contador
      const { error: r2 } = await supabase
        .from("pallet_counter")
        .update({ last_value: next })
        .eq("id", 1);
      if (r2) throw r2;

      // 3) crear pallet con todas las columnas requeridas
      const { data: ins, error: e3 } = await supabase
        .from("pallets")
        .insert([{ 
          pallet_number: next,
          size: parseInt(size),
          thermoformer_number: parseInt(thermoformer_number)
        }])
        .select("id, pallet_number, size, thermoformer_number, opened_at")
        .single();
      if (e3) throw e3;

      // devolvemos el pallet creado
      return new Response(
        JSON.stringify({ ok: true, data: { 
          id: ins.id, 
          created_at: ins.opened_at, 
          number: ins.pallet_number,
          size: ins.size,
          thermoformer_number: ins.thermoformer_number
        } }),
        { status: 200 }
      );
    }

    if (action === "update") {
      const body = await request.json();
      const { id, thermoformer_number, size } = body || {};
      if (!id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing id" }), { status: 400 });
      }

      // Actualizar la tabla pallets directamente
      const palletPatch: any = {};
      if (typeof thermoformer_number === "number") palletPatch.thermoformer_number = thermoformer_number;
      if (typeof size === "number") palletPatch.size = size;

      if (Object.keys(palletPatch).length > 0) {
        const { error: e1 } = await supabase.from("pallets").update(palletPatch).eq("id", id);
        if (e1) throw e1;
      }

      // También actualizar packets si es necesario
      const packetPatch: any = {};
      if (typeof thermoformer_number === "number") packetPatch.thermoformer_number = thermoformer_number;
      if (typeof size === "number") packetPatch.size = size;

      if (Object.keys(packetPatch).length > 0) {
        const { error: e2 } = await supabase.from("packets").update(packetPatch).eq("pallet_id", id);
        if (e2) throw e2;
      }

      // refrescar fila agregada
      const { rows } = await listPallets(1, 1000);
      const refreshed =
        rows.find((r) => r.id === id) ||
        {
          id,
          number: null,
          created_at: new Date().toISOString(),
          iso_start: null,
          iso_end: null,
          completed: false,
          packets_count: 0,
          size: typeof size === "number" ? size : null,
          thermoformer_number:
            typeof thermoformer_number === "number" ? thermoformer_number : null,
        };

      return new Response(JSON.stringify({ ok: true, data: refreshed }), { status: 200 });
    }

    if (action === "delete") {
      const body = await request.json();
      const { id } = body || {};
      if (!id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing id" }), { status: 400 });
      }

      // desasociar y borrar
      const { error: e1 } = await supabase.from("packets").update({ pallet_id: null }).eq("pallet_id", id);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("pallets").delete().eq("id", id);
      if (e2) throw e2;

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "Server error" }), { status: 500 });
  }
};
