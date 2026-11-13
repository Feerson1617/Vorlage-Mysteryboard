import { useEffect, useReducer, useRef, useState } from "react";
import dataset from "@mystery";
import {
  COLOR_NAMES,
  COLORS,
  MAX_EDGES,
  MAX_LABEL,
  MAX_TEAM_NAME,
  cardNumber,
  nextEdgeId,
  validateMystery,
  teamName,
  withTeam,
  type Edge,
  type Work,
} from "./core/model";
import { fromQr } from "./core/codec";
import { MAX_PNG_BYTES, restorePng } from "./core/png";
import { exportBoard, type ExportMode } from "./core/export";
import { Board } from "./components/Board";
import { Dialog } from "./components/Dialog";
import { Camera } from "./components/Camera";
import { emptyHistory, hasChanges, historyReducer } from "./core/history";
import { initialBoardWork } from "./core/layout";
import { LearningHelp } from "./components/LearningHelp";
const mystery = validateMystery(dataset);
type Modal = "resume" | "camera" | "save" | "help" | "menu" | "team" | null;
type Saved = { url: string; file: File; qr: boolean; mode: ExportMode };
const requireTeam = (work: Work, name: string): Work => {
  const named = withTeam(work, name);
  if (!teamName(named))
    throw new Error("Bitte gebt eine Teambezeichnung oder Vornamen ein.");
  return named;
};
export default function App() {
  const [history, dispatch] = useReducer(historyReducer, emptyHistory);
  const work = history.present,
    dirty = hasChanges(history);
  const [modal, setModal] = useState<Modal>(null);
  const [helpOpen, setHelpOpen] = useState(false),
    [orientation, setOrientation] = useState(false),
    [wideToolbar, setWideToolbar] = useState(
      () => matchMedia("(min-width: 1100px)").matches,
    );
  const [startTeam, setStartTeam] = useState(""),
    [teamDraft, setTeamDraft] = useState(""),
    [teamError, setTeamError] = useState("");
  const [card, setCard] = useState<number | null>(null),
    [edge, setEdge] = useState<Edge | null>(null),
    [connecting, setConnecting] = useState<number | null>(null);
  const [fitTick, setFitTick] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<Saved | null>(null);
  const input = useRef<HTMLInputElement>(null),
    startTeamInput = useRef<HTMLInputElement>(null),
    teamInput = useRef<HTMLInputElement>(null),
    pendingExport = useRef<ExportMode | null>(null),
    operation = useRef(0),
    exportRunning = useRef<Promise<void> | null>(null);
  const commit = (next: Work) => dispatch({ type: "edit", work: next });
  const close = () => {
    operation.current++;
    pendingExport.current = null;
    setModal(null);
    setCard(null);
    setEdge(null);
    setMessage("");
    setTeamError("");
    setSaved(null);
    setBusy(false);
    setHelpOpen(false);
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
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
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
    input.current!.value = "";
    input.current!.click();
  };
  const importFile = async (file: File) => {
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
    if (!snapshot) return;
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
        result = await exportBoard(snapshot, mystery, mode);
      } catch (e) {
        if (id !== operation.current) return;
        if (mode === "compact") throw e;
        result = await exportBoard(snapshot, mystery, "compact");
      }
      if (id !== operation.current) return;
      const file = new File(
        [result.blob],
        `MysteryBoard-${mystery.id.replace(/[^\p{L}\p{N}._-]/gu, "-")}-${new Date().toISOString().slice(0, 10)}.png`,
        { type: "image/png" },
      );
      setSaved({
        url: URL.createObjectURL(result.blob),
        file,
        qr: !!result.qr,
        mode: result.mode,
      });
      setMessage(
        result.qr
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
        direction: 0,
        label: "",
      });
      setConnecting(null);
    } else setCard(id);
  };
  const cardContent = mystery.cards.find((c) => c.id === card),
    cardState = work?.cards.find((c) => c.id === card);
  return (
    <main className={work ? "workspace" : undefined}>
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
      {work ? (
        <>
          <header className="toolbar">
            <span className="brand">MysteryBoard</span>
            <nav aria-label="Arbeitsfläche bedienen">
              <button onClick={() => setFitTick((t) => t + 1)}>
                Übersicht
              </button>
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
              <button className="primary" onClick={() => void save()}>
                Sichern
              </button>
              {wideToolbar && (
                <button
                  className="icon-button"
                  aria-label="Hilfe"
                  aria-expanded={helpOpen}
                  title="Hilfe"
                  onClick={openHelp}
                >
                  ?
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Menü"
                onClick={() => setModal("menu")}
              >
                ⋯
              </button>
            </nav>
            {teamName(work) && (
              <span
                className="team-summary"
                aria-label={`Team: ${teamName(work)}`}
              >
                {teamName(work)}
              </span>
            )}
          </header>
          <Board
            work={work}
            mystery={mystery}
            onChange={commit}
            onCard={selectCard}
            onEdge={(id) => {
              if (connecting === null)
                setEdge({ ...work.edges.find((e) => e.id === id)! });
            }}
            fitTick={fitTick}
            connecting={connecting}
            orientation={orientation}
          />
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
          {message && !modal && !card && !edge && (
            <div className="notice" role="status">
              {message}
              <button onClick={() => setMessage("")}>Schließen</button>
            </div>
          )}
        </>
      ) : (
        <section className="welcome">
          <div className="wordmark">
            <span aria-hidden="true">▦</span> MysteryBoard
          </div>
          <h1>{mystery.title}</h1>
          <p>
            Verschiebt die Karten, verbindet eure Gedanken
            <br className="wide-only" /> und haltet euren gemeinsamen Stand
            fest.
          </p>
          <label className="team-input">
            Teamname oder Vornamen
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
                const initial = initialBoardWork(mystery, {
                  width: window.innerWidth,
                  height: Math.max(1, window.innerHeight - 74),
                });
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
            <button onClick={() => setModal("resume")}>Fortsetzen</button>
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
      {cardContent && cardState && work && (
        <Dialog title={`Karte ${cardNumber(mystery, card!)}`} onClose={close}>
          {cardContent.group && (
            <p className="small card-group">
              {mystery.cardGroups![cardContent.group].label}
            </p>
          )}
          <article className="reading">
            <h3>{cardContent.title}</h3>
            <p>{cardContent.text}</p>
            {cardContent.image && (
              <img src={cardContent.image} alt={cardContent.imageAlt} />
            )}
          </article>
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
      {modal === "menu" && (
        <Dialog title="Menü" onClose={close}>
          {teamName(work) && (
            <p className="menu-team">Team: {teamName(work)}</p>
          )}
          <div className="menu-list">
            <button onClick={openHelp}>Hilfe</button>
            <button
              onClick={() => {
                setTeamDraft(teamName(work!));
                setMessage("");
                setTeamError("");
                pendingExport.current = null;
                setModal("team");
              }}
            >
              Teamname ändern
            </button>
            <button
              onClick={() => {
                setMessage("");
                setModal("resume");
              }}
            >
              Fortsetzen
            </button>
            <button onClick={() => void save("compact")}>
              Kleineres Sicherungsbild
            </button>
            <button onClick={() => setModal("help")}>Hinweise</button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Zur Startansicht gehen? Nicht gesicherte Änderungen gehen verloren.",
                  )
                ) {
                  dispatch({ type: "load", work: null });
                  setStartTeam("");
                  setConnecting(null);
                  setOrientation(false);
                  close();
                }
              }}
            >
              Zur Startansicht
            </button>
          </div>
        </Dialog>
      )}
      {modal === "team" && work && (
        <Dialog title="Teamname ändern" onClose={close}>
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
                if (mode) void save(mode, named);
              } catch (error) {
                setTeamError((error as Error).message);
                teamInput.current?.focus();
              }
            }}
          >
            <label>
              Teamname oder Vornamen
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
            Es wird nichts automatisch gespeichert. Bewahre das unveränderte
            Sicherungsbild in „Dateien“ auf. Ein Bildschirmfoto, ein Fotoalbum
            oder das Versenden als verkleinertes Bild kann die Sicherung
            verlieren.
          </p>
        </Dialog>
      )}
      {(modal === "resume" || modal === "camera") && (
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
      {modal === "save" && (
        <Dialog title="Arbeitsstand sichern" onClose={close}>
          <p role="status" aria-live="polite">
            {message}
          </p>
          {saved && (
            <>
              <p>
                Speichere die <strong>Originaldatei in „Dateien“</strong> und
                lasse sie unverändert. Die Anwendung kann nicht prüfen, ob die
                Datei dort tatsächlich abgelegt wurde. Ein Bildschirmfoto genügt
                nicht.
              </p>
              <a
                className="button primary full"
                href={saved.url}
                download={saved.file.name}
              >
                Sicherungsbild herunterladen
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
                          "Das Teilen ist hier nicht möglich. Nutze „Sicherungsbild herunterladen“.",
                        );
                    }
                  }}
                >
                  Datei teilen oder ablegen
                </button>
              )}
              <p className="small">
                {saved.mode === "a3"
                  ? "Großes Bild · 4961 × 3508 Bildpunkte"
                  : "Kleineres Bild · 2480 × 1754 Bildpunkte"}
              </p>
              <img
                className="export-preview"
                src={saved.url}
                alt="Vorschau des Sicherungsbildes"
              />
            </>
          )}
          {!busy && (!saved || saved.mode === "a3") && (
            <button className="full" onClick={() => void save("compact")}>
              Kleineres Bild erzeugen
            </button>
          )}
        </Dialog>
      )}
    </main>
  );
}
