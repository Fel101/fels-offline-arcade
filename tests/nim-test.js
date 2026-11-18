// Deterministic tests for games/nim/script.js
// Math.random is pinned to 0.5 so the CPU's "random among losing moves"
// fallback is deterministic (it always takes 2 with three options).
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
  "pile", "pile-count", "turn-label", "wins", "losses", "streak",
  "take-1", "take-2", "take-3",
  "mode-normal", "mode-misere", "new-game",
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
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: () => ++timerSeq, // never runs — tests drive the CPU by hand
  clearTimeout: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
Math.random = () => 0.5; // deterministic CPU fallback moves

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

// Legacy saves from the pre-core build — must migrate into the new stats.
storage.set("nim-wins", "7");
storage.set("nim-losses", "3");

const root = require("./_env").root;
const t0 = Date.now();
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/nim/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__NIM;
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

// Scripted full games (verified against a standalone trace of winPos + cpuChooseMove).
function winNormal() {
  T.take(3); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); // take the last counter — wins in normal
}
function loseNormal() {
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove(); // CPU takes the last counter
}
function winMisere() {
  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2); // leave one counter…
  T.cpuMove(); // …the CPU must take the last one and lose
}
function loseMisere() {
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove();
  T.take(1); T.cpuMove();
  T.take(1); // forced to take the last counter — loses in misère
}

// ---------- A. Init + legacy migration ----------
{
  const s = T.snap();
  eq(s.pile, 15, "full pile at start");
  eq(s.turn, "you", "player moves first");
  eq(s.mode, "normal", "default mode is normal");
  eq(s.gameOver, false, "no game over at start");
  eq(s.busy, false, "not busy at start");
  eq(s.paused, false, "not paused at start");
  eq(s.stats.wins, 7, "legacy nim-wins migrated");
  eq(s.stats.losses, 3, "legacy nim-losses migrated");
  eq(s.stats.games, 0, "no games yet");
  eq(storage.has("nim-stats-v1"), true, "stats persisted under core key");
  eq(storage.has("nim-wins"), false, "legacy nim-wins removed");
  eq(storage.has("nim-losses"), false, "legacy nim-losses removed");
  eq(elements.get("wins").textContent, 7, "wins HUD shows migrated value");
  eq(elements.get("losses").textContent, 3, "losses HUD shows migrated value");
  eq(elements.get("streak").textContent, 0, "streak HUD starts at 0");
  eq(elements.get("pile-count").textContent, 15, "pile HUD shows 15");
  eq(elements.get("pile").children.length, 15, "15 tokens rendered");
  eq(s.tokensTaken, 0, "no tokens taken yet");
  eq(JSON.stringify(s.takeDisabled), JSON.stringify([false, false, false]), "all take buttons enabled");
  eq(s.unlocked.length, 0, "no badges at start");
  eq(s.overlayTitle, null, "no overlay at start");
  eq(s.turnLabel, "Your move — take 1 to 3", "turn label prompts the player");
}

// ---------- B. Perfect CPU + first normal win ----------
{
  eq(T.winPos(4, "normal"), false, "15: P-position at 4 (normal)");
  eq(T.winPos(12, "normal"), false, "P-position at 12 (normal)");
  eq(T.winPos(5, "normal"), true, "N-position at 5 (normal)");
  eq(T.winPos(1, "misere"), false, "P-position at 1 (misère)");
  eq(T.winPos(5, "misere"), false, "P-position at 5 (misère)");
  eq(T.winPos(4, "misere"), true, "N-position at 4 (misère)");
  eq(T.cpuChooseMove(), 3, "CPU opening from 15 (normal) leaves 12");

  eq(T.take(3), true, "take 3 is accepted");
  let s = T.snap();
  eq(s.pile, 12, "pile is 12 after take 3");
  eq(s.turn, "cpu", "CPU to move");
  eq(s.busy, true, "busy while CPU thinks");
  eq(s.turnLabel, "CPU is thinking…", "label shows CPU thinking");
  eq(JSON.stringify(s.takeDisabled), JSON.stringify([true, true, true]), "buttons disabled on CPU turn");
  eq(s.tokensTaken, 3, "3 tokens dimmed");

  eq(T.take(2), false, "take rejected while CPU is thinking");
  eq(T.take(4), false, "take 4 is out of range");

  T.cpuMove();
  s = T.snap();
  eq(s.pile, 10, "CPU answered (from P-position, deterministic 2)");
  eq(s.turn, "you", "back to player");
  eq(s.busy, false, "no longer busy");
  eq(s.turnLabel, "Your move — take 1 to 3", "label back to player");

  T.take(2); T.cpuMove();
  eq(T.snap().pile, 6, "pile is 6");
  T.take(2); T.cpuMove();
  eq(T.snap().pile, 2, "pile is 2");
  T.take(2);
  s = T.snap();
  eq(s.gameOver, true, "game over after taking the last counter");
  eq(s.overlayTitle, "You win! 🎉", "win overlay shown");
  eq(s.turnLabel, "You win!", "turn label announces the win");
  eq(s.stats.games, 1, "game counted");
  eq(s.stats.wins, 8, "win recorded (7 migrated + 1)");
  eq(s.stats.normalWins, 1, "normal-mode win recorded");
  eq(s.stats.streak, 1, "streak is 1");
  eq(s.stats.bestStreak, 1, "best streak is 1");
  ok(s.unlocked.includes("first"), "First Steps badge unlocks");
  ok(s.unlocked.includes("win1"), "First Win badge unlocks");
  ok(s.unlocked.includes("win5"), "migrated wins count toward Sharp Mind");
  eq(elements.get("wins").textContent, 8, "wins HUD updated");
  eq(elements.get("streak").textContent, 1, "streak HUD updated");
  eq(s.tokensTaken, 15, "all tokens dimmed");
  eq(JSON.stringify(s.takeDisabled), JSON.stringify([true, true, true]), "buttons disabled after game over");
  T.overlay.hide();
}

// ---------- C. Normal loss (player blunders) ----------
{
  T.reset();
  eq(T.snap().pile, 15, "reset restores the pile");
  eq(T.snap().gameOver, false, "reset clears game over");
  eq(T.snap().overlayTitle, null, "reset hides the overlay");

  loseNormal();
  const s = T.snap();
  eq(s.gameOver, true, "game over after CPU takes the last counter");
  eq(s.overlayTitle, "CPU wins 🤖", "loss overlay shown");
  eq(s.turnLabel, "CPU wins!", "turn label announces the loss");
  eq(s.stats.losses, 4, "loss recorded (3 migrated + 1)");
  eq(s.stats.normalLosses, 1, "normal-mode loss recorded");
  eq(s.stats.games, 2, "second game counted");
  eq(s.stats.streak, 0, "streak reset by the loss");
  T.overlay.hide();
}

// ---------- D. Misère win ----------
{
  T.setMode("misere");
  let s = T.snap();
  eq(s.mode, "misere", "mode switched to misère");
  eq(s.pile, 15, "mode switch resets the pile");
  eq(storage.get("nim-mode"), "misere", "mode persisted");
  eq(elements.get("mode-misere").classList.contains("active"), true, "misère button active");
  eq(elements.get("mode-misere").classList.contains("btn--ghost"), false, "misère button not ghost");
  eq(elements.get("mode-normal").classList.contains("btn--ghost"), true, "normal button ghost");
  eq(T.cpuChooseMove(), 2, "CPU opening from 15 (misère) leaves 13");

  winMisere();
  s = T.snap();
  eq(s.gameOver, true, "game over after CPU takes the last counter");
  eq(s.overlayTitle, "You win! 🎉", "taking the last counter loses it for the CPU");
  eq(s.stats.wins, 9, "misère win recorded");
  eq(s.stats.misereWins, 1, "misère-mode win recorded");
  eq(s.stats.games, 3, "third game counted");
  eq(s.stats.streak, 1, "streak is 1 again");
  ok(s.unlocked.includes("bothModes"), "Two-Sided badge unlocks (win in both modes)");
  T.overlay.hide();
}

// ---------- E. Comeback win (normal) ----------
{
  T.setMode("normal");
  eq(T.snap().mode, "normal", "mode switched back to normal");
  eq(T.snap().pile, 15, "mode switch resets the pile");
  winNormal();
  const s = T.snap();
  eq(s.gameOver, true, "game over");
  eq(s.stats.wins, 10, "win recorded");
  eq(s.stats.normalWins, 2, "second normal win");
  eq(s.stats.streak, 2, "streak is 2");
  eq(s.stats.comebackWins, 1, "win after a loss counted as comeback");
  ok(s.unlocked.includes("win10"), "Nim Mind badge unlocks");
  ok(s.unlocked.includes("comeback"), "Comeback badge unlocks");
  T.overlay.hide();
}

// ---------- F. Win streak + normal mastery ----------
{
  T.reset();
  winNormal();
  const s = T.snap();
  eq(s.stats.wins, 11, "win recorded");
  eq(s.stats.games, 5, "fifth game counted");
  eq(s.stats.normalWins, 3, "third normal win");
  eq(s.stats.streak, 3, "streak is 3");
  eq(s.stats.bestStreak, 3, "best streak is 3");
  ok(s.unlocked.includes("normal3"), "Classic Conqueror badge unlocks");
  ok(s.unlocked.includes("streak3"), "Three in a Row badge unlocks");
  T.overlay.hide();
}

// ---------- G. Extend the streak ----------
{
  T.reset();
  winNormal();
  const s = T.snap();
  eq(s.stats.wins, 12, "win recorded");
  eq(s.stats.streak, 4, "streak is 4");
  eq(s.stats.bestStreak, 4, "best streak is 4");
  T.overlay.hide();
}

// ---------- H. Misère win extends the streak ----------
{
  T.setMode("misere");
  winMisere();
  const s = T.snap();
  eq(s.stats.wins, 13, "win recorded");
  eq(s.stats.misereWins, 2, "second misère win");
  eq(s.stats.streak, 5, "streak is 5 across modes");
  eq(s.stats.bestStreak, 5, "best streak is 5");
  ok(s.unlocked.includes("streak5"), "Unbeaten Run badge unlocks");
  T.overlay.hide();
}

// ---------- I. Third misère win ----------
{
  T.reset();
  winMisere();
  const s = T.snap();
  eq(s.stats.wins, 14, "win recorded");
  eq(s.stats.misereWins, 3, "third misère win");
  eq(s.stats.streak, 6, "streak is 6");
  ok(s.unlocked.includes("misere3"), "Misère Master badge unlocks");
  T.overlay.hide();
}

// ---------- J. Three losses ----------
{
  T.setMode("normal");
  loseNormal(); T.overlay.hide();
  T.reset();
  loseNormal(); T.overlay.hide();
  T.reset();
  loseNormal();
  const s = T.snap();
  eq(s.stats.losses, 7, "three more losses (10 total pending)");
  eq(s.stats.normalLosses, 4, "four normal-mode losses");
  eq(s.stats.games, 11, "eleventh game counted");
  eq(s.stats.streak, 0, "streak reset");
  T.overlay.hide();
}

// ---------- K. Losses reach 10 ----------
{
  T.reset();
  loseNormal(); T.overlay.hide();
  T.reset();
  loseNormal(); T.overlay.hide();
  T.reset();
  loseNormal();
  const s = T.snap();
  eq(s.stats.losses, 10, "tenth loss");
  eq(s.stats.games, 14, "fourteenth game counted");
  ok(s.unlocked.includes("loss10"), "Tough Crowd badge unlocks");
  T.overlay.hide();
}

// ---------- L. Volume — all 14 badges ----------
{
  T.stats.wins = 25;
  T.stats.games = 50;
  T.stats.bestStreak = 10;
  T.checkAchievements();
  const s = T.snap();
  ok(s.unlocked.includes("win25"), "Nim Master badge unlocks");
  ok(s.unlocked.includes("games50"), "Seasoned badge unlocks");
  ok(s.unlocked.includes("streak10"), "Nim Legend badge unlocks");
  const expected = [
    "first", "win1", "win5", "win10", "win25", "loss10", "games50",
    "normal3", "misere3", "streak3", "streak5", "streak10", "comeback", "bothModes",
  ];
  ok(
    s.unlocked.length === 14 && expected.every((id) => s.unlocked.includes(id)),
    "all 14 badges unlocked",
    s.unlocked
  );
}

// ---------- M. Persistence round-trip ----------
{
  const saved = JSON.parse(storage.get("nim-stats-v1"));
  eq(saved.wins, 25, "saved stats include wins");
  eq(saved.games, 50, "saved stats include games");
  const achv = JSON.parse(storage.get("nim-achv-v1"));
  ok(Array.isArray(achv) && achv.includes("first") && achv.includes("bothModes"), "unlocked ids persisted");
}

// ---------- N. Sound button ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "click mutes sound");
  eq(storage.get("nim-sound"), "off", "mute persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon flips to muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "click re-enables sound");
  eq(storage.get("nim-sound"), "on", "unmute persisted");
}

// ---------- O. Badges modal ----------
{
  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  const gridHtml = elements.get("achv-grid").innerHTML;
  ok(gridHtml.includes("First Steps"), "grid renders badge names");
  ok(gridHtml.includes("achv--done"), "earned badges marked done");
  eq(elements.get("achv-count").textContent, "14 / 14", "count shows 14 / 14");
  ok(elements.get("achv-records").innerHTML.includes("Wins"), "records rendered");
  T.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  T.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens again");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
}

// ---------- O2. Modal pauses an active game ----------
{
  T.reset();
  T.take(2);
  eq(T.snap().turn, "cpu", "CPU to move before modal");
  T.openAchv();
  eq(T.snap().paused, true, "modal pauses the game");
  eq(JSON.stringify(T.snap().takeDisabled), JSON.stringify([true, true, true]), "inputs locked while modal open");
  T.closeAchv();
  eq(T.snap().paused, false, "closing the modal resumes");
  T.cpuMove();
  eq(T.snap().pile, 12, "CPU completes its move after resume");
  eq(T.snap().turn, "you", "back to the player");
}

// ---------- P. Pause ----------
{
  T.reset();
  T.togglePause();
  let s = T.snap();
  eq(s.paused, true, "P pauses the game");
  eq(s.overlayTitle, "Paused", "pause overlay shown");
  eq(JSON.stringify(s.takeDisabled), JSON.stringify([true, true, true]), "inputs locked while paused");
  T.togglePause();
  s = T.snap();
  eq(s.paused, false, "resume unpauses");
  eq(s.overlayTitle, null, "overlay cleared on resume");

  T.take(3); // CPU to move
  T.togglePause();
  eq(T.snap().paused, true, "pause mid-CPU-turn");
  T.cpuMove();
  eq(T.snap().pile, 12, "cpuMove is blocked while paused");
  eq(T.snap().turn, "cpu", "turn unchanged while paused");
  T.togglePause();
  T.cpuMove();
  eq(T.snap().pile, 10, "CPU move lands after resume");

  T.take(2); T.cpuMove();
  T.take(2); T.cpuMove();
  T.take(2);
  s = T.snap();
  eq(s.gameOver, true, "game finished");
  eq(s.overlayTitle, "You win! 🎉", "win overlay shown");
  T.togglePause();
  s = T.snap();
  eq(s.paused, false, "pause is a no-op after game over");
  eq(s.overlayTitle, "You win! 🎉", "game-over overlay untouched");
  T.overlay.hide();
}

// ---------- Q. Auto-pause on blur / visibility ----------
{
  T.reset();
  (listeners["win:blur"] || []).forEach((fn) => fn());
  eq(T.snap().paused, true, "blur pauses the game");
  eq(T.snap().overlayTitle, "Paused", "pause overlay shown on blur");
  T.togglePause();
  eq(T.snap().paused, false, "resumed after blur-pause");

  T.reset();
  global.document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn());
  global.document.hidden = false;
  eq(T.snap().paused, true, "tab hide pauses the game");
  T.togglePause();
  eq(T.snap().paused, false, "resumed after visibility-pause");
}

// ---------- R. Keyboard controls ----------
{
  T.reset();
  keydown("1");
  eq(T.snap().pile, 14, "key 1 takes one counter");
  eq(T.snap().turn, "cpu", "CPU to move after key take");
  T.cpuMove();
  eq(T.snap().pile, 12, "CPU answered the key take");

  keydown("p");
  eq(T.snap().paused, true, "P pauses via keyboard");
  keydown("2");
  eq(T.snap().pile, 12, "takes are ignored while paused");
  keydown("p");
  eq(T.snap().paused, false, "P resumes via keyboard");

  keydown("3");
  eq(T.snap().pile, 9, "key 3 takes three counters");
  T.cpuMove();
  eq(T.snap().pile, 8, "CPU left 8 (winning reply)");
  keydown("9");
  eq(T.snap().pile, 8, "key 9 is not a take");
  keydown("z");
  eq(T.snap().pile, 8, "unrelated keys are ignored");
}

// ---------- S. Mode switching ----------
{
  T.reset();
  T.take(1);
  eq(T.snap().pile, 14, "mid-game before mode switch");
  T.setMode("normal");
  eq(T.snap().pile, 14, "same-mode setMode is a no-op");
  T.setMode("bogus");
  eq(T.snap().mode, "normal", "invalid mode ignored");
  T.setMode("misere");
  eq(T.snap().mode, "misere", "mode switched");
  eq(T.snap().pile, 15, "mode switch restarts the game");
  eq(storage.get("nim-mode"), "misere", "mode persisted");
  T.setMode("normal");
  eq(T.snap().mode, "normal", "mode switched back");
  eq(storage.get("nim-mode"), "normal", "mode persisted back");
  eq(elements.get("mode-normal").classList.contains("active"), true, "normal button active again");
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
if (fail) process.exit(1);
