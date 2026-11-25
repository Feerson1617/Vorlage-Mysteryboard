import { describe, it, expect } from "vitest";
import {
  collectionFrom,
  levelFrom,
  withLevel,
  encodeCollection,
  readProject,
  newStudioDraft,
} from "../src/core/levels";
import { newDraft, reviseDraft } from "../src/core/authoring";
import { encodeDocument, readDocument } from "../src/core/documents";
import { collectionScorm } from "../studio/ui/collection-scorm";
import { unzipSync, strFromU8 } from "fflate";
describe("Niveaus und historische Einzelprojekte", () => {
  it("lässt alte Entwürfe ohne Speicherfreigabe und startet neue in der Sitzung", () => {
    const old = newDraft("LK");
    expect(readProject(encodeDocument(old))).toEqual(old);
    expect(old.content.recovery).toBeUndefined();
    expect(newStudioDraft("LK").content.recovery).toBe("session");
  });
  for (const count of [1, 2, 4, 12])
    it(
      "erhält alle unabhängigen Entwürfe und veröffentlicht nur öffentliche Daten bei " +
        count +
        " Niveaus",
      async () => {
        let d = newStudioDraft("PRIVATE-LK");
        const cards = [
          { id: 1, title: "Beobachtung", group: "required", text: "Sichtbar" },
          {
            id: 2,
            title: "Nicht freigegeben",
            group: "required",
            text: "PRIVATE-KARTE",
          },
        ];
        d = reviseDraft(
          d,
          {
            ...d.content,
            title: "Klima",
            cards,
            initial: {
              ...d.content.initial,
              cards: cards.map((c) => ({ id: c.id, x: 0, y: 0, color: 0 })),
            },
          },
          { ...d.author, hiddenCards: [2] },
        );
        let c = collectionFrom(d);
        for (let i = 1; i < count; i++)
          c.levels.push(levelFrom(d, c.id, "Stufe " + i));
        c = withLevel(
          c,
          reviseDraft(c.levels[0].draft, {
            ...c.levels[0].draft.content,
            title: "Aktualisiert",
          }),
        );
        expect(readProject(encodeCollection(c))).toEqual(c);
        expect(() => readDocument(encodeCollection(c))).toThrow();
        expect(
          c.levels.slice(1).every((l) => l.draft.content.title === "Klima"),
        ).toBe(true);
        const zip = collectionScorm(c, "<body></body>", "START", "LMS");
        const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
        expect(Object.keys(entries)).toHaveLength(4 + count);
        for (const l of c.levels) {
          const file = "level-" + l.id + ".json";
          expect(strFromU8(entries["imsmanifest.xml"])).toContain(
            'href="' + file + '"',
          );
          const json = strFromU8(entries[file]);
          expect(json).not.toMatch(/PRIVATE-/);
          expect(readDocument(entries[file]).content.cards).toHaveLength(1);
        }
        expect(strFromU8(entries["app.html"])).not.toContain("Sichtbar");
        expect(() =>
          encodeCollection({ ...c, levels: [c.levels[0], c.levels[0]] }),
        ).toThrow();
      },
    );
});
