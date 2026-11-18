// Deterministic tests for games/frogger/script.js.
const fs = require("fs");
const path = require("path");

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

function makeCtx() {
  const grad = { addColorStop() {} };
  return {
    setTransform() {},
    save() {},
    restore() {},
    clearRect() {},
    translate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    setLineDash() {},
    createLinearGradient() {
      return grad;
    },
    measureText() {
      return { width: 10 };
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
  };
}

function makeEl(id, tag = "div") {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    hidden: false,
    disabled: false,
    title: "",
    dataset: {},
    className: "",
    children: [],
    _listeners: {},
    _attrs: {},
    classList: makeClassList(),
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 100,
    width: 494,
    height: 456,
    style: {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      },
    },
    getContext() {
      return makeCtx();
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    removeAttribute(k) {
      delete this._attrs[k];
    },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
    },
    remove() {},
    focus() {},
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
    },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign({ target: this, button: 0, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    querySelector() {
      return makeEl("q", "div");
    },
    querySelectorAll() {
      return [];
    },
    setPointerCapture() {},
  };
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
  "game", "score", "best", "lives", "level", "homes", "time", "time-label", "hint",
  "pause", "badges-btn", "badge-count", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2", "restart",
];
for (const id of ids) elements.set(id, makeEl(id));
elements.get("achv-modal").hidden = true;

const modeChips = ["classic", "attack", "daily", "zen"].map((m) => {
  const e = makeEl("mode-" + m, "button");
  e.dataset.mode = m;
  return e;
});
const dpadButtons = ["up", "down", "left", "right"].map((d) => {
  const e = makeEl("dpad-" + d, "button");
  e.dataset.dir = d;
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (t) => makeEl("created-" + t, t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    return makeEl("q");
  },
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".dpad button") return dpadButtons;
    return [];
  },
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
};

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
};

global.getComputedStyle = () => ({
  getPropertyValue: (n) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
    }[n] || ""),
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

let rafCb = null;
global.requestAnimationFrame = (cb) => {
  rafCb = cb;
  return 1;
};

const repo = require("./_env").gameScript("frogger");
let code = fs.readFileSync(repo, "utf8");
const CORE = require("./_env").CORE;
if (fs.existsSync(CORE)) code = fs.readFileSync(CORE, "utf8") + "\n" + code;

// Test hook now ships in the game source.
try {
  eval(code);
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__F;
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

let frameTs = 100000;
function frames(n) {
  for (let i = 0; i < n; i++) {
    frameTs += 16.7;
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error("no rAF callback");
    cb(frameTs);
  }
}

function fresh(mode = "classic") {
  T.setMode(mode, true);
  T.state.countdown = 0;
  T.state.running = true;
  T.state.paused = false;
  T.state.over = false;
}

function makeLane(row, dir, speed, kind, items) {
  return { row, dir, speed, kind, items, len: [1, 1], gap: [1, 1] };
}

// ---------- A. Geometry ----------
eq(T.COLS, 13, "13 columns");
eq(T.ROWS, 12, "12 rows");
eq(T.W, 494, "board width");
eq(T.H, 456, "board height");
deepEq(T.HOME_COLS, [0, 3, 6, 9, 12], "five home columns");
deepEq(T.RIVER_ROWS, [1, 2, 3, 4, 5], "five river rows");
deepEq(T.ROAD_ROWS, [7, 8, 9, 10], "four road rows");
eq(T.GOAL_ROW, 0, "goal row");
eq(T.START_ROW, 11, "start row");
eq(T.ACHIEVEMENTS.length, 25, "25 achievements");

// ---------- B. Lane generation ----------
{
  fresh("daily");
  const lanes = T.getLanes();
  eq(lanes.length, 9, "nine lanes generated");
  let allValid = true;
  for (const lane of lanes) {
    if (lane.items.length < 2) allValid = false;
    for (const it of lane.items) {
      if (it.len < 1) allValid = false;
    }
    const first = lane.items[0];
    if (!(first.x < 0)) allValid = false;
    const last = lane.items[lane.items.length - 1];
    if (!(last.x + last.len > 0)) allValid = false;
  }
  ok(allValid, "every lane is populated with items entering from off-screen");
  // Each row has exactly one lane.
  const rows = lanes.map((l) => l.row).sort((a, b) => a - b);
  deepEq(rows, [1, 2, 3, 4, 5, 7, 8, 9, 10], "lane rows are correct");
}

// ---------- B2. Lane speed uses seconds, not milliseconds ----------
{
  fresh("daily");
  T.setLanes([makeLane(3, 1, 1, "log", [{ x: 5, len: 4 }])]);
  T.state.speedMul = 1;
  const before = T.getLanes()[0].items[0].x;
  T.updateLanes(100); // 100 ms = 0.1 s
  const after = T.getLanes()[0].items[0].x;
  ok(
    Math.abs(after - before - 0.1) < 1e-6,
    "a speed-1 lane moves 0.1 tiles in 100ms (not 100 tiles)",
    { before, after }
  );
  T.updateLanes(1000); // 1 s
  const afterSec = T.getLanes()[0].items[0].x;
  ok(
    Math.abs(afterSec - after - 1) < 1e-6,
    "a speed-1 lane moves 1 tile in 1s",
    { after, afterSec }
  );
}

// ---------- C. Home detection ----------
eq(T.homeAtX(0), 0, "x=0 is home 0");
eq(T.homeAtX(3), 1, "x=3 is home 1");
eq(T.homeAtX(6), 2, "x=6 is home 2");
eq(T.homeAtX(9), 3, "x=9 is home 3");
eq(T.homeAtX(12), 4, "x=12 is home 4");
eq(T.homeAtX(1), -1, "x=1 is between homes");
eq(T.homeAtX(2.3), 1, "x=2.3 snaps to home 1");
eq(T.homeAtX(3.5), 1, "x=3.5 snaps to home 1");
eq(T.homeAtX(4.6), -1, "x=4.6 is in the gap between homes");
eq(T.homeAtX(14), -1, "out of range is no home");

// ---------- D. Movement + scoring ----------
{
  fresh();
  let f = T.getFrog();
  eq(f.row, 11, "frog starts on the bottom bank");
  eq(f.x, 6, "frog starts centered");
  T.move(0, -1);
  f = T.getFrog();
  eq(f.row, 10, "hop up moves one row");
  eq(T.snap().score, 10, "new forward row scores 10");
  T.move(0, -1);
  eq(T.snap().score, 20, "second new row scores again");
  T.move(-1, 0);
  eq(T.getFrog().x, 5, "hop left moves one column");
  eq(T.snap().score, 20, "sideways hop does not score");
  T.move(0, 1);
  eq(T.getFrog().row, 10, "hop down moves back");
  eq(T.snap().score, 20, "backwards hop does not score");
  T.move(0, -1);
  eq(T.snap().score, 20, "revisiting a row does not score");
  // Bounds
  for (let i = 0; i < 20; i++) T.move(-1, 0);
  eq(T.getFrog().x, 0, "frog clamps at the left edge");
  for (let i = 0; i < 30; i++) T.move(1, 0);
  eq(T.getFrog().x, 12, "frog clamps at the right edge");
}

// ---------- E. River riding + drowning ----------
{
  fresh();
  T.setLanes([makeLane(3, 1, 1, "log", [{ x: 5, len: 4 }])]);
  T.state.speedMul = 1;
  T.setFrog({ x: 6, row: 3, drawX: 6, drawY: 3, hop: 0, alive: true, elapsed: 0, maxRow: 3, timeLeft: 30 });
  T.updateFrog(100);
  let f = T.getFrog();
  ok(Math.abs(f.x - 6.1) < 1e-6, "log carries the frog", f.x);
  eq(f.alive, true, "frog survives on a log");
  eq(T.snap().frog.timeLeft, 30, "updateFrog does not change the timer");

  // No platform under the frog -> drown.
  T.setLanes([makeLane(3, 1, 1, "log", [{ x: 0, len: 1 }])]);
  T.setFrog({ x: 6, row: 3, drawX: 6, drawY: 3, hop: 0, alive: true, elapsed: 0, maxRow: 3, timeLeft: 30 });
  T.updateFrog(16);
  f = T.getFrog();
  eq(f.alive, false, "frog drowns without a platform");
  eq(T.snap().lives, 2, "drowning costs a life");

  // Swept off the edge.
  fresh();
  T.setLanes([makeLane(3, 1, 2, "log", [{ x: 11, len: 5 }])]);
  T.state.speedMul = 1;
  T.setFrog({ x: 12.2, row: 3, drawX: 12.2, drawY: 3, hop: 0, alive: true, elapsed: 0, maxRow: 3, timeLeft: 30 });
  T.updateFrog(100);
  eq(T.getFrog().alive, false, "frog is swept off the edge");
}

// ---------- F. Road collision ----------
{
  fresh();
  T.setLanes([makeLane(8, 1, 1, "car", [{ x: 5, len: 1 }])]);
  T.setFrog({ x: 5.2, row: 8, drawX: 5.2, drawY: 8, hop: 0, alive: true, elapsed: 0, maxRow: 8, timeLeft: 30 });
  T.updateFrog(16);
  eq(T.getFrog().alive, false, "frog hit by a car");
  eq(T.snap().lives, 2, "car hit costs a life");

  // A safe gap.
  fresh();
  T.setLanes([makeLane(8, 1, 1, "car", [{ x: 0, len: 1 }])]);
  T.setFrog({ x: 8.2, row: 8, drawX: 8.2, drawY: 8, hop: 0, alive: true, elapsed: 0, maxRow: 8, timeLeft: 30 });
  T.updateFrog(16);
  eq(T.getFrog().alive, true, "frog survives an empty lane");
}

// ---------- G. Reaching a home ----------
{
  fresh();
  T.state.homes = [false, false, false, false, false];
  T.state.homeCount = 0;
  T.setFrog({ x: 0, row: 1, drawX: 0, drawY: 1, hop: 0, alive: true, elapsed: 8, maxRow: 1, timeLeft: 22 });
  T.reachHome();
  const s = T.snap();
  eq(s.homes[0], true, "home 0 filled");
  eq(s.homeCount, 1, "home counter incremented");
  ok(s.score >= 50, "home awards points", s.score);
  eq(s.frog.row, 11, "frog respawns after a home");
  ok(s.stats.totalHomes >= 1, "total homes incremented");
  ok(s.stats.fastestHome > 0, "fastest home recorded", s.stats.fastestHome);
}

// ---------- H. Level complete ----------
{
  fresh();
  T.state.homes = [true, true, true, true, false];
  T.state.homeCount = 4;
  T.state.level = 1;
  T.state.speedMul = 1;
  T.state.deathsThisLevel = 0;
  T.setFrog({ x: 12, row: 1, drawX: 12, drawY: 1, hop: 0, alive: true, elapsed: 8, maxRow: 1, timeLeft: 22 });
  T.reachHome();
  const s = T.snap();
  eq(s.level, 2, "level advances");
  eq(s.homeCount, 0, "homes reset for the new level");
  deepEq(s.homes, [false, false, false, false, false], "home bays cleared");
  ok(s.speedMul > 1, "traffic speeds up", s.speedMul);
  ok(s.stats.maxLevel >= 2, "max level recorded");
  ok(s.stats.flawlessLevels >= 1, "flawless level recorded");
  eq(s.frog.row, 11, "frog respawns for the new level");
}

// ---------- I. Lives + game over ----------
{
  fresh();
  eq(T.snap().lives, 3, "starts with three lives");
  T.die("car");
  eq(T.snap().lives, 2, "first death leaves two lives");
  eq(T.getFrog().alive, false, "frog is dead");
  ok(T.snap().respawnTimer > 0, "respawn timer set");
  // Finish the respawn.
  T.updateFrog(900);
  eq(T.getFrog().alive, true, "frog respawns");
  eq(T.getFrog().row, 11, "respawn is on the start bank");
  T.die("water");
  T.updateFrog(900);
  T.die("car");
  const s = T.snap();
  eq(s.over, true, "third death ends the game");
  eq(s.running, false, "game stops running");
  ok(s.overlayTitle === "Game Over" || s.overlayTitle === "Time's Up! ⏱", "game over overlay", s.overlayTitle);
}

// ---------- J. Timers ----------
{
  // Classic per-frog timer.
  fresh();
  T.setFrog({ x: 6, row: 11, drawX: 6, drawY: 11, hop: 0, alive: true, elapsed: 29.9, maxRow: 11, timeLeft: 0.01 });
  T.updateTimers(20);
  eq(T.getFrog().alive, false, "frog timer expiring kills the frog");
  eq(T.snap().lives, 2, "timeout costs a life");

  // Attack countdown.
  fresh("attack");
  eq(T.snap().timeLeft, 120, "attack starts at 120s");
  T.state.timeLeft = 0.01;
  T.updateTimers(20);
  eq(T.snap().over, true, "attack countdown expiring ends the game");
  eq(T.snap().overlayTitle, "Time's Up! ⏱", "timeout overlay");

  // Zen has no timer.
  fresh("zen");
  T.setFrog({ x: 6, row: 11, drawX: 6, drawY: 11, hop: 0, alive: true, elapsed: 500, maxRow: 11, timeLeft: 0 });
  T.updateTimers(1000);
  eq(T.getFrog().alive, true, "zen frog never times out");
  eq(T.snap().lives, Infinity, "zen has infinite lives");
}

// ---------- K. Daily ----------
{
  fresh("daily");
  eq(T.snap().mode, "daily", "daily mode active");
  T.state.homes = [true, true, true, true, false];
  T.state.homeCount = 4;
  T.setFrog({ x: 12, row: 1, drawX: 12, drawY: 1, hop: 0, alive: true, elapsed: 8, maxRow: 1, timeLeft: 22 });
  T.reachHome();
  const s = T.snap();
  eq(s.over, true, "fifth home completes the daily");
  eq(s.won, true, "daily win flag set");
  eq(s.overlayTitle, "Daily Complete! 🎉", "daily overlay");
  eq(s.daily.streak, 1, "daily streak starts at 1");
  eq(s.daily.lastDate, T.dateStr(), "daily date recorded");
  ok(s.stats.dailyWins >= 1, "daily win counted");
  ok(s.unlocked.includes("daily"), "Daily Habit unlocks");
}

// ---------- L. Zen lives ----------
{
  fresh("zen");
  eq(T.snap().livesEl, "∞", "zen HUD shows infinity");
  T.die("car");
  eq(T.snap().lives, Infinity, "zen death keeps infinite lives");
  eq(T.getFrog().alive, false, "zen frog dies visually");
  T.updateFrog(900);
  eq(T.getFrog().alive, true, "zen frog respawns");
  eq(T.snap().over, false, "zen never ends on death");
}

// ---------- M. Achievements ----------
{
  fresh();
  T.stats.totalHomes = 10;
  T.stats.maxLevel = 3;
  T.stats.maxScore = 5000;
  T.stats.flawlessLevels = 3;
  T.stats.extraLives = 1;
  T.stats.closeCalls = 1;
  T.stats.attackWins = 1;
  T.stats.nightWins = 1;
  T.stats.totalRuns = 10;
  T.stats.totalDeaths = 25;
  T.stats.logDistance = 100;
  T.stats.fastestHome = 4;
  T.stats.zenScore = 2000;
  T.checkAchievements();
  const u = T.snap().unlocked;
  ok(u.includes("home10"), "home10 unlocks");
  ok(u.includes("level3"), "level3 unlocks");
  ok(u.includes("score5k"), "score5k unlocks");
  ok(u.includes("flawless3"), "flawless3 unlocks");
  ok(u.includes("extraLife"), "extraLife unlocks");
  ok(u.includes("closeCall"), "closeCall unlocks");
  ok(u.includes("attack"), "attack unlocks");
  ok(u.includes("night"), "night unlocks");
  ok(u.includes("runs10"), "runs10 unlocks");
  ok(u.includes("deaths25"), "deaths25 unlocks");
  ok(u.includes("logRider"), "logRider unlocks");
  ok(u.includes("speed5"), "speed5 unlocks");
  ok(u.includes("zen"), "zen unlocks");
  ok(!!storage.get("frogger-achv-v1"), "achievements persisted");
}

// ---------- N. Best persistence ----------
{
  fresh();
  T.state.score = 4321;
  T.saveBest();
  ok(storage.has("frogger-best-v1-classic"), "best score persisted");
  eq(Number(storage.get("frogger-best-v1-classic")), 4321, "best score value");
}

// ---------- O. Long run ----------
{
  fresh();
  T.reset();
  T.state.countdown = 0;
  try {
    frames(900);
    ok(true, "long frame run without runtime errors");
  } catch (err) {
    ok(false, "long frame run threw", String(err));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);