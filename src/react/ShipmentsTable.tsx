// src/react/ShipmentsTable.tsx
import React, { useEffect, useState } from "react";

type Row = {
  id: string;
  number: number | null;            // <- viene del backend
  thermoformer_number: number | null;
  size: number | null;
  iso_start: number | null;
  iso_end: number | null;
  closed_at: string | null;
  destination: string | null;
};

function cx(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}
const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-NZ") : "—";

export default function ShipmentsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const limit = 12;

  const totalPages = Math.max(1, Math.ceil(count / limit));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/shipments?action=list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, limit }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "HTTP error");
      setRows(j.data ?? []);
      setCount(j.count ?? 0);
      setLocations(j.locations ?? []);
    } catch (e) {
      console.error("[shipments list] error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page]);

  function onSelect(id: string, loc: string) {
    setDraft((d) => ({ ...d, [id]: loc }));
  }

  async function save(id: string) {
    const loc = draft[id];
    if (!loc) return;
    try {
      const res = await fetch("/api/shipments?action=assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: id, location: loc }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "Save error");
      setRows((old) =>
        old.map((r) => (r.id === id ? { ...r, destination: j.data.location } : r))
      );
      setDraft((d) => {
        const nd = { ...d };
        delete nd[id];
        return nd;
      });
    } catch (e: any) {
      console.error("[shipments assign] error:", e);
      alert(e?.message || "Save error");
    }
  }

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg overflow-hidden border border-slate-800">
      <table className="w-full text-sm text-slate-200">
        <thead className="bg-slate-800 text-slate-300 uppercase text-xs">
          <tr>
            <th className="px-3 py-3 text-center">Pallet Number</th>
            <th className="px-3 py-3 text-center">Thermoformer</th>
            <th className="px-3 py-3 text-center">Size</th>
            <th className="px-3 py-3 text-center">ISO start</th>
            <th className="px-3 py-3 text-center">ISO end</th>
            <th className="px-3 py-3 text-center">Closed At</th>
            <th className="px-3 py-3 text-center">Destination</th>
            <th className="px-3 py-3 text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400">Loading…</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400 italic">No closed pallets</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id} className={cx(i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900")}>
                <td className="px-3 py-2 text-center">
                  {typeof r.number === "number" ? `${r.number}` : r.id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-center">{r.thermoformer_number ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.size ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.iso_start ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.iso_end ?? "—"}</td>
                <td className="px-3 py-2 text-center">{fmtDT(r.closed_at)}</td>
                <td className="px-3 py-2 text-center">
                  <select
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1"
                    value={draft[r.id] ?? r.destination ?? ""}
                    onChange={(e) => onSelect(r.id, e.target.value)}
                  >
                    <option value="" disabled>Select location…</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    disabled={!draft[r.id]}
                    onClick={() => save(r.id)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Paginación */}
      <div className="flex justify-between items-center mt-4 px-4 py-3">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">
          Page {page} of {Math.max(1, Math.ceil(count / limit))}
        </span>
        <button
          disabled={page >= Math.max(1, Math.ceil(count / limit))}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
