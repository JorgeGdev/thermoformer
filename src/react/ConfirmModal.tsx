// Comments in English
import React from "react";

type Props = {
  open: boolean;
  values: { rawMaterials: string; batchNumber: string; boxNumber: string };
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({ open, values, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-8 grid place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40">
              ✓
            </div>
            <h3 className="text-lg font-semibold">Please confirm the values</h3>
          </div>

          <ul className="text-sm space-y-2">
            <li><span className="opacity-70">Production #:</span> <strong>{values.rawMaterials || "—"}</strong></li>
            <li><span className="opacity-70">Caspak Batch #:</span> <strong>{values.batchNumber || "—"}</strong></li>
            <li><span className="opacity-70">CTN# (Box number):</span> <strong>{values.boxNumber || "—"}</strong></li>
          </ul>

          <p className="text-xs opacity-70">
            Are these values correct? You can go back and edit them if needed.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded px-4 py-2 text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="rounded px-4 py-2 text-white bg-blue-600 hover:bg-blue-700"
              onClick={onConfirm}
            >
              Confirm & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
