// src/react/RawPalletsTable.tsx
import React, { useEffect, useState } from "react";

type Row = {
  id: string;
  supplier: string;
  pallet_no: number;
  stock_code: string | null;
  batch_number: string;
  sticker_date: string | null; // YYYY-MM-DD
  photo_path: string | null;
  created_at: string;
  in_thf: boolean; // NEW: whether a roll image exists in bucket for this batch
};

function cx(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export default function RawPalletsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 12;

  // formulario de alta (fila "Add new")
  const [addForm, setAddForm] = useState({
    supplier: "",
    pallet_no: "",
    stock_code: "",
    batch_number: "",
    sticker_date: "",
  });

  // edición en línea: guardamos draft y disparamos PATCH al salir (onBlur) o Enter
  const [draft, setDraft] = useState<Record<string, Partial<Row>>>({});

  const totalPages = Math.max(1, Math.ceil(count / limit));

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/raw-pallets?action=list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, limit }), // sin range
      });
      const j = await res.json();
      if (res.ok) {
        setRows(j.data ?? []);
        setCount(j.count ?? 0);
      } else {
        console.error("[raw-pallets list] error:", j?.error);
      }
    } catch (e) {
      console.error("[raw-pallets list] fatal:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page]);

  // helpers

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
      const res = await fetch("/api/raw-pallets?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update error");
      setRows((old) => old.map((x) => (x.id === id ? { ...x, ...j.data } : x)));
      setDraft((d) => {
        const nd = { ...d };
        delete nd[id];
        return nd;
      });
    } catch (e: any) {
      console.error("[raw-pallets update] error:", e);
      alert(e?.message || "Update error");
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this pallet?")) return;
    try {
      const res = await fetch("/api/raw-pallets?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete error");
      setRows((r) => r.filter((x) => x.id !== id));
      setCount((c) => Math.max(0, c - 1));
    } catch (e: any) {
      console.error("[raw-pallets delete] error:", e);
      alert(e?.message || "Delete error");
    }
  }

  async function addNew() {
    // validaciones simples
    const pallet_no = parseInt(addForm.pallet_no || "0", 10);
    if (!addForm.batch_number || !pallet_no) {
      alert("Batch Number y Pallet No son obligatorios");
      return;
    }

    try {
      const res = await fetch("/api/save-raw-pallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: addForm.supplier || null,
          pallet_no,
          stock_code: addForm.stock_code || null,
          batch_number: addForm.batch_number,
          sticker_date: addForm.sticker_date || null,
          // photo_path: null
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Insert error");

      // recargar
      await load();
      setAddForm({
        supplier: "",
        pallet_no: "",
        stock_code: "",
        batch_number: "",
        sticker_date: "",
      });
    } catch (e: any) {
      console.error("[addNew] error:", e);
      alert(e?.message || "Insert error");
    }
  }

  function onKeyCommit(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
      void commitEdit(id);
    }
  }

  return (
    <div className="mt-6">
      {/* Tabla */}
      <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800 text-slate-300 uppercase text-xs">
            <tr>
              <th className="px-3 py-3 text-center">Pallet</th>
              <th className="px-3 py-3 text-center">Batch</th>
              <th className="px-3 py-3 text-center">Supplier</th>
              <th className="px-3 py-3 text-center">Stock</th>
              <th className="px-3 py-3 text-center">Sticker date</th>
              <th className="px-3 py-3 text-center">IN THF</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>

          {/* Fila de alta (Add new) */}
          <tbody>
            <tr className="bg-slate-950/40">
              <td className="px-3 py-2 text-center">
                <input
                  className="w-20 bg-transparent border-0 outline-none text-center"
                  placeholder="#"
                  value={addForm.pallet_no}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, pallet_no: e.target.value }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  className="w-28 bg-transparent border-0 outline-none text-center"
                  placeholder="Batch"
                  value={addForm.batch_number}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, batch_number: e.target.value }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  className="w-28 bg-transparent border-0 outline-none text-center"
                  placeholder="Supplier"
                  value={addForm.supplier}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, supplier: e.target.value }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  className="w-28 bg-transparent border-0 outline-none text-center"
                  placeholder="Stock"
                  value={addForm.stock_code}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, stock_code: e.target.value }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  className="w-32 bg-transparent border-0 outline-none text-center"
                  placeholder="YYYY-MM-DD"
                  value={addForm.sticker_date}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, sticker_date: e.target.value }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-center text-slate-400">—</td>
              <td className="px-3 py-2 text-center">
                <button
                  onClick={addNew}
                  className="px-3 py-1.5 rounded bg-slate-600 hover:bg-slate-700 text-white border-2 border-white/30 hover:border-white/50 transition-all"
                >
                  Add
                </button>
              </td>
            </tr>

            {/* Filas de datos */}
                {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400 italic">
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={cx(
                    i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900",
                    "hover:bg-slate-800/70"
                  )}
                >
                  <td className="px-3 py-2 text-center font-semibold">
                    <input
                      className="w-16 bg-transparent border-0 outline-none text-center"
                      value={getValue(r, "pallet_no")}
                      onChange={(e) =>
                        startEdit(r.id, "pallet_no", Number(e.target.value || 0))
                      }
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                      inputMode="numeric"
                    />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-28 bg-transparent border-0 outline-none text-center"
                      value={getValue(r, "batch_number")}
                      onChange={(e) => startEdit(r.id, "batch_number", e.target.value)}
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                    />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-28 bg-transparent border-0 outline-none text-center"
                      value={getValue(r, "supplier")}
                      onChange={(e) => startEdit(r.id, "supplier", e.target.value)}
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                    />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-28 bg-transparent border-0 outline-none text-center"
                      value={getValue(r, "stock_code")}
                      onChange={(e) => startEdit(r.id, "stock_code", e.target.value)}
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                    />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <input
                      className="w-32 bg-transparent border-0 outline-none text-center"
                      placeholder="YYYY-MM-DD"
                      value={getValue(r, "sticker_date")}
                      onChange={(e) =>
                        startEdit(r.id, "sticker_date", e.target.value)
                      }
                      onBlur={() => commitEdit(r.id)}
                      onKeyDown={(e) => onKeyCommit(e, r.id)}
                    />
                  </td>

                  {/* IN THF */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        "px-2 py-1 rounded text-xs " +
                        (r.in_thf
                          ? "bg-emerald-600/20 text-blue-300 border border-blue-700/40"
                          : "bg-slate-700/30 text-slate-300 border border-slate-600/30")
                      }
                    >
                      {r.in_thf ? "Yes" : "No"}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => del(r.id)}
                        className="px-2 py-1 rounded bg-[#05b348] hover:bg-[#07fa50] text-white"
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
    </div>
  );
}
