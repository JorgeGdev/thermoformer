// src/react/NewPalletsTable.tsx
import React, { useEffect, useState } from "react";

type Row = {
  id: string;                // pallet id (UUID)
  number: number | null;     // puede venir null si no existe la columna en DB
  thermoformer_number: number | null;
  size: number | null;
  iso_start: number | null;
  iso_end: number | null;
  completed: boolean;        // true si count(packet_index)=24
  packets_count: number;     // cuántos packets asociados
  created_at: string;        // del pallet (opened_at)
  closed_at: string | null;  // fecha de cierre del pallet
};

function cx(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}
const shortId = (id: string) => id.slice(0, 8);

export default function NewPalletsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 12;

  const [draft, setDraft] = useState<Record<string, Partial<Row>>>({});

  const totalPages = Math.max(1, Math.ceil(count / limit));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/new-pallets?action=list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, limit }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "HTTP error");
      setRows(j.data ?? []);
      setCount(j.count ?? 0);
    } catch (e) {
      console.error("[new-pallets list] error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  function startEdit(id: string, key: keyof Row, val: any) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: val } }));
  }
  function getValue(r: Row, key: keyof Row) {
    const d = draft[r.id]?.[key];
    return (d !== undefined ? d : (r as any)[key]) ?? "";
  }
  async function commitEdit(id: string) {
    const patch = draft[id];
    if (!patch || Object.keys(patch).length === 0) return;
    try {
      const res = await fetch("/api/new-pallets?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "Update error");
      setRows((old) => old.map((x) => (x.id === id ? { ...x, ...j.data } : x)));
      setDraft((d) => { const nd = { ...d }; delete nd[id]; return nd; });
    } catch (e: any) {
      console.error("[new-pallets update] error:", e);
      alert(e?.message || "Update error");
    }
  }
  function onKeyCommit(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
      void commitEdit(id);
    }
  }

  async function addNew() {
    // Por ahora, usaremos valores por defecto. Podrías agregar un formulario para capturar estos valores
    const defaultSize = 25; // o el tamaño que prefieras por defecto
    const defaultThermoformer = 1; // o el termoformador que prefieras por defecto
    
    try {
      const res = await fetch("/api/new-pallets?action=create", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          size: defaultSize, 
          thermoformer_number: defaultThermoformer 
        })
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "Create error");
      await load();
      // j.data.number existe y viene de pallet_number
      if (typeof j?.data?.number === "number") {
        alert(`New pallet created: #${j.data.number} (Size: ${j.data.size}, TH: ${j.data.thermoformer_number})`);
      } else {
        alert(`New pallet created: ${shortId(j.data.id)}`);
      }
    } catch (e: any) {
      console.error("[new-pallets create] error:", e);
      alert(e?.message || "Create error");
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this pallet? (It will detach associated packets)")) return;
    try {
      const res = await fetch("/api/new-pallets?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || "Delete error");
      setRows((r) => r.filter((x) => x.id !== id));
      setCount((c) => Math.max(0, c - 1));
    } catch (e: any) {
      console.error("[new-pallets delete] error:", e);
      alert(e?.message || "Delete error");
    }
  }

  async function downloadCSV(row: Row) {
    // Formatear fechas para CSV
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Datos del pallet para CSV
    const csvData = [
      ["Field", "Value"],
      ["Pallet Number", row.number?.toString() ?? shortId(row.id)],
      ["Thermoformer", row.thermoformer_number?.toString() ?? "—"],
      ["Size", row.size?.toString() ?? "—"],
      ["ISO Start", row.iso_start?.toString() ?? "—"],
      ["ISO End", row.iso_end?.toString() ?? "—"],
      ["Completed", row.completed ? "Yes" : "No"],
      ["Packets Count", row.packets_count.toString()],
      ["Opened At", formatDate(row.created_at)],
      ["Closed At", formatDate(row.closed_at)],
      ["Status", row.closed_at ? "Closed" : "Open"],
    ];

    // Convertir a CSV
    const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    
    // Crear archivo y descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pallet_${row.number || shortId(row.id)}_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">New Pallets Control</h2>
        <button
          onClick={addNew}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Add pallet
        </button>
      </div>

      <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800 text-slate-300 uppercase text-xs">
            <tr>
              <th className="px-3 py-3 text-center">Pallet Number</th>
              <th className="px-3 py-3 text-center">Thermoformer</th>
              <th className="px-3 py-3 text-center">Size</th>
              <th className="px-3 py-3 text-center">ISO start</th>
              <th className="px-3 py-3 text-center">ISO end</th>
              <th className="px-3 py-3 text-center">Completed</th>
              <th className="px-3 py-3 text-center">Packets</th>
              <th className="px-3 py-3 text-center">Closed At</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 italic">No pallets</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className={cx(
                  i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900",
                  "hover:bg-slate-800/70"
                )}>
                  <td className="px-3 py-2 text-center font-semibold">
                    {typeof r.number === "number" ? `${r.number}` : shortId(r.id)}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-20 bg-transparent border-0 outline-none text-center"
                      placeholder="1|2"
                      value={getValue(r, "thermoformer_number") ?? ""}
                      onChange={(e) =>
                        startEdit(r.id, "thermoformer_number", Number(e.target.value || 0))
                      }
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                      inputMode="numeric"
                    />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-20 bg-transparent border-0 outline-none text-center"
                      placeholder="Size"
                      value={getValue(r, "size") ?? ""}
                      onChange={(e) => startEdit(r.id, "size", Number(e.target.value || 0))}
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                      inputMode="numeric"
                    />
                  </td>

                  <td className="px-3 py-2 text-center">{r.iso_start ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{r.iso_end ?? "—"}</td>

                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        "px-2 py-1 rounded text-xs " +
                        (r.completed
                          ? "bg-emerald-600/20 text-emerald-300 border border-emerald-700/40"
                          : "bg-slate-700/30 text-slate-300 border border-slate-600/30")
                      }
                    >
                      {r.completed ? "Yes" : "No"}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-center">{r.packets_count}</td>

                  <td className="px-3 py-2 text-center text-xs">
                    {r.closed_at ? (
                      <span className="text-slate-400">
                        {new Date(r.closed_at).toLocaleString("en-NZ", {
                          timeZone: "Pacific/Auckland",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Open</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => downloadCSV(r)}
                        className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-700 text-white text-xs"
                        title="Download CSV"
                      >
                        Print
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                        title="Delete pallet"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex justify-between items-center mt-4 px-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50 disabled:hover:bg-slate-700 transition"
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50 disabled:hover:bg-slate-700 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
