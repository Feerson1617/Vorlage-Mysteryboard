import { useEffect, useMemo, useRef, useState } from "react";
import type { Content, Draft, MysteryDocument } from "../core/documents";
import { contentHash, packDocument, validateDocument } from "../core/documents";
import { publishDraft, retainCards, reviseDraft } from "../core/authoring";
import { imageFromFile } from "../core/media";
import { initialBoardWork } from "../core/layout";
import { cardNumber, withTeam, type Work } from "../core/model";
import { exportBoard } from "../core/export";
import { Board } from "./Board";
import { Dialog } from "./Dialog";
import { PrintPreview } from "./PrintPreview";
import { MediaView } from "./MediaView";
import { TableEditor } from "./TableEditor";

type Card = Content["cards"][number];
export function AuthorEditor({
  initial,
  onFile,
  onImport,
  onHome,
}: {
  initial: Draft;
  onFile: (doc: MysteryDocument) => void;
  onImport: () => void;
  onHome: () => void;
}) {
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
  const preview =
    previewOverride?.content === content
      ? previewOverride.work
      : initialPreview;
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty || card) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, card]);
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (png) URL.revokeObjectURL(png.url);
    },
    [png],
  );
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
    setCard(structuredClone(content.cards.find((c) => c.id === id)!));
    setIncluded(!draft.author.hiddenCards.includes(id));
    setError("");
  };
  const add = () => {
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
    if (change(next, { ...draft.author, hiddenCards: hidden })) setCard(null);
  };
  const remove = (id: number) => {
    if (
      !window.confirm(
        `Karte ${cardNumber(content, id)} wirklich löschen? Die verbleibenden Karten werden neu nummeriert; es entsteht eine neue Inhaltsversion. Bereits verteilte Dateien bleiben unverändert.`,
      )
    )
      return;
    const keep = content.cards
      .filter((c) => c.id !== id)
      .sort((a, b) => a.id - b.id);
    const mapping = new Map(keep.map((c, i) => [c.id, i + 1]));
    change(
      retainCards(
        content,
        keep.map((c) => c.id),
      ),
      {
        ...draft.author,
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
  return (
    <main className="author-editor">
      <header className="author-toolbar">
        <strong>MysteryBoard · Lehrkräftemodus</strong>
        <span>Kürzel: {draft.author.initials}</span>
        <button
          className="primary"
          onClick={() => onFile(validateDocument(draft))}
        >
          Entwurf sichern
        </button>
        <button onClick={onImport}>Entwurf öffnen</button>
        <button
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
        Autorenwerkzeug ohne Anmeldung. Es wird nichts automatisch gespeichert.
        Das Kürzel ist kein Schüler-Teamname.
      </p>
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
            onChange={(e) => change({ ...content, subtitle: e.target.value })}
          />
        </label>
        <label>
          Methodischer Denkimpuls (optional)
          <textarea
            maxLength={500}
            value={content.help?.method ?? ""}
            onChange={(e) => {
              const help = {
                ...(content.help?.categories
                  ? { categories: content.help.categories }
                  : {}),
                ...(e.target.value ? { method: e.target.value } : {}),
              };
              const next = { ...content };
              if (Object.keys(help).length) next.help = help;
              else delete next.help;
              change(next);
            }}
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
        Inhaltsversion {content.version} · {content.cards.length} Karten. Jede
        übernommene Inhaltsänderung erhält eine neue Version. Beim Löschen
        werden IDs und Hilfereferenzen gemeinsam neu nummeriert.
      </p>
      <button
        className="primary"
        disabled={content.cards.length >= 100}
        onClick={add}
      >
        + Karte hinzufügen
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
          Die Kartennummern helfen beim Wiederfinden. Sie geben keine richtige
          Reihenfolge vor. Bewegungen in dieser Vorschau werden nicht als
          Schülerlösung verteilt.
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
          Mystery für Schülerinnen und Schüler bereitstellen
        </button>
        <button disabled={!content.cards.length} onClick={() => setPrint(true)}>
          Karten drucken / PDF
        </button>
      </div>
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
            <p className="small">
              Bis 3 MB und 4 Millionen Bildpunkte je Bild; insgesamt 12 MB und
              24 Millionen Bildpunkte. PDF-Seiten zunächst lokal als Bild
              exportieren.
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
                    onChange={(e) =>
                      setCard({ ...card, imageAlt: e.target.value })
                    }
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
            setBusy(false);
            setPublication(false);
            setPng(null);
          }}
        >
          <p>
            Die Datei enthält die vollständige Aufgabe und eingebettete Medien.
            Sie enthält keinen Teamnamen, keine Schülerbeziehungen und keine
            Bewegungen aus der Autorenvorschau. Nur freigegebene Karten werden
            aufgenommen.
          </p>
          <p>
            Stellt diese Datei separat im Kurs bereit. Das installierte
            SCORM-Paket wird dadurch nicht verändert.
          </p>
          <button
            className="primary full"
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
            Neue Schülerversion exportieren
          </button>
          <button
            className="full"
            disabled={busy}
            onClick={() => void taskPng()}
          >
            Aufgabe als Original-PNG erzeugen
          </button>
          {busy && <p role="status">Aufgabenbild wird vorbereitet …</p>}
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
      {print && content.cards.length > 0 && (
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
