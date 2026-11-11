# Contributing to PolyCast

Thanks for helping. PolyCast is small on purpose: plain Node scripts, one three.js engine file, and templates.

## Good first contributions
- **A new template:** a new set or genre (a news desk, a sci-fi bridge, a cooking show). Copy `templates/studio`, keep the CONFIG-first structure, and add a row to the templates table in `docs/GUIDE.md`.
- **New monitor screens or orb expressions:** add a branch in `drawMon()` or `drawFace()` and document it in the guide.
- **Voice providers:** add a provider next to `cartesiaTTS` and `systemTTS` in `scripts/voice.js` (ElevenLabs, OpenAI, Piper…). It should write a 44.1 kHz WAV.
- **Platform fixes:** Linux and macOS testing is especially welcome.

## Setup
```bash
git clone https://github.com/<your-username>/polycast && cd polycast
npm run doctor
node scripts/new.js videos/dev studio
node scripts/voice.js videos/dev && node scripts/preview.js videos/dev
```
`videos/` is gitignored, so experiment freely there.

## Before you open a pull request
- `npm run check` passes (syntax and JSON checks across the scripts and templates).
- If you touched rendering, attach a `frames/sheet.jpg` from `preview.js`.
- No API keys, personal data, or copyrighted characters or logos in templates.
- Keep dependencies at `three` and `puppeteer-core`; generate everything else in code.

## Style
- Plain JavaScript (CommonJS for scripts, ES modules for anything that runs in the browser).
- User-facing knobs go in a template's `CONFIG` block, not deep in the code.
- Comment the *why*, not the *what*.

By contributing you agree that your work is released under the [MIT License](LICENSE).
