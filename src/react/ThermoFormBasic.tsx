// Comments in English
import React, { useRef, useState } from "react";
import ConfirmModal from "./ConfirmModal";

// Resize an image file to max width and JPEG quality, return base64 string
function resizeImageFile(
  file: File,
  maxWidth = 1600,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = String(reader.result);
    };
    reader.onerror = reject;

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type FormData = {
  rawMaterials: string; // Production #
  batchNumber: string; // Caspak Batch #
  boxNumber: string; // CTN#
  photo?: string; // base64 preview
};

type Props = {
  thermoformerNumber?: 1 | 2; // optional, default 1
};

export default function ThermoFormBasic({ thermoformerNumber = 1 }: Props) {
  const [data, setData] = useState<FormData>({
    rawMaterials: "",
    batchNumber: "",
    boxNumber: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onChange<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function openScanner() {
    fileRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setMsg("Compressing and reading image...");

    try {
      // ⬅️ Comprime antes de enviar
      const resizedBase64 = await resizeImageFile(f, 1600, 0.7);

      // Guardar preview
      onChange("photo", resizedBase64);

      // Extraer solo la parte base64 (sin el "data:image/jpeg;base64,")
      const base64 = resizedBase64.split(",")[1];

      setLoading(true);
      const res = await fetch("/api/ocr-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || `OCR HTTP ${res.status}`);
      }

      const json = await res.json();

      setData({
        rawMaterials: json.raw_materials ?? "",
        batchNumber: json.batch_number ?? "",
        boxNumber: json.box_number ?? "",
        photo: resizedBase64,
      });
      setMsg(
        `Values extracted. (img ~${
          json?._debug?.sizeKB ?? "?"
        } KB) Review before saving.`
      );
    } catch (err: any) {
      setMsg(`AI failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  function isValid() {
    return (
      data.rawMaterials.trim() &&
      data.batchNumber.trim() &&
      data.boxNumber.trim()
    );
  }

  function openConfirm() {
    if (!isValid()) {
      setMsg("Please complete all fields.");
      return;
    }
    setConfirmOpen(true);
  }

  async function doSave() {
    setSaving(true);
    setMsg("Saving to Supabase...");
    try {
      const res = await fetch("/api/save-roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thermoformer_number: thermoformerNumber,
          raw_materials: data.rawMaterials,
          batch_number: data.batchNumber,
          box_number: data.boxNumber,
          photoBase64: data.photo,
        }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out?.error || `HTTP ${res.status}`);
      setMsg("Saved ✓");
      setConfirmOpen(false);
    } catch (e: any) {
      setMsg(`Error: ${e?.message ?? "Unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Scan button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={openScanner}
          className="w-full sm:w-[260px] h-[120px]
                     rounded-xl text-white font-semibold text-lg
                     bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800
                     shadow-lg shadow-slate-900/20
                     hover:from-slate-500 hover:via-slate-600 hover:to-slate-700
                     active:scale-[0.98]
                     transition grid place-items-center"
        >
          {loading ? "Scanning..." : "Scan Roll Data"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>

      {/* Editable fields (auto-filled by OCR) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Production # (Raw materials)
          <input
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-white/10 dark:bg-slate-900 px-3 py-2"
            placeholder="e.g. 25020430"
            value={data.rawMaterials}
            onChange={(e) => onChange("rawMaterials", e.target.value)}
          />
        </label>

        <label className="text-sm">
          Caspak Batch #
          <input
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-white/10 dark:bg-slate-900 px-3 py-2"
            placeholder="e.g. 33693"
            value={data.batchNumber}
            onChange={(e) => onChange("batchNumber", e.target.value)}
          />
        </label>

        <label className="text-sm">
          CTN# (Box number)
          <input
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-white/10 dark:bg-slate-900 px-3 py-2"
            placeholder="e.g. 931"
            value={data.boxNumber}
            onChange={(e) => onChange("boxNumber", e.target.value)}
          />
        </label>
      </div>

      {/* Photo preview */}
      {data.photo && (
        <img
          src={data.photo}
          alt="Roll label preview"
          className="max-h-48 rounded border border-slate-200 dark:border-slate-800"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openConfirm}
          disabled={saving}
          className="rounded px-4 py-2 bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Confirm & Save
        </button>
        {msg && <span className="text-sm opacity-80">{msg}</span>}
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        values={{
          rawMaterials: data.rawMaterials,
          batchNumber: data.batchNumber,
          boxNumber: data.boxNumber,
        }}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
      />
    </div>
  );
}
