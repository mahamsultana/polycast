---
name: polycast
description: Turn an idea or script into a low-poly 3D video with PolyCast. A host and a floating AI orb banter in a warm podcast studio (or a retro PS1-style horror scene), with generated voices (free system TTS or Cartesia), lip-sync, wall-monitor screens, stat cards, captions and a sound mix, rendered to MP4. Use when the user asks for a PolyCast video, a low-poly / podcast / orb-style video, reel, explainer, product or portfolio video.
---

# PolyCast

The toolkit is in this skill's folder (call it `$POLYCAST`: the directory containing this SKILL.md).
Videos ("episodes") live wherever the user wants. Default: `./polycast-videos/<name>` in the current project.

## 0. One-time setup
Run `node "$POLYCAST/scripts/doctor.js"`. It installs the node packages (no browser download) and checks ffmpeg, Chrome and voices.
If something is missing, tell the user the exact fix it prints (e.g. `winget install ffmpeg`, `brew install ffmpeg`, `sudo apt install ffmpeg espeak-ng`).

Voices:
- **Free (default):** the computer's own TTS. Windows SAPI (Zira, David), macOS `say`, Linux `espeak-ng`. No account needed.
- **Studio quality:** a Cartesia key in `.env` (`CARTESIA_API_KEY=...`) in the project or in `$POLYCAST`. Auto-detected.
- To force one, set `"provider": "system"` or `"cartesia"` in lines.json. `node $POLYCAST/scripts/voice.js --list-system` lists the free voices.

## 1. Understand the brief
Ask only what you can't infer: the topic or product, who's in it, length (30-60 s), landscape (default) or vertical,
how viewers should contact or follow, and any real screenshots or links. If they give a website, read it and describe
things exactly as the site does.

## 2. Create the episode
`node "$POLYCAST/scripts/new.js" polycast-videos/<name> studio` (or `retro-horror` for a vertical PS1 horror short).

## 3. Write the script: `lines.json`
- Speakers: `host` and `orb` (studio template). Each line: `{ "id", "who", "text", "after" }`. Add `"say"` when the
  pronunciation differs from the caption (e.g. text "Three.js", say "Three J S"; text "JSON", say "jason").
- Shape: hook in the first 3 s, where the orb challenges the host. Then each point = one plain-language claim + one
  concrete detail + an orb quip. End with a call to action. About 2.5 words per second.
- Lines under ~4 words can come out clipped. Pad them ("Wait... that's it?").
- Never have TTS read emails or URLs; show them on screen (contact card).

## 4. Voices
`node "$POLYCAST/scripts/voice.js" polycast-videos/<name> --verify`
(`--verify` transcribes every line back; it needs a Cartesia key and is skipped otherwise. With a key, always use it:
you can't listen to audio, so this is how you check it.) Fix flagged lines: edit, delete `vo/<id>_raw.wav`, rerun.

## 5. Direct the scene: `scene.js` CONFIG block only
Cues are `[lineId, word?]`, firing when that word is spoken.
- `host` look, `orbColor`, `neon` sign text, desk `note`, `piggy` label (make the props jokes about the topic)
- `topic` card (top-left) with an optional `sticker` gag
- `camera`: `[cue, shot]` with shots `two | wide | hostClose | orbClose | monL | monR`. Cut to the orb's close-up for its quips.
- `monitors`: `[cue, left, right]` with screens `chart | json | render | voices | skill | img:<file>`.
  Put real screenshots in `<episode>/img/` and use `img:file.png`; prefer them over drawn screens.
- `acting`: `[from, to, { orb, hostTurn, hostLook, orbTurn, wave }]` with orb faces
  `normal | smug | side | flat | happy | shock | loading | dots`
- `cards` (stat pop-ins), `captionHighlights`, `contact`, `end`
Only edit below CONFIG when the user wants a new kind of screen or prop.

## 6. Preview, check, build
- `node "$POLYCAST/scripts/preview.js" polycast-videos/<name> t1 t2 ... t8`, then READ `frames/sheet.jpg`. Check that
  no mic crosses a face, the orb face is visible, overlays don't collide, and screens are readable. Fix and repeat.
- `node "$POLYCAST/scripts/build.js" polycast-videos/<name> polycast-videos/<name>.mp4`. This takes 5-10 min, so run it in
  the background. Then extract a couple of frames from the MP4 to confirm, and give the user the absolute path.

## Rules
- Facts on screen must match the user's sources. Don't invent stats.
- Don't draw protected characters, logos or real people's likeness beyond a generic low-poly figure.
- Keep CONFIG text short. Cards hold about 14 characters big and 30 small.
