# Kallihno – Online-Einkommen mit digitalen Vorlagen

**Die Idee:** Ein fertiger deutscher **„Finanzplaner 2027“** (Excel / Google Sheets) als digitales
Produkt. Du verkaufst ihn auf Etsy (und optional auf Digistore24 oder Gumroad). Die Kundschaft kommt
über **faceless TikTok- und Pinterest-Videos**, für die du dein Gesicht nicht zeigen musst.
Das Produkt ist schon gebaut: `produkt/Finanzplaner_2027.xlsx`.

| | |
|---|---|
| Startkosten | ca. 0–25 € (Etsy: 0,20 $ pro Listing; Gewerbeanmeldung je nach Stadt ca. 15–60 €) |
| Zeit | ca. 1 h/Tag (1 Video am Tag und Nachrichten beantworten) |
| Grenzkosten pro Verkauf | 0 € (die Datei wird beliebig oft verkauft) |
| Bestes Timing | **JETZT.** Mitte Dezember bis Ende Januar suchen die meisten Leute nach Budget-Planern („Neujahrsvorsätze“) |

## Warum genau das? (Ergebnis der Recherche)

1. **Vorlagen sind die meistverkaufte Kategorie digitaler Produkte** auf Etsy und Gumroad
   (Notion, Excel, Canva, Google Sheets).
2. **Auf Deutsch gibt es viel weniger Konkurrenz.** Der Markt ist voll mit englischen Planern,
   gut gemachte deutsche Planer mit € und deutschen Kategorien gibt es dagegen kaum.
3. **Faceless TikTok** ist der aktuelle Trend für diese Produkte: Bildschirmaufnahme, Text darüber,
   Link in der Bio. TikTok Shop nimmt digitale Produkte meist nicht an, deshalb geht der Traffic
   über den Bio-Link zu Etsy.
4. **Was dagegen spricht:** Dropshipping und Print-on-Demand brauchen Kapital und Werbebudget.
   Umfragen bringen fast nichts. Freelancing tauscht Zeit gegen Geld.
   Eine Vorlage kostet 0 € pro Verkauf und skaliert.

**Ehrliche Erwartung:** Die meisten verdienen im ersten Monat wenig bis nichts. Ob es klappt,
hängt fast nur am Traffic, also daran, ob du **täglich** Videos postest. Realistisch sind nach
2–3 Monaten konsequenter Arbeit ein paar hundert Euro im Monat. Garantiert ist nichts.

## Rechnung (Beispiel)

Preis 12,90 €, abzüglich ca. 6,5 % Etsy-Transaktionsgebühr, ca. 4 % Zahlungsgebühr und Listing:
**ca. 11,30 € bleiben pro Verkauf.** 2 Verkäufe am Tag ergeben ca. 680 € im Monat.

## Fahrplan (14 Tage bis zum ersten Verkauf)

| Tag | Aufgabe |
|---|---|
| 1 | Planer öffnen und durchklicken. Farbe oder Namen nach Geschmack anpassen (`tools/build_finanzplaner.py`, Variablen oben) |
| 1 | Etsy-Shop eröffnen (Name z. B. „Planerglück“, „Finanzklar“), Konto-Verifizierung starten |
| 2 | 5 Produktbilder in Canva erstellen (kostenlos): Screenshots von Jahresübersicht, Budget-Ampel, Sparzielen, Schuldenfrei-Rechner und eine „Was ist drin?“-Grafik |
| 2 | Listing anlegen, die Texte stehen fertig in `marketing/etsy-listing.md` |
| 3 | TikTok-Account „@finanzklar.planer“ o. ä. anlegen, Bio-Link zum Etsy-Shop |
| 3–30 | **Täglich 1–2 Videos** nach `marketing/tiktok-30-tage.md`, dieselben Videos zusätzlich als Pinterest-Idea-Pins und YouTube Shorts hochladen |
| 7 | Erste Bewertungen: Freunden/Familie anbieten, den Planer zu kaufen und ehrlich zu bewerten (Etsy verbietet Fake-Bewertungen, also keine erfinden) |
| ab 10 | Was funktioniert? Die Videos mit den meisten Aufrufen variieren und neu posten |
| ab 30 | Weitere Produkte: Haushaltsbuch für Paare, WG-Kassen-Planer, Hochzeitsbudget, Selbstständigen-Planer (EÜR light), dann ein Bundle |

## Rechtliches in Deutschland (kurz, keine Rechtsberatung)

- **Gewerbe anmelden**, sobald du regelmäßig verkaufst (Gewerbeamt/online, je nach Stadt ca. 15–60 €).
- **Kleinunternehmerregelung (§ 19 UStG):** Bis 25.000 € Umsatz im Vorjahr musst du keine Umsatzsteuer
  ausweisen. Das Häkchen setzt du bei der steuerlichen Erfassung beim Finanzamt.
- **Einkommensteuer:** Der Gewinn kommt in die Steuererklärung (Anlage G und EÜR).
- **Etsy** führt die EU-Mehrwertsteuer für digitale Artikel selbst ab, wenn du über Etsy verkaufst.
- **Impressum und Widerrufsbelehrung** im Etsy-Shop hinterlegen. Bei digitalen Inhalten erlischt
  das Widerrufsrecht nur, wenn der Käufer dem ausdrücklich zustimmt. Hier lohnt eine geprüfte Vorlage
  (z. B. von Händlerbund oder IT-Recht-Kanzlei).
- Der Schuldenrechner enthält den Hinweis „keine Finanzberatung“. Lass ihn drin.

## Dateien

**👉 Start hier: `DEINE-TODOS.md`** mit allem, was du jetzt tun musst, und den Texten zum Reinkopieren.

- `produkt/Finanzplaner_2027.xlsx`: **Produkt 1** mit 7 Blättern, Dropdowns, Ampel, Diagrammen, Sparzielen und Schuldenfrei-Rechner
- `produkt/Paar-Haushaltsbuch_2027.xlsx`: **Produkt 2**, rechnet aus, wer wem wie viel überweisen muss (50/50 oder nach Einkommen)
- `produkt/Finanzplaner_2027_LITE_gratis.xlsx`: kostenlose Basis-Version als Köder (Pinterest, Reddit, Bio-Link)
- `marketing/bilder/`: 8 Etsy-Bilder (2000×2000) und 1 Pinterest-Pin (1000×1500)
- `marketing/videos/`: 5 fertige TikTok-, Reels- und Shorts-Videos (1080×1920, je ca. 10 s)
- `tools/build_finanzplaner.py`: erzeugt den Planer neu (für 2028 `JAHR` ändern; `--lite` erzeugt die Gratis-Version)
- `tools/build_paare.py`: erzeugt das Paar-Haushaltsbuch neu
- `tools/media/`: erzeugt Bilder und Videos neu (`python make_pages.py && node shoot.js && ./make_videos.sh`)
- `marketing/etsy-listing.md`: Titel, 13 Tags, Beschreibung und Preisstrategie
- `marketing/tiktok-30-tage.md`: 30 Video-Ideen mit Hooks, Ablauf und Hashtags
- `marketing/weitere-ideen.md`: Plan B/C und Produktideen zum Skalieren
