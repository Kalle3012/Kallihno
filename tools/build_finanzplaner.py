"""Erzeugt produkt/Finanzplaner_2027.xlsx – das verkaufbare Hauptprodukt."""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import DataBarRule, CellIsRule
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.comments import Comment

JAHR = 2027
F = "Arial"
GRUEN = "2E7D5B"; HELL = "E8F3EE"; GELB = "FFF4CC"; GRAU = "F4F4F4"
EUR = '#,##0.00 €;-#,##0.00 €;"-"'
thin = Side(style="thin", color="D0D0D0")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def head(ws, row, cols, values):
    for c, v in zip(cols, values):
        cell = ws.cell(row=row, column=c, value=v)
        cell.font = Font(name=F, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=GRUEN)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BOX

def title(ws, text, sub):
    ws["A1"] = text; ws["A1"].font = Font(name=F, size=18, bold=True, color=GRUEN)
    ws["A2"] = sub;  ws["A2"].font = Font(name=F, size=10, italic=True, color="666666")

def inp(cell):
    cell.fill = PatternFill("solid", fgColor=GELB); cell.font = Font(name=F, color="0000FF"); cell.border = BOX

wb = Workbook()

# ---------------- Anleitung ----------------
ws = wb.active; ws.title = "Start"
title(ws, f"Finanzplaner {JAHR}", "Dein Geld. Dein Plan. In 10 Minuten pro Monat.")
steps = [
    "SO FUNKTIONIERT'S",
    "1. Blatt 'Einstellungen': Startguthaben und deine Kategorien eintragen (gelbe Felder).",
    "2. Blatt 'Buchungen': Jede Einnahme/Ausgabe als eine Zeile eintragen. Kategorie per Dropdown.",
    "   Einnahmen positiv eintragen, Ausgaben ebenfalls positiv – der Typ kommt automatisch aus der Kategorie.",
    "3. Blatt 'Budget': Pro Kategorie dein Monatsbudget festlegen – Ampel zeigt, wo du drüber bist.",
    "4. Blatt 'Jahresübersicht': Alles rechnet sich automatisch – inkl. Diagramm.",
    "5. Blatt 'Sparziele': Ziele + bisher gespart eintragen – Fortschrittsbalken & Monatsrate.",
    "6. Blatt 'Schuldenfrei': Kredite eintragen – sieh, wann du schuldenfrei bist (Schneeball-Methode).",
    "",
    "LEGENDE",
    "Gelbe Felder mit blauer Schrift = hier trägst du etwas ein. Alles andere rechnet automatisch.",
    "Die Beispielzeilen kannst du einfach überschreiben oder löschen.",
    "",
    "Funktioniert in Excel, Google Sheets (Datei > Importieren) und LibreOffice.",
]
for i, s in enumerate(steps, start=4):
    c = ws.cell(row=i, column=1, value=s)
    c.font = Font(name=F, bold=s.isupper() and s != "", size=11, color=GRUEN if s.isupper() else "222222")
ws.column_dimensions["A"].width = 110
ws.sheet_view.showGridLines = False

# ---------------- Einstellungen ----------------
st = wb.create_sheet("Einstellungen")
title(st, "Einstellungen", "Gelbe Felder ausfüllen")
st["A4"] = "Jahr"; st["B4"] = JAHR; inp(st["B4"])
st["A5"] = "Startguthaben am 01.01."; st["B5"] = 1500; inp(st["B5"]); st["B5"].number_format = EUR
st["B5"].comment = Comment("Beispielwert – durch deinen Kontostand ersetzen.", "Finanzplaner")
for r in (4, 5): st.cell(row=r, column=1).font = Font(name=F, bold=True)
head(st, 7, [1, 2], ["Kategorie", "Typ"])
kategorien = [
    ("Gehalt", "Einnahme"), ("Nebenjob", "Einnahme"), ("Sonstige Einnahmen", "Einnahme"),
    ("Miete", "Ausgabe"), ("Strom & Nebenkosten", "Ausgabe"), ("Lebensmittel", "Ausgabe"),
    ("Mobilität", "Ausgabe"), ("Versicherungen", "Ausgabe"), ("Handy & Internet", "Ausgabe"),
    ("Abos & Streaming", "Ausgabe"), ("Freizeit & Ausgehen", "Ausgabe"), ("Kleidung", "Ausgabe"),
    ("Gesundheit", "Ausgabe"), ("Geschenke", "Ausgabe"), ("Kreditraten", "Ausgabe"),
    ("Sparen / Investieren", "Ausgabe"), ("Sonstiges", "Ausgabe"),
    ("", ""), ("", ""), ("", ""),  # Platz für eigene Kategorien
]
K0 = 8; K1 = K0 + len(kategorien) - 1
for i, (k, t) in enumerate(kategorien):
    r = K0 + i
    st.cell(row=r, column=1, value=k or None); st.cell(row=r, column=2, value=t or None)
    inp(st.cell(row=r, column=1)); inp(st.cell(row=r, column=2))
st.cell(row=K1 + 1, column=1, value="Leere gelbe Zeilen = Platz für eigene Kategorien.").font = Font(name=F, italic=True, size=9, color="666666")
dv_typ = DataValidation(type="list", formula1='"Einnahme,Ausgabe"', allow_blank=True)
st.add_data_validation(dv_typ); dv_typ.add(f"B{K0}:B{K1}")
st.column_dimensions["A"].width = 28; st.column_dimensions["B"].width = 14
KAT = f"Einstellungen!$A${K0}:$A${K1}"; TYP = f"Einstellungen!$B${K0}:$B${K1}"

# ---------------- Buchungen ----------------
bu = wb.create_sheet("Buchungen")
title(bu, "Buchungen", "Eine Zeile pro Einnahme/Ausgabe. Beträge immer positiv eintragen.")
head(bu, 4, range(1, 7), ["Datum", "Beschreibung", "Kategorie", "Betrag (€)", "Typ (auto)", "Monat (auto)"])
N = 1000; B0 = 5; B1 = B0 + N - 1
beispiele = [
    (dt.date(JAHR, 1, 1), "Gehalt Januar", "Gehalt", 2400),
    (dt.date(JAHR, 1, 2), "Miete Januar", "Miete", 750),
    (dt.date(JAHR, 1, 5), "Wocheneinkauf", "Lebensmittel", 68.4),
    (dt.date(JAHR, 1, 9), "Netflix + Spotify", "Abos & Streaming", 24.98),
    (dt.date(JAHR, 1, 15), "ETF-Sparplan", "Sparen / Investieren", 200),
]
for i in range(N):
    r = B0 + i
    for c in range(1, 5): inp(bu.cell(row=r, column=c))
    bu.cell(row=r, column=1).number_format = "DD.MM.YYYY"
    bu.cell(row=r, column=4).number_format = EUR
    bu.cell(row=r, column=5, value=f'=IF(C{r}="","",IFERROR(INDEX({TYP},MATCH(C{r},{KAT},0)),"?"))')
    bu.cell(row=r, column=6, value=f'=IF(A{r}="","",MONTH(A{r}))')
    for c in (5, 6):
        bu.cell(row=r, column=c).font = Font(name=F, color="555555"); bu.cell(row=r, column=c).border = BOX
for i, (d, b, k, v) in enumerate(beispiele):
    r = B0 + i
    bu.cell(row=r, column=1, value=d); bu.cell(row=r, column=2, value=b)
    bu.cell(row=r, column=3, value=k); bu.cell(row=r, column=4, value=v)
dv_kat = DataValidation(type="list", formula1=KAT, allow_blank=True)
bu.add_data_validation(dv_kat); dv_kat.add(f"C{B0}:C{B1}")
for col, w in zip("ABCDEF", (13, 34, 24, 14, 12, 12)): bu.column_dimensions[col].width = w
bu.freeze_panes = "A5"; bu.auto_filter.ref = f"A4:F{B1}"
BR = lambda col: f"Buchungen!${col}${B0}:${col}${B1}"

# ---------------- Budget ----------------
bg = wb.create_sheet("Budget")
title(bg, "Monatsbudget", "Plan vs. Ist für den gewählten Monat")
bg["A4"] = "Monat (1–12):"; bg["A4"].font = Font(name=F, bold=True)
bg["B4"] = 1; inp(bg["B4"])
dv_m = DataValidation(type="whole", operator="between", formula1="1", formula2="12"); bg.add_data_validation(dv_m); dv_m.add("B4")
head(bg, 6, range(1, 6), ["Kategorie", "Budget/Monat (€)", "Ist (€)", "Rest (€)", "Verbraucht"])
budgets = {"Miete": 750, "Strom & Nebenkosten": 120, "Lebensmittel": 350, "Mobilität": 120,
           "Versicherungen": 80, "Handy & Internet": 45, "Abos & Streaming": 30,
           "Freizeit & Ausgehen": 150, "Kleidung": 60, "Gesundheit": 30, "Geschenke": 40,
           "Kreditraten": 0, "Sparen / Investieren": 200, "Sonstiges": 50}
for i in range(len(kategorien)):
    r = 7 + i; src = K0 + i
    bg.cell(row=r, column=1, value=f'=IF(Einstellungen!B{src}="Ausgabe",Einstellungen!A{src},"")')
    name = kategorien[i][0]
    b = bg.cell(row=r, column=2, value=budgets.get(name, 0) if kategorien[i][1] == "Ausgabe" or name == "" else None)
    inp(b); b.number_format = EUR
    bg.cell(row=r, column=3, value=f'=IF(A{r}="","",SUMIFS({BR("D")},{BR("C")},A{r},{BR("F")},$B$4))').number_format = EUR
    bg.cell(row=r, column=4, value=f'=IF(A{r}="","",N(B{r})-C{r})').number_format = EUR
    bg.cell(row=r, column=5, value=f'=IF(OR(A{r}="",N(B{r})=0),"",C{r}/B{r})').number_format = "0%"
    for c in (1, 3, 4, 5): bg.cell(row=r, column=c).font = Font(name=F); bg.cell(row=r, column=c).border = BOX
G1 = 7 + len(kategorien) - 1
tr = G1 + 1
bg.cell(row=tr, column=1, value="Summe").font = Font(name=F, bold=True)
for c, col in ((2, "B"), (3, "C"), (4, "D")):
    x = bg.cell(row=tr, column=c, value=f"=SUM({col}7:{col}{G1})"); x.font = Font(name=F, bold=True); x.number_format = EUR
bg.conditional_formatting.add(f"E7:E{G1}", CellIsRule(operator="greaterThan", formula=["1"], fill=PatternFill("solid", fgColor="F8C9C4")))
bg.conditional_formatting.add(f"E7:E{G1}", CellIsRule(operator="between", formula=["0.85", "1"], fill=PatternFill("solid", fgColor="FFE7A8")))
bg.conditional_formatting.add(f"D7:D{G1}", CellIsRule(operator="lessThan", formula=["0"], font=Font(color="C0392B", bold=True)))
for col, w in zip("ABCDE", (26, 18, 14, 14, 12)): bg.column_dimensions[col].width = w

# ---------------- Jahresübersicht ----------------
jo = wb.create_sheet("Jahresübersicht")
title(jo, f"Jahresübersicht {JAHR}", "Rechnet automatisch aus deinen Buchungen")
monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
head(jo, 4, range(1, 7), ["Monat", "Einnahmen", "Ausgaben", "Saldo", "Sparquote", "Kontostand"])
for i, m in enumerate(monate):
    r = 5 + i
    jo.cell(row=r, column=1, value=m).font = Font(name=F, bold=True)
    jo.cell(row=r, column=2, value=f'=SUMIFS({BR("D")},{BR("E")},"Einnahme",{BR("F")},{i+1})')
    jo.cell(row=r, column=3, value=f'=SUMIFS({BR("D")},{BR("E")},"Ausgabe",{BR("F")},{i+1})')
    jo.cell(row=r, column=4, value=f"=B{r}-C{r}")
    jo.cell(row=r, column=5, value=f'=IF(B{r}=0,"",D{r}/B{r})').number_format = "0%"
    prev = "Einstellungen!$B$5" if i == 0 else f"F{r-1}"
    jo.cell(row=r, column=6, value=f"={prev}+D{r}")
    for c in (2, 3, 4, 6): jo.cell(row=r, column=c).number_format = EUR
    for c in range(1, 7): jo.cell(row=r, column=c).border = BOX
jo["A17"] = "Gesamt"; jo["A17"].font = Font(name=F, bold=True)
for col in "BCD":
    jo[f"{col}17"] = f"=SUM({col}5:{col}16)"; jo[f"{col}17"].number_format = EUR; jo[f"{col}17"].font = Font(name=F, bold=True)
jo["E17"] = '=IF(B17=0,"",D17/B17)'; jo["E17"].number_format = "0%"
jo.conditional_formatting.add("D5:D16", CellIsRule(operator="lessThan", formula=["0"], font=Font(color="C0392B", bold=True)))
for col, w in zip("ABCDEF", (10, 15, 15, 15, 12, 15)): jo.column_dimensions[col].width = w
# Ausgaben nach Kategorie (Jahr)
head(jo, 20, [1, 2], ["Kategorie", "Ausgaben Jahr"])
for i in range(len(kategorien)):
    r = 21 + i; src = K0 + i
    jo.cell(row=r, column=1, value=f'=IF(Einstellungen!B{src}="Ausgabe",Einstellungen!A{src},"")')
    jo.cell(row=r, column=2, value=f'=IF(A{r}="",0,SUMIFS({BR("D")},{BR("C")},A{r}))').number_format = EUR
ch = BarChart(); ch.title = "Einnahmen vs. Ausgaben"; ch.y_axis.title = "€"; ch.height = 8; ch.width = 18
ch.add_data(Reference(jo, min_col=2, max_col=3, min_row=4, max_row=16), titles_from_data=True)
ch.set_categories(Reference(jo, min_col=1, min_row=5, max_row=16))
jo.add_chart(ch, "H4")
pie = PieChart(); pie.title = "Wohin geht mein Geld?"; pie.height = 9; pie.width = 12
pie.add_data(Reference(jo, min_col=2, min_row=20, max_row=20 + len(kategorien)), titles_from_data=True)
pie.set_categories(Reference(jo, min_col=1, min_row=21, max_row=20 + len(kategorien)))
jo.add_chart(pie, "H21")

# ---------------- Sparziele ----------------
sz = wb.create_sheet("Sparziele")
title(sz, "Sparziele", "Wie viel muss ich pro Monat zurücklegen?")
sz["A4"] = "Stichtag heute:"; sz["B4"] = "=TODAY()"; sz["B4"].number_format = "DD.MM.YYYY"
head(sz, 6, range(1, 8), ["Ziel", "Zielbetrag (€)", "Schon gespart (€)", "Zieldatum", "Fehlt noch (€)", "Fortschritt", "Nötig pro Monat (€)"])
ziele = [("Notgroschen (3 Netto-Gehälter)", 6000, 1500, dt.date(JAHR, 12, 31)),
         ("Urlaub", 1500, 300, dt.date(JAHR, 7, 1)),
         ("Neuer Laptop", 1200, 0, dt.date(JAHR, 10, 1))]
for i in range(10):
    r = 7 + i
    for c in range(1, 5): inp(sz.cell(row=r, column=c))
    if i < len(ziele):
        for c, v in enumerate(ziele[i], start=1): sz.cell(row=r, column=c, value=v)
    sz.cell(row=r, column=2).number_format = EUR; sz.cell(row=r, column=3).number_format = EUR
    sz.cell(row=r, column=4).number_format = "DD.MM.YYYY"
    sz.cell(row=r, column=5, value=f'=IF(A{r}="","",MAX(0,B{r}-C{r}))').number_format = EUR
    sz.cell(row=r, column=6, value=f'=IF(OR(A{r}="",N(B{r})=0),"",MIN(1,C{r}/B{r}))').number_format = "0%"
    sz.cell(row=r, column=7, value=f'=IF(OR(A{r}="",D{r}=""),"",IF(D{r}<=$B$4,E{r},E{r}/MAX(1,(YEAR(D{r})-YEAR($B$4))*12+MONTH(D{r})-MONTH($B$4))))').number_format = EUR
    for c in (5, 6, 7): sz.cell(row=r, column=c).border = BOX; sz.cell(row=r, column=c).font = Font(name=F)
sz.conditional_formatting.add("F7:F16", DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="2E7D5B"))
for col, w in zip("ABCDEFG", (32, 15, 17, 13, 15, 13, 19)): sz.column_dimensions[col].width = w

# ---------------- Schuldenfrei ----------------
sf = wb.create_sheet("Schuldenfrei")
title(sf, "Schuldenfrei-Rechner", "Wann bin ich schuldenfrei? (Schneeball: kleinste Schuld zuerst tilgen)")
head(sf, 4, range(1, 8), ["Kredit / Schuld", "Restschuld (€)", "Zins p.a.", "Monatsrate (€)", "Monate bis 0", "Schuldenfrei am", "Zinskosten gesamt (€)"])
schulden = [("Dispo", 800, 0.12, 100), ("Ratenkredit Auto", 6500, 0.059, 220), ("Handy-Ratenkauf", 360, 0, 30)]
for i in range(8):
    r = 5 + i
    for c in range(1, 5): inp(sf.cell(row=r, column=c))
    if i < len(schulden):
        for c, v in enumerate(schulden[i], start=1): sf.cell(row=r, column=c, value=v)
    sf.cell(row=r, column=2).number_format = EUR; sf.cell(row=r, column=3).number_format = "0.0%"; sf.cell(row=r, column=4).number_format = EUR
    sf.cell(row=r, column=5, value=f'=IF(OR(A{r}="",N(D{r})=0),"",IF(N(C{r})=0,ROUNDUP(B{r}/D{r},0),IFERROR(ROUNDUP(NPER(C{r}/12,-D{r},B{r}),0),"Rate zu niedrig!")))')
    sf.cell(row=r, column=6, value=f'=IF(ISNUMBER(E{r}),EDATE(TODAY(),E{r}),"")').number_format = "MM/YYYY"
    sf.cell(row=r, column=7, value=f'=IF(ISNUMBER(E{r}),MAX(0,E{r}*D{r}-B{r}),"")').number_format = EUR
    for c in (5, 6, 7): sf.cell(row=r, column=c).border = BOX; sf.cell(row=r, column=c).font = Font(name=F)
sf["A14"] = "Summe"; sf["A14"].font = Font(name=F, bold=True)
sf["B14"] = "=SUM(B5:B12)"; sf["D14"] = "=SUM(D5:D12)"; sf["G14"] = "=SUM(G5:G12)"
for c in ("B14", "D14", "G14"): sf[c].number_format = EUR; sf[c].font = Font(name=F, bold=True)
sf["A15"] = "Komplett schuldenfrei am:"; sf["A15"].font = Font(name=F, bold=True)
sf["B15"] = '=IF(COUNT(E5:E12)=0,"",EDATE(TODAY(),MAX(E5:E12)))'; sf["B15"].number_format = "MM/YYYY"; sf["B15"].font = Font(name=F, bold=True, color=GRUEN, size=12)
sf["A17"] = "Hinweis: Vereinfachte Berechnung mit gleichbleibender Rate und Zins. Keine Finanzberatung."
sf["A17"].font = Font(name=F, italic=True, size=9, color="666666")
for col, w in zip("ABCDEFG", (26, 15, 10, 15, 13, 15, 20)): sf.column_dimensions[col].width = w

for s in wb.worksheets:
    s.sheet_properties.tabColor = GRUEN
    for row in s.iter_rows():
        for c in row:
            if c.font and c.font.name != F:
                c.font = Font(name=F, bold=c.font.bold, italic=c.font.italic, size=c.font.size, color=c.font.color)

import sys
out = sys.argv[1] if len(sys.argv) > 1 else "produkt/Finanzplaner_2027.xlsx"
wb.save(out); print("gespeichert:", out)
