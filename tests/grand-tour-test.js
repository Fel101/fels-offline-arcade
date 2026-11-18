// Deterministic tests for games/grand-tour/script.js.
const fs = require("fs");
const path = require("path");

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
    dataset: {},
    className: "",
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
      if (k === "class") {
        this.className = String(v);
        this.classList = makeClassList();
        String(v)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => this.classList.add(c));
      }
      if (k.indexOf("data-") === 0) {
        const key = k
          .slice(5)
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    querySelector() {
      return makeEl("div");
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return this.children[0] || null;
    },
  });
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html || "";
    },
    set(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
  });
  return el;
}

const ids = [
  "board", "countdown", "countdown-num", "time", "edges", "dots", "hints",
  "score", "best", "hint", "pause", "undo-btn", "redo-btn", "hint-btn",
  "branch-btn", "mark-btn", "new-game", "reset-btn", "check", "badges-btn",
  "badge-count", "sound-btn", "sound-icon", "branch-bar", "branch-keep",
  "branch-discard", "toasts", "achv-modal", "achv-grid", "achv-count",
  "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("branch-bar").hidden = true;
elements.get("countdown").hidden = true;

const modeChips = ["classic", "attack", "daily", "zen"].map((m) => {
  const e = makeEl("button", "mode-" + m);
  e.dataset.mode = m;
  return e;
});
const diffChips = ["easy", "medium", "hard", "expert"].map((d) => {
  const e = makeEl("button", "diff-" + d);
  e.dataset.diff = d;
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    return makeEl("div");
  },
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".diff-chip") return diffChips;
    return [];
  },
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
};

global.getComputedStyle = () => ({
  getPropertyValue: (n) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
    })[n] || "",
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

global.requestAnimationFrame = () => 1;

const repo = require("./_env").gameScript("grand-tour");
let code = fs.readFileSync(repo, "utf8");
const CORE = require("./_env").CORE;
if (fs.existsSync(CORE)) code = fs.readFileSync(CORE, "utf8") + "\n" + code;

const t0 = Date.now();
try {
  eval(code);
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__GT;
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
function deepEq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg, { actual: a, expected: b });
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridAdj(rows, cols) {
  const V = rows * cols;
  const adj = Array.from({ length: V }, () => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = r * cols + c;
      if (c + 1 < cols) {
        const w = v + 1;
        adj[v].push(w);
        adj[w].push(v);
      }
      if (r + 1 < rows) {
        const w = v + cols;
        adj[v].push(w);
        adj[w].push(v);
      }
    }
  }
  return adj;
}

function bruteForceCycles(rows, cols, limit) {
  const V = rows * cols;
  const adj = gridAdj(rows, cols);
  const visited = new Uint8Array(V);
  const path = [0];
  let directed = 0;
  visited[0] = 1;
  function dfs(v) {
    if (directed >= limit * 2 + 4) return;
    if (path.length === V) {
      if (adj[v].includes(0)) directed++;
      return;
    }
    for (const w of adj[v]) {
      if (w === 0 || visited[w]) continue;
      visited[w] = 1;
      path.push(w);
      dfs(w);
      path.pop();
      visited[w] = 0;
    }
  }
  dfs(0);
  return directed / 2;
}

// ---------- A. Base cycles ----------
for (const d of Object.keys(T.DIFFS)) {
  const cfg = T.DIFFS[d];
  const cycle = T.buildBaseCycle(cfg.rows, cfg.cols);
  ok(T.cycleIsValid(cycle, cfg.rows, cfg.cols), `base cycle valid for ${d}`, {
    rows: cfg.rows,
    cols: cfg.cols,
    len: cycle.length,
  });
  const edges = T.cycleEdges(cycle, cfg.cols);
  eq(edges.size, cfg.rows * cfg.cols, `base cycle has ${cfg.rows * cfg.cols} edges for ${d}`);
}

// ---------- B. Randomization preserves a single cycle ----------
for (const d of Object.keys(T.DIFFS)) {
  const cfg = T.DIFFS[d];
  for (let s = 1; s <= 6; s++) {
    const cycle = T.buildBaseCycle(cfg.rows, cfg.cols);
    T.randomizeCycle(cycle, mulberry32(s * 7919), cfg.rows, cfg.cols, 3000);
    ok(T.cycleIsValid(cycle, cfg.rows, cfg.cols), `randomized cycle valid ${d} seed ${s}`, {
      len: cycle.length,
    });
  }
}

// ---------- C. Graph shape ----------
{
  const g = T.getGraph(4, 6);
  eq(g.V, 24, "4x6 graph has 24 vertices");
  eq(g.E, 4 * 5 + 3 * 6, "4x6 graph has 38 edges");
  eq(g.edgeIds.length, g.E, "edge id list matches edge count");
  eq(g.edgeIndex.size, g.E, "edge index has every edge");
  let badInc = 0;
  for (let v = 0; v < g.V; v++) {
    for (const ei of g.inc[v]) {
      if (g.edgeA[ei] !== v && g.edgeB[ei] !== v) badInc++;
    }
  }
  eq(badInc, 0, "incidence lists are consistent");
}

// ---------- D. Solver matches brute force on small grids ----------
for (const [rows, cols] of [
  [2, 4],
  [3, 4],
  [4, 4],
]) {
  const g = T.getGraph(rows, cols);
  const brute = bruteForceCycles(rows, cols, 10000);
  const res = T.countSolutions(g, new Set(), 1000000, 8000000);
  eq(res.capped, false, `${rows}x${cols} solver did not hit the node cap`);
  eq(res.count, brute, `${rows}x${cols} solver matches brute force`, {
    solver: res.count,
    brute,
  });
  console.log(`  ${rows}x${cols} Hamiltonian cycles: solver=${res.count} brute=${brute}`);
}

// ---------- E. Generated puzzles are valid and unique ----------
const genTimes = {};
const clueCounts = {};
for (const d of Object.keys(T.DIFFS)) {
  const cfg = T.DIFFS[d];
  genTimes[d] = [];
  clueCounts[d] = [];
  for (let s = 1; s <= 4; s++) {
    const start = Date.now();
    const gen = T.generatePuzzle(d, `grand-tour-test-${d}-${s}`);
    const ms = Date.now() - start;
    genTimes[d].push(ms);
    clueCounts[d].push(gen.clues.size);

    eq(gen.solution.size, cfg.rows * cfg.cols, `${d} seed ${s}: solution has ${cfg.rows * cfg.cols} edges`);
    eq(gen.clues.size > 0, true, `${d} seed ${s}: has at least one clue`);
    ok(gen.clues.size <= gen.solution.size, `${d} seed ${s}: clues are a subset of the solution`);

    let subset = true;
    for (const id of gen.clues) if (!gen.solution.has(id)) subset = false;
    ok(subset, `${d} seed ${s}: every clue belongs to the solution`);

    const res = T.countSolutions(gen.graph, gen.clues, 2, 1000000);
    eq(res.capped, false, `${d} seed ${s}: uniqueness check completed`);
    eq(res.count, 1, `${d} seed ${s}: exactly one solution`, {
      count: res.count,
      clues: gen.clues.size,
      edges: gen.graph.E,
    });

    // Validate the solution itself: every dot degree 2 and one component.
    const deg = new Int32Array(gen.graph.V);
    const adj = Array.from({ length: gen.graph.V }, () => []);
    for (const id of gen.solution) {
      const ei = gen.graph.edgeIndex.get(id);
      if (ei === undefined) {
        ok(false, `${d} seed ${s}: solution edge exists in graph`);
        continue;
      }
      const a = gen.graph.edgeA[ei];
      const b = gen.graph.edgeB[ei];
      deg[a]++;
      deg[b]++;
      adj[a].push(b);
      adj[b].push(a);
    }
    let allTwo = true;
    for (let v = 0; v < gen.graph.V; v++) if (deg[v] !== 2) allTwo = false;
    ok(allTwo, `${d} seed ${s}: every dot has degree 2 in the solution`);

    const seen = new Uint8Array(gen.graph.V);
    const stack = [0];
    seen[0] = 1;
    let count = 0;
    while (stack.length) {
      const v = stack.pop();
      count++;
      for (const w of adj[v]) {
        if (!seen[w]) {
          seen[w] = 1;
          stack.push(w);
        }
      }
    }
    eq(count, gen.graph.V, `${d} seed ${s}: solution is one connected loop`);
  }
}

// ---------- F. Board evaluation ----------
function setStateFor(rows, cols, clueIds, lineIds) {
  const s = T.state;
  s.rows = rows;
  s.cols = cols;
  s.graph = T.getGraph(rows, cols);
  s.clues = new Set(clueIds);
  s.lines = new Set(lineIds);
  s.marks = new Set();
  s.started = true;
  s.over = false;
  s.paused = false;
  s.branching = false;
  s.branchTouched = new Set();
}

{
  // Empty board is not solved.
  setStateFor(4, 4, [], []);
  let res = T.evaluateBoard();
  eq(res.solved, false, "empty board is not solved");
  eq(res.reason, "degree", "empty board reports a degree problem");

  // Two separate 4-cycles on a 2x4 grid.
  const twoLoops = [
    "h0_0", "v0_1", "h1_0", "v0_0", // 0-1-5-4-0
    "h0_2", "v0_3", "h1_2", "v0_2", // 2-3-7-6-2
  ];
  setStateFor(2, 4, [], twoLoops);
  res = T.evaluateBoard();
  eq(res.solved, false, "two separate loops are not solved");
  eq(res.reason, "loops", "two loops report a loop problem");
  eq(res.components, 2, "two loops counted as two components");

  // One perimeter loop on the same 2x4 grid.
  const oneLoop = ["h0_0", "h0_1", "h0_2", "v0_3", "h1_2", "h1_1", "h1_0", "v0_0"];
  setStateFor(2, 4, [], oneLoop);
  res = T.evaluateBoard();
  eq(res.solved, true, "one perimeter loop is solved");
  eq(res.reason, "solved", "solved reason reported");

  // A missing edge leaves two open ends.
  setStateFor(2, 4, [], oneLoop.slice(0, -1));
  res = T.evaluateBoard();
  eq(res.solved, false, "a missing edge is not solved");
  eq(res.one, 2, "a missing edge leaves two open ends");

  // A branch is rejected.
  setStateFor(2, 4, [], oneLoop.concat(["v0_1"]));
  res = T.evaluateBoard();
  eq(res.solved, false, "a branch is not solved");
  ok(res.tooMany > 0, "a branch produces a dot with too many lines");
}

// ---------- G. Actions: line, mark, undo, redo, reset ----------
{
  T.setMode("classic", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;

  const freeEdge = s.graph.edgeIds.find((id) => !s.clues.has(id));
  ok(!!freeEdge, "found a non-clue edge");

  const before = T.snap();
  T.applyLine(freeEdge, true);
  let snap = T.snap();
  ok(snap.lines.includes(freeEdge), "line placed");
  eq(snap.history, before.history + 1, "placing a line pushes history");
  ok(snap.score > before.score, "placing a line scores points");

  T.applyLine(freeEdge, false);
  snap = T.snap();
  ok(!snap.lines.includes(freeEdge), "line removed");

  T.undo();
  snap = T.snap();
  ok(snap.lines.includes(freeEdge), "undo restores the line");
  eq(snap.future, 1, "undo pushes a redo entry");

  T.redo();
  snap = T.snap();
  ok(!snap.lines.includes(freeEdge), "redo removes the line again");
  eq(snap.redos, 1, "redo increments the per-puzzle redo counter");

  const markEdge = s.graph.edgeIds.find((id) => !s.clues.has(id));
  T.toggleMark(markEdge);
  snap = T.snap();
  ok(snap.marks.includes(markEdge), "mark placed");
  T.toggleMark(markEdge);
  snap = T.snap();
  ok(!snap.marks.includes(markEdge), "mark removed");

  // Reset keeps clues and clears player marks.
  T.applyLine(freeEdge, true);
  T.toggleMark(markEdge);
  const cluesBefore = T.snap().clues.length;
  T.resetProgress();
  snap = T.snap();
  eq(snap.lines.length, 0, "reset clears player lines");
  eq(snap.marks.length, 0, "reset clears marks");
  eq(snap.clues.length, cluesBefore, "reset keeps clues");
  ok(snap.clues.length > 0, "clues remain after reset");
}

// ---------- H. Branch keep / discard ----------
{
  T.setMode("classic", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;

  const edge = s.graph.edgeIds.find((id) => !s.clues.has(id));
  T.enterBranch();
  eq(T.snap().branching, true, "branch mode entered");
  T.applyLine(edge, true);
  eq(T.snap().lines.includes(edge), true, "branch line placed");
  ok(T.snap().branchTouched.includes(edge), "branch line marked as temporary");
  T.keepBranch();
  let snap = T.snap();
  eq(snap.branching, false, "keep exits branch mode");
  eq(snap.lines.includes(edge), true, "keep preserves the branch line");

  const edge2 = s.graph.edgeIds.find((id) => !s.clues.has(id) && id !== edge);
  T.enterBranch();
  T.applyLine(edge2, true);
  T.discardBranch();
  snap = T.snap();
  eq(snap.branching, false, "discard exits branch mode");
  eq(snap.lines.includes(edge2), false, "discard reverts the branch line");
  eq(snap.lines.includes(edge), true, "discard preserves earlier kept lines");
}

// ---------- I. Hints ----------
{
  T.setMode("classic", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;
  const hintsBefore = s.hintsLeft;
  const usedBefore = s.hintsUsed;
  T.useHint();
  eq(s.hintsLeft, hintsBefore - 1, "hint decrements the hint counter");
  eq(s.hintsUsed, usedBefore + 1, "hint increments hints used");
  const added = T.snap().lines.find((id) => s.solution.has(id) && !s.clues.has(id));
  ok(!!added, "hint adds a correct solution edge");
}

// ---------- J. Win flow ----------
{
  T.setMode("classic", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;
  s.score = 0;
  s.elapsed = 65000;
  s.lines = new Set();
  for (const id of s.solution) if (!s.clues.has(id)) s.lines.add(id);
  T.checkBoard(true);
  const snap = T.snap();
  eq(snap.over, true, "completing the loop ends the game");
  eq(snap.won, true, "completing the loop wins");
  eq(snap.overlayTitle, "Solved! 🎉", "win overlay shown");
  ok(snap.stats.solves >= 1, "solve counted in stats");
  ok(snap.unlocked.includes("first"), "first solve badge unlocked");
  ok(snap.score > 0, "win awards a score");
  ok(elements.get("best").textContent !== "—", "best time displayed after a win");
}

// ---------- K. Modes and difficulties ----------
{
  T.setMode("classic", true);
  T.setDiff("easy");
  let snap = T.snap();
  eq(snap.diff, "easy", "difficulty switched to easy");
  eq(snap.rows, 4, "easy has 4 rows");
  eq(snap.cols, 6, "easy has 6 columns");
  eq(snap.edgeEls > 0, true, "board rendered edges");
  eq(snap.dotEls, 24, "board rendered 24 dots");

  T.setMode("attack", true);
  snap = T.snap();
  eq(snap.mode, "attack", "mode switched to attack");
  eq(snap.remaining, 240000, "attack starts with a 4:00 clock on easy");

  T.setMode("zen", true);
  snap = T.snap();
  eq(snap.mode, "zen", "mode switched to zen");
  eq(snap.hintsLeft, Infinity, "zen has unlimited hints");

  T.setMode("daily", true);
  const first = T.snap();
  T.newPuzzle();
  const second = T.snap();
  deepEq(
    first.clues.slice().sort(),
    second.clues.slice().sort(),
    "daily clues are deterministic across restarts"
  );
  deepEq(
    first.solution.slice().sort(),
    second.solution.slice().sort(),
    "daily solution is deterministic across restarts"
  );

  T.setMode("classic", true);
  T.setDiff("medium");
  snap = T.snap();
  eq(snap.diff, "medium", "difficulty switched back to medium");
  eq(snap.rows, 6, "medium has 6 rows");
  eq(snap.cols, 6, "medium has 6 columns");
}

// ---------- L. Timer loop ----------
{
  T.setMode("attack", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;
  s.remaining = 10000;
  const start = 1000000;
  T.loop(start);
  T.loop(start + 1000);
  T.loop(start + 2000);
  ok(s.remaining < 10000, "attack timer counts down");
  ok(s.remaining > 0, "attack timer still running");
  // Pause stops the clock.
  const beforePause = s.remaining;
  T.setPaused(true, true);
  T.loop(start + 5000);
  eq(s.remaining, beforePause, "pause freezes the attack timer");
  T.setPaused(false, true);
  T.loop(start + 6000);
  ok(s.remaining < beforePause, "resume restarts the attack timer");

  // Running out of time ends the game.
  s.remaining = 50;
  T.loop(start + 7000);
  T.loop(start + 7100);
  const lost = T.snap();
  eq(lost.over, true, "time attack ends when the clock runs out");
  eq(lost.won, false, "time attack loss is not a win");
  eq(lost.overlayTitle, "Time's up", "time attack loss overlay shown");
}

// ---------- L2. Daily streak ----------
{
  T.daily.lastDate = "";
  T.daily.streak = 0;
  T.daily.history = {};
  T.setMode("daily", true);
  T.newPuzzle();
  const s = T.state;
  s.started = true;
  s.countdown = 0;
  s.over = false;
  s.paused = false;
  s.elapsed = 30000;
  s.lines = new Set();
  const sol = Array.from(s.solution);
  for (let i = 0; i < sol.length; i++) {
    if (!s.clues.has(sol[i])) s.lines.add(sol[i]);
  }
  T.checkBoard(true);
  const won = T.snap();
  eq(won.over, true, "daily solve wins");
  ok(won.daily.streak >= 1, "daily streak increments on a daily win");
  ok(won.daily.lastDate.length > 0, "daily date recorded");
  ok(won.stats.dailySolves >= 1, "daily solve counted");
  T.setMode("classic", true);
  T.setDiff("medium");
}

// ---------- M. Stats and achievements ----------
{
  const snap = T.snap();
  ok(snap.stats.solves >= 1, "stats record solves");
  ok(snap.stats.edgesPlaced > 0, "stats record placed lines");
  ok(snap.stats.bestTime > 0, "stats record a best time");
  ok(snap.unlocked.length > 0, "badges unlocked");
  ok(storage.has("grand-tour-stats-v1"), "stats persisted");
  ok(storage.has("grand-tour-achv-v1"), "achievements persisted");
  ok(storage.has("grand-tour-best-v1-classic-medium"), "best time persisted per mode and difficulty");
}

// ---------- N. Stress: generate many puzzles ----------
{
  const t0 = Date.now();
  let count = 0;
  for (const d of Object.keys(T.DIFFS)) {
    for (let s = 0; s < 3; s++) {
      const gen = T.generatePuzzle(d, `stress-${d}-${s}-${Math.random()}`);
      const res = T.countSolutions(gen.graph, gen.clues, 2, 1000000);
      if (res.count === 1 && !res.capped) count++;
      else {
        ok(false, `stress puzzle not unique ${d} ${s}`, { count: res.count, capped: res.capped });
      }
    }
  }
  eq(count, 12, "all 12 stress puzzles have exactly one solution");
  console.log(`  stress generation + verification: ${Date.now() - t0}ms`);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  initial medium puzzle generation: ${initMs}ms`);
for (const d of Object.keys(genTimes)) {
  const times = genTimes[d];
  console.log(
    `  ${d}: ${times.join(", ")} ms (avg ${Math.round(
      times.reduce((a, b) => a + b, 0) / times.length
    )} ms) clues ${clueCounts[d].join(", ")}`
  );
}
if (fail) process.exit(1);