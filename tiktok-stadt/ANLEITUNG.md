# 🏙️ TikTok-Stadt – Anleitung für deinen Live

Jeder Zuschauer bekommt ein Grundstück in der Stadt. Wer im Chat schreibt, dessen Haus wächst:
Hütte → Häuschen → Haus → Villa → … → Hochhaus → Wolkenkratzer → Fernsehturm → goldener Mega-Tower.

![Vorschau](vorschau.png)

Das Programm läuft **auf deinem Computer** während des Lives. Es liest jeden Kommentar, jeden
neuen Zuschauer, jeden Follow, jedes Teilen, alle Likes und Geschenke mit und baut die Stadt live.

## Regeln (stehen auch unten im Bild)

| Aktion | Punkte |
|---|---|
| Kommentar | +1 (höchstens alle 2 Sekunden pro Person, gegen Spam) |
| Folgen | +5 und eine pinke Fahne auf dem Dach |
| Live teilen | +3 |
| Likes | +1 je 50 Likes |
| Geschenk | +1 pro Diamant (Rose = 1, größere Geschenke viel mehr) |
| `!farbe pink` im Chat | färbt das eigene Haus (rot, blau, grün, gelb, lila, pink, rosa, orange, schwarz, weiß, türkis, braun, grau, gold) |

| Punkte | Gebäude |
|---|---|
| 0 | Grundstück |
| 1 | Hütte |
| 3 | Häuschen |
| 6 | Haus |
| 10 | Villa |
| 16 | Stadthaus |
| 25 | Mehrfamilienhaus |
| 40 | Bürogebäude |
| 60 | Hochhaus |
| 90 | Wolkenkratzer |
| 130 | Fernsehturm |
| 200 | Mega-Tower (gold) |

Ändern kannst du alles oben in `server.js` (Abschnitt „Einstellungen“).

## Heute einmal testen (10 Minuten)

1. **Node.js installieren:** https://nodejs.org → „LTS“ herunterladen und installieren.
2. Diesen Ordner `tiktok-stadt` auf deinen Computer laden (GitHub → grüner Knopf „Code“ → „Download ZIP“, entpacken).
3. Doppelklick auf **`START-WINDOWS.bat`** (Mac: `START-MAC.command`, beim ersten Mal Rechtsklick → Öffnen).
4. **`2` wählen** = Probelauf mit erfundenen Zuschauern. Der Browser öffnet die Stadt und sie wächst von selbst.
   So siehst du, wie es aussieht, ohne live zu sein.

## Morgen Mittag im Live

1. `START-WINDOWS.bat` starten, **`1`** wählen, deinen TikTok-Namen eingeben (ohne @).
   Du kannst das schon vor dem Live starten: Das Programm wartet und verbindet sich automatisch, sobald du live bist.
2. Im schwarzen Fenster siehst du jeden Kommentar mitlaufen. **Fenster offen lassen**, solange du live bist.
3. Die Stadt in den Live bringen, eine dieser Möglichkeiten:

**A) TikTok LIVE Studio (PC, empfohlen)**
„Quelle hinzufügen“ → „Link“ bzw. „Browser“ → `http://localhost:3000` → Größe 1080 × 1920 (Hochformat).

**B) OBS (falls du über OBS streamst)**
Quelle „Browser“ → URL `http://localhost:3000`, Breite 1080, Höhe 1920.
Willst du dich selbst dahinter zeigen: `http://localhost:3000/?durchsichtig=1` (Himmel wird durchsichtig).

**C) Nur mit dem Handy**
Computer und Handy ins gleiche WLAN. Auf dem PC die IP-Adresse herausfinden
(Windows: `ipconfig` → „IPv4-Adresse“, z. B. 192.168.178.23). Auf dem Handy im Browser
`http://192.168.178.23:3000` öffnen und in der TikTok-App den Live mit **Bildschirm teilen** starten.
(Windows fragt beim ersten Start evtl. nach der Firewall → „Zulassen“ für private Netzwerke.)

## Gut zu wissen

- **Die Stadt bleibt gespeichert** (Ordner `data`). Beim nächsten Live geht es weiter, Stammzuschauer behalten ihr Haus.
  Neu anfangen: Option `3` beim Start.
- **Verbindung weg?** Das Programm verbindet sich alle paar Sekunden von selbst neu. Die Stadt geht nicht verloren.
- **Weitere Ansicht-Optionen:** `?ohneliste=1` blendet die Rangliste aus. Mehrere kombinieren mit `&`,
  z. B. `http://localhost:3000/?durchsichtig=1&ohneliste=1`.
- Das Mitlesen läuft über die kostenlose, inoffizielle Bibliothek *TikTok-Live-Connector*. TikTok hat keine
  offizielle Schnittstelle dafür. Wenn TikTok etwas umstellt, kann die Verbindung ausfallen → dann im Ordner
  `npm install tiktok-live-connector@latest` ausführen. **Deshalb unbedingt heute einmal testen.**
- Bei sehr großen Lives schickt TikTok nicht jeden einzelnen Beitritt und jedes Like mit. Kommentare,
  Follows und Geschenke kommen zuverlässig an.

## Ideen für die Moderation

- Am Anfang: „Jeder, der hier ist, hat schon ein Grundstück! Schreib was, dann baust du.“
- Alle 10 Minuten die Top 3 vorlesen: „Anton hat den Mega-Tower! Wer holt ihn ein?“
- Ziel ausrufen: „Bei 50 Gebäuden …“ (Zähler steht oben).
- Neue Zuschauer begrüßen, sobald unten „bekommt ein Grundstück“ erscheint.
