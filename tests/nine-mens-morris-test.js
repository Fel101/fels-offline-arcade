// Deterministic tests for games/nine-mens-morris/script.js
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
  "board-svg", "points", "turn", "turn-line", "wins", "streak", "ai-diff",
  "new-game", "hint", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon",
  "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("ai-diff").value = "normal";

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
  eval(fs.readFileSync(root + "games/nine-mens-morris/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__NINE_MENS_MORRIS;
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

function st(over) { return Object.assign(T.createInitialState(), over || {}); }
function boardWith(pairs) { const b = new Array(24).fill(null); for (const [i, p] of pairs) b[i] = p; return b; }

// ---------- A. Init ----------
{
  const s = T.state;
  eq(s.board.length, 24, "24 points");
  eq(s.board.every((x) => x === null), true, "board starts empty");
  eq(s.hand.B, 9, "human has 9 pieces");
  eq(s.hand.W, 9, "CPU has 9 pieces");
  eq(s.phase, "place", "placing phase");
  eq(s.turn, "B", "human moves first");
  eq(s.pendingRemoval, false, "no pending removal");
  eq(s.winner, null, "no winner");
  eq(elements.get("points").children.length, 24, "24 point buttons rendered");
  ok(elements.get("board-svg").innerHTML.indexOf("<svg") !== -1, "board SVG drawn");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("nine-mens-morris-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Geometry ----------
{
  eq(T.ADJ[0].slice().sort((a, b) => a - b).join(","), "1,7", "point 0 neighbours");
  eq(T.ADJ[1].slice().sort((a, b) => a - b).join(","), "0,2,9", "point 1 neighbours");
  eq(T.ADJ[9].slice().sort((a, b) => a - b).join(","), "1,8,10,17", "point 9 neighbours");
  eq(T.MILLS.length, 16, "16 possible mills");
  eq(T.MILLS.some((m) => m.join(",") === "1,9,17"), true, "top spoke is a mill");
  eq(T.MILLS.some((m) => m.join(",") === "0,1,2"), true, "outer top is a mill");
  eq(T.COORDS.length, 24, "24 coordinates");
}

// ---------- C. Mills ----------
{
  const b = boardWith([[0, "B"], [1, "B"], [2, "B"]]);
  eq(T.formsMill(b, "B", 2), true, "completed mill detected");
  eq(T.formsMill(b, "B", 5), false, "point outside the mill");
  eq(T.formsMill(b, "W", 2), false, "wrong colour");
  eq(T.inAnyMill(b, 1, "B"), true, "middle of a mill");
  eq(T.inAnyMill(b, 0, "B"), true, "end of a mill");
}

// ---------- D. applyMove ----------
{
  const s0 = st({});
  const s1 = T.applyMove(s0, { type: "place", to: 0 });
  eq(s1.board[0], "B", "piece placed");
  eq(s1.hand.B, 8, "hand decremented");
  eq(s1.turn, "W", "turn passes to the CPU");
  eq(s0.board[0], null, "original state untouched");

  // Mill formation keeps the turn.
  const sm = st({ board: boardWith([[0, "B"], [1, "B"], [8, "W"]]), hand: { B: 7, W: 8 }, turn: "B" });
  const sm2 = T.applyMove(sm, { type: "place", to: 2 });
  eq(sm2.pendingRemoval, true, "mill triggers a removal");
  eq(sm2.turn, "B", "miller keeps the turn");
  eq(sm2.hand.B, 6, "hand decremented");

  // Removal.
  const sr = T.applyMove(sm2, { type: "remove", at: 8 });
  eq(sr.board[8], null, "piece removed");
  eq(sr.pendingRemoval, false, "removal resolved");
  eq(sr.turn, "W", "turn passes after removal");

  // Adjacent move.
  const sv = st({ board: boardWith([[0, "B"], [8, "W"], [9, "W"], [10, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  const sv2 = T.applyMove(sv, { type: "move", from: 0, to: 1 });
  eq(sv2.board[0], null, "source emptied");
  eq(sv2.board[1], "B", "destination filled");
  eq(sv2.turn, "W", "turn passes");

  // Illegal (non-adjacent) move.
  const sv3 = T.applyMove(sv, { type: "move", from: 0, to: 20 });
  eq(sv3.board[0], "B", "non-adjacent move rejected");
  eq(sv3.board[20], null, "destination unchanged");

  // Flying with three pieces.
  const sf = st({ board: boardWith([[0, "B"], [1, "B"], [2, "B"], [8, "W"], [9, "W"], [10, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  const sf2 = T.applyMove(sf, { type: "move", from: 0, to: 20 });
  eq(sf2.board[20], "B", "flying move allowed with three pieces");
  eq(T.isLegalStep(sf, "B", 0, 20), true, "flying predicate true");

  const s4 = st({ board: boardWith([[0, "B"], [4, "B"], [8, "W"], [9, "W"], [10, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  eq(T.isLegalStep(s4, "B", 0, 20), false, "no flying with two pieces");
}

// ---------- E. Removable pieces ----------
{
  const s = st({ board: boardWith([[8, "W"], [9, "W"], [10, "W"], [12, "W"]]), turn: "B" });
  eq(T.removable(s).join(","), "12", "mill pieces are protected");
  const s2 = st({ board: boardWith([[8, "W"], [9, "W"], [10, "W"]]), turn: "B" });
  eq(T.removable(s2).slice().sort((a, b) => a - b).join(","), "8,9,10", "all-in-mill -> all removable");
}

// ---------- F. Win by reduction ----------
{
  const s = st({ board: boardWith([[0, "B"], [1, "B"], [4, "B"], [8, "W"], [9, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  const s2 = T.applyMove(s, { type: "move", from: 4, to: 5 });
  eq(s2.winner, "B", "reducing the CPU to two wins");
  eq(s2.phase, "over", "game over");
}

// ---------- G. Win by block ----------
{
  const s = st({ board: boardWith([[7, "B"], [9, "B"], [4, "B"], [11, "B"], [13, "B"], [0, "W"], [1, "W"], [2, "W"], [3, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  eq(T.generateMovesFor(s, "W").length, 0, "CPU is blocked");
  const s2 = T.applyMove(s, { type: "move", from: 13, to: 12 });
  eq(s2.winner, "B", "a blocked CPU loses");
  eq(s2.phase, "over", "game over");
}

// ---------- H. AI ----------
{
  const fresh = T.chooseAiMove(st({}), "normal");
  ok(fresh && fresh.type === "place", "AI returns a placement on a fresh board", fresh);
  ok(fresh && fresh.to >= 0 && fresh.to < 24, "AI placement is a valid point", fresh);

  // Complete a mill.
  const win = st({ board: boardWith([[0, "W"], [1, "W"], [8, "B"], [9, "B"]]), hand: { B: 7, W: 7 }, turn: "W" });
  const m1 = T.chooseAiMove(win, "normal");
  eq(m1 && m1.type, "place", "AI places to complete a mill");
  eq(m1 && m1.to, 2, "AI completes the mill at point 2");

  // Block the human's mill.
  const block = st({ board: boardWith([[0, "B"], [1, "B"], [10, "B"], [8, "W"], [9, "W"]]), hand: { B: 6, W: 7 }, turn: "W" });
  const m2 = T.chooseAiMove(block, "normal");
  eq(m2 && m2.type, "place", "AI places to block");
  eq(m2 && m2.to, 2, "AI blocks the human mill at point 2");
}

// ---------- I. Live interaction ----------
{
  // Placing.
  T.setState(st({}));
  T.onPointClick(0);
  eq(T.board[0], "B", "click placed a piece");
  eq(T.turn, "W", "turn passed to the CPU");
  eq(T.moves, 1, "move counted");

  // Selecting and moving.
  const mv = st({ board: boardWith([[0, "B"], [8, "W"], [9, "W"], [10, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B" });
  T.setState(mv);
  T.onPointClick(0);
  eq(T.selected, 0, "piece selected");
  T.onPointClick(1);
  eq(T.board[0], null, "source emptied");
  eq(T.board[1], "B", "piece moved");

  // Removing after a mill.
  const rm = st({ board: boardWith([[0, "B"], [1, "B"], [2, "B"], [8, "W"], [9, "W"], [10, "W"], [12, "W"]]), hand: { B: 0, W: 0 }, phase: "move", turn: "B", pendingRemoval: true });
  T.setState(rm);
  T.onPointClick(12);
  eq(T.board[12], null, "enemy piece removed");
  eq(T.pendingRemoval, false, "removal resolved");
}

// ---------- J. Stats: win and loss ----------
{
  T.newGame();
  const win = st({ phase: "over", winner: "B" });
  win.moves = 40;
  win.piecesLost = 0;
  T.setState(win);
  T.endGame();
  eq(T.gameOver, true, "game over");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.fastWins, 1, "fast win counted");
  eq(T.stats.flawlessWins, 1, "flawless win counted");
  const u = T.unlocked();
  for (const id of ["first", "fast60", "flawless"]) ok(u.includes(id), id + " unlocks");
  eq(u.length, 3, "three badges unlocked");
  T.overlay.hide();

  T.setState(st({ phase: "over", winner: "W" }));
  T.endGame();
  eq(T.stats.games, 2, "second game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "streak reset");
  eq(T.unlocked().length, 3, "no new badges on a loss");
  T.overlay.hide();

  for (let i = 0; i < 4; i++) {
    const w = st({ phase: "over", winner: "B" });
    w.moves = 100;
    w.piecesLost = 1;
    T.setState(w);
    T.endGame();
    T.overlay.hide();
  }
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.games, 6, "sixth game");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  const u2 = T.unlocked();
  for (const id of ["win5", "streak2", "streak3"]) ok(u2.includes(id), id + " unlocks");
  eq(u2.length, 6, "six badges unlocked");
}

// ---------- K. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.mills = 50;
  T.stats.totalMoves = 100;
  T.stats.losses = 10;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win10", "games10", "games25", "streak5", "mills10", "mills50", "moves100", "losses10"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- L. Pause ----------
{
  T.setState(st({}));
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
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
  eq(storage.get("nine-mens-morris-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("nine-mens-morris-sound"), "on", "preference restored");
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