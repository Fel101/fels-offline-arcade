// Deterministic tests for games/whack-a-mole/script.js
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
      return makeEl("span");
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
  "board", "board-wrap", "countdown", "countdown-num", "time", "score", "combo",
  "hits", "misses", "best", "combo-fill", "hint", "live", "start", "pause",
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
Math.random = mulberry32(0x9e37);

const root = require("./_env").root;
const dir = root + "games/whack-a-mole/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__WAM;
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

function startPlaying() {
  T.startRound();
  T.state.started = true;
  T.state.countdown = 0;
  T.state.over = false;
  T.state.paused = false;
}

/** Force a mole up in a specific hole. */
function putMole(i, kind) {
  T.state.holes[i] = kind || "mole";
  T.state[`hide_${i}`] = T.state.elapsed + 999999;
}

// ---------- A. Board size ----------
{
  T.setDiff("easy");
  T.resetRound();
  eq(T.state.cols, 3, "easy is 3 columns");
  eq(T.snap().cellEls, 9, "easy renders 9 holes");

  T.setDiff("normal");
  T.resetRound();
  eq(T.snap().cellEls, 9, "normal renders 9 holes");

  T.setDiff("hard");
  T.resetRound();
  eq(T.state.cols, 4, "hard is 4 columns");
  eq(T.snap().cellEls, 16, "hard renders 16 holes");

  T.setDiff("easy");
  T.resetRound();
}

// ---------- B. Timings ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.resetRound();
  eq(Math.round(T.state.remaining / 1000), 30, "classic is 30 seconds");

  T.setMode("attack");
  T.resetRound();
  eq(Math.round(T.state.remaining / 1000), 60, "rush is 60 seconds");

  // Rush ramps: later timings are shorter than the base.
  const base = T.timing();
  T.state.elapsed = 50000;
  const late = T.timing();
  ok(late.spawnMax < base.spawnMax, "rush spawn interval shrinks over time");
  ok(late.holdMax < base.holdMax, "rush hold time shrinks over time");

  T.setDiff("hard");
  T.resetRound();
  const hardTiming = T.timing();
  ok(hardTiming.bombChance > 0, "hard mode spawns bombs");

  T.setDiff("easy");
  T.resetRound();
  eq(T.timing().bombChance, 0, "easy mode has no bombs");
  T.setMode("classic");
  T.resetRound();
}

// ---------- C. Whacking a mole ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  startPlaying();
  putMole(0, "mole");
  T.onHoleClick(0);
  const s = T.snap();
  eq(s.hits, 1, "whacking a mole scores a hit");
  eq(s.score > 0, true, "whacking scores points");
  eq(s.holes[0], null, "the mole disappears after being hit");
  ok(s.stats.hits >= 1, "total hits tracked");
  ok(s.unlocked.includes("first"), "first whack badge unlocked");
}

// ---------- D. Missing an empty hole ----------
{
  startPlaying();
  const before = T.snap();
  T.onHoleClick(4);
  const s = T.snap();
  eq(s.misses, before.misses + 1, "clicking an empty hole counts as a miss");
  eq(s.combo, 1, "a miss breaks the combo");
  eq(s.score, before.score, "a miss does not score");
}

// ---------- E. Bombs ----------
{
  T.setDiff("hard");
  startPlaying();
  T.state.score = 100;
  putMole(0, "bomb");
  T.onHoleClick(0);
  const s = T.snap();
  eq(s.bombsHit, 1, "hitting a bomb is counted");
  eq(s.score, 75, "a bomb costs 25 points");
  eq(s.combo, 1, "a bomb breaks the combo");
  eq(s.holes[0], null, "the bomb disappears");
  ok(s.stats.bombsHit >= 1, "bomb hits tracked in stats");

  // Score can't go below zero.
  T.state.score = 10;
  putMole(1, "bomb");
  T.onHoleClick(1);
  eq(T.snap().score, 0, "score floors at zero after a bomb");
  T.setDiff("easy");
  startPlaying();
}

// ---------- F. Combos ----------
{
  startPlaying();
  eq(T.comboMultiplier(), 1, "a fresh combo is x1");

  // Land hits quickly, within the combo window.
  let i = 0;
  for (; i < 4; i++) {
    putMole(i, "mole");
    T.state.elapsed += 100; // stay inside the 1600ms window
    T.onHoleClick(i);
  }
  const s = T.snap();
  eq(s.combo, 4, "consecutive hits build a combo");
  eq(s.multiplier, 2, "4 hits gives a x2 multiplier");
  eq(s.maxCombo, 4, "max combo tracked");

  // A gap longer than the window resets it.
  putMole(5, "mole");
  T.state.elapsed += 5000;
  T.onHoleClick(5);
  eq(T.snap().combo, 1, "a long gap resets the combo");
}

// ---------- G. Golden moles ----------
{
  T.resetRound();
  startPlaying();
  eq(T.snap().hits, 0, "fresh round has no hits");
  T.state.score = 0;
  putMole(0, "gold");
  T.onHoleClick(0);
  const s = T.snap();
  eq(s.hits, 1, "golden mole counts as a hit");
  ok(s.score >= 30, "golden mole is worth at least 30", s.score);
}

// ---------- H. Moles that escape ----------
{
  startPlaying();
  putMole(0, "mole");
  T.state.combo = 5;
  T.state.elapsed += 999999; // past the hide time
  T.loop(performance.now());
  T.loop(performance.now() + 16);
  const s = T.snap();
  eq(s.holes[0], null, "an escaped mole clears its hole");
  eq(s.combo, 1, "an escaped mole breaks the combo");
}

// ---------- I. Timer ----------
{
  T.setMode("classic");
  T.setDiff("easy");
  T.resetRound();
  startPlaying();
  eq(T.snap().hits, 0, "fresh timer round has no hits");
  const s = T.state;
  s.remaining = 3000;
  const start = performance.now();
  T.loop(start);
  T.loop(start + 1000);
  T.loop(start + 2000);
  ok(s.remaining < 3000, "timer counts down");

  const beforePause = s.remaining;
  T.setPaused(true, true);
  T.loop(start + 4000);
  eq(s.remaining, beforePause, "pause freezes the timer");
  T.setPaused(false, true);

  s.remaining = 50;
  putMole(0, "mole");
  T.onHoleClick(0);
  T.onHoleClick(8); // deliberate miss so the round isn't "flawless"
  T.loop(start + 5000);
  T.loop(start + 5100);
  const lost = T.snap();
  eq(lost.over, true, "time running out ends the round");
  eq(lost.overlayTitle, "Time! ⏱️", "time-up overlay shown");
}

// ---------- J. Daily determinism ----------
{
  T.setMode("daily");
  T.setDiff("normal");
  T.resetRound();
  eq(elements.get("start").disabled, false, "daily can be started");

  // Play a real daily round so the daily record is written.
  startPlaying();
  putMole(0, "mole");
  T.onHoleClick(0);
  T.state.hits = 3;
  T.endRound("time");
  eq(T.snap().daily.streak, 1, "daily streak starts at 1");
  ok(T.snap().stats.dailySolves >= 1, "daily solve counted");
  ok(T.unlocked().includes("daily"), "daily badge unlocked");

  // Same seed -> same critter sequence.
  T.resetRound();
  T.startRound();
  T.state.started = true;
  const seqA = [];
  for (let k = 0; k < 8; k++) {
    T.spawnCritter();
    seqA.push(T.state.holes.findIndex((h) => h));
  }
  T.resetRound();
  T.startRound();
  T.state.started = true;
  const seqB = [];
  for (let k = 0; k < 8; k++) {
    T.spawnCritter();
    seqB.push(T.state.holes.findIndex((h) => h));
  }
  eq(JSON.stringify(seqA), JSON.stringify(seqB), "daily spawns are deterministic");
  T.setMode("classic");
  T.resetRound();
  startPlaying();
}

// ---------- K. Zen ----------
{
  T.setMode("zen");
  T.resetRound();
  eq(elements.get("finish").hidden, false, "finish visible in zen");
  eq(T.snap().remaining, 0, "zen has no clock");
  startPlaying();
  putMole(0, "mole");
  T.onHoleClick(0);
  T.endRound("manual");
  const s = T.snap();
  eq(s.over, true, "manual zen finish ends the round");
  ok(s.unlocked.includes("zen"), "zen badge unlocked");
  T.setMode("classic");
  T.resetRound();
  startPlaying();
}

// ---------- L. Achievements ----------
{
  T.stats.hits = 500;
  T.checkAchievements();
  ok(T.unlocked().includes("total"), "500 hits badge");

  T.stats.maxCombo = 10;
  T.checkAchievements();
  ok(T.unlocked().includes("combo10"), "x10 combo badge");
  ok(T.unlocked().includes("streak"), "x8 combo badge");

  T.stats.bestScore = 900;
  T.checkAchievements();
  ok(T.unlocked().includes("score200"), "200 score badge");
  ok(T.unlocked().includes("score500"), "500 score badge");
  ok(T.unlocked().includes("score900"), "900 score badge");

  T.stats.maxRoundHits = 80;
  T.checkAchievements();
  ok(T.unlocked().includes("hits25"), "25 hits badge");
  ok(T.unlocked().includes("hits50"), "50 hits badge");
  ok(T.unlocked().includes("hits80"), "80 hits badge");

  T.stats.perfectRounds = 1;
  T.stats.accuracy = 1;
  T.stats.hardClean = 1;
  T.stats.rushRounds = 1;
  T.stats.hardRounds = 1;
  T.checkAchievements();
  ok(T.unlocked().includes("perfect"), "flawless badge");
  ok(T.unlocked().includes("accuracy"), "accuracy badge");
  ok(T.unlocked().includes("noBomb"), "bomb dodger badge");
  ok(T.unlocked().includes("rush"), "rush badge");
  ok(T.unlocked().includes("hard"), "hard badge");

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");
}

// ---------- M. Storage keys ----------
{
  ok(storage.has("whack-a-mole-stats-v1"), "stats key present");
  ok(storage.has("whack-a-mole-achv-v1"), "achievement key present");
  ok(storage.has("whack-a-mole-daily-v1"), "daily key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("whack-a-mole-best-v1-"));
  ok(bestKeys.length >= 1, "best scores stored per mode and difficulty", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);