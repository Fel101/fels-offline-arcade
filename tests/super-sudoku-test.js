// Deterministic tests for games/super-sudoku/script.js.
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
  "board", "countdown", "countdown-num", "time", "cards", "cells", "mistakes",
  "combo", "hints", "best", "hint", "pause", "notes-btn", "hint-btn", "undo-btn",
  "redo-btn", "new-game", "check", "badges-btn", "badge-count", "sound-btn",
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

const repo = require("./_env").gameScript("super-sudoku");
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

const T = global.window.__SS;
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
function frames(n) {
  for (let i = 0; i < n; i++) {
    frameTs += 16.7;
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error("no rAF callback");
    cb(frameTs);
  }
}

function boardValid(g) {
  for (let i = 0; i < T.OFFSETS.length; i++) {
    const [ox, oy] = T.OFFSETS[i];
    for (let r = 0; r < 9; r++) {
      const row = new Set();
      for (let c = 0; c < 9; c++) row.add(g[oy + r][ox + c]);
      if (row.size !== 9 || [...row].some((v) => v < 1 || v > 9)) return false;
    }
    for (let c = 0; c < 9; c++) {
      const col = new Set();
      for (let r = 0; r < 9; r++) col.add(g[oy + r][ox + c]);
      if (col.size !== 9) return false;
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const box = new Set();
        for (let i2 = 0; i2 < 3; i2++) for (let j = 0; j < 3; j++) box.add(g[oy + br * 3 + i2][ox + bc * 3 + j]);
        if (box.size !== 9) return false;
      }
    }
  }
  return true;
}

// ---------- A. Geometry ----------
{
  eq(T.N, 21, "lattice is 21x21");
  eq(T.OFFSETS.length, 5, "five cards");
  eq(T.ALL_CELLS.length, 369, "369 playable cells");
  // 5*81 - 4*9 = 369
  let overlap = 0;
  for (const [r, c] of T.ALL_CELLS) if (T.cardsAt(r, c).length > 1) overlap++;
  eq(overlap, 36, "36 shared cells");
  // the four corner cards share one 3x3 box each with the centre card
  eq(T.cardsAt(6, 6).length, 2, "top-left overlap cell belongs to two cards");
  eq(T.cardsAt(6, 6).join(","), "0,2", "top-left overlap is cards 0 and 2");
  eq(T.cardsAt(8, 8).length, 2, "centre box cell belongs to cards 0 and 2");
  eq(T.cardsAt(10, 10).length, 1, "true centre cell belongs to one card");
}

// ---------- B. Generation ----------
for (const d of ["easy", "medium", "hard", "expert"]) {
  const { solution, puzzle } = T.generatePuzzle(d, "ss-seed-" + d);
  ok(boardValid(solution), `${d}: solution is valid on all five cards`);
  eq(T.countSolutions(puzzle, 2), 1, `${d}: puzzle has a unique solution`);
  let given = 0;
  for (const [r, c] of T.ALL_CELLS) {
    if (puzzle[r][c] !== 0) {
      given++;
      eq(puzzle[r][c], solution[r][c], `${d}: given matches solution`);
    }
  }
  ok(given >= 369 - T.DIFFS[d].removes - 5, `${d}: removals close to target`, { given, target: 369 - T.DIFFS[d].removes });
}

// determinism
const g1 = T.generatePuzzle("medium", "daily-2026-01-01");
const g2 = T.generatePuzzle("medium", "daily-2026-01-01");
deepEq(g1.puzzle, g2.puzzle, "seeded generation is deterministic");
const g3 = T.generatePuzzle("medium", "daily-2026-01-02");
ok(JSON.stringify(g1.puzzle) !== JSON.stringify(g3.puzzle), "different seeds give different puzzles");

// ---------- C. Initial state ----------
let s = T.snap();
eq(s.mode, "classic", "starts in classic");
eq(s.diff, "medium", "starts at medium");
eq(s.started, false, "starts in countdown");
ok(s.countdown > 0, "countdown is running");
eq(s.over, false, "not over");
eq(s.diffHidden, false, "difficulty bar visible");
eq(s.newGameDisabled, false, "new puzzle enabled");
eq(s.completed.length, 0, "no cards complete at start");
eq(s.cardsEl, "0/5", "HUD shows 0/5 cards");
ok(s.total > 100, "many empty cells to solve", s.total);

frames(60);
eq(T.snap().started, false, "still counting after ~1s");
frames(120);
eq(T.snap().started, true, "countdown finishes after ~3s");

// ---------- D. Placement + completion ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "place-seed");
  const puz = puzzle.map((r) => r.slice());
  // clear the top-left card completely
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) puz[r][c] = 0;
  T.setMode("classic", true);
  T.setGridState(solution, puz);
  const totalEmpty = T.snap().total;
  ok(totalEmpty >= 81, "at least a full card to solve", totalEmpty);

  // fill the top-left card correctly
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      T.selectCell(r, c);
      T.placeNumber(solution[r][c]);
    }
  }
  s = T.snap();
  ok(s.completed.includes(0), "top-left card completes", s.completed);
  eq(s.cardsEl, "1/5", "HUD shows 1/5 cards");
  ok(s.stats.cardsCompleted >= 1, "card completion counted");
  ok(s.unlocked.includes("first"), "First Card unlocks");
  eq(s.over, false, "one card is not a win");

  // wrong entry
  let wrongCell = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puz[r][c] === 0) { wrongCell = { r, c }; break; }
  T.selectCell(wrongCell.r, wrongCell.c);
  T.placeNumber(solution[wrongCell.r][wrongCell.c] % 9 + 1);
  s = T.snap();
  eq(s.mistakes, 1, "wrong entry counts a mistake");
}

// ---------- E. Win all five ----------
{
  const { solution } = T.generatePuzzle("easy", "win-seed");
  const puz = solution.map((r) => r.slice());
  // keep every cell filled except one
  puz[8][8] = 0;
  T.setMode("classic", true);
  T.setGridState(solution, puz);
  T.selectCell(8, 8);
  T.placeNumber(solution[8][8]);
  s = T.snap();
  eq(s.over, true, "solving every cell wins");
  eq(s.won, true, "win flag set");
  eq(s.overlayTitle, "All Five Cards Solved! 🏆", "win overlay title", s.overlayTitle);
  eq(s.completed.length, 5, "all five cards complete");
  ok(s.score > 0, "win awards points", s.score);
  ok(s.stats.solves >= 1, "solve counted");
}

// ---------- F. Notes / undo / redo ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "undo-seed");
  const puz = puzzle.map((r) => r.slice());
  let cell = null;
  for (const [r, c] of T.ALL_CELLS) if (!puz[r][c]) { cell = { r, c }; break; }
  puz[cell.r][cell.c] = 0;
  T.setMode("classic", true);
  T.setGridState(solution, puz);
  T.selectCell(cell.r, cell.c);
  T.toggleNotes();
  eq(T.snap().notesMode, true, "notes mode on");
  T.placeNumber(5);
  s = T.snap();
  ok(s.notes[cell.r][cell.c].includes(5), "note added");
  T.toggleNotes();
  eq(T.snap().notesMode, false, "notes mode off");
  T.placeNumber(solution[cell.r][cell.c]);
  s = T.snap();
  eq(s.values[cell.r][cell.c], solution[cell.r][cell.c], "correct value placed");
  const after = s.score;
  T.undo();
  s = T.snap();
  eq(s.values[cell.r][cell.c], 0, "undo clears the cell");
  eq(s.score, 0, "undo restores score");
  T.redo();
  s = T.snap();
  eq(s.values[cell.r][cell.c], solution[cell.r][cell.c], "redo reapplies");
  eq(s.score, after, "redo restores score");
}

// ---------- G. Hint ----------
{
  const { solution, puzzle } = T.generatePuzzle("easy", "hint-seed");
  const puz = puzzle.map((r) => r.slice());
  let cell = null;
  for (const [r, c] of T.ALL_CELLS) if (!puz[r][c]) { cell = { r, c }; break; }
  T.setMode("classic", true);
  T.setGridState(solution, puz);
  T.selectCell(cell.r, cell.c);
  T.useHint();
  s = T.snap();
  eq(s.values[cell.r][cell.c], solution[cell.r][cell.c], "hint fills correctly");
  eq(s.hintsLeft, 2, "hint consumed");
  eq(s.hintsUsed, 1, "hint usage counted");
  ok(s.unlocked.includes("hint"), "Hint Master unlocks");
}

// ---------- H. Mistake limit ----------
{
  T.setMode("attack", true);
  const { solution, puzzle } = T.generatePuzzle("easy", "attack-seed");
  const puz = puzzle.map((r) => r.slice());
  const empties = [];
  for (const [r, c] of T.ALL_CELLS) if (!puz[r][c]) empties.push({ r, c });
  for (let i = 0; i < 3; i++) puz[empties[i].r][empties[i].c] = 0;
  T.setGridState(solution, puz);
  for (let i = 0; i < 3; i++) {
    T.selectCell(empties[i].r, empties[i].c);
    T.placeNumber(solution[empties[i].r][empties[i].c] % 9 + 1);
  }
  s = T.snap();
  eq(s.mistakes, 3, "three mistakes counted");
  eq(s.over, true, "third mistake ends the game");
  eq(s.overlayTitle, "Out of Mistakes", "mistake-limit overlay", s.overlayTitle);
}

// ---------- I. Mode UI ----------
T.setMode("daily", true);
s = T.snap();
eq(s.mode, "daily", "daily active");
eq(s.diffHidden, true, "difficulty hidden in daily");
eq(s.newGameDisabled, true, "new puzzle disabled in daily");
deepEq(s.modePressed, ["false", "false", "true"], "daily chip pressed");
T.setMode("attack", true);
s = T.snap();
eq(s.diffHidden, false, "difficulty visible in attack");
T.setMode("classic", true);
s = T.snap();
deepEq(s.modePressed, ["true", "false", "false"], "classic chip pressed");
eq(s.hintsLeft, 3, "hints restored in classic");

// ---------- J. Best persistence ----------
{
  T.setMode("classic", true);
  T.setDiff("hard");
  const { solution } = T.generatePuzzle("easy", "best-seed");
  const puz = solution.map((r) => r.slice());
  puz[8][8] = 0;
  T.setGridState(solution, puz);
  T.setState({ elapsed: 300000 });
  T.selectCell(8, 8);
  T.placeNumber(solution[8][8]);
  s = T.snap();
  ok(storage.has("super-sudoku-best-v1-classic-hard"), "best persisted per mode/diff", storage.get("super-sudoku-best-v1-classic-hard"));
  ok(JSON.parse(storage.get("super-sudoku-best-v1-classic-hard")).t > 0, "best time recorded");
}

// ---------- K. Daily streak ----------
{
  T.setMode("daily", true);
  const { solution } = T.generatePuzzle("medium", T.dateStr());
  const puz = solution.map((r) => r.slice());
  puz[8][8] = 0;
  T.setGridState(solution, puz);
  T.setState({ elapsed: 42000 });
  T.selectCell(8, 8);
  T.placeNumber(solution[8][8]);
  s = T.snap();
  eq(s.over, true, "daily solve completes");
  eq(s.daily.streak, 1, "streak starts at 1");
  eq(s.daily.lastDate, T.dateStr(), "last date is today");
  ok(s.stats.dailySolves >= 1, "daily solve counted");
  ok(s.unlocked.includes("daily"), "Daily Habit unlocks");
}

// ---------- L. Achievements ----------
{
  T.setMode("classic", true);
  T.stats.cardsCompleted = 0;
  T.stats.maxCardsInRun = 3;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("half"), "Halfway There unlocks");
  T.stats.maxCardsInRun = 4;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("four"), "Almost There unlocks");
  T.stats.bestTime = 330000;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("speed6"), "Lightning unlocks under 6:00");
  T.stats.solvesEasy = 1;
  T.stats.solvesMedium = 1;
  T.stats.solvesHard = 1;
  T.stats.solvesExpert = 1;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("allDiffs"), "Full Spectrum unlocks");
}

// ---------- M. Persistence + long run ----------
ok(!!storage.get("super-sudoku-stats-v1"), "stats persisted");
ok(!!storage.get("super-sudoku-achv-v1"), "achievements persisted");
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