// Deterministic tests for games/word-ladder/script.js
// Puzzles are installed directly through the test hook so the BFS stays
// deterministic; BRICK -> THANK is the known-shortest 3-step ladder.
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
    offsetWidth: 100,
    style: { setProperty() {}, removeProperty() {} },
    _attrs: {},
    _listeners: {},
    classList: makeClassList(),
    appendChild(c) {
      if (c && c.__fragment) {
        c.children.slice().forEach((child) => this.appendChild(child));
        c.children = [];
        return c;
      }
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
  "start-word", "target-word", "chain", "rung-form", "rung-input", "message",
  "wins", "streak", "steps", "best-steps", "hint-btn", "undo-btn", "giveup-btn",
  "new-puzzle", "hint", "badges-btn", "badge-count", "badges2", "sound-btn",
  "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("rung-input").tagName = "INPUT";
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createDocumentFragment: () => {
    const f = makeEl("fragment");
    f.__fragment = true;
    return f;
  },
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
storage.set("wordladder-wins", "2");
storage.set("wordladder-best-steps", "5");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/word-ladder/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__WORDLADDER;
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
function diffCount(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}
function hud(id) {
  return elements.get(id).textContent;
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.WORD_LEN, 5, "five-letter words");
  eq(T.FAST_STEPS, 4, "shortcut threshold is 4 steps");
  eq(T.stats.wins, 2, "legacy wins migrated");
  eq(T.stats.bestSteps, 5, "legacy best ladder migrated");
  eq(T.stats.games, 0, "legacy data did not invent games");
  eq(T.stats.losses, 0, "no give-ups yet");
  eq(T.stats.steps, 0, "no rungs yet");
  eq(T.stats.hints, 0, "no hints yet");
  eq(T.stats.undos, 0, "no undos yet");
  eq(storage.has("wordladder-wins"), false, "legacy wins key removed");
  eq(storage.has("wordladder-best-steps"), false, "legacy best-steps key removed");
  eq(storage.has("word-ladder-stats-v1"), true, "stats persisted under the core key");
  eq(hud("wins"), 2, "Wins HUD shows the migrated value");
  eq(hud("streak"), 0, "Streak HUD starts at 0");
  eq(hud("steps"), 0, "Steps HUD starts at 0");
  eq(hud("best-steps"), 5, "Best HUD shows the migrated value");
  ok(T.puzzle && T.WORD_SET.has(T.puzzle.start), "a real start word was generated", T.puzzle);
  ok(T.WORD_SET.has(T.puzzle.target), "a real target word was generated", T.puzzle);
  ok(T.puzzle.start !== T.puzzle.target, "start and target differ");
  ok(T.optimalLen >= 3, "generated puzzles are at least 3 steps", T.optimalLen);
  eq(T.chain.length, 1, "the chain starts with the start word");
  eq(T.chain[0], T.puzzle.start, "chain[0] is the start word");
  eq(T.roundOver, false, "not over");
  eq(T.paused, false, "not paused");
  eq(elements.get("start-word").children.length, 5, "five start tiles rendered");
  eq(elements.get("target-word").children.length, 5, "five target tiles rendered");
  eq(elements.get("chain").children.length, 1, "one rung rendered");
  ok(elements.get("chain").children[0].classList.contains("rung--start"), "first rung marked start");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges unlocked before the first check");
  eq(T.overlayTitle(), null, "no overlay at start");
  ok(elements.get("hint").textContent.indexOf("Esc pauses") !== -1, "hint mentions Esc");
  eq(T.WORD_SET.size >= 1000, true, "word list is large", T.WORD_SET.size);
}

// ---------- B. Validation + a six-step (non-optimal) win ----------
{
  T.setPuzzle("BRICK", "THANK");
  eq(T.puzzle.start, "BRICK", "start pinned");
  eq(T.puzzle.target, "THANK", "target pinned");
  eq(T.optimalLen, 4, "BRICK -> THANK needs 4 steps");
  eq(T.steps, 0, "chain reset");
  eq(T.chain.length, 1, "one rung after setPuzzle");
  eq(elements.get("rung-input").disabled, false, "input enabled");
  eq(elements.get("message").textContent, "", "no message yet");

  T.addRung("BRICKS");
  eq(T.chain.length, 1, "a six-letter word is rejected");
  eq(elements.get("message").textContent, "Enter a 5-letter word.", "length error shown");
  T.addRung("BRICK");
  eq(elements.get("message").textContent, "That's the same as the current rung.", "same-word error shown");
  T.addRung("BRAKE");
  eq(elements.get("message").textContent, "Change exactly ONE letter — this differs by 3.", "one-letter error shown");
  T.addRung("BRICE");
  eq(elements.get("message").textContent, '"BRICE" is not in the word list.', "word-list error shown");
  eq(T.stats.steps, 0, "rejected words add no rungs");

  T.addRung("trick");
  eq(T.chain.join(" "), "BRICK TRICK", "accepted rung lowercased input is normalised");
  eq(T.stats.steps, 1, "career rung counted");
  eq(hud("steps"), 1, "Steps HUD updated");
  eq(elements.get("message").textContent, "", "message cleared on success");

  T.addRung("THICK");
  T.addRung("THINK");
  eq(T.steps, 3, "three steps taken");
  eq(T.stats.steps, 3, "three career rungs");
  eq(T.roundOver, false, "target not reached yet");

  // Deliberate backtrack through BRINK: six steps, two more than the optimum.
  T.setPuzzle("BRICK", "THANK");
  for (const w of ["BRINK", "BRICK", "TRICK", "THICK", "THINK"]) T.addRung(w);
  eq(T.steps, 5, "five detour steps");
  eq(T.stats.steps, 8, "five more career rungs");
  T.addRung("THANK");
  eq(T.roundOver, true, "reaching the target ends the round");
  eq(T.steps, 6, "finished in 6 steps");
  eq(T.overlayTitle(), "You made it! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("BRICK → THANK in 6 steps.") !== -1, "win message", T.overlayMsg());
  eq((T.overlayMsg() || "").indexOf("a new best") === -1, true, "6 steps is not a new best");
  ok((T.overlayMsg() || "").indexOf("Wins: 3 · Best ever: 5 steps.") !== -1, "record line", T.overlayMsg());
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.optimalWins, 0, "a 6-step route is not optimal");
  eq(T.stats.noHintWins, 1, "hint-free win counted");
  eq(T.stats.fastWins, 0, "a 6-step win is not a shortcut");
  eq(T.stats.bestSteps, 5, "career best stays at the legacy 5");
  eq(hud("wins"), 3, "Wins HUD updated");
  eq(hud("best-steps"), 5, "Best HUD unchanged");
  eq(elements.get("chain").children.length, 13, "seven rungs plus six arrows");
  const lastRung = elements.get("chain").children[elements.get("chain").children.length - 1];
  ok(lastRung.classList.contains("rung--target"), "final rung marked target");
  eq(elements.get("rung-input").disabled, true, "input disabled after the win");
  T.addRung("THANK");
  eq(T.stats.games, 1, "input is ignored after the win");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  eq(u.length, 1, "one badge unlocked");
  T.overlay.hide();
}

// ---------- C. Undo, hint, then the optimal win ----------
{
  T.setPuzzle("BRICK", "THANK");
  eq(T.roundOver, false, "new puzzle is live");
  eq(T.stats.steps, 9, "career rungs survive the new puzzle");

  T.addRung("TRICK");
  eq(T.stats.steps, 10, "career rung counted");
  T.undo();
  eq(T.chain.join(" "), "BRICK", "undo removes the last rung");
  eq(T.steps, 0, "in-game steps back to 0");
  eq(T.stats.steps, 10, "career rungs survive the undo");
  eq(T.stats.undos, 1, "undo counted");
  eq(hud("steps"), 0, "Steps HUD reset");
  T.undo();
  eq(T.stats.undos, 1, "undoing the start rung is a no-op");

  T.useHint();
  eq(T.stats.hints, 1, "hint counted");
  eq(T.hintUsed, true, "hint marked used for this game");
  ok(/^Hint: [A-Z]{5} — now press Add Step\.$/.test(elements.get("message").textContent), "hint message", elements.get("message").textContent);
  const hinted = elements.get("rung-input").value;
  eq(hinted.length, 5, "hint fills the input");
  ok(T.WORD_SET.has(hinted), "the hint is a real word", hinted);
  eq(diffCount(hinted, "BRICK"), 1, "the hint differs by one letter", hinted);

  const solution = T.solution();
  eq(solution.length, 4, "solution has four rungs");
  eq(solution[solution.length - 1], "THANK", "solution ends at the target");
  for (let i = 0; i < solution.length; i++) {
    const prev = i === 0 ? "BRICK" : solution[i - 1];
    eq(diffCount(solution[i], prev), 1, "solution rung " + (i + 1) + " differs by one letter");
  }
  for (const w of solution) T.addRung(w);
  eq(T.roundOver, true, "optimal solution finishes the ladder");
  eq(T.steps, 4, "four steps");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.wins, 4, "fourth win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.optimalWins, 1, "shortest-path win counted");
  eq(T.stats.noHintWins, 1, "the hinted win does not count as unassisted");
  eq(T.stats.fastWins, 1, "a 4-step win is a shortcut");
  eq(T.stats.steps, 14, "four more career rungs");
  eq(T.stats.bestSteps, 4, "career best improved to 4");
  ok((T.overlayMsg() || "").indexOf("in 4 steps — a new best!") !== -1, "4-step win message", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best ever: 4 steps.") !== -1, "best line", T.overlayMsg());
  const u = T.unlocked();
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  ok(u.includes("optimal1"), "Tight Ladder badge unlocks");
  ok(u.includes("fastWin"), "Shortcut badge unlocks");
  eq(u.length, 4, "four badges unlocked");
  T.overlay.hide();
}

// ---------- D. Four more unassisted optimal wins ----------
{
  for (let i = 0; i < 4; i++) {
    T.setPuzzle("BRICK", "THANK");
    for (const w of T.solution()) T.addRung(w);
    eq(T.roundOver, true, "optimal win " + (i + 1) + " recorded");
    eq(T.stats.optimalWins, 2 + i, "optimal win counted");
    T.overlay.hide();
  }
  eq(T.stats.games, 6, "six games");
  eq(T.stats.wins, 8, "eight wins");
  eq(T.stats.streak, 6, "streak is 6");
  eq(T.stats.bestStreak, 6, "best streak is 6");
  eq(T.stats.optimalWins, 5, "five optimal wins");
  eq(T.stats.noHintWins, 5, "five unassisted wins");
  eq(T.stats.fastWins, 5, "five shortcuts");
  eq(T.stats.steps, 30, "thirty career rungs");
  eq(T.stats.bestSteps, 4, "best stays 4");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  ok(u.includes("optimal5"), "Pathfinder badge unlocks");
  ok(u.includes("noHint5"), "Unassisted badge unlocks");
  eq(u.length, 8, "eight badges unlocked");
}

// ---------- E. Six more wins reach 50 career rungs ----------
{
  for (let i = 0; i < 6; i++) {
    T.setPuzzle("BRICK", "THANK");
    for (const w of T.solution()) T.addRung(w);
    eq(T.roundOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.games, 12, "twelve games");
  eq(T.stats.wins, 14, "fourteen wins");
  eq(T.stats.streak, 12, "streak is 12");
  eq(T.stats.bestStreak, 12, "best streak is 12");
  eq(T.stats.optimalWins, 11, "eleven optimal wins");
  eq(T.stats.noHintWins, 11, "eleven unassisted wins");
  eq(T.stats.fastWins, 11, "eleven shortcuts");
  eq(T.stats.steps, 54, "fifty-four career rungs");
  const u = T.unlocked();
  ok(u.includes("win10"), "Champion badge unlocks");
  ok(u.includes("steps50"), "Steady Climber badge unlocks");
  eq(u.length, 10, "ten badges unlocked");
}

// ---------- F. Twenty-five hints ----------
{
  T.setPuzzle("BRICK", "THANK");
  for (let i = 0; i < 24; i++) T.useHint();
  eq(T.stats.hints, 25, "twenty-five hints used");
  eq(T.stats.games, 12, "hints do not count as games");
  ok(T.unlocked().includes("hints25"), "Helping Hand badge unlocks");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
}

// ---------- G. Ten undos ----------
{
  T.setPuzzle("BRICK", "THANK");
  const firstStep = T.solution()[0];
  for (let i = 0; i < 9; i++) {
    T.addRung(firstStep);
    eq(T.steps, 1, "rung added for undo " + (i + 1));
    T.undo();
    eq(T.steps, 0, "rung removed for undo " + (i + 1));
  }
  eq(T.stats.undos, 10, "ten undos");
  eq(T.stats.steps, 63, "career rungs keep counting through undos");
  eq(T.chain.join(" "), "BRICK", "back at the start");
  ok(T.unlocked().includes("undo10"), "Second Thoughts badge unlocks");
  eq(T.unlocked().length, 12, "twelve badges unlocked");
}

// ---------- H. Eight give-ups ----------
{
  for (let i = 0; i < 8; i++) {
    T.setPuzzle("BRICK", "THANK");
    T.giveUp();
    eq(T.roundOver, true, "give-up " + (i + 1) + " ends the round");
    eq(T.overlayTitle(), "Solution 🏳", "solution overlay shown");
    ok((T.overlayMsg() || "").indexOf("From your current rung:") !== -1, "solution framing", T.overlayMsg());
    ok((T.overlayMsg() || "").indexOf("THANK") !== -1, "solution reaches the target", T.overlayMsg());
    ok((T.overlayMsg() || "").indexOf("No win credited.") !== -1, "no win credited", T.overlayMsg());
    eq(elements.get("rung-input").disabled, true, "input disabled after giving up");
    T.overlay.hide();
  }
  eq(T.stats.games, 20, "twenty games");
  eq(T.stats.losses, 8, "eight give-ups");
  eq(T.stats.wins, 14, "wins unchanged");
  eq(T.stats.streak, 0, "give-ups reset the streak");
  eq(T.stats.bestStreak, 12, "best streak kept");
  ok(T.unlocked().includes("games20"), "Dedicated badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
  ok(!T.unlocked().includes("losses10"), "Persistence still locked at 8 give-ups");
}

// ---------- I. Random puzzle generation ----------
{
  T.newPuzzle();
  ok(T.puzzle && T.WORD_SET.has(T.puzzle.start), "generated start is real", T.puzzle);
  ok(T.WORD_SET.has(T.puzzle.target), "generated target is real", T.puzzle);
  ok(T.puzzle.start !== T.puzzle.target, "generated pair differs");
  ok(T.optimalLen >= 3 && T.optimalLen <= 6, "generated puzzle length in range", T.optimalLen);
  eq(T.chain.length, 1, "new puzzle starts a fresh chain");
  eq(T.roundOver, false, "new puzzle is live");
  eq(elements.get("rung-input").disabled, false, "input enabled");
  eq(elements.get("message").textContent, "", "message cleared");
  eq(T.stats.games, 20, "generating a puzzle is not a game");
}

// ---------- J. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "optimal1", "optimal5",
    "noHint5", "fastWin", "steps50", "hints25", "undo10", "games20",
  ];
  ok(u.length === 13 && expected.every((id) => u.includes(id)), "exactly the 13 earned badges are unlocked", u);
  ok(u.indexOf("losses10") === -1, "Persistence is the only locked badge");
  eq(T.stats.games, 20, "games");
  eq(T.stats.wins, 14, "wins");
  eq(T.stats.losses, 8, "losses");
  eq(T.stats.streak, 0, "streak");
  eq(T.stats.bestStreak, 12, "best streak");
  eq(T.stats.optimalWins, 11, "optimal wins");
  eq(T.stats.noHintWins, 11, "unassisted wins");
  eq(T.stats.fastWins, 11, "shortcut wins");
  eq(T.stats.steps, 63, "career rungs");
  eq(T.stats.hints, 25, "hints");
  eq(T.stats.undos, 10, "undos");
  eq(T.stats.bestSteps, 4, "career best");
}

// ---------- K. Pause ----------
{
  T.setPuzzle("BRICK", "THANK");
  const rung = T.solution()[0];
  T.addRung(rung);
  eq(T.steps, 1, "one rung before pausing");
  const careerBefore = T.stats.steps;

  keydown("Escape", { target: { tagName: "INPUT" } });
  eq(T.paused, true, "Esc pauses even from the input");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  eq(elements.get("rung-input").disabled, true, "input disabled while paused");
  T.addRung(T.solution()[1] || "THICK");
  eq(T.steps, 1, "rungs blocked while paused");
  eq(T.stats.steps, careerBefore, "no career rung while paused");
  T.useHint();
  eq(T.stats.hints, 25, "hints blocked while paused");
  T.undo();
  eq(T.stats.undos, 10, "undos blocked while paused");
  eq(elements.get("overlay") === undefined, true, "no stray overlay element");

  keydown("Escape");
  eq(T.paused, false, "Esc resumes");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  eq(elements.get("rung-input").disabled, false, "input re-enabled");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  // Game over suppresses pause.
  T.giveUp();
  eq(T.roundOver, true, "gave up");
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after the round ends");
  eq(T.overlayTitle(), "Solution 🏳", "result overlay intact");
  T.overlay.hide();
}

// ---------- L. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("word-ladder-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("word-ladder-sound"), "on", "preference restored");
}

// ---------- M. Badges modal ----------
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
