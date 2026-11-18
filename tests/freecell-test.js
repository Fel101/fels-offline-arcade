// Deterministic tests for games/freecell/script.js
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
  "free-cells", "foundations", "columns", "moves", "wins", "streak",
  "new-game", "undo", "give-up", "hint", "badges-btn", "badge-count", "badges2",
  "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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
  eval(fs.readFileSync(root + "games/freecell/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__FREECELL;
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

const S = 0, H = 1, D = 2, CL = 3;
const C = (r, s) => ({ r, s });
function col(...pairs) { return pairs.map(([r, s]) => ({ r, s })); }
function emptyCols() { return Array.from({ length: 8 }, () => []); }
function emptyBoard() { return { columns: emptyCols(), free: [null, null, null, null], found: [0, 0, 0, 0], moves: 0 }; }

// ---------- A. Init ----------
{
  const cols = T.columns;
  eq(cols.length, 8, "8 columns");
  eq(cols[0].length, 7, "column 0 has 7 cards");
  eq(cols[3].length, 7, "column 3 has 7 cards");
  eq(cols[4].length, 6, "column 4 has 6 cards");
  eq(cols[7].length, 6, "column 7 has 6 cards");
  eq(cols.flat().length, 52, "52 cards dealt");
  eq(T.free.every((x) => x === null), true, "free cells start empty");
  eq(T.found.join(","), "0,0,0,0", "foundations start empty");
  eq(T.moves, 0, "no moves yet");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("freecell-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("free-cells").children.length, 4, "four free cells rendered");
  eq(elements.get("foundations").children.length, 4, "four foundations rendered");
  eq(elements.get("columns").children.length, 8, "eight columns rendered");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Sequence validation ----------
{
  eq(T.isSequence(col([13, S], [12, H], [11, S])), true, "descending alternating sequence");
  eq(T.isSequence(col([13, S], [12, H], [11, H])), false, "same colour breaks the sequence");
  eq(T.isSequence(col([13, S], [11, H])), false, "a gap breaks the sequence");
  eq(T.isSequence(col([5, S])), true, "a single card is a sequence");
  eq(T.isSequence([]), true, "empty is a sequence");
}

// ---------- C. Capacity ----------
{
  const b = emptyBoard();
  for (let i = 0; i < 8; i++) b.columns[i] = col([13, S]);
  b.free = [C(2, S), C(3, H), C(4, D), C(5, CL)];
  T.setState(b);
  eq(T.maxMovable(false), 1, "no free cells, no empty columns -> 1");
  b.free = [null, C(3, H), C(4, D), C(5, CL)];
  T.setState(b);
  eq(T.maxMovable(false), 2, "one free cell -> 2");
  b.free = [C(2, S), C(3, H), C(4, D), C(5, CL)];
  b.columns[7] = [];
  T.setState(b);
  eq(T.maxMovable(false), 2, "one empty column -> 2");
  eq(T.maxMovable(true), 1, "moving into the empty column does not count it twice");
}

// ---------- D. Column moves ----------
{
  const b = emptyBoard();
  b.columns[0] = col([5, H]);
  b.columns[1] = col([6, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), true, "red 5 onto black 6");
  eq(T.columns[0].length, 0, "source emptied");
  eq(T.columns[1].length, 2, "target has two cards");
  eq(T.moves, 1, "move counted");

  b.columns[0] = col([5, H]);
  b.columns[1] = col([6, H]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), false, "red 5 onto red 6 rejected");

  b.columns[0] = col([5, H]);
  b.columns[1] = col([7, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), false, "wrong rank rejected");

  b.columns[0] = col([5, H]);
  b.columns[1] = [];
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), true, "any card to an empty column");
}

// ---------- E. Capacity-limited move ----------
{
  const b = emptyBoard();
  for (let i = 0; i < 8; i++) b.columns[i] = col([13, S]);
  b.columns[0] = col([9, S], [8, H]); // a 2-card sequence
  b.columns[1] = col([10, D]);
  b.free = [C(2, S), C(3, H), C(4, D), C(5, CL)];
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), false, "2-card move blocked with no free cells");

  b.free = [null, C(3, H), C(4, D), C(5, CL)];
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), true, "2-card move allowed with a free cell");
  eq(T.columns[1].length, 3, "both cards moved");
}

// ---------- F. Free cell moves ----------
{
  const b = emptyBoard();
  b.columns[0] = col([7, S], [6, H]);
  T.setState(b);
  T.selectFromColumn(0, 1);
  eq(T.tryMoveToFree(0), true, "top card to a free cell");
  eq(T.free[0].r, 6, "free cell holds the 6");
  eq(T.columns[0].length, 1, "column lost its top card");
  eq(T.stats.freeCellsUsed, 1, "free-cell use counted");

  T.setState(b);
  T.selectFromColumn(0, 0); // not the top card
  eq(T.tryMoveToFree(0), false, "only the top card can move to a free cell");

  b.free[0] = C(2, S);
  T.setState(b);
  T.selectFromColumn(0, 1);
  eq(T.tryMoveToFree(0), false, "occupied free cell rejects the move");
}

// ---------- G. Foundation moves ----------
{
  const b = emptyBoard();
  b.columns[0] = col([1, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToFoundation(0), true, "ace to its foundation");
  eq(T.found[0], 1, "foundation advanced");

  b.columns[0] = col([1, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToFoundation(1), false, "wrong suit rejected");

  b.columns[0] = col([2, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToFoundation(0), false, "must start from the ace");

  b.columns[0] = col([2, S]);
  b.found = [1, 0, 0, 0];
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToFoundation(0), true, "2 follows the ace");
  eq(T.found[0], 2, "foundation advanced to 2");
}

// ---------- H. Win ----------
{
  T.newGame();
  const b = emptyBoard();
  b.columns[0] = col([13, CL]);
  b.found = [13, 13, 13, 12];
  b.moves = 50;
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToFoundation(3), true, "final king placed");
  eq(T.gameOver, true, "game over on win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestMoves, 51, "best moves recorded");
  eq(T.stats.fastWins, 1, "fast win (<=120) counted");
  eq(T.stats.speedWins, 1, "speed win (<=80) counted");
  eq(T.stats.noUndoWins, 1, "no-undo win counted");
  const u = T.unlocked();
  for (const id of ["first", "fast120", "fast80", "noUndo"]) ok(u.includes(id), id + " unlocks");
  eq(u.length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- I. Give up ----------
{
  T.newGame();
  T.setState({ moves: 10 });
  T.giveUp();
  eq(T.gameOver, true, "give up ends the game");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "streak reset");

  // Giving up before any move just re-deals (no stat).
  T.newGame();
  eq(T.moves, 0, "fresh game has no moves");
  T.giveUp();
  eq(T.stats.games, 2, "empty give-up is not counted");
  eq(T.gameOver, false, "empty give-up starts a new deal");
}

// ---------- J. Undo ----------
{
  const b = emptyBoard();
  b.columns[0] = col([5, H]);
  b.columns[1] = col([6, S]);
  T.setState(b);
  T.selectFromColumn(0, 0);
  eq(T.tryMoveToColumn(1), true, "move made");
  eq(T.moves, 1, "one move");
  T.undo();
  eq(T.moves, 0, "undo restored the move count");
  eq(T.columns[0].length, 1, "undo restored the source");
  eq(T.columns[1].length, 1, "undo restored the target");
  eq(T.undoCount, 1, "undo counted");
  eq(T.historyLength, 0, "history popped");
}

// ---------- K. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.totalMoves = 100;
  T.stats.freeCellsUsed = 25;
  T.stats.losses = 10;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win5", "win10", "games10", "games25", "streak2", "streak3", "streak5", "moves100", "free25", "losses10"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- L. Pause ----------
{
  T.setState({ moves: 0, selected: null });
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  keydown("z", { ctrlKey: true });
  eq(T.paused, true, "undo blocked while paused");
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

// ---------- M. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("freecell-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("freecell-sound"), "on", "preference restored");
}

// ---------- N. Badges modal ----------
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