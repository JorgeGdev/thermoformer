// src/pages/api/list-rolls.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

type Range = "day" | "week" | "month";

// --- Helpers de tiempo (NZ) ---
const TZ = "Pacific/Auckland";

/** Convierte "ahora" a la hora de NZ y calcula inicio/fin en UTC para el rango. */
function nzRangeToUTC(range: Range) {
  // "Congelamos" un Date que representa el reloj de NZ
  const nowNZ = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const nowUTC = new Date();
  const delta = nowNZ.getTime() - nowUTC.getTime(); // NZ - UTC

  // inicio del día NZ
  const startNZ = new Date(nowNZ.getFullYear(), nowNZ.getMonth(), nowNZ.getDate());
  let fromNZ = startNZ;
  let toNZ: Date;

  if (range === "day") {
    toNZ = new Date(startNZ.getTime() + 24 * 60 * 60 * 1000);
  } else if (range === "week") {
    // Semana estilo ISO (lunes=1 … domingo=7)
    const dow = (nowNZ.getDay() + 6) % 7; // 0..6 con lunes=0
    const mondayNZ = new Date(startNZ.getTime() - dow * 24 * 60 * 60 * 1000);
    fromNZ = mondayNZ;
    toNZ = new Date(mondayNZ.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    // month
    const firstNZ = new Date(nowNZ.getFullYear(), nowNZ.getMonth(), 1);
    const nextMonthNZ = new Date(nowNZ.getFullYear(), nowNZ.getMonth() + 1, 1);
    fromNZ = firstNZ;
    toNZ = nextMonthNZ;
  }

  // Convertimos esos “bordes NZ” a UTC restando el delta
  const fromUTC = new Date(fromNZ.getTime() - delta).toISOString();
  const toUTC = new Date(toNZ.getTime() - delta).toISOString();
  return { fromUTC, toUTC };
}

// --- Supabase ---
const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;
const PUB_BASE = `${SUPABASE_URL}/storage/v1/object/public/rolls/`;

// Nota: este endpoint **lee** de la tabla `rolls` y arma la URL pública del storage.
// La columna `photo_path` debe tener: "YYYY-MM-DD/thermo1|thermo2/archivo.jpg"
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const { range = "day" } = (await request.json().catch(() => ({}))) as {
      range?: Range;
    };
    if (!["day", "week", "month"].includes(range)) {
      return json({ ok: false, error: "invalid range" }, 400);
    }

    const { fromUTC, toUTC } = nzRangeToUTC(range as Range);

    // Traemos últimos (p.e. 300) por si hay muchas fotos
    const { data, error } = await supabase
      .from("rolls")
      .select(
        "id, created_at, thermoformer_number, raw_materials, batch_number, box_number, photo_path"
      )
      .gte("created_at", fromUTC)
      .lt("created_at", toUTC)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("[list-rolls] supabase error:", error);
      return json({ ok: false, error: error.message }, 500);
    }

    // Armamos la URL pública a partir del path guardado
    const files =
      (data ?? []).map((r) => ({
        ...r,
        url: PUB_BASE + (r.photo_path ?? "").replace(/^\/+/, ""),
      })) ?? [];

    return json({ ok: true, files });
  } catch (err: any) {
    console.error("[list-rolls] fatal:", err?.message || err);
    return json({ ok: false, error: err?.message || "internal error" }, 500);
  }
}
