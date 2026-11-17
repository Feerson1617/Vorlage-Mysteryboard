import { useEffect, useMemo, useRef, useState } from "react";
import type { Content, Draft, MysteryDocument } from "../core/documents";
import { canonical, packDocument, validateDocument } from "../core/documents";
import {
  draftFromContent,
  publishDraft,
  retainCards,
  reviseDraft,
} from "../core/authoring";
import { parsePng } from "../core/png";
import { imageFromFile } from "../core/media";
import { initialBoardWork } from "../core/layout";
import { cardNumber, withTeam, type Work } from "../core/model";
import { exportBoard } from "../core/export";
import { Board } from "./Board";
import { Dialog } from "./Dialog";
import { PrintPreview } from "./PrintPreview";
import { MediaView } from "./MediaView";
import { TableEditor } from "./TableEditor";
import { HelpEditor } from "./HelpEditor";
import { DocumentImport } from "./DocumentImport";
import { readDocumentFile } from "../core/document-file";
import { classroomScorm } from "../core/classroom-scorm";

import { DesignEditor } from "../../studio/ui/DesignEditor";
import type { EditorIntegration } from "../../studio/ui/types";

type Card = Content["cards"][number];
export function AuthorEditor({
  initial,
  initialImport = false,
  initialMaterial,
  onMaterialStarted,
  onFile,
  onDownload,
  onHome,
  integration,
}: {
  integration?: EditorIntegration;
  initial: Draft;
  initialImport?: boolean;
  initialMaterial?: File;
  onMaterialStarted?: () => void;
  onFile: (doc: MysteryDocument) => void;
  onDownload: (file: File) => void;
  onHome: () => void;
}) {
  const [designOpen, setDesignOpen] = useState(false),
    [fitTick, setFitTick] = useState(0),
    [cardPosition, setCardPosition] = useState(0);
  const [draft, setDraft] = useState(initial),
    [dirty, setDirty] = useState(false);
  const [card, setCard] = useState<Card | null>(null),
    [included, setIncluded] = useState(true),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [print, setPrint] = useState(false),
    [publication, setPublication] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<{
      content: Content;
      work: Work;
    } | null>(null),
    [png, setPng] = useState<{ url: string; name: string } | null>(null);
  const [helpEditing, setHelpEditing] = useState(false);
  const [documentImport, setDocumentImport] = useState(false);
  const [importFile, setImportFile] = useState<File | undefined>();
  const [fileDialog, setFileDialog] = useState(initialImport),
    [fileBusy, setFileBusy] = useState(false),
    [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    importController = useRef<AbortController | null>(null),
    exportController = useRef<AbortController | null>(null);
  const [importNotice, setImportNotice] = useState("");
  const [helpNotice, setHelpNotice] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  const closeHelp = () => {
    setHelpEditing(false);
    requestAnimationFrame(() => helpButton.current?.focus());
  };
  const operation = useRef(0);
  const content = draft.content;
  const initialPreview = useMemo(
    () =>
      content.cards.length
        ? initialBoardWork(content, {
            width: Math.max(300, window.innerWidth - 48),
            height: 500,
          })
        : null,
    [content],
  );
  const previewSeed =
    previewOverride?.content === content
      ? previewOverride.work
      : initialPreview;
  const preview =
    previewSeed && integration && draft.author.board
      ? {
          ...previewSeed,
          cards: previewSeed.cards.map(
            (c) => draft.author.board!.find((p) => p.id === c.id) ?? c,
          ),
        }
      : previewSeed;
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty || card || helpEditing || documentImport) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, card, helpEditing, documentImport]);
  useEffect(
    () => () => {
      operation.current++;
      importController.current?.abort();
      exportController.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (png) URL.revokeObjectURL(png.url);
    },
    [png],
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    integration?.state(
      draft,
      dirty,
      !!card || helpEditing || documentImport || fileBusy,
    );
  }, [draft, dirty, card, helpEditing, documentImport, fileBusy]);
  useEffect(() => integration?.onSaved(() => setDirty(false)), []);
  const saveDesktop = async (saveAs = false) => {
    const snapshot = draft;
    if (await integration!.save(snapshot, saveAs)) {
      if (draftRef.current === snapshot) setDirty(false);
    }
  };
  const change = (next: Content, author = draft.author) => {
    try {
      setDraft(reviseDraft(draft, next, author));
      setDirty(true);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const closeCard = () => {
    if (
      busy ||
      window.confirm(
        "Kartenformular schließen? Nicht übernommene Eingaben gehen verloren.",
      )
    ) {
      operation.current++;
      setBusy(false);
      setCard(null);
      setError("");
    }
  };
  const edit = (id: number) => {
    setCardPosition(content.cards.findIndex((c) => c.id === id));
    setCard(structuredClone(content.cards.find((c) => c.id === id)!));
    setIncluded(!draft.author.hiddenCards.includes(id));
    setError("");
  };
  const add = () => {
    setCardPosition(content.cards.length);
    setCard({
      id: content.cards.length + 1,
      title: "",
      text: "",
      group:
        Object.entries(content.cardGroups!).find(([, g]) => !g.prefix)?.[0] ??
        Object.keys(content.cardGroups!)[0],
    });
    setIncluded(true);
    setError("");
  };
  const saveCard = () => {
    if (!card) return;
    const cards = content.cards.some((c) => c.id === card.id)
      ? content.cards.map((c) => (c.id === card.id ? card : c))
      : [...content.cards, card];
    if (integration) {
      const index = cards.findIndex((c) => c.id === card.id);
      cards.splice(index, 1);
      cards.splice(Math.min(cardPosition, cards.length), 0, card);
    }
    const next = {
      ...content,
      cards,
      initial: {
        ...content.initial,
        cards: cards.map(
          (c, i) =>
            content.initial.cards.find((s) => s.id === c.id) ?? {
              id: c.id,
              x: i * 480,
              y: 0,
              color: 0,
            },
        ),
      },
    };
    const hidden = [
      ...draft.author.hiddenCards.filter((id) => id !== card.id),
      ...(included ? [] : [card.id]),
    ];
    if (change(next, { ...draft.author, hiddenCards: hidden })) {
      setCard(null);
      setFitTick((t) => t + 1);
    }
  };
  const remove = (id: number) => {
    if (
      !window.confirm(
        `Karte ${cardNumber(content, id)} wirklich löschen? Die übrigen Karten werden neu nummeriert. Bereits verteilte Dateien bleiben erhalten.`,
      )
    )
      return false;
    const keep = content.cards.filter((c) => c.id !== id);
    const mapping = new Map(keep.map((c, i) => [c.id, i + 1]));
    return change(
      retainCards(
        content,
        keep.map((c) => c.id),
      ),
      {
        ...draft.author,
        ...(draft.author.board
          ? {
              board: draft.author.board
                .filter((c) => mapping.has(c.id))
                .map((c) => ({ ...c, id: mapping.get(c.id)! })),
            }
          : {}),
        hiddenCards: draft.author.hiddenCards
          .filter((n) => mapping.has(n))
          .map((n) => mapping.get(n)!),
      },
    );
  };
  const preparePublication = () => {
    try {
      publishDraft(draft);
      setError("");
      setPublication(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cancelFile = () => {
    importController.current?.abort();
    setFileBusy(false);
    setFileDialog(false);
    setFileError("");
  };
  const openMaterial = async (files: File[]) => {
    if (files.length !== 1) {
      setFileError(
        "Bitte genau eine Datei öffnen. Mehrere Dateien werden nicht zusammengeführt.",
      );
      return;
    }
    const file = files[0];
    if (!/\.(mysteryboard|png|docx|pdf|jpg|jpeg|webp)$/i.test(file.name)) {
      setFileError(
        "Bitte eine .mysteryboard-, Original-PNG-, Word-, PDF- oder Foto-Datei (PNG/JPEG/WebP) auswählen.",
      );
      return;
    }
    if (
      fileBusy ||
      card ||
      helpEditing ||
      documentImport ||
      publication ||
      print
    ) {
      setFileError(
        "Bitte zuerst den geöffneten Bearbeitungsschritt abschließen oder abbrechen.",
      );
      return;
    }
    setFileError("");
    let photo = /\.(jpg|jpeg|webp)$/i.test(file.name);
    if (/\.png$/i.test(file.name)) {
      try {
        if (file.size > 30_000_000)
          throw Error("Die Datei ist größer als 30 MB.");
        photo = !parsePng(new Uint8Array(await file.arrayBuffer())).some(
          (c) => c.type === "mySt",
        );
      } catch (e) {
        setFileError((e as Error).message);
        return;
      }
    }
    if (/\.(docx|pdf)$/i.test(file.name) || photo) {
      setFileDialog(false);
      setImportFile(file);
      setDocumentImport(true);
      return;
    }
    const controller = new AbortController();
    importController.current?.abort();
    importController.current = controller;
    setFileBusy(true);
    try {
      const document = await readDocumentFile(file, controller.signal);
      if (document.kind === "student")
        throw new Error(
          "Schülerarbeitsstände bitte über „Arbeit fortsetzen“ auf der Startseite öffnen. Für den Editor eine Aufgabe oder einen Lehrkraftentwurf verwenden.",
        );
      const next =
        document.kind === "draft"
          ? document
          : draftFromContent(document.content, draft.author.initials);
      if (
        dirty &&
        !confirm(
          "Geöffneten Entwurf ersetzen? Nicht abgelegte Änderungen gehen verloren. Bitte vorher „Entwurf sichern“ herunterladen.",
        )
      )
        return;
      controller.signal.throwIfAborted();
      integration?.detach();
      setDraft(next);
      setDirty(false);
      setPreviewOverride(null);
      setPng(null);
      setHelpNotice(false);
      setError("");
      setImportNotice("Datei geprüft und als bearbeitbarer Entwurf geöffnet.");
      setFileDialog(false);
    } catch (error) {
      if (!controller.signal.aborted) setFileError((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setFileBusy(false);
    }
  };
  const materialInput = (
    <input
      hidden
      ref={fileInput}
      type="file"
      accept=".mysteryboard,.png,.docx,.pdf,.jpg,.jpeg,.webp"
      aria-label="Mystery-Datei"
      disabled={fileBusy}
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (files.length) void openMaterial(files);
      }}
    />
  );
  useEffect(() => {
    if (initialMaterial) {
      void openMaterial([initialMaterial]);
      onMaterialStarted?.();
    }
  }, [initialMaterial]);
  const exportScorm = async () => {
    const controller = new AbortController();
    exportController.current?.abort();
    exportController.current = controller;
    setBusy(true);
    setError("");
    try {
      const file = await (integration?.scorm ?? classroomScorm)(
        publishDraft(draft),
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setPublication(false);
        onDownload(file);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          `SCORM konnte nicht erstellt werden. ${(error as Error).message} Der Entwurf bleibt erhalten.`,
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const taskPng = async () => {
    const id = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const task = publishDraft(draft),
        work = initialBoardWork(task.content, { width: 1024, height: 768 });
      const result = await exportBoard(
        work,
        task.content,
        "compact",
        packDocument(task),
      );
      if (id === operation.current)
        setPng({
          url: URL.createObjectURL(result.blob),
          name: `MysteryBoard-Aufgabe-${task.content.id}-${task.content.version}.png`,
        });
    } catch (e) {
      if (id === operation.current)
        setError(
          `PNG konnte nicht erzeugt werden. ${(e as Error).message} Die Projektdatei steht weiterhin zur Verfügung.`,
        );
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };
  const cardExtras = card && (
    <>
      {" "}
      <p className="small">
        Bis 3 MB und 4 Millionen Bildpunkte je Bild; insgesamt 12 MB und 24
        Millionen Bildpunkte. PDF-Seiten zunächst lokal als Bild exportieren.
      </p>
      {card.image && (
        <>
          <MediaView src={card.image} alt={card.imageAlt} />
          <button
            type="button"
            onClick={() => {
              const next = { ...card };
              delete next.image;
              delete next.imageAlt;
              setCard(next);
            }}
          >
            Bild entfernen
          </button>
          <label>
            Bildbeschreibung (optional)
            <input
              maxLength={300}
              value={card.imageAlt ?? ""}
              onChange={(e) => setCard({ ...card, imageAlt: e.target.value })}
            />
          </label>
        </>
      )}
      <label>
        Quellenangabe (optional)
        <textarea
          maxLength={1000}
          value={card.source ?? ""}
          onChange={(e) => setCard({ ...card, source: e.target.value })}
        />
      </label>
      {card.table ? (
        <TableEditor
          table={card.table}
          onChange={(table) => {
            const next = { ...card };
            if (table) next.table = table;
            else delete next.table;
            setCard(next);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() =>
            setCard({
              ...card,
              table: { headers: ["Merkmal", "Wert"], rows: [["", ""]] },
            })
          }
        >
          Tabelle hinzufügen
        </button>
      )}
      <label>
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => setIncluded(e.target.checked)}
        />
        Für Schülerinnen und Schüler bereitstellen
      </label>
      {integration && (
        <>
          <label>
            Position im Mystery
            <select
              value={cardPosition}
              onChange={(e) => setCardPosition(Number(e.target.value))}
            >
              {Array.from(
                { length: Math.max(content.cards.length, cardPosition + 1) },
                (_, i) => (
                  <option key={i} value={i}>
                    Position {i + 1}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Bildunterschrift
            <input
              value={card.imageCaption ?? ""}
              maxLength={500}
              onChange={(e) =>
                setCard({ ...card, imageCaption: e.target.value })
              }
            />
          </label>
          <label>
            Bildposition
            <select
              value={card.imagePosition ?? "after-text"}
              onChange={(e) =>
                setCard({
                  ...card,
                  imagePosition: e.target.value as "before-text" | "after-text",
                })
              }
            >
              <option value="after-text">Nach dem Text</option>
              <option value="before-text">Vor dem Text</option>
            </select>
          </label>
          <label>
            Bildgröße
            <input
              type="range"
              min={50}
              max={100}
              value={card.imageScale ?? 100}
              onChange={(e) =>
                setCard({ ...card, imageScale: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Weiteres Bild oder Diagramm hinzufügen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={(card.extraImages?.length ?? 0) >= 3}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const id = ++operation.current;
                setBusy(true);
                try {
                  const src = await imageFromFile(f);
                  if (id === operation.current)
                    setCard({
                      ...card,
                      extraImages: [
                        ...(card.extraImages ?? []),
                        { src, alt: "", caption: "", source: "" },
                      ],
                    });
                } catch (e) {
                  if (id === operation.current) setError((e as Error).message);
                } finally {
                  if (id === operation.current) setBusy(false);
                }
              }}
            />
          </label>
          {card.extraImages?.map((img, i) => (
            <div key={i} className="studio-extra-image">
              <MediaView src={img.src} alt={img.alt} />
              {(["alt", "caption", "source"] as const).map((k, j) => (
                <label key={k}>
                  {
                    [
                      "Beschreibung des zusätzlichen Bildes",
                      "Unterschrift des zusätzlichen Bildes",
                      "Quelle des zusätzlichen Bildes",
                    ][j]
                  }
                  <input
                    value={img[k] ?? ""}
                    maxLength={
                      k === "source" ? 1000 : k === "caption" ? 500 : 300
                    }
                    onChange={(e) =>
                      setCard({
                        ...card,
                        extraImages: card.extraImages!.map((m, n) =>
                          n === i ? { ...m, [k]: e.target.value } : m,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCard({
                    ...card,
                    extraImages: card.extraImages!.filter((_, n) => n !== i),
                  })
                }
              >
                Zusätzliches Bild entfernen
              </button>
            </div>
          ))}
          {content.cards.some((c) => c.id === card.id) && (
            <button
              type="button"
              onClick={() => {
                if (remove(card.id)) setCard(null);
              }}
            >
              Karte löschen
            </button>
          )}
        </>
      )}
    </>
  );
  return (
    <main
      className="author-editor"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          void openMaterial([...e.dataTransfer.files]);
        }
      }}
    >
      {integration && (
        <header className="author-toolbar studio-main-toolbar">
          <strong>MysteryBoard Studio</strong>
          <nav aria-label="Mystery bearbeiten">
            <button
              className="primary"
              disabled={
                content.cards.length >= 100 || documentImport || helpEditing
              }
              onClick={add}
            >
              Karte hinzufügen
            </button>
            <button
              disabled={documentImport || helpEditing || !!card}
              onClick={() => fileInput.current?.click()}
            >
              Material importieren
            </button>
            <button
              aria-pressed={designOpen}
              disabled={documentImport || helpEditing || !!card}
              onClick={() => setDesignOpen((v) => !v)}
            >
              Mystery gestalten
            </button>
            <button
              disabled={documentImport || helpEditing || !!card}
              onClick={() => void saveDesktop()}
            >
              Projekt sichern
            </button>
            <button
              disabled={
                !content.cards.length || documentImport || helpEditing || !!card
              }
              onClick={preparePublication}
            >
              Exportieren
            </button>
          </nav>
          <details className="studio-project-menu">
            <summary>Projekt</summary>
            <button
              disabled={documentImport || helpEditing || !!card || fileBusy}
              onClick={integration.open}
            >
              Mystery öffnen
            </button>
            <button
              disabled={
                documentImport ||
                helpEditing ||
                !!card ||
                fileBusy ||
                !content.cards.length
              }
              onClick={() => {
                try {
                  integration.preview(publishDraft(draft));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Schüleransicht prüfen
            </button>
            <button
              disabled={documentImport || helpEditing || !!card || fileBusy}
              onClick={() => void saveDesktop(true)}
            >
              Speichern unter
            </button>
            <button
              disabled={documentImport || helpEditing || !!card || fileBusy}
              onClick={() => {
                if (
                  !dirty ||
                  confirm(
                    "Zur Startseite? Ungesicherte Änderungen gehen verloren.",
                  )
                )
                  onHome();
              }}
            >
              Startseite
            </button>
          </details>
          {materialInput}
        </header>
      )}
      {!integration && (
        <>
          <header className="author-toolbar">
            <strong>MysteryBoard · Lehrkräftemodus</strong>
            <span>Kürzel: {draft.author.initials}</span>
            <button
              className="primary"
              disabled={helpEditing || documentImport || fileBusy}
              onClick={() => onFile(validateDocument(draft))}
            >
              Entwurf sichern
            </button>
            <button
              disabled={helpEditing || documentImport || fileBusy}
              onClick={() => {
                setFileError("");
                setFileDialog(true);
              }}
            >
              Entwurf öffnen
            </button>
            <button
              disabled={helpEditing || documentImport || fileBusy}
              onClick={() => {
                if (
                  !dirty ||
                  confirm(
                    "Zur Startseite? Nicht abgelegte Änderungen gehen verloren.",
                  )
                )
                  onHome();
              }}
            >
              Startseite
            </button>
          </header>
          <p>
            Autorenwerkzeug ohne Anmeldung. Es wird nichts automatisch
            gespeichert. Das Kürzel ist kein Schüler-Teamname.
          </p>
        </>
      )}
      {helpEditing ? (
        <HelpEditor
          content={content}
          onCancel={closeHelp}
          onApply={(help) => {
            if (canonical(help ?? null) === canonical(content.help ?? null)) {
              closeHelp();
              return true;
            }
            const next = { ...content };
            if (help) next.help = help;
            else delete next.help;
            if (change(next)) {
              setHelpNotice(true);
              closeHelp();
              return true;
            }
            return false;
          }}
        />
      ) : documentImport ? (
        <DocumentImport
          draft={draft}
          multipleImages={!!integration}
          initialFile={importFile}
          dirty={dirty}
          onCancel={() => {
            setDocumentImport(false);
            setImportFile(undefined);
          }}
          onApply={(next, count) => {
            if (next.content.id !== draft.content.id) integration?.detach();
            setDraft(next);
            setDirty(true);
            setDocumentImport(false);
            setImportFile(undefined);
            setError("");
            setImportNotice(
              `${count} Karten übernommen. Die Änderungen liegen nur im geöffneten Entwurf. Bitte „Entwurf sichern“ herunterladen; anschließend „Schülerversion erstellen“ für die Klasse verwenden.`,
            );
          }}
        />
      ) : integration ? (
        designOpen ? (
          <DesignEditor
            content={content}
            onChange={(next) => change(next)}
            onClose={() => setDesignOpen(false)}
            onHelp={() => setHelpEditing(true)}
          />
        ) : (
          <section className="studio-pinboard" aria-label="Autorenpinnwand">
            <label className="studio-title">
              Mystery-Titel
              <input
                maxLength={100}
                value={content.title}
                placeholder="Titel des Mysterys"
                onChange={(e) => change({ ...content, title: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            {fileError && <p role="alert">{fileError}</p>}
            {importNotice && <p role="status">{importNotice}</p>}
            {preview ? (
              <div className="studio-board">
                <Board
                  work={preview}
                  mystery={content}
                  onChange={(work) =>
                    change(content, {
                      ...draft.author,
                      board: work.cards.map((c) => ({ ...c, color: 0 })),
                    })
                  }
                  onCard={edit}
                  onEdge={() => {}}
                  fitTick={fitTick}
                  connecting={null}
                />
              </div>
            ) : (
              <div className="studio-empty">
                <p>Beginnt mit eurer ersten Informationskarte.</p>
                <button className="primary" onClick={add}>
                  Erste Karte hinzufügen
                </button>
                <button onClick={() => fileInput.current?.click()}>
                  Material importieren
                </button>
              </div>
            )}
            <p className="small">
              {content.cards.length} Karten · Die Autorenanordnung bleibt im
              Projekt; sie wird nicht als Schülerlösung verteilt.
            </p>
          </section>
        )
      ) : (
        <>
          <section
            className="author-document-import"
            aria-label="Unterrichtsmaterial übernehmen"
          >
            <p>
              Datei hier ablegen oder auswählen: .mysteryboard, Word (.docx),
              PDF oder Foto (PNG/JPEG/WebP).
            </p>
            <button
              disabled={fileBusy}
              onClick={() => fileInput.current?.click()}
            >
              Unterrichtsmaterial auswählen
            </button>
            {!fileDialog && materialInput}
            <button
              disabled={fileBusy}
              onClick={() => {
                setImportFile(undefined);
                setDocumentImport(true);
              }}
            >
              Dokument importieren
            </button>
            <button
              disabled={fileBusy}
              onClick={() => {
                setImportFile(undefined);
                setDocumentImport(true);
              }}
            >
              Foto oder Scan importieren
            </button>
            {fileBusy && (
              <>
                <p role="status">
                  Datei und eingebettete Bilder werden geprüft …
                </p>
                <button onClick={cancelFile}>Import abbrechen</button>
              </>
            )}
            {!fileDialog && fileError && <p role="alert">{fileError}</p>}
            {importNotice && <p role="status">{importNotice}</p>}
          </section>
          <div className="author-fields">
            <label>
              Mystery-Titel
              <input
                maxLength={100}
                value={content.title}
                onChange={(e) => change({ ...content, title: e.target.value })}
              />
            </label>
            <label>
              Untertitel (optional)
              <input
                maxLength={300}
                value={content.subtitle ?? ""}
                onChange={(e) =>
                  change({ ...content, subtitle: e.target.value })
                }
              />
            </label>
            <label>
              Startablage
              <select
                value={
                  content.startLayout?.mode === "explicit"
                    ? "explicit"
                    : (content.startLayout?.columns ?? "auto")
                }
                onChange={(e) => {
                  const next = {
                    ...content,
                    startLayout: {
                      mode: "ordered" as const,
                      ...(e.target.value === "auto"
                        ? {}
                        : { columns: Number(e.target.value) }),
                    },
                  };
                  change(next);
                }}
              >
                <option value="auto">
                  Nummerisch · automatisch an Bildschirm anpassen
                </option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} Spalten · nummerisch
                  </option>
                ))}
                {content.startLayout?.mode === "explicit" && (
                  <option value="explicit">
                    Importierte ausdrückliche Startanordnung
                  </option>
                )}
              </select>
            </label>
          </div>
          <p className="small">
            Fassung {content.version} · {content.cards.length} Karten. Jede
            Änderung gilt für eine neue Fassung. Bereits verteilte Dateien
            bleiben erhalten.
          </p>
          <section
            className="author-help-entry"
            aria-label="Hilfen für Lernende"
          >
            <h2>Hilfen für Lernende</h2>
            <p>Denkimpuls und farbige Kartennummern</p>
            <button ref={helpButton} onClick={() => setHelpEditing(true)}>
              Hilfen bearbeiten
            </button>
            <p className="small">
              Hilfe eingerichtet:{" "}
              {content.help?.method ? "Denkimpuls" : "Allgemeiner Denkimpuls"}
              {" · "}
              {content.help?.categories?.length ?? 0} Farbgruppen
              {" · "}
              {
                new Set(
                  content.help?.categories?.flatMap((g) => g.cardIds) ?? [],
                ).size
              }{" "}
              Karten markiert
            </p>
            {helpNotice && (
              <p role="status">
                Hilfen im geöffneten Entwurf geändert. Ladet ihn jetzt über
                „Entwurf sichern“ herunter.
              </p>
            )}
          </section>
          <button
            className="primary"
            disabled={content.cards.length >= 100}
            onClick={add}
          >
            Karte hinzufügen
          </button>
          <ol className="author-card-list">
            {content.cards.map((c) => (
              <li key={c.id}>
                <strong>
                  {cardNumber(content, c.id)} · {c.title || "Ohne Überschrift"}
                </strong>
                <span>
                  {content.cardGroups![c.group!].label}
                  {draft.author.hiddenCards.includes(c.id)
                    ? " · nur im Entwurf"
                    : ""}
                </span>
                <div className="actions">
                  <button onClick={() => edit(c.id)}>
                    Karte {cardNumber(content, c.id)} bearbeiten
                  </button>
                  <button onClick={() => remove(c.id)}>
                    Karte {cardNumber(content, c.id)} löschen
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <section aria-label="Mystery-Vorschau">
            <h2>{content.title || "Vorschau eures Mysterys"}</h2>
            {content.subtitle && <p>{content.subtitle}</p>}
            <p>
              Die Kartennummern helfen beim Wiederfinden. Sie geben keine
              richtige Reihenfolge vor. Bewegungen in dieser Vorschau werden
              nicht als Schülerlösung verteilt.
            </p>
            {preview && (
              <div className="author-board">
                <Board
                  key={content.version}
                  work={preview}
                  mystery={content}
                  onChange={(work) => setPreviewOverride({ content, work })}
                  onCard={edit}
                  onEdge={() => {}}
                  fitTick={0}
                  connecting={null}
                />
              </div>
            )}
          </section>
          <div className="actions">
            <button className="primary" onClick={preparePublication}>
              Schülerversion erstellen
            </button>
            <button
              onClick={() => {
                try {
                  publishDraft(draft);
                  setError("");
                  setPublication(true);
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              Aufgabe als PNG
            </button>
            <button
              disabled={!content.cards.length}
              onClick={() => setPrint(true)}
            >
              {integration
                ? "Als Druck-PDF exportieren"
                : "Karten drucken / PDF"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="status">
          {error}
        </p>
      )}
      {card && (
        <Dialog
          title={
            content.cards.some((c) => c.id === card.id)
              ? `Karte ${card.id} bearbeiten`
              : "Karte hinzufügen"
          }
          onClose={closeCard}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveCard();
            }}
          >
            <label>
              Kartenüberschrift
              <input
                maxLength={100}
                value={card.title}
                onChange={(e) => setCard({ ...card, title: e.target.value })}
              />
            </label>
            <label>
              Kartentext
              <textarea
                maxLength={4000}
                rows={7}
                value={card.text}
                onChange={(e) => setCard({ ...card, text: e.target.value })}
              />
            </label>
            <label>
              Kartengruppe
              <select
                value={card.group}
                onChange={(e) => setCard({ ...card, group: e.target.value })}
              >
                {Object.entries(content.cardGroups!).map(([id, g]) => (
                  <option key={id} value={id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bild oder Diagramm (PNG, JPEG, WebP)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const id = ++operation.current;
                  setBusy(true);
                  setError("");
                  try {
                    const image = await imageFromFile(f);
                    if (id === operation.current)
                      setCard((c) => (c ? { ...c, image } : c));
                  } catch (err) {
                    if (id === operation.current)
                      setError((err as Error).message);
                  } finally {
                    if (id === operation.current) setBusy(false);
                  }
                }}
              />
            </label>
            {integration ? (
              <details className="studio-card-details">
                <summary>Weitere Kartenangaben</summary>
                {cardExtras}
              </details>
            ) : (
              cardExtras
            )}
            {busy && <p role="status">Bild wird geprüft …</p>}
            {error && <p role="alert">{error}</p>}
            <button className="primary full" disabled={busy} type="submit">
              Karte übernehmen
            </button>
          </form>
        </Dialog>
      )}
      {publication && (
        <Dialog
          title="Mystery bereitstellen"
          onClose={() => {
            operation.current++;
            exportController.current?.abort();
            setBusy(false);
            setPublication(false);
            setPng(null);
          }}
        >
          {integration ? (
            <>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => {
                  try {
                    integration.print(publishDraft(draft));
                    setPublication(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Als Druck-PDF exportieren
              </button>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => void exportScorm()}
              >
                Als SCORM für itslearning exportieren
              </button>
              <button
                className="full"
                disabled={busy}
                onClick={() => void taskPng()}
              >
                Als Bild exportieren
              </button>
              <p className="small">
                Der Autoren-Bildexport zeigt die Aufgabe. Schüler sichern ihre
                eigene Arbeit später mit der vollständigen Original-PNG.
              </p>
            </>
          ) : (
            <>
              {" "}
              <p>
                Die Datei enthält die vollständige Aufgabe und eingebettete
                Medien. Sie enthält keinen Teamnamen, keine Schülerbeziehungen
                und keine Bewegungen aus der Autorenvorschau. Nur freigegebene
                Karten werden aufgenommen.
              </p>
              <p>
                Die Schülerversion als Datei wird mit „Aufgabe öffnen“ geladen.
                Für den direkten Aufgabenstart im itslearning-Kurs empfehlen wir
                SCORM. Ladet das ZIP herunter und importiert es anschließend
                manuell als SCORM-Ressource in itslearning. Eine bereits
                installierte Ressource wird dadurch nicht automatisch verändert.
              </p>
              <button
                className="full"
                disabled={busy}
                onClick={() => {
                  try {
                    const task = publishDraft(draft);
                    setPublication(false);
                    onFile(task);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Schülerversion als Datei
              </button>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => void exportScorm()}
              >
                {integration
                  ? "Als SCORM für itslearning exportieren"
                  : "Für itslearning als SCORM herunterladen"}
              </button>
              <button
                className="full"
                disabled={busy}
                onClick={() => void taskPng()}
              >
                Aufgabe als Original-PNG erzeugen
              </button>
            </>
          )}
          {busy && <p role="status">Datei wird lokal vorbereitet …</p>}
          {png && (
            <a
              className="button primary full"
              download={png.name}
              href={png.url}
            >
              Aufgaben-PNG herunterladen
            </a>
          )}
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {fileDialog && (
        <Dialog title="Datei öffnen" onClose={cancelFile}>
          <p>
            Eine .mysteryboard-Datei öffnet direkt als Entwurf. Word und PDF
            öffnen den bestehenden Importassistenten.
          </p>
          {materialInput}
          <button
            className="primary full"
            disabled={fileBusy}
            onClick={() => fileInput.current?.click()}
          >
            Mystery-Datei auswählen
          </button>
          {fileBusy && (
            <p role="status">Datei und eingebettete Bilder werden geprüft …</p>
          )}
          {fileError && <p role="alert">{fileError}</p>}
          <button className="full" onClick={cancelFile}>
            Abbrechen
          </button>
        </Dialog>
      )}
      {print && content.cards.length > 0 && !integration && (
        <Dialog title="Karten drucken / PDF" onClose={() => setPrint(false)}>
          <PrintPreview
            mystery={content}
            work={withTeam(
              initialBoardWork(content, { width: 1024, height: 768 }),
              `Lehrkraft ${draft.author.initials}`,
            )}
          />
        </Dialog>
      )}
    </main>
  );
}
