# Vollständige Browserprotokolle

`full-check.txt` und `rc2.txt` enthalten die vollständigen frischen Konsolenläufe. Die Ordner `playwright-report-json` und `playwright-report-rc2-json` enthalten sämtliche unveränderten Test-/Schrittdatensätze aus den eingebetteten Playwright-Berichtsarchiven. Maschinenpfade werden erst für die portable ZIP-Dokumentlieferung neutralisiert.

Tatsächliche Importdownloads, Original-PNGs und aktuelle Screenshots liegen unter `downloads`, `screenshots` und `dokumentimport`. Die JSON-Anhangverweise alter Regressionsfälle benennen die ursprünglichen Laufdateien; diese historischen Doppelanhänge werden nicht sämtlich erneut ausgeliefert. Die vollständigen Tests im Quellpaket erzeugen sie bei Bedarf erneut. Es wird kein HTML-Bericht mit fehlenden Anhangdateien als funktionsfähiger Bericht ausgegeben.
