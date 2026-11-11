#!/usr/bin/env node
// Create a new PolyCast episode folder from a template (it can live anywhere):
//   node scripts/new.js <episode-dir> [studio|retro-horror]
const fs = require('fs'), path = require('path');
const [dir, tpl = 'studio'] = process.argv.slice(2);
if (!dir) { console.error('usage: node scripts/new.js <episode-dir> [studio|retro-horror]'); process.exit(1); }
const ROOT = path.resolve(__dirname, '..'), src = path.join(ROOT, 'templates', tpl), dst = path.resolve(dir);
if (!fs.existsSync(src)) { console.error(`no template "${tpl}". Available: ${fs.readdirSync(path.join(ROOT, 'templates')).join(', ')}`); process.exit(1); }
if (fs.existsSync(dst) && fs.readdirSync(dst).length) { console.error(dst + ' already exists and is not empty'); process.exit(1); }
(function copy(a, b) { fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d); } })(src, dst);
const T = path.relative(process.cwd(), path.join(ROOT, 'scripts')) || '.';
console.log(`created ${dst} from template "${tpl}"
next:
  1. write the script:   ${path.join(dst, 'lines.json')}
  2. voices:             node ${T}/voice.js "${dst}"          (free system voice, or Cartesia if CARTESIA_API_KEY is set)
  3. direct the scene:   ${path.join(dst, 'scene.js')}  (CONFIG block at the top)
  4. preview:            node ${T}/preview.js "${dst}"
  5. build the mp4:      node ${T}/build.js "${dst}"`);
