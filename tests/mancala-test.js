// Deterministic tests for games/mancala/script.js
// The AI is a deterministic negamax search (fixed move ordering, no RNG).
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
  eval(fs.readFileSync(root + "games/mancala/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__MANCALA;
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
function emptyBoard() {
  return new Array(14).fill(0);
}
function boardWith(pairs) {
  const b = emptyBoard();
  for (const [i, v] of pairs) b[i] = v;
  return b;
}

// ---------- A. Init ----------
{
  const b = T.board;
  eq(b.length, 14, "board has 14 slots");
  for (let i = 0; i < 6; i++) eq(b[i], 4, "south pit " + i + " starts with 4");
  for (let i = 7; i < 13; i++) eq(b[i], 4, "north pit " + i + " starts with 4");
  eq(b[6], 0, "south store starts empty");
  eq(b[13], 0, "north store starts empty");
  eq(T.turn, "S", "human (south) moves first");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.diff, "normal", "default difficulty is normal");
  eq(T.stats.games, 0, "no games played");
  eq(T.stats.wins, 0, "no wins");
  eq(storage.has("mancala-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("board").children.length, 3, "two stores and a pits grid rendered");
  eq(elements.get("board").children[1].children.length, 12, "12 pits rendered");
  eq(elements.get("turn").textContent, "Your move", "turn HUD shows your move");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
}

// ---------- B. Sowing rules ----------
{
  // Simple sow from pit 0 (4 stones -> 1,2,3,4).
  {
    const b = T.initialBoard();
    const res = T.applyMove(b, "S", 0);
    eq(b[0], 0, "source pit emptied");
    eq(b[1], 5, "stone dropped in pit 1");
    eq(b[4], 5, "stone dropped in pit 4");
    eq(b[5], 4, "pit 5 untouched");
    eq(res.extra, false, "no extra turn");
    eq(res.captured, 0, "no capture");
    eq(res.gameOver, false, "game continues");
  }

  // Landing in your own store grants another turn.
  {
    const b = boardWith([[5, 1], [0, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1]]);
    const res = T.applyMove(b, "S", 5);
    eq(b[5], 0, "pit 5 emptied");
    eq(b[6], 1, "stone landed in the south store");
    eq(res.extra, true, "extra turn granted");
  }

  // Capturing the opposite pit.
  {
    const b = boardWith([[0, 1], [11, 3]]);
    const res = T.applyMove(b, "S", 0);
    eq(b[1], 0, "landing pit cleared by the capture");
    eq(b[11], 0, "opposite pit cleared by the capture");
    eq(b[6], 4, "captured 1 + 3 stones into the store");
    eq(res.captured, 4, "capture count reported");
  }

  // No capture when the opposite pit is empty.
  {
    const b = boardWith([[0, 1], [7, 1]]);
    const res = T.applyMove(b, "S", 0);
    eq(b[1], 1, "stone stays in the pit");
    eq(res.captured, 0, "no capture");
  }

  // No capture when the landing pit already had stones.
  {
    const b = boardWith([[0, 1], [1, 1], [7, 1]]);
    const res = T.applyMove(b, "S", 0);
    eq(b[1], 2, "second stone added to a non-empty pit");
    eq(res.captured, 0, "no capture from a non-empty landing pit");
  }

  // South skips the north store (13) while sowing (13 stones pass over it).
  {
    const b = boardWith([[5, 13]]);
    T.applyMove(b, "S", 5);
    eq(b[13], 0, "north store skipped");
    ok(b[6] >= 1, "south store was sown at least once", b[6]);
  }

  // North skips the south store (6) while sowing (13 stones pass over it).
  {
    const b = boardWith([[7, 13]]);
    T.applyMove(b, "N", 7);
    eq(b[6], 0, "south store skipped by north");
    ok(b[13] >= 1, "north store was sown at least once", b[13]);
  }
}

// ---------- C. Game over and collection ----------
{
  eq(T.isGameOver(T.initialBoard()), false, "initial board is not over");

  const southGone = boardWith([[7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2]]);
  eq(T.southEmpty(southGone), true, "south pits empty");
  eq(T.isGameOver(southGone), true, "board is over when south is empty");
  T.collectRemaining(southGone);
  eq(southGone[13], 12, "north collected its 12 remaining stones");
  eq(southGone[7], 0, "north pits cleared");

  // A move that empties the human side ends the game and collects.
  const b = boardWith([[5, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1]]);
  const res = T.applyMove(b, "S", 5);
  eq(res.gameOver, true, "emptying your last pit ends the game");
  eq(b[6], 1, "the sowing stone reached the south store");
  eq(b[13], 6, "north's remaining six stones were collected");
  eq(b[7], 0, "north pits cleared after collection");
}

// ---------- D. AI basics ----------
{
  eq(T.legalMoves(T.initialBoard(), "S").join(","), "0,1,2,3,4,5", "south legal moves");
  eq(T.legalMoves(T.initialBoard(), "N").join(","), "7,8,9,10,11,12", "north legal moves");

  for (const diff of ["easy", "normal", "hard"]) {
    const mv = T.chooseAiMove(T.initialBoard(), diff);
    ok(mv >= 7 && mv <= 12, diff + " AI returns a legal north pit", mv);
  }
  // Deterministic.
  eq(T.chooseAiMove(T.initialBoard(), "normal"), T.chooseAiMove(T.initialBoard(), "normal"), "AI is deterministic");

  eq(T.finalScore(boardWith([[6, 10], [13, 4]]), "S"), 6, "final score from the south view");
  eq(T.finalScore(boardWith([[6, 10], [13, 4]]), "N"), -6, "final score from the north view");

  // Forced single move.
  const only = boardWith([[0, 1], [7, 1]]);
  eq(T.chooseAiMove(only, "normal"), 7, "AI picks the only legal move");
}

// ---------- E. Human win ----------
{
  T.setState(boardWith([[6, 20], [13, 5]]), "S");
  T.endGame();
  eq(T.gameOver, true, "game over");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  eq(T.unlocked().length, 1, "one badge unlocked");
  T.overlay.hide();
}

// ---------- F. Shutout win ----------
{
  T.setState(boardWith([[6, 24], [13, 0]]), "S");
  T.endGame();
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.shutouts, 1, "shutout counted");
  ok(T.unlocked().includes("shutout1"), "Shutout badge unlocks");
  ok(T.unlocked().includes("streak2"), "Two in a Row badge unlocks");
  eq(T.unlocked().length, 3, "three badges unlocked");
  T.overlay.hide();
}

// ---------- G. Loss ----------
{
  T.setState(boardWith([[6, 3], [13, 10]]), "S");
  T.endGame();
  eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
  eq(T.stats.games, 3, "third game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.bestStreak, 2, "best streak preserved");
  eq(T.unlocked().length, 3, "no new badges on a loss");
  T.overlay.hide();
}

// ---------- H. Draw ----------
{
  T.setState(boardWith([[6, 7], [13, 7]]), "S");
  T.endGame();
  eq(T.overlayTitle(), "Draw!", "draw overlay shown");
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.draws, 1, "draw counted");
  eq(T.unlocked().length, 3, "draw earns no badge");
  T.overlay.hide();
}

// ---------- I. Three more wins (win5, streak3) ----------
{
  for (let i = 0; i < 3; i++) {
    T.setState(boardWith([[6, 18], [13, 6]]), "S");
    T.endGame();
    T.overlay.hide();
  }
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.games, 7, "seventh game");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 3, "best streak is 3");
  ok(T.unlocked().includes("win5"), "Regular badge unlocks at 5 wins");
  ok(T.unlocked().includes("streak3"), "Hat Trick badge unlocks");
  eq(T.unlocked().length, 5, "five badges unlocked");
}

// ---------- J. Badge thresholds ----------
{
  T.stats.wins = 10;
  T.stats.games = 25;
  T.stats.bestStreak = 5;
  T.stats.captures = 25;
  T.stats.biggestCapture = 10;
  T.stats.totalMoves = 100;
  T.stats.losses = 10;
  T.stats.shutouts = 3;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["win10", "games10", "games25", "streak5", "captures25", "bigCapture", "moves100", "losses10", "shutout3"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- K. Extra-turn flow ----------
{
  // South pit 5 has one stone; sowing it lands in the store and keeps the turn.
  const b = boardWith([[4, 1], [5, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1]]);
  T.setState(b, "S");
  const movesBefore = T.stats.totalMoves;
  T.playPit(5);
  eq(T.board[6], 1, "stone reached the store");
  eq(T.turn, "S", "human keeps the turn after landing in the store");
  eq(T.stats.totalMoves, movesBefore + 1, "move counted");
  eq(T.board[4], 1, "the other south pit is untouched");
}

// ---------- L. Pause ----------
{
  T.setDiff("normal");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const before = JSON.stringify(T.board);
  T.playPit(0);
  eq(JSON.stringify(T.board), before, "board frozen while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");

  T.playPit(0);
  eq(T.turn, "N", "turn passes to the CPU after a normal move");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();

  // Game over suppresses pause.
  T.setState(boardWith([[6, 20], [13, 5]]), "S");
  T.endGame();
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- L2. AI respects pause ----------
{
  T.setState(boardWith([[7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [0, 1]]), "N");
  const before = JSON.stringify(T.board);
  T.setPaused(true);
  eq(T.paused, true, "paused before the AI would move");
  T.aiMove();
  eq(JSON.stringify(T.board), before, "AI does not move while paused");
  eq(T.turn, "N", "turn unchanged while paused");
  T.setPaused(false);
  eq(T.paused, false, "resumed after the pause");
}

// ---------- M. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("mancala-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("mancala-sound"), "on", "preference restored");
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