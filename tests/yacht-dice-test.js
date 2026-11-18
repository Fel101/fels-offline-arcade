// Deterministic tests for games/yacht-dice/script.js
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
  "turn", "best", "games", "dice-row", "roll", "new-game", "sheet-body", "badges-btn",
  "badge-count", "sound-btn", "sound-icon", "badges2", "toasts", "achv-modal",
  "achv-grid", "achv-count", "achv-records",
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
  querySelector: () => makeEl("div"),
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

// Legacy best score from the pre-core build.
storage.set("yahtzee-best", "123");

const root = require("./_env").root;
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/yacht-dice/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__YAHTZEE;
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

function score(key, faces) {
  T.setDice(faces);
  T.scoreCategory(key);
}

const PERFECT = [
  ["aces", [1, 1, 1, 1, 1]],
  ["twos", [2, 2, 2, 2, 2]],
  ["threes", [3, 3, 3, 3, 3]],
  ["fours", [4, 4, 4, 4, 4]],
  ["fives", [5, 5, 5, 5, 5]],
  ["sixes", [6, 6, 6, 6, 6]],
  ["threeKind", [6, 6, 6, 1, 1]],
  ["fourKind", [6, 6, 6, 6, 1]],
  ["fullHouse", [6, 6, 6, 1, 1]],
  ["smallStraight", [1, 2, 3, 4, 6]],
  ["largeStraight", [2, 3, 4, 5, 6]],
  ["yahtzee", [6, 6, 6, 6, 6]],
  ["chance", [6, 6, 6, 6, 6]],
];

function playPerfect() {
  for (const [key, faces] of PERFECT) score(key, faces);
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.best, 123, "legacy best score migrated");
  eq(storage.has("yahtzee-best"), false, "legacy key removed");
  eq(T.stats.games, 0, "no games yet");
  eq(T.stats.total, 0, "no career points yet");
  eq(T.stats.yahtzees, 0, "no yahtzees yet");
  eq(T.stats.upperBonuses, 0, "no upper bonuses yet");
  eq(T.stats.fullHouses, 0, "no full houses yet");
  eq(T.stats.largeStraights, 0, "no large straights yet");
  eq(T.stats.best, elements.get("best").textContent, "best HUD");
  eq(elements.get("games").textContent, 0, "games HUD");
  eq(elements.get("turn").textContent, 1, "turn starts at 1");
  eq(T.rollsLeft, 3, "three rolls left");
  eq(T.dice.join(""), "00000", "dice start empty");
  eq(T.finished, false, "game is live");
  eq(elements.get("dice-row").children.length, 5, "five dice rendered");
  eq(Object.keys(T.scoreBtns).length, 13, "thirteen score buttons");
  for (const key of Object.keys(T.scoreBtns)) eq(T.scoreBtns[key].disabled, true, key + " starts disabled");
  eq(T.CATEGORIES.length, 13, "thirteen categories");
  eq(T.CATEGORIES.filter((c) => c.section === "upper").length, 6, "six upper categories");
  eq(T.CATEGORIES.filter((c) => c.section === "lower").length, 7, "seven lower categories");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  eq(elements.get("roll").textContent, "Roll (3 left)", "roll button label");
}

// ---------- B. Rolling, holding, resetting ----------
{
  T.roll();
  eq(T.dice.join(""), "44444", "rolls land on fours with a pinned RNG");
  eq(T.rollsLeft, 2, "two rolls left");
  eq(elements.get("roll").textContent, "Roll (2 left)", "roll button counts down");
  eq(T.scoreBtns.fours.textContent, 20, "fours preview");
  eq(T.scoreBtns.aces.textContent, 0, "aces preview");
  eq(T.scoreBtns.yahtzee.textContent, 50, "five of a kind previews a Yacht");
  eq(T.scoreBtns.chance.textContent, 20, "chance preview");
  eq(T.scoreBtns.fours.disabled, false, "categories are clickable after a roll");

  T.toggleHold(0);
  eq(T.held[0], true, "die 0 held");
  eq(elements.get("dice-row").children[0].children[0].classList.contains("held"), true, "held die styled");

  T.setDice([6, 6, 6, 6, 6]);
  T.toggleHold(0);
  Math.random = () => 0; // every fresh die lands on 1
  T.roll();
  Math.random = () => 0.5;
  eq(T.dice.join(""), "61111", "held die is kept while the rest reroll");
  eq(T.rollsLeft, 1, "one roll left");

  T.roll();
  eq(T.rollsLeft, 0, "no rolls left");
  eq(elements.get("roll").textContent, "No rolls left", "roll button disabled label");
  eq(elements.get("roll").disabled, true, "roll button disabled");

  T.newGame();
  eq(T.turn, 1, "new game resets the turn");
  eq(T.rollsLeft, 3, "new game restores three rolls");
  eq(T.dice.join(""), "00000", "new game clears the dice");
  eq(T.stats.best, 123, "the best score survives a new game");
  eq(elements.get("roll").textContent, "Roll (3 left)", "roll button reset");
}

// ---------- C. A perfect score sheet ----------
{
  score("aces", [1, 1, 1, 1, 1]);
  eq(T.scores.aces, 5, "aces score");
  eq(T.turn, 2, "turn advances");
  score("twos", [2, 2, 2, 2, 2]);
  score("threes", [3, 3, 3, 3, 3]);
  score("fours", [4, 4, 4, 4, 4]);
  score("fives", [5, 5, 5, 5, 5]);
  eq(T.turn, 6, "six categories played");
  score("sixes", [6, 6, 6, 6, 6]);
  eq(T.scores.sixes, 30, "sixes score");
  eq(T.turn, 7, "turn 7");
  eq(T.scoreBtns.aces.textContent, 5, "scored category shows its value");
  eq(T.scoreBtns.aces.disabled, true, "scored category is locked");
  eq(T.stats.yahtzees, 0, "no Yahtzee category yet");
  eq(T.stats.upperBonuses, 0, "the bonus is only counted at the end");

  score("threeKind", [6, 6, 6, 1, 1]);
  eq(T.scores.threeKind, 20, "3 of a kind score");
  score("fourKind", [6, 6, 6, 6, 1]);
  eq(T.scores.fourKind, 25, "4 of a kind score");
  score("fullHouse", [6, 6, 6, 1, 1]);
  eq(T.scores.fullHouse, 25, "full house score");
  eq(T.stats.fullHouses, 1, "full house tracked immediately");
  score("smallStraight", [1, 2, 3, 4, 6]);
  eq(T.scores.smallStraight, 30, "small straight score");
  score("largeStraight", [2, 3, 4, 5, 6]);
  eq(T.scores.largeStraight, 40, "large straight score");
  eq(T.stats.largeStraights, 1, "large straight tracked immediately");
  score("yahtzee", [6, 6, 6, 6, 6]);
  eq(T.scores.yahtzee, 50, "yahtzee score");
  eq(T.stats.yahtzees, 1, "yahtzee tracked immediately");
  eq(T.finished, false, "one category left");

  score("chance", [6, 6, 6, 6, 6]);
  eq(T.scores.chance, 30, "chance score");
  eq(T.finished, true, "the game finishes after 13 categories");
  eq(T.turn, 13, "turn stays on 13");
  eq(elements.get("roll").textContent, "Game over", "roll button says game over");
  eq(elements.get("roll").disabled, true, "roll button locked");

  eq(T.stats.games, 1, "game counted");
  eq(T.stats.best, 360, "best score");
  eq(T.stats.total, 360, "career total");
  eq(T.stats.upperBonuses, 1, "upper bonus counted");
  eq(elements.get("best").textContent, 360, "best HUD");
  eq(elements.get("games").textContent, 1, "games HUD");
  eq(T.overlayTitle(), "New Best! 🎉", "new best overlay");
  ok((T.overlayMsg() || "").indexOf("Total: 360") !== -1, "overlay total", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("includes 35 upper bonus") !== -1, "overlay bonus", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best: 360") !== -1, "overlay best", T.overlayMsg());
  eq(T.stats.yahtzees, 1, "one yahtzee");
  eq(T.stats.fullHouses, 1, "one full house");
  eq(T.stats.largeStraights, 1, "one large straight");

  const u = T.unlocked();
  ["first", "best150", "best200", "best250", "highroll", "yahtzee1", "bonus1", "fullhouse", "straight"].forEach((id) =>
    ok(u.includes(id), id + " badge unlocks")
  );
  eq(u.length, 9, "nine badges unlocked");
  eq(elements.get("badge-count").textContent, 9, "header badge count");

  score("aces", [1, 1, 1, 1, 1]);
  eq(T.stats.games, 1, "a finished game cannot keep scoring");
}

// ---------- D. A low-scoring game ----------
{
  T.newGame();
  eq(T.overlayTitle(), null, "New Game clears the overlay");
  for (const cat of T.CATEGORIES) score(cat.key, [1, 1, 1, 1, 1]);
  eq(T.finished, true, "the second game finishes");
  eq(T.stats.games, 2, "second game counted");
  eq(T.stats.best, 360, "the record holds");
  eq(T.stats.total, 430, "career total");
  eq(T.stats.upperBonuses, 1, "no second bonus");
  eq(T.stats.yahtzees, 2, "all ones is also a Yahtzee");
  eq(T.overlayTitle(), "Game over", "no new record");
  ok((T.overlayMsg() || "").indexOf("Total: 70") !== -1, "low total", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best: 360") !== -1, "best mentioned", T.overlayMsg());
  eq(T.unlocked().length, 9, "no new badges");
}

// ---------- E. Grind out ten games and all badges ----------
{
  for (let i = 0; i < 8; i++) {
    T.newGame();
    playPerfect();
    eq(T.finished, true, "perfect game " + (i + 3) + " finished");
  }
  eq(T.stats.games, 10, "ten games");
  eq(T.stats.total, 3310, "career total");
  eq(T.stats.yahtzees, 10, "ten yahtzees");
  eq(T.stats.upperBonuses, 9, "nine upper bonuses");
  eq(T.stats.fullHouses, 9, "nine full houses");
  eq(T.stats.largeStraights, 9, "nine large straights");
  eq(T.stats.best, 360, "best stays 360");

  const u = T.unlocked();
  ["games5", "games10", "yahtzee3", "bonus3", "career1000"].forEach((id) =>
    ok(u.includes(id), id + " badge unlocks")
  );
  eq(u.length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- F. Pause ----------
{
  T.newGame();
  T.togglePause();
  eq(T.paused, true, "pause on");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  eq(elements.get("roll").textContent, "Paused", "roll button says paused");
  eq(elements.get("roll").disabled, true, "roll blocked while paused");
  T.roll();
  eq(T.rollsLeft, 3, "rolling is blocked while paused");
  eq(T.dice.join(""), "00000", "no dice rolled while paused");
  T.setDice([6, 6, 6, 6, 6]);
  T.scoreCategory("aces");
  eq(T.scores.aces, null, "scoring is blocked while paused");

  T.togglePause();
  eq(T.paused, false, "pause off");
  eq(T.overlayTitle(), null, "pause overlay hidden");
  eq(elements.get("roll").disabled, false, "roll enabled again");

  winEvent("blur");
  eq(T.paused, true, "blur pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");

  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  // A finished game ignores pause.
  playPerfect();
  eq(T.finished, true, "eleventh game finished");
  eq(T.stats.games, 11, "eleven games");
  eq(T.stats.total, 3670, "career total");
  eq(T.stats.yahtzees, 11, "eleven yahtzees");
  eq(T.stats.upperBonuses, 10, "ten upper bonuses");
  eq(T.overlayTitle(), "Game over", "no new record on the eleventh game");
  T.setPaused(true);
  eq(T.paused, false, "a finished game cannot pause");
  eq(T.overlayTitle(), "Game over", "the game-over overlay survives");
}

// ---------- G. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("yahtzee-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("yahtzee-sound"), "on", "preference restored");
}

// ---------- H. Badges modal ----------
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

// ---------- I. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "games5", "games10", "best150", "best200", "best250", "highroll",
    "yahtzee1", "yahtzee3", "bonus1", "bonus3", "fullhouse", "straight", "career1000",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.games, 11, "games");
  eq(T.stats.best, 360, "best");
  eq(T.stats.total, 3670, "career points");
  eq(T.stats.yahtzees, 11, "yahtzees");
  eq(T.stats.upperBonuses, 10, "upper bonuses");
  eq(T.stats.fullHouses, 10, "full houses");
  eq(T.stats.largeStraights, 10, "large straights");
  ok(storage.has("yahtzee-stats-v1"), "stats persisted under the core key");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
