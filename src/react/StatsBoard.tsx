import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import StatsTable from "./StatsTable";

type Range = "today" | "week" | "month";
export type ThermoProp = "all" | 1 | 2;
type Size = "all" | 22 | 25 | 27 | 30;
type Shift = "all" | "DS" | "TW" | "NS";

type Props = { thermoformer: ThermoProp };

export default function StatsBoard({ thermoformer }: Props) {

  
  // filtros
  const [range, setRange] = useState<Range>("today");
  const [size, setSize] = useState<Size>("all");
  const [shift, setShift] = useState<Shift>("all");
  const [thermo, setThermo] = useState<ThermoProp>(thermoformer);

  // KPIs + hours
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({
    packetsTotal: 0,
    palletsOpened: 0,
    palletsClosed: 0,
  });
  const [hours, setHours] = useState<{ hour: number; count: number }[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ range, thermo, size, shift }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) {
      console.error(json.error);
      return;
    }
    setKpis(json.kpis);
    setHours(json.hours);
  }

  useEffect(() => {
    setThermo(thermoformer); // si entras a otra ruta /stats/thermoformer-2
  }, [thermoformer]);

  useEffect(() => {
    load();
  }, [range, thermo, size, shift]);

  const hourData = useMemo(
    () =>
      (hours || []).map((h) => ({
        name: String(h.hour).padStart(2, "0"),
        Packets: h.count,
      })),
    [hours]
  );

  return (
    <div className="max-w-[1200px] mx-auto p-2 sm:p-4">
      {/* filtros superiores */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* rango */}
        <div className="flex gap-2">
          {(["today", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-md ${
                range === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>

        {/* size */}
        <select
          value={size}
          onChange={(e) =>
            setSize((e.target.value as any) as Size)
          }
          className="ml-2 px-3 py-2 rounded-md bg-slate-200 dark:bg-slate-800"
        >
          <option value="all">All sizes</option>
          <option value={22}>22</option>
          <option value={25}>25</option>
          <option value={27}>27</option>
          <option value={30}>30</option>
        </select>

        {/* shift */}
        <select
          value={shift}
          onChange={(e) => setShift((e.target.value as any) as Shift)}
          className="px-3 py-2 rounded-md bg-slate-200 dark:bg-slate-800"
        >
          <option value="all">All shifts</option>
          <option value="DS">DS</option>
          <option value="TW">TW</option>
          <option value="NS">NS</option>
        </select>

        {/* thermo */}
        <select
          value={thermo}
          onChange={(e) => setThermo((e.target.value as any) as ThermoProp)}
          className="px-3 py-2 rounded-md bg-slate-200 dark:bg-slate-800"
        >
          <option value="all">All Thermo</option>
          <option value="1">Thermo 1</option>
          <option value="2">Thermo 2</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
          <div className="text-xs opacity-70 mb-1">Packets Total</div>
          <div className="text-2xl font-semibold">{kpis.packetsTotal}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
          <div className="text-xs opacity-70 mb-1">Pallets Opened</div>
          <div className="text-2xl font-semibold">{kpis.palletsOpened}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
          <div className="text-xs opacity-70 mb-1">Pallets Closed</div>
          <div className="text-2xl font-semibold">{kpis.palletsClosed}</div>
        </div>
      </div>

      {/* BAR CHART */}
      <div className="rounded-xl border border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 mb-6">
        <div className="text-sm font-semibold mb-2">Production by Hour</div>
        <div className="w-full h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={{ value: "Hour (NZ)", position: "insideBottom", offset: -5 }} />
              <YAxis allowDecimals={false} label={{ value: "Packets", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Bar dataKey="Packets" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLA DETALLADA */}
      <StatsTable range={range} thermo={thermo} size={size} shift={shift} />
    </div>
  );
}
