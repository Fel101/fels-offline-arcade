# Verification

The project has **no build step** — it is plain HTML/CSS/JS that runs from `file://`.
"Verification" therefore means syntax checks, the deterministic unit suites, and
headless-browser layout checks. All of it lives in this folder and runs offline.

## Requirements

- Node.js 18+ (no packages to install — `npm install` is unnecessary)
- Google Chrome for the layout checks (set `CHROME_PATH` if it isn't at the
  default Windows location)

## Commands

From the repository root:

```bash
npm test          # all 64 deterministic game suites (13,338 assertions)
npm run test:layout   # every game at 360 / 500 / 900 / 1200 px, 0 console errors + no overflow
npm run verify        # both of the above
```

You can also run a single suite or a single game's layout check directly:

```bash
node tests/chess-test.js
node tests/check-tia.js chess checkers
```

## Structure

- `run-all-suites.js` — runs every `*-test.js` suite and reports totals.
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
