// src/pages/api/save-raw-pallet.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

// Body esperado desde UI/escáner
type InBody = {
  supplier?: string;
  pallet_no?: number | string;
  stock_code?: string;
  batch_number?: string;
  sticker_date?: string;   // "YYYY-MM-DD"
  photoBase64?: string;    // imagen del sticker en base64 o dataURL
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Helpers de NZ time y base64 ---
const TZ = "Pacific/Auckland";
function nzDateParts() {
  const nowNZ = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const yyyy = nowNZ.getFullYear();
  const mm = String(nowNZ.getMonth() + 1).padStart(2, "0");
  const dd = String(nowNZ.getDate()).padStart(2, "0");
  const HH = String(nowNZ.getHours()).padStart(2, "0");
  const MM = String(nowNZ.getMinutes()).padStart(2, "0");
  const SS = String(nowNZ.getSeconds()).padStart(2, "0");
  return { dateFolder: `${yyyy}-${mm}-${dd}`, timeCompact: `${HH}${MM}${SS}` };
}
function normalizeBase64(s?: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^data:image\/\w+;base64,(.+)$/);
  return (m ? m[1] : s).trim() || null;
}

// --- Bucket RAW MATERIALS ---
const BUCKET = "raw-pallets"; // fotos de stickers de pallets raw【:contentReference[oaicite:2]{index=2}】

export async function POST({ request }: { request: Request }) {
  try {
    const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
    const SERVICE_KEY =
      (import.meta.env.SUPABASE_SERVICE_ROLE ||
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY) as string;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const body = (await request.json()) as InBody;

    // --- Validación/normalización de campos tabla raw_pallets【:contentReference[oaicite:3]{index=3}】 ---
    const supplier = (body.supplier ?? "").trim() || null;
    const stock_code = (body.stock_code ?? "").trim() || null;
    const batch_number = (body.batch_number ?? "").trim();
    const pallet_no =
      typeof body.pallet_no === "string"
        ? parseInt(body.pallet_no, 10)
        : (body.pallet_no as number | undefined);

    if (!batch_number || !pallet_no || Number.isNaN(pallet_no)) {
      return json({ error: "batch_number y pallet_no son obligatorios" }, 400);
    }

    let sticker_date: string | null = null;
    if (body.sticker_date && /^\d{4}-\d{2}-\d{2}$/.test(body.sticker_date)) {
      sticker_date = body.sticker_date;
    }

    // --- 1) (Opcional) subir foto al bucket y obtener photo_path ---
    let photo_path: string | null = null;
    if (body.photoBase64) {
      const b64 = normalizeBase64(body.photoBase64);
      if (b64) {
        const { dateFolder, timeCompact } = nzDateParts();
        const supplierFolder = (supplier || "unknown").replace(/\s+/g, "-");
        const filename = `${(supplier || "SUP")
          .replace(/\s+/g, "")
          .toUpperCase()}_${batch_number}_${pallet_no}_${timeCompact}.jpg`;

        // OJO: path relativo al bucket (no anteponer el nombre del bucket)【:contentReference[oaicite:4]{index=4}】
        const path = `${dateFolder}/${supplierFolder}/${filename}`;

        const buffer = Buffer.from(b64, "base64");
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

        if (!upErr) photo_path = path;
      }
    }

    // --- 2) UPSERT idempotente por (batch_number, pallet_no) ---
    // Si ya existe el sticker, actualizamos datos + photo_path; si no, lo insertamos.
    // Nota: este onConflict debe corresponder al índice/constraint único actual (ux_rawpallet_unique).
    const toSave = {
      supplier,
      pallet_no,
      stock_code,
      batch_number,
      sticker_date,
      photo_path, // si es null, no pisa el existente (lo manejamos abajo)
    };

    // Hacemos upsert devolviendo id
    const { data: upserted, error: upErr } = await supabase
      .from("raw_pallets")
      .upsert(toSave, {
        onConflict: "batch_number,pallet_no",
        ignoreDuplicates: false,
      })
      .select("id, photo_path")
      .single();

    if (upErr) {
      // si falla por constraint diferente, devolver mensaje claro
      return json({ error: upErr.message }, 500);
    }

    // Si no logramos subir foto antes pero ya existía una, mantenemos la existente
    // (ya viene en upserted.photo_path). Si sí subimos una nueva, ya quedó arriba.
    // Finalmente leemos la fila para UI desde la vista v_raw_pallets.
    const { data: row, error: selErr } = await supabase
      .from("v_raw_pallets")
      .select("*")
      .eq("id", upserted.id)
      .single();

    if (selErr) return json({ ok: true, row: { id: upserted.id, ...toSave } }, 200);

    return json({ ok: true, row }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
}
