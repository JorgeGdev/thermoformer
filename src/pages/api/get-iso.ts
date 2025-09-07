// src/pages/api/get-iso.ts
export const prerender = false;

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.SUPABASE_URL!,
  import.meta.env.SUPABASE_SERVICE_ROLE!
);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { size, thermoformer, shift, user_id } = body;

    if (!size || !thermoformer || !shift) {
      return json({ error: "Missing required fields" }, 400);
    }

    // ⚡ Llamamos a la función SQL create_packet
    const { data, error } = await supabase.rpc("create_packet", {
      p_size: size,
      p_thermo: thermoformer,
      p_shift: shift,
      p_user: user_id ?? null,
    });

    if (error) {
      console.error("[get-iso] Supabase error:", error);
      return json({ error: error.message }, 500);
    }

    return json({ success: true, packet: data }, 200);
  } catch (err: any) {
    console.error("[get-iso] Unexpected error:", err?.message);
    return json({ error: err?.message ?? "Unexpected error" }, 500);
  }
}
