# MysteryBoard Studio 0.2.0 – UX-Abnahme

Die fertige Lehrkräfte-App für Apple Silicon wird als DMG und App-ZIP separat im [geprüften Actions-Artefakt](https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44126057507/artifacts/14347956458) bereitgestellt. Beide Dateien wurden tatsächlich heruntergeladen, ihre Bytes und SHA-256 stehen in `Mac-Dateien.json`. Das Artefakt enthält die Installer unter `out/make/` und wird bis 17. Dezember 2026 aufbewahrt. Keine Apple-Notarisierung.

- **Abnahmepaket.zip:** vollständige Quellen, alte und neue Tests, gebaute Renderer, echte native PDFs/SCORMs, Original-PNGs, Screenshots und Logs. Zum Prüfen in einem anderen Chat; kein Installationsersatz. Unter 32 MiB.
- **Beispiel-SCORM-1.2.zip:** tatsächlich aus der neuen Mac-App exportierte digitale Schüleraufgabe mit fünf neutralen Karten. Unverändert als SCORM-Ressource in itslearning hochladen. Enthält keinen Lehrkräfteeditor und keine OCR.
- **Paketpruefung.json:** vollständige Entpack-/Manifestprüfung und erneuter Build aus den versiegelten Quellen; Studio, Player, Modulnachweis und Main-Prozess bytegleich. Geprüfte gepinnte Entwicklungspakete wurden per Hardlink in den entpackten Quellbaum übernommen.
- **SHA256SUMS.txt:** Prüfsummen für Installer und die hier bereitgestellten Dateien; bei gemeinsamer Ablage mit `shasum -a 256 -c SHA256SUMS.txt` prüfen.

Im entpackten Abnahmepaket zuerst `STUDIO-MACOS.md` und `STUDIO-UX-ABNAHMEBERICHT.md` lesen. Der native Vorher-/Nachher-Vergleich liegt unter `evidence/Vergleich/Import-Vorher-Nachher.html`. Alle Einzeldateien: `python3 verify-package.py`. Die große native App ist nicht in dieser Review-ZIP versteckt.

Anwendungscode: b5788140e968e60510c85a3c9e4b49480d4ec6f7. Nativer Build: db92059d88e9a38307f925e831ad8728505c2660. Paketierungsquellen: ff073a5 (nur Nachweise und Bereitstellung ergänzt). Alle Anwendungsdateien sind gegenüber dem geprüften Stand unverändert.

Bestanden: 177 Daten-, 272 Chromium- und vier eingefrorene RC2-Tests; 23 native Mac-Prüfpunkte; tatsächliche Mac-SCORMs in Chromium und WebKit 27.2; neun unabhängige PNG-Vergleiche. Keine Tests entfernt oder abgeschwächt. Die ursprünglichen Prüfungen der nativen Tests bleiben erhalten.

Offen: manuelle Prüfung dieser neuen Fassung auf dem eigenen M1 einschließlich nativer Betriebssystemdialoge und der privaten Original-PDFs, echte itslearning-Veröffentlichung und verwaltete Schul-iPads. WebKit 26.5 fehlt. Die Browserprüfung ist keine reale iPad-/Safari-Abnahme. Keine schulische Freigabe, kein Merge, kein öffentlicher Release. Die privaten Original-PDFs und deren Nachweise liegen ausschließlich in der getrennten privaten ZIP.
