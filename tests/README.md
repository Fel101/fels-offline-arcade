# Verification

The project has **no build step** — it is plain HTML/CSS/JS that runs from `file://`.
Verification includes deterministic unit suites, browser interaction checks, and
layout checks. All of them run offline from this folder.

## Requirements

- Node.js 18+ for the unit and layout tests. The browser smoke test also needs
  built-in `WebSocket` support, which is available in Node.js 24.
- Google Chrome for the browser and layout checks (set `CHROME_PATH` if it isn't at the
  default Windows location)

## Commands

From the repository root:

```bash
npm test              # all 64 deterministic game suites
npm run test:browser  # launcher, theme, and keyboard interaction in Chrome
npm run test:layout   # every game at 360 / 500 / 900 / 1200 px, 0 console errors + no overflow
npm run verify        # unit tests and layout checks
```

You can also run a single suite or a single game's layout check directly:

```bash
node tests/chess-test.js
node tests/check-tia.js chess checkers
```

## Structure

- `run-all-suites.js` — runs every `*-test.js` suite and reports totals.
- `browser-smoke.js` — opens the local launcher in Chrome with web requests
  blocked and exercises theme persistence, Badges dialogs, and a Backgammon move.
- `check-tia.js` — injects a diagnostic script into each game page and loads it
  in headless Chrome at four widths; reports console errors and horizontal
  overflow. Writes a temporary `_diag.html` into each game folder and removes
  it afterward (also covered by `.gitignore`).
- `_env.js` — shared path helpers so suites work from any checkout directory.
- `*-test.js` — one deterministic suite per game. Each game exposes a
  `window.__XXX` hook (embedded in its `script.js`) that the suite drives to
  seed state and step logic without relying on real timers.

## Design notes

- The suites use a minimal fake DOM and eval the real `js/arcade-core.js`
  followed by the game's real `script.js`. No mocks of game logic.
- Deterministic games use a seeded PRNG so daily puzzles and suites are
  reproducible.
- `check-tia.js` forces `prefers-reduced-motion` off and clamps the viewport in
  an iframe, which is why narrow widths are tested that way.
