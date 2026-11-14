import { useState } from "react";
export function MediaView({ src, alt }: { src: string; alt?: string }) {
  const [expanded, setExpanded] = useState(false),
    [zoom, setZoom] = useState(1);
  return (
    <section className="media-view">
      <img src={src} alt={alt || "Bild zur Karte"} />
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Bildvergrößerung schließen" : "Bild vergrößern"}
      </button>
      {expanded && (
        <>
          <label>
            Bildvergrößerung{" "}
            <input
              type="range"
              min="1"
              max="4"
              step="0.25"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <p className="small">
            Mit dem Regler vergrößern, danach das Bild seitlich oder nach unten
            verschieben. Die Arbeitsfläche bleibt unverändert.
          </p>
          <div
            className="media-scroll"
            tabIndex={0}
            aria-label="Vergrößertes Bild"
          >
            <img
              src={src}
              alt={alt || "Vergrößertes Bild zur Karte"}
              style={{
                width: `${zoom * 100}%`,
                maxWidth: "none",
                maxHeight: "none",
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
