// Sound design + voice mix for Route 9. Writes audio_mix.wav (stereo 44.1k, before loudnorm).
// usage: node episodes/route9/mix.js
const fs = require('fs'), path = require('path');
const EP = __dirname, SR = 44100;
const tl = JSON.parse(fs.readFileSync(path.join(EP, 'timeline.json'), 'utf8'));
const Ln = Object.fromEntries(tl.lines.map(l => [l.id, l]));
const cut = (a, b) => (Ln[a].end + Ln[b].start) / 2;
const STOP = Ln.l05.end + 0.9, THUD = [Ln.l05.end + 0.15, Ln.l05.end + 0.5];
const RADIO_ON = Ln.l07.start + 1.25, WHISPER_END = cut('l08', 'l09');
const REVEAL = Ln.l11.end + 0.5, SMASH = Ln.l12.start - 0.55, END = Ln.l12.start - 0.4;
const N = Math.ceil(tl.duration * SR), Lc = new Float32Array(N), Rc = new Float32Array(N);
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const add = (i, l, r = l) => { if (i >= 0 && i < N) { Lc[i] += l; Rc[i] += r; } };
const env = (t, a, b, fi = 0.3, fo = 0.3) => t < a || t > b ? 0 : Math.min(1, (t - a) / fi, (b - t) / fo);

function readWav(f) {
  const b = fs.readFileSync(f); let o = 12;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'data') { const s = new Float32Array(sz / 2); for (let i = 0; i < s.length; i++) s[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return s; }
    o += 8 + sz + (sz & 1); }
}
// one-pole filters
const lp = (x, fc) => { const a = 1 - Math.exp(-2 * Math.PI * fc / SR); let y = 0; return x.map(v => (y += a * (v - y))); };
const hp = (x, fc) => { const l = lp(x, fc); return x.map((v, i) => v - l[i]); };

// ---- voice
for (const ln of tl.lines) {
  let s = readWav(path.join(EP, 'vo', ln.id + '.wav'));
  const i0 = Math.round(ln.start * SR);
  if (ln.who === 'woman') { // radio whisper: band-limited, wobble, echo, wide
    s = lp(hp(lp(hp(s, 350), 3200), 350), 3200);
    const D1 = Math.round(0.17 * SR), D2 = Math.round(0.29 * SR), out = new Float32Array(s.length + SR);
    for (let i = 0; i < out.length; i++) { const v = (s[i] || 0) * (1 + 0.25 * Math.sin(i / SR * 2 * Math.PI * 7)); out[i] += v * 1.6;
      if (i + D1 < out.length) out[i + D1] += out[i] * 0.33; if (i + D2 < out.length) out[i + D2] += out[i] * 0.18; }
    out.forEach((v, i) => add(i0 + i, v * 3.4, v * 2.9 + (out[i - 400] || 0) * 0.6));
  } else s.forEach((v, i) => add(i0 + i, v));
}

// ---- road rumble + engine (driving)
{ let b1 = 0, b2 = 0;
  for (let i = 0; i < N; i++) { const t = i / SR; const g = t < STOP - 1 ? 1 : Math.max(0, 1 - (t - (STOP - 1)) / 1.0);
    if (g <= 0) continue; b1 += 0.02 * (rnd() - b1 * 0.02); b2 += 0.03 * (b1 - b2);
    const eng = Math.sin(2 * Math.PI * (44 + 2 * Math.sin(t * 0.7)) * t) * 0.04;
    add(i, (b2 * 0.9 + eng) * g * 0.8); } }
// ---- drone (whole story, swells into the reveal)
for (let i = 0; i < Math.round(SMASH * SR); i++) { const t = i / SR;
  const g = 0.035 + 0.06 * Math.min(1, t / REVEAL) ** 2 + (t > REVEAL ? 0.12 * ((t - REVEAL) / (SMASH - REVEAL)) : 0);
  const v = Math.sin(2 * Math.PI * 55 * t) + 0.6 * Math.sin(2 * Math.PI * 82.6 * t + Math.sin(t * 0.3)) + 0.35 * Math.sin(2 * Math.PI * 116.7 * t);
  add(i, v * g * 0.5 * (0.8 + 0.2 * Math.sin(t * 1.3)), v * g * 0.5 * (0.8 + 0.2 * Math.cos(t * 1.1))); }
// ---- seat thuds
for (const th of THUD) for (let k = 0; k < SR * 0.4; k++) { const t = k / SR, f = 75 - 35 * t / 0.4;
  const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14) * 0.9 + rnd() * Math.exp(-t * 60) * 0.25; add(Math.round(th * SR) + k, v); }
// ---- hazard ticks
for (let t = STOP; t < SMASH; t += 1 / 2.4) { const g = t < cut('l06', 'l07') ? 0.18 : 0.07;
  for (const off of [0, 0.03]) for (let k = 0; k < 220; k++) add(Math.round((t + off) * SR) + k, rnd() * Math.exp(-k / 40) * g); }
// ---- flashlight click + radio button click
for (const tc of [Ln.l06.start + 1.3, RADIO_ON]) for (let k = 0; k < 600; k++) add(Math.round(tc * SR) + k, rnd() * Math.exp(-k / 70) * 0.35);
// ---- radio static
{ const st = []; for (let i = 0; i < Math.round((WHISPER_END - RADIO_ON + 0.2) * SR); i++) st.push(rnd()); const f = hp(Float32Array.from(st), 1500);
  f.forEach((v, k) => { const t = RADIO_ON + k / SR; const g = 0.05 * env(t, RADIO_ON, WHISPER_END, 0.05, 0.05) * (0.7 + 0.3 * Math.sin(t * 31)) + (t > Ln.l08.start - 0.3 && t < Ln.l08.start ? 0.08 : 0);
    add(Math.round(t * SR), v * g); }); }
// ---- reveal: rising dissonant swell, then hit at the smash cut
{ const len = SMASH - REVEAL; for (let i = 0; i < Math.round(len * SR); i++) { const t = i / SR, x = t / len;
    const v = (Math.sin(2 * Math.PI * (440 + 60 * x) * t) + Math.sin(2 * Math.PI * (466 + 80 * x) * t) + 0.7 * Math.sin(2 * Math.PI * (622 + 90 * x) * t)) * 0.03 * x * x + rnd() * 0.05 * x ** 3;
    add(Math.round(REVEAL * SR) + i, v, v * 0.9); }
  for (let k = 0; k < SR * 1.2; k++) { const t = k / SR; const v = Math.sin(2 * Math.PI * (60 - 25 * t) * t) * Math.exp(-t * 3.5) * 0.9 + rnd() * Math.exp(-t * 9) * 0.5;
    add(Math.round((SMASH - 0.07) * SR) + k, v); } }
// ---- end card: pad + music box
{ const chord = [110, 130.8, 164.8, 220];
  for (let i = Math.round(END * SR); i < N; i++) { const t = i / SR - END; const g = Math.min(1, t / 1.5) * Math.min(1, (tl.duration - i / SR) / 1.0) * 0.03;
    let v = 0; for (const f of chord) v += Math.sin(2 * Math.PI * f * t + Math.sin(t * 0.5 + f));
    add(i, v * g, v * g * 0.9); }
  const notes = [659.3, 523.3, 440, 493.9, 523.3, 392, 440, 329.6, 440, 523.3, 659.3, 587.3];
  notes.forEach((f, n) => { const t0 = END + 0.6 + n * 0.5; for (let k = 0; k < SR * 1.4; k++) { const t = k / SR;
    const v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.01 * t)) * Math.exp(-t * 3) * 0.05;
    add(Math.round(t0 * SR) + k, v * (n % 2 ? 0.7 : 1), v * (n % 2 ? 1 : 0.7)); } }); }

// ---- write 16-bit stereo wav
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(Lc[i]), Math.abs(Rc[i]));
const g = 1; const sc = (x) => Math.tanh(x * 1.1) / 1.1;
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(sc(Lc[i] * g) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(sc(Rc[i] * g) * 32767), 46 + i * 4); }
fs.writeFileSync(path.join(EP, 'audio_mix.wav'), buf);
console.log('mix written, peak', peak.toFixed(2));
