// Deterministic tests for games/aim-trainer/script.js
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
    value: "",
    title: "",
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    _attrs: {},
    _listeners: {},
    classList: makeClassList(),
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign({ target: this, button: 0, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    focus() {},
    closest() { return null; },
    querySelector() { return makeEl("span"); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; },
  };
  let _className = "";
  Object.defineProperty(el, "className", {
    get() { return _className; },
    set(v) {
      _className = String(v);
      el.classList = makeClassList();
      _className.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
    },
  });
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get() { return _html; },
    set(v) { _html = v; if (v === "") el.children = []; },
  });
  return el;
}

function makeCtx() {
  const gradient = { addColorStop() {} };
  return {
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineCap: "",
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
    fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    drawImage() {}, setTransform() {},
  };
}

const ids = [
  "game", "score", "time", "acc", "restart", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
const canvasEl = elements.get("game");
canvasEl.width = 400;
canvasEl.height = 400;
canvasEl.getContext = () => makeCtx();
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  querySelector: (sel) => (sel === ".overlay .btn" ? makeEl("button") : makeEl("div")),
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); },
  removeEventListener() {},
};

let timerSeq = 0;
global.window = {
  innerWidth: 800,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => { (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn); },
  setTimeout: () => ++timerSeq,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/aim-trainer/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__AIM_TRAINER;
if (!T) { console.error("No test hook"); process.exit(1); }

let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}
function eq(a, b, msg) { ok(a === b, msg, { actual: a, expected: b }); }

function keydown(key, extra) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn(Object.assign({ key, target: { tagName: "BODY" }, preventDefault() {} }, extra || {}))
  );
}
function winEvent(t) { (listeners["win:" + t] || []).forEach((fn) => fn({})); }

// ---------- A. Init ----------
{
  eq(T.running, false, "not running yet");
  eq(T.score, 0, "score zero");
  eq(T.roundTime, 30000, "30 second round");
  eq(T.target, null, "no target yet");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("aim-trainer-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), "Aim Trainer", "start overlay shown");
}

// ---------- B. Start ----------
{
  T.startRound();
  eq(T.running, true, "start begins the round");
  eq(T.roundTime, 30000, "timer reset");
  ok(T.target !== null, "a target spawned");
  ok(T.target.r >= 16 && T.target.r <= 30, "target radius in range");
}

// ---------- C. Hit ----------
{
  const t = T.target;
  const score0 = T.score;
  T.click(t.x, t.y);
  ok(T.score > score0, "hitting a target scores points");
  eq(T.roundHits, 1, "hit counted");
  eq(T.combo, 1, "combo is 1");
  ok(T.target !== null, "a new target spawned");
}

// ---------- D. Miss ----------
{
  const misses0 = T.roundMisses;
  T.click(2, 2); // far from any target
  eq(T.roundMisses, misses0 + 1, "a miss is counted");
  eq(T.combo, 0, "a miss resets the combo");
}

// ---------- E. Bullseye ----------
{
  T.setTarget(200, 200, 30, 0);
  const bulls0 = T.roundBullseyes;
  T.click(200, 200);
  eq(T.roundBullseyes, bulls0 + 1, "a centre hit is a bullseye");
}

// ---------- F. Target expiry ----------
{
  T.setTarget(200, 200, 30, 0);
  T.click(200, 200); // build a combo
  const comboBefore = T.combo;
  ok(comboBefore >= 1, "combo built before expiry");
  T.setTargetAge(T.TARGET_LIFETIME + 10);
  T.step(16);
  eq(T.combo, 0, "expiry resets the combo");
  ok(T.target !== null && T.target.age < 50, "a fresh target spawned after expiry");
}

// ---------- G. Round end ----------
{
  T.setRoundTime(50);
  T.step(100);
  eq(T.running, false, "the round ended");
  eq(T.gameOver, true, "game over");
  eq(T.stats.games, 1, "round counted");
  eq(T.stats.losses, 1, "loss counted (score below target)");
  T.overlay.hide();
}

// ---------- H. Win ----------
{
  T.startRound();
  T.setScore(T.TARGET_SCORE);
  T.endRound();
  eq(T.gameOver, true, "game over on win");
  eq(T.overlayTitle(), "Target reached! 🎉", "win overlay shown");
  eq(T.stats.games, 2, "second round");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  T.overlay.hide();
}

// ---------- I. Lose ----------
{
  T.startRound();
  T.setScore(0);
  T.endRound();
  eq(T.overlayTitle(), "Time's up!", "loss overlay shown");
  eq(T.stats.games, 3, "third round");
  eq(T.stats.losses, 2, "second loss");
  eq(T.stats.streak, 0, "streak reset");
  T.overlay.hide();
}

// ---------- J. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.bestScore = 2000;
  T.stats.bestAccuracy = 80;
  T.stats.bestReaction = 200;
  T.stats.bullseyes = 25;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win5", "win10", "games10", "games25", "streak2", "streak3", "streak5", "score1k", "score2k", "accuracy80", "reaction300", "reaction200", "bullseye25"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- K. Pause ----------
{
  T.startRound();
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const t0 = T.roundTime;
  T.step(500);
  eq(T.roundTime, t0, "timer frozen while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
}

// ---------- L. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("aim-trainer-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("aim-trainer-sound"), "on", "preference restored");
}

// ---------- M. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows 14 of 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 14, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);