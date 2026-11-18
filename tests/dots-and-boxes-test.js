// Deterministic tests for games/dots-and-boxes/script.js
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
    querySelector() {
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
  "board", "you-score", "cpu-score", "wins", "streak", "turn-label", "new-game",
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
global.setTimeout = () => 1;
global.clearTimeout = () => {};
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Win count from the pre-core build.
storage.set("dots-wins", "2");

const root = require("./_env").root;
const dir = root + "games/dots-and-boxes/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const D = global.window.__DOTS;
if (!D) {
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

const boardKids = () => elements.get("board").children;
const lines = () => boardKids().filter((el) => el.classList.contains("line"));
const dots = () => boardKids().filter((el) => el.classList.contains("dot"));
const boxEls = () => boardKids().filter((el) => el.classList.contains("box"));
const hBtn = (r, c) => D.hLines && lines().find((el) => el.getAttribute("aria-label") === `Horizontal line row ${r + 1}, segment ${c + 1}`);
const vBtn = (r, c) => lines().find((el) => el.getAttribute("aria-label") === `Vertical line col ${c + 1}, segment ${r + 1}`);

function drawn(type, r, c) {
  return type === "h" ? !!D.hLines[r][c] : !!D.vLines[r][c];
}

// Draw every box, choosing which side of the owner function completes it.
// Processing row-major means each box is completed by its own final side.
function claimBoxes(ownerFor) {
  for (let br = 0; br < D.BOXES; br++) {
    for (let bc = 0; bc < D.BOXES; bc++) {
      const sides = [
        ["h", br, bc],
        ["h", br + 1, bc],
        ["v", br, bc],
        ["v", br, bc + 1],
      ];
      const missing = sides.filter(([t, r, c]) => !drawn(t, r, c));
      for (let i = 0; i < missing.length; i++) {
        const [t, r, c] = missing[i];
        const last = i === missing.length - 1;
        const owner = last ? ownerFor(br, bc) : "you";
        D.claim(t, r, c, owner);
      }
    }
  }
}

// ---------- A. Init, legacy migration and the 9x9 grid ----------
{
  eq(D.stats.games, 1, "the opening game is counted");
  eq(D.stats.wins, 2, "legacy wins migrated");
  eq(storage.has("dots-wins"), false, "legacy key removed");
  eq(D.stats.losses, 0, "no losses");
  eq(D.stats.draws, 0, "no draws");
  eq(D.stats.streak, 0, "no streak");
  eq(D.stats.bestStreak, 0, "no best streak");
  eq(D.stats.boxes, 0, "no boxes yet");
  eq(D.stats.boxesBest, 0, "no best game");
  eq(D.stats.shutouts, 0, "no shutouts");
  eq(D.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(D.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(D.DOTS, 5, "five dots per side");
  eq(D.BOXES, 4, "four boxes per side");
  eq(D.TOTAL_BOXES, 16, "sixteen boxes");
  eq(boardKids().length, 81, "9x9 grid rendered");
  eq(dots().length, 25, "25 dots");
  eq(lines().length, 40, "40 lines");
  eq(boxEls().length, 16, "16 boxes");
  eq(D.turn, "you", "you move first");
  eq(D.gameOver, false, "the game is live");
  eq(D.paused, false, "not paused");
  eq(D.busy, false, "not busy");
  eq(D.scores.you, 0, "no player boxes");
  eq(D.scores.cpu, 0, "no CPU boxes");
  eq(elements.get("you-score").textContent, 0, "your score HUD");
  eq(elements.get("cpu-score").textContent, 0, "CPU score HUD");
  eq(elements.get("wins").textContent, 2, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("turn-label").textContent, "Your line — draw any segment", "turn prompt");
  eq(D.unlocked().length, 1, "legacy wins unlock the first badge");
  ok(D.unlocked().includes("first"), "First Box unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(D.overlayTitle(), null, "no overlay on load");
  eq(hBtn(0, 0).disabled, false, "lines start clickable");
}

// ---------- B. Drawing lines and the CPU reply ----------
{
  // With the CPU disabled the turn stays with you, so a single player can
  // draw several lines in a row.
  D.setCpuEnabled(false);
  eq(D.draw("h", 0, 0), true, "a line can be drawn");
  eq(D.hLines[0][0], "you", "the line belongs to you");
  eq(hBtn(0, 0).disabled, true, "the line locks");
  eq(hBtn(0, 0).classList.contains("claimed-you"), true, "the line is styled");
  eq(D.turn, "you", "the turn stays with you when the CPU is off");
  eq(D.busy, false, "no timer when CPU is disabled");
  eq(D.draw("h", 0, 1), true, "you can draw another line");
  eq(D.draw("h", 0, 0), false, "a drawn line cannot be redrawn");

  eq(D.setTurn("cpu"), "cpu", "force the turn to the CPU");
  eq(D.cpuMove(), true, "the CPU moves");
  eq(D.turn, "you", "the cpu-disabled CPU hands the turn back");
  const claimed = D.hLines.flat().filter(Boolean).length + D.vLines.flat().filter(Boolean).length;
  eq(claimed, 3, "three lines are on the board");
  eq(D.scores.you, 0, "no boxes yet");
  eq(D.scores.cpu, 0, "no CPU boxes yet");
}

// ---------- C. Pause, blur, visibility and the badges modal ----------
{
  keydown("Escape");
  eq(D.paused, true, "Escape pauses");
  eq(D.overlayTitle(), "Paused", "pause overlay");
  has(D.overlayMsg(), "on hold", "pause message");
  eq(D.draw("v", 0, 0), false, "drawing is blocked while paused");
  eq(D.cpuMove(), false, "the CPU is frozen while paused");
  keydown("p");
  eq(D.paused, false, "P resumes");
  eq(D.overlayTitle(), null, "pause overlay closed");

  winEvent("blur");
  eq(D.paused, true, "window blur pauses");
  keydown("Escape");
  eq(D.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(D.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(D.paused, false, "resumed again");

  D.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(D.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "1 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(D.paused, true, "the game stays paused behind the modal");
  keydown("Escape");
  eq(D.paused, false, "and Escape resumes");
}

// ---------- D. Completing a box keeps the turn ----------
{
  eq(D.reset(), true, "a fresh game starts");
  eq(D.stats.games, 2, "second game counted");
  eq(D.setCpuEnabled(false), undefined, "CPU stays off");
  eq(D.draw("h", 0, 0), true, "top side drawn");
  D.claim("h", 1, 0, "you");
  D.claim("v", 0, 0, "you");
  eq(D.boxSides(0, 0), 3, "three sides on the top-left box");
  eq(D.boxes[0][0], null, "the box is not claimed yet");
  eq(D.draw("v", 0, 1), true, "the fourth side completes the box");
  eq(D.boxes[0][0], "you", "the box belongs to you");
  eq(D.scores.you, 1, "your score rises");
  eq(elements.get("you-score").textContent, 1, "score HUD");
  eq(D.turn, "you", "a completed box keeps the turn");
  eq(boxEls()[0].classList.contains("filled-you"), true, "the box is styled");
  eq(boxEls()[0].textContent, "Y", "the box shows a Y");
  eq(D.stats.boxes, 0, "box totals only settle at the end of a game");
}

// ---------- E. Ten perfect games ----------
{
  let firstRecord = false;
  for (let i = 0; i < 10; i++) {
    D.reset();
    claimBoxes(() => "you");
    if (i === 0) firstRecord = /New best/.test(D.overlayMsg() || "");
  }
  eq(firstRecord, true, "the first perfect game is a record");
  eq(D.stats.games, 12, "twelve games");
  eq(D.stats.wins, 12, "twelve wins including the legacy count");
  eq(D.stats.losses, 0, "no losses yet");
  eq(D.stats.draws, 0, "no draws yet");
  eq(D.stats.streak, 10, "a ten-game streak");
  eq(D.stats.bestStreak, 10, "best streak ten");
  eq(D.stats.boxes, 160, "160 boxes claimed");
  eq(D.stats.boxesBest, 16, "a perfect 16-box game");
  eq(D.stats.shutouts, 10, "ten clean sheets");
  eq(elements.get("wins").textContent, 12, "wins HUD");
  eq(elements.get("streak").textContent, 10, "streak HUD");
  eq(D.overlayTitle(), "You win! 🎉", "win overlay");
  has(D.overlayMsg(), "You 16, CPU 0", "final score in the overlay");
  has(D.overlayMsg(), "Clean sheet", "shutout note");
  ok(D.unlocked().includes("win5"), "Box Collector unlocks");
  ok(D.unlocked().includes("win10"), "Grid Champion unlocks");
  ok(D.unlocked().includes("games10"), "Ten Grids unlocks");
  ok(D.unlocked().includes("streak2"), "On a Roll unlocks");
  ok(D.unlocked().includes("streak3"), "Hot Streak unlocks");
  ok(D.unlocked().includes("streak5"), "Unstoppable unlocks");
  ok(D.unlocked().includes("boxes50"), "Brick Layer unlocks");
  ok(D.unlocked().includes("boxes150"), "Master Builder unlocks");
  ok(D.unlocked().includes("shutout1"), "Clean Sheet unlocks");
  ok(D.unlocked().includes("shutout3"), "Lockdown unlocks");
  ok(D.unlocked().includes("big12"), "Land Grab unlocks");
  ok(D.unlocked().includes("big16"), "Perfection unlocks");
  eq(D.unlocked().length, 13, "thirteen badges, games25 still locked");
}

// ---------- F. A loss ----------
{
  D.reset();
  eq(D.stats.games, 13, "thirteenth game");
  claimBoxes(() => "cpu");
  eq(D.scores.cpu, 16, "the CPU takes every box");
  eq(D.stats.wins, 12, "wins unchanged");
  eq(D.stats.losses, 1, "loss counted");
  eq(D.stats.streak, 0, "the streak breaks");
  eq(D.stats.bestStreak, 10, "the best streak survives");
  eq(D.stats.boxes, 160, "a 0-box loss adds nothing");
  eq(D.overlayTitle(), "CPU wins 🤖", "loss overlay");
  has(D.overlayMsg(), "You 0, CPU 16", "loss score");
}

// ---------- G. A draw ----------
{
  D.reset();
  eq(D.stats.games, 14, "fourteenth game");
  claimBoxes((br, bc) => (br * 4 + bc < 8 ? "you" : "cpu"));
  eq(D.scores.you, 8, "eight boxes each");
  eq(D.scores.cpu, 8, "eight boxes each");
  eq(D.stats.draws, 1, "draw counted");
  eq(D.stats.losses, 1, "losses unchanged");
  eq(D.stats.streak, 0, "the streak stays broken");
  eq(D.stats.boxes, 168, "eight more boxes");
  eq(D.stats.boxesBest, 16, "the best game survives");
  eq(D.overlayTitle(), "Draw! 🤝", "draw overlay");
}

// ---------- H. Play count ----------
{
  while (D.stats.games < 25) D.reset();
  eq(D.stats.games, 25, "twenty-five games");
  ok(D.unlocked().includes("games25"), "Veteran unlocks");
  eq(D.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- I. Badges modal and records ----------
{
  D.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "all 14 shown");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Games <b>25</b>", "games record");
  has(records, "Wins <b>12</b>", "wins record");
  has(records, "Losses <b>1</b>", "losses record");
  has(records, "Draws <b>1</b>", "draws record");
  has(records, "Best streak <b>10</b>", "best streak record");
  has(records, "Boxes <b>168</b>", "boxes record");
  has(records, "Best game <b>16</b>", "best game record");
  has(records, "Shutouts <b>10</b>", "shutouts record");
  D.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  const expected = [
    "first", "win5", "win10", "games10", "games25", "streak2", "streak3",
    "streak5", "boxes50", "boxes150", "shutout1", "shutout3", "big12", "big16",
  ];
  const u = D.unlocked();
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badge ids", u);
  ok(storage.has("dots-and-boxes-stats-v1"), "stats persisted");
  ok(storage.has("dots-and-boxes-achv-v1"), "badges persisted");
  eq(storage.has("dots-wins"), false, "legacy key stays removed");
}

// ---------- J. Buttons, sound and keyboard ----------
{
  const games = D.stats.games;
  elements.get("new-game").dispatch("click");
  eq(D.stats.games, games + 1, "New Game counts a game");
  eq(D.turn, "you", "a fresh grid");
  eq(lines().length, 40, "lines rebuilt");
  eq(D.scores.you, 0, "score reset");
  eq(D.overlayTitle(), null, "overlay closed");

  // A real line-button click draws a line.
  D.setCpuEnabled(false);
  const before = D.hLines.flat().filter(Boolean).length + D.vLines.flat().filter(Boolean).length;
  hBtn(0, 0).dispatch("click");
  const after = D.hLines.flat().filter(Boolean).length + D.vLines.flat().filter(Boolean).length;
  eq(after, before + 1, "clicking a line draws it");
  eq(hBtn(0, 0).classList.contains("claimed-you"), true, "the clicked line is yours");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("dots-and-boxes-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("dots-and-boxes-sound"), "on", "preference restored");

  keydown("Escape");
  eq(D.paused, true, "keyboard pause");
  keydown("Escape");
  eq(D.paused, false, "keyboard resume");

  D.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  keydown("Escape");
  eq(D.paused, false, "and resumes the game");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
