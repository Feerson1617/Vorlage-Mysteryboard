import React, { useEffect, useState, useRef } from "react";
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
import "../../src/style.css";
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
  const launch = readLaunch();
  if (!launch) throw Error("Die eingebettete Aufgabe fehlt.");
  const task = launch.task;
  const [camera, setCamera] = useState(false);
  const [resume, setResume] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [work, setWork] = useState<Work | undefined>(),
    [generation, setGeneration] = useState(0);
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
      try {
        const doc = await readDocumentFile(file, controller.signal);
        if (doc.kind !== "student" || doc.contentHash !== task.contentHash)
          throw Error(
            "Diese Sicherung gehört nicht zu dieser Aufgabe oder Inhaltsversion.",
          );
        restored = doc.work;
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
      setWork(restored);
      setGeneration((n) => n + 1);
      close();
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <App
        key={generation}
        mystery={task.content}
        loadedWork={work}
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
                setWork(restored);
                setGeneration((n) => n + 1);
                close();
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
          <input
            type="file"
            accept=".png,.mysteryboard,image/png"
            aria-label="Schüler-Sicherung"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void read(file);
            }}
          />
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
