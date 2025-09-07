import React from "react";

type FileRow = {
  id: string;
  url: string;
  created_at: string;
  thermoformer_number: number;
  raw_materials: string;
  batch_number: string;
  box_number: string;
  photo_path: string;
};

export default function RollsGallery() {
  const [range, setRange] = React.useState<"day" | "week" | "month">("day");
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<FileRow | null>(null);
  const [zoom, setZoom] = React.useState(1);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/list-rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const json = await res.json();
      if (json.ok) setFiles(json.files || []);
      else console.error(json.error);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [range]);

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["day", "week", "month"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              range === r
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {r === "day" ? "Today" : r === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="min-h-[120px]">
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-slate-400 italic">No images in this range.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {files.map((f) => (
              <figure
                key={f.id}
                className="bg-slate-900/60 rounded-lg border border-slate-800 overflow-hidden hover:ring-2 hover:ring-blue-500/40 transition cursor-zoom-in"
                onClick={() => {
                  setSelected(f);
                  setZoom(1);
                }}
              >
                <img
                  src={f.url}
                  alt={f.photo_path}
                  className="w-full h-36 object-cover"
                  loading="lazy"
                />
                <figcaption className="p-2 text-[11px] text-slate-300">
                  TH{f.thermoformer_number} • {new Date(f.created_at).toLocaleString("en-NZ")}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {/* Modal + zoom */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-900 rounded-xl p-3 border border-slate-700 max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <div className="text-slate-200 text-sm">
                TH{selected.thermoformer_number} • {selected.photo_path}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                >
                  −
                </button>
                <span className="w-14 text-center text-slate-300 text-sm">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                >
                  +
                </button>
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-auto max-h-[78vh]">
              <img
                src={selected.url}
                alt={selected.photo_path}
                onDoubleClick={() => setZoom((z) => (z < 2 ? 2 : 1))}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="mx-auto max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
