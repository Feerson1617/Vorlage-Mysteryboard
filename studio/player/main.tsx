import React, { useEffect, useState, useRef, useMemo } from "react";
import { Camera } from "../../src/components/Camera";
import { readDocumentQr } from "../../src/core/document-qr";
import { fromQr } from "../../src/core/codec";
import { Dialog } from "../../src/components/Dialog";
import { readDocumentFile } from "../../src/core/document-file";
import { restorePng } from "../../src/core/png";
import type { Work } from "../../src/core/model";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import { readLaunch } from "../../src/core/launch-document";
import { packDocument, studentDocument } from "../../src/core/documents";
import "virtual:player-style.css";
import { readDocument, type Task } from "../../src/core/documents";
import {
  Writer,
  claim,
  candidates,
  lastLevel,
  clearSelection,
  sessionSeed,
  validated,
  type Catalogue,
  type LevelInfo,
  type Snapshot,
} from "./recovery";
function bootstrap() {
  const index = document.getElementById("mysteryboard-levels");
  if (index) {
    const c = JSON.parse(index.textContent!) as Catalogue;
    if (
      !Array.isArray(c.levels) ||
      !c.levels.length ||
      c.levels.length > 12 ||
      c.levels.some(
        (l) => !/^[a-f0-9-]{36}$/.test(l.id) || !/^[a-f0-9]{64}$/.test(l.hash),
      )
    )
      throw Error("Ungültiges Niveauverzeichnis.");
    return { catalogue: c };
  }
  const launch = readLaunch();
  if (!launch) throw Error("Die eingebettete Aufgabe fehlt.");
  const task = launch.task;
  return {
    task,
    catalogue: {
      id: task.content.id,
      title: task.content.title,
      levels: [
        {
          id: task.content.id,
          name: task.content.title,
          description: "",
          hash: task.contentHash,
          version: task.content.version,
          mode: task.content.recovery ?? "off",
        },
      ],
    } satisfies Catalogue,
  };
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="welcome">
        <h1>Aufgabe konnte nicht geöffnet werden</h1>
        <p>{this.state.error}</p>
        <p>Bitte die unveränderte Aufgabe erneut öffnen.</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Player() {
  const source = useMemo(bootstrap, []);
  const c = source.catalogue;
  const [active, setActive] = useState<{
    generation: number;
    task: Task;
    level: LevelInfo;
    seed?: Snapshot;
    writer?: Writer;
    work?: Work;
  }>();
  const [choices, setChoices] = useState<Snapshot[]>([]);
  const [resumeLevels, setResumeLevels] = useState(false);
  const [starting, setStarting] = useState(true);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  async function choose(
    level: LevelInfo,
    seed?: Snapshot,
    manual?: Work,
    chosen = false,
  ) {
    request.current?.abort();
    const ctl = new AbortController();
    request.current = ctl;
    setStarting(true);
    setNotice("");
    setActive(undefined);
    try {
      let task = source.task;
      if (!task) {
        const response = await fetch("./level-" + level.id + ".json", {
          signal: ctl.signal,
          credentials: "same-origin",
          redirect: "error",
        });
        if (!response.ok) throw Error("Die Aufgabendatei fehlt.");
        const doc = readDocument(new Uint8Array(await response.arrayBuffer()));
        if (doc.kind !== "task" || doc.content.id !== c.id + "." + level.id)
          throw Error("Falsche Aufgabendatei.");
        task = doc;
      }
      if (
        task.contentHash !== level.hash ||
        task.content.version !== level.version ||
        (task.content.recovery ?? "off") !== level.mode
      )
        throw Error("Die Niveauprüfung ist fehlgeschlagen.");
      if (seed) {
        try {
          seed = validated(seed, task);
        } catch {
          seed = undefined;
          setNotice(
            "Der lokale Stand konnte nicht gelesen werden. Öffnet eure Original-PNG oder beginnt neu.",
          );
        }
      }
      let writer;
      if (level.mode !== "off") {
        let sid = seed?.session ?? crypto.randomUUID();
        const lock = await claim(sid, ctl.signal);
        if (lock !== "acquired") {
          // A tab cloned from another active tab starts its own work.
          if (!chosen && (lock === "occupied" || window.opener))
            seed = undefined;
          sid = crypto.randomUUID();
          await claim(sid, ctl.signal);
        }
        writer = new Writer(c.id, level, sid, seed?.revision);
      }
      ctl.signal.throwIfAborted();
      setActive({
        generation: ++generation.current,
        task,
        level,
        seed,
        writer,
        work: manual ?? seed?.work,
      });
    } catch (e) {
      if (!ctl.signal.aborted) setNotice((e as Error).message);
    } finally {
      if (!ctl.signal.aborted) setStarting(false);
    }
  }
  useEffect(() => {
    let live = true;
    const release = () => request.current?.abort();
    window.addEventListener("pagehide", release);
    const resume = async () => {
      const l = lastLevel(c);
      if (l) {
        void candidates(c).catch(() => {});
        await choose(l, sessionSeed(c.id, l));
        return;
      }
      let rows: Snapshot[] = [];
      try {
        rows = await candidates(c);
      } catch {
        /* The board remains usable with restricted storage. */
      }
      if (!live) return;
      setChoices(rows);
      if (c.levels.length === 1 && !rows.length) await choose(c.levels[0]);
      else setStarting(false);
    };
    const restoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) void resume();
    };
    void resume();
    window.addEventListener("pageshow", restoredPage);
    return () => {
      window.removeEventListener("pageshow", restoredPage);
      window.removeEventListener("pagehide", release);
      live = false;
      request.current?.abort();
    };
  }, [c]);
  const back = async (fresh: boolean) => {
    request.current?.abort();
    clearSelection(c, fresh);
    setResumeLevels(!fresh);
    setActive(undefined);
    setChoices([]);
    setStarting(true);
    setNotice("");
    const ctl = new AbortController();
    request.current = ctl;
    const rows = await candidates(c).catch(() => []);
    if (ctl.signal.aborted) return;
    setChoices(rows);
    if (c.levels.length === 1 && !rows.length) await choose(c.levels[0]);
    else setStarting(false);
  };
  if (active)
    return (
      <LevelPlayer
        key={active.generation}
        task={active.task}
        seed={active.seed}
        writer={active.writer}
        initial={active.work}
        onRestore={(work, hash = active.task.contentHash) => {
          const level = c.levels.find((l) => l.hash === hash);
          if (!level)
            throw Error(
              "Diese Sicherung gehört zu einer anderen Aufgabe oder Inhaltsversion.",
            );
          void choose(level, undefined, work);
        }}
        levelName={c.levels.length > 1 ? active.level.name : undefined}
        notice={notice}
        onSwitch={c.levels.length > 1 ? () => void back(false) : undefined}
        onHome={() => void back(true)}
        onDeleted={() => void back(false)}
      />
    );
  return (
    <main className="welcome level-start">
      <h1>{c.title}</h1>
      {notice && <p role="alert">{notice}</p>}
      {starting ? (
        <p role="status">Aufgabe wird geöffnet …</p>
      ) : (
        <>
          {choices.length > 0 && (
            <section>
              <h2>Lokalen Arbeitsstand fortsetzen</h2>
              {choices.map((r) => (
                <button
                  key={r.key}
                  onClick={() =>
                    void choose(
                      c.levels.find((l) => l.id === r.level)!,
                      r,
                      undefined,
                      true,
                    )
                  }
                >
                  {r.work.team || "Gruppe ohne Namen"} ·{" "}
                  {c.levels.find((l) => l.id === r.level)?.name} ·{" "}
                  {new Date(r.time).toLocaleString("de-DE")}
                </button>
              ))}
            </section>
          )}
          <p>
            {c.levels.length > 1
              ? "Wählt das euch zugewiesene Niveau."
              : "Neue Gruppenarbeit beginnen."}
          </p>
          <div className="level-choices">
            {c.levels.map((l) => (
              <button
                key={l.id}
                onClick={() =>
                  void choose(
                    l,
                    resumeLevels ? sessionSeed(c.id, l) : undefined,
                  )
                }
              >
                {l.name}
                {l.description && <small>{l.description}</small>}
              </button>
            ))}
          </div>
          <label className="button file-choice">
            Original-PNG öffnen
            <input
              className="sr-only"
              type="file"
              accept=".png"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const doc = await readDocumentFile(
                    file,
                    new AbortController().signal,
                  );
                  if (doc.kind !== "student")
                    throw Error("Bitte eine Schüler-PNG auswählen.");
                  const level = c.levels.find(
                    (l) => l.hash === doc.contentHash,
                  );
                  if (!level)
                    throw Error(
                      "Diese PNG gehört zu einer anderen Aufgabe oder Version.",
                    );
                  await choose(level, undefined, doc.work);
                } catch (err) {
                  setNotice((err as Error).message);
                }
              }}
            />
          </label>
        </>
      )}
    </main>
  );
}
function LevelPlayer({
  levelName,
  notice,
  task,
  seed,
  writer,
  initial,
  onSwitch,
  onHome,
  onDeleted,
  onRestore,
}: {
  levelName?: string;
  notice: string;
  onRestore: (w: Work, hash?: string) => void;
  task: Task;
  seed?: Snapshot;
  writer?: Writer;
  initial?: Work;
  onSwitch?: () => void;
  onHome: () => void;
  onDeleted: () => void;
}) {
  const [camera, setCamera] = useState(false);
  const [resume, setResume] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const close = () => {
    operation.current?.abort();
    setResume(false);
    setCamera(false);
    setBusy(false);
    setError("");
  };
  const read = async (file: File) => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    try {
      let restored: Work;
      let hash = task.contentHash;
      try {
        const doc = await readDocumentFile(file, controller.signal);
        if (doc.kind !== "student")
          throw Error(
            "Diese Sicherung gehört nicht zu dieser Aufgabe oder Inhaltsversion.",
          );
        restored = doc.work;
        hash = doc.contentHash;
      } catch (e) {
        controller.signal.throwIfAborted();
        try {
          restored = restorePng(
            new Uint8Array(await file.arrayBuffer()),
            task.content,
          );
        } catch {
          throw e;
        }
      }
      controller.signal.throwIfAborted();
      onRestore(restored, hash);
      close();
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      {notice && <p role="alert">{notice}</p>}
      <App
        levelName={levelName}
        writer={writer}
        restored={seed}
        onSwitch={onSwitch}
        onHome={onHome}
        onForget={
          writer
            ? async () => {
                await writer.remove();
                onDeleted();
              }
            : undefined
        }
        studentExport
        mystery={task.content}
        loadedWork={initial}
        onImport={() => setResume(true)}
        backupPayload={(work) =>
          packDocument(studentDocument(task.content, work))
        }
      />
      {camera && (
        <Dialog title="Code scannen" onClose={() => setCamera(false)}>
          <Camera
            onChoose={() => setCamera(false)}
            onScan={(text) => {
              try {
                let restored: Work;
                if (text.startsWith("MB3:")) {
                  const doc = readDocumentQr(text);
                  if (
                    doc.kind !== "student" ||
                    doc.contentHash !== task.contentHash
                  )
                    throw Error("Der Code gehört nicht zu dieser Aufgabe.");
                  restored = doc.work;
                } else restored = fromQr(text, task.content);
                close();
                onRestore(restored);
                return true;
              } catch (e) {
                setError((e as Error).message);
                return false;
              }
            }}
          />
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {resume && !camera && (
        <Dialog title="Arbeit fortsetzen" onClose={close}>
          <p>
            Wählt eure unveränderte Original-PNG. Sie muss zu dieser Aufgabe und
            Inhaltsversion gehören.
          </p>
          <label className="button file-choice">
            Original-PNG auswählen
            <input
              className="sr-only"
              type="file"
              accept=".png,.mysteryboard,image/png"
              aria-label="Schüler-Sicherung"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
              }}
            />
          </label>
          <button onClick={() => setCamera(true)}>
            Code mit Kamera scannen
          </button>
          {busy && <p role="status">Sicherung wird geprüft …</p>}
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <Player />
  </Boundary>,
);
