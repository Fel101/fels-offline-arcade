// Deterministic tests for games/letter-grid/script.js
const fs = require("fs");

const listeners = {};
const elements = new Map();
let elementFromPoint = null;

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
    contains(node) {
      let n = node;
      while (n) {
        if (n === this) return true;
        n = n.parentNode;
      }
      return false;
    },
    closest(sel) {
      if (sel === ".bg-cell" && this.classList.contains("bg-cell")) return this;
      return this.parentNode ? this.parentNode.closest(sel) : null;
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
      if (k === "class") {
        this.className = String(v);
        this.classList = makeClassList();
        String(v)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => this.classList.add(c));
      }
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
        { target: this, button: 0, preventDefault() {}, stopPropagation() {}, clientX: 0, clientY: 0 },
        ev
      );
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    focus() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    querySelector(sel) {
      if (sel === ".bg-cell__letter" || sel === ".bg-cell__ord") return makeEl("span");
      return makeEl("div");
    },
    querySelectorAll() {
      return [];
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return this.children[0] || null;
    },
  });
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
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._html || "";
    },
    set(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
  });
  return el;
}

const ids = [
  "board", "board-wrap", "countdown", "countdown-num", "time", "score", "words",
  "longest", "hints", "best", "hint", "live", "current-word", "submit-word",
  "clear-word", "progress-text", "progress-fill", "hint-line", "found-list",
  "missed-wrap", "missed-list", "pause", "hint-btn", "new-game", "finish",
  "badges-btn", "badge-count", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "badges2",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("countdown").hidden = true;
elements.get("missed-wrap").hidden = true;
elements.get("finish").hidden = true;

const modeChips = ["classic", "sprint", "daily", "zen"].map((m) => {
  const e = makeEl("button", "mode-" + m);
  e.dataset.mode = m;
  return e;
});
const diffChips = [4, 5].map((s) => {
  const e = makeEl("button", "diff-" + s);
  e.dataset.size = String(s);
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    return makeEl("div");
  },
  querySelectorAll: (sel) => {
    if (sel === ".mode-chip") return modeChips;
    if (sel === ".diff-chip") return diffChips;
    return [];
  },
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
  elementFromPoint: () => elementFromPoint,
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
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(0xb06e);

const base = require("./_env").gameDir("letter-grid") + "/";
const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(base + "words.js", "utf8"));
  eval(fs.readFileSync(base + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__BG;
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
function deepEq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), msg, { actual: a, expected: b });
}

function traceWord(faces, n, word) {
  const visited = new Set();
  const path = [];
  function dfs(i, pos) {
    const face = faces[i];
    if (!word.startsWith(face, pos)) return false;
    const np = pos + face.length;
    path.push(i);
    visited.add(i);
    if (np === word.length) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const ni = nr * n + nc;
        if (!visited.has(ni) && dfs(ni, np)) return true;
      }
    }
    path.pop();
    visited.delete(i);
    return false;
  }
  for (let i = 0; i < n * n; i++) {
    if (dfs(i, 0)) return path.slice();
  }
  return null;
}

function setPlayable() {
  T.state.started = true;
  T.state.countdown = 0;
  T.state.over = false;
  T.state.paused = false;
}

// ---------- A. Dictionary ----------
{
  const words = global.window.BOGGLE_WORDS;
  ok(Array.isArray(words), "dictionary is an array");
  ok(words.length > 8000, "dictionary has 8000+ words", words.length);
  let bad = 0;
  for (const w of words) if (!/^[A-Z]{3,12}$/.test(w)) bad++;
  eq(bad, 0, "every dictionary entry is 3-12 uppercase letters");
  for (const w of ["CAT", "DOG", "PLANET", "QUIZ", "QUAIL", "HOUSE", "JELLYFISH"]) {
    ok(T.WORD_SET.has(w), `dictionary contains ${w}`);
  }
  ok(!T.WORD_SET.has("ZZZZZZ"), "dictionary rejects nonsense");
  eq(T.WORD_SET.size, words.length, "word set size matches the list");
}

// ---------- B. Dice ----------
{
  eq(T.facesFromDie("HIMNQU").join(","), "H,I,M,N,QU", "Qu die faces parse correctly");
  eq(T.facesFromDie("AAEEGN").join(","), "A,A,E,E,G,N", "plain die faces parse correctly");

  for (let s = 1; s <= 20; s++) {
    const faces = T.roll4(mulberry32(s));
    eq(faces.length, 16, `4x4 roll ${s} has 16 faces`);
    for (const f of faces) {
      ok(/^[A-Z]{1,2}$/.test(f) && (f !== "Q"), `4x4 face ${f} is valid`);
    }
  }
  for (let s = 1; s <= 10; s++) {
    const faces = T.roll5(mulberry32(s));
    eq(faces.length, 25, `5x5 roll ${s} has 25 faces`);
    const vowels = new Set(["A", "E", "I", "O", "U"]);
    const v = faces.filter((f) => f.length === 1 && vowels.has(f)).length;
    ok(v >= 7 && v <= 12, `5x5 roll ${s} has a friendly vowel count (${v})`);
    eq(faces.filter((f) => f === "QU").length <= 1, true, `5x5 roll ${s} has at most one Qu`);
  }
}

// ---------- C. solveBoard ----------
{
  const faces = [
    "C", "A", "T",
    "O", "D", "O",
    "G", "S", "X",
  ];
  const words = T.solveBoard(faces, 3);
  const set = new Set(words);
  for (const w of ["CAT", "DOG", "GOD", "DOT", "COD"]) {
    ok(set.has(w), `solver finds ${w} on the 3x3 board`);
  }
  for (const w of words) {
    ok(w.length >= 3, `solver word ${w} is at least 3 letters`);
    ok(T.WORD_SET.has(w), `solver word ${w} is in the dictionary`);
    ok(!!traceWord(faces, 3, w), `solver word ${w} is traceable`);
  }

  const quFaces = [
    "QU", "I", "T",
    "A", "B", "C",
    "D", "E", "F",
  ];
  const quWords = new Set(T.solveBoard(quFaces, 3));
  ok(quWords.has("QUIT"), "Qu cell builds QUIT");
}

// ---------- D. Generation ----------
{
  for (const size of [4, 5]) {
    for (let s = 1; s <= 4; s++) {
      const gen = T.generateBoard(size, mulberry32(s * 7919 + size));
      eq(gen.faces.length, size * size, `${size}x${size} gen ${s} face count`);
      ok(gen.words.length >= (T.SIZES[size] || T.SIZES[4]).minWords, `${size}x${size} gen ${s} has enough words (${gen.words.length})`);
      const set = new Set(gen.words);
      eq(set.size, gen.words.length, `${size}x${size} gen ${s} has no duplicate words`);
      for (const w of gen.words) {
        ok(w.length >= 3, `${size}x${size} gen ${s} word ${w} is long enough`);
        ok(T.WORD_SET.has(w), `${size}x${size} gen ${s} word ${w} is in the dictionary`);
        ok(!!traceWord(gen.faces, size, w), `${size}x${size} gen ${s} word ${w} is traceable`);
      }
      const res = T.solveBoard(gen.faces, size);
      deepEq(
        res.slice().sort(),
        gen.words.slice().sort(),
        `${size}x${size} gen ${s} solver agrees with stored words`
      );
    }
  }
}

// ---------- E. Scoring ----------
{
  eq(T.wordPoints(3), 1, "3 letters = 1 point");
  eq(T.wordPoints(4), 1, "4 letters = 1 point");
  eq(T.wordPoints(5), 2, "5 letters = 2 points");
  eq(T.wordPoints(6), 3, "6 letters = 3 points");
  eq(T.wordPoints(7), 5, "7 letters = 5 points");
  eq(T.wordPoints(8), 11, "8 letters = 11 points");
  eq(T.wordPoints(12), 11, "12 letters = 11 points");
}

// ---------- F. Path + submit ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  const word = s.possible[0];
  const path = traceWord(s.faces, s.size, word);
  ok(!!path, `generated word ${word} has a path`);
  for (const idx of path) T.addCell(idx);
  eq(T.snap().path.join(","), path.join(","), "path can be built cell by cell");
  eq(T.snap().path.length, word.length === 2 ? 1 : path.length, "path length matches the traced cells");
  T.submitPath();
  let snap = T.snap();
  eq(snap.found.length, 1, "valid word is recorded");
  eq(snap.found[0][0], word, "the recorded word matches");
  eq(snap.score, T.wordPoints(word.length), "score matches the word value");
  eq(snap.stats.words, 1, "stats count the word");
  ok(snap.unlocked.includes("first"), "first word badge unlocked");
  ok(snap.stats.quickWords >= 1, "quick word tracked");

  // Duplicate.
  const path2 = traceWord(s.faces, s.size, word);
  for (const idx of path2) T.addCell(idx);
  T.submitPath();
  snap = T.snap();
  eq(snap.found.length, 1, "duplicate word is not recorded twice");
  eq(snap.invalid, 1, "duplicate increments the miss counter");

  // Backtracking.
  T.clearPath();
  const p3 = s.possible[1] || s.possible[0];
  const path3 = traceWord(s.faces, s.size, p3);
  for (let i = 0; i < Math.min(2, path3.length); i++) T.addCell(path3[i]);
  const before = T.snap().path.slice();
  T.addCell(before[before.length - 2]);
  const after = T.snap().path.slice();
  eq(after.length, before.length - 1, "stepping back pops the last cell");

  // Invalid word.
  let badPath = null;
  let badWord = null;
  const seen = new Set();
  function walk(idx, str, pathArr) {
    if (badPath || pathArr.length >= 3) return;
    const face = s.faces[idx];
    const next = str + face;
    const np = pathArr.concat([idx]);
    if (np.length === 3) {
      if (!T.WORD_SET.has(next) && !seen.has(next)) {
        seen.add(next);
        badPath = np;
        badWord = next;
      }
      return;
    }
    const r = Math.floor(idx / s.size);
    const c = idx % s.size;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= s.size || nc < 0 || nc >= s.size) continue;
        const ni = nr * s.size + nc;
        if (!np.includes(ni)) walk(ni, next, np);
      }
    }
  }
  for (let i = 0; i < s.faces.length && !badPath; i++) walk(i, "", []);
  ok(!!badPath, "found a 3-letter non-word path");
  if (badPath) {
    const invalidBefore = T.snap().invalid;
    for (const idx of badPath) T.addCell(idx);
    T.submitPath();
    const snap2 = T.snap();
    eq(snap2.invalid, invalidBefore + 1, "non-word increments the miss counter");
    eq(snap2.score, T.snap().score, "non-word does not score");
    eq(snap2.path.length, 0, "non-word clears the path");
  }
}

// ---------- G. Hints ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const before = T.snap();
  T.useHint();
  let snap = T.snap();
  eq(snap.hintsLeft, before.hintsLeft - 1, "hint decrements the counter");
  eq(snap.hintsUsed, 1, "hint increments hints used");
  eq(snap.hintWord.length > 0, true, "hint reveals a word");
  ok(snap.possible.includes(snap.hintWord), "hint word is on the board");
  ok(snap.stats.hintsUsed >= 1, "hint counted in stats");
  ok(snap.unlocked.includes("hint"), "hint badge unlocked");

  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  const hintsBefore = T.snap().hintsLeft;
  T.useHint();
  eq(T.snap().hintsLeft, hintsBefore, "zen hints are unlimited");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- H. Timer ----------
{
  T.setMode("classic");
  T.setSize(4);
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  s.remaining = 10000;
  const start = performance.now();
  T.loop(start);
  T.loop(start + 1000);
  T.loop(start + 2000);
  ok(s.remaining < 10000, "timer counts down");
  ok(s.remaining > 0, "timer still running");
  const beforePause = s.remaining;
  T.setPaused(true, true);
  T.loop(start + 5000);
  eq(s.remaining, beforePause, "pause freezes the timer");
  T.setPaused(false, true);
  T.loop(start + 6000);
  ok(s.remaining < beforePause, "resume restarts the timer");

  s.remaining = 50;
  T.loop(start + 7000);
  T.loop(start + 7100);
  const lost = T.snap();
  eq(lost.over, true, "time running out ends the round");
  eq(lost.overlayTitle, "Time's up! ⏰", "time-up overlay shown");
  eq(lost.finished, true, "round marked finished");
  ok(lost.overlayMsg.includes("Score"), "overlay reports the score");

  // Zen has no clock.
  T.setMode("zen");
  T.newPuzzle();
  setPlayable();
  eq(T.snap().remaining, 0, "zen has no countdown");
  const zenBefore = T.state.elapsed;
  const zt = performance.now();
  T.loop(zt);
  T.loop(zt + 1000);
  eq(T.state.elapsed > zenBefore, true, "zen tracks elapsed time internally");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- I. Modes and sizes ----------
{
  T.setSize(4);
  T.setMode("classic");
  T.newPuzzle();
  eq(T.snap().remaining, 180000, "classic 4x4 is 3:00");

  T.setSize(5);
  T.newPuzzle();
  eq(T.snap().remaining, 240000, "classic 5x5 is 4:00");

  T.setMode("sprint");
  T.newPuzzle();
  eq(T.snap().remaining, 150000, "sprint 5x5 is 2:30");

  T.setSize(4);
  T.newPuzzle();
  eq(T.snap().remaining, 90000, "sprint 4x4 is 1:30");
  eq(elements.get("finish").hidden, true, "finish hidden in timed modes");

  T.setMode("zen");
  T.newPuzzle();
  eq(elements.get("finish").hidden, false, "finish visible in zen");
  eq(T.snap().hintsLeft, Infinity, "zen hints are infinite");

  T.setMode("daily");
  T.newPuzzle();
  const a = T.snap();
  T.newPuzzle();
  const b = T.snap();
  deepEq(a.faces, b.faces, "daily faces are deterministic");
  deepEq(a.possible, b.possible, "daily words are deterministic");
  eq(elements.get("new-game").disabled, true, "new board disabled in daily");
  eq(a.mode, "daily", "daily mode active");

  T.setMode("classic");
  T.setSize(4);
  T.newPuzzle();
  setPlayable();
}

// ---------- J. End round / best / stats ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  s.score = 42;
  s.found.set(s.possible[0], 1);
  if (s.possible[1]) s.found.set(s.possible[1], 1);
  s.longest = 5;
  s.longestWord = "HOUSE";
  T.endRound("manual");
  let snap = T.snap();
  eq(snap.over, true, "manual finish ends the round");
  eq(snap.overlayTitle, "Round Complete", "manual overlay shown");
  eq(snap.stats.rounds >= 1, true, "round counted");
  eq(snap.stats.bestScore >= 42, true, "best score recorded");
  eq(snap.stats.bestWord, "HOUSE", "best word recorded");
  ok(snap.stats.noHintRounds >= 1, "no-hint round counted");
  ok(snap.stats.classicWins >= 1, "classic win counted");
  ok(snap.unlocked.includes("classic"), "classic badge unlocked");
  ok(snap.unlocked.includes("noHint"), "no-hint badge unlocked");
  ok(storage.has("boggle-best-v1-classic-4"), "best score persisted");
  ok(storage.has("boggle-stats-v1"), "stats persisted");

  // Perfect round.
  T.newPuzzle();
  setPlayable();
  const s2 = T.state;
  s2.found = new Map();
  let total = 0;
  for (const w of s2.possible) {
    const p = T.wordPoints(w.length);
    s2.found.set(w, p);
    total += p;
  }
  s2.score = total;
  s2.longest = Math.max(...s2.possible.map((w) => w.length));
  s2.longestWord = s2.possible.slice().sort((a, b) => b.length - a.length)[0] || "";
  T.endRound("clear");
  snap = T.snap();
  eq(snap.overlayTitle, "Board Cleared! ✨", "perfect overlay shown");
  ok(snap.stats.perfect >= 1, "perfect round counted");
  ok(snap.unlocked.includes("perfect"), "perfect badge unlocked");
  eq(snap.finished, true, "perfect round finished");
  ok(document.getElementById("missed-wrap").hidden, "no missed words shown for a perfect round");

  // 5x5 end round.
  T.setMode("classic");
  T.setSize(5);
  T.newPuzzle();
  setPlayable();
  const s3 = T.state;
  s3.found.set(s3.possible[0], 1);
  s3.score = 160;
  T.endRound("manual");
  snap = T.snap();
  ok(snap.stats.bigBoards >= 1, "big board counted");
  ok(snap.stats.fiveBest >= 160, "5x5 best tracked");
  ok(snap.unlocked.includes("bigBoard"), "big board badge unlocked");
  ok(snap.unlocked.includes("bigWin"), "big win badge unlocked");

  T.setSize(4);
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- K. Daily streak ----------
{
  T.daily.lastDate = "";
  T.daily.streak = 0;
  T.daily.history = {};
  T.setMode("daily");
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  s.found.set(s.possible[0], 1);
  s.score = 5;
  T.endRound("time");
  const snap = T.snap();
  eq(snap.daily.streak, 1, "daily streak starts at 1");
  eq(snap.daily.lastDate.length > 0, true, "daily date recorded");
  ok(snap.stats.dailySolves >= 1, "daily solve counted");
  ok(snap.unlocked.includes("daily"), "daily badge unlocked");

  // Same day does not double-count.
  T.newPuzzle();
  setPlayable();
  T.state.found.set(T.state.possible[0], 1);
  T.endRound("time");
  eq(T.snap().daily.streak, 1, "same-day daily does not double-count");
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
}

// ---------- L. Achievements by stat ----------
{
  T.stats.maxRoundWords = 10;
  T.checkAchievements();
  ok(T.unlocked().includes("words10"), "10-word badge unlocked");
  T.stats.maxRoundWords = 25;
  T.checkAchievements();
  ok(T.unlocked().includes("words25"), "25-word badge unlocked");
  T.stats.longest = 6;
  T.checkAchievements();
  ok(T.unlocked().includes("long6"), "6-letter badge unlocked");
  T.stats.longest = 8;
  T.checkAchievements();
  ok(T.unlocked().includes("long8"), "8-letter badge unlocked");
  T.stats.bestScore = 200;
  T.checkAchievements();
  ok(T.unlocked().includes("score200"), "200-point badge unlocked");
  T.stats.words = 100;
  T.checkAchievements();
  ok(T.unlocked().includes("bookworm"), "100-word badge unlocked");
  T.daily.streak = 7;
  T.checkAchievements();
  ok(T.unlocked().includes("daily7"), "7-day streak badge unlocked");
  T.stats.zenMax = 20;
  T.checkAchievements();
  ok(T.unlocked().includes("zen20"), "zen 20 badge unlocked");
}

// ---------- M. Pointer interaction ----------
{
  T.setMode("classic");
  T.newPuzzle();
  setPlayable();
  const s = T.state;
  const word = s.possible.find((w) => w.length >= 3);
  const path = traceWord(s.faces, s.size, word);
  ok(!!path, "pointer test found a word path");

  const cells = elements.get("board").children;
  eq(cells.length, s.size * s.size, "board rendered the right number of cells");

  const first = cells[path[0]];
  const board = elements.get("board");
  board.dispatch("pointerdown", { target: first, button: 0 });
  eq(T.snap().path.length, 1, "pointerdown starts the path");
  eq(T.snap().dragging, true, "pointerdown starts dragging");

  for (let i = 1; i < path.length; i++) {
    elementFromPoint = cells[path[i]];
    (listeners["win:pointermove"] || []).forEach((fn) =>
      fn({ clientX: 10, clientY: 10, preventDefault() {}, target: cells[path[i]] })
    );
  }
  eq(T.snap().path.length, path.length, "pointermove extends the path");
  eq(T.snap().dragging, true, "still dragging before pointerup");

  (listeners["win:pointerup"] || []).forEach((fn) => fn({ button: 0, preventDefault() {} }));
  const snap = T.snap();
  eq(snap.found.length, 1, "pointer drag submits the word");
  eq(snap.found[0][0], word, "pointer drag found the traced word");

  // Tap-to-build: tap two adjacent cells, then the last again to submit.
  T.clearPath();
  const p2 = traceWord(s.faces, s.size, s.possible[1]);
  if (p2) {
    board.dispatch("pointerdown", { target: cells[p2[0]], button: 0 });
    (listeners["win:pointerup"] || []).forEach((fn) => fn({ button: 0, preventDefault() {} }));
    eq(T.snap().tapMode, true, "a tap enters tap mode");
    for (let i = 1; i < p2.length; i++) {
      board.dispatch("pointerdown", { target: cells[p2[i]], button: 0 });
    }
    eq(T.snap().path.length, p2.length, "taps extend the path");
    board.dispatch("pointerdown", { target: cells[p2[p2.length - 1]], button: 0 });
    eq(T.snap().found.length, 2, "tapping the last cell submits");
  }
}

// ---------- N. Storage keys ----------
{
  ok(storage.has("boggle-stats-v1"), "stats key present");
  ok(storage.has("boggle-achv-v1"), "achievement key present");
  ok(storage.has("boggle-daily-v1"), "daily key present");
  const bestKeys = Array.from(storage.keys()).filter((k) => k.startsWith("boggle-best-v1-"));
  ok(bestKeys.length >= 2, "best scores stored per mode and size", bestKeys);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init + generation: ${initMs}ms`);
console.log(`  dictionary: ${global.window.BOGGLE_WORDS.length} words`);
if (fail) process.exit(1);