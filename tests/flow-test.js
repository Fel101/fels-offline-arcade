// Deterministic tests for games/flow-puzzle/script.js
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
    type: "",
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    _attrs: {},
    _listeners: {},
    classList: makeClassList(),
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      c.parentNode = null;
      return c;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
      if (k.indexOf("data-") === 0) {
        const key = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = String(v);
      }
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    removeAttribute(k) {
      delete this._attrs[k];
    },
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
    },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign(
        { target: this, button: 0, preventDefault() {}, stopPropagation() {} },
        ev
      );
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    focus() {},
    closest() {
      return null;
    },
    querySelector() {
      return makeEl("span");
    },
    querySelectorAll() {
      return [];
    },
  };
  let _className = "";
  Object.defineProperty(el, "className", {
    get() {
      return _className;
    },
    set(v) {
      _className = String(v);
      el.classList = makeClassList();
      _className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => el.classList.add(c));
    },
  });
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get() {
      return _html;
    },
    set(v) {
      _html = v;
      if (v === "") el.children = [];
    },
  });
  return el;
}

const ids = [
  "board", "level-num", "wins", "streak", "level-select", "reset-level", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("level-select").tagName = "SELECT";
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createDocumentFragment: () => makeEl("fragment"),
  querySelector: (sel) => {
    if (sel === ".overlay .btn") return makeEl("button");
    return makeEl("div");
  },
  querySelectorAll: () => [],
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
};

let timerSeq = 0;
global.window = {
  innerWidth: 800,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
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

// Legacy save from the pre-core build — must migrate.
storage.set("flow-wins", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/flow-puzzle/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__FLOW;
if (!T) {
  console.error("No test hook");
  process.exit(1);
}

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

function keydown(key, extra) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn(Object.assign({ key, target: { tagName: "BODY" }, preventDefault() {} }, extra || {}))
  );
}
function winEvent(t) {
  (listeners["win:" + t] || []).forEach((fn) => fn({}));
}

// Draw one colour's full-coverage path with real clicks.
function drawColor(li, col) {
  const path = T.pathFor(li, col);
  if (!path) throw new Error("no path for " + col + " on level " + li);
  for (const cell of path) T.handleCellClick(cell);
  return path;
}
function solveLevel(li) {
  for (const col of T.LEVEL_DATA[li].colors) drawColor(li, col);
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.SIZE, 5, "five by five board");
  eq(T.CELL_COUNT, 25, "twenty-five cells");
  eq(T.LEVELS.length, 8, "eight levels");
  eq(T.stats.wins, 2, "legacy wins migrated");
  eq(T.stats.streak, 0, "streak starts at 0");
  eq(T.stats.bestStreak, 0, "best streak starts at 0");
  eq(T.stats.cleanWins, 0, "no clean wins yet");
  eq(T.stats.cleanStreak, 0, "no clean streak yet");
  eq(T.stats.cells, 0, "no cells drawn yet");
  eq(T.stats.backtracks, 0, "no backtracks yet");
  eq(T.stats.resets, 0, "no resets yet");
  eq(T.stats.solved.length, 0, "no levels solved yet");
  eq(storage.has("flow-wins"), false, "legacy wins key removed");
  eq(storage.has("flow-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 2, "Wins HUD shows the migrated value");
  eq(elements.get("streak").textContent, 0, "Streak HUD starts at 0");
  eq(elements.get("level-num").textContent, 1, "Level HUD starts at 1");
  eq(T.levelIdx, 0, "first level loaded");
  eq(T.roundOver, false, "round is live");
  eq(T.paused, false, "not paused");
  eq(T.paintCount, 0, "board starts empty");
  eq(elements.get("board").children.length, 25, "25 cells rendered");
  eq(elements.get("level-select").children.length, 8, "eight level options");
  eq(elements.get("level-select").children[2].textContent, "Level 3 of 8", "options are labelled");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  ok(elements.get("hint").textContent.indexOf("P pauses") !== -1, "hint mentions P");
}

// ---------- B. Dots, painting rules and backtracks ----------
{
  T.loadLevel(0);
  const pathA = T.pathFor(0, "A");
  eq(pathA.length, 13, "level 1 colour A covers 13 cells");
  eq(pathA[0], T.idx(0, 0), "colour A starts at its first dot");
  eq(pathA[pathA.length - 1], T.idx(0, 2), "colour A ends at its second dot");
  eq(new Set(pathA).size, 13, "the path visits every cell once");
  for (let i = 1; i < pathA.length; i++) {
    eq(T.adjacent(pathA[i - 1], pathA[i]), true, "step " + i + " is orthogonal");
  }
  const pathB = T.pathFor(0, "B");
  const pathC = T.pathFor(0, "C");
  eq(pathA.length + pathB.length + pathC.length, 25, "the three paths cover the whole board");

  const direct = [T.idx(0, 0), T.idx(0, 1), T.idx(0, 2)];
  T.handleCellClick(direct[0]);
  eq(T.active, "A", "clicking a dot starts its pipe");
  eq(T.pipes.A.length, 1, "the pipe starts with the dot");
  eq(T.paint[direct[0]], "A", "the dot is painted");
  eq(T.stats.cells, 1, "the start cell counted");

  T.handleCellClick(direct[1]);
  eq(T.pipes.A.length, 2, "an adjacent cell extends the pipe");
  eq(T.stats.cells, 2, "the cell counted");
  eq(T.paint[direct[1]], "A", "the new cell is painted");

  T.handleCellClick(direct[2]);
  eq(T.completed.A, true, "reaching the far dot completes the pipe");
  eq(T.active, null, "complete pipes release the cursor");
  eq(T.stats.cells, 3, "the closing dot counted");
  eq(T.roundOver, false, "one pipe is not a win");

  T.handleCellClick(direct[2]);
  eq(T.completed.A, undefined, "clicking the endpoint again clears the pipe");
  eq(T.pipes.A, undefined, "the pipe is gone");
  eq(T.paintCount, 0, "the board is clean again");
  eq(T.stats.cells, 3, "clearing does not draw cells");

  T.handleCellClick(direct[0]);
  eq(T.active, "A", "a cleared colour can be restarted");
  eq(T.stats.cells, 4, "restarting the pipe counts the dot");
  T.handleCellClick(direct[1]);
  T.handleCellClick(direct[2]);
  eq(T.pipes.A.length, 3, "short pipe rebuilt");
  T.handleCellClick(direct[1]);
  eq(T.pipes.A.length, 3, "a completed pipe ignores plain-cell clicks");

  // Clicking a non-adjacent empty cell does nothing.
  T.handleCellClick(direct[2]);
  T.handleCellClick(direct[0]);
  const before = JSON.stringify(T.pipes);
  T.handleCellClick(24);
  eq(JSON.stringify(T.pipes), before, "a non-adjacent cell is ignored");
  eq(T.stats.cells, 7, "no cell drawn by the ignored click");

  // A second colour cannot draw through the first.
  T.handleCellClick(pathB[0]);
  eq(T.active, "B", "clicking another dot switches colour");
  const paintedCells = T.paintCount;
  T.handleCellClick(direct[1]);
  eq(T.paintCount, paintedCells, "a painted cell of another colour is not overwritten");
  eq(T.active, "B", "the second colour stays active");

  // Walking back along a pipe retracts it.
  T.loadLevel(0);
  const pathB2 = T.pathFor(0, "B");
  T.handleCellClick(pathB2[0]);
  T.handleCellClick(pathB2[1]);
  T.handleCellClick(pathB2[2]);
  eq(T.pipes.B.length, 3, "B has three cells");
  T.handleCellClick(pathB2[1]);
  eq(T.pipes.B.length, 2, "clicking back along the pipe retracts it");
  eq(T.stats.backtracks, 1, "the retracted cell counted as a backtrack");
  eq(T.roundBacktracks, 1, "the round tracked the backtrack");
  T.handleCellClick(pathB2[0]);
  eq(T.pipes.B, undefined, "clicking the start dot clears the pipe");
  eq(T.stats.cells, 11, "career cell count after the input tests");
}

// ---------- C. Clean win ----------
{
  T.loadLevel(0);
  const before = T.stats.cells;
  solveLevel(0);
  eq(T.roundOver, true, "covering the board wins");
  eq(T.paintCount, 25, "the whole board is painted");
  eq(T.overlayTitle(), "Level Complete! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Level 1 solved — every pipe connected.") !== -1, "win message", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("No backtracking!") !== -1, "clean bonus mentioned", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Streak 1.") !== -1, "streak line", T.overlayMsg());
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.cleanWins, 1, "clean win counted");
  eq(T.stats.cleanStreak, 1, "clean streak is 1");
  eq(T.stats.cells, before + 25, "twenty-five cells drawn");
  eq(T.stats.solved.join(","), "1", "level 1 recorded");
  eq(elements.get("wins").textContent, 3, "Wins HUD updated");
  eq(elements.get("streak").textContent, 1, "Streak HUD updated");
  T.handleCellClick(0);
  eq(T.stats.cells, before + 25, "clicks are ignored once won");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  ok(u.includes("clean"), "Direct Route badge unlocks");
  eq(u.length, 2, "two badges unlocked");
  T.overlay.hide();
}

// ---------- D. A backtracked win breaks the clean streak ----------
{
  T.loadLevel(1);
  eq(T.levelIdx, 1, "second level loaded");
  eq(elements.get("level-num").textContent, 2, "Level HUD updated");
  const path = T.pathFor(1, "A");
  const before = T.stats.cells;
  T.handleCellClick(path[0]);
  T.handleCellClick(path[1]);
  T.handleCellClick(path[2]);
  T.handleCellClick(path[1]);
  eq(T.roundBacktracks, 1, "round backtrack recorded");
  for (let i = 2; i < path.length; i++) T.handleCellClick(path[i]);
  eq(T.completed.A, true, "colour A completed after the detour");
  for (const col of T.LEVEL_DATA[1].colors) {
    if (col !== "A") drawColor(1, col);
  }
  eq(T.roundOver, true, "level 2 won");
  ok((T.overlayMsg() || "").indexOf("No backtracking") === -1, "not clean", T.overlayMsg());
  eq(T.stats.wins, 4, "fourth win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.cleanWins, 1, "clean wins unchanged");
  eq(T.stats.cleanStreak, 0, "clean streak reset by the backtrack");
  eq(T.stats.backtracks, 2, "two career backtracks");
  eq(T.stats.cells, before + 26, "one retracted cell was re-drawn");
  eq(T.stats.solved.join(","), "1,2", "level 2 recorded");
  T.overlay.hide();
}

// ---------- E. Reset breaks the streak and blocks a clean win ----------
{
  T.loadLevel(2);
  T.handleCellClick(T.pathFor(2, "A")[0]);
  T.resetLevel();
  eq(T.stats.resets, 1, "reset counted");
  eq(T.stats.streak, 0, "reset breaks the streak");
  eq(elements.get("streak").textContent, 0, "Streak HUD reset");
  eq(T.roundResets, 1, "the new round remembers the reset");
  eq(T.paintCount, 0, "the board is empty after a reset");
  eq(T.levelIdx, 2, "the same level is reloaded");
  eq(T.stats.cells, 63, "resetting even keeps the career cell count");

  solveLevel(2);
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.streak, 1, "streak restarts at 1");
  eq(T.stats.cleanWins, 1, "a reset round is not a clean win");
  eq(T.stats.cleanStreak, 0, "clean streak stays broken");
  eq(T.stats.cells, 88, "twenty-five cells for level 3");
  T.overlay.hide();
}

// ---------- F. Four more clean levels ----------
{
  for (const li of [3, 4, 5, 6]) {
    T.loadLevel(li);
    solveLevel(li);
    eq(T.stats.wins, 6 + (li - 3), "win on level " + (li + 1));
    T.overlay.hide();
  }
  eq(T.stats.wins, 9, "nine wins");
  eq(T.stats.streak, 5, "streak is 5");
  eq(T.stats.bestStreak, 5, "best streak is 5");
  eq(T.stats.cleanWins, 5, "five clean wins");
  eq(T.stats.cleanStreak, 4, "four in a row without a backtrack");
  eq(T.stats.cells, 188, "one hundred and eighty-eight cells");
  eq(T.stats.solved.length, 7, "seven levels solved");
  const u = T.unlocked();
  ["win5", "streak2", "streak3", "streak5", "clean5", "clean3", "cells100"].forEach((id) =>
    ok(u.includes(id), id + " badge unlocks")
  );
  eq(u.length, 9, "nine badges unlocked");
  ok(!u.includes("all8"), "Completionist still locked");
  ok(!u.includes("win10"), "Champion still locked");
}

// ---------- G. All eight levels ----------
{
  T.loadLevel(7);
  solveLevel(7);
  eq(T.stats.wins, 10, "tenth win");
  eq(T.stats.streak, 6, "streak is 6");
  eq(T.stats.bestStreak, 6, "best streak is 6");
  eq(T.stats.cleanWins, 6, "six clean wins");
  eq(T.stats.cleanStreak, 5, "five clean in a row");
  eq(T.stats.cells, 213, "two hundred and thirteen cells");
  eq(T.stats.solved.length, 8, "all eight levels solved");
  eq(T.stats.solved.slice().sort((a, b) => a - b).join(","), "1,2,3,4,5,6,7,8", "every level recorded");
  const u = T.unlocked();
  ok(u.includes("all8"), "Completionist badge unlocks");
  ok(u.includes("win10"), "Champion badge unlocks");
  eq(u.length, 11, "eleven badges unlocked");
  T.overlay.hide();
}

// ---------- H. Backtrack grind ----------
{
  T.loadLevel(0);
  const path = T.pathFor(0, "A");
  T.handleCellClick(path[0]);
  T.handleCellClick(path[1]);
  T.handleCellClick(path[2]);
  const before = T.stats.cells;
  for (let i = 0; i < 24; i++) {
    T.handleCellClick(path[1]);
    T.handleCellClick(path[2]);
  }
  eq(T.stats.backtracks, 26, "twenty-six career backtracks");
  eq(T.stats.cells, before + 24, "each retracted cell was re-drawn");
  ok(T.unlocked().includes("back25"), "Second Thoughts badge unlocks");
  eq(T.unlocked().length, 12, "twelve badges unlocked");
  T.loadLevel(0);
}

// ---------- I. Reset grind ----------
{
  for (let i = 0; i < 9; i++) T.resetLevel();
  eq(T.stats.resets, 10, "ten resets");
  eq(T.stats.streak, 0, "resets keep the streak at 0");
  ok(T.unlocked().includes("reset10"), "Fresh Start badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
  eq(T.stats.cells, 240, "career cell count survives the resets");
}

// ---------- J. Cell grind unlocks the last badge ----------
{
  T.loadLevel(0);
  const path = T.pathFor(0, "A");
  for (let i = 0; i < 91; i++) {
    T.handleCellClick(path[0]);
    T.handleCellClick(path[1]);
    T.handleCellClick(path[2]);
    T.handleCellClick(path[0]); // clears the completed pipe without counting
  }
  eq(T.stats.cells, 513, "three cells per cycle: 240 + 273");
  eq(T.stats.backtracks, 26, "clearing a completed pipe is not a backtrack");
  ok(T.unlocked().includes("cells500"), "Plumber badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count updated");
  eq(T.roundOver, false, "grinding never completed a level");
  T.loadLevel(0);
}

// ---------- K. Pause ----------
{
  const path = T.pathFor(0, "A");
  T.handleCellClick(path[0]);
  const cells = T.stats.cells;
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.handleCellClick(path[1]);
  eq(T.stats.cells, cells, "clicks are blocked while paused");
  T.handleCellClick(path[0]);
  eq(T.stats.cells, cells, "dot clicks are blocked while paused");
  T.handleCellClick(path[1]);
  keydown("P");
  eq(T.paused, false, "P resumes");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.handleCellClick(path[1]);
  eq(T.stats.cells, cells + 1, "clicks work after resuming");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("p");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("p");
  eq(T.paused, false, "resumed again");

  // P typed into a form control is ignored.
  keydown("p", { target: { tagName: "SELECT" } });
  eq(T.paused, false, "P in a select does not pause");

  // A solved board ignores pause.
  T.loadLevel(0);
  solveLevel(0);
  eq(T.roundOver, true, "level 1 solved again");
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Level Complete! 🎉", "win overlay intact");
}

// ---------- L. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("flow-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("flow-sound"), "on", "preference restored");
}

// ---------- M. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 14, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "streak5", "clean", "clean5",
    "clean3", "cells100", "cells500", "reset10", "back25", "all8",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.wins, 11, "wins");
  eq(T.stats.streak, 1, "streak");
  eq(T.stats.bestStreak, 6, "best streak");
  eq(T.stats.cleanWins, 7, "clean wins");
  eq(T.stats.cleanStreak, 6, "clean streak");
  eq(T.stats.cells, 540, "career cells drawn");
  eq(T.stats.backtracks, 26, "career backtracks");
  eq(T.stats.resets, 10, "career resets");
  eq(T.stats.solved.length, 8, "levels solved");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
