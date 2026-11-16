import { useState } from "react";
import {
  changeRegions,
  type PdfLayout,
  type PdfRegion,
  type Rect,
} from "../core/document-import/pdf-layout";
type Crop = { x: number; y: number; w: number; h: number };
export function PdfRegionOverlay({
  layout,
  page,
  cardId,
  mark,
  onSelect,
  numberFor,
}: {
  layout: PdfLayout;
  page: number;
  cardId?: number;
  mark: boolean;
  onSelect: (id: number) => void;
  numberFor: (id: number) => number;
}) {
  const p = layout.pages[page - 1];
  return (
    <svg
      className="import-region-overlay"
      viewBox={`0 0 ${p.width} ${p.height}`}
      aria-label="Erkannte Kartenbereiche"
    >
      {layout.regions
        .filter((r) => r.page === page)
        .map((r) => (
          <g key={r.id} data-pdf-region={r.id} data-region-card={r.cardId}>
            <rect
              x={r.bounds.x}
              y={r.bounds.y}
              width={r.bounds.width}
              height={r.bounds.height}
              fill={r.cardId === cardId ? "#e2eee4" : "transparent"}
              fillOpacity={r.cardId === cardId ? 0.16 : 0}
              stroke={r.cardId === cardId ? "#174a32" : "#647d6a"}
              strokeWidth={r.cardId === cardId ? 2 : 1}
              vectorEffect="non-scaling-stroke"
              role="button"
              aria-label={`Bereich ${numberFor(r.cardId)} auswählen`}
              tabIndex={mark ? -1 : 0}
              style={{ pointerEvents: mark ? "none" : "all" }}
              onClick={() => {
                if (!mark) onSelect(r.cardId);
              }}
              onKeyDown={(e) => {
                if (!mark && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(r.cardId);
                }
              }}
            />
            <text
              x={r.bounds.x + r.bounds.width - 5}
              y={r.bounds.y + r.bounds.height - 4}
              textAnchor="end"
              fontSize="14"
              fill="#174a32"
              stroke="#f7f8f7"
              strokeWidth="1.5"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {numberFor(r.cardId)}
            </text>
          </g>
        ))}
    </svg>
  );
}
export function PdfRegionControls({
  layout,
  page,
  cardId,
  crop,
  nextId,
  onMark,
  onChange,
  numberFor,
}: {
  layout: PdfLayout;
  page: number;
  cardId?: number;
  crop: Crop;
  nextId: number;
  numberFor: (id: number) => number;
  onMark: (crop: Crop) => void;
  onChange: (next: PdfLayout, affected: number[], removed: number[]) => boolean;
}) {
  const [axis, setAxis] = useState("horizontal"),
    [position, setPosition] = useState(50),
    [mergeWith, setMergeWith] = useState(""),
    [error, setError] = useState("");
  const region = layout.regions.find(
      (r) => r.page === page && r.cardId === cardId,
    ),
    p = layout.pages[page - 1];
  const bounds: Rect = {
    x: (crop.x * p.width) / 100,
    y: (crop.y * p.height) / 100,
    width: (crop.w * p.width) / 100,
    height: (crop.h * p.height) / 100,
  };
  const nextRegionId = Math.max(0, ...layout.regions.map((r) => r.id)) + 1;
  const apply = (
    regions: PdfRegion[],
    affected: number[],
    removed: number[] = [],
  ) => {
    try {
      const next = changeRegions(layout, regions);
      if (onChange(next, affected, removed)) setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="pdf-region-controls" aria-label="Kartengrenzen prüfen">
      <h4>Kartengrenzen prüfen</h4>
      <p className="small">
        Eine nummerierte Umrandung entspricht einem Kartenvorschlag. Antippen
        wählt die Karte. Markierungen und Prozentwerte lassen sich mit Finger,
        Maus oder Tastatur ändern. Räumliche Änderungen lesen die betroffenen
        Texte neu aus der Textebene beziehungsweise im OCR-Paket aus dem Bild;
        Bilder bleiben erhalten.
      </p>
      <button
        onClick={() =>
          apply(
            [
              ...layout.regions,
              {
                id: nextRegionId,
                cardId: nextId,
                page,
                bounds,
                strategy: "manual",
              },
            ],
            [nextId],
          )
        }
      >
        Markierung als Textkarte hinzufügen
      </button>
      {region ? (
        <>
          <div className="actions">
            <button
              onClick={() =>
                onMark({
                  x: (region.bounds.x / p.width) * 100,
                  y: (region.bounds.y / p.height) * 100,
                  w: (region.bounds.width / p.width) * 100,
                  h: (region.bounds.height / p.height) * 100,
                })
              }
            >
              Kartengrenze markieren
            </button>
            <button
              onClick={() =>
                apply(
                  layout.regions.map((r) =>
                    r.id === region.id
                      ? { ...r, bounds, strategy: "manual" }
                      : r,
                  ),
                  [region.cardId],
                )
              }
            >
              Grenze aktualisieren und Text neu lesen
            </button>
          </div>
          <div className="import-crop-fields">
            <label>
              Teilung
              <select
                aria-label="Bereich teilen entlang"
                value={axis}
                onChange={(e) => setAxis(e.target.value)}
              >
                <option value="horizontal">Waagerecht</option>
                <option value="vertical">Senkrecht</option>
              </select>
            </label>
            <label>
              Position (%)
              <input
                type="number"
                aria-label="Teilungsposition (%)"
                min={5}
                max={95}
                value={position}
                onChange={(e) =>
                  setPosition(Math.min(95, Math.max(5, Number(e.target.value))))
                }
              />
            </label>
          </div>
          <button
            onClick={() => {
              const a = { ...region.bounds },
                b = { ...region.bounds },
                fraction = position / 100;
              if (axis === "horizontal") {
                a.height *= fraction;
                b.y += a.height;
                b.height -= a.height;
              } else {
                a.width *= fraction;
                b.x += a.width;
                b.width -= a.width;
              }
              apply(
                layout.regions.flatMap((r) =>
                  r.id === region.id
                    ? [
                        { ...r, bounds: a, strategy: "manual" },
                        {
                          id: nextRegionId,
                          cardId: nextId,
                          page,
                          bounds: b,
                          strategy: "manual",
                        },
                      ]
                    : [r],
                ),
                [region.cardId, nextId],
              );
            }}
          >
            Bereich teilen
          </button>
          <label>
            Zusammenführen mit
            <select
              aria-label="Anderer Kartenbereich"
              value={mergeWith}
              onChange={(e) => setMergeWith(e.target.value)}
            >
              <option value="">Bereich auswählen</option>
              {layout.regions
                .filter((r) => r.page === page && r.cardId !== region.cardId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Bereich {numberFor(r.cardId)}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!mergeWith}
            onClick={() => {
              const other = layout.regions.find(
                (r) => String(r.id) === mergeWith,
              );
              if (
                !other ||
                other.page !== page ||
                other.cardId === region.cardId
              )
                return;
              const x = Math.min(region.bounds.x, other.bounds.x),
                y = Math.min(region.bounds.y, other.bounds.y),
                bounds = {
                  x,
                  y,
                  width:
                    Math.max(
                      region.bounds.x + region.bounds.width,
                      other.bounds.x + other.bounds.width,
                    ) - x,
                  height:
                    Math.max(
                      region.bounds.y + region.bounds.height,
                      other.bounds.y + other.bounds.height,
                    ) - y,
                };
              const regions = layout.regions
                .filter((r) => r.id !== other.id)
                .map((r) =>
                  r.id === region.id
                    ? { ...r, bounds, strategy: "manual" as const }
                    : r,
                );
              apply(
                regions,
                [region.cardId],
                regions.some((r) => r.cardId === other.cardId)
                  ? []
                  : [other.cardId],
              );
              setMergeWith("");
            }}
          >
            Bereiche zusammenführen
          </button>
          <button
            onClick={() => {
              const regions = layout.regions.filter((r) => r.id !== region.id);
              apply(
                regions,
                regions.some((r) => r.cardId === region.cardId)
                  ? [region.cardId]
                  : [],
                regions.some((r) => r.cardId === region.cardId)
                  ? []
                  : [region.cardId],
              );
            }}
          >
            Bereich entfernen
          </button>
        </>
      ) : (
        <p className="small">
          Für diese Text-/Bildkarte ist auf dieser Seite kein eigener Bereich
          markiert. Zum Ergänzen „Ausschnitt markieren“ und anschließend
          „Markierung als Textkarte hinzufügen“ verwenden. Ohne Textebene bleibt
          der vorhandene Bildausschnitt möglich.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
