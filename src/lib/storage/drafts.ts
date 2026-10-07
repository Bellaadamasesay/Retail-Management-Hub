/**
 * Small IndexedDB-backed store for work in progress (stock-take counts), so a
 * refresh, a closed tab or a dropped connection never loses a long count.
 * Falls back to memory where IndexedDB is unavailable (private windows,
 * tests); the app works either way, you just don't survive a reload.
 */
const DB_NAME = "retailhub";
const STORE = "drafts";

export interface Draft<T> {
  value: T;
  savedAt: string;
}

const memory = new Map<string, Draft<unknown>>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<R>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<R>): Promise<R | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const draft: Draft<T> = { value, savedAt: new Date().toISOString() };
  memory.set(key, draft);
  await run("readwrite", (store) => store.put(draft, key));
}

export async function loadDraft<T>(key: string): Promise<Draft<T> | null> {
  const stored = await run<Draft<T>>("readonly", (store) => store.get(key) as IDBRequest<Draft<T>>);
  return stored ?? (memory.get(key) as Draft<T> | undefined) ?? null;
}

export async function deleteDraft(key: string): Promise<void> {
  memory.delete(key);
  await run("readwrite", (store) => store.delete(key));
}
