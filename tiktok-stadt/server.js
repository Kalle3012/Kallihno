// TikTok-Stadt – jeder Zuschauer bekommt ein Haus, jeder Kommentar lässt es wachsen.
//
//   npm start -- deinTikTokName        echte Verbindung zu deinem Live
//   npm run demo                       Probelauf mit erfundenen Zuschauern
//   npm start -- deinTikTokName --neu  Stadt leeren und neu anfangen
//
// Danach im Browser öffnen: http://localhost:3000

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// ---------------------------------------------------------------- Einstellungen
const PORT = Number(process.env.PORT) || 3000;

// Punkte pro Aktion. Kommentare sind das Wichtigste.
const PUNKTE = {
  kommentar: 1,
  follow: 5,
  teilen: 3,
  diamant: 1,      // pro Diamant eines Geschenks (Rose = 1 Diamant = 1 Punkt)
  likesProPunkt: 50 // je 50 Likes = 1 Punkt
};
// Ein Kommentar zählt höchstens alle X Sekunden pro Person (gegen Spam-Fluten).
const KOMMENTAR_PAUSE_SEK = 2;

// Ab wie vielen Punkten welches Gebäude. Index = Stufe.
const STUFEN = [
  { ab: 0,   name: 'Grundstück' },
  { ab: 1,   name: 'Hütte' },
  { ab: 3,   name: 'Häuschen' },
  { ab: 6,   name: 'Haus' },
  { ab: 10,  name: 'Villa' },
  { ab: 16,  name: 'Stadthaus' },
  { ab: 25,  name: 'Mehrfamilienhaus' },
  { ab: 40,  name: 'Bürogebäude' },
  { ab: 60,  name: 'Hochhaus' },
  { ab: 90,  name: 'Wolkenkratzer' },
  { ab: 130, name: 'Fernsehturm' },
  { ab: 200, name: 'Mega-Tower' }
];

// ---------------------------------------------------------------- Start-Argumente
const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const NEU = args.includes('--neu');
const benutzer = (args.find(a => !a.startsWith('--')) || process.env.TIKTOK_USER || '')
  .replace(/^https?:\/\/(www\.)?tiktok\.com\//, '')
  .replace(/^@/, '')
  .replace(/\/live.*$/, '')
  .trim();

if (!DEMO && !benutzer) {
  console.log('\nBitte deinen TikTok-Namen angeben, z. B.:  npm start -- kallihno');
  console.log('Oder zum Testen:                           npm run demo\n');
  process.exit(1);
}

const hier = path.dirname(fileURLToPath(import.meta.url));
const DATEN_DIR = path.join(hier, 'data');
const DATEI = path.join(DATEN_DIR, DEMO ? 'stadt-demo.json' : 'stadt.json');

// ---------------------------------------------------------------- Zustand
let einwohner = new Map(); // uniqueId -> Bewohner
let naechsterPlatz = 0;
const stats = { zuschauer: 0, likesGesamt: 0, status: 'startet', streamer: benutzer || 'demo' };

function laden() {
  if (NEU) return;
  try {
    const d = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
    for (const b of d.einwohner || []) einwohner.set(b.id, b);
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
    + Math.floor(b.likes / PUNKTE.likesProPunkt);
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
      kommentare: 0, likes: 0, diamanten: 0, geteilt: 0, folgt: false,
      punkte: 0, stufe: 0, farbe: null,
      seit: Date.now(), zuletzt: Date.now(), letzterKommentarZeit: 0
    };
    einwohner.set(id, b);
  } else if (user.nickname) {
    b.name = user.nickname.slice(0, 24);
  }
  return b;
}

// ---------------------------------------------------------------- Webserver + Live-Verbindung zum Overlay
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let datei = url.pathname === '/' ? '/index.html' : url.pathname;
  const voll = path.join(hier, 'public', path.normalize(datei).replace(/^(\.\.[/\\])+/, ''));
  if (!voll.startsWith(path.join(hier, 'public'))) { res.writeHead(403); return res.end(); }
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
wss.on('connection', ws => {
  ws.send(JSON.stringify({
    t: 'alles',
    stufen: STUFEN.map(s => s.name),
    einwohner: [...einwohner.values()].map(oeffentlich),
    stats
  }));
});

function statsSenden() { senden({ t: 'stats', stats }); }

// Kernfunktion: etwas ist passiert -> Punkte neu, Stufe neu, ans Overlay schicken.
function ereignis(user, art, text) {
  const b = bewohnerHolen(user);
  if (!b) return;
  const alteStufe = b.stufe;
  b.punkte = punkteBerechnen(b);
  b.stufe = stufeFuer(b.punkte);
  b.zuletzt = Date.now();
  const aufstieg = b.stufe > alteStufe;
  senden({ t: 'bewohner', b: oeffentlich(b), art, text, aufstieg });
  if (aufstieg) {
    console.log(`  ⬆️  ${b.name} hat jetzt: ${STUFEN[b.stufe].name} (${b.punkte} ${b.punkte === 1 ? "Punkt" : "Punkte"})`);
  }
  speichern();
}

// Chat-Befehl: "!farbe rot" färbt das eigene Haus.
const FARBEN = {
  rot: '#e74c3c', blau: '#3498db', gruen: '#2ecc71', grün: '#2ecc71', gelb: '#f1c40f',
  lila: '#9b59b6', pink: '#ff6fb5', rosa: '#ff9ccf', orange: '#e67e22', schwarz: '#2d3436',
  weiss: '#f5f6fa', weiß: '#f5f6fa', tuerkis: '#1abc9c', türkis: '#1abc9c', braun: '#8d6e63',
  grau: '#95a5a6', gold: '#f5c542'
};

function kommentar(user, text) {
  const b = bewohnerHolen(user);
  if (!b) return;
  console.log(`💬 ${b.name}: ${text}`);
  const m = /^!\s*farbe\s+(\S+)/i.exec(text.trim());
  if (m && FARBEN[m[1].toLowerCase()]) b.farbe = FARBEN[m[1].toLowerCase()];
  const jetzt = Date.now();
  if (jetzt - b.letzterKommentarZeit >= KOMMENTAR_PAUSE_SEK * 1000) {
    b.kommentare++;
    b.letzterKommentarZeit = jetzt;
  }
  ereignis(user, 'kommentar', text.slice(0, 120));
}

function beitritt(user) {
  const id = user?.uniqueId;
  if (!id) return;
  const kannteIch = einwohner.has(id);
  const b = bewohnerHolen(user);
  if (!kannteIch) console.log(`👋 ${b.name} ist da – bekommt ein Grundstück`);
  ereignis(user, 'beitritt', kannteIch ? 'ist wieder da' : 'ist neu in der Stadt');
}

function folgen(user) {
  const b = bewohnerHolen(user);
  if (!b) return;
  console.log(`❤️  ${b.name} folgt dir jetzt!`);
  b.folgt = true;
  ereignis(user, 'follow', 'folgt jetzt!');
}

function teilen(user) {
  const b = bewohnerHolen(user);
  if (!b) return;
  console.log(`🔁 ${b.name} hat den Live geteilt`);
  b.geteilt++;
  ereignis(user, 'teilen', 'hat den Live geteilt');
}

function likes(user, anzahl, gesamt) {
  const b = bewohnerHolen(user);
  if (!b) return;
  b.likes += anzahl || 0;
  if (gesamt) stats.likesGesamt = gesamt;
  ereignis(user, 'like', `${anzahl} Likes`);
}

function geschenk(user, name, diamanten, anzahl) {
  const b = bewohnerHolen(user);
  if (!b) return;
  const summe = (diamanten || 1) * (anzahl || 1);
  console.log(`🎁 ${b.name} schenkt ${anzahl}× ${name} (${summe} Diamanten)`);
  b.diamanten += summe;
  ereignis(user, 'geschenk', `schenkt ${anzahl}× ${name}`);
}

// ---------------------------------------------------------------- Verbindung zu TikTok
async function tiktokStarten() {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
  const verbindung = new TikTokLiveConnection(benutzer, { enableExtendedGiftInfo: true });
  let verbunden = false;

  verbindung.on(WebcastEvent.CHAT, d => d.comment && kommentar(d.user, d.comment));
  verbindung.on(WebcastEvent.MEMBER, d => {
    beitritt(d.user);
    if (d.memberCount) { stats.zuschauer = d.memberCount; statsSenden(); }
  });
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
  const enden = ['', '_xx', '2009', '.official', '_gaming', 'chen', '_123', '.tiktok', '_live', 'ito'];
  const saetze = ['Hallo!', 'Wie heißt die Stadt?', 'Mein Haus soll riesig werden 😂', 'Bau mir ein Schloss', 'hiii', 'Wo ist mein Haus?', 'Ich will das höchste Haus!', '!farbe pink', '!farbe blau', '!farbe gold', 'lol', 'Grüße aus Berlin', 'mehr mehr mehr', '🔥🔥🔥', 'Ich bin hier seit Anfang!'];
  const leute = [];
  const neuePerson = () => {
    const v = vornamen[Math.floor(Math.random() * vornamen.length)];
    const id = (v + enden[Math.floor(Math.random() * enden.length)]).toLowerCase() + Math.floor(Math.random() * 100);
    const u = { uniqueId: id, nickname: v };
    leute.push(u);
    return u;
  };
  for (let i = 0; i < 6; i++) beitritt(neuePerson());
  stats.zuschauer = 6;
  setInterval(() => {
    const r = Math.random();
    // Ein paar Vielschreiber, damit man das Wachsen sieht
    const p = leute[Math.floor(Math.pow(Math.random(), 2.2) * leute.length)];
    if (r < 0.18 && leute.length < 80) { beitritt(neuePerson()); stats.zuschauer++; statsSenden(); }
    else if (r < 0.80) kommentar(p, saetze[Math.floor(Math.random() * saetze.length)]);
    else if (r < 0.87) likes(p, 15 + Math.floor(Math.random() * 40), stats.likesGesamt + 30);
    else if (r < 0.93) folgen(p);
    else if (r < 0.96) teilen(p);
    else geschenk(p, ['Rose', 'Herz', 'Donut', 'Krone'][Math.floor(Math.random() * 4)], [1, 5, 30, 99][Math.floor(Math.random() * 4)], 1 + Math.floor(Math.random() * 3));
  }, Number(process.env.DEMO_TEMPO) || 700);
}

// ---------------------------------------------------------------- Los geht's
laden();
server.listen(PORT, () => {
  console.log('\n🏙️  TikTok-Stadt läuft!');
  console.log(`   Overlay im Browser:  http://localhost:${PORT}`);
  console.log(`   Durchsichtig (OBS):  http://localhost:${PORT}/?durchsichtig=1\n`);
  if (DEMO) { console.log('   DEMO-MODUS: erfundene Zuschauer\n'); demoStarten(); }
  else tiktokStarten().catch(e => { console.error('Konnte TikTok-Bibliothek nicht laden. Hast du "npm install" ausgeführt?\n', e.message); });
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { speichernJetzt(); console.log('\nStadt gespeichert. Tschüss!'); process.exit(0); });
}
