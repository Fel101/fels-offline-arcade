// Deterministic tests for games/fifteen-puzzle/script.js
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
    contains(node) {
      let n = node;
      while (n) {
        if (n === this) return true;
        n = n.parentNode;
      }
      return false;
    },
    closest() {
      return null;
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
      if (k.indexOf("data-") === 0) {
        const key = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = String(v);
      } else if (k === "class") {
        this.className = String(v);
      }
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    removeAttribute(k) {
      delete this._attrs[k];
    },
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
    },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign(
        { target: this, button: 0, preventDefault() {}, stopPropagation() {} },
        ev
      );
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    focus() {},
    querySelector(sel) {
      if (sel === ".pz-tile__num") {
        if (!this._numEl) this._numEl = makeEl("span");
        return this._numEl;
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
      _className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => el.classList.add(c));
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

const ids = [
  "board", "board-wrap", "countdown", "countdown-num", "time", "moves", "solved",
  "score", "hints", "best", "hint", "live", "new-game", "hint-btn", "pause",
  "finish", "badges-btn", "badge-count", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("countdown").hidden = true;
elements.get("finish").hidden = true;

const modeChips = ["classic", "attack", "daily", "zen"].map((m) => {
  const e = makeEl("button", "mode-" + m);
  e.dataset.mode = m;
  return e;
});
const diffChips = ["easy", "normal", "hard"].map((d) => {
  const e = makeEl("button", "diff-" + d);
  e.dataset.diff = d;
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    if (sel === ".overlay .btn") return makeEl("button");
    return makeEl("div");
  },
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".diff-chip") return diffChips;
    return [];
  },
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
};

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: () => 1,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
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
Math.random = mulberry32(0x715e);

const root = require("./_env").root;
const dir = root + "games/fifteen-puzzle/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__PZ;
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
function deepEq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg, { actual: a, expected: b });
}

function setBoard(n, tiles) {
  T.state.size = n;
  T.state.tiles = tiles.slice();
}

function play() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.paused = false;
  T.state.over = false;
}

/** Solve a board by repeatedly applying the hint until solved. */
function solveWithHints(limit) {
  let guard = 0;
  while (!T.isSolved() && guard++ < (limit || 2000)) {
    const pick = T.hintTileIndex();
    if (pick < 0) return false;
    T.onTileClick(pick);
    if (T.state.over) return false;
  }
  return T.isSolved();
}

// ---------- A. Solved detection ----------
{
  eq(T.isSolvedTiles([1, 2, 3, 4, 5, 6, 7, 8, 0], 3), true, "solved 3x3 detected");
  eq(T.isSolvedTiles([1, 2, 3, 4, 5, 6, 7, 0, 8], 3), false, "unsolved 3x3 detected");
  eq(T.isSolvedTiles([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), false, "swapped tiles not solved");
}

// ---------- B. Manhattan distance ----------
{
  eq(T.manhattan([1, 2, 3, 4, 5, 6, 7, 8, 0], 3), 0, "solved board has distance 0");
  eq(T.manhattan([1, 2, 3, 4, 5, 6, 0, 7, 8], 3), 2, "one swap gives distance 2");
  eq(T.manhattan([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), 2, "one swap gives distance 2");
}

// ---------- C. Scrambling always solvable ----------
/**
 * Parity test for a sliding puzzle with an odd-width board (3×3, 5×5):
 * solvable iff the inversion count is even.
 * For even width (4×4): solvable iff (inversions + blankRowFromBottom) is odd.
 */
function isSolvableParity(tiles, n) {
  const seq = tiles.filter((v) => v !== 0);
  let inversions = 0;
  for (let i = 0; i < seq.length; i++)
    for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) inversions++;
  if (n % 2 === 1) return inversions % 2 === 0;
  const blankRowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

{
  for (const [name, n, steps] of [["easy", 3, 40], ["normal", 4, 120], ["hard", 5, 260]]) {
    for (let i = 1; i <= 20; i++) {
      const tiles = T.scramble(mulberry32(i * 131 + n), n, steps);
      eq(tiles.length, n * n, `${name} scramble ${i} has the right length`);
      eq(new Set(tiles).size, n * n, `${name} scramble ${i} has no duplicate tiles`);
      ok(tiles.includes(0), `${name} scramble ${i} contains the blank`);
      eq(T.isSolvedTiles(tiles, n), false, `${name} scramble ${i} is not already solved`);
      ok(
        isSolvableParity(tiles, n),
        `${name} scramble ${i} is solvable (parity check)`
      );
    }
  }

  // And confirm the 3x3 hints actually drive a board to solved.
  for (let i = 1; i <= 10; i++) {
    const tiles = T.scramble(mulberry32(i * 131 + 3), 3, 40);
    setBoard(3, tiles);
    T.state.moves = 0;
    T.state.over = false;
    T.state.started = true;
    T.state.paused = false;
    T.state.history = [];
    const solved = solveWithHints(400);
    ok(solved, `3x3 scramble ${i} is solvable by following hints`);
  }
}

// ---------- D. Board sizes ----------
{
  T.setDiff("easy");
  T.newPuzzle();
  eq(T.state.size, 3, "easy is 3x3");
  eq(T.snap().cellEls, 9, "easy renders 9 cells");

  T.setDiff("normal");
  T.newPuzzle();
  eq(T.state.size, 4, "normal is 4x4");
  eq(T.snap().cellEls, 16, "normal renders 16 cells");

  T.setDiff("hard");
  T.newPuzzle();
  eq(T.state.size, 5, "hard is 5x5");
  eq(T.snap().cellEls, 25, "hard renders 25 cells");

  T.setDiff("easy");
  T.newPuzzle();
}

// ---------- E. Sliding ----------
{
  T.setMode("classic");
  T.newPuzzle();
  play();
  // Solved board with one tile out of place: 1 2 3 / 4 5 6 / 7 0 8
  setBoard(3, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  const blankBefore = T.blankIndex();
  eq(blankBefore, 7, "blank starts at index 7");

  // Tile 8 at index 8 is adjacent to the blank.
  T.onTileClick(8);
  const s = T.snap();
  eq(s.tiles[7], 8, "the tile slid into the blank");
  eq(s.tiles[8], 0, "the blank moved to the old tile position");
  eq(s.moves, 1, "a slide counts as a move");
  eq(s.solvedNow, true, "sliding the last tile solves the board");
}

// ---------- F. Clicking a distant tile does nothing ----------
{
  T.newPuzzle();
  play();
  setBoard(3, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  const before = T.state.tiles.slice();
  T.onTileClick(0); // corner, not adjacent to blank at 7
  deepEq(T.state.tiles, before, "a non-adjacent tile cannot move");
  eq(T.state.moves, 0, "a blocked click is not a move");
}

// ---------- G. Hints ----------
{
  T.setMode("classic");
  T.newPuzzle();
  play();
  setBoard(3, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  const before = T.snap();
  T.useHint();
  const s = T.snap();
  eq(s.hintsLeft, before.hintsLeft - 1, "a hint decrements the counter");
  eq(s.hintsUsed, 1, "hints used increments");
  ok(s.unlocked.includes("hint"), "hint badge unlocked");
  ok(s.stats.hintsUsed >= 1, "hint tracked in stats");
}

global.window.__PZ_DEBUG = true;
// ---------- H. Hint always returns a legal move ----------
{
  for (const [n, steps] of [[3, 40], [4, 120]]) {
    for (let i = 1; i <= 10; i++) {
      const tiles = T.scramble(mulberry32(i * 17 + n), n, steps);
      setBoard(n, tiles);
      T.state.over = false;
      T.state.history = [];
      const b = T.blankIndex();
      const pick = T.hintTileIndex();
      const bAfter = T.blankIndex();
      const dist = (() => {
        const br = Math.floor(bAfter / n);
        const bc = bAfter % n;
        const r = Math.floor(pick / n);
        const c = pick % n;
        return Math.abs(br - r) + Math.abs(bc - c);
      })();
      if (dist !== 1) {
        console.error(
          `  [probe] n=${n} i=${i} state.size=${T.state.size} blank=${b} pick=${pick} dist=${dist} tiles.len=${tiles.length}`
        );
        // What does the core think the board is?
        console.error("    greedy says:", T.findHint());
        console.error("    neighboursOfBlank:", JSON.stringify(T.neighboursOfBlank()));
        console.error("    T.state === live state?", T.state === global.window.__PZ.state);
        console.error("    snap().size:", T.snap().size, "snap().tiles.len:", T.snap().tiles.length);
        console.error("    blankIndex():", T.blankIndex());
        console.error("    first 6 tiles:", JSON.stringify(T.snap().tiles.slice(0, 6)));
        console.error(
          `    raw: bAfter=${bAfter} br=${Math.floor(bAfter / n)} bc=${bAfter % n} | pick=${pick} r=${Math.floor(pick / n)} c=${pick % n}`
        );
      }
      eq(dist, 1, `${n}x${n} board ${i} hint is adjacent to the blank`);
    }
  }
}
global.window.__PZ_DEBUG = false;

// ---------- I. Solving a board ----------
{
  T.setMode("classic");
  T.newPuzzle();
  play();
  setBoard(3, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  T.onTileClick(8);
  const s = T.snap();
  eq(s.solved, 1, "one puzzle solved");
  ok(s.stats.solves >= 1, "solve counted in stats");
  ok(s.unlocked.includes("first"), "first solve badge unlocked");
  ok(s.score > 0, "solving scores points");
}

// ---------- J. Daily determinism ----------
{
  T.setMode("daily");
  T.newPuzzle();
  const a = T.snap().tiles.slice();
  T.newPuzzle();
  const b = T.snap().tiles.slice();
  deepEq(a, b, "daily starting board is deterministic");
  eq(elements.get("new-game").disabled, true, "new board disabled in daily");

  // Solve it to record the streak.
  play();
  solveWithHints(400);
  const s = T.snap();
  eq(s.daily.streak, 1, "daily streak starts at 1");
  ok(s.stats.dailySolves >= 1, "daily solve counted");

  T.setMode("classic");
  T.newPuzzle();
  play();
}

// ---------- K. Time Attack ----------
{
  T.setMode("attack");
  T.newPuzzle();
  play();
  eq(Math.round(T.state.remaining / 1000), 60, "easy attack is 60 seconds");
  T.state.remaining = 3000;

  let clock = 2000000;
  T.loop(clock);
  for (let i = 1; i <= 20; i++) T.loop(clock + i * 100);
  ok(T.state.remaining < 3000, "attack timer counts down");

  T.state.remaining = 40;
  T.loop(clock + 3000);
  T.loop(clock + 3100);
  eq(T.snap().over, true, "time running out ends the round");

  T.setMode("classic");
  T.newPuzzle();
  play();
}

// ---------- L. Zen ----------
{
  T.setMode("zen");
  T.newPuzzle();
  play();
  eq(elements.get("finish").hidden, false, "finish visible in zen");
  eq(T.snap().remaining, 0, "zen has no clock");
  eq(T.snap().hintsLeft, Infinity, "zen has unlimited hints");
  T.endRound("manual");
  eq(T.snap().over, true, "manual zen finish ends the round");
  T.setMode("classic");
  T.newPuzzle();
  play();
}

// ---------- M. Pause ----------
{
  T.newPuzzle();
  play();
  T.state.elapsed = 4000;
  T.setPaused(true, true);
  eq(T.snap().paused, true, "pause sets the flag");
  const clock = 3000000;
  T.loop(clock);
  for (let i = 1; i <= 10; i++) T.loop(clock + i * 100);
  eq(T.state.elapsed, 4000, "pause freezes the clock");
  T.setPaused(false, true);
  eq(T.snap().paused, false, "resume clears the flag");
}

// ---------- N. Achievements ----------
{
  T.stats.solves = 50;
  T.stats.hardSolves = 10;
  T.stats.noHintSolves = 10;
  T.stats.attackBest = 3;
  T.stats.bestScore = 1000;
  T.stats.bestStreak = 3;
  T.stats.maxMoves = 300;
  T.stats.perfectSolves = 1;
  T.stats.comeback = 1;
  T.stats.efficient = 1;
  T.stats.speed = 1;
  T.stats.nightSolves = 1;
  T.stats.zenSolves = 1;
  T.stats.attackSolves = 1;
  T.checkAchievements();

  const u = T.unlocked();
  for (const id of [
    "first", "solves5", "solves20", "solves50", "hard", "hard10", "noHint",
    "noHint10", "attack", "attack3", "zen", "speed", "efficient", "night",
    "score400", "score1000", "streak3", "moves", "perfect", "comeback",
  ]) {
    ok(u.includes(id), `badge ${id} unlocked`);
  }

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");
}

// ---------- O. Storage keys ----------
{
  ok(storage.has("fifteen-puzzle-stats-v1"), "stats key present");
  ok(storage.has("fifteen-puzzle-achv-v1"), "achievement key present");
  const bestKeys = Array.from(storage.keys()).filter((k) =>
    k.startsWith("fifteen-puzzle-best-v1-")
  );
  ok(bestKeys.length >= 1, "best scores stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);