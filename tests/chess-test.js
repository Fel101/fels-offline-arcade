// Deterministic tests for games/chess/script.js
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
    title: "",
    type: "",
    value: "",
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
    querySelector() {
      return makeEl("span");
    },
    querySelectorAll() {
      return [];
    },
    getContext() {
      return { createLinearGradient: () => ({ addColorStop() {} }) };
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
  "board", "status", "wins", "streak", "level", "new-game", "badges-btn",
  "badge-count", "badges2", "sound-btn", "sound-icon", "toasts", "achv-modal",
  "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("level").value = "3";

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

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: () => 1,
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 1;
global.clearInterval = () => {};
global.setTimeout = () => 1;
global.clearTimeout = () => {};
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Win count from the pre-core build.
storage.set("chess-wins", "2");

const root = require("./_env").root;
const dir = root + "games/chess/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const C = global.window.__CHESS;
if (!C) {
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
function has(hay, needle, msg) {
  ok(String(hay || "").indexOf(needle) !== -1, msg, { actual: hay, expected: needle });
}

function keydown(key) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn({ key, target: { tagName: "BODY" }, preventDefault() {} })
  );
}
function winEvent(t) {
  (listeners["win:" + t] || []).forEach((fn) => fn({}));
}
function visibility(hidden) {
  document.hidden = hidden;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
}
const cellAt = (r, c) => elements.get("board").children[r * 8 + c];

// A mate in one: black king a8 (0,0), white queen h7 (1,3), white king c6 (2,2).
// The queen slides to b7 (1,1), protected by the king.
const MATE = {
  pieces: { "0,0": "bk", "1,3": "wq", "2,2": "wk" },
  turn: "w",
  state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
};

// A pawn one step from promotion.
const PROMO = {
  pieces: { "0,7": "bk", "7,4": "wk", "1,0": "wp" },
  turn: "w",
  state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
};

// A free capture: white queen takes a black rook.
const CAPTURE = {
  pieces: { "0,0": "bk", "7,7": "wk", "4,4": "wq", "4,6": "br" },
  turn: "w",
  state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
};

// A quiet pawn step with both kings tucked away.
const QUIET = {
  pieces: { "0,4": "bk", "7,4": "wk", "6,0": "wp" },
  turn: "w",
  state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
};

function mateNow(level) {
  C.setPosition({ pieces: MATE.pieces, turn: "w", state: MATE.state, level: level });
  C.click(1, 3);
  C.click(1, 1);
  return C.stats.wins;
}

// ---------- A. Init, migration, board and badges ----------
{
  eq(C.stats.games, 1, "the opening game is counted");
  eq(C.stats.wins, 2, "legacy wins migrated");
  eq(storage.has("chess-wins"), false, "legacy key removed");
  eq(C.stats.losses, 0, "no losses");
  eq(C.stats.draws, 0, "no draws");
  eq(C.stats.streak, 0, "no streak");
  eq(C.stats.bestStreak, 0, "no best streak");
  eq(C.stats.moves, 0, "no moves");
  eq(C.stats.captures, 0, "no captures");
  eq(C.stats.promotions, 0, "no promotions");
  eq(C.stats.bestMoves, 0, "no best win");
  eq(C.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(C.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(C.turn, "w", "white to move");
  eq(C.gameOver, false, "the game is live");
  eq(C.thinking, false, "not thinking");
  eq(C.paused, false, "not paused");
  eq(C.level, 3, "normal by default");
  eq(C.gameLevel, 3, "the game remembers its level");
  eq(C.movesThisGame, 0, "no moves this game");
  eq(elements.get("board").children.length, 64, "64 squares rendered");
  eq(cellAt(7, 4).textContent, "♔", "white king on e1");
  eq(cellAt(0, 4).textContent, "♚", "black king on e8");
  eq(cellAt(6, 0).textContent, "♙", "white pawn on a2");
  eq(cellAt(1, 0).textContent, "♟", "black pawn on a7");
  eq(cellAt(6, 4).className.indexOf("chess-cell") !== -1, true, "cell class");
  eq(elements.get("wins").textContent, 2, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("status").textContent, "Your move", "status");
  eq(C.unlocked().length, 1, "legacy wins unlock the first badge");
  ok(C.unlocked().includes("first"), "First Mate unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(C.overlayTitle(), null, "no overlay on load");
}

// ---------- B. Selecting, moving and the AI reply ----------
{
  eq(C.click(6, 4), true, "clicking a pawn selects it");
  eq(C.selected.r, 6, "selected row");
  eq(C.selected.c, 4, "selected column");
  eq(C.targets.length, 2, "two pawn moves");
  ok(C.targets.some((t) => t.tr === 5 && t.tc === 4), "one step offered");
  ok(C.targets.some((t) => t.tr === 4 && t.tc === 4), "two steps offered");
  eq(cellAt(6, 4).style.boxShadow.indexOf("inset") !== -1, true, "selected square outlined");

  eq(C.click(4, 4), true, "the pawn moves two squares");
  eq(C.pieceAt(4, 4).t, "p", "the pawn landed");
  eq(C.pieceAt(6, 4), null, "the old square is empty");
  eq(C.turn, "b", "black to move");
  eq(C.thinking, true, "the AI is thinking");
  eq(C.movesThisGame, 1, "one player move");
  eq(C.stats.moves, 1, "one move counted");
  eq(elements.get("status").textContent, "Thinking…", "thinking status");

  eq(C.click(7, 0), false, "input is blocked while the AI thinks");

  eq(C.aiMove(), true, "the AI moves");
  eq(C.turn, "w", "back to white");
  eq(C.thinking, false, "the AI is done");
  eq(C.movesThisGame, 1, "the AI move is not a player move");
  eq(C.stats.moves, 1, "AI moves do not count");
  ok(
    elements.get("status").textContent === "Your move" ||
      elements.get("status").textContent === "Check! Your move",
    "your move prompt",
    elements.get("status").textContent
  );
}

// ---------- C. Pause, blur, visibility and the badges modal ----------
{
  C.click(6, 3);
  C.click(4, 3);
  eq(C.thinking, true, "the AI is thinking again");

  keydown("Escape");
  eq(C.paused, true, "Escape pauses");
  eq(C.overlayTitle(), "Paused", "pause overlay");
  has(C.overlayMsg(), "on hold", "pause message");
  eq(C.aiMove(), false, "the AI is frozen while paused");
  eq(C.click(7, 0), false, "clicks are blocked while paused");

  keydown("p");
  eq(C.paused, false, "P resumes");
  eq(C.overlayTitle(), null, "pause overlay closed");
  eq(C.aiMove(), true, "the AI moves after resuming");
  eq(C.thinking, false, "AI done");

  winEvent("blur");
  eq(C.paused, true, "window blur pauses");
  keydown("Escape");
  eq(C.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(C.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(C.paused, false, "resumed again");

  C.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(C.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "1 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(C.paused, true, "the game stays paused behind the modal");
  keydown("Escape");
  eq(C.paused, false, "and Escape resumes");
}

// ---------- D. A mate in one ----------
{
  C.setPosition({ pieces: MATE.pieces, turn: "w", state: MATE.state, level: 2 });
  eq(C.stats.games, 2, "the position counts as a game");
  eq(C.gameLevel, 2, "easy game");
  eq(C.turn, "w", "white to move");
  eq(C.inCheck("b"), false, "black is not in check to start");
  eq(C.click(1, 3), true, "the queen is selected");
  ok(C.targets.some((t) => t.tr === 1 && t.tc === 1), "the mating square is offered");
  eq(C.click(1, 1), true, "the queen delivers mate");
  eq(C.phase === undefined, true, "no stray phase field");
  eq(C.gameOver, true, "the game ends");
  eq(C.thinking, false, "nothing left to think about");
  eq(C.stats.wins, 3, "win counted");
  eq(C.stats.streak, 1, "streak starts");
  eq(C.stats.bestStreak, 1, "best streak tracks");
  eq(C.stats.easyWins, 1, "easy win recorded");
  eq(C.stats.bestMoves, 1, "a one-move win is the record");
  eq(C.movesThisGame, 1, "one move this game");
  eq(C.stats.moves, 3, "three moves overall now");
  eq(elements.get("wins").textContent, 3, "wins HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(elements.get("status").textContent, "Checkmate — you win! 🎉", "status");
  eq(C.overlayTitle(), "Checkmate! 🎉", "win overlay");
  has(C.overlayMsg(), "Easy", "overlay names the level");
  has(C.overlayMsg(), "1 move", "overlay reports the move count");
  has(C.overlayMsg(), "New best", "the first win is a record");
  ok(C.unlocked().includes("quick40"), "Swift Mate unlocks");
  ok(C.unlocked().includes("quick25"), "Blitz Finish unlocks");
  eq(C.unlocked().length, 4, "first + two quick badges + win3");
  eq(C.click(1, 3), false, "the board is locked after mate");
  eq(C.aiMove(), false, "the AI cannot move after mate");
  eq(C.setPaused(true), false, "a finished game cannot pause");
}

// ---------- E. Win streak and the win badges ----------
{
  mateNow(3);
  eq(C.stats.games, 3, "third game");
  eq(C.stats.wins, 4, "fourth win");
  eq(C.stats.streak, 2, "streak of two");
  ok(C.unlocked().includes("streak2"), "Winning Run unlocks");

  let guard = 0;
  while (C.stats.wins < 10 && guard++ < 20) mateNow(3);
  eq(C.stats.wins, 10, "ten wins");
  eq(C.stats.games, 9, "nine games");
  eq(C.stats.streak, 8, "an eight-win streak");
  eq(C.stats.bestStreak, 8, "best streak of eight");
  eq(C.stats.normalWins, 7, "seven normal wins so far");
  eq(C.stats.hardWins, 0, "no hard wins");
  eq(C.stats.bestMoves, 1, "the best win stays one move");
  ok(C.unlocked().includes("win5"), "Tactician unlocks");
  ok(C.unlocked().includes("win10"), "Chess Master unlocks");
  ok(C.unlocked().includes("streak3"), "Hat Trick unlocks");
  ok(C.unlocked().includes("streak5"), "Unbeaten unlocks");
  eq(C.unlocked().length, 9, "nine badges before games10");
}

// ---------- F. Promotion, games and moves ----------
{
  C.setPosition(PROMO);
  eq(C.stats.games, 10, "tenth game");
  eq(C.click(1, 0), true, "the pawn is selected");
  ok(C.targets.some((t) => t.tr === 0 && t.tc === 0 && t.type === "promo"), "promotion offered");
  eq(C.click(0, 0), true, "the pawn promotes");
  eq(C.pieceAt(0, 0).t, "q", "a queen appears");
  eq(C.pieceAt(0, 0).c, "w", "it is a white queen");
  eq(C.stats.promotions, 1, "promotion counted");
  eq(C.movesThisGame, 1, "one move");
  ok(C.unlocked().includes("games10"), "Ten Boards unlocks");
  ok(C.unlocked().includes("promote1"), "Coronation unlocks");
  eq(C.unlocked().length, 11, "eleven badges");
}

// ---------- G. A loss and a draw break the streak ----------
{
  C.setPosition({
    pieces: { "7,7": "wk", "6,6": "bq", "5,5": "bk" },
    turn: "w",
    state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
  });
  eq(C.stats.games, 11, "eleventh game");
  eq(C.inCheck("w"), true, "white is in check");
  eq(C.endOfGame("w"), "loss", "checkmate is a loss");
  eq(C.stats.losses, 1, "loss counted");
  eq(C.stats.streak, 0, "the streak breaks");
  eq(C.stats.bestStreak, 8, "the best streak survives");
  eq(C.overlayTitle(), "Checkmate 🤖", "loss overlay");
  eq(C.unlocked().length, 11, "no new badges from a loss");

  C.setPosition({
    pieces: { "7,7": "wk", "0,0": "bk" },
    turn: "w",
    state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
  });
  eq(C.stats.games, 12, "twelfth game");
  eq(C.inCheck("w"), false, "white is safe");
  eq(C.endOfGame("w"), "draw", "no check is a draw");
  eq(C.stats.draws, 1, "draw counted");
  eq(C.overlayTitle(), "Stalemate 🤝", "draw overlay");
  eq(C.unlocked().length, 11, "no new badges from a draw");
}

// ---------- H. Captures, games and moves ----------
{
  let guard = 0;
  while (C.stats.captures < 25 && guard++ < 40) {
    C.setPosition(CAPTURE);
    C.click(4, 4);
    C.click(4, 6);
  }
  eq(C.stats.captures, 25, "twenty-five captures");
  eq(C.stats.games, 37, "thirty-seven games");
  eq(C.stats.wins, 10, "wins unchanged by the capture drills");
  ok(C.unlocked().includes("games25"), "Veteran unlocks");
  ok(C.unlocked().includes("captures25"), "Predator unlocks");
  eq(C.unlocked().length, 13, "thirteen badges, moves50 still locked");

  guard = 0;
  let moves;
  do {
    C.setPosition(QUIET);
    C.click(6, 0);
    C.click(5, 0);
    moves = C.stats.moves;
  } while (moves < 50 && guard++ < 40);
  eq(C.stats.moves, 50, "fifty moves");
  eq(C.stats.games, 51, "fifty-one games");
  ok(C.unlocked().includes("moves50"), "Long Game unlocks");
  eq(C.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- I. Badges modal and records ----------
{
  C.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "all 14 shown");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Games <b>51</b>", "games record");
  has(records, "Wins <b>10</b>", "wins record");
  has(records, "Losses <b>1</b>", "losses record");
  has(records, "Draws <b>1</b>", "draws record");
  has(records, "Best streak <b>8</b>", "best streak record");
  has(records, "Moves <b>50</b>", "moves record");
  has(records, "Captures <b>25</b>", "captures record");
  has(records, "Best win <b>1 moves</b>", "best win record");
  C.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  const expected = [
    "first", "win3", "win5", "win10", "games10", "games25",
    "streak2", "streak3", "streak5", "moves50", "captures25",
    "promote1", "quick40", "quick25",
  ];
  const u = C.unlocked();
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badge ids", u);
  ok(storage.has("chess-stats-v1"), "stats persisted");
  ok(storage.has("chess-achv-v1"), "badges persisted");
  eq(storage.has("chess-wins"), false, "legacy key stays removed");
}

// ---------- J. Buttons, levels and sound ----------
{
  const games = C.stats.games;
  elements.get("new-game").dispatch("click");
  eq(C.stats.games, games + 1, "New Game counts a game");
  eq(C.phase === undefined, true, "still no phase field");
  eq(C.turn, "w", "a fresh board");
  eq(cellAt(7, 4).textContent, "♔", "pieces reset");
  eq(C.movesThisGame, 0, "move counter reset");
  eq(C.overlayTitle(), null, "overlay closed");

  eq(C.setLevel(4), 4, "level can be set");
  eq(elements.get("level").value, "4", "the select follows");
  C.newGame();
  eq(C.gameLevel, 4, "the new game remembers the level");
  eq(C.stats.games, games + 2, "another game counted");
  eq(C.setLevel(3), 3, "level restored");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("chess-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("chess-sound"), "on", "preference restored");

  keydown("Escape");
  eq(C.paused, true, "keyboard pause");
  keydown("Escape");
  eq(C.paused, false, "keyboard resume");

  C.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  keydown("Escape");
  eq(C.paused, false, "and resumes the game");
}

// ---------- K. Dead positions end the game as a draw ----------
function deadSpec(pieces, turn) {
  return {
    pieces,
    turn: turn || "w",
    state: { wK: false, wQ: false, bK: false, bQ: false, ep: null },
  };
}

{
  // Material classification is conservative and documented in the game.
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk" }));
  eq(C.isDeadPosition(), true, "king versus king is dead");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,4": "wb" }));
  eq(C.isDeadPosition(), true, "king and bishop versus king is dead");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,4": "wn" }));
  eq(C.isDeadPosition(), true, "king and knight versus king is dead");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,4": "wb", "2,2": "bb" }));
  eq(C.isDeadPosition(), true, "same-colour bishops are dead");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,4": "wb", "2,3": "bb" }));
  eq(C.isDeadPosition(), false, "opposite-colour bishops stay active");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "5,1": "wn", "4,4": "wn" }));
  eq(C.isDeadPosition(), false, "king and two knights stay active");
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,4": "wr" }));
  eq(C.isDeadPosition(), false, "a rook keeps the position alive");
}

{
  // The human captures the last piece, leaving king and knight.
  C.setPosition(deadSpec({ "7,0": "wk", "0,7": "bk", "4,3": "wn", "2,4": "br" }));
  const draws0 = C.stats.draws;
  const cap = C.legalMoves("w").find((m) => m.fr === 4 && m.fc === 3 && m.tr === 2 && m.tc === 4);
  ok(cap, "the knight can capture Black's last piece");
  eq(C.click(4, 3), true, "the knight is selected");
  eq(C.click(2, 4), true, "the capture is played");
  eq(C.pieceAt(2, 4).t, "n", "only the knight remains");
  eq(C.gameOver, true, "the game ends on the human's capture");
  eq(C.stats.draws, draws0 + 1, "exactly one draw is recorded");
  eq(C.overlayTitle(), "Dead position 🤝", "the dead-position overlay is shown");
  eq(C.snap().status, "Dead position — draw", "the status names the dead position");
  eq(C.click(7, 0), false, "the board is locked after the draw");
}

{
  // The CPU captures the last piece, leaving bare kings. The white king
  // guards every flight square, so capturing its knight is Black's only move.
  C.setPosition(deadSpec({ "2,1": "wk", "0,0": "bk", "0,1": "wn" }, "b"));
  const draws1 = C.stats.draws;
  const forced = C.legalMoves("b");
  eq(forced.length, 1, "the CPU has exactly one legal move");
  eq(forced[0].tr, 0, "that move is the capture's row");
  eq(forced[0].tc, 1, "that move is the capture's column");
  eq(C.gameOver, false, "the game is still live before the CPU move");
  eq(C.aiMove(), "draw", "the CPU's forced capture ends the game in a draw");
  eq(C.pieceAt(0, 1).c, "b", "the CPU captured the last white piece");
  eq(C.gameOver, true, "the game ends on the CPU's capture");
  eq(C.stats.draws, draws1 + 1, "one draw is recorded for the CPU capture");
  eq(C.overlayTitle(), "Dead position 🤝", "the CPU capture shows the dead-position draw");
}

{
  // A position that could still produce mate must keep playing.
  C.setPosition(deadSpec({ "7,0": "wk", "5,1": "wn", "4,4": "wn", "0,7": "bk" }));
  const draws2 = C.stats.draws;
  ok(C.legalMoves("w").length > 0, "White still has moves with two knights");
  const mv = C.legalMoves("w")[0];
  C.click(mv.fr, mv.fc);
  C.click(mv.tr, mv.tc);
  eq(C.gameOver, false, "two knights versus king does not end the game");
  eq(C.stats.draws, draws2, "no draw is recorded for an active position");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
