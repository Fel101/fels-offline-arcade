// Video Poker (Jacks or Better) — pure vanilla JS, fully offline.
// Hold cards, draw, and reach the target bankroll before going broke.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    audio,
    toast,
    overlay,
    confetti,
    badges: badgesApi,
    modal: modalApi,
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const handEl = dom.byId("hand");
  const bankrollEl = dom.byId("bankroll");
  const betEl = dom.byId("bet");
  const targetEl = dom.byId("target");
  const messageEl = dom.byId("message");
  const paytableEl = dom.byId("paytable");
  const actionBtn = dom.byId("action-btn");
  const newGameBtn = dom.byId("new-game");
  const hintEl = dom.byId("hint");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  // ---------- Constants ----------
  const START_BANKROLL = 100;
  const BET = 5;
  const TARGET = 300;
  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
  const HINT_DEFAULT =
    "Click cards to hold them, then Draw. Reach 300 credits before you go broke.";

  // Display order for the paytable strip (matches evaluateHand payouts).
  const PAYTABLE = [
    { key: "jacks-or-better", name: "Jacks or Better", mult: 2 },
    { key: "two-pair", name: "Two Pair", mult: 3 },
    { key: "three-kind", name: "Three of a Kind", mult: 5 },
    { key: "straight", name: "Straight", mult: 6 },
    { key: "flush", name: "Flush", mult: 8 },
    { key: "full-house", name: "Full House", mult: 12 },
    { key: "four-kind", name: "Four of a Kind", mult: 30 },
    { key: "straight-flush", name: "Straight Flush", mult: 60 },
    { key: "royal", name: "Royal Flush", mult: 250 },
  ];

  const K = makeKeys("video-poker");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    bestBankroll: 0, // highest bankroll reached in a session
    hands: 0, // hands played (draws)
    biggestWin: 0, // largest single payout
    royals: 0,
    fourKinds: 0,
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  function migrateLegacy() {
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Reach the target bankroll.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Reach the target 5 times.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Reach the target 10 times.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Reach the target 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Reach the target 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Reach the target 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "royal1", icon: "👑", name: "Royal", desc: "Hit a royal flush.", stat: "royals", goal: 1 },
    { id: "fourKind5", icon: "🍀", name: "Quads", desc: "Hit four of a kind 5 times.", stat: "fourKinds", goal: 5 },
    { id: "bigWin100", icon: "💰", name: "Big Win", desc: "Win 100+ credits in one hand.", stat: "biggestWin", goal: 100 },
    { id: "hands100", icon: "🃏", name: "Card Sharp", desc: "Play 100 hands.", stat: "hands", goal: 100 },
    { id: "high500", icon: "🏦", name: "High Roller", desc: "Reach 500 credits in a session.", stat: "bestBankroll", goal: 500 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Go broke 10 times — keep trying!", stat: "losses", goal: 10 },
  ];

  // ---------- Badges UI ----------
  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => stats[key] || 0,
    onUnlock: () => {
      updateBadgeCount();
      saveStats();
    },
    onRender: () => {
      if (!achvModal.hidden) renderAchvGrid();
    },
  });

  function checkAchievements() {
    achv.check();
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Hands", stats.hands],
        ["Biggest win", stats.biggestWin],
        ["Best bankroll", stats.bestBankroll],
        ["Royals", stats.royals],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
    },
    onClose: () => {
      const target = overlay.isOpen() ? document.querySelector(".overlay .btn") : badgesBtn;
      if (target && target.focus) target.focus();
    },
  });

  function openAchv() {
    achvModalCtl.open();
  }

  function closeAchv() {
    achvModalCtl.close();
  }

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });

  // ---------- State ----------
  let bankroll = START_BANKROLL;
  let bet = BET;
  let phase = "bet"; // "bet" | "hold" | "result"
  let hand = []; // 5 card objects or fewer before a deal
  let held = [false, false, false, false, false];
  let deck = [];
  let deckPos = 0;
  let lastResult = null;
  let lastPayout = 0;
  let gameOver = false;
  let paused = false;
  let rng = Math.random;

  function freshDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = d[i];
      d[i] = d[j];
      d[j] = tmp;
    }
    return d;
  }

  // ---------- Hand evaluation ----------
  function evaluateHand(cards) {
    const ranks = cards.map((c) => c.r).sort((a, b) => a - b);
    const suits = cards.map((c) => c.s);
    const counts = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    const groups = Object.keys(counts)
      .map((k) => counts[k])
      .sort((a, b) => b - a);

    const flush = suits.every((s) => s === suits[0]);

    let straight = false;
    if (groups.length === 5) {
      if (ranks[4] - ranks[0] === 4) straight = true;
      else if (ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14) straight = true;
    }

    const royal = straight && flush && ranks[0] === 10;

    if (royal) return { key: "royal", name: "Royal Flush", mult: 250 };
    if (straight && flush) return { key: "straight-flush", name: "Straight Flush", mult: 60 };
    if (groups[0] === 4) return { key: "four-kind", name: "Four of a Kind", mult: 30 };
    if (groups[0] === 3 && groups[1] === 2) return { key: "full-house", name: "Full House", mult: 12 };
    if (flush) return { key: "flush", name: "Flush", mult: 8 };
    if (straight) return { key: "straight", name: "Straight", mult: 6 };
    if (groups[0] === 3) return { key: "three-kind", name: "Three of a Kind", mult: 5 };
    if (groups[0] === 2 && groups[1] === 2) return { key: "two-pair", name: "Two Pair", mult: 3 };

    if (groups[0] === 2) {
      let pairRank = 0;
      for (const r in counts) if (counts[r] === 2) pairRank = Number(r);
      if (pairRank >= 11) return { key: "jacks-or-better", name: "Jacks or Better", mult: 2 };
    }

    return { key: "nothing", name: "No Win", mult: 0 };
  }

  function rankLabel(r) {
    return r === 14 ? "A" : r === 13 ? "K" : r === 12 ? "Q" : r === 11 ? "J" : String(r);
  }

  function isRed(card) {
    return card.s === 1 || card.s === 2;
  }

  function cardAria(card, held) {
    return `${rankLabel(card.r)} of ${SUIT_NAMES[card.s]}${held ? ", held" : ""}`;
  }

  // Build the visual face of a card: two corner indices, a centre emblem
  // (big suit for numbers/aces, a royal medallion for J/Q/K) and a HELD badge.
  function buildCardFace(card, i, opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    if (isRed(card)) btn.className += " card--red";
    if (held[i]) btn.className += " card--held";
    if (opts.deal) {
      btn.className += " card--deal";
      btn.style.setProperty("--i", String(i));
    }
    if (opts.drawn && opts.drawn.indexOf(i) >= 0) btn.className += " card--draw";
    if (opts.win) btn.className += " card--win";

    const rank = rankLabel(card.r);
    const suit = SUITS[card.s];

    const tl = document.createElement("span");
    tl.className = "card__corner card__corner--tl";
    tl.setAttribute("aria-hidden", "true");
    const tlRank = document.createElement("span");
    tlRank.className = "rank";
    tlRank.textContent = rank;
    const tlSuit = document.createElement("span");
    tlSuit.className = "suit";
    tlSuit.textContent = suit;
    tl.appendChild(tlRank);
    tl.appendChild(tlSuit);

    const center = document.createElement("span");
    center.className = "card__center";
    center.setAttribute("aria-hidden", "true");
    if (card.r >= 11 && card.r <= 13) {
      const wm = document.createElement("span");
      wm.className = "card__royal-watermark";
      wm.textContent = suit;
      center.appendChild(wm);
      const med = document.createElement("span");
      med.className = "card__medallion";
      med.textContent = rank;
      center.appendChild(med);
    } else {
      const big = document.createElement("span");
      big.className = "card__suit-big";
      big.textContent = suit;
      center.appendChild(big);
    }

    const br = document.createElement("span");
    br.className = "card__corner card__corner--br";
    br.setAttribute("aria-hidden", "true");
    const brRank = document.createElement("span");
    brRank.className = "rank";
    brRank.textContent = rank;
    const brSuit = document.createElement("span");
    brSuit.className = "suit";
    brSuit.textContent = suit;
    br.appendChild(brRank);
    br.appendChild(brSuit);

    const heldBadge = document.createElement("span");
    heldBadge.className = "card__held";
    heldBadge.textContent = "HELD";
    heldBadge.setAttribute("aria-hidden", "true");

    btn.appendChild(tl);
    btn.appendChild(center);
    btn.appendChild(br);
    btn.appendChild(heldBadge);

    btn.disabled = gameOver || paused || phase !== "hold";
    btn.setAttribute("aria-label", cardAria(card, held[i]));
    btn.setAttribute("aria-pressed", held[i] ? "true" : "false");
    return btn;
  }

  function buildPaytable() {
    if (!paytableEl) return;
    paytableEl.innerHTML = "";
    for (const row of PAYTABLE) {
      const chip = document.createElement("span");
      chip.className = "vp-pay";
      chip.dataset.key = row.key;
      const name = document.createElement("b");
      name.textContent = row.name;
      const mult = document.createElement("i");
      mult.textContent = row.mult + "×";
      chip.appendChild(name);
      chip.appendChild(mult);
      paytableEl.appendChild(chip);
    }
  }

  // Light up the paytable row for the hand just completed.
  function updatePaytable() {
    if (!paytableEl) return;
    const active = phase === "result" && lastResult && lastResult.mult > 0 ? lastResult.key : null;
    for (const el of paytableEl.children) {
      el.classList.toggle("is-win", !!active && el.dataset.key === active);
    }
  }

  function updateMessage() {
    messageEl.classList.remove("is-win");
    let msg;
    if (phase === "result" && lastResult && lastResult.mult > 0) {
      // Show the winning hand even when it also ends the game.
      msg = `${lastResult.name}! You win ${lastPayout}.`;
      messageEl.classList.add("is-win");
    } else if (gameOver) {
      msg = "Out of credits — deal again.";
    } else if (phase === "bet") {
      msg = "Press Deal to play a hand.";
    } else if (phase === "hold") {
      const n = held.filter(Boolean).length;
      msg = n ? `${n} held — press Draw.` : "Click cards to hold, then Draw.";
    } else if (phase === "result") {
      msg = "No win — deal again.";
    } else {
      msg = "";
    }
    messageEl.textContent = msg;
  }

  // ---------- Flow ----------
  function deal(preset) {
    if (gameOver || paused) return;
    if (phase === "hold") return;
    if (bankroll < bet) return lose();
    bankroll -= bet;
    deck = preset ? preset.slice() : freshDeck();
    deckPos = 0;
    hand = [];
    for (let i = 0; i < 5; i++) hand.push(deck[deckPos++]);
    held = [false, false, false, false, false];
    lastResult = null;
    lastPayout = 0;
    phase = "hold";
    sfx("place");
    render({ deal: true });
  }

  function draw() {
    if (gameOver || paused || phase !== "hold") return;
    const replaced = [];
    for (let i = 0; i < 5; i++) {
      if (!held[i]) {
        if (deckPos >= deck.length) { deck = freshDeck(); deckPos = 0; }
        hand[i] = deck[deckPos++];
        replaced.push(i);
      }
    }

    const result = evaluateHand(hand);
    const payout = result.mult * bet;
    bankroll += payout;
    lastResult = result;
    lastPayout = payout;
    phase = "result";

    stats.hands++;
    if (payout > stats.biggestWin) stats.biggestWin = payout;
    if (result.key === "royal") stats.royals++;
    if (result.key === "four-kind") stats.fourKinds++;
    stats.bestBankroll = Math.max(stats.bestBankroll, bankroll);

    if (result.key === "royal") { sfx("win"); confetti(120); }
    else if (result.key === "straight-flush" || result.key === "four-kind") { sfx("match"); confetti(70); }
    else if (result.mult > 0) sfx("win");
    else sfx("click");

    saveStats();
    checkAchievements();

    if (bankroll >= TARGET) return win({ drawn: replaced });
    if (bankroll < bet) return lose({ drawn: replaced });
    render({ drawn: replaced, win: result.mult > 0 });
  }

  function toggleHold(i) {
    if (gameOver || paused || phase !== "hold") return;
    if (i < 0 || i >= 5) return;
    held[i] = !held[i];
    sfx("click");
    // Update just this card in place so the lift animates smoothly.
    const card = hand[i];
    const el = handEl.children[i];
    if (el && card) {
      el.classList.toggle("card--held", held[i]);
      el.setAttribute("aria-pressed", held[i] ? "true" : "false");
      el.setAttribute("aria-label", cardAria(card, held[i]));
    }
    updateMessage();
  }

  function primaryAction() {
    if (phase === "hold") draw();
    else deal();
  }

  function win(opts) {
    if (gameOver) return;
    gameOver = true;
    phase = "result";
    stats.games++;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    stats.bestBankroll = Math.max(stats.bestBankroll, bankroll);
    saveStats();
    checkAchievements();
    render(Object.assign({ win: !!(lastResult && lastResult.mult > 0) }, opts || {}));
    sfx("win");
    confetti(90);
    showOverlay("Target reached! 🎉", `You finished with ${bankroll} credits.`, [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  function lose(opts) {
    if (gameOver) return;
    gameOver = true;
    phase = "result";
    lastResult = null; // don't show a previous hand's result on the loss screen
    lastPayout = 0;
    stats.games++;
    stats.losses++;
    stats.streak = 0;
    stats.bestBankroll = Math.max(stats.bestBankroll, bankroll);
    saveStats();
    checkAchievements();
    render(Object.assign({}, opts || {}));
    sfx("over");
    showOverlay("Out of credits", `You finished with ${bankroll} credits.`, [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Rendering ----------
  // opts: { deal } stagger the deal, { drawn: [i] } flip replaced cards,
  // { win } add the winning glow.
  function render(opts) {
    opts = opts || {};
    bankrollEl.textContent = bankroll;
    betEl.textContent = bet;
    targetEl.textContent = TARGET;

    handEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const card = hand[i];
      if (!card) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "card card--empty";
        slot.disabled = true;
        slot.setAttribute("aria-label", "Empty card slot");
        handEl.appendChild(slot);
      } else {
        handEl.appendChild(buildCardFace(card, i, opts));
      }
    }

    updateMessage();
    updatePaytable();

    actionBtn.textContent = phase === "hold" ? "Draw" : "Deal";
    actionBtn.disabled = gameOver || paused;
  }

  // ---------- Flow helpers ----------
  function newGame() {
    bankroll = START_BANKROLL;
    bet = BET;
    hand = [];
    held = [false, false, false, false, false];
    deck = [];
    deckPos = 0;
    phase = "bet";
    lastResult = null;
    lastPayout = 0;
    gameOver = false;
    paused = false;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
    }
    render();
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Input ----------
  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (String(e.key || "").toLowerCase() === "p") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function onHandClick(e) {
    const card = e.target && e.target.closest ? e.target.closest(".card") : null;
    if (!card) return;
    audio.unlock();
    const idx = [...handEl.children].indexOf(card);
    if (idx < 0) return;
    toggleHold(idx);
  }

  function bindEvents() {
    handEl.addEventListener("click", onHandClick);
    actionBtn.addEventListener("click", () => { sfx("click"); primaryAction(); });
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    buildPaytable();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__VIDEO_POKER = {
    START_BANKROLL,
    BET,
    TARGET,
    get bankroll() { return bankroll; },
    get bet() { return bet; },
    get phase() { return phase; },
    get hand() { return hand.map((c) => (c ? { r: c.r, s: c.s } : null)); },
    get held() { return held.slice(); },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get lastResult() { return lastResult; },
    get lastPayout() { return lastPayout; },
    stats,
    ACHIEVEMENTS,
    evaluateHand,
    deal,
    draw,
    toggleHold,
    primaryAction,
    win,
    lose,
    newGame,
    // Test-only: deterministic RNG.
    setRng: (fn) => { rng = typeof fn === "function" ? fn : Math.random; },
    // Test-only: install a position.
    setState: (s) => {
      s = s || {};
      if (Number.isFinite(s.bankroll)) bankroll = s.bankroll;
      if (Number.isFinite(s.bet)) bet = s.bet;
      if (s.phase) phase = s.phase;
      if (s.hand) hand = s.hand.map((c) => (c ? { r: c.r, s: c.s } : null));
      if (s.held) held = s.held.slice();
      if (s.deck) { deck = s.deck.map((c) => ({ r: c.r, s: c.s })); deckPos = Number.isFinite(s.deckPos) ? s.deckPos : 0; }
      if (s.lastResult !== undefined) lastResult = s.lastResult;
      if (Number.isFinite(s.lastPayout)) lastPayout = s.lastPayout;
      gameOver = !!s.gameOver;
      paused = false;
      hideOverlay();
      render();
    },
    setPaused,
    togglePause,
    checkAchievements,
    saveStats,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();