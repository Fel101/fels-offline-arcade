# 🎮 Offline Arcade

A self-contained, fully offline collection of browser games — a local take on the
"just a bunch of games to play" vibe. No server, no build step, no internet, no ads.
Just open `index.html` in any modern browser and pick a game.

## Running it

Open `index.html` in your browser (double-click it, or drag it into a tab). That's it.
No Node, no npm, nothing to install. Works from a local folder or a USB stick.

## Games (40)

| Game | Type | Play |
|------|------|------|
| 🐍 Snake | Arcade | Arrow keys / WASD + on-screen pad |
| 🧱 Tetris | Puzzle | Move, rotate, soft/hard drop, pause |
| 💣 Minesweeper | Logic | Left-click reveal, right-click flag |
| 🔢 Sudoku | Puzzle | Click a cell, type or use the numpad |
| ➡️ 2048 | Puzzle | Arrows / WASD / swipe |
| 🧠 Memory | Pattern | Click cards to flip and match |
| 🔴 Connect Four | Strategy | Click a column vs the computer |
| ❌ Tic-Tac-Toe | Strategy | Unbeatable AI |
| 🏓 Pong | Arcade | Mouse or ↑/↓ vs the computer |
| 🧨 Breakout | Arcade | Mouse or ◀/▶ |
| 🔨 Whack-a-Mole | Reflex | Click moles in 30 seconds |
| ♠️ Blackjack | Card | Bet, hit, stand vs the dealer |
| ♟️ Chess | Strategy | Full rules — castling, en passant, promotion + AI |
| 🃏 Solitaire | Card | Klondike, click to move |
| 🚩 Minesweeper Variants | Logic | Classic flood-fill or Saturation mode |
| 🏍️ Tron | Arcade | Light-cycle duel vs the computer |
| 🟠 Checkers | Strategy | Mandatory captures vs the computer |
| ⚫ Othello | Strategy | Flip discs to your color |
| 🚢 Battleship | Strategy | Hunt and sink the enemy fleet |
| 🪙 Nim | Strategy | Take 1–3 — perfect play vs the CPU |
| 🔷 Dots & Boxes | Strategy | Draw lines, claim the most boxes |
| 🧩 Nonogram | Logic | Solve the picture from the number clues |
| 🔤 Word Tile | Word | Guess the 5-letter word in 6 tries |
| 💡 Lights Out | Puzzle | Toggle the grid until all lights are off |
| 🧮 15 Puzzle | Puzzle | Slide the tiles back into order |
| 🌈 Flow | Puzzle | Connect matching pipes, fill every cell |
| 🎶 Simon | Reflex | Repeat the growing color-tone sequence |
| 🎲 Yahtzee | Dice | Roll and re-roll — beat your best total |
| 🏗️ Stack | Arcade | Drop blocks on the tower — how high? |
| 🐤 Flappy | Arcade | Tap to flap through the endless pipes |
| 🔍 Word Search | Word | Find the hidden themed words |
| 🪢 Hangman | Word | Guess the word before the gallows completes |
| 🔀 Jumble | Word | Unscramble the letters from the clue |
| 🪜 Word Ladder | Word | Change one letter at a time |
| 🕵️ Cryptogram | Word | Decode the secret message |
| 🔠 Word Square | Word | Every row and column is a word |
| 🎯 Mastermind | Logic | Crack the color code |
| 🗼 Tower of Hanoi | Puzzle | Move the tower, ring by ring |
| 🟢 Peg Solitaire | Puzzle | Jump and remove — leave one peg |
| 📦 Sokoban | Puzzle | Push every box onto a target |

## Structure

```
index.html            ← portal home (auto-generated game grid)
css/styles.css        ← shared arcade styling
games/
  snake/              ← one folder per game
    index.html         ← markup + layout
    script.js          ← game logic (self-contained IIFE)
  tetris/
  ...
```

Each game is **isolated** in its own folder with a "← Back to Games" button, so games
never interfere with each other.

## Adding a new game (game #41+)

1. Create `games/<name>/index.html` and `games/<name>/script.js`.
   Copy any existing game's `index.html` as a starting point — it already has the
   shared header, back button, status bar, canvas/board markup, and overlay styling.
2. In `index.html`, add one line to the `GAMES` array:

   ```js
   { name: "chess", emoji: "♟️", desc: "...", url: "games/chess/index.html" },
   ```

That's all — it appears on the home page automatically.

## Notes

- High scores / tallies use `localStorage`, wrapped in a safe helper so a blocked
  storage API (possible when opened over `file://` in some browsers) degrades to a
  reset score instead of breaking the game.
- Pure HTML/CSS/JS — no dependencies, so it stays fast and future-proof offline.
