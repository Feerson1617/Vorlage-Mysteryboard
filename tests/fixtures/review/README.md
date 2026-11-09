# Original-Prüfdaten der Zweitprüfung

Vom Nutzer am 9. November 2026 als `MysteryBoard-Zweitprüfung.zip` bereitgestellt.
Die zwei PNG-Dateien sind byteidentische Kopien aus `Prüfdateien/`.

| Eingabe                                                      |   Bytes | SHA-256                                                          |
| ------------------------------------------------------------ | ------: | ---------------------------------------------------------------- |
| Start-ID-1000000.png                                         |  412485 | 1c75c56db6a4cf0603d0679c68c38fa3466f399f351de2ef8ce5dd6a5f27e289 |
| 60-90-Gruppenstand.png                                       | 2381276 | 5256a551a362d6372aff9781497aa27aa7a8aa329490c9038c5fb549e8c80b66 |
| Nur-zur-Prüfung-220-Verbindungen.html (Quelle im Nutzer-ZIP) |  970777 | 150215480d1a142cc71a0f91d78260c7fd86288cef68e3adb4ca2dda3426b6b7 |

`stress-220.json` enthält die unveränderten Inhaltsdaten und den vollständigen Ausgangsstand der letztgenannten HTML: Mystery `qa-medien-large`, Version `QA-1`, 60 Karten, 220 Verbindungen. Die Extraktion liest ausschließlich Literale, führt kein JavaScript der Eingabe aus und lässt sich wiederholen:

```sh
python scripts/extract-review-fixture.py /pfad/Nur-zur-Prüfung-220-Verbindungen.html tests/fixtures/review/stress-220.json
npm run build:review
```

Der separate Build `dist/review/index.html` verbindet diese Prüfdaten mit dem aktuell korrigierten Anwendungscode. Er ist ausschließlich ein QA-Artefakt und wird nicht in die beiden Schüler-HTMLs aufgenommen. Kein synthetischer Ersatz für die gelieferten Reproduktionsdaten.

Medienherkunft laut mitgeliefertem Lesehinweis: zugeschnittene Beispieldaten `coffee.png` und `rocket.jpg` aus [scikit-image v0.24.0](https://github.com/scikit-image/scikit-image/tree/v0.24.0/skimage/data); Karte und Diagramm sind synthetische Prüfmaterialien. Die Extraktion verändert weder Bilder noch Alttexte. Die Original-Prüfberichte sind unabhängige Beobachtungen des Nutzers, keine hier erneut ausgeführten WebKit- oder Gerätetests.
