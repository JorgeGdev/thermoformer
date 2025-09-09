export const prerender = false;

import { createClient } from "@supabase/supabase-js";

// Lee variables (server-side)
const url = import.meta.env.SUPABASE_URL as string;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE as string;
const BUCKET = "rolls";

// util: fecha NZ -> YYYY-MM-DD y HHmmss
function nzDateParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  // parts.month es "09", parts.day es "07", parts.year es "2025"
  const YYYY = parts.year;
  const MM = parts.month;
  const DD = parts.day;
  const hh = parts.hour;
  const mm = parts.minute;
  const ss = parts.second;
  return {
    dateFolder: `${YYYY}-${MM}-${DD}`,
    timeCompact: `${hh}${mm}${ss}`,
  };
}

// util: limpia base64 "data:image/jpeg;base64,...."
function normalizeBase64(dataUrlOrBase64?: string) {
  if (!dataUrlOrBase64) return null;
  const i = dataUrlOrBase64.indexOf(",");
  return i >= 0 ? dataUrlOrBase64.slice(i + 1) : dataUrlOrBase64;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Body = {
  thermoformer_number: 1 | 2 | number;
  raw_materials: string;
  batch_number: string;
  box_number: string;
  photoBase64?: string; // puede venir dataURL o solo base64
};

export async function POST({ request }: { request: Request }) {
  try {
    if (!url || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" }, 500);
    }
    const supabase = createClient(url, serviceKey);

    const body = (await request.json()) as Body;
    const { thermoformer_number, raw_materials, batch_number, box_number } = body;
    if (!thermoformer_number || !raw_materials || !batch_number || !box_number) {
      return json({ error: "Missing required fields" }, 400);
    }

    // 1) Inserta el roll en la tabla (aunque la foto falle, tendrás el registro)
    const { data: inserted, error: insErr } = await supabase
      .from("rolls")
      .insert({
        thermoformer_number: Number(thermoformer_number),
        raw_materials,
        batch_number,
        box_number,
      })
      .select("*")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);

    // 2) Si llegó foto, súbela al bucket
    let photo_path: string | null = null;

    if (body.photoBase64) {
      const base64 = normalizeBase64(body.photoBase64);
      if (!base64) {
        return json({ error: "Invalid base64 image" }, 400);
      }

      const { dateFolder, timeCompact } = nzDateParts();
      const thermoFolder = Number(thermoformer_number) === 2 ? "thermo2" : "thermo1";
      const filename = `${raw_materials}_${batch_number}_${box_number}_${timeCompact}.jpg`;

      // ⚠️ Path SIN anteponer "rolls/" (el bucket ya es 'rolls')
      const path = `${dateFolder}/${thermoFolder}/${filename}`;

      const buffer = Buffer.from(base64, "base64");
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (upErr) {
        // foto falló, pero el roll ya se insertó
        return json({ ok: true, roll: inserted, warn: `Upload failed: ${upErr.message}` }, 200);
      }

      photo_path = path;

      // 3) Guarda ruta de foto en la fila recién insertada
      await supabase
        .from("rolls")
        .update({ photo_path })
        .eq("id", inserted.id);
    }

    return json({ ok: true, roll: { ...inserted, photo_path } }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "save-roll error" }, 500);
  }
}
