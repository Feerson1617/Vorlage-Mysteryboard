import React, { useEffect, useState, useRef, useMemo } from "react";
import { Camera } from "../../src/components/Camera";
import { readDocumentQr } from "../../src/core/document-qr";
import { fromQr } from "../../src/core/codec";
import { Dialog } from "../../src/components/Dialog";
import { readDocumentFile } from "../../src/core/document-file";
import { restorePng } from "../../src/core/png";
import { validateWork, type Work } from "../../src/core/model";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import { readLaunch } from "../../src/core/launch-document";
import { packDocument, studentDocument } from "../../src/core/documents";
import "virtual:player-style.css";
import { canonical, readDocument, type Task } from "../../src/core/documents";
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
  const [conflict,setConflict]=useState<{task:Task;level:LevelInfo;work:Work;previous:string[];}>();
  const [applying,setApplying]=useState(false);
  async function loadTask(level:LevelInfo, signal:AbortSignal) {
      let task = source.task;
      if (!task) {
        const response = await fetch("./level-" + level.id + ".json", {
          signal,
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
    return task;
  }
  async function applyImport(task:Task,level:LevelInfo,work:Work,signal:AbortSignal) {
    signal.throwIfAborted();
    let writer = active?.level.id===level.id ? active.writer : undefined;
    if (!active || active.level.id!==level.id){
      const next=new AbortController();
      try {
        if(level.mode!=="off"){
          const sid=crypto.randomUUID();
          await claim(sid,next.signal);
          writer=new Writer(c.id,level,sid);
        }
        signal.throwIfAborted();
      } catch(error){next.abort();throw error;}
      request.current?.abort();
      request.current=next;
    }
    if(level.mode==="off")clearSelection(c,false);
    setNotice("");setConflict(undefined);
    setActive({generation:++generation.current,task,level,work,writer});
  }
  async function prepareImport(work:Work,hash:string,current:Work|null,signal:AbortSignal){
    const level=c.levels.find(l=>l.hash===hash);
    if(!level)throw Error("Diese Sicherung gehört zu einer anderen Aufgabe oder Inhaltsversion.");
    const task=active?.level.id===level.id?active.task:await loadTask(level,signal);
    signal.throwIfAborted();
    work=validateWork(work,task.content);
    const data=canonical(work);
    if(current && active?.level.id===level.id && canonical(current)===data)return;
    const previous=[];
    const describe=(w:Work,l:LevelInfo)=> (w.team||"Gruppe ohne Namen")+(c.levels.length>1 ? " · "+l.name : "");
    if(current && active)previous.push(describe(current,active.level));
    const target=sessionSeed(c.id,level);
    if(target && (canonical(target.work)!==data || target.pending) && (!current || active?.level.id!==level.id))
      previous.push(describe(target.work,level));
    if(previous.length) setConflict({task,level,work,previous});
    else await applyImport(task,level,work,signal);
  }
  const confirmImport=conflict && <Dialog title="Arbeitsstand ersetzen?" onClose={()=>{if(!applying)setConflict(undefined);}}>
    <p>Bisherige Arbeit: {conflict.previous.join(" / ")}<br/>Ausgewählte PNG: {conflict.work.team||"Gruppe ohne Namen"}{c.levels.length>1 && " · "+conflict.level.name}</p>
    <p>Beim Öffnen kann die bisherige Arbeit verloren gehen.</p>
    <div className="actions"><button className="primary" disabled={applying} onClick={()=>setConflict(undefined)}>Bisherige Arbeit behalten</button>
    <button disabled={applying} onClick={async()=>{setApplying(true);try{await applyImport(conflict.task,conflict.level,conflict.work,new AbortController().signal);}catch(e){setNotice((e as Error).message);setConflict(undefined);}finally{setApplying(false);}}}>Ausgewählte PNG öffnen</button></div>
  </Dialog>;
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
      const task = await loadTask(level, ctl.signal);
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
      <><LevelPlayer
        key={active.generation}
        task={active.task}
        seed={active.seed}
        writer={active.writer}
        initial={active.work}
        onRestore={prepareImport}
        levelName={c.levels.length > 1 ? active.level.name : undefined}
        notice={notice}
        onSwitch={c.levels.length > 1 ? () => void back(false) : undefined}
        onHome={() => void back(true)}
        onDeleted={() => void back(false)}
      />{confirmImport}</>
    );
  return (
    <main className="welcome level-start">
      {confirmImport}<h1>{c.title}</h1>
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
                request.current?.abort();
                const ctl=new AbortController();request.current=ctl;setStarting(true);setNotice("");
                try {
                  const doc=await readDocumentFile(file,ctl.signal);
                  if (doc.kind !== "student")
                    throw Error("Bitte eine Schüler-PNG auswählen.");
                  await prepareImport(doc.work,doc.contentHash,null,ctl.signal);
                } catch (err) {
                  if(!ctl.signal.aborted)setNotice((err as Error).message);
                } finally {setStarting(false);}
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
  onRestore: (w: Work, hash:string,current:Work|null,signal:AbortSignal) => Promise<void>;
  task: Task;
  seed?: Snapshot;
  writer?: Writer;
  initial?: Work;
  onSwitch?: () => void;
  onHome: () => void;
  onDeleted: () => void;
}) {
  const current=useRef<Work|null>(null);
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
      if(file.size>30_000_000)throw Error("Die Sicherungsdatei überschreitet 30 MB.");
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
      await onRestore(restored, hash,current.current,controller.signal);
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
        onImport={work => {current.current=work;setResume(true)}}
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
                void onRestore(restored,task.contentHash,current.current,new AbortController().signal).catch(e=>{setResume(true);setError(e.message);});
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
