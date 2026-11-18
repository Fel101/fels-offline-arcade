// Deterministic tests for games/nonogram/script.js
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
    _attrs: { style: {} },
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
  "ngrid", "puzzle-num", "moves", "streak", "wins", "new-puzzle", "reset", "hint",
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
storage.set("nonogram-wins", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/nonogram/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__NONOGRAM;
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
function hud(id) {
  return elements.get(id).textContent;
}
// Click every filled cell of the current puzzle exactly once (left click).
function solveClean() {
  const sol = T.solution;
  for (let r = 0; r < T.SIZE; r++) {
    for (let c = 0; c < T.SIZE; c++) {
      if (sol[r][c] === 1) T.onLeft(r, c);
    }
  }
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.SIZE, 5, "five by five grid");
  eq(T.PUZZLES.length, 12, "twelve handcrafted pictures");
  eq(T.stats.wins, 2, "legacy wins migrated");
  eq(T.stats.streak, 0, "streak starts at 0");
  eq(T.stats.bestStreak, 0, "best streak starts at 0");
  eq(T.stats.moves, 0, "no clicks yet");
  eq(T.stats.marks, 0, "no marks yet");
  eq(T.stats.cleanWins, 0, "no clean wins yet");
  eq(T.stats.annotatedWins, 0, "no annotated wins yet");
  eq(T.stats.solved.length, 0, "no pictures solved yet");
  eq(storage.has("nonogram-wins"), false, "legacy wins key removed");
  eq(storage.has("nonogram-stats-v1"), true, "stats persisted under the core key");
  eq(hud("wins"), 2, "Wins HUD shows the migrated value");
  eq(hud("moves"), 0, "Moves HUD starts at 0");
  eq(hud("streak"), 0, "Streak HUD starts at 0");
  eq(T.puzzleIndex, 6, "Math.random 0.5 picks the 7th picture (Cross)");
  eq(hud("puzzle-num"), 7, "Puzzle number shown");
  eq(T.won, false, "not solved");
  eq(T.paused, false, "not paused");
  eq(T.moves, 0, "no moves");
  eq(T.marks, 0, "no marks");
  eq(T.grid.every((row) => row.every((v) => v === T.EMPTY)), true, "grid starts empty");
  eq(T.solution[0].join(""), "10001", "Cross solution pinned");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  ok(elements.get("hint").textContent.indexOf("P pauses") !== -1, "hint mentions P");
}

// ---------- B. Clue maths and rendered grid ----------
{
  eq(T.runs([0, 1, 1, 0, 1]).join(","), "2,1", "runs of a mixed line");
  eq(T.runs([1, 1, 1, 1, 1]).join(","), "5", "runs of a full line");
  eq(T.runs([0, 0, 0, 0, 0]).join(","), "0", "an empty line shows a single 0");
  eq(T.runs([1, 0, 1, 0, 1]).join(","), "1,1,1", "alternating runs");

  T.setPuzzle(0); // Heart
  eq(T.rowClue(0).join(","), "1,1", "Heart row 1 clue");
  eq(T.rowClue(1).join(","), "5", "Heart row 2 clue");
  eq(T.colClue(0).join(","), "2", "Heart column 1 clue");
  eq(T.colClue(2).join(","), "4", "Heart middle column clue");
  eq(T.filledCount(), 16, "Heart has sixteen filled cells");

  const kids = elements.get("ngrid").children;
  eq(kids.length, 36, "corner + 5 column clues + 5 x (row clue + 5 cells)");
  ok(kids[0].classList.contains("ngrid__corner"), "first cell is the corner");
  ok(kids[1].classList.contains("clue--col"), "column clue rendered first");
  eq(kids[1].children.length, 1, "Heart column 1 clue has one number");
  ok(kids[6].classList.contains("clue--row"), "row clue precedes the row cells");
  eq(kids[6].children.length, 2, "Heart row 1 clue has two numbers");
  ok(kids[7].classList.contains("ncell"), "grid cell rendered");
  eq(kids[7].dataset.r, "0", "cell has a row index");
  eq(kids[7].dataset.c, "0", "cell has a column index");
  eq(kids[7].getAttribute("aria-label"), "Row 1, column 1", "cell is labelled");
  eq(T.cells.length, 5, "cell lookup has five rows");
  eq(T.cells[4][4], kids[36 - 1], "last cell is wired into the lookup");
}

// ---------- C. Click rules ----------
{
  T.onLeft(0, 0);
  eq(T.grid[0][0], T.FILLED, "left click fills a cell");
  eq(T.moves, 1, "move counted");
  eq(T.stats.moves, 1, "career click counted");
  ok(T.cells[0][0].classList.contains("filled"), "cell marked filled");
  eq(hud("moves"), 1, "Moves HUD updated");

  T.onLeft(0, 0);
  eq(T.grid[0][0], T.EMPTY, "left click again clears the cell");
  eq(T.moves, 2, "second move counted");
  ok(!T.cells[0][0].classList.contains("filled"), "cell no longer filled");

  T.onRight(0, 1);
  eq(T.grid[0][1], T.MARKED, "right click marks a cell");
  eq(T.marks, 1, "mark counted");
  eq(T.stats.marks, 1, "career mark counted");
  eq(T.cells[0][1].textContent, "✕", "mark renders an ✕");
  ok(T.cells[0][1].classList.contains("marked"), "cell marked as empty");

  T.onRight(0, 1);
  eq(T.grid[0][1], T.EMPTY, "right click again clears the mark");
  eq(T.marks, 2, "second mark counted");
  eq(T.cells[0][1].textContent, "", "✕ removed");
  eq(T.stats.moves, 4, "four career clicks");

  T.resetPuzzle();
  eq(T.moves, 0, "reset clears the move counter");
  eq(T.marks, 0, "reset clears the mark counter");
  eq(T.grid.every((row) => row.every((v) => v === T.EMPTY)), true, "reset empties the grid");
  eq(T.stats.moves, 4, "career clicks survive a reset");
  eq(hud("moves"), 0, "Moves HUD reset");
}

// ---------- D. Clean win ----------
{
  T.setPuzzle(0); // Heart
  solveClean();
  eq(T.won, true, "matching the picture wins");
  eq(T.moves, 16, "sixteen clicks");
  eq(T.overlayTitle(), "Solved! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Heart — completed in 16 moves.") !== -1, "win message", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("No wasted clicks!") !== -1, "clean bonus mentioned", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Streak 1.") !== -1, "streak line", T.overlayMsg());
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.cleanWins, 1, "clean win counted");
  eq(T.stats.annotatedWins, 0, "an unannotated grid is not annotated");
  eq(T.stats.moves, 20, "sixteen more career clicks");
  eq(T.stats.solved.join(","), "Heart", "picture recorded as solved");
  eq(hud("wins"), 3, "Wins HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  ok(u.includes("clean"), "Precise badge unlocks");
  eq(u.length, 2, "two badges unlocked");
  T.onLeft(2, 2);
  eq(T.moves, 16, "clicks are ignored once solved");
  T.resetPuzzle();
  eq(T.moves, 16, "reset is blocked once solved");
  T.overlay.hide();
}

// ---------- E. Fully annotated win ----------
{
  T.setPuzzle(1); // Sailboat
  eq(T.filledCount(), 14, "Sailboat has fourteen filled cells");
  const sol = T.solution;
  for (let r = 0; r < T.SIZE; r++) {
    for (let c = 0; c < T.SIZE; c++) {
      if (sol[r][c] === 0) T.onRight(r, c);
    }
  }
  eq(T.marks, 11, "all eleven empty cells marked");
  eq(T.won, false, "marking alone does not win");
  for (let r = 0; r < T.SIZE; r++) {
    for (let c = 0; c < T.SIZE; c++) {
      if (sol[r][c] === 1) T.onLeft(r, c);
    }
  }
  eq(T.won, true, "filling the rest wins");
  eq(T.moves, 25, "eleven marks plus fourteen fills");
  ok((T.overlayMsg() || "").indexOf("Sailboat — completed in 25 moves.") !== -1, "win message", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Fully annotated!") !== -1, "annotated bonus mentioned", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("No wasted clicks") === -1, "an annotated win is not clean", T.overlayMsg());
  eq(T.stats.wins, 4, "fourth win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.cleanWins, 1, "clean wins unchanged");
  eq(T.stats.annotatedWins, 1, "annotated win counted");
  eq(T.stats.marks, 13, "thirteen career marks");
  eq(T.stats.moves, 45, "twenty-five more career clicks");
  eq(T.stats.solved.join(","), "Heart,Sailboat", "second picture recorded");
  const u = T.unlocked();
  ok(u.includes("annotated"), "Full Notes badge unlocks");
  ok(u.includes("marks10"), "Crosser badge unlocks");
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  eq(u.length, 5, "five badges unlocked");
  T.overlay.hide();
}

// ---------- F. Collect all twelve pictures ----------
{
  const order = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let expectedMoves = 45;
  let expectedClean = 1;
  for (let i = 0; i < order.length; i++) {
    T.setPuzzle(order[i]);
    const filled = T.filledCount();
    expectedMoves += filled;
    expectedClean += 1;
    solveClean();
    eq(T.won, true, T.PUZZLES[order[i]].name + " solved");
    eq(T.moves, filled, T.PUZZLES[order[i]].name + " finished in " + filled + " clean clicks");
    eq(T.stats.wins, 5 + i, "win tally after " + T.PUZZLES[order[i]].name);
    eq(T.stats.streak, 3 + i, "streak after " + T.PUZZLES[order[i]].name);
    eq(T.stats.cleanWins, expectedClean, "clean tally after " + T.PUZZLES[order[i]].name);
    eq(T.stats.moves, expectedMoves, "career clicks after " + T.PUZZLES[order[i]].name);
    eq(T.stats.solved.length, 3 + i, "distinct pictures after " + T.PUZZLES[order[i]].name);
    T.overlay.hide();
  }
  eq(T.stats.wins, 14, "fourteen wins");
  eq(T.stats.streak, 12, "twelve in a row");
  eq(T.stats.bestStreak, 12, "best streak is 12");
  eq(T.stats.cleanWins, 11, "eleven clean wins");
  eq(T.stats.moves, 181, "one hundred and eighty-one career clicks");
  eq(T.stats.solved.length, 12, "all twelve pictures solved");
  const u = T.unlocked();
  ["win5", "win10", "streak3", "streak5", "clean5", "all6", "all12", "moves100"].forEach((id) =>
    ok(u.includes(id), id + " badge unlocks")
  );
  eq(u.length, 13, "thirteen badges unlocked");
  ok(!u.includes("moves500"), "Dedicated still locked");
}

// ---------- G. Badges modal before the grind ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "13 / 14", "modal shows 13 of 14 unlocked");
  eq(elements.get("badge-count").textContent, 13, "header badge count in sync");
  ok(elements.get("achv-grid").innerHTML.indexOf("Dedicated") !== -1, "locked badge still listed");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
}

// ---------- H. Click grind unlocks the final click badge ----------
{
  T.setPuzzle(2); // Tree — (0,0) is empty in the picture, so this stays unsolved
  let guard = 0;
  while (T.stats.moves < 500 && guard < 600) {
    T.onLeft(0, 0);
    guard++;
  }
  eq(T.stats.moves, 500, "career clicks reach exactly 500");
  eq(guard, 319, "three hundred and nineteen clicks needed");
  ok(T.unlocked().includes("moves500"), "Dedicated badge unlocks");
  eq(T.won, false, "grinding did not solve the picture");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count updated");
  T.resetPuzzle();
}

// ---------- I. Pause ----------
{
  T.setPuzzle(3); // Mushroom
  T.onLeft(0, 0);
  eq(T.stats.moves, 501, "one click before pausing");
  keydown("p", { target: { tagName: "INPUT" } });
  eq(T.paused, false, "a P typed into an input does not pause");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.onLeft(1, 1);
  eq(T.stats.moves, 501, "clicks are blocked while paused");
  T.onRight(0, 0);
  eq(T.stats.marks, 13, "marks are blocked while paused");
  T.resetPuzzle();
  eq(T.moves, 1, "reset is blocked while paused");
  keydown("P");
  eq(T.paused, false, "P resumes");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.onLeft(1, 1);
  eq(T.moves, 2, "clicks work after resuming");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("p");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("p");
  eq(T.paused, false, "resumed again");

  // A solved board ignores pause.
  T.resetPuzzle();
  eq(T.moves, 0, "reset clears the two test clicks");
  solveClean();
  eq(T.won, true, "Mushroom solved");
  eq(T.stats.moves, 515, "thirteen clean clicks after the pause tests");
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Solved! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- J. New puzzle picks a different picture ----------
{
  const before = T.puzzleIndex;
  T.newPuzzle();
  ok(T.puzzleIndex !== before, "new puzzle avoids repeating the current picture");
  eq(T.moves, 0, "new puzzle starts at zero moves");
  eq(T.won, false, "new puzzle is live");
  eq(T.paused, false, "new puzzle is not paused");
  eq(T.grid.every((row) => row.every((v) => v === T.EMPTY)), true, "fresh grid");
  eq(T.stats.wins, 15, "new puzzle is not a win");
}

// ---------- K. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("nonogram-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("nonogram-sound"), "on", "preference restored");
}

// ---------- L. Badges modal after the grind ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 14, "header badge count in sync");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- M. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "streak5", "clean", "clean5",
    "marks10", "annotated", "moves100", "moves500", "all6", "all12",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.wins, 15, "wins");
  eq(T.stats.streak, 13, "streak");
  eq(T.stats.bestStreak, 13, "best streak");
  eq(T.stats.cleanWins, 12, "clean wins");
  eq(T.stats.annotatedWins, 1, "annotated wins");
  eq(T.stats.moves, 515, "career clicks");
  eq(T.stats.marks, 13, "career marks");
  eq(T.stats.solved.length, 12, "pictures solved");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
