import { useState } from "react";
import { CopyIssues } from "./CopyIssues";
import { Dialog } from "../../src/components/Dialog";
import { importLevels, type ImportedProject } from "../exchange/import";
const storageLabels = {
  off: "ausgeschaltet",
  session: "während der Sitzung",
  extended: "erweitert lokal",
};
const count = (n: number, one: string, many: string) =>
  n + " " + (n === 1 ? one : many);
export function ExchangeReview({
  project,
  replacing,
  issues,
  onClose,
  onApply,
}: {
  project: ImportedProject;
  replacing: boolean;
  issues: string[];
  onClose: () => void;
  onApply: () => Promise<void>;
}) {
  const [consent, setConsent] = useState(false),
    [acceptDraft, setAcceptDraft] = useState(false),
    [busy, setBusy] = useState(false),
    [error, fail] = useState("");
  const levels = importLevels(project);
  const extended =
    levels.some((l) => l.draft.content.recovery === "extended") ||
    (project.format === "MysteryBoardCollection" &&
      project.defaultRecovery === "extended");
  return (
    <Dialog
      title="KI-Material prüfen"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="exchange-review">
        <div className="exchange-summary">
          <h3>
            {project.format === "MysteryBoardCollection"
              ? project.title
              : project.content.title}
          </h3>
          <strong>
            {issues.length
              ? "Entwurf · Korrekturen vor dem Export erforderlich"
              : "Technisch exportbereit"}
          </strong>
          <p>Bitte prüfe die fachlichen Aussagen und Quellen.</p>
        </div>
        <div className="exchange-scroll">
          {issues.length > 0 && (
            <>
              <p className="exchange-errors" role="alert">
                {issues.join("\n")}
              </p>
              <CopyIssues message={issues.join("\n")} />
            </>
          )}
          {project.format === "MysteryBoardCollection" && (
            <p>
              Voreinstellung für neue Niveaus:{" "}
              {storageLabels[project.defaultRecovery ?? "session"]}.
            </p>
          )}
          <ul className="exchange-levels">
            {levels.map(({ name, draft }, i) => {
              const c = draft.content;
              const media = c.cards.reduce(
                (n, k) => n + Number(!!k.image) + (k.extraImages?.length ?? 0),
                0,
              );
              const tables = c.cards.filter((k) => k.table).length;
              const materials = [
                count(c.cards.length, "Karte", "Karten"),
                media && count(media, "Bild", "Bilder"),
                tables && count(tables, "Tabelle", "Tabellen"),
              ].filter(Boolean);
              const hints = c.initial.edges.length,
                privateEdges = draft.author.edges?.length ?? 0;
              const help = [
                c.help?.method
                  ? "Eigener Denkimpuls"
                  : "Allgemeiner Denkimpuls",
                c.help?.categories?.length
                  ? count(
                      c.help.categories.length,
                      "Hilfekategorie",
                      "Hilfekategorien",
                    )
                  : "ohne Nummernhilfe",
              ];
              const connections = [
                hints &&
                  count(
                    hints,
                    "öffentliche Starthilfe",
                    "öffentliche Starthilfen",
                  ),
                privateEdges &&
                  count(
                    privateEdges,
                    "private Verbindung",
                    "private Verbindungen",
                  ),
                draft.author.hiddenCards.length &&
                  count(
                    draft.author.hiddenCards.length,
                    "ausgeblendete Karte",
                    "ausgeblendete Karten",
                  ),
              ].filter(Boolean);
              return (
                <li key={i}>
                  <details>
                    <summary>
                      <strong>{name}</strong> · {materials.join(" · ")}
                    </summary>
                    <p>
                      {help.join(" · ")} ·{" "}
                      {count(
                        c.cards.filter((k) => k.studentEditable).length,
                        "bearbeitbare Karte",
                        "bearbeitbare Karten",
                      )}
                      <br />
                      {connections.length
                        ? connections.join(" · ")
                        : "Keine vorgegebenen Verbindungen"}{" "}
                      · Speicherung {storageLabels[c.recovery ?? "session"]}
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
        <footer>
          {issues.length > 0 && (
            <label className="author-publication-confirmation">
              <input
                type="checkbox"
                checked={acceptDraft}
                onChange={(e) => setAcceptDraft(e.target.checked)}
              />
              Als bearbeitbaren Entwurf trotz offener Korrekturen übernehmen
            </label>
          )}
          {extended && (
            <label className="author-publication-confirmation">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Erweiterte lokale Speicherung wie angegeben zulassen (bis zu drei
              Stunden auf diesem Gerät).
            </label>
          )}
          {replacing && (
            <p>Mit der Übernahme ersetzt du das geöffnete Projekt.</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button disabled={busy} onClick={onClose}>
              Abbrechen
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                (extended && !consent) ||
                (!!issues.length && !acceptDraft)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await onApply();
                } catch (e) {
                  fail((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              Als Projekt übernehmen
            </button>
          </div>
        </footer>
      </div>
    </Dialog>
  );
}
