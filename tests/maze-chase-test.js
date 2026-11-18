// Deterministic tests for games/maze-chase/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 380, height: 380 }; },
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
  "game", "score", "level", "lives", "restart", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
const canvasEl = elements.get("game");
canvasEl.width = 380;
canvasEl.height = 380;
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
  eval(fs.readFileSync(root + "games/maze-chase/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__MAZE_CHASE;
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

function openNeighbors(r, c) {
  const out = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (T.canMove(nr, nc)) out.push([nr, nc, dr, dc]);
  }
  return out;
}

// ---------- A. Init ----------
{
  const g = T.maze;
  eq(g.length, 19, "maze is 19 rows");
  eq(g[0].length, 19, "maze is 19 columns");
  eq(g[0].every((x) => x === "#"), true, "top border is wall");
  eq(g[18].every((x) => x === "#"), true, "bottom border is wall");
  eq(T.player.r, 1, "player starts on row 1");
  eq(T.player.c, 1, "player starts on column 1");
  eq(T.ghosts.length, 4, "four ghosts");
  eq(T.lives, 3, "three lives");
  eq(T.score, 0, "score zero");
  eq(T.level, 1, "level one");
  eq(T.state, "ready", "starts ready");
  eq(T.stats.games, 0, "no games counted yet");
  eq(storage.has("maze-chase-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), "Maze Chase", "start overlay shown");
  ok(T.dotsRemaining > 0, "dots placed on the board");
}

// ---------- B. Maze connectivity ----------
{
  const g = T.maze;
  let openCount = 0;
  for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++) if (g[r][c] === ".") openCount++;

  const seen = new Set(["1,1"]);
  const queue = [[1, 1]];
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && g[nr][nc] === "." && !seen.has(nr + "," + nc)) {
        seen.add(nr + "," + nc);
        queue.push([nr, nc]);
      }
    }
  }
  eq(seen.size, openCount, "every open cell is reachable from the start");
}

// ---------- C. Start and movement ----------
{
  T.startGame();
  eq(T.state, "playing", "start begins play");
  eq(T.stats.games, 1, "run counted at start");

  const p = T.player;
  const dirs = openNeighbors(p.r, p.c);
  ok(dirs.length > 0, "player has an open neighbour");
  const [nr, nc, dr, dc] = dirs[0];
  T.setDir(dr, dc);
  const before = [T.player.r, T.player.c];
  for (let i = 0; i < 8; i++) T.step();
  ok(T.player.r !== before[0] || T.player.c !== before[1], "player moved to the next cell");
}

// ---------- D. Eating a dot ----------
{
  T.setGhostCooldown(9999); // park the ghosts
  T.setPlayerPos(1, 1);
  const p = T.player;
  const target = openNeighbors(p.r, p.c)[0];
  const nd = Array.from({ length: 19 }, () => new Array(19).fill(0));
  nd[target[0]][target[1]] = 1; // the dot we will eat
  nd[17][17] = 1; // a far-away dot so the level does not end
  T.setDots(nd);
  const score0 = T.score;
  const rem0 = T.dotsRemaining;
  T.setDir(target[2], target[3]);
  for (let i = 0; i < 10; i++) T.step();
  eq(T.score, score0 + 10, "eating a dot scores 10");
  eq(T.dotsRemaining, rem0 - 1, "dots remaining decreased");
  eq(T.stats.dots >= 1, true, "dot counted in stats");
}

// ---------- E. Power pellet ----------
{
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  let pellet = null;
  for (let r = 0; r < 19 && !pellet; r++)
    for (let c = 0; c < 19; c++)
      if (T.dots[r][c] === 2) { pellet = [r, c]; break; }
  ok(pellet, "a power pellet exists");
  const nbrs = openNeighbors(pellet[0], pellet[1]);
  ok(nbrs.length > 0, "the pellet has an open neighbour");
  const [nr, nc, , ] = nbrs[0];
  T.setPlayerPos(nr, nc);
  const dr = pellet[0] - nr;
  const dc = pellet[1] - nc;
  T.setPowerTimer(0);
  T.setDir(dr, dc);
  for (let i = 0; i < 10; i++) T.step();
  ok(T.powerTimer > 0, "eating a power pellet starts power mode");
}

// ---------- F. Eating a ghost ----------
{
  T.setGhostCooldown(9999);
  T.setPowerTimer(480);
  T.setPlayerDir(0, 0); // stand still
  const p = T.player;
  T.setGhost(0, p.r, p.c);
  const score0 = T.score;
  const ghosts0 = T.stats.ghosts;
  T.step();
  eq(T.score, score0 + 200, "eating a ghost scores 200");
  eq(T.stats.ghosts, ghosts0 + 1, "ghost counted");
  eq(T.ghosts[0].r !== p.r || T.ghosts[0].c !== p.c, true, "eaten ghost respawns at its start");
}

// ---------- G. Losing a life ----------
{
  T.setGhostCooldown(9999);
  T.setPowerTimer(0);
  T.setPlayerDir(0, 0);
  const p = T.player;
  T.setGhost(0, p.r, p.c);
  const lives0 = T.lives;
  T.step();
  eq(T.lives, lives0 - 1, "being caught costs a life");
}

// ---------- H. Clearing a level ----------
{
  T.setGhostCooldown(9999);
  T.setPlayerPos(1, 1);
  const p = T.player;
  const target = openNeighbors(p.r, p.c)[0];
  const nd = Array.from({ length: 19 }, () => new Array(19).fill(0));
  nd[target[0]][target[1]] = 1;
  T.setDots(nd);
  eq(T.dotsRemaining, 1, "one dot left");
  T.setPlayerPos(p.r, p.c);
  T.setDir(target[2], target[3]);
  for (let i = 0; i < 10; i++) T.step();
  eq(T.level, 2, "clearing the last dot advances the level");
  ok(T.dotsRemaining > 0, "the new level has fresh dots");
}

// ---------- I. Game over ----------
{
  T.setLives(1);
  T.setPowerTimer(0);
  T.setPlayerDir(0, 0);
  T.setGhost(0, T.player.r, T.player.c);
  T.setGhostCooldown(9999);
  T.step();
  eq(T.state, "over", "losing the last life ends the game");
  eq(T.overlayTitle(), "Game Over", "game-over overlay shown");
}

// ---------- J. Badge thresholds ----------
{
  T.stats.dots = 500;
  T.stats.bestScore = 5000;
  T.stats.levels = 10;
  T.stats.games = 25;
  T.stats.ghosts = 10;
  T.stats.pellets = 25;
  T.stats.livesLost = 20;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["dots100", "dots500", "score1k", "score5k", "level3", "level5", "level10", "games10", "games25", "ghost10", "pellets25", "lives20"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- K. Pause ----------
{
  T.startGame();
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.player);
  for (let i = 0; i < 20; i++) T.step();
  eq(JSON.stringify(T.player), before, "player frozen while paused");
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
  eq(storage.get("maze-chase-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("maze-chase-sound"), "on", "preference restored");
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