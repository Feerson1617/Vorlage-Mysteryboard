import { useState } from "react";
import type { Content } from "../../src/core/documents";
import { designOf, DEFAULT_DESIGN, type Design } from "../../src/core/design";
export function DesignEditor({
  content,
  onChange,
  onHelp,
  onClose,
}: {
  content: Content;
  onChange: (c: Content) => void;
  onHelp: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"display" | "edges" | "media" | "start">(
    "display",
  );
  const d = designOf(content);
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
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "display" ? (
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
          <p>
            Die Anordnung auf der Autorenpinnwand bleibt im Projekt. Sie wird
            nicht als Schülerlösung exportiert. Die Schüler starten ohne
            Verbindungen, Farbzuordnungen und Teamnamen.
          </p>
          <label>
            Startablage der Schüler
            <select
              value={
                content.startLayout?.mode === "explicit"
                  ? "explicit"
                  : (content.startLayout?.columns ?? "auto")
              }
              onChange={(e) =>
                onChange({
                  ...content,
                  startLayout: {
                    mode: "ordered",
                    ...(e.target.value === "auto"
                      ? {}
                      : { columns: Number(e.target.value) }),
                  },
                })
              }
            >
              <option value="auto">Automatische, geordnete Ablage</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} Spalten
                </option>
              ))}
              {content.startLayout?.mode === "explicit" && (
                <option value="explicit">
                  Importierte ausdrückliche Startablage
                </option>
              )}
            </select>
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
