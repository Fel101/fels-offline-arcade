// Deterministic tests for games/checkers/script.js
// The AI's negamax is deterministic enough (capture-first ordering); the
// only RNG is tie-breaking among equal moves, pinned to pick the middle one.
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
  "board", "status", "wins", "streak", "new-game", "hint",
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
  setTimeout: () => ++timerSeq, // never fires — tests call aiGo() by hand
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

// Legacy save from the pre-core build — must migrate.
storage.set("checkers-wins", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/checkers/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__CHECKERS;
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
  return Array.from({ length: 8 }, () => new Array(8).fill(null));
}
function piece(c, t) { return { t: t || "m", c }; }

// A position where red (5,2) captures black (4,3) into (3,4); black is wiped out.
function captureWinBoard() {
  const b = emptyBoard();
  b[5][2] = piece("r");
  b[4][3] = piece("b");
  return b;
}
function playCaptureWin() {
  T.setState(captureWinBoard(), "r");
  T.click(5, 2);
  T.click(3, 4);
}

// Red (7,0) triple-jumps (6,1),(4,3),(2,5) -> lands on (1,6).
// With no other black man on the board that ends the game as a win.
function tripleJumpWinBoard() {
  const b = emptyBoard();
  b[7][0] = piece("r");
  b[6][1] = piece("b");
  b[4][3] = piece("b");
  b[2][5] = piece("b");
  return b;
}
// Same jump, but the extra black man at (2,7) keeps the game alive so the
// chain accounting can be tested without ending the game.
function tripleJumpBoard() {
  const b = tripleJumpWinBoard();
  b[2][7] = piece("b");
  return b;
}
function playTripleJump() {
  T.click(7, 0);
  T.click(5, 2);
  T.click(3, 4);
  T.click(1, 6);
}
// Red man (1,2) walks to (0,1) and is crowned; black (0,5) keeps the game alive.
function promotionBoard() {
  const b = emptyBoard();
  b[1][2] = piece("r");
  b[0][5] = piece("b");
  return b;
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.turn, "r", "red moves first");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.quiet, 0, "quiet counter starts at 0");
  eq(T.chain, null, "no chain in progress");
  eq(T.moveCount, 0, "no moves made");
  eq(T.stats.wins, 2, "legacy checkers-wins migrated");
  eq(T.stats.bestStreak, 0, "no streak carried over");
  eq(T.stats.captures, 0, "no captures yet");
  eq(T.stats.kings, 0, "no kings yet");
  eq(storage.has("checkers-wins"), false, "legacy wins key removed");
  eq(storage.has("checkers-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 2, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 0, "Streak HUD starts at 0");
  eq(elements.get("status").textContent, "Your move", "status shows Your move");
  eq(T.countPieces(T.board, "r"), 12, "12 red men");
  eq(T.countPieces(T.board, "b"), 12, "12 black men");
  eq(JSON.stringify(T.board[0][1]), JSON.stringify(piece("b")), "black man on the first dark square");
  eq(T.board[0][0], null, "light squares start empty");
  eq(JSON.stringify(T.board[5][0]), JSON.stringify(piece("r")), "red man on the back rows");
  eq(T.board[3][0], null, "middle rows start empty");
  eq(elements.get("board").children.length, 64, "64 cells rendered");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  const startMoves = T.legalMoves(T.board, "r", null);
  eq(startMoves.length, 7, "seven opening moves for red");
  ok(startMoves.every((m) => !m.capture), "no captures available at the start");
}

// ---------- B. Rules ----------
{
  const b = emptyBoard();
  b[5][2] = piece("r");
  b[7][0] = piece("r");
  b[4][1] = piece("b");
  const moves = T.legalMoves(b, "r", null);
  eq(moves.length, 1, "captures are mandatory (quiet moves suppressed)");
  eq(JSON.stringify(moves[0]), JSON.stringify({ fr: 5, fc: 2, tr: 3, tc: 0, capture: true }), "capture detected over (4,1)");

  eq(JSON.stringify(T.dirsFor(piece("r"))), JSON.stringify([[-1, -1], [-1, 1]]), "red men move up");
  eq(JSON.stringify(T.dirsFor(piece("b"))), JSON.stringify([[1, -1], [1, 1]]), "black men move down");
  eq(T.dirsFor(piece("r", "k")).length, 4, "kings move in all four diagonal directions");

  const promo = emptyBoard();
  promo[1][2] = piece("r");
  const promoted = T.applyMove(promo, { fr: 1, fc: 2, tr: 0, tc: 1, capture: false });
  eq(promoted, true, "applyMove reports the promotion");
  eq(promo[0][1].t, "k", "man becomes a king on the far row");
  eq(promo[1][2], null, "origin square emptied");

  const cap = emptyBoard();
  cap[5][2] = piece("r");
  cap[4][3] = piece("b");
  T.applyMove(cap, { fr: 5, fc: 2, tr: 3, tc: 4, capture: true });
  eq(cap[4][3], null, "captured piece removed");
  eq(JSON.stringify(cap[3][4]), JSON.stringify(piece("r")), "jumping piece landed");

  const cont = emptyBoard();
  cont[5][2] = piece("r"); // the piece that just landed
  cont[4][3] = piece("b");
  const more = T.legalMoves(cont, "r", [5, 2]);
  eq(more.length, 1, "continuation only offers further captures");
  eq(more[0].tr, 3, "continuation lands on (3,4)");

  const copy = T.cloneBoard(b);
  copy[5][2].t = "k";
  eq(b[5][2].t, "m", "cloneBoard is a deep copy");
}

// ---------- C. AI ----------
{
  const e = emptyBoard();
  e[5][0] = piece("r");
  e[0][1] = piece("r", "k");
  e[2][3] = piece("b");
  eq(T.evalBoard(e, "r"), 2, "eval counts man=1, king=2 from red's view");
  eq(T.evalBoard(e, "b"), -2, "eval is symmetric for black");

  const cap = emptyBoard();
  cap[2][3] = piece("b");
  cap[3][2] = piece("r");
  cap[7][0] = piece("r");
  T.setState(cap, "b");
  const mv = T.bestMoveFor("b", null);
  ok(mv && mv.capture, "AI takes the available capture", mv);
  eq(mv.fr + "," + mv.fc + ">" + mv.tr + "," + mv.tc, "2,3>4,1", "AI captures toward (4,1)");

  T.aiGo();
  eq(JSON.stringify(T.board[4][1]), JSON.stringify(piece("b")), "AI landed after its capture");
  eq(T.board[3][2], null, "AI removed the captured red man");
  eq(T.turn, "r", "turn returns to the human");
  eq(T.gameOver, false, "game continues after the AI move");

  T.newGame();
  const opening = T.bestMoveFor("b", null);
  ok(opening !== null, "AI has a legal opening move");
  eq(opening.capture, false, "opening move is a quiet one");
}

// ---------- D. Human single-capture win ----------
{
  T.setState(captureWinBoard(), "r");
  T.click(5, 2);
  eq(JSON.stringify(T.selected), JSON.stringify({ r: 5, c: 2 }), "clicking a red man selects it");
  eq(T.targets.length, 1, "one capture target");
  eq(T.targets[0].tr + "," + T.targets[0].tc, "3,4", "capture target is (3,4)");
  T.click(3, 4);
  eq(T.gameOver, true, "capturing the last black man wins");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Fast win in 1 move") !== -1, "fast win mentioned", T.overlayMsg());
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 3, "win counted (2 migrated + 1)");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.captures, 1, "capture counted");
  eq(T.stats.fastWins, 1, "fast win counted");
  eq(T.stats.totalMoves, 1, "one move");
  eq(elements.get("wins").textContent, 3, "Wins HUD updated");
  eq(elements.get("streak").textContent, 1, "Streak HUD updated");
  eq(elements.get("status").textContent, "You win! 🎉", "status shows the result");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  eq(T.unlocked().length, 1, "one badge unlocked");
  T.overlay.hide();
}

// ---------- E. Winning triple jump ----------
{
  T.setState(tripleJumpWinBoard(), "r");
  T.click(7, 0);
  eq(T.targets.length, 1, "one first jump offered");
  T.click(5, 2);
  eq(JSON.stringify(T.chain), JSON.stringify([5, 2]), "multi-jump chain starts");
  eq(elements.get("status").textContent, "Multi-jump — keep jumping!", "chain status shown");
  eq(T.targets.length, 1, "one continuation offered");
  T.click(3, 4);
  eq(JSON.stringify(T.chain), JSON.stringify([3, 4]), "chain continues");
  T.click(1, 6);
  eq(T.chain, null, "chain finished");
  eq(T.gameOver, true, "final jump ends the game");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.wins, 4, "fourth win (three men captured in one move)");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.captures, 4, "triple jump captured three (plus one earlier)");
  eq(T.stats.chains3, 1, "triple jump recorded");
  eq(T.stats.fastWins, 2, "second fast win");
  eq(T.stats.totalMoves, 2, "two completed moves");
  ok(T.unlocked().includes("streak2"), "Two in a Row badge unlocks");
  ok(T.unlocked().includes("chain3"), "Triple Jump badge unlocks");
  eq(T.unlocked().length, 3, "three badges unlocked");
  T.overlay.hide();
}

// ---------- F. Promotion ----------
{
  T.setState(promotionBoard(), "r");
  T.click(1, 2);
  eq(T.targets.length, 2, "two quiet moves offered");
  T.click(0, 1);
  eq(JSON.stringify(T.board[0][1]), JSON.stringify(piece("r", "k")), "man crowned on the far row");
  eq(T.stats.kings, 1, "promotion counted");
  eq(T.stats.totalMoves, 3, "third move");
  eq(T.moveCount, 1, "one move this game");
  ok(T.unlocked().includes("king1"), "Crowned badge unlocks");
  eq(T.unlocked().length, 4, "four badges unlocked");
}

// ---------- G. Two more wins ----------
{
  for (let i = 0; i < 2; i++) {
    playCaptureWin();
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.games, 4, "four games");
  eq(T.stats.wins, 6, "six wins");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  eq(T.stats.captures, 6, "six captures");
  eq(T.stats.fastWins, 4, "four fast wins");
  eq(T.stats.totalMoves, 5, "five moves");
  const u = T.unlocked();
  ok(u.includes("streak3"), "Hat Trick badge unlocks at streak 3");
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  eq(u.length, 6, "six badges unlocked");
}

// ---------- H. Two more wins ----------
{
  for (let i = 0; i < 2; i++) {
    playCaptureWin();
    T.overlay.hide();
  }
  eq(T.stats.wins, 8, "eight wins");
  eq(T.stats.games, 6, "six games");
  eq(T.stats.captures, 8, "eight captures");
  eq(T.stats.fastWins, 6, "six fast wins");
  ok(T.unlocked().includes("fast5"), "Speed Run badge unlocks at 5 fast wins");
  eq(T.unlocked().length, 7, "seven badges unlocked");
}

// ---------- I. Two more wins ----------
{
  for (let i = 0; i < 2; i++) {
    playCaptureWin();
    T.overlay.hide();
  }
  eq(T.stats.wins, 10, "ten wins");
  eq(T.stats.games, 8, "eight games");
  eq(T.stats.captures, 10, "ten captures");
  eq(T.stats.streak, 8, "streak is 8");
  const u = T.unlocked();
  ok(u.includes("win10"), "Champion badge unlocks");
  ok(u.includes("capture10"), "Hunter badge unlocks");
  eq(u.length, 9, "nine badges unlocked");
}

// ---------- J. Four more promotions ----------
{
  for (let i = 0; i < 4; i++) {
    T.setState(promotionBoard(), "r");
    T.click(1, 2);
    T.click(0, 1);
    eq(T.board[0][1].t, "k", "promotion " + (i + 1) + " done");
  }
  eq(T.stats.kings, 5, "five promotions");
  eq(T.stats.totalMoves, 13, "thirteen moves");
  ok(T.unlocked().includes("king5"), "Royalty badge unlocks");
  eq(T.unlocked().length, 10, "ten badges unlocked");
}

// ---------- K. Triple jumps until the capture badge ----------
{
  eq(T.stats.captures, 10, "ten captures before the grind");
  for (let i = 0; i < 14; i++) {
    T.setState(tripleJumpBoard(), "r");
    playTripleJump();
    eq(T.chain, null, "chain " + (i + 1) + " finished");
    eq(T.gameOver, "thinking", "chain " + (i + 1) + " passes the turn");
    eq(T.overlayTitle(), null, "chain " + (i + 1) + " does not end the game");
  }
  eq(T.stats.captures, 52, "10 + 14 x 3 captures");
  eq(T.stats.chains3, 15, "fifteen triple jumps");
  eq(T.stats.totalMoves, 27, "twenty-seven moves");
  eq(T.stats.games, 8, "no games finished by the chains");
  ok(T.unlocked().includes("capture50"), "Sweeper badge unlocks at 50 captures");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
  ok(!T.unlocked().includes("moves100"), "Mover still locked");
}

// ---------- L. Ten losses ----------
{
  const dead = () => {
    const b = emptyBoard();
    b[5][0] = piece("b"); // black is alive; red has no pieces
    return b;
  };
  for (let i = 0; i < 10; i++) {
    T.setState(dead(), "r");
    eq(T.legalMoves(T.board, "r", null).length, 0, "loss " + (i + 1) + ": red has no moves");
    T.endOfGame(false);
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
    T.overlay.hide();
  }
  eq(T.stats.losses, 10, "ten losses");
  eq(T.stats.games, 18, "eighteen games");
  eq(T.stats.streak, 0, "losses reset the streak");
  ok(T.unlocked().includes("losses10"), "Persistence badge unlocks");
  eq(T.unlocked().length, 12, "twelve badges unlocked");
}

// ---------- M. Draw ----------
{
  T.setState(emptyBoard(), "r");
  T.endOfGame(true);
  eq(T.overlayTitle(), "Draw", "draw overlay shown");
  eq(T.stats.draws, 1, "draw counted");
  eq(T.stats.games, 19, "nineteen games");
  eq(T.unlocked().length, 12, "no badges from the draw");
  T.overlay.hide();
}

// ---------- N. Twentieth game (Dedicated) ----------
{
  playCaptureWin();
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.wins, 11, "eleven wins");
  eq(T.stats.games, 20, "twenty games");
  eq(T.stats.streak, 1, "streak rebuilt to 1");
  eq(T.stats.captures, 53, "fifty-three captures");
  eq(T.stats.totalMoves, 28, "twenty-eight moves");
  ok(T.unlocked().includes("games20"), "Dedicated badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
  T.overlay.hide();
}

// ---------- O. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "capture10", "capture50",
    "king1", "king5", "chain3", "fast5", "games20", "losses10",
  ];
  ok(u.length === 13 && expected.every((id) => u.includes(id)), "exactly the 13 earned badges are unlocked", u);
  ok(T.unlocked().indexOf("moves100") === -1, "Mover is still locked");
  eq(T.stats.games, 20, "games");
  eq(T.stats.wins, 11, "wins");
  eq(T.stats.losses, 10, "losses");
  eq(T.stats.draws, 1, "draws");
  eq(T.stats.bestStreak, 8, "best streak");
  eq(T.stats.captures, 53, "captures");
  eq(T.stats.kings, 5, "kings");
  eq(T.stats.chains3, 15, "triple jumps");
  eq(T.stats.fastWins, 9, "fast wins");
  eq(T.stats.totalMoves, 28, "total moves");
}

// ---------- P. Pause ----------
{
  T.newGame();
  T.click(5, 2);
  eq(JSON.stringify(T.selected), JSON.stringify({ r: 5, c: 2 }), "piece selected before pause");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.click(4, 1);
  eq(T.moveCount, 0, "moves blocked while paused");
  eq(T.board[4][1], null, "board untouched while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.click(4, 1);
  eq(T.moveCount, 1, "moves work after resume");
  eq(T.turn, "b", "turn passed to the CPU");
  eq(T.gameOver, "thinking", "CPU is scheduled");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses (even while the CPU thinks)");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
  eq(T.paused, false, "resumed again");

  // Game over suppresses pause
  playCaptureWin();
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- Q. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("checkers-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("checkers-sound"), "on", "preference restored");
}

// ---------- R. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "13 / 14", "modal shows 13 of 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 13, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
