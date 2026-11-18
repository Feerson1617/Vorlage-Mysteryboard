import { useEffect, useRef, useState } from "react";
import type { Mystery, Work } from "../core/model";
import { preparePrintFrame } from "../core/print";

export function PrintPreview({
  work,
  mystery,
}: {
  work: Work;
  mystery: Mystery;
}) {
  const [paper, setPaper] = useState<"a4" | "a3">("a4");
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let current = true;
    setPages(null);
    setError("");
    const target = frame.current!;
    void preparePrintFrame(target, work, mystery, paper).then(
      ({ pageCount }) => {
        if (current) setPages(pageCount);
      },
      (reason: unknown) => {
        if (current)
          setError(
            `Die Druckfassung konnte nicht erstellt werden. ${reason instanceof Error ? reason.message : "Bitte versucht es erneut."} Euer Arbeitsstand bleibt erhalten.`,
          );
      },
    );
    return () => {
      current = false;
    };
  }, [work, mystery, paper]);

  return (
    <section className="print-preview">
      <p>
        Übersicht, lesbare Kartentexte und alle Beziehungen mit Seitenverweisen.
        Zum späteren Weiterarbeiten benötigt ihr weiterhin die Original-PNG über
        „Sichern“.
      </p>
      <div className="print-controls">
        <label>
          Papierformat
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as "a4" | "a3")}
          >
            <option value="a4">A4 quer</option>
            <option value="a3">A3 quer</option>
          </select>
        </label>
        <button
          className="primary"
          disabled={pages === null || !!error}
          onClick={() => {
            // Keep the prepared frame alive: Safari may return before printing ends.
            // The native print dialog opens only from this deliberate user action.
            try {
              frame.current!.contentWindow!.focus();
              frame.current!.contentWindow!.print();
            } catch {
              setError(
                "Der Druckdialog ist hier nicht verfügbar. Euer Arbeitsstand bleibt erhalten. Öffnet die Anwendung zum Drucken in einem Browser mit Druckfunktion.",
              );
            }
          }}
        >
          Drucken / PDF speichern
        </button>
      </div>
      <p className="small">
        Im Druckdialog dasselbe Papierformat und Querformat wählen. Dort könnt
        ihr auch als PDF speichern. Die Vorschau lässt sich seitlich und nach
        unten scrollen.
      </p>
      <p role={error ? "alert" : "status"} aria-live="polite">
        {error ||
          (pages === null
            ? "Die Druckseiten werden vorbereitet …"
            : `${pages} Seiten vorbereitet.`)}
      </p>
      {pages !== null && pages >= 30 && (
        <aside
          className="print-warning"
          role="note"
          aria-label="Umfangreicher Druckauftrag"
        >
          <strong>Achtung: {pages} Druckseiten.</strong> Prüft den Umfang und
          wählt im Druckdialog bei Bedarf einzelne Seiten oder speichert
          zunächst eine PDF.
        </aside>
      )}
      <iframe key={paper} ref={frame} title="Druckvorschau" />
    </section>
  );
}
