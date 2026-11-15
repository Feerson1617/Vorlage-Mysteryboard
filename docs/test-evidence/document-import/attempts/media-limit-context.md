# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: document-import.spec.ts >> Fehler, aktive Inhalte, Abbruch und Ersatzbestätigung lassen den vorhandenen Entwurf unverändert; keine Fremdanfragen
- Location: tests/browser/document-import.spec.ts:385:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('alert') with timeout 45000ms
  - waiting for getByRole('alert')

```

```yaml
- main:
  - strong: MysteryBoard · Lehrkräftemodus
  - text: "Kürzel: AB"
  - button "Entwurf sichern" [disabled]
  - button "Entwurf öffnen" [disabled]
  - button "Startseite" [disabled]
  - paragraph: Autorenwerkzeug ohne Anmeldung. Es wird nichts automatisch gespeichert. Das Kürzel ist kein Schüler-Teamname.
  - region "Dokument importieren":
    - heading "Dokument importieren" [level=2]
    - paragraph: 1. Datei auswählen · 2. Karten prüfen · 3. Karten übernehmen
    - paragraph: Die Verarbeitung bleibt auf diesem Gerät. Es wird nichts automatisch gespeichert.
    - button "Word- oder PDF-Datei auswählen"
    - button "Zurück zum Entwurf"
    - paragraph: F-Word-Mediengrenze.docx · Word (.docx) · 28 Textbereiche · 6 Bilder
    - status: Die Vorschläge sind noch nicht im Entwurf. Bitte am Original prüfen.
    - group:
      - heading "2. Karten prüfen" [level=3]
      - paragraph: "Unsichere Gliederung: Bitte alle vorgeschlagenen Grenzen, Inhalte und Pflicht-/Vertiefungsangaben am Original kontrollieren. Es findet keine fachliche Erkennung statt."
      - group: Hinweise zur Übernahme
      - button "Karten ansehen" [pressed]
      - button "Original ansehen"
      - region "Original vergleichen":
        - heading "Original" [level=3]
        - paragraph: Absätze, Tabellen und Bilder aus Word. Die Seiteneinteilung kann abweichen; für den vollständigen Vergleich die Originaldatei ablegen und in Word öffnen.
        - link "Originaldatei ablegen":
          - /url: blob:http://localhost:5174/253882b8-9029-4ac3-b3df-b0bc4f2b35ca
        - 'heading "Karte 1: Beobachtung 1" [level=4]'
        - paragraph: "Information 1: Der Messwert beträgt 1,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 1 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A1; keine Feldmessung."
        - 'heading "Karte 2: Beobachtung 2" [level=4]'
        - paragraph: "Information 2: Der Messwert beträgt 2,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 2 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A2; keine Feldmessung."
        - 'heading "Vertiefungskarte 3: Beobachtung 3" [level=4]'
        - paragraph: "Information 3: Der Messwert beträgt 3,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 3 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A3; keine Feldmessung."
        - 'heading "Karte 4: Beobachtung 4" [level=4]'
        - paragraph: "Information 4: Der Messwert beträgt 4,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 4 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A4; keine Feldmessung."
        - 'heading "Karte 5: Beobachtung 5" [level=4]'
        - paragraph: "Information 5: Der Messwert beträgt 5,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 5 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A5; keine Feldmessung."
        - 'heading "Karte 6: Beobachtung 6" [level=4]'
        - paragraph: "Information 6: Der Messwert beträgt 6,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 6 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - img "Bild aus dem Word-Dokument"
        - button "Bild vergrößern"
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A6; keine Feldmessung."
        - 'heading "Karte 7: Beobachtung 7" [level=4]'
        - paragraph: "Information 7: Der Messwert beträgt 7,5 g bei 12,5 °C."
        - paragraph: Vergleicht die Beobachtung 7 mit den anderen Karten und begründet mögliche Zusammenhänge.
        - paragraph: "Quelle: Eigene synthetische Prüfdaten A7; keine Feldmessung."
        - text: Ausgelesener Dokumenttext
        - textbox "Ausgelesener Dokumenttext": "Karte 1: Beobachtung 1 Information 1: Der Messwert beträgt 1,5 g bei 12,5 °C. Vergleicht die Beobachtung 1 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A1; keine Feldmessung. Karte 2: Beobachtung 2 Information 2: Der Messwert beträgt 2,5 g bei 12,5 °C. Vergleicht die Beobachtung 2 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A2; keine Feldmessung. Vertiefungskarte 3: Beobachtung 3 Information 3: Der Messwert beträgt 3,5 g bei 12,5 °C. Vergleicht die Beobachtung 3 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A3; keine Feldmessung. Karte 4: Beobachtung 4 Information 4: Der Messwert beträgt 4,5 g bei 12,5 °C. Vergleicht die Beobachtung 4 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A4; keine Feldmessung. Karte 5: Beobachtung 5 Information 5: Der Messwert beträgt 5,5 g bei 12,5 °C. Vergleicht die Beobachtung 5 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A5; keine Feldmessung. Karte 6: Beobachtung 6 Information 6: Der Messwert beträgt 6,5 g bei 12,5 °C. Vergleicht die Beobachtung 6 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A6; keine Feldmessung. Karte 7: Beobachtung 7 Information 7: Der Messwert beträgt 7,5 g bei 12,5 °C. Vergleicht die Beobachtung 7 mit den anderen Karten und begründet mögliche Zusammenhänge. Quelle: Eigene synthetische Prüfdaten A7; keine Feldmessung."
        - button "Textauswahl als Karte hinzufügen" [disabled]
      - region "Importkarten prüfen":
        - heading "Karten" [level=3]
        - paragraph: 7 Vorschläge · 7 zur Übernahme ausgewählt
        - paragraph: "Vorschlag 1: Grenze, Reihenfolge und Kartengruppe bitte am Original prüfen."
        - text: Karte auswählen
        - combobox "Importkarte auswählen":
          - 'option "1 · Karte 1: Beobachtung 1" [selected]'
          - 'option "2 · Karte 2: Beobachtung 2"'
          - 'option "3 · Vertiefungskarte 3: Beobachtung 3"'
          - 'option "4 · Karte 4: Beobachtung 4"'
          - 'option "5 · Karte 5: Beobachtung 5"'
          - 'option "6 · Karte 6: Beobachtung 6"'
          - 'option "7 · Karte 7: Beobachtung 7"'
        - button "Vorherige Karte" [disabled]
        - button "Nächste Karte"
        - checkbox "Diese Karte übernehmen" [checked]
        - text: Diese Karte übernehmen Überschrift
        - textbox "Überschrift": "Karte 1: Beobachtung 1"
        - text: Kartentext
        - textbox "Kartentext": "Information 1: Der Messwert beträgt 1,5 g bei 12,5 °C. Vergleicht die Beobachtung 1 mit den anderen Karten und begründet mögliche Zusammenhänge."
        - paragraph: 145 von höchstens 4000 Zeichen. Zum Teilen den Textcursor an die Grenze setzen.
        - text: Kartengruppe
        - combobox "Import-Kartengruppe":
          - option "Vertiefungskarte (V)"
          - option "Pflichtkarte" [selected]
        - text: Quellenangabe
        - textbox "Quellenangabe": Eigene synthetische Prüfdaten A1; keine Feldmessung.
        - img "Bild dieser Importkarte"
        - button "Bild vergrößern"
        - text: Bildbeschreibung
        - textbox "Bildbeschreibung"
        - button "Bild von Karte entfernen"
        - text: Bild aus dem Dokument
        - combobox "Bild aus dem Dokument":
          - option "Bild auswählen"
          - option "Bild 1" [selected]
          - option "Bild 2"
          - option "Bild 3"
          - option "Bild 4"
          - option "Bild 5"
          - option "Bild 6"
        - text: Bild ersetzen (PNG, JPEG, WebP)
        - button "Bild ersetzen (PNG, JPEG, WebP)"
        - button "Tabelle hinzufügen"
        - button "Karte am Textcursor teilen"
        - button "Mit nächster Karte zusammenfügen"
        - button "Importkarte entfernen"
        - button "Importkarte hinzufügen"
      - button "Weiter zur Übernahme"
```

# Test source

```ts
  318 | 
  319 | test("PDF D/E/G: komplexe Seiten, echter Ausschnitt, Scan ohne OCR und seitenübergreifender Text", async ({
  320 |   page,
  321 | }, info) => {
  322 |   test.setTimeout(120000);
  323 |   await teacher(page);
  324 |   await button(page, "Dokument importieren").tap();
  325 |   await parse(page, "D-PDF-Mehrspaltig.pdf");
  326 |   await button(page, "Original ansehen").tap();
  327 |   await expect(
  328 |     page
  329 |       .getByRole("combobox", { name: "PDF-Seite", exact: true })
  330 |       .locator("option"),
  331 |   ).toHaveCount(1);
  332 |   await page
  333 |     .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
  334 |     .check();
  335 |   for (const [name, v] of [
  336 |     ["Links (%)", "50"],
  337 |     ["Oben (%)", "0"],
  338 |     ["Breite (%)", "45"],
  339 |     ["Höhe (%)", "30"],
  340 |   ])
  341 |     await page.getByRole("spinbutton", { name, exact: true }).fill(v);
  342 |   await button(page, "Ausschnitt der aktuellen Karte zuordnen").tap();
  343 |   await expect(page.locator(".import-step-body")).toBeEnabled();
  344 |   await button(page, "Karten ansehen").tap();
  345 |   await expect(page.locator(".import-cards .media-view > img")).toHaveCount(1);
  346 |   const ratio = await page
  347 |     .locator(".import-cards .media-view > img")
  348 |     .evaluate((e: HTMLImageElement) => e.naturalWidth / e.naturalHeight);
  349 |   expect(ratio).toBeCloseTo(((595 / 842) * 0.45) / 0.3, 1);
  350 |   page.once("dialog", (d) => d.accept());
  351 |   await page
  352 |     .getByLabel("Word- oder PDF-Datei", { exact: true })
  353 |     .setInputFiles(fixture("E-PDF-Scan-ohne-Text.pdf"));
  354 |   await expect(
  355 |     page.getByText(
  356 |       "Dieses PDF enthält keinen auslesbaren Text. Sie können eine Seite als Bild übernehmen. Die automatische Texterkennung ergänzen wir später.",
  357 |       { exact: true },
  358 |     ),
  359 |   ).toBeVisible({ timeout: 45000 });
  360 |   await expect(page.locator(".import-step-body")).toBeEnabled({
  361 |     timeout: 25000,
  362 |   });
  363 |   await expect(
  364 |     page.getByRole("combobox", { name: "Importkarte auswählen", exact: true }),
  365 |   ).toHaveCount(0);
  366 |   await button(page, "Original ansehen").tap();
  367 |   await button(page, "Seite als Bildkarte hinzufügen").tap();
  368 |   await expect(page.locator(".import-step-body")).toBeEnabled();
  369 |   await take(page);
  370 |   await button(page, "Entwurf sichern").tap();
  371 |   const scan = await getFile(page, info, "import-scan-bildkarte.mysteryboard");
  372 |   expect(scan.document.content.cards[0].text).toBe("");
  373 |   expect(scan.document.content.cards[0].image).toMatch(/^data:image\//);
  374 |   await button(page, "Schließen").tap();
  375 |   await button(page, "Dokument importieren").tap();
  376 |   await parse(page, "G-PDF-Seitenuebergreifend.pdf");
  377 |   await card(page, 0);
  378 |   const text = await page
  379 |     .getByRole("textbox", { name: "Kartentext", exact: true })
  380 |     .inputValue();
  381 |   expect(text).toContain("Erster Teil: 12,5 °C.");
  382 |   expect(text).toContain("Fortsetzung ohne neue Kartenüberschrift: 3,50 g.");
  383 | });
  384 | 
  385 | test("Fehler, aktive Inhalte, Abbruch und Ersatzbestätigung lassen den vorhandenen Entwurf unverändert; keine Fremdanfragen", async ({
  386 |   page,
  387 | }, info) => {
  388 |   test.setTimeout(120000);
  389 |   const external: string[] = [];
  390 |   page.on("request", (r) => {
  391 |     if (
  392 |       /^https?:/.test(r.url()) &&
  393 |       !r.url().startsWith("http://localhost:5174/")
  394 |     )
  395 |       external.push(r.url());
  396 |   });
  397 |   await openUniversal(page);
  398 |   const bytes = await readFile(
  399 |     "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  400 |   );
  401 |   await importMystery(page, bytes);
  402 |   await button(page, "Entwurf sichern").tap();
  403 |   const before = await getFile(page, info, "import-vorher.mysteryboard");
  404 |   await button(page, "Schließen").tap();
  405 |   for (const name of [
  406 |     "F-Altformat.doc",
  407 |     "F-Defekt.docx",
  408 |     "F-Defekt.pdf",
  409 |     "F-Word-komprimiert.docx",
  410 |     "F-Word-aktive-Inhalte.docx",
  411 |     "F-Word-Mediengrenze.docx",
  412 |     "F-PDF-JavaScript.pdf",
  413 |   ]) {
  414 |     await button(page, "Dokument importieren").tap();
  415 |     await page
  416 |       .getByLabel("Word- oder PDF-Datei", { exact: true })
  417 |       .setInputFiles(fixture(name));
> 418 |     await expect(page.getByRole("alert")).toBeVisible({ timeout: 45000 });
      |                                           ^ Error: expect(locator).toBeVisible() failed
  419 |     await button(page, "Zurück zum Entwurf").tap();
  420 |     await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
  421 |       before.document.content.title,
  422 |     );
  423 |   }
  424 |   await button(page, "Dokument importieren").tap();
  425 |   await page
  426 |     .getByLabel("Word- oder PDF-Datei", { exact: true })
  427 |     .setInputFiles(fixture("H-PDF-Abbruch-38-Seiten.pdf"));
  428 |   await button(page, "Import abbrechen").tap();
  429 |   await expect(button(page, "Dokument importieren")).toBeVisible();
  430 |   await button(page, "Dokument importieren").tap();
  431 |   await parse(page, "F-Word-Text-und-externe-Verweise.docx");
  432 |   await expect(
  433 |     page.getByRole("textbox", { name: "Kartentext", exact: true }),
  434 |   ).toHaveValue(/<script>/);
  435 |   expect(
  436 |     await page.evaluate(() => (window as any).__importXss),
  437 |   ).toBeUndefined();
  438 |   page.once("dialog", (d) => d.accept());
  439 |   await button(page, "Zurück zum Entwurf").tap();
  440 |   await button(page, "Dokument importieren").tap();
  441 |   await parse(page, "A-Word-12-Karten.docx");
  442 |   await button(page, "Weiter zur Übernahme").tap();
  443 |   await page
  444 |     .getByRole("radio", {
  445 |       name: "Neues Mystery aus dem Dokument erstellen",
  446 |       exact: true,
  447 |     })
  448 |     .check();
  449 |   await page
  450 |     .getByRole("checkbox", {
  451 |       name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
  452 |       exact: true,
  453 |     })
  454 |     .check();
  455 |   page.once("dialog", (d) => d.dismiss());
  456 |   await button(page, "Geprüfte Karten übernehmen").tap();
  457 |   page.once("dialog", (d) => d.accept());
  458 |   await button(page, "Zurück zum Entwurf").tap();
  459 |   await button(page, "Entwurf sichern").tap();
  460 |   const after = await getFile(page, info, "import-nach-abbruch.mysteryboard");
  461 |   expect(after.document).toEqual(before.document);
  462 |   expect(external).toEqual([]);
  463 | });
  464 | 
  465 | test("Bestehendes Mystery ergänzen und ein neues Mystery bewusst erstellen bleiben getrennte, versionierte Vorgänge", async ({
  466 |   page,
  467 | }, info) => {
  468 |   test.setTimeout(90000);
  469 |   await openUniversal(page);
  470 |   const base = await readFile(
  471 |     "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  472 |   );
  473 |   await importMystery(page, base);
  474 |   await button(page, "Entwurf sichern").tap();
  475 |   const originalDraft = await getFile(
  476 |     page,
  477 |     info,
  478 |     "import-bestand-original.mysteryboard",
  479 |   );
  480 |   await button(page, "Schließen").tap();
  481 |   await button(page, "Dokument importieren").tap();
  482 |   await parse(page, "B-Word-Medien-Tabelle.docx");
  483 |   await take(page);
  484 |   await button(page, "Entwurf sichern").tap();
  485 |   const appended = await getFile(
  486 |     page,
  487 |     info,
  488 |     "import-bestand-ergaenzt.mysteryboard",
  489 |   );
  490 |   expect(appended.document.content.cards).toHaveLength(18);
  491 |   expect(appended.document.content.id).toBe(originalDraft.document.content.id);
  492 |   expect(appended.document.content.cards.slice(0, 12)).toEqual(
  493 |     originalDraft.document.content.cards,
  494 |   );
  495 |   expect(appended.document.content.help).toEqual(
  496 |     originalDraft.document.content.help,
  497 |   );
  498 |   await button(page, "Schließen").tap();
  499 |   await button(page, "Dokument importieren").tap();
  500 |   await parse(page, "A-Word-12-Karten.docx");
  501 |   await button(page, "Weiter zur Übernahme").tap();
  502 |   await page
  503 |     .getByRole("radio", {
  504 |       name: "Neues Mystery aus dem Dokument erstellen",
  505 |       exact: true,
  506 |     })
  507 |     .check();
  508 |   await page
  509 |     .getByRole("textbox", { name: "Mystery-Titel", exact: true })
  510 |     .fill("Neues Mystery nur aus Word");
  511 |   await page
  512 |     .getByRole("checkbox", {
  513 |       name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
  514 |       exact: true,
  515 |     })
  516 |     .check();
  517 |   page.once("dialog", (d) => d.accept());
  518 |   await button(page, "Geprüfte Karten übernehmen").tap();
```