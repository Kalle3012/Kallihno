// TikTok-Stadt – jeder Zuschauer bekommt eine Papierhütte und baut sie bis zur Riesen-Villa aus.
//
//   npm start -- deinTikTokName        echte Verbindung zu deinem Live
//   npm run demo                       Probelauf mit erfundenen Zuschauern
//   npm start -- deinTikTokName --neu  Stadt leeren und neu anfangen
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
  anthropicApiKey: '',
  kiModell: 'claude-opus-5-5',
  moderatorName: 'Bürgermeister Bo',
  port: 3000,
  kommentarPauseSekunden: 2,
  quizAlleMinuten: 6,
  bauRushAlleMinuten: 10,
  bauRushSekunden: 60,
  likeZielSchritt: 1000
};
const einstellungen = { ...STANDARD };
const EINSTELLUNGEN_DATEI = path.join(hier, 'einstellungen.json');
if (fs.existsSync(EINSTELLUNGEN_DATEI)) {
  try {
    const datei = JSON.parse(fs.readFileSync(EINSTELLUNGEN_DATEI, 'utf8').replace(/^\uFEFF/, ''));
    for (const [k, v] of Object.entries(datei)) if (v !== '' && v !== null && !k.startsWith('_')) einstellungen[k] = v;
  } catch (e) {
    console.error(`\n⚠️  einstellungen.json hat einen Tippfehler (${e.message}). Ich nutze die Standardwerte.\n`);
  }
}
const PORT = Number(process.env.PORT) || einstellungen.port;

// Punkte pro Aktion. Kommentare sind das Wichtigste.
const PUNKTE = { kommentar: 1, follow: 5, teilen: 3, diamant: 1, likesProPunkt: 50, quiz: 5 };

// Ab wie vielen Punkten welches Gebäude. Index = Stufe.
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

// ---------------------------------------------------------------- Zustand
const einwohner = new Map(); // uniqueId -> Bewohner
let naechsterPlatz = 0;
const stats = { zuschauer: 0, likesGesamt: 0, status: 'startet', streamer: benutzer || 'demo' };
const spiel = {
  likeZiel: einstellungen.likeZielSchritt,
  likeBasis: 0,   // Like-Stand, bei dem das aktuelle Ziel begonnen hat
  rushBis: 0,
  quiz: null      // { frage, antworten, anzeige, bis, timer }
};

function laden() {
  if (NEU) return;
  try {
    const d = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
    for (const b of d.einwohner || []) {
      b.bonus ??= 0;
      b.punkte = punkteBerechnen(b);
      b.stufe = stufeFuer(b.punkte); // falls sich die Stufen geändert haben
      einwohner.set(b.id, b);
    }
    naechsterPlatz = d.naechsterPlatz || einwohner.size;
    console.log(`Stadt geladen: ${einwohner.size} Gebäude (zum Neuanfang mit --neu starten)`);
  } catch { /* noch keine Stadt */ }
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
    fs.writeFileSync(tmp, JSON.stringify({ naechsterPlatz, einwohner: [...einwohner.values()] }));
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
  return {
    stufe: STUFEN[stufe].name,
    punkte,
    naechste: naechste?.name || '',
    fehlen: naechste ? naechste.ab - punkte : 0
  };
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
      punkte: 0, stufe: 0, farbe: null,
      seit: Date.now(), zuletzt: Date.now(), letzterKommentarZeit: 0
    };
    einwohner.set(id, b);
    moderator.neuerBuerger(b);
  } else if (user.nickname) {
    b.name = user.nickname.slice(0, 24);
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
  return {
    likeZiel: spiel.likeZiel, likeBasis: spiel.likeBasis, likes: stats.likesGesamt,
    rushBis: spiel.rushBis,
    quiz: spiel.quiz ? { frage: spiel.quiz.frage, bis: spiel.quiz.bis } : null,
    jetzt: Date.now()
  };
}

function statsSenden() { senden({ t: 'stats', stats }); }
function spielSenden() { senden({ t: 'spiel', spiel: spielZustand() }); }

// ---------------------------------------------------------------- Bürgermeister
const kiSchluessel = process.env.ANTHROPIC_API_KEY || einstellungen.anthropicApiKey;
const moderator = erstelleModerator({
  name: einstellungen.moderatorName,
  senden,
  apiKey: kiSchluessel,
  modell: einstellungen.kiModell,
  stadt: () => {
    const top = [...einwohner.values()].sort((a, b) => b.punkte - a.punkte)[0];
    return {
      anzahl: einwohner.size, zuschauer: stats.zuschauer,
      top: top?.name || 'niemand', topStufe: top ? STUFEN[top.stufe].name : 'Papierhütte'
    };
  }
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    t: 'alles',
    stufen: STUFEN,
    einwohner: [...einwohner.values()].map(oeffentlich),
    stats, spiel: spielZustand(),
    moderator: { name: einstellungen.moderatorName, pausiert: moderator.pausiert, ki: !!kiSchluessel }
  }));
  ws.on('message', roh => {
    let m; try { m = JSON.parse(roh); } catch { return; }
    if (m.t !== 'regie') return;
    if (m.aktion === 'quiz') quizStarten();
    else if (m.aktion === 'rush') rushStarten(true);
    else if (m.aktion === 'feuerwerk') senden({ t: 'feuerwerk', staerke: 3 });
    else if (m.aktion === 'sagen' && typeof m.text === 'string') moderator.sag(m.text.slice(0, 300), 6);
    else if (m.aktion === 'pause') { moderator.pause(!!m.an); senden({ t: 'moderator', pausiert: moderator.pausiert }); }
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
  if (/^!\s*(hilfe|help|befehle)\b/i.test(t)) {
    moderator.sag('Schreib einfach im Chat, jeder Kommentar ist ein Punkt. Befehle: !haus, !top und !farbe mit einer Farbe.', 3);
  }

  ereignis(b, 'kommentar', t.slice(0, 120));
  if (!istBefehl) moderator.kommentar(b.name, t.slice(0, 200), infoVon(b));
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
  moderator.geschenk(b, anzahl > 1 ? `${anzahl} mal ${name}` : name);
  if (summe >= 30) senden({ t: 'feuerwerk', staerke: summe >= 300 ? 3 : 1 });
  ereignis(b, 'geschenk', `schenkt ${anzahl}× ${name}`);
}

// ---------------------------------------------------------------- Bau-Rush und Quiz
let rushTimer = null;
function rushStarten(ansagen) {
  spiel.rushBis = Date.now() + einstellungen.bauRushSekunden * 1000;
  console.log('🚧 Bau-Rush gestartet!');
  if (ansagen) moderator.sag(`Achtung, Bau-Rush! ${einstellungen.bauRushSekunden} Sekunden lang zählt jeder Kommentar doppelt. Schreibt, was das Zeug hält!`, 5);
  spielSenden();
  clearTimeout(rushTimer);
  rushTimer = setTimeout(() => {
    spielSenden();
    moderator.sag('Der Bau-Rush ist vorbei. Schaut mal, wie die Stadt gewachsen ist!', 2);
  }, einstellungen.bauRushSekunden * 1000 + 200);
}

const letzteFragen = [];
function quizStarten() {
  if (spiel.quiz) return;
  const frei = QUIZ.filter(q => !letzteFragen.includes(q.frage));
  const q = frei[Math.floor(Math.random() * frei.length)];
  letzteFragen.push(q.frage); if (letzteFragen.length > 25) letzteFragen.shift();
  spiel.quiz = { frage: q.frage, antworten: q.antworten, anzeige: q.antworten[0], bis: Date.now() + 40_000 };
  console.log(`❓ Quiz: ${q.frage} (Antwort: ${q.antworten[0]})`);
  moderator.sag(`Quiz-Zeit! Wer zuerst richtig antwortet, bekommt fünf Bonuspunkte. ${q.frage}`, 5);
  spielSenden();
  spiel.quiz.timer = setTimeout(() => {
    if (!spiel.quiz) return;
    const a = spiel.quiz.anzeige;
    spiel.quiz = null;
    moderator.sag(`Das wusste leider niemand! Die Antwort war: ${a}.`, 4);
    senden({ t: 'quizEnde', gewinner: null, antwort: a });
    spielSenden();
  }, 40_000);
}

function automatischeSpiele() {
  const istAktiv = () => stats.status === 'live' || stats.status === 'demo';
  if (einstellungen.quizAlleMinuten > 0) {
    setInterval(() => { if (istAktiv() && einwohner.size >= 2) quizStarten(); }, einstellungen.quizAlleMinuten * 60_000);
  }
  if (einstellungen.bauRushAlleMinuten > 0) {
    setInterval(() => { if (istAktiv() && !rushAktiv() && !spiel.quiz) rushStarten(true); }, einstellungen.bauRushAlleMinuten * 60_000);
  }
}

// ---------------------------------------------------------------- Verbindung zu TikTok
async function tiktokStarten() {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
  const verbindung = new TikTokLiveConnection(benutzer, { enableExtendedGiftInfo: true });
  let verbunden = false;
  let begruesst = false;

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
    if (typeof d.viewerCount === 'number') { stats.zuschauer = d.viewerCount; statsSenden(); }
  });
  verbindung.on(WebcastEvent.STREAM_END, () => {
    console.log('\n🔴 Der Live ist beendet. Die Stadt ist gespeichert.');
    stats.status = 'beendet'; statsSenden(); speichernJetzt();
  });
  verbindung.on(ControlEvent.DISCONNECTED, () => {
    if (!verbunden) return;
    verbunden = false;
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
      stats.status = 'live'; statsSenden();
      console.log(`\n✅ Verbunden mit dem Live von @${benutzer} (Raum ${zustand.roomId}). Ich lese jetzt alles mit!\n`);
      if (!begruesst) {
        begruesst = true;
        moderator.sag('Hallo zusammen! Ich bin der Bürgermeister dieser Stadt. Jeder von euch bekommt ein Haus. Schreibt in den Chat, dann wird es größer!', 5);
      }
    } catch (e) {
      const msg = e?.message || String(e);
      const offline = /offline|not.*live|isn.t live|LIVE has ended|Room ID/i.test(msg) || e?.constructor?.name === 'UserOfflineError';
      stats.status = offline ? 'wartet' : 'fehler'; statsSenden();
      console.log(offline
        ? `⏳ @${benutzer} ist (noch) nicht live – oder der Name ist falsch geschrieben. Neuer Versuch in 15 Sekunden …`
        : `❌ Verbindung fehlgeschlagen: ${msg}\n   Neuer Versuch in 15 Sekunden …`);
      setTimeout(verbinden, 15_000);
    }
  }
  verbinden();
}

// ---------------------------------------------------------------- Demo-Modus
function demoStarten() {
  stats.status = 'demo';
  const vornamen = ['Lena', 'Max', 'Mia', 'Ben', 'Emma', 'Paul', 'Lea', 'Finn', 'Sofia', 'Noah', 'Hannah', 'Elias', 'Emilia', 'Luis', 'Clara', 'Jonas', 'Ida', 'Leon', 'Marie', 'Felix', 'Ella', 'Anton', 'Lina', 'Theo', 'Nele', 'Karl', 'Zoe', 'Oskar', 'Frieda', 'Tim'];
  const saetze = ['Hallo!', 'Wie heißt die Stadt?', 'Mein Haus soll riesig werden', 'Bau mir einen Pool', 'hiii', 'Wo ist mein Haus?', 'Ich will die Riesen-Villa!', '!farbe pink', '!farbe blau', '!farbe mint', '!haus', 'lol', 'Grüße aus Berlin', 'mehr mehr mehr', '🔥🔥🔥', 'Bürgermeister, wie alt bist du?', 'Ich bin seit Anfang dabei!', 'Was ist das beste Haus?', '!top'];
  const leute = [];
  const genutzt = new Set();
  const neuePerson = () => {
    let v = vornamen[Math.floor(Math.random() * vornamen.length)];
    if (genutzt.has(v)) v += Math.floor(Math.random() * 90 + 10);
    genutzt.add(v);
    const u = { uniqueId: v.toLowerCase() + '_' + Math.floor(Math.random() * 1000), nickname: v };
    leute.push(u);
    return u;
  };
  for (let i = 0; i < 6; i++) beitritt(neuePerson());
  stats.zuschauer = 6;
  moderator.sag('Hallo zusammen! Ich bin der Bürgermeister dieser Stadt. Das hier ist ein Probelauf mit erfundenen Zuschauern.', 5);
  const tempo = Number(process.env.DEMO_TEMPO) || 900;
  setInterval(() => {
    const r = Math.random();
    const p = leute[Math.floor(Math.pow(Math.random(), 2.2) * leute.length)]; // ein paar Vielschreiber
    if (spiel.quiz && Math.random() < 0.08) return kommentar(p, spiel.quiz.antworten[0]);
    if (r < 0.14 && leute.length < 60) { beitritt(neuePerson()); stats.zuschauer++; statsSenden(); }
    else if (r < 0.80) kommentar(p, saetze[Math.floor(Math.random() * saetze.length)]);
    else if (r < 0.90) likes(p, 15 + Math.floor(Math.random() * 40), stats.likesGesamt + 25 + Math.floor(Math.random() * 40));
    else if (r < 0.95) folgen(p);
    else if (r < 0.97) teilen(p);
    else geschenk(p, ['Rose', 'Herz', 'Donut', 'Krone'][Math.floor(Math.random() * 4)], [1, 5, 30, 99][Math.floor(Math.random() * 4)], 1 + Math.floor(Math.random() * 3));
  }, tempo);
}

// ---------------------------------------------------------------- Los geht's
laden();
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

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { speichernJetzt(); console.log('\nStadt gespeichert. Tschüss!'); process.exit(0); });
}
