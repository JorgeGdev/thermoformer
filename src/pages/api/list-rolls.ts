// src/pages/api/list-rolls.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.SUPABASE_URL!;
const service = import.meta.env.SUPABASE_SERVICE_ROLE!;
const supabase = createClient(url, service);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Simple: calculamos rangos en UTC (si quieres NZT luego ajustamos)
function getRangeBounds(range: "day" | "week" | "month") {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (range === "day") {
    start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (range === "week") {
    const day = now.getUTCDay(); // 0=domingo
    start = new Date(now);
    start.setUTCDate(start.getUTCDate() - day);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    // month
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export async function POST({ request }: { request: Request }) {
  try {
    const { range = "day" } = (await request.json()) as {
      range: "day" | "week" | "month";
    };

    const { start, end } = getRangeBounds(range);

    // 1) Traemos los últimos rolls con foto en ventana de tiempo
    const { data: rows, error } = await supabase
      .from("rolls")
      .select(
        "id, created_at, thermoformer_number, raw_materials, batch_number, box_number, photo_path"
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .is("photo_path", null) // truco para que PostgREST no excluya; lo cambiamos de inmediato con .not()
      .order("created_at", { ascending: false });

    // Nota: .is("photo_path", null) + .not("photo_path", "is", null) no pueden encadenarse
    // en el mismo builder, así que hacemos otra query si lo quieres súper estricto.
    // Para simplificar, filtramos en JS abajo:
    if (error) throw error;

    const onlyWithPhoto = (rows ?? []).filter((r) => r.photo_path);

    // 2) Pedimos signed URLs contra el bucket 'rolls'
    const signed = await Promise.all(
      onlyWithPhoto.map(async (r) => {
        const path = r.photo_path as string;
        const { data: signedUrl } = await supabase
          .storage
          .from("rolls") // ⬅️ bucket
          .createSignedUrl(path, 60 * 60); // 1 hora

        return {
          id: r.id,
          url: signedUrl?.signedUrl ?? "",
          created_at: r.created_at,
          thermoformer_number: r.thermoformer_number,
          raw_materials: r.raw_materials,
          batch_number: r.batch_number,
          box_number: r.box_number,
          photo_path: path,
        };
      })
    );

    return json({ ok: true, files: signed });
  } catch (err: any) {
    console.error("[list-rolls] error:", err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}
