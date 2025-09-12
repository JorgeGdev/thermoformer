import React from "react";

type FileRow = {
  id: string;
  url: string | null;           // puede venir null si no hubo foto
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

  // carga con limpieza previa para evitar “fantasmas”
  async function load() {
    setLoading(true);
    setFiles([]); // limpia la grilla antes del fetch
    try {
      const res = await fetch("/api/list-rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const json = await res.json();
      if (json.ok) {
        setFiles((json.files ?? []) as FileRow[]);
      } else {
        console.error("[list-rolls] error:", json.error);
      }
    } catch (e) {
      console.error("[list-rolls] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["day", "week", "month"] as const).map((r) => {
          const active = range === r;
          return (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg font-medium transition
                ${active ? "bg-slate-600 text-white shadow-sm border-2 border-white/30" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border-2 border-white/20"}
              `}
            >
              {r === "day" ? "Today" : r === "week" ? "This Week" : "This Month"}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="min-h-[160px]">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-lg bg-slate-800/60 border border-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : files.length === 0 ? (
          <p className="text-slate-400 italic">No images in this range.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {files.map((f) => (
              <Thumb key={f.id} file={f} onOpen={(row) => { setSelected(row); setZoom(1); }} />
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
              <div className="text-slate-200 text-sm truncate">
                TH{selected.thermoformer_number} • {selected.photo_path}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                >
                  −
                </button>
                <span className="w-14 text-center text-slate-300 text-sm">{Math.round(zoom * 100)}%</span>
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                >
                  +
                </button>
                <button
                  className="px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-700 border-2 border-white/30 hover:border-white/50 transition-all"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-auto max-h-[78vh] flex items-start justify-center">
              {/* cache-buster usando created_at + photo_path (luego lo cambiamos a updated_at) */}
              <img
                src={`${selected.url ?? ""}?v=${encodeURIComponent(
                  `${selected.created_at}|${selected.photo_path}`
                )}`}
                alt={selected.photo_path}
                onDoubleClick={() => setZoom((z) => (z < 2 ? 2 : 1))}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mini-componente para cada tarjeta, con ocultamiento si la imagen falla */
function Thumb({
  file,
  onOpen,
}: {
  file: FileRow;
  onOpen: (f: FileRow) => void;
}) {
  const [hide, setHide] = React.useState(false);
  if (hide || !file.url) return null;

  // cache-buster: con created_at + photo_path; luego lo cambiaremos a updated_at del storage
  const src = `${file.url}?v=${encodeURIComponent(`${file.created_at}|${file.photo_path}`)}`;

  const localTime = new Date(file.created_at).toLocaleString("en-NZ", {
    hour12: false,
  });

  return (
    <figure
      className="bg-slate-900/60 rounded-lg border border-slate-800 overflow-hidden hover:ring-2 hover:ring-slate-500/40 transition cursor-zoom-in"
      onClick={() => onOpen(file)}
      title={file.photo_path}
    >
      <img
        src={src}
        alt={file.photo_path}
        className="w-full h-36 object-cover"
        loading="lazy"
        onError={() => setHide(true)}
      />
      <figcaption className="p-2 text-[11px] text-slate-300 flex items-center justify-between">
        <span className="px-1.5 py-0.5 rounded bg-slate-600/20 text-slate-200 border border-slate-500/30">
          TH{file.thermoformer_number}
        </span>
        <span className="truncate ml-2">{localTime}</span>
      </figcaption>
    </figure>
  );
}
