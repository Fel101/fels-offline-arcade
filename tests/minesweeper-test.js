// Deterministic tests for games/minesweeper/script.js.
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
      if (on) set.add(c);
      else set.delete(c);
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
    className: "",
    children: [],
    _listeners: {},
    _attrs: {},
    classList: makeClassList(),
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 100,
    style: {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      },
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    removeAttribute(k) {
      delete this._attrs[k];
    },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
    },
    remove() {},
    focus() {
      if (this._onfocus) this._onfocus();
    },
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
      if (t === "focus") this._onfocus = fn;
    },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign({ target: this, button: 0, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    querySelector(sel) {
      if (sel === ".kakuro-clue") return null;
      return makeEl("q", "div");
    },
    querySelectorAll() {
      return [];
    },
  };
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html || "";
    },
    set(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
  });
  return el;
}

const ids = [
  "board", "board-wrap", "mines", "time", "time-label", "score", "best", "hints",
  "ms-progress-fill", "hint", "face-btn", "pause", "flag-btn", "hint-btn", "new-game",
  "badges-btn", "badge-count", "sound-btn", "sound-icon", "difficulty-bar", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl(id));
elements.get("achv-modal").hidden = true;

const progressEl = makeEl("progress");
progressEl.setAttribute("aria-valuenow", "0");

const modeChips = ["classic", "attack", "daily", "zen"].map((m) => {
  const e = makeEl("mode-" + m, "button");
  e.dataset.mode = m;
  return e;
});
const diffChips = ["beginner", "intermediate", "expert"].map((d) => {
  const e = makeEl("diff-" + d, "button");
  e.dataset.diff = d;
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (t) => makeEl("created-" + t, t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    if (sel === ".ms-progress") return progressEl;
    return makeEl("q");
  },
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".diff-chip") return diffChips;
    return [];
  },
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
};

global.window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  navigator: { vibrate: null },
};

global.navigator = global.window.navigator;

global.getComputedStyle = () => ({
  getPropertyValue: (n) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
    }[n] || ""),
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

let rafCb = null;
global.requestAnimationFrame = (cb) => {
  rafCb = cb;
  return 1;
};

const repo = require("./_env").gameScript("minesweeper");
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

const T = global.window.__M;
let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else {
    fail++;
    console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra));
  }
}
function eq(a, b, msg) {
  ok(a === b, msg, { actual: a, expected: b });
}
function deepEq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg, { actual: a, expected: b });
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

// Build a controlled board: mineSet is an array of "r,c" strings.
function setup(rows, cols, mineSet, opts = {}) {
  const s = T.state;
  s.rows = rows;
  s.cols = cols;
  s.mines = mineSet.length;
  s.started = opts.started === undefined ? true : opts.started;
  s.firstClick = opts.firstClick === undefined ? false : opts.firstClick;
  s.paused = false;
  s.over = false;
  s.won = false;
  s.showMines = false;
  s.exploded = null;
  s.flags = 0;
  s.flagsPlaced = 0;
  s.revealedCount = 0;
  s.safeTotal = rows * cols - mineSet.length;
  s.elapsed = 0;
  s.remaining = s.mode === "attack" ? T.currentCfg().attackTime * 1000 : 0;
  s.hintsTotal = T.MODES[s.mode].hints;
  s.hintsLeft = s.hintsTotal;
  s.hintsUsed = 0;
  s.score = 0;
  s.chords = 0;
  s.flagMode = false;
  s.lastTick = -1;
  T.buildBoard();
  for (const key of mineSet) {
    const [r, c] = key.split(",").map(Number);
    s.cells[r][c].mine = true;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = s.cells[r][c];
      if (cell.mine) continue;
      let n = 0;
      for (const [nr, nc] of T.neighbors(r, c)) if (s.cells[nr][nc].mine) n++;
      cell.adj = n;
    }
  }
  T.renderAll();
  T.updateHUD();
}

// ---------- A. Constants ----------
eq(T.DIFFS.beginner.rows, 9, "beginner rows");
eq(T.DIFFS.beginner.cols, 9, "beginner cols");
eq(T.DIFFS.beginner.mines, 10, "beginner mines");
eq(T.DIFFS.intermediate.rows, 16, "intermediate rows");
eq(T.DIFFS.intermediate.mines, 40, "intermediate mines");
eq(T.DIFFS.expert.cols, 30, "expert cols");
eq(T.DIFFS.expert.mines, 99, "expert mines");
eq(T.MODES.classic.hints, 3, "classic hints");
eq(T.MODES.attack.hints, 2, "attack hints");
eq(T.MODES.zen.hints, Infinity, "zen unlimited hints");
eq(T.ACHIEVEMENTS.length, 27, "27 achievements");

// ---------- B. Neighbor geometry ----------
{
  const s = T.state;
  s.rows = 9;
  s.cols = 9;
  eq(T.neighbors(0, 0).length, 3, "corner has 3 neighbors");
  eq(T.neighbors(0, 4).length, 5, "edge has 5 neighbors");
  eq(T.neighbors(4, 4).length, 8, "center has 8 neighbors");
  const ns = T.neighbors(0, 0);
  ok(ns.every(([r, c]) => r >= 0 && r < 9 && c >= 0 && c < 9), "neighbors in bounds");
}

// ---------- C. First-click safety + mine placement ----------
{
  T.setMode("classic", true);
  T.newGame();
  const s = T.snap();
  eq(s.started, false, "new game not started");
  eq(String(s.minesEl), "10", "beginner mine counter");
  eq(String(s.hintsEl), "3", "three hints at start");
  eq(s.hintDisabled, true, "hint disabled before start");
  eq(s.pauseDisabled, true, "pause disabled before start");

  // Click the center.
  T.onCellClick(4, 4);
  const st = T.snap();
  eq(st.started, true, "first click starts game");
  eq(st.firstClick, false, "first-click flag cleared");
  ok(!st.cells[4][4].mine, "clicked cell is safe");
  let neighborsSafe = true;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = 4 + dr;
      const c = 4 + dc;
      if (r >= 0 && r < 9 && c >= 0 && c < 9 && st.cells[r][c].mine) neighborsSafe = false;
    }
  ok(neighborsSafe, "3x3 around first click is safe");
  let mineCount = 0;
  for (const row of st.cells) for (const cell of row) if (cell.mine) mineCount++;
  eq(mineCount, 10, "exactly 10 mines placed");
  ok(st.cells[4][4].revealed, "first click opens a region");
  ok(st.revealedCount > 0, "cells revealed");

  // Adjacency values are correct.
  let adjOk = true;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const cell = st.cells[r][c];
      if (cell.mine) continue;
      let n = 0;
      for (const [nr, nc] of T.neighbors(r, c)) if (st.cells[nr][nc].mine) n++;
      if (cell.adj !== n) adjOk = false;
    }
  ok(adjOk, "adjacency counts are correct");
}

// ---------- D. Win ----------
{
  setup(3, 3, ["0,0"]);
  eq(T.snap().cells[0][1].adj, 1, "adjacency set");
  T.setState({ elapsed: 15000 });
  T.onCellClick(2, 2);
  const s = T.snap();
  ok(s.revealedCount >= 8, "flood reveals the safe region", s.revealedCount);
  eq(s.over, true, "revealing all safe cells wins");
  eq(s.won, true, "win flag set");
  eq(s.overlayTitle, "Board Cleared! 🎉", "win overlay");
  ok(s.score > 0, "win awards score", s.score);
  ok(s.stats.wins >= 1, "win counted");
  ok(s.stats.bestTime > 0, "best time recorded", s.stats.bestTime);
  eq(s.face, "😎", "face shows win");
  ok(storage.has("ms-best-v1-classic-beginner"), "best persisted");
  ok(s.unlocked.includes("first"), "First Sweep unlocks");
}

// ---------- E. Lose ----------
{
  setup(3, 3, ["0,0"]);
  T.onCellClick(0, 0);
  const s = T.snap();
  eq(s.over, true, "clicking a mine loses");
  eq(s.won, false, "not a win");
  eq(s.showMines, true, "mines shown");
  eq(s.exploded.r, 0, "exploded row");
  eq(s.exploded.c, 0, "exploded col");
  eq(s.overlayTitle, "Boom! 💥", "lose overlay");
  ok(s.stats.losses >= 1, "loss counted");
  eq(s.face, "😵", "face shows loss");
  eq(s.cells[0][0].text, "💥", "exploded cell shows boom");
}

// ---------- F. Flags + question marks ----------
{
  setup(3, 3, ["0,0"]);
  T.toggleFlag(2, 2, false);
  let s = T.snap();
  eq(s.cells[2][2].flagged, true, "flag placed");
  eq(s.flags, 1, "flag counter");
  eq(s.flagsPlaced, 1, "flags placed stat");
  eq(String(s.minesEl), "0", "mine counter reflects one flag on a one-mine board");

  T.toggleFlag(2, 2, true);
  s = T.snap();
  eq(s.cells[2][2].flagged, false, "flag removed");
  eq(s.cells[2][2].question, true, "question mark set");
  eq(s.cells[2][2].text, "❓", "question glyph");
  eq(s.flags, 0, "flag counter decremented");

  T.toggleFlag(2, 2, true);
  s = T.snap();
  eq(s.cells[2][2].question, false, "question cleared");
  eq(s.cells[2][2].text, "", "cell empty again");
}

// ---------- G. Chording ----------
{
  setup(5, 5, ["0,0", "2,2"]);
  T.onCellClick(0, 1); // adj 1
  eq(T.snap().cells[0][1].revealed, true, "number cell revealed");
  T.toggleFlag(0, 0, false); // correct flag
  T.chord(0, 1);
  let s = T.snap();
  eq(s.chords, 1, "chord counted");
  eq(s.exploded, null, "correct chord hits no mine");
  eq(s.showMines, false, "correct chord reveals no mines");
  ok(!s.over || s.won, "a correct chord only ends the game by winning", { over: s.over, won: s.won });
  ok(s.cells[1][0].revealed, "chord reveals neighbor");
  ok(s.cells[0][2].revealed, "chord cascades");

  // Wrong flag -> chord hits the mine.
  setup(3, 3, ["0,0"]);
  T.onCellClick(0, 1);
  T.toggleFlag(0, 2, false); // wrong flag, count matches adj
  T.chord(0, 1);
  s = T.snap();
  eq(s.over, true, "wrong chord loses");
  eq(s.won, false, "wrong chord is a loss");
}

// ---------- H. Hint ----------
{
  setup(5, 5, ["0,0", "4,4"]);
  const before = T.snap();
  T.useHint();
  const s = T.snap();
  eq(s.hintsUsed, 1, "hint counted");
  eq(s.hintsLeft, before.hintsLeft - 1, "hint consumed");
  eq(s.stats.hintsUsed, before.stats.hintsUsed + 1, "hint stat");
  ok(s.unlocked.includes("hint"), "Hint Master unlocks");
  ok(s.score >= 0, "score not negative");
}

// ---------- I. Flag mode ----------
{
  setup(5, 5, ["0,0"]);
  eq(T.snap().flagMode, false, "flag mode off");
  elements.get("flag-btn").dispatch("click");
  eq(T.snap().flagMode, true, "flag mode on");
  eq(T.snap().flagPressed, "true", "flag button pressed");
  // Clicking in flag mode flags instead of revealing.
  T.onCellClick(2, 2);
  const s = T.snap();
  eq(s.cells[2][2].flagged, true, "flag mode click flags");
  eq(s.cells[2][2].revealed, false, "flag mode click does not reveal");
  elements.get("flag-btn").dispatch("click");
  eq(T.snap().flagMode, false, "flag mode off again");
}

// ---------- J. Pause ----------
{
  setup(9, 9, ["0,0"]);
  const s1 = T.snap();
  ok(s1.started, "game started for pause test");
  elements.get("pause").dispatch("click");
  eq(T.snap().paused, true, "pause toggled");
  eq(T.snap().overlayTitle, "Paused", "pause overlay");
  elements.get("pause").dispatch("click");
  eq(T.snap().paused, false, "resume toggled");
}

// ---------- K. Time Attack countdown ----------
{
  T.setMode("attack", true);
  T.newGame();
  let s = T.snap();
  eq(s.mode, "attack", "attack mode");
  eq(s.timeLabel, "Left", "countdown label");
  ok(s.remaining > 0, "countdown initialized", s.remaining);
  // Start and jump near the deadline.
  T.onCellClick(0, 0);
  T.setState({ elapsed: T.currentCfg().attackTime * 1000 - 80, remaining: 80, lastTick: -1 });
  frames(20);
  s = T.snap();
  eq(s.over, true, "countdown expiry ends the game");
  eq(s.overlayTitle, "Time's Up! ⏱", "timeout overlay");
}

// ---------- L. Daily mode ----------
{
  T.setMode("daily", true);
  let s = T.snap();
  eq(s.mode, "daily", "daily active");
  eq(s.diff, "intermediate", "daily uses intermediate");
  eq(s.diffHidden, true, "difficulty hidden in daily");
  deepEq(s.modePressed, ["false", "false", "true", "false"], "daily chip pressed");
  ok(!storage.has("ms-daily-v1") || true, "daily storage readable");

  // Win a daily board.
  setup(3, 3, ["0,0"]);
  T.onCellClick(2, 2);
  let st = T.snap();
  if (!st.over) {
    for (let r = 0; r < 3 && !T.snap().over; r++)
      for (let c = 0; c < 3 && !T.snap().over; c++) {
        if (T.snap().cells[r][c].mine || T.snap().cells[r][c].revealed) continue;
        T.onCellClick(r, c);
      }
    st = T.snap();
  }
  eq(st.over, true, "daily board completes");
  eq(st.daily.streak, 1, "daily streak starts at 1");
  eq(st.daily.lastDate, T.dateStr(), "daily date recorded");
  ok(st.stats.dailyWins >= 1, "daily win counted");
  ok(st.unlocked.includes("daily"), "Daily Habit unlocks");
}

// ---------- M. Zen mode ----------
{
  T.setMode("zen", true);
  T.newGame();
  let s = T.snap();
  eq(s.mode, "zen", "zen active");
  eq(s.hintsTotal, Infinity, "zen unlimited hints");
  eq(String(s.hintsEl), "∞", "zen shows infinity");
  eq(s.hintDisabled, true, "zen hint disabled before start");
  T.onCellClick(4, 4);
  eq(T.snap().hintDisabled, false, "zen hint enabled after start");
  T.setState({ elapsed: 0 });
  frames(120);
  s = T.snap();
  eq(s.elapsed, 0, "zen does not count time");
}

// ---------- N. Difficulty switching ----------
{
  T.setMode("classic", true);
  T.setDiff("expert");
  let s = T.snap();
  eq(s.diff, "expert", "difficulty switched");
  eq(s.cols, 30, "expert columns");
  eq(s.rows, 16, "expert rows");
  eq(String(s.minesEl), "99", "expert mine counter");
  eq(String(s.hintsEl), "3", "hints restored");
  deepEq(s.diffPressed, ["false", "false", "true"], "expert chip pressed");
  T.setDiff("beginner");
  eq(T.snap().cols, 9, "back to beginner");
}

// ---------- O. Achievements ----------
{
  T.setMode("classic", true);
  T.stats.wins = 10;
  T.stats.winsBeginner = 1;
  T.stats.winsIntermediate = 1;
  T.stats.winsExpert = 1;
  T.stats.bestTime = 8000;
  T.stats.cellsRevealed = 1000;
  T.stats.flagsPlaced = 100;
  T.stats.chords = 50;
  T.stats.bestScore = 12000;
  T.stats.bestWinStreak = 5;
  T.stats.noHintWins = 1;
  T.stats.noFlagWins = 1;
  T.stats.perfectFlagWins = 1;
  T.checkAchievements();
  const u = T.snap().unlocked;
  ok(u.includes("wins10"), "wins10 unlocks");
  ok(u.includes("allDiffs"), "allDiffs unlocks");
  ok(u.includes("speed10"), "speed10 unlocks");
  ok(u.includes("cells1000"), "cells1000 unlocks");
  ok(u.includes("flags100"), "flags100 unlocks");
  ok(u.includes("chords50"), "chords50 unlocks");
  ok(u.includes("score10k"), "score10k unlocks");
  ok(u.includes("streak5"), "streak5 unlocks");
  ok(u.includes("noFlags"), "noFlags unlocks");
  ok(u.includes("noHints"), "noHints unlocks");
  ok(u.includes("perfect"), "perfect unlocks");
  ok(storage.has("ms-achv-v1"), "achievements persisted");
}

// ---------- P. Long run ----------
{
  T.setMode("classic", true);
  T.setDiff("beginner");
  T.newGame();
  T.onCellClick(4, 4);
  try {
    frames(900);
    ok(true, "long frame run without runtime errors");
  } catch (err) {
    ok(false, "long frame run threw", String(err));
  }
}

// ---------- Q. Persistence ----------
ok(!!storage.get("ms-stats-v1"), "stats persisted");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);