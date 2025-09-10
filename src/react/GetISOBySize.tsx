import React, { useState } from "react";
import { type Size } from "../config/sizes";

type Shift = "DS" | "TW" | "NS";

interface Props {
  size: Size;
}

const btnBig =
  "w-full h-[110px] rounded-xl text-white font-semibold text-lg " +
  "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 " +
  "shadow-lg shadow-blue-900/20 hover:from-blue-400 hover:via-blue-600 hover:to-blue-800 " +
  "active:scale-[0.98] transition flex items-center justify-center";

const chip =
  "px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-lg";

export default function GetISOBySize({ size }: Props) {
  const [shift, setShift] = useState<Shift>("DS");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMsg, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  async function createISO(thermoformer: 1 | 2) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/get-iso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, thermoformer, shift }),
      });
      const json = await res.json();
      if (!res.ok || json?.error || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const packet = Array.isArray(json?.packet) ? json.packet[0] : json.packet;
      setResult(packet);
      setOpen(true);
    } catch (e: any) {
      setError(e?.message || "Failed to create ISO");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function generateCSV() {
    if (!result) return;
    
    // CSV headers and data
    const headers = ["ISO_NUMBER", "SIZE", "PACKET", "PALLET", "ISO_DATE"];
    const data = [
      result.iso_number || "",
      result.size || "",
      result.packet_index || "",
      result.pallet_number || "",
      result.iso_date || ""
    ];
    
    // Create CSV content
    const csvContent = [
      headers.join(","),
      data.map(field => `"${field}"`).join(",")
    ].join("\n");
    
    // Generate filename with current timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `ISO_${result.iso_number}_${timestamp}.csv`;
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Size lock + shift selector */}
      <div className="flex items-center gap-3">
        <div className={chip}>
          <span className="opacity-70 mr-2 text-white">Size</span>
          <span className="font-semibold">{size}</span>
        </div>

        <span className="text-lg opacity-80 ml-2">Shift:</span>
        <div className="flex gap-2">
          {(["DS", "TW", "NS"] as Shift[]).map((s) => (
            <button
              key={s}
              onClick={() => setShift(s)}
              className={
                "px-5 py-2.5 rounded-lg border text-lg " +
                (shift === s
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-white/5 border-white/10 hover:bg-white/10")
              }
            >
              {s === "DS" ? "Day Shift" : s === "TW" ? "Twilight" : "Night"}
            </button>
          ))}
        </div>
      </div>

      {/* Thermoformer buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          className={btnBig}
          disabled={loading}
          onClick={() => createISO(1)}
        >
          {loading ? "Processing..." : "THERMOFORMER 1"}
        </button>

        <button
          className={btnBig}
          disabled={loading}
          onClick={() => createISO(2)}
        >
          {loading ? "Processing..." : "THERMOFORMER 2"}
        </button>
      </div>

      <p className="text-lg opacity-70">
        The system will use the latest roll data from the selected thermoformer and assign pallet/position automatically.
      </p>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0B1020] border border-white/10 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {errorMsg ? (
              <>
                <h3 className="text-xl font-semibold text-red-400">
                  Couldn’t create ISO
                </h3>
                <p className="mt-2 text-lg opacity-80">{errorMsg}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-lg"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-6 text-center  text-white">ISO Created Successfully</h3>
                
                {/* PROTAGONISTA: ISO NUMBER - Centro y Grande */}
                <div className="flex justify-center mb-8">
                  <div className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 px-8 py-6 rounded-2xl shadow-xl shadow-green-900/30 border border-green-400/20">
                    <div className="text-center">
                      <div className="text-base opacity-80 tracking-wider uppercase mb-1">ISO Number</div>
                      <div className="text-4xl font-bold text-white tracking-tight">
                        {result?.iso_number}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEGUNDO EN IMPORTANCIA: SIZE - Destacado pero más pequeño */}
                <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 px-6 py-4 rounded-xl shadow-lg shadow-blue-900/20 border border-blue-400/20">
                    <div className="text-center">
                      <div className="text-sm opacity-80 tracking-wider uppercase mb-1">Size</div>
                      <div className="text-2xl font-bold text-white">
                        {result?.size}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CAMPOS SECUNDARIOS - Alrededor en grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-lg">
                  <div className={chip + " bg-slate-700/30 border-slate-600/20"}>
                    <span className="opacity-70 mr-2 text-white">Shift</span>
                    <span className="font-semibold text-amber-300">{result?.shift}</span>
                  </div>
                  <div className={chip + " bg-slate-700/30 border-slate-600/20"}>
                    <span className="opacity-70 mr-2 text-white">Thermo</span>
                    <span className="font-semibold text-cyan-300">{result?.thermoformer_number}</span>
                  </div>
                  <div className={chip + " bg-slate-700/30 border-slate-600/20"}>
                    <span className="opacity-70 mr-2 text-white">Pallet</span>
                    <span className="font-semibold text-purple-300">{result?.pallet_number}</span>
                  </div>
                  <div className={chip + " bg-slate-700/30 border-slate-600/20"}>
                    <span className="opacity-70 mr-2 text-white">Packet</span>
                    <span className="font-semibold text-orange-300">{result?.packet_index}/24</span>
                  </div>
                  <div className={chip + " col-span-2 bg-slate-700/30 border-slate-600/20"}>
                    <span className="opacity-70 mr-2 text-white">ISO Date</span>
                    <span className="font-semibold text-indigo-300">{result?.iso_date}</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-lg space-y-2">
                  <div>
                    <span className="opacity-70 mr-2 text-white">Raw materials:</span>
                    <span className="font-mono text-white">{result?.raw_materials}</span>
                  </div>
                  <div>
                    <span className="opacity-70 mr-2 text-white">Batch #:</span>
                    <span className="font-mono text-white">{result?.batch_number}</span>
                  </div>
                  <div>
                    <span className="opacity-70 mr-2 text-white">CTN (Box) #:</span>
                    <span className="font-mono text-white">{result?.box_number}</span>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 text-white">
                  <button
                    onClick={() => generateCSV()}
                    className="px-5 py-2.5 rounded-lg bg-green-600/80 hover:bg-green-600 text-lg font-semibold"
                  >
                    PRINT
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="px-5 py-2.5 rounded-lg bg-white/50 hover:bg-white/20 text-lg"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}