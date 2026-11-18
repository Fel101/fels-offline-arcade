// Deterministic tests for games/go/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; },
    setPointerCapture() {},
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
  "board", "cap-black", "cap-white", "turn", "pass", "undo", "restart", "hint",
  "mode-cpu", "mode-2p", "badges-btn", "badge-count", "badges2", "sound-btn",
  "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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
  eval(fs.readFileSync(root + "games/go/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__GO;
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

function boardWith(list) {
  const b = Array.from({ length: 9 }, () => new Array(9).fill(0));
  for (const [r, c, v] of list) b[r][c] = v;
  return b;
}

T.newGame(false);

// ---------- A. Init ----------
{
  eq(T.N, 9, "board is 9x9");
  eq(T.KOMI, 5.5, "komi is 5.5");
  eq(T.board.length, 9, "9 rows");
  eq(T.board[0].length, 9, "9 columns");
  eq(T.board.flat().every((v) => v === 0), true, "board starts empty");
  eq(T.current, T.BLACK, "Black moves first");
  eq(T.captures[1], 0, "no captures yet");
  eq(T.gameOver, false, "game in progress");
  eq(elements.get("board").children.length, 81, "81 intersections rendered");
  eq(T.stats.games, 0, "no games finished yet");
  eq(storage.has("go-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Placement ----------
{
  T.newGame(false);
  const res = T.play(4, 4);
  eq(res.ok, true, "placing on an empty point works");
  eq(T.board[4][4], T.BLACK, "Black stone placed");
  eq(T.current, T.WHITE, "turn passes to White");
  eq(T.lastMove.r, 4, "last move row tracked");
  eq(T.lastMove.c, 4, "last move column tracked");

  const occupied = T.play(4, 4);
  eq(occupied.ok, false, "cannot play on an occupied point");
  eq(occupied.reason, "occupied", "reason is occupied");
  eq(T.current, T.WHITE, "turn unchanged after an illegal move");
}

// ---------- C. Capture ----------
{
  T.newGame(false);
  T.setBoard(boardWith([[0, 0, T.WHITE], [0, 1, T.BLACK]]), T.BLACK);
  const res = T.play(1, 0);
  eq(res.ok, true, "the capturing move is legal");
  eq(res.captured, 1, "one stone captured");
  eq(T.board[0][0], 0, "the captured stone is removed");
  eq(T.captures[T.BLACK], 1, "capture counted for Black");
}

// ---------- D. Suicide ----------
{
  T.newGame(false);
  // White stones at (0,1) and (1,0) each have outside liberties.
  T.setBoard(boardWith([[0, 1, T.WHITE], [1, 0, T.WHITE]]), T.BLACK);
  const res = T.play(0, 0);
  eq(res.ok, false, "suicide is rejected");
  eq(res.reason, "suicide", "reason is suicide");
  eq(T.board[0][0], 0, "no stone placed");
}

// ---------- E. Ko ----------
{
  T.newGame(false);
  T.setMode("2p");
  const setup = [
    [0, 1, T.BLACK], [1, 0, T.BLACK], [2, 1, T.BLACK],
    [0, 2, T.WHITE], [1, 1, T.WHITE], [1, 3, T.WHITE], [2, 2, T.WHITE],
  ];
  T.setBoard(boardWith(setup), T.BLACK);

  const cap = T.play(1, 2);
  eq(cap.ok, true, "Black captures the ko stone");
  eq(cap.captured, 1, "one stone captured");
  eq(T.board[1][1], 0, "the white stone is gone");

  const recapture = T.play(1, 1);
  eq(recapture.ok, false, "immediate recapture is forbidden");
  eq(recapture.reason, "ko", "reason is ko");

  // Intervening moves lift the ko ban.
  T.play(0, 0); // White plays elsewhere
  T.play(8, 8); // Black answers
  const later = T.play(1, 1);
  eq(later.ok, true, "the ko recapture is legal after intervening moves");
}

// ---------- F. Scoring ----------
{
  T.newGame(false);
  // Black box around the centre point.
  const box = [];
  for (let c = 0; c < 3; c++) box.push([0, c, T.BLACK]);
  box.push([1, 0, T.BLACK], [2, 0, T.BLACK], [1, 2, T.BLACK], [2, 2, T.BLACK]);
  for (let c = 0; c < 3; c++) box.push([2, c, T.BLACK]);
  T.setBoard(boardWith(box), T.BLACK);
  const s = T.scoreBoard();
  eq(s.black, 9, "Black has 8 stones plus 1 territory point");
  eq(s.white, T.KOMI, "White has only komi");
  eq(s.winner, T.BLACK, "Black wins the position");

  T.newGame(false);
  const empty = T.scoreBoard();
  eq(empty.black, 0, "empty board has no black points");
  eq(empty.white, T.KOMI, "empty board awards White komi");
  eq(empty.winner, T.WHITE, "White wins an empty board");
}

// ---------- G. Pass and game end ----------
{
  T.newGame(false);
  T.pass();
  eq(T.passes, 1, "one pass recorded");
  eq(T.gameOver, false, "one pass does not end the game");
  T.pass();
  eq(T.gameOver, true, "two passes end the game");
  eq(T.stats.games, 1, "the finished game is counted");
  ok(T.overlayTitle().indexOf("wins") >= 0, "result overlay shown");
}

// ---------- H. Undo ----------
{
  T.newGame(false);
  T.setMode("2p");
  T.play(2, 2);
  T.play(6, 6);
  eq(T.board[2][2], T.BLACK, "black stone present");
  eq(T.board[6][6], T.WHITE, "white stone present");
  T.undo();
  eq(T.board[6][6], 0, "undo removed White's stone");
  eq(T.current, T.WHITE, "White to move again");
  T.undo();
  eq(T.board[2][2], 0, "undo removed Black's stone");
  eq(T.current, T.BLACK, "Black to move again");
  eq(T.historyLength, 0, "history empty");
}

// ---------- I. CPU ----------
{
  T.newGame(false);
  T.setMode("cpu");
  T.setPlayer(T.WHITE);
  const before = T.board.flat().filter((v) => v === T.WHITE).length;
  const mv = T.aiMove();
  ok(mv && mv.r >= 0, "the CPU chose a move");
  const after = T.board.flat().filter((v) => v === T.WHITE).length;
  eq(after, before + 1, "the CPU placed a white stone");
  eq(T.current, T.BLACK, "turn returns to Black");
}

// ---------- J. Two-player mode ----------
{
  T.newGame(false);
  T.setMode("2p");
  eq(T.mode, "2p", "mode switched to 2 player");
  T.play(0, 0);
  eq(T.current, T.WHITE, "White to move in 2P mode");
  const res = T.aiMove();
  eq(res, null, "the CPU does not move in 2P mode");
  eq(T.board[0][0], T.BLACK, "only Black's stone is on the board");
}

// ---------- K. Badge thresholds ----------
{
  T.stats.games = 50;
  T.stats.wins = 10;
  T.stats.captures = 100;
  T.stats.bigCapture = 5;
  T.stats.bestMargin = 30;
  T.stats.moves = 100;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "games25", "games50", "win1", "win5", "win10", "cap10", "cap50", "cap100", "bigcap5", "margin10", "margin30", "moves100"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- L. Pause ----------
{
  T.newGame(false);
  T.setMode("cpu");
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.board);
  const res = T.play(4, 4);
  eq(res.ok, false, "cannot play while paused");
  eq(JSON.stringify(T.board), before, "board unchanged while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");

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
  eq(storage.get("go-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
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

// ---------- O. Restart ----------
{
  T.newGame(false);
  T.play(1, 1);
  elements.get("restart").dispatch("click");
  eq(T.board.flat().every((v) => v === 0), true, "restart clears the board");
  eq(T.current, T.BLACK, "Black to move after restart");
  eq(T.captures[1], 0, "captures reset");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);