// Screenshottet alle HTML-Seiten aus html/jobs.json nach ../../marketing/bilder bzw. frames
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const dir = path.join(__dirname, 'html'); const jobs = JSON.parse(fs.readFileSync(path.join(dir, 'jobs.json')));
  const img = path.join(__dirname, '..', '..', 'marketing', 'bilder'); const fr = path.join(__dirname, 'frames');
  fs.mkdirSync(img, { recursive: true }); fs.mkdirSync(fr, { recursive: true });
  const b = await chromium.launch();
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.join(dir, j.name + '.html')); await p.waitForTimeout(150);
    const out = j.name.startsWith('v') ? path.join(fr, j.name + '.png') : path.join(img, j.name + '.png');
    await p.screenshot({ path: out }); await p.close();
  }
  await b.close(); console.log('fertig', jobs.length);
})();
