import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  button,
  openUniversal,
  getFile,
  importMystery,
} from "./authoring-helpers";
import original from "../fixtures/document-import/ORIGINAL-INHALTE.json" with { type: "json" };
test.use({ hasTouch: true });
async function choose(page: Page, index: number) {
  await button(page, "Karten ansehen").tap();
  await page
    .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
    .selectOption(String(index));
}
async function start(page: Page) {
  await openUniversal(page);
  await button(page, "Eigenes Mystery erstellen").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await button(page, "Dokument importieren").tap();
  await page
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(
      resolve("tests/fixtures/document-import/B-Word-Medien-Tabelle.docx"),
    );
  await expect(
    page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
  ).toBeVisible({ timeout: 45000 });
}
async function apply(page: Page) {
  await button(page, "Weiter zur Übernahme").tap();
  await page
    .getByRole("checkbox", {
      name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
      exact: true,
    })
    .check();
  await button(page, "Geprüfte Karten übernehmen").tap();
}
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
]) {
  test(`Split/Merge ${viewport.width}x${viewport.height}: originale Zeichen, Quellen, Bilder, Tabelle und V-Karte im echten Entwurf und Aufgaben-Download`, async ({
    browser,
  }, info) => {
    test.setTimeout(90000);
    const context = await browser.newContext({ viewport, hasTouch: true }),
      page = await context.newPage();
    await start(page);
    const body = page.getByRole("textbox", { name: "Kartentext", exact: true });
    const source = page.getByRole("textbox", {
      name: "Quellenangabe",
      exact: true,
    });
    const expected = original.B.map((c) => ({
      title: c.title,
      source: c.source,
      group: c.extension ? "extension" : "required",
    }));
    const texts = original.B.map((c) => c.paragraphs.join("\n\n"));
    const cases = [
      { card: 0, text: "Material 1", at: 7, kind: "mitten im Wort, Bild" },
      { card: 0, text: "Material 1", at: 8, kind: "Wortzwischenraum" },
      {
        card: 1,
        text: "Erster Absatz.\n\nZweiter Absatz.",
        at: 14,
        kind: "vor Absatz",
      },
      {
        card: 1,
        text: "Erster Absatz.\n\nZweiter Absatz.",
        at: 15,
        kind: "im Umbruch",
      },
      {
        card: 1,
        text: "Erster Absatz.\n\nZweiter Absatz.",
        at: 16,
        kind: "nach Absatz",
      },
      { card: 2, text: texts[2], at: 8, kind: "strukturierte Tabelle" },
      { card: 4, text: texts[4], at: 7, kind: "mehrzeiliger Quellentext" },
      { card: 5, text: texts[5], at: 7, kind: "Vertiefungskarte" },
    ];
    for (const c of cases) {
      await choose(page, c.card);
      await body.fill(c.text);
      texts[c.card] = c.text;
      if (c.card === 4) {
        expected[4].source = "Quelle A\n\nQuelle B";
        await source.fill(expected[4].source);
      }
      await body.evaluate(
        (e: HTMLTextAreaElement, at) => e.setSelectionRange(at, at),
        c.at,
      );
      const unexpected: string[] = [];
      const dismiss = (dialog: any) => {
        unexpected.push(dialog.message());
        void dialog.dismiss();
      };
      page.on("dialog", dismiss);
      await button(page, "Karte am Textcursor teilen").tap();
      await expect(
        page
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option"),
      ).toHaveCount(7);
      await button(page, "Mit nächster Karte zusammenfügen").tap();
      await expect(body, c.kind).toHaveValue(c.text);
      await expect(source, c.kind).toHaveValue(expected[c.card].source);
      await expect(
        page
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option"),
      ).toHaveCount(6);
      page.off("dialog", dismiss);
      expect(unexpected, c.kind).toEqual([]);
    }
    await apply(page);
    await button(page, "Entwurf sichern").tap();
    const draft = await getFile(
      page,
      info,
      `import-integrity-${viewport.width}-entwurf.mysteryboard`,
    );
    const cards = draft.document.content.cards;
    for (let i = 0; i < cards.length; i++) {
      expect(cards[i].title).toBe(expected[i].title);
      expect(cards[i].source).toBe(expected[i].source);
      expect(cards[i].group).toBe(expected[i].group);
      if (i !== 3) expect(cards[i].text).toBe(texts[i]);
    }
    expect(cards[2].table).toEqual(original.table);
    for (const [i, filename] of [
      [0, "bild-1.png"],
      [1, "bild-2.jpeg"],
    ] as const) {
      const image = await readFile(
        resolve("tests/fixtures/document-import", filename),
      );
      expect(Buffer.from(cards[i].image!.split(",")[1], "base64")).toEqual(
        image,
      );
    }
    await context.close();
    const fresh = await browser.newContext({ viewport, hasTouch: true }),
      p2 = await fresh.newPage();
    await openUniversal(p2);
    await importMystery(p2, draft.bytes);
    await button(p2, "Schülerversion erstellen").tap();
    const task = await getFile(
      p2,
      info,
      `import-integrity-${viewport.width}-aufgabe.mysteryboard`,
    );
    expect(task.document.content).toEqual(draft.document.content);
    expect(task.document.content.cards[0].text).toBe("Material 1");
    expect(task.document.content.cards[0].source).toBe(
      "Eigene technische Vorlage B1.",
    );
    await fresh.close();
  });
}
test("Unklare Zusammenführung warnt, Abbrechen erhält beide Karten; verschiedene Quellen bleiben im Download", async ({
  page,
}, info) => {
  await start(page);
  const source = page.getByRole("textbox", {
    name: "Quellenangabe",
    exact: true,
  });
  const body = page.getByRole("textbox", { name: "Kartentext", exact: true });
  // Independent original cards 3/4 have compatible table/no image, different sources.
  await choose(page, 2);
  const before = await body.inputValue();
  page.once("dialog", async (d) => {
    expect(d.message()).toContain("nicht eindeutig");
    await d.dismiss();
  });
  await button(page, "Mit nächster Karte zusammenfügen").tap();
  await expect(body).toHaveValue(before);
  await expect(source).toHaveValue(original.B[2].source);
  page.once("dialog", (d) => d.accept());
  await button(page, "Mit nächster Karte zusammenfügen").tap();
  await expect(source).toHaveValue(
    original.B[2].source + "\n" + original.B[3].source,
  );
  await expect(body).toHaveValue(new RegExp("Karte 4: Material 4"));
  await apply(page);
  await button(page, "Entwurf sichern").tap();
  const saved = await getFile(
    page,
    info,
    "import-integrity-eigenstaendige-karten.mysteryboard",
  );
  expect(saved.document.content.cards[2].source).toBe(
    original.B[2].source + "\n" + original.B[3].source,
  );
  expect(saved.document.content.cards[2].table).toEqual(original.table);
});
