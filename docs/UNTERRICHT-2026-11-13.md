# Eingefrorene Unterrichtsversion für Freitag, 13. November 2026

Dokumentationsstand: **12. November 2026, Europe/Berlin**.

Die Unterrichtsversion bleibt getrennt von der danach entwickelten Druckfunktion.
Ihre feste Referenz ist `unterricht-2026-11-13-rc1`, ihr vollständiger Quellcommit
`240d5fcfcac7e5924efe169493c9f7525ba5ed74`. Die Boden-Inhalte bleiben Version 2.0.0.
Der Anwendungskern und sämtliche Inhalte werden für diese Bereitstellung nicht
neu gebaut oder verändert. `main` bleibt unberührt.

| Datei                              |  Bytes | SHA-256                                                            |
| ---------------------------------- | -----: | ------------------------------------------------------------------ |
| `MysteryBoard-Boden-Klasse11.html` | 459540 | `4c451aec074a8cca75dd1879fce21ef5a6e0b32ce40b6af9412b9f70186540e8` |
| `MysteryBoard-klein.html`          | 457990 | `5eee3c8230d51a6a22bc1198843102345b4fe279000d6b130889ca26dd1b94c2` |
| `MysteryBoard-umfangreich.html`    | 490876 | `800eeaf7c086a15850980a77e0f517796d4e582dac7fb914b452a94c71bef36f` |

Das separate Unterrichts-ZIP enthält die Boden-HTML, ein Manifest, eine kurze
Zehn-Schritte-Anleitung und Prüfsummen. Das Referenzarchiv enthält zusätzlich die
beiden anderen unveränderten Produktions-HTMLs. Keine später erzeugte HTML aus
dem Druck-Entwicklungsbranch als diese Unterrichtsversion ausgeben.

## Lokales Pages-Paket ohne Veröffentlichung

Das lokale Paket liegt bereits unter
`/workspace/Mysteryboard-print/dist/unterricht-pages/`. Zur Reproduktion in einem
Checkout, das `scripts/prepare-classroom-pages.mjs` enthält und dessen Zielordner
noch leer ist, ausführen:

```sh
node scripts/prepare-classroom-pages.mjs
sha256sum dist/unterricht-pages/index.html
```

Das Skript benötigt nur Node.js und Git. Es liest ausschließlich die Boden-HTML
des festen Unterrichtscommits, prüft das Tag-Ziel sowie die oben angegebene
SHA-256 und Größe und schreibt `index.html`, `.nojekyll` und `manifest.json` nach
`dist/unterricht-pages/`. Dieses Ziel muss leer sein; vorhandene Dateien werden
nicht überschrieben. Kein `npm run build`, kein Browserdownload und kein
Netzwerkzugriff sind dafür erforderlich. Fehlendes Tag oder ein abweichendes
Tag-Ziel führen zum Abbruch. Das Skript legt keinen Branch an und pusht nichts.

## Einfacher Pages-Weg nach ausdrücklicher Veröffentlichungsfreigabe

Der separate Branch **`pages-unterricht-2026-11-13`** ist innerhalb desselben
Repositories bereits **lokal als prüfbares Bereitstellungsartefakt vorbereitet**:

- Bereitstellungscommit: `0a1536e1121e4cbb6f8501c120a9ae36af821346`.
- Worktree: `/workspace/Mysteryboard-unterricht-pages`.
- Genau drei versionierte Dateien: `index.html`, `.nojekyll`, `manifest.json`.
- Die `index.html` ist byteidentisch mit der Boden-HTML aus dem Unterrichtscommit
  `240d5fcfcac7e5924efe169493c9f7525ba5ed74`.
- **Noch kein Push dieses Pages-Branches und keine Veröffentlichung.**

Dieser Weg benötigt keinen Merge des Entwicklungsbranches oder des manuellen
Actions-Workflows in `main`. Der bisherige Workflow bleibt als anderer
Veröffentlichungsweg erhalten; er wird für diesen Unterrichtsbranch nicht benötigt.

Falls dieser Cloud-Worktree später nicht mehr verfügbar ist, enthält das
Abnahmepaket unter `nachweise/pages-unterricht-2026-11-13.bundle` denselben
Bereitstellungscommit. In einem vorhandenen lokalen Checkout desselben
Repositories kann die Referenz ohne Veröffentlichung wieder eingelesen werden:

```sh
MB_PAGES_BUNDLE='/PFAD/ZUM/ABNAHMEPAKET/nachweise/pages-unterricht-2026-11-13.bundle'
git bundle verify "$MB_PAGES_BUNDLE"
git fetch "$MB_PAGES_BUNDLE" refs/heads/pages-unterricht-2026-11-13:refs/heads/pages-unterricht-2026-11-13
git rev-parse pages-unterricht-2026-11-13
```

Das Ergebnis muss `0a1536e1121e4cbb6f8501c120a9ae36af821346` sein.
Einen bereits abweichenden lokalen Branch nicht erzwingen oder zurücksetzen.
Dieser lokale Import aktiviert keine Pages-Veröffentlichung.

**Die folgenden Git- und GitHub-Schritte erst nach ausdrücklicher Freigabe zur
öffentlichen Veröffentlichung ausführen.** Sie sind eine Anleitung, kein Nachweis
einer bereits ausgeführten Bereitstellung. Vorher die tatsächlichen Pages-
Einstellungen prüfen; ein Push auf einen bereits als Pages-Quelle verwendeten
Branch kann unmittelbar eine Veröffentlichung auslösen.

1. Den bereits vorbereiteten Bereitstellungscommit im bestehenden Repository
   prüfen. Seine `index.html` muss die oben angegebene feste Boden-Prüfsumme haben:

   ```sh
   git show 0a1536e1121e4cbb6f8501c120a9ae36af821346:index.html | sha256sum
   ```

2. **Erst nach ausdrücklicher Veröffentlichungsfreigabe** genau diesen Commit
   mit einem normalen Push an den separaten Pages-Branch übertragen:

   ```sh
   git push origin 0a1536e1121e4cbb6f8501c120a9ae36af821346:refs/heads/pages-unterricht-2026-11-13
   ```

   Kein Force-Push. Falls der Remote-Branch bereits abweichende Änderungen enthält
   und Git den Push zurückweist, zuerst den Konflikt prüfen. `main` und die
   Entwicklungsbranches werden durch diesen Befehl nicht verändert.

3. Auf GitHub im vorhandenen Repository **Settings → Pages → Build and deployment**
   öffnen. Als **Source: Deploy from a branch**, als Branch
   **`pages-unterricht-2026-11-13`**, als Ordner **`/(root)`** wählen und speichern.
   Falls Rechte, Tarif oder Repository-Sichtbarkeit dies verhindern, den konkreten
   Fehler dokumentieren; keine erfolgreiche Veröffentlichung annehmen.
4. Den tatsächlichen Pages-Deploymentstatus abwarten und ausschließlich die von
   GitHub dort bestätigte HTTPS-Adresse übernehmen. Hier wird keine Adresse
   vorweggenommen. Den Link selbst öffnen; ein grüner Build allein beweist noch
   keine Erreichbarkeit im Schulnetz.
5. Die tatsächlich ausgelieferte HTML herunterladen und ihre SHA-256 mit der
   festen Boden-Prüfsumme vergleichen. Beispiel mit der von GitHub angezeigten
   Adresse, erst nach Ersetzen des Platzhalters:

   ```sh
   MB_STUDENT_URL='DIE_TATSAECHLICH_ANGEZEIGTE_HTTPS_ADRESSE'
   curl --fail --location "$MB_STUDENT_URL" --output /tmp/MysteryBoard-Unterricht-geladen.html
   sha256sum /tmp/MysteryBoard-Unterricht-geladen.html
   ```

Auf den Unterrichtsbranch keine spätere Entwicklungsfassung pushen. Änderungen
am Druck-Entwicklungsbranch veröffentlichen sich durch diesen Pages-Weg nicht
automatisch. Der Schülerlink lädt direkt die Boden-HTML; es gibt keine zusätzliche
Auswahl, Datenbank, Anmeldung oder Übertragung von Teamnamen/Antworten durch die
Anwendung. Nach dem Laden funktioniert die Bearbeitung offline. Das erneute
Öffnen nach vollständigem Schließen kann erneut Netzwerkzugang erfordern.

## Nur bei Bedarf: lokale Reproduktion in einem frischen Checkout

Diese Schritte sind für die oben bereits vorbereitete Bereitstellung **nicht
erneut erforderlich**. Sie beschreiben ausschließlich die lokale Erzeugung in
einem frischen Checkout ohne vorhandenen Branch `pages-unterricht-2026-11-13`.
Das feste Unterrichtstag und das Paketierungsskript müssen dort vorliegen.
Zuerst das leere `dist/unterricht-pages/` wie oben erzeugen. Anschließend mit
Git-Unterstützung für `worktree add --orphan` ausführen (in der Cloud mit Git
2.52.0 vorbereitet):

```sh
MB_REPO_DIR="$(git rev-parse --show-toplevel)"
MB_PAGES_DIR="$(dirname "$MB_REPO_DIR")/Mysteryboard-unterricht-pages"
git worktree add --orphan -b pages-unterricht-2026-11-13 "$MB_PAGES_DIR"
cp "$MB_REPO_DIR/dist/unterricht-pages/index.html" "$MB_PAGES_DIR/index.html"
cp "$MB_REPO_DIR/dist/unterricht-pages/.nojekyll" "$MB_PAGES_DIR/.nojekyll"
cp "$MB_REPO_DIR/dist/unterricht-pages/manifest.json" "$MB_PAGES_DIR/manifest.json"
sha256sum "$MB_PAGES_DIR/index.html"
git -C "$MB_PAGES_DIR" add index.html .nojekyll manifest.json
git -C "$MB_PAGES_DIR" commit -m "Prepare frozen classroom candidate for 2026-11-13"
```

Diese Reproduktionsbefehle enthalten keinen Push. Der separate Worktree gehört
zum bestehenden Repository und ersetzt keinen Entwicklungsbranch. Ein erneut
erzeugter Commit kann wegen seiner Metadaten eine andere SHA erhalten; er ist
gesondert zu prüfen und nicht automatisch mit dem oben genannten konkreten
Bereitstellungscommit gleichzusetzen. Keinen vorhandenen Branch zurücksetzen.
Falls Git `--orphan` nicht unterstützt, ein unterstütztes Git verwenden; keine
destruktive Bereinigung eines vorhandenen Branches vornehmen.

## Zehn Schritte auf einem echten verwalteten Schul-iPad

Datum, tatsächlichen Schülerlink, Commit, iPadOS-/Safari-Version, Gerät und Ergebnis
notieren. Stand 12. November 2026: **reale Schul-iPad-Abnahme noch offen**.

1. Schülerlink in Safari öffnen.
2. Teamnamen eingeben und beginnen.
3. Pflichtkarte öffnen und bewusst schließen.
4. Karte verschieben und mit einer anderen verbinden.
5. Beschriftung und Pfeilrichtung bearbeiten.
6. Eine V-Karte verwenden.
7. Original-PNG herunterladen und in „Dateien“ ablegen.
8. Browser vollständig schließen und die Seite erneut öffnen.
9. Original-PNG importieren; Team, Karten, Farben, Kategorien und Verbindungen vergleichen.
10. Arbeitsstand weiterbearbeiten und erneut sichern.

Wenn möglich zusätzlich die Original-PNG auf ein zweites verwaltetes Schul-iPad
übertragen und dort wiederherstellen. Screenshots oder von anderen Apps
umgewandelte Bilder ersetzen die Original-PNG nicht. Den Browser erst nach
wirklich abgelegter Datei verlassen: Eine erzeugte PNG ist noch kein Nachweis
einer außerhalb der Anwendung gespeicherten Sicherung.

Eine Browseremulation ersetzt diesen Praxistest nicht. Für Canva nur die
unveränderte Boden-HTML einsetzen und den tatsächlich veröffentlichten Canva-Link
gesondert prüfen; keine Canva-Kompatibilität allein aus der HTML- oder Pages-
Prüfung ableiten. Die Unterrichtsversion ist ein eingefrorener Release-Kandidat,
keine bereits bestätigte vollständige schulische Freigabe.
