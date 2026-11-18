// Deterministic tests for games/ruzzle/script.js
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
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { (this._listeners[t] || (this._listeners[t] = [])).push(fn); },
    removeEventListener() {},
    dispatch(t, ev = {}) {
      const e = Object.assign({ target: this, button: 0, preventDefault() {}, stopPropagation() {} }, ev);
      (this._listeners[t] || []).forEach((fn) => fn(e));
    },
    focus() {},
    closest() { return null; },
    querySelector() { return makeEl("span"); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 360 }; },
    setPointerCapture() {},
  };
  let _className = "";
  Object.defineProperty(el, "className", {
    get() { return _className; },
    set(v) {
      _className = String(v);
      el.classList = makeClassList();
      _className.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
    },
  });
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get() { return _html; },
    set(v) { _html = v; if (v === "") el.children = []; },
  });
  return el;
}

const ids = [
  "board", "found", "current-word", "time", "score", "words", "time-bar", "submit", "clear",
  "restart", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
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
  querySelector: (sel) => (sel === ".overlay .btn" ? makeEl("button") : makeEl("div")),
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); },
  removeEventListener() {},
  elementFromPoint: () => null,
};

let timerSeq = 0;
global.window = {
  innerWidth: 800,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => { (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn); },
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

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/ruzzle/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__RUZZLE;
if (!T) { console.error("No test hook"); process.exit(1); }

let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}
function eq(a, b, msg) { ok(a === b, msg, { actual: a, expected: b }); }

function keydown(key, extra) {
  (listeners["keydown"] || []).forEach((fn) =>
    fn(Object.assign({ key, target: { tagName: "BODY" }, preventDefault() {} }, extra || {}))
  );
}
function winEvent(t) { (listeners["win:" + t] || []).forEach((fn) => fn({})); }

T.overlay.hide();

// Find a word of at least `minLen` letters on the current board.
function findWords(minLen, maxLen) {
  const cells = T.cells;
  const dict = T.DICT;
  const out = [];
  const limit = maxLen || 8;
  function dfs(idx, str, visited) {
    const ch = cells[idx].wordChar;
    const ns = str + ch;
    if (visited.length >= minLen && dict.has(ns)) {
      out.push({ word: ns, path: visited.slice() });
      if (out.length > 40) return;
    }
    if (visited.length >= limit) return;
    const r = Math.floor(idx / 4), c = idx % 4;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 3 || nc < 0 || nc > 3) continue;
        const ni = nr * 4 + nc;
        if (visited.indexOf(ni) >= 0) continue;
        visited.push(ni);
        dfs(ni, ns, visited);
        visited.pop();
        if (out.length > 40) return;
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    dfs(i, "", [i]);
    if (out.length > 40) break;
  }
  return out;
}

function findNonWord() {
  const cells = T.cells;
  for (let i = 0; i < 16; i++) {
    if (cells[i].wordChar.length !== 1) continue;
    const r0 = Math.floor(i / 4), c0 = i % 4;
    for (let j = 0; j < 16; j++) {
      if (j === i || cells[j].wordChar.length !== 1) continue;
      const r1 = Math.floor(j / 4), c1 = j % 4;
      if (Math.abs(r0 - r1) > 1 || Math.abs(c0 - c1) > 1) continue;
      for (let k = 0; k < 16; k++) {
        if (k === i || k === j || cells[k].wordChar.length !== 1) continue;
        const r2 = Math.floor(k / 4), c2 = k % 4;
        if (Math.abs(r1 - r2) > 1 || Math.abs(c1 - c2) > 1) continue;
        const s = cells[i].wordChar + cells[j].wordChar + cells[k].wordChar;
        if (!T.DICT.has(s)) return { word: s, path: [i, j, k] };
      }
    }
  }
  return null;
}

// Pick a seed whose board contains a word, then install that board.
let chosen = null;
for (let s = 1; s <= 60 && !chosen; s++) {
  T.setSeed(s * 7919);
  T.generateBoard();
  const res = findWords(3);
  if (res.length) chosen = { seed: s * 7919, res };
}

// ---------- A. Init ----------
{
  eq(T.SIZE, 4, "board is 4x4");
  eq(T.CELLS, 16, "16 cells");
  eq(T.ROUND_MS, 90000, "90 second rounds");
  eq(T.MIN_WORD, 3, "3 letter minimum");
  ok(T.DICT.size > 5000, "dictionary is loaded");
  ok(T.DICT.has("cat") && T.DICT.has("dog") && T.DICT.has("word"), "common words are present");
  eq(T.stats.games, 0, "no games counted yet");
  eq(storage.has("ruzzle-stats-v1"), true, "stats persisted under the core key");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.state, "ready", "starts ready");
  eq(T.cells.length, 16, "16 cells generated");
}

// ---------- B. Adjacency and scoring ----------
{
  eq(T.adjacent(0, 1), true, "horizontal neighbours are adjacent");
  eq(T.adjacent(0, 5), true, "diagonal neighbours are adjacent");
  eq(T.adjacent(0, 15), false, "far cells are not adjacent");
  eq(T.adjacent(3, 4), false, "row wrap is not adjacent");
  eq(T.adjacent(0, 0), false, "a cell is not adjacent to itself");
  eq(T.scoreWord(3), 1, "3 letters score 1");
  eq(T.scoreWord(4), 2, "4 letters score 2");
  eq(T.scoreWord(5), 3, "5 letters score 3");
  eq(T.scoreWord(6), 4, "6 letters score 4");
  eq(T.scoreWord(7), 5, "7 letters score 5");
  eq(T.scoreWord(8), 6, "8 letters score 6");
}

// ---------- C. Start a round ----------
{
  T.startRound();
  eq(T.state, "playing", "start begins the round");
  eq(T.stats.games, 1, "round counted at start");
  eq(T.timeLeft, T.ROUND_MS, "timer reset");
  eq(T.score, 0, "score reset");
  eq(T.found.length, 0, "no words yet");
}

// ---------- D. Valid word ----------
{
  ok(chosen, "found a board with a word");
  T.setSeed(chosen.seed);
  T.generateBoard();
  const w = chosen.res[0];
  for (const idx of w.path) T.tapCell(idx);
  eq(T.word, w.word, "tapping the path spells the word");
  const score0 = T.score;
  T.submit();
  ok(T.found.some((f) => f.word === w.word), "the word was accepted");
  ok(T.score > score0, "score increased");
  eq(T.path.length, 0, "path cleared after submit");

  // Submitting it again is rejected.
  for (const idx of w.path) T.tapCell(idx);
  const foundCount = T.found.length;
  T.submit();
  eq(T.found.length, foundCount, "a repeated word is rejected");
}

// ---------- E. Too short ----------
{
  T.startRound();
  T.setSeed(chosen.seed);
  T.generateBoard();
  T.tapCell(0);
  const score0 = T.score;
  const found0 = T.found.length;
  T.submit();
  eq(T.found.length, found0, "a short attempt scores nothing");
  eq(T.score, score0, "score unchanged for a short attempt");
  eq(T.path.length, 0, "path cleared after a short attempt");
}

// ---------- F. Not in the dictionary ----------
{
  T.startRound();
  T.setSeed(chosen.seed);
  T.generateBoard();
  const nw = findNonWord();
  ok(nw, "found a non-word path");
  for (const idx of nw.path) T.tapCell(idx);
  const found0 = T.found.length;
  T.submit();
  eq(T.found.length, found0, "a non-word is rejected");
}

// ---------- G. Timer and end of round ----------
{
  T.startRound();
  T.setTime(10);
  T.step(20);
  eq(T.state, "over", "the round ends when time runs out");
  ok(T.overlayTitle().indexOf("Time!") === 0, "time-up overlay shown");
}

// ---------- H. Badge thresholds ----------
{
  T.stats.games = 25;
  T.stats.bestScore = 500;
  T.stats.totalWords = 200;
  T.stats.bestWordLen = 7;
  T.stats.bingos = 5;
  T.stats.sevenLetter = 25;
  T.stats.bestRoundWords = 12;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "games25", "score100", "score250", "score500", "words50", "words200", "long5", "long7", "bingo1", "bingo5", "seven25", "prolific"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- I. Pause ----------
{
  T.startRound();
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const t = T.timeLeft;
  T.step(5000);
  eq(T.timeLeft, t, "timer frozen while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");
  eq(T.overlayTitle(), null, "pause overlay hidden");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
}

// ---------- J. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("ruzzle-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
}

// ---------- K. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows 14 of 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  eq(elements.get("badge-count").textContent, 14, "header badge count in sync");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- L. Clear and restart ----------
{
  T.startRound();
  T.tapCell(0);
  T.tapCell(1);
  ok(T.path.length >= 1, "a path was built");
  elements.get("clear").dispatch("click");
  eq(T.path.length, 0, "Clear empties the path");
  elements.get("restart").dispatch("click");
  eq(T.state, "playing", "New Round starts a fresh round");
  eq(T.score, 0, "score reset");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);