import type {
  PendingText,
  Snapshot,
  Writer,
  CameraView,
} from "../studio/player/recovery";
import { CardReading } from "./components/CardReading";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  COLOR_NAMES,
  COLORS,
  MAX_CARD_TEXT,
  MAX_CARD_TITLE,
  MAX_EDGES,
  MAX_LABEL,
  MAX_TEAM_NAME,
  cardNumber,
  nextEdgeId,
  teamName,
  withTeam,
  validCardText,
  type CardText,
  type Edge,
  type Work,
  type Mystery,
} from "./core/model";
import { fromQr } from "./core/codec";
import { MAX_PNG_BYTES, restorePng } from "./core/png";
import { exportBoard, type ExportMode } from "./core/export";
import { backupFilename } from "./core/filenames";
import { Board } from "./components/Board";
import { Dialog } from "./components/Dialog";
import { Camera } from "./components/Camera";
import { emptyHistory, hasChanges, historyReducer } from "./core/history";
import {
  CARD_WIDTH,
  initialBoardWork,
  makeLayouts,
  overlappingTextCards,
} from "./core/layout";
import { withStudentCards, withStudentText } from "./core/student-text";
import { LearningHelp } from "./components/LearningHelp";
import { PrintPreview } from "./components/PrintPreview";
import { MediaView } from "./components/MediaView";
import { TableView } from "./components/TableView";
type Modal =
  | "resume"
  | "camera"
  | "save"
  | "help"
  | "menu"
  | "team"
  | "print"
  | "instructions"
  | "overlap"
  | null;
type Saved = { url: string; file: File; qr: boolean; mode: ExportMode };
const requireTeam = (work: Work, name: string): Work => {
  const named = withTeam(work, name);
  if (!teamName(named))
    throw new Error("Bitte gebt eine Teambezeichnung oder Vornamen ein.");
  return named;
};
export default function App({
  mystery,
  loadedWork,
  studentExport = false,
  levelName,
  writer,
  restored,
  onSwitch,
  onForget,
  backupPayload,
  onImport,
  onHome,
  onAuthor,
  initialHelpOpen = false,
  mode = "student",
}: {
  mystery: Mystery & { subtitle?: string; instructions?: string };
  loadedWork?: Work;
  studentExport?: boolean;
  levelName?: string;
  writer?: Writer;
  restored?: Snapshot;
  onSwitch?: () => void;
  onForget?: () => Promise<void>;
  backupPayload?: (work: Work) => Uint8Array;
  onImport?: () => void;
  onHome?: () => void;
  onAuthor?: () => void;
  initialHelpOpen?: boolean;
  mode?: "student" | "preview";
}) {
  const previewMode = mode === "preview";
  const [history, dispatch] = useReducer(
    historyReducer,
    loadedWork,
    (initial) =>
      initial
        ? historyReducer(emptyHistory, { type: "load", work: initial })
        : emptyHistory,
  );
  const work = history.present,
    dirty = hasChanges(history);
  const edits = work?.textEdits;
  const displayed = useMemo(
    () => withStudentCards(mystery, edits),
    [mystery, edits],
  );
  const cardLayouts = useMemo(
    () => makeLayouts(displayed, "preview"),
    [displayed],
  );
  const overlaps = useMemo(
    () => (work ? overlappingTextCards(work, cardLayouts) : []),
    [cardLayouts, work],
  );
  const [modal, setModal] = useState<Modal>(null);
  const [helpOpen, setHelpOpen] = useState(initialHelpOpen),
    [orientation, setOrientation] = useState(false),
    [wideToolbar, setWideToolbar] = useState(
      () => matchMedia("(min-width: 1100px)").matches,
    );
  const [startTeam, setStartTeam] = useState(""),
    [teamDraft, setTeamDraft] = useState(""),
    [teamError, setTeamError] = useState("");
  const [card, setCard] = useState<number | null>(
      restored?.pending?.id ?? restored?.openCard ?? null,
    ),
    [edge, setEdge] = useState<Edge | null>(null),
    [connecting, setConnecting] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState<CardText | null>(
    restored?.pending ?? null,
  );
  const [draftWarning, setDraftWarning] = useState(false);
  const selected = displayed.cards.find((c) => c.id === card);
  const published = mystery.cards.find((c) => c.id === card);
  const pendingText =
    !!textDraft &&
    selected &&
    (textDraft.title !== selected.title || textDraft.text !== selected.text);
  const [fitTick, setFitTick] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<Saved | null>(null);
  const input = useRef<HTMLInputElement>(null),
    startTeamInput = useRef<HTMLInputElement>(null),
    teamInput = useRef<HTMLInputElement>(null),
    pendingExport = useRef<ExportMode | "print" | null>(null),
    operation = useRef(0),
    exportRunning = useRef<Promise<void> | null>(null);
  const [storageStatus, setStorageStatus] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState(!!restored);
  const view = useRef<CameraView | undefined>(restored?.view);
  const saveViewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const persist = useRef<(() => void) | undefined>(undefined);
  const flushView = () => {
    if (saveViewTimer.current === undefined) return;
    clearTimeout(saveViewTimer.current);
    saveViewTimer.current = undefined;
    persist.current?.();
  };
  useLayoutEffect(() => {
    if (!writer || !work) return;
    let live = true;
    const pending =
      textDraft && card !== null
        ? { id: card, title: textDraft.title, text: textDraft.text }
        : undefined;
    const save = () => {
      clearTimeout(saveViewTimer.current);
      saveViewTimer.current = undefined;
      setStorageStatus("Wird gespeichert …");
      const promise = writer.write(
        work,
        pending,
        view.current,
        card ?? undefined,
      );
      const revision = writer.revision;
      promise.then(
        (status) => {
          if (live && revision === writer.revision) setStorageStatus(status);
        },
        () => {
          if (live && revision === writer.revision)
            setStorageStatus(
              "Automatische Speicherung nicht verfügbar. Bitte eine PNG exportieren.",
            );
        },
      );
    };
    persist.current = save;
    save();
    window.addEventListener("pagehide", flushView);
    return () => {
      live = false;
      clearTimeout(saveViewTimer.current);
      saveViewTimer.current = undefined;
      persist.current = undefined;
      window.removeEventListener("pagehide", flushView);
    };
  }, [writer, work, card, textDraft]);
  useEffect(() => {
    if (!recoveryNotice) return;
    const timer = setTimeout(() => setRecoveryNotice(false), 5000);
    return () => clearTimeout(timer);
  }, [recoveryNotice]);
  const commit = (next: Work) => dispatch({ type: "edit", work: next });
  const close = () => {
    operation.current++;
    pendingExport.current = null;
    setModal(null);
    setCard(null);
    setTextDraft(null);
    setDraftWarning(false);
    setEdge(null);
    setMessage("");
    setTeamError("");
    setSaved(null);
    setBusy(false);
    setHelpOpen(false);
  };
  const closeCard = () => {
    if (pendingText) {
      setDraftWarning(true);
      return;
    }
    close();
  };
  const openHelp = () => {
    close();
    setConnecting(null);
    setHelpOpen(true);
  };
  useEffect(() => {
    const media = matchMedia("(min-width: 1100px)");
    const update = () => setWideToolbar(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (modal || card !== null || edge !== null) setHelpOpen(false);
  }, [modal, card, edge]);
  useEffect(() => {
    if (modal === "team") teamInput.current?.focus();
  }, [modal]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      flushView();
      const unfinished =
        (modal === "team" && teamDraft !== teamName(work!)) ||
        (edge &&
          !work?.edges.some(
            (e) =>
              e.id === edge.id &&
              e.label === edge.label &&
              e.direction === edge.direction,
          ));
      if (
        !previewMode &&
        (unfinished ||
          ((dirty || pendingText || (work && writer)) && !writer?.isSaved))
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty, pendingText, previewMode, writer, modal, teamDraft, edge, work]);
  useEffect(
    () => () => {
      if (saved) URL.revokeObjectURL(saved.url);
    },
    [saved],
  );
  const accept = (next: Work) => {
    setOrientation(false);
    dispatch({ type: "load", work: next });
    setConnecting(null);
    setFitTick((t) => t + 1);
    close();
  };
  const choose = () => {
    if (previewMode) return;
    input.current!.value = "";
    input.current!.click();
  };
  const importFile = async (file: File) => {
    if (previewMode) return;
    const id = ++operation.current;
    setBusy(true);
    setMessage("Das Sicherungsbild wird gelesen …");
    try {
      if (file.size > MAX_PNG_BYTES)
        throw new Error(
          "Dieses Bild ist zu groß. Wähle eine Original-Sicherungsdatei mit höchstens 30 MB.",
        );
      const next = restorePng(
        new Uint8Array(await file.arrayBuffer()),
        mystery,
      );
      if (id === operation.current) accept(next);
    } catch (e) {
      if (id === operation.current)
        setMessage(
          e instanceof Error
            ? e.message
            : "Das Bild konnte nicht gelesen werden.",
        );
    } finally {
      if (id === operation.current) setBusy(false);
    }
  };
  const scan = (text: string) => {
    if (previewMode) return false;
    try {
      const next = fromQr(text, mystery);
      accept(next);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    }
  };
  const save = async (mode: ExportMode = "a3", snapshot = work) => {
    if (previewMode || !snapshot) return;
    const id = ++operation.current;
    setSaved(null);
    setTeamError("");
    // All student export paths pass this gate, including legacy loads and undo.
    // The low-level codec continues to accept valid teamless legacy states.
    try {
      requireTeam(snapshot, teamName(snapshot));
    } catch {
      pendingExport.current = mode;
      setTeamDraft(teamName(snapshot));
      setMessage(
        "Ergänzt vor dem Sichern eure Teambezeichnung oder Vornamen. Eine Gruppenbezeichnung genügt.",
      );
      setBusy(false);
      setModal("team");
      return;
    }
    pendingExport.current = null;
    setModal("save");
    setBusy(true);
    setMessage("Das Sicherungsbild wird vorbereitet …");
    // A canceled Canvas encoding cannot be interrupted. Wait for its release;
    // only the most recent still-open request may render the next snapshot.
    if (exportRunning.current) {
      setMessage(
        "Der vorherige Bildvorgang wird beendet. Danach wird euer aktuelles Sicherungsbild erstellt …",
      );
      await exportRunning.current;
      if (id !== operation.current) return;
      setMessage("Das Sicherungsbild wird vorbereitet …");
    }
    let finishExport!: () => void;
    exportRunning.current = new Promise<void>((resolve) => {
      finishExport = resolve;
    });
    // Give the browser a frame to paint the progress message before rendering.
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    try {
      if (id !== operation.current) return;
      let result;
      try {
        result = await exportBoard(
          snapshot,
          mystery,
          mode,
          backupPayload?.(snapshot),
          "preview",
        );
      } catch (e) {
        if (id !== operation.current) return;
        if (mode === "compact") throw e;
        result = await exportBoard(
          snapshot,
          mystery,
          "compact",
          backupPayload?.(snapshot),
          "preview",
        );
      }
      if (id !== operation.current) return;
      const file = new File(
        [result.blob],
        backupFilename(teamName(snapshot), mystery.title),
        { type: "image/png" },
      );
      setSaved({
        url: URL.createObjectURL(result.blob),
        file,
        qr: !!result.qr,
        mode: result.mode,
      });
      setMessage(
        studentExport
          ? ""
          : result.qr
            ? "Das Bild enthält euren vollständigen Arbeitsstand und einen Code zum Fortsetzen."
            : "Der Arbeitsstand ist zu groß für einen Code. Zum Fortsetzen benötigt ihr die unveränderte Originaldatei.",
      );
    } catch (e) {
      if (id === operation.current)
        setMessage(
          `Es konnte kein Sicherungsbild erstellt werden. ${(e as Error).message} Euer geöffneter Arbeitsstand bleibt erhalten. Versucht es erneut oder verwendet ein anderes Gerät.`,
        );
    } finally {
      exportRunning.current = null;
      finishExport();
      if (id === operation.current) setBusy(false);
    }
  };
  const selectCard = (id: number) => {
    if (connecting !== null && work) {
      if (id === connecting) {
        setConnecting(null);
        return;
      }
      const existing = work.edges.find(
        (e) =>
          (e.from === connecting && e.to === id) ||
          (e.to === connecting && e.from === id),
      );
      if (existing) {
        setEdge({ ...existing });
        setConnecting(null);
        return;
      }
      if (work.edges.length >= MAX_EDGES) {
        setMessage(
          "Es sind bereits sehr viele Verbindungen vorhanden. Entferne zuerst eine Verbindung.",
        );
        setConnecting(null);
        return;
      }
      setEdge({
        id: nextEdgeId(work.edges),
        from: connecting,
        to: id,
        direction: mystery.design?.direction ?? 1,
        label: "",
      });
      setConnecting(null);
    } else setCard(id);
  };
  const openPrint = () => {
    if (previewMode || !work) return;
    if (!teamName(work)) {
      pendingExport.current = "print";
      setTeamDraft("");
      setTeamError("");
      setMessage(
        "Ergänzt vor der Druckfassung eure Teambezeichnung oder Vornamen. Eine Gruppenbezeichnung genügt.",
      );
      setModal("team");
      return;
    }
    setMessage("");
    setModal("print");
  };
  const cardContent = selected,
    cardState = work?.cards.find((c) => c.id === card);
  return (
    <main className={work ? "workspace" : undefined}>
      {!previewMode && (
        <input
          ref={input}
          type="file"
          accept="image/png,.png"
          hidden
          aria-label="Sicherungsbild"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      )}
      {work ? (
        <>
          <header className="toolbar">
            <span className="brand">MysteryBoard</span>
            <nav aria-label="Arbeitsfläche bedienen">
              <button onClick={() => setFitTick((t) => t + 1)}>
                Übersicht
              </button>
              {mystery.instructions && (
                <button onClick={() => setModal("instructions")}>
                  Aufgabe
                </button>
              )}
              <button
                aria-label="Rückgängig"
                disabled={!history.past.length}
                onClick={() => dispatch({ type: "undo" })}
              >
                <span className="history-label">Rückgängig</span>
                <span className="history-symbol" aria-hidden="true">
                  ↶
                </span>
              </button>
              <button
                aria-label="Wiederholen"
                disabled={!history.future.length}
                onClick={() => dispatch({ type: "redo" })}
              >
                <span className="history-label">Wiederholen</span>
                <span className="history-symbol" aria-hidden="true">
                  ↷
                </span>
              </button>
              {!previewMode && (
                <button className="primary" onClick={() => void save()}>
                  {studentExport ? "Export" : "Sichern"}
                </button>
              )}
              {(studentExport || wideToolbar || previewMode) && (
                <button
                  className="icon-button"
                  aria-label="Hilfe"
                  aria-describedby="orientation-state"
                  data-orientation-active={orientation}
                  aria-expanded={helpOpen}
                  title={
                    orientation ? "Hilfe · Orientierung eingeschaltet" : "Hilfe"
                  }
                  onClick={openHelp}
                >
                  ?
                  {orientation && (
                    <span className="help-active-mark" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              )}
              {!previewMode && (
                <button
                  className="icon-button"
                  aria-label="Menü"
                  onClick={() => setModal("menu")}
                >
                  ⋯
                </button>
              )}
            </nav>
            {teamName(work) && (
              <span
                className="team-summary"
                aria-label={`Team: ${teamName(work)}`}
              >
                {levelName && (
                  <span className="active-level">{levelName} · </span>
                )}
                {teamName(work)}
              </span>
            )}
          </header>
          <span id="orientation-state" className="sr-only">
            {orientation
              ? "Orientierungshilfe eingeschaltet."
              : "Orientierungshilfe ausgeschaltet."}
          </span>
          {__PLAYER_BUILD__ && (
            <p className="player-board-hint">
              Tippe auf eine Karte, um sie groß zu lesen. Mit zwei Fingern
              kannst du die Pinnwand vergrößern.
            </p>
          )}
          <Board
            work={work}
            mystery={displayed}
            cardLayouts={cardLayouts}
            initialView={restored?.view}
            onView={
              writer
                ? (next) => {
                    view.current = next;
                    clearTimeout(saveViewTimer.current);
                    saveViewTimer.current = setTimeout(flushView, 120);
                  }
                : undefined
            }
            onChange={commit}
            gestureSession={__PLAYER_BUILD__ ? history.gestureSession : null}
            onMoveCard={
              __PLAYER_BUILD__
                ? (move, session) =>
                    dispatch({ type: "move-card", move, session })
                : undefined
            }
            onCard={selectCard}
            onEdge={(id) => {
              if (connecting === null)
                setEdge({ ...work.edges.find((e) => e.id === id)! });
            }}
            fitTick={fitTick}
            connecting={connecting}
            orientation={orientation}
          />
          {!!overlaps.length &&
            !modal &&
            card === null &&
            !edge &&
            connecting === null &&
            !message && (
              <div className="student-overlap">
                <button onClick={() => setModal("overlap")}>
                  Überlagerte Karten anzeigen
                </button>
              </div>
            )}
          {helpOpen && (
            <LearningHelp
              mystery={mystery}
              active={orientation}
              onToggle={() => setOrientation((v) => !v)}
              onClose={() => setHelpOpen(false)}
            />
          )}
          {connecting !== null && (
            <div className="connection-prompt" role="status">
              Mit {cardNumber(mystery, connecting)} verbinden: Tippe eine zweite
              Karte an.
              <button onClick={() => setConnecting(null)}>Abbrechen</button>
            </div>
          )}
          {writer && (
            <small className="recovery-status" role="status">
              {recoveryNotice
                ? "Euer Arbeitsstand wurde wiederhergestellt. "
                : ""}
              {storageStatus}
            </small>
          )}
          {message && !modal && !card && !edge && (
            <div className="notice" role="status">
              {message}
              <button onClick={() => setMessage("")}>Schließen</button>
            </div>
          )}
        </>
      ) : (
        <section className="welcome">
          {!studentExport && (
            <div className="wordmark">
              <span aria-hidden="true">▦</span> MysteryBoard
            </div>
          )}
          <h1>{mystery.title}</h1>
          {levelName && <p>{levelName}</p>}
          {mystery.subtitle && <p>{mystery.subtitle}</p>}
          {mystery.instructions && (
            <details className="student-instructions">
              <summary>Aufgabenstellung</summary>
              <p>{mystery.instructions}</p>
            </details>
          )}
          {!studentExport && (
            <>
              <p>
                Verschiebt die Karten, verbindet eure Gedanken
                <br className="wide-only" /> und haltet euren gemeinsamen Stand
                fest.
              </p>
              <p className="number-guidance">
                Die Kartennummern helfen euch beim Wiederfinden. Sie geben keine
                richtige Reihenfolge vor.
              </p>
            </>
          )}
          <label className="team-input">
            {studentExport ? "Gruppenname" : "Teamname oder Vornamen"}
            <input
              ref={startTeamInput}
              value={startTeam}
              onChange={(e) => {
                setStartTeam(e.target.value);
                setTeamError("");
              }}
              aria-required="true"
              aria-invalid={!!teamError}
              aria-describedby={teamError ? "start-team-error" : undefined}
              maxLength={MAX_TEAM_NAME}
              autoComplete="off"
              placeholder="Eine Gruppenbezeichnung genügt"
            />
          </label>
          {teamError && (
            <p id="start-team-error" className="status" role="alert">
              {teamError}
            </p>
          )}
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                const initial = initialBoardWork(
                  mystery,
                  {
                    width: window.innerWidth,
                    height: Math.max(1, window.innerHeight - 74),
                  },
                  undefined,
                  "preview",
                );
                try {
                  const named = requireTeam(initial, startTeam);
                  accept(initial);
                  // A newly entered team is unsaved work, unlike a loaded PNG.
                  commit(named);
                } catch (error) {
                  setTeamError((error as Error).message);
                  startTeamInput.current?.focus();
                }
              }}
            >
              Beginnen
            </button>
            <button
              onClick={() => (onImport ? onImport() : setModal("resume"))}
            >
              {studentExport ? "Original-PNG öffnen" : "Fortsetzen"}
            </button>
            {!__PLAYER_BUILD__ && onHome && (
              <button onClick={onHome}>Zur universellen Startseite</button>
            )}
            {!__PLAYER_BUILD__ && onAuthor && (
              <button onClick={onAuthor}>
                Lehrkräftemodus – Mystery bearbeiten
              </button>
            )}
          </div>
          {message && (
            <p className="status" role="alert">
              {message}
            </p>
          )}
          <p className="small">
            Euer Arbeitsstand bleibt bei euch.
            <br />
            Sichert ihn als Bild, bevor ihr die Seite schließt.
          </p>
        </section>
      )}
      {modal === "instructions" && (
        <Dialog title="Aufgabenstellung" onClose={close}>
          <p className="student-instructions-text">{mystery.instructions}</p>
        </Dialog>
      )}
      {modal === "overlap" && (
        <Dialog title="Überlagerte Karten" onClose={close}>
          <p>
            Längere Karten können andere Karten verdecken. Öffnet sie hier oder
            verschiebt sie auf der Pinnwand.
          </p>
          <div className="menu-list">
            {overlaps.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setModal(null);
                  setCard(id);
                }}
              >
                Karte {cardNumber(mystery, id)}
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {cardContent && cardState && work && (
        <Dialog
          title={`Karte ${cardNumber(mystery, card!)}`}
          onClose={closeCard}
        >
          {published?.studentEditable && textDraft ? (
            <form
              className="student-text-edit"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validCardText(textDraft)) return;
                commit(withStudentText(work, published, textDraft));
                setTextDraft(null);
                setDraftWarning(false);
              }}
            >
              {draftWarning && (
                <p role="alert">
                  Eure Eingaben sind noch offen. Übernehmt die Änderungen oder
                  brecht die Bearbeitung ab.
                </p>
              )}
              <div className="student-text-field">
                <label htmlFor="student-card-title">Kartenüberschrift</label>
                <input
                  id="student-card-title"
                  maxLength={MAX_CARD_TITLE}
                  placeholder="Eine kurze Überschrift"
                  value={textDraft.title}
                  onChange={(e) =>
                    setTextDraft({ ...textDraft, title: e.target.value })
                  }
                />
              </div>
              <div className="student-text-field">
                <label htmlFor="student-card-text">Kartentext</label>
                <textarea
                  id="student-card-text"
                  rows={6}
                  maxLength={MAX_CARD_TEXT}
                  placeholder="Schreibt hier eure Beobachtungen oder Erklärung."
                  value={textDraft.text}
                  onChange={(e) =>
                    setTextDraft({ ...textDraft, text: e.target.value })
                  }
                />
              </div>
              <p className="small">
                {restored?.pending?.id === card &&
                  "Wiederhergestellter Entwurf. "}
                Übernehmt die Eingaben und sichert euren Arbeitsstand
                anschließend als Original-PNG.
              </p>
              <div className="actions">
                <button type="submit" className="primary">
                  Änderungen übernehmen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextDraft(null);
                    setDraftWarning(false);
                  }}
                >
                  Bearbeitung abbrechen
                </button>
              </div>
            </form>
          ) : (
            <>
              {cardContent.group && (
                <p className="small card-group">
                  {mystery.cardGroups![cardContent.group].label}
                </p>
              )}
              {published?.studentEditable && (
                <div className="student-text-actions actions">
                  <button
                    onClick={() =>
                      setTextDraft({
                        title: cardContent.title,
                        text: cardContent.text,
                      })
                    }
                  >
                    Text bearbeiten
                  </button>
                  {edits?.some((edit) => edit.id === published.id) && (
                    <button
                      onClick={() =>
                        commit(withStudentText(work, published, published))
                      }
                    >
                      Ursprünglichen Text wiederherstellen
                    </button>
                  )}
                </div>
              )}
              {overlaps.includes(cardState.id) &&
                edits?.some((edit) => edit.id === cardState.id) &&
                (() => {
                  const right =
                    Math.ceil(Math.max(...work.cards.map((c) => c.x))) +
                    CARD_WIDTH +
                    24;
                  const left =
                    Math.floor(Math.min(...work.cards.map((c) => c.x))) -
                    CARD_WIDTH -
                    24;
                  const x = right <= 100000 ? right : left;
                  return (
                    <div className="student-text-overlap">
                      <p className="small">
                        Diese Karte überschneidet sich mit anderen Karten.
                      </p>
                      {x >= -100000 && (
                        <button
                          onClick={() => {
                            commit({
                              ...work,
                              cards: work.cards.map((c) =>
                                c.id === cardState.id ? { ...c, x } : c,
                              ),
                            });
                            setFitTick((tick) => tick + 1);
                          }}
                        >
                          Diese Karte neben die anderen setzen
                        </button>
                      )}
                    </div>
                  );
                })()}
              <CardReading
                card={cardContent}
                design={mystery.design}
                mark={cardState.color ? COLORS[cardState.color] : undefined}
              />
              <fieldset>
                <legend>Farbe</legend>
                <div className="colors">
                  {COLORS.map((color, i) => (
                    <button
                      key={color}
                      className={cardState.color === i ? "chosen" : ""}
                      style={{ background: color }}
                      aria-label={COLOR_NAMES[i]}
                      aria-pressed={cardState.color === i}
                      onClick={() =>
                        commit({
                          ...work,
                          cards: work.cards.map((c) =>
                            c.id === card ? { ...c, color: i } : c,
                          ),
                        })
                      }
                    >
                      {cardState.color === i ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </fieldset>
              {cardState.color !== 0 && (
                <label className="category-name">
                  Name für diese Farbe <span>(freiwillig)</span>
                  <input
                    key={cardState.color}
                    maxLength={40}
                    defaultValue={work.categories[cardState.color]}
                    placeholder="Eigener Name"
                    onBlur={(e) =>
                      commit({
                        ...work,
                        categories: work.categories.map((c, i) =>
                          i === cardState.color ? e.target.value : c,
                        ),
                      })
                    }
                  />
                </label>
              )}
              <button
                className="primary full"
                onClick={() => {
                  setConnecting(card);
                  setCard(null);
                }}
              >
                Mit einer Karte verbinden
              </button>
            </>
          )}
        </Dialog>
      )}
      {edge && work && (
        <Dialog
          title={`Verbindung ${cardNumber(mystery, edge.from)} und ${cardNumber(mystery, edge.to)}`}
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit({
                ...work,
                edges: [
                  ...work.edges.filter((x) => x.id !== edge.id),
                  edge,
                ].sort((a, b) => a.id - b.id),
              });
              setEdge(null);
            }}
          >
            <label>
              Beschriftung <span>(freiwillig)</span>
              <textarea
                maxLength={MAX_LABEL}
                value={edge.label}
                onChange={(e) => setEdge({ ...edge, label: e.target.value })}
                rows={4}
              />
            </label>
            <label>
              Richtung
              <select
                value={edge.direction}
                onChange={(e) =>
                  setEdge({
                    ...edge,
                    direction: Number(e.target.value) as 0 | 1 | 2,
                  })
                }
              >
                <option value="0">Ohne Pfeil</option>
                <option value="1">
                  {cardNumber(mystery, edge.from)} →{" "}
                  {cardNumber(mystery, edge.to)}
                </option>
                <option value="2">
                  {cardNumber(mystery, edge.to)} →{" "}
                  {cardNumber(mystery, edge.from)}
                </option>
              </select>
            </label>
            <div className="actions">
              <button className="primary" type="submit">
                Übernehmen
              </button>
              {work.edges.some((e) => e.id === edge.id) && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    commit({
                      ...work,
                      edges: work.edges.filter((e) => e.id !== edge.id),
                    });
                    setEdge(null);
                  }}
                >
                  Verbindung löschen
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
      {!previewMode && modal === "menu" && (
        <Dialog title="Menü" onClose={close}>
          {teamName(work) && (
            <p className="menu-team">Team: {teamName(work)}</p>
          )}
          <div className="menu-list">
            <button
              onClick={openHelp}
              aria-label="Hilfe"
              aria-describedby="orientation-state"
              data-orientation-active={orientation}
            >
              Hilfe
              {orientation && (
                <span className="help-active-label" aria-hidden="true">
                  ✓ Orientierung an
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTeamDraft(teamName(work!));
                setMessage("");
                setTeamError("");
                pendingExport.current = null;
                setModal("team");
              }}
            >
              {studentExport ? "Gruppenname ändern" : "Teamname ändern"}
            </button>
            <button
              onClick={() => {
                if (onImport) {
                  close();
                  onImport();
                  return;
                }
                setMessage("");
                setModal("resume");
              }}
            >
              {studentExport ? "Original-PNG öffnen" : "Fortsetzen"}
            </button>
            <button onClick={() => void save("compact")}>
              Kleineres Sicherungsbild
            </button>
            <button onClick={openPrint}>Druckfassung / PDF</button>
            {!__PLAYER_BUILD__ && onAuthor && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Zum Lehrkräftemodus wechseln? Sichert zuerst eure Schülerarbeit. Es werden nur die Karteninhalte übernommen.",
                    )
                  ) {
                    close();
                    onAuthor();
                  }
                }}
              >
                Lehrkräftemodus – Mystery bearbeiten
              </button>
            )}
            {onSwitch && (
              <button
                onClick={() => {
                  if (
                    writer?.isSaved ||
                    confirm(
                      "Zum anderen Niveau wechseln? Exportiert bei Bedarf zuerst eure PNG.",
                    )
                  )
                    onSwitch();
                }}
              >
                Niveau wechseln
              </button>
            )}
            {onForget && writer && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Diesen lokalen Arbeitsstand löschen und zur Startansicht gehen?",
                    )
                  )
                    void onForget().catch(() => {
                      close();
                      setMessage(
                        "Löschen fehlgeschlagen. Bitte erneut versuchen.",
                      );
                    });
                }}
              >
                Lokalen Arbeitsstand löschen
              </button>
            )}
            <button onClick={() => setModal("help")}>Hinweise</button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    studentExport
                      ? "Neue Gruppenarbeit beginnen? Exportiert zuerst eine PNG, wenn ihr die bisherige Arbeit behalten möchtet."
                      : "Zur Startansicht gehen? Nicht gesicherte Änderungen gehen verloren.",
                  )
                ) {
                  if (onHome) {
                    onHome();
                    return;
                  }
                  dispatch({ type: "load", work: null });
                  setStartTeam("");
                  setConnecting(null);
                  setOrientation(false);
                  close();
                }
              }}
            >
              {studentExport
                ? "Neue Gruppenarbeit beginnen"
                : "Zur Startansicht"}
            </button>
          </div>
        </Dialog>
      )}
      {!previewMode && modal === "team" && work && (
        <Dialog
          title={studentExport ? "Gruppenname ändern" : "Teamname ändern"}
          onClose={close}
        >
          {message && <p>{message}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const named = requireTeam(work, teamDraft);
                const mode = pendingExport.current;
                commit(named);
                close();
                // Use the newly named snapshot, not the preceding render's work.
                if (mode === "print") setModal("print");
                else if (mode) void save(mode, named);
              } catch (error) {
                setTeamError((error as Error).message);
                teamInput.current?.focus();
              }
            }}
          >
            <label>
              {studentExport ? "Gruppenname" : "Teamname oder Vornamen"}
              <input
                ref={teamInput}
                value={teamDraft}
                onChange={(e) => {
                  setTeamDraft(e.target.value);
                  setTeamError("");
                }}
                aria-required="true"
                aria-invalid={!!teamError}
                aria-describedby={teamError ? "team-error" : undefined}
                maxLength={MAX_TEAM_NAME}
                autoComplete="off"
              />
            </label>
            {teamError && (
              <p id="team-error" className="status" role="alert">
                {teamError}
              </p>
            )}
            <button className="primary" type="submit">
              Übernehmen
            </button>
          </form>
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog title="Hinweise" onClose={close}>
          <p>
            Tippe eine Karte an, um sie zu lesen, einzufärben oder zu verbinden.
            Ziehe sie mit einem Finger an eine andere Stelle.
          </p>
          <p>
            Ziehe die freie Fläche, um die Ansicht zu verschieben. Mit zwei
            Fingern kannst du vergrößern und verkleinern. „Übersicht“ zeigt alle
            Karten.
          </p>
          <p>
            Tippe eine Verbindung an, um Text und Richtung zu ändern oder sie zu
            löschen. Die Kartennummern helfen beim Wiederfinden. Sie geben keine
            Reihenfolge vor.
          </p>
          <p>
            {writer
              ? writer.level.mode === "extended"
                ? "Die lokale Zwischensicherung gilt bis zu drei Stunden nach der letzten Bearbeitung."
                : "Die Zwischensicherung gilt für diese Browsersitzung."
              : "Es wird nichts automatisch gespeichert."}{" "}
            Bewahre das unveränderte Sicherungsbild in „Dateien“ auf. Ein
            Bildschirmfoto, ein Fotoalbum oder das Versenden als verkleinertes
            Bild kann die Sicherung verlieren.
          </p>
        </Dialog>
      )}
      {!previewMode && modal === "print" && work && (
        <Dialog title="Druckfassung / PDF" onClose={close}>
          <PrintPreview work={work} mystery={mystery} />
        </Dialog>
      )}
      {!previewMode && (modal === "resume" || modal === "camera") && (
        <Dialog title="Fortsetzen" onClose={close}>
          {work && (
            <p>
              Ein gültiges Sicherungsbild ersetzt den geöffneten Arbeitsstand.
              Sichere ihn vorher, wenn du ihn behalten möchtest.
            </p>
          )}
          {modal === "resume" ? (
            <>
              <p>
                Wähle die unveränderte Originaldatei aus oder scanne einen
                Sicherungscode.
              </p>
              <div className="menu-list">
                <button className="primary" disabled={busy} onClick={choose}>
                  Sicherungsbild auswählen
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setMessage("");
                    setModal("camera");
                  }}
                >
                  QR-Code scannen
                </button>
              </div>
            </>
          ) : (
            <Camera onScan={scan} onChoose={choose} />
          )}
          {message && (
            <p className="status" role="status">
              {message}
            </p>
          )}
        </Dialog>
      )}
      {!previewMode && modal === "save" && (
        <Dialog
          title={
            studentExport ? "Original-PNG exportieren" : "Arbeitsstand sichern"
          }
          onClose={close}
        >
          <p hidden={!message} role="status" aria-live="polite">
            {message}
          </p>
          {saved && (
            <>
              {studentExport ? (
                <p>
                  Bewahrt die Original-PNG auf, um eure Arbeit später zu öffnen.
                </p>
              ) : (
                <>
                  <p>
                    Speichere die <strong>Originaldatei in „Dateien“</strong>{" "}
                    und lasse sie unverändert. Die Anwendung kann nicht prüfen,
                    ob die Datei dort tatsächlich abgelegt wurde. Ein
                    Bildschirmfoto genügt nicht.
                  </p>
                  <p className="small">
                    Das Bild zeigt von langen Karten einen Textauszug. Beim
                    Öffnen der Original-PNG sind eure Texte wieder vollständig
                    verfügbar.
                  </p>
                </>
              )}
              {studentExport && (
                <p className="export-filename">{saved.file.name}</p>
              )}
              <a
                className="button primary full"
                href={saved.url}
                download={saved.file.name}
              >
                {studentExport
                  ? "PNG herunterladen"
                  : "Sicherungsbild herunterladen"}
              </a>
              {navigator.canShare?.({ files: [saved.file] }) && (
                <button
                  className="full"
                  onClick={async () => {
                    try {
                      await navigator.share({ files: [saved.file] });
                    } catch (e) {
                      if ((e as Error).name !== "AbortError")
                        setMessage(
                          "Das Teilen ist hier nicht möglich. Nutze den Download.",
                        );
                    }
                  }}
                >
                  {studentExport
                    ? "In Dateien ablegen / Teilen"
                    : "Datei teilen oder ablegen"}
                </button>
              )}
              {!studentExport && (
                <p className="small">
                  {saved.mode === "a3"
                    ? "Großes Bild · 4961 × 3508 Bildpunkte"
                    : "Kleineres Bild · 2480 × 1754 Bildpunkte"}
                </p>
              )}
              <img
                className="export-preview"
                src={saved.url}
                alt="Vorschau des Sicherungsbildes"
              />
            </>
          )}
          {studentExport && saved && (
            <details className="export-details">
              <summary>Weitere Exportoptionen</summary>
              <p>
                Das Bild zeigt von langen Karten einen Textauszug. Beim Öffnen
                der Original-PNG sind eure Texte wieder vollständig verfügbar.
              </p>
              <p>
                {saved.mode === "a3" ? "4961 × 3508" : "2480 × 1754"} Pixel ·{" "}
                {saved.qr
                  ? "mit Wiederherstellungscode"
                  : "Wiederherstellung über die Originaldatei"}
              </p>
              {saved.mode === "a3" && (
                <button onClick={() => void save("compact")}>
                  Kleineres Bild erzeugen
                </button>
              )}
            </details>
          )}
          {!busy && (!saved || (!studentExport && saved.mode === "a3")) && (
            <button className="full" onClick={() => void save("compact")}>
              Kleineres Bild erzeugen
            </button>
          )}
        </Dialog>
      )}
    </main>
  );
}
