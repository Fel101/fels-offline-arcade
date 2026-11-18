// Deterministic tests for games/farkle/script.js
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
  "dice", "total", "turn-score", "turn-num", "selection", "roll-btn", "bank-btn",
  "new-game", "hint", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon",
  "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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
  eval(fs.readFileSync(root + "games/farkle/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__FARKLE;
if (!T) { console.error("No test hook"); process.exit(1); }

let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}
function eq(a, b, msg) { ok(a === b, msg, { actual: a, expected: b }); }

function keydown(key) {
  (listeners["keydown"] || []).forEach((fn) => fn({ key, target: { tagName: "BODY" }, preventDefault() {} }));
}
function winEvent(t) { (listeners["win:" + t] || []).forEach((fn) => fn({})); }

// Map a die face value to an RNG float that rollDie() turns back into it.
function rv(v) { return (v - 0.5) / 6; }
function seq(vals) {
  let i = 0;
  return () => (i < vals.length ? rv(vals[i++]) : 0.5);
}
const F = [false, false, false, false, false, false];

// ---------- A. Init ----------
{
  eq(T.dice.length, 6, "six dice");
  eq(T.held.every((x) => x === false), true, "none held");
  eq(T.setAside.every((x) => x === false), true, "none set aside");
  eq(T.turnScore, 0, "turn score starts at 0");
  eq(T.totalScore, 0, "total starts at 0");
  eq(T.turn, 1, "starts on turn 1");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("farkle-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("dice").children.length, 6, "6 die buttons rendered");
  eq(elements.get("turn-num").textContent, "1 / 10", "turn counter shown");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Scoring ----------
{
  const cases = [
    [[1], 100], [[5], 50], [[1, 5], 150],
    [[1, 1, 1], 1000], [[2, 2, 2], 200], [[3, 3, 3], 300], [[6, 6, 6], 600],
    [[1, 1, 1, 1], 2000], [[2, 2, 2, 2], 2000],
    [[1, 1, 1, 1, 1], 3000], [[2, 2, 2, 2, 2], 3000],
    [[1, 1, 1, 1, 1, 1], 4000],
    [[1, 1, 1, 5], 1050],
    [[1, 1, 1, 2, 2, 2], 1200],
    [[1, 1, 1, 1, 1, 5], 3050],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[1, 1, 2, 2, 3, 3], 1500],
  ];
  for (const [vals, expected] of cases) {
    const r = T.scoreSelection(vals);
    eq(r.valid, true, "valid: " + vals.join(","));
    eq(r.score, expected, "score for " + vals.join(","));
  }
  for (const vals of [[2], [1, 2], [2, 2], [3, 4], [2, 2, 2, 3]]) {
    const r = T.scoreSelection(vals);
    eq(r.valid, false, "invalid: " + vals.join(","));
    eq(r.score, 0, "invalid scores 0: " + vals.join(","));
  }
  eq(T.scoreSelection([]).valid, false, "empty selection is invalid");
}

// ---------- C. hasScore ----------
{
  eq(T.hasScore([1, 2, 3, 4, 5, 6]), true, "straight scores");
  eq(T.hasScore([2, 2, 3, 3, 4, 4]), true, "three pairs score");
  eq(T.hasScore([2, 2, 2, 4]), true, "three of a kind scores");
  eq(T.hasScore([1, 2, 3, 4]), true, "contains a 1");
  eq(T.hasScore([2, 3, 4, 6]), false, "no scoring dice");
  eq(T.hasScore([2, 2, 3, 3, 4, 6]), false, "two pairs is not enough");
  eq(T.hasScore([2, 3, 4, 6, 2, 3]), false, "scattered dice do not score");
}

// ---------- D. Button states & selection text ----------
{
  T.setState({ dice: [1, 5, 2, 3, 4, 6], turnScore: 0, totalScore: 0, turn: 1 });
  eq(elements.get("roll-btn").disabled, true, "roll disabled with no selection");
  eq(elements.get("bank-btn").disabled, true, "bank disabled with nothing to bank");
  T.toggleHold(0);
  eq(T.held[0], true, "die held");
  eq(elements.get("roll-btn").disabled, false, "roll enabled with a scoring selection");
  eq(elements.get("bank-btn").disabled, false, "bank enabled with a scoring selection");
  eq(elements.get("selection").textContent, "Keep: 100 points", "selection shows the score");

  // Banking nothing is a no-op.
  const totalBefore = T.totalScore;
  const turnBefore = T.turn;
  T.setState({ dice: [2, 3, 4, 6, 2, 3], turnScore: 0, totalScore: totalBefore, turn: turnBefore });
  T.bank();
  eq(T.totalScore, totalBefore, "banking with nothing does not change the total");
  eq(T.turn, turnBefore, "banking with nothing does not end the turn");
}

// ---------- E. Bank a scoring die ----------
{
  T.setState({ dice: [1, 5, 2, 3, 4, 6], turnScore: 0, totalScore: 0, turn: 1 });
  T.setRng(seq([1, 5, 2, 3, 4, 6])); // the next turn's opening roll
  T.toggleHold(0);
  T.bank();
  eq(T.totalScore, 100, "100 banked");
  eq(T.turn, 2, "turn advanced");
  eq(T.turnScore, 0, "turn score reset");
  eq(T.stats.totalRolls, 2, "opening roll counted (init + this turn)");
}

// ---------- F. Roll and farkle ----------
{
  T.setState({ dice: [1, 5, 2, 3, 4, 6], held: [true, false, false, false, false, false], turnScore: 0, totalScore: 100, turn: 2 });
  T.setRng(seq([2, 3, 4, 6, 2])); // re-roll produces no scoring dice
  const farklesBefore = T.stats.farkles;
  T.roll();
  eq(T.stats.farkles, farklesBefore + 1, "farkle counted");
  eq(T.turnScore, 0, "turn score lost on farkle");
  eq(T.turn, 3, "turn advanced after the farkle");
}

// ---------- G. Hot dice ----------
{
  T.setState({ dice: [1, 1, 1, 1, 1, 1], held: [true, true, true, true, true, true], turnScore: 0, totalScore: 100, turn: 3 });
  T.setRng(seq([1, 5, 2, 3, 4, 6]));
  const hotBefore = T.stats.hotDice;
  T.roll();
  eq(T.stats.hotDice, hotBefore + 1, "hot dice counted");
  eq(T.turnScore, 4000, "six 1s are worth 4000");
  eq(T.setAside.every((x) => x === false), true, "set-aside reset for hot dice");
  eq(T.dice.join(","), "1,5,2,3,4,6", "all six dice re-rolled");
}

// ---------- H. Win ----------
{
  T.setState({ dice: [1, 5, 2, 3, 4, 6], turnScore: 0, totalScore: 2900, turn: 5 });
  T.setRng(seq([1, 5, 2, 3, 4, 6]));
  T.toggleHold(0);
  T.bank();
  eq(T.gameOver, true, "game over on win");
  eq(T.overlayTitle(), "Target reached! 🎉", "win overlay shown");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestScore, 3000, "best score recorded");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  T.overlay.hide();
}

// ---------- I. Lose ----------
{
  T.setState({ dice: [1, 5, 2, 3, 4, 6], turnScore: 0, totalScore: 100, turn: 10 });
  T.setRng(seq([1, 5, 2, 3, 4, 6]));
  T.toggleHold(0);
  T.bank();
  eq(T.gameOver, true, "game over on loss");
  eq(T.overlayTitle(), "Out of turns", "loss overlay shown");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "streak reset");
  eq(T.stats.bestScore, 3000, "best score preserved");
  T.overlay.hide();
}

// ---------- J. Four more wins (win5, streak2/3) ----------
{
  for (let i = 0; i < 4; i++) {
    T.setState({ dice: [1, 5, 2, 3, 4, 6], turnScore: 0, totalScore: 2900, turn: 5 });
    T.setRng(seq([1, 5, 2, 3, 4, 6]));
    T.toggleHold(0);
    T.bank();
    T.overlay.hide();
  }
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.games, 6, "sixth game");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
}

// ---------- K. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.bestScore = 10000;
  T.stats.hotDice = 5;
  T.stats.farkles = 10;
  T.stats.totalRolls = 100;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win10", "games10", "games25", "streak5", "score5k", "score10k", "hot5", "farkle10", "rolls100"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- L. Pause ----------
{
  T.setRng(seq([1, 5, 2, 3, 4, 6]));
  T.newGame();
  eq(T.gameOver, false, "new game clears game over");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const heldBefore = JSON.stringify(T.held);
  T.toggleHold(0);
  eq(JSON.stringify(T.held), heldBefore, "holding blocked while paused");
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
  eq(storage.get("farkle-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("farkle-sound"), "on", "preference restored");
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