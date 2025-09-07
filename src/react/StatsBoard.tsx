// src/react/StatsBoard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Range = "day" | "week" | "month";
type Thermo = "1" | "2" | "all";

interface Props {
  thermoformer: Thermo; // "1" | "2" | "all"
}

export default function StatsBoard({ thermoformer }: Props) {
  const [range, setRange] = useState<Range>("day");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thermo: thermoformer, range }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Error loading stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [range, thermoformer]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <h2 className="text-lg font-semibold">
          Thermoformer {thermoformer === "all" ? "1 + 2" : thermoformer}
        </h2>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            className={`px-3 py-2 rounded-lg border ${
              range === "day"
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
            onClick={() => setRange("day")}
          >
            Today
          </button>
          <button
            className={`px-3 py-2 rounded-lg border ${
              range === "week"
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
            onClick={() => setRange("week")}
          >
            Week
          </button>
          <button
            className={`px-3 py-2 rounded-lg border ${
              range === "month"
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
            onClick={() => setRange("month")}
          >
            Month
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI title="Packets in range" value={data?.kpis?.packetsTotal ?? (loading ? "…" : 0)} />
        <KPI title="Active pallets" value={data?.kpis?.palletsActive ?? (loading ? "…" : 0)} />
        <KPI title="Completed pallets" value={data?.kpis?.palletsClosed ?? (loading ? "…" : 0)} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="By hour">
          <ChartBar dataset={data?.charts?.hourly ?? []} xKey="hour" />
        </Card>
        <Card title="By day">
          <ChartBar dataset={data?.charts?.daily ?? []} xKey="day" />
        </Card>
        <Card title="By shift">
          <ChartBar dataset={data?.charts?.shifts ?? []} xKey="shift" />
        </Card>
      </div>

      {/* Tabla */}
      <Card title="Production log">
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : loading ? (
          <p className="opacity-70 text-sm">Loading…</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-white/80">
                <tr className="border-b border-white/10">
                  <Th>ISO</Th>
                  <Th>Thermo</Th>
                  <Th>Raw</Th>
                  <Th>Batch</Th>
                  <Th>Box</Th>
                  <Th>Size</Th>
                  <Th>Shift</Th>
                  <Th>Pallet</Th>
                  <Th>Packet</Th>
                  <Th>Date</Th>
                  <Th>Time</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data?.table ?? []).map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-white/5">
                    <Td>{r.iso_number}</Td>
                    <Td>{r.thermoformer_number}</Td>
                    <Td className="font-mono">{r.raw_materials}</Td>
                    <Td className="font-mono">{r.batch_number}</Td>
                    <Td className="font-mono">{r.box_number}</Td>
                    <Td>{r.size}</Td>
                    <Td>{r.shift}</Td>
                    <Td>{r.pallet ?? "-"}</Td>
                    <Td>{r.packet_of_24}</Td>
                    <Td>{r.date}</Td>
                    <Td>{r.time}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1020] p-5">
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1020] p-5">
      <div className="text-sm opacity-80 mb-3">{title}</div>
      {children}
    </div>
  );
}

function ChartBar({ dataset, xKey }: { dataset: any[]; xKey: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dataset}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey={xKey} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const Th = ({ children }: React.PropsWithChildren) => (
  <th className="py-2 pr-4">{children}</th>
);
const Td = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
  <td className={`py-2 pr-4 ${className}`}>{children}</td>
);
