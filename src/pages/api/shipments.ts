// src/pages/apis/shipments.ts
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

// Lista blanca de sedes (idéntica al CHECK de la tabla)
const LOCATIONS = [
  "Te Puke - Washer Road",
  "Te Puke - Collins Lane",
  "Te Puke - Quarry Road",
  "Katikati - Marshall Road",
  "Edgecumbe - East Bank Road",
  "Opotiki - Stoney Creek Road",
];

type Row = {
  id: string;                   // pallet_id
  number: number | null;        // <- AHORA viene de pallets.pallet_number
  thermoformer_number: number | null;
  size: number | null;
  iso_start: number | null;
  iso_end: number | null;
  closed_at: string | null;     // pallets.closed_at si existe; si no, last_packet_at
  destination: string | null;   // pallet_shipments.location
};

async function listClosed(page: number, limit: number) {
  // 1) Traemos todos los packets con pallet_id para calcular 24/24, ISO min/max, size y th
  const { data: pkAll, error: e1 } = await supabase
    .from("packets")
    .select("pallet_id, packet_index, iso_number, size, thermoformer_number, created_at")
    .not("pallet_id", "is", null);

  if (e1) throw e1;

  type Agg = {
    iso_start: number | null;
    iso_end: number | null;
    size: number | null;
    th: number | null;
    indexes: Set<number>;
    last_packet_at: string | null;
  };
  const agg: Record<string, Agg> = {};
  for (const r of pkAll ?? []) {
    const k = r.pallet_id as string;
    const a = (agg[k] ||= {
      iso_start: null,
      iso_end: null,
      size: null,
      th: null,
      indexes: new Set<number>(),
      last_packet_at: null,
    });
    a.iso_start = a.iso_start == null ? r.iso_number : Math.min(a.iso_start!, r.iso_number!);
    a.iso_end = a.iso_end == null ? r.iso_number : Math.max(a.iso_end!, r.iso_number!);
    if (r.size != null) a.size = r.size;
    if (r.thermoformer_number != null) a.th = r.thermoformer_number;
    if (typeof r.packet_index === "number") a.indexes.add(r.packet_index);
    if (!a.last_packet_at || new Date(r.created_at) > new Date(a.last_packet_at)) {
      a.last_packet_at = r.created_at as string;
    }
  }

  // 2) Solo pallets "cerrados" = 24 posiciones
  const closedIds = Object.keys(agg).filter((id) => agg[id].indexes.size === 24);

  // Orden: último packet más reciente primero
  closedIds.sort((a, b) => {
    const da = new Date(agg[a].last_packet_at ?? 0).getTime();
    const db = new Date(agg[b].last_packet_at ?? 0).getTime();
    return db - da;
  });

  const total = closedIds.length;
  const start = Math.max(0, (page - 1) * limit);
  const slice = closedIds.slice(start, start + limit);

  // 3) Traemos metadatos de pallets: pallet_number y closed_at  ✅
  type PalMeta = { pallet_number: number | null; closed_at: string | null };
  const palletsMeta: Record<string, PalMeta> = {};
  if (slice.length > 0) {
    const { data: pals, error: e2 } = await supabase
      .from("pallets")
      .select("id, pallet_number, closed_at")
      .in("id", slice);
    if (e2) throw e2;
    for (const p of pals ?? []) {
      palletsMeta[p.id] = {
        pallet_number: (p as any).pallet_number ?? null,
        closed_at: (p as any).closed_at ?? null,
      };
    }
  }

  // 4) Destinos ya asignados
  const shipments: Record<string, string> = {};
  if (slice.length > 0) {
    const { data: shps, error: e3 } = await supabase
      .from("pallet_shipments")
      .select("pallet_id, location")
      .in("pallet_id", slice);
    if (e3) throw e3;
    for (const s of shps ?? []) shipments[s.pallet_id as string] = s.location as string;
  }

  // 5) Construimos filas para UI
  const rows: Row[] = slice.map((id) => ({
    id,
    number: palletsMeta[id]?.pallet_number ?? null,        // 👈 AHORA sale el número real
    thermoformer_number: agg[id].th,
    size: agg[id].size,
    iso_start: agg[id].iso_start,
    iso_end: agg[id].iso_end,
    closed_at: palletsMeta[id]?.closed_at ?? agg[id].last_packet_at,
    destination: shipments[id] ?? null,
  }));

  return { rows, count: total };
}

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const action = new URL(url).searchParams.get("action") ?? "list";

    if (action === "list") {
      const body = await request.json().catch(() => ({}));
      const page = Math.max(1, Number(body.page || 1));
      const limit = Math.max(1, Number(body.limit || 12));
      const { rows, count } = await listClosed(page, limit);
      return new Response(JSON.stringify({ ok: true, data: rows, count, locations: LOCATIONS }), {
        status: 200,
      });
    }

    if (action === "assign") {
      const body = await request.json();
      const { pallet_id, location } = body || {};
      if (!pallet_id || !location) {
        return new Response(JSON.stringify({ ok: false, error: "Missing pallet_id or location" }), {
          status: 400,
        });
      }
      if (!LOCATIONS.includes(location)) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid location" }), {
          status: 400,
        });
      }

      // Upsert por pallet_id (requiere índice único)
      const { data, error } = await supabase
        .from("pallet_shipments")
        .upsert({ pallet_id, location }, { onConflict: "pallet_id", ignoreDuplicates: false })
        .select("pallet_id, location")
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "Server error" }), {
      status: 500,
    });
  }
};
