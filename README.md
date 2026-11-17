# 🎮 Offline Arcade

A self-contained, fully offline collection of browser games — a local take on the
"just a bunch of games to play" vibe. No server, no build step, no internet, no ads.
Just open `index.html` in any modern browser and pick a game.

## Running it

Open `index.html` in your browser (double-click it, or drag it into a tab). That's it.
No Node, no npm, nothing to install. Works from a local folder or a USB stick.

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

## Games (46)

| Game | Type | Play |
|------|------|------|
| 🐍 Snake | Arcade | 4 modes (Classic, Endless, Zen, Vs AI), combos, power-ups, 19 badges |
| 🧱 Tetris | Puzzle | Marathon, Sprint 40, or race an AI rival — combos, hold, 24 badges |
| 💣 Minesweeper | Logic | Classic, Time Attack, Daily or Zen — chording, 27 badges |
| 🔢 Sudoku | Puzzle | Classic, Time Attack, Daily or X-Sudoku — notes, hints, 28 badges |
| 🔢 Super Sudoku | Puzzle | Five overlapping cards — solve all five |
| 🧮 Kakuro | Puzzle | Fill each run so it matches the clue sums |
| 🔢 2048 | Puzzle | Merge tiles — 3 sizes, undo, 24 badges |
| 🧠 Memory | Pattern | Flip pairs — 4 modes, 3 sizes, 24 badges |
| 🔴 Connect Four | Strategy | Click a column vs the computer — 14 badges |
| ❌ Tic-Tac-Toe | Strategy | Perfect AI, 3 levels + 2-player — 24 badges |
| 🏓 Pong | Arcade | Mouse or ↑/↓ vs the computer — 14 badges |
| 🧨 Breakout | Arcade | Mouse or ◀/▶ — 14 badges |
| 🔨 Whack-a-Mole | Reflex | Whack moles, chain combos — 4 modes, 24 badges |
| ♠️ Blackjack | Card | Bet, hit, stand vs the dealer — 14 badges |
| ♟️ Chess | Strategy | Full rules — castling, en passant, promotion + AI |
| 🃏 Solitaire | Card | Klondike, click to move — 14 badges |
| 🚩 Minesweeper Variants | Logic | Classic flood-fill or Saturation mode |
| 🏍️ Tron | Arcade | Light-cycle duel vs the computer — 14 badges |
| 🟠 Checkers | Strategy | Mandatory captures vs the computer — 14 badges |
| 🁫 Dominoes | Strategy | Draw, Block or All Fives — 3 AI levels, 24 badges |
| ⚫ Othello | Strategy | Flip discs to your colour — 14 badges |
| 🚢 Battleship | Strategy | Hunt and sink the enemy fleet |
| 🪙 Nim | Strategy | Take 1–3 — perfect play vs the CPU, 14 badges |
| 🔷 Dots & Boxes | Strategy | Draw lines, claim the most boxes |
| 🧩 Nonogram | Logic | Solve the picture from the number clues — 14 badges |
| 🌀 Grand Tour | Logic | One loop through every dot — 4 difficulties, 24 badges |
| 🔤 Word Tile | Word | Guess the 5-letter word in 6 tries — 14 badges |
| 💡 Lights Out | Puzzle | One click toggles a cross — 3 sizes, 24 badges |
| 🧮 15 Puzzle | Puzzle | Slide into order — 3 sizes, hints, 24 badges |
| 🌈 Flow | Puzzle | Connect matching pipes, fill every cell — 14 badges |
| 🎵 Simon | Reflex | Repeat the sequence — 4 modes, 3 pad sets, 24 badges |
| 🎲 Yahtzee | Dice | Roll and re-roll — beat your best total. 14 badges |
| 🏗️ Stack | Arcade | Drop blocks on the tower — how high? 14 badges |
| 🐤 Flappy | Arcade | Tap to flap through the endless pipes — 14 badges |
| 🐸 Frogger | Arcade | Dodge traffic, ride logs, fill five home bays — 25 badges |
| 🔍 Word Search | Word | Find the hidden themed words — 14 badges |
| 🔡 Boggle | Word | Connect adjacent letters — 4×4 and 5×5, 24 badges |
| 🪢 Hangman | Word | Guess the word before the gallows completes — 14 badges |
| 🔀 Jumble | Word | Unscramble the letters from the clue — 14 badges |
| 🪜 Word Ladder | Word | Change one letter at a time — 14 badges |
| 🕵️ Cryptogram | Word | Decode the secret message — 14 badges |
| 🔠 Word Square | Word | Every row and column is a word |
| 🎯 Mastermind | Logic | Crack the color code — 14 badges |
| 🗼 Tower of Hanoi | Puzzle | Move the tower, ring by ring — 14 badges |
| 🟢 Peg Solitaire | Puzzle | Jump and remove, leave one peg — 14 badges |
| 📦 Sokoban | Puzzle | Push every box onto a target — 14 badges |

## Structure

```
index.html            ← portal home (auto-generated game grid)
css/styles.css        ← shared arcade styling
js/arcade-core.js     ← shared game engine (storage, audio, badges, toasts…)
games/
  snake/              ← one folder per game
    index.html         ← markup + layout
    script.js          ← game logic (self-contained IIFE)
  tetris/
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
`games/boggle/words.js` holds the offline dictionary.

## Adding a new game (game #47+)

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
