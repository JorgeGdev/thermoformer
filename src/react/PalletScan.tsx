import React, { useRef, useState } from "react";

// compresor basado en tu ThermoFormBasic (resize + dataURL) :contentReference[oaicite:3]{index=3}
function resizeImageFile(file: File, maxWidth = 1600, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const r = new FileReader();
    r.onload = () => (img.src = String(r.result));
    r.onerror = reject;
    img.onload = () => {
      const s = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    r.readAsDataURL(file);
  });
}

type Form = {
  supplier: string;
  pallet_no: string;
  stock_code: string;
  batch_number: string;
  sticker_date: string; // YYYY-MM-DD
  photo?: string;
};

export default function PalletScan() {
  const [f, setF] = useState<Form>({
    supplier: "",
    pallet_no: "",
    stock_code: "",
    batch_number: "",
    sticker_date: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onChange<K extends keyof Form>(k: K, v: Form[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("Reading image...");
    const dataUrl = await resizeImageFile(file, 1600, 0.7);
    setF((p) => ({ ...p, photo: dataUrl }));
    setBusy(true);
    try {
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/ocr-raw-pallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "OCR error");

      setF({
        supplier: json.supplier || "",
        pallet_no: json.pallet_no ? String(json.pallet_no) : "",
        stock_code: json.stock_code || "",
        batch_number: json.batch_number || "",
        sticker_date: json.sticker_date || "",
        photo: dataUrl,
      });
      setMsg("Values detected. Please review.");
    } catch (e: any) {
      setMsg(`OCR failed: ${e?.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!f.pallet_no || !f.batch_number) {
      setMsg("pallet_no and batch_number are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/save-raw-pallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: f.supplier,
          pallet_no: Number(f.pallet_no),
          stock_code: f.stock_code,
          batch_number: f.batch_number,
          sticker_date: f.sticker_date,
          photoBase64: f.photo,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error || "Save error");
      setMsg("Saved ✓");
    } catch (e: any) {
      setMsg(`Error: ${e?.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full sm:w-[260px] h-[120px] rounded-xl text-white font-semibold text-lg
                     bg-gradient-to-r from-slate-500 via-slate-600 to-slate-700
                     shadow-lg hover:from-slate-400 hover:to-slate-800 active:scale-[0.98] transition grid place-items-center ">
          {busy ? "Scanning..." : "Scan Pallet Sticker"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Supplier
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={f.supplier} onChange={(e)=>onChange("supplier", e.target.value)} />
        </label>
        <label className="text-sm">Pallet No
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={f.pallet_no} onChange={(e)=>onChange("pallet_no", e.target.value)} />
        </label>
        <label className="text-sm">Stock code
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={f.stock_code} onChange={(e)=>onChange("stock_code", e.target.value)} />
        </label>
        <label className="text-sm">Batch #
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={f.batch_number} onChange={(e)=>onChange("batch_number", e.target.value)} />
        </label>
        <label className="text-sm">Sticker date (YYYY-MM-DD)
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={f.sticker_date} onChange={(e)=>onChange("sticker_date", e.target.value)} />
        </label>
      </div>

      {f.photo && (
        <img src={f.photo} alt="pallet sticker" className="max-h-48 rounded border" />
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
                className="rounded px-4 py-2 bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50">
          Save
        </button>
        {msg && <span className="text-sm opacity-80">{msg}</span>}
      </div>
    </div>
  );
}
