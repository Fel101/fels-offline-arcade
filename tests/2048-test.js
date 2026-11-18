// Deterministic tests for games/2048/script.js
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
      if (sel === ".g2048-cell__val") {
        if (!this._valEl) this._valEl = makeEl("span");
        return this._valEl;
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
  "board", "board-wrap", "countdown", "countdown-num", "score", "best", "top",
  "moves", "time", "hint", "live", "new-game", "undo", "pause", "badges-btn",
  "badge-count", "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid",
  "achv-count", "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("countdown").hidden = true;

const modeChips = ["classic", "sprint", "daily", "zen"].map((m) => {
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
Math.random = mulberry32(0x2048);

const root = require("./_env").root;
const dir = root + "games/2048/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__G2048;
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

function setBoard(rows) {
  T.state.grid = rows.map((r) => r.slice());
  T.state.size = rows.length;
}

function play() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.paused = false;
  T.state.over = false;
}

// ---------- A. Collapse logic ----------
{
  eq(JSON.stringify(T.collapse([2, 2, 2, 2]).line), JSON.stringify([4, 4, 0, 0]), "four 2s -> 4,4");
  eq(T.collapse([2, 2, 2, 2]).gained, 8, "four 2s score 8");
  eq(JSON.stringify(T.collapse([2, 2, 4, 0]).line), JSON.stringify([4, 4, 0, 0]), "2,2,4 -> 4,4 (no chain merge)");
  eq(T.collapse([4, 4, 8, 8]).gained, 24, "two pairs score 24");
  eq(JSON.stringify(T.collapse([2, 0, 2, 4]).line), JSON.stringify([4, 4, 0, 0]), "gaps collapse first");
  eq(JSON.stringify(T.collapse([0, 0, 0, 2]).line), JSON.stringify([2, 0, 0, 0]), "single tile slides left");
  eq(T.collapse([2, 4, 8, 16]).merged, 0, "no merges on a mixed line");
}

// ---------- B. Board sizes ----------
{
  T.setDiff("easy");
  T.resetGame();
  eq(T.state.size, 4, "easy is 4x4");
  eq(T.snap().cellEls, 16, "easy renders 16 cells");
  eq(T.state.grid.length, 4, "easy grid has 4 rows");

  T.setDiff("normal");
  T.resetGame();
  eq(T.state.size, 5, "normal is 5x5");
  eq(T.snap().cellEls, 25, "normal renders 25 cells");

  T.setDiff("hard");
  T.resetGame();
  eq(T.state.size, 5, "hard is 5x5");
  eq(T.snap().cellEls, 25, "hard renders 25 cells");

  T.setDiff("easy");
  T.resetGame();
}

// ---------- C. A fresh board has two tiles ----------
{
  T.setMode("classic");
  T.resetGame();
  const s = T.snap();
  const filled = s.grid.flat().filter(Boolean).length;
  eq(filled, 2, "a fresh board starts with 2 tiles");
  ok(s.grid.flat().every((v) => v === 0 || v === 2 || v === 4), "starting tiles are 2 or 4");
  eq(s.score, 0, "a fresh board scores 0");
}

// ---------- D. Moves ----------
{
  T.resetGame();
  play();
  setBoard([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const before = T.state.grid.flat().filter(Boolean).length;
  T.move("left");
  const s = T.snap();
  eq(s.grid[0][0], 4, "2,2 merges into a 4");
  eq(s.score, 4, "merging scores the new tile value");
  eq(s.moves, 1, "a successful move counts");
  eq(s.merges, 1, "a merge is counted");
  ok(s.grid.flat().filter(Boolean).length >= before, "a new tile spawned after the move");
}

// ---------- E. A no-op move doesn't count ----------
{
  T.resetGame();
  play();
  setBoard([
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const movesBefore = T.state.moves;
  T.move("left"); // already flush left, nothing can merge
  eq(T.state.moves, movesBefore, "a no-op move does not count");
}

// ---------- F. Undo ----------
{
  T.resetGame();
  play();
  setBoard([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  T.move("left");
  const afterMove = T.snap();
  eq(afterMove.historyLen, 1, "a move pushes a snapshot");

  T.undo();
  const afterUndo = T.snap();
  eq(afterUndo.moves, 0, "undo restores the move count");
  eq(afterUndo.score, 0, "undo restores the score");
  eq(afterUndo.grid[0][0], 2, "undo restores the board");
  ok(afterUndo.stats.undos >= 1, "undo is tracked in stats");
}

// ---------- G. Win at 2048 ----------
{
  T.resetGame();
  play();
  setBoard([
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  T.move("left");
  const s = T.snap();
  eq(s.topTile, 2048, "merging two 1024s makes 2048");
  eq(s.won, true, "reaching 2048 sets the win flag");
  eq(s.overlayTitle, "You win! 🎉", "win overlay shown");
  ok(s.stats.wins >= 1, "win counted in stats");
}

// ---------- H. Game over detection ----------
{
  T.resetGame();
  play();
  // A full board with no equal orthogonal neighbours is game over.
  setBoard([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  eq(T.canMove(), false, "a blocked board reports no moves");
}

// ---------- I. Timer ----------
{
  T.setMode("sprint");
  T.resetGame();
  play();
  eq(T.state.started, true, "playable");

  // The loop clamps dt to 100ms (tab-switch protection), so step frames.
  let clock = 1000000;
  T.loop(clock);
  for (let i = 1; i <= 30; i++) T.loop(clock + i * 100);
  ok(T.state.elapsed >= 2900, "the sprint clock runs up", T.state.elapsed);

  const beforePause = T.state.elapsed;
  T.setPaused(true, true);
  for (let i = 31; i <= 40; i++) T.loop(clock + i * 100);
  eq(T.state.elapsed, beforePause, "pause freezes the clock");
  T.setPaused(false, true);

  T.setMode("classic");
  T.resetGame();
  play();
}

// ---------- J. Zen keeps unlimited undo ----------
{
  T.setMode("zen");
  T.resetGame();
  play();
  setBoard([
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  T.move("left");
  T.move("down");
  T.move("right");
  T.move("up");
  const s = T.snap();
  ok(s.historyLen >= 3, "zen keeps every snapshot", s.historyLen);
  eq(s.historyLen, s.moves, "zen history matches the move count");

  T.setMode("classic");
  T.resetGame();
  play();
}

// ---------- K. Daily determinism ----------
{
  T.setMode("daily");
  T.resetGame();
  const a = T.snap();
  T.resetGame();
  const b = T.snap();
  eq(JSON.stringify(a.grid), JSON.stringify(b.grid), "daily starting grid is deterministic");

  // A finished daily game records the streak.
  T.state.started = true;
  T.state.score = 500;
  T.endGame("blocked");
  const s = T.snap();
  eq(s.daily.streak, 1, "daily streak starts at 1");
  ok(s.stats.dailySolves >= 1, "daily solve counted");

  T.setMode("classic");
  T.resetGame();
  play();
}

// ---------- L. Achievements ----------
{
  T.stats.topTile = 4096;
  T.stats.wins = 10;
  T.stats.bestScore = 20000;
  T.stats.maxMoves = 300;
  T.stats.merges = 2000;
  T.stats.undos = 25;
  T.stats.games = 10;
  T.stats.efficient = 1;
  T.stats.hardTop = 1024;
  T.stats.zenTop = 1024;
  T.stats.nightTop = 512;
  T.stats.comeback = 1;
  T.stats.sprintFast = 1;
  T.checkAchievements();

  const u = T.unlocked();
  for (const id of [
    "first", "tile128", "tile256", "tile512", "win", "win10", "tile4096",
    "score5000", "score20000", "moves100", "moves300", "sprint", "zen",
    "undo", "undo25", "night", "games", "efficient", "hard", "comeback",
    "totalMerges",
  ]) {
    ok(u.includes(id), `badge ${id} unlocked`);
  }

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");
}

// ---------- M. Storage keys ----------
{
  ok(storage.has("2048-stats-v1"), "stats key present");
  ok(storage.has("2048-achv-v1"), "achievement key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("2048-best-v1-"));
  ok(bestKeys.length >= 1, "best scores stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);