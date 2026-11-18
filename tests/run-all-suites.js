const { execSync } = require("child_process");
const suites = [
  "snake-test.js",
  "block-drop-test.js",
  "15p-test.js",
  "2048-test.js",
  "sudoku-test.js",
  "super-sudoku-test.js",
  "kakuro-test.js",
  "minesweeper-test.js",
  "road-hopper-test.js",
  "dominoes-test.js",
  "grand-tour-test.js",
  "letter-grid-test.js",
  "lights-out-test.js",
  "memory-test.js",
  "echo-test.js",
  "ttt-test.js",
  "wam-test.js",
  "paddle-ball-test.js",
  "brick-breaker-test.js",
  "nim-test.js",
  "hanoi-test.js",
  "peg-solitaire-test.js",
  "code-breaker-test.js",
  "four-in-a-row-test.js",
  "gomoku-test.js",
  "mancala-test.js",
  "farkle-test.js",
  "video-poker-test.js",
  "freecell-test.js",
  "nine-mens-morris-test.js",
  "alien-attack-test.js",
  "match-3-test.js",
  "maze-chase-test.js",
  "aim-trainer-test.js",
  "traffic-jam-test.js",
  "math-cages-test.js",
  "word-trace-test.js",
  "go-test.js",
  "backgammon-test.js",
  "tower-defense-test.js",
  "rune-defense-test.js",
  "hearts-test.js",
  "checkers-test.js",
  "reversi-test.js",
  "word-tile-test.js",
  "hangman-test.js",
  "word-ladder-test.js",
  "nonogram-test.js",
  "flow-test.js",
  "sokoban-test.js",
  "blackjack-test.js",
  "yacht-dice-test.js",
  "solitaire-test.js",
  "flappy-test.js",
  "stack-test.js",
  "light-trails-test.js",
  "cryptogram-test.js",
  "jumble-test.js",
  "word-search-test.js",
  "word-square-test.js",
  "sea-battle-test.js",
  "chess-test.js",
  "dots-and-boxes-test.js",
  "minesweeper-variants-test.js",
];
let totalPass = 0;
let totalFail = 0;
let bad = 0;
for (const f of suites) {
  let out = "";
  try {
    out = execSync(`node ${f}`, { encoding: "utf8", cwd: __dirname });
  } catch (e) {
    out = ((e.stdout || "") + (e.stderr || "")).toString();
  }
  const m = out.match(/(\d+) passed, (\d+) failed/);
  const p = m ? Number(m[1]) : 0;
  const fl = m ? Number(m[2]) : -1;
  totalPass += p;
  totalFail += Math.max(0, fl);
  if (fl !== 0) bad++;
  console.log(`${f.padEnd(24)} ${m ? m[0] : "NO RESULT"}`);
  if (fl !== 0) {
    const fails = out.split("\n").filter((l) => l.includes("FAIL:") || l.includes("INIT ERROR"));
    fails.slice(0, 8).forEach((l) => console.log("   " + l.trim().slice(0, 150)));
  }
}
console.log(`\nTOTAL: ${totalPass} passed, ${totalFail} failed across ${suites.length} suites (${bad} failing)`);
process.exit(bad ? 1 : 0);
