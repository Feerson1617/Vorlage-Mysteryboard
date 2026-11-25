import { useRef, useState } from "react";
import { Dialog } from "../../src/components/Dialog";
import { draftFromContent } from "../../src/core/authoring";
import {
  levelFrom,
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
  const file = useRef<HTMLInputElement>(null);
  const index = c.levels.findIndex((l) => l.id === c.active),
    level = c.levels[index];
  function update(data: Partial<Level>) {
    set({
      ...c,
      levels: c.levels.map((l) => (l === level ? { ...l, ...data } : l)),
    });
  }
  function add(l: Level) {
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
    <Dialog title="Niveaus verwalten" onClose={onClose}>
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
        <label>
          Niveau auswählen
          <select
            value={c.active}
            onChange={(e) => set({ ...c, active: e.target.value })}
          >
            {c.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
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
        <div className="actions">
          <button
            disabled={c.levels.length >= MAX_LEVELS}
            onClick={() =>
              add(
                levelFrom(
                  newStudioDraft(level.draft.author.initials),
                  c.id,
                  "Neues Niveau",
                ),
              )
            }
          >
            Niveau hinzufügen
          </button>
          <button
            disabled={c.levels.length >= MAX_LEVELS}
            onClick={() =>
              add({
                ...levelFrom(
                  level.draft,
                  c.id,
                  level.name.slice(0, 51) + " – Kopie",
                ),
                description: level.description,
              })
            }
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
