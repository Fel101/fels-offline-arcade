// Deterministic tests for games/four-in-a-row/script.js
// The AI is fully deterministic (center-first column order, no RNG), so the
// minimax behaviour can be asserted exactly on hand-built positions.
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
elements.get("ai-diff").value = "6"; // Medium

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
  eval(fs.readFileSync(root + "games/four-in-a-row/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__CONNECT4;
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
function emptyGrid() {
  return Array.from({ length: T.ROWS }, () => new Array(T.COLS).fill(""));
}
function bottomRow(cols, p) {
  const g = emptyGrid();
  cols.forEach((c) => { g[5][c] = p; });
  return g;
}

// ---------- A. Init ----------
{
  eq(T.grid.length, 6, "6 rows");
  eq(T.grid[0].length, 7, "7 columns");
  eq(T.grid.flat().every((c) => c === ""), true, "grid starts empty");
  eq(T.turn, "R", "human moves first");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.aiDepth, 6, "default AI depth is 6 (Medium)");
  eq(T.diff, "normal", "default difficulty is normal");
  eq(T.moveCount, 0, "no human drops yet");
  eq(T.stats.games, 0, "no games played");
  eq(T.stats.wins, 0, "no wins");
  eq(T.stats.totalMoves, 0, "no drops");
  eq(storage.has("connect-four-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("board").children.length, 42, "42 cells rendered");
  eq(elements.get("turn").textContent, "You", "turn HUD shows You");
  eq(elements.get("wins").textContent, 0, "wins HUD starts at 0");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Drop mechanics ----------
{
  const g = emptyGrid();
  eq(T.drop(g, 0, "R"), 5, "first disc lands on the bottom row");
  eq(T.drop(g, 0, "Y"), 4, "next disc stacks above it");
  eq(T.drop(g, 0, "R"), 3, "third disc stacks again");
  eq(g[5][0], "R", "bottom disc is red");
  eq(g[4][0], "Y", "middle disc is yellow");
  eq(g[3][0], "R", "top disc is red");

  eq(T.full(emptyGrid()), false, "empty board is not full");
  const fullBoard = emptyGrid();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) fullBoard[r][c] = (r + c) % 2 ? "R" : "Y";
  eq(T.full(fullBoard), true, "filled board is full");

  // Column legality runs off the live grid.
  T.setState(emptyGrid(), "R");
  eq(T.valid(0), true, "empty column is playable");
  T.playColumn(0);
  eq(T.moveCount, 1, "human drop counted");
  eq(T.grid[5][0], "R", "disc landed");
  eq(T.turn, "Y", "turn passes to the CPU");
  eq(T.stats.totalMoves, 1, "career drop counted");

  T.playColumn(1);
  eq(T.moveCount, 1, "human cannot move while the CPU is to move");
  eq(T.grid[5][1], "", "blocked click left the board untouched");

  const stacked = emptyGrid();
  for (let r = 0; r < 6; r++) stacked[r][0] = "R";
  T.setState(stacked, "R");
  T.playColumn(0);
  eq(T.moveCount, 0, "a full column rejects the drop");
  eq(T.grid[0][0], "R", "stack unchanged");
}

// ---------- C. Win detection ----------
{
  const h = bottomRow([0, 1, 2, 3], "R");
  eq(T.won(h, "R"), true, "horizontal four wins");
  eq(T.won(h, "Y"), false, "no false positive for the other colour");
  eq(T.won(bottomRow([0, 1, 2], "R"), "R"), false, "three in a row does not win");

  const v = emptyGrid();
  for (let r = 2; r <= 5; r++) v[r][6] = "Y";
  eq(T.won(v, "Y"), true, "vertical four wins");

  const d1 = emptyGrid();
  d1[5][0] = "R"; d1[4][1] = "R"; d1[3][2] = "R"; d1[2][3] = "R";
  eq(T.won(d1, "R"), true, "down-right diagonal wins");

  const d2 = emptyGrid();
  d2[5][3] = "Y"; d2[4][2] = "Y"; d2[3][1] = "Y"; d2[2][0] = "Y";
  eq(T.won(d2, "Y"), true, "down-left diagonal wins");

  eq(T.getWinner(bottomRow([0, 1, 2, 3], "R")), "R", "getWinner finds the human win");
  eq(T.getWinner(bottomRow([0, 1, 2, 3], "Y")), "Y", "getWinner finds the CPU win");
  eq(T.getWinner(emptyGrid()), null, "no winner on an empty board");

  eq(T.evaluate(emptyGrid()), 0, "empty board evaluates to 0");
  const aiCenter = emptyGrid();
  aiCenter[5][3] = "Y";
  ok(T.evaluate(aiCenter) > 0, "a CPU centre disc scores positive", T.evaluate(aiCenter));
  const huCenter = emptyGrid();
  huCenter[5][3] = "R";
  ok(T.evaluate(huCenter) < 0, "a human centre disc scores negative", T.evaluate(huCenter));
}

// ---------- D. AI behaviour ----------
{
  const best1 = T.chooseAiColumn(emptyGrid(), 2);
  eq(best1, 3, "on an empty board the AI prefers the centre column");

  // CPU has three along the bottom at 0,1,2 -> must complete at 3.
  const winNow = bottomRow([0, 1, 2], "Y");
  eq(T.chooseAiColumn(winNow, 4), 3, "AI takes the immediate winning column");

  // CPU three at 4,5,6 -> completes at 3.
  const winNow2 = bottomRow([4, 5, 6], "Y");
  eq(T.chooseAiColumn(winNow2, 4), 3, "AI completes the other side too");

  // Human threatens at 0,1,2 -> AI must block at 3.
  const blockNow = bottomRow([0, 1, 2], "R");
  eq(T.chooseAiColumn(blockNow, 4), 3, "AI blocks a horizontal threat");

  // Human vertical threat in col 0 -> AI must block there.
  const blockVert = emptyGrid();
  blockVert[5][0] = "R"; blockVert[4][0] = "R"; blockVert[3][0] = "R";
  eq(T.chooseAiColumn(blockVert, 4), 0, "AI blocks a vertical threat");

  // Perfect play is visible through minimax: a forced win scores hugely positive.
  const winScore = T.minimax(bottomRow([0, 1, 2], "Y"), 2, -Infinity, Infinity, true);
  ok(winScore > 10000, "minimax grades a forced CPU win as huge", winScore);
}

// ---------- E. Human win on Easy ----------
{
  T.setDiff("easy");
  eq(T.aiDepth, 4, "easy is depth 4");
  eq(T.diff, "easy", "easy difficulty tracked");
  T.setState(bottomRow([0, 1, 2], "R"), "R");
  T.playColumn(3);
  eq(T.gameOver, true, "win ends the game");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Fast finish") !== -1, "fast win is called out", T.overlayMsg());
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.easyWins, 1, "easy win counted");
  eq(T.stats.fastWins, 1, "fast win counted");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.totalMoves, 2, "one disc dropped here + one from section B");
  eq(elements.get("wins").textContent, 1, "wins HUD updated");
  eq(elements.get("streak").textContent, 1, "streak HUD updated");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  ok(T.unlocked().includes("easy"), "Warm-Up badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
  T.overlay.hide();
}

// ---------- F. Human win on Medium ----------
{
  T.setDiff("normal");
  T.setState(bottomRow([0, 1, 2], "R"), "R");
  T.playColumn(3);
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.normalWins, 1, "normal win counted");
  eq(T.stats.fastWins, 2, "second fast win");
  eq(T.stats.streak, 2, "streak is 2");
  ok(T.unlocked().includes("normal"), "Street Level badge unlocks");
  ok(T.unlocked().includes("streak2"), "Two in a Row badge unlocks");
  eq(T.unlocked().length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- G. Human win on Hard ----------
{
  T.setDiff("hard");
  eq(T.aiDepth, 8, "hard is depth 8");
  T.setState(bottomRow([0, 1, 2], "R"), "R");
  T.playColumn(3);
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.hardWins, 1, "hard win counted");
  eq(T.stats.fastWins, 3, "third fast win");
  eq(T.stats.streak, 3, "streak is 3");
  const u = T.unlocked();
  ok(u.includes("hard"), "Hard Mode badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  ok(u.includes("allDiff"), "All Rounder badge unlocks (all difficulties)");
  eq(u.length, 7, "seven badges unlocked");
  T.overlay.hide();
}

// ---------- H. CPU wins (loss) ----------
{
  T.setDiff("normal");
  T.setState(bottomRow([0, 1, 2], "Y"), "Y");
  T.aiMove();
  eq(T.gameOver, true, "CPU win ends the game");
  eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.totalMoves, 5, "4 human + 1 CPU drop so far (incl. section B)");
  eq(T.unlocked().length, 7, "no new badges on a loss");
  T.overlay.hide();
}

// ---------- I. Draw ----------
{
  T.newGame();
  T.endGame("draw");
  eq(T.gameOver, true, "game over");
  eq(T.overlayTitle(), "Draw!", "draw overlay shown");
  eq(T.stats.games, 5, "fifth game");
  eq(T.stats.draws, 1, "draw counted");
  ok(T.unlocked().includes("draw1"), "Stalemate badge unlocks");
  eq(T.unlocked().length, 8, "eight badges unlocked");
  T.overlay.hide();
}

// ---------- J. Two more wins (win5 + fast5) ----------
{
  T.setDiff("normal");
  for (let i = 0; i < 2; i++) {
    T.setState(bottomRow([0, 1, 2], "R"), "R");
    T.playColumn(3);
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.fastWins, 5, "fifth fast win");
  eq(T.stats.streak, 2, "streak is 2");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  ok(u.includes("fast5"), "Lightning badge unlocks at 5 fast wins");
  eq(u.length, 10, "ten badges unlocked");
}

// ---------- K. Five more wins (win10) ----------
{
  for (let i = 0; i < 5; i++) {
    T.setState(bottomRow([0, 1, 2], "R"), "R");
    T.playColumn(3);
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.wins, 10, "tenth win");
  eq(T.stats.fastWins, 10, "ten fast wins");
  eq(T.stats.streak, 7, "streak is 7");
  eq(T.stats.bestStreak, 7, "best streak is 7");
  ok(T.unlocked().includes("win10"), "Champion badge unlocks at 10 wins");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
  ok(!T.unlocked().includes("games20"), "Dedicated still locked");
  ok(!T.unlocked().includes("losses10"), "Persistence still locked");
  ok(!T.unlocked().includes("moves100"), "Dropper still locked");
}

// ---------- L. Two more losses ----------
{
  for (let i = 0; i < 2; i++) {
    T.setState(bottomRow([0, 1, 2], "Y"), "Y");
    T.aiMove();
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "CPU wins 🤖", "loss overlay shown");
    T.overlay.hide();
  }
  eq(T.stats.losses, 3, "three losses total");
  eq(T.stats.games, 14, "fourteen games total");
  eq(T.stats.streak, 0, "streak reset by the losses");
  eq(T.unlocked().length, 11, "no extra badges from the losses");
}

// ---------- M. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "easy", "normal", "hard", "allDiff",
    "streak2", "streak3", "fast5", "draw1",
  ];
  ok(u.length === 11 && expected.every((id) => u.includes(id)), "exactly the 11 earned badges are unlocked", u);
  eq(T.stats.games, 14, "games");
  eq(T.stats.wins, 10, "wins");
  eq(T.stats.losses, 3, "losses");
  eq(T.stats.draws, 1, "draws");
  eq(T.stats.easyWins, 1, "easy wins");
  eq(T.stats.normalWins, 8, "normal wins (1 in F, 2 in J, 5 in K)");
  eq(T.stats.hardWins, 1, "hard wins");
  eq(T.stats.fastWins, 10, "fast wins");
  eq(T.stats.bestStreak, 7, "best streak");
  eq(T.stats.totalMoves, 14, "1 from section B + 10 human wins + 3 CPU wins");
}

// ---------- N. Pause ----------
{
  T.setDiff("normal");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.playColumn(0);
  eq(T.moveCount, 0, "drops blocked while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.playColumn(0);
  eq(T.moveCount, 1, "drops work after resume");
  eq(T.turn, "Y", "CPU's turn after the human drop");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();

  // Game over suppresses pause
  T.setState(bottomRow([0, 1, 2], "R"), "R");
  T.playColumn(3);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- O. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("connect-four-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("connect-four-sound"), "on", "preference restored");
}

// ---------- P. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "11 / 14", "modal shows 11 of 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 11, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
