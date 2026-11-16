import { useEffect, useRef, useState } from "react";
import App from "./App";
import { Dialog } from "./components/Dialog";
import { FileDownload } from "./components/FileDownload";
import {
  encodeDocument,
  packDocument,
  studentDocument,
  type MysteryDocument,
  type Task,
  type Student,
} from "./core/documents";
import { readDocumentFile } from "./core/document-file";
import { AuthorEditor } from "./components/AuthorEditor";
import { draftFromContent, newDraft } from "./core/authoring";
import { portableBuiltin } from "./core/builtin-content";
import type { Mystery } from "./core/model";
import { Camera } from "./components/Camera";
import { readDocumentQr } from "./core/document-qr";

export function documentFile(doc: MysteryDocument) {
  const role = { draft: "Entwurf", task: "Aufgabe", student: "Arbeitsstand" }[
    doc.kind
  ];
  const title =
    doc.content.title
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "Mystery";
  return new File(
    [encodeDocument(doc) as BlobPart],
    `MysteryBoard-${role}-${title}-v${doc.content.version}.mysteryboard`,
    { type: "application/json" },
  );
}
export function UniversalApp({
  builtIn,
  initialDocument,
  classroom = false,
}: {
  classroom?: boolean;
  builtIn?: Mystery;
  initialDocument?: MysteryDocument | null;
}) {
  const [active, setActive] = useState<MysteryDocument | null>(
    initialDocument ?? null,
  );
  const [authorOpen, setAuthorOpen] = useState(false),
    [initials, setInitials] = useState(""),
    [createNew, setCreateNew] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [authorImport, setAuthorImport] = useState(false);
  const [importOpen, setImportOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const offerDocument = (doc: MysteryDocument) => {
    try {
      setFile(documentFile(doc));
      setFileError("");
    } catch (error) {
      setFileError(
        `Die Datei konnte nicht erzeugt werden. ${(error as Error).message} Der geöffnete Stand bleibt erhalten.`,
      );
    }
  };
  const [camera, setCamera] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    operation = useRef(0),
    readController = useRef<AbortController | null>(null);
  const cancel = () => {
    operation.current++;
    readController.current?.abort();
    setBusy(false);
    setImportOpen(false);
    setCamera(false);
    setError("");
  };
  useEffect(
    () => () => {
      operation.current++;
      readController.current?.abort();
    },
    [],
  );
  const importFile = async (selected: File) => {
    const id = ++operation.current;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setBusy(true);
    setError("");
    try {
      const doc = await readDocumentFile(selected, controller.signal);
      if (id !== operation.current) return;
      if (classroom && doc.kind === "draft")
        throw new Error(
          "Hier können Aufgaben und Schülerarbeitsstände fortgesetzt werden. Lehrkraftentwürfe bitte in der universellen Vorlage öffnen.",
        );
      setAuthorImport(false);
      setActive(doc);
      setGeneration((v) => v + 1);
      cancel();
    } catch (e) {
      if (id === operation.current) setError((e as Error).message);
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };
  const openImport = () => {
    setError("");
    setImportOpen(true);
  };
  const openAuthor = (create = false) => {
    setCreateNew(create);
    setInitials("");
    setError("");
    setAuthorOpen(true);
  };
  const home = () => {
    setActive(null);
    setGeneration((v) => v + 1);
  };
  return (
    <>
      {active?.kind === "draft" ? (
        <AuthorEditor
          key={generation}
          initial={active}
          initialImport={authorImport}
          onFile={offerDocument}
          onDownload={setFile}
          onHome={home}
        />
      ) : active ? (
        <App
          key={generation}
          mystery={active.content}
          loadedWork={active.kind === "student" ? active.work : undefined}
          backupPayload={(work) =>
            packDocument(studentDocument(active.content, work))
          }
          onImport={openImport}
          onHome={classroom ? undefined : () => setActive(null)}
          onProjectSave={(work) =>
            offerDocument(studentDocument(active.content, work))
          }
          onAuthor={classroom ? undefined : () => openAuthor()}
        />
      ) : builtIn ? (
        <App key={generation} mystery={builtIn} onAuthor={() => openAuthor()} />
      ) : (
        <main className="welcome universal-welcome">
          <h1>MysteryBoard</h1>
          <p>Öffnet eine Aufgabe oder setzt eure Arbeit fort.</p>
          <div className="actions student-entry-actions">
            <button className="primary" onClick={openImport}>
              Aufgabe öffnen
            </button>
            <button onClick={openImport}>Arbeit fortsetzen</button>
          </div>
          <button className="teacher-entry" onClick={() => openAuthor(true)}>
            Lehrkräfteeditor
          </button>
        </main>
      )}
      {importOpen && (
        <Dialog title="Datei öffnen" onClose={cancel}>
          <p>
            Aufgabe, Lehrkraft-Entwurf oder Schülerarbeitsstand: Wählt eine
            unveränderte .mysteryboard-Datei oder Original-PNG. Ein
            Bildschirmfoto genügt nicht.
          </p>
          {active && (
            <p>
              Eine gültige Datei ersetzt die geöffnete Arbeit. Sichert sie
              vorher, wenn ihr sie behalten möchtet.
            </p>
          )}
          <input
            ref={input}
            type="file"
            accept=".mysteryboard,.png,application/json,image/png"
            aria-label="Mystery-Datei"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
          <button
            className="primary full"
            disabled={busy}
            onClick={() => {
              input.current!.value = "";
              input.current!.click();
            }}
          >
            Mystery-Datei auswählen
          </button>
          {!camera ? (
            <button
              className="full"
              disabled={busy}
              onClick={() => setCamera(true)}
            >
              QR-Code scannen
            </button>
          ) : (
            <Camera
              onChoose={() => {
                input.current!.value = "";
                input.current!.click();
              }}
              onScan={(text) => {
                try {
                  const doc = readDocumentQr(text);
                  setCamera(false);
                  void importFile(documentFile(doc));
                  return true;
                } catch (e) {
                  setError((e as Error).message);
                  return false;
                }
              }}
            />
          )}
          {busy && (
            <p role="status">Datei und eingebettete Bilder werden geprüft …</p>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="full" onClick={cancel}>
            Abbrechen
          </button>
        </Dialog>
      )}
      {file && <FileDownload file={file} onClose={() => setFile(null)} />}
      {fileError && (
        <Dialog
          title="Datei konnte nicht erzeugt werden"
          onClose={() => setFileError("")}
        >
          <p role="alert">{fileError}</p>
        </Dialog>
      )}
      {authorOpen && (
        <Dialog
          title="Lehrkräftemodus"
          onClose={() => {
            operation.current++;
            setBusy(false);
            setAuthorOpen(false);
          }}
        >
          <p>
            Dieser Modus bearbeitet eure lokale Kopie. Er ist kein geschütztes
            Konto und ändert keine Datei im LMS.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const id = ++operation.current;
              setBusy(true);
              setError("");
              try {
                const draft = createNew
                  ? newDraft(initials)
                  : draftFromContent(
                      active?.content ?? (await portableBuiltin(builtIn!)),
                      initials,
                    );
                if (id !== operation.current) return;
                setAuthorImport(false);
                setActive(draft);
                setGeneration((v) => v + 1);
                setAuthorOpen(false);
              } catch (err) {
                if (id === operation.current) setError((err as Error).message);
              } finally {
                if (id === operation.current) setBusy(false);
              }
            }}
          >
            <label>
              Lehrkraftkürzel
              <input
                maxLength={40}
                required
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
              />
            </label>
            <button className="primary full" type="submit" disabled={busy}>
              Lehrkräftemodus öffnen
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
          {createNew && (
            <button
              className="full"
              onClick={() => {
                try {
                  const draft = newDraft(initials);
                  setAuthorImport(true);
                  setActive(draft);
                  setGeneration((v) => v + 1);
                  setAuthorOpen(false);
                  setError("");
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              Vorhandenes Mystery öffnen
            </button>
          )}
        </Dialog>
      )}
    </>
  );
}
