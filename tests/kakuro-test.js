// Deterministic tests for games/kakuro/script.js.
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
      if (on) set.add(c); else set.delete(c);
      return on;
    },
  };
}

function makeEl(id, tag = "div") {
  const el = {
    id, tagName: tag.toUpperCase(), textContent: "", hidden: false, disabled: false, title: "",
    dataset: {}, style: {}, children: [], _listeners: {}, _attrs: {}, classList: makeClassList(),
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {}, focus() {},
    addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); },
    removeEventListener() {},
    dispatch(t, ev = {}) { const e = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, ev); (this._listeners[t] || []).forEach((fn) => fn(e)); },
    querySelector(sel) {
      if (sel === ".kakuro-clue") return this.children.find((c) => c.className === "kakuro-clue") || null;
      if (sel === ".kakuro-clue__tri") return this.children.filter((c) => (c.className || "").includes("kakuro-clue__tri"));
      if (sel === ".sudoku-cell__val") return this.children.find((c) => c.className === "sudoku-cell__val") || null;
      if (sel === ".sudoku-cell__notes") return this.children.find((c) => c.className === "sudoku-cell__notes") || null;
      if (sel === ".snake-modal__head [data-close]") return makeEl("c", "button");
      return makeEl("q", "div");
    },
    querySelectorAll(sel) {
      if (sel === ".kakuro-clue__tri") return this.children.filter((c) => (c.className || "").includes("kakuro-clue__tri"));
      if (sel === ".sudoku-cell__notes span") {
        const notes = this.children.find((c) => c.className === "sudoku-cell__notes");
        return notes ? notes.children : [];
      }
      return [];
    },
  };
  Object.defineProperty(el, "innerHTML", { get() { return this._html || ""; }, set(v) { this._html = v; if (v === "") this.children = []; } });
  Object.defineProperty(el, "offsetWidth", { get() { return 100; } });
  return el;
}

const ids = ["board","countdown","countdown-num","time","cells","mistakes","combo","hints","best","hint","pause","notes-btn","hint-btn","undo-btn","redo-btn","new-game","check","badges-btn","badge-count","sound-btn","sound-icon","difficulty-bar","toasts","achv-modal","achv-grid","achv-count","achv-records","badges2"];
for (const id of ids) elements.set(id, makeEl(id));
elements.get("achv-modal").hidden = true;

const modeChips = ["classic","attack","daily"].map((m)=>{const e=makeEl("mode-"+m,"button");e.dataset.mode=m;return e;});
const diffChips = ["easy","medium","hard","expert"].map((d)=>{const e=makeEl("diff-"+d,"button");e.dataset.diff=d;return e;});
const numBtns = [1,2,3,4,5,6,7,8,9,0].map((n)=>{const e=makeEl("num-"+n,"button");e.dataset.n=String(n);return e;});
const body = makeEl("body","body");
global.document = {
  body, documentElement: makeEl("html","html"), hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (t) => makeEl("created-" + t, t),
  querySelector: (s) => s === ".mode-chip" ? modeChips[0] : makeEl("q"),
  querySelectorAll: (s) => {
    if (s === ".mode-chip") return modeChips;
    if (s === ".diff-chip") return diffChips;
    if (s === ".num-btn") return numBtns;
    return [];
  },
  addEventListener: (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); },
  removeEventListener() {},
};
global.window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (t, fn) => { (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn); },
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  AudioContext: undefined, webkitAudioContext: undefined,
};
global.getComputedStyle = () => ({
  getPropertyValue: (n) => ({ "--accent":"#5ad1b8","--accent-2":"#ffd94d","--accent-3":"#ff5ea8","--danger":"#ff5b5b","--text":"#f2f3f7","--muted":"#9a9aa8" }[n] || ""),
});
const storage = new Map();
global.localStorage = { getItem:(k)=>(storage.has(k)?storage.get(k):null), setItem:(k,v)=>storage.set(k,String(v)), removeItem:(k)=>storage.delete(k) };
let rafCb = null;
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

const repo = require("./_env").gameScript("kakuro");
let code = fs.readFileSync(repo, "utf8");
const CORE = require("./_env").CORE;
if (fs.existsSync(CORE)) code = fs.readFileSync(CORE, "utf8") + "\n" + code;

// Test hook now ships in the game source.
try { eval(code); } catch (err) { console.error("INIT ERROR:", (err && err.stack) || err); process.exit(1); }

const T = global.window.__K;
let pass = 0, fail = 0;
function ok(cond, msg, extra) { if (cond) pass++; else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); } }
function eq(a, b, msg) { ok(a === b, msg, { actual: a, expected: b }); }
function deepEq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg, { actual: a, expected: b }); }

let frameTs = 100000;
function frames(n) {
  for (let i = 0; i < n; i++) {
    frameTs += 16.7;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error("no rAF callback");
    cb(frameTs);
  }
}

function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hashSeed(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function makePuzzle(seed, diff) {
  const rand = mulberry(seed);
  const sol = T.transformSolution(rand);
  T.state.solution = sol;
  return { sol, gen: T.generate(diff, "seed-" + seed) };
}

// ---------- A. Solution validity ----------
for (let seed = 1; seed <= 20; seed++) {
  const sol = T.transformSolution(mulberry(seed));
  let valid = true;
  for (let r = 0; r < 9; r++) {
    const row = new Set(), col = new Set();
    for (let c = 0; c < 9; c++) { row.add(sol[r][c]); col.add(sol[c][r]); }
    if (row.size !== 9 || col.size !== 9) valid = false;
  }
  ok(valid, `seed ${seed}: transformed solution is a valid Sudoku`);
  const flat = sol.flat();
  ok(flat.every((v) => v >= 1 && v <= 9), `seed ${seed}: all digits 1-9`);
}
const s1 = T.transformSolution(mulberry(1));
const s2 = T.transformSolution(mulberry(1));
deepEq(s1, s2, "seeded solution is deterministic");
ok(JSON.stringify(T.transformSolution(mulberry(1))) !== JSON.stringify(T.transformSolution(mulberry(2))), "different seeds give different solutions");

// ---------- B. Generation ----------
for (const d of ["easy", "medium", "hard", "expert"]) {
  let allRunsValid = true;
  let anyPuzzle = false;
  let debugInfo = null;
  for (let seed = 1; seed <= 6; seed++) {
    const { gen } = makePuzzle(seed, d);
    const playable = gen.playable;
    const runs = gen.runs;
    for (const run of runs) {
      if (run.cells.length < 2 || run.cells.length > 9) { allRunsValid = false; debugInfo = debugInfo || { issue: "len", run }; }
      if (run.sum > 45) { allRunsValid = false; debugInfo = debugInfo || { issue: "sum>45", run }; }
      const expected = T.sumOf(T.state.solution, run.cells);
      if (run.sum !== expected) { allRunsValid = false; debugInfo = debugInfo || { issue: "sum-mismatch", run, expected }; }
    }
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (playable[r][c] && gen.runsAt[r][c].length === 0) { allRunsValid = false; debugInfo = debugInfo || { issue: "uncovered", r, c }; }
    }
    let removed = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!playable[r][c]) removed++;
    if (removed > 0) anyPuzzle = true;
    let playableCells = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (playable[r][c]) playableCells++;
    if (playableCells !== 81 - removed) { allRunsValid = false; debugInfo = debugInfo || { issue: "count", playableCells, removed }; }
  }
  ok(allRunsValid, `${d}: all runs valid (length 2-9, sum matches, every cell covered) ` + JSON.stringify(debugInfo));
  ok(anyPuzzle, `${d}: generation removes cells`);
}

// determinism
const gA = makePuzzle(42, "medium").gen;
const gB = makePuzzle(42, "medium").gen;
deepEq(gA.playable, gB.playable, "seeded generation is deterministic");
deepEq(gA.runs.map((r) => [r.dir, r.sum, r.cells]), gB.runs.map((r) => [r.dir, r.sum, r.cells]), "runs deterministic");

// ---------- C. Initial state ----------
let s = T.snap();
eq(s.mode, "classic", "starts in classic");
eq(s.diff, "medium", "starts at medium");
eq(s.started, false, "starts in countdown");
ok(s.countdown > 0, "countdown is running");
eq(s.over, false, "not over");
eq(s.diffHidden, false, "difficulty visible");
eq(s.newGameDisabled, false, "new puzzle enabled");
ok(s.total > 20, "has playable cells", s.total);
eq(s.cellsEl, `0/${s.total}`, "HUD shows 0/total cells");

frames(60);
eq(T.snap().started, false, "still counting after ~1s");
frames(120);
eq(T.snap().started, true, "countdown finishes after ~3s");

// ---------- D. Correct / wrong placement ----------
{
  const { sol, gen } = makePuzzle(7, "easy");
  T.setMode("classic", true);
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const f = T.firstPlayable();
  T.selectCell(f.r, f.c);
  T.placeNumber(sol[f.r][f.c]);
  s = T.snap();
  eq(s.values[f.r][f.c], sol[f.r][f.c], "correct value placed");
  eq(s.combo, 1, "combo increments");
  eq(s.score, 12, "first correct scores 12");
  ok(s.stats.correctCells >= 1, "correct cell counted");

  // wrong
  let target = null;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (gen.playable[r][c] && s.values[r][c] === 0) { target = { r, c }; break; }
  T.selectCell(target.r, target.c);
  T.placeNumber(sol[target.r][target.c] % 9 + 1);
  s = T.snap();
  eq(s.mistakes, 1, "wrong entry counts a mistake");
  eq(s.combo, 0, "combo resets");
}

// ---------- E. Run sums + completion ----------
{
  const { sol, gen } = makePuzzle(11, "easy");
  T.setMode("classic", true);
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  // fill one run correctly
  const run = gen.runs[0];
  for (const [r, c] of run.cells) {
    T.selectCell(r, c);
    T.placeNumber(sol[r][c]);
  }
  s = T.snap();
  ok(T.runComplete(run), "completed run matches its sum");
  let allFilled = run.cells.every(([r, c]) => s.values[r][c] === sol[r][c]);
  ok(allFilled, "run cells all correct");
}

// ---------- F. Notes / undo / redo ----------
{
  const { sol, gen } = makePuzzle(13, "easy");
  T.setMode("classic", true);
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const f = T.firstPlayable();
  T.selectCell(f.r, f.c);
  T.toggleNotes();
  eq(T.snap().notesMode, true, "notes on");
  T.placeNumber(5);
  s = T.snap();
  ok(s.notes[f.r][f.c].includes(5), "note added");
  T.toggleNotes();
  eq(T.snap().notesMode, false, "notes off");
  T.placeNumber(sol[f.r][f.c]);
  s = T.snap();
  eq(s.values[f.r][f.c], sol[f.r][f.c], "value placed");
  const after = s.score;
  T.undo();
  s = T.snap();
  eq(s.values[f.r][f.c], 0, "undo clears");
  eq(s.score, 0, "undo restores score");
  T.redo();
  s = T.snap();
  eq(s.values[f.r][f.c], sol[f.r][f.c], "redo reapplies");
  eq(s.score, after, "redo restores score");
}

// ---------- G. Hint ----------
{
  const { sol, gen } = makePuzzle(17, "easy");
  T.setMode("classic", true);
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const f = T.firstPlayable();
  T.selectCell(f.r, f.c);
  T.useHint();
  s = T.snap();
  eq(s.values[f.r][f.c], sol[f.r][f.c], "hint fills correctly");
  eq(s.hintsLeft, 2, "hint consumed");
  eq(s.hintsUsed, 1, "hint usage counted");
  ok(s.unlocked.includes("hint"), "Hint Master unlocks");
}

// ---------- H. Mistake limit ----------
{
  T.setMode("attack", true);
  const { sol, gen } = makePuzzle(19, "easy");
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  let empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (gen.playable[r][c]) empties.push({ r, c });
  for (let i = 0; i < 3; i++) {
    const e = empties[i];
    T.selectCell(e.r, e.c);
    T.placeNumber(sol[e.r][e.c] % 9 + 1);
  }
  s = T.snap();
  eq(s.mistakes, 3, "three mistakes counted");
  eq(s.over, true, "third mistake ends");
  eq(s.overlayTitle, "Out of Mistakes", "mistake overlay", s.overlayTitle);
}

// ---------- I. Mode UI ----------
T.setMode("daily", true);
s = T.snap();
eq(s.mode, "daily", "daily active");
eq(s.diffHidden, true, "difficulty hidden in daily");
eq(s.newGameDisabled, true, "new puzzle disabled in daily");
deepEq(s.modePressed, ["false", "false", "true"], "daily chip pressed");
T.setMode("attack", true);
s = T.snap();
eq(s.diffHidden, false, "difficulty visible in attack");
T.setMode("classic", true);
s = T.snap();
deepEq(s.modePressed, ["true", "false", "false"], "classic chip pressed");
eq(s.hintsLeft, 3, "hints restored");

// ---------- J. Win ----------
{
  const { sol, gen } = makePuzzle(23, "easy");
  T.setMode("classic", true);
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  // fill all but one cell
  const empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (gen.playable[r][c]) empties.push({ r, c });
  const last = empties[empties.length - 1];
  for (const e of empties) {
    if (e === last) continue;
    T.selectCell(e.r, e.c);
    T.placeNumber(sol[e.r][e.c]);
    if (T.snap().over) break;
  }
  s = T.snap();
  if (!s.over) {
    T.selectCell(last.r, last.c);
    T.placeNumber(sol[last.r][last.c]);
    s = T.snap();
  }
  eq(s.over, true, "completing the board wins");
  eq(s.won, true, "win flag set");
  eq(s.overlayTitle, "Solved! 🎉", "win overlay", s.overlayTitle);
  ok(s.score > 0, "win awards points", s.score);
  ok(s.stats.solves >= 1, "solve counted");
}

// ---------- K. Best persistence ----------
{
  T.setMode("classic", true);
  T.setDiff("hard");
  const { sol, gen } = makePuzzle(29, "hard");
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (gen.playable[r][c]) empties.push({ r, c });
  for (const e of empties) {
    T.selectCell(e.r, e.c);
    T.placeNumber(sol[e.r][e.c]);
    if (T.snap().over) break;
  }
  T.setState({ elapsed: 200000 });
  s = T.snap();
  ok(storage.has("kakuro-best-v1-classic-hard"), "best persisted per mode/diff", storage.get("kakuro-best-v1-classic-hard"));
}

// ---------- L. Daily streak ----------
{
  T.setMode("daily", true);
  const { sol, gen } = makePuzzle(31, "medium");
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const empties = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (gen.playable[r][c]) empties.push({ r, c });
  for (const e of empties) {
    T.selectCell(e.r, e.c);
    T.placeNumber(sol[e.r][e.c]);
    if (T.snap().over) break;
  }
  T.setState({ elapsed: 42000 });
  s = T.snap();
  eq(s.over, true, "daily solve completes");
  eq(s.daily.streak, 1, "streak starts at 1");
  eq(s.daily.lastDate, T.dateStr(), "last date is today");
  ok(s.stats.dailySolves >= 1, "daily solve counted");
  ok(s.unlocked.includes("daily"), "Daily Habit unlocks");
}

// ---------- M. Achievements ----------
{
  T.setMode("classic", true);
  T.stats.maxCombo = 5;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("combo5"), "combo5 unlocks");
  T.stats.maxCombo = 10;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("combo10"), "combo10 unlocks");
  T.stats.maxCombo = 15;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("combo15"), "combo15 unlocks");
  T.stats.solvesEasy = 1;
  T.stats.solvesMedium = 1;
  T.stats.solvesHard = 1;
  T.stats.solvesExpert = 1;
  T.checkAchievements();
  ok(T.snap().unlocked.includes("allDiffs"), "allDiffs unlocks");
}

// ---------- O. Clue numbers ----------
{
  T.setMode("classic", true);
  const { sol, gen } = makePuzzle(37, "medium");
  T.setPuzzle(sol, gen.playable, gen.runs, gen.runsAt);
  const board = elements.get("board");
  let clueCells = 0;
  let tris = 0;
  let bad = 0;
  const problems = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (gen.playable[r][c]) continue;
      clueCells++;
      const wrap = board.children[r * 9 + c];
      if (!wrap) { bad++; continue; }
      const clue = wrap.children.find((ch) => (ch.className || "").includes("kakuro-clue"));
      if (!clue) { bad++; continue; }
      const spans = clue.children.filter((ch) => (ch.className || "").includes("kakuro-clue__tri"));
      tris += spans.length;
      const down = spans.find((sp) => sp.className.includes("--down"));
      const right = spans.find((sp) => sp.className.includes("--right"));
      const downRun = T.clueRun(r, c, "v");
      const rightRun = T.clueRun(r, c, "h");
      const fail = (why) => {
        bad++;
        if (problems.length < 8) problems.push({ r, c, why, down: down && down.textContent, right: right && right.textContent, downSum: downRun && downRun.sum, rightSum: rightRun && rightRun.sum, split: clue.classList.contains("kakuro-clue--split") });
      };
      if (downRun) {
        if (!down || String(down.textContent) !== String(downRun.sum)) fail("down");
      } else if (down) fail("unexpected-down");
      if (rightRun) {
        if (!right || String(right.textContent) !== String(rightRun.sum)) fail("right");
      } else if (right) fail("unexpected-right");
      // Every run must have a clue at its top-left corner.
      if (downRun && !clue.classList.contains("kakuro-clue--split")) fail("split");
    }
  }
  ok(clueCells > 0, "board has clue cells", clueCells);
  ok(tris > 0, "clues render sum triangles", tris);
  eq(bad, 0, "every clue triangle matches the run it describes " + JSON.stringify(problems));

  // No digit repeats within a run.
  const run = gen.runs.find((x) => x.cells.length >= 2);
  const [r0, c0] = run.cells[0];
  const [r1, c1] = run.cells[1];
  const v = sol[r0][c0];
  T.state.values[r0][c0] = v;
  T.state.values[r1][c1] = v;
  ok(T.runConflict(r1, c1, v), "duplicate digit in a run is a conflict");
}

// ---------- N. Persistence + long run ----------
ok(!!storage.get("kakuro-stats-v1"), "stats persisted");
ok(!!storage.get("kakuro-achv-v1"), "achievements persisted");
T.setMode("classic", true);
T.reset();
try { frames(600); ok(true, "long frame run without runtime errors"); }
catch (err) { ok(false, "long frame run threw", String(err)); }

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);