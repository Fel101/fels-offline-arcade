// Hearts — dodge hearts and the queen, or shoot the moon.
// Pure vanilla JS, fully offline. Shared plumbing (storage, audio, toasts,
// overlay, confetti, badges, modal) comes from ../../js/arcade-core.js.
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
  const msgEl = dom.byId("msg");
  const trickEl = dom.byId("trick");
  const myPointsEl = dom.byId("my-points");
  const myMetaEl = dom.byId("my-meta-points");
  const heartsStateEl = dom.byId("hearts-state");
  const passBtn = dom.byId("pass");
  const restartBtn = dom.byId("restart");

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
  const SUITS = ["C", "D", "S", "H"];
  const SUIT_SYMBOL = { C: "♣", D: "♦", S: "♠", H: "♥" };
  const NAME = ["You", "West", "North", "East"];
  const PASS_DIRS = ["left", "right", "across"];

  const K = makeKeys("hearts");

  // ---------- Seeded RNG ----------
  let rngState = 0x7a1e5c3d;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function randInt(n) {
    return Math.floor(rand() * n);
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    bestScore: 0,
    hearts: 0,
    queens: 0,
    moons: 0,
    cleanHands: 0,
    streak: 0,
    bestStreak: 0,
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
    { id: "first", icon: "🎴", name: "First Hand", desc: "Finish your first hand.", stat: "games", goal: 1 },
    { id: "games10", icon: "🕹️", name: "Regular", desc: "Finish 10 hands.", stat: "games", goal: 10 },
    { id: "games25", icon: "🎮", name: "Card Sharp", desc: "Finish 25 hands.", stat: "games", goal: 25 },
    { id: "win1", icon: "🏆", name: "First Win", desc: "Win a hand.", stat: "wins", goal: 1 },
    { id: "win5", icon: "👑", name: "Winner", desc: "Win 5 hands.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🎖️", name: "Champion", desc: "Win 10 hands.", stat: "wins", goal: 10 },
    { id: "wins25", icon: "🏅", name: "Legend", desc: "Win 25 hands.", stat: "wins", goal: 25 },
    {
      id: "low5",
      icon: "💎",
      name: "Light Touch",
      desc: "Finish a hand with 5 or fewer points.",
      stat: "bestScore",
      goal: 5,
      satisfied: () => stats.games > 0 && stats.bestScore > 0 && stats.bestScore <= 5,
      progress: () => ({
        pct: stats.games > 0 ? Math.max(0, 100 - (stats.bestScore / 26) * 100) : 0,
        now: stats.games > 0 && stats.bestScore <= 5 ? 1 : 0,
        text: stats.games > 0 ? stats.bestScore + " pts" : "—",
      }),
    },
    {
      id: "perfect",
      icon: "🌟",
      name: "Clean Sweep",
      desc: "Finish a hand with zero points.",
      stat: "bestScore",
      goal: 0,
      satisfied: () => stats.games > 0 && stats.bestScore === 0,
      progress: () => ({
        pct: stats.games > 0 && stats.bestScore === 0 ? 100 : 0,
        now: stats.games > 0 && stats.bestScore === 0 ? 1 : 0,
        text: stats.games > 0 ? stats.bestScore + " pts" : "—",
      }),
    },
    { id: "moon1", icon: "🌙", name: "To the Moon", desc: "Shoot the moon.", stat: "moons", goal: 1 },
    { id: "cleanQ5", icon: "🛡️", name: "Queen Dodger", desc: "Avoid the queen in 5 hands.", stat: "cleanHands", goal: 5 },
    { id: "hearts13", icon: "❤️", name: "Heartbreaker", desc: "Take 13 hearts in total.", stat: "hearts", goal: 13 },
    { id: "queen1", icon: "🃏", name: "Queen Taker", desc: "Take the queen of spades.", stat: "queens", goal: 1 },
    { id: "streak3", icon: "🔥", name: "On a Roll", desc: "Win 3 hands in a row.", stat: "bestStreak", goal: 3 },
  ];

  // ---------- Badges UI ----------
  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => (Number.isFinite(stats[key]) ? stats[key] : 0),
    onUnlock: () => {
      updateBadgeCount();
      saveStats();
    },
    onRender: () => {
      if (!achvModal.hidden) renderAchvGrid();
    },
  });

  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  function checkAchievements() {
    achv.check();
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Hands", stats.games],
        ["Wins", stats.wins],
        ["Best score", stats.games ? stats.bestScore : "—"],
        ["Hearts taken", stats.hearts],
        ["Queens taken", stats.queens],
        ["Moons shot", stats.moons],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
    },
    onClose: () => {
      if (badgesBtn.focus) badgesBtn.focus();
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
  audio.define("play", [[440, 0, 0.04, "triangle", 0.03]]);
  audio.define("take", [[300, 0, 0.08, "sawtooth", 0.035]]);
  audio.define("moon", [[523, 0, 0.1, "triangle", 0.05], [659, 0.1, 0.1, "triangle", 0.05], [784, 0.2, 0.1, "triangle", 0.05], [1047, 0.3, 0.18, "triangle", 0.05]]);

  // ---------- State ----------
  let hands = [[], [], [], []];
  let phase = "pass"; // pass | play | over
  let turn = 0;
  let trick = [];
  let trickNumber = 1;
  let heartsBroken = false;
  let points = [0, 0, 0, 0];
  let tookQueen = [false, false, false, false];
  let heartsTaken = [0, 0, 0, 0];
  let passDirection = "left";
  let passSelection = [];
  let leader = 0;
  let paused = false;
  let aiTimer = 0;
  let resolveTimer = 0;

  // ---------- Cards ----------
  function rankLabel(rank) {
    if (rank === 14) return "A";
    if (rank === 13) return "K";
    if (rank === 12) return "Q";
    if (rank === 11) return "J";
    return String(rank);
  }

  function isRed(card) {
    return card.suit === "H" || card.suit === "D";
  }

  function isQueenOfSpades(card) {
    return card.suit === "S" && card.rank === 12;
  }

  function cardLabel(card) {
    return rankLabel(card.rank) + SUIT_SYMBOL[card.suit];
  }

  function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank, id: suit + rank });
    }
    return deck;
  }

  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    return deck;
  }

  function sortHand(player) {
    hands[player].sort((a, b) => {
      const sa = SUITS.indexOf(a.suit);
      const sb = SUITS.indexOf(b.suit);
      if (sa !== sb) return sa - sb;
      return a.rank - b.rank;
    });
  }

  function findInHand(player, id) {
    return hands[player].find((c) => c.id === id) || null;
  }

  function passTarget(player) {
    if (passDirection === "left") return (player + 1) % 4;
    if (passDirection === "right") return (player + 3) % 4;
    return (player + 2) % 4;
  }

  // ---------- Legal moves ----------
  function legalCards(player) {
    const hand = hands[player];
    if (!hand.length) return [];
    let legal;

    if (trick.length === 0) {
      if (trickNumber === 1) {
        const twoClubs = hand.find((c) => c.suit === "C" && c.rank === 2);
        if (twoClubs) return [twoClubs.id];
      }
      const nonHearts = hand.filter((c) => c.suit !== "H");
      legal = !heartsBroken && nonHearts.length ? nonHearts : hand.slice();
    } else {
      const ledSuit = trick[0].card.suit;
      const follow = hand.filter((c) => c.suit === ledSuit);
      legal = follow.length ? follow : hand.slice();
    }

    // No hearts or the queen on the first trick unless the hand is all danger.
    if (trickNumber === 1) {
      const safe = legal.filter((c) => !isDanger(c));
      if (safe.length) legal = safe;
    }

    return legal.map((c) => c.id);
  }

  function isDanger(card) {
    return card.suit === "H" || isQueenOfSpades(card);
  }

  function dangerScore(card) {
    if (isQueenOfSpades(card)) return 1000;
    if (card.suit === "H") return 100 + card.rank;
    return card.rank;
  }

  // ---------- Deal / new game ----------
  function newGame(intro) {
    clearTimeout(aiTimer);
    clearTimeout(resolveTimer);
    aiTimer = 0;
    resolveTimer = 0;

    const deck = shuffle(buildDeck());
    hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
    for (let i = 0; i < 4; i++) sortHand(i);

    phase = "pass";
    turn = 0;
    trick = [];
    trickNumber = 1;
    heartsBroken = false;
    points = [0, 0, 0, 0];
    tookQueen = [false, false, false, false];
    heartsTaken = [0, 0, 0, 0];
    passSelection = [];
    passDirection = PASS_DIRS[randInt(PASS_DIRS.length)];
    leader = 0;
    paused = false;

    hideOverlay();
    render();
    updateStatus();
    if (intro) showStartOverlay();
  }

  function chooseAIPass(player) {
    const sorted = hands[player].slice().sort((a, b) => dangerScore(b) - dangerScore(a));
    return sorted.slice(0, 3).map((c) => c.id);
  }

  function togglePass(cardId) {
    if (phase !== "pass") return;
    const i = passSelection.indexOf(cardId);
    if (i >= 0) passSelection.splice(i, 1);
    else if (passSelection.length < 3) passSelection.push(cardId);
    else return;
    sfx("select");
    render();
    updateStatus();
  }

  function confirmPass() {
    if (phase !== "pass" || passSelection.length !== 3) return;

    const allPasses = [passSelection.slice()];
    for (let i = 1; i < 4; i++) allPasses[i] = chooseAIPass(i);

    const received = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      const target = passTarget(i);
      for (const id of allPasses[i]) {
        const idx = hands[i].findIndex((c) => c.id === id);
        if (idx >= 0) {
          const [card] = hands[i].splice(idx, 1);
          received[target].push(card);
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      hands[i] = hands[i].concat(received[i]);
      sortHand(i);
    }

    passSelection = [];
    phase = "play";
    trick = [];
    trickNumber = 1;
    heartsBroken = false;
    points = [0, 0, 0, 0];
    tookQueen = [false, false, false, false];
    heartsTaken = [0, 0, 0, 0];

    leader = 0;
    for (let i = 0; i < 4; i++) if (findInHand(i, "C2")) leader = i;
    turn = leader;

    render();
    updateStatus();
    maybeAI();
  }

  // ---------- Play ----------
  function playCard(player, cardId) {
    if (phase !== "play" || turn !== player) return false;
    const legal = legalCards(player);
    if (!legal.includes(cardId)) return false;
    const idx = hands[player].findIndex((c) => c.id === cardId);
    if (idx < 0) return false;

    const [card] = hands[player].splice(idx, 1);
    trick.push({ player, card });
    if (card.suit === "H") heartsBroken = true;
    sfx("play");

    if (trick.length === 4) {
      render();
      updateStatus();
      clearTimeout(resolveTimer);
      resolveTimer = setTimeout(() => {
        resolveTimer = 0;
        resolveTrick();
      }, 700);
      return true;
    }

    turn = (player + 1) % 4;
    render();
    updateStatus();
    maybeAI();
    return true;
  }

  function resolveTrick() {
    if (trick.length !== 4) return;
    const ledSuit = trick[0].card.suit;
    let best = trick[0];
    for (const p of trick) {
      if (p.card.suit === ledSuit && p.card.rank > best.card.rank) best = p;
    }
    const winner = best.player;

    let pts = 0;
    for (const p of trick) {
      if (p.card.suit === "H") {
        pts++;
        heartsTaken[winner]++;
      }
      if (isQueenOfSpades(p.card)) {
        pts += 13;
        tookQueen[winner] = true;
      }
    }
    points[winner] += pts;
    if (pts > 0) sfx("take");

    trick = [];
    trickNumber++;

    if (hands.every((h) => h.length === 0)) {
      endGame();
      return;
    }

    leader = winner;
    turn = winner;
    render();
    updateStatus();
    maybeAI();
  }

  // ---------- CPU ----------
  function aiChooseCard(player) {
    const legal = legalCards(player);
    if (!legal.length) return null;
    const cards = legal.map((id) => findInHand(player, id)).filter(Boolean);
    if (!cards.length) return null;

    if (trick.length === 0) {
      const safe = cards.filter((c) => !isDanger(c));
      const pool = safe.length ? safe : cards;
      pool.sort((a, b) => a.rank - b.rank);
      return pool[0].id;
    }

    const ledSuit = trick[0].card.suit;
    const follow = cards.filter((c) => c.suit === ledSuit);
    if (follow.length) {
      follow.sort((a, b) => a.rank - b.rank);
      return follow[0].id;
    }

    const dangerCards = cards.filter(isDanger);
    if (dangerCards.length) {
      dangerCards.sort((a, b) => dangerScore(b) - dangerScore(a));
      return dangerCards[0].id;
    }

    cards.sort((a, b) => b.rank - a.rank);
    return cards[0].id;
  }

  function aiPlay(player) {
    if (phase !== "play" || turn !== player) return false;
    const id = aiChooseCard(player);
    if (!id) return false;
    return playCard(player, id);
  }

  function maybeAI() {
    if (phase !== "play" || turn === 0 || paused) return;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiTimer = 0;
      if (phase !== "play" || turn === 0 || paused) return;
      aiPlay(turn);
    }, 550);
  }

  // ---------- End ----------
  function endGame() {
    if (phase === "over") return;
    phase = "over";
    clearTimeout(aiTimer);
    clearTimeout(resolveTimer);
    aiTimer = 0;
    resolveTimer = 0;

    let shooter = -1;
    for (let i = 0; i < 4; i++) if (points[i] === 26) shooter = i;
    if (shooter >= 0) {
      for (let i = 0; i < 4; i++) points[i] = i === shooter ? 0 : 26;
    }

    const human = points[0];
    const minOther = Math.min(points[1], points[2], points[3]);
    const won = human <= minOther;

    stats.games++;
    if (stats.games === 1) stats.bestScore = human;
    else stats.bestScore = Math.min(stats.bestScore, human);
    stats.hearts += heartsTaken[0];
    if (tookQueen[0]) stats.queens++;
    else stats.cleanHands++;
    if (shooter === 0) stats.moons++;
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.streak = 0;
    }

    saveStats();
    checkAchievements();
    render();
    updateStatus();

    if (shooter === 0) sfx("moon");
    else if (won) sfx("win");
    else sfx("over");
    if (won) confetti(90);

    const moonNote =
      shooter === 0
        ? " · You shot the moon!"
        : shooter > 0
        ? " · " + NAME[shooter] + " shot the moon"
        : "";

    showOverlay(
      won ? "You win! 🎉" : "You lost",
      `Scores — You ${points[0]}, West ${points[1]}, North ${points[2]}, East ${points[3]}.${moonNote}`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Rendering ----------
  function cardEl(card, opts) {
    const el = document.createElement(opts && opts.button ? "button" : "div");
    if (opts && opts.button) el.type = "button";
    el.className = "hh-card" + (isRed(card) ? " hh-card--red" : "") + (opts && opts.small ? " hh-card--small" : "");
    const r = document.createElement("span");
    r.className = "hh-card__rank";
    r.textContent = rankLabel(card.rank);
    const s = document.createElement("span");
    s.className = "hh-card__suit";
    s.textContent = SUIT_SYMBOL[card.suit];
    el.appendChild(r);
    el.appendChild(s);
    el.setAttribute("aria-label", cardLabel(card));
    return el;
  }

  function render() {
    for (let i = 1; i < 4; i++) {
      const countEl = dom.byId("count-" + i);
      const ptsEl = dom.byId("points-" + i);
      if (countEl) countEl.textContent = hands[i].length;
      if (ptsEl) ptsEl.textContent = points[i];
      const seat = dom.byId("seat-" + i);
      if (seat) seat.classList.toggle("hh-opp--active", phase === "play" && turn === i && !paused);
    }

    for (let i = 0; i < 4; i++) {
      const slot = dom.byId("slot-" + i);
      if (!slot) continue;
      slot.innerHTML = "";
      const entry = trick.find((p) => p.player === i);
      if (entry) slot.appendChild(cardEl(entry.card, { small: true }));
    }

    handEl.innerHTML = "";
    const legal = phase === "play" && turn === 0 && !paused ? legalCards(0) : null;
    for (const card of hands[0]) {
      const b = cardEl(card, { button: true });
      if (phase === "pass" && passSelection.includes(card.id)) b.classList.add("hh-card--sel");
      if (phase === "play" && turn === 0 && !paused) {
        if (legal.includes(card.id)) b.classList.add("hh-card--playable");
        else b.classList.add("hh-card--dim");
      }
      b.addEventListener("click", () => onCardClick(card.id));
      handEl.appendChild(b);
    }

    if (myMetaEl) myMetaEl.textContent = points[0] + " points";
  }

  function updateStatus() {
    trickEl.textContent = Math.min(trickNumber, 13) + "/13";
    myPointsEl.textContent = points[0];
    heartsStateEl.textContent = heartsBroken ? "Broken" : "—";

    if (phase === "pass") {
      const dirText =
        passDirection === "left" ? "to the left" : passDirection === "right" ? "to the right" : "across the table";
      msgEl.textContent = `Select 3 cards to pass ${dirText}.`;
    } else if (phase === "play") {
      msgEl.textContent = turn === 0 ? "Your turn" : NAME[turn] + " is thinking…";
    } else {
      msgEl.textContent = "Hand complete";
    }

    const canPass = phase === "pass" && passSelection.length === 3;
    passBtn.disabled = !canPass;
    passBtn.textContent = `Pass 3 cards (${passSelection.length}/3)`;
  }

  // ---------- Input ----------
  function onCardClick(cardId) {
    audio.unlock();
    if (phase === "pass") {
      togglePass(cardId);
      return;
    }
    if (phase === "play" && turn === 0 && !paused) {
      if (legalCards(0).includes(cardId)) {
        playCard(0, cardId);
      } else {
        sfx("error");
        toast.show("Not legal", "Follow suit if you can, and avoid points on the first trick.", "🚫");
      }
    }
  }

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

    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (overlay.isOpen() || paused || phase === "over") return;
    if ((key === "Enter" || key === " ") && phase === "pass" && passSelection.length === 3) {
      if (e.preventDefault) e.preventDefault();
      confirmPass();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);
    passBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); confirmPass(); });
    restartBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); newGame(false); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    window.addEventListener("blur", () => {
      if (phase !== "over" && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && phase !== "over" && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (phase === "over" || paused === p) return;
    paused = p;
    if (p) {
      clearTimeout(aiTimer);
      clearTimeout(resolveTimer);
      aiTimer = 0;
      resolveTimer = 0;
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); maybeAI(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
    render();
    updateStatus();
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame(true);
    renderAchvGrid();
  }

  function showStartOverlay() {
    showOverlay(
      "Hearts",
      "Pass 3 cards, then take as few hearts and as little of the queen as you can. Lowest score wins.",
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // Test hook — harmless in normal play.
  window.__HEARTS = {
    SUITS,
    NAME,
    PASS_DIRS,
    stats,
    ACHIEVEMENTS,
    get hands() { return hands.map((h) => h.map((c) => ({ suit: c.suit, rank: c.rank, id: c.id }))); },
    get phase() { return phase; },
    get turn() { return turn; },
    get trick() { return trick.map((p) => ({ player: p.player, card: { suit: p.card.suit, rank: p.card.rank, id: p.card.id } })); },
    get trickNumber() { return trickNumber; },
    get heartsBroken() { return heartsBroken; },
    get points() { return points.slice(); },
    get passDirection() { return passDirection; },
    get passSelection() { return passSelection.slice(); },
    get paused() { return paused; },
    get leader() { return leader; },
    rankLabel,
    isQueenOfSpades,
    isDanger,
    legalCards,
    findInHand,
    passTarget,
    chooseAIPass,
    togglePass,
    confirmPass,
    playCard,
    resolveTrick,
    aiChooseCard,
    aiPlay,
    endGame,
    newGame,
    setPaused,
    togglePause,
    setSeed: (n) => { rngState = n >>> 0; },
    setHands: (h) => {
      hands = [[], [], [], []];
      h.forEach((cards, i) => {
        hands[i] = cards.map((c) => ({ suit: c.suit, rank: c.rank, id: c.suit + c.rank }));
        sortHand(i);
      });
      render();
      updateStatus();
    },
    setPhase: (p) => { phase = p; render(); updateStatus(); },
    setTurn: (t) => { turn = t; render(); updateStatus(); },
    setTrick: (t) => { trick = t; render(); updateStatus(); },
    setTrickNumber: (n) => { trickNumber = n; updateStatus(); },
    setHeartsBroken: (b) => { heartsBroken = !!b; updateStatus(); },
    setPoints: (p) => { points = p.slice(); render(); updateStatus(); },
    setPassDirection: (d) => { passDirection = d; updateStatus(); },
    setPaused,
    togglePause,
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();