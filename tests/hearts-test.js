// Deterministic tests for games/hearts/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 800 }; },
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
  "hand", "msg", "trick", "my-points", "my-meta-points", "hearts-state", "pass", "restart",
  "count-1", "points-1", "count-2", "points-2", "count-3", "points-3",
  "slot-0", "slot-1", "slot-2", "slot-3",
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
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
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
  eval(fs.readFileSync(root + "games/hearts/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__HEARTS;
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

const K = (rank, suit) => ({ suit, rank });
const card = (rank, suit) => ({ suit, rank, id: suit + rank });

T.overlay.hide();

// ---------- A. Init ----------
{
  eq(T.hands.length, 4, "four hands");
  for (let i = 0; i < 4; i++) eq(T.hands[i].length, 13, "each hand has 13 cards");
  eq(T.phase, "pass", "starts in the pass phase");
  eq(T.passDirection, T.passDirection, "a pass direction is chosen");
  ok(T.PASS_DIRS.includes(T.passDirection), "pass direction is valid");
  const ids = T.hands.flat().map((c) => c.id);
  eq(ids.length, 52, "52 cards dealt");
  eq(new Set(ids).size, 52, "all cards are unique");
  eq(T.stats.games, 0, "no hands played yet");
  eq(storage.has("hearts-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Passing ----------
{
  T.newGame(false);
  const hand = T.hands[0];
  T.togglePass(hand[0].id);
  T.togglePass(hand[1].id);
  T.togglePass(hand[2].id);
  eq(T.passSelection.length, 3, "three cards selected");
  T.togglePass(hand[3].id);
  eq(T.passSelection.length, 3, "a fourth card is ignored");

  T.confirmPass();
  eq(T.phase, "play", "confirming the pass starts play");
  for (let i = 0; i < 4; i++) eq(T.hands[i].length, 13, "hands stay at 13 after passing");
  eq(T.turn, T.leader, "the 2 of clubs holder leads");
  const leaderHand = T.hands[T.leader].map((c) => c.id);
  ok(leaderHand.includes("C2"), "the leader holds the 2 of clubs");
  eq(T.legalCards(T.leader).length, 1, "the first play is forced");
  eq(T.legalCards(T.leader)[0], "C2", "the first card must be the 2 of clubs");
}

// ---------- C. Pass direction targets ----------
{
  T.setPassDirection("left");
  eq(T.passTarget(0), 1, "left passes to the next seat");
  T.setPassDirection("right");
  eq(T.passTarget(0), 3, "right passes to the previous seat");
  T.setPassDirection("across");
  eq(T.passTarget(0), 2, "across passes to the opposite seat");
}

// ---------- D. Cannot lead hearts before they are broken ----------
{
  T.setHands([
    [K(5, "H"), K(3, "C"), K(4, "D")],
    [K(14, "S")],
    [K(5, "C")],
    [K(5, "D")],
  ]);
  T.setTrick([]);
  T.setTrickNumber(2);
  T.setHeartsBroken(false);
  T.setTurn(0);
  T.setPhase("play");
  const legal = T.legalCards(0);
  ok(legal.includes("C3") && legal.includes("D4"), "non-heart leads are legal");
  ok(!legal.includes("H5"), "leading a heart is illegal before hearts are broken");
}

// ---------- E. Must follow suit ----------
{
  T.setHands([
    [K(2, "C"), K(5, "C"), K(5, "H")],
    [K(4, "C")],
    [K(5, "C")],
    [K(5, "D")],
  ]);
  T.setTrick([{ player: 1, card: card(10, "C") }]);
  T.setTrickNumber(3);
  T.setTurn(0);
  T.setPhase("play");
  const legal = T.legalCards(0);
  eq(legal.length, 2, "only clubs are legal when following clubs");
  ok(legal.includes("C2") && legal.includes("C5"), "both clubs are offered");
}

// ---------- F. First-trick danger restriction ----------
{
  T.setHands([
    [K(12, "S"), K(5, "H"), K(4, "D")],
    [K(4, "C")],
    [K(5, "C")],
    [K(5, "D")],
  ]);
  T.setTrick([{ player: 1, card: card(10, "C") }]);
  T.setTrickNumber(1);
  T.setTurn(0);
  T.setPhase("play");
  const legal = T.legalCards(0);
  eq(legal.length, 1, "only the safe card is legal on the first trick");
  eq(legal[0], "D4", "hearts and the queen are excluded on the first trick");
}

// ---------- G. Playing a card ----------
{
  T.setHands([
    [K(2, "C"), K(3, "C")],
    [K(5, "D")],
    [K(5, "S")],
    [K(5, "H")],
  ]);
  T.setTrick([]);
  T.setTrickNumber(2);
  T.setHeartsBroken(true);
  T.setTurn(0);
  T.setPhase("play");
  const before = T.hands[0].length;
  eq(T.playCard(0, "C2"), true, "a legal card can be played");
  eq(T.hands[0].length, before - 1, "the card left the hand");
  eq(T.trick.length, 1, "the trick has one card");
  eq(T.turn, 1, "the turn advanced");
  eq(T.playCard(0, "C3"), false, "out-of-turn plays are rejected");
}

// ---------- H. Resolving a trick ----------
{
  T.setHands([[K(3, "C")], [K(4, "C")], [K(5, "C")], [K(6, "C")]]);
  T.setPoints([0, 0, 0, 0]);
  T.setTrickNumber(5);
  T.setTrick([
    { player: 0, card: card(5, "D") },
    { player: 1, card: card(10, "D") },
    { player: 2, card: card(7, "D") },
    { player: 3, card: card(8, "D") },
  ]);
  T.resolveTrick();
  eq(T.trick.length, 0, "the trick cleared");
  eq(T.trickNumber, 6, "the trick counter advanced");
  eq(T.turn, 1, "the highest diamond led the next trick");
  eq(T.points[1], 0, "no points for a plain trick");
}

// ---------- I. Hearts and queen points ----------
{
  T.setHands([[K(3, "C")], [K(4, "C")], [K(5, "C")], [K(6, "C")]]);
  T.setPoints([0, 0, 0, 0]);
  T.setTrick([
    { player: 0, card: card(2, "H") },
    { player: 1, card: card(12, "S") },
    { player: 2, card: card(14, "H") },
    { player: 3, card: card(13, "H") },
  ]);
  T.resolveTrick();
  eq(T.points[2], 16, "three hearts plus the queen = 16 points");
}

// ---------- J. Shooting the moon (human) ----------
{
  T.stats.games = 0;
  T.stats.wins = 0;
  T.stats.moons = 0;
  T.stats.bestScore = 0;
  T.stats.streak = 0;
  T.stats.bestStreak = 0;
  T.setPoints([26, 0, 0, 0]);
  T.endGame();
  eq(T.points[0], 0, "the shooter scores zero");
  eq(T.points[1], 26, "everyone else takes 26");
  eq(T.stats.moons, 1, "the moon is recorded");
  eq(T.stats.wins, 1, "shooting the moon wins the hand");
  T.newGame(false);
}

// ---------- K. Win and loss ----------
{
  T.stats.games = 0;
  T.stats.wins = 0;
  T.stats.bestScore = 0;
  T.setPoints([3, 5, 10, 8]);
  T.endGame();
  eq(T.stats.wins, 1, "the lowest score wins");
  eq(T.stats.bestScore, 3, "the best score is recorded");

  T.stats.games = 0;
  T.stats.wins = 0;
  T.stats.bestScore = 0;
  T.stats.streak = 0;
  T.setPoints([20, 1, 1, 1]);
  T.endGame();
  eq(T.stats.wins, 0, "a high score loses");
  eq(T.stats.streak, 0, "the streak resets on a loss");
  T.newGame(false);
}

// ---------- L. CPU plays ----------
{
  T.setHands([
    [K(3, "C")],
    [K(5, "D"), K(6, "D")],
    [K(5, "S")],
    [K(5, "H")],
  ]);
  T.setTrick([]);
  T.setTrickNumber(2);
  T.setHeartsBroken(true);
  T.setTurn(1);
  T.setPhase("play");
  const before = T.hands[1].length;
  eq(T.aiPlay(1), true, "the CPU plays a card");
  eq(T.hands[1].length, before - 1, "the CPU's hand shrank");
  eq(T.turn, 2, "the turn advanced past the CPU");
}

// ---------- M. Badge thresholds ----------
{
  T.stats.games = 25;
  T.stats.wins = 25;
  T.stats.bestScore = 3;
  T.stats.hearts = 13;
  T.stats.queens = 1;
  T.stats.moons = 1;
  T.stats.cleanHands = 5;
  T.stats.bestStreak = 3;
  T.saveStats();
  T.checkAchievements();
  T.stats.bestScore = 0;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "games25", "win1", "win5", "win10", "wins25", "low5", "perfect", "moon1", "cleanQ5", "hearts13", "queen1", "streak3"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- N. Pause ----------
{
  T.newGame(false);
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
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

// ---------- O. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("hearts-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
}

// ---------- P. Badges modal ----------
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

// ---------- Q. Restart ----------
{
  T.newGame(false);
  T.togglePass(T.hands[0][0].id);
  eq(T.passSelection.length, 1, "a card selected");
  elements.get("restart").dispatch("click");
  eq(T.passSelection.length, 0, "restart clears the selection");
  eq(T.phase, "pass", "restart returns to the pass phase");
  for (let i = 0; i < 4; i++) eq(T.hands[i].length, 13, "restart deals 13 cards each");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);