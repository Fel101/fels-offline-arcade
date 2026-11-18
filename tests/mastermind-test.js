// Deterministic tests for games/mastermind/script.js
// Math.random is pinned to 0.5, so the secret code is deterministic:
//   easy   -> [2,2,2,2]   (floor(0.5*4)=2)
//   normal -> [3,3,3,3]   (floor(0.5*6)=3)
//   hard   -> [3,3,3,3,3]
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
  "wins", "streak", "board", "palette", "guess-btn", "new-code", "difficulty", "hint",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("difficulty").value = "normal"; // default selection

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
Math.random = () => 0.5; // deterministic secret codes + confetti

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Legacy saves from the pre-core build — must migrate.
storage.set("mastermind-wins", "4");
storage.set("mastermind-streak", "2");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/mastermind/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__MASTERMIND;
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
function guess(colors) {
  colors.forEach((c) => T.addColor(c));
  T.doGuess();
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.currentDiff, "normal", "default difficulty is normal");
  eq(T.pegCount, 4, "normal: 4 pegs");
  eq(T.colorCount, 6, "normal: 6 colors");
  eq(JSON.stringify(T.secret), JSON.stringify([3, 3, 3, 3]), "secret generated (deterministic under pinned RNG)");
  eq(T.rowsLength, 0, "no guesses yet");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(T.stats.wins, 4, "legacy mastermind-wins migrated");
  eq(T.stats.streak, 2, "legacy mastermind-streak migrated");
  eq(T.stats.bestStreak, 2, "legacy streak seeds the best streak");
  eq(storage.has("mastermind-wins"), false, "legacy wins key removed");
  eq(storage.has("mastermind-streak"), false, "legacy streak key removed");
  eq(storage.has("mastermind-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 4, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 2, "Streak HUD shows migrated value");
  eq(elements.get("guess-btn").disabled, true, "guess disabled with an empty row");
  eq(elements.get("board").children.length, 10, "10 guess rows rendered");
  eq(elements.get("palette").children.length, 6, "6 palette colors on normal");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges unlocked at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. Scoring + peg mechanics ----------
{
  const s = T.scoreGuess;
  eq(JSON.stringify(s([3, 3, 3, 3], [3, 3, 3, 3])), JSON.stringify({ black: 4, white: 0 }), "all exact");
  eq(JSON.stringify(s([3, 3, 3, 3], [3, 3, 3, 0])), JSON.stringify({ black: 3, white: 0 }), "three exact, no white");
  eq(JSON.stringify(s([0, 1, 2, 3], [0, 1, 3, 4])), JSON.stringify({ black: 2, white: 1 }), "two exact, one white");
  eq(JSON.stringify(s([0, 1, 2, 3], [3, 2, 1, 4])), JSON.stringify({ black: 0, white: 3 }), "zero black, three white");
  eq(JSON.stringify(s([0, 0, 1, 2], [0, 1, 0, 3])), JSON.stringify({ black: 1, white: 2 }), "duplicates counted correctly");
  eq(JSON.stringify(s([0, 1, 2, 3], [4, 5, 0, 1])), JSON.stringify({ black: 0, white: 2 }), "zero black, two white");

  T.addColor(0);
  eq(JSON.stringify(T.currentGuess), JSON.stringify([0]), "first peg added");
  T.addColor(1);
  eq(JSON.stringify(T.currentGuess), JSON.stringify([0, 1]), "second peg added");
  eq(elements.get("guess-btn").disabled, true, "guess disabled until the row is full");

  T.undoLastPeg();
  eq(JSON.stringify(T.currentGuess), JSON.stringify([0]), "undo removes the last peg");
  eq(T.stats.undos, 1, "undo counted");
  T.undoLastPeg();
  eq(T.currentGuess.length, 0, "second undo empties the row");
  T.undoLastPeg();
  eq(T.stats.undos, 2, "undo with an empty row is a no-op");

  T.addColor(0);
  T.addColor(1);
  T.addColor(2);
  T.addColor(3);
  eq(JSON.stringify(T.currentGuess), JSON.stringify([0, 1, 2, 3]), "row filled");
  eq(elements.get("guess-btn").disabled, false, "guess enabled when the row is full");
  T.addColor(4);
  eq(T.currentGuess.length, 4, "adding beyond the peg count is ignored");
  T.undoLastPeg();
  eq(T.currentGuess.length, 3, "back to three pegs (3 undos so far)");
}

// ---------- C. Easy one-shot win ----------
{
  T.setDiff("easy");
  eq(T.pegCount, 4, "easy: 4 pegs");
  eq(T.colorCount, 4, "easy: 4 colors");
  eq(JSON.stringify(T.secret), JSON.stringify([2, 2, 2, 2]), "easy secret under pinned RNG");
  eq(elements.get("palette").children.length, 4, "4 palette colors on easy");

  guess([2, 2, 2, 2]);
  eq(T.gameOver, true, "game over after the win");
  eq(T.rowsLength, 1, "one guess recorded");
  eq(T.overlayTitle(), "Code Cracked! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("one-shot") !== -1, "win message mentions the one-shot", T.overlayMsg());
  eq(T.stats.games, 1, "board counted");
  eq(T.stats.wins, 5, "win recorded (4 migrated + 1)");
  eq(T.stats.oneShot, 1, "one-shot recorded");
  eq(T.stats.easyWins, 1, "easy win recorded");
  eq(T.stats.fastWins, 1, "fast win recorded");
  eq(T.stats.streak, 3, "streak continues the migrated 2");
  eq(T.stats.bestStreak, 3, "best streak updated");
  eq(T.stats.totalGuesses, 1, "guess counted");
  eq(elements.get("wins").textContent, 5, "Wins HUD updated");
  eq(elements.get("streak").textContent, 3, "Streak HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Crack badge unlocks");
  ok(u.includes("one"), "One-Shot badge unlocks");
  ok(u.includes("easy"), "Warm-Up badge unlocks");
  ok(u.includes("win5"), "Serial Cracker badge unlocks at 5 wins");
  ok(u.includes("streak2"), "Two in a Row badge unlocks (streak 3)");
  ok(u.includes("streak3"), "Hat Trick badge unlocks (streak 3)");
  eq(u.length, 6, "six badges unlocked so far");
  T.overlay.hide();
}

// ---------- D. Normal win in four guesses ----------
{
  T.setDiff("normal");
  eq(JSON.stringify(T.secret), JSON.stringify([3, 3, 3, 3]), "normal secret under pinned RNG");
  guess([0, 0, 0, 0]);
  eq(T.gameOver, false, "still going after guess 1");
  guess([1, 1, 1, 1]);
  guess([2, 2, 2, 2]);
  guess([3, 3, 3, 3]);
  eq(T.gameOver, true, "win on the fourth guess");
  eq(T.rowsLength, 4, "four rows recorded");
  eq(JSON.stringify(T.rows[0]), JSON.stringify({ guess: [0, 0, 0, 0], black: 0, white: 0 }), "first row scored 0/0");
  eq(JSON.stringify(T.rows[3]), JSON.stringify({ guess: [3, 3, 3, 3], black: 4, white: 0 }), "winning row scored 4 black");
  eq(T.stats.games, 2, "second board");
  eq(T.stats.wins, 6, "sixth win");
  eq(T.stats.normalWins, 1, "normal win recorded");
  eq(T.stats.oneShot, 1, "one-shot unchanged");
  eq(T.stats.fastWins, 1, "4 guesses is not fast");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.totalGuesses, 5, "5 guesses in total");
  ok(T.unlocked().includes("normal"), "Street Level badge unlocks");
  eq(T.unlocked().length, 7, "seven badges unlocked");
  T.overlay.hide();
}

// ---------- E. Hard win in three guesses ----------
{
  T.setDiff("hard");
  eq(T.pegCount, 5, "hard: 5 pegs");
  eq(JSON.stringify(T.secret), JSON.stringify([3, 3, 3, 3, 3]), "hard secret under pinned RNG");
  guess([0, 0, 0, 0, 0]);
  guess([1, 1, 1, 1, 1]);
  eq(T.gameOver, false, "two wrong guesses so far");
  guess([3, 3, 3, 3, 3]);
  eq(T.gameOver, true, "win on the third guess");
  eq(T.rowsLength, 3, "three rows recorded");
  eq(T.stats.games, 3, "third board");
  eq(T.stats.wins, 7, "seventh win");
  eq(T.stats.hardWins, 1, "hard win recorded");
  eq(T.stats.fastWins, 2, "3 guesses counts as fast");
  eq(T.stats.streak, 5, "streak is 5");
  eq(T.stats.totalGuesses, 8, "8 guesses in total");
  const u = T.unlocked();
  ok(u.includes("hard"), "Hard Mode badge unlocks");
  ok(u.includes("allDiff"), "All Rounder badge unlocks (all three difficulties)");
  eq(u.length, 9, "nine badges unlocked");
  T.overlay.hide();
}

// ---------- F. Out of guesses ----------
{
  T.setDiff("normal");
  for (let i = 0; i < 10; i++) guess([0, 1, 2, 3]);
  eq(T.gameOver, true, "game over after 10 guesses");
  eq(T.rowsLength, 10, "ten rows recorded");
  eq(T.overlayTitle(), "Out of Guesses 💀", "loss overlay shown");
  ok((T.overlayMsg() || "").indexOf("blue") !== -1, "loss message reveals the code by color name", T.overlayMsg());
  eq(T.stats.games, 4, "loss counts as a finished board");
  eq(T.stats.wins, 7, "win count unchanged");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.totalGuesses, 18, "18 guesses in total");
  T.overlay.hide();
}

// ---------- G/H/I/J. Easy one-shots (win5 -> win10, fast5) ----------
{
  T.setDiff("easy");
  guess([2, 2, 2, 2]);
  eq(T.gameOver, true, "G: win");
  eq(T.stats.wins, 8, "G: eighth win");
  eq(T.stats.oneShot, 2, "G: second one-shot");
  eq(T.stats.fastWins, 3, "G: third fast win");
  eq(T.stats.streak, 1, "G: streak rebuilt after the loss");
  eq(T.stats.games, 5, "G: fifth board");
  T.overlay.hide();

  T.newGame();
  guess([2, 2, 2, 2]);
  eq(T.stats.wins, 9, "H: ninth win");
  eq(T.stats.fastWins, 4, "H: fourth fast win");
  eq(T.stats.streak, 2, "H: streak is 2");
  T.overlay.hide();

  T.newGame();
  guess([2, 2, 2, 2]);
  eq(T.gameOver, true, "I: win");
  eq(T.stats.wins, 10, "I: tenth win");
  eq(T.stats.oneShot, 4, "I: fourth one-shot");
  eq(T.stats.fastWins, 5, "I: fifth fast win");
  eq(T.stats.games, 7, "I: seventh board");
  const u = T.unlocked();
  ok(u.includes("win10"), "Code Master badge unlocks at 10 wins");
  ok(u.includes("fast5"), "Lightning badge unlocks at 5 fast wins");
  eq(u.length, 11, "eleven badges unlocked");
  ok(!u.includes("games20"), "Dedicated still locked (7 boards)");
  ok(!u.includes("guesses100"), "Investigator still locked (21 guesses)");
  T.overlay.hide();

  T.newGame();
  guess([2, 2, 2, 2]);
  eq(T.stats.wins, 11, "J: eleventh win");
  eq(T.stats.oneShot, 5, "J: fifth one-shot");
  eq(T.stats.fastWins, 6, "J: sixth fast win");
  eq(T.stats.games, 8, "J: eighth board");
  T.overlay.hide();
}

// ---------- K. Undo badge ----------
{
  eq(T.stats.undos, 3, "three undos from section B");
  T.newGame();
  for (let i = 0; i < 7; i++) {
    T.addColor(0);
    T.undoLastPeg();
  }
  eq(T.stats.undos, 10, "ten undos in total");
  ok(T.unlocked().includes("undo10"), "Second Thoughts badge unlocks at 10 undos");
  eq(T.unlocked().length, 12, "twelve badges unlocked");
}

// ---------- L. Final badge tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "one", "easy", "normal", "hard", "allDiff",
    "win5", "win10", "streak2", "streak3", "fast5", "undo10",
  ];
  ok(u.length === 12 && expected.every((id) => u.includes(id)), "exactly the 12 earned badges are unlocked", u);
  eq(T.stats.easyWins, 5, "five easy wins");
  eq(T.stats.normalWins, 1, "one normal win");
  eq(T.stats.hardWins, 1, "one hard win");
  eq(T.stats.bestStreak, 5, "best streak 5");
  eq(T.stats.totalGuesses, 22, "career guess total checks out (1+4+3+10+4)");
}

// ---------- M. Pause ----------
{
  T.setDiff("easy");
  T.addColor(0);
  keydown("p");
  eq(T.paused, true, "P pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.addColor(1);
  eq(T.currentGuess.length, 1, "peg adds blocked while paused");
  T.doGuess();
  eq(T.rowsLength, 0, "guesses blocked while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.addColor(1);
  eq(T.currentGuess.length, 2, "peg adds work after resume");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();

  // Game over suppresses pause
  T.setDiff("easy");
  guess([2, 2, 2, 2]);
  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "Code Cracked! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- N. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("mastermind-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("mastermind-sound"), "on", "preference restored");
}

// ---------- O. Badges modal ----------
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
