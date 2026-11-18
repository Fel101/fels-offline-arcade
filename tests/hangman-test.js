// Deterministic tests for games/hangman/script.js
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

// Fake 2D context that logs the drawing calls.
const ctxLog = [];
const fakeCtx = {
  strokeStyle: "",
  lineWidth: 0,
  lineCap: "",
  lineJoin: "",
  clearRect() {
    ctxLog.length = 0;
  },
  beginPath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  stroke() {
    ctxLog.push("stroke");
  },
};
const gallows = makeEl("canvas", "gallows");
gallows.width = 300;
gallows.height = 240;
gallows.getContext = () => fakeCtx;
elements.set("gallows", gallows);

const ids = [
  "category", "word", "keyboard", "wins", "streak", "lives", "new-word", "hint",
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
storage.set("hangman-wins", "2");
storage.set("hangman-streak", "1");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/hangman/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__HANGMAN;
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
function slots() {
  return elements.get("word").children;
}
function keyBtn(letter) {
  const rows = elements.get("keyboard").children;
  for (const row of rows) {
    for (const b of row.children) if (b.textContent === letter) return b;
  }
  return null;
}
const WRONG = ["Z", "X", "Q", "J", "V", "B"];

// ---------- A. Init + legacy migration ----------
{
  eq(T.MAX_WRONG, 6, "six wrong guesses allowed");
  eq(T.stats.wins, 2, "legacy wins migrated");
  eq(T.stats.streak, 1, "legacy streak migrated");
  eq(T.stats.bestStreak, 0, "best streak has no legacy source");
  eq(T.stats.games, 0, "legacy data did not invent games");
  eq(T.stats.losses, 0, "no losses yet");
  eq(T.stats.wrongGuesses, 0, "no wrong guesses yet");
  eq(storage.has("hangman-wins"), false, "legacy wins key removed");
  eq(storage.has("hangman-streak"), false, "legacy streak key removed");
  eq(storage.has("hangman-stats-v1"), true, "stats persisted under the core key");
  eq(elements.get("wins").textContent, 2, "Wins HUD shows migrated value");
  eq(elements.get("streak").textContent, 1, "Streak HUD shows migrated value");
  eq(elements.get("lives").textContent, 6, "Lives HUD starts at 6");
  ok(Object.prototype.hasOwnProperty.call(T.CATEGORIES, T.category), "a real category was picked", T.category);
  ok(T.CATEGORIES[T.category].includes(T.word), "the word belongs to the category", T.word);
  eq(T.guessed.length, 0, "no letters guessed");
  eq(T.wrong, 0, "no wrong guesses");
  eq(T.gameOver, false, "not game over");
  eq(T.paused, false, "not paused");
  eq(slots().length, T.word.length, "one slot per letter");
  eq(elements.get("category").textContent, T.category, "category shown");
  eq(elements.get("keyboard").children.length, 3, "three keyboard rows");
  eq(elements.get("keyboard").children[0].children.length, 10, "top row has 10 keys");
  eq(elements.get("keyboard").children[1].children.length, 9, "middle row has 9 keys");
  eq(elements.get("keyboard").children[2].children.length, 7, "bottom row has 7 keys");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  eq(elements.get("hint").textContent.indexOf("Esc pauses") !== -1, true, "hint mentions Esc");
  eq(ctxLog.length, 1, "fresh canvas has just the ground line");
}

// ---------- B. Rules and a six-wrong loss ----------
{
  T.setWord("TIGER", "Animals");
  eq(T.word, "TIGER", "target pinned");
  eq(slots().length, 5, "five slots for TIGER");
  eq(slots()[0].textContent, "", "slots start empty");
  eq(elements.get("lives").textContent, 6, "lives reset");

  T.guess("T");
  eq(T.wrong, 0, "correct letter is not a wrong guess");
  eq(slots()[0].textContent, "T", "T revealed");
  ok(!slots()[1].textContent, "I not revealed");
  const tb = keyBtn("T");
  ok(tb && tb.classList.contains("key--good") && tb.disabled, "T key marked good and disabled");

  T.guess("T");
  eq(T.guessed.length, 1, "a repeated letter is ignored");

  T.guess("Z");
  eq(T.wrong, 1, "wrong letter counted");
  eq(T.stats.wrongGuesses, 1, "career wrong guesses counted");
  eq(elements.get("lives").textContent, 5, "lives drop to 5");
  eq(elements.get("streak").textContent, 1, "streak HUD unchanged");
  const zb = keyBtn("Z");
  ok(zb && zb.classList.contains("key--bad") && zb.disabled, "Z key marked bad and disabled");
  eq(ctxLog.length, 2, "gallows drawn (stage 1)");

  for (const ch of ["A", "B", "C"]) T.guess(ch);
  eq(T.wrong, 4, "four wrong guesses");
  eq(elements.get("lives").textContent, 2, "lives at 2");
  eq(ctxLog.length, 5, "stages 2-4 drawn (head, body, arm)");

  T.guess("D");
  eq(T.wrong, 5, "five wrong guesses");
  eq(elements.get("lives").textContent, 1, "one life left");
  eq(ctxLog.length, 6, "stage 5 drawn (second arm)");

  T.guess("F");
  eq(T.wrong, 6, "six wrong guesses");
  eq(T.gameOver, true, "six wrong guesses lose the game");
  eq(T.overlayTitle(), "Out of lives! 😵", "loss overlay shown");
  ok((T.overlayMsg() || "").indexOf("The word was TIGER.") !== -1, "word revealed in the overlay", T.overlayMsg());
  eq(ctxLog.length, 7, "stage 6 drawn (legs)");
  eq(slots().length, 5, "five slots on the revealed word");
  eq(slots()[1].textContent, "I", "unguessed I revealed");
  ok(slots()[1].classList.contains("slot--missed"), "revealed letter marked missed");
  eq(slots()[0].textContent, "T", "guessed T still shown");
  ok(!slots()[0].classList.contains("slot--missed"), "guessed T not marked missed");
  eq(T.stats.games, 1, "game counted");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.bestStreak, 0, "no best streak yet");
  eq(T.stats.wrongGuesses, 6, "six career wrong guesses");
  eq(T.stats.animalWins, 0, "no animal wins from a loss");
  eq(elements.get("streak").textContent, 0, "Streak HUD reset");
  eq(T.unlocked().length, 1, "only First Win (from the migrated wins) is unlocked");
  const ib = keyBtn("I");
  ok(ib && ib.disabled, "keyboard disabled after a loss");
  T.guess("I");
  eq(T.guessed.length, 7, "guesses are ignored once the game is over");
}

// ---------- C. Perfect win ----------
{
  T.setWord("CAT", "Animals");
  eq(T.gameOver, false, "a new round resets the game-over flag");
  eq(T.guessed.length, 0, "letters reset");
  eq(T.wrong, 0, "wrong guesses reset");
  eq(elements.get("lives").textContent, 6, "lives reset");
  eq(slots()[0].textContent, "", "slots cleared");

  T.guess("C");
  eq(slots()[0].textContent, "C", "C revealed");
  eq(slots()[1].textContent, "", "A not yet revealed");
  T.guess("A");
  eq(T.gameOver, false, "one letter left");
  T.guess("T");
  eq(T.gameOver, true, "solving the word ends the game");
  eq(T.overlayTitle(), "You got it! 🎉", "win overlay shown");
  ok((T.overlayMsg() || "").indexOf("The word was CAT.") !== -1, "word in the overlay", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Streak 1.") !== -1, "streak in the overlay", T.overlayMsg());
  eq(slots().length, 3, "three slots");
  eq(slots()[2].textContent, "T", "full word shown");
  eq(T.stats.games, 2, "second game");
  eq(T.stats.wins, 3, "third win");
  eq(T.stats.streak, 1, "streak restarts at 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.perfectWins, 1, "flawless win counted");
  eq(T.stats.animalWins, 1, "animal win counted");
  eq(T.stats.wrongGuesses, 6, "no extra wrong guesses");
  eq(elements.get("wins").textContent, 3, "Wins HUD updated");
  const u = T.unlocked();
  ok(u.includes("first"), "First Win badge unlocks");
  ok(u.includes("perfect"), "Flawless badge unlocks");
  ok(u.includes("animal"), "Zoologist badge unlocks");
  eq(u.length, 3, "three badges unlocked");
  T.overlay.hide();
}

// ---------- D. Food win builds a streak ----------
{
  T.setWord("PIZZA", "Food");
  for (const ch of ["P", "I", "Z", "A"]) T.guess(ch);
  eq(slots()[0].textContent, "P", "P revealed");
  eq(slots()[1].textContent, "I", "I revealed");
  eq(slots()[2].textContent, "Z", "first Z revealed");
  eq(slots()[3].textContent, "Z", "second Z revealed from the same guess");
  eq(slots()[4].textContent, "A", "A revealed");
  eq(T.gameOver, true, "PIZZA solved");
  eq(T.stats.games, 3, "third game");
  eq(T.stats.wins, 4, "fourth win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.bestStreak, 2, "best streak is 2");
  eq(T.stats.perfectWins, 2, "second flawless win");
  eq(T.stats.foodWins, 1, "food win counted");
  const u = T.unlocked();
  ok(u.includes("streak2"), "Two in a Row badge unlocks");
  ok(u.includes("food"), "Foodie badge unlocks");
  eq(u.length, 5, "five badges unlocked");
  T.overlay.hide();
}

// ---------- E. Space win on the last life ----------
{
  T.setWord("MOON", "Space");
  T.guess("M");
  T.guess("O");
  for (const ch of ["A", "B", "C", "D"]) T.guess(ch);
  eq(T.wrong, 4, "four wrong guesses");
  eq(elements.get("lives").textContent, 2, "two lives left");
  T.guess("E");
  eq(T.wrong, 5, "five wrong guesses");
  eq(elements.get("lives").textContent, 1, "one life left");
  eq(T.gameOver, false, "still alive");
  T.guess("N");
  eq(T.gameOver, true, "MOON solved on the last life");
  eq(T.stats.games, 4, "fourth game");
  eq(T.stats.wins, 5, "fifth win");
  eq(T.stats.streak, 3, "streak is 3");
  eq(T.stats.bestStreak, 3, "best streak is 3");
  eq(T.stats.perfectWins, 2, "a five-wrong win is not flawless");
  eq(T.stats.lastLifeWins, 1, "last-gasp win counted");
  eq(T.stats.spaceWins, 1, "space win counted");
  eq(T.stats.wrongGuesses, 11, "eleven career wrong guesses");
  const u = T.unlocked();
  ok(u.includes("win5"), "Regular badge unlocks at 5 wins");
  ok(u.includes("streak3"), "Hat Trick badge unlocks");
  ok(u.includes("lastLife"), "Last Gasp badge unlocks");
  ok(u.includes("space"), "Astronomer badge unlocks");
  eq(u.length, 9, "nine badges unlocked");
  T.overlay.hide();
}

// ---------- F. Wrong-guess grind (16 losses: 20 games, 107 wrong) ----------
{
  for (let i = 0; i < 16; i++) {
    T.setWord("CAT", "Animals");
    for (const ch of WRONG) T.guess(ch);
    eq(T.gameOver, true, "loss " + (i + 1) + " recorded");
    eq(T.overlayTitle(), "Out of lives! 😵", "loss overlay shown");
    if (i === 8) {
      eq(T.stats.losses, 10, "ten losses reached");
      ok(T.unlocked().includes("losses10"), "Persistence badge unlocks at 10 losses");
    }
    T.overlay.hide();
  }
  eq(T.stats.games, 20, "twenty games");
  eq(T.stats.losses, 17, "seventeen losses");
  eq(T.stats.wrongGuesses, 107, "one hundred and seven wrong guesses");
  eq(T.stats.wins, 5, "wins unchanged");
  const u = T.unlocked();
  ok(u.includes("wrong100"), "Brave Guesser badge unlocks");
  ok(u.includes("games20"), "Dedicated badge unlocks");
  eq(u.length, 12, "twelve badges unlocked");
  ok(!u.includes("win10"), "Champion still locked");
  ok(!u.includes("streak5"), "Unstoppable still locked");
}

// ---------- G. Four straight wins (streak 4, no fifth) ----------
{
  for (let i = 0; i < 4; i++) {
    T.setWord("CAT", "Animals");
    T.guess("C");
    T.guess("A");
    T.guess("T");
    eq(T.gameOver, true, "win " + (i + 1) + " recorded");
    T.overlay.hide();
  }
  eq(T.stats.games, 24, "twenty-four games");
  eq(T.stats.wins, 9, "nine wins");
  eq(T.stats.streak, 4, "streak is 4");
  eq(T.stats.bestStreak, 4, "best streak is 4");
  eq(T.stats.perfectWins, 6, "six flawless wins");
  eq(T.stats.animalWins, 5, "five animal wins");
  eq(T.unlocked().length, 12, "no new badges yet");
}

// ---------- H. One loss breaks the streak ----------
{
  T.setWord("CAT", "Animals");
  for (const ch of WRONG) T.guess(ch);
  eq(T.gameOver, true, "loss recorded");
  eq(T.stats.games, 25, "twenty-five games");
  eq(T.stats.losses, 18, "eighteen losses");
  eq(T.stats.streak, 0, "loss resets the streak");
  eq(T.stats.bestStreak, 4, "best streak stays 4");
  eq(T.stats.wrongGuesses, 113, "one hundred and thirteen wrong guesses");
  eq(T.unlocked().length, 12, "no new badges from the loss");
  T.overlay.hide();
}

// ---------- I. Tenth win ----------
{
  T.setWord("CAT", "Animals");
  T.guess("C");
  T.guess("A");
  T.guess("T");
  eq(T.gameOver, true, "win recorded");
  eq(T.stats.games, 26, "twenty-six games");
  eq(T.stats.wins, 10, "ten wins");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 4, "best streak stays 4");
  eq(T.stats.perfectWins, 7, "seven flawless wins");
  eq(T.stats.animalWins, 6, "six animal wins");
  ok(T.unlocked().includes("win10"), "Champion badge unlocks");
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
  T.overlay.hide();
}

// ---------- J. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "streak2", "streak3", "perfect", "lastLife",
    "animal", "food", "space", "wrong100", "games20", "losses10",
  ];
  ok(u.length === 13 && expected.every((id) => u.includes(id)), "exactly the 13 earned badges are unlocked", u);
  ok(u.indexOf("streak5") === -1, "Unstoppable is the only locked badge");
  eq(T.stats.games, 26, "games");
  eq(T.stats.wins, 10, "wins");
  eq(T.stats.losses, 18, "losses");
  eq(T.stats.streak, 1, "streak");
  eq(T.stats.bestStreak, 4, "best streak");
  eq(T.stats.perfectWins, 7, "flawless wins");
  eq(T.stats.lastLifeWins, 1, "last-gasp wins");
  eq(T.stats.wrongGuesses, 113, "wrong guesses");
  eq(T.stats.animalWins, 6, "animal wins");
  eq(T.stats.foodWins, 1, "food wins");
  eq(T.stats.spaceWins, 1, "space wins");
}

// ---------- K. Mouse + keyboard input ----------
{
  T.setWord("CAT", "Animals");
  const cb = keyBtn("C");
  cb.dispatch("click");
  eq(T.guessed.length, 1, "clicking a key guesses the letter");
  eq(slots()[0].textContent, "C", "clicked letter revealed");
  keyBtn("A").dispatch("click");
  eq(slots()[1].textContent, "A", "second click revealed A");
  keydown("t");
  eq(T.gameOver, true, "physical keyboard completed the word");
  eq(T.stats.wins, 11, "eleventh win");
  eq(T.stats.games, 27, "twenty-seventh game");
  eq(T.stats.perfectWins, 8, "eighth flawless win");

  // Enter after a win starts a fresh word.
  keydown("Enter");
  eq(T.gameOver, false, "Enter starts a new round");
  eq(T.guessed.length, 0, "new round has no letters");
  eq(T.wrong, 0, "new round has no wrong guesses");
  eq(T.stats.games, 27, "starting a new round did not count a game");

  // Enter during play is not a guess.
  keydown("Enter");
  eq(T.guessed.length, 0, "Enter mid-round is ignored");
  T.overlay.hide();
}

// ---------- L. Pause ----------
{
  T.setWord("CAT", "Animals");
  T.guess("C");
  keydown("Escape");
  eq(T.paused, true, "Esc pauses the game");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  T.guess("A");
  eq(T.guessed.length, 1, "guesses blocked while paused");
  keydown("Escape");
  eq(T.paused, false, "Esc resumes the game");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  T.guess("A");
  eq(T.guessed.length, 2, "guessing works after resume");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  // A modifier key combination is not a guess.
  keydown("z", { ctrlKey: true, metaKey: false, altKey: false });
  eq(T.guessed.length, 2, "Ctrl+Z is ignored");

  T.guess("T");
  eq(T.gameOver, true, "word completed");

  winEvent("blur");
  eq(T.paused, false, "blur does not pause after a win");
  eq(T.overlayTitle(), "You got it! 🎉", "win overlay intact");
  T.overlay.hide();
}

// ---------- M. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("hangman-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("hangman-sound"), "on", "preference restored");
}

// ---------- N. Badges modal ----------
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
