// Deterministic tests for games/breakout/script.js
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
    getContext() {
      return ctx;
    },
  };
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
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get() {
      return _html;
    },
    set(v) {
      _html = v;
      if (v === "") el.children = [];
    },
  });
  return el;
}

const gradient = { addColorStop() {} };
const ctx = new Proxy(
  {
    createLinearGradient: () => gradient,
    measureText: () => ({ width: 10 }),
  },
  {
    get(t, p) {
      return p in t ? t[p] : () => {};
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }
);

const ids = [
  "game", "score", "lives", "best", "launch",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
elements.get("game").width = 480;
elements.get("game").height = 480;
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  querySelector: (sel) => {
    if (sel === ".overlay .btn") return makeEl("button");
    return makeEl("div");
  },
  querySelectorAll: () => [],
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
global.cancelAnimationFrame = () => {};

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const root = require("./_env").root;
const dir = root + "games/breakout/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__BREAKOUT;
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

// ---------- A. Initial state ----------
{
  const s = T.snap();
  eq(s.score, 0, "starts at score 0");
  eq(s.lives, 3, "starts with 3 lives");
  eq(s.aliveBricks, 40, "starts with all 40 bricks");
  eq(s.launched, false, "ball not launched yet");
  eq(s.paused, false, "not paused");
  eq(s.stats.bestScore, 0, "no best score yet");
  eq(s.stats.games, 0, "no games yet");
  eq(s.overlayTitle, null, "no overlay at start");
  eq(elements.get("best").textContent, 0, "best HUD shows 0");
  eq(s.unlocked.length, 0, "no badges at start");
}

// ---------- B. Launch ----------
{
  T.go();
  const s = T.snap();
  eq(s.launched, true, "go() launches the ball");
  ok(s.ball.vy < 0, "ball travels upward");
  T.go();
  eq(T.snap().launched, true, "second go() is a no-op");
}

// ---------- C. Wall bounces ----------
{
  T.setBall(5, 300, -2, 1);
  T.update();
  let b = T.snap().ball;
  ok(b.vx > 0, "left wall reverses vx");

  T.setBall(475, 300, 2, 1);
  T.update();
  b = T.snap().ball;
  ok(b.vx < 0, "right wall reverses vx");

  T.setBall(240, 5, 1, -2);
  T.update();
  b = T.snap().ball;
  ok(b.vy > 0, "top wall reverses vy");
}

// ---------- D. Paddle bounce ----------
{
  T.setPaddleX(195); // paddle spans 195..285, center 240
  T.setBall(240, 448, 2, 2);
  T.update();
  const b = T.snap().ball;
  ok(b.vy < 0, "paddle bounce sends ball up");
}

// ---------- E. Brick smashing ----------
{
  T.reset();
  T.go();
  const before = T.snap();
  ok(before.aliveBricks === 40, "fresh board before smash");

  // Smash the top-left brick (x=8, y=60, w≈51.5, h=22).
  T.setBall(20, 70, 1, 1);
  T.update();
  const s = T.snap();
  eq(s.aliveBricks, 39, "one brick destroyed");
  eq(s.score, 10, "brick is worth 10 points");
  eq(s.stats.bricks, 1, "brick counted in stats");
  eq(s.stats.bestScore, 10, "best score tracks live score");
  eq(s.bricksThisGame, 1, "per-game brick count");
  ok(s.unlocked.includes("first"), "First Brick badge unlocks");

  // Smash a few more to pass the 50 threshold.
  for (let i = 0; i < 49; i++) {
    T.reset();
    T.go();
    T.setBall(20, 70, 1, 1);
    T.update();
  }
  const s2 = T.snap();
  eq(s2.stats.bricks, 50, "50 bricks total");
  ok(s2.unlocked.includes("brick50"), "Demolition badge unlocks");
}

// ---------- F. Losing a life ----------
{
  T.reset();
  T.go();
  T.setBall(240, 500, 0, 2);
  T.update();
  const s = T.snap();
  eq(s.lives, 2, "ball below the board costs a life");
  eq(s.launched, false, "ball re-attaches to paddle");
  eq(s.stats.livesLost, 1, "life loss tracked");
  eq(s.score, 0, "score unchanged");
}

// ---------- G. Game over (loss) ----------
{
  T.reset();
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 3 -> 2
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 2 -> 1
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 1 -> 0, game over
  const s = T.snap();
  eq(s.lives, 0, "no lives left");
  eq(s.overlayTitle, "Game Over", "game-over overlay shown");
  eq(s.stats.games, 1, "game counted");
  eq(s.stats.livesLost, 4, "three more lives lost");
  ok(!s.unlocked.includes("clear1"), "no clear badge after a loss");
  eq(s.stats.grindGames, 0, "no grind badge with only 50 bricks smashed");
  T.overlay.hide();
}

// ---------- H. Winning (board clear) ----------
{
  T.reset();
  T.go();
  eq(T.snap().aliveBricks, 40, "fresh board before clear");
  T.killBricks(40);
  T.setBall(240, 200, 0.5, 0.5);
  T.update();
  const s = T.snap();
  eq(s.aliveBricks, 0, "all bricks gone");
  eq(s.overlayTitle, "You clear it! 🎉", "win overlay shown");
  eq(s.stats.wins, 1, "win recorded");
  eq(s.stats.perfectWins, 1, "no lives lost, so flawless");
  ok(s.unlocked.includes("clear1"), "First Clear badge unlocks");
  ok(s.unlocked.includes("perfect"), "Flawless badge unlocks");
  eq(storage.has("breakout-stats-v1"), true, "stats persisted");
  T.overlay.hide();
}

// ---------- I. Win without being flawless ----------
{
  T.reset();
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lose one life
  T.go(); // relaunch — the ball is re-attached to the paddle after a loss
  T.killBricks(40);
  T.setBall(240, 200, 0.5, 0.5);
  T.update();
  const s = T.snap();
  eq(s.stats.wins, 2, "second win recorded");
  eq(s.stats.perfectWins, 1, "flawless count unchanged");
  T.overlay.hide();
}

// ---------- J. Grinder (lose after 250+ total bricks) ----------
{
  // Build the career brick count past 250 (the board holds 40, so a
  // "grind" is measured across games, not within one board).
  for (let i = 0; i < 250; i++) {
    T.reset();
    T.go();
    T.setBall(20, 70, 1, 1);
    T.update();
  }
  eq(T.snap().stats.bricks, 300, "300 bricks total");
  ok(T.snap().unlocked.includes("brick250"), "Masonry badge unlocks at 250 total");
  // Now lose a game while the total is comfortably over 250.
  T.reset();
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 3 -> 2
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 2 -> 1
  T.go();
  T.setBall(240, 500, 0, 2); T.update(); // lives 1 -> 0, game over
  const s = T.snap();
  eq(s.lives, 0, "no lives left after grind loss");
  eq(s.stats.grindGames, 1, "grind loss recorded");
  ok(s.unlocked.includes("grinder"), "Grinder badge unlocks");
  T.overlay.hide();
}

// ---------- K. Volume badges ----------
{
  T.stats.bestScore = 300;
  T.stats.bricks = 1000;
  T.stats.wins = 25;
  T.stats.games = 50;
  T.stats.livesLost = 20;
  T.checkAchievements();
  const s = T.snap();
  ok(s.unlocked.includes("score100"), "100-score badge unlocks");
  ok(s.unlocked.includes("score300"), "300-score badge unlocks");
  ok(s.unlocked.includes("brick1000"), "1000-brick badge unlocks");
  ok(s.unlocked.includes("wins5"), "5-clear badge unlocks");
  ok(s.unlocked.includes("wins25"), "25-clear badge unlocks");
  ok(s.unlocked.includes("games10"), "10-game badge unlocks");
  ok(s.unlocked.includes("games50"), "50-game badge unlocks");
  ok(s.unlocked.includes("lives20"), "20-lives-lost badge unlocks");
  eq(s.unlocked.length, 14, "all 14 badges unlocked at full volume", s.unlocked);
}

// ---------- L. Persistence round-trip ----------
{
  const saved = JSON.parse(storage.get("breakout-stats-v1"));
  ok(saved.bestScore >= 300, "saved stats include best score");
  const achv = JSON.parse(storage.get("breakout-achv-v1"));
  ok(Array.isArray(achv) && achv.includes("first"), "unlocked ids persisted");
}

// ---------- M. Sound button ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "click mutes sound");
  eq(storage.get("breakout-sound"), "off", "mute persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon flips to muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "click re-enables sound");
  eq(storage.get("breakout-sound"), "on", "unmute persisted");
}

// ---------- N. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  const gridHtml = elements.get("achv-grid").innerHTML;
  ok(gridHtml.includes("First Brick"), "grid renders badge names");
  ok(gridHtml.includes("achv--done"), "earned badges marked done");
  eq(elements.get("achv-count").textContent, "14 / 14", "count shows 14 / 14");
  ok(elements.get("achv-records").innerHTML.includes("Best score"), "records rendered");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
}

// ---------- O. Pause ----------
{
  T.reset();
  T.go();
  T.togglePause();
  let s = T.snap();
  eq(s.paused, true, "P pauses the game");
  eq(s.overlayTitle, "Paused", "pause overlay shown");
  T.togglePause();
  s = T.snap();
  eq(s.paused, false, "resume unpauses");
  eq(s.overlayTitle, null, "overlay cleared on resume");
}

// ---------- P. Pause before launch is a no-op ----------
{
  T.reset();
  eq(T.snap().launched, false, "not launched after reset");
  T.togglePause();
  eq(T.snap().paused, false, "pause ignored before launch");
  eq(T.snap().overlayTitle, null, "no pause overlay before launch");
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);
