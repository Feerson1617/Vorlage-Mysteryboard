# Boden-Mystery für HTTPS, Canva und Schul-iPads vorbereiten

Die veröffentlichungsfähige Datei entsteht aus demselben Anwendungskern wie die
kleine und die umfangreiche Testversion. Es gibt keine zusätzliche
Mystery-Auswahl, Datenbank oder Laufzeitbibliothek aus dem Netz. Die fachlichen
Inhalte bleiben in `src/content/boden-klasse11.json`, die Build-Auswahl in
`mysteries.json`. Weitere Mysterys beschreibt [NEUES-MYSTERY.md](NEUES-MYSTERY.md).

Diese Konfiguration bereitet eine Veröffentlichung vor. Das Hinzufügen oder
Pushen dieser Dateien veröffentlicht nichts: Der Workflow hat ausschließlich
`workflow_dispatch`, keinen Push-, PR- oder Zeitplan-Trigger. Eine tatsächliche
Pages-URL darf erst aus einer vorhandenen Pages-Konfiguration beziehungsweise
einem erfolgreichen Deployment übernommen werden. Dieser Text bestätigt keine
bereits aktive Website.

## Lokal ein prüfbares Paket erstellen

Voraussetzung: Node.js 24, installierte Abhängigkeiten und Chromium entsprechend
der vorhandenen Playwright-Konfiguration. In einem frischen Checkout:

```sh
npm ci
npx playwright install --with-deps chromium
export CHROMIUM_PATH="$(node --input-type=module -e "import { chromium } from '@playwright/test'; console.log(chromium.executablePath());")"
npm run check
node scripts/prepare-pages.mjs
```

`npm run check` führt sämtliche vorhandenen Datentests, die Typprüfung, die
Produktions-Builds und alle Chromium-Browsertests einschließlich der zusätzlichen
Testinhalte aus. Das Paketierungsskript führt selbst keine Tests und keinen Build
aus; deshalb immer erst den vollständigen Prüfbefehl erfolgreich abschließen.
Es prüft außerdem die vorhandenen Produktionsdateien auf HTML-Größengrenze und
externe Laufzeitressourcen. Die Offline-Funktion belegen die Browserprüfungen.

Ergebnis unter `dist/pages/`:

- `index.html`: byteidentische Kopie von
  `artifacts/MysteryBoard-Boden-Klasse11.html`, ohne Änderung der Oberfläche.
- `.nojekyll`: leere Markierung für statische Auslieferung.
- `manifest.json`: Kennzeichnung als generiertes Paket, tatsächlicher
  Git-HEAD, Status lokaler Quelländerungen, Inhaltsidentität und SHA-256/Bytes aller
  Produktions-HTMLs sowie der `index.html`.
- `README.md`: Herkunft und Prüfsumme für die Person, die das Paket bereitstellt.

Manifest und README fügen der Schüleroberfläche nichts hinzu. Generierte Dateien
nicht bearbeiten; nach Änderungen am Quellstand erneut bauen und prüfen. Ein
lokaler Entwurf wird ausdrücklich als gegenüber HEAD verändert gekennzeichnet.
Im CI-Workflow bricht das Skript bei nachträglich veränderten Quellen ab;
generierte Dateien in `artifacts/` sind von diesem Quellvergleich ausgenommen.
Ein optionales leeres Zielverzeichnis kann als einziges Argument angegeben
werden. Fremde Dateien im Zielverzeichnis werden weder gelöscht noch übernommen.

## Manueller GitHub-Actions-Ablauf

Workflow: [pages-manual.yml](../.github/workflows/pages-manual.yml).

1. Zuerst Commit und PR auf dem Entwicklungsbranch prüfen. `main` wird dadurch
   nicht verändert. **GitHub zeigt den manuellen `workflow_dispatch`-Start erst
   an, wenn die Workflow-Datei auf dem Default-Branch vorhanden ist.** Solange
   sie nur auf `feat/mysteryboard-prototype` liegt, ist der lokale Paketierungsweg
   nutzbar; ein Actions-Start wird hier nicht als bereits verfügbar behauptet.
   Die Aufnahme auf den Default-Branch erfordert den gesondert freigegebenen
   Merge durch die zuständige Person.
2. Wenn der Workflow verfügbar ist, unter Actions den Workflow und den
   gewünschten Workflow-Branch wählen. Unter `source_ref` vorzugsweise die
   vollständige freigegebene Commit-SHA eintragen. Leer verwendet den Commit des
   ausgewählten Workflow-Refs. Der gewählte Quellstand muss diesen universellen
   Build-Prozess und das Paketierungsskript enthalten.
3. Für Vorbereitung und Prüfung `publish` auf **false** lassen. Der Workflow
   checkt den gewählten Stand aus, installiert aus der Lockdatei, führt die
   gesamte vorhandene Suite mit Chromium aus und lädt erst nach Erfolg die drei
   Produktionsdateien, das Prüfprotokoll und ein Pages-Artefakt hoch. Die
   Commit-SHA und Prüfsummen stehen im Lauf und im Manifest. Dies ist keine
   öffentliche Website.
4. Erst nach gesonderter Veröffentlichungsfreigabe in den Repository-Einstellungen
   unter **Pages → Build and deployment → Source** GitHub Actions auswählen.
   Die Umgebung `github-pages` muss Deployments des gewählten Workflow-Branches
   zulassen; vorhandene Branch- und Umgebungsfreigaben gelten weiterhin.
5. Den Lauf mit demselben geprüften Quellcommit erneut starten, `publish` auf
   **true** setzen und exakt `BODEN-MYSTERY VERÖFFENTLICHEN` bestätigen. Ohne beide
   Angaben erfolgt kein Deployment. Auch dieser Lauf prüft vor der Auslieferung
   erneut vollständig. Die tatsächliche HTTPS-Adresse steht anschließend beim
   erfolgreichen Deployment und in der GitHub-Pages-Umgebung.

Der Prüfjob besitzt nur `contents: read`. Ausschließlich der separat freigegebene
Deploy-Job erhält `pages: write` und `id-token: write`; er pusht keinen Branch.
Es werden keine Repository-Geheimnisse für Schülerdaten oder eine Datenbank
benötigt. Dies ist eine statische Auslieferung. Das Laden der Seite erfordert
HTTPS-Zugriff; die Bearbeitung nach dem Laden ist offline möglich. Nach dem
vollständigen Schließen muss die Seite gegebenenfalls erneut über das Netzwerk
geladen werden. Es wird kein Service Worker und keine automatische dauerhafte
Speicherung eingeführt.

## Canva mit unveränderter Anwendung prüfen

Die originale `MysteryBoard-Boden-Klasse11.html` verwenden und ihre SHA-256 mit
dem Manifest vergleichen. Sofern der verwendete Canva-Code-Veröffentlichungsweg
das vollständige Dokument ausführen kann, dieses unverändert übernehmen und
den tatsächlich veröffentlichten Schülerlink öffnen. Keinen von Canva neu
erzeugten oder umgeschriebenen Anwendungscode als unveränderte MysteryBoard-
Version behandeln. Insbesondere Touch-Dialoge, PNG-Download und PNG-Import in
diesem konkreten Veröffentlichungsweg prüfen. Falls Canva die unveränderte HTML
nicht annimmt oder Funktionen sperrt, ist diese Bereitstellung noch ungeprüft
beziehungsweise ungeeignet; den vorbereiteten HTTPS-Weg über Pages verwenden.
Eine erfolgreiche lokale HTML-Prüfung bestätigt keine Canva-Kompatibilität.

## Praktische Abnahme auf einem verwalteten Schul-iPad

Die tatsächlich veröffentlichte Adresse und die verwendete Commit-SHA notieren;
Safari-/iPadOS-Version, Datum, Gerät und Ergebnis festhalten.

1. Schülerlink in Safari öffnen und gültigen Teamnamen eingeben.
2. Boden-Mystery starten; Pflichtkarte öffnen, bewusst schließen, erneut öffnen
   und verschieben. Es darf kein unbeabsichtigter Nachklick auftreten.
3. Zwei Karten verbinden, Pfeil beschriften, bearbeiten und bewusst löschen;
   Verbindung erneut anlegen. Rückgängig/Wiederholen und Pinch-Zoom prüfen.
4. Eine Vertiefungskarte V13–V18 öffnen und verwenden; Teamname rechts oben und
   Erreichbarkeit aller Werkzeuge in beiden iPad-Ausrichtungen prüfen.
5. PNG erzeugen, herunterladen und als Originaldatei in der App „Dateien“ ablegen.
   Teamname, Karten, Farben, Kategorien, Positionen und Verbindungen festhalten.
6. Webseite vollständig verlassen, danach erneut öffnen und die Original-PNG
   aus „Dateien“ importieren. Den vollständigen Zustand vergleichen.
7. Wiederhergestellten Zustand weiterbearbeiten, erneut sichern und importieren.
8. Nach Möglichkeit Original-PNG auf ein zweites verwaltetes Schul-iPad übertragen
   und dort wiederherstellen. Screenshot oder von einer App umgewandelte PNG
   ersetzen die Originaldatei nicht.

Ohne erfolgreiche tatsächliche Canva-Veröffentlichungsprüfung (sofern Canva
verwendet wird) und Wiederherstellung auf verwalteten Schul-iPads besteht keine
vollständige schulische Freigabe. Chromium- und WebKit-Emulation ersetzen diese
Geräteprüfung nicht. Das manuelle Pages-Paket allein bestätigt weder Erreichbarkeit
im Schulnetz noch eine bereits erteilte Unterrichtsfreigabe.
