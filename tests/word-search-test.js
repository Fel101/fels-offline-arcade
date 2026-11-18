// Deterministic tests for games/word-search/script.js
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
    value: "",
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
    querySelector(sel) {
      if (sel && sel.indexOf("[data-word=") === 0) {
        const word = sel.replace(/^\[data-word="?/, "").replace(/"?\]$/, "");
        const chip = document.createElement("span");
        chip.className = "ws-chip";
        chip.dataset.word = word;
        return chip;
      }
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
  "board", "word-list", "theme", "difficulty", "found", "time", "wins", "new-game",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "theme" || id === "difficulty" ? "select" : "div", id));
elements.get("theme").value = "Animals";
elements.get("difficulty").value = "normal";
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

// Win count from the pre-core build.
storage.set("wordsearch-wins", "2");

const root = require("./_env").root;
const dir = root + "games/word-search/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const W = global.window.__WORDSEARCH;
if (!W) {
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

// Build a 12x12 grid from a list of {word, r, c, dr, dc} placements.
function makeGrid(placements) {
  const g = Array.from({ length: 12 }, () => Array(12).fill("X"));
  const words = [];
  for (const p of placements) {
    const word = p.word;
    words.push(word);
    for (let i = 0; i < word.length; i++) g[p.r + p.dr * i][p.c + p.dc * i] = word[i];
  }
  return { grid: g, words };
}

const boardCell = (r, c) => elements.get("board").children[r * 12 + c];

// ---------- A. Init + legacy migration + placement ----------
{
  eq(W.stats.games, 1, "the opening puzzle is counted");
  eq(W.stats.wins, 2, "legacy wins migrated");
  eq(storage.has("wordsearch-wins"), false, "legacy key removed");
  eq(W.stats.words, 0, "no words found yet");
  eq(W.stats.bestTime, 0, "no best time yet");
  eq(W.stats.easyWins, 0, "no easy wins yet");
  eq(W.stats.normalWins, 0, "no normal wins yet");
  eq(W.stats.hardWins, 0, "no hard wins yet");
  eq(W.stats.themes.length, 0, "no themes finished yet");
  eq(W.GRID, 12, "12x12 grid");
  eq(W.grid.length, 12, "twelve rows");
  eq(W.grid[0].length, 12, "twelve columns");
  eq(W.words.length, 7, "normal difficulty places seven words");
  eq(W.remaining.length, 7, "all seven words are remaining");
  eq(W.words.every((w) => W.locate(w)), true, "every listed word is findable");
  eq(W.theme, "Animals", "default theme");
  eq(W.difficulty, "normal", "default difficulty");
  eq(W.foundCount, 0, "nothing found yet");
  eq(W.gameOver, false, "the puzzle is live");
  eq(W.paused, false, "not paused");
  eq(W.elapsed, 0, "clock starts at zero");
  eq(W.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(W.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(W.unlocked().length, 1, "the legacy wins unlock the first badge");
  ok(W.unlocked().includes("first"), "First Find unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(elements.get("found").textContent, "0/7", "found HUD");
  eq(elements.get("time").textContent, "0", "time HUD");
  eq(elements.get("wins").textContent, 2, "wins HUD");
  eq(W.overlayTitle(), null, "no overlay on load");
  eq(elements.get("board").children.length, 144, "144 grid cells rendered");
  eq(boardCell(0, 0).className.indexOf("ws-cell") !== -1, true, "cell class");
  eq(elements.get("word-list").children.length, 7, "seven word chips rendered");
}

// ---------- B. Crafted puzzle: selection rules and directions ----------
{
  const built = makeGrid([
    { word: "CAT", r: 0, c: 0, dr: 0, dc: 1 },
    { word: "DOG", r: 2, c: 0, dr: 1, dc: 0 },
    { word: "BIRD", r: 4, c: 4, dr: 1, dc: 1 },
  ]);
  W.setPuzzle({ grid: built.grid, words: built.words });
  eq(W.stats.games, 1, "loading a test puzzle does not count a game");
  eq(W.words.length, 3, "three test words");
  eq(W.remaining.length, 3, "three remaining");
  eq(W.cell(0, 0), "C", "grid letter");
  eq(elements.get("found").textContent, "0/3", "found HUD for the test puzzle");

  eq(W.click(0, 0), true, "the first click selects a start cell");
  eq(W.selStart && W.selStart.r, 0, "start row tracked");
  eq(boardCell(0, 0).classList.contains("sel"), true, "start cell highlighted");
  eq(W.click(0, 0), false, "clicking the same cell clears the selection");
  eq(W.selStart, null, "selection cleared");

  // A non-straight pair is rejected.
  W.click(0, 0);
  eq(W.click(2, 1), false, "a non-straight line is rejected");
  eq(W.selStart, null, "selection cleared after the bad line");
  eq(boardCell(0, 0).classList.contains("bad"), true, "the bad cells flash");
  eq(boardCell(0, 0).classList.contains("sel"), false, "the selection highlight is removed");

  // A straight line that is not a word is rejected.
  W.click(0, 0);
  eq(W.click(0, 1), false, "a straight non-word is rejected");
  eq(boardCell(0, 1).classList.contains("bad"), true, "the whole line flashes");

  // Forward word.
  W.click(0, 0);
  eq(W.click(0, 2), true, "CAT is found forwards");
  eq(W.remaining.length, 2, "two words remain");
  eq(W.foundCount, 1, "found count");
  eq(W.stats.words, 1, "word counted");
  eq(elements.get("found").textContent, "1/3", "found HUD");
  eq(boardCell(0, 1).classList.contains("found"), true, "found cells highlighted");
  eq(boardCell(0, 0).classList.contains("sel"), false, "selection highlight cleared");

  // Backwards / reversed word.
  W.setElapsed(45);
  eq(W.selectLine(4, 0, 2, 0), true, "DOG is found backwards");
  eq(W.remaining.length, 1, "one word remains");
  eq(W.stats.words, 2, "second word counted");
  eq(W.foundCount, 2, "found count");

  // Diagonal word, and the puzzle completes.
  eq(W.selectLine(7, 7, 4, 4), true, "BIRD is found diagonally");
  eq(W.gameOver, true, "the final word ends the puzzle");
  eq(W.stats.wins, 3, "win counted");
  eq(W.stats.normalWins, 1, "normal win counted");
  eq(W.stats.themes.join(","), "Animals", "theme recorded");
  eq(W.stats.bestTime, 45, "best time recorded");
  eq(elements.get("wins").textContent, 3, "wins HUD");
  eq(elements.get("time").textContent, "45", "time HUD");
  eq(W.overlayTitle(), "You found them all! 🎉", "win overlay");
  has(W.overlayMsg(), "Animals", "overlay names the theme");
  has(W.overlayMsg(), "45s", "overlay reports the time");
  has(W.overlayMsg(), "New best time", "the first finish is a record");
  ok(W.unlocked().includes("quick120"), "Under Two badge unlocks");
  ok(W.unlocked().includes("quick60"), "Under a Minute badge unlocks");
  eq(W.unlocked().length, 3, "three badges");
}

// ---------- C. Easy puzzle, pause, blur, modal ----------
{
  elements.get("theme").value = "Space";
  elements.get("difficulty").value = "easy";
  W.newGame();
  eq(W.stats.games, 2, "new puzzle counted");
  eq(W.words.length, 5, "easy places five words");
  eq(W.theme, "Space", "theme switched");
  eq(W.difficulty, "easy", "difficulty switched");
  eq(elements.get("found").textContent, "0/5", "found HUD resets");
  eq(W.elapsed, 0, "clock resets");
  eq(W.gameOver, false, "puzzle is live");

  keydown("Escape");
  eq(W.paused, true, "Escape pauses");
  eq(W.overlayTitle(), "Paused", "pause overlay");
  eq(W.click(0, 0), false, "grid clicks are blocked while paused");
  eq(W.selStart, null, "no selection while paused");

  keydown("Escape");
  eq(W.paused, false, "Escape resumes");
  eq(W.overlayTitle(), null, "pause overlay closed");

  winEvent("blur");
  eq(W.paused, true, "window blur pauses");
  keydown("Escape");
  eq(W.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(W.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(W.paused, false, "resumed again");

  keydown("p");
  eq(W.paused, true, "P pauses too");
  keydown("p");
  eq(W.paused, false, "P resumes");

  W.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(W.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "3 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(W.paused, true, "the puzzle stays paused behind the modal");
  eq(W.overlayTitle(), "Paused", "pause overlay still up");
  keydown("Escape");
  eq(W.paused, false, "and Escape resumes");

  W.setElapsed(30);
  eq(W.solve(), true, "the easy puzzle solves");
  eq(W.stats.wins, 4, "win counted");
  eq(W.stats.easyWins, 1, "easy win counted");
  eq(W.stats.themes.join(","), "Animals,Space", "second theme recorded");
  eq(W.stats.bestTime, 30, "faster best time");
  eq(W.stats.words, 8, "three more words found");
  ok(W.unlocked().includes("easyWin"), "Warm Up badge unlocks");
  eq(W.unlocked().length, 4, "four badges");
  has(W.overlayMsg(), "New best time", "record solve");
}

// ---------- D. Hard puzzle reaches all difficulties ----------
{
  elements.get("theme").value = "Ocean";
  elements.get("difficulty").value = "hard";
  W.newGame();
  eq(W.stats.games, 3, "third puzzle counted");
  eq(W.words.length, 9, "hard places nine words");
  W.setElapsed(90);
  eq(W.solve(), true, "the hard puzzle solves");
  eq(W.stats.wins, 5, "fifth win");
  eq(W.stats.hardWins, 1, "hard win counted");
  eq(W.stats.themes.join(","), "Animals,Space,Ocean", "third theme recorded");
  eq(W.stats.bestTime, 30, "best time unchanged");
  eq(W.stats.words, 17, "nine more words found");
  ok(W.unlocked().includes("hardWin"), "Deep Search badge unlocks");
  ok(W.unlocked().includes("triDifficulty"), "All Sizes badge unlocks");
  ok(W.unlocked().includes("win5"), "Puzzle Picker badge unlocks");
  eq(W.unlocked().length, 7, "seven badges");
}

// ---------- E. Word grind with single-word puzzles ----------
{
  let guard = 0;
  while (W.stats.words < 100 && guard++ < 120) {
    const built = makeGrid([{ word: "CAT", r: 0, c: 0, dr: 0, dc: 1 }]);
    W.setPuzzle({ grid: built.grid, words: built.words });
    W.setElapsed(300);
    W.solve();
  }
  eq(W.stats.words, 100, "one hundred words found");
  eq(W.stats.wins, 88, "eighty-eight wins");
  eq(W.stats.hardWins, 84, "the grinds count as hard wins");
  eq(W.stats.themes.length, 3, "no new themes from the grind");
  eq(W.stats.bestTime, 30, "the best time survives the slow grinds");
  ok(W.unlocked().includes("words25"), "Word Collector badge unlocks");
  ok(W.unlocked().includes("words100"), "Vocabulary badge unlocks");
  ok(W.unlocked().includes("win10"), "Grid Hunter badge unlocks");
  ok(W.unlocked().includes("win25"), "Search Master badge unlocks");
  eq(W.unlocked().length, 11, "eleven badges");
}

// ---------- F. Themes + game grind ----------
{
  for (const theme of ["Food", "Sports", "Dinosaurs"]) {
    elements.get("theme").value = theme;
    elements.get("difficulty").value = "normal";
    const built = makeGrid([{ word: "CAT", r: 0, c: 0, dr: 0, dc: 1 }]);
    W.setPuzzle({ grid: built.grid, words: built.words });
    W.setElapsed(100);
    W.solve();
  }
  eq(W.stats.themes.length, 6, "all six themes finished");
  eq(W.stats.themes.join(","), "Animals,Space,Ocean,Food,Sports,Dinosaurs", "theme order");
  eq(W.stats.wins, 91, "ninety-one wins");
  eq(W.stats.words, 103, "one hundred and three words");
  ok(W.unlocked().includes("allThemes"), "Globetrotter badge unlocks");
  eq(W.unlocked().length, 12, "twelve badges");

  // New Game button and the selectors both start a puzzle.
  let games = W.stats.games;
  elements.get("new-game").dispatch("click");
  eq(W.stats.games, games + 1, "New Game counts a puzzle");
  games = W.stats.games;
  elements.get("theme").value = "Food";
  elements.get("theme").dispatch("change");
  eq(W.stats.games, games + 1, "changing the theme starts a puzzle");
  games = W.stats.games;
  elements.get("difficulty").value = "easy";
  elements.get("difficulty").dispatch("change");
  eq(W.stats.games, games + 1, "changing the difficulty starts a puzzle");
  eq(W.words.length, 5, "the new puzzle respects the difficulty");

  let guard = 0;
  while (W.stats.games < 25 && guard++ < 40) W.newGame();
  eq(W.stats.games, 25, "twenty-five puzzles started");
  ok(W.unlocked().includes("games10"), "Ten Grids badge unlocks");
  ok(W.unlocked().includes("games25"), "Puzzle Shelf badge unlocks");
  eq(W.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- G. Sound + modal + final tally ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("word-search-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("word-search-sound"), "on", "preference restored");

  W.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Puzzles <b>25</b>", "puzzles record");
  has(records, "Finished <b>91</b>", "finished record");
  has(records, "Words found <b>103</b>", "words record");
  has(records, "Best time <b>30s</b>", "best time record");
  has(records, "Themes <b>6/6</b>", "themes record");
  W.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  W.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");

  const u = W.unlocked();
  const expected = [
    "first", "win5", "win10", "win25", "words25", "words100", "games10", "games25",
    "quick120", "quick60", "easyWin", "hardWin", "triDifficulty", "allThemes",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(W.stats.games, 25, "puzzles");
  eq(W.stats.wins, 91, "wins");
  eq(W.stats.words, 103, "words");
  eq(W.stats.bestTime, 30, "best time");
  eq(W.stats.easyWins, 1, "easy wins");
  eq(W.stats.normalWins, 4, "normal wins");
  eq(W.stats.hardWins, 84, "hard wins");
  eq(W.stats.themes.length, 6, "themes");
  eq(elements.get("wins").textContent, 91, "wins HUD");
  eq(elements.get("found").textContent, "0/5", "found HUD after the last restart");
  ok(storage.has("word-search-stats-v1"), "stats persisted");
  ok(storage.has("word-search-achv-v1"), "badges persisted");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
