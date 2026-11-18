# 🎮 Fel's Offline Arcade

**64 games** · **0 dependencies** · **100% offline** · **MIT licensed**

A self-contained, fully offline collection of **64 browser games** — a local take on
the "just a bunch of games to play" vibe. No server, no build step, no internet, no
ads, no accounts, no tracking. Just open `index.html` in any modern browser and pick
a game.

Everything is plain **HTML, CSS and JavaScript** with **zero dependencies**, so it runs
from a local folder, a USB stick, or any static host.

---

## Quick start

**Play online:** <https://fel101.github.io/fels-offline-arcade/>

**Play offline:**

1. Download or clone this repository.
2. Double-click **`index.html`** (or drag it into a browser tab).
3. Pick a game and play.

That's it — no Node, no npm, nothing to install.

---

## Highlights

- **64 games** across 10 categories — Arcade, Board, Card, Dice, Logic, Pattern,
  Puzzle, Reflex, Strategy and Word.
- **Shared core** (`js/arcade-core.js`) provides storage, sound, toasts, overlays,
  confetti, badges and theming; each game keeps its own rules and rendering.
- **Persistent progress** — high scores, stats and **14–28 badges per game** are saved
  in `localStorage` (gracefully degrading if storage is blocked).
- **Four themes** — System, Dark, Light and Kids (high-contrast, playful) — applied to
  the portal and every game, remembered between visits.
- **Fully offline** — no network requests, no external assets, no CDN.
- **Works from `file://`** — no web server required.
- **Accessible touches** — keyboard shortcuts, ARIA labels, `prefers-reduced-motion`
  support, and responsive layouts down to 360 px.

---

## Games (64)

| Game | Type | Play |
|------|------|------|
| 🐍 Snake | Arcade | 4 modes (Classic, Endless, Zen, Vs AI), combos, power-ups, 19 badges |
| 🧱 Block Drop | Puzzle | Marathon, Sprint 40, or race an AI rival — combos, hold, 24 badges |
| 💣 Minesweeper | Logic | Classic, Time Attack, Daily or Zen — chording, 27 badges |
| 🔢 Sudoku | Puzzle | Classic, Time Attack, Daily or X-Sudoku — notes, hints, 28 badges |
| 🔢 Super Sudoku | Puzzle | Five overlapping cards — solve all five |
| 🧮 Kakuro | Puzzle | Fill each run so it matches the clue sums |
| 🔢 2048 | Puzzle | Merge tiles — 3 sizes, undo, 24 badges |
| 🧠 Memory | Pattern | Flip pairs — 4 modes, 3 sizes, 24 badges |
| 🔴 Four in a Row | Strategy | Click a column vs the computer — 14 badges |
| 🔵 Gomoku | Strategy | Five in a row vs the computer — 14 badges |
| 🪨 Mancala | Strategy | Sow and capture stones vs the computer — 14 badges |
| 🎰 Farkle | Dice | Push your luck — reach 3000 in 10 turns — 14 badges |
| 🎴 Video Poker | Card | Jacks or Better — hold, draw, hit the target — 14 badges |
| ♣️ FreeCell | Card | Classic open solitaire — free cells, foundations, undo — 14 badges |
| ⚪ Nine Men's Morris | Strategy | Form mills, remove pieces, outthink the CPU — 14 badges |
| 👾 Alien Attack | Arcade | Defend Earth from waves of descending aliens — 14 badges |
| 💎 Match 3 | Puzzle | Swap gems, match three, chain cascades — 14 badges |
| 🟡 Maze Chase | Arcade | Eat the dots, dodge the ghosts, grab power pellets — 14 badges |
| 🖱️ Aim Trainer | Reflex | Click the targets fast — chase accuracy and reaction time — 14 badges |
| 🚗 Traffic Jam | Puzzle | Slide the cars, free the red car — 12 levels, 14 badges |
| 🔢 Math Cages | Puzzle | Fill the grid, satisfy every cage — 12 puzzles, 14 badges |
| 🔤 Word Trace | Word | Trace words across the grid before time runs out — 14 badges |
| ⚫ Go | Strategy | Place stones, surround territory, outplay the CPU on 9×9 — 14 badges |
| 🎲 Backgammon | Board | Race home, hit blots, bear off — classic backgammon vs the CPU — 14 badges |
| 🏰 Tower Defense | Strategy | Build towers, stop the waves, protect the base — 14 badges |
| 🔮 Rune Defense | Strategy | Advanced tower defense — 8 rune towers, status effects, 15 waves and a boss — 14 badges |
| 🃏 Hearts | Card | Dodge hearts and the queen, shoot the moon — 4-player hearts — 14 badges |
| ❌ Tic-Tac-Toe | Strategy | Perfect AI, 3 levels + 2-player — 24 badges |
| 🏓 Paddle Ball | Arcade | Mouse or ↑/↓ vs the computer — 14 badges |
| 🧨 Brick Breaker | Arcade | Bounce the ball and smash every brick — 14 badges |
| 🔨 Whack-a-Mole | Reflex | Whack moles, chain combos — 4 modes, 24 badges |
| ♠️ Blackjack | Card | Bet, hit, stand vs the dealer — 14 badges |
| ♟️ Chess | Strategy | Full rules — castling, en passant, promotion + AI — 14 badges |
| 🃏 Solitaire | Card | Klondike, click to move — 14 badges |
| 🚩 Minesweeper Variants | Logic | Classic flood-fill or Saturation mode — 14 badges |
| 🏍️ Light Trails | Arcade | Light-trail duel vs the computer — 14 badges |
| 🟠 Checkers | Strategy | Mandatory captures vs the computer — 14 badges |
| 🁫 Dominoes | Strategy | Draw, Block or All Fives — 3 AI levels, 24 badges |
| ⚫ Reversi | Strategy | Flip discs to your colour — 14 badges |
| 🚢 Sea Battle | Strategy | Hunt and sink the enemy fleet — 14 badges |
| 🪙 Nim | Strategy | Take 1–3 — perfect play vs the CPU, 14 badges |
| 🔷 Dots & Boxes | Strategy | Draw lines, claim the most boxes — 14 badges |
| 🧩 Nonogram | Logic | Solve the picture from the number clues — 14 badges |
| 🌀 Grand Tour | Logic | One loop through every dot — 4 difficulties, 24 badges |
| 🔤 Word Tile | Word | Guess the 5-letter word in 6 tries — 14 badges |
| 💡 Lights Out | Puzzle | One click toggles a cross — 3 sizes, 24 badges |
| 🧮 15 Puzzle | Puzzle | Slide into order — 3 sizes, hints, 24 badges |
| 🌈 Flow | Puzzle | Connect matching pipes, fill every cell — 14 badges |
| 🎵 Echo | Reflex | Repeat the sequence — 4 modes, 3 pad sets, 24 badges |
| 🎲 Yacht Dice | Dice | Roll and re-roll — beat your best total. 14 badges |
| 🏗️ Stack | Arcade | Drop blocks on the tower — how high? 14 badges |
| 🐤 Flappy | Arcade | Five modes — Classic, Sprint, Hard, Zen and seeded Daily — 14 badges |
| 🐸 Road Hopper | Arcade | Five modes — Classic, Time Attack, Blitz, Daily and Zen — 25 badges |
| 🔍 Word Search | Word | Find the hidden themed words — 14 badges |
| 🔡 Letter Grid | Word | Connect adjacent letters — 4×4 and 5×5, 24 badges |
| 🪢 Hangman | Word | Guess the word before the gallows completes — 14 badges |
| 🔀 Jumble | Word | Unscramble the letters from the clue — 14 badges |
| 🪜 Word Ladder | Word | Change one letter at a time — 14 badges |
| 🕵️ Cryptogram | Word | Decode the secret message — 14 badges |
| 🔠 Word Square | Word | Every row and column is a word — 14 badges |
| 🎯 Code Breaker | Logic | Crack the color code — 14 badges |
| 🗼 Tower of Hanoi | Puzzle | Move the tower, ring by ring — 14 badges |
| 🟢 Peg Solitaire | Puzzle | Jump and remove, leave one peg — 14 badges |
| 📦 Sokoban | Puzzle | Push every box onto a target — 14 badges |

---

## Portal features

- **Search** — filters by name, description, category, or URL slug. Press `/` to focus it.
- **Category filters** — Arcade, Card, Dice, Logic, Pattern, Puzzle, Reflex, Strategy, Word.
- **Favorites** — star any game; the "Favorites" filter shows your saved picks.
- **Recently played** — the last few games you opened from the portal, stored locally.
- **Random game** — jumps into a random game from the current filter.
- **Theme** — pick **System** (follows your OS), **Dark** (neutral near-black),
  **Light** (bright), or **Kids** (chunky, high-contrast, playful). Applies to the
  portal and every game; your choice is remembered. Defaults to System, then Dark.
- **New badges** — games with `isNew: true` in the `GAMES` array get a "New" pill.
- Keyboard: `/` focuses search, `Esc` clears it.

---

## Structure

```
index.html            ← portal home (auto-generated game grid)
css/styles.css        ← shared arcade styling
js/arcade-core.js     ← shared game engine (storage, audio, badges, toasts…)
games/
  snake/              ← one folder per game
    index.html         ← markup + layout
    script.js          ← game logic (self-contained IIFE)
  block-drop/
  ...
```

Games that use the shared core load `../../js/arcade-core.js` before their own
`script.js`, then destructure what they need:

```js
const { store, keys, util, audio, toast, overlay, confetti, badges, modal, dom } =
  window.Arcade;
```

The core provides persistent storage, seeded RNG (for Daily puzzles), oscillator
sound effects, toast notifications, the game-over overlay, confetti, the badge
grid, a pause-aware modal, and a delta-clamped animation loop. Games keep their
own rules and rendering; only the plumbing is shared.

Each game is **isolated** in its own folder with a "← Back to Games" button, so games
never interfere with each other. Games may bundle extra data files — for example,
`games/letter-grid/words.js` holds the offline dictionary.

---

## Adding a new game (game #65+)

1. Create `games/<name>/index.html` and `games/<name>/script.js`.
   Copy any existing game's `index.html` as a starting point — it already has the
   shared header, back button, status bar, canvas/board markup, and overlay styling.
2. In `index.html`, add one entry to the `GAMES` array:

   ```js
   {
     name: "chess",
     display: "Chess",
     emoji: "♟️",
     category: "Strategy",
     desc: "Full rules — castling, en passant, promotion + AI",
     url: "games/chess/index.html",
     isNew: true, // optional — shows a "New" badge
   },
   ```

   That's all — it appears on the home page automatically. The footer count, search,
   and category filters update from the array. Use a unique emoji; if you add a new
   category, its filter chip appears automatically.

---

## Notes

- High scores / tallies use `localStorage`, wrapped in a safe helper so a blocked
  storage API (possible when opened over `file://` in some browsers) degrades to a
  reset score instead of breaking the game.
- Favorites and recently played use the same safe `localStorage` wrapper; if storage
  is blocked, the portal still works and those features simply stay empty.
- **Themes** live entirely in `css/styles.css` as `[data-theme="…"]` variable blocks,
  applied to `<html>`. A tiny inline script in each page's `<head>` reads
  `offline-arcade:theme:v1` and sets `data-theme` before first paint (no flash).
  "System" removes the attribute so CSS falls back to `prefers-color-scheme`, then
  dark. Canvas game rendering keeps its own colors; themes restyle the surrounding UI.
- Pure HTML/CSS/JS — no dependencies, so it stays fast and future-proof offline.

---

## Verification

There is **no build step** — open `index.html` and play. For development, the
offline test suites live in `tests/` and need only Node.js:

```bash
npm test             # 13,700+ deterministic assertions across all 64 games
npm run test:layout  # console errors + overflow at 360/500/900/1200 px (needs Chrome)
npm run verify       # both
```

See [tests/README.md](tests/README.md) for details.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for adding games,
code style, and how the project is structured.

## Issues and questions

Found a bug, or have an idea for a game? Please
[open an issue on GitHub](../../issues). GitHub Issues is the only support channel
for this project.

## License

Copyright © 2026 Pete Hudson. Released under the [MIT License](LICENSE): you are
free to use, copy, modify and share it, including commercially, as long as the
copyright notice and license text stay with any copies.

## Credits

Created by **Pete Hudson**. Every game is an original implementation written for
this project. No third-party code, artwork, sounds or level designs are included:
all graphics are drawn in code, and all sound effects are generated in the browser.

Many of these games are versions of traditional or public-domain games. Where a
game is in the style of a commercial title, it uses its own name, art and levels,
and this project is not affiliated with or endorsed by the owner of that title.