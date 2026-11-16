import { useEffect, useRef, useState } from "react";
import type { Draft } from "../core/documents";
import {
  verifyImageDecode,
  imageFromFile,
  inspectDataImage,
} from "../core/media";
import {
  checkImportFile,
  takeImportedCards,
  mergeImported,
  splitImported,
  canRejoinImported,
  type Card,
  type ImportResult,
} from "../core/document-import/model";
import ImportWorker from "../core/document-import/parser.worker?worker&inline";
import { TableEditor } from "./TableEditor";
import { TableView } from "./TableView";
import { MediaView } from "./MediaView";

type Crop = { x: number; y: number; w: number; h: number };
async function cropImage(src: string, crop: Crop) {
  if (
    crop.w <= 0 ||
    crop.h <= 0 ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.x + crop.w > 100.01 ||
    crop.y + crop.h > 100.01
  )
    throw new Error(
      "Markiert einen nicht leeren Ausschnitt innerhalb der Seite.",
    );
  const image = new Image();
  image.src = src;
  await image.decode();
  const width = Math.max(1, Math.round((image.naturalWidth * crop.w) / 100)),
    height = Math.max(1, Math.round((image.naturalHeight * crop.h) / 100));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")!
    .drawImage(
      image,
      (image.naturalWidth * crop.x) / 100,
      (image.naturalHeight * crop.y) / 100,
      width,
      height,
      0,
      0,
      width,
      height,
    );
  let data = canvas.toDataURL("image/png");
  try {
    inspectDataImage(data);
  } catch {
    data = canvas.toDataURL("image/jpeg", 0.9);
    inspectDataImage(data);
  }
  canvas.width = canvas.height = 0;
  return data;
}
export function DocumentImport({
  draft,
  initialFile,
  dirty,
  onApply,
  onCancel,
}: {
  draft: Draft;
  initialFile?: File;
  dirty: boolean;
  onApply: (next: Draft, count: number) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1),
    [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<ImportResult | null>(null),
    [cards, setCards] = useState<Card[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [view, setView] = useState<"original" | "cards">("cards"),
    [page, setPage] = useState(1),
    [pageImage, setPageImage] = useState("");
  const [mode, setMode] = useState<"append" | "new">("append"),
    [title, setTitle] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 100, h: 100 }),
    [mark, setMark] = useState(false),
    [picked, setPicked] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true),
    textarea = useRef<HTMLTextAreaElement>(null),
    cropStart = useRef<{ x: number; y: number } | null>(null);
  const originalURL = useRef("");
  const groups = Object.entries(draft.content.cardGroups!);
  const defaultGroup = groups.find(([, g]) => !g.prefix)?.[0] ?? groups[0][0];
  const extensionGroup =
    groups.find(([, g]) => g.prefix === "V" || /vertief/i.test(g.label))?.[0] ??
    defaultGroup;
  const current = cards[index];
  const initialCards = useRef<Card[]>([]);
  function proposalsChanged() {
    return (
      result &&
      (cards.length !== initialCards.current.length ||
        cards.some((c, i) => c !== initialCards.current[i]) ||
        selected.length !== initialCards.current.length)
    );
  }
  function stop() {
    request.current++;
    clearTimeout(timer.current);
    worker.current?.terminate();
    worker.current = null;
  }
  useEffect(
    () => () => {
      alive.current = false;
      stop();
      if (originalURL.current) URL.revokeObjectURL(originalURL.current);
    },
    [],
  );
  function deadline(ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      stop();
      if (alive.current) {
        setBusy(false);
        setError(
          "Der Import wurde wegen der Verarbeitungsdauer beendet. Bitte eine kleinere Datei verwenden. Der bisherige Entwurf bleibt erhalten.",
        );
      }
    }, ms);
  }
  function renderPage(n: number) {
    if (!worker.current) return;
    setBusy(true);
    setMessage(`PDF-Seite ${n} wird angezeigt …`);
    deadline(20000);
    worker.current.postMessage({
      type: "render",
      id: ++request.current,
      page: n,
    });
  }
  async function openFile(f: File) {
    try {
      if (
        proposalsChanged() &&
        !confirm(
          "Andere Datei öffnen? Noch nicht übernommene Importänderungen werden verworfen. Der geöffnete Entwurf bleibt unverändert.",
        )
      )
        return;
      const format = checkImportFile(f.name, f.size);
      stop();
      setBusy(true);
      setMessage("Die Datei wird lokal gelesen …");
      setError("");
      setResult(null);
      setCards([]);
      setSelected([]);
      setReviewed(false);
      setPageImage("");
      setPage(1);
      setStep(1);
      setFile(f);
      setTitle(f.name.replace(/\.[^.]+$/, ""));
      if (originalURL.current) URL.revokeObjectURL(originalURL.current);
      originalURL.current = URL.createObjectURL(f);
      const id = ++request.current;
      deadline(45000);
      const bytes = await f.arrayBuffer();
      if (!alive.current || id !== request.current) return;
      const instance = new ImportWorker({
        name: "mysteryboard-document-import",
      });
      worker.current = instance;
      instance.onerror = () => {
        if (!alive.current || worker.current !== instance) return;
        stop();
        setBusy(false);
        setError(
          "Die Datei konnte nicht gelesen werden. Bitte eine gültige Word- oder PDF-Datei beziehungsweise einen aktuellen Browser verwenden.",
        );
      };
      instance.onmessage = (e) => {
        const data = e.data;
        if (!alive.current || worker.current !== instance) return;
        if (data.type === "progress") {
          setMessage(data.message);
          return;
        }
        if (data.type === "ready") return;
        if (data.id !== request.current) return;
        clearTimeout(timer.current);
        setBusy(false);
        if (data.type === "error") {
          stop();
          setError(data.message);
          return;
        }
        if (data.type === "parsed") {
          const r = data.result as ImportResult;
          setResult(r);
          const proposed = r.cards.map((c) => ({
            ...c,
            group: c.group === "extension" ? extensionGroup : defaultGroup,
          }));
          initialCards.current = proposed;
          setCards(proposed);
          setSelected(r.cards.map((c) => c.id));
          setIndex(0);
          setStep(2);
          setView("cards");
          setMessage(
            "Die Vorschläge sind noch nicht im Entwurf. Bitte am Original prüfen.",
          );
          if (r.format === "pdf") renderPage(1);
        } else if (data.type === "rendered") {
          setPageImage(data.image);
          setCrop({ x: 0, y: 0, w: 100, h: 100 });
          setMark(false);
          setMessage("Seite lokal angezeigt.");
        }
      };
      instance.postMessage({ type: "parse", id, format, name: f.name, bytes }, [
        bytes,
      ]);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (initialFile) void openFile(initialFile);
  }, []);
  function update(patch: Partial<Card>) {
    setCards(cards.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    setReviewed(false);
    setError("");
  }
  function addCard(patch: Partial<Card> = {}) {
    const id = Math.max(0, ...cards.map((c) => c.id)) + 1;
    setCards([
      ...cards,
      { id, title: "", text: "", group: defaultGroup, ...patch },
    ]);
    setSelected([...selected, id]);
    setIndex(cards.length);
    setView("cards");
    setReviewed(false);
  }
  function remove() {
    if (!current) return;
    setCards(cards.filter((c) => c.id !== current.id));
    setSelected(selected.filter((id) => id !== current.id));
    setIndex(Math.max(0, index - 1));
    setReviewed(false);
  }
  function split() {
    if (!current) return;
    const at = textarea.current?.selectionStart ?? 0;
    if (at <= 0 || at >= current.text.length) {
      setError(
        "Setzt den Textcursor an die gewünschte Grenze innerhalb des Kartentexts.",
      );
      return;
    }
    const id = Math.max(...cards.map((c) => c.id)) + 1;
    setCards([
      ...cards.slice(0, index),
      ...splitImported(current, at, id),
      ...cards.slice(index + 1),
    ]);
    setSelected([...selected, id]);
    setReviewed(false);
  }
  function merge() {
    try {
      const next = cards[index + 1],
        exact = canRejoinImported(current, next),
        joined = mergeImported(current, next);
      if (
        !exact &&
        !confirm(
          "Diese Karten können nicht eindeutig als unveränderte Teilstücke zurückgesetzt werden. Ihre Texte und die zweite Überschrift werden mit Absätzen verbunden; unterschiedliche Quellen, Bilder und Tabelleninformationen bleiben erhalten. Die gemeinsame Karte verwendet die Kartengruppe der ersten Karte. Zusammenfügen und die Textgrenze sowie Kartengruppe anschließend am Original prüfen?",
        )
      )
        return;
      setCards([...cards.slice(0, index), joined, ...cards.slice(index + 2)]);
      setSelected([
        ...selected.filter((id) => id !== next.id && id !== current.id),
        ...(selected.includes(current.id) || selected.includes(next.id)
          ? [current.id]
          : []),
      ]);
      setReviewed(false);
      setError("");
      setMessage(
        exact
          ? "Teilung zurückgenommen: Text, Quelle und Karteninformationen entsprechen wieder dem Original vor der Teilung."
          : "Karten mit Absätzen zusammengefügt. Bitte Textgrenze und gemeinsame Kartengruppe am Original prüfen.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function close() {
    if (
      step !== 1 &&
      cards.length &&
      !confirm(
        "Import schließen? Noch nicht übernommene Importänderungen werden verworfen. Der Entwurf bleibt unverändert.",
      )
    )
      return;
    stop();
    onCancel();
  }
  async function attach(asNew = false) {
    try {
      if (!pageImage) return;
      setBusy(true);
      setError("");
      const data = await cropImage(pageImage, crop);
      await verifyImageDecode(data);
      if (!alive.current) return;
      if (asNew) addCard({ image: data });
      else update({ image: data });
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function cropPoint(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(
        100,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.min(
        100,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * 100),
      ),
    };
  }
  async function apply() {
    try {
      setError("");
      if (!reviewed)
        throw new Error(
          "Bitte zuerst den Vergleich mit dem Original bestätigen.",
        );
      const chosen = cards.filter((c) => selected.includes(c.id));
      const next = takeImportedCards(draft, chosen, mode, title);
      setBusy(true);
      for (const c of chosen) if (c.image) await verifyImageDecode(c.image);
      if (!alive.current) return;
      if (
        mode === "new" &&
        !confirm(
          `${dirty ? "Der geöffnete Entwurf enthält noch nicht dauerhaft abgelegte Änderungen. " : ""}Ein neues Mystery beginnen? Der geöffnete Entwurf wird ersetzt. Brecht ab und sichert ihn zuerst, wenn ihr ihn behalten möchtet.`,
        )
      ) {
        setBusy(false);
        return;
      }
      stop();
      onApply(next, chosen.length);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  const originalText =
    result?.blocks
      .filter((b) => result.format !== "pdf" || b.page === page)
      .map((b) =>
        b.table
          ? [
              b.table.headers.join("\t"),
              ...b.table.rows.map((r) => r.join("\t")),
            ].join("\n")
          : b.text,
      )
      .filter(Boolean)
      .join("\n\n") ?? "";
  return (
    <section className="document-import" aria-label="Dokument importieren">
      <h2>Dokument importieren</h2>
      <p className="small">
        1. Datei auswählen · 2. Karten prüfen · 3. Karten übernehmen
      </p>
      <p>
        Die Verarbeitung bleibt auf diesem Gerät. Es wird nichts automatisch
        gespeichert.
      </p>
      <div className="actions">
        <button disabled={busy} onClick={() => fileInput.current?.click()}>
          Word- oder PDF-Datei auswählen
        </button>
        <input
          hidden
          ref={fileInput}
          type="file"
          accept=".docx,.pdf"
          aria-label="Word- oder PDF-Datei"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void openFile(f);
          }}
        />
        <button onClick={close}>
          {busy ? "Import abbrechen" : "Zurück zum Entwurf"}
        </button>
      </div>
      {file && (
        <p className="small">
          {file.name} ·{" "}
          {result?.format === "pdf"
            ? "PDF"
            : result?.format === "docx"
              ? "Word (.docx)"
              : "Datei"}
          {result?.pages ? ` · ${result.pages.length} Seiten` : ""}
          {result
            ? ` · ${result.blocks.filter((b) => b.text).length} Textbereiche · ${result.images.length} Bilder`
            : ""}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {busy && (
        <p aria-live="polite">
          Bitte warten. Ein Abbruch verändert den bisherigen Entwurf nicht.
        </p>
      )}
      <fieldset className="import-step-body" disabled={busy}>
        {result && step === 2 && (
          <>
            <h3>2. Karten prüfen</h3>
            <p className="import-warning">
              Unsichere Gliederung: Bitte alle vorgeschlagenen Grenzen, Inhalte
              und Pflicht-/Vertiefungsangaben am Original kontrollieren. Es
              findet keine fachliche Erkennung statt.
            </p>
            {result.noText && (
              <p role="status">
                Dieses PDF enthält keinen auslesbaren Text. Sie können eine
                Seite als Bild übernehmen. Die automatische Texterkennung
                ergänzen wir später.
              </p>
            )}
            <details>
              <summary>Hinweise zur Übernahme</summary>
              {result.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </details>
            <div className="actions import-tabs">
              <button
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
              >
                Karten ansehen
              </button>
              <button
                aria-pressed={view === "original"}
                onClick={() => setView("original")}
              >
                Original ansehen
              </button>
            </div>
            <div className="import-review" data-view={view}>
              <section
                className="import-original"
                aria-label="Original vergleichen"
              >
                <h3>Original</h3>
                {result.format === "docx" && (
                  <p className="small">
                    Absätze, Tabellen und Bilder aus Word. Die Seiteneinteilung
                    kann abweichen; für den vollständigen Vergleich die
                    Originaldatei ablegen und in Word öffnen.
                  </p>
                )}
                {originalURL.current && (
                  <a
                    className="button"
                    href={originalURL.current}
                    download={file?.name}
                  >
                    Originaldatei ablegen
                  </a>
                )}
                {result.format === "docx" && (
                  <div className="import-docx-original">
                    {result.blocks.map((b, i) => (
                      <div key={i}>
                        {b.kind === "heading" ? (
                          <h4>{b.text}</h4>
                        ) : b.table ? (
                          <TableView table={b.table} />
                        ) : b.image ? (
                          <MediaView
                            lazy
                            src={b.image}
                            alt={b.imageAlt || "Bild aus dem Word-Dokument"}
                          />
                        ) : (
                          <p>{b.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {result.format === "pdf" && (
                  <>
                    <label>
                      PDF-Seite
                      <select
                        aria-label="PDF-Seite"
                        disabled={busy}
                        value={page}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setPage(n);
                          setPageImage("");
                          renderPage(n);
                        }}
                      >
                        {result.pages!.map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            Seite {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    {pageImage && (
                      <>
                        <label className="help-toggle">
                          <input
                            type="checkbox"
                            checked={mark}
                            onChange={(e) => setMark(e.target.checked)}
                          />
                          Ausschnitt markieren
                        </label>
                        <div
                          className={"import-page " + (mark ? "marking" : "")}
                          onPointerDown={(e) => {
                            if (!mark) return;
                            e.preventDefault();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            cropStart.current = cropPoint(e);
                          }}
                          onPointerMove={(e) => {
                            if (!mark || !cropStart.current) return;
                            const p = cropPoint(e),
                              s = cropStart.current;
                            setCrop({
                              x: Math.min(s.x, p.x),
                              y: Math.min(s.y, p.y),
                              w: Math.max(0.1, Math.abs(s.x - p.x)),
                              h: Math.max(0.1, Math.abs(s.y - p.y)),
                            });
                          }}
                          onPointerUp={() => {
                            cropStart.current = null;
                          }}
                          onPointerCancel={() => {
                            cropStart.current = null;
                          }}
                        >
                          <img
                            src={pageImage}
                            alt={`Original-PDF-Seite ${page}`}
                          />
                          {mark && (
                            <span
                              className="import-crop"
                              style={{
                                left: crop.x + "%",
                                top: crop.y + "%",
                                width: crop.w + "%",
                                height: crop.h + "%",
                              }}
                            />
                          )}
                        </div>
                        {mark && (
                          <>
                            <p className="small">
                              Mit Finger oder Maus einen Bereich markieren oder
                              die Prozentwerte anpassen.
                            </p>
                            <div className="import-crop-fields">
                              {(
                                [
                                  ["Links", "x"],
                                  ["Oben", "y"],
                                  ["Breite", "w"],
                                  ["Höhe", "h"],
                                ] as const
                              ).map(([label, key]) => (
                                <label key={key}>
                                  {label} (%)
                                  <input
                                    type="number"
                                    min={key === "x" || key === "y" ? 0 : 1}
                                    max={100}
                                    value={Math.round(crop[key])}
                                    onChange={(e) => {
                                      const n = Math.max(
                                        key === "x" || key === "y" ? 0 : 1,
                                        Math.min(100, Number(e.target.value)),
                                      );
                                      setCrop((old) => {
                                        const next = { ...old, [key]: n };
                                        next.w = Math.min(next.w, 100 - next.x);
                                        next.h = Math.min(next.h, 100 - next.y);
                                        return next;
                                      });
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="actions">
                          <button
                            disabled={!current || busy}
                            onClick={() => void attach()}
                          >
                            Ausschnitt der aktuellen Karte zuordnen
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void attach(true)}
                          >
                            Seite als Bildkarte hinzufügen
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
                <label>
                  Ausgelesener{" "}
                  {result.format === "pdf" ? "Seitentext" : "Dokumenttext"}
                  <textarea
                    readOnly
                    value={originalText}
                    rows={6}
                    onSelect={(e) => {
                      const t = e.currentTarget;
                      setPicked(
                        t.value.slice(t.selectionStart, t.selectionEnd),
                      );
                    }}
                  />
                </label>
                <button
                  disabled={!picked}
                  onClick={() => addCard({ text: picked })}
                >
                  Textauswahl als Karte hinzufügen
                </button>
              </section>
              <section
                className="import-cards"
                aria-label="Importkarten prüfen"
              >
                <h3>Karten</h3>
                <p>
                  {cards.length} Vorschläge · {selected.length} zur Übernahme
                  ausgewählt
                </p>
                {current && (
                  <>
                    <p className="import-warning">
                      Vorschlag {index + 1}: Grenze, Reihenfolge und
                      Kartengruppe bitte am Original prüfen.
                      {/[\uFFFD\u0000]/.test(current.title + current.text)
                        ? " Möglicherweise nicht lesbare Zeichen gefunden; bitte korrigieren."
                        : ""}
                    </p>
                    <label>
                      Karte auswählen
                      <select
                        aria-label="Importkarte auswählen"
                        value={index}
                        onChange={(e) => setIndex(Number(e.target.value))}
                      >
                        {cards.map((c, i) => (
                          <option key={c.id} value={i}>
                            {i + 1} · {c.title || "Ohne Überschrift"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="actions">
                      <button
                        disabled={index === 0}
                        onClick={() => setIndex(index - 1)}
                      >
                        Vorherige Karte
                      </button>
                      <button
                        disabled={index === cards.length - 1}
                        onClick={() => setIndex(index + 1)}
                      >
                        Nächste Karte
                      </button>
                    </div>
                    <label className="help-toggle">
                      <input
                        type="checkbox"
                        checked={selected.includes(current.id)}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, current.id]
                              : selected.filter((id) => id !== current.id),
                          );
                          setReviewed(false);
                        }}
                      />
                      Diese Karte übernehmen
                    </label>
                    <label>
                      Überschrift
                      <input
                        value={current.title}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    <label>
                      Kartentext
                      <textarea
                        ref={textarea}
                        value={current.text}
                        rows={8}
                        onChange={(e) => update({ text: e.target.value })}
                      />
                    </label>
                    <p className="small">
                      {current.text.length} von höchstens 4000 Zeichen. Zum
                      Teilen den Textcursor an die Grenze setzen.
                    </p>
                    <label>
                      Kartengruppe
                      <select
                        aria-label="Import-Kartengruppe"
                        value={current.group}
                        onChange={(e) => update({ group: e.target.value })}
                      >
                        {groups.map(([id, g]) => (
                          <option key={id} value={id}>
                            {g.label}
                            {g.prefix ? ` (${g.prefix})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quellenangabe
                      <textarea
                        value={current.source ?? ""}
                        onChange={(e) => update({ source: e.target.value })}
                      />
                    </label>
                    {current.image && (
                      <>
                        <MediaView
                          src={current.image}
                          alt={current.imageAlt || "Bild dieser Importkarte"}
                        />
                        <label>
                          Bildbeschreibung
                          <input
                            value={current.imageAlt ?? ""}
                            onChange={(e) =>
                              update({ imageAlt: e.target.value })
                            }
                          />
                        </label>
                        <button
                          onClick={() => {
                            const next = { ...current };
                            delete next.image;
                            delete next.imageAlt;
                            setCards(
                              cards.map((c, i) => (i === index ? next : c)),
                            );
                            setReviewed(false);
                          }}
                        >
                          Bild von Karte entfernen
                        </button>
                      </>
                    )}
                    {!!result.images.length && (
                      <label>
                        Bild aus dem Dokument
                        <select
                          value={result.images.indexOf(current.image ?? "")}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n >= 0) update({ image: result.images[n] });
                          }}
                        >
                          <option value={-1}>Bild auswählen</option>
                          {result.images.map((_, i) => (
                            <option value={i} key={i}>
                              Bild {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Bild ersetzen (PNG, JPEG, WebP)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          try {
                            setBusy(true);
                            const image = await imageFromFile(f);
                            if (alive.current) update({ image });
                          } catch (e) {
                            if (alive.current) setError((e as Error).message);
                          } finally {
                            if (alive.current) setBusy(false);
                          }
                        }}
                      />
                    </label>
                    {current.table ? (
                      <TableEditor
                        table={current.table}
                        onChange={(table) => {
                          if (table) update({ table });
                          else {
                            const next = { ...current };
                            delete next.table;
                            setCards(
                              cards.map((c, i) => (i === index ? next : c)),
                            );
                            setReviewed(false);
                          }
                        }}
                      />
                    ) : (
                      <button
                        onClick={() =>
                          update({
                            table: { headers: ["", ""], rows: [["", ""]] },
                          })
                        }
                      >
                        Tabelle hinzufügen
                      </button>
                    )}
                    <div className="actions">
                      <button onClick={split}>
                        Karte am Textcursor teilen
                      </button>
                      <button
                        disabled={index >= cards.length - 1}
                        onClick={merge}
                      >
                        Mit nächster Karte zusammenfügen
                      </button>
                      <button onClick={remove}>Importkarte entfernen</button>
                    </div>
                  </>
                )}
                <button
                  disabled={cards.length >= 100}
                  onClick={() => addCard()}
                >
                  Importkarte hinzufügen
                </button>
              </section>
            </div>
            <div className="actions">
              <button
                disabled={busy || !selected.length}
                className="primary"
                onClick={() => {
                  setStep(3);
                  setError("");
                }}
              >
                Weiter zur Übernahme
              </button>
            </div>
          </>
        )}
        {result && step === 3 && (
          <>
            <h3>3. Karten übernehmen</h3>
            <p>
              {selected.length} ausgewählte Karten. Bis jetzt wurde der Entwurf
              nicht verändert.
            </p>
            <label className="help-toggle">
              <input
                type="radio"
                name="import-target"
                checked={mode === "append"}
                onChange={() => setMode("append")}
              />
              Karten zu diesem Mystery hinzufügen
            </label>
            <label className="help-toggle">
              <input
                type="radio"
                name="import-target"
                checked={mode === "new"}
                onChange={() => setMode("new")}
              />
              Neues Mystery aus dem Dokument erstellen
            </label>
            {(mode === "new" || !draft.content.title) && (
              <label>
                Mystery-Titel
                <input
                  aria-describedby="document-import-title-hint"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            )}
            {(mode === "new" || !draft.content.title) && (
              <p id="document-import-title-hint" className="small">
                Vorschlag aus dem Dateinamen; bitte prüfen.
              </p>
            )}
            {mode === "new" && (
              <>
                <p>
                  Der bisherige Entwurf wird erst nach einer zusätzlichen
                  Bestätigung ersetzt. Sichert ihn vorher, wenn ihr ihn behalten
                  möchtet.
                </p>
              </>
            )}
            <label className="help-toggle">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Ich habe Texte, Grenzen, Bilder, Tabellen und
              Pflicht-/Vertiefungskarten mit dem Original geprüft.
            </label>
            <p>
              Übernehmen ändert nur den geöffneten Entwurf. Danach „Entwurf
              sichern“ bewusst herunterladen und „Schülerversion erstellen“ für
              die Klasse verwenden.
            </p>
            <div className="actions">
              <button disabled={busy} onClick={() => setStep(2)}>
                Zurück zu den Karten
              </button>
              <button
                disabled={busy || !reviewed}
                className="primary"
                onClick={() => void apply()}
              >
                Geprüfte Karten übernehmen
              </button>
            </div>
          </>
        )}
      </fieldset>
    </section>
  );
}
