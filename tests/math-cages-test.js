// Deterministic tests for games/math-cages/script.js
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
  "board", "pad", "level", "size", "mistakes", "prev", "next", "restart", "undo",
  "check", "hint", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon",
  "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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
  eval(fs.readFileSync(root + "games/math-cages/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__KENKEN;
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
  eq(T.PUZZLES.length, 12, "12 puzzles");
  eq(T.levelIndex, 0, "starts on puzzle 1");
  eq(T.size, 4, "first puzzle is 4x4");
  eq(T.values.length, 4, "4 rows");
  eq(T.values[0].length, 4, "4 columns");
  eq(T.values.flat().every((v) => v === 0), true, "grid starts empty");
  eq(elements.get("board").children.length, 16, "16 cells rendered");
  eq(elements.get("pad").children.length, 5, "4 number keys plus erase");
  eq(T.mistakes, 0, "no mistakes yet");
  eq(T.stats.games, 0, "no games counted yet");
  eq(storage.has("kenken-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "start overlay dismissed");
}

// ---------- B. Every puzzle is valid ----------
{
  for (let p = 0; p < T.PUZZLES.length; p++) {
    const puzzle = T.PUZZLES[p];
    const n = puzzle.size;
    const sol = puzzle.solution;

    // rows and columns are permutations of 1..n
    for (let r = 0; r < n; r++) {
      const row = sol[r].slice().sort((a, b) => a - b);
      eq(row.join(","), Array.from({ length: n }, (_, i) => i + 1).join(","), `puzzle ${p} row ${r} is a permutation`);
    }
    for (let c = 0; c < n; c++) {
      const col = sol.map((row) => row[c]).sort((a, b) => a - b);
      eq(col.join(","), Array.from({ length: n }, (_, i) => i + 1).join(","), `puzzle ${p} col ${c} is a permutation`);
    }

    // cages cover the board exactly once and hit their targets
    const seen = new Set();
    let okCages = true;
    for (const cage of puzzle.cages) {
      const vals = [];
      for (const [r, c] of cage.cells) {
        const k = r + "," + c;
        if (seen.has(k)) okCages = false;
        seen.add(k);
        vals.push(sol[r][c]);
      }
      let good = false;
      const t = cage.target;
      if (cage.op === "=" && vals.length === 1) good = vals[0] === t;
      else if (cage.op === "+") good = vals.reduce((a, b) => a + b, 0) === t;
      else if (cage.op === "*") good = vals.reduce((a, b) => a * b, 1) === t;
      else if (cage.op === "-" && vals.length === 2) good = Math.abs(vals[0] - vals[1]) === t;
      else if (cage.op === "/" && vals.length === 2) {
        const hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
        good = hi / lo === t;
      }
      if (!good) okCages = false;
    }
    ok(okCages, `puzzle ${p} cages are satisfied`);
    eq(seen.size, n * n, `puzzle ${p} cages cover every cell exactly once`);
  }
}

// ---------- C. Placing values ----------
{
  T.loadLevel(0, false);
  T.selectCell(0, 0);
  const correct = T.solution[0][0];
  T.placeValue(correct);
  eq(T.values[0][0], correct, "value placed in the selected cell");
  eq(T.historyLength, 1, "placement recorded for undo");
  eq(T.stats.games, 1, "first placement counts the attempt");

  T.placeValue(0);
  eq(T.values[0][0], 0, "erase clears the cell");
  eq(T.historyLength, 2, "erase recorded");
}

// ---------- D. Conflicts ----------
{
  T.loadLevel(0, false);
  // Put the same value in two cells of the same row.
  T.selectCell(0, 0);
  T.placeValue(1);
  T.selectCell(0, 1);
  T.placeValue(1);
  const conflicts = T.computeConflicts();
  ok(conflicts.has("0,0"), "first duplicate flagged");
  ok(conflicts.has("0,1"), "second duplicate flagged");
}

// ---------- E. Check ----------
{
  T.loadLevel(0, false);
  T.selectCell(0, 0);
  // Put a deliberately wrong value in row 0.
  const wrongVal = (T.solution[0][0] % T.size) + 1;
  T.placeValue(wrongVal === T.solution[0][0] ? (wrongVal % T.size) + 1 : wrongVal);
  const mistakes0 = T.mistakes;
  T.check();
  eq(T.mistakes, mistakes0 + 1, "Check counts a wrong cell");
  T.overlay.hide();
}

// ---------- F. Hint ----------
{
  T.loadLevel(0, false);
  T.selectCell(1, 1);
  const before = T.hintsUsed;
  T.useHint();
  eq(T.hintsUsed, before + 1, "hint counted");
  eq(T.values[1][1], T.solution[1][1], "hint reveals the correct value");
  eq(T.selected.r, 1, "hint keeps the selection");
  eq(T.selected.c, 1, "hint keeps the selection");
}

// ---------- G. Undo ----------
{
  T.loadLevel(0, false);
  T.selectCell(0, 0);
  T.placeValue(1);
  T.placeValue(2);
  eq(T.values[0][0], 2, "value is 2");
  T.undo();
  eq(T.values[0][0], 1, "undo reverts one step");
  T.undo();
  eq(T.values[0][0], 0, "undo reverts to empty");
  eq(T.historyLength, 0, "undo stack empty");
}

// ---------- H. Win ----------
{
  T.loadLevel(0, false);
  for (let r = 0; r < T.size; r++) {
    for (let c = 0; c < T.size; c++) {
      T.selectCell(r, c);
      T.placeValue(T.solution[r][c]);
    }
  }
  eq(T.won, true, "filling the grid correctly wins");
  eq(T.stats.wins, 1, "win recorded");
  eq(T.stats.solved4, 1, "4x4 solve recorded");
  eq(T.stats.perfect, 1, "no-mistake solve recorded");
  ok(T.overlayTitle().indexOf("Solved!") === 0, "win overlay shown");
}

// ---------- I. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.solved4 = 3;
  T.stats.solved5 = 3;
  T.stats.perfect = 5;
  T.stats.bestStreak = 5;
  T.stats.games = 25;
  T.stats.noHintWins = 5;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "win5", "win10", "solve4", "solve5", "perfect1", "perfect5", "streak3", "streak5", "games10", "games25", "nohint1", "nohint5", "allrounder"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- J. Pause ----------
{
  T.loadLevel(0, false);
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.values);
  T.placeValue(1);
  eq(JSON.stringify(T.values), before, "board frozen while paused");
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

// ---------- K. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("kenken-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
}

// ---------- L. Badges modal ----------
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

// ---------- M. Navigation ----------
{
  T.loadLevel(0, false);
  elements.get("next").dispatch("click");
  eq(T.levelIndex, 1, "Next advances a puzzle");
  elements.get("prev").dispatch("click");
  eq(T.levelIndex, 0, "Prev goes back");
  elements.get("prev").dispatch("click");
  eq(T.levelIndex, 0, "Prev stops at the first puzzle");
}

// ---------- N. Restart ----------
{
  T.loadLevel(0, false);
  T.selectCell(0, 0);
  T.placeValue(1);
  eq(T.values[0][0], 1, "a value placed");
  elements.get("restart").dispatch("click");
  eq(T.values[0][0], 0, "restart clears the grid");
  eq(T.mistakes, 0, "restart resets mistakes");
  eq(T.historyLength, 0, "restart clears the undo stack");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);