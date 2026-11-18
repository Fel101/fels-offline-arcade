// Deterministic tests for games/alien-attack/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 520 }; },
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

// Canvas 2D context stub.
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
  "game", "score", "best", "wave", "lives", "restart", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
const canvasEl = elements.get("game");
canvasEl.width = 400;
canvasEl.height = 520;
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
  requestAnimationFrame: () => 1, // never fires — tests call step() by hand
  cancelAnimationFrame: () => {},
  pointerup: null,
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
  eval(fs.readFileSync(root + "games/alien-attack/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__SPACE_INVADERS;
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
  const s = T.snap();
  eq(s.state, "ready", "starts ready");
  eq(s.aliensAlive, 50, "50 aliens");
  eq(s.lives, 3, "three lives");
  eq(s.score, 0, "score zero");
  eq(s.wave, 1, "wave one");
  eq(T.stats.games, 0, "no games counted yet");
  eq(storage.has("space-invaders-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), "Alien Attack", "start overlay shown");
}

// ---------- B. Start and movement ----------
{
  T.start();
  eq(T.snap().state, "playing", "start begins play");
  eq(T.stats.games, 1, "run counted at start");

  const x0 = T.playerX;
  T.setInput({ left: true });
  for (let i = 0; i < 10; i++) T.step();
  const x1 = T.playerX;
  ok(x1 < x0, "moves left");

  T.setInput({ left: false, right: true });
  for (let i = 0; i < 10; i++) T.step();
  ok(T.playerX > x1, "moves right");

  T.setPlayerX(0);
  T.setInput({ left: true, right: false });
  T.step();
  eq(T.playerX, 0, "clamped at the left edge");

  T.setPlayerX(T.W - T.PLAYER_W);
  T.setInput({ left: false, right: true });
  T.step();
  eq(T.playerX, T.W - T.PLAYER_W, "clamped at the right edge");
  T.setInput({ left: false, right: false });
}

// ---------- C. Firing ----------
{
  T.resetBoard();
  T.fire();
  eq(T.snap().bullets, 1, "bullet fired");
  eq(T.shotsThisGame, 1, "shot counted");
  T.fire();
  eq(T.snap().bullets, 1, "cooldown blocks an immediate refire");

  T.resetBoard();
  T.addBullet(50, 100);
  T.addBullet(70, 100);
  const shots = T.stats.shots;
  T.fire();
  eq(T.snap().bullets, 2, "at most two player bullets");
  eq(T.stats.shots, shots, "no shot counted when at the bullet cap");
}

// ---------- D. Bullet destroys an alien ----------
{
  T.resetBoard();
  const a = T.getAliens().find((x) => x.alive);
  T.addBullet(a.x + 5, a.y + 8);
  const kills = T.stats.kills;
  const score0 = T.snap().score;
  T.step();
  eq(T.snap().aliensAlive, 49, "alien destroyed");
  eq(T.stats.kills, kills + 1, "kill counted");
  ok(T.snap().score > score0, "score increased");
}

// ---------- E. Bomb hits the player ----------
{
  T.resetBoard();
  T.setLives(3);
  const px = T.playerX;
  T.addBomb(px + 10, T.PLAYER_Y);
  T.step();
  eq(T.snap().lives, 2, "lost a life");
  ok(T.invuln > 0, "briefly invulnerable after a hit");

  const lives2 = T.snap().lives;
  T.addBomb(px + 10, T.PLAYER_Y);
  T.step();
  eq(T.snap().lives, lives2, "no damage while invulnerable");
}

// ---------- F. Bunkers absorb fire ----------
{
  T.resetBoard();
  const b = T.getBunkers()[0];
  const hp = b.hp;
  T.addBullet(b.x + 10, b.y + 5);
  T.step();
  eq(T.getBunkers()[0].hp, hp - 1, "bunker damaged by a bullet");
}

// ---------- G. UFO ----------
{
  T.resetBoard();
  T.setUfo(100, 40, 0);
  T.addBullet(110, 45);
  const ufos = T.stats.ufos;
  T.step();
  eq(T.snap().ufo, null, "UFO destroyed");
  eq(T.stats.ufos, ufos + 1, "UFO counted");
}

// ---------- H. Wave clear ----------
{
  T.resetBoard();
  T.clearAliens();
  T.step();
  eq(T.snap().wave, 2, "wave advanced");
  eq(T.stats.waves, 2, "waves stat updated");
  eq(T.snap().aliensAlive, 50, "a fresh fleet spawned");
}

// ---------- I. Game over ----------
{
  T.resetBoard();
  T.setLives(1);
  const games = T.stats.games;
  T.loseLife();
  eq(T.snap().state, "over", "game over when lives run out");
  eq(T.stats.games, games, "games counted at run start, not again at the end");
  eq(T.overlayTitle(), "Game Over", "game-over overlay shown");

  T.resetBoard();
  T.lowerAliens(T.PLAYER_Y);
  T.step();
  eq(T.snap().state, "over", "aliens reaching the ground ends the game");
}

// ---------- J. Badge thresholds ----------
{
  T.stats.kills = 250;
  T.stats.bestScore = 1500;
  T.stats.waves = 10;
  T.stats.games = 25;
  T.stats.bestAccuracy = 50;
  T.stats.ufos = 10;
  T.stats.livesLost = 20;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["kills50", "kills250", "score500", "score1500", "wave3", "wave5", "wave10", "games10", "games25", "acc50", "ufo10", "lives20"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- K. Pause ----------
{
  T.resetBoard();
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const x = T.playerX;
  T.setInput({ left: true });
  T.step();
  eq(T.playerX, x, "no movement while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  T.setInput({ left: false });

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
  eq(storage.get("space-invaders-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("space-invaders-sound"), "on", "preference restored");
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