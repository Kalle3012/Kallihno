// TikTok-Stadt – jeder Zuschauer bekommt eine Papierhütte und baut sie bis zur Riesen-Villa aus.
// Je mehr Leute in der Stadt wohnen, desto besser werden Straßen, Laternen und Rathaus.
// Alles wird gespeichert: Beim nächsten Live geht es genau dort weiter.
//
//   npm start -- deinTikTokName        echte Verbindung zu deinem Live
//   npm run demo                       Probelauf mit erfundenen Zuschauern
//   npm start -- deinTikTokName --neu  neue, leere Stadt (die alte wird vorher gesichert)
//
// Stadt:   http://localhost:3000
// Regie:   http://localhost:3000/regie.html  (Stimme des Bürgermeisters + Knöpfe)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { erstelleModerator } from './moderator.js';
import { QUIZ } from './quiz.js';

const hier = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- Einstellungen
const STANDARD = {
  tiktokName: '',
  stadtName: 'Zuschauer-Stadt',
  anthropicApiKey: '',
  kiModell: 'claude-opus-5-5',
  eulerApiKey: '',
  moderatorName: 'Bürgermeister Bo',
  port: 3000,
  kommentarPauseSekunden: 2,
  quizAlleMinuten: 6,
  bauRushAlleMinuten: 10,
  bauRushSekunden: 60,
  likeZielSchritt: 1000,
  abstimmungSekunden: 45
};
const einstellungen = { ...STANDARD };
const EINSTELLUNGEN_DATEI = path.join(hier, 'einstellungen.json');
if (fs.existsSync(EINSTELLUNGEN_DATEI)) {
  try {
    const datei = JSON.parse(fs.readFileSync(EINSTELLUNGEN_DATEI, 'utf8').replace(/^﻿/, ''));
    for (const [k, v] of Object.entries(datei)) if (v !== '' && v !== null && !k.startsWith('_')) einstellungen[k] = v;
  } catch (e) {
    console.error(`\n⚠️  einstellungen.json hat einen Tippfehler (${e.message}). Ich nutze die Standardwerte.\n`);
  }
}
const PORT = Number(process.env.PORT) || einstellungen.port;

// Punkte pro Aktion. Kommentare sind das Wichtigste.
const PUNKTE = { kommentar: 1, follow: 5, teilen: 3, diamant: 1, likesProPunkt: 50, quiz: 5 };

// Häuser: ab wie vielen Punkten welches Gebäude. Index = Stufe.
const STUFEN = [
  { ab: 0,   name: 'Papierhütte' },
  { ab: 2,   name: 'Holzhütte' },
  { ab: 5,   name: 'Gartenhäuschen' },
  { ab: 9,   name: 'Tiny House' },
  { ab: 14,  name: 'Bungalow' },
  { ab: 21,  name: 'Einfamilienhaus' },
  { ab: 30,  name: 'Modernes Haus' },
  { ab: 42,  name: 'Haus mit Pool' },
  { ab: 58,  name: 'Designer-Villa' },
  { ab: 80,  name: 'Luxusvilla' },
  { ab: 110, name: 'Prachtvilla' },
  { ab: 150, name: 'Riesen-Villa' }
];
const MAX_STUFE = STUFEN.length - 1;

// Stadt: ab wie vielen Einwohnern welche Ausbaustufe (Straßen, Laternen, Rathaus)
const STADTSTUFEN = [
  { ab: 0,   name: 'Siedlung',   a: 'eine', neu: 'Feldwege und ein Zelt als Rathaus' },
  { ab: 8,   name: 'Dorf',       a: 'ein',  neu: 'Kopfsteinpflaster, Holzlaternen und ein kleines Rathaus' },
  { ab: 20,  name: 'Kleinstadt', a: 'eine', neu: 'Asphaltstraßen, Straßenlaternen, Bäume an den Straßen und ein Rathaus mit Uhrturm' },
  { ab: 40,  name: 'Stadt',      a: 'eine', neu: 'Gehwege, Zebrastreifen, Parkbänke, moderne Laternen und Autos auf den Straßen' },
  { ab: 75,  name: 'Großstadt',  a: 'eine', neu: 'Radwege, LED-Laternen, Blumenkübel und ein Rathaus mit Kuppel' },
  { ab: 150, name: 'Metropole',  a: 'eine', neu: 'goldene Prachtlaternen, einen Boulevard und ein goldenes Rathaus' }
];
// Wahrzeichen, über die der Chat abstimmt (je eins bei Kleinstadt, Stadt, Großstadt)
const WAHRZEICHEN = {
  riesenrad: { name: 'Riesenrad', worte: ['riesenrad', 'rad'] },
  park: { name: 'Park mit Teich', worte: ['park', 'teich'] },
  brunnen: { name: 'Springbrunnen', worte: ['brunnen', 'springbrunnen'] }
};
const ABSTIMMUNG_BEI = [2, 3, 4];

// ---------------------------------------------------------------- Start-Argumente
const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const NEU = args.includes('--neu');
const benutzer = (args.find(a => !a.startsWith('--')) || process.env.TIKTOK_USER || einstellungen.tiktokName || '')
  .replace(/^https?:\/\/(www\.)?tiktok\.com\//, '')
  .replace(/^@/, '')
  .replace(/\/live.*$/, '')
  .trim();

if (!DEMO && !benutzer) {
  console.log('\nBitte deinen TikTok-Namen angeben, z. B.:  npm start -- kallihno');
  console.log('Oder zum Testen:                           npm run demo\n');
  process.exit(1);
}

const DATEN_DIR = path.join(hier, 'data');
const DATEI = path.join(DATEN_DIR, DEMO ? 'stadt-demo.json' : 'stadt.json');
const SICHERUNG_DIR = path.join(DATEN_DIR, 'sicherungen');
const BERICHT_DIR = path.join(DATEN_DIR, 'berichte');

const heute = () => new Date().toLocaleDateString('sv-SE'); // 2026-11-17
const zeitstempel = () => new Date().toLocaleString('sv-SE').replace(' ', '_').replace(/:/g, '-').slice(0, 16);

// ---------------------------------------------------------------- Zustand
const einwohner = new Map(); // uniqueId -> Bewohner
let naechsterPlatz = 0;
const stats = { zuschauer: 0, likesGesamt: 0, status: 'startet', streamer: benutzer || 'demo' };
const spiel = {
  likeZiel: einstellungen.likeZielSchritt,
  likeBasis: 0,       // Like-Stand, bei dem das aktuelle Ziel begonnen hat
  rushBis: 0,
  quiz: null,         // { frage, antworten, anzeige, bis, timer }
  abstimmung: null    // { optionen, stimmen, waehler, bis, timer }
};
const stadt = {
  stufe: 0,
  wahrzeichen: [],    // Reihenfolge, in der sie gebaut wurden
  chronik: { gegruendet: heute(), streams: [], gesamtKommentare: 0, rekordZuschauer: 0 }
};
// Was in diesem Live passiert (für den Tagesbericht)
const sitzung = {
  start: Date.now(), neue: 0, kommentare: 0, diamanten: 0, spitze: 0,
  punkteStart: new Map(), gesehen: new Set(), stadtStufeStart: 0, berichtGeschrieben: false, warLive: false
};

function laden() {
  if (!fs.existsSync(DATEI)) return;
  // Bei jedem Start eine Sicherungskopie anlegen (die letzten 30 bleiben)
  try {
    fs.mkdirSync(SICHERUNG_DIR, { recursive: true });
    fs.copyFileSync(DATEI, path.join(SICHERUNG_DIR, `${path.basename(DATEI, '.json')}_${zeitstempel()}.json`));
    const alle = fs.readdirSync(SICHERUNG_DIR).filter(f => f.endsWith('.json')).sort();
    for (const alt of alle.slice(0, Math.max(0, alle.length - 30))) fs.rmSync(path.join(SICHERUNG_DIR, alt));
  } catch (e) { console.error('Sicherung fehlgeschlagen:', e.message); }
  if (NEU) { console.log('Neue Stadt. Die alte liegt als Sicherung in data/sicherungen.'); return; }
  try {
    const d = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
    for (const b of d.einwohner || []) {
      b.bonus ??= 0; b.tage ??= 1; b.letzterTag ??= '';
      b.punkte = punkteBerechnen(b);
      b.stufe = stufeFuer(b.punkte);
      einwohner.set(b.id, b);
    }
    naechsterPlatz = d.naechsterPlatz || einwohner.size;
    if (d.stadt) {
      stadt.wahrzeichen = d.stadt.wahrzeichen || [];
      Object.assign(stadt.chronik, d.stadt.chronik || {});
    }
    stadt.stufe = stadtStufeFuer(einwohner.size);
    console.log(`Stadt geladen: ${einwohner.size} Einwohner, ${STADTSTUFEN[stadt.stufe].name}, ${stadt.chronik.streams.length} frühere Lives.`);
  } catch (e) {
    console.error(`\n❌ Die gespeicherte Stadt konnte nicht gelesen werden (${e.message}).`);
    console.error('   Eine Sicherung liegt in data/sicherungen. Ich starte mit einer leeren Stadt.\n');
  }
}

let speichernGeplant = false;
function speichern() {
  if (speichernGeplant) return;
  speichernGeplant = true;
  setTimeout(speichernJetzt, 3000);
}
function speichernJetzt() {
  speichernGeplant = false;
  try {
    fs.mkdirSync(DATEN_DIR, { recursive: true });
    const tmp = DATEI + '.tmp';
    const { stufe, ...rest } = stadt;
    fs.writeFileSync(tmp, JSON.stringify({ version: 2, gespeichert: new Date().toISOString(), naechsterPlatz, stadt: rest, einwohner: [...einwohner.values()] }));
    fs.renameSync(tmp, DATEI);
  } catch (e) {
    console.error('Konnte Stadt nicht speichern:', e.message);
  }
}

function stufeFuer(punkte) {
  let s = 0;
  for (let i = 0; i < STUFEN.length; i++) if (punkte >= STUFEN[i].ab) s = i;
  return s;
}
function stadtStufeFuer(anzahl) {
  let s = 0;
  for (let i = 0; i < STADTSTUFEN.length; i++) if (anzahl >= STADTSTUFEN[i].ab) s = i;
  return s;
}

function punkteBerechnen(b) {
  return b.kommentare * PUNKTE.kommentar
    + (b.folgt ? PUNKTE.follow : 0)
    + b.geteilt * PUNKTE.teilen
    + b.diamanten * PUNKTE.diamant
    + Math.floor(b.likes / PUNKTE.likesProPunkt)
    + (b.bonus || 0);
}

function infoVon(b) {
  const punkte = punkteBerechnen(b), stufe = stufeFuer(punkte);
  const naechste = STUFEN[stufe + 1];
  return { stufe: STUFEN[stufe].name, punkte, naechste: naechste?.name || '', fehlen: naechste ? naechste.ab - punkte : 0 };
}

function bewohnerHolen(user) {
  const id = user?.uniqueId || user?.userId;
  if (!id) return null;
  let b = einwohner.get(id);
  if (!b) {
    b = {
      id,
      name: (user.nickname || id).slice(0, 24),
      platz: naechsterPlatz++,
      kommentare: 0, likes: 0, diamanten: 0, geteilt: 0, folgt: false, bonus: 0,
      punkte: 0, stufe: 0, farbe: null, tage: 1, letzterTag: heute(),
      seit: Date.now(), zuletzt: Date.now(), letzterKommentarZeit: 0
    };
    einwohner.set(id, b);
    sitzung.neue++;
    sitzung.gesehen.add(id);
    sitzung.punkteStart.set(id, 0);
    moderator.neuerBuerger(b);
    stadtPruefen();
  } else {
    if (user.nickname) b.name = user.nickname.slice(0, 24);
    if (!sitzung.gesehen.has(id)) {
      // Zum ersten Mal in diesem Live: Stammgast?
      sitzung.gesehen.add(id);
      sitzung.punkteStart.set(id, b.punkte);
      if (b.letzterTag !== heute()) {
        b.tage = (b.tage || 1) + 1;
        b.letzterTag = heute();
        moderator.zurueck(b, STUFEN[b.stufe].name);
      }
    }
  }
  return b;
}

const rushAktiv = () => Date.now() < spiel.rushBis;

// ---------------------------------------------------------------- Webserver + Verbindung zum Overlay
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PUBLIC = path.join(hier, 'public');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let datei;
  try { datei = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  const voll = path.join(PUBLIC, path.normalize(datei));
  if (!voll.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(voll, (err, inhalt) => {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(voll)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(inhalt);
  });
});

const wss = new WebSocketServer({ server });
function oeffentlich(b) {
  const { letzterKommentarZeit, ...rest } = b;
  return { ...rest, stufenName: STUFEN[b.stufe].name };
}
function senden(nachricht) {
  const text = JSON.stringify(nachricht);
  for (const c of wss.clients) if (c.readyState === 1) c.send(text);
}
function spielZustand() {
  const a = spiel.abstimmung;
  return {
    likeZiel: spiel.likeZiel, likeBasis: spiel.likeBasis, likes: stats.likesGesamt,
    rushBis: spiel.rushBis,
    quiz: spiel.quiz ? { frage: spiel.quiz.frage, bis: spiel.quiz.bis } : null,
    abstimmung: a ? { bis: a.bis, optionen: a.optionen.map(o => ({ art: o, name: WAHRZEICHEN[o].name, stimmen: a.stimmen[o] })) } : null,
    jetzt: Date.now()
  };
}
function stadtZustand() {
  const naechste = STADTSTUFEN[stadt.stufe + 1];
  return {
    name: einstellungen.stadtName, stufe: stadt.stufe, stufenName: STADTSTUFEN[stadt.stufe].name, artikel: STADTSTUFEN[stadt.stufe].a, neu: STADTSTUFEN[stadt.stufe].neu,
    einwohner: einwohner.size, naechsteAb: naechste?.ab ?? null, naechsterName: naechste?.name ?? null,
    wahrzeichen: stadt.wahrzeichen, tag: stadt.chronik.streams.length + 1
  };
}

function statsSenden() { senden({ t: 'stats', stats }); }
function spielSenden() { senden({ t: 'spiel', spiel: spielZustand() }); }
function stadtSenden() { senden({ t: 'stadt', stadt: stadtZustand() }); }

// ---------------------------------------------------------------- Bürgermeister
const kiSchluessel = process.env.ANTHROPIC_API_KEY || einstellungen.anthropicApiKey;
const moderator = erstelleModerator({
  name: einstellungen.moderatorName,
  senden,
  apiKey: kiSchluessel,
  modell: einstellungen.kiModell,
  stadt: () => {
    const top = [...einwohner.values()].sort((a, b) => b.punkte - a.punkte)[0];
    const s = stadtZustand();
    return {
      anzahl: einwohner.size, zuschauer: stats.zuschauer,
      top: top?.name || 'niemand', topStufe: top ? STUFEN[top.stufe].name : 'Papierhütte',
      stadtName: s.name, stadtStufe: `${STADTSTUFEN[stadt.stufe].a} ${s.stufenName}`,
      naechsteStadt: s.naechsterName ? `${STADTSTUFEN[stadt.stufe + 1].a} ${s.naechsterName}` : '', fehlenStadt: s.naechsteAb ? s.naechsteAb - s.einwohner : 0
    };
  }
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    t: 'alles',
    stufen: STUFEN,
    einwohner: [...einwohner.values()].map(oeffentlich),
    stats, spiel: spielZustand(), stadt: stadtZustand(),
    moderator: { name: einstellungen.moderatorName, pausiert: moderator.pausiert, ki: !!kiSchluessel }
  }));
  ws.on('message', roh => {
    let m; try { m = JSON.parse(roh); } catch { return; }
    if (m.t !== 'regie') return;
    if (m.aktion === 'quiz') quizStarten();
    else if (m.aktion === 'rush') rushStarten(true);
    else if (m.aktion === 'feuerwerk') senden({ t: 'feuerwerk', staerke: 3 });
    else if (m.aktion === 'abstimmung') abstimmungStarten(true);
    else if (m.aktion === 'sagen' && typeof m.text === 'string') moderator.sag(m.text.slice(0, 300), 10);
    else if (m.aktion === 'pause') { moderator.pause(!!m.an); senden({ t: 'moderator', pausiert: moderator.pausiert }); }
    else if (m.aktion === 'bericht') {
      if (berichtSchreiben('über die Regie beendet')) moderator.sag('Danke, dass ihr da wart! Die Stadt ist gespeichert. Bis zum nächsten Mal!', 6);
      else moderator.sag('Der Tagesbericht für heute ist schon gespeichert.', 2);
    }
  });
});

// ---------------------------------------------------------------- Kernfunktion
// Etwas ist passiert -> Punkte neu, Stufe neu, ans Overlay schicken.
function ereignis(b, art, text) {
  const alteStufe = b.stufe;
  b.punkte = punkteBerechnen(b);
  b.stufe = stufeFuer(b.punkte);
  b.zuletzt = Date.now();
  const aufstieg = b.stufe > alteStufe;
  senden({ t: 'bewohner', b: oeffentlich(b), art, text, aufstieg });
  if (aufstieg) {
    console.log(`  ⬆️  ${b.name} hat jetzt: ${STUFEN[b.stufe].name} (${b.punkte} ${b.punkte === 1 ? 'Punkt' : 'Punkte'})`);
    moderator.aufstieg(b, STUFEN[b.stufe].name, b.stufe === MAX_STUFE);
  }
  speichern();
}

// ---------------------------------------------------------------- Stadtausbau + Wahrzeichen
function stadtPruefen() {
  const neu = stadtStufeFuer(einwohner.size);
  if (neu <= stadt.stufe) { stadtSenden(); return; }
  for (let s = stadt.stufe + 1; s <= neu; s++) {
    const st = STADTSTUFEN[s];
    console.log(`\n🏙️  Die Stadt ist jetzt ${st.a} ${st.name}! (${einwohner.size} Einwohner)\n`);
    moderator.sag(`Großartig! Wir haben ${einwohner.size} Einwohner. Unsere Stadt ist jetzt ${st.a} ${st.name}! Neu: ${st.neu}.`, 5);
  }
  stadt.stufe = neu;
  senden({ t: 'stadtAufstieg', stadt: stadtZustand() });
  senden({ t: 'feuerwerk', staerke: 2 });
  stadtSenden();
  // Wahrzeichen fällig?
  const faellig = ABSTIMMUNG_BEI.filter(s => s <= neu).length;
  if (stadt.wahrzeichen.length < faellig && !spiel.abstimmung) setTimeout(() => abstimmungStarten(false), 9000);
  speichern();
}

function wahrzeichenNachholen() {
  const faellig = ABSTIMMUNG_BEI.filter(s => s <= stadt.stufe).length;
  if (stadt.wahrzeichen.length < faellig && !spiel.abstimmung) setTimeout(() => abstimmungStarten(false), 20_000);
}

function offeneWahrzeichen() { return Object.keys(WAHRZEICHEN).filter(w => !stadt.wahrzeichen.includes(w)); }

function abstimmungStarten(vonHand) {
  if (spiel.abstimmung) return;
  const optionen = offeneWahrzeichen();
  if (!optionen.length) { if (vonHand) moderator.sag('Alle Wahrzeichen sind schon gebaut!', 3); return; }
  if (spiel.quiz) { setTimeout(() => abstimmungStarten(vonHand), 5000); return; } // erst Quiz fertig spielen
  if (optionen.length === 1) { wahrzeichenBauen(optionen[0], null); return; }
  const sek = einstellungen.abstimmungSekunden;
  const a = { optionen, stimmen: Object.fromEntries(optionen.map(o => [o, 0])), waehler: new Set(), bis: Date.now() + sek * 1000 };
  spiel.abstimmung = a;
  const liste = optionen.map((o, i) => `${i + 1} für ${WAHRZEICHEN[o].name}`).join(', ');
  console.log(`🗳️  Abstimmung: ${liste}`);
  // Sicherheitsnetz, falls die Ansage nie kommt
  a.timer = setTimeout(abstimmungBeenden, (sek + 60) * 1000);
  // Countdown startet, wenn der Bürgermeister die Abstimmung ansagt
  moderator.sag(`Abstimmung! Was bauen wir als Nächstes in die Stadtmitte? Schreibt ${liste}. Ihr habt ${sek} Sekunden!`, 9, () => {
    if (spiel.abstimmung !== a) return;
    clearTimeout(a.timer);
    a.bis = Date.now() + sek * 1000;
    a.timer = setTimeout(abstimmungBeenden, sek * 1000);
    spielSenden();
  }, () => spiel.abstimmung === a);
  spielSenden();
}

function stimmeZaehlen(b, text) {
  const a = spiel.abstimmung;
  if (!a || Date.now() > a.bis || a.waehler.has(b.id)) return;
  const n = normal(text);
  let wahl = null;
  const zahl = /^\s*([1-3])\b/.exec(n);
  if (zahl && a.optionen[+zahl[1] - 1]) wahl = a.optionen[+zahl[1] - 1];
  else wahl = a.optionen.find(o => WAHRZEICHEN[o].worte.some(w => (' ' + n + ' ').includes(' ' + w + ' ')));
  if (!wahl) return;
  a.waehler.add(b.id);
  a.stimmen[wahl]++;
  spielSenden();
}

function abstimmungBeenden() {
  const a = spiel.abstimmung;
  if (!a) return;
  spiel.abstimmung = null;
  const max = Math.max(...Object.values(a.stimmen));
  const beste = a.optionen.filter(o => a.stimmen[o] === max);
  const sieger = beste[Math.floor(Math.random() * beste.length)];
  wahrzeichenBauen(sieger, max > 0 ? a.stimmen : null);
  spielSenden();
  setTimeout(wahrzeichenNachholen, 1000);
}

function wahrzeichenBauen(art, stimmen) {
  stadt.wahrzeichen.push(art);
  const name = WAHRZEICHEN[art].name;
  console.log(`🏗️  Neues Wahrzeichen: ${name}`);
  moderator.sag(stimmen
    ? `Entschieden! Mit ${stimmen[art]} ${stimmen[art] === 1 ? 'Stimme' : 'Stimmen'} gewinnt: ${name}! Die Bagger rollen schon an.`
    : `In der Stadtmitte entsteht jetzt: ${name}!`, 6);
  senden({ t: 'wahrzeichen', art, name, stimmen });
  senden({ t: 'feuerwerk', staerke: 2 });
  stadtSenden();
  speichern();
}

// ---------------------------------------------------------------- Chat-Befehle und Kommentare
const FARBEN = {
  rot: '#ef4444', blau: '#3b82f6', gruen: '#22c55e', grün: '#22c55e', gelb: '#facc15',
  lila: '#a855f7', pink: '#ec4899', rosa: '#f9a8d4', orange: '#f97316', schwarz: '#27272a',
  weiss: '#f4f4f5', weiß: '#f4f4f5', tuerkis: '#14b8a6', türkis: '#14b8a6', braun: '#92400e',
  grau: '#9ca3af', gold: '#eab308', mint: '#6ee7b7', hellblau: '#7dd3fc'
};
const normal = s => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function kommentar(user, text) {
  const b = bewohnerHolen(user);
  if (!b) return;
  console.log(`💬 ${b.name}: ${text}`);
  const t = text.trim();
  const jetzt = Date.now();
  const istBefehl = t.startsWith('!');
  sitzung.kommentare++;
  stadt.chronik.gesamtKommentare++;

  // Quiz-Antwort?
  if (spiel.quiz && jetzt < spiel.quiz.bis) {
    const n = ' ' + normal(t) + ' ';
    if (spiel.quiz.antworten.some(a => n.includes(' ' + normal(a) + ' '))) {
      const q = spiel.quiz;
      spiel.quiz = null;
      clearTimeout(q.timer);
      b.bonus += PUNKTE.quiz;
      moderator.sag(`Richtig! ${b.name} wusste es zuerst: ${q.anzeige}. Fünf Bonuspunkte!`, 5);
      senden({ t: 'quizEnde', gewinner: b.name, antwort: q.anzeige });
      spielSenden();
      ereignis(b, 'quiz', 'hat das Quiz gewonnen!');
      return;
    }
  }
  // Stimme für ein Wahrzeichen?
  if (spiel.abstimmung) stimmeZaehlen(b, t);

  // Punkt für den Kommentar (mit kleiner Pause gegen Spam)
  if (jetzt - b.letzterKommentarZeit >= einstellungen.kommentarPauseSekunden * 1000) {
    b.kommentare++;
    if (rushAktiv()) b.bonus += PUNKTE.kommentar; // Bau-Rush: doppelte Punkte
    b.letzterKommentarZeit = jetzt;
  }

  // Befehle
  const farbe = /^!\s*farbe\s+(\S+)/i.exec(t);
  if (farbe) {
    const wort = farbe[1].toLowerCase();
    if (FARBEN[wort]) { b.farbe = FARBEN[wort]; moderator.sag(`${b.name} streicht das Haus ${wort} an. Schick!`, 1); }
    else moderator.sag(`${b.name}, die Farbe kenne ich nicht. Probier zum Beispiel rot, blau, pink, gold oder mint.`, 1);
  }
  if (/^!\s*haus\b/i.test(t)) {
    const i = infoVon(b);
    moderator.sag(i.naechste
      ? `${b.name}, dein Zuhause: ${i.stufe}, mit ${i.punkte} ${i.punkte === 1 ? 'Punkt' : 'Punkten'}. Noch ${i.fehlen} bis zur nächsten Stufe: ${i.naechste}!`
      : `${b.name}, du wohnst in der Riesen-Villa mit ${i.punkte} Punkten. Du bist ganz oben!`, 3);
  }
  if (/^!\s*top\b/i.test(t)) {
    const top = [...einwohner.values()].sort((a, c) => c.punkte - a.punkte).slice(0, 3);
    moderator.sag('Die Top 3: ' + top.map((x, i) => `${i + 1}. ${x.name}, ${STUFEN[x.stufe].name}`).join('. ') + '.', 3);
  }
  if (/^!\s*stadt\b/i.test(t)) {
    const s = stadtZustand();
    moderator.sag(s.naechsterName
      ? `Wir sind ${s.artikel} ${s.stufenName} mit ${s.einwohner} Einwohnern. Noch ${s.naechsteAb - s.einwohner} neue Bürger, dann werden wir ${STADTSTUFEN[stadt.stufe + 1].a} ${s.naechsterName}!`
      : `Wir sind eine Metropole mit ${s.einwohner} Einwohnern. Mehr geht nicht!`, 3);
  }
  if (/^!\s*(hilfe|help|befehle)\b/i.test(t)) {
    moderator.sag('Schreib einfach im Chat, jeder Kommentar ist ein Punkt. Befehle: !haus, !top, !stadt und !farbe mit einer Farbe.', 3);
  }

  ereignis(b, 'kommentar', t.slice(0, 120));
  if (!istBefehl && !/^\s*[1-3]\s*$/.test(t)) moderator.kommentar(b.name, t.slice(0, 200), infoVon(b));
}

function beitritt(user) {
  const id = user?.uniqueId;
  if (!id) return;
  const kannteIch = einwohner.has(id);
  const b = bewohnerHolen(user);
  if (!kannteIch) console.log(`👋 ${b.name} ist da – bekommt eine Papierhütte`);
  ereignis(b, 'beitritt', kannteIch ? 'ist wieder da' : 'ist neu in der Stadt');
}

function folgen(user) {
  const b = bewohnerHolen(user);
  if (!b || b.folgt) return;
  console.log(`❤️  ${b.name} folgt dir jetzt!`);
  b.folgt = true;
  moderator.follow(b);
  ereignis(b, 'follow', 'folgt jetzt!');
}

function teilen(user) {
  const b = bewohnerHolen(user);
  if (!b) return;
  console.log(`🔁 ${b.name} hat den Live geteilt`);
  b.geteilt++;
  moderator.teilen(b);
  ereignis(b, 'teilen', 'hat den Live geteilt');
}

function likes(user, anzahl, gesamt) {
  const b = bewohnerHolen(user);
  if (!b) return;
  b.likes += anzahl || 0;
  stats.likesGesamt = Math.max(stats.likesGesamt, gesamt || stats.likesGesamt + (anzahl || 0));
  if (stats.likesGesamt >= spiel.likeZiel) {
    const erreicht = spiel.likeZiel;
    spiel.likeBasis = erreicht;
    while (spiel.likeZiel <= stats.likesGesamt) spiel.likeZiel += einstellungen.likeZielSchritt;
    console.log(`🎆 Like-Ziel ${erreicht} erreicht!`);
    senden({ t: 'feuerwerk', staerke: 3 });
    moderator.sag(`Like-Ziel geschafft: ${erreicht.toLocaleString('de-DE')} Likes! Feuerwerk! Und als Belohnung gibt es einen Bau-Rush!`, 5);
    rushStarten(false);
  }
  spielSenden();
  ereignis(b, 'like', `${anzahl} Likes`);
}

function geschenk(user, name, diamanten, anzahl) {
  const b = bewohnerHolen(user);
  if (!b) return;
  const summe = (diamanten || 1) * (anzahl || 1);
  console.log(`🎁 ${b.name} schenkt ${anzahl}× ${name} (${summe} Diamanten)`);
  b.diamanten += summe;
  sitzung.diamanten += summe;
  moderator.geschenk(b, anzahl > 1 ? `${anzahl} mal ${name}` : name);
  if (summe >= 30) senden({ t: 'feuerwerk', staerke: summe >= 300 ? 3 : 1 });
  // Großes Geschenk: die ganze Stadt bekommt einen kurzen Bau-Rush
  if (summe >= 100 && !rushAktiv()) {
    rushStarten(false, 30);
    moderator.sag(`Dank ${b.name} gibt es jetzt 30 Sekunden Bau-Rush für alle!`, 8);
  }
  ereignis(b, 'geschenk', `schenkt ${anzahl}× ${name}`);
}

// ---------------------------------------------------------------- Bau-Rush und Quiz
let rushTimer = null;
function rushStarten(ansagen, sekunden = einstellungen.bauRushSekunden) {
  spiel.rushBis = Date.now() + sekunden * 1000;
  console.log('🚧 Bau-Rush gestartet!');
  if (ansagen) moderator.sag(`Achtung, Bau-Rush! ${sekunden} Sekunden lang zählt jeder Kommentar doppelt. Schreibt, was das Zeug hält!`, 9);
  spielSenden();
  clearTimeout(rushTimer);
  rushTimer = setTimeout(() => {
    spielSenden();
    moderator.sag('Der Bau-Rush ist vorbei. Schaut mal, wie die Stadt gewachsen ist!', 2);
  }, sekunden * 1000 + 200);
}

const letzteFragen = [];
function quizStarten() {
  if (spiel.quiz || spiel.abstimmung) return;
  const frei = QUIZ.filter(q => !letzteFragen.includes(q.frage));
  const q = frei[Math.floor(Math.random() * frei.length)];
  letzteFragen.push(q.frage); if (letzteFragen.length > 25) letzteFragen.shift();
  const quiz = { frage: q.frage, antworten: q.antworten, anzeige: q.antworten[0], bis: Date.now() + 40_000 };
  spiel.quiz = quiz;
  console.log(`❓ Quiz: ${q.frage} (Antwort: ${q.antworten[0]})`);
  const ende = () => {
    if (spiel.quiz !== quiz) return;
    const a = spiel.quiz.anzeige;
    spiel.quiz = null;
    moderator.sag(`Das wusste leider niemand! Die Antwort war: ${a}.`, 4);
    senden({ t: 'quizEnde', gewinner: null, antwort: a });
    spielSenden();
  };
  quiz.timer = setTimeout(ende, 100_000); // Sicherheitsnetz
  // 40 Sekunden Antwortzeit ab der Ansage
  moderator.sag(`Quiz-Zeit! Wer zuerst richtig antwortet, bekommt fünf Bonuspunkte. ${q.frage}`, 9, () => {
    if (spiel.quiz !== quiz) return;
    clearTimeout(quiz.timer);
    quiz.bis = Date.now() + 40_000;
    quiz.timer = setTimeout(ende, 40_000);
    spielSenden();
  }, () => spiel.quiz === quiz);
  spielSenden();
}

function automatischeSpiele() {
  const istAktiv = () => stats.status === 'live' || stats.status === 'demo';
  if (einstellungen.quizAlleMinuten > 0) {
    setInterval(() => { if (istAktiv() && einwohner.size >= 2) quizStarten(); }, einstellungen.quizAlleMinuten * 60_000);
  }
  if (einstellungen.bauRushAlleMinuten > 0) {
    setInterval(() => { if (istAktiv() && !rushAktiv() && !spiel.quiz && !spiel.abstimmung) rushStarten(true); }, einstellungen.bauRushAlleMinuten * 60_000);
  }
}

// ---------------------------------------------------------------- Gedächtnis: Tagesbericht und Chronik
function willkommenZurueck() {
  const letzter = stadt.chronik.streams.at(-1);
  if (!letzter) return;
  const tag = stadt.chronik.streams.length + 1;
  moderator.sag(`Willkommen zurück in ${einstellungen.stadtName}! Heute ist Tag ${tag}. Letztes Mal sind ${letzter.neue} neue Bürger eingezogen` +
    (letzter.fleissigster ? `, und am fleißigsten hat ${letzter.fleissigster} gebaut.` : '.') + ' Eure Häuser stehen alle noch!', 6);
}

function berichtSchreiben(grund) {
  if (sitzung.berichtGeschrieben || !sitzung.warLive) return null;
  sitzung.berichtGeschrieben = true;
  const zuwachs = [...sitzung.punkteStart].map(([id, start]) => {
    const b = einwohner.get(id);
    return b ? { name: b.name, plus: b.punkte - start, stufe: STUFEN[b.stufe].name } : null;
  }).filter(Boolean).sort((a, b) => b.plus - a.plus);
  const top = [...einwohner.values()].sort((a, b) => b.punkte - a.punkte).slice(0, 5);
  const minuten = Math.round((Date.now() - sitzung.start) / 60000);
  const eintrag = {
    datum: heute(), minuten, neue: sitzung.neue, besucher: sitzung.gesehen.size, kommentare: sitzung.kommentare,
    likes: stats.likesGesamt, diamanten: sitzung.diamanten, spitzeZuschauer: sitzung.spitze,
    einwohner: einwohner.size, stadtStufe: STADTSTUFEN[stadt.stufe].name,
    fleissigster: zuwachs[0]?.plus > 0 ? zuwachs[0].name : null
  };
  stadt.chronik.streams.push(eintrag);
  if (stadt.chronik.streams.length > 365) stadt.chronik.streams.shift();
  speichernJetzt();

  const zeilen = [
    `# ${einstellungen.stadtName} – Tag ${stadt.chronik.streams.length} (${eintrag.datum})`, '',
    `- Dauer: ${minuten} Minuten (${grund})`,
    `- Besucher in der Stadt: ${eintrag.besucher}, davon neu eingezogen: ${eintrag.neue}`,
    `- Kommentare: ${eintrag.kommentare}, Likes: ${eintrag.likes}, Diamanten: ${eintrag.diamanten}`,
    `- Höchste Zuschauerzahl: ${eintrag.spitzeZuschauer}`,
    `- Stadt: ${eintrag.stadtStufe} mit ${eintrag.einwohner} Einwohnern` + (stadt.wahrzeichen.length ? `, Wahrzeichen: ${stadt.wahrzeichen.map(w => WAHRZEICHEN[w].name).join(', ')}` : ''),
    '', '## Am fleißigsten heute', ...zuwachs.slice(0, 10).filter(z => z.plus > 0).map((z, i) => `${i + 1}. ${z.name}: +${z.plus} Punkte (${z.stufe})`),
    '', '## Schönste Häuser insgesamt', ...top.map((b, i) => `${i + 1}. ${b.name}: ${STUFEN[b.stufe].name} (${b.punkte} Punkte)`)
  ];
  try {
    fs.mkdirSync(BERICHT_DIR, { recursive: true });
    const datei = path.join(BERICHT_DIR, `${DEMO ? 'probelauf_' : ''}tag-${String(stadt.chronik.streams.length).padStart(3, '0')}_${zeitstempel()}.md`);
    fs.writeFileSync(datei, zeilen.join('\n') + '\n');
    console.log('\n' + zeilen.join('\n') + `\n\n📄 Bericht gespeichert: ${datei}\n`);
  } catch (e) { console.error('Bericht konnte nicht gespeichert werden:', e.message); }
  return eintrag;
}

// ---------------------------------------------------------------- Verbindung zu TikTok
async function tiktokStarten() {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
  const optionen = { enableExtendedGiftInfo: true };
  if (einstellungen.eulerApiKey) optionen.signApiKey = einstellungen.eulerApiKey;
  const verbindung = new TikTokLiveConnection(benutzer, optionen);
  let verbunden = false;
  let begruesst = false;
  let fehlversuche = 0;

  verbindung.on(WebcastEvent.CHAT, d => d.comment && kommentar(d.user, d.comment));
  verbindung.on(WebcastEvent.MEMBER, d => beitritt(d.user));
  verbindung.on(WebcastEvent.FOLLOW, d => folgen(d.user));
  verbindung.on(WebcastEvent.SHARE, d => teilen(d.user));
  verbindung.on(WebcastEvent.LIKE, d => likes(d.user, d.likeCount, d.totalLikeCount));
  verbindung.on(WebcastEvent.GIFT, d => {
    if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return; // Serie läuft noch
    const name = d.giftDetails?.giftName || d.extendedGiftInfo?.name || 'Geschenk';
    const diamanten = d.giftDetails?.diamondCount || d.extendedGiftInfo?.diamond_count || 1;
    geschenk(d.user, name, diamanten, d.repeatCount || 1);
  });
  verbindung.on(WebcastEvent.ROOM_USER, d => {
    if (typeof d.viewerCount === 'number') zuschauerSetzen(d.viewerCount);
  });
  verbindung.on(WebcastEvent.STREAM_END, () => {
    console.log('\n🔴 Der Live ist beendet. Die Stadt ist gespeichert.');
    stats.status = 'beendet'; statsSenden(); speichernJetzt();
    berichtSchreiben('Live beendet');
  });
  verbindung.on(ControlEvent.DISCONNECTED, () => {
    if (!verbunden) return;
    verbunden = false;
    if (stats.status === 'beendet') return;
    console.log('⚠️  Verbindung getrennt – versuche es in 10 Sekunden erneut …');
    stats.status = 'getrennt'; statsSenden();
    setTimeout(verbinden, 10_000);
  });
  verbindung.on(ControlEvent.ERROR, () => { /* Meldung kommt unten beim Verbindungsversuch */ });

  async function verbinden() {
    try {
      stats.status = 'verbinde'; statsSenden();
      const zustand = await verbindung.connect();
      verbunden = true;
      fehlversuche = 0;
      sitzung.warLive = true;
      stats.status = 'live'; statsSenden();
      console.log(`\n✅ Verbunden mit dem Live von @${benutzer} (Raum ${zustand.roomId}). Ich lese jetzt alles mit!\n`);
      if (!begruesst) {
        begruesst = true;
        wahrzeichenNachholen();
        if (stadt.chronik.streams.length) willkommenZurueck();
        else moderator.sag('Hallo zusammen! Ich bin der Bürgermeister dieser Stadt. Jeder von euch bekommt ein Haus. Schreibt in den Chat, dann wird es größer!', 5);
      }
    } catch (e) {
      // Nicht zu oft fragen: Der kostenlose Verbindungsdienst erlaubt nur wenige Versuche pro Minute.
      fehlversuche++;
      const warte = Math.min(60, 20 + (fehlversuche - 1) * 10);
      const msg = e?.message || String(e);
      const offline = /offline|not.*live|isn.t live|LIVE has ended|Room ID/i.test(msg) || e?.constructor?.name === 'UserOfflineError';
      const limit = /rate|limit|429|too many/i.test(msg);
      stats.status = offline ? 'wartet' : 'fehler'; statsSenden();
      if (limit) console.log(`⛔ Zu viele Verbindungsversuche (Limit des kostenlosen Dienstes). Neuer Versuch in ${warte} Sekunden …\n   Tipp: kostenlosen Schlüssel von eulerstream.com in einstellungen.json bei "eulerApiKey" eintragen.`);
      else if (offline) console.log(`⏳ @${benutzer} ist (noch) nicht live – oder der Name ist falsch geschrieben. Neuer Versuch in ${warte} Sekunden …`);
      else console.log(`❌ Verbindung fehlgeschlagen: ${msg}\n   Neuer Versuch in ${warte} Sekunden …`);
      setTimeout(verbinden, warte * 1000);
    }
  }
  verbinden();
}

function zuschauerSetzen(n) {
  stats.zuschauer = n;
  sitzung.spitze = Math.max(sitzung.spitze, n);
  if (n > stadt.chronik.rekordZuschauer) {
    const alt = stadt.chronik.rekordZuschauer;
    stadt.chronik.rekordZuschauer = n;
    if (alt >= 5 && n % 5 === 0) moderator.sag(`Neuer Zuschauer-Rekord: ${n} Leute sind gerade in der Stadt!`, 3);
  }
  statsSenden();
}

// ---------------------------------------------------------------- Demo-Modus
function demoStarten() {
  stats.status = 'demo';
  sitzung.warLive = true;
  const vornamen = ['Lena', 'Max', 'Mia', 'Ben', 'Emma', 'Paul', 'Lea', 'Finn', 'Sofia', 'Noah', 'Hannah', 'Elias', 'Emilia', 'Luis', 'Clara', 'Jonas', 'Ida', 'Leon', 'Marie', 'Felix', 'Ella', 'Anton', 'Lina', 'Theo', 'Nele', 'Karl', 'Zoe', 'Oskar', 'Frieda', 'Tim'];
  const saetze = ['Hallo!', 'Wie heißt die Stadt?', 'Mein Haus soll riesig werden', 'Bau mir einen Pool', 'hiii', 'Wo ist mein Haus?', 'Ich will die Riesen-Villa!', '!farbe pink', '!farbe blau', '!farbe mint', '!haus', 'lol', 'Grüße aus Berlin', 'mehr mehr mehr', '🔥🔥🔥', 'Bürgermeister, wie alt bist du?', 'Ich bin seit Anfang dabei!', 'Was ist das beste Haus?', '!top', '!stadt'];
  const leute = [];
  const genutzt = new Set();
  const neuePerson = () => {
    let v = vornamen[Math.floor(Math.random() * vornamen.length)];
    if (genutzt.has(v)) v += Math.floor(Math.random() * 90 + 10);
    genutzt.add(v);
    const u = { uniqueId: 'demo_' + v.toLowerCase(), nickname: v };
    leute.push(u);
    return u;
  };
  for (let i = 0; i < 6; i++) beitritt(neuePerson());
  zuschauerSetzen(6);
  wahrzeichenNachholen();
  if (stadt.chronik.streams.length) willkommenZurueck();
  else moderator.sag('Hallo zusammen! Ich bin der Bürgermeister dieser Stadt. Das hier ist ein Probelauf mit erfundenen Zuschauern.', 5);
  const tempo = Number(process.env.DEMO_TEMPO) || 900;
  const maxLeute = Number(process.env.DEMO_LEUTE) || 60;
  setInterval(() => {
    const r = Math.random();
    const p = leute[Math.floor(Math.pow(Math.random(), 2.2) * leute.length)]; // ein paar Vielschreiber
    if (spiel.quiz && Math.random() < 0.08) return kommentar(p, spiel.quiz.antworten[0]);
    if (spiel.abstimmung && Math.random() < 0.3) return kommentar(p, String(1 + Math.floor(Math.random() * spiel.abstimmung.optionen.length)));
    if (r < 0.14 && leute.length < maxLeute) { beitritt(neuePerson()); zuschauerSetzen(stats.zuschauer + 1); }
    else if (r < 0.80) kommentar(p, saetze[Math.floor(Math.random() * saetze.length)]);
    else if (r < 0.90) likes(p, 15 + Math.floor(Math.random() * 40), stats.likesGesamt + 25 + Math.floor(Math.random() * 40));
    else if (r < 0.95) folgen(p);
    else if (r < 0.97) teilen(p);
    else geschenk(p, ['Rose', 'Herz', 'Donut', 'Krone'][Math.floor(Math.random() * 4)], [1, 5, 30, 99][Math.floor(Math.random() * 4)], 1 + Math.floor(Math.random() * 3));
  }, tempo);
}

// ---------------------------------------------------------------- Los geht's
laden();
sitzung.stadtStufeStart = stadt.stufe;
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`\n❌ Port ${PORT} ist schon belegt. Läuft die Stadt schon in einem anderen Fenster? Dann dieses Fenster schließen.\n`);
  else console.error('Serverfehler:', e.message);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log('\n🏙️  TikTok-Stadt läuft!');
  console.log(`   Stadt (für den Live):   http://localhost:${PORT}`);
  console.log(`   Regie + Stimme:         http://localhost:${PORT}/regie.html\n`);
  if (DEMO) { console.log('   DEMO-MODUS: erfundene Zuschauer\n'); demoStarten(); }
  else tiktokStarten().catch(e => { console.error('Konnte TikTok-Bibliothek nicht laden. Hast du "npm install" ausgeführt?\n', e.message); });
  automatischeSpiele();
});

// Beim Beenden (Fenster schließen, Strg+C): speichern und Tagesbericht schreiben
function beenden() {
  if (spiel.abstimmung) { clearTimeout(spiel.abstimmung.timer); abstimmungBeenden(); }
  speichernJetzt();
  berichtSchreiben('Programm beendet');
  console.log('\nStadt gespeichert. Bis zum nächsten Live!');
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try { process.on(sig, beenden); } catch { /* Signal gibt es auf diesem System nicht */ }
}
// Ein Fehler irgendwo soll nicht den ganzen Live abbrechen
process.on('uncaughtException', e => { console.error('⚠️  Unerwarteter Fehler (Programm läuft weiter):', e?.message || e); speichern(); });
process.on('unhandledRejection', e => { console.error('⚠️  Unerwarteter Fehler (Programm läuft weiter):', e?.message || e); });
