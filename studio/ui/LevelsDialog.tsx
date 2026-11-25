import { useRef, useState } from "react";
import { Dialog } from "../../src/components/Dialog";
import { draftFromContent, reviseDraft } from "../../src/core/authoring";
import {
  levelFrom,
  setCollectionRecovery,
  type RecoveryMode,
  MAX_LEVELS,
  newStudioDraft,
  readProject,
  validateCollection,
  type Collection,
  type Level,
} from "../../src/core/levels";
export function LevelsDialog({
  initial,
  onApply,
  onClose,
}: {
  initial: Collection;
  onApply: (c: Collection) => void;
  onClose: () => void;
}) {
  const [c, set] = useState(initial),
    [error, fail] = useState("");
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const index = c.levels.findIndex((l) => l.id === c.active),
    level = c.levels[index];
  const modified =
    c.title !== initial.title ||
    c.defaultRecovery !== initial.defaultRecovery ||
    c.levels.length !== initial.levels.length ||
    c.levels.some((l, i) => {
      const old = initial.levels[i];
      return (
        l.id !== old.id ||
        l.name !== old.name ||
        l.description !== old.description ||
        l.usesDefault !== old.usesDefault ||
        l.draft !== old.draft
      );
    });
  function update(data: Partial<Level>) {
    set({
      ...c,
      levels: c.levels.map((l) => (l === level ? { ...l, ...data } : l)),
    });
  }
  function add(l: Level) {
    setEdit(true);
    if (c.levels.length < MAX_LEVELS)
      set({ ...c, active: l.id, levels: [...c.levels, l] });
  }
  function reorder(offset: number) {
    const items = c.levels.slice();
    items.splice(index, 1);
    items.splice(index + offset, 0, level);
    set({ ...c, levels: items });
  }
  return (
    <Dialog
      title="Niveaus verwalten"
      onClose={() => {
        if (
          !loading &&
          (!modified || confirm("Änderungen an den Niveaus verwerfen?"))
        )
          onClose();
      }}
    >
      {loading && <p role="status">Niveau wird eingelesen …</p>}
      <fieldset
        disabled={loading}
        aria-label="Niveauverwaltung"
        className="level-fields"
      >
        <label>
          Projekttitel
          <input
            value={c.title}
            maxLength={100}
            onChange={(e) => set({ ...c, title: e.target.value })}
          />
        </label>
        <div
          className="level-list"
          role="group"
          aria-label="Vorhandene Niveaus"
        >
          {c.levels.map((l) => (
            <button
              key={l.id}
              aria-pressed={l.id === c.active}
              onClick={() => {
                set({ ...c, active: l.id });
                setEdit(false);
              }}
            >
              <strong>{l.name}</strong>
              <span>
                {l.draft.content.cards.length} Karten
                {l.id === c.active ? " · ausgewählt" : ""}
              </span>
              {l.description && <small>{l.description}</small>}
            </button>
          ))}
        </div>
        <button aria-expanded={edit} onClick={() => setEdit(!edit)}>
          Niveauoptionen
        </button>
        {edit && (
          <>
            <label>
              Niveaubezeichnung
              <input
                maxLength={60}
                value={level.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Kurzbeschreibung
              <input
                maxLength={300}
                value={level.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <div className="actions">
              <button disabled={index === 0} onClick={() => reorder(-1)}>
                Nach oben
              </button>
              <button
                disabled={index === c.levels.length - 1}
                onClick={() => reorder(1)}
              >
                Nach unten
              </button>
              <button
                disabled={c.levels.length === 1}
                onClick={() => {
                  if (confirm("Dieses Niveau mit allen Karten löschen?")) {
                    const levels = c.levels.filter((l) => l !== level);
                    set({ ...c, levels, active: levels[0].id });
                  }
                }}
              >
                Niveau löschen
              </button>
            </div>
          </>
        )}
        <div className="actions">
          <button
            disabled={c.levels.length >= MAX_LEVELS}
            onClick={() => {
              const mode = c.defaultRecovery ?? "off",
                base = newStudioDraft(level.draft.author.initials);
              const next = levelFrom(
                base,
                c.id,
                "Niveau " + (c.levels.length + 1),
              );
              next.draft = reviseDraft(next.draft, {
                ...next.draft.content,
                title: (c.title + " – " + next.name).slice(0, 100),
                recovery: mode,
                design: level.draft.content.design,
              });
              add({ ...next, usesDefault: true });
            }}
          >
            Niveau hinzufügen
          </button>
          <button
            disabled={c.levels.length >= MAX_LEVELS}
            onClick={() => {
              const next = levelFrom(
                level.draft,
                c.id,
                level.name.slice(0, 51) + " – Kopie",
              );
              next.draft = reviseDraft(next.draft, {
                ...next.draft.content,
                title:
                  (level.draft.content.title || c.title).slice(0, 86) +
                  " – Kopie " +
                  (c.levels.length + 1),
              });
              add({
                ...next,
                description: level.description,
                usesDefault: level.usesDefault,
              });
            }}
          >
            Niveau duplizieren
          </button>
          <button
            disabled={c.levels.length >= MAX_LEVELS}
            onClick={() => file.current?.click()}
          >
            Mystery als Niveau importieren
          </button>
        </div>
        <input
          ref={file}
          hidden
          type="file"
          accept=".mysteryboard,.png"
          aria-label="Mystery als Niveau"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setLoading(true);
            try {
              if (f.size > 30_000_000)
                throw Error("Die Datei überschreitet 30 MB.");
              const doc = readProject(new Uint8Array(await f.arrayBuffer()));
              if (
                doc.format === "MysteryBoardCollection" ||
                doc.kind === "student"
              )
                throw Error(
                  "Bitte einen einzelnen Entwurf oder eine veröffentlichte Aufgabe wählen.",
                );
              add(
                levelFrom(
                  doc.kind === "draft"
                    ? doc
                    : draftFromContent(
                        doc.content,
                        level.draft.author.initials,
                      ),
                  c.id,
                  doc.content.title.slice(0, 60) || "Import",
                ),
              );
              fail("");
            } catch (e) {
              fail((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        />
        <details className="level-defaults">
          <summary>Speicherung im Projekt</summary>
          <label>
            Voreinstellung für Niveaus
            <select
              value={c.defaultRecovery ?? ""}
              onChange={(e) =>
                set(
                  setCollectionRecovery(
                    c,
                    e.target.value as RecoveryMode,
                    false,
                  ),
                )
              }
            >
              {c.defaultRecovery === undefined && (
                <option value="" disabled>
                  Bisherige Einzelwerte
                </option>
              )}
              <option value="off">Ausgeschaltet</option>
              <option value="session">Während der Browsersitzung</option>
              <option value="extended">
                Erweitert · drei Stunden auf diesem Gerät
              </option>
            </select>
          </label>
          <p>
            Die Voreinstellung gilt für neue und verknüpfte Niveaus.
            Individuelle Einstellungen bleiben erhalten.
          </p>
          {c.defaultRecovery === "extended" && (
            <p>
              Nur mit schulischer Freigabe. Weitere Gruppen am Gerät können
              einen Stand auswählen.
            </p>
          )}
          <button
            disabled={
              !c.defaultRecovery || c.levels.every((l) => l.usesDefault)
            }
            onClick={() => {
              if (
                c.defaultRecovery &&
                confirm(
                  "Die Speicheroption für alle Niveaus übernehmen und individuelle Einstellungen ersetzen?",
                )
              )
                set(setCollectionRecovery(c, c.defaultRecovery, true));
            }}
          >
            Auf alle Niveaus anwenden
          </button>
        </details>
        {new Set(c.levels.map((l) => l.draft.content.title)).size !==
          c.levels.length && (
          <p>
            Gleiche Mystery-Titel ergeben bei gleicher Gruppe denselben
            PNG-Dateinamen.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          onClick={() => {
            try {
              onApply(validateCollection(c));
            } catch (e) {
              fail((e as Error).message);
            }
          }}
        >
          Niveau bearbeiten
        </button>
      </fieldset>
    </Dialog>
  );
}
