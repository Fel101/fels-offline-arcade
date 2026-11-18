// Deterministic tests for games/match-3/script.js
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
  "board", "score", "target", "moves", "new-game", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
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
  eval(fs.readFileSync(root + "games/match-3/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__MATCH3;
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

function gridFrom(rows) { return rows.map((r) => r.slice()); }
function emptyGrid() { return Array.from({ length: 8 }, () => new Array(8).fill(-1)); }
function full(g) { return g.every((row) => row.every((x) => x !== -1)); }

// A grid with no pre-existing matches and one known valid swap at (0,1)<->(1,1).
const SWAP_GRID = [
  [0, 1, 0, 2, 3, 4, 5, 0],
  [1, 0, 2, 3, 4, 5, 0, 1],
  [2, 3, 4, 5, 0, 1, 2, 3],
  [3, 4, 5, 0, 1, 2, 3, 4],
  [4, 5, 0, 1, 2, 3, 4, 5],
  [5, 0, 1, 2, 3, 4, 5, 0],
  [0, 1, 2, 3, 4, 5, 0, 1],
  [1, 2, 3, 4, 5, 0, 1, 2],
];

// ---------- A. Init ----------
{
  const g = T.grid;
  eq(g.length, 8, "8 rows");
  eq(g[0].length, 8, "8 columns");
  eq(elements.get("board").children.length, 64, "64 gems rendered");
  eq(T.score, 0, "score zero");
  eq(T.moves, 30, "30 moves");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("match-3-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.anyMatched(T.findMatches(g).matched), false, "starting board has no matches");
  eq(T.hasPossibleMove(g), true, "starting board has a possible move");
}

// ---------- B. findMatches ----------
{
  const h = emptyGrid();
  for (let c = 0; c < 3; c++) h[0][c] = 0;
  const m1 = T.findMatches(h);
  eq(m1.matched[0][0] && m1.matched[0][1] && m1.matched[0][2], true, "horizontal three marked");
  eq(m1.fives, 0, "three is not a five");

  const v = emptyGrid();
  for (let r = 0; r < 3; r++) v[r][3] = 1;
  const m2 = T.findMatches(v);
  eq(m2.matched[0][3] && m2.matched[1][3] && m2.matched[2][3], true, "vertical three marked");

  const five = emptyGrid();
  for (let c = 0; c < 5; c++) five[4][c] = 2;
  const m3 = T.findMatches(five);
  eq(m3.fives, 1, "five in a row counted");

  const none = gridFrom(SWAP_GRID);
  eq(T.anyMatched(T.findMatches(none).matched), false, "clean grid has no matches");
}

// ---------- C. hasPossibleMove ----------
{
  eq(T.hasPossibleMove(emptyGrid()), false, "empty board has no moves");
  const g = gridFrom(SWAP_GRID);
  eq(T.hasPossibleMove(g), true, "board with a known swap has a move");
}

// ---------- D. trySwap ----------
{
  T.setState({ grid: gridFrom(SWAP_GRID), score: 0, moves: 30 });
  const before = T.score;
  const okSwap = T.trySwap(0, 1, 1, 1);
  eq(okSwap, true, "a match-making swap is accepted");
  eq(T.moves, 29, "a valid swap costs a move");
  ok(T.score > before, "score increased");

  T.setState({ grid: gridFrom(SWAP_GRID), score: 0, moves: 30 });
  const snapshot = JSON.stringify(T.grid);
  const badSwap = T.trySwap(0, 0, 0, 1);
  eq(badSwap, false, "a non-matching swap is rejected");
  eq(T.moves, 30, "a rejected swap costs no move");
  eq(JSON.stringify(T.grid), snapshot, "a rejected swap leaves the board unchanged");
}

// ---------- E. resolve and gravity ----------
{
  T.setSeed(12345);
  const g = gridFrom(SWAP_GRID);
  for (let c = 0; c < 3; c++) g[0][c] = 0;
  const res = T.resolve(g);
  ok(res.cleared >= 3, "at least three gems cleared");
  ok(res.cascades >= 1, "at least one cascade pass");
  ok(res.points > 0, "points awarded");
  eq(full(g), true, "board refilled after clearing");
}

// ---------- F. Scoring for a five ----------
{
  T.setSeed(999);
  const g = emptyGrid();
  for (let c = 0; c < 5; c++) g[0][c] = 4;
  const res = T.resolve(g);
  ok(res.fives >= 1, "a five-run is reported");
}

// ---------- G. Win and lose ----------
{
  T.setState({ grid: T.generateGrid(), score: T.TARGET, moves: 5 });
  T.checkEnd();
  eq(T.gameOver, true, "target reached ends the game");
  eq(T.overlayTitle(), "Target reached! 🎉", "win overlay shown");
  eq(T.stats.wins, 1, "win counted");
  T.overlay.hide();

  T.setState({ grid: T.generateGrid(), score: 0, moves: 0 });
  T.checkEnd();
  eq(T.gameOver, true, "no moves ends the game");
  eq(T.overlayTitle(), "Out of moves", "loss overlay shown");
  eq(T.stats.losses, 1, "loss counted");
  T.overlay.hide();
}

// ---------- H. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.bestScore = 5000;
  T.stats.totalCleared = 500;
  T.stats.bestCascade = 4;
  T.stats.fives = 1;
  T.stats.losses = 10;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win5", "win10", "games10", "games25", "streak2", "streak3", "streak5", "score2k", "score5k", "clear500", "cascade4", "fives1", "losses10"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- I. Pause ----------
{
  T.setState({ grid: T.generateGrid(), score: 0, moves: 30 });
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.grid);
  T.trySwap(0, 0, 0, 1);
  eq(JSON.stringify(T.grid), before, "board frozen while paused");
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

// ---------- J. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("match-3-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("match-3-sound"), "on", "preference restored");
}

// ---------- K. Badges modal ----------
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