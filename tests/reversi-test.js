// Deterministic tests for games/reversi/script.js
// The AI is a positional negamax; the only RNG is tie-breaking among equal
// moves, pinned to pick the middle one.
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
  "board", "status", "wins", "streak", "counts", "level", "new-game", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("level").value = "3"; // Normal

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
storage.set("othello-wins", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/reversi/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__OTHELLO;
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
const cells = (b) => b.flat().filter(Boolean).length;

// Almost every square black; black plays (0,7), flips the white disc at (0,6)
// and wins 62-1. A white corner at (7,7) keeps the corner badge honest.
function blackWinBoard() {
  const b = emptyBoard();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = "b";
  b[0][6] = "w";
  b[7][7] = "w";
  b[0][7] = null;
  return b;
}
// Mirror: almost every square white; the AI plays (0,7) and wins 62-2.
function whiteWinBoard() {
  const b = emptyBoard();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = "w";
  b[0][6] = "b";
  b[7][7] = "b";
  b[0][7] = null;
  return b;
}
// A full board split 32/32: neither side has a move, so it is a draw.
function drawBoard() {
  const b = emptyBoard();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = (r + c) % 2 ? "b" : "w";
  return b;
}
// Black plays (0,4) and flips three white discs; white can still reply at (7,5).
function flipBoard() {
  const b = emptyBoard();
  b[0][0] = "b";
  b[0][1] = "w"; b[0][2] = "w"; b[0][3] = "w";
  b[7][6] = "b"; b[7][7] = "w";
  return b;
}
function cornersBoard() {
  const b = emptyBoard();
  for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7]]) b[r][c] = "b";
  return b;
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.turn, "b", "black (human) moves first");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.moveCount, 0, "no moves made");
  eq(T.aiDepth, 3, "default AI depth is 3 (Normal)");
  eq(T.diff, "normal", "default difficulty is normal");
  eq(T.stats.wins, 2, "legacy othello-wins migrated");
  eq(T.stats.games, 0, "legacy wins did not invent games");
  eq(T.stats.flips, 0, "no flips yet");
  eq(T.stats.totalMoves, 0, "no moves yet");
  eq(storage.has("othello-wins"), false, "legacy wins key removed");
  eq(storage.has("othello-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 2, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 0, "Streak HUD starts at 0");
  eq(elements.get("counts").textContent, "You 2 · AI 2", "balance starts 2-2");
  eq(elements.get("status").textContent, "Your move", "status shows Your move");
  eq(T.board.length, 8, "8 rows");
  eq(T.board[0].length, 8, "8 columns");
  eq(T.board[3][3], "w", "white on (3,3)");
  eq(T.board[3][4], "b", "black on (3,4)");
  eq(T.board[4][3], "b", "black on (4,3)");
  eq(T.board[4][4], "w", "white on (4,4)");
  eq(cells(T.board), 4, "four discs on the opening board");
  eq(T.countDiscs(T.board, "b"), 2, "two black discs");
  eq(T.countDiscs(T.board, "w"), 2, "two white discs");
  eq(elements.get("board").children.length, 64, "64 cells rendered");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Rules ----------
{
  const moves = T.legalMoves(T.board, "b");
  eq(moves.length, 4, "four opening moves for black");
  const keys = moves.map((m) => m.r + "," + m.c).sort();
  eq(keys.join(" "), "2,3 3,2 4,5 5,4", "the four standard opening squares");
  ok(moves.every((m) => m.flips.length === 1), "each opening move flips exactly one disc");

  const wmoves = T.legalMoves(T.board, "w");
  eq(wmoves.length, 4, "four opening moves for white too");
  eq(wmoves.map((m) => m.r + "," + m.c).sort().join(" "), "2,4 3,5 4,2 5,3", "white's opening squares");

  const b = emptyBoard();
  b[0][0] = "b"; b[0][1] = "w"; b[0][2] = "w";
  T.applyDisc(b, { r: 0, c: 3, flips: [[0, 1], [0, 2]] }, "b");
  eq(b[0][3], "b", "placed disc written");
  eq(b[0][1], "b", "first flanked disc flipped");
  eq(b[0][2], "b", "second flanked disc flipped");

  eq(T.inBounds(0, 0), true, "(0,0) is on the board");
  eq(T.inBounds(-1, 0), false, "negative row is off the board");
  eq(T.inBounds(7, 7), true, "(7,7) is on the board");
  eq(T.inBounds(8, 0), false, "row 8 is off the board");
  eq(T.isCorner(0, 0), true, "(0,0) is a corner");
  eq(T.isCorner(0, 3), false, "(0,3) is not a corner");
  eq(T.countCorners(T.board, "b"), 0, "no corners held at the start");

  // Opening board is balanced: equal weight and equal discs.
  eq(T.evalBoard(T.board, "b"), 0, "opening position evaluates even");
  eq(T.evalBoard(T.board, "w"), 0, "and even for white");

  const copy = T.cloneBoard(T.board);
  copy[3][3] = "b";
  eq(T.board[3][3], "w", "cloneBoard is a deep copy");
}

// ---------- C. AI prefers corners ----------
{
  const b = emptyBoard();
  b[0][1] = "b"; b[0][2] = "w";
  b[7][6] = "b"; b[7][7] = "w";
  T.setState(b, "w");
  const legal = T.legalMoves(b, "w").map((m) => m.r + "," + m.c).sort();
  eq(legal.join(" "), "0,0 7,5", "two candidate moves, one of them a corner");
  const m = T.bestMoveFor("w", 2);
  ok(m && m.r === 0 && m.c === 0, "AI takes the corner", m);
  eq(m.flips.length, 1, "the corner move flips one disc");
}

// ---------- D. Opening move flow ----------
{
  T.newGame();
  eq(T.diff, "normal", "normal difficulty");
  T.click(2, 3);
  eq(T.board[2][3], "b", "disc placed at (2,3)");
  eq(T.board[3][3], "b", "disc at (3,3) flipped to black");
  eq(T.stats.flips, 1, "flip counted");
  eq(T.stats.totalMoves, 1, "career move counted");
  eq(T.moveCount, 1, "game move counted");
  eq(T.turn, "w", "turn passes to the AI");
  eq(T.gameOver, "thinking", "AI is scheduled");
  eq(elements.get("counts").textContent, "You 4 · AI 1", "balance updated");
  eq(elements.get("status").textContent, "AI thinking…", "status shows the AI thinking");

  T.aiGo();
  eq(T.turn, "b", "AI reply returns the turn to you");
  eq(T.gameOver, false, "game continues after the AI move");
  eq(T.stats.totalMoves, 1, "the AI move is not counted as yours");
  eq(T.moveCount, 1, "your move count is unchanged");
}

// ---------- E. Easy win ----------
{
  T.setDiff("easy");
  eq(T.aiDepth, 2, "easy is depth 2");
  eq(T.diff, "easy", "easy difficulty tracked");
  T.setState(blackWinBoard(), "b");
  T.click(0, 7);
  eq(T.gameOver, true, "capturing the last white disc wins");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Fast win in 1 move") !== -1, "fast win mentioned", T.overlayMsg());
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 3, "win counted (2 migrated + 1)");
  eq(T.stats.easyWins, 1, "easy win counted");
  eq(T.stats.fastWins, 1, "fast win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.flips, 2, "second flip counted");
  eq(T.stats.totalMoves, 2, "second move counted");
  eq(elements.get("wins").textContent, 3, "Wins HUD updated");
  eq(elements.get("streak").textContent, 1, "Streak HUD updated");
  eq(elements.get("status").textContent, "You win! 🎉", "status shows the result");
  eq(elements.get("counts").textContent, "You 63 · AI 1", "final balance shown");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  ok(T.unlocked().includes("easy"), "Warm-Up badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
  T.overlay.hide();
}

// ---------- F. Normal win ----------
{
  T.setDiff("normal");
  T.setState(blackWinBoard(), "b");
  T.click(0, 7);
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.wins, 4, "second win");
  eq(T.stats.normalWins, 1, "normal win counted");
  eq(T.stats.fastWins, 2, "second fast win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  const u = T.unlocked();
  ok(u.includes("normal"), "Street Level badge unlocks");
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  eq(u.length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- G. Hard win ----------
{
  T.setDiff("hard");
  eq(T.aiDepth, 4, "hard is depth 4");
  T.setState(blackWinBoard(), "b");
  T.click(0, 7);
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.games, 3, "third game");
  eq(T.stats.wins, 5, "third win");
  eq(T.stats.hardWins, 1, "hard win counted");
  eq(T.stats.fastWins, 3, "third fast win");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 3, "best streak is 3");
  const u = T.unlocked();
  ok(u.includes("hard"), "Hard Mode badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  ok(u.includes("allDiff"), "All Rounder badge unlocks (all difficulties)");
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  eq(u.length, 8, "eight badges unlocked");
  T.overlay.hide();
}

// ---------- H. CPU wins (loss) ----------
{
  T.setDiff("normal");
  T.setState(whiteWinBoard(), "w");
  T.aiGo();
  eq(T.gameOver, true, "AI win ends the game");
  eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.flips, 4, "the AI's flip is not yours");
  eq(T.stats.totalMoves, 4, "the AI's move is not yours");
  eq(T.unlocked().length, 8, "no new badges on a loss");
  T.overlay.hide();
}

// ---------- I. Draw ----------
{
  T.setState(drawBoard(), "b");
  eq(T.legalMoves(T.board, "b").length, 0, "a full 32/32 board has no moves");
  T.endOfGame();
  eq(T.gameOver, true, "game over");
  eq(T.overlayTitle(), "Draw", "draw overlay shown");
  eq(T.stats.games, 5, "fifth game");
  eq(T.stats.draws, 1, "draw counted");
  eq(T.stats.streak, 0, "draw resets the streak");
  eq(T.unlocked().length, 8, "no badge from the draw");
  T.overlay.hide();
}

// ---------- J. Flip grind (Flipper) ----------
{
  for (let i = 0; i < 34; i++) {
    T.setState(flipBoard(), "b");
    T.click(0, 4);
    eq(T.stats.flips, 4 + (i + 1) * 3, "flip " + (i + 1) + ": three discs flipped");
    eq(T.gameOver, "thinking", "flip " + (i + 1) + ": AI still to move");
    eq(T.turn, "w", "flip " + (i + 1) + ": turn passed");
    ok(T.board[0][1] === "b" && T.board[0][2] === "b" && T.board[0][3] === "b",
      "flip " + (i + 1) + ": white discs turned black");
    ok(T.legalMoves(T.board, "w").length > 0, "flip " + (i + 1) + ": AI has a reply");
    if (i < 31) ok(!T.unlocked().includes("flip100"), "flip " + (i + 1) + ": Flipper still locked");
    else ok(T.unlocked().includes("flip100"), "flip " + (i + 1) + ": Flipper unlocked at 100");
  }
  eq(T.stats.flips, 106, "100+ discs flipped in total");
  eq(T.stats.totalMoves, 4 + 34, "34 more moves");
  eq(T.stats.games, 5, "the grind did not finish any games");
  ok(T.unlocked().includes("flip100"), "Flipper badge unlocks");
  eq(T.unlocked().length, 9, "nine badges unlocked");
  eq(elements.get("badge-count").textContent, 9, "header count in sync");
}

// ---------- K. All four corners ----------
{
  T.setState(cornersBoard(), "b");
  eq(T.countCorners(T.board, "b"), 4, "four black corners");
  T.checkAchievements();
  ok(T.unlocked().includes("corners4"), "Cornered badge unlocks");
  eq(T.unlocked().length, 10, "ten badges unlocked");
}

// ---------- L. Seven more wins ----------
{
  T.setDiff("normal");
  for (let i = 0; i < 7; i++) {
    T.setState(blackWinBoard(), "b");
    T.click(0, 7);
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "You win! 🎉", "win " + (i + 1) + " overlay");
    T.overlay.hide();
  }
  eq(T.stats.games, 12, "twelve games");
  eq(T.stats.wins, 12, "twelve wins (legacy plus ten real)");
  eq(T.stats.fastWins, 10, "ten fast wins");
  eq(T.stats.streak, 7, "streak is 7");
  eq(T.stats.bestStreak, 7, "best streak is 7");
  eq(T.stats.flips, 113, "seven more flips");
  eq(T.stats.totalMoves, 45, "seven more moves");
  const u = T.unlocked();
  ok(u.includes("fast5"), "Lightning badge unlocks at 5 fast wins");
  ok(u.includes("win10"), "Champion badge unlocks at 10 wins");
  eq(u.length, 12, "twelve badges unlocked");
}

// ---------- M. Eight losses ----------
{
  for (let i = 0; i < 8; i++) {
    T.setState(whiteWinBoard(), "w");
    T.aiGo();
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
    T.overlay.hide();
  }
  eq(T.stats.losses, 9, "nine losses total");
  eq(T.stats.games, 20, "twenty games total");
  eq(T.stats.streak, 0, "losses reset the streak");
  ok(T.unlocked().includes("games20"), "Dedicated badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
  ok(!T.unlocked().includes("losses10"), "Persistence still locked at 9 losses");
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "easy", "normal", "hard", "allDiff",
    "streak2", "streak3", "flip100", "corners4", "fast5", "games20",
  ];
  ok(u.length === 13 && expected.every((id) => u.includes(id)), "exactly the 13 earned badges are unlocked", u);
  ok(u.indexOf("losses10") === -1, "Persistence is the only locked badge");
  eq(T.stats.games, 20, "games");
  eq(T.stats.wins, 12, "wins");
  eq(T.stats.losses, 9, "losses");
  eq(T.stats.draws, 1, "draws");
  eq(T.stats.easyWins, 1, "easy wins");
  eq(T.stats.normalWins, 8, "normal wins");
  eq(T.stats.hardWins, 1, "hard wins");
  eq(T.stats.fastWins, 10, "fast wins");
  eq(T.stats.bestStreak, 7, "best streak");
  eq(T.stats.flips, 113, "total flips");
  eq(T.stats.totalMoves, 45, "total moves");
}

// ---------- O. Pause ----------
{
  T.newGame();
  T.click(2, 3);
  eq(T.moveCount, 1, "one move before pausing");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.click(4, 5);
  eq(T.moveCount, 1, "moves blocked while paused");
  eq(T.stats.totalMoves, 46, "no career move while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  eq(T.gameOver, "thinking", "the AI is rescheduled on resume");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses (even while the CPU thinks)");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
  eq(T.paused, false, "resumed again");

  // Game over suppresses pause.
  T.setState(blackWinBoard(), "b");
  T.click(0, 7);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- P. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("othello-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("othello-sound"), "on", "preference restored");
}

// ---------- Q. Badges modal ----------
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
