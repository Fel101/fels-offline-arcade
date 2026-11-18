// Deterministic tests for games/echo/script.js
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
  "pads", "board-wrap", "countdown", "countdown-num", "level", "time", "lives",
  "best", "status", "live", "start", "pause", "badges-btn", "badge-count",
  "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count",
  "achv-records", "badges2",
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
  setTimeout: (fn) => {
    // Fire immediately so sequence playback is synchronous in tests.
    if (typeof fn === "function") fn();
    return 1;
  },
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
Math.random = mulberry32(0x51ee);

const root = require("./_env").root;
const dir = root + "games/echo/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__SIMON;
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

/** Jump straight into accepting input on level 1. */
function beginInput() {
  T.startGame();
  T.state.started = true;
  T.state.countdown = 0;
  T.state.phase = "input";
  T.state.inputIndex = 0;
}

function repeatSequence() {
  const seq = T.state.sequence.slice();
  for (const pad of seq) T.onPadPress(pad);
}

// ---------- A. Pad layouts ----------
{
  T.setDiff("easy");
  T.resetRound();
  eq(T.state.pads.length, 4, "easy has 4 pads");
  eq(T.snap().cellEls, 4, "easy renders 4 pad elements");

  T.setDiff("normal");
  T.resetRound();
  eq(T.state.pads.length, 6, "normal has 6 pads");
  eq(T.snap().cellEls, 6, "normal renders 6 pad elements");

  T.setDiff("hard");
  T.resetRound();
  eq(T.state.pads.length, 9, "hard has 9 pads");
  eq(T.snap().cellEls, 9, "hard renders 9 pad elements");

  T.setDiff("easy");
  T.resetRound();
}

// ---------- B. Flash speed ----------
{
  T.setDiff("easy");
  const s1 = T.flashSpeed(1);
  const s5 = T.flashSpeed(5);
  const s50 = T.flashSpeed(50);
  ok(s1 > s5, "flash gets faster as levels rise");
  ok(s5 > s50, "flash keeps getting faster");
  ok(s50 >= 220, "flash speed has a floor");
}

// ---------- C. Correct input advances ----------
{
  beginInput();
  T.state.sequence = [0, 1];
  T.state.phase = "input";
  T.state.inputIndex = 0;

  T.onPadPress(0);
  eq(T.snap().inputIndex, 1, "correct first pad advances the index");
  eq(T.snap().level, 1, "half a sequence does not advance the level");

  T.onPadPress(1);
  // nextLevel runs on a 420ms timer, which our setTimeout fires inline.
  const s = T.snap();
  eq(s.level, 2, "completing the sequence advances the level");
  eq(s.sequence.length, 3, "the sequence grows by one");
  ok(s.stats.levelsCleared >= 1, "levels cleared tracked");
  ok(s.stats.maxLevel >= 2, "max level tracked");
}

// ---------- D. Wrong pad costs a life ----------
{
  T.setMode("classic");
  T.resetRound();
  beginInput();
  T.state.sequence = [0, 1, 2];
  T.state.phase = "input";
  T.state.inputIndex = 0;

  T.onPadPress(3); // wrong
  const s = T.snap();
  eq(s.lives, 2, "a wrong pad costs one life");
  eq(s.mistakes, 1, "mistakes counted");
  eq(s.over, false, "still alive after one mistake");
  ok(s.level >= 1, "level is unchanged after a miss");
}

// ---------- E. Losing all lives ends the run ----------
{
  T.setMode("classic");
  T.resetRound();
  beginInput();
  T.state.sequence = [0, 1];
  T.state.phase = "input";

  T.onPadPress(3);
  T.onPadPress(3);
  const afterTwo = T.snap();
  eq(afterTwo.lives, 1, "two mistakes leave one life");
  eq(afterTwo.over, false, "still playing");

  T.onPadPress(3);
  const s = T.snap();
  eq(s.lives, 0, "three mistakes exhaust the lives");
  eq(s.over, true, "losing all lives ends the run");
  eq(s.overlayTitle, "Game Over 💥", "game over overlay shown");
  ok(s.stats.rounds >= 1, "round counted");
}

// ---------- F. Zen has infinite lives ----------
{
  T.setMode("zen");
  T.resetRound();
  beginInput();
  T.state.sequence = [0, 1];
  T.state.phase = "input";
  eq(T.snap().lives, Infinity, "zen starts with infinite lives");

  for (let i = 0; i < 5; i++) T.onPadPress(3);
  const s = T.snap();
  eq(s.lives, Infinity, "zen never loses lives");
  eq(s.over, false, "zen never ends on mistakes");
  ok(s.mistakes >= 5, "mistakes still counted in zen");

  T.setMode("classic");
  T.resetRound();
  beginInput();
}

// ---------- G. Daily is deterministic ----------
{
  T.setMode("daily");
  T.resetRound();
  beginInput();
  T.state.sequence = [];
  T.nextLevel(); // appends one pad
  const firstSeq = T.state.sequence.slice();

  T.resetRound();
  beginInput();
  T.state.sequence = [];
  T.nextLevel();
  const secondSeq = T.state.sequence.slice();

  eq(JSON.stringify(firstSeq), JSON.stringify(secondSeq), "daily sequence is deterministic");
  T.setMode("classic");
  T.resetRound();
  beginInput();
}

// ---------- H. Score accumulates ----------
{
  T.setMode("classic");
  T.resetRound();
  beginInput();
  T.state.sequence = [0, 1, 2, 3];
  T.state.phase = "input";
  T.state.inputIndex = 0;
  T.state.score = 0;

  repeatSequence();
  const s = T.snap();
  ok(s.score > 0, "clearing a level scores points", s.score);
}

// ---------- I. Pause ----------
{
  T.setMode("classic");
  T.resetRound();
  beginInput();
  T.state.sequence = [0];
  T.state.phase = "input";
  T.state.elapsed = 3000;

  T.setPaused(true, true);
  eq(T.snap().paused, true, "pause sets the flag");
  const t = performance.now();
  T.loop(t);
  T.loop(t + 1000);
  eq(T.state.elapsed, 3000, "pause freezes the clock");

  T.setPaused(false, true);
  eq(T.snap().paused, false, "resume clears the flag");
}

// ---------- J. Sprint timer ----------
{
  T.setMode("sprint");
  T.resetRound();
  beginInput();
  eq(Math.round(T.state.remaining / 1000), 120, "sprint is 120 seconds");

  T.state.remaining = 40;
  const start = performance.now();
  T.loop(start);
  T.loop(start + 1000);
  ok(T.state.remaining < 40, "sprint timer counts down");

  T.state.remaining = 30;
  T.loop(start + 3000);
  T.loop(start + 3050);
  eq(T.snap().over, true, "sprint time running out ends the run");

  T.setMode("classic");
  T.resetRound();
  beginInput();
}

// ---------- K. Achievements ----------
{
  T.stats.maxLevel = 20;
  T.stats.hardLevel = 8;
  T.stats.normalLevel = 8;
  T.stats.sprintLevel = 10;
  T.stats.zenLevel = 10;
  T.stats.clutchLevel = 8;
  T.stats.comebackLevel = 8;
  T.stats.nightLevel = 5;
  T.stats.fullSpectrum = 1;
  T.stats.quickLevels = 1;
  T.stats.bestScore = 1000;
  T.stats.levelsCleared = 100;
  T.stats.bestStreak = 10;
  T.stats.rounds = 20;
  T.stats.perfectRuns = 10;
  T.checkAchievements();

  const u = T.unlocked();
  for (const id of [
    "level5", "level10", "level15", "level20", "hard", "normal",
    "sprint", "zen", "lives", "comeback", "night", "allPads", "quick", "score",
    "totalLevels", "noMiss", "rounds", "perfect10", "perfect",
  ]) {
    ok(u.includes(id), `badge ${id} unlocked`);
  }

  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7 day streak badge");

  T.stats.maxLevel = 25;
  T.checkAchievements();
  ok(T.unlocked().includes("marathon"), "level 25 badge");

  T.stats.dailySolves = 1;
  T.checkAchievements();
  ok(T.unlocked().includes("daily"), "daily badge");
}

// ---------- L. Storage keys ----------
{
  ok(storage.has("simon-stats-v1"), "stats key present");
  ok(storage.has("simon-achv-v1"), "achievement key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("simon-best-v1-"));
  ok(bestKeys.length >= 1, "best levels stored per mode and difficulty", bestKeys);

  // A finished daily run writes the daily record.
  T.setMode("daily");
  T.resetRound();
  beginInput();
  T.state.level = 4;
  T.state.score = 120;
  T.endRun();
  ok(storage.has("simon-daily-v1"), "daily key present after a daily run");
  ok(T.snap().daily.streak >= 1, "daily streak recorded");
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);