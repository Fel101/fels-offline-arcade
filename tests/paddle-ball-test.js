// Deterministic tests for games/paddle-ball/script.js
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
    value: "",
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
    canvas: { width: 640, height: 400 },
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
  "game", "player", "cpu", "wins", "start", "difficulty",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
elements.get("game").width = 640;
elements.get("game").height = 400;
elements.get("achv-modal").hidden = true;
elements.get("difficulty").value = "medium";

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
const dir = root + "games/paddle-ball/";
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__PONG;
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
  eq(s.playerScore, 0, "starts at 0-0");
  eq(s.cpuScore, 0, "starts at 0-0 (CPU)");
  eq(s.running, false, "not running before Start");
  eq(s.paused, false, "not paused");
  eq(s.difficulty, "medium", "defaults to Medium");
  eq(s.aiSpeed, 0.1, "Medium maps to 0.1");
  ok(s.ball && s.ball.x === 320 && s.ball.y === 200, "ball starts at center", s.ball);
  eq(s.stats.wins, 0, "no wins yet");
  eq(s.stats.rounds, 0, "no matches yet");
  eq(s.overlayTitle, null, "no overlay at start");
  eq(elements.get("wins").textContent, 0, "wins HUD shows 0");
  eq(T.snap().unlocked.length, 0, "no badges at start");
}

// ---------- B. Difficulty ----------
{
  T.setDifficulty("hard");
  eq(T.snap().difficulty, "hard", "switches to Hard");
  eq(T.snap().aiSpeed, 0.16, "Hard maps to 0.16");
  eq(storage.get("pong-diff"), "hard", "difficulty persisted");

  T.setDifficulty("easy");
  eq(T.snap().aiSpeed, 0.06, "Easy maps to 0.06");

  T.setDifficulty("bogus");
  eq(T.snap().difficulty, "easy", "unknown difficulty ignored");

  T.setDifficulty("medium");
  eq(T.snap().aiSpeed, 0.1, "back to Medium");
}

// ---------- C. Ball physics ----------
{
  T.resetGame();
  T.startGame();
  const s = T.snap();
  eq(s.running, true, "Start begins play");

  // Top wall bounce
  T.setBall(320, 5, 2, -3);
  T.updateBall();
  let b = T.snap().ball;
  eq(b.y, 10, "top wall clamps ball to its radius");
  ok(b.vy > 0, "top wall reverses vy");

  // Bottom wall bounce
  T.setBall(320, 395, 2, 3);
  T.updateBall();
  b = T.snap().ball;
  eq(b.y, 390, "bottom wall clamps ball");
  ok(b.vy < 0, "bottom wall reverses vy");

  // Paddle bounce + rally
  T.setPaddleY("l", 160); // covers y 160..240
  T.setBall(34, 200, -3, 0);
  const rallyBefore = T.snap().rally;
  T.updateBall();
  b = T.snap().ball;
  ok(b.vx > 0, "left paddle sends ball back right");
  eq(T.snap().rally, rallyBefore + 1, "rally increments on paddle hit");
  ok(b.vx > 3, "paddle hit speeds the ball up", b.vx);
}

// ---------- D. Scoring ----------
{
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0); // out of the way
  T.setPaddleY("r", 0);
  T.setBall(-5, 200, -2, 0);
  T.updateBall();
  let s = T.snap();
  eq(s.cpuScore, 1, "CPU scores when ball leaves left edge");
  eq(s.rally, 0, "rally resets after a point");
  eq(s.overlayTitle, null, "no overlay after an ordinary point");

  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  T.setBall(645, 200, 2, 0);
  T.updateBall();
  s = T.snap();
  eq(s.playerScore, 1, "player scores when ball leaves right edge");
  eq(s.playerScore, s.cpuScore, "score is level after exchange");
}

// ---------- E. Ever-trailed tracking ----------
{
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  eq(T.snap().everTrailed, false, "fresh match: not trailed");
  T.setBall(-5, 200, -2, 0); T.updateBall(); // 0-1, CPU leads
  ok(T.snap().everTrailed, "CPU lead flags the player as trailed");
  T.setBall(645, 200, 2, 0); T.updateBall(); // 1-1, level
  T.setBall(645, 200, 2, 0); T.updateBall(); // 2-1, player leads
  ok(T.snap().everTrailed, "trailed flag stays latched once set");
}

// ---------- F. Winning 5-0 (sweep + debut) ----------
{
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  for (let i = 0; i < 4; i++) {
    T.setBall(645, 200, 2, 0);
    T.updateBall();
  }
  eq(T.snap().playerScore, 4, "four player points banked");
  T.setBall(645, 200, 2, 0);
  T.updateBall();
  const s = T.snap();
  eq(s.playerScore, 5, "fifth point wins");
  eq(s.overlayTitle, "You win! 🎉", "win overlay shown");
  eq(s.overlayMsg, "Final score 5 – 0.", "final score in overlay");
  eq(s.stats.wins, 1, "win recorded");
  eq(s.stats.rounds, 1, "match counted");
  eq(s.stats.sweeps, 1, "5-0 counts as a sweep");
  eq(s.stats.losses, 0, "no losses");
  ok(s.unlocked.includes("debut"), "Debut badge unlocks");
  ok(s.unlocked.includes("sweeps"), "Clean Sweep badge unlocks");
  eq(storage.has("pong-stats-v1"), true, "stats persisted");
  eq(elements.get("wins").textContent, 1, "wins HUD updates");
}

// ---------- G. Losing ----------
{
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  for (let i = 0; i < 5; i++) {
    T.setBall(-5, 200, -2, 0);
    T.updateBall();
  }
  const s = T.snap();
  eq(s.cpuScore, 5, "CPU reaches 5");
  eq(s.overlayTitle, "CPU wins 🤖", "loss overlay shown");
  eq(s.stats.losses, 1, "loss recorded");
  eq(s.stats.rounds, 2, "second match counted");
  ok(!s.unlocked.includes("fifty"), "no phantom badges");
  T.overlay.hide();
}

// ---------- H. Comeback + clutch (win 5-4 after trailing) ----------
{
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  // Build a 1-4 deficit (CPU led), then run to 5-4.
  T.setBall(-5, 200, -2, 0); T.updateBall(); // 0-1
  T.setBall(645, 200, 2, 0); T.updateBall(); // 1-1
  T.setBall(-5, 200, -2, 0); T.updateBall(); // 1-2
  T.setBall(-5, 200, -2, 0); T.updateBall(); // 1-3
  T.setBall(-5, 200, -2, 0); T.updateBall(); // 1-4 (trailed)
  ok(T.snap().everTrailed, "deficit flagged as trailed");
  T.setBall(645, 200, 2, 0); T.updateBall(); // 2-4
  T.setBall(645, 200, 2, 0); T.updateBall(); // 3-4
  T.setBall(645, 200, 2, 0); T.updateBall(); // 4-4
  T.setBall(645, 200, 2, 0); T.updateBall(); // 5-4 WIN
  const s = T.snap();
  eq(s.overlayTitle, "You win! 🎉", "cameback win overlay");
  eq(s.stats.comebacks, 1, "comeback recorded");
  eq(s.stats.clutch, 1, "5-4 recorded as clutch");
  ok(s.unlocked.includes("comeback"), "Cameback badge unlocks");
  ok(s.unlocked.includes("clutch"), "Clutch badge unlocks");
  T.overlay.hide();
}

// ---------- I. Hard-mode win ----------
{
  T.setDifficulty("hard");
  T.resetGame();
  T.startGame();
  T.setPaddleY("l", 0);
  T.setPaddleY("r", 0);
  for (let i = 0; i < 5; i++) {
    T.setBall(645, 200, 2, 0);
    T.updateBall();
  }
  const s = T.snap();
  eq(s.stats.hardWins, 1, "Hard win recorded");
  ok(s.unlocked.includes("hard1"), "Hard Court badge unlocks");
  T.setDifficulty("medium");
  T.overlay.hide();
}

// ---------- J. Rally badges ----------
{
  T.stats.maxRally = 25;
  T.checkAchievements();
  let s = T.snap();
  ok(s.unlocked.includes("rally10"), "Table Tennis (10) badge unlocks");
  ok(s.unlocked.includes("rally25"), "Tennis Player (25) badge unlocks");
  ok(!s.unlocked.includes("rally50"), "50-rally badge still locked");

  T.stats.maxRally = 50;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("rally50"), "Superstar (50) badge unlocks");
  T.stats.maxRally = 50;
}

// ---------- K. Volume badges ----------
{
  T.stats.wins = 25;
  T.stats.rounds = 50;
  T.checkAchievements();
  const s = T.snap();
  ok(s.unlocked.includes("five"), "5-win badge unlocks");
  ok(s.unlocked.includes("twentyfive"), "25-win badge unlocks");
  ok(s.unlocked.includes("games10"), "10-match badge unlocks");
  ok(s.unlocked.includes("games50"), "50-match badge unlocks");
  ok(!s.unlocked.includes("fifty"), "50-win badge still locked");
  ok(!s.unlocked.includes("games100"), "100-match badge still locked");

  T.stats.wins = 50;
  T.stats.rounds = 100;
  T.checkAchievements();
  const s2 = T.snap();
  ok(s2.unlocked.includes("fifty"), "50-win badge unlocks");
  ok(s2.unlocked.includes("games100"), "100-match badge unlocks");
  eq(s2.unlocked.length, 14, "all 14 badges unlocked at full volume", s2.unlocked);
}

// ---------- L. Persistence round-trip ----------
{
  const saved = JSON.parse(storage.get("pong-stats-v1"));
  ok(saved.wins >= 50, "saved stats include the wins");
  const achv = JSON.parse(storage.get("pong-achv-v1"));
  ok(Array.isArray(achv) && achv.includes("debut"), "unlocked ids persisted");
}

// ---------- M. Sound button ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "click mutes sound");
  eq(storage.get("pong-sound"), "off", "mute persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon flips to muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "click re-enables sound");
  eq(storage.get("pong-sound"), "on", "unmute persisted");
}

// ---------- N. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  const gridHtml = elements.get("achv-grid").innerHTML;
  ok(gridHtml.includes("Debut"), "grid renders badge names");
  ok(gridHtml.includes("achv--done"), "earned badges marked done");
  eq(elements.get("achv-count").textContent, "14 / 14", "count shows 14 / 14");
  ok(elements.get("achv-records").innerHTML.includes("Wins"), "records rendered");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
}

// ---------- O. Pause ----------
{
  T.resetGame();
  T.startGame();
  T.togglePause();
  let s = T.snap();
  eq(s.paused, true, "P pauses the game");
  eq(s.overlayTitle, "Paused", "pause overlay shown");
  T.togglePause();
  s = T.snap();
  eq(s.paused, false, "resume unpauses");
  eq(s.overlayTitle, null, "overlay cleared on resume");
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);
