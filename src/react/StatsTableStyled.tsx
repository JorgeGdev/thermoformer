import React from "react";

type PacketRow = {
  id: string;
  iso_number: number;
  thermoformer_number: number;
  raw_materials: string;
  batch_number: string;
  box_number: string;
  size: number;
  shift: string;
  pallet_number: number;
  packet_index: number;
  iso_date: string;
  created_at: string;
};

type Props = {
  rows: PacketRow[];
};

export default function StatsTableStyled({ rows }: Props) {
  return (
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
            <th className="px-4 py-3 text-center">ISO Date</th>
            <th className="px-4 py-3 text-center">Created At</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="text-center py-6 text-slate-400 italic"
              >
                No data available
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
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
                <td className="px-4 py-2 text-center">{r.iso_date}</td>
                <td className="px-4 py-2 text-center">
                  {new Date(r.created_at).toLocaleString("en-NZ", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
