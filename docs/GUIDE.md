# PolyCast guide

Everything you can control, in one place. If you just want a video, the [README](../README.md) quick start is enough.

- [1. Episodes](#1-episodes)
- [2. The script: `lines.json`](#2-the-script-linesjson)
- [3. Voices](#3-voices)
- [4. Directing: `scene.js` CONFIG](#4-directing-scenejs-config)
- [5. Preview and build](#5-preview-and-build)
- [6. Templates](#6-templates)
- [7. Writing a script that people watch](#7-writing-a-script-that-people-watch)
- [8. Troubleshooting](#8-troubleshooting)

---

## 1. Episodes

An episode is a folder. It can live anywhere:

```
my-video/
├── lines.json      ← the script (you write this)
├── scene.js        ← the set + the CONFIG block (you tweak this)
├── mix.js          ← sound design (usually untouched)
├── img/            ← optional screenshots for the wall monitors
├── vo/             ← generated: one .wav per line
├── timeline.json   ← generated: when each line starts and ends
├── frames/         ← generated: previews + sheet.jpg
└── video.mp4       ← generated: silent render (build.js adds the audio)
```

Create one from a template:

```bash
node scripts/new.js my-video studio          # landscape podcast studio
node scripts/new.js my-short retro-horror    # vertical PS1-style horror
```

## 2. The script: `lines.json`

```json
{
  "provider": "auto",
  "lead": 0.35,
  "voices": {
    "host": {
      "cartesia": { "id": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc", "speed": 1.0 },
      "system":   { "gender": "female" }
    },
    "orb": {
      "cartesia": { "id": "87286a8d-7ea7-4235-a41a-dd9fa6630feb", "speed": 0.95 },
      "system":   { "gender": "male" },
      "fx": "robot"
    }
  },
  "lines": [
    { "id": "o01", "who": "orb",  "text": "So you think a text file can make a whole video?", "after": 0.25 },
    { "id": "h01", "who": "host", "text": "This video started as a JSON file.", "say": "This video started as a jason file." }
  ]
}
```

| Field | Meaning |
|---|---|
| `provider` | `auto` (Cartesia if a key exists, otherwise free), `cartesia`, or `system` |
| `lead` | Seconds of silence before the first line |
| `voices.<who>.cartesia` | `id` (any [Cartesia voice](https://play.cartesia.ai/voices)), `speed`, optional `emotion` |
| `voices.<who>.system` | `gender` (`female` or `male`), optional `name` (exact system voice name), `speed` |
| `voices.<who>.fx` | `robot`, `radio`, `deep`, or any ffmpeg `-af` filter string |
| `lines[].id` | Unique ID. The scene uses it for cues, so keep it stable. |
| `lines[].who` | Which voice speaks. The studio template expects `host` and `orb`. |
| `lines[].text` | What the captions show |
| `lines[].say` | Optional: what the voice actually says (pronunciation fixes) |
| `lines[].after` | Pause after the line, in seconds (0.2–0.5 keeps banter snappy) |

Lines are cached. Change a line, delete `vo/<id>_raw.wav`, and run `voice.js` again. Set `FORCE=1` to redo all of them.

## 3. Voices

| Provider | Cost | Quality | Setup |
|---|---|---|---|
| **System** (default without a key) | Free | Robotic but clear | Windows and macOS: nothing to install. Linux: `sudo apt install espeak-ng` |
| **Cartesia** | Paid API, free tier available | Studio quality, expressive | Put `CARTESIA_API_KEY=...` in `.env` |

```bash
node scripts/voice.js my-video              # generate
node scripts/voice.js my-video --verify     # + speech-to-text check of every line (Cartesia key needed)
node scripts/voice.js --list-system         # see your free voices
POLYCAST_VOICE=system node scripts/voice.js my-video   # force free voices for one run
```

Switching providers regenerates every line automatically.

## 4. Directing: `scene.js` CONFIG

Every timing is a **cue**: `[lineId]` fires when the line starts, and `[lineId, 'word']` fires when that word is spoken.
Cues are recomputed from `timeline.json`, so regenerating the voices never breaks the edit.

### Look
```js
host: { skin: 0xd9a77f, shirt: 0x2f8f83, hair: 0x2a1c14, hairStyle: 'swoop', pants: 0x2a2f4a },  // hairStyle: swoop | cap | long
orbColor: 0xe0703f,
neon: 'POLYCAST',                  // the glowing sign on the slat wall
note: ['SCRIPT', '.JSON'],         // sticky note on the desk (1-3 short lines)
piggy: ['VOICE BILL', '$0.00'],    // piggy bank label (a great spot for a joke)
```

### Topic card (top-left)
```js
topic: { title: 'POLYCAST', pill: 'TEXT → VIDEO', sticker: { text: '*free', at: ['o05'] } },
```
The sticker pops on at its cue. It's useful for running gags (e.g. "BUILT BY ME" plus a "*w/ AI" sticker that gets crossed out).

### Camera
```js
camera: [ [['o01'], 'two'], [['h01'], 'hostClose'], [['o02'], 'orbClose'], [['h02'], 'monL'] ],
```
| Shot | Frames |
|---|---|
| `wide` | Whole studio |
| `two` | Both characters |
| `hostClose` / `orbClose` | Single close-ups. Use them for reactions and punchlines. |
| `monL` / `monR` | Left or right wall monitor, for showing a screen |

Moves between shots are eased over 0.5 s, with a gentle handheld drift.

### Wall monitors
```js
monitors: [ [['o01'], 'chart', 'chart'], [['h02'], 'img:dashboard.png', 'voices'] ],
```
Screens: `chart`, `json`, `render`, `voices`, `skill`, or `img:<file>` from the episode's `img/` folder (slow pan and zoom).
To add a new drawn screen, add an `else if (mode === 'yours')` branch in `drawMon()`.

### Acting
```js
acting: [ [['o01'], ['h01'], { orb: 'side', hostTurn: 0.5 }],
          [['h06', 'free'], null, { orb: 'happy', wave: true }] ],
```
| Key | Values |
|---|---|
| `orb` | `normal` `smug` `side` `flat` `happy` `shock` `loading` `dots` |
| `hostTurn` | Head yaw: `0` faces the camera, `0.5` faces the orb |
| `hostLook` | Pupils: `0` center, `1` toward the orb |
| `orbTurn` | Orb yaw: `0` faces the camera, `-0.45` faces the host |
| `wave` | Host raises their hand |

The last matching range wins. Use `null` as the end cue to mean "until the end".

### Cards, captions, contact, end
```js
cards: [ [['h03', 'mouth'], ['o04'], 'LIP-SYNC', 'to the real audio', '#5cc98a'] ],   // [from, until, big, small, color]
captionHighlights: ['json', 'free', 'claude'],                                          // words shown in yellow
contact: { at: ['h06', 'free'], big: 'you@example.com', small: 'yoursite.com' },
end: { title: 'Your Name', sub: 'what you do', pill: 'call to action' },
```

### Resolution
```js
export const RES = [1280, 720, 1920, 1080];   // [render width, render height, output width, output height]
```
Vertical: `[720, 1280, 1080, 1920]`, then nudge the camera `SHOTS` a little wider.

## 5. Preview and build

```bash
node scripts/preview.js my-video 2 9 18 27 36 44   # chosen times (default: 6 evenly spaced)
node scripts/build.js my-video my-video.mp4        # voices → render → mix → mp4
MODE=loop node scripts/render.js my-video video    # alternate render mode, if a scene supports one
```

Always open `frames/sheet.jpg` before a full build. A full 1080p render takes minutes; a preview takes seconds.

The output is H.264 + AAC at -16 LUFS, with faststart enabled, ready for YouTube, LinkedIn, X and your website.

## 6. Templates

| Template | Format | Look | Speakers |
|---|---|---|---|
| `studio` | 1920×1080 | Warm podcast studio: shadows, depth of field, neon | `host`, `orb` |
| `retro-horror` | 1080×1920 | PS1-style horror: dithering, vertex wobble, VHS overlay | `nar`, `danny`, `woman` |

The engine (`engine/lib.js`) provides `makePerson`, IK limbs, the car and road world, and a compositor with a clean mode or a PS1 dither mode. A new template is just a folder with `lines.json`, `scene.js` and `mix.js`.

## 7. Writing a script that people watch

1. **Hook in the first 3 seconds.** The orb challenges the host: *"So you think a text file can make a whole video?"*
2. **One idea per line.** About 2.5 spoken words per second; 45–60 s total.
3. **Claim, proof, quip.** Say it plainly, show one real number or screen, and let the orb react.
4. **Cut on the joke.** Use a close-up of whoever reacts.
5. **End on one action:** a URL, an email, or "comment X".

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Chrome not found` | Install Chrome or set `CHROME_PATH=/path/to/chrome` |
| `ffmpeg` not found | Windows `winget install ffmpeg` · macOS `brew install ffmpeg` · Linux `sudo apt install ffmpeg` |
| Linux: no voices | `sudo apt install espeak-ng`, or add a Cartesia key |
| A word is missing from a line | The line is too short. Pad it ("Wait… free? I'm in.") and regenerate |
| A name is mispronounced (e.g. "Claude" sounds like "cloud") | Spell it phonetically in `say`: `"say": "... Clawd Code ..."`. Captions keep `text`. |
| The orb's face is hidden | Keep the flattened-front orb geometry; don't put mics in front of faces |
| Render is slow on Linux | Headless Chrome falls back to SwiftShader (CPU). Lower `RES` render size for drafts |
| Black or empty frames | Run `node scripts/preview.js` and read the `[pageerror]` lines; usually a typo in `scene.js` |
