// src/react/RawPalletsGallery.tsx
import React, { useEffect, useState } from "react";

type Item = {
  id: string;
  supplier: string | null;
  pallet_no: number;
  stock_code: string | null;
  batch_number: string;
  sticker_date: string | null;
  created_at: string;
  photo_path: string;
  public_url: string; // armado en el endpoint
};

function fmtNZ(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-NZ");
  } catch {
    return ts;
  }
}

export default function RawPalletsGallery() {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 24;

  const totalPages = Math.max(1, Math.ceil(count / limit));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/list-raw-pallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, limit }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "HTTP error");
      setItems(j.items ?? []);
      setCount(j.count ?? 0);
    } catch (e) {
      console.error("[RawPalletsGallery] load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page]);

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold mb-4">Raw Labels (scanned)</h2>

      {loading && items.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-slate-400 italic">
          No scanned labels yet
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((it) => (
            <div
              key={it.id + it.photo_path}
              className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow"
            >
              <div className="aspect-[4/3] bg-black/40">
                <img
                  src={it.public_url}
                  alt={`Raw pallet ${it.batch_number} - pallet ${it.pallet_no}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="p-4 text-sm text-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="opacity-70">Batch</span>
                  <span className="font-semibold">{it.batch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Pallet</span>
                  <span className="font-semibold">{it.pallet_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Supplier</span>
                  <span className="font-semibold">{it.supplier ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Stock</span>
                  <span className="font-semibold">{it.stock_code ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Sticker date</span>
                  <span className="font-semibold">{it.sticker_date ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Scanned at</span>
                  <span className="font-mono">{fmtNZ(it.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      <div className="flex justify-between items-center mt-6 px-1">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
