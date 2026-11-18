// Deterministic tests for games/tower-of-hanoi/script.js
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
  "moves", "min-moves", "best", "solved",
  "board", "ring-select", "undo-btn", "solve-btn", "cancel-btn", "new-game", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("cancel-btn").hidden = true;

// Peg elements with stable stacks — the game queries them at load.
function makePeg(p) {
  const peg = makeEl("div", "peg-" + p);
  peg.dataset.peg = String(p);
  const stack = makeEl("div", "peg-stack-" + p);
  peg.querySelector = (sel) => (sel === ".peg__stack" ? stack : makeEl("span"));
  peg.querySelectorAll = () => [];
  peg.stackEl = stack;
  return peg;
}
const pegEls = [makePeg(0), makePeg(1), makePeg(2)];
elements.get("board").querySelectorAll = (sel) => (sel === ".peg" ? pegEls : []);

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
  setTimeout: () => ++timerSeq, // never runs — timers are driven by hand
  clearTimeout: () => {},
  setInterval: () => ++timerSeq, // never fires — tests step the auto-solver
  clearInterval: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
Math.random = () => 0.5; // deterministic confetti

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Legacy saves from the pre-core build — must migrate.
storage.set("hanoi-wins", "3");
storage.set("hanoi-best-4", "20");
storage.set("hanoi-best-7", "130");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/tower-of-hanoi/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__HANOI;
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

// Optimal move plans (source, dest peg pairs) — the classic recursive solution.
function optimalPlan(n, out) {
  (function rec(k, from, to, aux) {
    if (k === 1) { out.push([from, to]); return; }
    rec(k - 1, from, aux, to);
    out.push([from, to]);
    rec(k - 1, aux, to, from);
  })(n, 0, 2, 1);
  return out;
}
function play(plan) {
  for (const [a, b] of plan) {
    T.click(a);
    T.click(b);
  }
}
const OPT3 = optimalPlan(3, []);
const OPT4 = optimalPlan(4, []);
const OPT5 = optimalPlan(5, []);
const OPT6 = optimalPlan(6, []);
const OPT7 = optimalPlan(7, []);

// ---------- A. Init + legacy migration ----------
{
  eq(T.ringCount, 4, "default is 4 rings");
  eq(JSON.stringify(T.pegs()), JSON.stringify([[4, 3, 2, 1], [], []]), "fresh tower on the start peg");
  eq(T.moves, 0, "no moves yet");
  eq(T.held, null, "nothing held");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.autoPlaying, false, "not auto-playing");
  eq(T.stats.games, 3, "legacy hanoi-wins migrated into stats.games");
  eq(T.bestFor(4), 20, "legacy hanoi-best-4 migrated to the best record");
  eq(T.bestFor(7), 130, "legacy hanoi-best-7 migrated");
  eq(storage.has("hanoi-wins"), false, "legacy hanoi-wins removed");
  eq(storage.has("hanoi-best-4"), false, "legacy hanoi-best-4 removed");
  eq(storage.has("hanoi-best-7"), false, "legacy hanoi-best-7 removed");
  eq(storage.has("hanoi-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("solved").textContent, 3, "Solved HUD shows migrated value");
  eq(elements.get("best").textContent, "20", "Best HUD shows migrated 4-ring record");
  eq(elements.get("min-moves").textContent, 15, "minimum for 4 rings is 15");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const ids2 = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(ids2).size, 14, "badge ids are unique");
  const stack0 = pegEls[0].stackEl;
  eq(stack0.children.length, 4, "4 discs rendered on the start peg");
  // A flex column paints its first child at the top: the visual order must be
  // smallest → largest from top to bottom, even though pegs[0] is [4,3,2,1].
  const drawn = stack0.children.map((c) => parseInt(c.style.width, 10));
  eq(drawn[0], 46, "the smallest ring is drawn first (at the top)");
  eq(drawn[drawn.length - 1], 146, "the largest ring is drawn last (at the bottom)");
  ok(drawn.every((w, i) => i === 0 || w > drawn[i - 1]), "rings widen downwards — not upside down", drawn);
}

// ---------- B. Move mechanics ----------
{
  T.click(1);
  eq(T.held, null, "clicking an empty peg does nothing");
  eq(T.moves, 0, "no move made");

  T.click(0);
  eq(T.held, 0, "top disc lifted from the start peg");
  eq(T.hint(), "Disc lifted — click a highlighted peg to drop it, or the same peg to set it back.", "hint updates on lift");

  T.click(0);
  eq(T.held, null, "clicking the same peg cancels the lift");
  eq(T.moves, 0, "cancel makes no move");

  T.click(0);
  eq(T.held, 0, "lifted again");
  T.click(1);
  eq(JSON.stringify(T.pegs()), JSON.stringify([[4, 3, 2], [1], []]), "smallest disc moved to the spare peg");
  eq(T.moves, 1, "move counted");
  eq(T.stats.totalMoves, 1, "career move counted");
  eq(pegEls[1].stackEl.children[0].classList.contains("disc--drop"), true, "the landed ring animates in");
  eq(pegEls[1].classList.contains("peg--drop"), true, "the destination plinth flashes");

  T.click(0);
  eq(T.held, 0, "second disc lifted");
  T.click(1);
  eq(T.moves, 1, "larger disc cannot land on a smaller one");
  eq(T.held, 0, "still holding the disc after a rejected drop");
  eq(T.hint(), "A larger disc can't sit on a smaller one!", "error hint shown");
  eq(pegEls[1].classList.contains("peg--shake"), true, "rejected peg shakes");

  T.click(2);
  eq(JSON.stringify(T.pegs()), JSON.stringify([[4, 3], [1], [2]]), "second disc on the goal peg");
  eq(T.moves, 2, "second move counted");

  // Keyboard pegs 1/2/3
  keydown("1");
  eq(T.held, 0, "key 1 lifts from the start peg");
  keydown("3");
  eq(T.moves, 2, "key 3 rejects a larger disc on a smaller one");
  keydown("1");
  eq(T.held, null, "key 1 again cancels the lift");
  eq(T.moves, 2, "still two moves");
}

// ---------- C. Optimal 4-ring win ----------
{
  T.newGame();
  eq(JSON.stringify(T.pegs()), JSON.stringify([[4, 3, 2, 1], [], []]), "new game restores the tower");
  play(OPT4);
  eq(T.gameOver, true, "win after the last disc lands on the goal peg");
  eq(T.overlayTitle(), "Tower Solved! 🎉", "win overlay shown");
  const msg = T.overlay.info().msg || "";
  ok(msg.indexOf("perfect") !== -1, "win message mentions the perfect solve", { msg });
  ok(msg.indexOf("New best") !== -1, "win message mentions the new record", { msg });
  eq(T.stats.games, 4, "game counted (3 migrated + 1)");
  eq(T.stats.solved4, 1, "4-ring solve recorded");
  eq(T.stats.perfect, 1, "optimal solve recorded");
  eq(T.stats.perfect5, 0, "not a 5+ ring solve yet");
  eq(T.stats.totalMoves, 17, "career moves = 2 + 15");
  eq(T.stats.records, 1, "first 4-ring record set (20 -> 15)");
  eq(T.bestFor(4), 15, "4-ring best updated to 15");
  eq(elements.get("solved").textContent, 4, "Solved HUD updated");
  eq(elements.get("best").textContent, "15", "Best HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Steps badge unlocks");
  ok(u.includes("perfect"), "Optimal badge unlocks");
  ok(!u.includes("games5"), "Puzzle Fan still locked at 4 games");
  T.overlay.hide();
}

// ---------- D. Non-optimal 4-ring win (no new record) ----------
{
  T.newGame();
  play([[0, 1], [1, 0]]); // wobble: move disc 1 out and back
  play(OPT4);
  eq(T.gameOver, true, "game over");
  eq(T.moves, 17, "solved in 17 moves");
  eq(T.stats.games, 5, "fifth game");
  eq(T.stats.solved4, 2, "second 4-ring solve");
  eq(T.stats.perfect, 1, "perfect count unchanged");
  eq(T.stats.records, 1, "17 moves is not a new record");
  eq(T.bestFor(4), 15, "best stays at 15");
  ok(T.unlocked().includes("games5"), "Puzzle Fan badge unlocks at 5 games");
  T.overlay.hide();
}

// ---------- E. Undo ----------
{
  T.newGame();
  T.click(0);
  T.click(1);
  eq(T.moves, 1, "one move made");
  T.undo();
  eq(T.moves, 0, "undo reverts the move");
  eq(JSON.stringify(T.pegs()), JSON.stringify([[4, 3, 2, 1], [], []]), "tower restored by undo");
  eq(T.stats.undone, 1, "undo counted");
  T.undo();
  eq(T.stats.undone, 1, "undo with an empty history is a no-op");
  T.click(0);
  eq(T.held, 0, "can lift after undo");
  T.undo();
  eq(T.held, 0, "blocked undo leaves the held disc");
  eq(T.stats.undone, 1, "blocked undo not counted");
  T.click(0);
  eq(T.held, null, "lift cancelled by clicking the same peg");
}

// ---------- F. Auto-solve ----------
{
  T.newGame();
  T.solve();
  eq(T.autoPlaying, true, "auto-play running");
  eq(elements.get("solve-btn").hidden, true, "solve button hidden while playing");
  eq(elements.get("cancel-btn").hidden, false, "cancel button visible");
  eq(elements.get("ring-select").disabled, true, "ring select disabled");
  for (let i = 0; i < 15; i++) T.step();
  eq(T.gameOver, true, "auto-solve finishes in 15 optimal moves");
  eq(T.autoPlaying, false, "auto-play stopped on win");
  eq(T.stats.games, 6, "auto-solve counts as a game");
  eq(T.stats.perfect, 2, "auto-solve was optimal");
  eq(T.stats.records, 1, "tied best is not a new record");

  // Cancel mid-solve
  T.newGame();
  T.solve();
  T.step();
  T.step();
  T.step();
  eq(T.moves, 3, "three auto moves played");
  T.stopAuto();
  eq(T.autoPlaying, false, "cancel stops auto-play");
  eq(T.gameOver, false, "game still in progress");
  eq(T.stats.totalMoves, 53, "auto moves count toward the career total");
}

// ---------- G. 3-ring win ----------
{
  T.setRings(3);
  eq(T.ringCount, 3, "ring count switched to 3");
  eq(JSON.stringify(T.pegs()), JSON.stringify([[3, 2, 1], [], []]), "3-disc tower");
  play(OPT3);
  eq(T.gameOver, true, "3-ring win");
  eq(T.stats.games, 7, "seventh game");
  eq(T.stats.solved3, 1, "3-ring solve recorded");
  eq(T.stats.perfect, 3, "third perfect solve");
  eq(T.stats.records, 2, "first 3-ring record set");
  ok(T.unlocked().includes("rings3"), "Warm-Up badge unlocks");
  T.overlay.hide();
}

// ---------- H. 5-ring win ----------
{
  T.setRings(5);
  eq(OPT5.length, 31, "5-ring optimum is 31 moves");
  play(OPT5);
  eq(T.gameOver, true, "5-ring win");
  eq(T.stats.games, 8, "eighth game");
  eq(T.stats.solved5, 1, "5-ring solve recorded");
  eq(T.stats.perfect, 4, "fourth perfect solve");
  eq(T.stats.perfect5, 1, "5+ ring perfect recorded");
  eq(T.stats.records, 3, "first 5-ring record set");
  ok(T.unlocked().includes("rings5"), "Getting Tall badge unlocks");
  ok(T.unlocked().includes("perfect5"), "Flawless Five badge unlocks");
  T.overlay.hide();
}

// ---------- I. 7-ring win (crosses the 100-move career line) ----------
{
  T.setRings(7);
  eq(OPT7.length, 127, "7-ring optimum is 127 moves");
  play(OPT7);
  eq(T.gameOver, true, "7-ring win");
  eq(T.stats.games, 9, "ninth game");
  eq(T.stats.solved7, 1, "7-ring solve recorded");
  eq(T.stats.perfect5, 2, "second 5+ ring perfect");
  eq(T.stats.records, 4, "7-ring beat the migrated best of 130");
  eq(T.bestFor(7), 127, "7-ring best updated to 127");
  eq(T.stats.totalMoves, 218, "career moves cross 100");
  ok(T.unlocked().includes("rings7"), "Seven Rings badge unlocks");
  ok(T.unlocked().includes("moves100"), "Moving Day badge unlocks at 100+ moves");
  T.overlay.hide();
}

// ---------- J. 6-ring win (every size, 10 games, 5 records) ----------
{
  T.setRings(6);
  eq(OPT6.length, 63, "6-ring optimum is 63 moves");
  play(OPT6);
  eq(T.gameOver, true, "6-ring win");
  eq(T.stats.games, 10, "tenth game");
  eq(T.stats.solved6, 1, "6-ring solve recorded");
  eq(T.stats.records, 5, "fifth record set");
  eq(T.stats.totalMoves, 281, "career total");
  const u = T.unlocked();
  ok(u.includes("games10"), "Tower Builder badge unlocks at 10 games");
  ok(u.includes("allRings"), "Every Size badge unlocks (all 5 sizes solved)");
  ok(u.includes("records5"), "Record Setter badge unlocks at 5 records");
  eq(u.length, 11, "11 badges unlocked so far");
  ok(!u.includes("games25"), "Hanoi Master still locked");
  ok(!u.includes("moves1000"), "Marathon still locked");
  ok(!u.includes("undo10"), "Second Thoughts still locked");
  T.overlay.hide();
}

// ---------- K. Undo badge ----------
{
  T.newGame();
  for (let i = 0; i < 10; i++) {
    T.click(0);
    T.click(1);
    T.undo();
  }
  eq(T.stats.undone, 11, "eleven undos in total");
  ok(T.unlocked().includes("undo10"), "Second Thoughts badge unlocks at 10 undos");
  eq(T.unlocked().length, 12, "12 badges unlocked");
}

// ---------- L. Pause ----------
{
  eq(T.paused, false, "not paused before the test");
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.click(0);
  eq(T.held, null, "peg clicks blocked while paused");
  keydown("1");
  eq(T.held, null, "keyboard pegs blocked while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.click(0);
  eq(T.held, 0, "moves work after resume");
  T.click(0);

  // Pausing kills a running auto-solve
  T.newGame();
  T.solve();
  eq(T.autoPlaying, true, "auto-play running");
  keydown("p");
  eq(T.paused, true, "paused during auto-play");
  eq(T.autoPlaying, false, "auto-play stopped by pause");
  T.togglePause();
  eq(T.paused, false, "resumed");
  eq(T.autoPlaying, false, "auto-play stays off after resume");

  // Blur / visibility auto-pause
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
  play(OPT6);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Tower Solved! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- M. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("hanoi-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("hanoi-sound"), "on", "preference restored");
}

// ---------- N. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "12 / 14", "modal shows 12 of 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 12, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);
