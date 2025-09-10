export const prerender = false;

const apiKey = import.meta.env.OPENAI_API_KEY as string;

type Out = {
  supplier: string;
  pallet_no: number | null;
  stock_code: string;
  batch_number: string;
  sticker_date: string; // YYYY-MM-DD
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!apiKey) return json({ error: "Missing OPENAI_API_KEY" }, 500);

    const { imageBase64 } = (await request.json()) as { imageBase64?: string };
    if (!imageBase64) return json({ error: "Missing imageBase64" }, 400);

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const prompt = `
Read the pallet label image and extract ONLY these fields:

supplier: brand/company name if visible (e.g. "CASPAK"), else "".
pallet_no: the integer after "Pallet One:" or "Pallet #", etc. If missing return null.
stock_code: a code like 8066-1601 (if present), else "".
batch_number: the big 5-digit number (e.g. 33693). If unreadable return "".
sticker_date: the printed date in format YYYY-MM-DD (convert from "March 27, 2025"). If missing return "".

Return strict JSON:
{"supplier":"","pallet_no":null,"stock_code":"","batch_number":"","sticker_date":""}
No extra keys, no prose.`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "Return valid JSON only." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    });

    const text = resp.choices?.[0]?.message?.content ?? "{}";
    const clean = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: Partial<Out> = {};
    try {
      parsed = JSON.parse(clean);
    } catch {
      return json({ error: "Model did not return JSON" }, 500);
    }

    const toNum = (v: any) => (v === null || v === undefined ? null : Number(String(v).replace(/\D+/g, "")) || null);
    const out: Out = {
      supplier: String(parsed.supplier ?? "").trim(),
      pallet_no: toNum(parsed.pallet_no),
      stock_code: String(parsed.stock_code ?? "").trim(),
      batch_number: String(parsed.batch_number ?? "").trim(),
      sticker_date: String(parsed.sticker_date ?? "").trim(), // YYYY-MM-DD
    };

    return json(out, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "OCR error" }, 500);
  }
}
