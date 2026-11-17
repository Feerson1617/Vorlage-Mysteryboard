import { useEffect, useRef, useState } from "react";
import { AuthorEditor } from "../../src/components/AuthorEditor";
import { Dialog } from "../../src/components/Dialog";
import { newDraft, draftFromContent } from "../../src/core/authoring";
import {
  readDocument,
  encodeDocument,
  validateDocument,
  contentHash,
  type Draft,
  type Task,
  type MysteryDocument,
} from "../../src/core/documents";
import { launchJSON } from "../../src/core/launch-document";
import { scormEntries, zipScorm } from "../../src/core/scorm-package";
import template from "virtual:studio-player";
import launch from "../../scorm/launch.html?raw";
import session from "../../scorm/session.js?raw";
import { PdfExport } from "./PdfExport";
import type { EditorIntegration } from "./types";
const filename = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .slice(0, 80) || "Mystery";
export function StudioApp() {
  const bridge = window.mysteryStudio;
  const [draft, setDraft] = useState<Draft | null>(null),
    [generation, setGeneration] = useState(0),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [create, setCreate] = useState<"new" | "import" | null>(null),
    [initials, setInitials] = useState(""),
    [initialImport, setInitialImport] = useState(false),
    [initialMaterial, setInitialMaterial] = useState<File | undefined>(),
    [recent, setRecent] = useState<{ id: string; name: string }[]>([]),
    [pdf, setPdf] = useState<Task | null>(null);
  const read = async (
    promise: ReturnType<NonNullable<typeof bridge>["openProject"]>,
  ) => {
    try {
      setError("");
      const opened = await promise;
      if (!opened) return;
      const doc = readDocument(new Uint8Array(opened.bytes));
      if (doc.kind === "student")
        throw Error(
          "Schülerarbeitsstände werden im Schülerplayer fortgesetzt.",
        );
      setDraft(
        doc.kind === "draft" ? doc : draftFromContent(doc.content, "LK"),
      );
      setName(opened.name);
      setGeneration((g) => g + 1);
      setInitialImport(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void bridge
      ?.recentProjects()
      .then(setRecent)
      .catch((e) => setError(e.message));
  }, [draft, bridge]);
  const integration: EditorIntegration = {
    state: (d, dirty, forms) => {
      void bridge
        ?.projectState({ bytes: encodeDocument(d), dirty, forms })
        .catch((e) => setError(e.message));
    },
    save: async (d, saveAs) => {
      try {
        const result = await bridge!.saveProject(
          encodeDocument(validateDocument(d)),
          saveAs,
        );
        if (result) setName(result.name);
        return !!result;
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    open: () => void read(bridge!.openProject()),
    detach: () => {
      setName("");
      void bridge!.detachProject();
    },
    print: setPdf,
    preview: (task) => {
      void bridge!
        .previewTask(encodeDocument(task))
        .catch((e) => setError(e.message));
    },
    onSaved: (fn) => bridge!.onSaved(fn),
    scorm: async (task, signal) => {
      signal.throwIfAborted();
      const placeholder =
        /<script\s+id="mysteryboard-launch"\s+type="application\/json">\s*null\s*<\/script>/g;
      if ([...template.matchAll(placeholder)].length !== 1)
        throw Error("Der geprüfte Schülerplayer fehlt.");
      const html = template.replace(
        placeholder,
        () =>
          `<script id="mysteryboard-launch" type="application/json">${launchJSON(task, true)}</script>`,
      );
      const zip = zipScorm(
        scormEntries(
          new TextEncoder().encode(html),
          launch,
          session,
          `MysteryBoard-${task.content.id}-${task.content.version}`,
          task.content.title,
        ),
      );
      signal.throwIfAborted();
      return new File(
        [zip as BlobPart],
        `MysteryBoard-${filename(task.content.title)}-SCORM-1.2.zip`,
        { type: "application/zip" },
      );
    },
  };
  const saveExport = async (file: File) => {
    try {
      const kind = file.name.endsWith(".zip")
        ? "scorm"
        : file.name.endsWith(".png")
          ? "png"
          : "document";
      await bridge!.saveExport(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        kind,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const onFile = (doc: MysteryDocument) => {
    if (doc.kind === "draft") void integration.save(doc, false);
    else
      void saveExport(
        new File(
          [encodeDocument(doc) as BlobPart],
          `MysteryBoard-${filename(doc.content.title)}.mysteryboard`,
        ),
      );
  };
  if (!bridge)
    return (
      <main className="welcome">
        <h1>MysteryBoard Studio</h1>
        <p>
          Bitte die installierte Desktop-App öffnen. Diese Autorenfassung
          benötigt ihre lokale Dateiverwaltung.
        </p>
      </main>
    );
  return (
    <>
      {draft ? (
        <>
          <div className="studio-project-name" role="status">
            {name || "Noch nicht als Projektdatei gespeichert"}
          </div>
          <AuthorEditor
            key={generation}
            initial={draft}
            initialImport={initialImport}
            initialMaterial={initialMaterial}
            onMaterialStarted={() => setInitialMaterial(undefined)}
            integration={integration}
            onFile={onFile}
            onDownload={(file) => void saveExport(file)}
            onHome={() => {
              void bridge.detachProject();
              setDraft(null);
              setName("");
            }}
          />
        </>
      ) : (
        <main
          className="welcome studio-welcome"
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            if (e.dataTransfer.files.length !== 1) {
              setError("Bitte eine Datei auswählen oder ablegen.");
              return;
            }
            const d = newDraft("LK");
            d.content.numbering = "by-group";
            d.contentHash = contentHash(d.content);
            setDraft(d);
            setGeneration((g) => g + 1);
            setInitialImport(false);
            setInitialMaterial(e.dataTransfer.files[0]);
            setName("");
            void bridge.detachProject();
          }}
        >
          <h1>MysteryBoard Studio</h1>
          <p>Mysterys erstellen und für den Unterricht bereitstellen.</p>
          <div className="studio-start-actions">
            <button className="primary" onClick={() => setCreate("new")}>
              Neues Mystery erstellen
            </button>
            <button onClick={() => void read(bridge.openProject())}>
              Mystery öffnen
            </button>
            <button onClick={() => setCreate("import")}>
              Unterrichtsmaterial importieren
            </button>
          </div>
          <section aria-label="Zuletzt bearbeitete Projekte">
            <h2>Zuletzt bearbeitete Projekte</h2>
            {recent.length ? (
              recent.map((r) => (
                <button
                  className="studio-recent"
                  key={r.id}
                  onClick={() => void read(bridge.openRecent(r.id))}
                >
                  {r.name}
                </button>
              ))
            ) : (
              <p className="small">Noch keine Projekte geöffnet.</p>
            )}
          </section>
        </main>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}
          <button onClick={() => setError("")}>Schließen</button>
        </div>
      )}
      {create && (
        <Dialog title="Neues Mystery erstellen" onClose={() => setCreate(null)}>
          <label>
            Lehrkraftkürzel
            <input
              value={initials}
              onChange={(e) => setInitials(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </label>
          <button
            className="primary full"
            disabled={!initials.trim()}
            onClick={() => {
              try {
                setDraft(
                  (() => {
                    const d = newDraft(initials);
                    return {
                      ...d,
                      content: { ...d.content, numbering: "by-group" as const },
                      contentHash: contentHash({
                        ...d.content,
                        numbering: "by-group",
                      }),
                    };
                  })(),
                );
                setGeneration((g) => g + 1);
                setInitialImport(create === "import");
                setName("");
                void bridge.detachProject();
                setCreate(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Mystery erstellen
          </button>
        </Dialog>
      )}
      {pdf && <PdfExport task={pdf} onClose={() => setPdf(null)} />}
    </>
  );
}
