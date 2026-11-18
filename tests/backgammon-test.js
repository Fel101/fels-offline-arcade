// Deterministic tests for games/backgammon/script.js
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
  "row-top", "row-bottom", "bar", "dice-row", "dice", "off-w", "off-b", "tray-w", "tray-b",
  "tray-w-box", "tray-b-box", "roll", "restart", "hint", "mode-cpu", "mode-2p",
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
  eval(fs.readFileSync(root + "games/backgammon/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__BACKGAMMON;
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

T.newGame(false);

// ---------- A. Init ----------
{
  const pts = T.points;
  const w = pts.reduce((s, p) => s + p.w, 0);
  const b = pts.reduce((s, p) => s + p.b, 0);
  eq(w, 15, "White starts with 15 checkers");
  eq(b, 15, "Black starts with 15 checkers");
  eq(T.turn, T.WHITE, "White moves first");
  eq(T.phase, "roll", "starts in the roll phase");
  eq(T.dice.length, 0, "no dice yet");
  eq(elements.get("row-top").children.length, 12, "12 top points rendered");
  eq(elements.get("row-bottom").children.length, 12, "12 bottom points rendered");
  eq(elements.get("bar").children.length, 2, "two bar chips rendered");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(storage.has("backgammon-stats-v1"), true, "stats persisted under the core key");
}

// ---------- B. Roll ----------
{
  T.newGame(false);
  T.setSeed(12345);
  T.roll();
  eq(T.phase, "move", "rolling enters the move phase");
  ok(T.dice.length === 2 || T.dice.length === 4, "two dice, or four on doubles");
  ok(T.dice.every((d) => d >= 1 && d <= 6), "dice values are 1-6");
  if (T.dice.length === 4) {
    eq(T.dice[0], T.dice[1], "doubles produce four equal dice");
  }
}

// ---------- C. Basic movement ----------
{
  T.newGame(false);
  T.setPoints([[10, 1, 0]]);
  T.setBar(0, 0);
  T.setOff(0, 0);
  T.setDice([4]);
  const moves = T.legalMoves(T.WHITE, 4);
  ok(moves.some((m) => m.from === 10 && m.to === 6), "White moves 10 -> 6 with a 4");
  T.applyMove(moves.find((m) => m.from === 10 && m.to === 6));
  eq(T.getP(10, T.WHITE), 0, "checker left point 10");
  eq(T.getP(6, T.WHITE), 1, "checker arrived on point 6");
  eq(T.dice.length, 0, "the die was consumed");
}

// ---------- D. Blocked point ----------
{
  T.newGame(false);
  T.setPoints([[10, 1, 0], [6, 0, 2], [7, 0, 1]]);
  T.setBar(0, 0);
  T.setDice([4]);
  const moves = T.legalMoves(T.WHITE, 4);
  ok(!moves.some((m) => m.to === 6), "cannot land on a point held by two enemy checkers");
}

// ---------- E. Hit a blot ----------
{
  T.newGame(false);
  T.setPoints([[10, 1, 0], [6, 0, 1]]);
  T.setBar(0, 0);
  T.setDice([4]);
  const mv = T.legalMoves(T.WHITE, 4).find((m) => m.to === 6);
  ok(mv && mv.hit, "landing on a blot is a hit");
  T.applyMove(mv);
  eq(T.getP(6, T.BLACK), 0, "the blot was removed");
  eq(T.getP(6, T.WHITE), 1, "White occupies the point");
  eq(T.bar[2], 1, "the hit checker went to the bar");
}

// ---------- F. Bar entry ----------
{
  T.newGame(false);
  T.setPoints([[22, 0, 0]]);
  T.setBar(1, 0);
  T.setDice([3]);
  const moves = T.legalMoves(T.WHITE, 3);
  ok(moves.some((m) => m.from === "bar" && m.to === 22), "White re-enters at 25 - die");

  T.setPoints([[22, 0, 2]]);
  T.setDice([3]);
  ok(!T.legalMoves(T.WHITE, 3).some((m) => m.to === 22), "cannot re-enter on a blocked point");
}

// ---------- G. Bearing off ----------
{
  T.newGame(false);
  T.setPoints([[1, 1, 0], [2, 1, 0], [3, 1, 0]]);
  T.setBar(0, 0);
  T.setDice([1]);
  ok(T.legalMoves(T.WHITE, 1).some((m) => m.from === 1 && m.to === "off"), "a 1 bears off from point 1");

  T.setPoints([[2, 1, 0]]);
  T.setDice([6]);
  ok(T.legalMoves(T.WHITE, 6).some((m) => m.from === 2 && m.to === "off"), "a larger die bears off the highest checker");

  T.setPoints([[2, 1, 0], [5, 1, 0]]);
  T.setDice([6]);
  const moves = T.legalMoves(T.WHITE, 6);
  ok(!moves.some((m) => m.from === 2 && m.to === "off"), "cannot bear off a lower checker while a higher one remains");
  ok(moves.some((m) => m.from === 5 && m.to === "off"), "the higher checker bears off instead");
}

// ---------- H. Doubles ----------
{
  T.newGame(false);
  T.setPoints([[24, 1, 0]]);
  T.setBar(0, 0);
  T.setDice([3, 3, 3, 3]);
  eq(T.uniqueDice().length, 1, "doubles collapse to one face value");
  for (let i = 0; i < 4; i++) {
    const mv = T.legalMoves(T.WHITE, 3)[0];
    T.applyMove(mv);
  }
  eq(T.getP(12, T.WHITE), 1, "four 3s moved the checker from 24 to 12");
  eq(T.dice.length, 0, "all four dice were used");
}

// ---------- I. Win ----------
{
  T.newGame(false);
  T.stats.wins = 0;
  T.stats.games = 0;
  T.setPoints([[1, 1, 0]]);
  T.setBar(0, 0);
  T.setOff(14, 0);
  T.setDice([1]);
  const mv = T.legalMoves(T.WHITE, 1).find((m) => m.to === "off");
  T.applyMove(mv);
  eq(T.gameOver, true, "bearing off the last checker wins");
  eq(T.off[1], 15, "all 15 White checkers are off");
  eq(T.stats.wins, 1, "the win is recorded");
  ok(T.overlayTitle().indexOf("win") >= 0 || T.overlayTitle().indexOf("White") >= 0, "result overlay shown");
  T.newGame(false);
}

// ---------- J. Gammon and backgammon ----------
{
  T.newGame(false);
  T.stats.wins = 0;
  T.stats.gammon = 0;
  T.stats.backgammon = 0;
  // Black has a checker in White's home board -> backgammon.
  T.setPoints([[1, 1, 0], [3, 0, 1]]);
  T.setBar(0, 0);
  T.setOff(14, 0);
  T.setDice([1]);
  T.applyMove(T.legalMoves(T.WHITE, 1).find((m) => m.to === "off"));
  eq(T.stats.backgammon, 1, "a backgammon is recorded");

  T.newGame(false);
  T.stats.gammon = 0;
  T.stats.backgammon = 0;
  // Black has no checker in White's home -> gammon.
  T.setPoints([[1, 1, 0], [20, 0, 1]]);
  T.setBar(0, 0);
  T.setOff(14, 0);
  T.setDice([1]);
  T.applyMove(T.legalMoves(T.WHITE, 1).find((m) => m.to === "off"));
  eq(T.stats.gammon, 1, "a gammon is recorded");
  eq(T.stats.backgammon, 0, "no backgammon this time");
  T.newGame(false);
}

// ---------- K. CPU ----------
{
  T.newGame(false);
  T.setMode("cpu");
  T.setPoints([[10, 1, 0], [5, 0, 2], [8, 0, 1]]);
  T.setBar(0, 0);
  T.setOff(0, 0);
  T.setTurn(T.BLACK);
  T.setDice([3, 5]);
  T.cpuPlayTurn();
  eq(T.turn, T.WHITE, "the turn returns to White after the CPU plays");
  ok(T.dice.length === 0, "the CPU used its dice");
}

// ---------- L. Two-player mode ----------
{
  T.newGame(false);
  T.setMode("2p");
  eq(T.mode, "2p", "mode switched to 2 player");
  const before = JSON.stringify(T.points);
  T.cpuPlayTurn();
  eq(JSON.stringify(T.points), before, "the CPU does not move in 2P mode");
}

// ---------- M. Bar auto-selection ----------
{
  T.newGame(false);
  T.setPoints([[22, 0, 0]]);
  T.setBar(1, 0);
  T.roll();
  eq(T.selected, "bar", "having a checker on the bar auto-selects it");
  T.newGame(false);
}

// ---------- N. Badge thresholds ----------
{
  T.stats.games = 25;
  T.stats.wins = 25;
  T.stats.gammon = 10;
  T.stats.backgammon = 1;
  T.stats.moves = 100;
  T.stats.bestStreak = 5;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "games25", "win1", "win5", "win10", "wins25", "gammon1", "gammon5", "gammon10", "backgammon1", "moves100", "streak3", "streak5"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- O. Pause ----------
{
  T.newGame(false);
  T.setMode("cpu");
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.points);
  T.applyMove({ from: 10, to: 6, die: 4, hit: false });
  eq(JSON.stringify(T.points), before, "board unchanged while paused");
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

// ---------- P. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("backgammon-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
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

// ---------- R. Restart ----------
{
  T.newGame(false);
  T.setPoints([[1, 1, 0]]);
  elements.get("restart").dispatch("click");
  const pts = T.points;
  eq(pts.reduce((s, p) => s + p.w, 0), 15, "restart restores White's 15 checkers");
  eq(pts.reduce((s, p) => s + p.b, 0), 15, "restart restores Black's 15 checkers");
  eq(T.phase, "roll", "restart starts in the roll phase");
}

// ---------- S. Turn-level legality ----------
{
  // Higher die wins when only one of two distinct dice can be played.
  T.setMode("2p");
  T.setPoints([[8, 1, 0], [5, 0, 2], [1, 0, 13]]);
  T.setBar(0, 0);
  T.setOff(14, 0);
  T.setDice([1, 2]);

  const before = JSON.stringify(T.points) + "|" + JSON.stringify(T.stats) + "|" + T.selected;
  const moves = T.legalTurnMoves(T.WHITE);
  eq(JSON.stringify(T.points) + "|" + JSON.stringify(T.stats) + "|" + T.selected, before,
    "exploring continuations does not touch live state, stats or selection");
  ok(moves.some((m) => m.from === 8 && m.to === 6 && m.die === 2), "8->6 with the higher die is offered");
  ok(!moves.some((m) => m.from === 8 && m.to === 7), "8->7 with the lower die is rejected");

  T.onPointClick(8);
  eq(T.selected, 8, "point 8 can be selected");
  T.onPointClick(7);
  eq(T.getP(8, T.WHITE), 1, "the rejected 8->7 leaves the checker at 8");
  eq(T.getP(7, T.WHITE), 0, "the rejected 8->7 places nothing on point 7");
  T.onPointClick(8);
  T.onPointClick(6);
  eq(T.getP(8, T.WHITE), 0, "the accepted 8->6 empties point 8");
  eq(T.getP(6, T.WHITE), 1, "the checker lands on point 6");
}

{
  // A first move must still allow the rest of the turn to be played.
  T.setMode("2p");
  T.setPoints([[8, 1, 0], [12, 1, 0], [5, 0, 2], [10, 0, 2], [1, 0, 11]]);
  T.setBar(0, 0);
  T.setOff(13, 0);
  T.setDice([1, 2]);

  const moves = T.legalTurnMoves(T.WHITE);
  ok(!moves.some((m) => m.from === 8 && m.to === 7), "8->7 is rejected because it wastes the 2");
  ok(moves.some((m) => m.from === 12 && m.to === 11), "12->11 is allowed");
  ok(moves.some((m) => m.from === 8 && m.to === 6), "8->6 is allowed");

  T.onPointClick(12);
  T.onPointClick(11);
  eq(T.getP(11, T.WHITE), 1, "12->11 is accepted through the click path");
  eq(T.dice.join(","), "2", "the 1 die is consumed");
  T.onPointClick(8);
  T.onPointClick(6);
  eq(T.getP(6, T.WHITE), 1, "8->6 follows with the remaining die");
  eq(T.dice.length, 0, "both dice are used");
  eq(T.turn, T.BLACK, "the turn passes when no dice remain");
}

{
  // Doubles may be only partially usable; play as many as the position allows.
  T.setMode("2p");
  T.setPoints([[8, 1, 0], [7, 1, 0], [5, 0, 2], [1, 0, 13]]);
  T.setBar(0, 0);
  T.setOff(13, 0);
  T.setDice([2, 2, 2, 2]);

  const moves = T.legalTurnMoves(T.WHITE);
  ok(moves.length > 0, "a partial doubles position still has a legal first move");
  ok(moves.every((m) => m.die === 2), "doubles only offer the doubled value");
  let guard = 0;
  let plays = 0;
  while (T.turn === T.WHITE && guard++ < 8) {
    const mv = T.legalTurnMoves(T.WHITE)[0];
    if (!mv) break;
    T.onPointClick(mv.from);
    T.onPointClick(mv.to);
    plays++;
  }
  eq(plays, 3, "only three of the four doubles can actually be played");
  eq(T.turn, T.BLACK, "the partial doubles turn ends when no further die can be played");
}

{
  // The CPU is filtered through the very same turn-level legality rules.
  T.setMode("cpu");
  T.setPoints([[17, 0, 1], [13, 0, 1], [20, 2, 0], [15, 2, 0], [24, 11, 0]]);
  T.setBar(0, 0);
  T.setOff(0, 13);
  T.setTurn(T.BLACK);
  T.setDice([1, 2]);

  const legal = T.legalTurnMoves(T.BLACK);
  ok(!legal.some((m) => m.from === 17 && m.to === 18), "the CPU's wasteful 17->18 is rejected");
  ok(legal.some((m) => m.from === 13 && m.to === 14), "the CPU can play 13->14");
  ok(legal.some((m) => m.from === 17 && m.to === 19), "the CPU can play 17->19");
  T.cpuPlayTurn();
  eq(T.dice.length, 0, "the CPU plays both dice");
  eq(T.turn, T.WHITE, "the CPU ends its turn");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);