import { useEffect, useMemo, useRef, useState } from "react";
import type { Content, Draft, MysteryDocument } from "../core/documents";
import { canonical, packDocument, validateDocument } from "../core/documents";
import {
  draftFromContent,
  authorEdges,
  moveAuthorCards,
  publishDraft,
  remapEdges,
  retainCards,
  reviseDraft,
  updateAuthorEdge,
} from "../core/authoring";
import { parsePng } from "../core/png";
import { imageFromFile } from "../core/media";
import { initialBoardWork } from "../core/layout";
import {
  cardNumber,
  MAX_EDGES,
  MAX_LABEL,
  nextEdgeId,
  withTeam,
  type Edge,
  type Work,
} from "../core/model";
import { exportBoard } from "../core/export";
import { Board } from "./Board";
import { Dialog } from "./Dialog";
import { PrintPreview } from "./PrintPreview";
import { MediaView } from "./MediaView";
import { CardReading } from "./CardReading";
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
    [cardPosition, setCardPosition] = useState(0),
    [readingCard, setReadingCard] = useState(false),
    [saveNotice, setSaveNotice] = useState("");
  const [draft, setDraft] = useState(initial),
    [dirty, setDirty] = useState(false);
  const [connectingCards, setConnectingCards] = useState(false);
  const [connectionFrom, setConnectionFrom] = useState<number | null>(null);
  const [edgeForm, setEdgeForm] = useState<{
    edge: Edge;
    shared: boolean;
  } | null>(null);
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
        ? initialBoardWork(
            content,
            {
              width: Math.max(300, window.innerWidth - 48),
              height: integration
                ? Math.max(360, window.innerHeight - 300)
                : 500,
            },
            integration ? 2 : 7,
          )
        : null,
    [content],
  );
  const previewSeed =
    previewOverride?.content === content
      ? previewOverride.work
      : initialPreview;
  const studioBoard = !!integration;
  const { board: authorBoard, edges: privateEdges } = draft.author;
  const preview = useMemo(() => {
    if (!previewSeed || !studioBoard) return previewSeed;
    const positions = new Map(authorBoard?.map((c) => [c.id, c]));
    return {
      ...previewSeed,
      cards: previewSeed.cards.map((c) => positions.get(c.id) ?? c),
      edges: [...previewSeed.edges, ...(privateEdges ?? [])],
    };
  }, [previewSeed, studioBoard, authorBoard, privateEdges]);
  const privateEdgeIds = useMemo(
    () => new Set(privateEdges?.map((edge) => edge.id)),
    [privateEdges],
  );
  const sharedEdges = content.initial.edges.filter(
    (edge) =>
      !draft.author.hiddenCards.includes(edge.from) &&
      !draft.author.hiddenCards.includes(edge.to),
  );
  useEffect(() => {
    if (!connectingCards || edgeForm) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectingCards(false);
        setConnectionFrom(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [connectingCards, edgeForm]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty || card || edgeForm || helpEditing || documentImport) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, card, edgeForm, helpEditing, documentImport]);
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
  const blocked =
    !!card ||
    !!edgeForm ||
    helpEditing ||
    documentImport ||
    fileBusy ||
    busy ||
    !!integration?.modal;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const saving = useRef(false);
  useEffect(() => {
    integration?.state(draft, dirty, blocked);
  }, [draft, dirty, blocked]);
  useEffect(
    () =>
      integration?.onSaved((saved) => {
        if (
          canonical(validateDocument(draftRef.current)) ===
          new TextDecoder().decode(saved.bytes)
        )
          setDirty(false);
      }),
    [],
  );
  useEffect(
    () =>
      integration?.onCommand((command) => {
        if (command !== "open" && !blockedRef.current)
          void saveDesktop(command === "save-as");
      }),
    [],
  );
  const saveDesktop = async (saveAs = false) => {
    if (saving.current) return;
    saving.current = true;
    const snapshot = draftRef.current;
    setSaveNotice("");
    setError("");
    try {
      if (await integration!.save(snapshot, saveAs)) {
        if (draftRef.current === snapshot) setDirty(false);
        setSaveNotice("Projekt gespeichert.");
      }
    } catch (e) {
      setError(
        `Das Projekt konnte nicht gespeichert werden. ${(e as Error).message}`,
      );
    } finally {
      saving.current = false;
    }
  };
  const applyDraft = (update: (current: Draft) => Draft) => {
    try {
      const next = update(draftRef.current);
      draftRef.current = next;
      setDraft(next);
      setDirty(true);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const change = (next: Content, author = draft.author) =>
    applyDraft((current) => reviseDraft(current, next, author));
  const stopConnecting = () => {
    setConnectingCards(false);
    setConnectionFrom(null);
  };
  const openEdge = (edge: Edge) => {
    setConnectionFrom(null);
    setEdgeForm({ edge, shared: !privateEdgeIds.has(edge.id) });
  };
  const selectBoardCard = (id: number) => {
    if (!connectingCards) return edit(id);
    if (connectionFrom === null || connectionFrom === id) {
      setConnectionFrom(connectionFrom === id ? null : id);
      return;
    }
    const edges = authorEdges(draftRef.current);
    const existing = edges.find(
      (edge) =>
        (edge.from === connectionFrom && edge.to === id) ||
        (edge.from === id && edge.to === connectionFrom),
    );
    if (existing) return openEdge(existing);
    if (edges.length >= MAX_EDGES) {
      setError(
        `Die Pinnwand kann höchstens ${MAX_EDGES} Verbindungen enthalten.`,
      );
      return;
    }
    setEdgeForm({
      shared: false,
      edge: {
        id: nextEdgeId(edges),
        from: connectionFrom,
        to: id,
        direction: content.design?.direction ?? 1,
        label: "",
      },
    });
    setConnectionFrom(null);
  };
  const saveEdge = (remove = false) => {
    if (!edgeForm) return;
    if (
      applyDraft((current) =>
        updateAuthorEdge(
          current,
          edgeForm.edge.id,
          remove ? undefined : edgeForm.edge,
          edgeForm.shared,
        ),
      )
    )
      setEdgeForm(null);
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
    setReadingCard(false);
    setCardPosition(content.cards.findIndex((c) => c.id === id));
    setCard(structuredClone(content.cards.find((c) => c.id === id)!));
    setIncluded(!draft.author.hiddenCards.includes(id));
    setError("");
  };
  const add = () => {
    setReadingCard(false);
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
        ...(draft.author.edges
          ? { edges: remapEdges(draft.author.edges, mapping) }
          : {}),
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
      if (!integration) publishDraft(draft);
      setError("");
      setSaveNotice("");
      setPublication(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  let publicationIssue = "";
  if (integration && publication) {
    try {
      publishDraft(draft);
    } catch (e) {
      publicationIssue = (e as Error).message;
    }
  }
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
          integration
            ? "Schülerarbeitsstände bitte im Schülerplayer fortsetzen. In Studio eine Aufgabe oder ein bearbeitbares Mystery öffnen."
            : "Schülerarbeitsstände bitte über „Arbeit fortsetzen“ auf der Startseite öffnen. Für den Editor eine Aufgabe oder einen Lehrkraftentwurf verwenden.",
        );
      const next =
        document.kind === "draft"
          ? document
          : draftFromContent(document.content, draft.author.initials);
      if (
        dirty &&
        !confirm(
          integration
            ? "Geöffnetes Mystery ersetzen? Ungesicherte Änderungen gehen verloren. Sichere es bei Bedarf zuerst über „Exportieren → Bearbeitbares Mystery sichern“."
            : "Geöffneten Entwurf ersetzen? Nicht abgelegte Änderungen gehen verloren. Bitte vorher „Entwurf sichern“ herunterladen.",
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
      if (id === operation.current && integration) {
        setPublication(false);
        onDownload(
          new File(
            [result.blob],
            `MysteryBoard-Aufgabe-${task.content.id}-${task.content.version}.png`,
            { type: "image/png" },
          ),
        );
      } else if (id === operation.current)
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
      className={"author-editor" + (integration ? " studio-editor" : "")}
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
          <div className="studio-project-navigation">
            <button
              className="studio-back"
              hidden={documentImport || helpEditing}
              disabled={blocked}
              onClick={() => {
                if (
                  !dirty ||
                  confirm(
                    "Zur Projektübersicht? Ungesicherte Änderungen gehen verloren.",
                  )
                )
                  onHome();
              }}
            >
              Zur Projektübersicht
            </button>
            <span className="studio-project-status" role="status">
              {integration.name || "Neues Mystery"}
              {(dirty || blocked || !integration.name) && (
                <span className="studio-unsaved">
                  {" "}
                  · Ungesicherte Änderungen
                </span>
              )}
            </span>
          </div>
          <nav
            aria-label="Mystery bearbeiten"
            hidden={documentImport || helpEditing}
          >
            <button
              className="primary"
              disabled={content.cards.length >= 100 || blocked}
              onClick={add}
            >
              Karte hinzufügen
            </button>
            <button
              disabled={blocked}
              onClick={() => fileInput.current?.click()}
            >
              Importieren
            </button>
            <button
              aria-pressed={designOpen}
              disabled={blocked}
              onClick={() => setDesignOpen((v) => !v)}
            >
              Mystery gestalten
            </button>
            <button disabled={blocked} onClick={preparePublication}>
              Exportieren
            </button>
          </nav>
          {materialInput}
        </header>
      )}
      {integration && fileError && (documentImport || helpEditing) && (
        <p role="alert">{fileError}</p>
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
          studio={!!integration}
          multipleImages={!!integration}
          initialFile={importFile}
          dirty={dirty}
          onCancel={() => {
            setDocumentImport(false);
            setImportFile(undefined);
            setFileError("");
          }}
          onApply={(next, count) => {
            if (next.content.id !== draft.content.id) integration?.detach();
            setDraft(next);
            setDirty(true);
            setDocumentImport(false);
            setImportFile(undefined);
            setError("");
            setImportNotice(
              integration
                ? `${count} Karten übernommen. Du kannst sie jetzt auf der Pinnwand bearbeiten oder über „Exportieren“ speichern und für den Unterricht bereitstellen.`
                : `${count} Karten übernommen. Die Änderungen liegen nur im geöffneten Entwurf. Bitte „Entwurf sichern“ herunterladen; anschließend „Schülerversion erstellen“ für die Klasse verwenden.`,
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
            <div className="studio-board-help">
              <p>
                Karten anklicken zum Bearbeiten, ziehen zum Anordnen. „Groß
                ansehen“ öffnet die Leseansicht. Mit Trackpad oder Mausrad
                kannst du die Pinnwand vergrößern.
              </p>
              {preview && (
                <div className="studio-board-tools">
                  <button onClick={() => setFitTick((t) => t + 1)}>
                    Alle Karten anzeigen
                  </button>
                  {content.cards.length >= 2 && (
                    <button
                      aria-pressed={connectingCards}
                      onClick={() => {
                        if (connectingCards) stopConnecting();
                        else setConnectingCards(true);
                      }}
                    >
                      {connectingCards
                        ? "Verbindungsmodus beenden"
                        : "Verbindungen bearbeiten"}
                    </button>
                  )}
                </div>
              )}
            </div>
            {connectingCards && (
              <p role="status" className="studio-edge-hint">
                {connectionFrom === null
                  ? "Erste Karte oder vorhandene Verbindung auswählen."
                  : `Karte ${cardNumber(content, connectionFrom)} gewählt. Jetzt die zweite Karte auswählen.`}
              </p>
            )}
            {!!preview?.edges.length && (
              <p className="studio-edge-hint">
                <span className="studio-private-edge">
                  Gestrichelt in Braun: nur für Lehrkräfte.
                </span>{" "}
                Übrige Verbindungen: Starthilfen.
              </p>
            )}
            {preview ? (
              <div className="studio-board">
                <Board
                  badgeScaleLimit={2}
                  work={preview}
                  mystery={content}
                  authorBoard
                  selectingCards={connectingCards}
                  privateEdges={privateEdgeIds}
                  onChange={(work) =>
                    applyDraft((current) =>
                      moveAuthorCards(current, work.cards),
                    )
                  }
                  onCard={selectBoardCard}
                  onEdge={(id) => {
                    const edge = preview.edges.find((item) => item.id === id);
                    if (edge) openEdge(edge);
                  }}
                  fitTick={fitTick}
                  connecting={connectionFrom}
                />
              </div>
            ) : (
              <div className="studio-empty">
                <p>
                  Beginne mit „Karte hinzufügen“ oder lege vorhandenes Material
                  hier ab.
                </p>
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
      {error &&
        (!integration || designOpen || helpEditing || documentImport) && (
          <p role="alert" className="status">
            {error}
          </p>
        )}
      {edgeForm && (
        <Dialog
          title="Verbindung bearbeiten"
          onClose={() => {
            setEdgeForm(null);
            setError("");
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveEdge();
            }}
          >
            <label>
              Richtung
              <select
                value={edgeForm.edge.direction}
                onChange={(event) =>
                  setEdgeForm({
                    ...edgeForm,
                    edge: {
                      ...edgeForm.edge,
                      direction: Number(
                        event.target.value,
                      ) as Edge["direction"],
                    },
                  })
                }
              >
                <option value="1">
                  {cardNumber(content, edgeForm.edge.from)} →{" "}
                  {cardNumber(content, edgeForm.edge.to)}
                </option>
                <option value="2">
                  {cardNumber(content, edgeForm.edge.to)} →{" "}
                  {cardNumber(content, edgeForm.edge.from)}
                </option>
                <option value="0">Ohne Pfeil</option>
              </select>
            </label>
            <label>
              Beschriftung (freiwillig)
              <textarea
                rows={3}
                maxLength={MAX_LABEL}
                value={edgeForm.edge.label}
                onChange={(event) =>
                  setEdgeForm({
                    ...edgeForm,
                    edge: { ...edgeForm.edge, label: event.target.value },
                  })
                }
              />
            </label>
            <label className="studio-share-edge">
              <input
                type="checkbox"
                checked={edgeForm.shared}
                disabled={
                  !edgeForm.shared &&
                  [edgeForm.edge.from, edgeForm.edge.to].some((id) =>
                    draft.author.hiddenCards.includes(id),
                  )
                }
                onChange={(event) =>
                  setEdgeForm({ ...edgeForm, shared: event.target.checked })
                }
              />
              Diese Verbindung als Starthilfe an Lernende weitergeben.
            </label>
            {[edgeForm.edge.from, edgeForm.edge.to].some((id) =>
              draft.author.hiddenCards.includes(id),
            ) && (
              <p className="small">
                Eine der Karten ist ausgeblendet. Die Verbindung erscheint in
                keiner Schülerausgabe.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <button type="submit" className="primary">
                Übernehmen
              </button>
              {preview?.edges.some((edge) => edge.id === edgeForm.edge.id) && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => saveEdge(true)}
                >
                  Verbindung löschen
                </button>
              )}
            </div>
          </form>
        </Dialog>
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
          {integration && (
            <button
              className="studio-reading-toggle"
              onClick={() => setReadingCard((v) => !v)}
            >
              {readingCard ? "Zur Bearbeitung" : "Groß ansehen"}
            </button>
          )}
          {integration && readingCard ? (
            <CardReading card={card} design={content.design} />
          ) : (
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
          )}
        </Dialog>
      )}
      {publication && (
        <Dialog
          title={
            integration ? "Speichern und exportieren" : "Mystery bereitstellen"
          }
          onClose={() => {
            operation.current++;
            exportController.current?.abort();
            setBusy(false);
            setPublication(false);
            setPng(null);
          }}
        >
          {integration ? (
            <div className="studio-export-choices">
              <button
                className="studio-export-option"
                aria-label="Bearbeitbares Mystery sichern"
                disabled={busy}
                onClick={() => void saveDesktop()}
              >
                <strong>Bearbeitbares Mystery sichern</strong>
                <span>Später weiterarbeiten</span>
                <small>.mysteryboard · ⌘S</small>
              </button>
              <button
                className="studio-export-secondary"
                disabled={busy}
                onClick={() => void saveDesktop(true)}
              >
                Speichern unter …
              </button>
              {saveNotice && <p role="status">{saveNotice}</p>}
              {!!content.initial.edges.length && (
                <details className="studio-export-start-edges" open>
                  <summary>
                    Starthilfen für Lernende ({sharedEdges.length})
                  </summary>
                  <ul>
                    {sharedEdges.map((edge) => (
                      <li key={edge.id}>
                        {cardNumber(
                          content,
                          edge.direction === 2 ? edge.to : edge.from,
                        )}
                        {edge.direction ? " → " : " – "}
                        {cardNumber(
                          content,
                          edge.direction === 2 ? edge.from : edge.to,
                        )}
                        {edge.label && `: ${edge.label}`}
                      </li>
                    ))}
                  </ul>
                  {content.initial.edges.length > sharedEdges.length && (
                    <p className="small">
                      Starthilfen zu ausgeblendeten Karten werden ausgelassen.
                    </p>
                  )}
                </details>
              )}
              <button
                className="studio-export-option"
                aria-label="Als Druck-PDF speichern"
                disabled={busy || !!publicationIssue}
                onClick={() => {
                  try {
                    integration.print(publishDraft(draft));
                    setPublication(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <strong>Als Druck-PDF speichern</strong>
                <span>Karten zum Ausschneiden</span>
                <small>PDF · A4 oder A3</small>
              </button>
              <button
                className="studio-export-option"
                aria-label="Für itslearning exportieren"
                disabled={busy || !!publicationIssue}
                onClick={() => void exportScorm()}
              >
                <strong>Für itslearning exportieren</strong>
                <span>Digitale Schüleraufgabe</span>
                <small>SCORM 1.2 · ZIP</small>
              </button>
              <button
                className="studio-export-secondary"
                disabled={busy || !!publicationIssue}
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
                className="studio-export-option"
                aria-label="Als Bild exportieren"
                disabled={busy || !!publicationIssue}
                onClick={() => void taskPng()}
              >
                <strong>Als Bild exportieren</strong>
                <span>Grafische Übersicht der Aufgabe</span>
                <small>PNG · keine Schülerarbeit</small>
              </button>
              {!content.cards.length && (
                <p className="small">
                  Dein Projekt kannst du bereits sichern. Für eine
                  Unterrichtsaufgabe füge zuerst Karten hinzu.
                </p>
              )}
              {!!content.cards.length && publicationIssue && (
                <p className="small">{publicationIssue}</p>
              )}
            </div>
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
