// Deterministic tests for games/cryptogram/script.js
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
  "board", "keyboard", "solves", "time", "best", "source", "decoded", "freq", "hint", "reveal-word", "reset", "new-puzzle",
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
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Wins from the pre-core build.
storage.set("cryptogram-wins", "2");

const root = require("./_env").root;
const dir = root + "games/cryptogram/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__CRYPTOGRAM;
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
function near(a, b, tol, msg) {
  ok(Math.abs(a - b) <= tol, msg, { actual: a, expected: b, tol });
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

// A controlled puzzle with a fixed substitution (no RNG involved).
const ALPHA_MAP = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((p, i) => {
  ALPHA_MAP[p] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(i + 7) % 26];
});

function loadQuote(text, source) {
  T.setPuzzle({ text, source: source || "test", map: ALPHA_MAP });
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.games, 1, "the opening puzzle is counted");
  eq(T.stats.solves, 2, "legacy wins migrated into solves");
  eq(storage.has("cryptogram-wins"), false, "legacy key removed");
  eq(T.stats.hints, 0, "no hints yet");
  eq(T.stats.letters, 0, "no letters yet");
  eq(T.stats.flawless, 0, "no clean solves yet");
  eq(T.stats.bestTime, 0, "no best time yet");
  eq(T.quote.text, "THINK OUTSIDE THE BOX", "the first quote is deterministic");
  eq(T.quote.source, "proverb", "the source is shown");
  eq(elements.get("source").textContent, "proverb", "source line rendered");
  eq(T.solved, false, "the puzzle is unsolved");
  eq(T.paused, false, "not paused");
  eq(T.selected, null, "nothing selected");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 1, "the migrated win unlocked a badge");
  ok(T.unlocked().includes("first"), "First Decode unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(elements.get("solves").textContent, 2, "solved HUD");
  eq(elements.get("best").textContent, "—", "best HUD before any solve");
  eq(elements.get("time").textContent, 0, "timer starts at zero");

  const s = T.snap();
  eq(s.cells, 18, "one cell per letter");
  eq(s.unique, 12, "twelve distinct cipher letters");
  const seen = new Set();
  let deranged = true;
  for (const p of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (s.cipher[p] === p) deranged = false;
    seen.add(s.cipher[p]);
  }
  eq(deranged, true, "no letter maps to itself");
  eq(seen.size, 26, "the substitution is a bijection");
}

// ---------- B. Board rendering ----------
{
  const board = elements.get("board");
  eq(board.children.length, 4, "four words");
  eq(board.children.map((w) => w.children.length).join(","), "5,7,3,3", "word lengths");
  eq(board.children[0].className, "crypto-word", "word class");
  const cell = board.children[0].children[0];
  eq(cell.children.length, 2, "each cell has a cipher letter and a slot");
  eq(cell.children[0].className, "crypto-cipher", "cipher class");
  eq(cell.children[1].className, "crypto-slot", "slot class");
  eq(cell.children[0].textContent, T.snap().cipher["T"], "first letter is the T cipher");
  eq(cell.children[1].getAttribute("aria-label"), `Cipher ${T.snap().cipher["T"]}, empty`, "slot label");
  eq(elements.get("keyboard").children.length, 3, "three keyboard rows");
  eq(elements.get("keyboard").children[0].children.length, 10, "top row has ten keys");
  eq(elements.get("keyboard").children[2].children.length, 8, "bottom row has seven keys plus backspace");
}

// ---------- C. Selecting and typing ----------
{
  const cT = T.snap().cipher["T"];
  T.select(cT);
  eq(T.selected, cT, "clicking a cipher selects it");
  const board = elements.get("board");
  const slot = board.children[0].children[0].children[1];
  eq(slot.classList.contains("selected"), true, "selected cells are highlighted");

  keydown("t");
  eq(T.mapping[cT], "T", "typing fills the mapping");
  eq(slot.textContent, "T", "the slot shows the letter");
  eq(T.stats.letters, 1, "letter counted");
  eq(T.snap().solved, false, "not solved yet");

  // A wrong letter, then Backspace.
  const cH = T.snap().cipher["H"];
  T.select(cH);
  keydown("z");
  eq(T.mapping[cH], "Z", "wrong letters are accepted as guesses");
  eq(T.stats.letters, 2, "second letter counted");
  keydown("Backspace");
  eq(T.mapping[cH], undefined, "Backspace clears the selection");
  eq(T.stats.letters, 2, "clearing is not a typed letter");

  // No selection, no typing.
  T.select(null);
  eq(T.selected, null, "selection cleared");
  eq(T.type("A"), false, "typing without a selection is ignored");
  eq(T.stats.letters, 2, "letters unchanged");

  // Hint fills one letter and locks it.
  eq(T.hint(), true, "Hint reveals a letter");
  eq(T.stats.hints, 1, "hint counted");
  eq(T.snap().hintsThisPuzzle, 1, "hint counted for the puzzle");
  const hintedLetter = T.hinted[0];
  ok(!!hintedLetter, "a cipher letter is hinted", T.hinted);
  eq(T.mapping[hintedLetter], T.snap().plainOf[hintedLetter], "the hint is correct");
  T.select(hintedLetter);
  eq(T.type("Q"), false, "hinted letters are locked");
  eq(T.mapping[hintedLetter], T.snap().plainOf[hintedLetter], "hint value kept");
  eq(T.stats.letters, 2, "locked letters do not count as typed");
}

// ---------- D. Solving ----------
{
  T.setElapsed(45000);
  eq(T.solve(), true, "the finished grid solves the puzzle");
  eq(T.solved, true, "solved flag");
  eq(T.stats.solves, 3, "solve counted");
  eq(T.stats.flawless, 0, "a hint means it is not a clean solve");
  near(T.stats.bestTime, 45000, 300, "best time recorded");
  eq(elements.get("solves").textContent, 3, "solved HUD");
  eq(elements.get("best").textContent, "0:45", "best time HUD");
  eq(T.overlayTitle(), "Solved! 🎉", "win overlay");
  has(T.overlayMsg(), "THINK OUTSIDE THE BOX", "the quote is shown");
  has(T.overlayMsg(), "Solved in 0:45", "the solve time is shown");
  has(T.overlayMsg(), "New best time", "the first solve is a record");
  ["quick300", "quick180", "quick120"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " unlocks")
  );
  eq(T.unlocked().length, 4, "four badges");

  eq(T.type("A"), false, "a solved puzzle stops taking input");
  eq(T.hint(), false, "hints stop after solving");
  eq(T.reset(), false, "reset stops after solving");
  T.setPaused(true);
  eq(T.paused, false, "a solved puzzle cannot pause");
}

// ---------- E. Play again ----------
{
  const before = T.quote.text;
  T.newGame();
  eq(T.stats.games, 2, "new puzzle counted");
  eq(T.quote.text === before, false, "never the same quote twice in a row");
  eq(T.quote.text, "IF AT FIRST YOU DO NOT SUCCEED TRY AGAIN", "next quote in the list");
  eq(T.solved, false, "fresh puzzle");
  eq(T.snap().selected, null, "nothing selected");
  eq(JSON.stringify(T.snap().mapping), "{}", "entries cleared");
  eq(JSON.stringify(T.snap().hinted), "[]", "hints cleared");
  eq(T.overlayTitle(), null, "overlay closed");
  eq(elements.get("time").textContent, 0, "timer restarted");
  eq(T.snap().cells, 32, "cells match the new quote");
}

// ---------- F. Clean solve + record ----------
{
  loadQuote("HELLO WORLD", "test");
  eq(T.snap().cells, 10, "ten cells");
  T.setElapsed(30000);
  eq(T.solve(), true, "solved");
  eq(T.stats.solves, 4, "solve counted");
  eq(T.stats.flawless, 1, "clean solve counted");
  near(T.stats.bestTime, 30000, 300, "faster best time");
  eq(elements.get("best").textContent, "0:30", "best HUD");
  has(T.overlayMsg(), "New best time", "record solve");
  ok(T.unlocked().includes("flawless1"), "Clean Solve badge unlocks");
  eq(T.unlocked().length, 5, "five badges");

  // A slow solve is not a record.
  loadQuote("HELLO WORLD", "test");
  T.setElapsed(200000);
  T.solve();
  eq(T.stats.solves, 5, "fifth solve");
  eq(T.stats.flawless, 2, "second clean solve");
  near(T.stats.bestTime, 30000, 300, "best time unchanged");
  eq(T.overlayTitle(), "Solved! 🎉", "still a win overlay");
  ok((T.overlayMsg() || "").indexOf("New best time") === -1, "no record claim on a slow solve");
}

// ---------- G. Reset keeps hints ----------
{
  loadQuote("ABCDEFGH", "test");
  T.setElapsed(9000);
  eq(T.hint(), true, "hint used");
  const hintedLetter = T.hinted[0];
  ok(!!hintedLetter, "a letter is hinted", T.hinted);
  const cipherOf = T.snap().cipher;
  const freePlain = "ABCDEFGH".split("").find((p) => cipherOf[p] !== hintedLetter);
  T.select(cipherOf[freePlain]);
  T.type(freePlain);
  eq(T.mapping[cipherOf[freePlain]], freePlain, "a second letter typed");
  T.setElapsed(20000);
  eq(T.reset(), true, "reset clears the grid");
  eq(T.mapping[hintedLetter], T.snap().plainOf[hintedLetter], "hinted letters survive a reset");
  eq(T.mapping[cipherOf[freePlain]], undefined, "typed letters are cleared");
  eq(T.snap().elapsed < 500, true, "reset restarts the clock");
  eq(T.stats.hints, 2, "hint total");

  loadQuote("HELLO WORLD", "test");
  T.setElapsed(5000);
}

// ---------- H. Pause ----------
{
  const snapshot = T.snap();
  eq(T.paused, false, "running");

  keydown("Escape");
  eq(T.paused, true, "Escape pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  const frozen = T.snap().elapsed;
  eq(T.snap().elapsed, frozen, "the clock is frozen");
  eq(T.type("A"), false, "typing is blocked while paused");
  eq(T.hint(), false, "hints are blocked while paused");
  eq(T.reset(), false, "reset is blocked while paused");
  T.select("A");
  eq(T.selected, snapshot.selected, "selection is frozen too");

  keydown("Escape");
  eq(T.paused, false, "Escape resumes");
  eq(T.overlayTitle(), null, "pause overlay closed");
  eq(T.snap().elapsed >= frozen, true, "the clock resumes");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(T.paused, true, "opening the badges pauses");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(T.paused, true, "the puzzle stays paused behind the modal");
  eq(T.overlayTitle(), "Paused", "pause overlay still up");
  keydown("Escape");
  eq(T.paused, false, "and Escape resumes");
}

// ---------- I. Letter grind ----------
{
  loadQuote("HELLO WORLD", "test");
  const cH = T.snap().cipher["H"];
  T.select(cH);
  let guard = 0;
  while (T.stats.letters < 500 && guard++ < 1000) T.type("Z");
  eq(T.stats.letters, 500, "five hundred letters typed");
  eq(T.snap().solved, false, "typing wrong letters never solves the grid");
  ok(T.unlocked().includes("letters500"), "Typist badge unlocks");
}

// ---------- J. Hint grind ----------
{
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let guard = 0;
  while (T.stats.hints < 100 && guard++ < 20) {
    loadQuote(alphabet, "test");
    for (let i = 0; i < 25 && T.stats.hints < 100; i++) T.hint();
  }
  eq(T.stats.hints, 100, "one hundred hints");
  ok(T.unlocked().includes("hint25"), "Nudge badge unlocks");
  ok(T.unlocked().includes("hint100"), "Hint Addict badge unlocks");
}

// ---------- K. Solve grind ----------
{
  let guard = 0;
  while (T.stats.solves < 25 && guard++ < 40) {
    loadQuote("HELLO WORLD", "test");
    T.setElapsed(600000);
    T.solve();
  }
  eq(T.stats.solves, 25, "twenty-five solves");
  eq(T.stats.flawless, 22, "twenty-two clean solves");
  ok(T.unlocked().includes("solves5"), "Codebreaker badge unlocks");
  ok(T.unlocked().includes("solves10"), "Cryptanalyst badge unlocks");
  ok(T.unlocked().includes("solves25"), "Cipher Master badge unlocks");
  ok(T.unlocked().includes("flawless5"), "Spotless badge unlocks");
  near(T.stats.bestTime, 30000, 300, "the best time still belongs to the 0:30 solve");
}

// ---------- L. Puzzle grind ----------
{
  while (T.stats.games < 25) T.newGame();
  eq(T.stats.games, 25, "twenty-five puzzles started");
  ok(T.unlocked().includes("games10"), "Ten Puzzles badge unlocks");
  ok(T.unlocked().includes("games25"), "Puzzle Shelf badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- M. New Puzzle button + keyboard ----------
{
  const before = T.quote.text;
  elements.get("new-puzzle").dispatch("click");
  eq(T.stats.games, 26, "New Puzzle counts a puzzle");
  eq(T.quote.text === before, false, "New Puzzle deals a different quote");
  eq(T.solved, false, "new puzzle is unsolved");

  loadQuote("HELLO WORLD", "test");
  const cH2 = T.snap().cipher["H"];
  ok(!!cH2, "cipher letters available");
  T.select(cH2);
  keydown("h");
  eq(T.mapping[cH2], "H", "keyboard input types into the grid");
  keydown("Backspace");
  eq(T.mapping[cH2], undefined, "Backspace clears from the keyboard");

  const hintBtn = elements.get("hint");
  hintBtn.dispatch("click");
  eq(T.stats.hints, 101, "the Hint button works");
  const resetBtn = elements.get("reset");
  resetBtn.dispatch("click");
  eq(T.snap().hintsThisPuzzle, 1, "reset keeps the puzzle going");
}

// ---------- N. Rendering + sound ----------
{
  const board = elements.get("board");
  eq(board.children.length > 0, true, "board rendered");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("cryptogram-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("cryptogram-sound"), "on", "preference restored");
}

// ---------- O. Badges modal + final tally ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Puzzles <b>26</b>", "puzzles record");
  has(records, "Solved <b>25</b>", "solved record");
  has(records, "Hints <b>101</b>", "hints record");
  has(records, "Best time <b>0:30</b>", "best time record");
  has(records, "Clean solves <b>22</b>", "clean solve record");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

{
  const u = T.unlocked();
  const expected = [
    "first", "solves5", "solves10", "solves25", "games10", "games25", "hint25",
    "hint100", "quick300", "quick180", "quick120", "flawless1", "flawless5", "letters500",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.games, 26, "puzzles");
  eq(T.stats.solves, 25, "solves");
  eq(T.stats.hints, 101, "hints");
  eq(T.stats.letters, 501, "letters");
  eq(T.stats.flawless, 22, "clean solves");
  near(T.stats.bestTime, 30000, 300, "best time");
  eq(elements.get("solves").textContent, 25, "solved HUD");
  eq(elements.get("best").textContent, "0:30", "best HUD");
  ok(storage.has("cryptogram-stats-v1"), "stats persisted");
  ok(storage.has("cryptogram-achv-v1"), "badges persisted");
}

// ---------- P. Onboarding: correctness feedback, word reveal, frequencies ----------
{
  const html = fs.readFileSync(dir + "index.html", "utf8");
  ok(html.indexOf("How to play") !== -1, "the guide is present");
  ok(html.indexOf("WKH FDW") !== -1, "the worked substitution example is present");
  ok(html.indexOf("Letter frequencies") !== -1, "frequency help is present");

  loadQuote("A FRIEND IN NEED", "test");
  const total = T.snap().unique;
  eq(elements.get("decoded").textContent, "0/" + total, "the decoded readout starts empty");

  function slotFor(c) {
    for (const w of elements.get("board").children) {
      for (const cell of w.children) {
        const slot = cell.children[1];
        if (slot && slot.dataset.cipher === c) return slot;
      }
    }
    return null;
  }

  const cA = T.snap().cipher["A"];
  T.select(cA);
  T.type("X");
  eq(slotFor(cA).classList.contains("correct"), false, "a wrong guess is not marked correct");
  eq(elements.get("decoded").textContent, "0/" + total, "a wrong guess does not raise the count");
  T.type("A");
  eq(slotFor(cA).classList.contains("correct"), true, "a correct guess glows green");
  eq(elements.get("decoded").textContent, "1/" + total, "a correct guess raises the count");

  // Revealing a word starts with the shortest one ("A"), then locks it.
  loadQuote("A FRIEND IN NEED", "test");
  const hintsBefore = T.stats.hints;
  ok(T.revealWord() >= 1, "Reveal word reveals letters");
  ok(T.stats.hints >= hintsBefore + 1, "revealing a word counts as hints");
  eq(T.mapping[T.snap().cipher["A"]], "A", "the one-letter word is revealed first");
  ok(T.hinted.includes(T.snap().cipher["A"]), "the revealed letter is locked");
  ok(T.revealWord() >= 1, "a second word can be revealed");

  // Frequency table is a real cryptogram aid.
  const freq = T.frequencies();
  eq(freq.length, T.snap().unique, "one frequency entry per cipher letter");
  eq(freq.reduce((n, f) => n + f.count, 0), T.snap().cells, "counts add up to every cell");
  ok(freq[0].count >= freq[freq.length - 1].count, "frequencies are sorted highest first");
  ok(elements.get("freq").innerHTML.indexOf("<b>") !== -1, "the frequency panel is rendered");

  // The button is wired and the aid is blocked after a solve.
  loadQuote("HELLO WORLD", "test");
  const h = T.stats.hints;
  elements.get("reveal-word").dispatch("click");
  ok(T.stats.hints > h, "Reveal word button works");
  loadQuote("HELLO WORLD", "test");
  eq(T.solve(), true, "the puzzle can still be solved normally");
  eq(T.revealWord(), 0, "no word reveal after solving");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
