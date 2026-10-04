// 手元の曲のファイル本体。ブラウザ内（IndexedDB）にだけ保存し、外部へは送らない
const DB_NAME = 'inmb';
const STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putFile(id: string, file: Blob): Promise<void> {
  await run('readwrite', store => store.put(file, id));
}

export async function getFile(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', store => store.get(id));
}

export async function listFileIds(): Promise<string[]> {
  const keys = await run('readonly', store => store.getAllKeys());
  return keys.map(String);
}

/** リストから消えた曲のファイルを消す */
export async function pruneFiles(keepIds: Iterable<string>): Promise<void> {
  const keep = new Set(keepIds);
  for (const id of await listFileIds()) {
    if (!keep.has(id)) await run('readwrite', store => store.delete(id));
  }
}
