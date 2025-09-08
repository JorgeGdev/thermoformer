// src/pages/api/list-rolls.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";
import { nzRangeUTC } from "../../lib/nzTime";

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePath(p: string) {
  return String(p ?? "")
    .replace(/^\/?rolls\//i, "") // quita 'rolls/' si alguien lo guardó de más
    .replace(/^\/+/, "");
}

export async function POST({ request }: { request: Request }) {
  try {
    const { range = "day" } = (await request.json()) as {
      range: "day" | "week" | "month";
    };

    const { start, end } = nzRangeUTC(
      range === "day" ? "day" : range === "week" ? "week" : "month"
    );

    const { data: rows, error } = await supabase
      .from("rolls")
      .select(
        "id, created_at, thermoformer_number, raw_materials, batch_number, box_number, photo_path"
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const onlyWithPhoto = (rows ?? []).filter((r) => r.photo_path);

    const files = await Promise.all(
      onlyWithPhoto.map(async (r) => {
        const path = normalizePath(r.photo_path as string);
        const pub = supabase.storage.from("rolls").getPublicUrl(path);
        return {
          id: r.id,
          url: pub.data?.publicUrl ?? "",
          created_at: r.created_at,
          thermoformer_number: r.thermoformer_number,
          raw_materials: r.raw_materials,
          batch_number: r.batch_number,
          box_number: r.box_number,
          photo_path: path,
        };
      })
    );

    return json({ ok: true, files });
  } catch (err: any) {
    console.error("[list-rolls] error:", err?.message);
    return json({ ok: false, error: err?.message ?? "list-rolls error" }, 500);
  }
}
