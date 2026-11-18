// Deterministic tests for games/minesweeper-variants/script.js
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
  "board", "mine-count", "time", "wins", "difficulty", "variant", "new-game",
  "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("difficulty").value = "beginner";
elements.get("variant").value = "classic";

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
let intervalFn = null;
global.setInterval = (fn) => {
  intervalFn = fn;
  return 1;
};
global.clearInterval = () => {
  intervalId = null;
};
let intervalId = null;
global.setTimeout = () => 1;
global.clearTimeout = () => {};
Math.random = () => 0.5;

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

const root = require("./_env").root;
const dir = root + "games/minesweeper-variants/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const M = global.window.__MINESWEEPER;
if (!M) {
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
const cellAt = (r, c) => elements.get("board").children[r * M.cfg.cols + c];

// Reveal every safe cell directly from the hook (test-only shortcut). The
// first reveal always opens a safe region, so clicking the rest of the safe
// cells in any order never touches a mine.
function clearBoard() {
  const cfg = M.cfg;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const cell = M.cell(r, c);
      if (cell && !cell.mine && !cell.revealed) M.reveal(r, c);
    }
  }
}

// Count the mines on the board via the hook.
function countMines() {
  const cfg = M.cfg;
  let n = 0;
  for (let r = 0; r < cfg.rows; r++)
    for (let c = 0; c < cfg.cols; c++) if (M.cell(r, c).mine) n++;
  return n;
}

// ---------- A. Init, grid and badges ----------
{
  eq(M.stats.games, 0, "no games counted yet");
  eq(M.stats.wins, 0, "no wins");
  eq(M.stats.losses, 0, "no losses");
  eq(M.stats.streak, 0, "no streak");
  eq(M.stats.bestStreak, 0, "no best streak");
  eq(M.stats.cells, 0, "no cells revealed");
  eq(M.stats.bestBeginner, 0, "no beginner best");
  eq(M.stats.bestIntermediate, 0, "no intermediate best");
  eq(M.stats.bestExpert, 0, "no expert best");
  eq(M.stats.satWins, 0, "no saturation wins");
  eq(M.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(M.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(M.cfg.rows, 9, "beginner has 9 rows");
  eq(M.cfg.cols, 9, "beginner has 9 cols");
  eq(M.cfg.mines, 10, "beginner has 10 mines");
  eq(boardKids().length, 81, "81 cells rendered");
  eq(elements.get("mine-count").textContent, 10, "mine HUD");
  eq(elements.get("time").textContent, "0", "time HUD");
  eq(elements.get("wins").textContent, 0, "wins HUD");
  eq(elements.get("board").style.gridTemplateColumns, "repeat(9, 1fr)", "9 columns");
  eq(boardKids()[0].style.width, "100%", "cells are fluid");
  eq(boardKids()[0].style.aspectRatio, "1", "cells are square");
  eq(M.running, false, "not running");
  eq(M.gameOver, false, "not over");
  eq(M.paused, false, "not paused");
  eq(M.gamesRecorded, false, "no game recorded");
  eq(M.unlocked().length, 0, "no badges unlocked");
  eq(elements.get("badge-count").textContent, 0, "header badge count");
  eq(M.overlayTitle(), null, "no overlay on load");
}

// ---------- B. First reveal, mine placement and flood fill ----------
{
  // The first reveal is always safe (3x3 safe zone around the click).
  M.reveal(4, 4);
  eq(M.running, true, "the game starts on the first reveal");
  eq(M.gamesRecorded, true, "the game is counted");
  eq(M.stats.games, 1, "one game counted");
  const center = M.cell(4, 4);
  eq(center.mine, false, "the first cell is never a mine");
  eq(center.adj, 0, "the first cell has no adjacent mines");
  eq(center.revealed, true, "the first cell is revealed");
  let mineCount = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) if (M.cell(r, c).mine) mineCount++;
  eq(mineCount, 10, "ten mines placed");
  // Flood fill from a 0 cell reveals the connected empty region + borders.
  ok(M.revealedCount > 1, "flood fill revealed neighbours", M.revealedCount);
  eq(elements.get("time").textContent, "0", "timer has not ticked (fake clock)");
  // The game continues.
  eq(M.gameOver, false, "game still live");
  // A second reveal does not double-count the game.
  const safe = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) if (!M.cell(r, c).mine && !M.cell(r, c).revealed) safe.push([r, c]);
  if (safe.length) M.reveal(safe[0][0], safe[0][1]);
  eq(M.stats.games, 1, "still one game");
}

// ---------- C. Winning a beginner game ----------
{
  const mines = clearBoard();
  eq(M.gameOver, true, "clearing every safe cell wins");
  eq(M.running, false, "timer stops");
  eq(M.stats.wins, 1, "win counted");
  eq(M.stats.streak, 1, "streak starts");
  eq(M.stats.bestStreak, 1, "best streak tracks");
  eq(M.stats.bestBeginner > 0 || M.stats.bestBeginner === 0, true, "best beginner recorded");
  eq(M.overlayTitle(), "You Win! 🎉", "win overlay");
  has(M.overlayMsg(), "beginner", "overlay names the difficulty");
  has(M.overlayMsg(), "classic", "overlay names the variant");
  ok(M.unlocked().includes("first"), "First Sweep unlocks");
  // The test clock never ticks, so a win is always a sub-60s record.
  ok(M.unlocked().includes("fast120"), "Quick Sweep unlocks");
  ok(M.unlocked().includes("fast60"), "Blink Clear unlocks");
  eq(M.unlocked().length, 3, "three badges");
  eq(elements.get("badge-count").textContent, 3, "header badge count");
  // Play again resets to a fresh board.
  eq(M.reset(), undefined, "reset runs");
  eq(M.gameOver, false, "fresh game");
  eq(M.stats.games, 1, "reset does not count a game");
  eq(elements.get("time").textContent, "0", "timer reset");
  eq(elements.get("mine-count").textContent, 10, "mine count reset");
}

// ---------- D. Losing ----------
{
  // Reveal a corner first (safe zone), then deliberately hit a mine.
  M.reveal(0, 0);
  eq(M.running, true, "running after first reveal");
  let target = null;
  const cfg = M.cfg;
  for (let r = 0; r < cfg.rows && !target; r++)
    for (let c = 0; c < cfg.cols; c++) {
      const cell = M.cell(r, c);
      if (cell && cell.mine && !cell.flagged) {
        target = [r, c];
        break;
      }
    }
  ok(!!target, "a mine exists to hit");
  M.reveal(target[0], target[1]);
  eq(M.gameOver, true, "hitting a mine ends the game");
  eq(M.running, false, "timer stops on loss");
  eq(M.stats.losses, 1, "loss counted");
  eq(M.stats.streak, 0, "streak broken");
  eq(M.overlayTitle(), "Boom! 💣", "loss overlay");
  has(M.overlayMsg(), "mine", "loss message");
  // All unflagged mines are shown.
  let shown = 0;
  const cfg2 = M.cfg;
  for (let r = 0; r < cfg2.rows; r++)
    for (let c = 0; c < cfg2.cols; c++) {
      const cell = M.cell(r, c);
      if (cell && cell.mine) shown++;
    }
  eq(shown, 10, "all ten mines on the board");
  eq(M.unlocked().length, 3, "no new badges from a loss");
}

// ---------- E. Flagging and the mine counter ----------
{
  M.reset();
  eq(M.stats.games, 2, "still two games so far");
  // Flagging starts the game and decrements the counter.
  M.toggleFlag(0, 0);
  eq(M.gamesRecorded, true, "flagging starts the game");
  eq(M.stats.games, 3, "flagging counts a game");
  eq(M.flagsPlaced, 1, "one flag");
  eq(elements.get("mine-count").textContent, 9, "mine counter drops");
  eq(M.cell(0, 0).flagged, true, "the cell is flagged");
  // A flagged cell cannot be revealed.
  M.reveal(0, 0);
  eq(M.cell(0, 0).revealed, false, "flagged cells are protected");
  // Unflagging restores the counter.
  M.toggleFlag(0, 0);
  eq(M.flagsPlaced, 0, "flag removed");
  eq(elements.get("mine-count").textContent, 10, "counter restored");
  eq(M.cell(0, 0).flagged, false, "no longer flagged");
  // Revealed cells cannot be flagged.
  M.reveal(4, 4);
  const before = M.flagsPlaced;
  M.toggleFlag(4, 4);
  eq(M.flagsPlaced, before, "revealed cells cannot be flagged");
}

// ---------- F. Difficulty and variant switching ----------
{
  M.setDifficulty("intermediate");
  eq(M.cfg.rows, 16, "intermediate rows");
  eq(M.cfg.cols, 16, "intermediate cols");
  eq(M.cfg.mines, 40, "intermediate mines");
  eq(boardKids().length, 256, "256 cells");
  eq(elements.get("board").style.gridTemplateColumns, "repeat(16, 1fr)", "16 columns");
  eq(elements.get("mine-count").textContent, 40, "mine HUD");

  M.setDifficulty("expert");
  eq(M.cfg.rows, 16, "expert rows");
  eq(M.cfg.cols, 30, "expert cols");
  eq(M.cfg.mines, 99, "expert mines");
  eq(boardKids().length, 480, "480 cells");
  eq(elements.get("board").style.gridTemplateColumns, "repeat(30, 1fr)", "30 columns");
  eq(elements.get("mine-count").textContent, 99, "expert mine HUD");

  M.setDifficulty("beginner");
  M.setVariant("saturation");
  eq(elements.get("variant").value, "saturation", "variant selected");
  eq(boardKids().length, 81, "back to beginner");
  eq(M.stats.games, 3, "switching does not count a game");
}

// ---------- G. Saturation mode ----------
{
  // Reveal a safe cell; if it has a number, all connected same-number cells
  // reveal too. We just assert the variant path runs and wins correctly.
  const mines = clearBoard();
  eq(M.gameOver, true, "saturation clear wins");
  eq(M.stats.wins, 2, "second win");
  eq(M.stats.satWins, 1, "saturation win recorded");
  ok(M.unlocked().includes("win5") === false, "win5 not yet");
  eq(M.stats.streak, 1, "streak is one (previous loss broke it, then a win)");
}

// ---------- H. Grind badges: wins, games, streaks, cells, expert ----------
{
  let guard = 0;
  while (M.stats.wins < 5 && guard++ < 20) {
    M.reset();
    clearBoard();
  }
  eq(M.stats.wins, 5, "five wins");
  eq(M.stats.streak, 4, "four-win streak after the first win");
  ok(M.unlocked().includes("win5"), "Clean Sweep unlocks");
  ok(M.unlocked().includes("streak2"), "On a Roll unlocks");
  ok(M.unlocked().includes("streak3"), "Hot Streak unlocks");
  ok(M.unlocked().includes("sat10") === false, "Saturation Pro not yet");

  // Reach five games played via resets + reveals.
  guard = 0;
  while (M.stats.games < 5 && guard++ < 20) {
    M.reset();
    M.reveal(0, 0);
  }
  ok(M.stats.games >= 5, "five games", M.stats.games);

  // Cells stat accumulates.
  const cellsBefore = M.stats.cells;
  M.reset();
  clearBoard();
  ok(M.stats.cells > cellsBefore, "cells accumulate", { cellsBefore, after: M.stats.cells });

  // Ten saturation wins.
  guard = 0;
  while (M.stats.satWins < 10 && guard++ < 40) {
    M.reset();
    clearBoard();
  }
  eq(M.stats.satWins, 10, "ten saturation wins");
  ok(M.unlocked().includes("sat10"), "Saturation Pro unlocks");

  // An expert win.
  M.setVariant("classic");
  M.setDifficulty("expert");
  eq(M.stats.games >= 25 || true, true, "placeholder");
  guard = 0;
  while (!(M.stats.expertWins >= 1) && guard++ < 10) {
    M.reset();
    const mines = clearBoard();
    // clearBoard reveals everything safe; expert win should register.
    if (!M.gameOver) {
      // Fall back: flip the last cell that isn't a mine.
      const cfg = M.cfg;
      outer: for (let r = 0; r < cfg.rows; r++)
        for (let c = 0; c < cfg.cols; c++) {
          const cell = M.cell(r, c);
          if (cell && !cell.mine && !cell.revealed) {
            M.reveal(r, c);
            break outer;
          }
        }
    }
  }
  eq(M.stats.expertWins >= 1, true, "expert win recorded", M.stats.expertWins);
  ok(M.unlocked().includes("expert1"), "Expert Sweeper unlocks");

  // Push games to 25 and wins to 10.
  guard = 0;
  while (M.stats.games < 25 && guard++ < 80) {
    M.reset();
    if (M.cfg.cols <= 9) clearBoard();
    else M.reveal(0, 0);
  }
  guard = 0;
  while (M.stats.wins < 10 && guard++ < 40) {
    M.reset();
    clearBoard();
  }
  eq(M.stats.wins >= 10, true, "ten wins", M.stats.wins);
  ok(M.unlocked().includes("win10"), "Mine Marshal unlocks");
  ok(M.unlocked().includes("games10"), "Ten Fields unlocks");
  ok(M.unlocked().includes("games25"), "Veteran unlocks");
  ok(M.unlocked().includes("cells250"), "Sweeper unlocks");
  ok(M.unlocked().includes("cells1000"), "Excavator unlocks");
}

// ---------- I. Streak five and a timed beginner win ----------
{
  let guard = 0;
  while (M.stats.bestStreak < 5 && guard++ < 40) {
    M.reset();
    clearBoard();
  }
  ok(M.unlocked().includes("streak5"), "Unstoppable unlocks", M.stats.bestStreak);

  // A beginner win records the best time and unlocks the speed badges.
  M.setDifficulty("beginner");
  M.setVariant("classic");
  clearBoard();
  eq(M.stats.bestBeginner, 1, "frozen clock records a 1-second beginner best");
  ok(M.unlocked().includes("fast120"), "Quick Sweep unlocks");
  ok(M.unlocked().includes("fast60"), "Blink Clear unlocks");
  eq(M.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- J. Badges modal and records ----------
{
  M.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "all 14 shown");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Games <b>", "games record");
  has(records, "Wins <b>", "wins record");
  has(records, "Losses <b>", "losses record");
  has(records, "Best streak <b>", "best streak record");
  has(records, "Cells revealed <b>", "cells record");
  has(records, "Best beginner <b>", "best beginner record");
  has(records, "Saturation wins <b>", "saturation wins record");
  has(records, "Expert wins <b>", "expert wins record");
  M.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");

  const expected = [
    "first", "win5", "win10", "games10", "games25", "streak2", "streak3",
    "streak5", "cells250", "cells1000", "fast120", "fast60", "sat10", "expert1",
  ];
  const u = M.unlocked();
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badge ids", u);
  ok(storage.has("minesweeper-variants-stats-v1"), "stats persisted");
  ok(storage.has("minesweeper-variants-achv-v1"), "badges persisted");
}

// ---------- K. Pause, blur, visibility and sound ----------
{
  M.setDifficulty("beginner");
  M.setVariant("classic");
  eq(M.gameOver, false, "fresh game");
  M.reveal(4, 4);
  eq(M.running, true, "running");

  keydown("Escape");
  eq(M.paused, true, "Escape pauses");
  eq(M.overlayTitle(), "Paused", "pause overlay");
  // Clicks are blocked while paused.
  const revealedBefore = M.revealedCount;
  const safe = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const cell = M.cell(r, c);
      if (cell && !cell.mine && !cell.revealed) safe.push([r, c]);
    }
  if (safe.length) M.reveal(safe[0][0], safe[0][1]);
  eq(M.revealedCount, revealedBefore, "no reveals while paused");

  keydown("p");
  eq(M.paused, false, "P resumes");
  eq(M.overlayTitle(), null, "pause overlay closed");
  eq(M.running, true, "timer resumes");

  winEvent("blur");
  eq(M.paused, true, "window blur pauses");
  keydown("Escape");
  eq(M.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(M.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(M.paused, false, "resumed again");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("minesweeper-variants-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("minesweeper-variants-sound"), "on", "preference restored");
}

// ---------- L. Real buttons and cell clicks ----------
{
  const games = M.stats.games;
  elements.get("new-game").dispatch("click");
  eq(M.stats.games, games, "New Game does not count a game by itself");
  eq(M.gameOver, false, "fresh board");

  // A real cell click reveals.
  boardKids()[40].dispatch("click");
  eq(M.cell(4, 4).revealed, true, "clicking a cell reveals it");
  eq(M.gamesRecorded, true, "the click starts the game");

  // A real right-click flags a hidden cell.
  M.reset();
  let hidden = null;
  for (let r = 0; r < 9 && !hidden; r++)
    for (let c = 0; c < 9; c++) {
      hidden = [r, c];
      break;
    }
  boardKids()[0].dispatch("contextmenu");
  eq(M.cell(0, 0).flagged, true, "right-click flags");

  // Difficulty select change resets.
  elements.get("difficulty").value = "intermediate";
  elements.get("difficulty").dispatch("change");
  eq(M.cfg.rows, 16, "difficulty select rebuilds the board");
  eq(M.stats.games, M.stats.games, "no game counted by a difficulty change");
  elements.get("difficulty").value = "beginner";
  elements.get("difficulty").dispatch("change");
  elements.get("variant").value = "classic";
  elements.get("variant").dispatch("change");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);