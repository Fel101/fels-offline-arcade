// Deterministic tests for games/gomoku/script.js
// The AI is fully deterministic (pattern scores + fixed tie-breaks, no RNG),
// so its behaviour can be asserted exactly on hand-built positions.
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
  "board", "turn", "wins", "streak", "ai-diff", "new-game", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("ai-diff").value = "normal"; // Normal

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

let timerSeq = 0;
global.window = {
  innerWidth: 800,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: () => ++timerSeq, // never fires — tests call aiMove() by hand
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
  eval(fs.readFileSync(root + "games/gomoku/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__GOMOKU;
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

function keydown(key) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn({ key, target: { tagName: "BODY" }, preventDefault() {} })
  );
}
function winEvent(t) {
  (listeners["win:" + t] || []).forEach((fn) => fn({}));
}
function emptyGrid() {
  return Array.from({ length: T.SIZE }, () => new Array(T.SIZE).fill(""));
}
function rowStones(row, cols, p) {
  const g = emptyGrid();
  cols.forEach((c) => { g[row][c] = p; });
  return g;
}
function colStones(col, rows, p) {
  const g = emptyGrid();
  rows.forEach((r) => { g[r][col] = p; });
  return g;
}
function humanFourAt(row, startCol) {
  return rowStones(row, [startCol, startCol + 1, startCol + 2, startCol + 3], "B");
}
function aiFourAt(row, startCol) {
  return rowStones(row, [startCol, startCol + 1, startCol + 2, startCol + 3], "W");
}

// ---------- A. Init ----------
{
  eq(T.grid.length, T.SIZE, "board has SIZE rows");
  eq(T.grid[0].length, T.SIZE, "board has SIZE columns");
  eq(T.grid.flat().every((c) => c === ""), true, "board starts empty");
  eq(elements.get("board").children.length, T.SIZE * T.SIZE, "225 cells rendered");
  eq(T.turn, "B", "human (black) moves first");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.diff, "normal", "default difficulty is normal");
  eq(T.moveCount, 0, "no human stones yet");
  eq(T.stats.games, 0, "no games played");
  eq(T.stats.wins, 0, "no wins");
  eq(T.stats.totalMoves, 0, "no stones placed");
  eq(storage.has("gomoku-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("turn").textContent, "You", "turn HUD shows You");
  eq(elements.get("wins").textContent, 0, "wins HUD starts at 0");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Placement mechanics ----------
{
  const g = emptyGrid();
  eq(T.place(g, 0, 0, "B"), true, "placing on an empty point works");
  eq(T.place(g, 0, 0, "W"), false, "cannot place on an occupied point");
  eq(T.place(g, -1, 0, "B"), false, "cannot place off the board");
  eq(T.place(g, 0, T.SIZE, "B"), false, "cannot place past the edge");

  T.setState(emptyGrid(), "B");
  T.playCell(7, 7);
  eq(T.moveCount, 1, "human stone counted");
  eq(T.grid[7][7], "B", "stone landed");
  eq(T.turn, "W", "turn passes to the CPU");
  eq(T.stats.totalMoves, 1, "career stone counted");

  T.playCell(7, 8);
  eq(T.moveCount, 1, "human cannot move while the CPU is to move");
  eq(T.grid[7][8], "", "blocked click left the board untouched");

  const occupied = emptyGrid();
  occupied[0][0] = "B";
  T.setState(occupied, "B");
  T.playCell(0, 0);
  eq(T.moveCount, 0, "an occupied point rejects the move");
  eq(T.grid[0][0], "B", "existing stone unchanged");
}

// ---------- C. Win detection ----------
{
  eq(T.checkWin(rowStones(7, [3, 4, 5, 6, 7], "B"), 7, 7, "B"), true, "horizontal five wins");
  eq(T.checkWin(rowStones(7, [3, 4, 5, 6, 7], "B"), 7, 4, "B"), true, "win detected at any stone in the line");
  eq(T.checkWin(rowStones(7, [3, 4, 5, 6], "B"), 7, 6, "B"), false, "four in a row does not win");
  eq(T.checkWin(rowStones(7, [3, 4, 5, 6, 7], "B"), 7, 7, "W"), false, "wrong colour does not win");
  eq(T.checkWin(colStones(3, [3, 4, 5, 6, 7], "W"), 7, 3, "W"), true, "vertical five wins");

  const d1 = emptyGrid();
  [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]].forEach(([r, c]) => { d1[r][c] = "B"; });
  eq(T.checkWin(d1, 7, 7, "B"), true, "down-right diagonal wins");

  const d2 = emptyGrid();
  [[3, 7], [4, 6], [5, 5], [6, 4], [7, 3]].forEach(([r, c]) => { d2[r][c] = "W"; });
  eq(T.checkWin(d2, 7, 3, "W"), true, "down-left diagonal wins");

  const mixed = rowStones(7, [3, 4, 5, 6, 7], "B");
  mixed[7][4] = "W";
  eq(T.checkWin(mixed, 7, 3, "B"), false, "mixed colours break the line");

  eq(T.isFull(emptyGrid()), false, "empty board is not full");
  const fullBoard = emptyGrid();
  for (let r = 0; r < T.SIZE; r++)
    for (let c = 0; c < T.SIZE; c++) fullBoard[r][c] = (r + c) % 2 ? "B" : "W";
  eq(T.isFull(fullBoard), true, "filled board is full");
}

// ---------- D. Pattern scores ----------
{
  eq(T.scoreFor(5, 0), 1000000, "five is a win");
  eq(T.scoreFor(4, 2), 100000, "open four scores highest below a win");
  eq(T.scoreFor(4, 1), 10000, "closed four");
  eq(T.scoreFor(3, 2), 5000, "open three");
  eq(T.scoreFor(2, 2), 200, "open two");
  eq(T.scoreFor(2, 0), 0, "a dead run scores nothing");

  const g = humanFourAt(7, 0);
  eq(T.pointScore(g, 7, 4, "B"), 1000000, "a completing point is recognised as a win");
  ok(T.pointScore(g, 7, 4, "W") < 1000000, "the same point is not a win for the other colour");
}

// ---------- E. AI behaviour ----------
{
  eq(T.aiChooseMove(emptyGrid(), "normal")[0], 7, "empty board -> centre row");
  eq(T.aiChooseMove(emptyGrid(), "normal")[1], 7, "empty board -> centre column");

  const winNow = aiFourAt(0, 0);
  eq(T.aiChooseMove(winNow, "normal")[0], 0, "AI completes its own four (row)");
  eq(T.aiChooseMove(winNow, "normal")[1], 4, "AI completes its own four (col)");

  // Human threatens to win at (7,4) — every difficulty must block it.
  const threat = humanFourAt(7, 0);
  for (const diff of ["easy", "normal", "hard"]) {
    const mv = T.aiChooseMove(threat, diff);
    eq(mv[0], 7, diff + " AI blocks a forced loss (row)");
    eq(mv[1], 4, diff + " AI blocks a forced loss (col)");
  }

  // Own win outranks blocking the opponent's win.
  const both = emptyGrid();
  [0, 1, 2, 3].forEach((c) => { both[0][c] = "W"; }); // AI wins at (0,4)
  [11, 12, 13, 14].forEach((c) => { both[14][c] = "B"; }); // human wins at (14,10)
  const mv = T.aiChooseMove(both, "normal");
  eq(mv[0], 0, "AI takes its own win over blocking");
  eq(mv[1], 4, "AI takes its own win over blocking");
}

// ---------- F. Human win on Easy ----------
{
  T.setDiff("easy");
  eq(T.diff, "easy", "easy difficulty tracked");
  T.setState(humanFourAt(7, 0), "B");
  T.playCell(7, 4);
  eq(T.gameOver, true, "win ends the game");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Fast finish") !== -1, "quick win is called out", T.overlayMsg());
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.easyWins, 1, "easy win counted");
  eq(T.stats.quickWins, 1, "quick win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.totalMoves, 2, "one from section B + this win");
  eq(elements.get("wins").textContent, 1, "wins HUD updated");
  eq(elements.get("streak").textContent, 1, "streak HUD updated");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  ok(T.unlocked().includes("easy"), "Warm-Up badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
  T.overlay.hide();
}

// ---------- G. Human win on Normal ----------
{
  T.setDiff("normal");
  T.setState(humanFourAt(7, 0), "B");
  T.playCell(7, 4);
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.normalWins, 1, "normal win counted");
  eq(T.stats.quickWins, 2, "second quick win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.totalMoves, 3, "third stone");
  ok(T.unlocked().includes("normal"), "Street Level badge unlocks");
  ok(T.unlocked().includes("streak2"), "Two in a Row badge unlocks");
  eq(T.unlocked().length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- H. Human win on Hard ----------
{
  T.setDiff("hard");
  T.setState(humanFourAt(7, 0), "B");
  T.playCell(7, 4);
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.hardWins, 1, "hard win counted");
  eq(T.stats.quickWins, 3, "third quick win");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.totalMoves, 4, "fourth stone");
  const u = T.unlocked();
  ok(u.includes("hard"), "Hard Mode badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  ok(u.includes("allDiff"), "All Rounder badge unlocks (all difficulties)");
  eq(u.length, 7, "seven badges unlocked");
  T.overlay.hide();
}

// ---------- I. CPU wins (loss) ----------
{
  T.setDiff("normal");
  T.setState(aiFourAt(7, 0), "W");
  T.aiMove();
  eq(T.gameOver, true, "CPU win ends the game");
  eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.bestStreak, 3, "best streak preserved");
  eq(T.stats.totalMoves, 5, "CPU stone counted");
  eq(T.unlocked().length, 7, "no new badges on a loss");
  T.overlay.hide();
}

// ---------- J. Draw ----------
{
  T.newGame();
  T.endGame("draw");
  eq(T.gameOver, true, "game over");
  eq(T.overlayTitle(), "Draw!", "draw overlay shown");
  eq(T.stats.games, 5, "fifth game");
  eq(T.stats.draws, 1, "draw counted");
  ok(T.unlocked().includes("draw1"), "Stalemate badge unlocks");
  eq(T.unlocked().length, 8, "eight badges unlocked");
  T.overlay.hide();
}

// ---------- K. Two more wins (win5 + quick5) ----------
{
  T.setDiff("normal");
  for (let i = 0; i < 2; i++) {
    T.setState(humanFourAt(7, 0), "B");
    T.playCell(7, 4);
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.quickWins, 5, "fifth quick win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.totalMoves, 7, "seventh stone");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  ok(u.includes("quick5"), "Lightning badge unlocks at 5 quick wins");
  eq(u.length, 10, "ten badges unlocked");
}

// ---------- L. Five more wins (win10) ----------
{
  for (let i = 0; i < 5; i++) {
    T.setState(humanFourAt(7, 0), "B");
    T.playCell(7, 4);
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.wins, 10, "tenth win");
  eq(T.stats.quickWins, 10, "ten quick wins");
  eq(T.stats.streak, 7, "streak is 7");
  eq(T.stats.bestStreak, 7, "best streak is 7");
  eq(T.stats.totalMoves, 12, "twelfth stone");
  ok(T.unlocked().includes("win10"), "Champion badge unlocks at 10 wins");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
  ok(!T.unlocked().includes("games20"), "Dedicated still locked");
  ok(!T.unlocked().includes("losses10"), "Persistence still locked");
  ok(!T.unlocked().includes("moves100"), "Stone Layer still locked");
}

// ---------- M. Two more losses ----------
{
  for (let i = 0; i < 2; i++) {
    T.setState(aiFourAt(7, 0), "W");
    T.aiMove();
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
    T.overlay.hide();
  }
  eq(T.stats.losses, 3, "three losses total");
  eq(T.stats.games, 14, "fourteen games total");
  eq(T.stats.streak, 0, "streak reset by the losses");
  eq(T.unlocked().length, 11, "no extra badges from the losses");
}

// ---------- N. Badge thresholds ----------
{
  T.stats.games = 20;
  T.stats.losses = 10;
  T.stats.totalMoves = 100;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  ok(u.includes("games20"), "Dedicated unlocks at 20 games");
  ok(u.includes("losses10"), "Persistence unlocks at 10 losses");
  ok(u.includes("moves100"), "Stone Layer unlocks at 100 stones");
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- O. Pause ----------
{
  T.setDiff("normal");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.playCell(7, 7);
  eq(T.moveCount, 0, "stones blocked while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.playCell(7, 7);
  eq(T.moveCount, 1, "stones work after resume");
  eq(T.turn, "W", "CPU's turn after the human stone");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();

  // Game over suppresses pause.
  T.setState(humanFourAt(7, 0), "B");
  T.playCell(7, 4);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- P. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("gomoku-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("gomoku-sound"), "on", "preference restored");
}

// ---------- Q. Badges modal ----------
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