#!/usr/bin/env node
// node scripts/preview.js <episode-dir> [t1 t2 ...]  -> frames + contact sheet (<episode>/frames/sheet.jpg)
const path = require('path'), { execFileSync } = require('child_process');
const [ep, ...times] = process.argv.slice(2);
if (!ep) { console.error('usage: node scripts/preview.js <episode-dir> [t1 t2 ...]'); process.exit(1); }
execFileSync(process.execPath, [path.join(__dirname, 'render.js'), ep, 'preview', ...times], { stdio: 'inherit' });
