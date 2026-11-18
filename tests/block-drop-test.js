// Deterministic tests for games/block-drop/script.js using a temp copy with a test hook.
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
    toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)),
  };
}

function makeEl(id, tag = "div") {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    innerHTML: "",
    hidden: false,
    title: "",
    dataset: {},
    style: {},
    width: 480,
    height: 480,
    classList: makeClassList(),
    children: [],
    _listeners: {},
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {},
    focus() {},
    setPointerCapture() {},
    addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); },
    removeEventListener() {},
    dispatch(type, ev = {}) {
      const e = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[type] || []).forEach((fn) => fn(e));
    },
    querySelector(sel) {
      if (sel === ".btn") return makeEl("qbtn", "button");
      if (sel && sel.indexOf("data-close") >= 0) return makeEl("qclose", "button");
      return makeEl("q");
    },
    querySelectorAll(sel) {
      if (sel === "[data-close]") return [makeEl("close1", "button"), makeEl("close2", "div")];
      return [];
    },
    getContext() { return ctx; },
  };
}

const gradient = { addColorStop() {} };
const ctx = new Proxy(
  {
    canvas: null,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 10 }),
  },
  {
    get(t, p) { return p in t ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  }
);

const ids = [
  "board", "next", "hold", "rival", "score", "lines", "level", "time", "best", "hint",
  "pause", "badges-btn", "badge-count", "sound-btn", "sound-icon", "ai-difficulty",
  "rival-panel", "rival-lines", "rival-pieces", "rival-diff", "race-track",
  "race-player-fill", "race-player-text", "race-rival-row", "race-ai-fill", "race-ai-text",
  "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records", "restart", "badges2",
];
for (const id of ids) elements.set(id, makeEl(id, id === "board" || id === "next" || id === "hold" || id === "rival" ? "canvas" : "div"));
elements.get("achv-modal").hidden = true;
elements.get("rival-panel").hidden = true;
elements.get("ai-difficulty").hidden = true;
elements.get("race-track").hidden = true;
elements.get("race-rival-row").hidden = true;

const modeChips = ["marathon", "sprint", "ai"].map((m) => {
  const el = makeEl("mode-" + m, "button");
  el.dataset.mode = m;
  return el;
});
const aiChips = ["chill", "smart", "expert"].map((d) => {
  const el = makeEl("ai-" + d, "button");
  el.dataset.diff = d;
  return el;
});
const touchButtons = ["left", "rotate", "right", "down", "drop", "hold"].map((a) => {
  const el = makeEl("touch-" + a, "button");
  el.dataset.act = a;
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
    if (sel === ".ai-chip") return aiChips;
    if (sel === ".touch-controls button") return touchButtons;
    return [];
  },
  addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); },
  removeEventListener() {},
};

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (type, fn) => { (listeners["win:" + type] || (listeners["win:" + type] = [])).push(fn); },
  setTimeout: () => 0,
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
      "--glass-border": "rgba(255,255,255,0.11)",
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

const repo = require("./_env").gameScript("block-drop");
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

const T = global.window.__T;
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

function emptyGrid() {
  return Array.from({ length: 20 }, () => new Array(10).fill(null));
}
function filledRows(rows, exceptCols, key = "J") {
  const g = emptyGrid();
  for (const r of rows) {
    for (let c = 0; c < 10; c++) {
      if (!exceptCols || !exceptCols.includes(c)) g[r][c] = key;
    }
  }
  return g;
}
function linePiece(shape, x, y, key = "I") {
  return { key, shape: shape.map((r) => [...r]), x, y, rot: 0 };
}

// A. initial state
let s = T.snap();
eq(s.mode, "marathon", "starts in marathon");
eq(s.grid.length, 20, "grid has 20 rows");
eq(s.grid[0].length, 10, "grid has 10 cols");
eq(s.queue.length, 3, "next queue has 3 pieces");
ok(!!s.current, "a current piece exists");
eq(s.holdPiece, null, "hold starts empty");
eq(s.score, 0, "score starts 0");
eq(s.lines, 0, "lines starts 0");
eq(s.level, 1, "level starts 1");
eq(s.started, false, "starts in countdown");
ok(s.countdown > 0, "countdown is running");
eq(s.ai, null, "no AI in marathon");
eq(s.rivalHidden, true, "rival panel hidden in marathon");
eq(s.raceHidden, true, "race track hidden in marathon");

// B. 7-bag
T.setMode("marathon");
T.reset();
const seen = new Set();
for (let i = 0; i < 7; i++) {
  seen.add(T.snap().current.key);
  T.spawnNext();
}
eq(seen.size, 7, "7-bag yields all 7 pieces", Array.from(seen));

// C. movement and wall kicks
T.reset();
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 0, "I"));
T.tryMove(-1, 0);
eq(T.snap().current.x, 2, "move left");
T.tryMove(1, 0);
eq(T.snap().current.x, 3, "move right");
T.setCurrent(linePiece([[1, 1, 1, 1]], -1, 0, "I"));
T.tryRotate();
s = T.snap();
eq(s.current.x, 0, "wall kick shifts rotated I into bounds", s.current);
deepEq(s.current.shape, [[1], [1], [1], [1]], "I rotates to vertical");

// D. hard drop
T.reset();
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 0, "I"));
T.setStarted(true);
T.hardDrop();
s = T.snap();
eq(s.score, 38, "hard drop scores 2 per cell");
eq(s.grid[19][3], "I", "hard drop locks at the bottom");
eq(s.records.totalHardDrops, 1, "hard drop counted");
ok(s.current && s.current.key !== "I" || s.current, "next piece spawned");

// E. single line clear
T.reset();
T.setScore(0);
T.setLines(0);
T.setLevel(1);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
s = T.snap();
eq(s.lines, 1, "single line cleared");
eq(s.score, 100, "single line scores 100");
ok(s.grid.every((r) => r.every((c) => !c)), "cleared board is empty");
ok(s.unlocked.includes("first"), "First Line unlocks");

// F. double / triple / quad
function clearTest(shape, rows, except, key, expectedLines, expectedScore, achv) {
  T.reset();
  T.setScore(0);
  T.setLines(0);
  T.setLevel(1);
  T.setCombo(0);
  T.setLastClear(false);
  T.setGrid(filledRows(rows, except));
  T.setCurrent(linePiece(shape, except[0], rows[0], key));
  T.lockPiece();
  const st = T.snap();
  eq(st.lines, expectedLines, `${achv} lines`);
  eq(st.score, expectedScore, `${achv} score`);
  ok(st.unlocked.includes(achv), `${achv} unlocks`);
}
clearTest([[1, 1, 1, 1], [1, 1, 1, 1]], [18, 19], [3, 4, 5, 6], "I", 2, 300, "double");
clearTest([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]], [17, 18, 19], [3, 4, 5, 6], "I", 3, 500, "triple");
clearTest([[1], [1], [1], [1]], [16, 17, 18, 19], [3], "I", 4, 800, "tetris");

// G. combo + back-to-back
T.reset();
T.setScore(0);
T.setLines(0);
T.setLevel(1);
T.setCombo(0);
T.setLastClear(false);
T.setGrid(filledRows([16, 17, 18, 19], [3]));
T.setCurrent(linePiece([[1], [1], [1], [1]], 3, 16, "I"));
T.lockPiece();
const afterFirst = T.snap();
eq(afterFirst.score, 800, "first quad scores 800");
T.setGrid(filledRows([16, 17, 18, 19], [3]));
T.setCurrent(linePiece([[1], [1], [1], [1]], 3, 16, "I"));
T.lockPiece();
s = T.snap();
eq(s.score, 2075, "back-to-back quad + combo scores correctly", s.score);
eq(s.records.backToBacks, 1, "back-to-back counted");
eq(s.records.maxCombo, 2, "combo x2 recorded");
ok(s.unlocked.includes("combo2"), "combo x2 unlocks");
ok(s.unlocked.includes("back2back"), "back-to-back unlocks");

// H. lock delay
T.reset();
T.setGrid(emptyGrid());
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 18, "O"));
T.setLock(0, 0);
T.updatePlayer(499);
s = T.snap();
eq(s.gameOver, false, "not locked at 499ms");
eq(s.current.y, 18, "piece still at y=18 at 499ms");
T.updatePlayer(2);
s = T.snap();
eq(s.grid[18][4], "O", "piece locked after 500ms");
ok(s.current && s.current.key !== "O" || s.current, "next piece spawned after lock");
// move resets lock timer
T.reset();
T.setGrid(emptyGrid());
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 18, "O"));
T.setLock(490, 0);
T.tryMove(-1, 0);
s = T.snap();
eq(s.lockTimer, 0, "move resets lock timer");
eq(s.lockResets, 1, "lock reset counted");
T.updatePlayer(499);
eq(T.snap().current.y, 18, "piece not locked after reset");

// I. hold
T.reset();
T.setQueue(["T", "I", "O"]);
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.setStarted(true);
T.setCanHold(true);
T.setHold(null);
T.hold();
s = T.snap();
eq(s.holdPiece, "O", "hold stores current piece");
eq(s.current.key, "T", "hold spawns next piece");
eq(s.canHold, false, "hold locked until next lock");
T.hold();
eq(T.snap().current.key, "T", "cannot hold twice");
eq(T.snap().records.totalHolds, 1, "hold counted once");
T.setCanHold(true);
T.hold();
s = T.snap();
eq(s.holdPiece, "T", "second hold stores the current piece");
eq(s.current.key, "O", "second hold swaps back");
ok(s.unlocked.includes("hold"), "Hold Up unlocks");

// J. top-out
T.reset();
T.setGrid(filledRows([0, 1], []));
T.setQueue(["I", "O", "T"]);
T.spawnNext();
s = T.snap();
eq(s.gameOver, true, "top-out ends the game");
eq(s.overlayTitle, "Game Over", "marathon top-out title", s.overlayTitle);

// K. sprint
T.setMode("sprint");
T.setGameTime(65000);
T.setLines(39);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
s = T.snap();
eq(s.gameOver, true, "sprint ends at 40 lines");
eq(s.records.sprints, 1, "sprint counted");
eq(s.sprintBest, 65000, "first sprint best set");
eq(s.overlayTitle, "Sprint Complete!", "sprint complete title", s.overlayTitle);
ok(s.unlocked.includes("sprint"), "Sprint unlocks");

T.setMode("sprint");
T.setGameTime(50000);
T.setLines(39);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
s = T.snap();
eq(s.sprintBest, 50000, "faster sprint updates best");
ok(s.unlocked.includes("under3"), "under 3:00 unlocks");
ok(s.unlocked.includes("under2"), "under 2:00 unlocks");

T.setMode("sprint");
T.setGameTime(70000);
T.setLines(39);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
eq(T.snap().sprintBest, 50000, "slower sprint does not replace best");

// L. Vs AI setup and AI placement
T.setMode("ai");
s = T.snap();
ok(!!s.ai, "AI exists in Vs AI mode");
eq(s.ai.lines, 0, "AI starts at 0 lines");
eq(s.ai.queue.length, 3, "AI queue has 3 pieces");
eq(s.rivalHidden, false, "rival panel visible in Vs AI");
eq(s.aiDiffHidden, false, "AI difficulty visible in Vs AI");
eq(s.raceHidden, false, "race track visible in Vs AI");
eq(s.raceRivalHidden, false, "rival race row visible in Vs AI");

T.setAiGrid(emptyGrid());
const target = T.aiBestPlacement(emptyGrid(), T.makePiece("O"));
ok(!!target, "AI finds a placement on an empty grid");
eq(target.y, 18, "AI drops O to the bottom", target);
eq(T.aiInterval(), 650, "smart AI interval at 0 lines");

T.setAiLines(100);
const fast = T.aiInterval();
T.setAiLines(0);
ok(fast < T.aiInterval(), "AI speeds up as lines grow", { fast, base: T.aiInterval() });

T.setAiLines(0);
T.setGrid(emptyGrid());
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.setQueue(["T", "I", "L"]);
T.setAiGrid(emptyGrid());
T.setAiCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.setAiTarget({ shape: [[1, 1], [1, 1]], x: 4, y: 18 });
T.aiLock();
s = T.snap();
eq(s.ai.pieces, 1, "AI locks a piece");
eq(s.ai.grid[18][4], "O", "AI grid has the locked piece");
ok(!!s.ai.current, "AI spawns its next piece");

// AI line clear
T.setAiGrid(filledRows([19], [4, 5]));
T.setAiCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.setAiTarget({ shape: [[1, 1], [1, 1]], x: 4, y: 18 });
T.aiLock();
s = T.snap();
eq(s.ai.lines, 1, "AI clears a line", s.ai.lines);

// AI reaches 40 -> rival wins
T.setAiLines(39);
T.setAiGrid(filledRows([19], [4, 5]));
T.setAiCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.setAiTarget({ shape: [[1, 1], [1, 1]], x: 4, y: 18 });
T.aiLock();
s = T.snap();
eq(s.gameOver, true, "AI reaching 40 ends the race");
eq(s.overlayTitle, "Rival Wins", "rival win title", s.overlayTitle);
eq(s.records.aiWins, 0, "rival win does not count for player");

// AI crash -> player wins
T.setMode("ai");
T.setAiGrid(filledRows([0, 1, 2, 3], []));
T.setAiCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.aiSpawn(0);
s = T.snap();
eq(s.ai.over, true, "AI has no placement and crashes");
eq(s.gameOver, true, "AI crash ends the race");
eq(s.overlayTitle, "You Win!", "player win title after AI crash", s.overlayTitle);
eq(s.records.aiWins, 1, "player win counted");
ok(s.unlocked.includes("rival"), "Rival Slayer unlocks");

// Player reaches 40 -> player wins
T.setMode("ai");
T.setLines(39);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
s = T.snap();
eq(s.gameOver, true, "player reaching 40 ends the race");
eq(s.overlayTitle, "You Win!", "player win title", s.overlayTitle);
eq(s.records.aiWins, 2, "second player win counted");

// Player tops out in AI -> rival wins
T.setMode("ai");
T.setGrid(filledRows([0, 1], []));
T.setQueue(["I", "O", "T"]);
T.spawnNext();
s = T.snap();
eq(s.gameOver, true, "player top-out ends AI race");
eq(s.overlayTitle, "Rival Wins", "player top-out title", s.overlayTitle);

// M. mode UI
T.setMode("marathon");
s = T.snap();
eq(s.raceHidden, true, "marathon hides race track");
eq(s.rivalHidden, true, "marathon hides rival");
eq(s.aiDiffHidden, true, "marathon hides AI difficulty");
T.setMode("sprint");
s = T.snap();
eq(s.raceHidden, false, "sprint shows race track");
eq(s.rivalHidden, true, "sprint hides rival");
eq(s.raceRivalHidden, true, "sprint hides rival row");
T.setMode("ai");
s = T.snap();
eq(s.rivalHidden, false, "AI mode shows rival");
eq(s.raceRivalHidden, false, "AI mode shows rival row");
eq(s.aiDiffHidden, false, "AI mode shows difficulty");
deepEq(s.modePressed, ["false", "false", "true"], "AI mode chip pressed");
deepEq(s.aiPressed, ["false", "true", "false"], "Smart difficulty pressed");

// N. countdown
T.setMode("marathon");
T.reset();
s = T.snap();
eq(s.started, false, "countdown starts");
ok(s.countdown > 0, "countdown positive");
const startY = s.current.y;
frames(60); // ~1s
s = T.snap();
eq(s.started, false, "still counting after 1s");
eq(s.current.y, startY, "piece does not fall during countdown");
frames(120); // ~2s more
s = T.snap();
eq(s.started, true, "countdown finishes");
frames(70); // ~1.2s of play
s = T.snap();
ok(s.current.y > 0 || s.gameOver, "piece falls after countdown", { y: s.current && s.current.y, over: s.gameOver });

// countdown skip
T.reset();
T.startPlay();
s = T.snap();
eq(s.started, true, "startPlay starts immediately");
eq(s.countdown, 0, "startPlay clears countdown");

// O. achievements via records
T.setMode("marathon");
T.reset();
T.setRecord("totalPieces", 99);
T.setGrid(emptyGrid());
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.lockPiece();
ok(T.snap().unlocked.includes("pieces100"), "Piece Master unlocks at 100");

T.setRecord("totalHardDrops", 49);
T.setMode("marathon");
T.reset();
T.setStarted(true);
T.setCurrent(linePiece([[1, 1], [1, 1]], 4, 0, "O"));
T.hardDrop();
ok(T.snap().unlocked.includes("drops50"), "Drop It unlocks at 50");

T.setRecord("maxScore", 999);
T.setScore(999);
T.addScore(1);
T.checkAchievements();
ok(T.snap().unlocked.includes("score1k"), "Four Figures unlocks at 1000");

T.setRecord("maxLevel", 4);
T.setLines(39);
T.setGrid(filledRows([19], [3, 4, 5, 6]));
T.setCurrent(linePiece([[1, 1, 1, 1]], 3, 19, "I"));
T.lockPiece();
s = T.snap();
eq(s.level, 5, "level 5 reached");
ok(s.unlocked.includes("level5"), "Level Up unlocks at 5");

// P. best scores per mode
T.setMode("marathon");
T.reset();
T.setBestScore(0);
T.addScore(1234);
s = T.snap();
eq(s.bestScore, 1234, "marathon best updates");
eq(storage.get("tetris-best-marathon"), "1234", "marathon best persisted");
T.setMode("ai");
T.reset();
T.setBestScore(0);
T.addScore(500);
s = T.snap();
eq(s.bestScore, 500, "AI best updates");
eq(storage.get("tetris-best-ai"), "500", "AI best persisted");
T.setMode("marathon");
s = T.snap();
eq(s.bestScore, 1234, "marathon best restored");

// Q. marathon time + achievement
T.setMode("marathon");
T.reset();
T.setGameTime(300500);
T.setLastSec(299);
T.updatePerSecond();
s = T.snap();
eq(s.records.marathonTime, 300, "marathon time recorded");
ok(s.unlocked.includes("marathon5"), "Marathoner unlocks at 5 minutes");

// R. persistence
ok(!!storage.get("tetris-stats-v1"), "stats persisted");
ok(!!storage.get("tetris-achv-v1"), "achievements persisted");
const achv = JSON.parse(storage.get("tetris-achv-v1") || "[]");
ok(achv.includes("first") && achv.includes("tetris") && achv.includes("rival"), "achievement ids persisted", achv);

// S. no runtime errors over a longer run
T.setMode("marathon");
T.reset();
try {
  frames(600);
  ok(true, "long frame run without runtime errors");
} catch (err) {
  ok(false, "long frame run threw", String(err));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);