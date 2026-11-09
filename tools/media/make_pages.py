"""Erzeugt HTML-Seiten für Etsy-Bilder (2000x2000) und TikTok-Frames (1080x1920)."""
import os, json
OUT = os.path.join(os.path.dirname(__file__), "html"); os.makedirs(OUT, exist_ok=True)
G, GL, R, RL, INK = "#2E7D5B", "#E8F3EE", "#B5546B", "#F8E8EC", "#1d2a24"

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;color:%(ink)s;width:%(w)dpx;height:%(h)dpx;overflow:hidden;
 background:%(bg)s;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:%(pad)dpx;gap:%(gap)dpx}
h1{font-size:%(h1)dpx;font-weight:800;letter-spacing:-.03em;line-height:1.02;text-align:center}
h2{font-size:%(h2)dpx;font-weight:600;text-align:center;opacity:.8;line-height:1.25}
.pill{display:inline-block;background:%(acc)s;color:#fff;border-radius:999px;padding:.35em 1em;font-weight:700;font-size:%(pill)dpx}
.win{background:#fff;border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.18);overflow:hidden;width:100%%}
.bar{height:56px;background:#f1f1f1;display:flex;align-items:center;gap:12px;padding:0 24px}
.bar i{width:16px;height:16px;border-radius:50%%;background:#ddd;display:block}
.tabs{display:flex;gap:4px;padding:0 20px;background:#f7f7f7;border-top:1px solid #e5e5e5}
.tabs span{font-size:22px;padding:12px 20px;color:#777}.tabs span.on{background:#fff;color:%(acc)s;font-weight:700;border-bottom:4px solid %(acc)s}
table{border-collapse:collapse;width:100%%;font-size:%(td)dpx}
th{background:%(acc)s;color:#fff;font-weight:700;padding:.55em .7em;text-align:left}
td,th{white-space:nowrap}
td{padding:.5em .7em;border-bottom:1px solid #eee;font-variant-numeric:tabular-nums}
td.n,th.n{text-align:right}
.red{background:#F8C9C4}.yel{background:#FFE7A8}.neg{color:#C0392B;font-weight:700}
.prog{height:.8em;background:#eee;border-radius:99px;overflow:hidden;min-width:5em}.prog b{display:block;height:100%%;background:%(acc)s}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:36px;width:100%%}
.tile{background:#fff;border-radius:28px;padding:44px;box-shadow:0 12px 40px rgba(0,0,0,.08)}
.tile .ic{font-size:72px}.tile h3{font-size:46px;margin:14px 0 8px}.tile p{font-size:30px;opacity:.75;line-height:1.3}
.chart{display:flex;align-items:flex-end;gap:14px;height:340px;padding:30px 30px 10px}
.chart div{flex:1;display:flex;gap:4px;align-items:flex-end;height:100%%}.chart u{flex:1;display:block;border-radius:6px 6px 0 0;text-decoration:none}
.lbl{display:flex;gap:14px;padding:0 30px 24px}.lbl span{flex:1;text-align:center;font-size:20px;color:#888}
.big{font-size:%(big)dpx;font-weight:800;color:%(acc)s;text-align:center;line-height:1.1}
.foot{font-size:%(foot)dpx;font-weight:600;opacity:.7;text-align:center}
.hl{background:linear-gradient(transparent 55%%,%(hl)s 55%%)}
"""

def page(name, body, w, h, bg, acc, square=True):
    s = dict(ink=INK, w=w, h=h, bg=bg, acc=acc, pad=110 if square else 48, gap=56 if square else 60,
             h1=128 if square else 104, h2=50 if square else 54, pill=36, td=30 if square else 23,
             big=150 if square else 120, foot=34, hl=("#bfe3cf" if acc == G else "#f2c4cf"))
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS % s}</style></head><body>{body}</body></html>"
    open(os.path.join(OUT, name + ".html"), "w").write(html)
    return name, w, h

def win(tabs, on, inner):
    t = "".join(f"<span class='{'on' if x == on else ''}'>{x}</span>" for x in tabs)
    return f"<div class='win'><div class='bar'><i></i><i></i><i></i></div>{inner}<div class='tabs'>{t}</div></div>"

TABS = ["Start", "Buchungen", "Budget", "Jahresübersicht", "Sparziele", "Schuldenfrei"]
eur = lambda v: f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

# Beispieldaten für die Mockups (illustrativ, wie die Beispielzeilen im Planer)
ein = [2400, 2400, 2550, 2400, 2400, 2650, 2400, 2400, 2400, 2400, 2400, 4600]
aus = [1980, 1850, 2210, 1790, 1920, 2400, 2150, 1880, 1760, 1940, 2050, 2900]
mon = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
mx = max(ein)
bars = "".join(f"<div><u style='height:{e/mx*100:.0f}%;background:{G}'></u><u style='height:{a/mx*100:.0f}%;background:#E7A15A'></u></div>" for e, a in zip(ein, aus))
lbl = "".join(f"<span>{m}</span>" for m in mon)
CHART = f"<div class='chart'>{bars}</div><div class='lbl'>{lbl}</div>"
k = 1500; rows = ""
for m, e, a in list(zip(mon, ein, aus))[:6]:
    k += e - a
    rows += f"<tr><td><b>{m}</b></td><td class=n>{eur(e)}</td><td class=n>{eur(a)}</td><td class=n>{eur(e-a)}</td><td class=n>{(e-a)/e:.0%}</td><td class=n>{eur(k)}</td></tr>"
JO = f"<table><tr><th>Monat</th><th class=n>Einnahmen</th><th class=n>Ausgaben</th><th class=n>Saldo</th><th class=n>Sparquote</th><th class=n>Kontostand</th></tr>{rows}</table>"

budget = [("Miete", 750, 750), ("Lebensmittel", 350, 412.80), ("Freizeit & Ausgehen", 150, 138.50),
          ("Mobilität", 120, 64.20), ("Abos & Streaming", 30, 42.97), ("Kleidung", 60, 0), ("Sparen / Investieren", 200, 200)]
brow = ""
for n, b, i in budget:
    p = i / b if b else 0; cls = "red" if p > 1 else ("yel" if p >= .85 else "")
    brow += f"<tr><td>{n}</td><td class=n>{eur(b)}</td><td class=n>{eur(i)}</td><td class='n {'neg' if b-i<0 else ''}'>{eur(b-i)}</td><td class='n {cls}'>{p:.0%}</td></tr>"
BUD = f"<table><tr><th>Kategorie</th><th class=n>Budget</th><th class=n>Ist</th><th class=n>Rest</th><th class=n>Verbraucht</th></tr>{brow}</table>"

ziele = [("Notgroschen", 6000, 1500, 346.15), ("Urlaub 🌴", 1500, 300, 150), ("Neuer Laptop", 1200, 0, 109.09), ("Führerschein", 3000, 2100, 75)]
zrow = "".join(f"<tr><td>{n}</td><td class=n>{eur(z)}</td><td class=n>{eur(g)}</td><td><div class=prog><b style='width:{g/z*100:.0f}%'></b></div></td><td class=n><b>{eur(m)}</b></td></tr>" for n, z, g, m in ziele)
SPZ = f"<table><tr><th>Ziel</th><th class=n>Ziel</th><th class=n>Gespart</th><th>Fortschritt</th><th class=n>Pro Monat</th></tr>{zrow}</table>"

srow = "".join(f"<tr><td>{n}</td><td class=n>{eur(b)}</td><td class=n>{z}</td><td class=n>{eur(r)}</td><td class=n>{m}</td><td class=n>{d}</td></tr>" for n, b, z, r, m, d in
               [("Dispo", 800, "12,0 %", 100, 9, "08/2027"), ("Ratenkredit Auto", 6500, "5,9 %", 220, 33, "08/2029"), ("Handy-Ratenkauf", 360, "0,0 %", 30, 12, "11/2027")])
SCH = f"<table><tr><th>Schuld</th><th class=n>Rest</th><th class=n>Zins</th><th class=n>Rate</th><th class=n>Monate</th><th class=n>Frei am</th></tr>{srow}</table>"

AUSG = ("<table><tr><th>Monat</th><th class=n>Lena zahlte</th><th class=n>Tom zahlte</th><th>Wer zahlt an wen?</th><th class=n>Betrag</th></tr>"
        f"<tr><td><b>Jan</b></td><td class=n>{eur(1129.9)}</td><td class=n>{eur(217.8)}</td><td style='color:{R};font-weight:700'>Tom → Lena</td><td class=n><b>{eur(368.5)}</b></td></tr>"
        f"<tr><td><b>Feb</b></td><td class=n>{eur(1185.2)}</td><td class=n>{eur(402.6)}</td><td style='color:{R};font-weight:700'>Tom → Lena</td><td class=n><b>{eur(196.73)}</b></td></tr>"
        f"<tr><td><b>Mär</b></td><td class=n>{eur(1150)}</td><td class=n>{eur(890.4)}</td><td style='color:{R};font-weight:700'>Lena → Tom</td><td class=n><b>{eur(29.4)}</b></td></tr>"
        f"<tr><td><b>Apr</b></td><td class=n>{eur(1210.3)}</td><td class=n>{eur(611.5)}</td><td style='color:{G};font-weight:700'>Quitt ✓</td><td class=n>{eur(0)}</td></tr></table>")

jobs = []
SQ = 2000
# ---------- Etsy: Finanzplaner ----------
jobs.append(page("etsy_fp_1", f"<span class=pill>🇩🇪 DEUTSCH · EXCEL & GOOGLE SHEETS</span><h1>Finanzplaner <span class=hl>2027</span></h1>"
    f"<h2>Haushaltsbuch · Budget · Sparziele · Schuldenfrei-Rechner</h2>{win(TABS,'Jahresübersicht',CHART + JO)}", SQ, SQ, GL, G))
tiles = [("📒", "Buchungen", "Einnahmen & Ausgaben mit Dropdown"), ("🚦", "Budget-Ampel", "Sofort sehen, wo du drüber bist"),
         ("📊", "Jahresübersicht", "Sparquote, Kontostand & Diagramme"), ("🎯", "Sparziele", "Fortschritt + nötige Monatsrate"),
         ("⛓️‍💥", "Schuldenfrei", "Auf den Monat genau berechnet"), ("✍️", "Anleitung", "In 10 Minuten startklar")]
jobs.append(page("etsy_fp_2", "<h1 style='font-size:110px'>Was ist drin?</h1><div class=grid>" +
    "".join(f"<div class=tile><div class=ic>{i}</div><h3>{t}</h3><p>{d}</p></div>" for i, t, d in tiles) + "</div>", SQ, SQ, GL, G))
jobs.append(page("etsy_fp_3", f"<h1 style='font-size:112px'>Die Budget-<span class=hl>Ampel</span></h1><h2>Rot = drüber. Gelb = fast. Kein böses Erwachen mehr am Monatsende.</h2>{win(TABS,'Budget',BUD)}", SQ, SQ, GL, G))
jobs.append(page("etsy_fp_4", f"<h1 style='font-size:112px'>Sparziele, die du <span class=hl>erreichst</span></h1><h2>Ziel + Datum eintragen – der Planer sagt dir, wie viel du pro Monat zurücklegen musst.</h2>{win(TABS,'Sparziele',SPZ)}", SQ, SQ, GL, G))
jobs.append(page("etsy_fp_5", f"<h1 style='font-size:112px'>Wann bist <span class=hl>du</span> schuldenfrei?</h1><h2>Restschuld, Zins & Rate eintragen – Datum und Zinskosten erscheinen automatisch.</h2>{win(TABS,'Schuldenfrei',SCH)}<div class=big style='font-size:96px'>Schuldenfrei: 08/2029 🎉</div>", SQ, SQ, GL, G))
steps = [("1", "Kaufen & sofort herunterladen"), ("2", "In Excel öffnen – oder in Google Sheets importieren"), ("3", "Ausgaben eintragen. Fertig – der Rest rechnet sich selbst.")]
jobs.append(page("etsy_fp_6", "<h1 style='font-size:120px'>So einfach geht's</h1>" + "".join(
    f"<div class=tile style='width:100%;display:flex;gap:44px;align-items:center'><div class=big style='font-size:140px'>{n}</div><h3 style='font-size:58px'>{t}</h3></div>" for n, t in steps)
    + "<div class=foot>✔ Excel ✔ Google Sheets ✔ LibreOffice ✔ Mac & Windows ✔ Tablet</div>", SQ, SQ, GL, G))
# ---------- Etsy: Paare ----------
PT = ["Start", "Einstellungen", "Ausgaben", "Ausgleich", "Kategorien"]
jobs.append(page("etsy_pa_1", f"<span class=pill>🇩🇪 DEUTSCH · EXCEL & GOOGLE SHEETS</span><h1>Haushaltsbuch<br>für <span class=hl>Paare</span> 💕</h1>"
    f"<h2>Wer schuldet wem wie viel? Fair teilen – 50/50 oder nach Einkommen.</h2>{win(PT,'Ausgleich',AUSG)}", SQ, SQ, RL, R))
ptiles = [("⚖️", "Fair teilen", "50/50 oder nach Einkommen"), ("💸", "Monatsausgleich", "Einmal überweisen – quitt"),
          ("🛒", "Wer hat bezahlt?", "Gemeinsam oder nur für eine Person"), ("📊", "Kategorien", "Wofür ihr als Paar Geld ausgebt")]
jobs.append(page("etsy_pa_2", "<h1 style='font-size:110px'>Nie wieder Streit<br>ums Geld</h1><div class=grid>" +
    "".join(f"<div class=tile><div class=ic>{i}</div><h3>{t}</h3><p>{d}</p></div>" for i, t, d in ptiles) + "</div>", SQ, SQ, RL, R))
# ---------- Pinterest / Lead-Magnet ----------
jobs.append(page("pin_lite", f"<span class=pill>GRATIS DOWNLOAD</span><h1 style='font-size:120px'>Kostenloses Haushaltsbuch 2027</h1><h2>Excel & Google Sheets · auf Deutsch · rechnet automatisch</h2>{win(['Start','Einstellungen','Buchungen','Jahresübersicht'],'Jahresübersicht',CHART)}<div class=foot>Link in Bio 💚</div>", 1000, 1500, GL, G, square=False))

# ---------- TikTok-Frames (1080x1920) ----------
V = (1080, 1920)
def vt(name, body, bg=GL, acc=G): jobs.append(page(name, body, *V, bg, acc, square=False))
videos = {
 "v1": [("<h1>Ich hatte 2026 <span class=hl>keine Ahnung</span>, wo mein Geld hingeht.</h1><h2>Nie wieder. 👇</h2>", None),
        (f"<h2>Jede Ausgabe 1× eintragen…</h2>{win(TABS,'Jahresübersicht',CHART)}", None),
        (f"<h2>…und alles rechnet sich selbst.</h2>{win(TABS,'Jahresübersicht',JO)}", None),
        ("<h1 style='font-size:96px'>Finanzplaner 2027</h1><h2>auf Deutsch · Excel & Google Sheets</h2><div class=big>Link in Bio 💚</div>", None)],
 "v2": [("<h1>Die <span class=hl>Ampel</span>, die mir jeden Monat Geld spart 🚦</h1>", None),
        (f"<h2>Budget pro Kategorie festlegen</h2>{win(TABS,'Budget',BUD)}", None),
        ("<h1 style='font-size:92px'>Rot = drüber.<br>Gelb = fast.</h1><h2>Lebensmittel +62,80 € 😬<br>Abos +12,97 € 👀</h2>", None),
        ("<h1 style='font-size:96px'>Finanzplaner 2027</h1><h2>auf Deutsch · Excel & Google Sheets</h2><div class=big>Link in Bio 💚</div>", None)],
 "v3": [("<h1>Wann bin ich <span class=hl>schuldenfrei</span>? Excel sagt's mir auf den Monat genau.</h1>", None),
        (f"<h2>Restschuld, Zins, Rate eintragen</h2>{win(TABS,'Schuldenfrei',SCH)}", None),
        ("<div class=big>08/2029 🎉</div><h2>…und so viel Zinsen zahle ich bis dahin.<br>Dispo zuerst weg! 🔥</h2>", None),
        ("<h1 style='font-size:96px'>Finanzplaner 2027</h1><h2>auf Deutsch · Excel & Google Sheets</h2><div class=big>Link in Bio 💚</div>", None)],
 "v4": [("<h1>Wie viel muss ich <span class=hl>pro Monat</span> sparen für meinen Urlaub? 🌴</h1>", None),
        (f"<h2>Ziel + Datum eintragen…</h2>{win(TABS,'Sparziele',SPZ)}", None),
        ("<div class=big>150 € / Monat</div><h2>…und der Balken zeigt, wie weit du bist.</h2>", None),
        ("<h1 style='font-size:96px'>Finanzplaner 2027</h1><h2>auf Deutsch · Excel & Google Sheets</h2><div class=big>Link in Bio 💚</div>", None)],
 "v5": [("<h1>POV: Ihr streitet nie wieder darüber, <span class=hl>wer was bezahlt</span> hat 💕</h1>", "R"),
        (f"<h2>Jede Ausgabe: Wer hat gezahlt? Für wen?</h2>{win(PT,'Ausgleich',AUSG)}", "R"),
        ("<div class=big>Tom → Lena<br>368,50 €</div><h2>Einmal im Monat überweisen. Quitt. ✓</h2>", "R"),
        ("<h1 style='font-size:92px'>Haushaltsbuch für Paare</h1><h2>50/50 oder nach Einkommen</h2><div class=big>Link in Bio 💕</div>", "R")],
}
for v, frames in videos.items():
    for i, (body, theme) in enumerate(frames):
        vt(f"{v}_{i}", body, *((RL, R) if theme else (GL, G)))
json.dump([{"name": n, "w": w, "h": h} for n, w, h in jobs], open(os.path.join(OUT, "jobs.json"), "w"))
print(len(jobs), "Seiten")
