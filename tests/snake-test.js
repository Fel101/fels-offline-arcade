// Deterministic tests for games/snake/script.js using a temp copy with a test hook.
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
    toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)),
  };
}

function makeEl(id, tag = "div") {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    innerHTML: "",
    hidden: id === "achv-modal",
    title: "",
    dataset: {},
    style: {},
    width: 480,
    height: 480,
    classList: makeClassList(),
    children: [],
    _listeners: {},
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    focus() {},
    setPointerCapture() {},
    addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); },
    dispatch(type, ev = {}) {
      const e = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[type] || []).forEach((fn) => fn(e));
    },
    querySelector() { return makeEl("q"); },
    querySelectorAll() { return []; },
    getContext() { return ctx; },
  };
}

const gradient = { addColorStop() {} };
const ctx = new Proxy(
  {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 10 }),
  },
  {
    get(t, p) { return p in t ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  }
);

const ids = [
  "game", "score", "best", "length", "combo", "combo-fill", "hint", "pause",
  "badges-btn", "badge-count", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "restart",
];
for (const id of ids) elements.set(id, makeEl(id, id === "game" ? "canvas" : "div"));
elements.get("achv-modal").hidden = true;

const modeChips = ["classic", "endless", "zen", "ai"].map((m) => {
  const el = makeEl("mode-" + m, "button");
  el.dataset.mode = m;
  return el;
});
const dpadButtons = ["up", "down", "left", "right"].map((d) => {
  const el = makeEl("dpad-" + d, "button");
  el.dataset.dir = d;
  return el;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (tag) => makeEl("created-" + tag, tag),
  querySelector: (sel) => (sel === ".mode-chip" ? modeChips[0] : makeEl("q")),
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".dpad button") return dpadButtons;
    if (sel === "[data-close]") return [makeEl("close1", "button"), makeEl("close2", "div")];
    return [];
  },
  addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); },
};

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (type, fn) => { (listeners["win:" + type] || (listeners["win:" + type] = [])).push(fn); },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};

global.getComputedStyle = () => ({
  getPropertyValue: (name) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
      "--glass-border": "rgba(255,255,255,0.11)",
    }[name] || ""),
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

let rafCb = null;
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

const repo = require("./_env").gameScript("snake");
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

const T = global.window.__T;
let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}
function eq(actual, expected, msg) {
  ok(actual === expected, msg, { actual, expected });
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

// A. initial state
let s = T.snap();
eq(s.mode, "classic", "starts in classic");
eq(s.snake.length, 3, "starts length 3");
eq(s.score, 0, "starts score 0");
ok(!!s.food, "food exists at start");
eq(s.over, false, "not over at start");

// B. eat apple
let h = s.snake[0];
T.setFood(h.x + 1, h.y, "apple");
T.tick(1000);
s = T.snap();
eq(s.score, 10, "apple gives 10");
eq(s.snake.length, 4, "eating grows snake");
eq(s.combo, 2, "combo increments to x2");
eq(s.records.totalFood, 1, "totalFood increments");
eq(s.best, 10, "best updates live");
ok(s.unlocked.includes("first"), "First Bite unlocks");

// C. second quick apple -> x2 multiplier
h = s.snake[0];
T.setFood(h.x + 1, h.y, "apple");
T.tick(1100);
s = T.snap();
eq(s.score, 30, "second quick apple scores 20 (x2)");
eq(s.combo, 3, "combo reaches x3");
ok(s.unlocked.includes("combo3"), "On Fire (x3) unlocks");

// D. combo expiry in Zen (no death)
T.setMode("zen");
T.skipCountdown();
s = T.snap();
h = s.snake[0];
T.setFood(h.x + 1, h.y, "apple");
T.tick(2000);
eq(T.snap().combo, 2, "zen apple starts combo");
T.setFood(0, 0, "apple"); // park food out of the snake's path
frames(250); // ~4.2s
eq(T.snap().combo, 1, "combo expires after window");
eq(elements.get("combo-fill").style.width, "0%", "combo bar empties");

// E. ghost berry lets you pass through yourself
T.setMode("classic");
T.setFood(0, 0, "apple");
T.setNow(3000);
h = T.snap().snake[0];
T.setFood(h.x + 1, h.y, "ghost");
T.tick(3000);
s = T.snap();
ok(s.ghostActive, "ghost active after eating ghost berry");
const loop = [
  { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 },
  { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 },
];
T.setSnake(loop, { x: -1, y: 0 });
T.setFood(19, 19, "apple");
T.tick(3100);
eq(T.snap().over, false, "ghost lets snake pass through itself");

// E2. same collision without ghost kills
T.setMode("classic");
T.setSnake(loop, { x: -1, y: 0 });
T.setFood(19, 19, "apple");
T.tick(4000);
eq(T.snap().over, true, "self collision without ghost ends run");

// F. golden apple
T.setMode("classic");
h = T.snap().snake[0];
T.setFood(h.x + 1, h.y, "golden");
T.tick(5000);
s = T.snap();
eq(s.score, 50, "golden apple gives 50");
eq(s.records.golden, 1, "golden counter increments");

// G. slow berry
T.setMode("classic");
h = T.snap().snake[0];
T.setFood(h.x + 1, h.y, "slow");
T.tick(6000);
s = T.snap();
ok(s.slowActive, "slow active after eating slow berry");
ok(s.step > 200, "slow berry increases step interval", s.step);

// H. wall death in classic
T.setMode("classic");
T.setSnake([{ x: 19, y: 5 }], { x: 1, y: 0 });
T.setFood(0, 0, "apple");
T.tick(7000);
eq(T.snap().over, true, "wall kills in classic");

// I. endless wraps
T.setMode("endless");
T.setSnake([{ x: 19, y: 5 }], { x: 1, y: 0 });
T.setFood(0, 0, "apple");
T.tick(8000);
s = T.snap();
eq(s.over, false, "endless survives wall");
eq(s.snake[0].x, 0, "endless wraps to x=0");

// J. zen ignores self collision
T.setMode("zen");
T.setSnake(loop, { x: -1, y: 0 });
T.setFood(19, 19, "apple");
T.tick(9000);
eq(T.snap().over, false, "zen ignores self collision");

// K. AI mode
T.setMode("ai");
s = T.snap();
ok(!!s.ai, "AI exists in Vs AI mode");
eq(s.ai.snake.length, 4, "AI starts length 4");
eq(s.ai.alive, true, "AI starts alive");

// AI runs into wall -> KO (trapped: only the wall is left)
T.setSnake([{ x: 19, y: 1 }, { x: 18, y: 1 }], { x: 1, y: 0 });
T.setAI(
  [{ x: 19, y: 0 }, { x: 18, y: 0 }, { x: 17, y: 0 }, { x: 16, y: 0 }],
  { x: 1, y: 0 }
);
T.tickAI(10000);
s = T.snap();
eq(s.ai.alive, false, "AI dies at wall");
eq(s.records.rivalKO, 1, "AI crash counts as rival KO");

// respawn
T.respawnAI();
s = T.snap();
eq(s.ai.alive, true, "AI respawns");
eq(s.ai.snake.length, 4, "respawned AI length 4");

// AI eats food (only open move is onto the food)
T.setSnake([{ x: 5, y: 4 }, { x: 5, y: 6 }], { x: 1, y: 0 });
T.setAI(
  [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }],
  { x: 1, y: 0 }
);
T.setFood(6, 5, "apple");
T.tickAI(10100);
eq(T.snap().ai.score, 10, "AI scores when it eats");

// AI runs into player body -> KO (trapped on three sides)
T.setSnake([{ x: 6, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 6 }], { x: 1, y: 0 });
T.setAI(
  [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }],
  { x: 1, y: 0 }
);
T.tickAI(10200);
eq(T.snap().ai.alive, false, "AI crashing into player counts as KO");

// player runs into AI body -> player dies
T.setMode("ai");
T.setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], { x: 1, y: 0 });
T.setAI([{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }], { x: -1, y: 0 });
T.setFood(0, 0, "apple");
T.tick(11000);
eq(T.snap().over, true, "player dies hitting AI body");

// L. achievements persisted
const achvRaw = storage.get("snake-achv-v1");
ok(!!achvRaw, "achievements persisted");
const achv = JSON.parse(achvRaw || "[]");
ok(achv.includes("first") && achv.includes("combo3"), "achievement ids persisted", achv);

// M. per-mode best separation
T.setMode("classic");
T.setSnake([{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], { x: 1, y: 0 });
T.setFood(9, 10, "apple");
T.tick(12000);
const classicBest = T.snap().best;
ok(classicBest >= 10, "classic best recorded", classicBest);
T.setMode("endless");
eq(T.snap().best, 0, "endless best starts at 0");
T.setMode("classic");
eq(T.snap().best, classicBest, "classic best restored");

// N. records sane
s = T.snap();
ok(s.records.maxLen >= 4, "maxLen tracked", s.records.maxLen);
ok(s.records.maxCombo >= 3, "maxCombo tracked", s.records.maxCombo);
ok(s.records.maxTime >= 0, "maxTime tracked");

// O. countdown holds the snake still, then releases it
T.setMode("classic");
const startHead = T.snap().snake[0];
ok(T.snap().countdown > 0, "countdown starts after reset", T.snap().countdown);
frames(60); // ~1s
const midCount = T.snap();
ok(midCount.countdown > 0, "countdown still running after 1s", midCount.countdown);
ok(
  midCount.snake[0].x === startHead.x && midCount.snake[0].y === startHead.y,
  "snake waits during countdown",
  midCount.snake[0]
);
frames(120); // ~2s more
const afterCount = T.snap();
ok(
  afterCount.countdown === 0,
  "countdown reaches zero",
  afterCount.countdown
);
ok(
  afterCount.snake[0].x !== startHead.x || afterCount.snake[0].y !== startHead.y || afterCount.over,
  "snake moves after countdown",
  afterCount.snake[0]
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);