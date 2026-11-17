import { useEffect, useRef, useState } from "react";
import type { Task } from "../../src/core/documents";
import { Dialog } from "../../src/components/Dialog";
import { cutCards, type PrintResult, type PaperOptions } from "./cut-cards";
import fonts from "virtual:studio-fonts";
export function PdfExport({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<PaperOptions>({
    paper: "A4",
    landscape: false,
    cover: true,
    monochrome: false,
    question: task.content.title,
    instructions: task.content.subtitle || "",
  });
  const [result, setResult] = useState<PrintResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    controller.current = c;
    setResult(null);
    setError("");
    void cutCards(task, options, fonts, c.signal)
      .then((r) => {
        if (!c.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [task, options]);
  const change = (v: Partial<PaperOptions>) =>
    setOptions((o) => ({ ...o, ...v }));
  return (
    <Dialog title="Als Druck-PDF speichern" onClose={onClose}>
      <details>
        <summary>Druckoptionen</summary>
        <div className="studio-print-options">
          <label>
            Papier
            <select
              value={options.paper}
              onChange={(e) => change({ paper: e.target.value as "A4" | "A3" })}
            >
              <option>A4</option>
              <option>A3</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.landscape}
              onChange={(e) => change({ landscape: e.target.checked })}
            />
            Querformat
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.cover}
              onChange={(e) => change({ cover: e.target.checked })}
            />
            Titelseite mit Leitfrage und Arbeitsauftrag
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.monochrome}
              onChange={(e) => change({ monochrome: e.target.checked })}
            />
            Tintensparendes Schwarz-Weiß
          </label>
        </div>
        {options.cover && (
          <>
            <label>
              Leitfrage für Titelseite
              <input
                value={options.question}
                onChange={(e) => change({ question: e.target.value })}
                maxLength={1000}
              />
            </label>
            <label>
              Arbeitsauftrag für Titelseite
              <textarea
                value={options.instructions}
                onChange={(e) => change({ instructions: e.target.value })}
                maxLength={5000}
              />
            </label>
          </>
        )}
      </details>
      {error && <p role="alert">{error}</p>}
      {result ? (
        <>
          <p role="status">
            {result.cards} Karten · {result.pages} Seiten. Alle Seiten sind in
            der Vorschau durch Scrollen erreichbar.
          </p>
          {result.warnings.map((w) => (
            <p key={w} role="status">
              {w}
            </p>
          ))}
          <iframe
            title="Vollständige Druckvorschau"
            className="studio-pdf-preview"
            srcDoc={result.html}
            sandbox="allow-same-origin"
          />
          <button
            className="primary full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await window.mysteryStudio!.printPDF(result.html);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            PDF speichern
          </button>
        </>
      ) : (
        !error && (
          <p role="status">Druckseiten werden vollständig vorbereitet …</p>
        )
      )}
    </Dialog>
  );
}
