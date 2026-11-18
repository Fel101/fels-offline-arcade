// Deterministic tests for games/tic-tac-toe/script.js
const fs = require("fs");

const listeners = {};
const elements = new Map();

function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c);
      else set.delete(c);
      return on;
    },
  };
}

function makeEl(tag = "div", id = "") {
  const el = {
    tagName: String(tag).toUpperCase(),
    id,
    children: [],
    parentNode: null,
    textContent: "",
    hidden: false,
    disabled: false,
    title: "",
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    _attrs: {},
    _listeners: {},
    classList: makeClassList(),
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      c.parentNode = null;
      return c;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    contains(n) {
      let x = n;
      while (x) {
        if (x === this) return true;
        x = x.parentNode;
      }
      return false;
    },
    closest() {
      return null;
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
      if (k.startsWith("data-")) {
        const key = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = String(v);
      }
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
    },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      (this._listeners[t] || []).forEach((fn) =>
        fn(Object.assign({ target: this, button: 0, preventDefault() {} }, ev))
      );
    },
    focus() {},
    querySelector(sel) {
      if (sel === ".ttt-cell__mark") {
        if (!this._markEl) this._markEl = makeEl("span");
        return this._markEl;
      }
      return makeEl("div");
    },
    querySelectorAll() {
      return [];
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return this.children[0] || null;
    },
  });
  let _className = "";
  Object.defineProperty(el, "className", {
    get() {
      return _className;
    },
    set(v) {
      _className = String(v);
      el.classList = makeClassList();
      _className.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
    },
  });
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html || "";
    },
    set(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
  });
  return el;
}

for (const id of [
  "board", "board-wrap", "countdown", "countdown-num", "you", "draws", "cpu",
  "streak", "time", "hint", "live", "new-game", "pause", "badges-btn",
  "badge-count", "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid",
  "achv-count", "achv-records", "badges2",
]) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("countdown").hidden = true;

const modeChips = ["classic", "blitz", "daily", "two"].map((m) => {
  const e = makeEl("button");
  e.dataset.mode = m;
  return e;
});
const diffChips = ["chill", "cunning", "ruthless"].map((d) => {
  const e = makeEl("button");
  e.dataset.diff = d;
  return e;
});

global.document = {
  body: makeEl("body"),
  documentElement: makeEl("html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  querySelector: (sel) => (sel === ".mode-chip" ? modeChips[0] : makeEl("div")),
  querySelectorAll: (sel) =>
    sel === ".mode-chip" ? modeChips : sel === ".diff-chip" ? diffChips : [],
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
};

global.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: (fn) => {
    if (typeof fn === "function") fn();
    return 1;
  },
  clearTimeout: () => {},
  requestAnimationFrame: () => 1,
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(0x7171);

const root = require("./_env").root;
const dir = root + "games/tic-tac-toe/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__TTT;
if (!T) {
  console.error("No test hook");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else {
    fail++;
    console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra));
  }
}
function eq(a, b, msg) {
  ok(a === b, msg, { actual: a, expected: b });
}

function play() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.paused = false;
  T.state.gameOver = false;
}

// ---------- A. Win detection ----------
{
  const w1 = T.winnerOf(["X", "X", "X", "", "", "", "", "", ""]);
  eq(w1 && w1.player, "X", "top row is a win for X");
  eq(JSON.stringify(w1.line), JSON.stringify([0, 1, 2]), "winning line reported");

  const w2 = T.winnerOf(["O", "", "", "O", "", "", "O", "", ""]);
  eq(w2 && w2.player, "O", "left column is a win for O");

  const w3 = T.winnerOf(["X", "", "", "", "X", "", "", "", "X"]);
  eq(w3 && w3.player, "X", "main diagonal is a win");

  const w4 = T.winnerOf(["", "", "X", "", "X", "", "X", "", ""]);
  eq(w4 && w4.player, "X", "anti-diagonal is a win");

  eq(T.winnerOf(["X", "O", "X", "", "", "", "", "", ""]), null, "no win on a mixed board");
}

// ---------- B. Minimax: perfect play never loses ----------
{
  // Exhaustively play the ruthless AI against every possible human line.
  let aiLosses = 0;
  let games = 0;

  function playOut(board, turn) {
    const w = T.winnerOf(board);
    if (w) {
      games++;
      if (w.player === "X") aiLosses++;
      return;
    }
    if (T.isFull(board)) {
      games++;
      return;
    }

    if (turn === "X") {
      for (let i = 0; i < 9; i++) {
        if (board[i]) continue;
        const next = board.slice();
        next[i] = "X";
        playOut(next, "O");
      }
      return;
    }

    // The AI plays its optimal move. Collect every optimal move so the
    // exploration covers all lines the AI could legitimately take.
    const probe = board.slice();
    let bestScore = -Infinity;
    let optimal = [];
    for (let i = 0; i < 9; i++) {
      if (probe[i]) continue;
      probe[i] = "O";
      const s = T.minimax(probe, "X", 0);
      probe[i] = "";
      if (s > bestScore) {
        bestScore = s;
        optimal = [i];
      } else if (s === bestScore) {
        optimal.push(i);
      }
    }
    for (const i of optimal) {
      const next = board.slice();
      next[i] = "O";
      playOut(next, "X");
    }
  }

  playOut(new Array(9).fill(""), "X");
  eq(aiLosses, 0, "the AI never loses with perfect play");
  ok(games > 100, "the exhaustive check explored many games", games);
}

// ---------- C. chooseAiMove returns a legal move ----------
{
  T.setMode("classic");
  T.setDiff("ruthless");
  T.newMatch();
  play();
  for (let t = 0; t < 30; t++) {
    T.state.board = new Array(9).fill("");
    T.state.board[0] = "X";
    T.state.board[4] = "O";
    const move = T.chooseAiMove();
    ok(move >= 0 && move < 9, `AI returns a valid index (${move})`);
    eq(T.state.board[move], "", `AI picks an empty square (${move})`);
  }
}

// ---------- D. Placing marks ----------
{
  T.setMode("two");
  T.newMatch();
  play();
  T.state.turn = "X";
  T.onCellClick(0);
  let s = T.snap();
  eq(s.board[0], "X", "X placed in square 0");
  eq(s.turn, "O", "turn passes to O");
  eq(s.plies, 1, "ply count increments");

  T.state.turn = "O";
  T.onCellClick(4);
  s = T.snap();
  eq(s.board[4], "O", "O placed in square 4");
  eq(s.turn, "X", "turn passes back to X");
}

// ---------- E. Occupied square rejects input ----------
{
  T.setMode("two");
  T.newMatch();
  play();
  T.state.turn = "X";
  T.onCellClick(0);
  const before = T.snap().board.slice();
  T.state.turn = "O";
  T.onCellClick(0); // already taken
  eq(JSON.stringify(T.snap().board), JSON.stringify(before), "an occupied square ignores input");
  eq(T.snap().plies, 1, "ply count unchanged");
}

// ---------- F. Winning a match ----------
{
  T.setMode("two");
  T.newMatch();
  play();
  // X takes the top row while O plays elsewhere.
  T.state.turn = "X";
  T.onCellClick(0);
  T.state.turn = "O";
  T.onCellClick(3);
  T.state.turn = "X";
  T.onCellClick(1);
  T.state.turn = "O";
  T.onCellClick(4);
  T.state.turn = "X";
  T.onCellClick(2);

  const s = T.snap();
  eq(s.gameOver, true, "three in a row ends the match");
  eq(s.winner, "X", "X is the winner");
  eq(JSON.stringify(s.line), JSON.stringify([0, 1, 2]), "winning line recorded");
  ok(s.stats.games >= 1, "game counted");
  ok(s.unlocked.includes("first"), "first game badge unlocked");
  ok(s.scores.you >= 1, "X win added to the score");
}

// ---------- G. Draw detection ----------
{
  T.setMode("two");
  T.newMatch();
  play();
  // A known drawn sequence.
  const seq = [0, 1, 2, 4, 3, 5, 7, 6, 8];
  let turn = "X";
  for (const i of seq) {
    T.state.turn = turn;
    T.onCellClick(i);
    if (T.snap().gameOver) break;
    turn = turn === "X" ? "O" : "X";
  }
  const s = T.snap();
  eq(s.gameOver, true, "the drawn sequence ends the match");
  eq(s.winner, "draw", "the match is a draw");
  ok(s.stats.draws >= 1, "draw counted");
  ok(s.unlocked.includes("draw1"), "draw badge unlocked");
}

// ---------- H. Blitz mode ----------
{
  T.setMode("blitz");
  T.newMatch();
  play();
  eq(Math.round(T.state.remaining / 1000), 120, "blitz is 120 seconds");
  eq(elements.get("time").textContent !== "", true, "timer element populated");

  // Time running out ends the round.
  let clock = 5000000;
  T.loop(clock);
  T.state.remaining = 40;
  T.loop(clock + 100);
  T.loop(clock + 200);
  const s = T.snap();
  eq(s.gameOver, true, "blitz time-out ends the round");
  eq(s.overlayTitle, "Time's up! ⏰", "blitz time-up overlay");

  T.setMode("classic");
  T.newMatch();
  play();
}

// ---------- I. Difficulty affects blunder rate ----------
{
  const rates = {};
  for (const d of ["chill", "cunning", "ruthless"]) {
    T.setDiff(d);
    T.newMatch();
    play();
    // Count how often the AI plays a non-optimal move.
    let nonOptimal = 0;
    const trials = 200;
    for (let t = 0; t < trials; t++) {
      T.state.board = new Array(9).fill("");
      T.state.board[0] = "X";
      T.state.board[8] = "X";
      const optimal = (() => {
        const probe = T.state.board.slice();
        let bestScore = -Infinity;
        let picks = [];
        for (let i = 0; i < 9; i++) {
          if (probe[i]) continue;
          probe[i] = "O";
          const s = T.minimax(probe, "X", 0);
          probe[i] = "";
          if (s > bestScore) {
            bestScore = s;
            picks = [i];
          } else if (s === bestScore) picks.push(i);
        }
        return picks;
      })();
      const move = T.chooseAiMove();
      if (!optimal.includes(move)) nonOptimal++;
    }
    rates[d] = nonOptimal / trials;
  }
  ok(rates.ruthless === 0, "ruthless never blunders", rates.ruthless);
  ok(rates.chill > rates.ruthless, "chill blunders more than ruthless", rates);
  ok(rates.cunning > rates.ruthless, "cunning blunders more than ruthless", rates);
}

// ---------- J. Daily determinism ----------
{
  T.setMode("daily");
  T.setDiff("ruthless");
  T.newMatch();
  play();

  // Same seed → same AI choice for the same board. A fresh match re-seeds,
  // so compare two matches rather than two calls in one match.
  const probe = ["X", "", "", "", "O", "", "", "", ""];

  T.state.board = probe.slice();
  const a = T.chooseAiMove();

  T.newMatch();
  play();
  T.state.board = probe.slice();
  const b = T.chooseAiMove();

  eq(a, b, "daily AI choice is deterministic across matches");
  eq(elements.get("new-game").disabled, true, "new game disabled in daily");

  T.setMode("classic");
  T.newMatch();
  play();
}

// ---------- K. Pause ----------
{
  T.setMode("classic");
  T.newMatch();
  play();
  T.state.elapsed = 5000;
  T.setPaused(true, true);
  eq(T.snap().paused, true, "pause sets the flag");
  const clock = 6000000;
  T.loop(clock);
  for (let i = 1; i <= 10; i++) T.loop(clock + i * 100);
  eq(T.state.elapsed, 5000, "pause freezes the clock");
  T.setPaused(false, true);
  eq(T.snap().paused, false, "resume clears the flag");
}

// ---------- L. Achievements ----------
{
  T.stats.wins = 50;
  T.stats.draws = 10;
  T.stats.bestStreak = 5;
  T.stats.ruthlessWins = 5;
  T.stats.chillWins = 5;
  T.stats.blitzWins = 3;
  T.stats.twoWins = 1;
  T.stats.quickWins = 1;
  T.stats.cornerWins = 1;
  T.stats.nightWins = 1;
  T.stats.flawless = 1;
  T.stats.games = 50;
  T.checkAchievements();

  const u = T.unlocked();
  for (const id of [
    "win1", "win10", "win50", "draw1", "draw10", "ruthless", "ruthless5",
    "chill", "blitz", "blitz3", "two", "streak3", "streak5", "quick",
    "corner", "night", "games10", "games50", "flawless",
  ]) {
    ok(u.includes(id), `badge ${id} unlocked`);
  }

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");
}

// ---------- M. Storage keys ----------
{
  ok(storage.has("tic-tac-toe-stats-v1"), "stats key present");
  ok(storage.has("tic-tac-toe-achv-v1"), "achievement key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("tic-tac-toe-best-v1-"));
  ok(bestKeys.length >= 1, "best records stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);