import { useState } from "react";
import type { Content } from "../../src/core/documents";
import { designOf, DEFAULT_DESIGN, type Design } from "../../src/core/design";
export function DesignEditor({
  content,
  onChange,
  onStartLayout,
  onHelp,
  onClose,
}: {
  content: Content;
  onChange: (c: Content) => void;
  onStartLayout: (layout: NonNullable<Content["startLayout"]>) => void;
  onHelp: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<
    "display" | "edges" | "media" | "start" | "editing"
  >("display");
  const d = designOf(content);
  const editableCount = content.cards.filter(
    (card) => card.studentEditable,
  ).length;
  const lockedCount = content.cards.length - editableCount;
  const setCardPermissions = (allowed: boolean) =>
    onChange({
      ...content,
      cards: content.cards.map((card) => ({
        ...card,
        studentEditable: allowed ? true : undefined,
      })),
    });
  const change = (update: Design) =>
    onChange({ ...content, design: { ...d, ...update } });
  const color = (key: keyof Design, label: string) => (
    <label>
      {label}
      <input
        type="color"
        aria-label={label}
        value={String(d[key])}
        onChange={(e) => change({ [key]: e.target.value })}
      />
    </label>
  );
  const number = (
    key: keyof Design,
    label: string,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={Number(d[key])}
        onChange={(e) => change({ [key]: Number(e.target.value) })}
      />
      <output>{String(d[key])}</output>
    </label>
  );
  return (
    <section className="studio-design" aria-label="Mystery gestalten">
      <header>
        <h2>Mystery gestalten</h2>
        <button onClick={onClose}>Zur Pinnwand</button>
      </header>
      <nav aria-label="Gestaltungsbereiche">
        {(
          [
            ["display", "Darstellung"],
            ["edges", "Verbindungen"],
            ["media", "Karten und Medien"],
            ["start", "Startanordnung"],
            ["editing", "Bearbeitungsfreigabe"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "editing" ? (
        <section>
          <h3>Überschriften und Texte</h3>
          <p>
            {editableCount} bearbeitbar · {lockedCount} gesperrt
          </p>
          <div className="menu-list">
            <button
              disabled={!lockedCount}
              onClick={() => setCardPermissions(true)}
            >
              Alle Karten für Lernende bearbeitbar machen ({lockedCount}{" "}
              Änderungen)
            </button>
            <button
              disabled={!editableCount}
              onClick={() => setCardPermissions(false)}
            >
              Alle Karten für Lernende sperren ({editableCount} Änderungen)
            </button>
          </div>
          <p className="small">
            Neue Karten starten gesperrt. Einzelne Freigaben ändert ihr im
            Kartenformular.
          </p>
        </section>
      ) : tab === "display" ? (
        <>
          <label>
            Gestaltungsvorlage
            <select
              defaultValue=""
              onChange={(e) =>
                change(
                  e.target.value === "contrast"
                    ? {
                        ...DEFAULT_DESIGN,
                        textColor: "#111111",
                        borderColor: "#222222",
                        borderWidth: 2,
                        background: "#ffffff",
                        edgeColor: "#111111",
                      }
                    : e.target.value === "print"
                      ? {
                          ...DEFAULT_DESIGN,
                          background: "#ffffff",
                          radius: 0,
                          borderColor: "#333333",
                        }
                      : { ...DEFAULT_DESIGN },
                )
              }
            >
              <option value="" disabled>
                Vorlage wählen
              </option>
              <option value="standard">Standard</option>
              <option value="contrast">Kontrastreich</option>
              <option value="print">Druckfreundlich</option>
            </select>
          </label>
          <label>
            Schrift
            <select
              aria-label="Schrift"
              value={d.font}
              onChange={(e) =>
                change({ font: e.target.value as "sans" | "serif" })
              }
            >
              <option value="sans">Klar ohne Serifen</option>
              <option value="serif">Klassisch mit Serifen</option>
            </select>
          </label>
          {number("fontSize", "Schriftgröße", 14, 22)}
          {color("textColor", "Textfarbe")}
          {color("cardColor", "Kartenfarbe")}
          {color("borderColor", "Kartenrahmen")}
          {number("borderWidth", "Rahmenstärke", 1, 4)}
          {number("radius", "Eckenradius", 0, 22)}
          {number("spacing", "Kartenabstand", 40, 160)}
          {color("background", "Hintergrund")}
          <button onClick={onHelp}>Hilfen und Nummernfarben bearbeiten</button>
        </>
      ) : tab === "edges" ? (
        <>
          <p>
            Diese Einstellungen gelten für alle Verbindungen. Eine bereits
            gespeicherte Richtung bleibt erhalten; die Ausgangsrichtung gilt nur
            für neue Pfeile.
          </p>
          <label>
            Ausgangsrichtung neuer Verbindungen
            <select
              value={d.direction}
              onChange={(e) =>
                change({ direction: Number(e.target.value) as 0 | 1 | 2 })
              }
            >
              <option value="1">Von der ersten zur zweiten Karte</option>
              <option value="2">Von der zweiten zur ersten Karte</option>
              <option value="0">Bewusst ohne Pfeil</option>
            </select>
          </label>
          <label>
            Pfeilspitze
            <select
              value={d.arrowHead}
              onChange={(e) =>
                change({ arrowHead: e.target.value as "triangle" | "open" })
              }
            >
              <option value="triangle">Gefüllte Spitze</option>
              <option value="open">Konturspitze</option>
            </select>
          </label>
          {number("edgeWidth", "Linienstärke", 1, 6)}
          {color("edgeColor", "Linienfarbe")}
          <label>
            <input
              type="checkbox"
              checked={d.edgeDash}
              onChange={(e) => change({ edgeDash: e.target.checked })}
            />
            Gestrichelte Verbindung
          </label>
          {number("labelSize", "Beschriftungsgröße", 12, 20)}
          {color("labelBackground", "Beschriftungshintergrund")}
        </>
      ) : tab === "media" ? (
        <>
          <p>
            Bilder, Diagramme, Quellen, Tabellen und Bildbeschreibungen werden
            an der jeweiligen Karte bearbeitet.
          </p>
          <p>
            Öffnet auf der Pinnwand eine Karte und dann „Weitere Kartenangaben“.
            Zusätzliche Bilder bleiben echte Bilder; Diagramme werden nicht
            durch vermutete Datentabellen ersetzt.
          </p>
          <button onClick={onClose}>Karte auf der Pinnwand auswählen</button>
          <button onClick={onHelp}>Hilfen konfigurieren</button>
        </>
      ) : (
        <>
          <fieldset className="studio-start-layout">
            <legend>Schüler-Startanordnung</legend>
            <label>
              <input
                type="radio"
                name="student-start-layout"
                checked={content.startLayout?.mode !== "explicit"}
                onChange={() => onStartLayout({ mode: "ordered" })}
              />
              Karten automatisch für Lernende anordnen
            </label>
            <label>
              <input
                type="radio"
                name="student-start-layout"
                disabled={!content.cards.length}
                checked={content.startLayout?.mode === "explicit"}
                onChange={() => onStartLayout({ mode: "explicit" })}
              />
              Meine aktuelle Kartenanordnung als Startansicht übernehmen
            </label>
            {content.startLayout?.mode === "explicit" ? (
              <button
                type="button"
                disabled={!content.cards.length}
                onClick={() => onStartLayout({ mode: "explicit" })}
              >
                Startansicht mit aktueller Anordnung aktualisieren
              </button>
            ) : (
              <label>
                Spalten der Startansicht
                <select
                  value={content.startLayout?.columns ?? "auto"}
                  onChange={(event) =>
                    onStartLayout({
                      mode: "ordered",
                      ...(event.target.value === "auto"
                        ? {}
                        : { columns: Number(event.target.value) }),
                    })
                  }
                >
                  <option value="auto">Automatisch</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} Spalten
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="small">
              Nur ausdrücklich freigegebene Verbindungen erscheinen in der
              Startansicht. Prüfe die Schüleransicht vor dem Export.
            </p>
          </fieldset>
          <label>
            <input
              type="checkbox"
              checked={content.numbering === "by-group"}
              onChange={(e) => {
                const next = { ...content };
                if (e.target.checked) next.numbering = "by-group";
                else delete next.numbering;
                onChange(next);
              }}
            />
            Pflicht- und V-Karten getrennt nummerieren
          </label>
          <label>
            Untertitel oder kurzer Arbeitsauftrag
            <input
              maxLength={300}
              value={content.subtitle ?? ""}
              onChange={(e) =>
                onChange({ ...content, subtitle: e.target.value })
              }
            />
          </label>
        </>
      )}
    </section>
  );
}
