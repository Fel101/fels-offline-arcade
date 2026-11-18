// Deterministic tests for games/flappy/script.js
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
  "mode-label", "extra-stat", "extra-label", "extra-value",
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

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Legacy best score from the pre-core build.
storage.set("flappy-best", "7");

const root = require("./_env").root;
const dir = root + "games/flappy/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__FLAPPY;
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

// One pipe pass at the bird's altitude, fully deterministic.
function passPipe() {
  T.setPipes([{ x: 10, gapTop: 165 }]);
  T.setBird(240, 0);
  T.step();
}

// ---------- A. Init + legacy migration ----------
{
  eq(T.stats.best, 7, "legacy best migrated");
  eq(storage.has("flappy-best"), false, "legacy key removed");
  eq(T.stats.games, 0, "no runs yet");
  eq(T.stats.pipes, 0, "no pipes yet");
  eq(T.stats.flaps, 0, "no flaps yet");
  eq(T.stats.crashes, 0, "no crashes yet");
  eq(T.state, "ready", "starts on the ready screen");
  eq(T.paused, false, "not paused");
  eq(T.score, 0, "score starts at 0");
  eq(elements.get("score").textContent, 0, "score HUD");
  eq(elements.get("best").textContent, 7, "best HUD shows the legacy score");
  eq(elements.get("games").textContent, 0, "runs HUD");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), "Flappy", "start overlay");
  ok((T.overlayMsg() || "").indexOf("flap") !== -1, "start overlay explains flapping", T.overlayMsg());
  eq(T.W, 400, "canvas width");
  eq(T.H, 520, "canvas height");
  const s = T.snap();
  eq(s.bird.y, 220, "bird starts mid-air");
  eq(s.bird.vy, 0, "bird starts still");
  eq(s.pipes.length, 0, "no pipes at the start");
}

// ---------- B. First flap starts the run ----------
{
  keydown(" ");
  eq(T.state, "playing", "Space starts flying");
  eq(T.overlayTitle(), null, "start overlay closes");
  eq(T.stats.games, 1, "the run is counted");
  eq(T.stats.flaps, 1, "the flap is counted");
  eq(elements.get("games").textContent, 1, "runs HUD updates");
  eq(T.snap().bird.vy, T.FLAP, "flap gives upward velocity");
  eq(T.unlocked().length, 1, "one badge from the legacy best");
  ok(T.unlocked().includes("score5"), "Up and Away unlocks immediately");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
}

// ---------- C. Physics + the first pipe ----------
{
  const before = T.snap();
  T.setBird(240, 0);
  T.step();
  const after = T.snap();
  ok(after.bird.vy > 0, "gravity pulls the bird down", after.bird.vy);
  ok(after.bird.y > 240, "the bird falls", after.bird.y);

  T.setPipes([]);
  T.addPipe(10, 165);
  T.setBird(240, 0);
  T.step();
  eq(T.score, 1, "a pipe behind the bird scores");
  eq(T.stats.pipes, 1, "pipe counted");
  eq(T.snap().pipes[0].passed, true, "pipe flagged as passed");
  eq(elements.get("score").textContent, 1, "score HUD");
  ok(T.unlocked().includes("first"), "First Flight badge unlocks");
  eq(T.unlocked().length, 2, "two badges unlocked");
  eq(before.stats.best, 7, "the legacy best was not lowered");
}

// ---------- D. A 50-pipe run ----------
{
  T.reset(false);
  eq(T.state, "playing", "Play Again starts playing");
  eq(T.stats.games, 2, "second run counted");
  eq(T.score, 0, "score resets");
  eq(elements.get("score").textContent, 0, "score HUD resets");

  for (let i = 0; i < 50; i++) passPipe();
  eq(T.score, 50, "fifty pipes in one run");
  eq(T.stats.pipes, 51, "fifty-one pipes in total");
  eq(T.stats.best, 50, "best score");
  eq(elements.get("best").textContent, 50, "best HUD");
  ["score10", "score20", "score30", "pipes50"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
  eq(T.unlocked().length, 6, "six badges unlocked");

  T.crash();
  eq(T.state, "over", "a crash ends the run");
  eq(T.stats.crashes, 1, "crash counted");
  eq(T.overlayTitle(), "New Best! 🎉", "new-best overlay");
  ok((T.overlayMsg() || "").indexOf("Score: 50.") !== -1, "score in the overlay", T.overlayMsg());
  ok((T.overlayMsg() || "").indexOf("Best: 50.") !== -1, "best in the overlay", T.overlayMsg());
}

// ---------- E. A run that does not beat the record ----------
{
  keydown(" ");
  eq(T.state, "playing", "Space restarts after a crash");
  eq(T.stats.games, 3, "third run counted");
  eq(T.snap().bird.y, 220, "the bird is back at the start height");
  T.setBird(470, 5);
  T.step();
  eq(T.state, "over", "hitting the ground crashes");
  eq(T.stats.crashes, 2, "crash counted");
  eq(T.overlayTitle(), "Game Over", "plain game-over overlay");
  ok((T.overlayMsg() || "").indexOf("Best: 50.") !== -1, "best survives the loss", T.overlayMsg());
}

// ---------- F. Pause ----------
{
  keydown(" ");
  eq(T.state, "playing", "fourth run");
  eq(T.stats.games, 4, "fourth run counted");

  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  const y = T.snap().bird.y;
  const flaps = T.stats.flaps;
  T.step();
  eq(T.snap().bird.y, y, "the bird is frozen while paused");
  keydown(" ");
  eq(T.stats.flaps, flaps, "Space does not flap while paused");
  keydown("p");
  eq(T.paused, false, "P resumes");
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

  T.setBird(470, 5);
  T.step();
  eq(T.stats.crashes, 3, "crash after the pause tests");

  T.setPaused(true);
  eq(T.paused, false, "a finished run cannot pause");
}

// ---------- G. Ceiling and pipe collisions ----------
{
  keydown(" ");
  eq(T.stats.games, 5, "fifth run");
  T.setBird(10, -10);
  T.step();
  eq(T.state, "over", "the ceiling crashes");
  eq(T.stats.crashes, 4, "ceiling crash counted");

  keydown(" ");
  eq(T.stats.games, 6, "sixth run");
  T.setBird(50, 0);
  T.setPipes([{ x: 80, gapTop: 100 }]);
  T.step();
  eq(T.state, "over", "a pipe crashes");
  eq(T.stats.crashes, 5, "pipe crash counted");
  eq(T.overlayTitle(), "Game Over", "still no record");
}

// ---------- H. Run and crash grind ----------
{
  for (let i = 0; i < 18; i++) {
    T.reset(false);
    T.crash();
  }
  eq(T.stats.games, 24, "twenty-four runs");
  eq(T.stats.crashes, 23, "twenty-three crashes");

  T.reset(false);
  eq(T.stats.games, 25, "twenty-fifth run");
  T.crash();
  eq(T.stats.crashes, 24, "twenty-four crashes");
  ["games10", "games25", "crashes10"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
}

// ---------- I. Flap grind ----------
{
  T.reset(false);
  eq(T.stats.games, 26, "twenty-sixth run");
  const target = 1000 - T.stats.flaps;
  for (let i = 0; i < target; i++) T.flap();
  eq(T.stats.flaps, 1000, "one thousand flaps");
  ["flaps100", "flaps500", "flaps1000"].forEach((id) =>
    ok(T.unlocked().includes(id), id + " badge unlocks")
  );
  eq(T.state, "playing", "flapping never crashes on its own");
}

// ---------- J. Pipe grind ----------
{
  T.setSpawnIn(10000); // keep the natural spawner out of the way
  for (let i = 0; i < 199; i++) passPipe();
  eq(T.stats.pipes, 250, "two hundred and fifty pipes");
  eq(T.score, 199, "199 pipes this run");
  eq(T.stats.best, 199, "new personal best");
  ok(T.unlocked().includes("pipes250"), "Pipe Dream badge unlocks");

  T.crash();
  eq(T.stats.crashes, 25, "twenty-five crashes");
  eq(T.overlayTitle(), "New Best! 🎉", "record run overlay");
}

// ---------- K. Crash grind reaches fifty ----------
{
  for (let i = 0; i < 25; i++) {
    T.reset(false);
    T.crash();
  }
  eq(T.stats.crashes, 50, "fifty crashes");
  eq(T.stats.games, 51, "fifty-one runs");
  ok(T.unlocked().includes("crashes50"), "Crash Test Dummy badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- L. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("flappy-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("flappy-sound"), "on", "preference restored");
}

// ---------- M. Badges modal ----------
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

// ---------- N. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "score5", "score10", "score20", "score30", "games10", "games25",
    "flaps100", "flaps500", "flaps1000", "pipes50", "pipes250", "crashes10", "crashes50",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.games, 51, "runs");
  eq(T.stats.pipes, 250, "pipes passed");
  eq(T.stats.flaps, 1000, "flaps");
  eq(T.stats.crashes, 50, "crashes");
  eq(T.stats.best, 199, "best score");
  eq(elements.get("best").textContent, 199, "best HUD");
  eq(elements.get("games").textContent, 51, "runs HUD");
  ok(storage.has("flappy-stats-v1"), "stats persisted under the core key");
}

// ---------- O. Modes: configs and switching ----------
{
  eq(Object.keys(T.MODES).length, 5, "five mode configs");
  eq(T.MODES.classic.gravity, T.GRAVITY, "classic keeps the pinned gravity");
  eq(T.MODES.classic.flap, T.FLAP, "classic keeps the pinned flap");
  eq(T.MODES.classic.gap, T.GAP, "classic keeps the pinned gap");
  ok(T.MODES.hard.speed > T.MODES.classic.speed, "Hard pipes are faster");
  ok(T.MODES.hard.gap < T.MODES.classic.gap, "Hard gaps are tighter");
  ok(T.MODES.zen.gap > T.MODES.classic.gap, "Zen gaps are wider");
  eq(T.MODES.sprint.timed, 60, "Sprint is a 60-second run");
  eq(T.MODES.zen.lives, 3, "Zen gives three lives");
  eq(T.MODES.daily.seeded, true, "Daily is seeded");

  T.setMode("zen");
  eq(T.mode, "zen", "setMode switches mode");
  eq(T.state, "ready", "switching mode returns to the ready screen");
  eq(T.lives, 3, "Zen lives applied on reset");
  eq(elements.get("mode-label").textContent, "Zen", "mode label updates");
  eq(elements.get("extra-label").textContent, "Lives", "Zen extra stat is lives");
  eq(elements.get("extra-value").textContent, "❤❤❤", "Zen shows three hearts");
  eq(elements.get("extra-stat").hidden, false, "Zen extra stat is shown");

  T.setMode("classic");
  eq(elements.get("extra-stat").hidden, true, "classic hides the extra stat");
}

// ---------- P. Zen absorbs hits instead of ending the run ----------
{
  T.setMode("zen");
  T.flap();
  eq(T.state, "playing", "Zen starts flying");
  T.setPipes([{ x: 100, gapTop: 200 }]);
  T.setBird(60, 0);
  T.step();
  eq(T.lives, 2, "a pipe hit costs one life");
  eq(T.state, "playing", "the run continues after a Zen hit");
  ok(T.particles().length > 0, "the hit spawns particles");
}

// ---------- Q. Sprint timer ----------
{
  T.setMode("sprint");
  T.flap();
  eq(T.timeLeft, 3600, "Sprint starts at 60 seconds");
  T.setSpawnIn(10000);
  for (let i = 0; i < 120; i++) {
    T.setBird(240, 0); // stay safely between pipes
    T.step();
  }
  ok(T.timeLeft < 3600, "the Sprint timer counts down");
  let guard = 0;
  while (T.state === "playing" && guard++ < 5000) {
    T.setBird(240, 0); // stay safely between pipes
    T.step();
  }
  eq(T.state, "over", "the run ends when time runs out");
  eq(T.overlayTitle(), "Time's up! ⏱️", "time-up overlay");
  eq(elements.get("extra-label").textContent, "Time", "Sprint extra stat is time");
}

// ---------- R. Daily is seeded and mode bests are tracked ----------
{
  T.setMode("daily");
  T.reset(false);
  const a = [];
  for (let i = 0; i < 5; i++) {
    T.spawnPipe();
    a.push(T.snap().pipes.slice(-1)[0].gapTop);
  }
  T.reset(false);
  const b = [];
  for (let i = 0; i < 5; i++) {
    T.spawnPipe();
    b.push(T.snap().pipes.slice(-1)[0].gapTop);
  }
  ok(JSON.stringify(a) === JSON.stringify(b), "Daily pipes repeat for the same day");

  T.setMode("hard");
  T.reset(false);
  T.setSpawnIn(10000);
  for (let i = 0; i < 3; i++) passPipe();
  eq(T.stats.bestHard, 3, "Hard mode best is tracked separately");
  ok(T.stats.best >= T.stats.bestHard, "overall best stays the maximum");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
