#!/usr/bin/env node
// Check (and fix) everything PolyCast needs: node deps, ffmpeg, Chrome, a voice.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); let ok = true;
const has = (cmd, args = ['-version']) => !spawnSync(cmd, args, { encoding: 'utf8' }).error;
const say = (good, msg, fix) => { console.log(`${good ? '✓' : '✗'} ${msg}${good || !fix ? '' : '\n    → ' + fix}`); if (!good) ok = false; };
say(+process.versions.node.split('.')[0] >= 18, `Node ${process.versions.node}`, 'install Node 18+ from https://nodejs.org');
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'three'))) {
  console.log('… installing node packages (no browser download)');
  spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' } });
}
say(fs.existsSync(path.join(ROOT, 'node_modules', 'three')), 'node packages (three, puppeteer-core)', `cd "${ROOT}" && npm install`);
say(has('ffmpeg') && has('ffprobe'), 'ffmpeg + ffprobe', 'Windows: winget install ffmpeg · macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg');
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
say(!!chrome, `browser: ${chrome || 'not found'}`, 'install Google Chrome, or set CHROME_PATH');
let key = process.env.CARTESIA_API_KEY;
for (const f of [path.join(process.cwd(), '.env'), path.join(ROOT, '.env')]) if (!key && fs.existsSync(f)) key = (fs.readFileSync(f, 'utf8').match(/^\s*CARTESIA_API_KEY\s*=\s*(\S+)/m) || [])[1];
const sys = process.platform === 'win32' || process.platform === 'darwin' || has('espeak-ng', ['--version']);
console.log(`${key ? '✓ voices: Cartesia key found (studio quality)' : sys ? '✓ voices: free system TTS (add CARTESIA_API_KEY in .env for studio voices)' : '✗ voices: no Cartesia key and no espeak-ng'}`);
if (!key && !sys) { ok = false; console.log('    → sudo apt install espeak-ng   or put CARTESIA_API_KEY=... in .env'); }
console.log(ok ? '\nPolyCast is ready.' : '\nFix the ✗ items above, then run this again.');
process.exit(ok ? 0 : 1);
