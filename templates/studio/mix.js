// PolyCast studio mix: voices (slightly panned per speaker) + lo-fi bed that ducks under dialogue
// + a UI "pop" whenever a card from scene.js CONFIG appears. Writes audio_mix.wav next to this file.
process.removeAllListeners('warning');   // scene.js is an ES module inside a CommonJS package: harmless notice
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const EP = __dirname, SR = 44100;

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(EP, 'timeline.json'), 'utf8'));
  const Ln = Object.fromEntries(tl.lines.map(l => [l.id, l]));
  const at = (c) => { if (!c) return null; const l = Ln[c[0]]; if (!l) return null; if (!c[1]) return l.start; const i = Math.max(0, l.text.toLowerCase().indexOf(c[1].toLowerCase())); return l.start + (l.end - l.start) * i / l.text.length; };
  let C = {}; try { C = (await import(pathToFileURL(path.join(EP, 'scene.js')).href)).CONFIG || {}; } catch (e) { /* no config: no pops */ }
  const N = Math.ceil(tl.duration * SR), Lc = new Float32Array(N), Rc = new Float32Array(N), voice = new Float32Array(N);
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  function readWav(f) { const b = fs.readFileSync(f); let o = 12; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'data') { const s = new Float32Array(sz / 2); for (let i = 0; i < s.length; i++) s[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return s; } o += 8 + sz + (sz & 1); } }
  const speakers = [...new Set(tl.lines.map(l => l.who))];
  for (const l of tl.lines) {
    const s = readWav(path.join(EP, 'vo', l.id + '.wav')), i0 = Math.round(l.start * SR);
    const p = speakers.length > 1 ? (speakers.indexOf(l.who) / (speakers.length - 1)) * 2 - 1 : 0, pan = [1 - Math.max(0, p) * 0.18, 1 + Math.min(0, p) * 0.18];
    s.forEach((v, i) => { if (i0 + i < N) { Lc[i0 + i] += v * pan[0]; Rc[i0 + i] += v * pan[1]; voice[i0 + i] = Math.max(voice[i0 + i], Math.abs(v)); } });
  }
  const duck = new Float32Array(N); { let e = 0; for (let i = 0; i < N; i++) { const target = voice[i] > 0.02 ? 1 : 0; e += (target - e) * (target > e ? 0.002 : 0.00004); duck[i] = e; } }
  // lo-fi bed: Fmaj7 - Em7 - Dm7 - Cmaj7 at 80 bpm, soft kick + hat
  const beat = 60 / 80, bar = beat * 4;
  const chords = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 164.8, 196, 246.9]];
  for (let i = 0; i < N; i++) {
    const t = i / SR, b = Math.floor(t / bar) % 4, tb = t % bar;
    let v = 0; for (const f of chords[b]) v += Math.sin(2 * Math.PI * f * t) * 0.6 + Math.sin(2 * Math.PI * f * 2.002 * t) * 0.12;
    v *= 0.018 * Math.min(1, tb / 0.08) * (0.75 + 0.25 * Math.exp(-tb * 1.2));
    const tk = t % beat, k = Math.floor(t / beat) % 4;
    if (k === 0 || k === 2) v += Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-tk * 30)) * tk) * Math.exp(-tk * 9) * 0.22;
    v += rnd() * Math.exp(-((t + beat / 2) % beat) * 60) * 0.025;
    const g = (1 - 0.6 * duck[i]) * Math.min(1, t / 1.5) * Math.min(1, (tl.duration - t) / 1.5);
    Lc[i] += v * g; Rc[i] += v * g * 0.95;
  }
  const pops = [...(C.cards || []).map(c => at(c[0]) - 0.2), C.topic?.sticker && at(C.topic.sticker.at), C.contact && at(C.contact.at), tl.duration - 1.5].filter(x => x != null && x > 0);
  for (const tp of pops) for (let k = 0; k < SR * 0.12; k++) { const t = k / SR, v = Math.sin(2 * Math.PI * (900 - 2500 * t) * t) * Math.exp(-t * 40) * 0.12, j = Math.round(tp * SR) + k; if (j < N) { Lc[j] += v; Rc[j] += v; } }
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  const sc = (x) => Math.tanh(x * 1.1) / 1.1;
  for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(sc(Lc[i]) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(sc(Rc[i]) * 32767), 46 + i * 4); }
  fs.writeFileSync(path.join(EP, 'audio_mix.wav'), buf); console.log('mix ok');
})().catch(e => { console.error(e); process.exit(1); });
