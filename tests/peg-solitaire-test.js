// Deterministic tests for games/peg-solitaire/script.js
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
  "board", "moves", "pegs-left", "wins", "streak",
  "undo", "new-game",
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

// Legacy save from the pre-core build — must migrate.
storage.set("pegsol-wins", "2");

// ---------- Solver (memoized DFS over the 33-hole cross, BigInt states) ----------
const isValid = (r, c) =>
  r >= 0 && r < 7 && c >= 0 && c < 7 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
const CELLS = [];
for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (isValid(r, c)) CELLS.push([r, c]);
const IX = new Map(CELLS.map((p, i) => [p.join(","), i]));
const N = CELLS.length;
const BIT = CELLS.map((_, i) => 1n << BigInt(i));
const MOVES = CELLS.map(([r, c], i) => {
  const out = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const tr = r + 2 * dr, tc = c + 2 * dc;
    if (!isValid(tr, tc)) continue;
    out.push({
      from: [r, c],
      over: [r + dr, c + dc],
      to: [tr, tc],
      f: i,
      o: IX.get([r + dr, c + dc].join(",")),
      t: IX.get([tr, tc].join(",")),
    });
  }
  return out;
});
const CENTER_I = IX.get("3,3");
let START = 0n;
for (let i = 0; i < N; i++) if (i !== CENTER_I) START |= BIT[i];

function popcount(m) {
  let n = 0;
  while (m) {
    n += 1;
    m &= m - 1n;
  }
  return n;
}
function moveOptions(mask) {
  const out = [];
  for (let i = 0; i < N; i++) {
    if (!(mask & BIT[i])) continue;
    for (const m of MOVES[i]) {
      if ((mask & BIT[m.o]) && !(mask & BIT[m.t])) out.push(m);
    }
  }
  return out;
}
function applyMove(mask, m) {
  return (mask & ~BIT[m.f]) & ~BIT[m.o] | BIT[m.t];
}
function solveTo(target) {
  const memo = new Map();
  function rec(mask, path) {
    if (memo.has(mask)) return null;
    if (popcount(mask) === 1) {
      const low = mask & -mask; // isolate the single set bit
      const at = CELLS[Number(Math.log2(Number(low)))];
      return at[0] === target[0] && at[1] === target[1] ? path : null;
    }
    for (const m of moveOptions(mask)) {
      const res = rec(applyMove(mask, m), path.concat([m]));
      if (res) return res;
    }
    memo.set(mask, true);
    return null;
  }
  return rec(START, []);
}
function findDead(n) {
  const memo = new Map();
  function rec(mask, path) {
    if (memo.has(mask)) return null;
    const opts = moveOptions(mask);
    if (opts.length === 0) return popcount(mask) === n ? path : null;
    for (const m of opts) {
      const res = rec(applyMove(mask, m), path.concat([m]));
      if (res) return res;
    }
    memo.set(mask, true);
    return null;
  }
  return rec(START, []);
}

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/peg-solitaire/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__PEGSOL;
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
function play(plan) {
  for (const m of plan) {
    T.click(m.from[0], m.from[1]);
    T.click(m.to[0], m.to[1]);
  }
}

const SOLV_CENTER = solveTo([3, 3]);
const SOLV_CORNER = solveTo([0, 3]);
const DEAD2 = findDead(2);
if (!SOLV_CENTER || SOLV_CENTER.length !== 31) {
  console.error("solver failed to find a 31-move center solution");
  process.exit(1);
}
if (!SOLV_CORNER || SOLV_CORNER.length !== 31) {
  console.error("solver failed to find a 31-move corner solution");
  process.exit(1);
}
if (!DEAD2 || DEAD2.length < 1) {
  console.error("solver failed to find a 2-peg dead board");
  process.exit(1);
}

// ---------- A. Init + legacy migration ----------
{
  const b = T.board();
  let pegs = 0;
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++)
      if (b[r][c] === 1) pegs++;
      else if (isValid(r, c) && !(r === 3 && c === 3)) { /* unexpected empty */ }
  eq(pegs, 32, "32 pegs on the standard board");
  eq(b[3][3], 0, "center hole starts empty");
  eq(!isValid(0, 0) || b[0][0] === -1, true, "off-cross cells are void");
  eq(T.pegsLeft(), 32, "pegs left = 32");
  eq(T.moves, 0, "no moves yet");
  eq(T.selected, null, "nothing selected");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.anyMovesLeft(), true, "moves available at start");
  eq(T.stats.wins, 2, "legacy pegsol-wins migrated");
  eq(storage.has("pegsol-wins"), false, "legacy key removed");
  eq(storage.has("peg-solitaire-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 2, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 0, "Streak HUD starts at 0");
  eq(elements.get("board").children.length, 49, "7x7 grid rendered (spacers + cells)");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  const from13 = T.movesFrom(1, 3);
  ok(from13.some((m) => m.to[0] === 3 && m.to[1] === 3), "peg at (1,3) can jump to (3,3)");
}

// ---------- B. Selection + move mechanics ----------
{
  T.click(0, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([0, 3]), "clicking a peg selects it");
  T.click(1, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([1, 3]), "clicking another peg re-selects");
  T.click(3, 3);
  eq(T.selected, null, "legal jump deselects");
  eq(T.moves, 1, "jump counted");
  eq(T.pegsLeft(), 31, "jumped peg removed");
  eq(T.stats.totalMoves, 1, "career jump counted");
  eq(T.board()[1][3], 0, "origin hole emptied");
  eq(T.board()[2][3], 0, "jumped-over hole emptied");
  eq(T.board()[3][3], 1, "destination filled");

  T.click(4, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([4, 3]), "peg below the center selects");
  T.click(1, 3);
  eq(T.selected, null, "empty hole that isn't a legal target deselects");
  eq(T.moves, 1, "illegal destination makes no move");
  T.click(6, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([6, 3]), "clicking a peg always re-selects, even mid-selection");

  T.click(4, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([4, 3]), "re-selected");
  T.click(4, 3);
  eq(T.selected, null, "clicking the selected peg deselects");

  T.click(0, 0);
  eq(T.selected, null, "off-cross cells are inert");

  T.undo();
  eq(T.moves, 0, "undo restores the move count");
  eq(T.pegsLeft(), 32, "undo restores the board");
  eq(T.stats.undone, 1, "undo counted");
  T.undo();
  eq(T.stats.undone, 1, "undo with empty history is a no-op");
}

// ---------- C. Win with the peg in the center ----------
{
  T.newGame();
  play(SOLV_CENTER);
  eq(T.gameOver, true, "board finished");
  eq(T.overlayTitle(), "Perfect solve! 🏆", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("One peg left") !== -1, "win message mentions the last peg");
  eq(JSON.stringify(T.lastPeg()), JSON.stringify([3, 3]), "last peg in the center");
  eq(T.pegsLeft(), 1, "one peg remains");
  eq(T.anyMovesLeft(), false, "no moves remain");
  eq(T.stats.games, 1, "board counted");
  eq(T.stats.wins, 3, "win recorded (2 migrated + 1)");
  eq(T.stats.perfectCenter, 1, "center win recorded");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.totalMoves, 32, "31 jumps this board + 1 from section B (career counter, undos don't subtract)");
  eq(elements.get("wins").textContent, 3, "Wins HUD updated");
  eq(elements.get("streak").textContent, 1, "Streak HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Board badge unlocks");
  ok(u.includes("win1"), "Perfect Solve badge unlocks");
  ok(u.includes("center"), "Center Stage badge unlocks");
  T.overlay.hide();
}

// ---------- D. Win with the peg in a corner ----------
{
  T.newGame();
  play(SOLV_CORNER);
  eq(T.gameOver, true, "board finished");
  eq(JSON.stringify(T.lastPeg()), JSON.stringify([0, 3]), "last peg in a corner");
  eq(T.stats.wins, 4, "second win recorded");
  eq(T.stats.perfectCorner, 1, "corner win recorded");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  const u = T.unlocked();
  ok(u.includes("corner"), "Corner Shot badge unlocks");
  ok(u.includes("both"), "Any Position badge unlocks (center + corner)");
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  T.overlay.hide();
}

// ---------- E. Third win (streak + 5 wins) ----------
{
  T.newGame();
  play(SOLV_CENTER);
  eq(T.gameOver, true, "board finished");
  eq(T.stats.games, 3, "third board");
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.perfectCenter, 2, "second center win");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 3, "best streak is 3");
  const u = T.unlocked();
  ok(u.includes("win5"), "Consistent badge unlocks at 5 wins");
  ok(u.includes("streak3"), "Three in a Row badge unlocks");
  T.overlay.hide();
}

// ---------- F. Ten near-miss boards (2 pegs left) ----------
{
  for (let i = 0; i < 10; i++) {
    T.newGame();
    play(DEAD2);
    eq(T.gameOver, true, "near board " + (i + 1) + " finished");
    eq(T.pegsLeft(), 2, "near board " + (i + 1) + " ends with 2 pegs");
    T.overlay.hide();
  }
  eq(T.stats.nearlyWins, 10, "ten near-miss boards recorded");
  eq(T.stats.games, 13, "13 boards played");
  eq(T.stats.streak, 0, "streak broken by the losses");
  eq(T.stats.wins, 5, "win count unchanged");
  eq(T.overlayTitle(), null, "overlay hidden after the last board");
  const u = T.unlocked();
  ok(u.includes("nearly10"), "So Close badge unlocks at 10 near-misses");
  ok(u.includes("moves100"), "Jumper badge unlocks (100+ total jumps)");
  ok(!u.includes("moves500"), "Marathon still locked");
}

// ---------- G. Undo badge ----------
{
  T.newGame();
  for (let i = 0; i < 10; i++) {
    T.click(1, 3);
    T.click(3, 3);
    T.undo();
  }
  eq(T.stats.undone, 11, "eleven undos in total");
  ok(T.unlocked().includes("undo10"), "Second Thoughts badge unlocks at 10 undos");
}

// ---------- H. Final badge tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win1", "win5", "center", "corner", "both",
    "streak2", "streak3", "nearly10", "moves100", "undo10",
  ];
  ok(
    u.length === 11 && expected.every((id) => u.includes(id)),
    "exactly the 11 earned badges are unlocked",
    u
  );
  ok(!u.includes("win10"), "Solitaire Master still locked (5 wins)");
  ok(!u.includes("games20"), "Regular still locked (13 boards)");
  eq(T.stats.totalMoves, 1 + 31 * 3 + 10 * DEAD2.length + 10, "career jump math checks out (1 from section B, 10 from section G)");
}

// ---------- I. Pause ----------
{
  T.newGame();
  T.click(1, 3);
  eq(JSON.stringify(T.selected), JSON.stringify([1, 3]), "peg selected before pause");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.click(3, 3);
  eq(T.moves, 0, "jumps blocked while paused");
  keydown("1");
  eq(T.paused, true, "number keys do nothing");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.click(3, 3);
  eq(T.moves, 1, "jumps work after resume");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();

  // Game over suppresses pause
  T.newGame();
  play(SOLV_CENTER);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Perfect solve! 🏆", "win overlay intact");
  T.overlay.hide();
}

// ---------- J. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("peg-solitaire-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("peg-solitaire-sound"), "on", "preference restored");
}

// ---------- K. Badges modal ----------
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
