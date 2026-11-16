// Nimmt public/werbung.html Bild für Bild auf und baut daraus ein TikTok-Video (1080 × 1920, 30 fps, ohne Ton).
// Aufruf:  node werbung/video-bauen.cjs [ziel.mp4]
// Braucht: Playwright mit Chromium und ffmpeg.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const PUBLIC = path.join(__dirname, '..', 'public');
const ZIEL = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'marketing', 'videos', 'live-ankuendigung.mp4'));
const FPS = 30;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const datei = path.join(PUBLIC, p === '/' ? 'index.html' : path.normalize(p));
  if (!datei.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  });
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const bilder = fs.mkdtempSync(path.join(os.tmpdir(), 'werbung-'));
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await seite.clock.install({ time: new Date('2026-11-16T12:00:00') }); // feste Zeit: jedes Bild genau 1/30 s
  await seite.goto(`http://127.0.0.1:${port}/werbung.html`);
  await seite.waitForFunction(() => window.geladen && document.getElementById('stadt').contentWindow.film);
  await seite.waitForTimeout(800);                // Schriften laden lassen
  // Uhr anhalten: ab jetzt läuft die Zeit nur noch, wenn wir sie Bild für Bild weiterstellen
  const jetzt = await seite.evaluate(() => Date.now());
  await seite.clock.pauseAt(jetzt + 1000);
  await seite.evaluate(() => window.los());
  const dauer = await seite.evaluate(() => window.DAUER);
  const anzahl = Math.round(dauer * FPS);
  for (let i = 0; i < anzahl; i++) {
    await seite.clock.runFor(1000 / FPS);
    await seite.screenshot({ path: path.join(bilder, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 90 === 0) console.log(`Bild ${i} / ${anzahl}`);
  }
  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(bilder, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ZIEL], { stdio: 'inherit' });
  fs.rmSync(bilder, { recursive: true, force: true });
  console.log('Fertig:', ZIEL);
})().catch(e => { console.error(e); process.exit(1); });
