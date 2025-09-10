// src/pages/api/raw-pallets.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE as string;

// safety
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Rango de fechas en NZ (Today/Week/Month) */
function nzRange(kind: "today" | "week" | "month") {
  // Forzamos zona NZ. En Node 18+ esto funciona con timeZone en Intl.
  const tz = "Pacific/Auckland";
  const now = new Date();

  if (kind === "today") {
    // ejemplo para rango 'today'
    // start = inicio del día actual en NZ
    // end = inicio del día siguiente en NZ
    const nzDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    
    const [y, m, d] = nzDateStr.split("-").map((n) => parseInt(n, 10));
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }

  if (kind === "week") {
    // Semana actual en NZ (lunes a domingo)
    const nzDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
    }).format(now);
    
    const [y, m, d] = nzDateStr.split("-").map((n) => parseInt(n, 10));
    const nzMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    
    // Obtenemos el día de la semana en NZ
    const wd = new Intl.DateTimeFormat("en-NZ-u-ca-iso8601", {
      weekday: "short",
      timeZone: tz,
    }).format(nzMidnight);
    
    const dayIdx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
    const start = new Date(nzMidnight);
    start.setUTCDate(start.getUTCDate() - dayIdx);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }

  if (kind === "month") {
    // Mes actual en NZ
    const nzDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    
    const [y, m] = nzDateStr.split("-").map((n) => parseInt(n, 10));
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }

  // fallback para casos no esperados
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export async function POST({ request, url }: { request: Request; url: URL }) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return json({ error: "Missing Supabase envs" }, 500);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // action: list | update | delete
    const action =
      (url.searchParams.get("action") as "list" | "update" | "delete") ?? "list";

    if (action === "list") {
      type Range = "today" | "week" | "month";
      const body = (await request.json().catch(() => ({}))) as {
        range?: Range;
        page?: number;
        limit?: number;
      };

      const range: Range = body.range ?? "today";
      const page = Math.max(1, Number(body.page ?? 1));
      const limit = Math.min(100, Math.max(10, Number(body.limit ?? 20)));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { startISO, endISO } = nzRange(range);

      // Leemos DESDE LA VISTA (solo lectura/agrupado listo para UI)
      const sel = supabase
        .from("v_raw_pallets")
        .select("*", { count: "exact" })
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: false })
        .range(from, to);

      const { data, count, error } = await sel;
      if (error) {
        console.error("[raw-pallets list] supabase error:", error);
        return json({ error: error.message }, 500);
      }
      return json({ data, count, page, limit });
    }

    if (action === "update") {
      // Se edita en la TABLA base raw_pallets
      const body = (await request.json()) as {
        id: string;
        supplier?: string;
        pallet_no?: number;
        stock_code?: string;
        batch_number?: string;
        sticker_date?: string; // 'YYYY-MM-DD'
        rolls_total?: number;
        rolls_used?: number;
        photo_path?: string | null;
      };
      if (!body?.id) return json({ error: "Missing id" }, 400);

      const { id, ...fields } = body;
      const { data, error } = await supabase
        .from("raw_pallets")
        .update(fields)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[raw-pallets update] supabase error:", error);
        return json({ error: error.message }, 500);
      }
      return json({ data });
    }

    if (action === "delete") {
      const body = (await request.json()) as { id: string };
      if (!body?.id) return json({ error: "Missing id" }, 400);

      const { error } = await supabase.from("raw_pallets").delete().eq("id", body.id);
      if (error) {
        console.error("[raw-pallets delete] supabase error:", error);
        return json({ error: error.message }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("[raw-pallets] fatal:", err?.message, err?.stack);
    return json({ error: err?.message ?? "server error" }, 500);
  }
}
