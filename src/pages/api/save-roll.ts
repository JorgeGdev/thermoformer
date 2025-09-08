// src/pages/api/save-roll.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

// ENV (usa service role porque sube a storage e inserta en DB)
const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helpers
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// "YYYY-MM-DD" en horario de Nueva Zelanda (Pacific/Auckland)
function nzYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// limpia strings para usar en nombre de archivo
function slug(v: string) {
  return (v ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "");
}

// convierte dataURL o base64 “puro” a Buffer + contentType + extensión
function base64ToFileParts(imageBase64: string) {
  let b64 = imageBase64;
  let contentType = "image/jpeg";
  let ext = "jpg";

  const m = /^data:(.+?);base64,(.*)$/.exec(imageBase64);
  if (m) {
    contentType = m[1];
    b64 = m[2];
  }
  if (/png/i.test(contentType)) ext = "png";
  else if (/jpeg|jpg/i.test(contentType)) ext = "jpg";
  else if (/webp/i.test(contentType)) ext = "webp";

  const buffer = Buffer.from(b64, "base64");
  return { buffer, contentType, ext };
}

/**
 * Espera un JSON:
 * {
 *   thermoformer_number: 1 | 2,
 *   raw_materials: string,
 *   batch_number: string,
 *   box_number: string,
 *   imageBase64?: string,   // dataURL o base64
 *   user_id?: string        // opcional
 * }
 */
export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();

    const thermoformer_number = Number(body?.thermoformer_number);
    const raw_materials = String(body?.raw_materials ?? "").trim();
    const batch_number = String(body?.batch_number ?? "").trim();
    const box_number = String(body?.box_number ?? "").trim();
    const imageBase64 = body?.imageBase64 as string | undefined;
    const user_id = body?.user_id as string | undefined;

    if (![1, 2].includes(thermoformer_number)) {
      return json({ ok: false, error: "Invalid thermoformer_number" }, 400);
    }
    if (!raw_materials || !batch_number || !box_number) {
      return json({ ok: false, error: "Missing fields" }, 400);
    }

    // 1) Preparar path NZ y nombre del archivo (si hay imagen)
    const ymd = nzYmd(); // p.ej. "2025-09-08"
    const folder = `${ymd}/thermo${thermoformer_number}`;

    let photo_path: string | null = null;

    if (imageBase64 && imageBase64.length > 16) {
      const { buffer, contentType, ext } = base64ToFileParts(imageBase64);

      // nombre legible + timestamp para evitar colisiones
      const fileName = `${slug(raw_materials)}_${slug(batch_number)}_${slug(
        box_number
      )}_${Date.now()}.${ext}`;

      // Importante: NO anteponer "rolls/" aquí. Es ruta relativa dentro del bucket.
      const objectPath = `${folder}/${fileName}`;

      // 2) Subir al bucket 'rolls'
      const up = await supabase.storage
        .from("rolls")
        .upload(objectPath, buffer, {
          contentType,
          upsert: false,
        });

      if (up.error) {
        console.error("[save-roll] upload error:", up.error.message);
        return json({ ok: false, error: up.error.message }, 500);
      }

      photo_path = objectPath;
    }

    // 3) Insertar fila en tabla rolls
    const insertPayload: Record<string, any> = {
      thermoformer_number,
      raw_materials,
      batch_number,
      box_number,
      photo_path, // relativo: "YYYY-MM-DD/thermo1/xxxxx.jpg"
    };
    if (user_id) insertPayload.user_id = user_id;

    const { data, error } = await supabase
      .from("rolls")
      .insert(insertPayload)
      .select("id, created_at, photo_path")
      .single();

    if (error) {
      console.error("[save-roll] insert error:", error.message);
      return json({ ok: false, error: error.message }, 500);
    }

    // 4) Si deseas mostrar url directa en la UI:
    let photo_url: string | null = null;
    if (photo_path) {
      const pub = supabase.storage.from("rolls").getPublicUrl(photo_path);
      photo_url = pub.data?.publicUrl ?? null;

      // Si el bucket no fuera público, podrías firmar:
      // const signed = await supabase.storage.from("rolls").createSignedUrl(photo_path, 3600);
      // photo_url = signed.data?.signedUrl ?? null;
    }

    return json({
      ok: true,
      roll_id: data.id,
      created_at: data.created_at,
      photo_path,
      photo_url, // útil para previsualizar
    });
  } catch (err: any) {
    console.error("[save-roll] ERROR:", err?.message);
    return json({ ok: false, error: err?.message ?? "save-roll failed" }, 500);
  }
}
