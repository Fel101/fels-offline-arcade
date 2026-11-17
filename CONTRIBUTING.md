# Contributing to Offline Arcade

Thanks for your interest! This project is a collection of small, self-contained
browser games. Adding a game or fixing a bug is meant to be straightforward — no
build step, no dependencies, no framework.

## Ground rules

- **Vanilla only.** Plain HTML, CSS and JavaScript. No libraries, no frameworks,
  no package managers, no CDN links.
- **Must work offline.** The whole point is that you can open `index.html` from a
  folder (even `file://`) with no internet. Never reference external URLs, fonts,
  images or scripts.
- **Keep games isolated.** Each game lives in its own folder and must not touch
  another game's files or storage.
- **Don't break the portal.** The home page builds its grid from the `GAMES` array;
  keep entries well-formed.

## Adding a new game

1. **Create the folder and files**

   ```
   games/<name>/
     index.html
     script.js
   ```

2. **Copy `index.html` from an existing game** (e.g. `games/tic-tac-toe/`) as a
   starting point. It already includes:
   - the theme bootstrap script (prevents a flash on load),
   - the shared header with the back button, sound toggle and badges button,
   - the status bar, board/canvas area, controls and hint text,
   - the toasts container and the badges modal,
   - the two script tags that load `../../js/arcade-core.js` then `script.js`.

   Update the `<title>`, `<h1>`, description, board markup and hint copy for your game.

3. **Write `script.js` as a single IIFE** that pulls what it needs from the core:

   ```js
   (() => {
     "use strict";
     const { store, keys, util, audio, overlay, confetti, badges, modal, dom } =
       window.Arcade;
     // ... game code ...
   })();
   ```

   Use `keys("<name>")` to get consistent storage keys, `audio.sfx("...")` for sound,
   `overlay.show/hide` for the end-of-game dialog, and `badges.create(...)` for
   achievements.

4. **Register the game in `index.html`** by adding one entry to the `GAMES` array:

   ```js
   {
     name: "my-game",
     display: "My Game",
     emoji: "🎲",
     category: "Puzzle",           // must be one of the existing categories, or a new one
     desc: "One-line summary. 14 badges.",
     url: "games/my-game/index.html",
     isNew: true,                  // optional "New" pill
   },
   ```

   The footer count, search index and category filters update automatically.

5. **Test it**:
   - Open the portal, find your game, play a full round, and check that the
     overlay, sound toggle and badges modal all work.
   - Resize the window down to ~360 px wide and confirm nothing overflows.
   - Confirm the browser console has no errors.
   - If you can, run the project's checks (see below).

## Code style

- 2-space indentation, semicolons, `const`/`let` (no `var` in new code).
- Keep rules and rendering inside the game's IIFE; only shared *plumbing* belongs
  in `js/arcade-core.js`.
- Keep games dependency-free and defensive: guard `localStorage` access so a
  blocked storage API degrades gracefully instead of throwing.
- Prefer accessible markup: real `<button>` elements, ARIA labels where the
  meaning isn't obvious, and respect `prefers-reduced-motion`.

## Shared core

`js/arcade-core.js` is loaded by every game and exposes:

| Area | What it gives you |
|------|-------------------|
| `store` | Safe `localStorage` wrapper (`get`, `set`, `json`, `jsonSet`, `remove`) |
| `keys(game)` | Consistent storage key names (`stats`, `achv`, `sound`, `best`, …) |
| `util` | Formatting, seeded RNG, `clamp`, `shuffle`, `formatTime`, … |
| `audio` | Oscillator sound effects + a sound-toggle button binder |
| `toast` | Corner notifications |
| `overlay` | Full-screen "Paused" / "Game over" dialog |
| `confetti` | Lightweight celebration effect (respects reduced motion) |
| `badges` | Achievement definitions, progress and the badge grid |
| `modal` | Accessible show/hide dialog shell with scroll lock |
| `loop` | Delta-clamped `requestAnimationFrame` loop |

Changes here affect all 56 games, so please be conservative and test broadly.

## Checks

There is no required build. At minimum, please verify:

- `node --check games/<name>/script.js` passes (syntax).
- The game loads with **zero console errors** at widths of 360, 500, 900 and 1200 px.
- No horizontal scrollbar at those widths.
- Progress persists after a reload, and the badges modal reflects it.

## Reporting issues

Open an issue describing:

- which game (or the portal),
- what you did and what happened instead,
- your browser and OS,
- whether it happens offline from `file://`.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).