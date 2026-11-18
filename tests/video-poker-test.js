// Deterministic tests for games/video-poker/script.js
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
  "hand", "bankroll", "bet", "target", "message", "action-btn", "new-game", "hint",
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
  eval(fs.readFileSync(root + "games/video-poker/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__VIDEO_POKER;
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

const S = 0, H = 1, D = 2, CL = 3;
const C = (r, s) => ({ r, s });

const royalPreset = [C(10, S), C(11, S), C(12, S), C(13, S), C(14, S), C(2, S), C(3, S), C(4, S), C(5, S), C(6, S)];
const fullHousePreset = [C(8, S), C(8, H), C(8, D), C(3, CL), C(3, S), C(2, S), C(4, S), C(5, S), C(6, S), C(7, S)];
const jacksPreset = [C(11, S), C(11, H), C(2, D), C(5, CL), C(9, S), C(3, H), C(4, H), C(8, CL), C(6, S), C(7, D)];
const nothingPreset = [C(2, S), C(4, H), C(7, D), C(9, CL), C(13, S), C(3, S), C(6, H), C(8, D), C(10, CL), C(12, S)];

function hand(cards) { return cards.slice(); }

// ---------- A. Init ----------
{
  eq(T.bankroll, 100, "starting bankroll");
  eq(T.bet, 5, "fixed bet");
  eq(T.phase, "bet", "starts in the bet phase");
  eq(T.hand.length, 0, "no cards dealt yet");
  eq(T.held.every((x) => x === false), true, "none held");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.games, 0, "no games played");
  eq(storage.has("video-poker-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("hand").children.length, 5, "five card slots rendered");
  eq(elements.get("bankroll").textContent, 100, "bankroll HUD");
  eq(elements.get("bet").textContent, 5, "bet HUD");
  eq(elements.get("target").textContent, 300, "target HUD");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Hand evaluation ----------
{
  const cases = [
    [[C(10, S), C(11, S), C(12, S), C(13, S), C(14, S)], "royal", 250],
    [[C(5, H), C(6, H), C(7, H), C(8, H), C(9, H)], "straight-flush", 60],
    [[C(9, S), C(9, H), C(9, D), C(9, CL), C(2, S)], "four-kind", 30],
    [[C(8, S), C(8, H), C(8, D), C(3, CL), C(3, S)], "full-house", 12],
    [[C(2, S), C(4, S), C(7, S), C(9, S), C(13, S)], "flush", 8],
    [[C(5, S), C(6, H), C(7, D), C(8, CL), C(9, S)], "straight", 6],
    [[C(14, S), C(2, H), C(3, D), C(4, CL), C(5, S)], "straight", 6],
    [[C(7, S), C(7, H), C(7, D), C(2, CL), C(9, S)], "three-kind", 5],
    [[C(7, S), C(7, H), C(2, D), C(2, CL), C(9, S)], "two-pair", 3],
    [[C(11, S), C(11, H), C(2, D), C(5, CL), C(9, S)], "jacks-or-better", 2],
    [[C(13, S), C(13, H), C(2, D), C(5, CL), C(9, S)], "jacks-or-better", 2],
    [[C(10, S), C(10, H), C(2, D), C(5, CL), C(9, S)], "nothing", 0],
    [[C(2, S), C(4, H), C(7, D), C(9, CL), C(13, S)], "nothing", 0],
  ];
  for (const [cards, key, mult] of cases) {
    const r = T.evaluateHand(cards);
    eq(r.key, key, "hand -> " + key);
    eq(r.mult, mult, "multiplier for " + key);
  }
}

// ---------- C. Deal, hold and draw (pair of jacks) ----------
{
  T.newGame();
  T.deal(jacksPreset);
  eq(T.bankroll, 95, "bet deducted");
  eq(T.phase, "hold", "hold phase after dealing");
  eq(T.hand.length, 5, "five cards dealt");
  eq(T.hand[0].r, 11, "first card is a jack");
  eq(T.hand[0].s, S, "first card suit");

  T.toggleHold(0);
  T.toggleHold(1);
  eq(T.held[0] && T.held[1], true, "two jacks held");
  eq(T.held[2], false, "third card not held");

  T.draw();
  eq(T.phase, "result", "result phase after drawing");
  eq(T.hand[0].r, 11, "held jack stayed");
  eq(T.hand[1].r, 11, "held jack stayed");
  eq(T.hand[2].r, 3, "non-held card replaced");
  eq(T.hand[2].s, H, "replacement suit");
  eq(T.lastResult.key, "jacks-or-better", "pair of jacks evaluated");
  eq(T.bankroll, 105, "payout added (95 + 10)");
  eq(T.stats.hands, 1, "hand counted");
  eq(elements.get("action-btn").textContent, "Deal", "action button returns to Deal");
  ok(/Jacks or Better/.test(elements.get("message").textContent), "message names the hand");
}

// ---------- D. Royal flush win ----------
{
  T.newGame();
  T.deal(royalPreset);
  eq(T.bankroll, 95, "bet deducted");
  for (let i = 0; i < 5; i++) T.toggleHold(i);
  T.draw();
  eq(T.bankroll, 1345, "royal pays 1250 on a 5 bet");
  eq(T.gameOver, true, "game over on reaching the target");
  eq(T.overlayTitle(), "Target reached! 🎉", "win overlay shown");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.royals, 1, "royal counted");
  eq(T.stats.biggestWin, 1250, "biggest win recorded");
  eq(T.stats.bestBankroll, 1345, "best bankroll recorded");
  eq(T.stats.hands, 2, "second hand");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  ok(u.includes("royal1"), "Royal badge unlocks");
  ok(u.includes("bigWin100"), "Big Win badge unlocks");
  ok(u.includes("high500"), "High Roller badge unlocks");
  eq(u.length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- E. Nothing hand ----------
{
  T.newGame();
  T.deal(nothingPreset);
  eq(T.bankroll, 95, "bet deducted");
  T.draw();
  eq(T.lastResult.key, "nothing", "no win");
  eq(T.bankroll, 95, "no payout");
  eq(T.phase, "result", "result phase");
  eq(T.stats.hands, 3, "third hand");
  eq(T.gameOver, false, "not over");
}

// ---------- F. Lose ----------
{
  T.newGame();
  T.setState({ phase: "result", bankroll: 3 });
  T.deal();
  eq(T.gameOver, true, "game over when broke");
  eq(T.overlayTitle(), "Out of credits", "loss overlay shown");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "streak reset");
  eq(T.stats.bestBankroll, 1345, "best bankroll preserved");
  T.overlay.hide();
}

// ---------- G. Win with a full house ----------
{
  T.newGame();
  T.setState({ phase: "result", bankroll: 295 });
  T.deal(fullHousePreset);
  eq(T.bankroll, 290, "bet deducted");
  for (let i = 0; i < 5; i++) T.toggleHold(i);
  T.draw();
  eq(T.lastResult.key, "full-house", "full house evaluated");
  eq(T.bankroll, 350, "full house pays 60");
  eq(T.gameOver, true, "target reached");
  eq(T.stats.games, 3, "third game");
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.hands, 4, "fourth hand");
  eq(T.unlocked().length, 4, "still four badges");
  T.overlay.hide();
}

// ---------- H. Three more wins (win5, streak2/3) ----------
{
  for (let i = 0; i < 3; i++) {
    T.newGame();
    T.setState({ phase: "result", bankroll: 295 });
    T.deal(fullHousePreset);
    for (let k = 0; k < 5; k++) T.toggleHold(k);
    T.draw();
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
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
  eq(u.length, 7, "seven badges unlocked");
}

// ---------- I. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.fourKinds = 5;
  T.stats.hands = 100;
  T.stats.losses = 10;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win10", "games10", "games25", "streak5", "fourKind5", "hands100", "losses10"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- J. Pause ----------
{
  T.setState({ phase: "hold", hand: jacksPreset.slice(0, 5), bankroll: 95, bet: 5, held: [false, false, false, false, false] });
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

// ---------- K. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("video-poker-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("video-poker-sound"), "on", "preference restored");
}

// ---------- L. Badges modal ----------
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