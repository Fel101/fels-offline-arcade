// Deterministic tests for games/tower-defense/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 576, height: 384 }; },
    setPointerCapture() {},
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
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineCap: "", lineWidth: 1,
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, ellipse() {}, rect() {},
    fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    drawImage() {}, setTransform() {},
  };
}

const ids = [
  "game", "gold", "lives", "wave", "speed", "palette", "start-wave", "speed-btn", "upgrade",
  "sell", "restart", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
const canvasEl = elements.get("game");
canvasEl.width = 576;
canvasEl.height = 384;
canvasEl.getContext = () => makeCtx();
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
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
  eval(fs.readFileSync(root + "games/tower-defense/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__TOWER_DEFENSE;
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

T.overlay.hide();

// ---------- A. Init ----------
{
  eq(T.COLS, 12, "12 columns");
  eq(T.ROWS, 8, "8 rows");
  eq(T.PATH.length > 10, true, "a path is defined");
  eq(T.WAVES.length, 10, "10 waves");
  eq(T.gold, 130, "starting gold");
  eq(T.lives, 20, "starting lives");
  eq(T.wave, 0, "no wave yet");
  eq(T.gameState, "build", "starts in the build phase");
  eq(T.towers.length, 0, "no towers yet");
  eq(elements.get("palette").children.length, 3, "three tower types in the palette");
  eq(elements.get("game").width, 576, "canvas width");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(storage.has("tower-defense-stats-v1"), true, "stats persisted under the core key");
}

// ---------- B. Buildable cells ----------
{
  let grass = 0;
  let path = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 12; c++) {
      if (T.isBuildable(c, r)) grass++;
      else path++;
    }
  }
  eq(grass + path, 96, "every cell is either buildable or path");
  ok(grass > 40, "plenty of buildable grass");
  eq(T.isBuildable(-1, 1), false, "off-board cells are not buildable");
}

// ---------- C. Placing towers ----------
{
  T.newGame();
  let spot = null;
  for (let r = 0; r < 8 && !spot; r++)
    for (let c = 0; c < 12; c++)
      if (T.isBuildable(c, r)) { spot = { c, r }; break; }
  ok(spot, "found a buildable cell");

  const gold0 = T.gold;
  eq(T.placeTower(spot.c, spot.r, "arrow"), true, "a tower can be built on grass");
  eq(T.gold, gold0 - T.TOWER_TYPES.arrow.cost, "gold was spent");
  eq(T.towers.length, 1, "one tower exists");
  eq(T.stats.towersBuilt >= 1, true, "tower build counted");

  eq(T.placeTower(spot.c, spot.r, "arrow"), false, "cannot build on an occupied cell");
  eq(T.placeTower(1, 1), false, "cannot build on the path");

  T.setGold(5);
  eq(T.placeTower(spot.c + 1, spot.r, "cannon"), false, "cannot build without enough gold");
}

// ---------- D. Upgrade and sell ----------
{
  T.newGame();
  eq(T.placeTower(0, 0, "arrow"), true, "tower placed");
  T.setSelected(0);
  const gold0 = T.gold;
  const cost = Math.round(T.TOWER_TYPES.arrow.cost * 0.8 * 1);
  T.upgradeSelected();
  eq(T.towers[0].level, 2, "tower upgraded to level 2");
  eq(T.gold, gold0 - cost, "upgrade cost deducted");
  eq(T.towers[0].damage > T.TOWER_TYPES.arrow.damage, true, "upgrade increased damage");

  const gold1 = T.gold;
  T.sellSelected();
  eq(T.towers.length, 0, "tower sold");
  eq(T.gold > gold1, true, "selling refunds gold");
}

// ---------- E. Start a wave ----------
{
  T.newGame();
  T.startWave();
  eq(T.wave, 1, "wave counter advanced");
  eq(T.gameState, "wave", "state is wave");
  T.update(100);
  eq(T.enemies.length >= 1, true, "an enemy spawned");
  T.update(100);
  T.startWave();
  eq(T.wave, 1, "cannot start a wave twice");
}

// ---------- F. Enemies move ----------
{
  T.newGame();
  T.spawnEnemy("grunt");
  const e0 = T.enemies[0];
  for (let i = 0; i < 10; i++) T.update(50);
  const e1 = T.enemies[0];
  ok(e1.seg > e0.seg || e1.x !== e0.x, "the enemy moved along the path");
}

// ---------- G. Towers shoot ----------
{
  T.newGame();
  eq(T.placeTower(1, 0, "arrow"), true, "arrow tower placed near the path");
  T.spawnEnemy("grunt");
  let killed = false;
  for (let i = 0; i < 400 && !killed; i++) {
    T.update(50);
    if (T.stats.kills > 0) killed = true;
  }
  ok(killed, "the tower destroyed an enemy");
}

// ---------- H. Reaching the base costs a life ----------
{
  T.newGame();
  T.setLives(5);
  T.spawnEnemy("grunt");
  for (let i = 0; i < 500 && T.lives === 5; i++) T.update(100);
  eq(T.lives, 4, "an enemy reaching the base costs a life");
}

// ---------- I. Losing ----------
{
  T.newGame();
  T.setLives(1);
  T.spawnEnemy("grunt");
  for (let i = 0; i < 800 && T.gameState !== "over"; i++) T.update(100);
  eq(T.gameState, "over", "losing all lives ends the game");
  eq(T.overlayTitle().indexOf("fallen") >= 0 || T.overlayTitle().indexOf("fallen") >= 0, true, "loss overlay shown");
}

// ---------- J. Winning ----------
{
  T.newGame();
  T.stats.wins = 0;
  T.setWave(10);
  T.endGame(true);
  eq(T.gameState, "win", "winning sets the win state");
  eq(T.stats.wins, 1, "the win is recorded");
  eq(T.stats.bestWave, 10, "best wave recorded");
  ok(T.overlayTitle().indexOf("defended") >= 0, "win overlay shown");
  T.newGame();
}

// ---------- K. Badge thresholds ----------
{
  T.stats.games = 10;
  T.stats.wins = 10;
  T.stats.bestWave = 10;
  T.stats.kills = 200;
  T.stats.towersBuilt = 30;
  T.stats.totalGold = 500;
  T.stats.flawlessWins = 1;
  T.stats.bestGold = 300;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "win1", "win5", "wave5", "wave10", "kills50", "kills200", "towers10", "towers30", "gold500", "flawless", "rich", "veteran"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- L. Speed toggle ----------
{
  T.newGame();
  const before = T.speed;
  elements.get("speed-btn").dispatch("click");
  eq(T.speed, before === 1 ? 2 : 1, "speed toggles");
}

// ---------- M. Pause ----------
{
  T.newGame();
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const t0 = T.enemies.length;
  T.update(500);
  eq(T.enemies.length, t0, "no spawning while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
}

// ---------- N. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("tower-defense-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
}

// ---------- O. Badges modal ----------
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

// ---------- P. Restart ----------
{
  T.newGame();
  T.setGold(1);
  T.setLives(1);
  elements.get("restart").dispatch("click");
  eq(T.gold, T.START_GOLD, "restart restores gold");
  eq(T.lives, T.START_LIVES, "restart restores lives");
  eq(T.wave, 0, "restart resets the wave");
  eq(T.gameState, "build", "restart returns to build");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);