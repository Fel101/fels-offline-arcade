// Deterministic tests for games/traffic-jam/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 360 }; },
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

const ids = [
  "grid", "level", "moves", "par", "level-name", "prev", "next", "restart", "undo",
  "hint", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
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
  eval(fs.readFileSync(root + "games/traffic-jam/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__RUSH_HOUR;
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

// Hide the start overlay so gameplay input is accepted.
T.overlay.hide();

// ---------- A. Init ----------
{
  eq(T.LEVELS.length, 12, "12 levels");
  eq(T.levelIndex, 0, "starts on level 1");
  eq(T.levelName, "First Gear", "first level name");
  eq(T.moves, 0, "no moves yet");
  eq(T.won, false, "not won");
  eq(T.paused, false, "not paused");
  eq(T.selected, -1, "nothing selected");
  eq(T.vehicles.length, 2, "level 1 has two cars");
  eq(T.vehicles[0].id, "X", "target is car X");
  eq(T.stats.games, 0, "no games counted yet");
  eq(storage.has("rush-hour-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "start overlay dismissed");
  eq(elements.get("grid").children.length, 36 + 2, "36 cells plus 2 cars rendered");
  eq(elements.get("par").textContent, T.par, "par shown in the status bar");
  ok(T.par > 0, "par is positive");
}

// ---------- B. Every level is solvable ----------
{
  const pars = [];
  for (let i = 0; i < T.LEVELS.length; i++) {
    T.loadLevel(i, false);
    const sol = T.bfsSolve(T.vehicles, 200000);
    ok(sol && sol.moves >= 1, "level " + (i + 1) + " is solvable (gesture BFS)");
    const par = T.computePar(T.vehicles);
    ok(Number.isFinite(par) && par > 0, "level " + (i + 1) + " has a finite par");
    pars.push(par);
    // The stored/served par should match the recomputed optimum.
    eq(T.par, par, "level " + (i + 1) + " par matches the optimum");
  }
  console.log("  pars:", pars.join(", "));
}

// ---------- C. Movement and blocking (level 1) ----------
{
  T.loadLevel(0, false);
  const aIdx = T.vehicles.findIndex((v) => v.id === "A");
  const xIdx = T.vehicles.findIndex((v) => v.id === "X");

  // X cannot move left at column 0.
  T.selectCar(xIdx);
  const x0 = T.vehicles[xIdx].col;
  T.nudge(xIdx, -1);
  eq(T.vehicles[xIdx].col, x0, "target cannot move past the left edge");
  eq(T.moves, 0, "a blocked nudge costs no move");

  // Move A down one cell: this frees the target's lane.
  T.selectCar(aIdx);
  const aRow0 = T.vehicles[aIdx].row;
  T.nudge(aIdx, 1);
  eq(T.vehicles[aIdx].row, aRow0 + 1, "car A slides down one cell");
  eq(T.moves, 1, "a one-cell slide counts as one move");
  eq(T.historyLength, 1, "the move is on the undo stack");

  // The target can now travel to the right edge.
  T.selectCar(xIdx);
  for (let i = 0; i < 4; i++) T.nudge(xIdx, 1);
  eq(T.vehicles[xIdx].col, 4, "target reached the right edge");
  eq(T.won, true, "freeing the target wins the level");
  eq(T.moves, 5, "five cells slid in total");
}

// ---------- D. Undo ----------
{
  T.loadLevel(0, false);
  const aIdx = T.vehicles.findIndex((v) => v.id === "A");
  const xIdx = T.vehicles.findIndex((v) => v.id === "X");
  const aRow0 = T.vehicles[aIdx].row;
  T.nudge(aIdx, 1);
  T.nudge(aIdx, 1);
  eq(T.moves, 2, "two moves made");
  T.undo();
  eq(T.vehicles[aIdx].row, aRow0 + 1, "undo reverts one slide");
  eq(T.moves, 1, "undo refunds the move");
  T.undo();
  eq(T.vehicles[aIdx].row, aRow0, "undo reverts to the start");
  eq(T.moves, 0, "no moves left");
  eq(T.undosUsed, 2, "undo usage tracked");
  T.undo();
  eq(T.moves, 0, "undo on an empty stack is a no-op");
}

// ---------- E. Hint ----------
{
  T.loadLevel(0, false);
  const before = T.hintsUsed;
  T.useHint();
  eq(T.hintsUsed, before + 1, "using a hint is tracked");
  ok(T.selected >= 0, "a hint selects a car to move");
  const sol = T.bfsSolve(T.vehicles, 200000);
  ok(sol && sol.first, "the position still has a solution");
}

// ---------- F. Win flow and stats ----------
{
  T.loadLevel(0, false);
  T.stats.games = 0;
  T.stats.wins = 0;
  T.stats.perfects = 0;
  T.stats.efficient = 0;
  T.stats.noHint = 0;
  T.stats.noUndo = 0;
  T.stats.totalMoves = 0;
  const aIdx = T.vehicles.findIndex((v) => v.id === "A");
  const xIdx = T.vehicles.findIndex((v) => v.id === "X");
  T.nudge(aIdx, 1);
  for (let i = 0; i < 4; i++) T.nudge(xIdx, 1);
  eq(T.won, true, "solved");
  eq(T.stats.games, 1, "the attempt was counted");
  eq(T.stats.wins, 1, "a win recorded");
  eq(T.stats.totalMoves, 5, "moves accumulated");
  eq(T.stats.solved, 1, "distinct level recorded");
  eq(T.solvedCount, 1, "solved count matches");
  ok(T.overlayTitle().indexOf("Level Clear!") === 0, "win overlay shown");
  ok(T.overlayTitle().indexOf("★") >= 0, "stars shown");
  eq(T.moves <= T.par, true, "an optimal solve earns three stars");
}

// ---------- G. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.solved = 12;
  T.stats.perfects = 12;
  T.stats.efficient = 1;
  T.stats.noHint = 1;
  T.stats.noUndo = 1;
  T.stats.totalMoves = 100;
  T.stats.games = 25;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "win5", "win10", "solve6", "solve12", "perfect1", "perfect5", "games10", "games25", "efficient", "nohint", "noundo", "moves100", "perfect12"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- H. Pause ----------
{
  T.loadLevel(0, false);
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.vehicles);
  T.nudge(1, 1);
  eq(JSON.stringify(T.vehicles), before, "board frozen while paused");
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

// ---------- I. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("rush-hour-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("rush-hour-sound"), "on", "preference restored");
}

// ---------- J. Badges modal ----------
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

// ---------- K. Level navigation ----------
{
  T.loadLevel(0, false);
  elements.get("next").dispatch("click");
  eq(T.levelIndex, 1, "Next advances a level");
  eq(T.moves, 0, "new level starts at zero moves");
  elements.get("next").dispatch("click");
  eq(T.levelIndex, 2, "Next advances again");
  elements.get("prev").dispatch("click");
  eq(T.levelIndex, 1, "Prev goes back a level");
  elements.get("prev").dispatch("click");
  eq(T.levelIndex, 0, "Prev goes back again");
  elements.get("prev").dispatch("click");
  eq(T.levelIndex, 0, "Prev stops at the first level");
}

// ---------- L. Restart ----------
{
  T.loadLevel(0, false);
  const aIdx = T.vehicles.findIndex((v) => v.id === "A");
  const aRow0 = T.vehicles[aIdx].row;
  T.nudge(aIdx, 1);
  eq(T.moves, 1, "a move made");
  elements.get("restart").dispatch("click");
  eq(T.moves, 0, "restart clears the move count");
  eq(T.vehicles[aIdx].row, aRow0, "restart restores the starting layout");
  eq(T.historyLength, 0, "restart clears the undo stack");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);