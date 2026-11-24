# Last Local — Neon Remake

A first-person liminal-space horror game set on a late-night New York City subway
(G train default from Hoyt-Schermerhorn to Court Sq, plus L and 7 line routes).
Built by Gemini 4 Neon in Google AI Studio from the spec of the original game.

- **Live app:** https://last-local-neon.ai.studio
- **Original game:** https://github.com/PerfecHateyOu/Last-Local-Liminal-Space-Subway
- **Stack:** React 19 + Three.js + Vite + TypeScript + Tailwind CSS

## The ride

Three 13-stop routes (**G**, **L**, and **7**), playable as a full ride, in 4 chapters,
or in Practice, Standard, and Nightmare modes. Includes calibrated per-stop cruise and
dwell timings, suspicion bands and parent-watch escalation, per-stop sanity bands and
drift, anomalies to flag, a Polaroid camera, an EVP recorder, an FM Radio Tuner
(88.0–108.0 MHz), the blackout segment, the Safe Haven choice, 3-stage False Stop Trials
(forgiving Stop 4, strict Stop 9), the Lying PA, the Restraint sequence, a 13-Case
Psychological Log, a persistent Archive, and 8 priority-ranked endings (`END-01`–`END-08`).

## Controls

| Key | Action |
| --- | --- |
| `WASD` | Move in the car |
| `Arrow keys` / `Mouse` | Look around |
| `F` / `Left click` | Flag aimed anomaly |
| `Space` | Hold still (Restraint / Trial Stage 2) or snap Polaroid |
| `1` / `2` / `3` | Mask prompt or False Stop Trial choices |
| `B` | PA board |
| `Tab` | Evidence log |
| `C` | Polaroid camera |
| `V` | EVP recorder |
| `T` | Radio tuner |
| `M` | Mute / unmute audio |
| `P` / `Esc` | Pause (`Esc` closes an open panel first) |

## Run it

```bash
npm install
npm run dev      # Vite dev server on port 3000
npm run build    # Production build
npm test         # Unit tests (node:test via tsx)
npm run lint     # tsc --noEmit
```

## Verified status (Nov 24, 2026 — `be7a8ad`)

- Builds clean (`vite build`), TypeScript passes (`tsc --noEmit`) with zero errors.
- All 49 unit tests in `src/game/game.test.ts` pass: G/L/7 13-stop routes and
  calibrated timings, 4 chapters, suspicion bands/deltas and Practice mode, sanity
  bands/drift/penalties/glitches, all 8 priority-ranked endings, 3-stage False Stop
  Trials, Radio Tuner, 13-Case Psychological Log, persistent Archive, input/pause
  hygiene, anomaly catalog, non-spoiler EVP resonance, Polaroid captions, and full
  simulated 13-stop rides on all three lines.
- Pause hygiene is strict: held keys are cleared on pause, key repeats are ignored,
  and the look camera does not drift while paused (see `src/game/input.ts`).

## Known gaps

- No browser / end-to-end tests — the 3D scene and React UI are untested; only the
  49 unit tests in `src/game/game.test.ts` exist.
- Procedural audio clip hooks (`src/game/audio.ts`) and additional anomaly variants
  (`src/game/anomalies.ts`) remain marked `TBD` for future passes.
- Minor AI Studio template leftovers: `metadata.json` still declares
  `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` (even though `@google/genai` was removed
  in `be7a8ad`), unused `express`/`dotenv` dependencies remain in `package.json`, and
  `vite.config.ts` uses `__dirname` (triggering a Vite 8 deprecation warning).
