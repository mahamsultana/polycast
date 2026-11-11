#!/usr/bin/env node
// PolyCast voices: one audio file per script line + timeline.json.
//
//   node scripts/voice.js <episode-dir>            generate (cached per line)
//   node scripts/voice.js <episode-dir> --verify   + transcribe every line back (needs a Cartesia key)
//   node scripts/voice.js --list-system            show the free voices installed on this computer
//
// Providers ("provider" in lines.json, or POLYCAST_VOICE env):
//   auto      Cartesia if CARTESIA_API_KEY is set, otherwise the free system voice   (default)
//   cartesia  https://cartesia.ai  (studio quality; needs a key)
//   system    free, offline: Windows SAPI (Zira/David), macOS `say`, Linux `espeak-ng`
// Delete vo/<id>_raw.wav (or set FORCE=1) to regenerate a line.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');

function apiKey() {
  if (process.env.CARTESIA_API_KEY) return process.env.CARTESIA_API_KEY.trim();
  for (const f of [path.join(process.cwd(), '.env'), path.join(ROOT, '.env')]) {
    if (fs.existsSync(f)) { const m = fs.readFileSync(f, 'utf8').match(/^\s*CARTESIA_API_KEY\s*=\s*(.+?)\s*$/m); if (m && m[1]) return m[1].replace(/^["']|["']$/g, ''); }
  }
  return '';
}

// ---------------------------------------------------------------- free system voices
function systemVoices() {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | % { $_.VoiceInfo.Name + ' | ' + $_.VoiceInfo.Gender }"], { encoding: 'utf8' });
    return r.stdout.trim();
  }
  if (process.platform === 'darwin') return spawnSync('say', ['-v', '?'], { encoding: 'utf8' }).stdout.split('\n').filter(l => /en_/.test(l)).join('\n');
  const r = spawnSync('espeak-ng', ['--voices=en'], { encoding: 'utf8' });
  return r.error ? 'espeak-ng not found: sudo apt install espeak-ng' : r.stdout;
}
function systemTTS(text, v, outWav) {
  const sys = v.system || {}, female = (sys.gender || 'female') === 'female', speed = sys.speed ?? 1;
  const tmp = path.join(os.tmpdir(), `polycast_${process.pid}_${Date.now()}`);
  if (process.platform === 'win32') {
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      if ($env:PC_NAME) { $s.SelectVoice($env:PC_NAME) } else { $s.SelectVoiceByHints($env:PC_GENDER) };
      $s.Rate = [int]$env:PC_RATE; $s.SetOutputToWaveFile($env:PC_OUT); $s.Speak($env:PC_TEXT); $s.Dispose()`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { env: { ...process.env, PC_TEXT: text, PC_OUT: tmp + '.wav',
      PC_NAME: sys.name || '', PC_GENDER: female ? 'Female' : 'Male', PC_RATE: String(Math.round((speed - 1) * 10)) }, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('Windows TTS failed: ' + r.stderr);
    fs.renameSync(tmp + '.wav', outWav + '.src.wav');
  } else if (process.platform === 'darwin') {
    const name = sys.name || (female ? 'Samantha' : 'Daniel');
    const r = spawnSync('say', ['-v', name, '-r', String(Math.round(180 * speed)), '-o', tmp + '.aiff', text]);
    if (r.status !== 0) throw new Error('macOS say failed (voice "' + name + '")');
    fs.renameSync(tmp + '.aiff', outWav + '.src.wav');
  } else {
    const r = spawnSync('espeak-ng', ['-v', sys.name || (female ? 'en-us+f3' : 'en-us+m3'), '-s', String(Math.round(165 * speed)), '-w', tmp + '.wav', text]);
    if (r.error) throw new Error('No system TTS found. Install it: sudo apt install espeak-ng (or set a CARTESIA_API_KEY)');
    fs.renameSync(tmp + '.wav', outWav + '.src.wav');
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', outWav + '.src.wav', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
  fs.unlinkSync(outWav + '.src.wav');
}

// ---------------------------------------------------------------- Cartesia
async function cartesiaTTS(key, cfg, text, v, outWav) {
  const c = v.cartesia || {};
  if (!c.id) throw new Error('voice has no cartesia.id');
  const gen = { speed: c.speed ?? 1, volume: 1.0 }; if (c.emotion) gen.emotion = c.emotion;
  const r = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST', headers: { 'X-API-Key': key, 'Cartesia-Version': '2025-04-16', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: cfg.model || 'sonic-3', transcript: text, language: cfg.language || 'en', voice: { mode: 'id', id: c.id },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 }, generation_config: gen }),
  });
  if (!r.ok) throw new Error(`Cartesia ${r.status}: ${await r.text()}`);
  fs.writeFileSync(outWav, Buffer.from(await r.arrayBuffer()));
}
async function stt(key, file, lang) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/wav' }), path.basename(file));
  fd.append('model', 'ink-whisper'); fd.append('language', lang || 'en');
  const r = await fetch('https://api.cartesia.ai/stt', { method: 'POST', headers: { 'X-API-Key': key, 'Cartesia-Version': '2025-04-16' }, body: fd });
  return r.ok ? ((await r.json()).text || '') : `(stt error ${r.status})`;
}

// ---------------------------------------------------------------- effects (e.g. make the orb sound like a robot)
const FX = {
  robot: 'asetrate=44100*0.9,aresample=44100,atempo=1.1111,aecho=0.8:0.55:7:0.35',
  radio: 'highpass=f=350,lowpass=f=3200,aecho=0.8:0.4:170:0.3',
  deep: 'asetrate=44100*0.88,aresample=44100,atempo=1.136',
};

// ---------------------------------------------------------------- main
(async () => {
  if (process.argv[2] === '--list-system') { console.log(systemVoices()); return; }
  const epArg = process.argv[2];
  if (!epArg) { console.error('usage: node scripts/voice.js <episode-dir> [--verify] | --list-system'); process.exit(1); }
  const ep = path.resolve(epArg), VERIFY = process.argv.includes('--verify');
  const cfg = JSON.parse(fs.readFileSync(path.join(ep, 'lines.json'), 'utf8'));
  const key = apiKey();
  let provider = process.env.POLYCAST_VOICE || cfg.provider || 'auto';
  if (provider === 'auto') provider = key ? 'cartesia' : 'system';
  if (provider === 'cartesia' && !key) { console.error('provider "cartesia" needs CARTESIA_API_KEY (or use "system" for free voices)'); process.exit(1); }
  console.log(`voices: ${provider === 'cartesia' ? 'Cartesia' : 'free system TTS (' + process.platform + ')'}`);
  const stamp = path.join(ep, 'vo', '.provider');
  fs.mkdirSync(path.join(ep, 'vo'), { recursive: true });
  const force = process.env.FORCE || (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') !== provider);
  fs.writeFileSync(stamp, provider);

  let t = cfg.lead ?? 0.3; const out = [];
  for (const line of cfg.lines) {
    const v = cfg.voices[line.who]; if (!v) throw new Error(`line ${line.id}: no voice "${line.who}" in lines.json`);
    const raw = path.join(ep, 'vo', `${line.id}_raw.wav`), f = path.join(ep, 'vo', `${line.id}.wav`);
    if (!fs.existsSync(raw) || force) {
      const spoken = line.say || line.text;   // optional "say": how to pronounce it (captions keep "text")
      if (provider === 'cartesia') await cartesiaTTS(key, cfg, spoken, v, raw); else systemTTS(spoken, v, raw);
    }
    const fx = v.fx ? (FX[v.fx] || v.fx) + ',' : '';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      fx + 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,aformat=sample_rates=44100:channel_layouts=mono', f]);
    const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
    out.push({ id: line.id, who: line.who, text: line.text, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    console.log(`${line.id.padEnd(5)} ${line.who.padEnd(6)} ${t.toFixed(2).padStart(6)} ${(t + d).toFixed(2).padStart(6)}  ${line.text}`);
    t += d + (line.after ?? 0.3);
  }
  fs.writeFileSync(path.join(ep, 'timeline.json'), JSON.stringify({ duration: +t.toFixed(3), lines: out }, null, 1));
  console.log(`total ${t.toFixed(2)}s`);

  if (VERIFY) {
    if (!key) { console.log('\n--verify needs a Cartesia key (speech-to-text); skipped.'); return; }
    console.log('\nverifying with speech-to-text...');
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    let bad = 0;
    for (const l of out) {
      const heard = await stt(key, path.join(ep, 'vo', l.id + '.wav'), cfg.language);
      const a = norm(cfg.lines.find(x => x.id === l.id).say || l.text).split(' '), b = new Set(norm(heard).split(' '));
      const miss = a.filter(w => !b.has(w) && !/^\d/.test(w)), flag = miss.length > Math.max(1, a.length * 0.25);
      if (flag) bad++; console.log(`${l.id}: ${heard}${flag ? '   <-- CHECK' : ''}`);
    }
    console.log(bad ? `\n${bad} line(s) may be clipped. Reword them, delete vo/<id>_raw.wav, rerun.` : '\nall lines OK');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
