// Deterministic tests for games/sea-battle/script.js
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
  "your-board", "enemy-board", "randomize", "start-battle", "wins", "streak",
  "your-ships", "enemy-ships", "turn-label", "badges-btn", "badge-count", "badges2",
  "sound-btn", "sound-icon", "toasts", "achv-modal", "achv-grid", "achv-count",
  "achv-records",
];
for (const id of ids) elements.set(id, makeEl("div", id));
elements.get("achv-modal").hidden = true;
elements.get("start-battle").disabled = false;

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
storage.set("battleship-wins", "3");

const root = require("./_env").root;
const dir = root + "games/sea-battle/";
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(dir + "script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const B = global.window.__BATTLESHIP;
if (!B) {
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
const enemyCell = (r, c) => elements.get("enemy-board").children[r * 10 + c];
const yourCell = (r, c) => elements.get("your-board").children[r * 10 + c];

// Deterministic fleets shared across the suite.
const PLAYER = [{ name: "Destroyer", cells: ["9,0", "9,1"] }];
const AI = [
  { name: "Carrier", cells: ["0,0", "0,1", "0,2", "0,3", "0,4"] },
  { name: "Battleship", cells: ["1,0", "1,1", "1,2", "1,3"] },
  { name: "Cruiser", cells: ["2,0", "2,1", "2,2"] },
  { name: "Submarine", cells: ["3,0", "3,1", "3,2"] },
  { name: "Destroyer", cells: ["4,0", "4,1"] },
];
const AI_CELLS = AI.flatMap((ship) => ship.cells.map((k) => k.split(",").map(Number)));

function winBattle() {
  B.setFleets(PLAYER, AI);
  B.startBattle();
  for (const [r, c] of AI_CELLS) B.fire(r, c);
  return B.stats.wins;
}

// ---------- A. Init, legacy migration, deterministic fleets ----------
{
  eq(B.stats.games, 0, "no battles counted yet");
  eq(B.stats.wins, 3, "legacy wins migrated");
  eq(storage.has("battleship-wins"), false, "legacy key removed");
  eq(B.stats.losses, 0, "no losses");
  eq(B.stats.streak, 0, "no streak");
  eq(B.stats.bestStreak, 0, "no best streak");
  eq(B.stats.shots, 0, "no shots");
  eq(B.stats.hits, 0, "no hits");
  eq(B.stats.sunk, 0, "no ships sunk");
  eq(B.stats.bestShots, 0, "no best win yet");
  eq(B.SIZE, 10, "ten by ten");
  eq(B.SHIP_DEFS.length, 5, "five ship classes");
  eq(B.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(B.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(B.phase, "setup", "starts in fleet placement");
  eq(B.paused, false, "not paused");
  eq(B.busy, false, "not busy");
  eq(B.playerFleet.length, 5, "a full player fleet");
  eq(B.aiFleet.length, 5, "a full enemy fleet");
  eq(B.playerFleet.map((s) => s.size).join(","), "5,4,3,3,2", "ship sizes");
  const playerCells = B.playerFleet.flatMap((s) => s.cells);
  const aiCells = B.aiFleet.flatMap((s) => s.cells);
  eq(playerCells.length, 17, "17 occupied cells");
  eq(new Set(playerCells).size, 17, "no overlapping player ships");
  eq(new Set(aiCells).size, 17, "no overlapping enemy ships");
  ok(
    playerCells.every((k) => {
      const [r, c] = B.parseKey(k);
      return r >= 0 && r < 10 && c >= 0 && c < 10;
    }),
    "every ship sits on the board"
  );
  eq(B.playerFleet.map((s) => s.cells.join("|")).join(";"), B.aiFleet.map((s) => s.cells.join("|")).join(";"), "the constant RNG mirrors both fleets");
  eq(elements.get("your-board").children.length, 100, "100 player cells rendered");
  eq(elements.get("enemy-board").children.length, 100, "100 enemy cells rendered");
  eq(enemyCell(0, 0).className.indexOf("bcell") !== -1, true, "cell class");
  eq(enemyCell(0, 0).disabled, true, "enemy cells are locked during setup");
  eq(elements.get("wins").textContent, 3, "wins HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("your-ships").textContent, 5, "your ships HUD");
  eq(elements.get("enemy-ships").textContent, 5, "enemy ships HUD");
  eq(elements.get("turn-label").textContent, "Place your fleet!", "setup prompt");
  eq(B.unlocked().length, 1, "legacy wins unlock the first badge");
  ok(B.unlocked().includes("first"), "First Victory unlocks from the legacy count");
  eq(elements.get("badge-count").textContent, 1, "header badge count");
  eq(B.overlayTitle(), null, "no overlay on load");
}

// ---------- B. Placing fleets and starting a battle ----------
{
  const set = B.setFleets(PLAYER, AI);
  eq(set.player.length, 1, "custom player fleet accepted");
  eq(set.ai.length, 5, "custom enemy fleet accepted");
  eq(B.phase, "setup", "setFleets returns to setup");
  eq(elements.get("your-ships").textContent, 1, "your ships HUD follows the fleet");
  eq(elements.get("enemy-ships").textContent, 5, "enemy ships HUD follows the fleet");
  eq(yourCell(9, 0).classList.contains("ship"), true, "your ship is drawn");
  eq(yourCell(0, 0).classList.contains("ship"), false, "empty water is not a ship");

  B.setCpuEnabled(false);
  eq(B.startBattle(), true, "the battle starts");
  eq(B.phase, "battle", "battle phase");
  eq(B.stats.games, 1, "the battle is counted");
  eq(B.turnLabel, "Your shot — fire away!", "turn prompt");
  eq(elements.get("turn-label").textContent, "Your shot — fire away!", "turn label updated");
  eq(elements.get("enemy-board").children[0].disabled, false, "enemy cells unlock in battle");
  eq(B.startBattle(), false, "the battle cannot start twice");
  eq(B.stats.games, 1, "no extra game counted");
}

// ---------- C. Firing, hits, misses and a first win ----------
{
  eq(B.fire(0, 0), true, "a shot fires");
  eq(B.playerShots.includes("0,0"), true, "the shot is recorded");
  eq(B.stats.shots, 1, "shot counted");
  eq(B.stats.hits, 1, "hit counted");
  eq(B.shotsThisGame, 1, "shot counted for the battle");
  eq(enemyCell(0, 0).classList.contains("hit"), true, "hit cell styled");
  eq(enemyCell(0, 0).textContent, "🔥", "hit shows a flame");
  eq(enemyCell(0, 0).disabled, true, "a spent cell locks");
  eq(B.fire(0, 0), false, "the same cell cannot be fired twice");
  eq(B.stats.shots, 1, "repeat shots are not counted");

  eq(B.fire(9, 9), true, "a miss fires");
  eq(B.stats.shots, 2, "miss counted as a shot");
  eq(B.stats.hits, 1, "miss is not a hit");
  eq(enemyCell(9, 9).classList.contains("miss"), true, "miss cell styled");
  eq(enemyCell(9, 9).textContent, "·", "miss shows a dot");

  // Sink the carrier (0,1 .. 0,4).
  for (let c = 1; c <= 4; c++) eq(B.fire(0, c), true, "carrier cell fires");
  eq(B.stats.sunk, 1, "the carrier is sunk");
  eq(B.stats.hits, 5, "every carrier cell counted as a hit");
  eq(elements.get("enemy-ships").textContent, 4, "enemy ship count drops");
  eq(B.aiFleet.filter((s) => s.sunk).length, 1, "the sunk flag is set");

  // Sink the rest.
  const remaining = [
    [1, 1], [1, 2], [1, 3], [1, 0],
    [2, 0], [2, 1], [2, 2],
    [3, 0], [3, 1], [3, 2],
    [4, 0], [4, 1],
  ];
  for (const [r, c] of remaining) {
    if (B.phase === "battle") B.fire(r, c);
  }
  eq(B.phase, "over", "the battle ends");
  eq(B.stats.wins, 4, "win counted on top of the legacy total");
  eq(B.stats.streak, 1, "streak starts");
  eq(B.stats.bestStreak, 1, "best streak tracks");
  eq(B.stats.shots, 18, "18 shots for the first win");
  eq(B.stats.hits, 17, "17 hits");
  eq(B.stats.sunk, 5, "all five ships sunk");
  eq(B.shotsThisGame, 18, "18 shots this battle");
  eq(B.stats.bestShots, 18, "best win recorded");
  eq(elements.get("wins").textContent, 4, "wins HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(elements.get("enemy-ships").textContent, 0, "enemy fleet is gone");
  eq(B.turnLabel, "Enemy fleet destroyed!", "turn label");
  eq(B.overlayTitle(), "Victory! 🎉", "win overlay");
  has(B.overlayMsg(), "18 shots", "overlay reports the shot count");
  has(B.overlayMsg(), "New best", "the first win is a record");
  ok(B.unlocked().includes("precise30"), "Sharpshooter unlocks");
  ok(B.unlocked().includes("precise22"), "Surgical Strike unlocks");
  eq(B.unlocked().length, 3, "three badges");
  eq(elements.get("badge-count").textContent, 3, "header badge count");

  eq(B.fire(0, 0), false, "firing is blocked after the battle");
  eq(B.cpuShot(9, 0), null, "the CPU cannot fire after the battle");
  eq(B.startBattle(), false, "a finished battle cannot restart");
  eq(B.setPaused(true), false, "a finished battle cannot pause");
}

// ---------- D. Play again resets to fleet placement ----------
{
  eq(B.reset(), true, "Play again resets");
  eq(B.phase, "setup", "back to placement");
  eq(B.busy, false, "not busy");
  eq(B.playerShots.length, 0, "player shots cleared");
  eq(B.aiShots.length, 0, "CPU shots cleared");
  eq(B.shotsThisGame, 0, "battle shot counter cleared");
  eq(B.overlayTitle(), null, "overlay closed");
  eq(elements.get("turn-label").textContent, "Place your fleet!", "placement prompt");
  eq(elements.get("your-ships").textContent, 5, "a fresh fleet is dealt");
  eq(elements.get("enemy-ships").textContent, 5, "a fresh enemy fleet is dealt");
  eq(B.stats.wins, 4, "wins survive a reset");
  eq(B.stats.bestShots, 18, "best win survives a reset");
  eq(B.reset(), true, "reset is idempotent");
}

// ---------- E. A cleaner second win ----------
{
  eq(winBattle(), 5, "a second battle wins");
  eq(B.stats.games, 2, "second battle counted");
  eq(B.stats.wins, 5, "fifth win");
  eq(B.stats.streak, 2, "streak of two");
  eq(B.stats.bestStreak, 2, "best streak of two");
  eq(B.stats.shots, 35, "17 more shots");
  eq(B.stats.hits, 34, "17 more hits");
  eq(B.stats.sunk, 10, "five more ships sunk");
  eq(B.stats.bestShots, 17, "a flawless win improves the record");
  has(B.overlayMsg(), "17 shots", "overlay reports the clean win");
  ok(B.unlocked().includes("win5"), "Task Force unlocks");
  ok(B.unlocked().includes("streak2"), "On a Roll unlocks");
  eq(B.unlocked().length, 5, "five badges");
}

// ---------- F. A loss ends the streak ----------
{
  B.setFleets(PLAYER, AI);
  eq(B.startBattle(), true, "a third battle starts");
  eq(B.stats.games, 3, "third battle counted");
  eq(B.cpuShot(9, 0), "hit", "the CPU hits your destroyer");
  eq(B.phase, "battle", "one ship cell is not a loss");
  eq(B.stats.hits, 34, "CPU hits do not pad your stats");
  eq(B.cpuShot(9, 1), "sunk", "the CPU sinks your last ship");
  eq(B.phase, "over", "the loss ends the battle");
  eq(B.stats.losses, 1, "loss counted");
  eq(B.stats.wins, 5, "wins unchanged");
  eq(B.stats.streak, 0, "the streak is broken");
  eq(B.stats.bestStreak, 2, "the best streak is kept");
  eq(B.overlayTitle(), "Defeated 🤖", "loss overlay");
  has(B.overlayMsg(), "sank your whole fleet", "loss message");
  eq(B.stats.bestShots, 17, "a loss does not touch the best win");
}

// ---------- G. Pause, blur, visibility and the badges modal ----------
{
  B.setFleets(PLAYER, AI);
  eq(B.startBattle(), true, "a fourth battle starts");
  eq(B.stats.games, 4, "fourth battle counted");

  keydown("Escape");
  eq(B.paused, true, "Escape pauses");
  eq(B.overlayTitle(), "Paused", "pause overlay");
  has(B.overlayMsg(), "on hold", "pause overlay explains");
  eq(B.fire(5, 5), false, "firing is blocked while paused");
  eq(B.startBattle(), false, "starting is blocked while paused");
  eq(B.reset(), false, "resetting is blocked while paused");

  keydown("p");
  eq(B.paused, false, "P resumes");
  eq(B.overlayTitle(), null, "pause overlay closed");

  keydown("Escape");
  eq(B.paused, true, "Escape pauses again");
  keydown("Escape");
  eq(B.paused, false, "Escape resumes");

  winEvent("blur");
  eq(B.paused, true, "window blur pauses");
  keydown("Escape");
  eq(B.paused, false, "Escape resumes after blur");

  visibility(true);
  eq(B.paused, true, "a hidden tab pauses");
  keydown("Escape");
  eq(B.paused, false, "resumed again");

  B.openAchv();
  eq(elements.get("achv-modal").hidden, false, "badges open");
  eq(B.paused, true, "opening the badges pauses");
  eq(elements.get("achv-count").textContent, "5 / 14", "modal count");
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  eq(B.paused, true, "the battle stays paused behind the modal");
  eq(B.overlayTitle(), "Paused", "pause overlay still up");
  keydown("Escape");
  eq(B.paused, false, "and Escape resumes");
}

// ---------- H. Badge grinds: streak, wins, games, hits and ships ----------
{
  // A loss reset the streak, so twenty straight wins build it back up.
  let guard = 0;
  while (B.stats.wins < 25 && guard++ < 40) winBattle();
  eq(B.stats.wins, 25, "twenty-five wins");
  eq(B.stats.games, 24, "twenty-four battles so far");
  eq(B.stats.streak, 20, "a twenty-win streak");
  eq(B.stats.bestStreak, 20, "best streak twenty");
  eq(B.stats.hits, 374, "374 hits");
  eq(B.stats.sunk, 110, "110 ships sunk");
  eq(B.stats.bestShots, 17, "the best win stays at 17 shots");
  ok(B.unlocked().includes("win10"), "Fleet Commander unlocks");
  ok(B.unlocked().includes("win25"), "Admiral unlocks");
  ok(B.unlocked().includes("games10"), "Ten Battles unlocks");
  ok(B.unlocked().includes("streak3"), "Hot Streak unlocks");
  ok(B.unlocked().includes("streak5"), "Unstoppable unlocks");
  ok(B.unlocked().includes("hits50"), "Marksman unlocks");
  ok(B.unlocked().includes("hits150"), "Deadeye unlocks");
  ok(B.unlocked().includes("sunk25"), "Shipbreaker unlocks");
  eq(B.unlocked().length, 13, "thirteen badges, games25 still locked");

  // One more battle start reaches 25 games.
  B.reset();
  B.startBattle();
  eq(B.stats.games, 25, "twenty-five battles");
  ok(B.unlocked().includes("games25"), "Veteran unlocks");
  eq(B.unlocked().length, 14, "all fourteen badges unlocked");
  eq(elements.get("badge-count").textContent, 14, "header badge count");
}

// ---------- I. Badges modal and records ----------
{
  B.openAchv();
  eq(elements.get("achv-modal").hidden, false, "modal opens");
  eq(elements.get("achv-count").textContent, "14 / 14", "modal shows all 14");
  eq(elements.get("achv-grid").innerHTML.length > 100, true, "badge grid rendered");
  const records = elements.get("achv-records").innerHTML;
  has(records, "Battles <b>25</b>", "battles record");
  has(records, "Wins <b>25</b>", "wins record");
  has(records, "Losses <b>1</b>", "losses record");
  has(records, "Streak <b>20</b>", "streak record");
  has(records, "Best streak <b>20</b>", "best streak record");
  has(records, "Best win <b>17 shots</b>", "best win record");
  B.closeAchv();
  eq(elements.get("achv-modal").hidden, true, "modal closes");
  eq(B.paused, true, "the battle stays paused behind the closed modal");
  B.setPaused(false);
  eq(B.paused, false, "resuming clears the pause");
  eq(B.overlayTitle(), null, "pause overlay closed");

  const expected = [
    "first", "win5", "win10", "win25", "games10", "games25",
    "streak2", "streak3", "streak5", "hits50", "hits150", "sunk25",
    "precise30", "precise22",
  ];
  const u = B.unlocked();
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badge ids", u);
  ok(storage.has("battleship-stats-v1"), "stats persisted");
  ok(storage.has("battleship-achv-v1"), "badges persisted");
  eq(storage.has("battleship-wins"), false, "legacy key stays removed");
}

// ---------- J. Buttons, real cell clicks, keyboard and sound ----------
{
  const games = B.stats.games;
  eq(B.startBattle(), false, "a battle in progress cannot restart");

  // End the in-progress battle so the placement controls come back.
  eq(B.endGame(false), true, "ending the battle manually works");
  eq(B.phase, "over", "the battle is over");
  eq(B.reset(), true, "reset works after the battle");
  eq(B.phase, "setup", "back to fleet placement");
  eq(B.playerFleet.length, 5, "a full fleet is dealt again");
  eq(B.stats.games, games, "resetting does not count a battle");

  elements.get("start-battle").dispatch("click");
  eq(B.phase, "battle", "the Start Battle button works");
  eq(B.stats.games, games + 1, "the button counts a battle");

  B.setCpuEnabled(false);
  const shotsBefore = B.stats.shots;
  enemyCell(6, 6).dispatch("click");
  eq(B.stats.shots, shotsBefore + 1, "clicking an enemy cell fires");
  eq(B.playerShots.includes("6,6"), true, "the click records the shot");

  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("battleship-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("battleship-sound"), "on", "preference restored");

  keydown("Escape");
  eq(B.paused, true, "keyboard pause");
  keydown("Escape");
  eq(B.paused, false, "keyboard resume");

  B.openAchv();
  keydown("Escape");
  eq(elements.get("achv-modal").hidden, true, "Escape closes the modal");
  keydown("Escape");
  eq(B.paused, false, "and resumes the battle");

  // Reset is blocked during a battle but allowed once it ends.
  eq(B.reset(), false, "reset is blocked during battle");
  B.endGame(false);
  eq(B.phase, "over", "the battle ends");
  eq(B.reset(), true, "reset works after the battle");
  eq(B.stats.games, games + 1, "resetting does not count a battle");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
