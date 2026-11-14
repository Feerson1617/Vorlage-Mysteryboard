import { expect, it } from "vitest";
import source from "../examples/universal/content.json";
import {
  checkHelp,
  helpTemplate,
  HELP_PALETTE,
  METHOD_PRESETS,
} from "../src/core/help-authoring";
import {
  taskDocument,
  encodeDocument,
  readDocument,
} from "../src/core/documents";
import {
  draftFromContent,
  reviseDraft,
  retainCards,
  publishDraft,
} from "../src/core/authoring";
import { numberTextColor } from "../src/core/help";
const content = taskDocument(source).content;
it("Vorlagen geben fünf bearbeitbare Texte und zwei Systeme ohne fachliche Vorbelegung vor", () => {
  expect(METHOD_PRESETS).toHaveLength(5);
  for (const system of ["causes", "conflicts"] as const) {
    const groups = helpTemplate(system);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.color)).toEqual([
      "#2166ac",
      "#f5a623",
      "#287c43",
    ]);
    expect(groups.every((g) => g.cardIds.length === 0)).toBe(true);
    groups[0].cardIds.push(1);
    expect(helpTemplate(system)[0].cardIds).toEqual([]);
  }
  expect(helpTemplate("custom")).toEqual([]);
});
it("jede Palettenfarbe erreicht mit ihrer Nummerntextfarbe mindestens 4,5:1 Kontrast", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  for (const [, hex] of HELP_PALETTE) {
    const a = lum(hex),
      b = lum(numberTextColor(hex));
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
it("lokale unvollständige Gruppen liefern konkrete Fehler statt verlorener Eingaben", () => {
  const groups = helpTemplate("causes");
  groups[0].label = "";
  groups[1].color = groups[0].color;
  const before = structuredClone(groups);
  const checked = checkHelp(content, "Eigener Text", true, groups);
  expect(checked.issues.some((i) => i.field === "label" && i.group === 0)).toBe(
    true,
  );
  expect(checked.issues.some((i) => i.field === "color" && i.group === 1)).toBe(
    true,
  );
  expect(checked.issues.filter((i) => i.field === "cards")).toHaveLength(3);
  expect(groups).toEqual(before);
});
it("falsche Referenzen, doppelte Zuordnungen, ungültige Farben und mehr als sechs Gruppen scheitern", () => {
  for (const mutate of [
    (g: any) => g[0].cardIds.push(999),
    (g: any) => g[1].cardIds.push(1),
    (g: any) => (g[0].color = "red"),
    (g: any) => (g[1].label = g[0].label),
    (g: any) => g.push(...structuredClone(g), ...structuredClone(g)),
  ]) {
    const groups = helpTemplate("causes");
    groups.forEach((g, i) => (g.cardIds = [i + 1]));
    mutate(groups);
    expect(
      checkHelp(content, "Text", true, groups).issues.length,
    ).toBeGreaterThan(0);
  }
});
it("einzelne unmarkierte Karten sind erlaubt, deaktivierte Nummernhilfe bleibt formatkompatibel", () => {
  const groups = helpTemplate("conflicts");
  groups.forEach((g, i) => (g.cardIds = [i + 1]));
  const result = checkHelp(content, "", true, groups);
  expect(result.issues).toEqual([]);
  expect(result.help?.method).toBeUndefined();
  expect(result.help?.categories?.flatMap((g) => g.cardIds)).toEqual([1, 2, 3]);
  expect(checkHelp(content, " ", false, groups)).toEqual({
    help: undefined,
    issues: [],
  });
});
it("Hilfe übersteht Versionswechsel, Kartenlöschung und vollständigen Dokument-Rundlauf", () => {
  const before = taskDocument(source);
  const groups = helpTemplate("causes");
  groups.forEach((g, i) => (g.cardIds = [i + 1]));
  groups[0].cardIds.push(12);
  const help = checkHelp(
    content,
    "Eigenständig bearbeitet",
    true,
    groups,
  ).help!;
  let draft = reviseDraft(draftFromContent(content, "AB"), {
    ...content,
    help,
  });
  draft = reviseDraft(
    draft,
    retainCards(
      draft.content,
      content.cards.filter((c) => c.id !== 1).map((c) => c.id),
    ),
  );
  const result = publishDraft(draft);
  expect(result.content.version).not.toBe(before.content.version);
  expect(
    result.content.help?.categories?.find((g) => g.id === "group1")?.cardIds,
  ).toEqual([11]);
  expect(readDocument(encodeDocument(before))).toEqual(before);
  expect(readDocument(encodeDocument(result))).toEqual(result);
});

it("gültig importierte individuelle Schreibweisen bleiben beim unveränderten Übernehmen vollständig erhalten", () => {
  const original = structuredClone(content);
  original.help = {
    method: "  Eigener Denkimpuls  ",
    categories: [
      { id: "a", label: "A", color: "#2166AC", cardIds: [1] },
      { id: "b", label: "a", color: "#F5A623", cardIds: [2] },
    ],
  };
  const doc = taskDocument(original);
  const result = checkHelp(
    doc.content,
    doc.content.help!.method!,
    true,
    doc.content.help!.categories!,
  );
  expect(result.issues).toEqual([]);
  expect(result.help).toEqual(doc.content.help);
});
