import { scormName } from "../../src/core/scorm-name";
import { identifyFile } from "../import-file";
import {
  isExchange,
  parseExchangeText,
  parsePastedExchange,
  importExchange,
  decodeExchangeMedia,
  type ImportedProject,
} from "../exchange/import";
import { CopyIssues } from "./CopyIssues";
import { ExchangeReview } from "./ExchangeReview";
import { LevelsDialog } from "./LevelsDialog";
import {
  collectionScorm,
  singleEntries,
  exportIssues,
} from "./collection-scorm";
import {
  bindLevel,
  levelFrom,
  collectionFrom,
  readProject,
  withLevel,
  projectBytes,
  newStudioDraft,
  type Collection,
} from "../../src/core/levels";
import { publishDraft } from "../../src/core/authoring";
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
import { zipScorm } from "../../src/core/scorm-package";
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
  const [collection, setCollection] = useState<Collection | null>(null);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [modified, setModified] = useState(false);
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
  const [exchange, setExchange] = useState<ImportedProject | null>(null);
  const [tools, setTools] = useState<"template" | "paste" | null>(null),
    [pasted, setPasted] = useState(""),
    [exchangeError, setExchangeError] = useState(""),
    [working, setWorking] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const attempt = useRef(0);
  const leaveExchange = () => {
    attempt.current++;
    setExchange(null);
    setTools(null);
    setPasted("");
    setExchangeError("");
    setWorking(false);
  };
  const openTools = (mode: "template" | "paste") => {
    leaveExchange();
    setTools(mode);
  };
  const stage = async (input: unknown, token: number) => {
    const project = importExchange(input);
    await decodeExchangeMedia(project);
    if (token === attempt.current) {
      setTools(null);
      setPasted("");
      setExchangeError("");
      setIssues(exportIssues(project, template, launch, session));
      setExchange(project);
    }
  };
  const [incoming, setIncoming] = useState<{
    project: Draft;
    current: Draft;
  } | null>(null);
  const aiModal = !!incoming || !!exchange || !!tools || working;
  const read = async (
    promise: ReturnType<NonNullable<typeof bridge>["openProject"]>,
  ) => {
    try {
      setError("");
      const opened = await promise;
      if (!opened) return;
      const bytes = new Uint8Array(opened.bytes);
      const identified = identifyFile(bytes);
      if (identified.type === "exchange") {
        const token = ++attempt.current;
        setWorking(true);
        try {
          await stage(identified.value, token);
        } finally {
          if (token === attempt.current) setWorking(false);
        }
        return;
      }
      if (identified.type === "material") {
        if (!draft) {
          setDraft(newStudioDraft("LK"));
          setName("");
          setGeneration((g) => g + 1);
        }
        setInitialMaterial(
          new File([bytes], opened.name + "." + identified.extension),
        );
        return;
      }
      const loaded = identified.project;
      const c = loaded.format === "MysteryBoardCollection" ? loaded : null;
      const doc =
        loaded.format === "MysteryBoardCollection"
          ? loaded.levels.find((l) => l.id === loaded.active)!.draft
          : loaded;
      setCollection(c);
      setModified(doc.kind === "task" || !/\.mysteryboard$/i.test(opened.name));
      setDraft(
        doc.kind === "draft" ? doc : draftFromContent(doc.content, "LK"),
      );
      setCreate(null);
      setPdf(null);
      setName(opened.name);
      setGeneration((g) => g + 1);
      setInitialImport(false);
    } catch (e) {
      setError(
        `Das Mystery konnte nicht geöffnet werden. ${(e as Error).message}`,
      );
    }
  };
  useEffect(() => {
    void bridge
      ?.recentProjects()
      .then(setRecent)
      .catch((e) => setError(e.message));
  }, [draft, bridge]);
  useEffect(
    () =>
      bridge?.onCommand?.((command) => {
        if (command === "open" && !pdf && !create && !error && !aiModal)
          void read(bridge.openProject());
      }),
    [bridge, pdf, create, error, aiModal],
  );
  useEffect(() => {
    void bridge
      ?.modalState?.(!!editing || !!pdf || !!create || !!error || aiModal)
      .catch((e) => setError(e.message));
  }, [bridge, editing, pdf, create, error, aiModal]);
  function adoptCopy(project: ImportedProject) {
    const group = project.format === "MysteryBoardCollection" ? project : null;
    setCollection(group);
    setDraft(
      project.format === "MysteryBoardCollection"
        ? project.levels.find((l) => l.id === project.active)!.draft
        : project,
    );
    setModified(true);
    setInitialImport(false);
    setInitialMaterial(undefined);
    setName("");
    setGeneration((g) => g + 1);
  }
  const integration: EditorIntegration = {
    importFile: async (file, current) => {
      if (file.size > 60_000_000)
        throw Error("Die Datei ist größer als 60 MB.");
      const info = identifyFile(new Uint8Array(await file.arrayBuffer()));
      if (info.type === "material")
        return file.name.toLowerCase().endsWith("." + info.extension)
          ? file
          : new File([file], file.name + "." + info.extension);
      if (info.type === "exchange") {
        await stage(info.value, ++attempt.current);
        return null;
      }
      const doc = info.project;
      const copy =
        doc.format === "MysteryBoardCollection"
          ? doc
          : doc.kind === "draft"
            ? doc
            : draftFromContent(doc.content, current.author.initials);
      await decodeExchangeMedia(copy);
      if (copy.format === "MysteryBoard" && current.content.cards.length)
        setIncoming({ project: copy, current });
      else if (await bridge!.replaceWithExchange()) adoptCopy(copy);
      return null;
    },
    name,
    unsaved: modified,
    bindLevel: collection ? (d) => bindLevel(collection, d) : undefined,
    activeLevel: collection?.active,
    levelList: collection?.levels.map(({ id, name }) => ({ id, name })),
    switchLevel: collection
      ? (d, id) => {
          const next = { ...withLevel(collection, d), active: id };
          const target = next.levels.find((l) => l.id === id);
          if (!target || id === collection.active) return;
          setCollection(next);
          setModified(true);
          setDraft(target.draft);
          setGeneration((g) => g + 1);
          setInitialImport(false);
        }
      : undefined,
    levelName: collection?.levels.find((l) => l.id === collection.active)?.name,
    levels: (d) =>
      setEditing(collection ? withLevel(collection, d) : collectionFrom(d)),
    exportLevels:
      collection && collection.levels.length > 1
        ? async (d) => {
            const c = withLevel(collection, d);
            const hints = c.levels.flatMap((l) =>
              publishDraft(l.draft).content.initial.edges.map(
                (e) => l.name + " · " + e.from + " / " + e.to + " " + e.label,
              ),
            );
            if (
              hints.length &&
              !confirm(
                "Diese freigegebenen Starthilfen an Lernende weitergeben?\n" +
                  hints.join("\n"),
              )
            )
              return;
            await saveExport(collectionScorm(c, template, launch, session));
          }
        : undefined,
    matchesSaved: (d, data) =>
      !!collection &&
      new TextDecoder().decode(projectBytes(collection, d)) ===
        new TextDecoder().decode(data),
    modal: !!editing || !!pdf || !!create || !!error || aiModal,
    state: (d, dirty, forms) => {
      void bridge
        ?.projectState({ bytes: projectBytes(collection, d), dirty, forms })
        .catch((e) => setError(e.message));
    },
    save: async (d, saveAs) => {
      try {
        const result = await bridge!.saveProject(
          projectBytes(collection, d),
          saveAs,
        );
        if (result) {
          setModified(false);
          setName(result.name);
        }
        return !!result;
      } catch (e) {
        throw e;
      }
    },
    leaveHome: bridge?.leaveHome,
    open: () => void read(bridge!.openProject()),
    detach: () => {
      if (collection) return;
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
    onCommand: (fn) => bridge!.onCommand?.(fn) ?? (() => {}),
    scorm: async (task, signal) => {
      signal.throwIfAborted();
      const zip = zipScorm(singleEntries(task, template, launch, session));
      signal.throwIfAborted();
      return new File(
        [zip as BlobPart],
        collection
          ? scormName(
              collection.title,
              collection.levels.find((l) => l.id === collection.active)!.name,
            )
          : scormName(task.content.title),
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
              setCollection(null);
              setModified(false);
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
            const d = newStudioDraft("LK");
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
          <div className="exchange-entry">
            <button onClick={() => openTools("template")}>
              KI-Blankovorlage exportieren
            </button>
            <button onClick={() => openTools("paste")}>KI-Text einfügen</button>
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
      {tools === "template" && (
        <Dialog title="KI-Blankovorlage exportieren" onClose={leaveExchange}>
          <p>
            Lade die Vorlage in den KI-Chat mit deinem Unterrichtsmaterial. Die
            ausgefüllte Datei kannst du über „Mystery öffnen“ prüfen.
          </p>
          <div className="menu-list">
            {(["mysteryboard", "txt"] as const).map((ext) => (
              <button
                key={ext}
                disabled={working}
                className={ext === "mysteryboard" ? "primary" : ""}
                onClick={async () => {
                  setWorking(true);
                  try {
                    if (await bridge.saveTemplate(ext)) leaveExchange();
                  } catch (e) {
                    setExchangeError((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                {ext === "txt"
                  ? "TXT-Alternative speichern"
                  : "Blankovorlage speichern"}
              </button>
            ))}
          </div>
          {exchangeError && <p role="alert">{exchangeError}</p>}
        </Dialog>
      )}
      {tools === "paste" && (
        <Dialog title="KI-Text einfügen" onClose={leaveExchange}>
          <label>
            JSON aus dem KI-Chat
            <textarea
              rows={8}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setExchangeError("");
              }}
            />
          </label>
          {exchangeError && (
            <>
              <p role="alert" className="exchange-errors">
                {exchangeError}
              </p>
              <CopyIssues message={exchangeError} />
            </>
          )}
          <button
            className="primary"
            disabled={!pasted.trim() || working}
            onClick={async () => {
              const token = ++attempt.current;
              setWorking(true);
              try {
                await stage(parsePastedExchange(pasted), token);
              } catch (e) {
                if (token === attempt.current)
                  setExchangeError((e as Error).message);
              } finally {
                if (token === attempt.current) setWorking(false);
              }
            }}
          >
            Material prüfen
          </button>
        </Dialog>
      )}
      {exchange && (
        <ExchangeReview
          project={exchange}
          issues={issues}
          replacing={!!draft}
          onClose={leaveExchange}
          onApply={async () => {
            if (!(await bridge.replaceWithExchange())) {
              leaveExchange();
              return;
            }
            const c =
              exchange.format === "MysteryBoardCollection" ? exchange : null;
            setCollection(c);
            setDraft(
              exchange.format === "MysteryBoardCollection"
                ? exchange.levels[0].draft
                : exchange,
            );
            setModified(true);
            setInitialImport(false);
            setInitialMaterial(undefined);
            setGeneration((g) => g + 1);
            setName("");
            leaveExchange();
          }}
        />
      )}
      {incoming && (
        <Dialog title="Mystery übernehmen" onClose={() => setIncoming(null)}>
          <button
            onClick={async () => {
              try {
                if (await bridge.replaceWithExchange())
                  adoptCopy(incoming.project);
                setIncoming(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Als Projekt öffnen
          </button>
          <button
            disabled={(collection?.levels.length ?? 1) >= 12}
            onClick={async () => {
              try {
                const c = collection
                  ? withLevel(collection, incoming.current)
                  : collectionFrom(incoming.current);
                const l = levelFrom(
                  incoming.project,
                  c.id,
                  (incoming.project.content.title || "Weiteres Niveau").slice(
                    0,
                    60,
                  ),
                );
                const next = { ...c, levels: [...c.levels, l], active: l.id };
                projectBytes(next, l.draft);
                if (!collection && name) {
                  await bridge.detachProject();
                  setName("");
                }
                setCollection(next);
                setModified(true);
                setDraft(l.draft);
                setGeneration((g) => g + 1);
                setIncoming(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Als weiteres Niveau hinzufügen
          </button>
          <button onClick={() => setIncoming(null)}>Abbrechen</button>
        </Dialog>
      )}
      {editing && (
        <LevelsDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onApply={(c) => {
            if (!collection && name) {
              void bridge.detachProject();
              setName("");
            }
            setCollection(c);
            setModified(true);
            setDraft(c.levels.find((l) => l.id === c.active)!.draft);
            setGeneration((g) => g + 1);
            setInitialImport(false);
            setEditing(null);
          }}
        />
      )}
      {error && (
        <Dialog title="Aktion nicht möglich" onClose={() => setError("")}>
          <p role="alert" className="exchange-errors">
            {error}
          </p>
          <CopyIssues message={error} />
        </Dialog>
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
                    const d = newStudioDraft(initials);
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
                setModified(true);
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
