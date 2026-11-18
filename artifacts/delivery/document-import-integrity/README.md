# MysteryBoard: tatsächliche Dokumentimport-Lieferung

Quellcommit: **059bc50b7a2d58924264df1cd734697f0157feae**, Basis **8418a445248893c2ba01bea673d84febcdf36537**. Ausschließlicher Branch: `feat/mysteryboard-document-import-integrity`.

Dieser Lieferordner enthält wirkliche ZIP-Dateien. Auf GitHub beim ZIP **Download raw file** wählen; die Chat-Antwort enthält zusätzlich direkte, commitgebundene HTTPS-Downloads. Der Commit dieses Lieferordners ergänzt ausschließlich Dateien unter diesem Pfad. Der Anwendungscode ist genau der angegebene Quellcommit.

- [MysteryBoard-Dokumentimport-Abnahmepaket.zip](MysteryBoard-Dokumentimport-Abnahmepaket.zip): aktuelle Einzel-HTML und bytegleiche SCORM-App, echte DOCX-/PDF-Originale A–H, Quellenbilder und Vergleichsmanifest, frisch importierte Entwürfe/Aufgaben, zwei Inhaltsversionen, Original-PNGs, zwanzig tatsächlich erzeugte A4-/A3-PDFs, Screenshots, vollständige Testprotokolle und unabhängig startbare Playwright-Skripte.
- [MysteryBoard-Universal-Projektvorlage.zip](MysteryBoard-Universal-Projektvorlage.zip): vollständiger Quellcode, Lockdatei, Schemata, Beispiele, sämtliche Testfälle, aktuelle Downloadbeispiele und Protokolle. Enthält keine rekursiven Liefer-ZIPs oder installierten Abhängigkeiten. Doppelte Screenshotkopien stehen im Abnahmepaket.
- [MysteryBoard-Universal.html](MysteryBoard-Universal.html) und [MysteryBoard-Universal-SCORM-1.2.zip](MysteryBoard-Universal-SCORM-1.2.zip): dieselben fertigen Produktionsdateien zusätzlich einzeln.

Die drei ZIPs wurden tatsächlich entpackt und auf CRC, Vollständigkeit, alle Inhaltsprüfsummen und bytegleiche Anwendung geprüft. Aus dem endgültig entpackten Quell-ZIP wurde mit eigenem `npm ci` kalt neu gebaut; HTML und SCORM sind bytegleich. Der Browserprüfer wurde mit eigener Installation aus dem endgültigen Abnahmepaket gestartet und besteht alle zwölf Prüfgruppen. Nachweise: [ZIP-PRUEFUNG.json](ZIP-PRUEFUNG.json), [LIEFERPRUEFUNG.json](LIEFERPRUEFUNG.json), Schlussprotokolle und [SHA256SUMS.txt](SHA256SUMS.txt).

Gesamtergebnis: **130 Datentests, 193 Chromium-Browsertests, vier zusätzliche eingefrorene Boden-RC2-Tests bestanden**. Die unmittelbare Split/Merge-Rücksetzung stellt originale Zeichen/Absätze und Quelle wieder her; der echte heruntergeladene Entwurf und die daraus erzeugte Aufgabe sind geprüft. Unklare Zusammenführungen verlangen Bestätigung, unterschiedliche Quellen bleiben erhalten.

[PRUEFBERICHT.md](PRUEFBERICHT.md) enthält Ursachen, Änderungen, genaue Befehle, Messwerte und Grenzen. Die HTML umfasst 5.564.484 Bytes. Echte Safari-/verwaltete Schul-iPad-/itslearning-/Canva-Tests, native iPad-Druckausgabe und physische Gesamtspeichermessungen bleiben offen. WebKit 26.5 ist nicht verfügbar, 27.2 fehlt die nötige Systemumgebung. Die Cloud blockiert direkte file://-Navigation; die tatsächlichen Dateien wurden über localhost geladen und anschließend offline geprüft. Keine schulische Freigabe, kein Merge und kein Pages-/Release-Deployment.
