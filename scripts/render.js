#!/usr/bin/env node
// PolyCast renderer: three.js inside headless Chrome, frame by frame, piped to ffmpeg.
//
//   node scripts/render.js <episode-dir> preview 2 8.5 20 31   -> <episode>/frames/prev_*.jpg + sheet.jpg
//   node scripts/render.js <episode-dir> video                 -> <episode>/video.mp4 (silent)
//   MODE=loop node scripts/render.js <episode-dir> video       -> <episode>/video_loop.mp4 (scene decides)
// The episode can live anywhere; it is served at /ep/, the toolkit at /.
//
// Env: CHROME_PATH to point at a Chrome/Chromium/Edge binary if auto-detect fails. FPS (default 30).
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const FPS = +(process.env.FPS || 30);
const epArg = process.argv[2];
if (!epArg) { console.error('usage: node scripts/render.js <episode-dir> preview|video [times...]'); process.exit(1); }
const epAbs = path.resolve(epArg);
const ep = path.basename(epAbs);
const mode = process.argv[3] || 'video';
const VMODE = process.env.MODE || '';

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const c = {
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  }[process.platform] || [];
  const hit = c.find(p => p && fs.existsSync(p));
  if (!hit) { console.error('Chrome not found. Install Chrome or set CHROME_PATH=/path/to/chrome'); process.exit(1); }
  return hit;
}

// ---- per-speaker mouth envelopes from the voice files (one value per frame)
function readWav(f) {
  const b = fs.readFileSync(f); let o = 12, sr = 44100, ch = 1;
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
    if (id === 'data') { const n = Math.floor(sz / 2 / ch), s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = b.readInt16LE(o + 8 + i * 2 * ch) / 32768; return { sr, s }; }
    o += 8 + sz + (sz & 1);
  }
  throw new Error('bad wav ' + f);
}
const tlPath = path.join(epAbs, 'timeline.json');
if (!fs.existsSync(tlPath)) { console.error(`No timeline.json in ${epArg}. Run: node scripts/voice.js ${epArg}`); process.exit(1); }
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const NF = Math.ceil(tl.duration * FPS) + 2, env = {};
for (const ln of tl.lines) {
  const { sr, s } = readWav(path.join(epAbs, 'vo', ln.id + '.wav'));
  const arr = env[ln.who] || (env[ln.who] = new Array(NF).fill(0));
  const win = Math.round(sr / FPS); let peak = 1e-6; const vals = [];
  for (let k = 0; k * win < s.length; k++) { let e = 0; for (let i = k * win; i < Math.min(s.length, (k + 1) * win); i++) e += s[i] * s[i]; const r = Math.sqrt(e / win); vals.push(r); peak = Math.max(peak, r); }
  vals.forEach((v, k) => { const f = Math.round(ln.start * FPS) + k; if (f < NF) arr[f] = Math.min(1, Math.pow(v / peak, 0.7) * 1.1); });
}
fs.writeFileSync(path.join(epAbs, 'env.json'), JSON.stringify(Object.fromEntries(Object.entries(env).map(([k, a]) => [k, a.map(v => +v.toFixed(3))]))));

// ---- tiny static server rooted at the repo
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const base = u.startsWith('/ep/') ? epAbs : ROOT, f = path.join(base, u.startsWith('/ep/') ? u.slice(4) : u);
  if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1');

(async () => {
  await new Promise(r => srv.on('listening', r));
  const gpuArgs = process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader'];
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: [...gpuArgs, '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if (!/Failed to load resource/.test(m.text())) console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`http://127.0.0.1:${srv.address().port}/engine/page.html${VMODE ? '?mode=' + VMODE : ''}`);
  await page.waitForFunction('window.__ready || window.__error', { timeout: 120000 });
  const err = await page.evaluate('window.__error'); if (err) throw new Error(err);
  const dur = await page.evaluate('window.__duration');
  const grab = async (t) => Buffer.from((await page.evaluate(`renderFrame(${t})`)).split(',')[1], 'base64');

  if (mode === 'preview') {
    const dir = path.join(epAbs, 'frames'); fs.mkdirSync(dir, { recursive: true });
    const times = process.argv.slice(4).map(Number);
    if (!times.length) times.push(...[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map(f => +(f * dur).toFixed(2)));
    const files = [];
    for (const t of times) { const f = path.join(dir, `prev_${VMODE}${t.toFixed(2)}.jpg`); fs.writeFileSync(f, await grab(t)); files.push(f); console.log('frame', t); }
    // contact sheet (4 per row; tile pads the last row)
    const seq = path.join(dir, '_sheet_%02d.jpg');
    files.forEach((f, i) => fs.copyFileSync(f, path.join(dir, `_sheet_${String(i).padStart(2, '0')}.jpg`)));
    const cols = Math.min(4, files.length), rows = Math.ceil(files.length / cols);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', seq, '-vf', `scale=480:-2,tile=${cols}x${rows}`, '-frames:v', '1', path.join(dir, 'sheet.jpg')], { stdio: 'inherit' });
    files.forEach((_, i) => fs.unlinkSync(path.join(dir, `_sheet_${String(i).padStart(2, '0')}.jpg`)));
    console.log('sheet ->', path.join(epAbs, 'frames', 'sheet.jpg'));
  } else {
    const out = path.join(epAbs, VMODE ? `video_${VMODE}.mp4` : 'video.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * FPS), t0 = Date.now();
    for (let f = 0; f < n; f++) {
      const buf = await grab(f / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 90 === 0) console.log(`frame ${f}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log('wrote', out);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
