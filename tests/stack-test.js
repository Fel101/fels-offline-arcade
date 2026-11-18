// Deterministic tests for games/stack/script.js
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
      return ctx;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 400, height: 520 };
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

const gradient = { addColorStop() {} };
const ctx = new Proxy(
  {
    createLinearGradient: () => gradient,
    measureText: () => ({ width: 10 }),
  },
  {
    get(t, p) {
      return p in t ? t[p] : () => {};
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }
);

const ids = [
  "game", "score", "best", "games", "restart",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
elements.get("game").width = 400;
elements.get("game").height = 520;
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
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Legacy best score from the pre-core build.
storage.set("stack-best", "8");

const root = require("./_env").root;
const dir = root + "games/stack/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__STACK;
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

function perfectDrop() {
  T.setMoving(180, 100, 1, 2.4);
  T.drop();
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.best, 8, "legacy best migrated");
  eq(storage.has("stack-best"), false, "legacy key removed");
  eq(T.stats.games, 0, "no towers yet");
  eq(T.stats.blocks, 0, "no blocks yet");
  eq(T.stats.perfects, 0, "no perfects yet");
  eq(T.stats.slices, 0, "no slices yet");
  eq(T.score, 0, "score starts at 0");
  eq(T.gameOver, false, "game is live");
  eq(T.paused, false, "not paused");
  const s = T.snap();
  eq(s.blocks.length, 0, "empty tower");
  eq(s.moving.w, 180, "first block is 180 wide");
  eq(s.moving.x, 220, "first block slides in from the right with a pinned RNG");
  eq(s.moving.dir, -1, "moving left");
  eq(s.moving.speed, 2.4, "base speed");
  eq(elements.get("score").textContent, 0, "score HUD");
  eq(elements.get("best").textContent, 8, "best HUD shows the legacy score");
  eq(elements.get("games").textContent, 0, "towers HUD");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
}

// ---------- B. First drop ----------
{
  T.setMoving(180, 100, 1, 2.4);
  keydown(" ");
  eq(T.score, 1, "the first block scores");
  eq(T.stats.blocks, 1, "block counted");
  eq(T.stats.games, 1, "tower counted");
  eq(elements.get("score").textContent, 1, "score HUD");
  eq(elements.get("games").textContent, 1, "towers HUD");
  const s = T.snap();
  eq(s.blocks.length, 1, "one block in the tower");
  eq(s.blocks[0].x, 180, "first block placed where dropped");
  eq(s.blocks[0].w, 100, "first block keeps its width");
  eq(s.moving.w, 100, "the next block matches the width");
  ok(T.unlocked().includes("first"), "First Drop badge unlocks");
  eq(T.unlocked().length, 1, "one badge unlocked");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
}

// ---------- C. Perfect drop ----------
{
  perfectDrop();
  eq(T.score, 3, "a perfect drop scores 2");
  eq(T.stats.blocks, 2, "block counted");
  eq(T.stats.perfects, 1, "perfect counted");
  eq(T.stats.best, 8, "the legacy best is still higher");
  const s = T.snap();
  eq(s.blocks.length, 2, "two blocks");
  eq(s.floaters, 1, "PERFECT floater spawned");
  eq(s.camEase, -48, "camera eases down after the second drop");
  ok(T.unlocked().includes("perfect1"), "Perfect Drop badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
}

// ---------- D. Sliced drop ----------
{
  T.setMoving(200, 100, 1, 2.4);
  T.drop();
  const s = T.snap();
  eq(T.score, 4, "a sliced drop scores 1");
  eq(s.blocks.length, 3, "three blocks");
  eq(s.blocks[2].x, 200, "the overlap starts at 200");
  eq(s.blocks[2].w, 80, "only the overlap survives");
  eq(T.stats.slices, 1, "one overhang cut");
  eq(s.slices.length, 1, "one slice falling");
  eq(s.slices[0].w, 20, "the slice is the right-hand overhang");
  eq(s.moving.w, 80, "the next block matches the trimmed width");
}

// ---------- E. Update physics ----------
{
  T.setMoving(320, 80, -1, 2.4);
  T.step();
  eq(T.snap().moving.x, 317.6, "the block slides by its speed");

  T.setMoving(399, 80, 1, 5);
  T.step();
  const right = T.snap().moving;
  eq(right.x, 320, "the block stops at the right wall");
  eq(right.dir, -1, "and turns around");

  T.setMoving(2, 80, -1, 5);
  T.step();
  const left = T.snap().moving;
  eq(left.x, 0, "the block stops at the left wall");
  eq(left.dir, 1, "and turns around");
}

// ---------- F. A miss ends the tower ----------
{
  T.setMoving(350, 80);
  T.drop();
  eq(T.gameOver, true, "missing the tower ends the run");
  eq(T.overlayTitle(), "Game Over", "no record yet");
  ok((T.overlayMsg() || "").indexOf("Score: 4.") !== -1, "score in the overlay", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best: 8.") !== -1, "best in the overlay", T.overlayMsg());
  eq(T.stats.games, 1, "the run was already counted");

  keydown(" ");
  eq(T.gameOver, false, "Space starts a new tower");
  eq(T.score, 0, "score resets");
  eq(elements.get("score").textContent, 0, "score HUD resets");
  eq(T.overlayTitle(), null, "overlay closed");
  eq(T.stats.games, 1, "a fresh tower is not counted until the first drop");
}

// ---------- G. A record run ----------
{
  T.setMoving(180, 100);
  T.drop();
  eq(T.stats.games, 2, "second tower counted");
  for (let i = 0; i < 4; i++) perfectDrop();
  eq(T.score, 9, "one block plus four perfects");
  eq(T.stats.perfects, 5, "five perfect drops");
  T.setMoving(350, 80);
  T.drop();
  eq(T.gameOver, true, "the run ends");
  eq(T.stats.best, 9, "new personal best");
  eq(T.overlayTitle(), "New Best! 🎉", "record overlay");
  ok((T.overlayMsg() || "").indexOf("Tower 2.") !== -1, "tower number in the overlay", T.overlayMsg());
}

// ---------- H. Perfect grind ----------
{
  T.reset();
  T.setMoving(180, 100);
  T.drop();
  for (let i = 0; i < 45; i++) perfectDrop();
  eq(T.stats.perfects, 50, "fifty perfect drops");
  eq(T.score, 91, "ninety-one points");
  eq(T.stats.best, 91, "best score");
  ["best10", "best25", "best50", "perfect10", "perfect50"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
}

// ---------- I. Block grind ----------
{
  for (let i = 0; i < 196; i++) perfectDrop();
  eq(T.stats.blocks, 250, "two hundred and fifty blocks");
  eq(T.score, 483, "four hundred and eighty-three points");
  eq(T.stats.best, 483, "best score");
  ok(T.unlocked().includes("blocks50"), "Bricklayer badge unlocks");
  ok(T.unlocked().includes("blocks250"), "Skyscraper badge unlocks");
  ok(T.unlocked().includes("best100"), "Stratosphere badge unlocks");
}

// ---------- J. Slice grind ----------
{
  for (let i = 0; i < 99; i++) {
    T.setBlocks([{ x: 100, w: 100 }]);
    T.setMoving(150, 100, 1, 2.4);
    T.drop();
  }
  eq(T.stats.slices, 100, "one hundred overhangs cut");
  eq(T.score, 582, "five hundred and eighty-two points");
  ok(T.unlocked().includes("slice25"), "Trimmer badge unlocks");
  ok(T.unlocked().includes("slice100"), "Sculptor badge unlocks");
}

// ---------- K. Tower grind ----------
{
  for (let i = 0; i < 22; i++) {
    T.reset();
    T.setMoving(180, 100);
    T.drop();
    T.endGame();
  }
  eq(T.stats.games, 25, "twenty-five towers");
  ok(T.unlocked().includes("games10"), "Regular badge unlocks");
  ok(T.unlocked().includes("games25"), "Devoted badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- L. Pause ----------
{
  T.reset();
  const x = T.snap().moving.x;
  T.togglePause();
  eq(T.paused, true, "pause on");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  T.step();
  eq(T.snap().moving.x, x, "the block is frozen while paused");
  T.setMoving(180, 100);
  T.drop();
  eq(T.score, 0, "dropping is blocked while paused");
  eq(T.snap().blocks.length, 0, "no block placed while paused");
  keydown(" ");
  eq(T.score, 0, "Space is blocked while paused");
  T.togglePause();
  eq(T.paused, false, "pause off");
  eq(T.overlayTitle(), null, "pause overlay hidden");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");

  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  T.endGame();
  T.setPaused(true);
  eq(T.paused, false, "a finished tower cannot pause");
  eq(T.overlayTitle(), "Game Over", "the game-over overlay survives");
}

// ---------- M. Rendering ----------
{
  let threw = null;
  try {
    T.draw();
  } catch (e) {
    threw = e;
  }
  eq(threw, null, "drawing does not throw");
  const p = elements.get("game");
  eq(p.getContext("2d"), ctx, "canvas context is used");
}

// ---------- N. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("stack-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("stack-sound"), "on", "preference restored");
}

// ---------- O. Badges modal ----------
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

// ---------- P. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "blocks50", "blocks250", "best10", "best25", "best50", "best100",
    "perfect1", "perfect10", "perfect50", "games10", "games25", "slice25", "slice100",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.games, 25, "towers");
  eq(T.stats.blocks, 371, "blocks placed");
  eq(T.stats.perfects, 246, "perfect drops");
  eq(T.stats.slices, 100, "overhangs cut");
  eq(T.stats.best, 582, "best score");
  eq(elements.get("best").textContent, 582, "best HUD");
  eq(elements.get("games").textContent, 25, "towers HUD");
  ok(storage.has("stack-stats-v1"), "stats persisted under the core key");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
