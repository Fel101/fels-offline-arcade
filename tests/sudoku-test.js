// Deterministic tests for games/sudoku/script.js using a temp copy with a test hook.
const fs = require("fs");
const path = require("path");

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
      if (on) set.add(c); else set.delete(c);
      return on;
    },
  };
}

function makeEl(id, tag = "div") {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    hidden: false,
    disabled: false,
    title: "",
    dataset: {},
    style: {},
    children: [],
    _listeners: {},
    _attrs: {},
    classList: makeClassList(),
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {},
    focus() {},
    addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); },
    removeEventListener() {},
    dispatch(type, ev = {}) {
      const e = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[type] || []).forEach((fn) => fn(e));
    },
    querySelector() { return makeEl("q", "div"); },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html || ""; },
    set(v) { this._html = v; if (v === "") this.children = []; },
  });
  Object.defineProperty(el, "offsetWidth", { get() { return 100; } });
  return el;
}

const ids = [
  "board", "countdown", "countdown-num", "time", "score", "mistakes", "mistakes-item",
  "combo", "hints", "hints-item", "best", "hint", "pause", "notes-btn", "hint-btn",
  "undo-btn", "redo-btn", "new-game", "check", "badges-btn", "badge-count", "sound-btn",
  "sound-icon", "difficulty-bar", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl(id));
elements.get("achv-modal").hidden = true;

const modeChips = ["classic", "attack", "daily"].map((m) => {
  const el = makeEl("mode-" + m, "button");
  el.dataset.mode = m;
  return el;
});
const diffChips = ["easy", "medium", "hard", "expert"].map((d) => {
  const el = makeEl("diff-" + d, "button");
  el.dataset.diff = d;
  return el;
});
const numBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => {
  const el = makeEl("num-" + n, "button");
  el.dataset.n = String(n);
  return el;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (tag) => makeEl("created-" + tag, tag),
  querySelector: (sel) => (sel === ".mode-chip" ? modeChips[0] : makeEl("q")),
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".diff-chip") return diffChips;
    if (sel === ".num-btn") return numBtns;
    return [];
  },
  addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); },
  removeEventListener() {},
};

global.window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (type, fn) => { (listeners["win:" + type] || (listeners["win:" + type] = [])).push(fn); },
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
};

global.getComputedStyle = () => ({
  getPropertyValue: (name) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
    }[name] || ""),
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

let rafCb = null;
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

const repo = require("./_env").gameScript("sudoku");
let code = fs.readFileSync(repo, "utf8");
const CORE = require("./_env").CORE;
if (fs.existsSync(CORE)) code = fs.readFileSync(CORE, "utf8") + "\n" + code;

// Test hook now ships in the game source.
try {
  eval(code);
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__S;
let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}
function eq(actual, expected, msg) {
  ok(actual === expected, msg, { actual, expected });
}
function deepEq(actual, expected, msg) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), msg, { actual, expected });
}

let frameTs = 100000;
function frames(n, step = 16.7) {
  for (let i = 0; i < n; i++) {
    frameTs += step;
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error("no rAF callback");
    cb(frameTs);
  }
}

function validSolution(g) {
  for (let r = 0; r < 9; r++) {
    const row = new Set(g[r]);
    if (row.size !== 9 || [...row].some((v) => v < 1 || v > 9)) return false;
  }
  for (let c = 0; c < 9; c++) {
    const col = new Set();
    for (let r = 0; r < 9; r++) col.add(g[r][c]);
    if (col.size !== 9) return false;
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const box = new Set();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box.add(g[br + i][bc + j]);
      if (box.size !== 9) return false;
    }
  }
  return true;
}

function nearSolved(count = 1) {
  const { solution } = T.generatePuzzle("easy", "near-solved-seed");
  // A valid puzzle with `count` empty cells: the rest are givens.
  const puz = solution.map((r) => r.slice());
  let cleared = 0;
  for (let r = 0; r < 9 && cleared < count; r++) {
    for (let c = 0; c < 9 && cleared < count; c++) {
      puz[r][c] = 0;
      cleared++;
    }
  }
  return { solution, puzzle: puz };
}

// ---------- A. Generation ----------
for (const d of ["easy", "medium", "hard", "expert"]) {
  const { solution, puzzle } = T.generatePuzzle(d, "gen-seed-" + d);
  ok(validSolution(solution), `${d}: solution is a valid completed grid`);
  eq(T.countSolutions(puzzle.map((r) => r.slice()), 2), 1, `${d}: puzzle has a unique solution`);
  let givens = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (puzzle[r][c] !== 0) {
      givens++;
      eq(puzzle[r][c], solution[r][c], `${d}: given matches solution at ${r},${c}`);
    }
  }
  ok(givens >= 81 - T.DIFFS[d].removes, `${d}: removed close to target`, { givens, target: 81 - T.DIFFS[d].removes });
}

// determinism
const g1 = T.generatePuzzle("medium", "daily-2026-01-01");
const g2 = T.generatePuzzle("medium", "daily-2026-01-01");
deepEq(g1.puzzle, g2.puzzle, "seeded generation is deterministic");
const g3 = T.generatePuzzle("medium", "daily-2026-01-02");
ok(JSON.stringify(g1.puzzle) !== JSON.stringify(g3.puzzle), "different seeds give different puzzles");

// ---------- B. Initial state ----------
let s = T.snap();
eq(s.mode, "classic", "starts in classic mode");
eq(s.diff, "medium", "starts at medium");
eq(s.started, false, "starts in countdown");
ok(s.countdown > 0, "countdown is running");
eq(s.score, 0, "score starts 0");
eq(s.over, false, "not over");
eq(s.diffHidden, false, "difficulty bar visible in classic");
eq(s.newGameDisabled, false, "new puzzle enabled in classic");
eq(s.hintDisabled, false, "hint enabled in classic");

// ---------- C. Countdown ----------
frames(60);
s = T.snap();
eq(s.started, false, "still counting after ~1s");
frames(120);
s = T.snap();
eq(s.started, true, "countdown finishes after ~3s");

// ---------- D. Correct / wrong placement ----------
{
  const { solution, puzzle } = nearSolved(2);
  T.setPuzzle(solution, puzzle);
  let target = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0) { target = { r, c }; break; }
  T.selectCell(target.r, target.c);
  T.setState({ started: true });
  T.placeNumber(solution[target.r][target.c]);
  s = T.snap();
  eq(s.score, 12, "first correct placement scores 12", s.score);
  eq(s.combo, 1, "combo increments on correct");
  eq(s.over, false, "one cell left does not win yet");
  // fill the last cell
  let last = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0 && !(r === target.r && c === target.c)) last = { r, c };
  T.selectCell(last.r, last.c);
  T.placeNumber(solution[last.r][last.c]);
  s = T.snap();
  eq(s.over, true, "filling the last cell wins");
  eq(s.won, true, "win flag set");
  eq(s.overlayTitle, "Solved! 🎉", "win overlay title", s.overlayTitle);
  ok(s.score > 12, "completion bonus added", s.score);
  ok(s.stats.solves >= 1, "solve counted");
}

// wrong placement
{
  const { solution, puzzle } = nearSolved();
  T.setMode("classic", true);
  T.setPuzzle(solution, puzzle);
  let target = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0) { target = { r, c }; break; }
  const wrong = solution[target.r][target.c] % 9 + 1;
  T.selectCell(target.r, target.c);
  T.setState({ started: true });
  T.placeNumber(wrong);
  s = T.snap();
  eq(s.mistakes, 1, "wrong entry counts a mistake");
  eq(s.score, 0, "wrong entry does not score");
  eq(s.combo, 0, "wrong entry resets combo");
  eq(s.over, false, "classic has no mistake limit");
}

// ---------- E. Combo scoring ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "combo-seed");
  const puz = puzzle.map((r) => r.slice());
  const empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puz[r][c] === 0) empties.push({ r, c });
  // clear 3 empties and fill them in order
  const picks = empties.slice(0, 3);
  for (const p of picks) puz[p.r][p.c] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true });
  let expected = 0;
  picks.forEach((p, i) => {
    T.selectCell(p.r, p.c);
    T.placeNumber(solution[p.r][p.c]);
    expected += 10 + Math.min(i + 1, 10) * 2;
  });
  s = T.snap();
  eq(s.score, expected, "combo scoring formula", { actual: s.score, expected });
  eq(s.maxCombo, 3, "max combo recorded");
}

// ---------- F. Notes ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "notes-seed");
  const puz = puzzle.map((r) => r.slice());
  puz[4][4] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true });
  T.selectCell(4, 4);
  T.toggleNotes();
  eq(T.snap().notesMode, true, "notes mode on");
  T.placeNumber(5);
  s = T.snap();
  ok(s.notes[4][4].includes(5), "note added");
  eq(s.stats.noteEntries, T.snap().stats.noteEntries, "note stat consistent");
  ok(s.stats.noteEntries >= 1, "note entry counted");
  T.placeNumber(5);
  s = T.snap();
  ok(!s.notes[4][4].includes(5), "tapping same note removes it");
  T.toggleNotes();
  eq(T.snap().notesMode, false, "notes mode off");
}

// ---------- G. Undo / redo ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "undo-seed");
  const puz = puzzle.map((r) => r.slice());
  puz[0][0] = 0;
  puz[0][1] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true });
  T.selectCell(0, 0);
  T.placeNumber(solution[0][0]);
  const afterPlace = T.snap();
  ok(afterPlace.history === 1, "history recorded");
  T.undo();
  s = T.snap();
  eq(s.values[0][0], 0, "undo clears the cell");
  eq(s.score, 0, "undo restores score");
  ok(s.stats.undos >= 1, "undo counted");
  T.redo();
  s = T.snap();
  eq(s.values[0][0], solution[0][0], "redo reapplies the value");
  eq(s.score, afterPlace.score, "redo restores score");
}

// ---------- H. Hint ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "hint-seed");
  const puz = puzzle.map((r) => r.slice());
  puz[8][8] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true });
  T.selectCell(8, 8);
  T.useHint();
  s = T.snap();
  eq(s.values[8][8], solution[8][8], "hint fills the correct value");
  eq(s.hintsLeft, 2, "hint consumed");
  eq(s.hintsUsed, 1, "hint usage counted");
  ok(s.stats.hintsUsed >= 1, "hint stat recorded");
  ok(s.unlocked.includes("hint"), "Hint Master unlocks");
}

// ---------- I. Mistake limit (Time Attack) ----------
{
  T.setMode("attack", true);
  const { solution, puzzle } = T.generatePuzzle("easy", "attack-seed");
  const puz = puzzle.map((r) => r.slice());
  const empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puz[r][c] === 0) empties.push({ r, c });
  for (const e of empties.slice(0, 3)) puz[e.r][e.c] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true });
  for (let i = 0; i < 3; i++) {
    const e = empties[i];
    T.selectCell(e.r, e.c);
    T.placeNumber(solution[e.r][e.c] % 9 + 1);
  }
  s = T.snap();
  eq(s.mistakes, 3, "three mistakes counted");
  eq(s.over, true, "third mistake ends the game");
  eq(s.overlayTitle, "Out of Mistakes", "mistake-limit overlay", s.overlayTitle);
}

// ---------- J. Mode UI ----------
T.setMode("daily", true);
s = T.snap();
eq(s.mode, "daily", "daily mode active");
eq(s.diffHidden, true, "difficulty hidden in daily");
eq(s.newGameDisabled, true, "new puzzle disabled in daily");
eq(s.hintDisabled, false, "hint enabled in daily");
eq(s.hintsLeft, 3, "daily has hints");
deepEq(s.modePressed, ["false", "false", "true"], "daily chip pressed");
T.setMode("attack", true);
s = T.snap();
eq(s.diffHidden, false, "difficulty visible in attack");
eq(s.newGameDisabled, false, "new puzzle enabled in attack");
T.setMode("classic", true);
s = T.snap();
deepEq(s.modePressed, ["true", "false", "false"], "classic chip pressed");
eq(s.hintsLeft, 3, "hints restored in classic");

// ---------- K. Best persistence per mode/diff ----------
T.setMode("classic", true);
T.setDiff("hard");
{
  const { solution, puzzle } = nearSolved();
  T.setPuzzle(solution, puzzle);
  T.setState({ started: true, elapsed: 95000 });
  let target = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0) { target = { r, c }; break; }
  T.selectCell(target.r, target.c);
  T.placeNumber(solution[target.r][target.c]);
}
s = T.snap();
eq(storage.get("sudoku-best-v1-classic-hard"), JSON.stringify({ t: 95000, s: s.score }), "best time/score persisted", storage.get("sudoku-best-v1-classic-hard"));
T.setMode("classic", true);
storage.delete("sudoku-best-v1-classic-easy");
T.setDiff("easy");
s = T.snap();
ok(!storage.has("sudoku-best-v1-classic-easy"), "other difficulty has its own best");

// ---------- L. No AI code path ----------
{
  T.setMode("classic", true);
  s = T.snap();
  eq(s.mode, "classic", "no ai mode exists");
  ok(!("ai" in s), "no ai state in snapshot");
  ok(!("aiDiff" in s), "no aiDiff state in snapshot");
  deepEq(s.modePressed, ["true", "false", "false"], "only three mode chips");
}

// ---------- M. Daily streak ----------
{
  T.setMode("daily", true);
  const { solution } = T.generatePuzzle("medium", T.dateStr());
  const puz = solution.map((r) => r.slice());
  puz[0][0] = 0;
  T.setPuzzle(solution, puz);
  T.setState({ started: true, elapsed: 42000 });
  T.selectCell(0, 0);
  T.placeNumber(solution[0][0]);
  s = T.snap();
  eq(s.over, true, "daily solve completes");
  eq(s.daily.streak, 1, "daily streak starts at 1");
  eq(s.daily.lastDate, T.dateStr(), "daily last date is today");
  ok(s.stats.dailySolves >= 1, "daily solve counted");
  ok(s.unlocked.includes("daily"), "Daily Habit unlocks");
}

// ---------- N. Achievements via stats ----------
T.setMode("classic", true);
T.setState({ started: true });
T.stats.solves = 99;
T.checkAchievements();
ok(T.snap().unlocked.includes("solves25"), "Getting Serious unlocks at 25");
T.stats.solves = 100;
T.checkAchievements();
ok(T.snap().unlocked.includes("solves100"), "Century unlocks at 100");
T.stats.bestTime = 110000;
T.checkAchievements();
ok(T.snap().unlocked.includes("speed2"), "Lightning unlocks under 2:00");
T.stats.solvesEasy = 1;
T.stats.solvesMedium = 1;
T.stats.solvesHard = 1;
T.stats.solvesExpert = 1;
T.checkAchievements();
ok(T.snap().unlocked.includes("allDiffs"), "Full Spectrum unlocks");

// ---------- O. Persistence ----------
ok(!!storage.get("sudoku-stats-v1"), "stats persisted");
ok(!!storage.get("sudoku-achv-v1"), "achievements persisted");
const achv = JSON.parse(storage.get("sudoku-achv-v1") || "[]");
ok(achv.includes("first") && achv.includes("daily"), "achievement ids persisted", achv);

// ---------- P. Long run without errors ----------
T.setMode("classic", true);
T.reset();
try {
  frames(600);
  ok(true, "long frame run without runtime errors");
} catch (err) {
  ok(false, "long frame run threw", String(err));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
