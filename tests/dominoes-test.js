// Deterministic tests for games/dominoes/script.js.
const fs = require("fs");
const path = require("path");

const listeners = {};
const elements = new Map();
let timerId = 1;
const timers = new Map();

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

function makeCtx() {
  const grad = { addColorStop() {} };
  return {
    setTransform() {},
    save() {},
    restore() {},
    clearRect() {},
    translate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    setLineDash() {},
    createLinearGradient() {
      return grad;
    },
    createRadialGradient() {
      return grad;
    },
    measureText() {
      return { width: 10 };
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
}

function makeEl(id, tag = "div") {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    hidden: false,
    disabled: false,
    title: "",
    dataset: {},
    className: "",
    children: [],
    _listeners: {},
    _attrs: {},
    classList: makeClassList(),
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 100,
    width: 760,
    height: 420,
    style: {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      },
    },
    getContext() {
      return makeCtx();
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
    },
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    removeAttribute(k) {
      delete this._attrs[k];
    },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
    },
    remove() {},
    focus() {},
    closest(sel) {
      if (sel === ".domino-hand__tile") {
        return String(this.className).split(/\s+/).includes("domino-hand__tile") ? this : null;
      }
      return null;
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
    querySelector() {
      return makeEl("q", "div");
    },
    querySelectorAll() {
      return [];
    },
    setPointerCapture() {},
  };
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
  "game", "score", "ai-score", "best", "round", "target", "boneyard", "turn",
  "ends", "hint", "hand", "opp-hand", "opp-count", "opp-name", "end-choice",
  "pause", "badges-btn", "badge-count", "sound-btn", "sound-icon", "toasts",
  "achv-modal", "achv-grid", "achv-count", "achv-records", "restart", "badges2",
];
for (const id of ids) elements.set(id, makeEl(id));
elements.get("achv-modal").hidden = true;

const modeChips = ["classic", "allfives", "block", "daily"].map((m) => {
  const e = makeEl("mode-" + m, "button");
  e.dataset.mode = m;
  return e;
});
const diffChips = ["chill", "cunning", "ruthless"].map((d) => {
  const e = makeEl("diff-" + d, "button");
  e.dataset.diff = d;
  return e;
});

const body = makeEl("body", "body");
global.document = {
  body,
  documentElement: makeEl("html", "html"),
  hidden: false,
  getElementById: (id) => elements.get(id) || makeEl(id),
  createElement: (t) => makeEl("created-" + t, t),
  querySelector: (sel) => {
    if (sel === ".mode-chip") return modeChips[0];
    return makeEl("q");
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
};

global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
  setTimeout: (fn, ms) => {
    const id = timerId++;
    timers.set(id, { fn, ms });
    return id;
  },
  clearTimeout: (id) => timers.delete(id),
  AudioContext: undefined,
  webkitAudioContext: undefined,
};

global.setTimeout = global.window.setTimeout;
global.clearTimeout = global.window.clearTimeout;

global.getComputedStyle = () => ({
  getPropertyValue: (n) =>
    ({
      "--accent": "#5ad1b8",
      "--accent-2": "#ffd94d",
      "--accent-3": "#ff5ea8",
      "--danger": "#ff5b5b",
      "--text": "#f2f3f7",
      "--muted": "#9a9aa8",
    })[n] || "",
});

const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};

global.requestAnimationFrame = () => 1;

const repo = require("./_env").gameScript("dominoes");
let code = fs.readFileSync(repo, "utf8");
const CORE = require("./_env").CORE;
if (fs.existsSync(CORE)) code = fs.readFileSync(CORE, "utf8") + "\n" + code;

// Test hook now ships in the game source.

try {
  eval(code);
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__D;
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

function tile(a, b) {
  return T.ALL_TILES.find((t) => t.a === Math.min(a, b) && t.b === Math.max(a, b));
}
function setHand(you, ai, chain, opts = {}) {
  const s = T.state;
  s.mode = opts.mode || "classic";
  s.diff = opts.diff || "cunning";
  s.target = opts.target || 10000;
  s.score = { you: opts.youScore || 0, ai: opts.aiScore || 0 };
  s.chain = chain ? chain.map((t) => ({ a: t.a, b: t.b })) : [];
  s.hands = { you: you.slice(), ai: ai.slice() };
  s.boneyard = opts.boneyard ? opts.boneyard.slice() : [];
  s.turn = opts.turn || "you";
  s.status = "playing";
  s.paused = false;
  s.over = false;
  s.selected = null;
  s.consecutivePasses = 0;
  s.humanDraws = 0;
  s.humanPasses = 0;
  s.roundMoves = 0;
  s.maxDeficit = 0;
  s.lastPlaced = null;
  s.rng = opts.rng || Math.random;
  T.clearTimers();
  T.updateHUD();
}

// ---------- A. Tile set ----------
eq(T.ALL_TILES.length, 28, "double-six set has 28 tiles");
{
  const keys = new Set(T.ALL_TILES.map((t) => `${t.a}-${t.b}`));
  eq(keys.size, 28, "all tiles are unique");
  let bad = 0;
  for (const t of T.ALL_TILES) {
    if (t.a < 0 || t.a > 6 || t.b < 0 || t.b > 6 || t.a > t.b) bad++;
  }
  eq(bad, 0, "tile values are valid and normalised");
  eq(T.ALL_TILES.filter((t) => t.a === 0 && t.b === 0).length, 1, "one blank-blank tile");
  eq(T.ALL_TILES.filter((t) => t.a === 6 && t.b === 6).length, 1, "one double-six");
}

// ---------- B. Ends ----------
{
  eq(T.endsOf([]).left, null, "empty chain has no left end");
  eq(T.endsOf([]).right, null, "empty chain has no right end");
  deepEq(T.endsOf([{ a: 6, b: 6 }]), { left: 6, right: 6 }, "single double has both ends 6");
  deepEq(T.endsOf([{ a: 2, b: 5 }]), { left: 2, right: 5 }, "single tile ends");
  deepEq(
    T.endsOf([{ a: 2, b: 5 }, { a: 5, b: 3 }]),
    { left: 2, right: 3 },
    "chain ends after two tiles"
  );
}

// ---------- C. Orientation / legal moves ----------
{
  setHand([tile(2, 4), tile(3, 5)], [tile(1, 1)], [{ a: 2, b: 5 }]);
  deepEq(T.orientFor(tile(3, 5), "right", T.state.chain), { a: 5, b: 3 }, "flip to play on right");
  deepEq(T.orientFor(tile(2, 4), "left", T.state.chain), { a: 4, b: 2 }, "flip to play on left");
  eq(T.orientFor(tile(1, 1), "left", T.state.chain), null, "non-matching tile cannot play left");
  eq(T.orientFor(tile(1, 1), "right", T.state.chain), null, "non-matching tile cannot play right");

  const moves = T.legalMoves("you");
  eq(moves.length, 2, "two legal moves from this hand");
  ok(moves.every((m) => m.side === "left" || m.side === "right"), "moves have a side");
}

// ---------- D. All Fives scoring ----------
{
  setHand([tile(5, 5), tile(0, 1)], [tile(2, 3)], [], { mode: "allfives", target: 10000 });
  T.playTile("you", tile(5, 5), "start");
  eq(T.state.score.you, 10, "double-five opens for 10 in All Fives");
  eq(T.stats.allFivesPoints, 10, "All Fives points tracked");
}
{
  setHand([tile(6, 4), tile(0, 1)], [tile(2, 3)], [], { mode: "allfives", target: 10000 });
  T.playTile("you", tile(6, 4), "start");
  eq(T.state.score.you, 10, "6-4 opens for 10 in All Fives");
}
{
  setHand([tile(2, 3), tile(0, 1)], [tile(1, 2)], [], { mode: "allfives", target: 10000 });
  T.playTile("you", tile(2, 3), "start");
  eq(T.state.score.you, 5, "2-3 opens for 5 in All Fives");
}
{
  setHand([tile(1, 2), tile(0, 1)], [tile(1, 2)], [], { mode: "allfives", target: 10000 });
  T.playTile("you", tile(1, 2), "start");
  eq(T.state.score.you, 0, "3 does not score in All Fives");
}

// ---------- E. Round end by domino ----------
{
  setHand([tile(3, 4)], [tile(1, 2), tile(5, 6)], [], { mode: "classic", target: 10000 });
  T.playTile("you", tile(3, 4), "start");
  const s = T.snap();
  eq(s.status, "roundOver", "emptying your hand ends the round");
  eq(s.score.you, 14, "winner scores opponent pips (1+2+5+6)");
  eq(s.stats.roundsWon, 1, "round win counted");
  eq(s.unlocked.includes("domino"), true, "Domino! badge unlocked");
  eq(s.overlayTitle, "Domino! 🎉", "domino overlay shown");
}

// ---------- F. Blocked round ----------
{
  setHand([tile(1, 2)], [tile(3, 4)], [{ a: 0, b: 0 }], { mode: "classic", target: 10000 });
  T.passTurn("you");
  eq(T.state.consecutivePasses, 1, "one pass recorded");
  eq(T.state.turn, "ai", "turn passes to computer");
  T.passTurn("ai");
  const s = T.snap();
  eq(s.status, "roundOver", "two passes block the round");
  eq(s.score.you, 7, "lowest pip hand wins the blocked round (3 vs 7)");
  eq(s.stats.blockedWins, 1, "blocked win counted");
  eq(s.overlayTitle, "Blocked!", "blocked overlay shown");
}

// ---------- G. Blocked tie ----------
{
  setHand([tile(1, 2)], [tile(1, 2)], [{ a: 0, b: 0 }], { mode: "block", target: 10000 });
  T.passTurn("you");
  T.passTurn("ai");
  const s = T.snap();
  eq(s.status, "roundOver", "tied block ends the round");
  eq(s.score.you, 0, "tied block awards no points");
  eq(s.overlayMsg.indexOf("Both players hold 3 pips"), 0, "tie message shown", s.overlayMsg);
}

// ---------- H. AI move selection ----------
{
  setHand([tile(1, 2)], [tile(2, 3), tile(5, 6), tile(1, 1)], [{ a: 2, b: 5 }], {
    mode: "classic",
    diff: "cunning",
    rng: () => 0.5,
  });
  const moves = T.legalMoves("ai");
  const move = T.chooseAiMove(moves);
  ok(!!move, "cunning AI returns a move");
  ok(move.side === "left" || move.side === "right", "AI move has a side");
  ok(T.state.hands.ai.includes(move.tile), "AI move uses a tile in its hand");
  ok(!!T.orientFor(move.tile, move.side, T.state.chain), "AI move is legal");
}
{
  setHand([tile(1, 2)], [tile(2, 3), tile(5, 6)], [{ a: 2, b: 5 }], {
    mode: "classic",
    diff: "chill",
    rng: () => 0.5,
  });
  const move = T.chooseAiMove(T.legalMoves("ai"));
  ok(!!move, "chill AI returns a move");
}
{
  setHand([tile(1, 2)], [tile(2, 3), tile(5, 6)], [{ a: 2, b: 5 }], {
    mode: "classic",
    diff: "ruthless",
    rng: () => 0.5,
  });
  const move = T.chooseAiMove(T.legalMoves("ai"));
  ok(!!move, "ruthless AI returns a move");
}

// ---------- I. Canvas layout ----------
{
  setHand([], [], [], { mode: "classic" });
  T.state.chain = T.ALL_TILES.map((t) => ({ a: t.a, b: t.b }));
  const items = T.layoutChain();
  eq(items.length, 28, "all 28 tiles lay out");
  let out = 0;
  let overlap = 0;
  for (const it of items) {
    if (it.x < 0 || it.x + it.w > T.CW || it.top < 0 || it.top + it.h > T.CH) out++;
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.top < b.top + b.h && a.top + a.h > b.top) overlap++;
    }
  }
  eq(out, 0, "every tile is inside the canvas");
  eq(overlap, 0, "no two tiles overlap");
  T.draw(1000);
  ok(true, "drawing a full chain does not throw");
}

// ---------- J. SVG rendering ----------
{
  const blank = T.tileSVG(0, 0);
  eq((blank.match(/<circle/g) || []).length, 0, "0-0 has no pips");
  const six = T.tileSVG(6, 6);
  eq((six.match(/<circle/g) || []).length, 12, "6-6 has twelve pips");
  const mixed = T.tileSVG(2, 5);
  eq((mixed.match(/<circle/g) || []).length, 7, "2-5 has seven pips");
  ok(mixed.indexOf("<svg") === 0, "tile SVG starts with an svg tag");
}

// ---------- K. Daily determinism ----------
{
  T.setMode("daily", true);
  const first = T.snap().hand.map((t) => `${t.a}-${t.b}`).join(",");
  T.reset();
  const second = T.snap().hand.map((t) => `${t.a}-${t.b}`).join(",");
  eq(second, first, "daily deal is deterministic across restarts");
  eq(T.state.mode, "daily", "daily mode active");
}

// ---------- L. All Fives match end ----------
{
  setHand([tile(5, 5), tile(0, 1)], [tile(2, 3)], [], {
    mode: "allfives",
    target: 20,
    youScore: 15,
  });
  T.playTile("you", tile(5, 5), "start");
  const s = T.snap();
  eq(s.score.you, 25, "All Fives points push you over the target");
  eq(s.status, "matchOver", "match ends immediately in All Fives");
  eq(s.over, true, "over flag set");
  eq(s.stats.gamesWon, 1, "match win counted");
  eq(s.overlayTitle, "You win the match! 🎉", "match overlay shown");
}

// ---------- M. Match end by round score ----------
{
  setHand([tile(3, 4)], [tile(1, 2)], [], { mode: "classic", target: 10, youScore: 5 });
  T.playTile("you", tile(3, 4), "start");
  const s = T.snap();
  eq(s.score.you, 8, "round points added");
  eq(s.status, "roundOver", "round ends below target");
  T.state.score.you = 10;
  T.state.status = "playing";
  T.state.hands = { you: [tile(3, 4)], ai: [tile(1, 2)] };
  T.state.chain = [];
  T.playTile("you", tile(3, 4), "start");
  const s2 = T.snap();
  eq(s2.status, "matchOver", "reaching the target ends the match");
  eq(s2.over, true, "match over flag set");
}

// ---------- N. Draw until playable ----------
{
  setHand([tile(1, 2)], [tile(3, 4)], [{ a: 0, b: 0 }], {
    mode: "classic",
    boneyard: [tile(5, 6), tile(2, 3)],
  });
  const drawn = T.drawUntilPlayable("you");
  eq(drawn, 2, "draws every tile when none of them fit");
  eq(T.state.hands.you.length, 3, "drawn tiles added to hand");
  eq(T.state.boneyard.length, 0, "boneyard emptied");
}
{
  setHand([tile(1, 2)], [tile(3, 4)], [{ a: 0, b: 0 }], {
    mode: "classic",
    boneyard: [tile(1, 6), tile(0, 1)],
  });
  const drawn = T.drawUntilPlayable("you");
  eq(drawn, 1, "stops as soon as a playable tile is drawn");
  eq(T.state.hands.you.length, 2, "one tile added to hand");
  eq(T.state.boneyard.length, 1, "boneyard keeps the rest");
}

// ---------- O. Stats / achievements / persistence ----------
{
  T.setMode("classic", true);
  eq(!!storage.get("dominoes-stats-v1"), true, "stats persisted");
  eq(!!storage.get("dominoes-achv-v1"), true, "achievements persisted");
  eq(T.snap().unlocked.includes("first_round"), true, "first round badge stays unlocked");
  eq(T.snap().unlocked.includes("nodraw"), true, "no-draw badge unlocked");
  eq(T.snap().unlocked.includes("nopass"), true, "no-pass badge unlocked");
  ok(storage.has("dominoes-best-v1-classic"), "best score persisted per mode");
}

// ---------- P. Stress: play many rounds ----------
{
  T.setMode("classic", true);
  T.state.target = 100000;
  let rounds = 0;
  let steps = 0;
  while (rounds < 8 && steps < 3000) {
    steps++;
    const s = T.snap();
    if (s.status === "roundOver") {
      rounds++;
      T.startRound();
      continue;
    }
    if (s.status === "matchOver") break;
    if (s.turn === "you") {
      const moves = T.legalMoves("you");
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        T.playTile("you", m.tile, m.side);
      } else {
        T.passTurn("you");
      }
    } else {
      const moves = T.legalMoves("ai");
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        T.playTile("ai", m.tile, m.side);
      } else {
        T.passTurn("ai");
      }
    }
  }
  ok(steps < 3000, "stress run terminated without an infinite loop", { steps, rounds });
  ok(rounds >= 1, "stress run completed at least one round", { rounds });
  const chain = T.state.chain;
  let badEnds = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    if (chain[i].b !== chain[i + 1].a) badEnds++;
  }
  eq(badEnds, 0, "chain joins always match");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);