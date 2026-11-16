# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: release-candidate.spec.ts >> Release Candidate Papierprobe 1024x768: alle Originalfelder, Revision, SCORM und alte/neue PNG
- Location: tests/browser/release-candidate.spec.ts:19:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Auch Dateien von einer KI/)
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/Auch Dateien von einer KI/) with timeout 8000ms
  - waiting for getByText(/Auch Dateien von einer KI/)

```

```yaml
- main:
  - heading "MysteryBoard" [level=1]
  - paragraph: Öffnet eine Aufgabe oder setzt eure Arbeit fort.
  - button "Aufgabe öffnen"
  - button "Arbeit fortsetzen"
  - button "Lehrkräfteeditor"
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { readFile } from "node:fs/promises";
  3   | import { resolve } from "node:path";
  4   | import { readDocument } from "../../src/core/documents";
  5   | import {
  6   |   button,
  7   |   openUniversal,
  8   |   importMystery,
  9   |   getFile,
  10  | } from "./authoring-helpers";
  11  | import { scorm, png, project, connect, gestures } from "./help-runtime-helpers";
  12  | test.use({ hasTouch: true });
  13  | for (const viewport of [
  14  |   { width: 1024, height: 768 },
  15  |   { width: 768, height: 1024 },
  16  |   { width: 600, height: 800 },
  17  |   { width: 320, height: 700 },
  18  | ])
  19  |   test(`Release Candidate Papierprobe ${viewport.width}x${viewport.height}: alle Originalfelder, Revision, SCORM und alte/neue PNG`, async ({
  20  |     browser,
  21  |   }, info) => {
  22  |     test.setTimeout(180000);
  23  |     const input = await readFile(
  24  |       "examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard",
  25  |     );
  26  |     const source = readDocument(input);
  27  |     const context = await browser.newContext({ hasTouch: true, viewport }),
  28  |       page = await context.newPage();
  29  |     const filenames: string[] = [];
  30  |     page.on("download", (d) => filenames.push(d.suggestedFilename()));
  31  |     await openUniversal(page);
> 32  |     await expect(page.getByText(/Auch Dateien von einer KI/)).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  33  |     await importMystery(page, input);
  34  |     await page
  35  |       .getByLabel("Teamname oder Vornamen", { exact: true })
  36  |       .fill("Papierprobe original");
  37  |     await button(page, "Beginnen").tap();
  38  |     for (const c of source.content.cards) {
  39  |       await page.locator(`[data-number="${c.id}"]`).tap();
  40  |       await expect(page.locator(".reading h3")).toHaveText(c.title);
  41  |       await expect(page.locator(".reading > p").first()).toHaveText(c.text);
  42  |       await expect(page.locator(".reading > p.small")).toHaveText(
  43  |         "Quelle: " + c.source,
  44  |       );
  45  |       if (c.table) {
  46  |         await expect(page.locator(".reading caption")).toHaveText(
  47  |           c.table.caption!,
  48  |         );
  49  |         expect(await page.locator(".reading th").allTextContents()).toEqual(
  50  |           c.table.headers,
  51  |         );
  52  |         expect(
  53  |           await page
  54  |             .locator(".reading tbody tr")
  55  |             .evaluateAll((rows) =>
  56  |               rows.map((r) =>
  57  |                 [...r.querySelectorAll("td")].map((c) => c.textContent),
  58  |               ),
  59  |             ),
  60  |         ).toEqual(c.table.rows);
  61  |       }
  62  |       if (c.image) {
  63  |         await expect(page.locator(".media-view > img")).toHaveAttribute(
  64  |           "src",
  65  |           c.image,
  66  |         );
  67  |         await button(page, "Bild vergrößern").tap();
  68  |         await page
  69  |           .getByRole("slider", { name: "Bildvergrößerung", exact: true })
  70  |           .press("End");
  71  |         await expect(
  72  |           page.getByRole("slider", { name: "Bildvergrößerung", exact: true }),
  73  |         ).toHaveValue("4");
  74  |         const size = await page
  75  |           .locator(".media-scroll img")
  76  |           .evaluate((el: HTMLImageElement) => ({
  77  |             width: el.getBoundingClientRect().width,
  78  |             natural: el.naturalWidth,
  79  |           }));
  80  |         expect(size.natural).toBe(900);
  81  |         expect((size.width / 900) * 21).toBeGreaterThanOrEqual(14);
  82  |         await page.screenshot({
  83  |           path: info.outputPath("diagramm-lesefenster.png"),
  84  |         });
  85  |         const enlarged = page.getByLabel("Vergrößertes Bild", { exact: true });
  86  |         await enlarged.scrollIntoViewIfNeeded();
  87  |         await enlarged.press("End");
  88  |         for (let i = 0; i < 60; i++) await enlarged.press("ArrowRight");
  89  |         await expect
  90  |           .poll(() =>
  91  |             enlarged.evaluate(
  92  |               (e) =>
  93  |                 e.scrollLeft >= e.scrollWidth - e.clientWidth - 2 &&
  94  |                 e.scrollTop >= e.scrollHeight - e.clientHeight - 2,
  95  |             ),
  96  |           )
  97  |           .toBe(true);
  98  |         await page.screenshot({
  99  |           path: info.outputPath("diagramm-rechts-unten.png"),
  100 |         });
  101 |       }
  102 |       await button(page, "Schließen").tap();
  103 |     }
  104 |     await connect(page, 1, 2, "Originalbeobachtungen");
  105 |     const old = await png(
  106 |       page,
  107 |       info,
  108 |       `rc-papier-${viewport.width}-alte-schuelerarbeit`,
  109 |     );
  110 |     expect(old.document.content).toEqual(source.content);
  111 |     await button(page, "Menü").tap();
  112 |     page.once("dialog", (d) => d.accept());
  113 |     await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  114 |     await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("RC");
  115 |     await button(page, "Lehrkräftemodus öffnen").tap();
  116 |     await button(page, "Karte hinzufügen").tap();
  117 |     await page
  118 |       .getByLabel("Kartenüberschrift", { exact: true })
  119 |       .fill("Zusätzliche Prüfbeobachtung");
  120 |     await page
  121 |       .getByRole("textbox", { name: "Kartentext", exact: true })
  122 |       .fill(
  123 |         "Eine spätere Prüfung soll mehrere Messorte vergleichen. Dies ist eine Ergänzung der zweiten Fassung.",
  124 |       );
  125 |     await button(page, "Karte übernehmen").tap();
  126 |     page.once("dialog", (d) => d.accept());
  127 |     await button(page, "Karte 2 löschen").tap();
  128 |     await button(page, "Karte 1 bearbeiten").tap();
  129 |     const revisedText =
  130 |       source.content.cards[0].text +
  131 |       " Ergänzung: Eine spätere Untersuchung wird gesondert dokumentiert.";
  132 |     await page
```