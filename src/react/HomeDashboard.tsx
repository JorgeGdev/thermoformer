import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";

interface HomeStatsData {
  currentShift: {
    code: string;
    label: string;
    target: number;
    shiftTarget: number;
    progressPercent: number;
  };
  thermoformers: {
    thermo1: { count: number; idealTarget: number; percentOfShift: number };
    thermo2: { count: number; idealTarget: number; percentOfShift: number };
  };
  summary: {
    totalPackets: number;
    totalPlixies: number;
    shiftProgress: number;
    shiftTarget: number;
    remainingToTarget: number;
  };
  trending: Array<{
    hour: number;
    thermo1: number;
    thermo2: number;
    total: number;
  }>;
}

export default function HomeDashboard() {
  const [data, setData] = useState<HomeStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch("/api/home-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        console.error("Home stats error:", json.error);
      }
    } catch (err) {
      console.error("Failed to load home stats:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/80">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load dashboard data</div>
      </div>
    );
  }

  const chartData = data.trending.map(item => ({
    name: String(item.hour).padStart(2, '0'),
    "Thermo 1": item.thermo1,
    "Thermo 2": item.thermo2,
    "Total": item.total
  }));

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Current Shift Header */}
      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-white drop-shadow-lg mb-2">
          Plixies Control Dashboard
        </div>
        <div className="text-xl text-white/90 drop-shadow mb-6">
          {data.currentShift.label} - Real Time Production
        </div>
        
        {/* Animated Kiwi Progress Bar */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="relative flex items-center justify-between h-20 bg-slate-800/20 rounded-full overflow-hidden backdrop-blur">
            {/* START Flag */}
            <div className="absolute left-2 z-10 flex items-center">
              <img 
                src="/images/start.png" 
                alt="Start" 
                className="h-12 w-auto drop-shadow-lg"
              />
            </div>
            
            {/* Progress Track */}
            <div className="absolute inset-2 rounded-full">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${Math.min(100, data.currentShift.progressPercent)}%` }}
              >
                {/* Progress glow effect */}
                <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            {/* Running Kiwi */}
            <div 
              className="absolute z-20 transition-all duration-1000 ease-out"
              style={{ 
                left: `${Math.max(8, Math.min(85, (data.currentShift.progressPercent * 0.85) + 8))}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="relative">
                <img 
                  src="/images/kiwifruit.png" 
                  alt="Running Kiwi" 
                  className="h-10 w-auto drop-shadow-xl animate-bounce"
                />
                {/* Motion lines behind kiwi */}
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex space-x-1 opacity-60">
                  <div className="w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '100ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                </div>
              </div>
            </div>
            
            {/* FINISH Flag */}
            <div className="absolute right-2 z-10 flex items-center">
              <img 
                src="/images/finish.png" 
                alt="Finish" 
                className="h-12 w-auto drop-shadow-lg"
              />
            </div>
          </div>
          
          {/* Progress Text Below */}
          <div className="mt-3 text-center">
            <div className="text-lg font-semibold text-white">
              {data.currentShift.progressPercent}% Complete
            </div>
            <div className="text-sm text-white/80">
              {data.summary.totalPackets} / {data.summary.shiftTarget} packets
              {data.summary.remainingToTarget > 0 && (
                <span className="ml-2 text-orange-300">
                  ({data.summary.remainingToTarget} more needed)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Shift Target Progress - Main KPI */}
        <div className="md:col-span-2 lg:col-span-1 bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-white/70 mb-3">Shift Target</div>
          <div className="text-3xl font-bold text-white mb-2">
            {data.summary.totalPackets}<span className="text-lg text-white/60">/{data.summary.shiftTarget}</span>
          </div>
          <div className="text-xs text-white/60 mb-3">
            {data.summary.shiftTarget} packets per shift (combined)
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                data.currentShift.progressPercent >= 100 ? 'bg-green-500' :
                data.currentShift.progressPercent >= 75 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, data.currentShift.progressPercent)}%` }}
            />
          </div>
          {data.summary.remainingToTarget > 0 && (
            <div className="text-xs text-orange-400">
              {data.summary.remainingToTarget} more needed
            </div>
          )}
        </div>

        {/* Thermoformer 1 */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/70">Thermoformer 1</div>
            <div className="text-lg font-bold text-blue-400">
              {data.thermoformers.thermo1.percentOfShift}%
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-2">
            {data.thermoformers.thermo1.count}
            <span className="text-lg text-white/60"> packets</span>
          </div>
          <div className="text-xs text-white/60 mb-3">
            {data.thermoformers.thermo1.percentOfShift}% of shift production
          </div>
          <div className="text-xs text-white/50">
            Ideal: ~{data.thermoformers.thermo1.idealTarget} packets (50% of {data.summary.shiftTarget})
          </div>
        </div>

        {/* Thermoformer 2 */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/70">Thermoformer 2</div>
            <div className="text-lg font-bold text-purple-400">
              {data.thermoformers.thermo2.percentOfShift}%
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-2">
            {data.thermoformers.thermo2.count}
            <span className="text-lg text-white/60"> packets</span>
          </div>
          <div className="text-xs text-white/60 mb-3">
            {data.thermoformers.thermo2.percentOfShift}% of shift production
          </div>
          <div className="text-xs text-white/50">
            Ideal: ~{data.thermoformers.thermo2.idealTarget} packets (50% of {data.summary.shiftTarget})
          </div>
        </div>

        {/* Total Packets */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-white/70 mb-3">Total Packets</div>
          <div className="text-3xl font-bold text-green-400 mb-2">
            {data.summary.totalPackets.toLocaleString()}
          </div>
          <div className="text-xs text-white/60">
            This shift
          </div>
        </div>

        {/* Total Plixies */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-white/70 mb-3">Total Plixies</div>
          <div className="text-3xl font-bold text-orange-400 mb-2">
            {data.summary.totalPlixies.toLocaleString()}
          </div>
          <div className="text-xs text-white/60">
            432 plixies per packet
          </div>
        </div>
      </div>

      {/* Production Trending Chart */}
      <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
        <div className="text-xl font-semibold text-white mb-6">
          24-Hour Production Trend
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorThermo1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorThermo2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="name" 
                stroke="#9CA3AF"
                fontSize={12}
                label={{
                  value: "Hour (NZ Time)",
                  position: "insideBottom",
                  offset: -5,
                  style: { textAnchor: 'middle', fill: '#9CA3AF' }
                }}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                label={{
                  value: "Packets",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fill: '#9CA3AF' }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Thermo 1"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorThermo1)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Thermo 2"
                stroke="#A855F7"
                fillOpacity={1}
                fill="url(#colorThermo2)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Total"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorTotal)"
                strokeWidth={3}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}