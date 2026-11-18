# Druckfassung / PDF

Die Druckfunktion aus `feat/mysteryboard-print-pdf` (`30ecd1d814b4510a689c7b5d44ad1dd6609849f1`) ist auf `feat/mysteryboard-template-print-integration` in den neueren Vorlagenkern `3454f97c513a6c657256623c08e11d9f93f8b09a` integriert. Beide ursprünglichen Feature-Branches sowie die eingefrorenen Unterrichtsversionen RC1 und RC2 bleiben unverändert. Die Boden-HTML und RC2-SCORM-ZIP werden nicht neu erzeugt; aktuelle technische Boden-Builds bleiben ausschließlich Vorschauen unter `artifacts/previews/`.

## Verwendung

1. Im bestehenden Menü **Druckfassung / PDF** wählen. Eine fehlende Teamangabe wird wie vor der PNG-Sicherung nachgefragt.
2. **A4 quer** oder **A3 quer** wählen und die fertig aufgebaute Vorschau prüfen. Lange Dokumente lassen sich scrollen.
3. Bewusst **Drucken / PDF speichern** betätigen. Im nativen Druckdialog dasselbe Papierformat und Querformat wählen, zusätzliche Browser-Kopf-/Fußzeilen ausschalten und nach Möglichkeit Originalgröße/100 % verwenden. Den dort angebotenen PDF-Speicherweg verwenden; dessen genaue Bedienung hängt von Browser und Gerät ab.
4. Vorschau schließen und normal weiterarbeiten. Für einen später wiederherstellbaren Arbeitsstand weiterhin **Sichern → Original-PNG → Dateien** verwenden.

Es gibt keine neue dauerhafte Schaltfläche auf der Arbeitsfläche. Der Druckdialog wird nicht automatisch geöffnet. Die Vorschau bleibt auch nach Rückkehr aus dem Druckdialog erhalten, da Safari seinen Druckvorgang asynchron abschließen kann. Ein Abbruch des Druckdialogs speichert oder löscht keinen Arbeitsstand.

## Aufbau des Dokuments

- **Gesamtübersicht:** SVG mit den gespeicherten Kartenpositionen, allen Verbindungen, Pfeilrichtungen, Beschriftungen und Kartennummern. Der aktuelle Bildschirmzoom beeinflusst die Ausgabe nicht. Die Übersicht enthält die vollständige Farblegende einschließlich eigener Kategorien.
- **Vollständige Karten:** Zwei Spalten mit normalen Kartentexten in **11 Punkt**. Karte, Titel, Pflicht-/Vertiefungsgruppe, originaler Nummer/V-Kennung, Farbe als Wort und eigene Kategorie bleiben zugeordnet. Zu lange Texte werden über weitere Spalten/Seiten mit wiederholter Kartennummer und „Fortsetzung“ verteilt. Es werden keine Textenden abgeschnitten. Beziehungen verweisen mit den vorhandenen Kartennummern auf das Beziehungsverzeichnis.
- **Bilddetails:** Zu jeder Bildkarte eine eigene große, unverzerrte Bildseite. Originale Bilddaten bleiben erhalten; das Bild wird in die verfügbare Fläche eingepasst. Beschriftung und Rückverweis ordnen es seiner Karte zu.
- **Vollständige Beziehungen:** Jede vorhandene Verbindung erscheint einmal als Eintrag, bei Bedarf mit Fortsetzungen. Originale Richtung und vollständige Beschriftung bleiben erhalten. „Ohne Pfeil“ ist ausdrücklich gekennzeichnet. Beide Endpunkte verweisen auf die endgültigen Kartenseiten.
- **Kopf-/Fußzeile:** Mystery-Titel links, Team rechts, auf jeder Seite. Beide Bereiche umbrechen auch sehr lange untrennbare Angaben. Alle Seiten tragen „Seite x von y“. Es werden keine neuen Buchstabencodes eingeführt.

Die vollständige Topologie steht im lesbaren Karten-/Beziehungsverzeichnis. Eine sehr dichte oder weit auseinandergezogene räumliche Übersicht, insbesondere bei 220–300 Beziehungen, bleibt als Ganzes nicht überall ausreichend lesbar. Das Verfahren behauptet keine automatisch entwirrte grafische Darstellung. Die lesbaren Detailseiten und Querverweise ermöglichen die genaue Auswertung der unveränderten Beziehungen. Es kopiert nicht lediglich ein verkleinertes Gesamtbild auf mehrere Blätter.

## Technische Entscheidung und Grenzen

Die Ausgabe verwendet lokales HTML, CSS für Druckseiten und SVG in einem sichtbaren Frame derselben Anwendung. A4/A3-Seiten werden in tatsächlichen Papiermaßen erzeugt. Die Aufteilung misst die konkreten DOM-Inhalte mit fertigen Schriften; überlange Texte werden zeichengetreu fortgesetzt. Querverweise erhalten nach der endgültigen Aufteilung ihre Seitenzahl. Eine abschließende Grenzprüfung gibt die Druckschaltfläche nur für vollständig passende Seiten frei. Textwerte werden als Textknoten eingesetzt.

Dieser Ansatz benötigt keine neue PDF-Bibliothek, keinen Server, keine externen Ressourcen und keine riesigen Raster-Canvas-Flächen. Der Browser übernimmt den eigentlichen Druck bzw. das PDF. Anders als ein neuer selbst erzeugter PDF-Renderer nutzt er die vorhandene Text-/SVG-Ausgabe und den systemeigenen Druckweg. Dies ist eine begründete technische Auswahl, **keine bestätigte Safari-/Schul-iPad-Kompatibilität**. Besonders Papierformat, Druckmaßstab, PDF-Ablage in „Dateien“ und größere Vorschauen müssen dort geprüft werden. Der im Browser erreichbare Druckdialog kann durch Geräteverwaltung eingeschränkt sein.

Die Druckfunktion erhält ausschließlich Inhaltsdaten und den fachlichen Arbeitsstand. Temporäre Nummernhilfefarben, das Hilfefenster und die Anzeige „Orientierung an“ gelangen nicht in die Druckfassung. Die Übersicht verwendet stets die aktuellen gespeicherten Positionen; weder beim Öffnen noch beim Papierwechsel wird neu sortiert.

Die Vorbereitung arbeitet auf validierten Eingabedaten; Work-Format, Mystery-ID/-Version, Kartennummern, History, PNG-/QR-Codec und automatische Speicherung werden nicht verändert. Ein ausdrücklich eingegebener Teamnachtrag bleibt eine normale Bearbeitung; die anschließende Druckvorbereitung fügt keine weiteren Änderungen hinzu. Eine PDF enthält keine zugesicherte Wiederherstellungsfunktion und darf nicht als Sicherungs-PNG importiert werden.

Papierwechsel oder Schließen lösen keine weiteren Druckaufrufe aus. Veraltete Vorbereitungen werden zwischen Verarbeitungsschritten abgebrochen. Es wird seitenweise mit begrenzter Seitenzahl gearbeitet; bei zu großem Umfang oder nicht ladbaren Bildern erscheint ein Fehler und der Arbeitsstand bleibt erhalten. Die Originalbildauflösung und der Speicherbedarf der nativen Browser-Bilddecoder bleiben relevant: ein extrem hochauflösendes Bild wird durch diese Funktion nicht automatisch für iPads optimiert. Keine pauschale Druckqualitätszusage für beliebige Bildauflösungen oder extrem dichte Gefüge.

## Prüfbefehle und Beispiele

```sh
# Vollständige Regression, einschließlich Drucktests:
npm run check

# Gezielt: Drucktests mit allen Produktions- und Prüfvarianten:
npm run build
node scripts/build.mjs --tests
npx playwright test tests/browser/print.spec.ts

# Zusätzlich echte Chromium-PDFs, Screenshots und PDF-Inhaltsprüfung erzeugen:
# Dieses Prüfwerkzeug benötigt pdfinfo/pdftotext (Poppler), nicht die Anwendung.
PRINT_EXAMPLES_DIR=/tmp/mysteryboard-print-examples npx playwright test tests/browser/print.spec.ts
```

Die neue Integrationsprüfung ergänzt einen durchgehenden Schülerablauf mit Startablage, Hilfe, eigenen Farben/Kategorien, A4/A3 und frischer PNG-Wiederherstellung. Beide Hilfemarkierungen und temporäre Nummernfarben bleiben aus dem Druckdokument ausgeschlossen.

```sh
# Neue Integration mit nativen Chromium-PDFs und Poppler-Inhaltsprüfung:
INTEGRATION_EXAMPLES_DIR=/tmp/mysteryboard-integration-pdfs npx playwright test tests/browser/integration.spec.ts

# Unabhängige Raster-/Proportionsprüfung der daraus erzeugten PDF-Dateien:
# Zusätzlich wird Pillow als Prüfwerkzeug benötigt, nicht zur Laufzeit der HTML.
python3 scripts/audit-integration-pdfs.py /tmp/mysteryboard-integration-pdfs /tmp/mysteryboard-pdf-audit
```

`page.pdf()` nutzt in der Testautomatisierung Chromiums Druck-Backend mit dem tatsächlich vorbereiteten Druckdokument. Die Funktion selbst öffnet den Browserdruckdialog erst durch einen bewussten Tipp. Diese getrennten Nachweise belegen echte PDF-Dateien und die Auslösebedingung, aber weder eine automatisierte Bedienung des Betriebssystemdialogs noch Safari-Kompatibilität.

Die Drucktests vergleichen die unabhängigen Inhalts-/Arbeitsdaten mit dem fertigen Dokument: Karten und vollständige Texte, alle Verbindungen/Richtungen/Labels, Kategorien, Nummern/V-Kennzeichnungen, Kopfzeilen, Seitenzahlen und Querverweise. Sie prüfen Seitenränder, Schriftgröße, Offline-Verhalten, extreme gültige Texte, A3 sowie den unveränderten PNG-Arbeitsstand. Die zusätzliche PDF-Prüfung kontrolliert die tatsächlich erzeugten Seiten und Texte. Beispiele sind technische Teststände mit entsprechend gekennzeichneten Testbeziehungen, keine fachlichen Musterlösungen.

Zum Geräteabschluss: die neutralen Varianten mit 5, 12, 18 und 60 Karten sowie den Medienprüfstand auf dem tatsächlich verwendeten Safari-/iPadOS-Stand prüfen, A4 und A3 wählen, native PDF speichern, PDF öffnen und mindestens Übersicht, eine Kartenseite, Bildseite und Beziehungsseite prüfen. Danach Druckvorschau schließen, eine Karte bearbeiten und die Original-PNG in neuer Sitzung wiederherstellen. Eine Chromium-PDF und ein erfolgreicher Desktop-Test ersetzen diese Abnahme nicht.
