// Deterministic tests for games/lights-out/script.js
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
    querySelector() {
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
  "board", "board-wrap", "countdown", "countdown-num", "time", "moves", "lights",
  "score", "solved", "hints", "best", "hint", "live", "pause", "hint-btn",
  "new-game", "finish", "badges-btn", "badge-count", "sound-btn", "sound-icon",
  "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2",
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
Math.random = mulberry32(0x1234);

const root = require("./_env").root;
const dir = root + "games/lights-out/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__LO;
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

function setPlayable() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.over = false;
  T.state.paused = false;
}

/** Brute force: try every subset of presses for small boards. */
function bruteForceMinPresses(grid, n) {
  const N = n * n;
  let best = Infinity;
  for (let mask = 0; mask < 1 << N; mask++) {
    const g = grid.slice();
    let presses = 0;
    for (let i = 0; i < N; i++) {
      if (mask & (1 << i)) {
        T.applyPress(g, i, n);
        presses++;
      }
    }
    if (presses >= best) continue;
    if (g.every((v) => !v)) best = presses;
  }
  return best === Infinity ? null : best;
}

// ---------- A. Neighbours ----------
{
  // 3x3, corner 0 -> itself + right + down
  deepEq(T.neighbours(0, 3).sort((a, b) => a - b), [0, 1, 3], "corner neighbours");
  // centre 4 -> plus shape
  deepEq(T.neighbours(4, 3).sort((a, b) => a - b), [1, 3, 4, 5, 7], "centre neighbours");
  // edge 1 -> itself, left, right, down
  deepEq(T.neighbours(1, 3).sort((a, b) => a - b), [0, 1, 2, 4], "edge neighbours");
}

// ---------- B. Solver correctness vs brute force ----------
{
  for (const n of [3, 4]) {
    const N = n * n;
    // Every board reachable by pressing a random set — solver must solve it,
    // and its move count must equal the brute-force minimum.
    for (let trial = 0; trial < 40; trial++) {
      const rand = mulberry32(trial * 31 + n);
      const grid = T.generatePuzzle(rand, n, 1 + Math.floor(rand() * N));
      const sol = T.solveLights(grid, n);
      ok(sol !== null, `solver returns a solution for ${n}x${n} trial ${trial}`);
      if (!sol) continue;
      const g = grid.slice();
      for (const i of sol) T.applyPress(g, i, n);
      ok(g.every((v) => !v), `solution ${sol} clears ${n}x${n} trial ${trial}`);
      const bf = bruteForceMinPresses(grid, n);
      eq(sol.length, bf, `${n}x${n} trial ${trial} solution is minimum weight`);
    }
  }
}

// ---------- C. 5x5 solver always solves ----------
{
  for (let trial = 0; trial < 25; trial++) {
    const rand = mulberry32(trial * 977 + 5);
    const grid = T.generatePuzzle(rand, 5, 5 + (trial % 10));
    const sol = T.solveLights(grid, 5);
    ok(sol !== null, `5x5 trial ${trial} solvable`);
    if (!sol) continue;
    const g = grid.slice();
    for (const i of sol) T.applyPress(g, i, 5);
    ok(g.every((v) => !v), `5x5 solution ${sol.length} clears trial ${trial}`);
  }
}

// ---------- D. Generation is solvable and not already solved ----------
{
  for (const [diff, n] of [["easy", 3], ["normal", 4], ["hard", 5]]) {
    for (let i = 1; i <= 15; i++) {
      const grid = T.generatePuzzle(mulberry32(i * 13 + n), n, 8);
      ok(!grid.every((v) => !v), `${diff} board ${i} starts unsolved`);
      const sol = T.solveLights(grid, n);
      ok(sol !== null && sol.length > 0, `${diff} board ${i} is solvable`);
    }
  }
}

// ---------- E. Board sizes ----------
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

// ---------- F. Clicking toggles correctly ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const before = T.snap();
  const n = before.size;
  const i = 4;
  const expected = before.grid.slice();
  for (const j of T.neighbours(i, n)) expected[j] = !expected[j];
  T.onCellClick(i);
  const after = T.snap();
  deepEq(after.grid, expected, "click toggles the cell and its neighbours");
  eq(after.moves, 1, "click counts as a move");
  eq(after.lights, expected.filter(Boolean).length, "light count matches the grid");
}

// ---------- G. Solving a board ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  const s = T.snap();
  const sol = T.solveLights(s.initial, s.size);
  ok(!!sol && sol.length > 0, "initial board has a solution");
  for (const i of sol) T.onCellClick(i);
  let snap = T.snap();
  eq(snap.lights, 0, "board is cleared after the solution");
  eq(snap.moves, sol.length, "solution takes exactly par moves");
  eq(snap.perfect, true, "optimal solution keeps the perfect flag");
  eq(snap.solved, 1, "one board solved");
  ok(snap.stats.perfect >= 1, "optimal badge stat incremented");
  ok(snap.unlocked.includes("first"), "first board badge unlocked");
  ok(snap.unlocked.includes("perfect"), "optimal badge unlocked");
  ok(snap.score > 0, "score is positive");
}

// ---------- H. Hints ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const before = T.snap();
  T.useHint();
  let snap = T.snap();
  eq(snap.hintsLeft, before.hintsLeft - 1, "hint decrements the counter");
  eq(snap.hintsUsed, 1, "hint increments hints used");
  ok(snap.unlocked.includes("hint"), "hint badge unlocked");

  // Hint after a deviation must still be correct.
  T.newPuzzle();
  setPlayable();
  T.onCellClick(0);
  const beforeHint = T.snap();
  const solNow = T.solveLights(beforeHint.grid, beforeHint.size);
  ok(solNow !== null && solNow.length > 0, "board still solvable after a wrong press");
  T.useHint();
  snap = T.snap();
  eq(snap.hintsUsed, beforeHint.hintsUsed + 1, "hint works after a deviation");

  // Zen is unlimited.
  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  eq(T.snap().hintsLeft, Infinity, "zen has unlimited hints");
  T.useHint();
  eq(T.snap().hintsLeft, Infinity, "zen hint does not run out");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- I. Daily determinism ----------
{
  T.setDiff("normal");
  T.setMode("daily");
  T.newPuzzle();
  const a = T.snap();
  T.newPuzzle();
  const b = T.snap();
  deepEq(a.grid, b.grid, "daily grid is deterministic");
  deepEq(a.initial, b.initial, "daily initial grid is deterministic");
  eq(elements.get("new-game").disabled, true, "new board disabled in daily");

  setPlayable();
  const sol = T.solveLights(T.snap().initial, T.snap().size);
  for (const i of sol) T.onCellClick(i);
  const snap = T.snap();
  eq(snap.over, true, "daily ends after one solve");
  eq(snap.daily.streak, 1, "daily streak starts at 1");
  ok(snap.stats.dailySolves >= 1, "daily solve counted");
  ok(snap.unlocked.includes("daily"), "daily badge unlocked");

  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- J. Time Attack countdown ----------
{
  T.setMode("attack");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  eq(Math.round(T.state.remaining / 1000), 90, "easy attack is 90 seconds");
  const s = T.state;
  s.remaining = 3000;
  const start = performance.now();
  T.loop(start);
  T.loop(start + 1000);
  T.loop(start + 2000);
  ok(s.remaining < 3000, "attack timer counts down");

  const beforePause = s.remaining;
  T.setPaused(true, true);
  T.loop(start + 4000);
  eq(s.remaining, beforePause, "pause freezes the attack timer");
  T.setPaused(false, true);

  s.remaining = 50;
  T.loop(start + 5000);
  T.loop(start + 5100);
  const lost = T.snap();
  eq(lost.over, true, "time running out ends the round");
  eq(lost.overlayTitle, "Time's up! ⏰", "time-up overlay shown");

  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- K. Difficulty attack times ----------
{
  T.setMode("attack");
  T.setDiff("normal");
  T.newPuzzle();
  eq(Math.round(T.state.remaining / 1000), 120, "normal attack is 120 seconds");
  T.setDiff("hard");
  T.newPuzzle();
  eq(Math.round(T.state.remaining / 1000), 150, "hard attack is 150 seconds");
  T.setDiff("easy");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- L. Zen finish ----------
{
  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  eq(elements.get("finish").hidden, false, "finish visible in zen");
  eq(T.snap().remaining, 0, "zen has no countdown");

  // Solve one Zen board so the Zen Master badge is earned.
  const zenSol = T.solveLights(T.state.initial, T.state.size);
  for (const i of zenSol) T.onCellClick(i);
  eq(T.snap().solved, 1, "zen board solved");

  T.newPuzzle();
  setPlayable();
  T.endRound("manual");
  const snap = T.snap();
  eq(snap.over, true, "manual zen finish ends the round");
  ok(snap.unlocked.includes("zen"), "zen badge unlocked");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- M. Pause ----------
{
  T.newPuzzle();
  setPlayable();
  T.state.elapsed = 4000;
  T.setPaused(true, true);
  eq(T.snap().paused, true, "pause sets the flag");
  const t = performance.now();
  T.loop(t);
  T.loop(t + 1000);
  eq(T.state.elapsed, 4000, "pause freezes the clock");
  T.setPaused(false, true);
  eq(T.snap().paused, false, "resume clears the flag");
}

// ---------- N. Achievements by stat ----------
{
  T.stats.solved = 50;
  T.checkAchievements();
  ok(T.unlocked().includes("solved10"), "10 solved badge");
  ok(T.unlocked().includes("solved50"), "50 solved badge");

  T.stats.perfect = 10;
  T.checkAchievements();
  ok(T.unlocked().includes("perfect10"), "10 optimal badge");

  T.stats.hardWins = 10;
  T.checkAchievements();
  ok(T.unlocked().includes("hard10"), "10 hard badge");

  T.stats.attackBest = 5;
  T.checkAchievements();
  ok(T.unlocked().includes("attack5"), "blitz badge");

  T.stats.bestScore = 800;
  T.checkAchievements();
  ok(T.unlocked().includes("score300"), "300 score badge");
  ok(T.unlocked().includes("score800"), "800 score badge");

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");

  T.stats.bestStreak = 5;
  T.checkAchievements();
  ok(T.unlocked().includes("streak5"), "5 streak badge");

  T.stats.noHintWins = 10;
  T.checkAchievements();
  ok(T.unlocked().includes("noHint10"), "10 no-hint badge");
}

// ---------- O. Storage keys ----------
{
  ok(storage.has("lights-out-stats-v1"), "stats key present");
  ok(storage.has("lights-out-achv-v1"), "achievement key present");
  ok(storage.has("lights-out-daily-v1"), "daily key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("lights-out-best-v1-"));
  ok(bestKeys.length >= 1, "best scores stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);