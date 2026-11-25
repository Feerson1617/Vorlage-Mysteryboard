import { sha256 } from "@noble/hashes/sha2.js";
import { validateWork, type Work } from "../../src/core/model";
import type { Task } from "../../src/core/documents";

export interface LevelInfo {
  id: string;
  name: string;
  description: string;
  hash: string;
  version: string;
  mode: "off" | "session" | "extended";
}
export interface Catalogue {
  id: string;
  title: string;
  levels: LevelInfo[];
}
export interface PendingText {
  id: number;
  title: string;
  text: string;
}
export interface CameraView {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}
export interface Snapshot {
  key: string;
  collection: string;
  level: string;
  hash: string;
  version: string;
  session: string;
  revision: number;
  time: number;
  work: Work;
  pending?: PendingText;
  openCard?: number;
  view?: CameraView;
  checksum: string;
}
export const ttl = 3 * 60 * 60 * 1000;
const prefix = "mysteryboard.028.";
const scope = (c: string, l: string) => prefix + JSON.stringify([c, l]);
const active = (id: string) => prefix + "active." + id;
const keyFor = (c: string, l: string, h: string, s: string) =>
  JSON.stringify([c, l, h, s]);
export function lastLevel(c: Catalogue) {
  try {
    const last = JSON.parse(sessionStorage.getItem(active(c.id)) || "null");
    return c.levels.find(
      (l) =>
        l.mode !== "off" &&
        l.id === last?.id &&
        l.hash === last.hash &&
        sessionSeed(c.id, l),
    );
  } catch {
    return undefined;
  }
}
export function clearSelection(c: Catalogue, fresh: boolean) {
  try {
    sessionStorage.removeItem(active(c.id));
    if (fresh)
      for (const l of c.levels) sessionStorage.removeItem(scope(c.id, l.id));
  } catch {
    /* A denied store has no accessible selection. */
  }
}
function digest(row: Omit<Snapshot, "checksum">) {
  return Array.from(
    sha256(new TextEncoder().encode(JSON.stringify(row))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function intact(row: Snapshot | undefined, c: string, l: LevelInfo) {
  if (
    !row ||
    typeof row.session !== "string" ||
    !row.work ||
    (row.work.team !== undefined && typeof row.work.team !== "string") ||
    !Array.isArray(row.work.cards) ||
    row.collection !== c ||
    row.level !== l.id ||
    row.hash !== l.hash ||
    row.version !== l.version ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    !Number.isFinite(row.time) ||
    row.time > Date.now() + 60000 ||
    row.key !== keyFor(c, l.id, l.hash, row.session)
  )
    return false;
  const { checksum, ...body } = row;
  return digest(body) === checksum;
}
export function sessionSeed(c: string, l: LevelInfo) {
  if (l.mode === "off") return;
  try {
    const key = scope(c, l.id);
    const row = JSON.parse(sessionStorage.getItem(key) || "null");
    if (row && l.mode === "extended" && row.time + ttl <= Date.now()) {
      sessionStorage.removeItem(key);
      return;
    }
    return intact(row, c, l) ? (row as Snapshot) : undefined;
  } catch {
    return;
  }
}
export function validated(row: Snapshot, task: Task) {
  if (row.hash !== task.contentHash)
    throw Error("Diese Sicherung gehört zu einer anderen Inhaltsversion.");
  const work = validateWork(row.work, task.content);
  if (
    row.pending &&
    (!task.content.cards.some(
      (c) => c.id === row.pending!.id && c.studentEditable,
    ) ||
      typeof row.pending.text !== "string" ||
      row.pending.text.length > 4000 ||
      typeof row.pending.title !== "string" ||
      row.pending.title.length > 100)
  )
    throw Error("Der gespeicherte Textentwurf ist ungültig.");
  const v = row.view;
  const view =
    v &&
    [v.x, v.y, v.z, v.width, v.height].every(Number.isFinite) &&
    v.z > 0 &&
    v.width > 0 &&
    v.height > 0
      ? v
      : undefined;
  const openCard = work.cards.some((card) => card.id === row.openCard)
    ? row.openCard
    : undefined;
  return { ...row, work, view, openCard };
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("MysteryBoard-Unterricht", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("work", { keyPath: "key" });
    request.onsuccess = () => {
      const d = request.result;
      d.onversionchange = () => {
        d.close();
        database = undefined;
      };
      resolve(d);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Lokaler Speicher blockiert."));
  }).catch((e) => {
    database = undefined;
    throw e;
  }));
}
async function transaction(run: (store: IDBObjectStore) => void) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("work", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
    run(tx.objectStore("work"));
  });
}
export async function candidates(c: Catalogue) {
  if (!c.levels.some((l) => l.mode === "extended")) return [];
  const rows: Snapshot[] = [];
  await transaction((store) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      const row = item.value as Snapshot;
      const l = c.levels.find(
        (l) => l.id === row.level && l.mode === "extended",
      );
      if (!Number.isFinite(row.time) || row.time + ttl <= Date.now())
        item.delete();
      else if (l && intact(row, c.id, l)) rows.push(row);
      item.continue();
    };
  });
  return rows.sort((a, b) => b.time - a.time);
}
// A copied tab can inherit sessionStorage. Claim the writer for this document
// before reusing its session, so concurrent tabs never overwrite each other.
export async function claim(session: string, signal: AbortSignal) {
  let locks: LockManager;
  try {
    locks = navigator.locks;
    if (!locks) return "unavailable";
  } catch {
    return "unavailable";
  }
  return new Promise<"acquired" | "occupied" | "unavailable">((resolve) => {
    locks
      .request(prefix + session, { ifAvailable: true }, async (lock) => {
        resolve(lock && !signal.aborted ? "acquired" : "occupied");
        if (lock && !signal.aborted)
          await new Promise<void>((done) =>
            signal.addEventListener("abort", () => done(), { once: true }),
          );
      })
      .catch(() => resolve("unavailable"));
  });
}
export class Writer {
  revision: number;
  confirmedRevision = 0;
  private removing = false;
  get isSaved() {
    return (
      !this.removing &&
      this.revision > 0 &&
      this.confirmedRevision === this.revision
    );
  }
  constructor(
    readonly collection: string,
    readonly level: LevelInfo,
    readonly session: string,
    revision = 0,
  ) {
    this.revision = revision;
  }
  async write(
    work: Work,
    pending?: PendingText,
    view?: CameraView,
    openCard?: number,
  ) {
    if (this.removing) return "";
    const { collection, level, session } = this;
    const body = {
      key: keyFor(collection, level.id, level.hash, session),
      collection,
      level: level.id,
      hash: level.hash,
      version: level.version,
      session,
      revision: ++this.revision,
      time: Date.now(),
      work,
      ...(pending ? { pending } : {}),
      ...(openCard !== undefined ? { openCard } : {}),
      ...(view ? { view } : {}),
    };
    const row = { ...body, checksum: digest(body) };
    let short = false;
    try {
      sessionStorage.setItem(scope(collection, level.id), JSON.stringify(row));
      sessionStorage.setItem(
        active(collection),
        JSON.stringify({ id: level.id, hash: level.hash }),
      );
      short = true;
    } catch {}
    if (level.mode === "extended") {
      try {
        await transaction((store) => {
          if (this.removing) return;
          const existing = store.get(row.key);
          existing.onsuccess = () => {
            if (
              !this.removing &&
              (!existing.result || existing.result.revision < row.revision)
            )
              store.put(row);
          };
        });
        if (short && !this.removing)
          this.confirmedRevision = Math.max(
            this.confirmedRevision,
            row.revision,
          );
        return short
          ? "Automatisch gespeichert"
          : "Lokal gespeichert. Nach Neuladen bitte Gruppe wählen.";
      } catch {
        if (short)
          return "Nur während der Sitzung gespeichert. Zur Sicherheit über Export eine PNG ablegen.";
      }
    }
    if (short && level.mode === "session")
      this.confirmedRevision = row.revision;
    return short
      ? "Automatisch gespeichert"
      : "Automatische Speicherung nicht verfügbar. Bitte über Export eine PNG ablegen.";
  }
  async remove() {
    this.removing = true;
    try {
      if (this.level.mode === "extended")
        await transaction((store) =>
          store.delete(
            keyFor(
              this.collection,
              this.level.id,
              this.level.hash,
              this.session,
            ),
          ),
        );
      const key = scope(this.collection, this.level.id);
      const row = JSON.parse(sessionStorage.getItem(key) || "null");
      if (row?.session === this.session) {
        sessionStorage.removeItem(key);
        const selected = JSON.parse(
          sessionStorage.getItem(active(this.collection)) || "null",
        );
        if (selected?.id === this.level.id)
          sessionStorage.removeItem(active(this.collection));
      }
    } catch (error) {
      this.removing = false;
      throw error;
    }
  }
}
