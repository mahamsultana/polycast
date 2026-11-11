#!/usr/bin/env node
// Fast sanity checks (no rendering): script syntax, template JSON, and that every scene cue points at a real line.
//   node scripts/check.js [episode-or-template-dir ...]   (default: all templates)
process.removeAllListeners('warning');   // scene.js is an ES module inside a CommonJS package: harmless notice
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..'); let fail = 0;
const bad = (m) => { console.log('✗ ' + m); fail++; }, good = (m) => console.log('✓ ' + m);

(async () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, 'scripts', f)], { encoding: 'utf8' });
    r.status === 0 ? good('scripts/' + f) : bad(`scripts/${f}\n${r.stderr}`);
  }
  const dirs = process.argv.slice(2).length ? process.argv.slice(2).map(d => path.resolve(d))
    : fs.readdirSync(path.join(ROOT, 'templates')).map(d => path.join(ROOT, 'templates', d));
  for (const dir of dirs) {
    const name = path.relative(ROOT, dir) || dir;
    let lines;
    try { lines = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8')); } catch (e) { bad(`${name}/lines.json: ${e.message}`); continue; }
    const ids = new Set(), who = new Set(Object.keys(lines.voices || {}));
    for (const l of lines.lines || []) {
      if (!l.id || !l.who || !l.text) bad(`${name}: line missing id/who/text: ${JSON.stringify(l)}`);
      if (ids.has(l.id)) bad(`${name}: duplicate line id ${l.id}`); ids.add(l.id);
      if (!who.has(l.who)) bad(`${name}: line ${l.id} uses voice "${l.who}" not defined in voices`);
    }
    for (const [k, v] of Object.entries(lines.voices || {})) if (!v.cartesia?.id && !v.system) bad(`${name}: voice "${k}" has neither cartesia.id nor system`);
    good(`${name}/lines.json (${ids.size} lines)`);
    let mod;
    try { mod = await import(pathToFileURL(path.join(dir, 'scene.js')).href); } catch (e) { bad(`${name}/scene.js: ${e.message}`); continue; }
    if (typeof mod.setup !== 'function') { bad(`${name}/scene.js: no exported setup()`); continue; }
    const C = mod.CONFIG;
    if (C) {
      const cues = [];
      const walk = (x) => { if (Array.isArray(x)) { if (typeof x[0] === 'string' && ids.has(x[0]) || (typeof x[0] === 'string' && /^[a-z]\d\d$/i.test(x[0]) && x.length <= 2)) cues.push(x); else x.forEach(walk); } else if (x && typeof x === 'object') Object.values(x).forEach(walk); };
      walk(C);
      const missing = cues.filter(c => !ids.has(c[0]));
      missing.length ? bad(`${name}/scene.js: cues point at unknown lines: ${missing.map(c => c.join(':')).join(', ')}`) : good(`${name}/scene.js CONFIG (${cues.length} cues)`);
      const imgs = [...(C.monitors || [])].flatMap(m => [m[1], m[2]]).filter(s => typeof s === 'string' && s.startsWith('img:'));
      for (const s of imgs) if (!fs.existsSync(path.join(dir, 'img', s.slice(4)))) bad(`${name}: monitor image missing: img/${s.slice(4)}`);
    } else good(`${name}/scene.js (no CONFIG block)`);
  }
  console.log(fail ? `\n${fail} problem(s)` : '\nall good');
  process.exit(fail ? 1 : 0);
})();
