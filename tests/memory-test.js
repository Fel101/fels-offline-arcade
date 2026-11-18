// Deterministic tests for games/memory/script.js (built on js/arcade-core.js)
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
    querySelector(sel) {
      if (sel === ".mem-card__face--front") {
        const s = makeEl("span");
        return s;
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
  "board", "board-wrap", "countdown", "countdown-num", "time", "moves", "pairs",
  "score", "hints", "best", "hint", "live", "pause", "hint-btn", "new-game",
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
Math.random = mulberry32(0xbeef);

const root = require("./_env").root;
const dir = root + "games/memory/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__MEM;
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

function setPlayable() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.over = false;
  T.state.paused = false;
  T.state.lock = false;
}

function pairIndex(emoji) {
  return T.state.deck.map((c, i) => (c.emoji === emoji ? i : -1)).filter((i) => i >= 0);
}

function solveBoard() {
  const seen = new Set();
  for (const card of T.state.deck) {
    if (seen.has(card.emoji)) continue;
    seen.add(card.emoji);
    const idx = pairIndex(card.emoji);
    T.onCardClick(idx[0]);
    T.onCardClick(idx[1]);
  }
}

// ---------- A. Deck generation ----------
{
  T.setDiff("easy");
  T.newPuzzle();
  let s = T.snap();
  eq(s.deck.length, 12, "easy deck has 12 cards");
  eq(new Set(s.deck).size, 6, "easy deck has 6 unique emojis");
  const counts = {};
  for (const e of s.deck) counts[e] = (counts[e] || 0) + 1;
  ok(Object.values(counts).every((n) => n === 2), "every easy emoji appears exactly twice");

  T.setDiff("normal");
  T.newPuzzle();
  s = T.snap();
  eq(s.deck.length, 16, "normal deck has 16 cards");
  eq(new Set(s.deck).size, 8, "normal deck has 8 unique emojis");

  T.setDiff("hard");
  T.newPuzzle();
  s = T.snap();
  eq(s.deck.length, 20, "hard deck has 20 cards");
  eq(new Set(s.deck).size, 10, "hard deck has 10 unique emojis");
}

// ---------- B. Daily is deterministic ----------
{
  T.setDiff("normal");
  T.setMode("daily");
  T.newPuzzle();
  const a = T.snap();
  T.newPuzzle();
  const b = T.snap();
  eq(JSON.stringify(a.deck), JSON.stringify(b.deck), "daily deck is deterministic");
  eq(elements.get("new-game").disabled, true, "new board disabled in daily");
}

// ---------- C. Core flip logic ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  const s = T.snap();
  const emoji = s.deck[0];
  const idx = pairIndex(emoji);
  ok(idx.length === 2, "found a matching pair");

  T.onCardClick(idx[0]);
  let snap = T.snap();
  eq(snap.flipped.length, 1, "first flip is recorded");
  eq(snap.moves, 0, "one card does not count as a move");

  T.onCardClick(idx[0]);
  snap = T.snap();
  eq(snap.flipped.length, 0, "clicking the same card flips it back");
  eq(snap.moves, 0, "flipping back is not a move");

  T.onCardClick(idx[0]);
  T.onCardClick(idx[1]);
  snap = T.snap();
  eq(snap.matched.length, 2, "matching pair is matched");
  eq(snap.moves, 1, "matching pair counts as one move");
  eq(snap.flipped.length, 0, "flipped list clears after a match");
  eq(snap.score > 0, true, "score is positive after a match");
  ok(snap.unlocked.includes("first"), "first pair badge unlocked");
}

// ---------- D. Wrong pair flips back ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  const s = T.snap();
  const a0 = 0;
  let b0 = -1;
  for (let i = 0; i < s.deck.length; i++) {
    if (i !== a0 && s.deck[i] !== s.deck[a0]) {
      b0 = i;
      break;
    }
  }
  ok(b0 >= 0, "found a non-matching card");

  T.onCardClick(a0);
  T.onCardClick(b0);
  let snap = T.snap();
  eq(snap.moves, 1, "wrong pair counts as a move");
  eq(snap.misses, 1, "wrong pair increments misses");
  eq(snap.perfect, false, "perfect flag cleared");
  eq(snap.lock, true, "board locks while the wrong pair is showing");

  // Simulate the timeout firing.
  T.state.flipped = [];
  T.state.lock = false;
  snap = T.snap();
  eq(snap.matched.length, 0, "no cards matched on a wrong pair");
}

// ---------- E. Peek ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const before = T.snap();
  T.usePeek();
  let snap = T.snap();
  eq(snap.hintsLeft, before.hintsLeft - 1, "peek decrements the counter");
  eq(snap.hintsUsed, 1, "peek increments hints used");
  ok(snap.stats.hintsUsed >= 1, "peek counted in stats");
  ok(snap.unlocked.includes("hint"), "peek badge unlocked");

  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  eq(T.snap().hintsLeft, Infinity, "zen has unlimited peeks");
  T.usePeek();
  eq(T.snap().hintsLeft, Infinity, "zen peeks do not run out");

  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- F. Solving a board ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  solveBoard();
  const snap = T.snap();
  eq(snap.matched.length, 12, "solving matches every card");
  eq(snap.moves, 6, "perfect solve takes exactly 6 moves");
  eq(snap.over, true, "solving ends the round");
  eq(snap.overlayTitle, "Flawless! ✨", "perfect solve shows the flawless overlay");
  ok(snap.stats.boards >= 1, "board counted");
  ok(snap.stats.perfect >= 1, "perfect board counted");
  ok(snap.unlocked.includes("board1"), "first board badge unlocked");
  ok(snap.unlocked.includes("perfect"), "flawless badge unlocked");
  ok(storage.has("memory-best-v1-classic-easy"), "best score persisted");
  ok(storage.has("memory-stats-v1"), "stats persisted");
  ok(snap.overlayMsg.includes("Score"), "overlay reports the score");
}

// ---------- G. Scoring ----------
{
  eq(T.computeScore.call(null), T.computeScore(), "computeScore is callable");
  T.setMode("classic");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  eq(T.snap().score, 0, "a fresh board scores 0");
  solveBoard();
  const s = T.snap();
  ok(s.score >= 60, "perfect easy board scores at least 60", s.score);
}

// ---------- H. Time Attack countdown ----------
{
  T.setMode("attack");
  T.setDiff("easy");
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  eq(Math.round(s.remaining / 1000), 60, "easy attack is 60 seconds");

  s.remaining = 3000;
  const start = performance.now();
  T.loop(start);
  T.loop(start + 1000);
  T.loop(start + 2000);
  ok(s.remaining < 3000, "attack timer counts down");
  ok(s.remaining > 0, "attack timer still running");

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
}

// ---------- I. Difficulty timings ----------
{
  T.setMode("attack");
  T.setDiff("normal");
  T.newPuzzle();
  eq(Math.round(T.state.remaining / 1000), 90, "normal attack is 90 seconds");
  T.setDiff("hard");
  T.newPuzzle();
  eq(Math.round(T.state.remaining / 1000), 120, "hard attack is 120 seconds");
  T.setDiff("easy");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- J. Zen finish ----------
{
  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  eq(elements.get("finish").hidden, false, "finish visible in zen");
  eq(T.snap().remaining, 0, "zen has no countdown");
  T.endRound("manual");
  const snap = T.snap();
  eq(snap.over, true, "manual zen finish ends the round");
  eq(snap.overlayTitle, "Round Complete", "manual finish overlay");
  ok(snap.unlocked.includes("zen"), "zen badge unlocked");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- K. Daily streak ----------
{
  T.daily.lastDate = "";
  T.daily.streak = 0;
  T.daily.history = {};
  T.setMode("daily");
  T.newPuzzle();
  setPlayable();
  solveBoard();
  const snap = T.snap();
  eq(snap.daily.streak, 1, "daily streak starts at 1");
  ok(snap.stats.dailySolves >= 1, "daily solve counted");
  ok(snap.unlocked.includes("daily"), "daily badge unlocked");

  T.newPuzzle();
  setPlayable();
  solveBoard();
  eq(T.snap().daily.streak, 1, "same-day daily does not double-count");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- L. Achievements by stat ----------
{
  T.stats.boards = 50;
  T.checkAchievements();
  ok(T.unlocked().includes("board10"), "10 boards badge unlocked");
  ok(T.unlocked().includes("board50"), "50 boards badge unlocked");

  T.stats.pairs = 100;
  T.checkAchievements();
  ok(T.unlocked().includes("pairs100"), "100 pairs badge unlocked");

  T.stats.bestScore = 900;
  T.checkAchievements();
  ok(T.unlocked().includes("score500"), "500 point badge unlocked");
  ok(T.unlocked().includes("score900"), "900 point badge unlocked");

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge unlocked");

  T.stats.bestStreak = 3;
  T.checkAchievements();
  ok(T.unlocked().includes("streak3"), "3 streak badge unlocked");
}

// ---------- M. Pause behaviour ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  T.state.elapsed = 5000;
  T.setPaused(true, true);
  eq(T.snap().paused, true, "pause sets the paused flag");
  const t = performance.now();
  T.loop(t);
  T.loop(t + 1000);
  eq(T.state.elapsed, 5000, "pause freezes the clock");
  T.setPaused(false, true);
  eq(T.snap().paused, false, "resume clears the paused flag");
}

// ---------- N. Storage keys ----------
{
  ok(storage.has("memory-stats-v1"), "stats key present");
  ok(storage.has("memory-achv-v1"), "achievement key present");
  ok(storage.has("memory-daily-v1"), "daily key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("memory-best-v1-"));
  ok(bestKeys.length >= 1, "best scores stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);