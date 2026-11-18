// Deterministic tests for games/blackjack/script.js
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
    dataset: {},
    style: {},
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
    closest() {
      return null;
    },
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
  "bank", "bet", "streak", "player-hand", "dealer-hand", "player-score", "dealer-score",
  "result", "bet-controls", "play-controls", "deal", "hit", "stand", "badges-btn",
  "badge-count", "sound-btn", "sound-icon", "badges2", "toasts", "achv-modal",
  "achv-grid", "achv-count", "achv-records",
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
  createDocumentFragment: () => makeEl("fragment"),
  querySelector: () => makeEl("div"),
  querySelectorAll: () => [],
  addEventListener: (t, fn) => {
    (listeners[t] || (listeners[t] = [])).push(fn);
  },
  removeEventListener() {},
};

let timerSeq = 0;
global.window = {
  innerWidth: 800,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener: (t, fn) => {
    (listeners["win:" + t] || (listeners["win:" + t] = [])).push(fn);
  },
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
try {
  eval(fs.readFileSync(root + "js/arcade-core.js", "utf8"));
  eval(fs.readFileSync(root + "games/blackjack/script.js", "utf8"));
} catch (err) {
  console.error("INIT ERROR:", (err && err.stack) || err);
  process.exit(1);
}

const T = global.window.__BLACKJACK;
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

const c = (r, s) => ({ r, s });

// Plays a full hand with a scripted deck. Returns the outcome.
function hand(seq, betAmt, opts) {
  if (betAmt) T.addBet(betAmt);
  T.rigDeck(seq.map(([r, s]) => c(r, s)));
  T.startRound();
  if (opts && opts.hit) T.hit();
  if (T.phase === "player") T.stand();
  if (T.phase === "dealer") T.advanceDealer();
  return T.lastOutcome;
}

function finishRound() {
  T.newRound();
}

// ---------- A. Init ----------
{
  eq(T.START_BANK, 100, "starting bankroll is 100");
  eq(T.phase, "betting", "starts in the betting phase");
  eq(T.bank, 100, "bankroll starts at 100");
  eq(T.bet, 0, "no bet placed");
  eq(T.stats.hands, 0, "no hands yet");
  eq(T.stats.wins, 0, "no wins yet");
  eq(T.stats.losses, 0, "no losses yet");
  eq(T.stats.pushes, 0, "no pushes yet");
  eq(T.stats.blackjacks, 0, "no blackjacks yet");
  eq(T.stats.busts, 0, "no busts yet");
  eq(T.stats.bestBank, 100, "peak bankroll is the starting stack");
  eq(T.stats.profit, 0, "no profit yet");
  eq(T.stats.streak, 0, "no streak");
  eq(elements.get("bank").textContent, 100, "bankroll HUD");
  eq(elements.get("bet").textContent, 0, "bet HUD");
  eq(elements.get("streak").textContent, 0, "streak HUD");
  eq(elements.get("player-hand").children.length, 0, "player hand empty");
  eq(elements.get("dealer-hand").children.length, 0, "dealer hand empty");
  eq(elements.get("player-score").textContent, "", "no player score");
  eq(elements.get("dealer-score").textContent, "", "no dealer score");
  eq(T.ACHIEVEMENTS.length, 14, "14 badge definitions");
  eq(new Set(T.ACHIEVEMENTS.map((a) => a.id)).size, 14, "badge ids are unique");
  eq(T.unlocked().length, 0, "no badges at start");
  eq(T.overlayTitle(), null, "no overlay at start");
  eq(elements.get("bet-controls").style.display, "flex", "bet controls visible");
  eq(elements.get("play-controls").style.display, "none", "play controls hidden");
}

// ---------- B. First win (dealer busts) ----------
{
  T.addBet(5);
  T.addBet(10);
  T.addBet(25);
  eq(T.bet, 40, "bets add up");
  eq(elements.get("bet").textContent, 40, "bet HUD follows");

  T.rigDeck([c("10", "♠"), c("9", "♥"), c("10", "♣"), c("6", "♦"), c("K", "♠")]);
  T.startRound();
  eq(T.phase, "player", "hand is live");
  eq(T.stats.hands, 1, "hand counted");
  eq(T.player.map((x) => x.r).join(""), "109", "player cards");
  eq(T.dealer.length, 2, "dealer has two cards");
  eq(elements.get("player-hand").children.length, 2, "two player cards rendered");
  eq(elements.get("dealer-hand").children.length, 2, "two dealer cards rendered");
  ok(elements.get("dealer-hand").children[1].classList.contains("bj-card--back"), "hole card hidden");
  eq(elements.get("player-score").textContent, 19, "player score shown");
  eq(elements.get("dealer-score").textContent, "10", "only the dealer's up card is scored");
  eq(elements.get("bet-controls").style.display, "none", "bet controls hidden during a hand");
  eq(elements.get("play-controls").style.display, "flex", "play controls shown");

  T.stand();
  eq(T.phase, "dealer", "standing hands over to the dealer");
  ok(!elements.get("dealer-hand").children[1].classList.contains("bj-card--back"), "hole card revealed");
  eq(T.advanceDealer(), true, "dealer finishes");
  eq(T.lastOutcome, "win", "dealer busts, player wins");
  eq(T.stats.wins, 1, "win counted");
  eq(T.stats.losses, 0, "no losses");
  eq(T.stats.streak, 1, "streak is 1");
  eq(T.stats.bestStreak, 1, "best streak is 1");
  eq(T.stats.profit, 40, "net profit");
  eq(T.bank, 140, "bankroll grows");
  eq(T.stats.bestBank, 140, "peak bankroll tracked");
  eq(elements.get("bank").textContent, 140, "bankroll HUD");
  eq(elements.get("streak").textContent, 1, "streak HUD");
  eq(T.overlayTitle(), "You win! 🎉", "win overlay");
  ok((T.overlayMsg() || "").indexOf("Bankroll: 140.") !== -1, "overlay shows the bankroll", T.overlayMsg());
  ok(T.unlocked().includes("first"), "First Win badge unlocks");
  eq(T.unlocked().length, 1, "one badge unlocked");
  eq(elements.get("badge-count").textContent, 1, "header count in sync");
  finishRound();
  eq(T.phase, "betting", "new round returns to betting");
  eq(T.bet, 0, "the bet resets");
  eq(T.overlayTitle(), null, "overlay closed");
  eq(elements.get("bank").textContent, 140, "bankroll kept for the next round");
}

// ---------- C. Natural blackjack ----------
{
  eq(hand([["A", "♠"], ["K", "♥"], ["9", "♣"], ["7", "♦"], ["5", "♥"]], 100), "blackjack", "natural 21 wins");
  eq(T.stats.blackjacks, 1, "blackjack counted");
  eq(T.stats.wins, 2, "second win");
  eq(T.stats.streak, 2, "streak is 2");
  eq(T.stats.profit, 190, "3:2 payout");
  eq(T.bank, 290, "bankroll after blackjack");
  eq(T.stats.bestBank, 290, "peak bankroll");
  eq(T.overlayTitle(), "Blackjack! 🂡", "blackjack overlay");
  ok((T.overlayMsg() || "").indexOf("3:2") !== -1, "payout explained", T.overlayMsg());
  ["bj1", "bank150", "bank250"].forEach((id) => ok(T.unlocked().includes(id), id + " badge unlocks"));
  eq(T.unlocked().length, 4, "four badges unlocked");
  eq(elements.get("badge-count").textContent, 4, "header count in sync");
  finishRound();
}

// ---------- D. Push ----------
{
  eq(hand([["10", "♠"], ["8", "♥"], ["10", "♣"], ["8", "♦"]], 10), "push", "equal totals push");
  eq(T.stats.pushes, 1, "push counted");
  eq(T.stats.streak, 0, "a push breaks the streak");
  eq(T.stats.profit, 190, "a push changes no money");
  eq(T.bank, 290, "bankroll unchanged");
  eq(T.overlayTitle(), "Push", "push overlay");
  finishRound();
}

// ---------- E. Bust ----------
{
  eq(hand([["10", "♠"], ["6", "♥"], ["10", "♣"], ["7", "♦"], ["K", "♠"]], 20, { hit: true }), "bust", "busts lose");
  eq(T.stats.busts, 1, "bust counted");
  eq(T.stats.losses, 1, "loss counted");
  eq(T.stats.streak, 0, "a bust breaks the streak");
  eq(T.stats.profit, 170, "loss deducted");
  eq(T.bank, 270, "bankroll after a bust");
  eq(T.overlayTitle(), "Bust 💥", "bust overlay");
  ok((T.overlayMsg() || "").indexOf("over 21") !== -1, "bust message", T.overlayMsg());
  finishRound();
}

// ---------- F. Dealer wins ----------
{
  eq(hand([["10", "♠"], ["9", "♥"], ["10", "♣"], ["K", "♦"]], 30), "lose", "a stronger dealer wins");
  eq(T.stats.losses, 2, "second loss");
  eq(T.stats.profit, 140, "loss deducted");
  eq(T.bank, 240, "bankroll after the loss");
  eq(T.overlayTitle(), "Dealer wins", "dealer overlay");
  finishRound();
}

// ---------- G. Five-win streak ----------
{
  for (let i = 0; i < 5; i++) {
    eq(hand([["10", "♠"], ["Q", "♥"], ["10", "♣"], ["9", "♦"]], 5), "win", "round " + (i + 1) + " wins");
    finishRound();
  }
  eq(T.stats.wins, 7, "seven wins");
  eq(T.stats.hands, 10, "ten hands");
  eq(T.stats.streak, 5, "five in a row");
  eq(T.stats.bestStreak, 5, "best streak is 5");
  eq(T.stats.profit, 165, "profit after the streak");
  eq(T.bank, 265, "bankroll after the streak");
  ["streak3", "streak5"].forEach((id) => ok(T.unlocked().includes(id), id + " badge unlocks"));
  eq(T.unlocked().length, 6, "six badges unlocked");
}

// ---------- H. Winning on exactly 21 ----------
{
  eq(hand([["7", "♠"], ["7", "♥"], ["10", "♣"], ["9", "♦"], ["7", "♦"]], 5, { hit: true }), "win", "three-card 21 wins");
  eq(T.stats.twentyOnes, 1, "exactly-21 win counted");
  eq(T.stats.wins, 8, "eighth win");
  eq(T.stats.bestStreak, 6, "best streak is 6");
  eq(T.stats.profit, 170, "profit");
  eq(T.bank, 270, "bankroll");
  ok(T.unlocked().includes("twentyone"), "Twenty-One badge unlocks");
  eq(T.unlocked().length, 7, "seven badges unlocked");
  finishRound();
}

// ---------- I. Ten wins ----------
{
  for (let i = 0; i < 2; i++) {
    eq(hand([["10", "♠"], ["Q", "♥"], ["10", "♣"], ["9", "♦"]], 5), "win", "win " + (i + 9));
    finishRound();
  }
  eq(T.stats.wins, 10, "ten wins");
  eq(T.stats.hands, 13, "thirteen hands");
  eq(T.stats.profit, 180, "profit");
  eq(T.bank, 280, "bankroll");
  ok(T.unlocked().includes("win10"), "Regular badge unlocks");
  eq(T.unlocked().length, 8, "eight badges unlocked");
}

// ---------- J. Pushes ----------
{
  for (let i = 0; i < 4; i++) {
    eq(hand([["10", "♠"], ["8", "♥"], ["10", "♣"], ["8", "♦"]], 5), "push", "push " + (i + 2));
    finishRound();
  }
  eq(T.stats.pushes, 5, "five pushes");
  eq(T.stats.hands, 17, "seventeen hands");
  eq(T.stats.streak, 0, "pushes reset the streak");
  eq(T.bank, 280, "pushes keep the bankroll");
  ok(T.unlocked().includes("push5"), "Push It badge unlocks");
  eq(T.unlocked().length, 9, "nine badges unlocked");
}

// ---------- K. Busts ----------
{
  for (let i = 0; i < 9; i++) {
    eq(hand([["10", "♠"], ["6", "♥"], ["10", "♣"], ["7", "♦"], ["K", "♠"]], 5, { hit: true }), "bust", "bust " + (i + 2));
    finishRound();
  }
  eq(T.stats.busts, 10, "ten busts");
  eq(T.stats.losses, 11, "eleven losses");
  eq(T.stats.hands, 26, "twenty-six hands");
  eq(T.stats.profit, 135, "profit after the busts");
  eq(T.bank, 235, "bankroll after the busts");
  ["bust10", "hands25"].forEach((id) => ok(T.unlocked().includes(id), id + " badge unlocks"));
  eq(T.unlocked().length, 11, "eleven badges unlocked");
}

// ---------- L. Twenty-five wins ----------
{
  for (let i = 0; i < 15; i++) {
    eq(hand([["10", "♠"], ["Q", "♥"], ["10", "♣"], ["9", "♦"]], 5), "win", "win " + (i + 11));
    finishRound();
  }
  eq(T.stats.wins, 25, "twenty-five wins");
  eq(T.stats.hands, 41, "forty-one hands");
  eq(T.stats.streak, 15, "streak of 15");
  eq(T.stats.bestStreak, 15, "best streak is 15");
  eq(T.stats.profit, 210, "profit");
  eq(T.bank, 310, "bankroll");
  ["win25", "profit200"].forEach((id) => ok(T.unlocked().includes(id), id + " badge unlocks"));
  eq(T.unlocked().length, 13, "thirteen badges unlocked");
}

// ---------- M. Five blackjacks ----------
{
  for (let i = 0; i < 4; i++) {
    eq(hand([["A", "♠"], ["K", "♥"], ["9", "♣"], ["7", "♦"], ["5", "♥"]], 5), "blackjack", "blackjack " + (i + 2));
    finishRound();
  }
  eq(T.stats.blackjacks, 5, "five blackjacks");
  eq(T.stats.wins, 29, "twenty-nine wins");
  eq(T.stats.hands, 45, "forty-five hands");
  eq(T.stats.profit, 238, "profit");
  eq(T.bank, 338, "bankroll");
  eq(T.stats.bestBank, 338, "peak bankroll");
  ok(T.unlocked().includes("bj5"), "Blackjack Artist badge unlocks");
  eq(T.unlocked().length, 14, "all fourteen badges unlocked");
}

// ---------- N. Bankruptcy ----------
{
  T.bank = 0;
  T.startRound();
  eq(T.bank, 100, "a fresh stack after going broke");
  eq(T.bet, 0, "the bet resets");
  eq(T.phase, "betting", "back to betting");
  eq(T.overlayTitle(), "Out of chips! 💸", "bankruptcy overlay");
  T.newRound();
  eq(T.overlayTitle(), null, "bankruptcy overlay closes");
}

// ---------- O. Pause ----------
{
  eq(hand([["10", "♠"], ["Q", "♥"], ["10", "♣"], ["9", "♦"]], 5), "win", "win before the pause tests");
  finishRound();
  eq(T.bank, 105, "bankroll after the last win");
  eq(T.stats.hands, 46, "forty-six hands");

  T.addBet(5);
  T.rigDeck([c("10", "♠"), c("Q", "♥"), c("10", "♣"), c("9", "♦")]);
  T.startRound();
  eq(T.phase, "player", "hand live");
  const cards = T.player.length;
  keydown("p");
  eq(T.paused, true, "P pauses");
  eq(T.overlayTitle(), "Paused", "pause overlay");
  T.hit();
  eq(T.player.length, cards, "hitting is blocked while paused");
  T.stand();
  eq(T.phase, "player", "standing is blocked while paused");
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

  T.stand();
  eq(T.advanceDealer(), true, "hand finishes after the pause");
  eq(T.lastOutcome, "win", "the held hand wins");
  eq(T.stats.wins, 31, "thirty-first win");
  eq(T.stats.streak, 21, "streak of 21");
  eq(T.stats.bestStreak, 21, "best streak is 21");
  eq(T.stats.profit, 248, "profit");
  eq(T.bank, 110, "bankroll");
  finishRound();

  const before = T.phase;
  T.setPaused(true);
  eq(T.paused, false, "betting cannot be paused");
  eq(T.phase, before, "phase unchanged");
}

// ---------- P. Sound toggle ----------
{
  const btn = elements.get("sound-btn");
  eq(btn.getAttribute("aria-pressed"), "true", "sound starts on");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "false", "sound muted after click");
  eq(storage.get("blackjack-sound"), "off", "sound preference persisted");
  eq(elements.get("sound-icon").textContent, "🔇", "icon shows muted");
  btn.dispatch("click");
  eq(btn.getAttribute("aria-pressed"), "true", "sound back on");
  eq(storage.get("blackjack-sound"), "on", "preference restored");
}

// ---------- Q. Badges modal ----------
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

  // Escape pauses during a live hand, and a solved/betting table ignores it.
  T.addBet(5);
  T.rigDeck([c("10", "♠"), c("Q", "♥"), c("10", "♣"), c("9", "♦")]);
  T.startRound();
  keydown("Escape");
  eq(T.paused, true, "Escape pauses a live hand");
  keydown("Escape");
  eq(T.paused, false, "Escape resumes");
  T.stand();
  T.advanceDealer();
  finishRound();
  keydown("Escape");
  eq(T.paused, false, "Escape is ignored while betting");
}

// ---------- R. Final tally ----------
{
  const u = T.unlocked();
  const expected = [
    "first", "win10", "win25", "streak3", "streak5", "bj1", "bj5", "push5",
    "hands25", "bust10", "bank150", "bank250", "profit200", "twentyone",
  ];
  ok(u.length === 14 && expected.every((id) => u.includes(id)), "all 14 badges unlocked", u);
  eq(T.stats.hands, 48, "hands");
  eq(T.stats.wins, 32, "wins");
  eq(T.stats.losses, 11, "losses");
  eq(T.stats.pushes, 5, "pushes");
  eq(T.stats.blackjacks, 5, "blackjacks");
  eq(T.stats.busts, 10, "busts");
  eq(T.stats.streak, 22, "current streak");
  eq(T.stats.bestStreak, 22, "best streak");
  eq(T.stats.profit, 253, "career profit");
  eq(T.stats.bestBank, 338, "peak bankroll");
  eq(T.stats.twentyOnes, 1, "three-card 21 wins");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
