// src/pages/api/ocr-intake.ts
export const prerender = false; // ✅ permite POST en dev/SSR

// Server env vars (Astro)
const apiKey = import.meta.env.OPENAI_API_KEY as string;

// Tipos de salida
type Out = { raw_materials: string; batch_number: string; box_number: string };


// Helper JSON response
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Limpieza de respuesta del modelo (quita ```json ... ```)
function stripCodeFence(s: string) {
  return s.replace(/```json\s*|\s*```/g, "").trim();
}

// Sanitizadores
const cleanDigits = (v?: string) => (v ?? "").replace(/[^\d]/g, "").trim();
const cleanText = (v?: string) => (v ?? "").trim();

// Timeout suave (no cancela la request, pero evita colgar la ruta)
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("OCR timed out")), ms)),
  ]);
}

export async function POST({ request }: { request: Request }) {
  const started = Date.now();
  try {
    // Validar API key
    if (!apiKey || apiKey === "your-openai-api-key-here") {
      return json({ error: "Missing OPENAI_API_KEY (server)" }, 500);
    }

    // Leer body
    const { imageBase64 } = (await request.json()) as { imageBase64?: string };
    if (!imageBase64) return json({ error: "Missing imageBase64" }, 400);

    // Diagnóstico de tamaño del payload
    // Nota: base64 ocupa ~4/3 del binario. Esto calcula KB aproximados del binario original.
    const sizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
    if (sizeKB > 1500) {
      // Límite conservador para evitar 500 por payload gigante
      return json(
        {
          error: "Image too large. Please retake closer or compress.",
          sizeKB,
          hint: "Try a photo under ~1.5MB; 1200-1600px wide is plenty.",
        },
        413
      );
    }

    // Import dinámico para evitar bundling issues
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const prompt = `
Read the roll label image. Extract these fields ONLY by anchored labels:
- "Production #"   -> raw_materials
- "Caspak Batch #" -> batch_number
- "CTN#"           -> box_number

Return STRICT JSON with exactly:
{"raw_materials":"","batch_number":"","box_number":""}

Rules:
- Digits/letters only where appropriate and trim spaces.
- If a field is missing/unclear, return "".
- No extra keys. No prose. JSON only.
`;

    // Llamada al modelo con timeout suave
    const resp = await withTimeout(
      client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: "Return only valid JSON for the requested fields." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              // Enviamos como data URL base64
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      }),
      20_000
    );

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const cleaned = stripCodeFence(raw);

    // Intentar parsear JSON
    let parsed: Partial<Out>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Si el modelo falló con JSON inválido, devolvemos error informativo
      return json(
        {
          error: "Model did not return valid JSON",
          _debug: { rawSnippet: cleaned.slice(0, 160), sizeKB, durationMs: Date.now() - started },
        },
        500
      );
    }

    // Sanitizar con cuidado (no romper ceros a la izquierda en Production # si algún día cambia)
    const out: Out = {
      raw_materials: cleanText(parsed.raw_materials), // Production #
      batch_number: cleanDigits(parsed.batch_number), // Caspak Batch #
      box_number: cleanDigits(parsed.box_number),     // CTN#
    };

    return json({ ...out, _debug: { sizeKB, durationMs: Date.now() - started } }, 200);
  } catch (err: any) {
    const msg = err?.message || "OCR error";
    console.error("[OCR] ERROR:", msg);
    return json({ error: msg, _debug: { durationMs: Date.now() - started } }, 500);
  }
}
