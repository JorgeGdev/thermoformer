// src/pages/api/save-roll.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

// Server env (Astro)
const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

type BodyIn = {
  thermoformer_number: 1 | 2;
  raw_materials: string;   // Production #
  batch_number: string;    // Caspak Batch #
  box_number: string;      // CTN#
  photoBase64?: string;    // opcional: base64 dataURL (data:image/jpeg;base64,xxx) o solo base64
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Normaliza dataURL o base64 “puro”
function extractBase64(input?: string): { base64: string | null; contentType: string } {
  if (!input) return { base64: null, contentType: "image/jpeg" };
  const hasHeader = input.startsWith("data:");
  if (hasHeader) {
    const [, meta, b64] = input.match(/^data:(.*?);base64,(.*)$/) || [];
    return { base64: b64 || null, contentType: meta || "image/jpeg" };
  }
  return { base64: input, contentType: "image/jpeg" };
}

// yyyy-mm-dd
function dateStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
// hhmmss
function timeStr(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}${m}${s}`;
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return json({ ok: false, error: "Missing Supabase server env" }, 500);
    }

    const body = (await request.json()) as BodyIn;
    const { thermoformer_number, raw_materials, batch_number, box_number, photoBase64 } = body;

    if (![1, 2].includes(Number(thermoformer_number))) {
      return json({ ok: false, error: "Invalid thermoformer_number" }, 400);
    }
    if (!raw_materials || !batch_number || !box_number) {
      return json({ ok: false, error: "Missing fields" }, 400);
    }

    // 1) Subir imagen a Storage (si viene)
    let photo_path: string | null = null;

    const { base64, contentType } = extractBase64(photoBase64);
    if (base64) {
      const bin = Buffer.from(base64, "base64"); // Node runtime
      const today = dateStr();
      const now = timeStr();
      const folder = `rolls/${today}/thermo${thermoformer_number}`;
      const safeName = `${raw_materials || "prod"}_${batch_number || "batch"}_${box_number || "box"}_${now}.jpg`
        .replace(/[^\w.\-]/g, "_"); // nombre seguro

      const path = `${folder}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("rolls")
        .upload(path, bin, {
          contentType,
          upsert: false,
        });

      if (upErr) {
        // No frenamos todo: podemos guardar la fila aun sin foto
        console.error("[save-roll] upload error:", upErr.message);
      } else {
        photo_path = path;
      }
    }

    // 2) Insertar fila en DB
    const { data, error } = await supabase
      .from("rolls")
      .insert({
        thermoformer_number,
        raw_materials,
        batch_number,
        box_number,
        photo_path, // puede venir null si falló upload
      })
      .select("id, created_at, photo_path")
      .single();

    if (error) return json({ ok: false, error: error.message }, 500);

    // 3) Si el bucket es público, puedes construir URL pública
    let public_url: string | null = null;
    if (photo_path) {
      const { data: pub } = supabase.storage.from("rolls").getPublicUrl(photo_path);
      public_url = pub?.publicUrl || null;
    }

    return json(
      {
        ok: true,
        id: data.id,
        created_at: data.created_at,
        photo_path: data.photo_path,
        photo_public_url: public_url,
      },
      200
    );
  } catch (e: any) {
    console.error("[save-roll] ERROR:", e?.message);
    return json({ ok: false, error: e?.message || "Unknown error" }, 500);
  }
}
