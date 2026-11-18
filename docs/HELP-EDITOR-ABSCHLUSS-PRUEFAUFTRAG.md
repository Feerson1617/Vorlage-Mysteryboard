# MysteryBoard – Hilfeeditor abschließen und vollständiges unabhängiges Abnahmepaket bereitstellen

## 1. Ausgangslage

Repository: `Feerson1617/Vorlage-Mysteryboard`

Aktueller Entwicklungsbranch: `feat/mysteryboard-author-help-editor`

Zuletzt unabhängig ermittelter Commit: `9aa16fd41f3ce9e5e35015bb1f4c7fe0911f8e89`

Der grafische Hilfeeditor ist bereits implementiert. Jetzt folgt die abschließende technische und nutzerorientierte Prüfung.

**Dies ist kein Auftrag zur grundlegenden Neuentwicklung.**

Die fertige Anwendung soll unabhängig in ChatGPT mit Playwright und Chromium ausgeführt und überprüft werden können. Dafür muss ein vollständiges, herunterladbares Abnahmepaket entstehen.

## 2. Bestehende Funktionen erhalten

Unverändert erhalten bleiben insbesondere:

- Universeller Lehrkräftemodus
- Karteneditor
- Import und Export von Mystery-Dateien
- Automatische Nummerierung
- Numerisch sortierte Startablage
- Original-PNG und Wiederherstellung
- Pinch-to-Zoom und bisherige Touch-Steuerung
- Undo/Redo
- Karten- und Verbindungsbearbeitung
- Medienvergrößerung
- Druckfunktion
- Universelles SCORM 1.2
- Rückwärtskompatibilität bestehender Dokumente

**Die abgeschlossene Boden-RC2 darf keinesfalls verändert werden.**

Kein Merge in `main`, kein Force-Push und keine Änderung bestehender Release-Tags.

## 3. Hilfeeditor gezielt abschließen

Prüfe die tatsächliche Bedienung des neuen Hilfeeditors und korrigiere ausschließlich reproduzierte Fehler.

Besonders zu untersuchen:

### A – Vorgefertigte Hilfetexte

- Alle fünf Vorlagen auswählbar
- Texte anschließend frei bearbeitbar
- Individuelle Änderungen bleiben beim Sichern erhalten
- Wechsel der Vorlage löscht vorhandene Änderungen nicht unbemerkt
- Verständliche Darstellung ohne pädagogische oder technische Fachsprache

### B – Farbige Nummernorientierung

- „Ursachen und Wirkungen“
- „Nutzungskonflikte“
- „Eigene Gruppen“
- „Keine farbige Hilfe“

Prüfe Zuordnung, Bearbeitung, Deaktivierung, erneute Aktivierung und das Speichern der Kategorien.

Prüfe insbesondere gleichlautende Kategorienamen mit unterschiedlicher Großschreibung oder zusätzlichen Leerzeichen.

Beispiele:

- `Ursachen`
- ` Ursachen `
- `ursachen`

Solche offensichtlich gleich gemeinten Kategorien dürfen keine widersprüchlichen Gruppierungen erzeugen.

Prüfe außerdem Farbkontraste und die Unterscheidbarkeit der angebotenen Farben.

### C – Kartenänderungen

Nach dem Löschen, Hinzufügen oder Umnummerieren von Karten müssen die hinterlegten Hilfereferenzen korrekt bleiben.

Ungültige Zuordnungen dürfen nicht stillschweigend in veröffentlichte Mystery-Dateien gelangen.

### D – Vorschau

Die Lehrkraft muss ihre Hilfe in der tatsächlichen Schüleransicht prüfen können.

Nach der Vorschau:

- keine unerwarteten Änderungen am Entwurf,
- keine gespeicherten Schüleraktionen,
- keine veränderten Kartenpositionen,
- keine verlorenen Hilfedaten,
- keine versehentlich vorgegebenen Lösungsverbindungen.

## 4. Bedienbarkeit aus Lehrkraftperspektive prüfen

Simuliere eine Lehrkraft ohne technische Vorkenntnisse.

Auftrag:

„Erstellen Sie eine Hilfe für Ihr Mystery. Wählen Sie einen Denkimpuls, ändern Sie den Text, markieren Sie einige Kartennummern farbig und stellen Sie die Aufgabe anschließend für Ihre Klasse bereit.“

Führe diesen Ablauf tatsächlich im Browser aus.

Prüfe:

1. Sind die Funktionen ohne Handbuch auffindbar?
2. Sind alle Schaltflächen eindeutig beschriftet?
3. Sind die Arbeitsschritte logisch angeordnet?
4. Können Änderungen versehentlich verloren gehen?
5. Gibt es unnötige Dialoge oder Bedienhandlungen?
6. Sind Fehlermeldungen verständlich?
7. Ist die Oberfläche auf dem iPad übersichtlich?
8. Funktionieren sämtliche Aktionen mit Touch?

Behebe unnötige Bedienhürden, ohne zusätzliche sichtbare Komplexität zu erzeugen.

## 5. Vollständiger Test des Datenkreislaufs

Führe mit der tatsächlich gebauten Anwendung diesen vollständigen Ablauf durch:

1. Lehrkraft öffnet einen bestehenden Entwurf.
2. Sie wählt einen Denkimpuls.
3. Sie verändert den Hilfetext.
4. Sie erstellt drei farbige Kategorien.
5. Sie ordnet einzelnen Kategorien Karten zu.
6. Sie lässt einige Karten bewusst unmarkiert.
7. Sie sichert den Entwurf.
8. Sie schließt die Anwendung.
9. Sie öffnet den Entwurf erneut.
10. Sie überprüft alle Hilfedaten.
11. Sie veröffentlicht eine Schülerversion.
12. Sie öffnet diese in der universellen SCORM-Anwendung.
13. Sie aktiviert beide Hilfestufen.
14. Sie überprüft die tatsächlichen Nummernfarben und die Legende.
15. Sie deaktiviert die Hilfe.
16. Sie bearbeitet Karten und erstellt beschriftete Verbindungen.
17. Sie sichert eine Original-PNG.
18. Sie stellt den Arbeitsstand in einer neuen SCORM-Sitzung wieder her.
19. Sie kontrolliert, dass temporäre Hilfefarben nicht als Schülerkartenfarben übernommen wurden.
20. Sie bearbeitet anschließend das ursprüngliche Mystery erneut, verändert Hilfekategorien und veröffentlicht eine neue Inhaltsversion.

Prüfe, dass ältere Schülerarbeitsstände weiterhin mit ihren ursprünglichen Inhalten funktionieren.

## 6. Technische Regression

Führe die vollständige vorhandene Testsuite erneut aus.

Mindestens:

- Daten- und Modelltests
- TypeScript-Prüfung
- Build- und Inhaltsvalidierung
- Chromium-Browsertests
- Touch-/Pinch-to-Zoom-Regressionen
- PNG-Import und Export
- Alte und neue Mystery-Dateiformate
- SCORM-Manifest und Sitzungslogik
- Druck A4 und A3
- Offline-Funktion
- Manipulierte und beschädigte Dokumente

Prüfe die Oberfläche bei 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln.

Keine vorhandenen Tests entfernen oder abschwächen, um positive Ergebnisse zu erzielen.

## 7. Vollständiges Abnahmepaket erstellen

Erzeuge:

**`MysteryBoard-Hilfeeditor-Abnahmepaket.zip`**

Die ZIP muss mindestens enthalten:

- Die tatsächlich gebaute `MysteryBoard-Universal.html`
- Die tatsächlich gebaute `MysteryBoard-Universal-SCORM-1.2.zip`
- Einen vollständig konfigurierten Lehrkraft-Entwurf
- Eine daraus veröffentlichte Schülerversion
- Eine Schülerversion mit dem Kategoriensystem „Nutzungskonflikte“
- Ein Mystery mit eigenen Hilfekategorien
- Ein Mystery ohne farbige Hilfe
- Eine echte Schüler-Sicherungs-PNG
- Eine überarbeitete zweite Inhaltsversion
- Screenshots der Lehrkräfteoberfläche
- Screenshots der Schüler-Hilfestufen
- Den aktuellen unabhängigen Prüfauftrag
- Testprotokolle
- Prüfsummen und Commit-SHA
- Eine kurze Anleitung zur unabhängigen Browserprüfung

**Die fertigen HTML- und SCORM-Dateien müssen physisch im ZIP enthalten sein.**

Keine bloßen GitHub-Verweise, internen Cloud-Pfade oder Screenshots als Ersatz für die ausführbare Software.

Entpacke die fertige ZIP selbst in ein frisches Verzeichnis und überprüfe ihre Vollständigkeit und Integrität.

## 8. Projektvorlage bereitstellen

Erzeuge zusätzlich die aktualisierte:

`MysteryBoard-Universal-Projektvorlage.zip`

Sie muss den gesamten aktuellen Projektstand einschließlich Quellcode, KI-Anleitung, Lehrkräfteanleitung, Beispieldateien, Validierungsskripten und SCORM-Buildprozess enthalten.

Prüfe durch eine neue Installation aus der entpackten Projektvorlage, ob sich die Anwendung reproduzierbar bauen lässt.

Die Vorlage muss später ohne Kenntnis dieses Codex-Chats an andere Lehrkräfte und KIs weitergegeben werden können.

## 9. GitHub und Abschluss

Arbeite im bestehenden Feature-Branch.

Erstelle notwendige Korrekturen als nachvollziehbare Commits und pushe sie auf denselben Branch.

Nicht in `main` mergen.

Stelle abschließend diese Dateien unmittelbar zum Herunterladen bereit:

1. `MysteryBoard-Hilfeeditor-Abnahmepaket.zip`
2. `MysteryBoard-Universal-Projektvorlage.zip`
3. `MysteryBoard-Universal-SCORM-1.2.zip`

Wenn die direkte Downloadbereitstellung nicht möglich ist, stelle die Dateien in einem eindeutig benannten Artefaktverzeichnis des bestehenden GitHub-Repositories bereit und nenne den genauen Downloadweg.

Prüfe vor Abschluss selbst, dass sämtliche Dateien tatsächlich vorhanden, vollständig und herunterladbar sind.

## 10. Verbindliche Qualitätsgrenze

Keine weiteren neuen Funktionen entwickeln.

Keine neue Architektur.

Keine Veränderungen der abgeschlossenen Boden-RC2.

**Ziel ist die unabhängige Abnahme des fertig entwickelten grafischen Hilfeeditors einschließlich seiner Bedienbarkeit, seines Datenkreislaufs und seiner SCORM-Kompatibilität.**

Der Auftrag ist erst abgeschlossen, wenn ChatGPT die tatsächliche Anwendung aus dem bereitgestellten ZIP unabhängig im Browser ausführen kann.