// src/pages/apis/raw-pallets.ts
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

// ✅ Env (Astro + fallback a process.env)
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

type RawPallet = {
  id: string;
  supplier: string | null;
  pallet_no: number;
  stock_code: string | null;
  batch_number: string;
  sticker_date: string | null; // YYYY-MM-DD
  photo_path: string | null;   // 👈 clave para IN THF
  created_at: string;
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const action = new URL(url).searchParams.get("action") ?? "list";

    if (action === "list") {
      const body = await request.json().catch(() => ({}));
      const page = Math.max(1, Number(body.page || 1));
      const limit = Math.max(1, Number(body.limit || 12));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // 1) Página de raw_pallets (incluye photo_path)
      const { data: pageRows, error: e1, count } = await supabase
        .from("raw_pallets")
        .select(
          "id,supplier,pallet_no,stock_code,batch_number,sticker_date,photo_path,created_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (e1) throw e1;

      // 2) IN THF = photo_path !== null (escaneado y subido al bucket)
      const decorated = (pageRows ?? []).map((r: RawPallet) => ({
        ...r,
        in_thf: r.photo_path !== null,
      }));

      return new Response(
        JSON.stringify({ ok: true, data: decorated, count: count ?? 0 }),
        { status: 200 }
      );
    }

    if (action === "update") {
      const body = await request.json();
      const { id, ...patch } = body || {};
      if (!id) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing id" }),
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("raw_pallets")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    }

    if (action === "delete") {
      const body = await request.json();
      const { id } = body || {};
      if (!id) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing id" }),
          { status: 400 }
        );
      }

      const { error } = await supabase.from("raw_pallets").delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action" }),
      { status: 400 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Server error" }),
      { status: 500 }
    );
  }
};
