// src/pages/apis/list-raw-pallets.ts
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const page = Math.max(1, Number(body.page || 1));
    const limit = Math.max(1, Math.min(60, Number(body.limit || 24)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Solo registros con foto (escaneados)
    const { data, error, count } = await supabase
      .from("raw_pallets")
      .select(
        "id,supplier,pallet_no,stock_code,batch_number,sticker_date,photo_path,created_at",
        { count: "exact" }
      )
      .not("photo_path", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const items =
      (data ?? []).map((r) => ({
        id: r.id,
        supplier: r.supplier,
        pallet_no: r.pallet_no,
        stock_code: r.stock_code,
        batch_number: r.batch_number,
        sticker_date: r.sticker_date,
        created_at: r.created_at,
        photo_path: r.photo_path,
        public_url: `${SUPABASE_URL}/storage/v1/object/public/raw-pallets/${r.photo_path}`,
      })) ?? [];

    return new Response(
      JSON.stringify({ ok: true, items, count: count ?? 0 }),
      { status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Server error" }),
      { status: 500 }
    );
  }
};
