// Deterministic tests for games/jumble/script.js
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
    type: "",
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
  "scramble", "clue", "answer", "attempts", "keyboard", "wins", "streak", "best-streak",
  "hint-btn", "clear-btn", "new-word", "badges-btn", "badge-count", "badges2",
  "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count", "achv-records",
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

// Loose counters from the pre-core build.
storage.set("jumble-wins", "2");
storage.set("jumble-streak", "1");
storage.set("jumble-best-streak", "2");

const root = require("./_env").root;
const dir = root + "games/jumble/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const J = global.window.__JUMBLE;
if (!J) {
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

// ---------- A. Init + legacy migration ----------
{
  eq(J.stats.games, 1, "the opening word is counted");
  eq(J.stats.wins, 2, "legacy wins migrated");
  eq(J.stats.streak, 1, "legacy streak migrated");
  eq(J.stats.bestStreak, 2, "legacy best streak migrated");
  eq(storage.has("jumble-wins"), false, "legacy wins key removed");
  eq(storage.has("jumble-streak"), false, "legacy streak key removed");
  eq(storage.has("jumble-best-streak"), false, "legacy best-streak key removed");
  eq(J.stats.hints, 0, "no hints yet");
  eq(J.stats.letters, 0, "no letters yet");
  eq(J.stats.flawless, 0, "no clean solves yet");
  eq(J.stats.wrongGuesses, 0, "no wrong guesses yet");
  eq(J.WORDS.length, 82, "word list size");
  eq(J.current.w, "COOKIE", "the first word is deterministic");
  eq(J.current.clue, "A sweet baked treat with chocolate chips", "the clue is shown");
  eq(J.scrambled.length, 6, "the scramble has six tiles");
  eq(J.scrambled.split("").sort().join(""), "CEIKOO", "the scramble is a permutation");
  eq(J.scrambled === "COOKIE", false, "the scramble is shuffled");
  eq(J.answer.length, 6, "six answer boxes");
  eq(J.answer.join(""), "", "answer starts empty");
  eq(J.locked.filter(Boolean).length, 0, "nothing locked");
  eq(J.selected, null, "nothing selected");
  eq(J.attempts, 0, "no attempts");
  eq(J.roundOver, false, "round is live");
  eq(J.paused, false, "not paused");
  eq(J.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(J.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(J.unlocked().length, 2, "the legacy counters unlock two badges");
  ok(J.unlocked().includes("first"), "First Solve unlocks from the legacy wins");
  ok(J.unlocked().includes("streak2"), "Two in a Row unlocks from the legacy streak");
  eq(elements.get("badge-count").textContent, 2, "header badge count");
  eq(elements.get("wins").textContent, 2, "wins HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(elements.get("best-streak").textContent, 2, "best streak HUD");
  eq(J.overlayTitle(), null, "no overlay on load");
}

// ---------- B. Board rendering + a clean win ----------
{
  eq(elements.get("scramble").children.length, 6, "six scramble tiles rendered");
  eq(elements.get("scramble").children[0].className, "scramble__tile", "tile class");
  eq(elements.get("scramble").children[0].textContent, J.scrambled[0], "tile letter");
  eq(elements.get("clue").textContent, "Clue: A sweet baked treat with chocolate chips", "clue line");
  eq(elements.get("answer").children.length, 6, "six answer boxes rendered");
  eq(elements.get("answer").children[0].className, "answer-box", "box class");
  eq(elements.get("attempts").textContent, "Attempts: 0", "attempt counter");
  eq(elements.get("keyboard").children.length, 3, "three keyboard rows");
  eq(elements.get("keyboard").children[0].children.length, 10, "top row has ten keys");
  eq(elements.get("keyboard").children[1].children.length, 9, "home row has nine keys");
  eq(elements.get("keyboard").children[2].children.length, 8, "bottom row has seven keys plus backspace");

  // Select toggling.
  eq(J.select(2), true, "a box can be selected");
  eq(J.selected, 2, "selection tracked");
  eq(elements.get("answer").children[2].classList.contains("answer-box--selected"), true, "selected box highlighted");
  eq(J.select(2), true, "clicking the same box again clears it");
  eq(J.selected, null, "selection cleared");

  J.typeWord("COOKIE");
  eq(J.answer.join(""), "COOKIE", "the answer fills in order");
  eq(J.stats.letters, 6, "six letters counted");
  eq(J.roundOver, true, "a correct answer ends the round");
  eq(J.attempts, 1, "one attempt");
  eq(elements.get("attempts").textContent, "Attempts: 1", "the attempt label refreshes on a win");
  eq(elements.get("answer").children[0].classList.contains("answer-box--correct"), true, "winning boxes are highlighted");
  eq(J.stats.wins, 3, "win counted");
  eq(J.stats.streak, 2, "streak extends");
  eq(J.stats.bestStreak, 2, "best streak unchanged");
  eq(J.stats.flawless, 1, "clean solve counted");
  eq(elements.get("wins").textContent, 3, "wins HUD");
  eq(elements.get("streak").textContent, 2, "streak HUD");
  eq(elements.get("best-streak").textContent, 2, "best streak HUD");
  eq(J.overlayTitle(), "You got it! 🎉", "win overlay");
  has(J.overlayMsg(), "The word was COOKIE", "overlay names the word");
  has(J.overlayMsg(), "Solved with 1 attempt", "overlay reports the attempt");
  has(J.overlayMsg(), "Streak 2", "overlay reports the streak");
  ok((J.overlayMsg() || "").indexOf("New best streak") === -1, "no record claim on a tie");
  eq(J.typeWord("X"), undefined, "a finished word takes no more letters");
  eq(J.stats.letters, 6, "letters unchanged after the win");

  // Next word from the deterministic picker.
  J.newWord("COOKIE");
  eq(J.stats.games, 2, "next word counted");
  eq(J.current.w, "TURKEY", "the next word skips the current one");
  eq(J.roundOver, false, "fresh round");
  eq(J.answer.join(""), "", "answer cleared");
  eq(J.overlayTitle(), null, "overlay closed");
}

// ---------- C. Hint locks a letter and resets the streak ----------
{
  eq(J.stats.streak, 2, "streak before the hint");
  eq(J.hint(), true, "Hint reveals a letter");
  eq(J.answer[0], "T", "the hint fills the first wrong letter");
  eq(J.locked[0], true, "the hinted box is locked");
  eq(J.stats.hints, 1, "hint counted");
  eq(J.hintsThisWord, 1, "hint counted for the word");
  eq(J.stats.streak, 0, "a hint resets the streak");
  eq(elements.get("streak").textContent, 0, "streak HUD reset");
  eq(elements.get("answer").children[0].disabled, false, "locked boxes are not disabled");
  eq(J.select(0), false, "locked boxes cannot be selected");
  eq(J.insert("Z"), true, "typing fills the next free box");
  eq(J.answer[1], "Z", "the letter lands after the locked box");
  eq(J.remove(), true, "backspace clears it");
  eq(J.answer[1], "", "the box is empty again");

  J.typeWord("URKEY");
  eq(J.answer.join(""), "TURKEY", "the rest of the word fills in");
  eq(J.roundOver, true, "the word solves");
  eq(J.stats.wins, 4, "win counted");
  eq(J.stats.streak, 1, "streak restarts");
  eq(J.stats.flawless, 1, "a hinted solve is not clean");
  eq(J.attempts, 1, "one attempt");
  eq(J.stats.letters, 12, "five more letters typed");
}

// ---------- D. Wrong guesses keep the round alive ----------
{
  J.loadWord("TIGER", "Big striped cat");
  eq(J.stats.games, 2, "loading a test word does not count a game");
  eq(J.current.w, "TIGER", "test word pinned");
  eq(elements.get("clue").textContent, "Clue: Big striped cat", "test clue rendered");
  J.typeWord("TIGES");
  eq(J.answer.join(""), "TIGES", "a wrong guess fills the boxes");
  eq(J.roundOver, false, "a wrong guess does not end the round");
  eq(J.attempts, 1, "attempt counted");
  eq(J.stats.wrongGuesses, 1, "wrong guess counted");
  eq(J.stats.streak, 0, "a wrong guess resets the streak");
  eq(elements.get("answer").classList.contains("answer-row--wrong"), true, "the row shakes");
  eq(J.stats.letters, 17, "five letters typed");
  eq(J.insert("A"), false, "the row is full so typing is ignored");
  eq(J.clear(), true, "Clear empties the row");
  eq(J.answer.join(""), "", "the wrong letters are gone");

  J.typeWord("TIGER");
  eq(J.roundOver, true, "the corrected word solves");
  eq(J.stats.wins, 5, "fifth win");
  eq(J.stats.flawless, 2, "second clean solve");
  ok(J.unlocked().includes("win5"), "Word Finder badge unlocks");
  eq(J.unlocked().length, 3, "three badges");
}

// ---------- E. Pause, blur, visibility and the badges modal ----------
{
  J.loadWord("OCEAN", "The giant salty sea");
  eq(J.paused, false, "running");
  keydown("Escape");
  eq(J.paused, true, "Escape pauses");
  eq(J.overlayTitle(), "Paused", "pause overlay");
  eq(J.insert("A"), false, "typing is blocked while paused");
  eq(J.remove(), false, "backspace is blocked while paused");
  eq(J.clear(), false, "Clear is blocked while paused");
  eq(J.hint(), false, "hints are blocked while paused");
  eq(J.select(0), false, "selection is blocked while paused");
  eq(J.answer.join(""), "", "the answer stays empty");

  keydown("Escape");
  eq(J.paused, false, "Escape resumes");
  eq(J.overlayTitle(), null, "pause overlay closed");

  winEvent("blur");
  eq(J.paused, true, "window blur pauses");
  keydown("Escape");
  eq(J.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(J.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(J.paused, false, "resumed again");

  J.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(J.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "3 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(J.paused, true, "the word stays paused behind the modal");
  eq(J.overlayTitle(), "Paused", "pause overlay still up");
  keydown("Escape");
  eq(J.paused, false, "and Escape resumes");
}

// ---------- F. Letter grind ----------
{
  J.loadWord("AB", "test");
  let guard = 0;
  while (J.stats.letters < 500 && guard++ < 2000) {
    J.insert("X");
    J.clear();
  }
  eq(J.stats.letters, 500, "five hundred letters typed");
  ok(J.unlocked().includes("letters100"), "Letter Drop badge unlocks");
  ok(J.unlocked().includes("letters500"), "Typist badge unlocks");
  eq(J.unlocked().length, 5, "five badges");
}

// ---------- G. Hint grind ----------
{
  let guard = 0;
  while (J.stats.hints < 50 && guard++ < 40) {
    // A 26-letter word never completes from six hints, so the grind only
    // touches the hint counters.
    J.loadWord("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "test");
    for (let i = 0; i < 6 && J.stats.hints < 50; i++) J.hint();
  }
  eq(J.stats.hints, 50, "fifty hints");
  ok(J.unlocked().includes("hint10"), "Nudge badge unlocks");
  ok(J.unlocked().includes("hint50"), "Hint Happy badge unlocks");
  eq(J.unlocked().length, 7, "seven badges");
}

// ---------- H. Clean-solve grind ----------
{
  let guard = 0;
  while (J.stats.flawless < 5 && guard++ < 10) {
    J.loadWord("HELLO", "test");
    eq(J.solve(), true, "the solve helper finishes the word");
  }
  eq(J.stats.flawless, 5, "five clean solves");
  eq(J.stats.wins, 8, "eight wins");
  eq(J.stats.streak, 3, "streak of three");
  eq(J.stats.bestStreak, 3, "best streak of three");
  ok(J.unlocked().includes("flawless5"), "Spotless badge unlocks");
  ok(J.unlocked().includes("streak3"), "Hat Trick badge unlocks");
  eq(J.unlocked().length, 9, "nine badges");
}

// ---------- I. Win grind ----------
{
  let guard = 0;
  while (J.stats.wins < 25 && guard++ < 40) {
    J.loadWord("HELLO", "test");
    J.solve();
  }
  eq(J.stats.wins, 25, "twenty-five wins");
  eq(J.stats.streak, 20, "twenty in a row");
  eq(J.stats.bestStreak, 20, "best streak");
  eq(J.stats.flawless, 22, "twenty-two clean solves");
  ok(J.unlocked().includes("win10"), "Wordsmith badge unlocks");
  ok(J.unlocked().includes("win25"), "Jumble Master badge unlocks");
  ok(J.unlocked().includes("streak5"), "Unstoppable badge unlocks");
  eq(J.unlocked().length, 12, "twelve badges");
  has(J.overlayMsg(), "New best streak", "the last win set a record");
}

// ---------- J. Buttons and keyboard ----------
{
  const before = J.stats.games;
  elements.get("new-word").dispatch("click");
  eq(J.stats.games, before + 1, "New Word counts a game");
  eq(J.overlayTitle(), null, "New Word closes any overlay");

  J.loadWord("HELLO", "test");
  const row2 = elements.get("keyboard").children[1];
  row2.children[0].dispatch("click"); // A
  eq(J.answer[0], "A", "the on-screen keyboard types");
  eq(J.stats.letters, 501, "letter counted from the keyboard");
  const row3 = elements.get("keyboard").children[2];
  row3.children[row3.children.length - 1].dispatch("click"); // backspace
  eq(J.answer[0], "", "the on-screen backspace clears");

  eq(J.solve(), true, "the word solves");
  ok(J.stats.wins > 25, "the win count grows");
  keydown("Enter");
  eq(J.roundOver, false, "Enter deals the next word after a win");
  eq(J.overlayTitle(), null, "overlay closed");

  // The hint and clear buttons work with real clicks.
  const hintsBefore = J.stats.hints;
  elements.get("hint-btn").dispatch("click");
  eq(J.stats.hints, hintsBefore + 1, "the Hint button works");
  const filled = J.answer.filter(Boolean).length;
  elements.get("clear-btn").dispatch("click");
  eq(J.answer.filter(Boolean).length, 1, "Clear keeps hinted letters");
  eq(filled >= 1, true, "there was something to clear");
}

// ---------- K. Game grind ----------
{
  let guard = 0;
  while (J.stats.games < 25 && guard++ < 40) J.newWord(J.current.w);
  eq(J.stats.games, 25, "twenty-five words started");
  ok(J.unlocked().includes("games10"), "Ten Words badge unlocks");
  ok(J.unlocked().includes("games25"), "Word Shelf badge unlocks");
  eq(J.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- L. Sound + modal + final tally ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("jumble-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("jumble-sound"), "on", "preference restored");

  J.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Words <b>25</b>", "words record");
  has(records, "Solved <b>26</b>", "solved record");
  has(records, "Best streak <b>21</b>", "best streak record");
  has(records, "Hints <b>51</b>", "hints record");
  has(records, "Clean solves <b>23</b>", "clean solve record");
  J.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  J.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");

  const u = J.unlocked();
  const expected = [
    "first", "win5", "win10", "win25", "streak2", "streak3", "streak5",
    "games10", "games25", "hint10", "hint50", "letters100", "letters500", "flawless5",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(J.stats.games, 25, "words");
  eq(J.stats.wins, 26, "wins");
  eq(J.stats.bestStreak, 21, "best streak");
  eq(J.stats.hints, 51, "hints");
  eq(J.stats.letters, 501, "letters");
  eq(J.stats.flawless, 23, "clean solves");
  eq(J.stats.wrongGuesses, 1, "wrong guesses");
  eq(elements.get("wins").textContent, 26, "wins HUD");
  eq(elements.get("best-streak").textContent, 21, "best streak HUD");
  ok(storage.has("jumble-stats-v1"), "stats persisted");
  ok(storage.has("jumble-achv-v1"), "badges persisted");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
