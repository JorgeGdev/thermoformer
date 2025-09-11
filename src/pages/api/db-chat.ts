// src/pages/apis/db-chat.ts
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

const TZ = "Pacific/Auckland";

// Helpers de fecha en NZ
function nzNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function nzStartOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function toISOUTC(d: Date) {
  // Convierte el instante "local NZ" a ISO UTC conservando el instante real
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

async function countBetweenUTC(startUTC: string, endUTC: string) {
  const { count, error } = await supabase
    .from("packets")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startUTC)
    .lt("created_at", endUTC);
  if (error) throw error;
  return count ?? 0;
}

async function handleQuestion(q: string): Promise<string> {
  const text = q.toLowerCase().trim();

  // Casos: hoy / ayer / hace N días
  const nowNZ = nzNow();
  if (/(^|\s)(hoy|today)(\s|$)/.test(text)) {
    const start = nzStartOfDay(nowNZ);
    const end = addDays(start, 1);
    const c = await countBetweenUTC(toISOUTC(start), toISOUTC(end));
    return `Hoy se registraron ${c} paquetes.`;
  }

  if (/(^|\s)(ayer|yesterday)(\s|$)/.test(text)) {
    const end = nzStartOfDay(nowNZ);
    const start = addDays(end, -1);
    const c = await countBetweenUTC(toISOUTC(start), toISOUTC(end));
    return `Ayer se registraron ${c} paquetes.`;
  }

  // "hace N días" / "N days ago"
  const mAgo = text.match(/hace\s+(\d+)\s+d[ií]as|(\d+)\s+days?\s+ago/);
  if (mAgo) {
    const n = Number(mAgo[1] || mAgo[2]);
    const end = nzStartOfDay(nowNZ);
    const start = addDays(end, -n);
    const afterStart = nzStartOfDay(start);
    const afterEnd = addDays(afterStart, 1);
    const c = await countBetweenUTC(toISOUTC(afterStart), toISOUTC(afterEnd));
    return `Hace ${n} día(s) se registraron ${c} paquetes.`;
  }

  // "esta semana" (desde lunes NZ) / "this week"
  if (/esta\s+semana|this\s+week/.test(text)) {
    const d = nzStartOfDay(nowNZ);
    const day = d.getDay(); // 0 dom, 1 lun, ...
    const mondayOffset = (day + 6) % 7; // días desde lunes
    const start = addDays(d, -mondayOffset);
    const end = addDays(start, 7);
    const c = await countBetweenUTC(toISOUTC(start), toISOUTC(end));
    return `Esta semana llevamos ${c} paquetes.`;
  }

  // "este mes" / "this month"
  if (/este\s+mes|this\s+month/.test(text)) {
    const d = nzNow();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const c = await countBetweenUTC(toISOUTC(start), toISOUTC(end));
    return `Este mes llevamos ${c} paquetes.`;
  }

  // Entre fechas: "entre 2025-03-10 y 2025-03-15"
  const mBetween =
    text.match(/entre\s+(\d{4}-\d{2}-\d{2})\s+y\s+(\d{4}-\d{2}-\d{2})/) ||
    text.match(/between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/);
  if (mBetween) {
    const start = new Date(mBetween[1] + "T00:00:00");
    const end = new Date(mBetween[2] + "T00:00:00");
    const c = await countBetweenUTC(toISOUTC(start), toISOUTC(addDays(end, 1)));
    return `Entre ${mBetween[1]} y ${mBetween[2]} se registraron ${c} paquetes.`;
  }

  // Fallback
  return "Pregunta entendida, pero aún no la soportamos. Prueba con: 'hoy', 'ayer', 'hace 3 días', 'esta semana', 'este mes', o 'entre YYYY-MM-DD y YYYY-MM-DD'.";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { question } = await request.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing question" }), { status: 400 });
    }
    const answer = await handleQuestion(question);
    return new Response(JSON.stringify({ ok: true, answer }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "Server error" }), { status: 500 });
  }
};
