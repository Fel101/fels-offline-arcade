// Deterministic tests for games/light-trails/script.js
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
      return { left: 0, top: 0, width: 480, height: 480 };
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
  "game", "wins", "streak", "best", "restart",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
elements.get("game").width = 480;
elements.get("game").height = 480;
elements.get("achv-modal").hidden = true;

// The on-screen D-pad buttons.
const padDirs = ["up", "left", "down", "right"];
const padBtns = padDirs.map((d) => {
  const el = makeEl("button", "pad-" + d);
  el.setAttribute("data-dir", d);
  return el;
});

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
  querySelectorAll: (sel) => (sel === "[data-dir]" ? padBtns : []),
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

// Best session win count from the pre-core build.
storage.set("tron-best", "3");

const root = require("./_env").root;
const dir = root + "games/light-trails/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__TRON;
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

// The enemy is boxed into a corner and its only free direction is behind it,
// so it drives into a trail and the round is won.
function winRound() {
  T.reset();
  T.start();
  T.setCells([
    [0, 1, 1],
    [1, 0, 1],
    [1, 2, 1],
  ]);
  T.setPlayer(20, 20, "right");
  T.setEnemy(1, 1, "left");
  return T.step();
}

function loseRound() {
  T.reset();
  T.start();
  T.setCells([]);
  T.setPlayer(39, 10, "right");
  T.setEnemy(30, 30, "left");
  return T.step();
}

// Drive n safe cells in the current round: the arena is cleared and the two
// cycles are re-seated in open space before every tick.
function survive(n) {
  for (let i = 0; i < n; i++) {
    T.setCells([]);
    T.setPlayer(20, 20, "right");
    T.setEnemy(30, 30, "left");
    T.step();
  }
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.bestStreak, 3, "legacy best streak migrated");
  eq(storage.has("tron-best"), false, "legacy key removed");
  eq(T.stats.games, 0, "no rounds yet");
  eq(T.stats.wins, 0, "no wins yet");
  eq(T.stats.losses, 0, "no losses yet");
  eq(T.stats.streak, 0, "no streak yet");
  eq(T.stats.cells, 0, "no cells driven yet");
  eq(T.stats.bestRun, 0, "no long run yet");
  eq(T.state, "ready", "starts on the ready screen");
  eq(T.paused, false, "not paused");
  eq(T.runCells, 0, "run counter reset");
  eq(T.W, 480, "canvas width");
  eq(T.H, 480, "canvas height");
  eq(T.CELL, 12, "cell size");
  eq(T.SIZE, 40, "grid size");
  eq(T.STEP_MS, 95, "tick length");
  const s = T.snap();
  eq(s.player.gx, 3, "player starts in the left lane");
  eq(s.player.gy, 20, "player starts mid-board");
  eq(s.player.dir, "right", "player faces right");
  eq(s.player.dead, false, "player alive");
  eq(s.enemy.gx, 36, "enemy starts in the right lane");
  eq(s.enemy.gy, 20, "enemy starts mid-board");
  eq(s.enemy.dir, "left", "enemy faces left");
  eq(s.playerCells, 1, "player head is on the grid");
  eq(s.enemyCells, 1, "enemy head is on the grid");
  eq(T.cellAt(3, 20), 1, "player head marked");
  eq(T.cellAt(36, 20), 2, "enemy head marked");
  eq(T.cellAt(20, 20), 0, "the rest of the grid is empty");
  eq(elements.get("wins").textContent, 0, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("best").textContent, 3, "best HUD shows the legacy streak");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at the start");
  eq(elements.get("badge-count").textContent, 0, "header badge count");
  eq(T.overlayTitle(), "Light Trails", "start overlay");
  has(T.overlayMsg(), "Steer", "start overlay explains the controls");
}

// ---------- B. Round 1: start, steering, movement, timing ----------
{
  keydown(" ");
  eq(T.state, "playing", "Space starts the round");
  eq(T.overlayTitle(), null, "start overlay closes");
  eq(T.stats.games, 1, "the round is counted");
  eq(elements.get("wins").textContent, 0, "no win yet");
  eq(T.turn("up"), true, "turn up is accepted");
  eq(T.player.dir, "up", "heading up");
  eq(T.turn("down"), false, "cannot reverse into yourself");
  eq(T.turn("up"), false, "cannot repeat the current direction");
  eq(T.turn("left"), true, "turn left is accepted");
  eq(T.turn("right"), false, "cannot reverse again");
  eq(T.player.dir, "left", "heading left");
  eq(T.turn("sideways"), false, "unknown directions are ignored");

  T.setCells([]);
  T.setPlayer(10, 10, "right");
  T.setEnemy(30, 30, "left");
  eq(T.step(), true, "a step ticks the duel");
  let s = T.snap();
  eq(s.player.gx, 11, "player advances one cell");
  eq(s.player.gy, 10, "player keeps its row");
  eq(T.cellAt(11, 10), 1, "player trail is marked");
  eq(s.enemy.gy, 29, "enemy AI picks the first open direction");
  eq(T.cellAt(30, 29), 2, "enemy trail is marked");
  eq(s.runCells, 1, "run counter");
  eq(T.stats.cells, 1, "career cells");
  eq(T.stats.bestRun, 1, "best run");
  eq(T.unlocked().length, 2, "the legacy streak unlocks two badges");
  ok(T.unlocked().includes("streak2"), "streak2 unlocks from the legacy streak");
  ok(T.unlocked().includes("streak3"), "streak3 unlocks from the legacy streak");
  eq(elements.get("badge-count").textContent, 2, "header badge count");

  T.update(94);
  eq(T.snap().player.gx, 11, "a partial tick does not move the cycle");
  T.update(1);
  eq(T.snap().player.gx, 12, "the leftover millisecond completes the tick");
  eq(T.snap().acc, 0, "accumulator cleared");
  eq(T.snap().runCells, 2, "second cell");

  T.update(190);
  s = T.snap();
  eq(s.player.gx, 14, "two ticks in one frame");
  eq(s.enemy.gy, 26, "enemy kept climbing");
  eq(s.runCells, 4, "four cells this round");
  eq(T.stats.cells, 4, "career cells follow");
  eq(T.stats.bestRun, 4, "best run follows");
  eq(elements.get("wins").textContent, 0, "wins HUD unchanged");
  eq(elements.get("streak").textContent, 0, "streak HUD unchanged");
  eq(elements.get("best").textContent, 3, "best HUD unchanged");

  T.setCells([]);
  T.setPlayer(39, 12, "right");
  T.step();
  eq(T.state, "over", "driving into the wall ends the round");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "streak stays at zero");
  eq(T.stats.wins, 0, "still no wins");
  eq(T.runCells, 4, "run cells frozen at the crash");
  eq(T.overlayTitle(), "Crashed! 🚨", "crash overlay");
  has(T.overlayMsg(), "after 4 cells", "crash overlay reports the distance");
  has(T.overlayMsg(), "Best streak 3", "crash overlay keeps the best streak");
  eq(elements.get("wins").textContent, 0, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  ok(storage.has("tron-stats-v1"), "stats persisted under the core key");
}

// ---------- C. Round 2: pause ----------
{
  T.reset();
  eq(T.state, "ready", "reset parks the duel");
  eq(T.runCells, 0, "run counter cleared");
  eq(T.overlayTitle(), null, "reset closes the overlay");
  eq(T.start(), true, "start begins a round");
  eq(T.stats.games, 2, "second round counted");
  eq(T.start(), false, "cannot start while playing");

  T.setCells([]);
  T.setPlayer(10, 20, "right");
  T.setEnemy(30, 30, "left");
  T.step();
  eq(T.stats.cells, 5, "one more cell");

  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  eq(T.step(), false, "a step is ignored while paused");
  eq(T.snap().player.gx, 11, "the cycle is frozen");
  eq(T.turn("up"), false, "steering is blocked while paused");
  eq(T.player.dir, "right", "direction unchanged");
  T.update(300);
  eq(T.snap().player.gx, 11, "time does not tick while paused");
  keydown(" ");
  eq(T.paused, true, "Space does not resume");
  eq(T.stats.games, 2, "and does not start a round");
  keydown("p");
  eq(T.paused, false, "P resumes");
  eq(T.overlayTitle(), null, "pause overlay closed");
  T.step();
  eq(T.snap().player.gx, 12, "movement resumes");
  eq(T.stats.cells, 6, "cell counted after the pause");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");

  visibility(true);
  eq(T.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(T.paused, false, "resumed again");

  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open mid-round");
  eq(T.paused, true, "opening the badges pauses the duel");
  eq(elements.get("achv-count").textContent, "2 / 14", "modal count");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
  eq(T.paused, true, "still paused behind the modal");
  eq(T.overlayTitle(), "Paused", "pause overlay is still there");
  keydown("p");
  eq(T.paused, false, "resume after the modal");

  T.setCells([]);
  T.setPlayer(0, 0, "up");
  T.step();
  eq(T.state, "over", "driving off the top ends the round");
  eq(T.stats.losses, 2, "second loss");
  T.setPaused(true);
  eq(T.paused, false, "a finished round cannot pause");
  eq(T.overlayTitle(), "Crashed! 🚨", "crash overlay survives");
}

// ---------- D. Round 3: a win ----------
{
  winRound();
  eq(T.state, "over", "the enemy crashing wins the round");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.losses, 2, "losses unchanged");
  eq(T.stats.streak, 1, "streak starts");
  eq(T.stats.bestStreak, 3, "the legacy best streak is still higher");
  eq(T.stats.cells, 7, "one more cell");
  eq(T.overlayTitle(), "You outlasted it! 🎉", "win overlay");
  has(T.overlayMsg(), "Streak 1", "win overlay reports the streak");
  has(T.overlayMsg(), "Round 3 won", "win overlay reports the round");
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  eq(T.unlocked().length, 3, "three badges");
  eq(elements.get("wins").textContent, 1, "wins HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(elements.get("best").textContent, 3, "best HUD");
}

// ---------- E. Round 4: your own trail ----------
{
  T.reset();
  T.start();
  eq(T.stats.games, 4, "fourth round");
  T.setCells([[11, 10, 1]]);
  T.setPlayer(10, 10, "right");
  T.step();
  eq(T.state, "over", "hitting a trail ends the round");
  eq(T.stats.losses, 3, "third loss");
  eq(T.stats.streak, 0, "streak broken");
  eq(T.stats.wins, 1, "wins unchanged");
  eq(T.stats.cells, 7, "no cell gained on the crash");
  eq(elements.get("streak").textContent, 0, "streak HUD reset");

  // Win again so the win grind below starts from a known place.
  winRound();
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.streak, 1, "streak restarts");
  eq(T.stats.games, 5, "fifth round");
}

// ---------- F. Win grind reaches the streak and win badges ----------
{
  for (let i = 0; i < 5; i++) winRound();
  eq(T.stats.games, 10, "ten rounds");
  eq(T.stats.wins, 7, "seven wins");
  eq(T.stats.losses, 3, "three losses");
  eq(T.stats.streak, 6, "six wins in a row");
  eq(T.stats.bestStreak, 6, "new best streak");
  eq(T.stats.cells, 13, "one cell per win");
  eq(elements.get("wins").textContent, 7, "wins HUD");
  eq(elements.get("streak").textContent, 6, "streak HUD");
  eq(elements.get("best").textContent, 6, "best HUD");
  has(T.overlayMsg(), "New best streak", "the last win set a record");
  ok(T.unlocked().includes("win5"), "Circuit Rider badge unlocks");
  ok(T.unlocked().includes("streak5"), "Unbroken badge unlocks");
  ok(T.unlocked().includes("games10"), "Ten Rounds badge unlocks");
  eq(T.unlocked().length, 6, "six badges");
}

// ---------- G. Long runs and the distance badges ----------
{
  T.reset();
  T.start();
  eq(T.stats.games, 11, "eleventh round");
  survive(100);
  eq(T.runCells, 100, "one hundred cells in one run");
  eq(T.stats.bestRun, 100, "best run recorded");
  eq(T.stats.cells, 113, "career cells");
  ok(T.unlocked().includes("bestRun100"), "Marathon badge unlocks");
  eq(T.unlocked().length, 7, "seven badges");
  T.setPlayer(39, 10, "right");
  T.step();
  eq(T.state, "over", "the round ends on the next crash");
  eq(T.stats.losses, 4, "fourth loss");
  eq(T.stats.streak, 0, "the long run ends the streak");

  T.reset();
  T.start();
  survive(137);
  eq(T.stats.cells, 250, "two hundred and fifty cells");
  ok(T.unlocked().includes("cells250"), "Traveller badge unlocks");
  eq(T.unlocked().length, 8, "eight badges");
  T.setPlayer(39, 10, "right");
  T.step();
  eq(T.stats.losses, 5, "fifth loss");

  T.reset();
  T.start();
  survive(750);
  eq(T.stats.cells, 1000, "one thousand cells");
  ok(T.unlocked().includes("cells1000"), "Long Haul badge unlocks");
  eq(T.unlocked().length, 9, "nine badges");
  eq(T.stats.bestRun, 750, "longest run");
  T.setPlayer(39, 10, "right");
  T.step();
  eq(T.stats.losses, 6, "sixth loss");
}

// ---------- H. Crash grind ----------
{
  eq(T.stats.losses, 6, "losses before the grind");
  for (let i = 0; i < 4; i++) loseRound();
  eq(T.stats.losses, 10, "ten crashes");
  ok(T.unlocked().includes("loss10"), "Ten Crashes badge unlocks");
  eq(T.stats.games, 17, "rounds after the first crash batch");

  for (let i = 0; i < 15; i++) loseRound();
  eq(T.stats.losses, 25, "twenty-five crashes");
  ok(T.unlocked().includes("loss25"), "Scrap Heap badge unlocks");
  ok(T.unlocked().includes("games25"), "Grid Regular badge unlocks");
  eq(T.stats.games, 32, "rounds after the crash grind");
  eq(T.unlocked().length, 12, "twelve badges");
  eq(T.stats.cells, 1000, "crashes add no distance");
}

// ---------- I. Win grind ----------
{
  for (let i = 0; i < 18; i++) winRound();
  eq(T.stats.wins, 25, "twenty-five wins");
  eq(T.stats.games, 50, "fifty rounds");
  eq(T.stats.streak, 18, "eighteen wins in a row");
  eq(T.stats.bestStreak, 18, "best streak");
  eq(T.stats.cells, 1018, "career cells");
  ok(T.unlocked().includes("win10"), "Grid Master badge unlocks");
  ok(T.unlocked().includes("win25"), "Program Elite badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- J. Restart, keyboard restart, D-pad ----------
{
  T.reset();
  T.start();
  eq(T.stats.games, 51, "the restart test round is counted");
  document.getElementById("restart").dispatch("click");
  eq(T.state, "ready", "Restart parks the duel");
  eq(T.overlayTitle(), "Light Trails", "Restart shows the start overlay");
  eq(T.stats.games, 51, "Restart does not count another round");
  eq(T.snap().playerCells, 1, "the arena is cleared");
  eq(T.snap().enemyCells, 1, "only the two heads remain");
  eq(T.snap().player.gx, 3, "player back on the start lane");

  keydown(" ");
  eq(T.state, "playing", "Space starts from the ready screen");
  eq(T.stats.games, 52, "another round counted");
  keydown("ArrowUp");
  eq(T.player.dir, "up", "arrow keys steer");
  keydown("a");
  eq(T.player.dir, "left", "WASD steers");

  padBtns[2].dispatch("click"); // down
  eq(T.player.dir, "down", "the on-screen pad steers");
  padBtns[0].dispatch("click"); // up is the opposite of down
  eq(T.player.dir, "down", "the pad respects the no-reverse rule");
  padBtns[1].dispatch("click"); // left
  eq(T.player.dir, "left", "the pad turns left");

  // Swipes steer too.
  const canvas = elements.get("game");
  canvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
  canvas.dispatch("pointerup", { clientX: 102, clientY: 160 });
  eq(T.player.dir, "down", "a downward swipe turns down");
  canvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
  canvas.dispatch("pointerup", { clientX: 160, clientY: 102 });
  eq(T.player.dir, "right", "a rightward swipe turns right");
  canvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
  canvas.dispatch("pointerup", { clientX: 104, clientY: 106 });
  eq(T.player.dir, "right", "a tiny movement is not a swipe");

  keydown("Escape");
  eq(T.paused, true, "Escape pauses");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");

  T.endGame(false);
  keydown(" ");
  eq(T.state, "playing", "Space starts a fresh round after a crash");
  eq(T.stats.games, 53, "and counts it");
}

// ---------- K. Helpers: flood fill and blocked() ----------
{
  T.reset();
  T.setCells([]);
  eq(T.openArea(0, 0), 1600, "an empty arena is one big open area");
  eq(T.openArea(-1, 0), 0, "out of bounds has no area");
  eq(T.openArea(0, 0), 1600, "openArea can be called again");

  const wall = [];
  for (let x = 0; x < 40; x++) wall.push([x, 0, 1]);
  T.setCells(wall);
  eq(T.openArea(0, 1), 1560, "a full wall cuts off one row");
  eq(T.openArea(0, 0), 0, "an occupied cell has no area");
  eq(T.blocked(0, 1, "up"), true, "blocked by a trail");
  eq(T.blocked(0, 1, "left"), true, "blocked by the wall");
  eq(T.blocked(0, 1, "right"), false, "open to the right");
  eq(T.blocked(0, 1, "down"), false, "open below");
}

// ---------- L. Rendering + sound ----------
{
  let threw = null;
  try {
    T.draw();
    T.reset();
    T.draw();
  } catch (e) {
    threw = e;
  }
  eq(threw, null, "drawing does not throw");
  eq(elements.get("game").getContext("2d"), ctx, "canvas context is used");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("tron-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("tron-sound"), "on", "preference restored");
}

// ---------- M. Badges modal + final tally ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14 unlocked");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Rounds <b>53</b>", "rounds record");
  has(records, "Wins <b>25</b>", "wins record");
  has(records, "Losses <b>26</b>", "losses record");
  has(records, "Best streak <b>18</b>", "best streak record");
  has(records, "Cells <b>1018</b>", "cells record");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win5", "win10", "win25", "streak2", "streak3", "streak5",
    "games10", "games25", "cells250", "cells1000", "bestRun100", "loss10", "loss25",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.games, 53, "rounds");
  eq(T.stats.wins, 25, "wins");
  eq(T.stats.losses, 26, "losses");
  eq(T.stats.bestStreak, 18, "best streak");
  eq(T.stats.cells, 1018, "cells");
  eq(T.stats.bestRun, 750, "best run");
  eq(elements.get("wins").textContent, 25, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("best").textContent, 18, "best HUD");
  ok(storage.has("tron-stats-v1"), "stats persisted");
  ok(storage.has("tron-achv-v1"), "badges persisted");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
