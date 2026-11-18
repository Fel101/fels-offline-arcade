// Deterministic tests for games/solitaire/script.js
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
    dataset: {},
    style: {},
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
  "stock", "waste", "foundations", "tableau", "moves", "wins", "streak", "new-game",
  "badges-btn", "badge-count", "sound-btn", "sound-icon", "badges2", "toasts",
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
  querySelector: () => makeEl("div"),
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

// Legacy win counter from the pre-core build.
storage.set("sol-wins", "4");

const root = require("./_env").root;
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/solitaire/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__SOLITAIRE;
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

const FOUNDATION_51 = {
  spades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  hearts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  diamonds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  clubs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
};

// One card short of a win: the king of spades waits on the waste.
function nearWin(moveCount) {
  T.loadState({
    foundation: JSON.parse(JSON.stringify(FOUNDATION_51)),
    waste: [[13, "spades"]],
    moves: moveCount,
  });
  T.handle("waste"); // select
  T.handle("foundation", 0); // spades
}

function winNow(moveCount) {
  nearWin(moveCount);
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.wins, 4, "legacy wins migrated");
  eq(storage.has("sol-wins"), false, "legacy key removed");
  eq(T.stats.games, 1, "the opening deal counts as a game");
  eq(T.stats.moves, 0, "no moves yet");
  eq(T.stats.streak, 0, "no streak yet");
  eq(T.stats.bestStreak, 0, "no best streak yet");
  eq(T.stats.bestMoves, 0, "no winning move count yet");
  eq(T.stats.recycles, 0, "no recycles yet");
  eq(T.stats.draws, 0, "no draws yet");
  eq(elements.get("wins").textContent, 4, "wins HUD");
  eq(elements.get("moves").textContent, 0, "moves HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(T.moves, 0, "in-game move counter");
  eq(T.gameOver, false, "game live");

  const s = T.state;
  eq(s.tableau.length, 7, "seven tableau columns");
  eq(s.tableau.map((c) => c.length).join(","), "1,2,3,4,5,6,7", "tableau stair deal");
  eq(s.stock.length, 24, "twenty-four cards in the stock");
  eq(s.waste.length, 0, "empty waste");
  eq(s.tableau.reduce((a, c) => a + c.length, 0), 28, "twenty-eight tableau cards");
  for (let c = 0; c < 7; c++) {
    const col = s.tableau[c];
    eq(col[col.length - 1].faceUp, true, "column " + c + " top card face up");
    for (let i = 0; i < col.length - 1; i++) eq(col[i].faceUp, false, "column " + c + " card " + i + " face down");
  }
  eq(Object.keys(s.foundation).length, 4, "four foundations");
  eq(elements.get("stock").children.length, 1, "stock renders a card back");
  eq(elements.get("waste").children.length, 0, "empty waste renders no card");
  eq(elements.get("foundations").children.length, 4, "four foundation slots");
  eq(elements.get("tableau").children.length, 7, "seven tableau columns rendered");

  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 1, "First Clear is already earned from legacy wins");
  ok(T.unlocked().includes("first"), "First Clear unlocked");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Drawing and recycling ----------
{
  T.drawStock();
  eq(T.stats.draws, 1, "one draw");
  eq(T.state.stock.length, 23, "stock shrinks");
  eq(T.state.waste.length, 1, "waste grows");
  eq(T.state.waste[0].faceUp, true, "drawn card is face up");
  eq(elements.get("waste").children.length, 1, "waste renders the card");
  eq(T.moves, 0, "drawing is not a move");

  for (let i = 0; i < 23; i++) T.drawStock();
  eq(T.state.stock.length, 0, "stock empty");
  eq(T.state.waste.length, 24, "waste holds 24");
  eq(T.stats.draws, 24, "24 draws");

  T.drawStock();
  eq(T.state.stock.length, 24, "recycle refills the stock");
  eq(T.state.waste.length, 0, "waste empty after recycling");
  eq(T.stats.recycles, 1, "recycle counted");
  eq(T.state.stock.every((c) => c.faceUp === false), true, "recycled cards are face down");

  for (let i = 0; i < 24; i++) T.drawStock();
  T.drawStock();
  eq(T.stats.draws, 48, "48 draws");
  eq(T.stats.recycles, 2, "second recycle counted");
}

// ---------- C. A lone ace goes home on a click ----------
{
  T.loadState({
    waste: [[1, "spades"]],
    tableau: [[[13, "clubs"]]],
    moves: 10,
  });
  T.handle("waste");
  const s = T.state;
  eq(s.foundation.spades.length, 1, "ace auto-moved to its foundation");
  eq(s.foundation.spades[0].rank, 1, "the ace is on the foundation");
  eq(s.waste.length, 0, "waste emptied");
  eq(T.moves, 11, "move counted");
  eq(elements.get("moves").textContent, 11, "moves HUD");
  eq(T.stats.moves, 1, "career move counted");
  eq(elements.get("foundations").children[0].children.length, 1, "foundation renders the ace");
}

// ---------- D. Selecting and moving a stack ----------
{
  T.loadState({
    tableau: [[[13, "spades"]], [[12, "hearts"], [11, "clubs"]]],
    moves: 0,
  });
  T.handle("tableau", 1, 0);
  const sel = T.sel;
  ok(sel && sel.kind === "tableau" && sel.col === 1 && sel.idx === 0, "queen stack selected", sel);
  ok(
    elements.get("tableau").children[1].children[0].classList.contains("sel"),
    "selected card highlighted"
  );
  ok(
    elements.get("tableau").children[0].classList.contains("hl"),
    "legal tableau destination highlighted"
  );

  T.handle("tableau", 0, 0);
  const s = T.state;
  eq(s.tableau[0].length, 3, "both cards moved onto the king");
  eq(s.tableau[0][1].rank, 12, "queen sits on the king");
  eq(s.tableau[0][2].rank, 11, "jack follows the queen");
  eq(s.tableau[1].length, 0, "source column empty");
  eq(T.sel, null, "selection cleared");
  eq(T.moves, 1, "one move");
  eq(T.stats.moves, 2, "career moves");
}

// ---------- E. Building a foundation run ----------
{
  T.loadState({
    foundation: { spades: [1] },
    waste: [[2, "spades"]],
    moves: 0,
  });
  T.handle("waste");
  const s = T.state;
  eq(s.foundation.spades.length, 2, "two of spades follows the ace");
  eq(s.foundation.spades[1].rank, 2, "second card is the two");
  eq(T.stats.moves, 3, "career moves");
}

// ---------- F. First win ----------
{
  winNow(89);
  eq(T.gameOver, true, "clearing the four foundations wins");
  eq(T.moves, 90, "ninety moves");
  eq(T.stats.wins, 5, "win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.bestMoves, 90, "best move count");
  eq(T.stats.games, 1, "a win does not deal a new game");
  eq(T.stats.moves, 4, "career moves");
  eq(elements.get("wins").textContent, 5, "wins HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(T.overlayTitle(), "You cleared it! 🎉", "win overlay");
  ok((T.overlayMsg() || "").indexOf("Solved in 90 moves.") !== -1, "move count in the overlay", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best: 90.") !== -1, "best in the overlay", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Streak 1.") !== -1, "streak in the overlay", T.overlayMsg());
  eq(T.state.foundation.spades.length, 13, "spades complete");
  eq(T.state.foundation.hearts.length, 13, "hearts complete");
  eq(T.state.foundation.diamonds.length, 13, "diamonds complete");
  eq(T.state.foundation.clubs.length, 13, "clubs complete");

  ["first", "win5", "quick150", "quick100"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
  eq(T.unlocked().length, 4, "four badges unlocked");
  eq(elements.get("badge-count").textContent, 4, "header badge count");
}

// ---------- G. A five-win streak ----------
{
  for (let i = 0; i < 4; i++) {
    winNow(50);
    eq(T.gameOver, true, "win " + (i + 2) + " lands");
  }
  eq(T.stats.wins, 9, "nine wins");
  eq(T.stats.streak, 5, "five in a row");
  eq(T.stats.bestStreak, 5, "best streak is 5");
  eq(T.stats.bestMoves, 51, "best move count improves");
  eq(T.stats.moves, 8, "career moves");
  ["streak2", "streak3", "streak5"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
  eq(T.unlocked().length, 7, "seven badges unlocked");
  eq(elements.get("streak").textContent, 5, "streak HUD");
}

// ---------- H. Games, moves, draws and recycles ----------
{
  for (let i = 0; i < 9; i++) T.newGame();
  eq(T.stats.games, 10, "ten games dealt");
  ok(T.unlocked().includes("games10"), "Deal Me In badge unlocks");

  for (let i = 0; i < 15; i++) T.newGame();
  eq(T.stats.games, 25, "twenty-five games dealt");
  ok(T.unlocked().includes("games25"), "Old Hand badge unlocks");
  eq(T.stats.streak, 5, "dealing gap-free games keeps the streak");

  // 1,992 real moves on a lone king (career total 8 -> 2,000).
  T.loadState({ tableau: [[[13, "spades"]]], moves: 0 });
  for (let i = 0; i < 1992; i++) {
    const from = i % 2 === 0 ? 0 : 1;
    const to = i % 2 === 0 ? 1 : 0;
    T.doMove({ kind: "tableau", col: from, idx: 0 }, { kind: "tableau", col: to });
  }
  eq(T.stats.moves, 2000, "two thousand career moves");
  ok(T.unlocked().includes("moves500"), "Busy Hands badge unlocks");
  ok(T.unlocked().includes("moves2000"), "Marathon badge unlocks");

  // Draw up to 500 cards, refilling the stock without recycling.
  const refill = [];
  for (let i = 0; i < 24; i++) refill.push([1, "spades"]);
  while (T.stats.draws < 500) {
    if (T.state.stock.length === 0) T.loadState({ stock: refill });
    T.drawStock();
  }
  eq(T.stats.draws, 500, "five hundred draws");
  ok(T.unlocked().includes("draws500"), "Card Counter badge unlocks");

  for (let i = 0; i < 8; i++) {
    T.loadState({ stock: [], waste: [[1, "spades"]] });
    T.drawStock();
  }
  eq(T.stats.recycles, 10, "ten recycles");
  ok(T.unlocked().includes("recycle10"), "Going Around badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
}

// ---------- I. Tenth win ----------
{
  winNow(40);
  eq(T.stats.wins, 10, "ten wins");
  eq(T.stats.streak, 6, "streak of 6");
  eq(T.stats.bestMoves, 41, "best move count");
  eq(T.stats.moves, 2001, "career moves");
  ok(T.unlocked().includes("win10"), "Grandmaster badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
  eq(elements.get("wins").textContent, 10, "wins HUD");
}

// ---------- J. Pause ----------
{
  T.newGame();
  eq(T.stats.games, 26, "another game dealt");
  T.togglePause();
  eq(T.paused, true, "pause on");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  const draws = T.stats.draws;
  T.handle("stock");
  eq(T.stats.draws, draws, "stock clicks are blocked while paused");
  T.drawStock();
  eq(T.stats.draws, draws, "drawing is blocked while paused");
  T.togglePause();
  eq(T.paused, false, "pause off");
  eq(T.overlayTitle(), null, "pause overlay hidden");

  winEvent("blur");
  eq(T.paused, true, "blur pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");

  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  winNow(30);
  eq(T.gameOver, true, "eleventh win lands");
  eq(T.stats.wins, 11, "eleven wins");
  eq(T.stats.streak, 7, "streak of 7");
  eq(T.stats.bestMoves, 31, "best move count improves again");
  eq(T.stats.moves, 2002, "career moves");
  T.setPaused(true);
  eq(T.paused, false, "a finished game cannot pause");
  eq(T.overlayTitle(), "You cleared it! 🎉", "win overlay survives");
}

// ---------- K. Abandoning a game breaks the streak ----------
{
  T.newGame();
  eq(T.stats.games, 27, "game after the win");
  T.loadState({ tableau: [[[13, "spades"]]], moves: 5 });
  T.newGame();
  eq(T.stats.games, 28, "abandoned game counted");
  eq(T.stats.streak, 0, "abandoning resets the streak");
  eq(T.stats.bestStreak, 7, "best streak is kept");
  eq(elements.get("streak").textContent, 0, "streak HUD");
}

// ---------- L. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("solitaire-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("solitaire-sound"), "on", "preference restored");
}

// ---------- M. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 14, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "streak5", "moves500", "moves2000",
    "games10", "games25", "recycle10", "draws500", "quick150", "quick100",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.wins, 11, "wins");
  eq(T.stats.games, 28, "games");
  eq(T.stats.moves, 2002, "career moves");
  eq(T.stats.streak, 0, "current streak");
  eq(T.stats.bestStreak, 7, "best streak");
  eq(T.stats.bestMoves, 31, "best winning moves");
  eq(T.stats.recycles, 10, "recycles");
  eq(T.stats.draws, 500, "draws");
  ok(storage.has("solitaire-stats-v1"), "stats persisted under the core key");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
