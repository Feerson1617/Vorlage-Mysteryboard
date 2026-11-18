# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: document-import.spec.ts >> Bestehendes Mystery ergänzen und ein neues Mystery bewusst erstellen bleiben getrennte, versionierte Vorgänge
- Location: tests/browser/document-import.spec.ts:464:1

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'Mystery-Titel', exact: true })

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - strong [ref=e5]: MysteryBoard · Lehrkräftemodus
    - generic [ref=e6]: "Kürzel: AB"
    - button "Entwurf sichern" [disabled] [ref=e7]
    - button "Entwurf öffnen" [disabled] [ref=e8]
    - button "Startseite" [disabled] [ref=e9]
  - paragraph [ref=e10]: Autorenwerkzeug ohne Anmeldung. Es wird nichts automatisch gespeichert. Das Kürzel ist kein Schüler-Teamname.
  - region "Dokument importieren" [ref=e11]:
    - heading "Dokument importieren" [level=2] [ref=e12]
    - paragraph [ref=e13]: 1. Datei auswählen · 2. Karten prüfen · 3. Karten übernehmen
    - paragraph [ref=e14]: Die Verarbeitung bleibt auf diesem Gerät. Es wird nichts automatisch gespeichert.
    - generic [ref=e15]:
      - button "Word- oder PDF-Datei auswählen" [ref=e16] [cursor=pointer]
      - button "Zurück zum Entwurf" [ref=e17] [cursor=pointer]
    - paragraph [ref=e18]: A-Word-12-Karten.docx · Word (.docx) · 48 Textbereiche · 0 Bilder
    - status [ref=e19]: Die Vorschläge sind noch nicht im Entwurf. Bitte am Original prüfen.
    - group [ref=e20]:
      - heading "3. Karten übernehmen" [level=3] [ref=e21]
      - paragraph [ref=e22]: 12 ausgewählte Karten. Bis jetzt wurde der Entwurf nicht verändert.
      - generic [ref=e23]:
        - radio "Karten zu diesem Mystery hinzufügen" [ref=e24]
        - text: Karten zu diesem Mystery hinzufügen
      - generic [ref=e25]:
        - radio "Neues Mystery aus dem Dokument erstellen" [checked] [active] [ref=e26]
        - text: Neues Mystery aus dem Dokument erstellen
      - generic [ref=e27]:
        - text: Mystery-Titel
        - textbox "Mystery-Titel Vorschlag aus dem Dateinamen; bitte prüfen." [ref=e28]: A-Word-12-Karten
        - text: Vorschlag aus dem Dateinamen; bitte prüfen.
      - paragraph [ref=e29]: Der bisherige Entwurf wird erst nach einer zusätzlichen Bestätigung ersetzt. Sichert ihn vorher, wenn ihr ihn behalten möchtet.
      - generic [ref=e30]:
        - checkbox "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft." [ref=e31]
        - text: Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.
      - paragraph [ref=e32]: Übernehmen ändert nur den geöffneten Entwurf. Danach „Entwurf sichern“ bewusst herunterladen und „Schülerversion erstellen“ für die Klasse verwenden.
      - generic [ref=e33]:
        - button "Zurück zu den Karten" [ref=e34] [cursor=pointer]
        - button "Geprüfte Karten übernehmen" [disabled] [ref=e35]
```

# Test source

```ts
  409 |     "F-Word-komprimiert.docx",
  410 |     "F-Word-aktive-Inhalte.docx",
  411 |     "F-PDF-JavaScript.pdf",
  412 |   ]) {
  413 |     await button(page, "Dokument importieren").tap();
  414 |     await page
  415 |       .getByLabel("Word- oder PDF-Datei", { exact: true })
  416 |       .setInputFiles(fixture(name));
  417 |     await expect(page.getByRole("alert")).toBeVisible({ timeout: 45000 });
  418 |     await button(page, "Zurück zum Entwurf").tap();
  419 |     await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
  420 |       before.document.content.title,
  421 |     );
  422 |   }
  423 |   await button(page, "Dokument importieren").tap();
  424 |   await page
  425 |     .getByLabel("Word- oder PDF-Datei", { exact: true })
  426 |     .setInputFiles(fixture("H-PDF-Abbruch-38-Seiten.pdf"));
  427 |   await button(page, "Import abbrechen").tap();
  428 |   await expect(button(page, "Dokument importieren")).toBeVisible();
  429 |   await button(page, "Dokument importieren").tap();
  430 |   await parse(page, "F-Word-Text-und-externe-Verweise.docx");
  431 |   await expect(
  432 |     page.getByRole("textbox", { name: "Kartentext", exact: true }),
  433 |   ).toHaveValue(/<script>/);
  434 |   expect(
  435 |     await page.evaluate(() => (window as any).__importXss),
  436 |   ).toBeUndefined();
  437 |   page.once("dialog", (d) => d.accept());
  438 |   await button(page, "Zurück zum Entwurf").tap();
  439 |   await button(page, "Dokument importieren").tap();
  440 |   await parse(page, "A-Word-12-Karten.docx");
  441 |   await button(page, "Weiter zur Übernahme").tap();
  442 |   await page
  443 |     .getByRole("radio", {
  444 |       name: "Neues Mystery aus dem Dokument erstellen",
  445 |       exact: true,
  446 |     })
  447 |     .check();
  448 |   await page
  449 |     .getByRole("checkbox", {
  450 |       name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
  451 |       exact: true,
  452 |     })
  453 |     .check();
  454 |   page.once("dialog", (d) => d.dismiss());
  455 |   await button(page, "Geprüfte Karten übernehmen").tap();
  456 |   page.once("dialog", (d) => d.accept());
  457 |   await button(page, "Zurück zum Entwurf").tap();
  458 |   await button(page, "Entwurf sichern").tap();
  459 |   const after = await getFile(page, info, "import-nach-abbruch.mysteryboard");
  460 |   expect(after.document).toEqual(before.document);
  461 |   expect(external).toEqual([]);
  462 | });
  463 | 
  464 | test("Bestehendes Mystery ergänzen und ein neues Mystery bewusst erstellen bleiben getrennte, versionierte Vorgänge", async ({
  465 |   page,
  466 | }, info) => {
  467 |   test.setTimeout(90000);
  468 |   await openUniversal(page);
  469 |   const base = await readFile(
  470 |     "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  471 |   );
  472 |   await importMystery(page, base);
  473 |   await button(page, "Entwurf sichern").tap();
  474 |   const originalDraft = await getFile(
  475 |     page,
  476 |     info,
  477 |     "import-bestand-original.mysteryboard",
  478 |   );
  479 |   await button(page, "Schließen").tap();
  480 |   await button(page, "Dokument importieren").tap();
  481 |   await parse(page, "B-Word-Medien-Tabelle.docx");
  482 |   await take(page);
  483 |   await button(page, "Entwurf sichern").tap();
  484 |   const appended = await getFile(
  485 |     page,
  486 |     info,
  487 |     "import-bestand-ergaenzt.mysteryboard",
  488 |   );
  489 |   expect(appended.document.content.cards).toHaveLength(18);
  490 |   expect(appended.document.content.id).toBe(originalDraft.document.content.id);
  491 |   expect(appended.document.content.cards.slice(0, 12)).toEqual(
  492 |     originalDraft.document.content.cards,
  493 |   );
  494 |   expect(appended.document.content.help).toEqual(
  495 |     originalDraft.document.content.help,
  496 |   );
  497 |   await button(page, "Schließen").tap();
  498 |   await button(page, "Dokument importieren").tap();
  499 |   await parse(page, "A-Word-12-Karten.docx");
  500 |   await button(page, "Weiter zur Übernahme").tap();
  501 |   await page
  502 |     .getByRole("radio", {
  503 |       name: "Neues Mystery aus dem Dokument erstellen",
  504 |       exact: true,
  505 |     })
  506 |     .check();
  507 |   await page
  508 |     .getByRole("textbox", { name: "Mystery-Titel", exact: true })
> 509 |     .fill("Neues Mystery nur aus Word");
      |      ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  510 |   await page
  511 |     .getByRole("checkbox", {
  512 |       name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
  513 |       exact: true,
  514 |     })
  515 |     .check();
  516 |   page.once("dialog", (d) => d.accept());
  517 |   await button(page, "Geprüfte Karten übernehmen").tap();
  518 |   await button(page, "Entwurf sichern").tap();
  519 |   const created = await getFile(
  520 |     page,
  521 |     info,
  522 |     "import-neue-identitaet.mysteryboard",
  523 |   );
  524 |   expect(created.document.content.id).not.toBe(appended.document.content.id);
  525 |   expect(created.document.content.cards).toHaveLength(12);
  526 |   expect(created.document.content.help).toBeUndefined();
  527 |   expect(created.document.content.title).toBe("Neues Mystery nur aus Word");
  528 |   expect(
  529 |     await readFile("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
  530 |   ).toEqual(base);
  531 | });
  532 | 
  533 | test("Importparser werden erst bei der Dateiauswahl instanziiert und nach Abbruch freigegeben", async ({
  534 |   page,
  535 | }) => {
  536 |   await page.addInitScript(() => {
  537 |     const W = window.Worker;
  538 |     (window as any).__importWorkers = [];
  539 |     window.Worker = new Proxy(W, {
  540 |       construct(target, args) {
  541 |         (window as any).__importWorkers.push(args[1]?.name ?? "");
  542 |         return Reflect.construct(target, args);
  543 |       },
  544 |     });
  545 |   });
  546 |   await teacher(page);
  547 |   expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual(
  548 |     [],
  549 |   );
  550 |   await button(page, "Dokument importieren").tap();
  551 |   expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual(
  552 |     [],
  553 |   );
  554 |   await parse(page, "A-Word-12-Karten.docx");
  555 |   expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual([
  556 |     "mysteryboard-document-import",
  557 |   ]);
  558 |   expect(await page.evaluate(() => typeof (window as any).pdfjsWorker)).toBe(
  559 |     "undefined",
  560 |   );
  561 |   page.once("dialog", (d) => d.accept());
  562 |   await button(page, "Zurück zum Entwurf").tap();
  563 |   await expect.poll(() => page.workers().length).toBe(0);
  564 | });
  565 | 
```