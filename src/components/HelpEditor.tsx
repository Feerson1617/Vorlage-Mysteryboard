import { useEffect, useRef, useState } from "react";
import type { Content } from "../core/documents";
import { validateContent } from "../core/documents";
import {
  cardNumber,
  withTeam,
  type HelpCategory,
  type HelpConfig,
} from "../core/model";
import { DEFAULT_METHOD_HELP, numberTextColor } from "../core/help";
import {
  checkHelp,
  assignHelpCards,
  matchesHelpCard,
  ambiguousHelpNames,
  helpTemplate,
  HELP_PALETTE,
  METHOD_PRESETS,
  SYSTEM_LABELS,
  type HelpSystem,
  type HelpIssue,
} from "../core/help-authoring";
import { initialBoardWork } from "../core/layout";
import App from "../App";
import { Dialog } from "./Dialog";

export function HelpEditor({
  content,
  onApply,
  onCancel,
}: {
  content: Content;
  onApply: (help: HelpConfig | undefined) => boolean;
  onCancel: () => void;
}) {
  const initial = useRef({
    method: content.help?.method ?? "",
    enabled: !!content.help?.categories,
    groups: structuredClone(content.help?.categories ?? []),
  });
  const [method, setMethod] = useState(initial.current.method),
    [enabled, setEnabled] = useState(initial.current.enabled),
    [groups, setGroups] = useState(initial.current.groups);
  const [preset, setPreset] = useState(
      initial.current.method ? "custom" : "default",
    ),
    [system, setSystem] = useState<HelpSystem>("custom");
  const customMethod = useRef(initial.current.method),
    savedSystems = useRef<Partial<Record<HelpSystem, HelpCategory[]>>>({
      custom: structuredClone(initial.current.groups),
    });
  const [pending, setPending] = useState<HelpSystem | null>(null),
    [remove, setRemove] = useState<string | null>(null),
    [issues, setIssues] = useState<HelpIssue[]>([]),
    [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Content | null>(null);
  const [query, setQuery] = useState(""),
    [bulk, setBulk] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [bulkGroup, setBulkGroup] = useState("");
  const visibleCards = content.cards.filter((c) =>
    matchesHelpCard(content, c, query),
  );
  const toggleBulk = () => {
    setBulk((v) => !v);
    setSelected([]);
    setBulkGroup("");
  };
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const changed =
    JSON.stringify({ method, enabled, groups }) !==
    JSON.stringify(initial.current);
  const cancel = () => {
    if (!changed || confirm("Nicht übernommene Hilfeänderungen verwerfen?"))
      onCancel();
  };
  const selectSystem = (next: HelpSystem) => {
    savedSystems.current[system] = structuredClone(groups);
    setGroups(
      structuredClone(savedSystems.current[next] ?? helpTemplate(next)),
    );
    setSystem(next);
    setPending(null);
    setRemove(null);
    setIssues([]);
  };
  const requestSystem = (next: HelpSystem) => {
    if (next === system) return;
    if (
      groups.some((g) => g.cardIds.length) ||
      JSON.stringify(groups) !==
        JSON.stringify(savedSystems.current[system] ?? helpTemplate(system))
    )
      setPending(next);
    else selectSystem(next);
  };
  const checked = () => {
    const result = checkHelp(content, method, enabled, groups);
    if (enabled) result.issues.push(...ambiguousHelpNames(groups));
    setIssues(result.issues);
    if (result.issues.length)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('.help-editor [aria-invalid="true"]')
          ?.focus(),
      );
    return result;
  };
  const apply = () => {
    const result = checked();
    if (!result.issues.length) onApply(result.help);
  };
  const showPreview = () => {
    const result = checked();
    if (result.issues.length) return;
    if (!content.title.trim() || !content.cards.length) {
      setMessage(
        "Gebt eurem Mystery zuerst einen Titel und fügt mindestens eine Karte hinzu.",
      );
      return;
    }
    const next = { ...content };
    if (result.help) next.help = result.help;
    else delete next.help;
    setMessage("");
    setPreview(validateContent(next));
  };
  const fieldError = (group: number, field: HelpIssue["field"]) =>
    issues.find((e) => e.group === group && e.field === field);
  const update = (i: number, patch: Partial<HelpCategory>) => {
    setGroups(groups.map((g, n) => (n === i ? { ...g, ...patch } : g)));
    setIssues([]);
  };
  return (
    <section className="help-editor" aria-label="Hilfen für Lernende">
      <h2 ref={heading} tabIndex={-1}>
        Hilfen für Lernende
      </h2>
      <h3>1. Hilfetext festlegen</h3>
      <label>
        Denkimpuls auswählen
        <select
          value={preset}
          onChange={(e) => {
            if (preset === "custom") customMethod.current = method;
            const next = e.target.value;
            setPreset(next);
            setMethod(
              next === "default"
                ? ""
                : next === "custom"
                  ? customMethod.current
                  : METHOD_PRESETS[Number(next)][1],
            );
            setIssues([]);
          }}
        >
          <option value="default">Allgemeiner Denkimpuls</option>
          {METHOD_PRESETS.map(([name], i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
          <option value="custom">Eigener Hilfetext</option>
        </select>
      </label>
      <label>
        Hilfetext
        <textarea
          rows={4}
          maxLength={500}
          value={method}
          placeholder={DEFAULT_METHOD_HELP}
          onChange={(e) => {
            setMethod(e.target.value);
            customMethod.current = e.target.value;
            setPreset("custom");
            setIssues([]);
          }}
        />
      </label>
      <p className="small">
        Ohne eigenen Text erscheint der allgemeine Denkimpuls.
      </p>
      <h3>2. Farbige Nummernorientierung</h3>
      <label className="help-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setIssues([]);
          }}
        />
        Kartennummern als Hilfe markieren
      </label>
      {!enabled && groups.length > 0 && (
        <p className="small">
          Beim Übernehmen ohne farbige Hilfe entfallen die bisherigen
          Markierungen in dieser Fassung. Bis dahin könnt ihr sie hier wieder
          einschalten.
        </p>
      )}
      {enabled && (
        <>
          <label>
            Gruppen auswählen
            <select
              value={system}
              onChange={(e) => requestSystem(e.target.value as HelpSystem)}
            >
              {Object.entries(SYSTEM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {pending && (
            <div className="help-confirm" role="status">
              <p>
                Zu „{SYSTEM_LABELS[pending]}“ wechseln? Ihr könnt die bisherigen
                Gruppen und Zuordnungen hier wieder auswählen, solange ihr diese
                Hilfe bearbeitet. In die Schülerversion wird nur die zuletzt
                gewählte Gruppierung übernommen.
              </p>
              <button onClick={() => selectSystem(pending)}>
                Vorlage wechseln
              </button>
              <button onClick={() => setPending(null)}>Beibehalten</button>
            </div>
          )}
          <p className="small">
            Die Vorlagen sind Beispiele. Die Karten werden erst durch eure
            Auswahl zugeordnet.
          </p>
          <div className="help-groups">
            {groups.map((g, i) => (
              <fieldset
                key={g.id}
                tabIndex={-1}
                aria-invalid={!!fieldError(i, "cards")}
                aria-describedby={
                  fieldError(i, "cards") ? `help-cards-${i}` : undefined
                }
              >
                <legend>Gruppe {i + 1}</legend>
                <label>
                  Gruppenname
                  <input
                    aria-label={`Name Gruppe ${i + 1}`}
                    maxLength={60}
                    value={g.label}
                    aria-invalid={!!fieldError(i, "label")}
                    aria-describedby={
                      fieldError(i, "label") ? `help-name-${i}` : undefined
                    }
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </label>
                {fieldError(i, "label") && (
                  <p className="field-error" id={`help-name-${i}`}>
                    {fieldError(i, "label")!.message}
                  </p>
                )}
                <label>
                  Farbe
                  <select
                    aria-label={`Farbe Gruppe ${i + 1}`}
                    value={g.color.toLowerCase()}
                    aria-invalid={!!fieldError(i, "color")}
                    aria-describedby={
                      fieldError(i, "color") ? `help-color-${i}` : undefined
                    }
                    onChange={(e) => update(i, { color: e.target.value })}
                  >
                    {!HELP_PALETTE.some(
                      ([, c]) => c === g.color.toLowerCase(),
                    ) && (
                      <option value={g.color.toLowerCase()}>
                        Vorhandene Farbe {g.color}
                      </option>
                    )}
                    {HELP_PALETTE.map(([name, color]) => (
                      <option key={color} value={color}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <span
                  className="help-number-preview"
                  style={{
                    backgroundColor: g.color,
                    color: numberTextColor(g.color),
                  }}
                  aria-label={`Nummernfarbe Gruppe ${i + 1}`}
                >
                  12
                </span>
                {fieldError(i, "color") && (
                  <p className="field-error" id={`help-color-${i}`}>
                    {fieldError(i, "color")!.message}
                  </p>
                )}
                {fieldError(i, "cards") && (
                  <p className="field-error" id={`help-cards-${i}`}>
                    {fieldError(i, "cards")!.message}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (g.cardIds.length) setRemove(g.id);
                    else {
                      setGroups(groups.filter((_, n) => n !== i));
                      setIssues([]);
                    }
                  }}
                >
                  Gruppe {i + 1} entfernen
                </button>
              </fieldset>
            ))}
          </div>
          {remove !== null && groups.some((g) => g.id === remove) && (
            <div className="help-confirm" role="status">
              <p>
                Gruppe „
                {groups.find((g) => g.id === remove)!.label || "Ohne Namen"}“
                entfernen? Ihre Karten verlieren diese Markierung.
              </p>
              <button
                onClick={() => {
                  setGroups(groups.filter((g) => g.id !== remove));
                  setRemove(null);
                  setIssues([]);
                }}
              >
                Gruppe entfernen bestätigen
              </button>
              <button onClick={() => setRemove(null)}>Beibehalten</button>
            </div>
          )}
          <button
            disabled={groups.length >= 6}
            onClick={() => {
              let n = 1;
              while (groups.some((g) => g.id === `group${n}`)) n++;
              setGroups([
                ...groups,
                {
                  id: `group${n}`,
                  label: "",
                  color: HELP_PALETTE.find(
                    ([, c]) => !groups.some((g) => g.color.toLowerCase() === c),
                  )![1],
                  cardIds: [],
                },
              ]);
              setIssues([]);
            }}
          >
            Gruppe hinzufügen
          </button>
          <p className="small">{groups.length} von höchstens 6 Gruppen.</p>
          <h3>Karten zuordnen</h3>
          <p>
            Ordnet nur Karten zu, deren Funktion ihr fachlich begründen könnt.
            Eine Karte kann mehrere Zusammenhänge haben. Nicht alle Karten
            müssen markiert werden.
          </p>
          <p className="small">
            Wählt einen passenden Schwerpunkt oder lasst die Karte unmarkiert.
          </p>
          <label>
            Karten suchen (Nummer oder Titel)
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="small" role="status">
            {visibleCards.length} von {content.cards.length} Karten angezeigt.
          </p>
          {query && (
            <button onClick={() => setQuery("")}>Suche zurücksetzen</button>
          )}
          <button aria-expanded={bulk} onClick={toggleBulk}>
            {bulk
              ? "Mehrfachzuordnung schließen"
              : "Mehrere Karten gemeinsam zuordnen"}
          </button>
          {bulk && (
            <div className="help-bulk">
              <label>
                Gemeinsame Farbgruppe
                <select
                  value={
                    groups.some((g) => g.id === bulkGroup) ? bulkGroup : ""
                  }
                  onChange={(e) => setBulkGroup(e.target.value)}
                >
                  <option value="">Gruppe auswählen</option>
                  {groups.map((g, i) => (
                    <option key={g.id} value={g.id}>
                      {g.label || `Gruppe ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="small" role="status">
                {selected.length} Karten ausgewählt
                {" · "}
                {
                  selected.filter(
                    (id) => !visibleCards.some((c) => c.id === id),
                  ).length
                }{" "}
                davon außerhalb der Suche. Vorherige Zuordnungen dieser Karten
                werden ersetzt.
              </p>
              <button
                disabled={
                  !selected.length || !groups.some((g) => g.id === bulkGroup)
                }
                onClick={() => {
                  setGroups(assignHelpCards(groups, selected, bulkGroup));
                  setMessage(`${selected.length} Karten gemeinsam zugeordnet.`);
                  setSelected([]);
                  setIssues([]);
                }}
              >
                Ausgewählte Karten zuordnen
              </button>
              <button
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                Auswahl aufheben
              </button>
            </div>
          )}
          <ul className="help-card-assignments">
            {visibleCards.map((c) => {
              const category = groups.find((g) => g.cardIds.includes(c.id));
              return (
                <li key={c.id}>
                  {bulk && (
                    <label className="help-bulk-check">
                      <input
                        type="checkbox"
                        aria-label={`Karte ${cardNumber(content, c.id)} gemeinsam zuordnen`}
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, c.id]
                              : selected.filter((id) => id !== c.id),
                          )
                        }
                      />
                    </label>
                  )}
                  <span
                    className="help-number-preview"
                    style={{
                      backgroundColor: category?.color ?? "#345943",
                      color: category
                        ? numberTextColor(category.color)
                        : "#fff",
                    }}
                    aria-label={`Vorschau Nummer ${cardNumber(content, c.id)}`}
                  >
                    {cardNumber(content, c.id)}
                  </span>
                  <label>
                    <span>{c.title || "Ohne Überschrift"}</span>
                    <select
                      aria-label={`Hilfe für Karte ${cardNumber(content, c.id)}`}
                      value={category?.id ?? ""}
                      onChange={(e) => {
                        setGroups(
                          assignHelpCards(groups, [c.id], e.target.value),
                        );
                        setIssues([]);
                      }}
                    >
                      <option value="">Keine Zuordnung</option>
                      {groups.map((g, i) => (
                        <option key={g.id} value={g.id}>
                          {g.label || `Gruppe ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {issues.length > 0 && (
        <div role="alert" className="field-error">
          <p>
            Die Änderungen konnten noch nicht übernommen werden. Bitte prüft die
            markierten Angaben.
          </p>
          {issues
            .filter((i) => i.group === undefined)
            .map((i, n) => (
              <p key={n}>{i.message}</p>
            ))}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <div className="actions">
        <button onClick={showPreview}>Hilfe aus Schülersicht ansehen</button>
        <button className="primary" onClick={apply}>
          Hilfe übernehmen
        </button>
        <button onClick={cancel}>Abbrechen</button>
      </div>
      {preview && (
        <Dialog title="Hilfe aus Schülersicht" onClose={() => setPreview(null)}>
          <p className="small">
            Probiert Karten und Verbindungen aus. Diese Bewegungen bleiben nur
            in der Vorschau.
          </p>
          <button onClick={() => setPreview(null)}>Zurück zu den Hilfen</button>
          <div className="student-help-preview">
            <App
              mode="preview"
              mystery={preview}
              loadedWork={withTeam(
                initialBoardWork(preview, {
                  width: window.innerWidth,
                  height: window.innerHeight - 120,
                }),
                "Vorschau",
              )}
              initialHelpOpen
            />
          </div>
        </Dialog>
      )}
    </section>
  );
}
