# MysteryBoard Studio 0.2.0 für Windows x64

Windows-spezifische Ergänzung zur unveränderten macOS-Referenz
`39ff7853293b49c4aba180b49cf5331e26df96e7`.
`macos-reference.json` erfasst alle 1.695 ursprünglichen Dateien mit Git-Blob,
Dateigröße und SHA-256. `node windows/integrity.mjs` vergleicht den gesamten
Arbeitsbaum und verbietet Änderungen an bestehenden Dateien.

Die historische Dokumentation enthält im selben Ordner `RESULTS.json` und
`results.json`. Deshalb materialisiert der Windows-Checkout genau diese beiden
historischen Belegdateien nicht. Beide Git-Blobs werden weiterhin vollständig
gegen ihre ursprünglichen SHA-256-Werte geprüft. Alle übrigen 1.693 Dateien,
insbesondere sämtliche Anwendungsdateien, werden auch als Arbeitsdateien geprüft.
Es wird keine geschützte Datei umbenannt, gelöscht oder geändert.

Auf Windows x64 mit Node 24.22.1:

```powershell
npm ci
npm ci --prefix windows
node windows/build.mjs
```

Die ursprüngliche `package.json`, Lockdatei, Forge-Konfiguration, React-Oberfläche,
Core-Module, Electron-Hauptprozessdateien, macOS-Workflows und bisherigen Artefakte
bleiben unverändert. `windows/package-lock.json` isoliert die zusätzlichen
Forge/Squirrel-Abhängigkeiten. Das vollständige Anwendungsbundle wird in einen
Windows-Stagingordner kopiert. Nur dessen package.json wählt den zusätzlichen
Windows-Bootstrap. Squirrel-Installationsereignisse erzeugen keine Editorfenster.
Es gibt keinen Auto-Updater oder Update-Netzwerkdienst.

`build-ui.mjs` normalisiert nur Vites Buildpfade für das unveränderte Lizenz-Audit.
`localize-ui.mjs` ersetzt im generierten Windows-HTML ausschließlich die sichtbaren
Mac-Tastenkürzelhinweise; die Sicherheitsrichtlinie erhält die neuen Skripthashes.
Keine Quellkomponente wird dafür bearbeitet. Alle Anwendungsfunktionen sind die
der eingefrorenen Referenz.

Der separate Workflow `.github/workflows/studio-windows.yml` verwendet einen
regulären kostenlosen `windows-2025`-Runner im öffentlichen Repository. Er baut
Installer und portablen Ordner, startet beide tatsächlich, prüft native Dateien,
Offline-OCR, PDF, SCORM und frische PNG-Wiederherstellung, entpackt das Gesamtpaket
neu, installiert erneut und wiederholt einen vollständigen Projektablauf.

Windows 11 x64 ist das Ziel; der automatisierte Host ist Windows Server 2025.
Ein Runner-Test ist keine Freigabe für verwaltete Schul-PCs mit eingeschränkten
Rechten. Die ausführbare Datei ist nicht vertrauenswürdig codesigniert;
SmartScreen-/Organisationsregeln können warnen oder blockieren. Keine globalen
Schutzfunktionen werden deaktiviert. Die eigentliche Anwendung benötigt keine
Entwicklerwerkzeuge und keinen Internetzugang.

Das einzige abschließende Komplettpaket liegt unter
`windows/delivery/MysteryBoard-Studio-0.2.0-Windows-x64-KOMPLETTPAKET.zip`.
Ein Kandidat wird nicht als technisch abgenommen bezeichnet. Maßgeblich sind
ausschließlich ein erfolgreicher nativer Workflow und die darin enthaltenen
Prüfergebnisse. Kein GitHub-Release, Merge oder Eingriff in main ist vorgesehen.
