// Deterministic tests for games/maze-chase/script.js
const fs = require("fs");

const listeners = {};
const elements = new Map();
let activeElement = null;

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
    focus() { activeElement = this; },
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

const playerArcs = [];
global.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
};

function makeCtx() {
  const gradient = { addColorStop() {} };
  return {
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineCap: "",
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, ellipse() {}, rect() {},
    arc(x, y, radius, start, end) {
      if (this.fillStyle === "#ffd94d") playerArcs.push({ start, end });
    },
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
canvasEl.width = 460;
canvasEl.height = 500;
canvasEl.getContext = () => makeCtx();
const modalEl = elements.get("achv-modal");
modalEl.hidden = true;
// The real dialog has a backdrop and a separate Close button. Mirror that here
// so focus/trap behavior is actually exercised instead of stubbed away.
const modalBackdrop = makeEl("div", "modal-backdrop");
modalBackdrop.setAttribute("data-close", "");
const modalCloseBtn = makeEl("button", "modal-close");
modalCloseBtn.setAttribute("data-close", "");
modalEl.querySelectorAll = (sel) => {
  if (sel === "[data-close]") return [modalBackdrop, modalCloseBtn];
  if (sel.indexOf("button") !== -1) return [modalCloseBtn];
  return [];
};
modalEl.querySelector = (sel) => modalEl.querySelectorAll(sel)[0] || makeEl("span");
modalEl.contains = (n) => n === modalEl || n === modalBackdrop || n === modalCloseBtn;

const body = makeEl("body", "body");
global.document = {
  body,
  get activeElement() { return activeElement; },
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
const { MAZE_W, MAZE_H } = T;

const emptyDots = () => Array.from({ length: MAZE_H }, () => new Array(MAZE_W).fill(0));

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
  eq(g.length, 25, "stage is 25 rows");
  ok(g.every((row) => row.length === 23), "every row has 23 columns");
  eq(g[0].every((x) => x === "#"), true, "top border is wall");
  eq(g[MAZE_H - 1].every((x) => x === "#"), true, "bottom border is wall");
  eq(T.player.r, 17, "player starts near the bottom");
  eq(T.player.c, 11, "player starts in the middle column");
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
  for (const row of g) for (const tile of row) if (tile === ".") openCount++;

  const seen = new Set(["1,1"]);
  const queue = [[1, 1]];
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (g[nr]?.[nc] === "." && !seen.has(nr + "," + nc)) {
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
  const nd = emptyDots();
  nd[target[0]][target[1]] = 1; // the dot we will eat
  nd[MAZE_H - 2][MAZE_W - 2] = 1; // a far-away dot so the level does not end
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
  for (let r = 0; r < MAZE_H && !pellet; r++)
    for (let c = 0; c < MAZE_W; c++)
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
  const nd = emptyDots();
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

// ---------- N. Pac-Man stage and ghost behaviour ----------
{
  T.newGame();
  const g = T.maze;
  let symmetric = true;
  for (let r = 0; r < MAZE_H; r++)
    for (let c = 0; c < MAZE_W; c++) if (g[r][c] !== g[r][MAZE_W - 1 - c]) symmetric = false;
  eq(symmetric, true, "the stage is left-right symmetric");
  eq(g[12][11], " ", "a centre ghost pen exists");
  eq(g[11][11], "=", "the pen has an exit gate");
  eq(T.canMove(11, 11), false, "the gate blocks the player");
  eq(T.canMove(12, 0), true, "the left tunnel is open");
  eq(T.canMove(12, MAZE_W - 1), true, "the right tunnel is open");
  for (const [r, c] of [[1, 1], [1, MAZE_W - 2], [MAZE_H - 2, 1], [MAZE_H - 2, MAZE_W - 2]])
    eq(T.dots[r][c], 2, `corner power pellet at ${r},${c}`);
  eq(T.dots[T.player.r][T.player.c], 0, "no dot under the player start");
  eq(JSON.stringify(T.GHOST_DIRS), JSON.stringify([[-1, 0], [0, -1], [1, 0], [0, 1]]), "arcade direction priority");
  eq(JSON.stringify(T.PEN_STARTS), JSON.stringify([[10, 11], [12, 11], [12, 10], [12, 12]]), "four ghosts start at the pen");
  eq(T.ghosts.filter((x) => x.leaving).length, 3, "three ghosts start inside the pen");

  // Every ghost escapes the pen instead of oscillating in the three-cell slot.
  T.startGame();
  T.setGhostCooldown(1);
  for (let i = 0; i < 120; i++) T.step();
  ok(T.ghosts.every((x) => !x.leaving), "all ghosts escape the pen", T.ghosts);

  // Scatter/chase schedule flips after seven seconds and reverses the ghosts.
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  T.setPlayerDir(0, 0);
  eq(T.scatterMode, true, "play begins in scatter mode");
  eq(T.modeIndex, 0, "the mode schedule starts at phase 0");
  for (let i = 0; i < 421; i++) T.step();
  eq(T.scatterMode, false, "ghosts switch to chase mode");
  eq(T.modeIndex, 1, "the schedule advances");

  // A power pellet reverses every ghost immediately.
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  const before = T.ghosts.map((x) => x.dir);
  let pellet = null;
  for (let r = 0; r < MAZE_H && !pellet; r++)
    for (let c = 0; c < MAZE_W; c++) if (T.dots[r][c] === 2) { pellet = [r, c]; break; }
  T.setPlayerPos(pellet[0], pellet[1]);
  T.eat();
  ok(T.powerTimer > 0, "eating the pellet starts power mode");
  ok(
    T.ghosts.every((x, i) => x.dir[0] === -before[i][0] && x.dir[1] === -before[i][1]),
    "frightened ghosts turn tail at once"
  );

  // Side tunnels wrap the player to the opposite edge.
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  T.setPlayerPos(12, 0);
  T.setDir(0, -1);
  for (let i = 0; i < 7; i++) T.step();
  eq(T.player.r, 12, "the player stays on the tunnel row");
  eq(T.player.c, MAZE_W - 1, "the player wraps to the far side");
}

// The mouth follows travel in the canvas's column (x) and row (y) axes.
{
  for (const [key, dr, dc] of [["ArrowRight", 0, 1], ["ArrowDown", 1, 0], ["ArrowLeft", 0, -1], ["ArrowUp", -1, 0]]) {
    T.newGame();
    T.startGame();
    T.setGhostCooldown(9999);
    T.setPlayerPos(16, 11);
    // A turn on the upper/lower pen lanes provides a valid corridor in each direction.
    if (!T.canMove(16 + dr, 11 + dc)) T.setPlayerPos(14, 11);
    const before = T.player;
    keydown(key);
    T.step();
    eq(T.player.r, before.r + dr, `${key} moves on the row axis`);
    eq(T.player.c, before.c + dc, `${key} moves on the column axis`);
    T.draw();
    const { start, end } = playerArcs.at(-1);
    const mouth = (start + end) / 2 - Math.PI;
    ok(Math.abs(Math.cos(mouth) - dc) < 1e-9 && Math.abs(Math.sin(mouth) - dr) < 1e-9, `${key} points the mouth along travel`);
  }
}

// ---------- O. Badges dialog focus and simulation suspension ----------
{
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  T.setPlayerDir(0, 0);
  T.setPowerTimer(480);

  const headerBtn = elements.get("badges-btn");
  headerBtn.focus();
  T.openAchv();
  eq(T.badgesOpen, true, "Badges marks the dialog open");
  eq(activeElement, modalCloseBtn, "the Close button gets focus, not the backdrop");
  modalEl.dispatch("keydown", { key: "Tab", shiftKey: true });
  eq(activeElement, modalCloseBtn, "Shift+Tab stays inside the dialog");
  modalEl.dispatch("keydown", { key: "Tab", shiftKey: false });
  eq(activeElement, modalCloseBtn, "Tab stays inside the dialog");

  // All simulation is frozen while the dialog owns input.
  const held = { power: T.powerTimer, r: T.player.r, c: T.player.c };
  for (let i = 0; i < 60; i++) T.tickLoop(1000 / 60);
  T.step();
  keydown("ArrowLeft");
  eq(T.powerTimer, held.power, "power timer frozen while Badges is open");
  eq(T.player.r, held.r, "player row frozen while Badges is open");
  eq(T.player.c, held.c, "player column frozen while Badges is open");
  eq(T.player.nextDir[0], 0, "gameplay shortcuts ignored while Badges is open");
  eq(T.player.nextDir[1], 0, "gameplay keys do not change direction while Badges is open");

  keydown("Escape");
  eq(T.badgesOpen, false, "Escape closes the dialog");
  eq(activeElement, headerBtn, "focus returns to the header Badges button");
  for (let i = 0; i < 60; i++) T.tickLoop(1000 / 60);
  ok(T.powerTimer < held.power, "play resumes after closing Badges");

  // Backdrop dismissal still works.
  T.openAchv();
  modalBackdrop.dispatch("click");
  eq(T.badgesOpen, false, "clicking the backdrop closes the dialog");

  // Opening from the pause overlay keeps that overlay and its state intact.
  T.setPaused(true);
  const overlayBadges = document.querySelector(".overlay .btn");
  overlayBadges.focus();
  T.openAchv();
  eq(activeElement, modalCloseBtn, "overlay action opens with focus on Close");
  eq(T.powerTimer, T.powerTimer, "paused game stays paused behind Badges");
  keydown("Escape");
  eq(activeElement, overlayBadges, "focus returns to the overlay Badges action");
  eq(T.paused, true, "the pause survives closing Badges");
  eq(T.overlayTitle(), "Paused", "the pause overlay controls are preserved");
  T.setPaused(false);

  // The same is true from an end-of-game overlay.
  T.endGame();
  T.openAchv();
  T.closeAchv();
  eq(T.state, "over", "game-over state survives Badges");
  eq(T.overlayTitle(), "Game Over", "game-over controls are preserved");
}

// ---------- P. Refresh-rate independent simulation ----------
{
  function runSecond(hz) {
    T.newGame();
    T.startGame();
    T.setGhostCooldown(9999);
    T.setPlayerDir(0, 0);
    T.setPowerTimer(480);
    for (let i = 0; i < hz; i++) T.tickLoop(1000 / hz);
    return T.powerTimer;
  }
  const at60 = runSecond(60);
  const at120 = runSecond(120);
  eq(at60, 420, "one second at 60 Hz advances 60 simulation ticks");
  eq(at120, 420, "one second at 120 Hz advances the same 60 ticks");
  ok(T.tickCarry < T.TICK_MS, "no whole tick is left in carryover");

  T.newGame();
  T.startGame();
  T.setPowerTimer(480);
  T.setPaused(true);
  for (let i = 0; i < 120; i++) T.tickLoop(1000 / 60);
  eq(T.powerTimer, 480, "paused time never advances the simulation");
  eq(T.tickCarry, 0, "paused frames do not bank carryover");
}

// ---------- Q. Tile-swap collisions ----------
{
  // Player (1,4) moves left while the ghost (1,3) moves right: they trade tiles.
  T.newGame();
  T.startGame();
  T.setPlayerPos(1, 4);
  T.setPlayerDir(0, -1);
  T.setGhost(0, 1, 3);
  T.setGhostDir(0, 0, 1);
  T.setGhostCooldown(1);
  const lives0 = T.lives;
  T.step();
  eq(T.lives, lives0 - 1, "a swap costs one life");

  // Powered swap eats the ghost instead.
  T.newGame();
  T.startGame();
  T.setPlayerPos(1, 4);
  T.setPlayerDir(0, -1);
  T.setGhost(0, 1, 3);
  T.setGhostDir(0, 0, 1);
  T.setGhostCooldown(1);
  T.setPowerTimer(480);
  const eaten0 = T.stats.ghosts;
  T.step();
  ok(T.stats.ghosts > eaten0, "a powered swap eats the ghost");
  eq(T.lives, 3, "a powered swap costs no life");

  // Ordinary same-tile collision is unchanged.
  T.newGame();
  T.startGame();
  T.setPlayerPos(1, 2);
  T.setPlayerDir(0, 0);
  T.setGhost(0, 1, 1);
  T.setGhostDir(0, 0, 1);
  T.setGhostCooldown(1);
  const lives1 = T.lives;
  T.step();
  eq(T.lives, lives1 - 1, "a same-tile collision still costs a life");

  // Moving in the same direction past no one is safe.
  T.newGame();
  T.startGame();
  T.setPlayerPos(1, 4);
  T.setPlayerDir(0, 1);
  T.setGhost(0, 1, 3);
  T.setGhostDir(0, 0, 1);
  T.setGhostCooldown(1);
  const lives2 = T.lives;
  T.step();
  eq(T.lives, lives2, "moving alongside a ghost does not collide");

  // The side tunnels still wrap after the collision change.
  T.newGame();
  T.startGame();
  T.setGhostCooldown(9999);
  T.setPlayerPos(12, 0);
  T.setDir(0, -1);
  for (let i = 0; i < 7; i++) T.step();
  eq(T.player.c, MAZE_W - 1, "side tunnel still wraps the player");
}

// ---------- R. Shared modal helper ----------
{
  function makeDialog() {
    const el = makeEl("div", "test-dialog");
    const back = makeEl("div"); back.setAttribute("data-close", "");
    const close = makeEl("button"); close.setAttribute("data-close", "");
    const a = makeEl("button");
    const b = makeEl("button");
    el.querySelectorAll = (sel) => {
      if (sel === "[data-close]") return [back, close];
      if (sel.indexOf("button") !== -1) return [close, a, b];
      return [];
    };
    el.querySelector = (sel) => el.querySelectorAll(sel)[0] || makeEl("span");
    el.contains = (n) => n === el || n === back || n === close || n === a || n === b;
    return { el, back, close, a, b };
  }

  const opener = makeEl("button");
  opener.focus();
  const d = makeDialog();
  const ctl = global.window.Arcade.modal.create(d.el, {});
  ctl.open();
  eq(activeElement, d.close, "the helper focuses the real Close button, not the backdrop");
  d.b.focus();
  d.el.dispatch("keydown", { key: "Tab" });
  eq(activeElement, d.close, "Tab wraps from the last control to the first");
  d.close.focus();
  d.el.dispatch("keydown", { key: "Tab", shiftKey: true });
  eq(activeElement, d.b, "Shift+Tab wraps from the first control to the last");
  ctl.close();
  eq(activeElement, opener, "the helper restores the actual opener");

  const elsewhere = makeEl("button");
  opener.focus();
  const d2 = makeDialog();
  const ctl2 = global.window.Arcade.modal.create(d2.el, {
    onClose: () => elsewhere.focus(),
  });
  ctl2.open();
  ctl2.close();
  eq(activeElement, elsewhere, "an explicit focus in onClose wins over opener restoration");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
