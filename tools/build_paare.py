"""Erzeugt produkt/Paar-Haushaltsbuch_2027.xlsx – Produkt Nr. 2."""
import datetime as dt, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.chart import PieChart, BarChart, Reference

JAHR = 2027; F = "Arial"; ROSE = "B5546B"; GELB = "FFF4CC"
EUR = '#,##0.00 €;-#,##0.00 €;"-"'
thin = Side(style="thin", color="D0D0D0"); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def head(ws, row, values):
    for c, v in enumerate(values, start=1):
        x = ws.cell(row=row, column=c, value=v)
        x.font = Font(name=F, bold=True, color="FFFFFF"); x.fill = PatternFill("solid", fgColor=ROSE)
        x.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); x.border = BOX
def title(ws, t, s):
    ws["A1"] = t; ws["A1"].font = Font(name=F, size=18, bold=True, color=ROSE)
    ws["A2"] = s; ws["A2"].font = Font(name=F, size=10, italic=True, color="666666")
def inp(c):
    c.fill = PatternFill("solid", fgColor=GELB); c.font = Font(name=F, color="0000FF"); c.border = BOX
def calc(c, fmt=None):
    c.font = Font(name=F); c.border = BOX
    if fmt: c.number_format = fmt

wb = Workbook()
ws = wb.active; ws.title = "Start"
title(ws, f"Haushaltsbuch für Paare {JAHR}", "Gemeinsame Kosten fair teilen – ohne Streit ums Geld 💕")
for i, t in enumerate([
    "SO FUNKTIONIERT'S",
    "1. 'Einstellungen': Eure Namen eintragen und wählen: 50/50 teilen oder nach Einkommen.",
    "2. 'Ausgaben': Jede Ausgabe eintragen – wer hat bezahlt, und für wen war's (gemeinsam oder nur für eine Person)?",
    "3. 'Ausgleich': Zeigt pro Monat, wer wem wie viel überweisen muss. Einmal überweisen – quitt!",
    "4. 'Kategorien': Wofür gebt ihr als Paar euer Geld aus? Mit Diagramm.",
    "",
    "LEGENDE",
    "Gelbe Felder mit blauer Schrift = hier etwas eintragen. Alles andere rechnet automatisch.",
    "Die Beispielzeilen einfach überschreiben oder löschen.",
    "",
    "Funktioniert in Excel, Google Sheets (Datei > Importieren) und LibreOffice.",
], start=4):
    c = ws.cell(row=i, column=1, value=t)
    c.font = Font(name=F, bold=t.isupper() and t != "", size=11, color=ROSE if t.isupper() else "222222")
ws.column_dimensions["A"].width = 115; ws.sheet_view.showGridLines = False

st = wb.create_sheet("Einstellungen")
title(st, "Einstellungen", "Gelbe Felder ausfüllen")
rows = [("Name Person 1", "Lena"), ("Name Person 2", "Tom"), ("Aufteilung", "Nach Einkommen"),
        ("Netto-Einkommen Person 1 (€)", 2600), ("Netto-Einkommen Person 2 (€)", 1900)]
for i, (k, v) in enumerate(rows, start=4):
    st.cell(row=i, column=1, value=k).font = Font(name=F, bold=True)
    c = st.cell(row=i, column=2, value=v); inp(c)
    if isinstance(v, int): c.number_format = EUR
dv = DataValidation(type="list", formula1='"50/50,Nach Einkommen"'); st.add_data_validation(dv); dv.add("B6")
st["A10"] = "Anteil Person 1 an gemeinsamen Kosten"; st["A10"].font = Font(name=F, bold=True)
st["B10"] = '=IF(B6="50/50",0.5,IF(N(B7)+N(B8)=0,0.5,B7/(B7+B8)))'; calc(st["B10"], "0.0%")
st["A11"] = "Anteil Person 2 an gemeinsamen Kosten"; st["A11"].font = Font(name=F, bold=True)
st["B11"] = "=1-B10"; calc(st["B11"], "0.0%")
# Hilfsliste "Für wen"
st["D3"] = "Für wen (Liste)"; st["D3"].font = Font(name=F, bold=True, size=9, color="888888")
st["D4"] = "Gemeinsam"; st["D5"] = "=B4"; st["D6"] = "=B5"
for r in (4, 5, 6): st.cell(row=r, column=4).font = Font(name=F, size=9, color="888888")
head_row = 13
st.cell(row=head_row, column=1, value="Kategorien").font = Font(name=F, bold=True, color=ROSE, size=12)
kats = ["Miete", "Nebenkosten & Strom", "Lebensmittel", "Drogerie & Haushalt", "Restaurant & Lieferdienst",
        "Ausflüge & Urlaub", "Auto & Mobilität", "Abos & Streaming", "Haustier", "Möbel & Wohnen",
        "Geschenke", "Sonstiges", None, None, None]
K0 = head_row + 1; K1 = K0 + len(kats) - 1
for i, k in enumerate(kats):
    inp(st.cell(row=K0 + i, column=1, value=k))
st.column_dimensions["A"].width = 38; st.column_dimensions["B"].width = 18; st.column_dimensions["D"].width = 16
P1 = "Einstellungen!$B$4"; P2 = "Einstellungen!$B$5"; A1 = "Einstellungen!$B$10"; A2 = "Einstellungen!$B$11"
KAT = f"Einstellungen!$A${K0}:$A${K1}"

au = wb.create_sheet("Ausgaben")
title(au, "Ausgaben", "Wer hat bezahlt – und für wen war's?")
head(au, 4, ["Datum", "Beschreibung", "Kategorie", "Betrag (€)", "Bezahlt von", "Für wen",
             "Monat (auto)", "Anteil P1 (auto)", "Anteil P2 (auto)"])
N = 1000; R0 = 5; R1 = R0 + N - 1
bsp = [(dt.date(JAHR,1,1), "Miete Januar", "Miete", 1100, "Lena", "Gemeinsam"),
       (dt.date(JAHR,1,3), "Großeinkauf", "Lebensmittel", 94.30, "Tom", "Gemeinsam"),
       (dt.date(JAHR,1,8), "Pizza-Abend", "Restaurant & Lieferdienst", 38.50, "Tom", "Gemeinsam"),
       (dt.date(JAHR,1,12), "Toms Fitnessstudio (von Lena ausgelegt)", "Sonstiges", 29.90, "Lena", "Tom"),
       (dt.date(JAHR,1,20), "Strom-Abschlag", "Nebenkosten & Strom", 85, "Tom", "Gemeinsam")]
for i in range(N):
    r = R0 + i
    for c in range(1, 7): inp(au.cell(row=r, column=c))
    au.cell(row=r, column=1).number_format = "DD.MM.YYYY"; au.cell(row=r, column=4).number_format = EUR
    au.cell(row=r, column=7, value=f'=IF(A{r}="","",MONTH(A{r}))')
    au.cell(row=r, column=8, value=f'=IF(D{r}="",0,IF(F{r}="Gemeinsam",D{r}*{A1},IF(F{r}={P1},D{r},0)))')
    au.cell(row=r, column=9, value=f'=IF(D{r}="",0,IF(F{r}="Gemeinsam",D{r}*{A2},IF(F{r}={P2},D{r},0)))')
    for c in (7, 8, 9): calc(au.cell(row=r, column=c), EUR if c > 7 else None); au.cell(row=r, column=c).font = Font(name=F, color="555555")
for i, row in enumerate(bsp):
    for c, v in enumerate(row, start=1): au.cell(row=R0 + i, column=c, value=v)
for rng, f1 in ((f"C{R0}:C{R1}", KAT), (f"E{R0}:E{R1}", "Einstellungen!$B$4:$B$5"), (f"F{R0}:F{R1}", "Einstellungen!$D$4:$D$6")):
    d = DataValidation(type="list", formula1=f1, allow_blank=True); au.add_data_validation(d); d.add(rng)
for col, w in zip("ABCDEFGHI", (12, 36, 24, 13, 13, 13, 9, 13, 13)): au.column_dimensions[col].width = w
au.freeze_panes = "A5"; au.auto_filter.ref = f"A4:I{R1}"
C = lambda col: f"Ausgaben!${col}${R0}:${col}${R1}"

ag = wb.create_sheet("Ausgleich")
title(ag, "Monatlicher Ausgleich", "Einmal im Monat überweisen – und ihr seid quitt")
head(ag, 4, ["Monat", "P1 hat bezahlt", "P2 hat bezahlt", "Anteil P1", "Anteil P2", "Saldo P1", "Wer zahlt an wen?", "Betrag (€)"])
ag["B3"] = f'="P1 = "&{P1}&"   ·   P2 = "&{P2}'; ag["B3"].font = Font(name=F, italic=True, color="666666")
mon = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
for i, m in enumerate(mon):
    r = 5 + i
    ag.cell(row=r, column=1, value=m).font = Font(name=F, bold=True)
    ag.cell(row=r, column=2, value=f'=SUMIFS({C("D")},{C("E")},{P1},{C("G")},{i+1})')
    ag.cell(row=r, column=3, value=f'=SUMIFS({C("D")},{C("E")},{P2},{C("G")},{i+1})')
    ag.cell(row=r, column=4, value=f'=SUMIFS({C("H")},{C("G")},{i+1})')
    ag.cell(row=r, column=5, value=f'=SUMIFS({C("I")},{C("G")},{i+1})')
    ag.cell(row=r, column=6, value=f"=ROUND(B{r}-D{r},2)")
    ag.cell(row=r, column=7, value=f'=IF(B{r}+C{r}=0,"",IF(F{r}=0,"Quitt ✓",IF(F{r}>0,{P2}&" → "&{P1},{P1}&" → "&{P2})))')
    ag.cell(row=r, column=8, value=f'=IF(B{r}+C{r}=0,"",ABS(F{r}))')
    for c in range(2, 9): calc(ag.cell(row=r, column=c), EUR if c != 7 else None)
    ag.cell(row=r, column=7).font = Font(name=F, bold=True, color=ROSE)
ag["A17"] = "Jahr"; ag["A17"].font = Font(name=F, bold=True)
for col in "BCDEF":
    ag[f"{col}17"] = f"=SUM({col}5:{col}16)"; calc(ag[f"{col}17"], EUR); ag[f"{col}17"].font = Font(name=F, bold=True)
ag["A19"] = "Saldo > 0: Person 1 hat mehr gezahlt als ihr Anteil → Person 2 überweist. Saldo < 0: umgekehrt."
ag["A19"].font = Font(name=F, italic=True, size=9, color="666666")
for col, w in zip("ABCDEFGH", (9, 15, 15, 13, 13, 13, 22, 13)): ag.column_dimensions[col].width = w
ch = BarChart(); ch.title = "Wer hat wie viel bezahlt?"; ch.height = 8; ch.width = 17
ch.add_data(Reference(ag, min_col=2, max_col=3, min_row=4, max_row=16), titles_from_data=True)
ch.set_categories(Reference(ag, min_col=1, min_row=5, max_row=16)); ag.add_chart(ch, "J4")

kt = wb.create_sheet("Kategorien")
title(kt, f"Wofür wir {JAHR} Geld ausgeben", "Automatisch aus den Ausgaben")
head(kt, 4, ["Kategorie", "Gesamt (€)", "Ø pro Monat (€)", "Anteil"])
for i in range(len(kats)):
    r = 5 + i
    kt.cell(row=r, column=1, value=f'=IF(Einstellungen!A{K0+i}="","",Einstellungen!A{K0+i})')
    kt.cell(row=r, column=2, value=f'=IF(A{r}="",0,SUMIFS({C("D")},{C("C")},A{r}))')
    kt.cell(row=r, column=3, value=f"=B{r}/12")
    kt.cell(row=r, column=4, value=f'=IF(SUM($B$5:$B${4+len(kats)})=0,"",B{r}/SUM($B$5:$B${4+len(kats)}))')
    for c, fmt in ((1, None), (2, EUR), (3, EUR), (4, "0.0%")): calc(kt.cell(row=r, column=c), fmt)
for col, w in zip("ABCD", (28, 14, 16, 10)): kt.column_dimensions[col].width = w
pie = PieChart(); pie.title = "Unsere Ausgaben"; pie.height = 9; pie.width = 12
pie.add_data(Reference(kt, min_col=2, min_row=4, max_row=4 + len(kats)), titles_from_data=True)
pie.set_categories(Reference(kt, min_col=1, min_row=5, max_row=4 + len(kats))); kt.add_chart(pie, "F4")

for s in wb.worksheets: s.sheet_properties.tabColor = ROSE
out = sys.argv[1] if len(sys.argv) > 1 else "produkt/Paar-Haushaltsbuch_2027.xlsx"
wb.save(out); print("gespeichert:", out)
