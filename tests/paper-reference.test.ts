import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import original from "../examples/ki-papierprobe/original-karten.json" with { type: "json" };
import expected from "../examples/ki-papierprobe/ERWARTETE-INHALTSSTRUKTUR.json" with { type: "json" };
import { readDocument } from "../src/core/documents";

test("Papieroriginal und digitale Referenz stimmen in jedem Text, Tabellenwert, Bild und Pflicht-/V-Metadatum überein", () => {
  const task = readDocument(
    readFileSync("examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard"),
  );
  const draft = readDocument(
    readFileSync(
      "examples/ki-papierprobe/Parkteich-Lehrkraftentwurf-v1.mysteryboard",
    ),
  );
  expect(task.kind).toBe("task");
  expect(draft.kind).toBe("draft");
  expect(task.content).toEqual(draft.content);
  expect(task.content.cards).toHaveLength(original.cards.length);
  expect(task.content.cards).toHaveLength(10);
  expect(task.contentHash).toBe(expected.contentHash);
  for (const source of original.cards) {
    const card = task.content.cards.find((c) => c.id === source.number)!;
    for (const key of ["title", "text", "source"] as const)
      expect(card[key]).toBe(source[key]);
    expect(card.group).toBe(
      source.kind === "Vertiefungskarte" ? "extension" : "required",
    );
    if (source.table) expect(card.table).toEqual(source.table);
    if (source.diagram) {
      const image = readFileSync("examples/ki-papierprobe/" + source.diagram);
      expect(card.image).toBe(
        "data:image/png;base64," + image.toString("base64"),
      );
      expect(createHash("sha256").update(image).digest("hex")).toBe(
        expected.cards.find((c) => c.id === card.id)!.imageSha256,
      );
      expect(card.imageAlt).toBe(source.imageAlt);
    }
  }
  expect(task.content.initial.edges).toEqual([]);
  expect(
    task.content.cards.filter((c) => c.group === "extension").map((c) => c.id),
  ).toEqual([10]);
  expect(expected.foreignAiTrial).toBe("OPEN");
});
