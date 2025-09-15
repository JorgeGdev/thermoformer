// Simple helpers to pick and persist a directory handle and save files into it.

type DirHandle = FileSystemDirectoryHandle;

// Ask user to pick the folder once (C:\BarTender\input) and persist permission
export async function connectBarTenderFolder(): Promise<DirHandle | null> {
  if (!('showDirectoryPicker' in window)) return null;

  // optional but recommended: ask for persistent storage to reduce permission loss
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try { await navigator.storage.persist(); } catch {}
  }

  const dir = await (window as any).showDirectoryPicker({ mode: 'readwrite' }) as DirHandle;

  // store handle in IndexedDB via structured clone
  await saveHandle(dir);
  return dir;
}

// Try to restore previously saved handle
export async function getSavedBarTenderFolder(): Promise<DirHandle | null> {
  try { return await loadHandle(); } catch { return null; }
}

// Ensure we still have write permission
export async function ensureWritePermission(dir: DirHandle): Promise<boolean> {
  // @ts-ignore
  const state = await dir.queryPermission({ mode: 'readwrite' });
  if (state === 'granted') return true;
  // @ts-ignore
  const requested = await dir.requestPermission({ mode: 'readwrite' });
  return requested === 'granted';
}

// Save a CSV string into the connected folder
export async function saveCsvToBarTender(dir: DirHandle, fileName: string, csv: string) {
  // Windows safe filename
  fileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  await writable.close();
}

// --- tiny IndexedDB helpers (no deps) ---
const DB = 'bt-handle-db';
const STORE = 'handles';

async function idb() {
  return await new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function saveHandle(handle: DirHandle) {
  const db = await idb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, 'dir');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function loadHandle(): Promise<DirHandle | null> {
  const db = await idb();
  return await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('dir');
    req.onsuccess = () => res((req.result as DirHandle) || null);
    req.onerror = () => rej(req.error);
  });
}