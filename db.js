// Livello dati: IndexedDB con 4 store (categories, articles, lists, purchases).
const DB_NAME = 'spesa';
const DB_VERSION = 2;
// aliases: memoria delle righe scontrino già associate a un articolo ({ key, articleId })
export const STORES = ['categories', 'articles', 'lists', 'purchases', 'aliases'];

let dbPromise;
export function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => { req.result.close(); dbPromise = null; };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const run = (store, mode, fn) =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );

export const all = (store) => run(store, 'readonly', (o) => o.getAll());
export const get = (store, id) => run(store, 'readonly', (o) => o.get(id));
/** Inserisce o aggiorna; restituisce l'id. */
export const put = (store, value) => run(store, 'readwrite', (o) => o.put(value));
export const del = (store, id) => run(store, 'readwrite', (o) => o.delete(id));

export async function exportAll() {
  const data = { app: 'spesa', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORES) data[s] = await all(s);
  return data;
}

/** Sostituisce tutto il contenuto con quello del backup, in un'unica transazione. */
export async function importAll(data) {
  if (!data || data.app !== 'spesa') throw new Error('File non valido: non è un backup di questa app.');
  for (const s of STORES) {
    if (data[s] === undefined && s === 'aliases') data[s] = []; // backup creati prima della scansione scontrino
    if (!Array.isArray(data[s])) throw new Error('Backup incompleto: manca "' + s + '".');
  }
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    for (const s of STORES) {
      const os = tx.objectStore(s);
      os.clear();
      for (const row of data[s]) os.put(row);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Importazione annullata'));
  });
}

export async function wipe() {
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    for (const s of STORES) tx.objectStore(s).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
