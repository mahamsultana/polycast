#!/usr/bin/env node
// One command: voices -> render -> sound mix -> final mp4.
//   node scripts/build.js <episode-dir> [out.mp4]
// Skips nothing clever: voices are cached per line, so re-running only re-renders + re-mixes.
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ep = process.argv[2];
if (!ep) { console.error('usage: node scripts/build.js <episode-dir> [out.mp4]'); process.exit(1); }
const out = process.argv[3] || path.join(ep, 'final.mp4');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

console.log('== 1/4 voices'); run(process.execPath, [path.join(__dirname, 'voice.js'), ep]);
console.log('== 2/4 render'); run(process.execPath, [path.join(__dirname, 'render.js'), ep, 'video']);
console.log('== 3/4 mix');
const mix = path.join(ep, 'mix.js');
if (fs.existsSync(mix)) run(process.execPath, [mix]);
console.log('== 4/4 encode');
const audio = path.join(ep, 'audio_mix.wav');
const args = ['-y', '-loglevel', 'error', '-i', path.join(ep, 'video.mp4')];
if (fs.existsSync(audio)) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
run('ffmpeg', args);
console.log('done ->', out);
