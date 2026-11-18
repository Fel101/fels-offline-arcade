// Deterministic tests for games/word-tile/script.js
// The target word is pinned with the test hook; scoring and guess counting are
// asserted exactly.
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
  "board", "keyboard", "wins", "streak", "best", "new-game", "hint",
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
  setTimeout: () => ++timerSeq, // never fires
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
storage.set("wordle-wins", "3");
storage.set("wordle-streak", "1");
storage.set("wordle-best-streak", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/word-tile/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__WORDLE;
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
function js(arr) {
  return JSON.stringify(arr);
}

const WRONG5 = ["APPLE", "BACON", "HOUSE", "MONEY", "RIVER"];

// ---------- A. Init + legacy migration ----------
{
  eq(T.WORD_LEN, 5, "five-letter words");
  eq(T.MAX_ROWS, 6, "six tries");
  eq(T.row, 0, "starts on the first row");
  eq(T.col, 0, "no letters typed");
  eq(T.current, "", "empty current guess");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.wins, 3, "legacy wins migrated");
  eq(T.stats.streak, 1, "legacy streak migrated");
  eq(T.stats.bestStreak, 2, "legacy best streak migrated");
  eq(T.stats.games, 0, "legacy data did not invent games");
  eq(T.stats.totalGuesses, 0, "no guesses yet");
  eq(T.stats.prevOutcome, "", "no previous outcome");
  eq(storage.has("wordle-wins"), false, "legacy wins key removed");
  eq(storage.has("wordle-streak"), false, "legacy streak key removed");
  eq(storage.has("wordle-best-streak"), false, "legacy best-streak key removed");
  eq(storage.has("wordle-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 3, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 1, "Streak HUD shows migrated value");
  eq(elements.get("best").textContent, 2, "Best streak HUD shows migrated value");
  ok(T.WORDS.includes(T.answer), "target comes from the word list", T.answer);
  eq(T.answer.length, 5, "target is five letters");
  eq(T.grid.length, 6, "grid has six rows");
  eq(T.grid[0].length, 5, "each row has five cells");
  eq(T.grid.flat().every((c) => c === ""), true, "grid starts empty");
  eq(elements.get("board").children.length, 6, "six board rows rendered");
  eq(elements.get("board").children[0].children.length, 5, "five tiles per row");
  eq(elements.get("keyboard").children.length, 3, "three keyboard rows");
  eq(elements.get("keyboard").children[2].children.length, 9, "last row has Enter + 7 keys + Backspace");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Scoring ----------
{
  eq(js(T.scoreGuess("CRANE", "CRANE")), js(["green", "green", "green", "green", "green"]), "exact match is all green");
  eq(js(T.scoreGuess("ABBEY", "KEBAB")), js(["yellow", "yellow", "green", "yellow", "gray"]), "greens and yellows mix correctly");
  eq(js(T.scoreGuess("SPEED", "ABIDE")), js(["gray", "gray", "yellow", "gray", "yellow"]), "duplicate guess letters only count once");
  eq(js(T.scoreGuess("ALLEY", "APPLE")), js(["green", "yellow", "gray", "yellow", "gray"]), "duplicate target letters are matched once");
  eq(js(T.scoreGuess("ZZZZZ", "ABOUT")), js(["gray", "gray", "gray", "gray", "gray"]), "no shared letters is all gray");
}

// ---------- C. Typing ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  T.typeWord("CRANE");
  eq(T.col, 5, "five letters typed");
  eq(T.current, "CRANE", "current guess assembled");
  eq(js(T.grid[0]), js(["C", "R", "A", "N", "E"]), "letters land in the grid");
  const rowEl = elements.get("board").children[0];
  eq(rowEl.children[0].textContent, "C", "first tile shows C");
  eq(rowEl.children[4].textContent, "E", "last tile shows E");
  ok(rowEl.children[0].classList.contains("filled"), "typed tile marked filled");

  T.addLetter("X");
  eq(T.col, 5, "a sixth letter is ignored");
  eq(T.current, "CRANE", "guess unchanged");

  T.removeLetter();
  eq(T.col, 4, "backspace removes a letter");
  eq(T.grid[0][4], "", "cell cleared");
  eq(rowEl.children[4].textContent, "", "tile text cleared");
  ok(!rowEl.children[4].classList.contains("filled"), "tile no longer filled");
  for (let i = 0; i < 10; i++) T.removeLetter();
  eq(T.col, 0, "backspace stops at the first cell");

  // Physical keyboard — P must type the letter P, not pause.
  keydown("a"); keydown("p"); keydown("p"); keydown("l"); keydown("e");
  eq(T.current, "APPLE", "keyboard letters (including P) build the guess");
  eq(T.paused, false, "typing P did not pause");
  keydown("Backspace");
  eq(T.col, 4, "keyboard Backspace removes a letter");
  keydown("e");
  eq(T.current, "APPLE", "letter restored");
}

// ---------- D. Invalid word ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  const toastBefore = elements.get("toasts").children.length;
  T.typeWord("ZZZZZ");
  T.submitGuess();
  eq(T.stats.totalGuesses, 0, "invalid guess is not counted");
  eq(T.row, 0, "invalid guess does not advance the row");
  eq(T.col, 5, "letters stay so the player can fix them");
  eq(T.gameOver, false, "still playing");
  eq(elements.get("toasts").children.length, toastBefore + 1, "a toast is shown");
  for (let i = 0; i < 5; i++) T.removeLetter();
  eq(T.col, 0, "row cleared");
}

// ---------- E. Win in 3 ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  T.guess("APPLE");
  eq(T.row, 1, "first wrong guess advances");
  eq(T.stats.totalGuesses, 1, "guess counted");
  eq(T.gameOver, false, "game continues");
  T.guess("CRANE");
  eq(T.row, 2, "second wrong guess advances");
  eq(T.stats.totalGuesses, 2, "second guess counted");
  T.guess("ABOUT");
  eq(T.gameOver, true, "solving ends the game");
  eq(T.overlayTitle(), "You got it! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("The word was ABOUT.") !== -1, "answer revealed", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Solved in 3 guesses") !== -1, "guess count reported", T.overlayMsg());
  const winRow = elements.get("board").children[2];
  eq(winRow.children[0].classList.contains("green"), true, "winning row all green");
  eq(T.keyState["A"], "green", "keyboard A marked green");
  eq(T.keyState["B"], "green", "keyboard B marked green");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.wins, 4, "win counted (3 migrated + 1)");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.winsIn3, 1, "solved in 3 tracked");
  eq(T.stats.winsIn2, 0, "not solved in 2");
  eq(T.stats.winsOnSix, 0, "not solved on six");
  eq(T.stats.fastWins, 1, "fast win tracked");
  eq(T.stats.losses, 0, "no losses");
  eq(T.stats.totalGuesses, 3, "three guesses made");
  eq(T.stats.prevOutcome, "win", "previous outcome recorded");
  eq(elements.get("wins").textContent, 4, "Wins HUD updated");
  eq(elements.get("streak").textContent, 2, "Streak HUD updated");
  eq(elements.get("best").textContent, 2, "Best streak HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  ok(u.includes("winIn3"), "Sharp badge unlocks");
  eq(u.length, 3, "three badges unlocked");
  T.overlay.hide();
}

// ---------- F. Win in 2 ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  T.guess("APPLE");
  T.guess("ABOUT");
  eq(T.gameOver, true, "win recorded");
  ok((T.overlayMsg() || "").indexOf("Solved in 2 guesses") !== -1, "two guesses reported", T.overlayMsg());
  eq(T.stats.games, 2, "second game");
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 3, "best streak is 3");
  eq(T.stats.winsIn2, 1, "solved in 2 tracked");
  eq(T.stats.winsIn3, 2, "second solve in 3 or fewer");
  eq(T.stats.fastWins, 2, "second fast win");
  eq(T.stats.totalGuesses, 5, "five guesses made");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks");
  ok(u.includes("winIn2"), "Two-Shot badge unlocks");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  eq(u.length, 6, "six badges unlocked");
  T.overlay.hide();
}

// ---------- G. Win on the last try ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  for (const w of WRONG5) T.guess(w);
  eq(T.row, 5, "five wrong guesses used");
  eq(T.gameOver, false, "one try left");
  T.guess("ABOUT");
  eq(T.gameOver, true, "won on the last row");
  ok((T.overlayMsg() || "").indexOf("Solved in 6 guesses") !== -1, "six guesses reported", T.overlayMsg());
  eq(T.stats.games, 3, "third game");
  eq(T.stats.wins, 6, "sixth win");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  eq(T.stats.winsOnSix, 1, "clutch win tracked");
  eq(T.stats.fastWins, 2, "a six-guess win is not fast");
  eq(T.stats.winsIn3, 2, "a six-guess win is not sharp");
  eq(T.stats.totalGuesses, 11, "eleven guesses made");
  ok(T.unlocked().includes("winIn6"), "Clutch badge unlocks");
  eq(T.unlocked().length, 7, "seven badges unlocked");
  T.overlay.hide();
}

// ---------- H. Loss ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  for (const w of [...WRONG5, "CRANE"]) T.guess(w);
  eq(T.gameOver, true, "six wrong guesses lose");
  eq(T.overlayTitle(), "Out of tries 😔", "loss overlay shown");
  ok((T.overlayMsg() || "").indexOf("The word was ABOUT.") !== -1, "answer revealed", T.overlayMsg());
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.bestStreak, 4, "best streak kept");
  eq(T.stats.totalGuesses, 17, "seventeen guesses made");
  eq(T.stats.prevOutcome, "loss", "loss recorded as the previous outcome");
  eq(T.unlocked().length, 7, "no badges from a loss");
  T.overlay.hide();
}

// ---------- I. Comeback ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  T.guess("APPLE");
  T.guess("CRANE");
  T.guess("ABOUT");
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.games, 5, "fifth game");
  eq(T.stats.wins, 7, "seventh win");
  eq(T.stats.streak, 1, "streak restarts at 1");
  eq(T.stats.winsIn3, 3, "third sharp win");
  eq(T.stats.fastWins, 3, "third fast win");
  eq(T.stats.comebackWins, 1, "comeback tracked");
  eq(T.stats.totalGuesses, 20, "twenty guesses made");
  ok(T.unlocked().includes("comeback"), "Comeback badge unlocks");
  eq(T.unlocked().length, 8, "eight badges unlocked");
  T.overlay.hide();
}

// ---------- J. Three fast wins ----------
{
  for (let i = 0; i < 3; i++) {
    T.newGame();
    T.setAnswer("ABOUT");
    T.guess("APPLE");
    T.guess("CRANE");
    T.guess("ABOUT");
    eq(T.gameOver, true, "fast win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.games, 8, "eight games");
  eq(T.stats.wins, 10, "ten wins");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  eq(T.stats.winsIn3, 6, "six sharp wins");
  eq(T.stats.fastWins, 6, "six fast wins");
  eq(T.stats.comebackWins, 1, "no extra comebacks");
  eq(T.stats.totalGuesses, 29, "twenty-nine guesses made");
  const u = T.unlocked();
  ok(u.includes("win10"), "Champion badge unlocks at 10 wins");
  ok(u.includes("fast5"), "Lightning badge unlocks at 5 fast wins");
  eq(u.length, 10, "ten badges unlocked");
}

// ---------- K. Five in a row ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  for (const w of WRONG5) T.guess(w);
  T.guess("ABOUT");
  eq(T.gameOver, true, "sixth-guess win recorded");
  eq(T.stats.games, 9, "nine games");
  eq(T.stats.wins, 11, "eleven wins");
  eq(T.stats.streak, 5, "streak is 5");
  eq(T.stats.bestStreak, 5, "best streak is 5");
  eq(T.stats.winsOnSix, 2, "second clutch win");
  eq(T.stats.totalGuesses, 35, "thirty-five guesses made");
  ok(T.unlocked().includes("streak5"), "Unstoppable badge unlocks");
  eq(T.unlocked().length, 11, "eleven badges unlocked");
  T.overlay.hide();
}

// ---------- L. Eight losses ----------
{
  for (let i = 0; i < 8; i++) {
    T.newGame();
    T.setAnswer("ABOUT");
    for (const w of [...WRONG5, "CRANE"]) T.guess(w);
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "Out of tries 😔", "loss overlay shown");
    T.overlay.hide();
  }
  eq(T.stats.games, 17, "seventeen games");
  eq(T.stats.losses, 9, "nine losses total");
  eq(T.stats.streak, 0, "losses reset the streak");
  eq(T.stats.totalGuesses, 83, "eighty-three guesses made");
  eq(T.unlocked().length, 11, "no badges from the losses");
  ok(!T.unlocked().includes("losses10"), "Persistence still locked at 9 losses");
}

// ---------- M. Three slow wins (20 games, 100 guesses) ----------
{
  for (let i = 0; i < 3; i++) {
    T.newGame();
    T.setAnswer("ABOUT");
    for (const w of WRONG5) T.guess(w);
    T.guess("ABOUT");
    eq(T.gameOver, true, "slow win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.games, 20, "twenty games");
  eq(T.stats.wins, 14, "fourteen wins");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 5, "best streak stays 5");
  eq(T.stats.winsOnSix, 5, "five clutch wins");
  eq(T.stats.comebackWins, 2, "the first slow win was a comeback");
  eq(T.stats.totalGuesses, 101, "one hundred and one guesses");
  const u = T.unlocked();
  ok(u.includes("guesses100"), "Wordsmith badge unlocks");
  ok(u.includes("games20"), "Dedicated badge unlocks");
  eq(u.length, 13, "thirteen badges unlocked");
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "streak5",
    "winIn3", "winIn2", "winIn6", "fast5", "comeback", "guesses100", "games20",
  ];
  ok(u.length === 13 && expected.every((id) => u.includes(id)), "exactly the 13 earned badges are unlocked", u);
  ok(u.indexOf("losses10") === -1, "Persistence is the only locked badge");
  eq(T.stats.games, 20, "games");
  eq(T.stats.wins, 14, "wins");
  eq(T.stats.losses, 9, "losses");
  eq(T.stats.streak, 3, "streak");
  eq(T.stats.bestStreak, 5, "best streak");
  eq(T.stats.winsIn2, 1, "wins in 2");
  eq(T.stats.winsIn3, 6, "wins in 3");
  eq(T.stats.winsOnSix, 5, "wins on six");
  eq(T.stats.fastWins, 6, "fast wins");
  eq(T.stats.comebackWins, 2, "comebacks");
  eq(T.stats.totalGuesses, 101, "total guesses");
  eq(T.stats.prevOutcome, "win", "last outcome");
}

// ---------- O. Pause ----------
{
  T.newGame();
  T.setAnswer("ABOUT");
  T.typeWord("CR");
  eq(T.col, 2, "two letters typed before pausing");
  keydown("Escape");
  eq(T.paused, true, "Esc pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.typeWord("ANE");
  eq(T.col, 2, "typing blocked while paused");
  keydown("Escape");
  eq(T.paused, false, "Esc resumes the game");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.typeWord("ANE");
  eq(T.current, "CRANE", "typing works after resume");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  // One-guess win through the physical keyboard, then Enter restarts.
  T.newGame();
  T.setAnswer("ABOUT");
  keydown("a"); keydown("b"); keydown("o"); keydown("u"); keydown("t");
  eq(T.current, "ABOUT", "keyboard typed the answer");
  keydown("Enter");
  eq(T.gameOver, true, "Enter submitted the winning guess");
  ok((T.overlayMsg() || "").indexOf("Solved in 1 guess.") !== -1, "single-guess win reported", T.overlayMsg());
  eq(T.stats.games, 21, "twenty-first game");
  eq(T.stats.wins, 15, "fifteenth win");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 5, "best streak stays 5");
  eq(T.stats.winsIn2, 2, "second win in 2 or fewer");
  eq(T.stats.winsIn3, 7, "seventh sharp win");
  eq(T.stats.fastWins, 7, "seventh fast win");
  eq(T.stats.totalGuesses, 102, "total guesses");

  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You got it! 🎉", "win overlay intact");
  keydown("Enter");
  eq(T.gameOver, false, "Enter starts a new game after a win");
  eq(T.row, 0, "new game starts on the first row");
  eq(T.col, 0, "new game has no letters");
}

// ---------- P. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("wordle-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("wordle-sound"), "on", "preference restored");
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
