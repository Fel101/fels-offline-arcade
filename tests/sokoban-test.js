// Deterministic tests for games/sokoban/script.js
// Levels 1–11 are solved by a push-space BFS in the test; the 12th level is a
// hand-verified 23-move solution (its push-space is too large for a quick BFS).
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
  "board", "moves", "level", "solved", "placed", "best-moves", "level-label", "hint", "undo", "reset-level",
  "level-prev", "level-next", "badges-btn", "badge-count", "badges2", "sound-btn",
  "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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

// Legacy save from the pre-core build: level 2 (index 1) was solved.
storage.set("sokoban-done", String(1 << 1));

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/sokoban/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__SOKOBAN;
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

function keydown(key, extra) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn(Object.assign({ key, target: { tagName: "BODY" }, preventDefault() {} }, extra || {}))
  );
}
function winEvent(t) {
  (listeners["win:" + t] || []).forEach((fn) => fn({}));
}

const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
function apply(plan) {
  for (const d of plan) T.tryMove(DIRS[d][0], DIRS[d][1]);
}

// ---------------------------------------------------------------------------
// Push-space BFS. Returns the shortest list of "up|down|left|right" moves.
// ---------------------------------------------------------------------------
function planFromState() {
  const s = T.state;
  const rows = s.rows;
  const cols = s.cols;
  const id = (r, c) => r * cols + c;
  const floor = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (!s.grid[r][c]) floor.add(id(r, c));
  }
  const targets = new Set(s.targets);
  const names = ["up", "down", "left", "right"];

  function reach(player, boxes) {
    const blocked = new Set(boxes);
    const prev = new Map([[player, null]]);
    const q = [player];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      const r = Math.floor(cur / cols);
      const c = cur % cols;
      for (const name of names) {
        const [dr, dc] = DIRS[name];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const ni = id(nr, nc);
        if (!floor.has(ni) || blocked.has(ni) || prev.has(ni)) continue;
        prev.set(ni, { from: cur, dir: name });
        q.push(ni);
      }
    }
    return prev;
  }
  function walk(player, boxes, dest) {
    const prev = reach(player, boxes);
    if (!prev.has(dest)) return null;
    const out = [];
    let cur = dest;
    while (prev.get(cur)) {
      const p = prev.get(cur);
      out.unshift(p.dir);
      cur = p.from;
    }
    return out;
  }
  const solved = (boxes) => boxes.every((b) => targets.has(b));
  function key(state) {
    const seen = reach(state.player, state.boxes);
    let anchor = Infinity;
    for (const k of seen.keys()) if (k < anchor) anchor = k;
    return state.boxes.join(",") + "|" + anchor;
  }

  const start = {
    boxes: s.boxes.slice().sort((a, b) => a - b),
    player: id(s.player.r, s.player.c),
    plan: [],
  };
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (solved(cur.boxes)) return cur.plan;
    for (const b of cur.boxes) {
      const br = Math.floor(b / cols);
      const bc = b % cols;
      for (const name of names) {
        const [dr, dc] = DIRS[name];
        const sr = br - dr;
        const sc = bc - dc;
        const tr = br + dr;
        const tc = bc + dc;
        if (sr < 0 || sc < 0 || sr >= rows || sc >= cols) continue;
        if (tr < 0 || tc < 0 || tr >= rows || tc >= cols) continue;
        const stand = id(sr, sc);
        const dest = id(tr, tc);
        if (!floor.has(stand) || !floor.has(dest)) continue;
        if (cur.boxes.includes(stand) || cur.boxes.includes(dest)) continue;
        const path = walk(cur.player, cur.boxes, stand);
        if (!path) continue;
        const boxes = cur.boxes.filter((x) => x !== b).concat(dest).sort((x, y) => x - y);
        const next = { boxes, player: b, plan: cur.plan.concat(path, [name]) };
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return null;
}

function solvePlan(li) {
  T.loadLevel(li);
  return planFromState();
}

// Hand-verified solution for level 12 ("Cross Push"): 27 steps, 6 pushes.
const CROSS_PUSH = [
  "up", "up",
  "down", "down", "down", "down",
  "up", "up", "up",
  "left", "left",
  "right", "right", "right", "right",
  "down", "down", "down", "left", "left", "up",
  "left", "left",
  "right", "right", "right", "right",
];

function solve(li) {
  const plan = li === T.TOTAL - 1 ? CROSS_PUSH : solvePlan(li);
  if (!plan) throw new Error("no plan for level " + (li + 1));
  apply(plan);
  return plan;
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.TOTAL, 12, "twelve levels");
  eq(T.LEVELS.length, 12, "twelve level definitions");
  eq(T.stats.wins, 1, "legacy wins migrated from the solved bitmask");
  eq(T.stats.solved.join(","), "2", "legacy level recorded as solved");
  eq(T.stats.streak, 0, "streak starts at 0");
  eq(T.stats.bestStreak, 0, "best streak starts at 0");
  eq(T.stats.moves, 0, "no steps yet");
  eq(T.stats.pushes, 0, "no pushes yet");
  eq(T.stats.undos, 0, "no undos yet");
  eq(T.stats.resets, 0, "no resets yet");
  eq(T.stats.cleanWins, 0, "no clean wins yet");
  eq(storage.has("sokoban-done"), false, "legacy bitmask key removed");
  eq(storage.has("sokoban-stats-v1"), true, "stats persisted under the core key");
  eq(T.levelIndex, 0, "the first unsolved level is loaded");
  eq(elements.get("moves").textContent, 0, "Moves HUD starts at 0");
  eq(elements.get("level").textContent, "1/12", "Level HUD");
  eq(elements.get("solved").textContent, "1/12", "Solved HUD shows the migrated level");
  eq(elements.get("level-label").textContent, "Level 1: First Push", "level label");
  eq(T.rows, 5, "level 1 has five rows");
  eq(T.cols, 7, "level 1 has seven columns");
  eq(elements.get("board").children.length, 35, "thirty-five cells rendered");
  const cells = elements.get("board").children;
  ok(cells[0].classList.contains("sk-wall"), "border is a wall");
  ok(cells[8].classList.contains("sk-floor"), "inside is floor");
  ok(cells[16].children.length === 1 && cells[16].children[0].classList.contains("sk-player"), "player rendered");
  ok(cells[17].children.length === 1 && cells[17].children[0].classList.contains("sk-box"), "box rendered");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  ok(elements.get("hint").textContent.indexOf("Esc pauses") !== -1, "hint mentions Esc");
}

// ---------- B. First solve via the physical keyboard ----------
{
  eq(T.gameOver, false, "level 1 is live");
  keydown("ArrowRight");
  eq(T.gameOver, true, "pushing the box onto the target solves the level");
  eq(T.moves, 1, "one move");
  eq(T.stats.moves, 1, "career step counted");
  eq(T.stats.pushes, 1, "career push counted");
  eq(T.overlayTitle(), "Level complete! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("Solved in 1 move.") !== -1, "win message", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("No undo, no reset!") !== -1, "clean bonus", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Cleared 2 / 12.") !== -1, "progress line", T.overlayMsg());
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.cleanWins, 1, "clean win counted");
  eq(T.stats.solved.join(","), "1,2", "level 1 recorded");
  eq(elements.get("solved").textContent, "2/12", "Solved HUD updated");
  eq(elements.get("moves").textContent, 1, "Moves HUD updated");
  const st = T.state;
  eq(st.boxes.every((b) => st.targets.indexOf(b) !== -1), true, "every box sits on a target");
  keydown("ArrowRight");
  eq(T.stats.moves, 1, "moves are ignored after the win");
  keydown("u");
  eq(T.stats.undos, 0, "undo is ignored after the win");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  ok(T.unlocked().includes("clean"), "Direct Route badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
  T.overlay.hide();
}

// ---------- C. Undo prevents a clean win ----------
{
  T.loadLevel(1);
  eq(T.overlayTitle(), null, "loading a level clears the overlay");
  eq(T.levelIndex, 1, "level 2 loaded");
  eq(elements.get("level-label").textContent, "Level 2: Double Shift", "level label updated");
  keydown("ArrowUp");
  eq(T.stats.moves, 2, "step counted");
  eq(T.moves, 1, "in-game move counted");
  T.undo();
  eq(T.moves, 0, "undo restores the move counter");
  eq(T.stats.undos, 1, "undo counted");
  eq(T.roundUndos, 1, "the round remembers the undo");
  eq(T.historyLength, 0, "history is empty after the undo");
  T.undo();
  eq(T.stats.undos, 1, "an empty history ignores undo");

  apply(planFromState());
  eq(T.gameOver, true, "level 2 solved");
  ok((T.overlayMsg() || "").indexOf("No undo") === -1, "not clean", T.overlayMsg());
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.cleanWins, 1, "clean wins unchanged");
  eq(T.stats.moves, 5, "three more career steps");
  eq(T.stats.pushes, 3, "two more career pushes");
  ok(T.unlocked().includes("streak2"), "Two in a Row badge unlocks");
  eq(T.unlocked().length, 3, "three badges unlocked");
  T.overlay.hide();
}

// ---------- D. Reset breaks the streak and blocks a clean win ----------
{
  T.loadLevel(2);
  keydown("ArrowUp");
  eq(T.stats.moves, 6, "step before the reset");
  T.resetLevel();
  eq(T.stats.resets, 1, "reset counted");
  eq(T.stats.streak, 0, "reset breaks the streak");
  eq(T.roundResets, 1, "the new round remembers the reset");
  eq(T.moves, 0, "the level restarted");
  eq(T.levelIndex, 2, "the same level reloaded");

  apply(planFromState());
  eq(T.gameOver, true, "level 3 solved");
  eq(T.stats.wins, 4, "fourth win");
  eq(T.stats.streak, 1, "streak restarts at 1");
  eq(T.stats.cleanWins, 1, "a reset round is not clean");
  ok(!T.unlocked().includes("win5"), "Regular badge is still locked");
  eq(T.unlocked().length, 3, "still three badges unlocked");
  eq(T.stats.moves, 10, "four more career steps");
  eq(T.stats.pushes, 4, "one more career push");
  T.overlay.hide();
}

// ---------- E. Clear the remaining warehouses ----------
{
  for (let li = 3; li < T.TOTAL; li++) {
    T.loadLevel(li);
    const before = T.stats.moves;
    const plan = solve(li);
    eq(T.gameOver, true, "level " + (li + 1) + " solved");
    eq(T.stats.moves - before, plan.length, "level " + (li + 1) + " used " + plan.length + " steps");
    if (li < T.TOTAL - 1) {
      eq(T.overlayTitle(), "Level complete! 🎉", "level " + (li + 1) + " overlay");
    }
    T.overlay.hide();
  }
  eq(T.stats.wins, 13, "thirteen wins");
  eq(T.stats.streak, 10, "ten in a row");
  eq(T.stats.bestStreak, 10, "best streak is 10");
  eq(T.stats.cleanWins, 10, "ten clean wins");
  eq(T.stats.moves, 172, "one hundred and seventy-two steps");
  eq(T.stats.pushes, 42, "forty-two pushes");
  eq(T.stats.solved.length, 12, "every warehouse cleared");
  eq(elements.get("solved").textContent, "12/12", "Solved HUD complete");
  const u = T.unlocked();
  ["win10", "streak3", "streak5", "clean", "clean5", "all12", "moves100"].forEach((id) =>
    ok(u.includes(id), id + " badge unlocks")
  );
  eq(u.length, 10, "ten badges unlocked");
  ok(!u.includes("moves500"), "Long Haul still locked");
  ok(!u.includes("pushes100"), "Box Mover still locked");
}

// ---------- F. Step grind reaches 500 ----------
{
  T.loadLevel(0);
  for (let i = 0; i < 164; i++) {
    keydown("ArrowUp");
    keydown("ArrowDown");
  }
  eq(T.stats.moves, 500, "exactly 500 career steps");
  eq(T.moves, 328, "328 steps this round");
  ok(T.unlocked().includes("moves500"), "Long Haul badge unlocks");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
}

// ---------- G. Push grind reaches 100 ----------
{
  T.loadLevel(4); // Twin Boxes: box (2,3), second box (2,5)
  T.tryMove(-1, 0); // up to (2,4), right of the first box
  const st0 = T.state;
  eq(st0.player.r, 2, "player reached row 2");
  eq(st0.player.c, 4, "player stands right of the box");
  for (let i = 0; i < 29; i++) {
    T.tryMove(0, -1); // push left: (2,3) -> (2,2)
    T.tryMove(1, 0);
    T.tryMove(0, -1);
    T.tryMove(0, -1);
    T.tryMove(-1, 0); // stand left of the box at (2,1)
    T.tryMove(0, 1); // push right: (2,2) -> (2,3)
    T.tryMove(1, 0);
    T.tryMove(0, 1);
    T.tryMove(0, 1);
    T.tryMove(-1, 0); // back to (2,4)
  }
  const st = T.state;
  eq(st.player.r, 2, "back on row 2");
  eq(st.player.c, 4, "back right of the box");
  eq(T.stats.pushes, 100, "exactly 100 career pushes");
  eq(T.gameOver, false, "no box reached a target");
  ok(T.unlocked().includes("pushes100"), "Box Mover badge unlocks");
  eq(T.unlocked().length, 12, "twelve badges unlocked");
}

// ---------- H. Undo grind ----------
{
  T.loadLevel(1);
  for (let i = 0; i < 24; i++) {
    keydown("ArrowUp");
    keydown("u");
  }
  eq(T.stats.undos, 25, "twenty-five career undos");
  ok(T.unlocked().includes("undo25"), "Second Thoughts badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
}

// ---------- I. Reset grind ----------
{
  for (let i = 0; i < 9; i++) T.resetLevel();
  eq(T.stats.resets, 10, "ten resets");
  eq(T.stats.streak, 0, "resets keep the streak at 0");
  ok(T.unlocked().includes("reset10"), "Fresh Start badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
}

// ---------- J. Pause ----------
{
  T.loadLevel(0);
  keydown("ArrowUp");
  eq(T.moves, 1, "one step before pausing");
  const before = T.stats.moves;
  keydown("Escape");
  eq(T.paused, true, "Esc pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  keydown("ArrowDown");
  eq(T.stats.moves, before, "movement is blocked while paused");
  keydown("u");
  eq(T.stats.undos, 25, "undo is blocked while paused");
  keydown("Escape");
  eq(T.paused, false, "Esc resumes");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  keydown("ArrowDown");
  eq(T.moves, 2, "movement works after resuming");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  // A solved board ignores pause.
  keydown("ArrowRight");
  eq(T.gameOver, true, "level 1 solved again");
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Level complete! 🎉", "win overlay intact");
  ok((T.overlayMsg() || "").indexOf("Cleared 12 / 12.") !== -1, "all levels already cleared", T.overlayMsg());
  T.overlay.hide();
}

// ---------- K. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("sokoban-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("sokoban-sound"), "on", "preference restored");
}

// ---------- L. Badges modal ----------
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

// ---------- M. Master overlay ----------
{
  // Replaying the last level after everything is solved must not re-announce the crown.
  T.loadLevel(T.TOTAL - 1);
  apply(CROSS_PUSH);
  eq(T.gameOver, true, "final level solved again");
  eq(T.overlayTitle(), "Level complete! 🎉", "normal overlay once the set is complete");
  ok((T.overlayMsg() || "").indexOf("All 12 warehouses") === -1, "no master message on replay", T.overlayMsg());
  T.overlay.hide();
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "streak5", "clean", "clean5",
    "moves100", "moves500", "pushes100", "undo25", "reset10", "all12",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.wins, 15, "wins");
  eq(T.stats.streak, 2, "streak");
  eq(T.stats.bestStreak, 10, "best streak");
  eq(T.stats.cleanWins, 12, "clean wins");
  eq(T.stats.moves, 845, "career steps");
  eq(T.stats.pushes, 111, "career pushes");
  eq(T.stats.undos, 25, "career undos");
  eq(T.stats.resets, 10, "career resets");
  eq(T.stats.solved.length, 12, "warehouses cleared");
}

// ---------- O. Graphics hook, onboarding and new feedback ----------
{
  const html = fs.readFileSync(root + "games/sokoban/index.html", "utf8");
  ok(html.indexOf("How to play") !== -1, "the guide is present");
  ok(html.indexOf("id=\"placed\"") !== -1 && html.indexOf("id=\"best-moves\"") !== -1, "new HUD chips exist");
  ok(html.indexOf("@keyframes skPushR") !== -1 && html.indexOf("@keyframes skPlaced") !== -1, "push animations defined");
  ok(html.indexOf("prefers-reduced-motion") !== -1, "reduced motion is respected");
  ok(elements.get("hint").textContent.indexOf("Red crates are wedged") !== -1, "hint explains wedged crates");

  // Level 1: one push right solves it and records a best.
  T.loadLevel(0);
  eq(T.facing, "right", "the worker faces right by default");
  eq(elements.get("placed").textContent, "0/1", "crates readout starts empty");
  eq(elements.get("best-moves").textContent, "1", "best readout shows the saved record");
  delete T.stats.bestMoves[1]; // make this solve a fresh record
  T.tryMove(0, 1);
  eq(T.facing, "right", "the worker faces the step direction");
  const cells = elements.get("board").children;
  const landed = cells[2 * 7 + 4].children[0];
  ok(landed.classList.contains("sk-box--done"), "the placed crate is green");
  ok(landed.classList.contains("sk-box--pushed") && landed.classList.contains("sk-box--push-right"), "push animation applied");
  ok(landed.classList.contains("sk-box--placed"), "landing pop applied");
  const worker = cells[2 * 7 + 3].children[0];
  ok(worker.classList.contains("sk-player--right") && worker.classList.contains("sk-player--step"), "worker turns and steps");
  eq(elements.get("placed").textContent, "1/1", "crates readout fills");
  eq(T.stats.bestMoves[1], 1, "best move count recorded");
  ok(T.overlayMsg().indexOf("New best!") !== -1, "a new best is announced", T.overlayMsg());
  T.overlay.hide();

  // A slower replay does not overwrite the record.
  T.loadLevel(0);
  apply(["up", "down", "right"]);
  eq(T.gameOver, true, "the slower route still solves level 1");
  eq(T.stats.bestMoves[1], 1, "the best move count is kept");
  ok(T.overlayMsg().indexOf("New best!") === -1, "no false new-best claim", T.overlayMsg());
  T.overlay.hide();

  // One-shot feedback is dropped on the next render.
  T.loadLevel(1);
  const fresh = elements.get("board").children;
  ok(!fresh.some((c) => c.children.some((ch) => ch.className.indexOf("sk-box--pushed") !== -1)), "push feedback is one-shot");

  // Genuine deadlock: wedge a crate in the bottom-left corner of level 3.
  T.loadLevel(2);
  apply(["up", "up", "up", "left", "left", "down", "down", "down"]);
  const stuck = T.stuckBoxes();
  eq(stuck.length, 1, "exactly one wedged crate is detected");
  eq(stuck[0], 4 * 8 + 1, "the wedged crate is in the corner");
  const wedged = elements.get("board").children[4 * 8 + 1].children[0];
  ok(wedged.classList.contains("sk-box--stuck"), "wedged crate is highlighted red");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
