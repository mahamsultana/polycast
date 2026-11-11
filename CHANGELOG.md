# Changelog

## 1.0.0 — 2026-11-11
First public release.

- `studio` template: a 1920×1080 low-poly podcast studio with a host and the floating orb Byte. Soft shadows, depth of field, neon sign, wall monitors, topic card, stat cards, captions, contact card and end card, all driven by a `CONFIG` block with word-level cues.
- `retro-horror` template: a vertical PS1-style horror short with dithering, vertex wobble and a VHS overlay.
- Voices: free system TTS (Windows SAPI, macOS `say`, Linux `espeak-ng`) or Cartesia, with per-voice effects (`robot`, `radio`, `deep`), pronunciation overrides (`say`), and speech-to-text verification.
- Lip-sync driven by each line's real audio envelope.
- Scripts: `doctor`, `new`, `voice`, `preview` (with contact sheet), `render`, `build`.
- Claude Code skill (`SKILL.md`): describe a video and Claude builds it end to end.
