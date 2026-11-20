# Druckqualität und Kartenübersicht für MysteryBoard Studio 0.2.7

Die Druckübersicht verwendet dieselben Vorschauabmessungen wie die digitale Schülerpinnwand. Pro Karte erscheinen höchstens sechs Textzeilen und bis zu drei Titelzeilen. Ein gekennzeichneter Auszug verweist auf die vollständigen Kartenseiten. Medienhinweise stehen in einer eigenen Zeile und werden auch als Kartenbeschreibung für assistive Technik ausgegeben. Die zugrunde liegenden Kartentexte, Medien und Datenformate bleiben erhalten.

Komplexe Wirkungsgefüge bekommen zusätzlich vergrößerte Ausschnitte. Jeder Ausschnitt nennt seine zugeordneten Karten. Diese bleiben in ihrer gespeicherten räumlichen Anordnung und erscheinen vollständig in mindestens einem Ausschnitt. Ausschnitte können sich überlappen. Fortgesetzte Randverbindungen lassen sich über die Gesamtübersicht und die vollständigen Beziehungen verfolgen. Bei vielen oder langen Beschriftungen benennt die Übersicht die Verbindung mit einer V-Nummer. Die vollständige Beschreibung steht unter derselben Nummer bei den Beziehungen.

Die Druckseiten passen Textfragmente an Wortgrenzen ein und bevorzugen nah gelegene Absatzgrenzen. Nicht umbrechbare Zeichenfolgen, die selbst in eine leere Druckspalte nicht vollständig passen, dürfen an Unicode-Graphemgrenzen weiterlaufen. Die folgende Druckspalte kennzeichnet diese Fälle. Alle gespeicherten Zeichen bleiben erhalten. Für den Seitenwechsel ausgeblendeter Rand-Leerraum bleibt im Text des Druckdokuments erhalten.

## Nachweis

- `npm test`, `npm run build`, `npm run test:e2e` und `npm run test:rc2` prüfen die bestehenden Daten-, Browser- und Unterrichtsfunktionen.
- `STUDIO_VERSION=0.2.7 STUDIO_026_SCORM=/pfad/SCORM-30.zip node qa/studio/student-text-025.mjs /tmp/druckqualitaet` verwendet den SHA-256-geprüften SCORM-Export aus 0.2.6 für den Vorher-Nachher-Vergleich. Beide Player öffnen dieselbe Aufgabe und die Original-PNG derselben Sitzung. Mit `MB_ENGINE=webkit` wird anschließend derselbe Ausgabeordner geprüft.
- `python3 qa/studio/verify-print-quality-027.py /tmp/druckqualitaet` vergleicht die tatsächlich gerenderten A4- und A3-PDFs. PyMuPDF liest die Textbereiche positionsbezogen aus. Die Zeichen werden nach Unicode-Normalisierung und ohne darstellungsbedingten Leerraum mit den erwarteten Zeichen verglichen. Zusätzlich rendert das Skript Übersichts-, Ausschnitt- und Textseiten.
- Der Workflow `.github/workflows/studio-macos-027.yml` prüft die aus der DMG installierte ARM64-Anwendung, den exportierten SCORM-Player und die historischen Funktionen. Die technische Testfassung ist bis zum ausstehenden nativen P01-Originalnachweis aus 0.2.4 von einer Gesamtfreigabe getrennt.
