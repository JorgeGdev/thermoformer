import { useEffect, useState } from "react";
import React from "react";

type Props = {
  range: string;
  thermo: string | number;
  size: string | number;
  shift: string;
};

export default function StatsTable({ range, thermo, size, shift }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // 🔹 Paginación local adicional
  const [localPage, setLocalPage] = React.useState(1);
  const localLimit = 10; // 🔹 cuantos registros por página

  const totalPages = Math.ceil(rows.length / localLimit);

  const paginatedRows = rows.slice((localPage - 1) * localLimit, localPage * localLimit);

  const goPrev = () => setLocalPage((p) => Math.max(1, p - 1));
  const goNext = () => setLocalPage((p) => Math.min(totalPages, p + 1));

  async function load() {
    const res = await fetch("/api/stats-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, limit, range, thermo, size, shift }),
    });
    const json = await res.json();
    if (json.ok) {
      setRows(json.data);
      setTotal(json.count);
    } else {
      console.error("Error loading table:", json.error);
    }
  }

  useEffect(() => {
    load();
    setLocalPage(1); // Reset local page when filters change
  }, [page, range, thermo, size, shift]);

  return (
    <div className="mt-6">
      <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800 text-slate-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-center">ISO #</th>
              <th className="px-4 py-3 text-center">Thermo</th>
              <th className="px-4 py-3 text-center">Raw Materials</th>
              <th className="px-4 py-3 text-center">Batch</th>
              <th className="px-4 py-3 text-center">Box</th>
              <th className="px-4 py-3 text-center">Size</th>
              <th className="px-4 py-3 text-center">Shift</th>
              <th className="px-4 py-3 text-center">Pallet</th>
              <th className="px-4 py-3 text-center">Packet</th>
              <th className="px-4 py-3 text-center">Date</th>
              <th className="px-4 py-3 text-center">Hour</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="text-center py-6 text-slate-400 italic"
                >
                  No data available
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${
                    i % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900"
                  } hover:bg-slate-800/70 transition`}
                >
                  <td className="px-4 py-2 text-center font-semibold text-blue-400">
                    {r.iso_number}
                  </td>
                  <td className="px-4 py-2 text-center">{r.thermoformer_number}</td>
                  <td className="px-4 py-2 text-center">{r.raw_materials}</td>
                  <td className="px-4 py-2 text-center">{r.batch_number}</td>
                  <td className="px-4 py-2 text-center">{r.box_number}</td>
                  <td className="px-4 py-2 text-center">{r.size}</td>
                  <td className="px-4 py-2 text-center">{r.shift}</td>
                  <td className="px-4 py-2 text-center">{r.pallet_number}</td>
                  <td className="px-4 py-2 text-center">{r.packet_index}/24</td>
                  <td className="px-4 py-2 text-center">
                    {new Date(r.created_at).toLocaleDateString("en-NZ")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {new Date(r.created_at).toLocaleTimeString("en-NZ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Local Pagination */}
      <div className="flex justify-between items-center mt-4 px-2">
        <button
          disabled={localPage === 1}
          onClick={goPrev}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50 disabled:hover:bg-slate-700 transition border-2 border-white/30 hover:border-white/50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">
          Page {localPage} of {totalPages || 1} • {rows.length} total records
        </span>
        <button
          disabled={localPage >= totalPages}
          onClick={goNext}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-50 disabled:hover:bg-slate-700 transition border-2 border-white/30 hover:border-white/50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
