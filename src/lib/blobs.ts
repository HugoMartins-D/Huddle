/*
 * Arquivos de vídeo das gravações, guardados no IndexedDB do navegador.
 * Quando o backend entrar, estas funções passam a falar com o armazenamento do servidor.
 */
const DB_NAME = "huddle-arquivos";
const STORE = "gravacoes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao acessar o armazenamento de vídeos."));
    };
  });
}

export const blobs = {
  put: (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id)),
  get: (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id)),
  remove: (id: string) => run("readwrite", (s) => s.delete(id)),
  clear: () => run("readwrite", (s) => s.clear()),
};
