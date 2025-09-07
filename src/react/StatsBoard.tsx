import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import StatsTable from "./StatsTable";

type Range = "day" | "week" | "month";
type Thermo = "1" | "2" | "all";
type Size = 22 | 25 | 27 | 30 | "all";
type Shift = "DS" | "TW" | "NS" | "all";

interface Kpis {
  packetsTotal: number;
  palletsOpenedInRange: number;
  palletsClosedInRange: number;
}

interface Charts {
  hourly: { hour: string; count: number }[];
  daily: { day: string; count: number }[];
  shifts: { shift: string; count: number }[];
}

export default function StatsBoard() {
  const [range, setRange] = useState<Range>("day");
  const [thermo, setThermo] = useState<Thermo>("all");
  const [size, setSize] = useState<Size>("all");
  const [shift, setShift] = useState<Shift>("all");
  const [live, setLive] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch stats
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range, thermo, size, shift }),
      });
      const json = await res.json();
      if (json.ok) {
        setKpis(json.kpis);
        setCharts(json.charts);
      } else {
        console.error("Error:", json.error);
      }
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [range, thermo, size, shift]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [live, range, thermo, size, shift]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Range buttons */}
        <div className="flex gap-2">
          {(["day", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded ${
                range === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              {r === "day" ? "Today" : r === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>

        {/* Size dropdown */}
        <select
          value={size}
          onChange={(e) =>
            setSize(
              e.target.value === "all"
                ? "all"
                : (Number(e.target.value) as Size)
            )
          }
          className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-sky-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All sizes</option>
          <option value="22">Size 22</option>
          <option value="25">Size 25</option>
          <option value="27">Size 27</option>
          <option value="30">Size 30</option>
        </select>

        {/* Shift dropdown */}
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value as Shift)}
          className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-sky-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All shifts</option>
          <option value="DS">Day Shift</option>
          <option value="TW">Twilight Shift</option>
          <option value="NS">Night Shift</option>
        </select>

        {/* Thermo dropdown */}
        <select
          value={thermo}
          onChange={(e) => setThermo(e.target.value as Thermo)}
          className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-sky-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Thermo</option>
          <option value="1">Thermo 1</option>
          <option value="2">Thermo 2</option>
        </select>

        {/* Live toggle */}
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
          />
          Live
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-slate-900 border border-blue-200">
          <p className="text-sm text-slate-500">Packets Total</p>
          <p className="text-2xl font-bold">
            {loading ? "…" : kpis?.packetsTotal ?? 0}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-slate-900 border border-blue-200">
          <p className="text-sm text-slate-500">Pallets Opened</p>
          <p className="text-2xl font-bold">
            {loading ? "…" : kpis?.palletsOpenedInRange ?? 0}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-slate-900 border border-blue-200">
          <p className="text-sm text-slate-500">Pallets Closed</p>
          <p className="text-2xl font-bold">
            {loading ? "…" : kpis?.palletsClosedInRange ?? 0}
          </p>
        </div>
      </div>

      {/* Hourly Bar Chart */}
      <div className="p-4 rounded-lg border bg-white dark:bg-slate-900">
        <h3 className="text-sm font-medium mb-3">Production by Hour</h3>
        {charts?.hourly && charts.hourly.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={charts.hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                label={{
                  value: "Hour of Day",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                allowDecimals={false}
                label={{ value: "Packets", angle: -90, position: "insideLeft" }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1e293b', // slate-800
                  border: '1px solid #334155', // slate-700
                  borderRadius: '8px',
                  color: '#f1f5f9', // slate-100
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
                labelStyle={{
                  color: '#cbd5e1', // slate-300
                  fontWeight: '600',
                  marginBottom: '4px'
                }}
                formatter={(value: any, name: string) => [
                  `${value} packets`, // Cambiamos "count" por "packets"
                  name === 'count' ? 'Production' : name
                ]}
                labelFormatter={(label) => `Hour: ${label}:00`}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-sm">No data available.</p>
        )}
      </div>
      <StatsTable range={range} thermo={thermo} size={size} shift={shift} />
    </div>
  );
}
