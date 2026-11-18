// Deterministic tests for games/word-square/script.js
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
    title: "",
    type: "",
    value: "",
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
    querySelector() {
      return makeEl("span");
    },
    querySelectorAll() {
      return [];
    },
    getContext() {
      return { createLinearGradient: () => ({ addColorStop() {} }) };
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
  "board", "wins", "time", "best", "puzzle", "hint", "reset", "new-puzzle",
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

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: () => 1,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 1;
global.clearInterval = () => {};
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Win count from the pre-core build.
storage.set("wordsquare-wins", "2");

const root = require("./_env").root;
const dir = root + "games/word-square/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const W = global.window.__WORDSQUARE;
if (!W) {
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
function has(hay, needle, msg) {
  ok(String(hay || "").indexOf(needle) !== -1, msg, { actual: hay, expected: needle });
}

function keydown(key) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn({ key, target: { tagName: "BODY" }, preventDefault() {} })
  );
}
function winEvent(t) {
  (listeners["win:" + t] || []).forEach((fn) => fn({}));
}
function visibility(hidden) {
  document.hidden = hidden;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
}
const boardCell = (r, c) => elements.get("board").children[r * 5 + c];
const lockedCount = () => W.locked.reduce((n, row) => n + row.filter(Boolean).length, 0);
const validCount = () => {
  let n = 0;
  for (const cell of elements.get("board").children) if (cell.classList.contains("valid")) n++;
  return n;
};

// ---------- A. Init + legacy migration + puzzle data ----------
{
  eq(W.stats.games, 1, "the opening puzzle is counted");
  eq(W.stats.wins, 2, "legacy wins migrated");
  eq(storage.has("wordsquare-wins"), false, "legacy key removed");
  eq(W.stats.hints, 0, "no hints yet");
  eq(W.stats.flawless, 0, "no clean squares yet");
  eq(W.stats.bestTime, 0, "no best time yet");
  eq(W.stats.solved.length, 0, "no squares completed yet");
  eq(W.SIZE, 5, "five by five");
  eq(W.LINE_COUNT, 10, "ten lines");
  eq(W.PUZZLES.length, 13, "13 puzzles");
  eq(W.WORDS.length, 808, "808 dictionary words");
  eq(new Set(W.WORDS).size, 808, "dictionary words are unique");
  ok(
    W.PUZZLES.every((rows) =>
      rows.every((row) => row.length === 5 && W.WORDS_SET.has(row)) &&
      [0, 1, 2, 3, 4].every((c) => W.WORDS_SET.has(rows.map((row) => row[c]).join("")))
    ),
    "every puzzle is a true word square"
  );
  eq(W.puzzleIndex, 6, "the opening puzzle is deterministic");
  eq(W.solution.map((row) => row.join("")).join(","), "DELTA,EMAIL,LARGE,TIGER,ALERT", "opening solution");
  eq(W.grid.length, 5, "five rows");
  eq(W.grid[0].length, 5, "five columns");
  eq(W.grid.every((row) => row.every((ch) => ch === "")), true, "the grid starts empty");
  eq(lockedCount(), 0, "nothing locked");
  eq(W.selected.r, 0, "selection starts at the top left");
  eq(W.selected.c, 0, "selection starts at the top left");
  eq(W.gameOver, false, "the square is live");
  eq(W.paused, false, "not paused");
  eq(W.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(W.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(W.unlocked().length, 1, "the legacy wins unlock the first badge");
  ok(W.unlocked().includes("first"), "First Square unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(elements.get("wins").textContent, 2, "wins HUD");
  eq(elements.get("time").textContent, "0:00", "clock starts at 0:00");
  eq(elements.get("best").textContent, "—", "best HUD empty");
  eq(elements.get("puzzle").textContent, "7 / 13", "puzzle label");
  eq(W.overlayTitle(), null, "no overlay on load");
  eq(elements.get("board").children.length, 25, "25 grid cells rendered");
  eq(boardCell(0, 0).className.indexOf("ws-cell") !== -1, true, "cell class");
  eq(boardCell(0, 0).getAttribute("aria-label"), "Row 1, column 1, empty", "cell aria label");
}

// ---------- B. Selection, typing, erasing ----------
{
  eq(W.select(0, 1), true, "a cell can be selected");
  eq(W.selected.r, 0, "selected row tracked");
  eq(W.selected.c, 1, "selected column tracked");
  eq(boardCell(0, 1).classList.contains("selected"), true, "selected cell highlighted");
  eq(W.select(0, 1), false, "re-selecting the same cell is a no-op");
  eq(W.type("D"), true, "typing fills the selected cell");
  eq(W.grid[0][1], "D", "the letter lands in the cell");
  eq(W.selected.c, 2, "the selection advances");
  eq(boardCell(0, 2).classList.contains("selected"), true, "the next cell is highlighted");
  eq(W.erase(), true, "Backspace steps back and clears");
  eq(W.grid[0][1], "", "the typed letter is gone");
  eq(W.selected.c, 1, "the selection stepped back");
  eq(W.erase(), false, "nothing left to erase at the start");
  eq(W.selected.c, 0, "the cursor stepped back to the first cell");
  eq(W.move(0, 1), true, "arrows move the selection");
  eq(W.selected.c, 1, "moved right");
  eq(W.move(0, 1), true, "moved right again");
  eq(W.selected.c, 2, "moved right again");
  eq(W.move(0, 1), true, "moved right again");
  eq(W.selected.c, 3, "moved right again");
  eq(W.move(0, 1), true, "moved right again");
  eq(W.selected.c, 4, "at the right edge");
  eq(W.move(0, 1), false, "the selection stops at the edge");
  eq(W.move(1, 0), true, "moved down");
  eq(W.selected.r, 1, "moved down");
  eq(W.move(-1, -1), true, "moved diagonally back");
  eq(W.selected.r, 0, "moved up");
  eq(W.selected.c, 3, "moved left");
}

// ---------- C. Hints lock cells and typing skips them ----------
{
  eq(W.hint(), true, "Hint reveals a letter");
  eq(W.grid[2][2], "R", "the hinted letter is correct");
  eq(W.locked[2][2], true, "the hinted cell is locked");
  eq(lockedCount(), 1, "one cell locked");
  eq(W.stats.hints, 1, "hint counted");
  eq(W.hintsThisPuzzle, 1, "hint counted for the square");
  eq(boardCell(2, 2).classList.contains("locked"), true, "locked cell styled");
  eq(W.hint(), true, "a second hint works");
  eq(lockedCount(), 2, "two cells locked");
  eq(W.stats.hints, 2, "second hint counted");
  eq(W.hintsThisPuzzle, 2, "second hint counted for the square");

  eq(W.select(2, 1), true, "select a cell before a locked one");
  eq(W.type("X"), true, "typing still works next to a lock");
  eq(W.grid[2][1], "X", "the letter lands in the free cell");
  eq(W.selected.c, 4, "the cursor skips both locked cells");
  eq(W.select(2, 2), true, "a locked cell can still be focused");
  eq(W.type("Y"), false, "typing on a locked cell is refused");
  eq(W.grid[2][2], "R", "the locked letter is untouched");
}

// ---------- D. A clean timed win ----------
{
  W.setPuzzle(6);
  eq(W.stats.games, 1, "loading a puzzle does not count a game");
  eq(W.hintsThisPuzzle, 0, "hints reset with the puzzle");
  eq(W.puzzleIndex, 6, "puzzle pinned");
  eq(elements.get("puzzle").textContent, "7 / 13", "puzzle label");
  W.setElapsed(45000);
  eq(elements.get("time").textContent, "0:45", "the HUD formats the clock as m:ss");
  eq(W.solve(), true, "the square solves");
  eq(W.gameOver, true, "the square ends");
  eq(W.stats.wins, 3, "win counted");
  eq(W.stats.flawless, 1, "clean square counted");
  eq(W.stats.solved.length, 1, "square recorded");
  eq(W.stats.solved[0], 6, "the solved puzzle index is stored");
  eq(W.stats.bestTime, 45000, "best time recorded");
  eq(elements.get("wins").textContent, 3, "wins HUD");
  eq(elements.get("time").textContent, "0:45", "the clock freezes on the finish");
  eq(elements.get("best").textContent, "0:45", "best time HUD");
  eq(W.checkLines(), 10, "all ten lines are valid");
  eq(validCount(), 25, "every cell is highlighted");
  eq(W.overlayTitle(), "Square Complete! 🎉", "win overlay");
  has(W.overlayMsg(), "Solved in 0:45", "overlay reports the time");
  has(W.overlayMsg(), "New best time", "the first finish is a record");
  ok(W.unlocked().includes("quick300"), "Under Five badge unlocks");
  ok(W.unlocked().includes("quick180"), "Under Three badge unlocks");
  ok(W.unlocked().includes("quick120"), "Under Two badge unlocks");
  ok(W.unlocked().includes("flawless1"), "Clean Square badge unlocks");
  eq(W.unlocked().length, 5, "five badges");
  eq(elements.get("badge-count").textContent, 5, "header badge count");
  eq(W.type("A"), false, "typing is blocked after the win");
  eq(W.hint(), false, "hints are blocked after the win");
  eq(W.erase(), false, "erasing is blocked after the win");
  eq(W.select(0, 0), false, "selection is blocked after the win");
}

// ---------- E. Next puzzle never repeats ----------
{
  W.newGame();
  eq(W.stats.games, 2, "the next square is counted");
  eq(W.puzzleIndex, 7, "the next puzzle skips the current one");
  eq(elements.get("puzzle").textContent, "8 / 13", "puzzle label");
  eq(W.gameOver, false, "fresh square");
  eq(W.grid.every((row) => row.every((ch) => ch === "")), true, "grid cleared");
  eq(elements.get("time").textContent, "0:00", "clock restarts");
  eq(elements.get("best").textContent, "0:45", "best time kept");
  eq(W.stats.solved.length, 1, "solved list kept");
  eq(W.overlayTitle(), null, "overlay closed");
  eq(W.hintsThisPuzzle, 0, "hints reset");
}

// ---------- F. Pause, blur, visibility and the badges modal ----------
{
  keydown("Escape");
  eq(W.paused, true, "Escape pauses");
  eq(W.overlayTitle(), "Paused", "pause overlay");
  has(W.overlayMsg(), "clock is stopped", "pause overlay explains the clock");
  eq(W.type("A"), false, "typing is blocked while paused");
  eq(W.erase(), false, "erasing is blocked while paused");
  eq(W.hint(), false, "hints are blocked while paused");
  eq(W.select(1, 1), false, "selection is blocked while paused");
  eq(W.move(1, 0), false, "arrows are blocked while paused");
  eq(W.grid[1][1], "", "the grid stays empty");

  keydown("Escape");
  eq(W.paused, false, "Escape resumes");
  eq(W.overlayTitle(), null, "pause overlay closed");

  winEvent("blur");
  eq(W.paused, true, "window blur pauses");
  keydown("Escape");
  eq(W.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(W.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(W.paused, false, "resumed again");

  keydown("p");
  eq(W.paused, false, "P is a letter, not a pause key");
  eq(W.grid[0][0], "P", "P types into the grid");
  keydown("Backspace");
  eq(W.grid[0][0], "", "Backspace clears it");

  keydown("ArrowRight");
  eq(W.selected.c, 1, "arrow keys move the selection");
  keydown("ArrowDown");
  eq(W.selected.r, 1, "arrow keys move the selection");

  W.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(W.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "5 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(W.paused, true, "the square stays paused behind the modal");
  eq(W.overlayTitle(), "Paused", "pause overlay still up");
  keydown("Escape");
  eq(W.paused, false, "and Escape resumes");
}

// ---------- G. Reset keeps hinted letters; rows and columns highlight ----------
{
  W.setPuzzle(0);
  eq(W.puzzleIndex, 0, "puzzle pinned");
  eq(elements.get("puzzle").textContent, "1 / 13", "puzzle label");
  eq(W.solution[0].join(""), "BEACH", "the solution is the word square");
  eq(W.stats.games, 2, "setPuzzle does not count a game");

  W.type("B");
  W.type("E");
  W.type("A");
  W.type("C");
  W.type("H");
  eq(W.grid[0].join(""), "BEACH", "the row reads the first word");
  eq(W.checkLines(), 1, "the completed row is valid");
  eq(validCount(), 5, "the row cells are highlighted");
  eq(W.selected.r, 1, "the cursor advances past the row");

  W.setElapsed(5000);
  eq(elements.get("time").textContent, "0:05", "mid-game clock");
  W.type("Z");
  eq(W.grid[1][0], "Z", "a wrong letter is allowed");
  eq(W.checkLines(), 1, "a wrong letter breaks no rows");
  eq(W.reset(), true, "Reset clears the board");
  eq(W.grid[0].join(""), "", "the board is empty");
  eq(elements.get("time").textContent, "0:00", "Reset restarts the clock");
  eq(W.gameOver, false, "Reset leaves the square live");

  // A column can be a word too.
  for (let r = 0; r < 5; r++) {
    W.select(r, 0);
    W.type("BEACH"[r]);
  }
  eq(W.grid.map((row) => row[0]).join(""), "BEACH", "the column reads BEACH");
  eq(W.checkLines(), 1, "the completed column is valid");
  eq(validCount(), 5, "the column cells are highlighted");

  // A hint stays locked through a reset.
  W.setPuzzle(0);
  W.hint();
  W.hint();
  eq(lockedCount(), 2, "two hinted cells");
  W.select(4, 4);
  W.type("Z");
  eq(W.grid[4][4], "Z", "typed a letter");
  W.reset();
  eq(lockedCount(), 2, "hinted cells survive Reset");
  eq(W.grid.reduce((n, row) => n + row.filter(Boolean).length, 0), 2, "only hinted letters remain");
  eq(W.grid[4][4], "", "typed letters are cleared");

  W.setElapsed(30000);
  eq(W.solve(), true, "hinted square still solves");
  eq(W.stats.wins, 4, "win counted");
  eq(W.stats.flawless, 1, "a hinted square is not a clean solve");
  eq(W.stats.solved.join(","), "6,0", "both squares recorded");
  eq(W.stats.bestTime, 30000, "a faster time is a new best");
  eq(elements.get("best").textContent, "0:30", "best time HUD");
  has(W.overlayMsg(), "New best time", "record solve");
  eq(W.unlocked().length, 5, "no new badges yet");
}

// ---------- H. Finish the whole set ----------
{
  for (let i = 1; i < W.PUZZLES.length; i++) {
    W.setPuzzle(i);
    W.setElapsed(60000);
    eq(W.solve(), true, "puzzle " + i + " solves");
  }
  eq(W.stats.solved.length, 13, "every square finished");
  eq(W.stats.wins, 16, "sixteen wins");
  eq(W.stats.flawless, 13, "thirteen clean squares");
  eq(W.stats.bestTime, 30000, "the best time survives slower solves");
  ok(W.unlocked().includes("allSquares"), "Every Square badge unlocks");
  ok(W.unlocked().includes("win5"), "Square Deal badge unlocks");
  ok(W.unlocked().includes("win10"), "Grid Smith badge unlocks");
  ok(W.unlocked().includes("flawless5"), "Spotless badge unlocks");
  eq(W.unlocked().length, 9, "nine badges");
}

// ---------- I. Hint, win and game grinds ----------
{
  let guard = 0;
  while (W.stats.hints < 50 && guard++ < 20) {
    W.setPuzzle(0);
    for (let i = 0; i < 5 && W.stats.hints < 50; i++) W.hint();
  }
  eq(W.stats.hints, 50, "fifty hints");
  ok(W.unlocked().includes("hint10"), "Nudge badge unlocks");
  ok(W.unlocked().includes("hint50"), "Hint Happy badge unlocks");
  eq(W.unlocked().length, 11, "eleven badges");

  guard = 0;
  while (W.stats.wins < 25 && guard++ < 40) {
    W.setPuzzle(0);
    W.setElapsed(600000);
    W.solve();
  }
  eq(W.stats.wins, 25, "twenty-five wins");
  ok(W.unlocked().includes("win25"), "Square Master badge unlocks");
  eq(W.unlocked().length, 12, "twelve badges");

  guard = 0;
  while (W.stats.games < 25 && guard++ < 40) W.newGame();
  eq(W.stats.games, 25, "twenty-five squares started");
  ok(W.unlocked().includes("games10"), "Ten Grids badge unlocks");
  ok(W.unlocked().includes("games25"), "Puzzle Shelf badge unlocks");
  eq(W.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- J. Buttons, keyboard and sound ----------
{
  const games = W.stats.games;
  elements.get("new-puzzle").dispatch("click");
  eq(W.stats.games, games + 1, "New Puzzle counts a game");
  eq(W.overlayTitle(), null, "New Puzzle closes any overlay");

  W.setPuzzle(0);
  const hints = W.stats.hints;
  elements.get("hint").dispatch("click");
  eq(W.stats.hints, hints + 1, "the Hint button works");
  const filledAfterHint = W.grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  eq(filledAfterHint, 1, "the Hint button revealed one letter");
  elements.get("reset").dispatch("click");
  eq(W.grid.reduce((n, row) => n + row.filter(Boolean).length, 0), 1, "Reset keeps the hinted letter");
  eq(elements.get("time").textContent, "0:00", "the Reset button restarts the clock");

  keydown("a");
  eq(W.grid[0][0], "A", "keyboard input types a letter");
  eq(W.selected.c, 1, "the cursor advances");
  eq(W.grid[0][0].length, 1, "one letter per cell");

  keydown("b");
  keydown("Backspace");
  eq(W.grid[0][1], "", "Backspace removes the last letter");
  keydown("Escape");
  eq(W.paused, true, "Escape pauses from the keyboard");
  keydown("Escape");
  eq(W.paused, false, "Escape resumes");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("word-square-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("word-square-sound"), "on", "preference restored");

  eq(W.setPuzzle(99).join(","), W.PUZZLES[12].join(","), "an out-of-range puzzle clamps to the last");
  eq(W.setPuzzle(-5).join(","), W.PUZZLES[0].join(","), "a negative puzzle clamps to the first");
  eq(elements.get("puzzle").textContent, "1 / 13", "the label follows the clamp");

  W.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Puzzles <b>26</b>", "puzzles record");
  has(records, "Solved <b>25</b>", "solved record");
  has(records, "Hints <b>51</b>", "hints record");
  has(records, "Best time <b>0:30</b>", "best time record");
  has(records, "Squares <b>13/13</b>", "squares record");
  W.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  W.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");

  const expected = [
    "first", "win5", "win10", "win25", "games10", "games25",
    "hint10", "hint50", "quick300", "quick180", "quick120",
    "flawless1", "flawless5", "allSquares",
  ];
  const u = W.unlocked();
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(W.stats.games, 26, "puzzles");
  eq(W.stats.wins, 25, "wins");
  eq(W.stats.hints, 51, "hints");
  eq(W.stats.bestTime, 30000, "best time");
  eq(W.stats.solved.length, 13, "squares");
  ok(storage.has("word-square-stats-v1"), "stats persisted");
  ok(storage.has("word-square-achv-v1"), "badges persisted");
  eq(storage.has("wordsquare-wins"), false, "legacy key stays removed");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
