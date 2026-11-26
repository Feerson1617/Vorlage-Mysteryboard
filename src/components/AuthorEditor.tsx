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
  setStudentStart,
  updateAuthorEdge,
} from "../core/authoring";
import { parsePng } from "../core/png";
import { imageFromFile } from "../core/media";
import { initialBoardWork, makeLayouts } from "../core/layout";
import {
  cardNumber,
  COLORS,
  COLOR_NAMES,
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
import { cardAppearance, designOf } from "../core/design";

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
  const [boardFocused, setBoardFocused] = useState(false),
    [boardHelp, setBoardHelp] = useState(false),
    [zoomCommand, setZoomCommand] = useState<{ factor: number }>();
  const [draft, setDraft] = useState(initial),
    [dirty, setDirty] = useState(!!integration?.unsaved);
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
  const [confirmedTaskHash, setConfirmedTaskHash] = useState<string | null>(
    null,
  );
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
  const digitalExportRunning = useRef(false);
  const [privateView, setPrivateView] = useState(false);
  const [undoClear, setUndoClear] = useState<{ before: Draft; after: Draft }>();
  const content = draft.content;
  const studentView = !!integration && !privateView;
  const visibleIds = useMemo(
    () =>
      content.cards
        .filter((c) => !draft.author.hiddenCards.includes(c.id))
        .map((c) => c.id),
    [content, draft.author.hiddenCards],
  );
  const boardContent = useMemo(
    () => (studentView ? retainCards(content, visibleIds) : content),
    [studentView, content, visibleIds],
  );
  const internalId = (id: number) => (studentView ? visibleIds[id - 1] : id);
  const displayId = (id: number) =>
    studentView ? visibleIds.indexOf(id) + 1 : id;
  const viewport = {
    width: Math.max(300, window.innerWidth - 48),
    height: Math.max(360, window.innerHeight - 150),
  };
  const learnerWork = useMemo(
    () =>
      studentView && boardContent.cards.length
        ? initialBoardWork(boardContent, viewport, 7, "preview")
        : null,
    [studentView, boardContent],
  );
  const cardLayouts = useMemo(
    () => (studentView ? makeLayouts(boardContent, "preview") : undefined),
    [studentView, boardContent],
  );
  const initialPreview = useMemo(
    () =>
      content.cards.length
        ? initialBoardWork(
            content,
            {
              width: Math.max(300, window.innerWidth - 48),
              height: integration
                ? Math.max(360, window.innerHeight - 150)
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
    if (studentView) return learnerWork;
    if (!previewSeed || !studioBoard) return previewSeed;
    const positions = new Map(authorBoard?.map((c) => [c.id, c]));
    return {
      ...previewSeed,
      cards: previewSeed.cards.map((c) => positions.get(c.id) ?? c),
      edges: [...previewSeed.edges, ...(privateEdges ?? [])],
    };
  }, [
    previewSeed,
    studioBoard,
    authorBoard,
    privateEdges,
    studentView,
    learnerWork,
  ]);
  const privateEdgeIds = useMemo(
    () => new Set(privateEdges?.map((edge) => edge.id)),
    [privateEdges],
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
    if (!boardFocused || connectingCards || card || boardHelp) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBoardFocused(false);
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [boardFocused, connectingCards, card, boardHelp]);
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
  const editingForm =
    !!card || !!edgeForm || helpEditing || documentImport || fileBusy || busy;
  const blocked = editingForm || !!integration?.modal;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const saving = useRef(false);
  useEffect(() => {
    integration?.state(draft, dirty, editingForm);
  }, [draft, dirty, editingForm]);
  useEffect(
    () =>
      integration?.onSaved((saved) => {
        if (
          integrationRef.current?.matchesSaved?.(
            draftRef.current,
            saved.bytes,
          ) ||
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
  const integrationRef = useRef(integration);
  integrationRef.current = integration;
  const saveDesktop = async (saveAs = false) => {
    if (saving.current) return;
    saving.current = true;
    const snapshot = draftRef.current;
    setSaveNotice("");
    setError("");
    try {
      if (await integrationRef.current!.save(snapshot, saveAs)) {
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
      if (next === draftRef.current) return true;
      draftRef.current = next;
      setDraft(next);
      setDirty(true);
      setSaveNotice("");
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const change = (next: Content, author = draft.author) =>
    applyDraft((current) => reviseDraft(current, next, author));
  function moveBoard(
    current: Draft,
    cards: Work["cards"],
    mode: "ordered" | "explicit" = "explicit",
  ) {
    if (!studentView) return moveAuthorCards(current, cards);
    // Freeze the previous private layout before changing a shared fallback.
    const prior = current.author.board ?? initialPreview?.cards;
    const prepared = prior
      ? { ...current, author: { ...current.author, board: prior } }
      : current;
    return setStudentStart(
      prepared,
      { mode },
      cards.map((c) => ({ ...c, id: internalId(c.id) })),
    );
  }
  function boardAction(clear: boolean) {
    const scope = privateView ? "Musterlösung (privat)" : "Schülerstart";
    const other = privateView ? "Schülerstart" : "private Musterlösung";
    if (
      !confirm(
        clear
          ? "Sämtliche Verbindungen in „" +
              scope +
              "“ in diesem Niveau löschen? Karten, Texte, Bilder, Einstellungen und die Ansicht „" +
              other +
              "“ bleiben erhalten."
          : "Karten in „" +
              scope +
              "“ nach Nummern anordnen? Verbindungen, Inhalte und andere Niveaus bleiben erhalten.",
      )
    )
      return;
    const before = draftRef.current;
    if (clear) {
      const { startEdgesAsHints, ...rest } = before.content;
      const after = privateView
        ? { ...before, author: { ...before.author, edges: [] } }
        : reviseDraft(before, {
            ...rest,
            initial: { ...rest.initial, edges: [] },
          });
      if (applyDraft(() => after)) setUndoClear({ before, after });
    } else {
      const ordered = initialBoardWork(
        { ...boardContent, startLayout: { mode: "ordered" } },
        viewport,
        studentView ? 7 : 2,
        studentView ? "preview" : "full",
      );
      applyDraft((current) => moveBoard(current, ordered.cards, "ordered"));
      setFitTick((t) => t + 1);
    }
  }
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
    if (existing) {
      if (studentView && privateEdgeIds.has(existing.id)) {
        if (
          confirm(
            "Dieses Kartenpaar ist privat verbunden. Diese Verbindung zur Bearbeitung als öffentliche Starthilfe öffnen? Erst Übernehmen veröffentlicht sie.",
          )
        )
          setEdgeForm({ edge: { ...existing }, shared: true });
        setConnectionFrom(null);
        return;
      }
      return openEdge(existing);
    }
    if (edges.length >= MAX_EDGES) {
      setError(
        `Die Pinnwand kann höchstens ${MAX_EDGES} Verbindungen enthalten.`,
      );
      return;
    }
    setEdgeForm({
      shared: studentView,
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
    const title = content.cards.find((entry) => entry.id === id)?.title.trim();
    if (
      !window.confirm(
        `Karte ${cardNumber(content, id)}${title ? ` „${title}“` : ""} wirklich löschen? Zugehörige Verbindungen werden entfernt und die übrigen Karten neu nummeriert.`,
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
      setConfirmedTaskHash(null);
      setPng(null);
      setPublication(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const { task: publishedTask, issue: publicationIssue } = useMemo(() => {
    if (!publication) return { task: null, issue: "" };
    try {
      return { task: publishDraft(draft), issue: "" };
    } catch (e) {
      return { task: null, issue: (e as Error).message };
    }
  }, [draft, publication]);
  const publishedContent = publishedTask?.content;
  const sharedEdges = publishedContent?.initial.edges ?? [];
  const needsConfirmation = sharedEdges.length > 0;
  const exportConfirmed =
    !needsConfirmation || confirmedTaskHash === publishedTask?.contentHash;
  const confirmedPublication = () => {
    if (!publication || !publishedTask)
      throw new Error(publicationIssue || "Öffne zuerst den Exportbereich.");
    const snapshot = draftRef.current;
    if (snapshot !== draft)
      throw new Error(
        "Die Aufgabe hat sich geändert. Prüfe die aktuelle Ausgabe erneut.",
      );
    if (!exportConfirmed)
      throw new Error("Bestätige zuerst die vorgegebenen Verbindungen.");
    return { task: publishedTask, snapshot };
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
    let file = files[0];
    if (integration?.importFile) {
      try {
        const material = await integration.importFile(file, draftRef.current);
        setFileDialog(false);
        setFileError("");
        if (!material) return;
        file = material;
      } catch (e) {
        setFileError((e as Error).message);
        return;
      }
    }
    if (!/\.(mysteryboard|png|docx|pdf|jpg|jpeg|webp)$/i.test(file.name)) {
      setFileError(
        "Bitte eine .mysteryboard-, Original-PNG-, Word-, PDF- oder Foto-Datei (PNG/JPEG/WebP) auswählen.",
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
        (dirty || (!!integration && draft.content.cards.length > 0)) &&
        !confirm(
          integration
            ? "Geöffnetes Mystery ersetzen? Ungesicherte Änderungen gehen verloren. Sichere es bei Bedarf zuerst über „Exportieren → Bearbeitbares Mystery sichern“."
            : "Geöffneten Entwurf ersetzen? Nicht abgelegte Änderungen gehen verloren. Bitte vorher „Entwurf sichern“ herunterladen.",
        )
      )
        return;
      controller.signal.throwIfAborted();
      integration?.detach();
      setDraft(integration?.bindLevel?.(next) ?? next);
      setDirty(!!integration?.bindLevel);
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
  const chooseMaterial = async () => {
    const choose = integration && window.mysteryStudio?.chooseMaterial;
    if (!choose) {
      fileInput.current?.click();
      return;
    }
    try {
      const selected = await choose();
      if (selected)
        await openMaterial([
          new File([new Uint8Array(selected.bytes)], selected.name),
        ]);
    } catch (e) {
      setFileError((e as Error).message);
    }
  };
  const materialInput = (
    <input
      hidden
      ref={fileInput}
      type="file"
      accept=".mysteryboard,.txt,.png,.docx,.pdf,.jpg,.jpeg,.webp"
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
    if (digitalExportRunning.current) return;
    digitalExportRunning.current = true;
    const controller = new AbortController();
    exportController.current?.abort();
    exportController.current = controller;
    setBusy(true);
    setError("");
    try {
      const { task, snapshot } = confirmedPublication();
      const file = await (integration?.scorm ?? classroomScorm)(
        task,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        if (draftRef.current !== snapshot)
          throw new Error(
            "Die Aufgabe hat sich geändert. Prüfe die aktuelle Ausgabe erneut.",
          );
        setPublication(false);
        onDownload(file);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          `SCORM konnte nicht erstellt werden. ${(error as Error).message} Der Entwurf bleibt erhalten.`,
        );
    } finally {
      digitalExportRunning.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const taskPng = async () => {
    if (digitalExportRunning.current) return;
    digitalExportRunning.current = true;
    const id = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const { task, snapshot } = confirmedPublication(),
        work = initialBoardWork(task.content, { width: 1024, height: 768 });
      const result = await exportBoard(
        work,
        task.content,
        "compact",
        packDocument(task),
      );
      if (id === operation.current && draftRef.current !== snapshot)
        throw new Error(
          "Die Aufgabe hat sich geändert. Prüfe die aktuelle Ausgabe erneut.",
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
      digitalExportRunning.current = false;
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
        </>
      )}
    </>
  );
  return (
    <main
      className={
        "author-editor" +
        (integration ? " studio-editor" : "") +
        (boardFocused ? " studio-board-focus" : "")
      }
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
          <button
            className="studio-back"
            hidden={documentImport || helpEditing}
            disabled={blocked}
            onClick={async () => {
              if (integration.leaveHome) {
                try {
                  if (await integration.leaveHome()) onHome();
                } catch (e) {
                  setError((e as Error).message);
                }
              } else if (
                !dirty ||
                confirm(
                  "Zur Startseite? Ungesicherte Änderungen gehen verloren.",
                )
              )
                onHome();
            }}
          >
            Zur Startseite
          </button>
          {!documentImport && !helpEditing && !designOpen && (
            <div className="studio-title-field">
              <input
                aria-label="Mystery-Titel"
                className="studio-title"
                title={content.title}
                maxLength={100}
                value={content.title}
                placeholder="Mystery-Titel"
                onChange={(e) => change({ ...content, title: e.target.value })}
              />
              {content.title && (
                <span className="studio-full-title" aria-hidden="true">
                  {content.title}
                </span>
              )}
            </div>
          )}
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
            <button disabled={blocked} onClick={() => void chooseMaterial()}>
              Importieren
            </button>
            <button
              aria-pressed={designOpen}
              disabled={blocked}
              onClick={() => setDesignOpen((v) => !v)}
            >
              Mystery gestalten
            </button>
            <button
              title="Unterrichtsmaterial exportieren"
              disabled={blocked}
              onClick={preparePublication}
            >
              Exportieren
            </button>
          </nav>
          {!!integration.levelList &&
            integration.levelList.length > 1 &&
            !designOpen &&
            !helpEditing &&
            !documentImport && (
              <div
                className={
                  "level-switch" +
                  (integration.levelList.length <= 4 ? " few-levels" : "")
                }
              >
                <div
                  className="level-tabs"
                  role="group"
                  aria-label="Niveau wechseln"
                >
                  {integration.levelList.map((l) => (
                    <button
                      key={l.id}
                      disabled={blocked || publication}
                      aria-pressed={l.id === integration.activeLevel}
                      onClick={() => integration.switchLevel?.(draft, l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Aktuelles Niveau"
                  disabled={blocked || publication}
                  value={integration.activeLevel}
                  onChange={(e) =>
                    integration.switchLevel?.(draft, e.target.value)
                  }
                >
                  {integration.levelList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          <div className="studio-save-group">
            <span
              className="studio-project-status"
              role="status"
              title={integration.name}
            >
              {dirty ? (
                <span className="studio-unsaved">Ungesicherte Änderungen</span>
              ) : integration.name ? (
                "Alle Änderungen gespeichert"
              ) : (
                "Noch nicht gespeichert"
              )}
            </span>
            <button
              className="studio-save"
              title="Bearbeitbares Lehrkräfteprojekt speichern (⌘S)"
              disabled={blocked || !dirty}
              onClick={() => void saveDesktop()}
            >
              Speichern
            </button>
          </div>
          {!fileDialog && materialInput}
        </header>
      )}
      {integration &&
        fileError &&
        (documentImport || helpEditing || designOpen) &&
        !fileDialog && <p role="alert">{fileError}</p>}
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
            if (integration && draft.content.recovery && !next.content.recovery)
              next = reviseDraft(next, {
                ...next.content,
                recovery: draft.content.recovery,
              });
            if (next.content.id !== draft.content.id) integration?.detach();
            setDraft(integration?.bindLevel?.(next) ?? next);
            setDirty(true);
            setDocumentImport(false);
            setImportFile(undefined);
            setError("");
            setImportNotice(
              integration
                ? `${count} Karten übernommen.`
                : `${count} Karten übernommen. Die Änderungen liegen nur im geöffneten Entwurf. Bitte „Entwurf sichern“ herunterladen; anschließend „Schülerversion erstellen“ für die Klasse verwenden.`,
            );
          }}
        />
      ) : integration ? (
        designOpen ? (
          <>
            <DesignEditor
              levels={
                <button onClick={() => integration.levels?.(draft)}>
                  Niveaus verwalten
                </button>
              }
              storage={
                <>
                  <label>
                    Zwischensicherung für dieses Niveau
                    <select
                      value={content.recovery ?? "off"}
                      onChange={(e) =>
                        change({
                          ...content,
                          recovery: e.target.value as Content["recovery"],
                        })
                      }
                    >
                      <option value="off">
                        Keine automatische Zwischensicherung
                      </option>
                      <option value="session">
                        Während der Browsersitzung (empfohlen)
                      </option>
                      <option value="extended">
                        Erweiterte lokale Wiederherstellung
                      </option>
                    </select>
                  </label>
                  {content.recovery === "extended" && (
                    <p>
                      Andere Gruppen am Gerät können einen lokalen Stand
                      auswählen. Nur mit schulischer Freigabe nutzen. Gültig für
                      drei Stunden ab der letzten Speicherung. Abgelaufene
                      Stände werden beim nächsten Zugriff entfernt.
                    </p>
                  )}
                </>
              }
              content={content}
              onChange={(next) => change(next)}
              onStartLayout={(layout) =>
                applyDraft((current) =>
                  layout.mode === "explicit" && studentView
                    ? moveBoard(current, preview?.cards ?? [])
                    : setStudentStart(
                        current,
                        layout,
                        privateView
                          ? (preview?.cards ?? [])
                          : (initialPreview?.cards ?? []),
                      ),
                )
              }
              onClose={() => setDesignOpen(false)}
              onHelp={() => setHelpEditing(true)}
            />
          </>
        ) : (
          <section className="studio-pinboard" aria-label="Autorenpinnwand">
            {error && <p role="alert">{error}</p>}
            {fileError && <p role="alert">{fileError}</p>}
            {importNotice && (
              <div className="studio-board-notice">
                <span role="status">{importNotice}</span>
                <button
                  aria-label="Importmeldung schließen"
                  onClick={() => setImportNotice("")}
                >
                  ×
                </button>
              </div>
            )}
            <div
              className="studio-board-tools"
              role="group"
              aria-label="Pinnwand-Werkzeuge"
            >
              <div
                role="group"
                aria-label="Pinnwandansicht"
                className="studio-view-switch"
              >
                {[false, true].map((priv) => (
                  <button
                    key={String(priv)}
                    aria-pressed={privateView === priv}
                    onClick={() => {
                      setPrivateView(priv);
                      stopConnecting();
                      setFitTick((t) => t + 1);
                    }}
                  >
                    {priv ? "Musterlösung (privat)" : "Schülerstart"}
                    {priv && !!privateEdges?.length && (
                      <small> · {privateEdges.length}</small>
                    )}
                  </button>
                ))}
              </div>
              {preview && (
                <>
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
                  <div
                    className="studio-zoom-tools"
                    role="group"
                    aria-label="Zoomsteuerung"
                  >
                    <button
                      aria-label="Pinnwand verkleinern"
                      onClick={() => setZoomCommand({ factor: 0.8 })}
                    >
                      −
                    </button>
                    <button
                      aria-label="Pinnwand vergrößern"
                      onClick={() => setZoomCommand({ factor: 1.25 })}
                    >
                      +
                    </button>
                  </div>
                  <button
                    aria-pressed={boardFocused}
                    onClick={() => setBoardFocused((value) => !value)}
                  >
                    {boardFocused
                      ? "Fokusmodus beenden"
                      : "Pinnwand maximieren"}
                  </button>
                </>
              )}
              <button
                className="studio-board-help-button"
                onClick={() => setBoardHelp(true)}
              >
                Pinnwand-Hilfe
              </button>
              <details className="studio-board-actions">
                <summary>Pinnwandaktionen</summary>
                <div>
                  <button
                    disabled={
                      !(privateView
                        ? privateEdges?.length
                        : content.initial.edges.length)
                    }
                    onClick={() => boardAction(true)}
                  >
                    Sämtliche Verbindungen löschen
                  </button>
                  <button
                    disabled={!preview?.cards.length}
                    onClick={() => boardAction(false)}
                  >
                    Kartenanordnung nach Nummern
                  </button>
                  {undoClear?.after === draft && (
                    <button
                      onClick={() => {
                        applyDraft(() => undoClear.before);
                        setUndoClear(undefined);
                      }}
                    >
                      Löschen rückgängig
                    </button>
                  )}
                </div>
              </details>
              <span className="small studio-card-count">
                {boardContent.cards.length} Karten
              </span>
            </div>
            {connectingCards && (
              <p role="status" className="studio-edge-hint">
                {connectionFrom === null
                  ? "Erste Karte oder vorhandene Verbindung auswählen."
                  : `Karte ${cardNumber(boardContent, displayId(connectionFrom))} gewählt. Jetzt die zweite Karte auswählen.`}
              </p>
            )}
            {preview ? (
              <div className="studio-board">
                <Board
                  key={privateView ? "private" : "public"}
                  cardLayouts={cardLayouts}
                  badgeScaleLimit={studentView ? 7 : 2}
                  work={preview}
                  mystery={boardContent}
                  authorBoard
                  selectingCards={connectingCards}
                  privateEdges={privateEdgeIds}
                  onChange={(work) =>
                    applyDraft((current) => moveBoard(current, work.cards))
                  }
                  onCard={(id) => selectBoardCard(internalId(id))}
                  onEdge={(id) => {
                    const edge = authorEdges(draft).find(
                      (item) => item.id === id,
                    );
                    if (edge) openEdge(edge);
                  }}
                  fitTick={fitTick}
                  zoomCommand={zoomCommand}
                  connecting={
                    connectionFrom === null ? null : displayId(connectionFrom)
                  }
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
            <button disabled={fileBusy} onClick={() => void chooseMaterial()}>
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
            <button onClick={preparePublication}>Aufgabe als PNG</button>
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
                  {cardNumber(boardContent, displayId(edgeForm.edge.from))} →{" "}
                  {cardNumber(boardContent, displayId(edgeForm.edge.to))}
                </option>
                <option value="2">
                  {cardNumber(boardContent, displayId(edgeForm.edge.to))} →{" "}
                  {cardNumber(boardContent, displayId(edgeForm.edge.from))}
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
      {boardHelp && (
        <Dialog title="Pinnwand-Hilfe" onClose={() => setBoardHelp(false)}>
          <p>
            Klicke auf eine Karte zum Bearbeiten oder ziehe sie an einen neuen
            Platz. „Groß ansehen“ öffnet die Leseansicht.
          </p>
          <p>
            Vergrößere die Pinnwand mit Trackpad, Mausrad oder den Zoomtasten.
            „Alle Karten anzeigen“ stellt die Übersicht wieder her.
          </p>
          <p>
            Gestrichelte braune Verbindungen sind intern. Freigegebene
            Verbindungen erscheinen als Starthilfen. Im Schülerstart bearbeitest
            du die sichtbaren Startpositionen direkt. In der Musterlösung
            ordnest du Karten privat an.
          </p>
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
              {integration && (
                <label className="author-student-editable">
                  <input
                    type="checkbox"
                    checked={!!card.studentEditable}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        studentEditable: e.target.checked ? true : undefined,
                      })
                    }
                  />
                  Lernende dürfen Überschrift und Text dieser Karte bearbeiten.
                </label>
              )}
              {integration && (
                <fieldset className="studio-card-colors">
                  <legend>Kartenfarbe</legend>
                  <div className="studio-color-controls">
                    <button
                      type="button"
                      aria-pressed={!card.backgroundColor}
                      onClick={() =>
                        setCard({ ...card, backgroundColor: undefined })
                      }
                    >
                      Standardfarbe
                    </button>
                    {COLORS.slice(1).map((color, index) => (
                      <button
                        type="button"
                        key={color}
                        aria-label={COLOR_NAMES[index + 1]}
                        aria-pressed={card.backgroundColor === color}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setCard({ ...card, backgroundColor: color })
                        }
                      >
                        {COLOR_NAMES[index + 1]}
                      </button>
                    ))}
                    <label>
                      Eigene Farbe
                      <input
                        type="color"
                        value={
                          card.backgroundColor ?? designOf(content).cardColor
                        }
                        onChange={(event) =>
                          setCard({
                            ...card,
                            backgroundColor: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div
                    className="studio-card-color-preview"
                    style={(() => {
                      const appearance = cardAppearance(
                        card,
                        designOf(content),
                      );
                      return {
                        backgroundColor: appearance.background,
                        color: appearance.text,
                      };
                    })()}
                  >
                    <strong>{card.title || "Kartenüberschrift"}</strong>
                    {card.text && <span>{card.text}</span>}
                  </div>
                </fieldset>
              )}
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
              <div className="actions studio-card-actions">
                <button className="primary" disabled={busy} type="submit">
                  Karte übernehmen
                </button>
                {integration &&
                  content.cards.some((entry) => entry.id === card.id) && (
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (remove(card.id)) {
                          setCard(null);
                          setFitTick((tick) => tick + 1);
                        }
                      }}
                    >
                      Karte löschen
                    </button>
                  )}
              </div>
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
            setConfirmedTaskHash(null);
            setPng(null);
          }}
        >
          {publishedTask && needsConfirmation && (
            <section
              className="author-publication-edges"
              aria-label="Starthilfen kontrollieren"
            >
              <p>
                <strong>
                  Dieses Mystery enthält bereits vorgegebene Verbindungen für
                  Lernende.
                </strong>
              </p>
              <p>Starthilfen für Lernende ({sharedEdges.length})</p>
              <ul>
                {sharedEdges.map((edge) => (
                  <li key={edge.id}>
                    {cardNumber(
                      publishedTask.content,
                      edge.direction === 2 ? edge.to : edge.from,
                    )}
                    {edge.direction ? " → " : " – "}
                    {cardNumber(
                      publishedTask.content,
                      edge.direction === 2 ? edge.from : edge.to,
                    )}
                    {edge.direction === 0 && " (ohne Pfeil)"}
                    {edge.label && `: ${edge.label}`}
                  </li>
                ))}
              </ul>
              <label className="author-publication-confirmation">
                <input
                  type="checkbox"
                  checked={exportConfirmed}
                  disabled={busy}
                  onChange={(event) =>
                    setConfirmedTaskHash(
                      event.target.checked ? publishedTask.contentHash : null,
                    )
                  }
                />
                Ich habe die vorgegebenen Verbindungen geprüft und möchte sie an
                die Lernenden weitergeben.
              </label>
            </section>
          )}
          {publishedTask &&
            content.initial.edges.length > sharedEdges.length && (
              <p className="small">
                Starthilfen zu ausgeblendeten Karten werden ausgelassen.
              </p>
            )}
          {integration ? (
            <div className="studio-export-choices">
              {integration.exportLevels && (
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await integration.exportLevels!(draft);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Alle Niveaus für itslearning exportieren
                </button>
              )}
              <button
                className={
                  integration.exportLevels
                    ? "studio-export-option"
                    : "studio-export-option primary"
                }
                aria-label="Für itslearning exportieren"
                disabled={busy || !publishedTask || !exportConfirmed}
                onClick={() => void exportScorm()}
              >
                <strong>Für itslearning exportieren</strong>
                <span>Digitale Schüleraufgabe</span>
                <small>SCORM 1.2 · ZIP</small>
              </button>

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
                className="studio-export-secondary"
                disabled={busy || !publishedTask}
                onClick={() => {
                  if (publishedTask && draftRef.current === draft)
                    integration.preview(publishedTask);
                }}
              >
                Schüleransicht prüfen
              </button>
              <button
                className="studio-export-option"
                aria-label="Als Bild exportieren"
                disabled={busy || !publishedTask || !exportConfirmed}
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
                disabled={busy || !publishedTask || !exportConfirmed}
                onClick={() => {
                  try {
                    const { task } = confirmedPublication();
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
                disabled={busy || !publishedTask || !exportConfirmed}
                onClick={() => void exportScorm()}
              >
                {integration
                  ? "Als SCORM für itslearning exportieren"
                  : "Für itslearning als SCORM herunterladen"}
              </button>
              <button
                className="full"
                disabled={busy || !publishedTask || !exportConfirmed}
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
            onClick={() => void chooseMaterial()}
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
