import { emptyProgress, validateProgress } from "./learning";
import type { Progress } from "./types";
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("human-atlas-study", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("progress");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      dbPromise = undefined;
      reject(r.error);
    };
    r.onblocked = () => {
      dbPromise = undefined;
      reject(new Error("Close other LearnHumanBody tabs to enable storage."));
    };
  }));
}
export async function loadProgress() {
  const db = await database();
  return new Promise<Progress>((resolve, reject) => {
    const r = db.transaction("progress").objectStore("progress").get("learner");
    r.onsuccess = () => {
      try {
        resolve(r.result ? validateProgress(r.result) : emptyProgress());
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
  });
}
export async function saveProgress(p: Progress) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(p, "learner");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
