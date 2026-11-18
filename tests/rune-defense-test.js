// Deterministic tests for games/rune-defense/script.js
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
    getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 400 }; },
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

function makeCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {},
    fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    fillText() {}, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() {}, setTransform() {},
  };
}

const ids = [
  "game", "gold", "lives", "wave", "speed", "palette", "start-wave", "speed-btn", "upgrade",
  "sell", "restart", "badges-btn", "badge-count", "badges2", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records",
];
for (const id of ids) elements.set(id, makeEl(id === "game" ? "canvas" : "div", id));
const canvasEl = elements.get("game");
canvasEl.width = 640;
canvasEl.height = 400;
canvasEl.getContext = () => makeCtx();
elements.get("achv-modal").hidden = true;

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl("div", id),
  createElement: (t) => makeEl(t),
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  querySelector: (sel) => (sel === ".overlay .btn" ? makeEl("button") : makeEl("div")),
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); },
  removeEventListener() {},
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
  eval(fs.readFileSync(root + "games/rune-defense/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}
const initMs = Date.now() - t0;

const T = global.window.__RUNE_DEFENSE;
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
function frames(n, ms) { for (let i = 0; i < n; i++) T.update(ms === undefined ? 50 : ms); }
function spawn(type) {
  T.spawnEnemy(type);
  const list = T.rawEnemies();
  return list[list.length - 1];
}

T.overlay.hide();

// ---------- A. Init ----------
{
  eq(T.COLS, 16, "16 columns");
  eq(T.ROWS, 10, "10 rows");
  eq(T.CELL, 40, "40px cells");
  eq(T.W, 640, "canvas width");
  eq(T.H, 400, "canvas height");
  eq(T.MAX_WAVE, 15, "15 waves");
  eq(T.WAVES.length, 15, "15 wave definitions");
  eq(T.gold, T.START_GOLD, "starting gold");
  eq(T.lives, T.START_LIVES, "starting lives");
  eq(T.wave, 0, "no wave yet");
  eq(T.gameState, "build", "starts in the build phase");
  eq(T.towers.length, 0, "no towers yet");
  eq(Object.keys(T.TOWER_TYPES).length, 8, "eight tower types");
  eq(Object.keys(T.ENEMY_TYPES).length, 8, "eight enemy types");
  eq(elements.get("palette").children.length, 8, "eight tower buttons in the palette");
  eq(elements.get("game").width, 640, "canvas width attribute");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  const bid = T.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(bid).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(storage.has("rune-defense-stats-v1"), true, "stats persisted under the core key");
}

// ---------- B. Buildable cells ----------
{
  let grass = 0;
  let path = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 16; c++) {
      if (T.isBuildable(c, r)) grass++;
      else path++;
    }
  }
  eq(grass + path, 160, "every cell is either buildable or path");
  ok(grass > 80, "plenty of buildable grass");
  eq(T.isBuildable(-1, 1), false, "off-board cells are not buildable");
  eq(T.isBuildable(3, 1), false, "path cells are not buildable");
}

// ---------- C. Wave composition ----------
{
  let allNonEmpty = true;
  for (const w of T.WAVES) if (!w.length) allNonEmpty = false;
  eq(allNonEmpty, true, "every wave has enemies");
  eq(T.WAVES[0].length, 8, "wave 1 has eight goblins");
  ok(T.WAVES[0].every((t) => t === "goblin"), "wave 1 is all goblins");
  eq(T.WAVES[14].indexOf("boss") >= 0, true, "wave 15 includes the boss");
  for (let i = 0; i < 14; i++) {
    eq(T.WAVES[i].indexOf("boss"), -1, "wave " + (i + 1) + " has no boss");
  }
  ok(T.WAVES[14].length > T.WAVES[0].length, "the final wave is the biggest");
}

// ---------- D. Placing towers ----------
{
  T.newGame();
  T.setGold(9999);
  const gold0 = T.gold;
  eq(T.placeTower(0, 0, "arrow"), true, "a tower can be built on grass");
  eq(T.gold, gold0 - T.TOWER_TYPES.arrow.cost, "gold was spent");
  eq(T.towers.length, 1, "one tower exists");
  eq(T.stats.towersBuilt >= 1, true, "tower build counted");

  eq(T.placeTower(0, 0, "arrow"), false, "cannot build on an occupied cell");
  eq(T.placeTower(3, 1), false, "cannot build on the path");
  eq(T.placeTower(2, 1), false, "cannot build on another path cell");

  T.setGold(0);
  eq(T.placeTower(0, 1, "arrow"), false, "cannot build without gold");
}

// ---------- E. Upgrade and sell ----------
{
  T.newGame();
  T.setGold(9999);
  eq(T.placeTower(0, 0, "arrow"), true, "tower placed");
  T.setSelected(0);
  const gold0 = T.gold;
  const cost = Math.round(T.TOWER_TYPES.arrow.cost * 0.8 * 1);
  T.upgradeSelected();
  eq(T.towers[0].level, 2, "tower upgraded to level 2");
  eq(T.gold, gold0 - cost, "upgrade cost deducted");
  eq(T.towers[0].damage > T.TOWER_TYPES.arrow.damage, true, "upgrade increased damage");

  const gold1 = T.gold;
  T.sellSelected();
  eq(T.towers.length, 0, "tower sold");
  eq(T.gold > gold1, true, "selling refunds gold");
}

// ---------- F. Start a wave ----------
{
  T.newGame();
  T.startWave();
  eq(T.wave, 1, "wave counter advanced");
  eq(T.gameState, "wave", "state is wave");
  T.update(100);
  eq(T.enemies.length >= 1, true, "an enemy spawned");
  T.startWave();
  eq(T.wave, 1, "cannot start a wave twice");
}

// ---------- G. Enemies move along the path ----------
{
  T.newGame();
  T.setWave(1);
  const e = spawn("goblin");
  const x0 = e.x;
  for (let i = 0; i < 10; i++) T.update(50);
  ok(e.x !== x0 || e.seg > 0, "the enemy moved along the path");
}

// ---------- H. Arrow tower kills ----------
{
  T.newGame();
  T.setWave(1);
  T.setGold(9999);
  eq(T.placeTower(1, 0, "arrow"), true, "arrow tower placed near the path");
  spawn("goblin");
  let killed = false;
  for (let i = 0; i < 600 && !killed; i++) {
    T.update(50);
    if (T.stats.kills > 0) killed = true;
  }
  ok(killed, "the arrow tower destroyed an enemy");
}

// ---------- I. Frost slows ----------
{
  T.newGame();
  T.setWave(1);
  T.setGold(9999);
  eq(T.placeTower(0, 0, "frost"), true, "frost tower placed");
  const e = spawn("goblin");
  let slowed = false;
  for (let i = 0; i < 40 && !slowed; i++) {
    T.update(50);
    if (e.slowUntil > T.time) slowed = true;
  }
  ok(slowed, "frost applied a slow");
  ok(e.slowFactor < 1, "the slow factor is below 1");
}

// ---------- J. Venom poisons (damage over time) ----------
{
  T.newGame();
  T.setWave(1);
  T.setGold(9999);
  eq(T.placeTower(0, 0, "venom"), true, "venom tower placed");
  const e = spawn("goblin");
  let poisoned = false;
  for (let i = 0; i < 40 && !poisoned; i++) {
    T.update(50);
    if (e.poisonUntil > T.time && e.poisonDps > 0) poisoned = true;
  }
  ok(poisoned, "venom applied poison");

  // Poison should keep ticking after the projectile is gone.
  T.clearEnemies();
  const e2 = spawn("goblin");
  e2.hp = 5;
  e2.poisonUntil = T.time + 4;
  e2.poisonDps = 100;
  const kills0 = T.stats.kills;
  T.update(100);
  eq(e2.dead, true, "poison damage over time killed the enemy");
  ok(T.stats.kills > kills0, "the poison kill was counted");
}

// ---------- K. Flame burns and splashes ----------
{
  T.newGame();
  T.setWave(1);
  T.setGold(9999);
  eq(T.placeTower(0, 0, "flame"), true, "flame tower placed");
  const e = spawn("goblin");
  let burned = false;
  for (let i = 0; i < 40 && !burned; i++) {
    T.update(50);
    if (e.burnUntil > T.time && e.burnDps > 0) burned = true;
  }
  ok(burned, "flame applied burn");
}

// ---------- L. Lightning chains ----------
{
  T.newGame();
  T.setWave(1);
  T.setGold(9999);
  eq(T.placeTower(2, 0, "lightning"), true, "lightning tower placed");
  T.clearEnemies();
  const a = spawn("goblin");
  const b = spawn("goblin");
  const c = spawn("goblin");
  for (const e of [a, b, c]) {
    e.hp = 9999;
    e.maxHp = 9999;
    e.speed = 0;
    e.seg = 1;
  }
  a.x = 100; a.y = 60;
  b.x = 140; b.y = 60;
  c.x = 100; c.y = 100;

  let maxBeams = 0;
  for (let i = 0; i < 30; i++) {
    T.update(50);
    if (T.beams > maxBeams) maxBeams = T.beams;
  }
  ok(maxBeams > 0, "chain lightning produced beams");
  const damaged = [a, b, c].filter((e) => e.hp < e.maxHp).length;
  eq(damaged, 3, "the primary and both chained enemies took damage");
}

// ---------- M. Shields absorb damage ----------
{
  T.newGame();
  T.setWave(1);
  T.clearEnemies();
  const w = spawn("wraith");
  eq(w.shield, 60, "wraiths spawn with a shield");
  const hp0 = w.hp;
  T.damageEnemy(w, 30, null);
  eq(w.shield, 30, "the shield absorbed 30 damage");
  eq(w.hp, hp0, "no health lost while the shield holds");
  T.damageEnemy(w, 40, null);
  eq(w.shield, 0, "the shield is depleted");
  eq(w.hp, hp0 - 10, "overflow damage reached health");
}

// ---------- N. Healers heal nearby allies ----------
{
  T.newGame();
  T.setWave(1);
  T.clearEnemies();
  const h = spawn("healer");
  const g = spawn("goblin");
  h.speed = 0; g.speed = 0;
  h.x = 100; h.y = 60;
  g.x = 140; g.y = 60;
  g.hp = g.maxHp - 50;
  const hp0 = g.hp;
  T.setTime(0);
  T.update(100);
  ok(g.hp > hp0, "the healer restored health to a nearby ally");
}

// ---------- O. Berserkers enrage when wounded ----------
{
  T.newGame();
  T.setWave(1);
  T.clearEnemies();
  const calm = spawn("berserker");
  const rage = spawn("berserker");
  for (const e of [calm, rage]) {
    e.speed = 1;
    e.slowUntil = 0;
    e.slowFactor = 1;
    e.seg = 0;
    e.x = -20;
    e.y = 60;
  }
  calm.hp = calm.maxHp;
  rage.hp = rage.maxHp * 0.5;
  const calmX = calm.x;
  const rageX = rage.x;
  T.moveEnemy(calm, 0.1);
  T.moveEnemy(rage, 0.1);
  const calmDist = Math.abs(calm.x - calmX);
  const rageDist = Math.abs(rage.x - rageX);
  ok(rageDist > calmDist * 1.4, "the wounded berserker moved faster");
}

// ---------- P. Reaching the base costs lives ----------
{
  T.newGame();
  T.setLives(20);
  const g = spawn("goblin");
  T.reachBase(g);
  eq(T.lives, 19, "a goblin costs one life");

  const boss = spawn("boss");
  T.reachBase(boss);
  eq(T.lives, 9, "the boss costs ten lives");
}

// ---------- Q. Losing ----------
{
  T.newGame();
  T.setLives(1);
  const g = spawn("goblin");
  T.reachBase(g);
  eq(T.gameState, "over", "losing all lives ends the game");
  ok(T.overlayTitle().indexOf("fallen") >= 0, "loss overlay shown");
}

// ---------- R. Winning and boss kill ----------
{
  T.newGame();
  T.setWave(15);
  T.stats.wins = 0;
  T.stats.bossKills = 0;
  const boss = spawn("boss");
  T.killEnemy(boss);
  eq(T.stats.bossKills, 1, "defeating the boss is recorded");
  T.endGame(true);
  eq(T.gameState, "win", "winning sets the win state");
  eq(T.stats.wins, 1, "the win is recorded");
  eq(T.stats.bestWave, 15, "best wave recorded");
  ok(T.overlayTitle().indexOf("held") >= 0, "win overlay shown");
  T.newGame();
}

// ---------- S. Badge thresholds ----------
{
  T.stats.games = 10;
  T.stats.wins = 5;
  T.stats.bestWave = 15;
  T.stats.kills = 500;
  T.stats.towersBuilt = 15;
  T.stats.totalGold = 1000;
  T.stats.flawlessWins = 1;
  T.stats.bossKills = 1;
  T.stats.bestGold = 500;
  T.saveStats();
  T.checkAchievements();
  const u = T.unlocked();
  for (const id of ["first", "games10", "win1", "win5", "wave5", "wave10", "wave15", "kills100", "kills500", "towers15", "gold1000", "flawless", "boss1", "rich"]) {
    ok(u.includes(id), id + " unlocks at its threshold");
  }
  eq(u.length, 14, "all 14 badges unlocked");
}

// ---------- T. Speed toggle ----------
{
  T.newGame();
  const before = T.speed;
  elements.get("speed-btn").dispatch("click");
  eq(T.speed, before === 1 ? 2 : 1, "speed toggles");
}

// ---------- U. Pause ----------
{
  T.newGame();
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay shown");
  const t0 = T.time;
  T.update(500);
  eq(T.time, t0, "time is frozen while paused");
  T.togglePause();
  eq(T.paused, false, "resume clears the pause");

  winEvent("blur");
  eq(T.paused, true, "window blur pauses");
  T.togglePause();
  document.hidden = true;
  (listeners["visibilitychange"] || []).forEach((fn) => fn({}));
  document.hidden = false;
  eq(T.paused, true, "tab hidden pauses");
  T.togglePause();
}

// ---------- V. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("rune-defense-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
}

// ---------- W. Badges modal ----------
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

// ---------- X. Restart ----------
{
  T.newGame();
  T.setGold(1);
  T.setLives(1);
  T.setWave(5);
  elements.get("restart").dispatch("click");
  eq(T.gold, T.START_GOLD, "restart restores gold");
  eq(T.lives, T.START_LIVES, "restart restores lives");
  eq(T.wave, 0, "restart resets the wave");
  eq(T.gameState, "build", "restart returns to build");
  eq(T.towers.length, 0, "restart clears towers");
}

console.log(`${pass} passed, ${fail} failed`);
console.log(`  init: ${initMs}ms`);
process.exit(fail ? 1 : 0);