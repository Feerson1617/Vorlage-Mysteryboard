# Eigene neutrale PDF-Vergleichsdokumente

Die drei PDFs sind ausschließlich synthetisch und für dieses Projekt selbst erzeugt. Sie enthalten keine Texte, Bilder oder Metadaten aus hochgeladenen Unterrichtsmaterialien.

- `Rahmen-20.pdf`: zwei Seiten, drei Spalten, fünf beziehungsweise zwei Reihen; 15 + 5 ausgefüllte Zellen, ein leeres Feld, zwei echte Zweiparagraphenfelder, Kopf-/Fragetext und gesonderter Arbeitsauftrag. Leicht unterbrochene gemeinsame Linien.
- `Ohne-Rahmen-16.pdf`: zwei Spalten mit acht Zeilen, eigene unsortierte Buchstabenfolge und zentrierte Überschriften/Kartentexte.
- `Unklare-Bereiche.pdf`: unbeschriftete räumliche Textgruppen; ausdrücklich unsichere Erkennung und manuelle Grenzen nötig.

`ERWARTETE-KARTEN.json` enthält die vollständigen unabhängigen Solltexte aus dem Erzeugungsskript. `python3 generate.py` erzeugt die Dateien mit dem kostenlosen ReportLab. Die fertigen PDFs werden eingecheckt; ReportLab ist keine Laufzeitabhängigkeit des Editors und zum Ausführen der Browserregression nicht nötig.

Die beiden realen hochgeladenen PDFs werden zusätzlich außerhalb des öffentlichen Repositorys geprüft. Deren Originale, Screenshots und abgeleitete Aufgaben dürfen nicht in öffentliche Regressionen oder Lieferungen übernommen werden.
