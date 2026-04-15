const DB_NAME = "sparecircle";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const ACTIVE_PROJECT_KEY = "active-project";

interface PersistedProjectRecord {
  id: string;
  serializedProject: string;
  savedAt: string;
}

function openProjectDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openProjectDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = run(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    };
  }));
}

export async function saveActiveProjectToIndexedDb(serializedProject: string): Promise<void> {
  const record: PersistedProjectRecord = {
    id: ACTIVE_PROJECT_KEY,
    serializedProject,
    savedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(record));
}

export async function loadActiveProjectFromIndexedDb(): Promise<PersistedProjectRecord | null> {
  const result = await withStore<PersistedProjectRecord | undefined>("readonly", (store) => store.get(ACTIVE_PROJECT_KEY));
  return result ?? null;
}
