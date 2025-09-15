import React, { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface ISOStatsData {
  summary: {
    totalPackets: number;
    totalISOs: number;
  };
  bySizes: {
    22: number;
    25: number;
    27: number;
    30: number;
  };
  recentISOs: Array<{
    iso_number: string;
    size: number;
    thermoformer_number: number;
    created_at: string;
  }>;
}

export default function ISOStats() {
  const [data, setData] = useState<ISOStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    try {
      const res = await fetch("/api/iso-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        console.error("ISO stats error:", json.error);
      }
    } catch (err) {
      console.error("Failed to load ISO stats:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-400">Loading stats...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <div className="text-red-400">Failed to load stats</div>
      </div>
    );
  }

  const chartData = [
    { name: "22", packets: data.bySizes[22] },
    { name: "25", packets: data.bySizes[25] },
    { name: "27", packets: data.bySizes[27] },
    { name: "30", packets: data.bySizes[30] }
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Today's Production</div>
          <div className="text-2xl font-bold text-white">{data.summary.totalPackets}</div>
          <div className="text-xs text-slate-500">Total packets processed</div>
        </div>

        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">ISOs Created</div>
          <div className="text-2xl font-bold text-white">{data.summary.totalISOs}</div>
          <div className="text-xs text-slate-500">New ISO numbers today</div>
        </div>

        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Active Sizes</div>
          <div className="text-2xl font-bold text-white">
            {Object.values(data.bySizes).filter(count => count > 0).length}
          </div>
          <div className="text-xs text-slate-500">Sizes in production</div>
        </div>
      </div>

      {/* Production by Size Chart */}
      <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
        <div className="text-lg font-semibold text-white mb-4">Production by Size (Today)</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                stroke="#94A3B8"
                fontSize={12}
                label={{
                  value: "Size",
                  position: "insideBottom",
                  offset: -5,
                  style: { textAnchor: 'middle', fill: '#94A3B8' }
                }}
              />
              <YAxis 
                stroke="#94A3B8"
                fontSize={12}
                label={{
                  value: "Packets",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fill: '#94A3B8' }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#F1F5F9'
                }}
              />
              <Bar 
                dataKey="packets" 
                fill="#4c8549"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentISOs.length > 0 && (
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="text-lg font-semibold text-white mb-4">Recent ISO Activity</div>
          <div className="space-y-2">
            {data.recentISOs.map((iso, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-mono text-blue-400">{iso.iso_number}</div>
                  <div className="text-xs text-slate-400">Size {iso.size}</div>
                  <div className="text-xs text-slate-400">Thermo {iso.thermoformer_number}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(iso.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Pacific/Auckland'
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}