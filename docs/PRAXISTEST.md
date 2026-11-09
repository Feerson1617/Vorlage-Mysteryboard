# Praxistest: Schul-iPad und Canva Code

**Status: noch nicht praktisch abgenommen.** Die folgenden Schritte sind eine Testanleitung, keine Behauptung einer erfolgten Prüfung. Keine Schülerdaten verwenden. Zuerst mit dem kleinen Testdatensatz arbeiten; anschließend alle Sicherungsschritte mit dem umfangreichen wiederholen.

## 1. Anwendung bereitstellen

1. Die unveränderte Datei `artifacts/MysteryBoard-klein.html` bereithalten. Falls sie aus Quellcode gebaut wird: `npm ci`, `npm run build`.
2. In der konkret eingesetzten Canva-Code-Version prüfen, ob vollständiges HTML mit eingebettetem JavaScript unverändert übernommen und als interaktive Seite veröffentlicht werden kann. Die Datei enthält bereits sämtliche Ressourcen; kein CDN ergänzen. Falls die Oberfläche nur generierte Inhalte erlaubt, den vollständigen HTML-Quelltext als Grundlage übergeben und das resultierende Verhalten erneut prüfen. Eine KI-Neugenerierung ist **nicht** identisch mit dieser geprüften Datei.
3. Gibt es keinen Weg, das HTML unverändert auszuführen, diesen Schritt als **blockiert** protokollieren. Nicht durch ein Bildschirmfoto, eine Präsentationsfolie oder eine von Canva umgeschriebene Anwendung als bestanden ersetzen. Für den unabhängigen Funktionstest darf ein schulintern freigegebener statischer HTTPS-Host die HTML-Datei unverändert ausliefern; das belegt dann keine Canva-Kompatibilität.
4. Die bereitgestellte Seite im verwalteten Safari öffnen. Datum, iPad-Modell, iPadOS-/Safari-Version, Canva-Veröffentlichungsart und eingebetteten/externen Browser festhalten. Die Vorschau in „Dateien“ kann JavaScript blockieren; das ist kein vollständiger Anwendungstest.
5. „Beginnen“ antippen. Prüfen: zwölf nummerierte Karten, ruhige Oberfläche, keine dauerhafte Seitenleiste, keine fehlenden Bilder. Nach dem Laden versuchsweise die Netzwerkverbindung unterbrechen; die Arbeit muss weitergehen. Zum erneuten Laden einer gehosteten Seite ist deren Auslieferung selbstverständlich nötig.

## 2. Touch und Ansicht

1. Karte antippen: vollständiger Text, gut lesbar; Lesefenster schließen. Ansicht muss an derselben Stelle bleiben.
2. Eine Karte mit einem Finger ziehen. „Rückgängig“ muss die alte Position und Überlagerung wiederherstellen. „Wiederholen“ stellt die Verschiebung erneut her. Auf schmalen Bildschirmen erscheinen dafür die Pfeile ↶ und ↷.
3. Freie Fläche ziehen. Mit zwei Fingern zoomen und zugleich verschieben; auch direkt auf einer Karte beginnen.
4. Eine Karte kurz anziehen, dann den zweiten Finger auflegen und zoomen. Es darf keine Kartenverschiebung gespeichert und kein Lesefenster geöffnet werden. Auch nach dem ersten abgehobenen Finger darf der verbleibende keine Karte verschieben.
5. „Übersicht“ antippen. Alle Karten und äußeren Zahlen müssen wieder erreichbar sein.
6. Farbe ändern, optional selbst benennen. „Mit einer Karte verbinden“, Lesefenster schließt; zweite Karte antippen. Text eingeben, Richtung wählen, übernehmen.
7. Verbindung direkt antippen, Text/Richtung ändern und löschen. Alternativ dieselben zwei Karten erneut auswählen, um die vorhandene Verbindung zu öffnen. Mehrere Änderungen rückgängig machen und wiederholen. Nach Rückgängig eine neue Änderung durchführen: Wiederholen muss dann deaktiviert sein.
8. Im Verbindungsmodus zwei Finger verwenden: Es darf keine ungewollte Verbindung entstehen.

## 3. Sichern und vollständig fortsetzen

1. Mehrere Karten deutlich verschieben, Farben ändern, eine Verbindung mit Umlauten beschriften. Den erwarteten Zustand notieren.
2. „Sichern“ antippen. Warten, bis „Sicherungsbild herunterladen“ angeboten wird. Zuerst das große Bild prüfen; bei Problemen „Kleineres Bild erzeugen“ verwenden. Auf speicherarmen Geräten kann direkt im Menü „Kleineres Sicherungsbild“ gewählt werden, ohne zuvor ein großes Bild zu erzeugen. Erstellungsdauer und Browserabstürze protokollieren.
3. Über Download oder „Datei teilen oder ablegen“ die PNG in **Dateien** sichern. Nicht ausschließlich „Fotos“, Messenger-Komprimierung, Canva-Bildbearbeitung oder einen Screenshot verwenden.
4. Originaldatei sichtbar überprüfen: 4961 × 3508 bzw. 2480 × 1754, Kartennummern am Rand vollständig, Texte beim Vergrößern lesbar, Linien/Beschriftungen vorhanden, QR getrennt unterhalb des Boards. Export auch bei verändertem Bildschirmzoom vergleichen.
5. Anwendung schließen und in einer neuen Sitzung öffnen. Nicht auf Browser-Wiederherstellung verlassen. Die erzeugte Vorschau allein ist keine dauerhafte Ablage; auch nach Download oder Teilen kann die Anwendung dies nicht bestätigen. Eine Warnung beim Verlassen kann auf dem iPad ausbleiben.
6. „Fortsetzen“ → „Sicherungsbild auswählen“ → dieselbe Original-PNG. Positionen, Reihenfolge, Farben, Kategorienamen, Texte und Pfeilrichtungen mit den Notizen vergleichen. Rückgängig und Wiederholen müssen nach dem Import zunächst deaktiviert sein.
7. Nach Import eine Karte verschieben, eine vorhandene Verbindung bearbeiten, eine neue anlegen und wieder sichern. Erneut öffnen/importieren.
8. Mit `MysteryBoard-umfangreich.html` und 60 Karten wiederholen. Hier ist die Meldung erforderlich, dass die Originaldatei gebraucht wird; es darf kein unvollständiger QR-Code erscheinen.
9. Falsche Datei oder Sicherung des anderen Test-Mysterys wählen. Fehlermeldung erwarten, bisherigen Stand unverändert prüfen. Dateiauswahl bzw. laufenden Import abbrechen und denselben Schutz prüfen.

## 4. Optional: Kamera und QR

1. Die kleine PNG auf einem zweiten Bildschirm oder sauber ausgedruckt anzeigen. Am iPad „Fortsetzen“ → „QR-Code scannen“.
2. Kamera freigeben, sofern Browser und Einbettung dies erlauben. Code vollständig einschließlich weißem Rand erfassen. Er muss denselben vollständigen Zustand wiederherstellen und darf keine externe URL öffnen.
3. Bei verweigerter Kamera muss die Bildauswahl weiterhin funktionieren. Bei Canva-Einbettung sind HTTPS, iframe-Sandbox, Download- und Kamera-Berechtigungen separat zu prüfen; eine Webseite kann eine fehlende Plattformfreigabe nicht selbst erzwingen.
4. Dialog schließen: Kameraindikator muss ausgehen. Ungültigen/fremden Code zeigen: Meldung erwarten, bisherigen Stand prüfen.
5. Scanentfernung, Bildschirm-/Druckgröße, Licht und Erfolg notieren. Nach erfolgreichem Scan ebenfalls eine vorhandene Verbindung ändern.

## Abnahmebogen

Für jeden Punkt „bestanden / fehlgeschlagen / nicht geprüft“, Gerät, Version und konkrete Beobachtung erfassen. Besonders relevant: Gestenüberschneidung, Speicherbedarf, Metadatenerhalt beim gewählten iPad-Dateipfad, unveränderte HTML-Ausführung in Canva, Downloadrechte und Kamera. Erst nach diesen Prüfungen gelten Schul-iPad und Canva als praktisch abgenommen.
