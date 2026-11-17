// Blackjack — pure vanilla JS, fully offline.
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

  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RED = new Set(["♥", "♦"]);
  const START_BANK = 100;

  // ---------- DOM ----------
  const bankEl = dom.byId("bank");
  const betEl = dom.byId("bet");
  const streakEl = dom.byId("streak");
  const playerHandEl = dom.byId("player-hand");
  const dealerHandEl = dom.byId("dealer-hand");
  const playerScoreEl = dom.byId("player-score");
  const dealerScoreEl = dom.byId("dealer-score");
  const resultEl = dom.byId("result");
  const betControls = dom.byId("bet-controls");
  const playControls = dom.byId("play-controls");
  const dealBtn = dom.byId("deal");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  const K = makeKeys("blackjack");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    hands: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    busts: 0,
    streak: 0,
    bestStreak: 0,
    profit: 0,
    bestBank: START_BANK,
    twentyOnes: 0,
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

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Win", desc: "Win your first hand.", stat: "wins", goal: 1 },
    { id: "win10", icon: "🔁", name: "Regular", desc: "Win 10 hands.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "High Roller", desc: "Win 25 hands.", stat: "wins", goal: 25 },
    { id: "streak3", icon: "🔥", name: "Three in a Row", desc: "Win 3 hands in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Win 5 hands in a row.", stat: "bestStreak", goal: 5 },
    { id: "bj1", icon: "🂡", name: "Natural", desc: "Hit your first blackjack.", stat: "blackjacks", goal: 1 },
    { id: "bj5", icon: "✨", name: "Blackjack Artist", desc: "Hit 5 blackjacks.", stat: "blackjacks", goal: 5 },
    { id: "push5", icon: "🤝", name: "Push It", desc: "Push the dealer 5 times.", stat: "pushes", goal: 5 },
    { id: "hands25", icon: "🎲", name: "Table Regular", desc: "Play 25 hands.", stat: "hands", goal: 25 },
    { id: "bust10", icon: "💥", name: "Bust Out", desc: "Bust 10 times.", stat: "busts", goal: 10 },
    { id: "bank150", icon: "💰", name: "In the Black", desc: "Grow the bankroll to 150.", stat: "bestBank", goal: 150 },
    { id: "bank250", icon: "🏦", name: "Big Stack", desc: "Grow the bankroll to 250.", stat: "bestBank", goal: 250 },
    { id: "profit200", icon: "📈", name: "Profit Margin", desc: "Bank +200 net profit.", stat: "profit", goal: 200 },
    { id: "twentyone", icon: "🎯", name: "Twenty-One", desc: "Win a hand on exactly 21.", stat: "twentyOnes", goal: 1 },
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

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Hands", stats.hands],
        ["Wins", stats.wins],
        ["Blackjacks", stats.blackjacks],
        ["Best streak", stats.bestStreak],
        ["Peak bank", stats.bestBank],
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

  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });

  // ---------- Game state ----------
  let deck = [];
  let player = [];
  let dealer = [];
  let bank = START_BANK;
  let bet = 0;
  let phase = "betting"; // betting | player | dealer | over
  let paused = false;
  let lastOutcome = null;
  let rigged = null; // test-only deck sequence

  function buildDeck() {
    deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function rigDeck(seq) {
    rigged = seq.slice();
  }

  function handValue(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.r === "A") {
        aces++;
        total += 11;
      } else if (card.r === "K" || card.r === "Q" || card.r === "J") {
        total += 10;
      } else {
        total += parseInt(card.r, 10);
      }
    }
    while (total > 21 && aces) {
      total -= 11;
      aces--;
    }
    return total;
  }

  function isRed(card) {
    return RED.has(card.s);
  }

  function renderCard(card, hidden) {
    const el = document.createElement("div");
    if (hidden) {
      el.className = "bj-card bj-card--back";
      el.setAttribute("aria-label", "Hidden card");
      return el;
    }
    el.className = "bj-card" + (isRed(card) ? " bj-card--red" : "");
    el.innerHTML =
      `<span class="bj-corner bj-corner--tl">${card.r}<br><span class="bj-suit">${card.s}</span></span>` +
      `<span class="bj-big">${card.s}</span>` +
      `<span class="bj-corner bj-corner--br">${card.r}<br><span class="bj-suit">${card.s}</span></span>`;
    return el;
  }

  function render(revealDealer) {
    playerHandEl.innerHTML = "";
    dealerHandEl.innerHTML = "";
    player.forEach((c) => playerHandEl.appendChild(renderCard(c)));
    dealer.forEach((c, i) => {
      const hidden = revealDealer === false && i === 1;
      dealerHandEl.appendChild(renderCard(c, hidden));
    });
    playerScoreEl.textContent = player.length ? handValue(player) : "";
    if (!dealer.length) {
      dealerScoreEl.textContent = "";
    } else if (revealDealer === false) {
      dealerScoreEl.textContent = String(handValue([dealer[0]]));
    } else {
      const dVal = handValue(dealer);
      dealerScoreEl.textContent = dVal + (dVal === 21 && dealer.length === 2 ? " (Blackjack)" : "");
    }
  }

  function updateStatus() {
    bankEl.textContent = bank;
    betEl.textContent = bet;
    streakEl.textContent = stats.streak;
  }

  function setControls() {
    betControls.style.display = phase === "betting" ? "flex" : "none";
    playControls.style.display = phase === "player" ? "flex" : "none";
  }

  // ---------- Betting ----------
  function addBet(amt) {
    if (phase !== "betting" || paused) return;
    const room = bank - bet;
    if (amt > room) amt = room;
    if (amt <= 0) return;
    bet += amt;
    sfx("click");
    updateStatus();
  }

  // ---------- Round flow ----------
  function startRound() {
    if (phase !== "betting" || paused) return;
    if (bank <= 0) return bankrupt();
    if (bet <= 0) {
      toast("Place a bet first");
      sfx("error");
      return;
    }
    if (rigged) {
      deck = rigged.slice().reverse();
      rigged = null;
    } else {
      buildDeck();
    }
    player = [deck.pop(), deck.pop()];
    dealer = [deck.pop(), deck.pop()];
    phase = "player";
    lastOutcome = null;
    stats.hands++;
    saveStats();
    checkAchievements();
    resultEl.textContent = "Hit or stand?";
    render(false);
    updateStatus();
    setControls();
    sfx("flip");
    if (handValue(player) === 21) stand(); // natural blackjack auto-stands
  }

  function hit() {
    if (phase !== "player" || paused) return;
    player.push(deck.pop());
    sfx("tick");
    render(false);
    if (handValue(player) > 21) {
      stats.busts++;
      saveStats();
      checkAchievements();
      endRound("bust");
    }
  }

  function stand() {
    if (phase !== "player" || paused) return;
    phase = "dealer";
    setControls();
    render(true);
    sfx("flip");
    dealerTurn();
  }

  function dealerTurn() {
    setTimeout(dealerTick, 400);
  }

  function dealerTick() {
    if (phase !== "dealer") return;
    if (paused) {
      setTimeout(dealerTick, 200);
      return;
    }
    if (handValue(dealer) < 17) {
      dealer.push(deck.pop());
      sfx("flip");
      render(true);
      setTimeout(dealerTick, 500);
    } else {
      resolve();
    }
  }

  // Test-friendly: play the dealer's whole turn synchronously.
  function advanceDealer() {
    let guard = 0;
    while (phase === "dealer" && guard++ < 40) dealerTick();
    return phase === "over";
  }

  function resolve() {
    const pVal = handValue(player);
    const dVal = handValue(dealer);
    const dealerBlackjack = dVal === 21 && dealer.length === 2;
    const playerBlackjack = pVal === 21 && player.length === 2;

    if (dealerBlackjack && !playerBlackjack) return endRound("lose");
    if (playerBlackjack && !dealerBlackjack) return endRound("blackjack");
    if (pVal > 21) return endRound("bust");
    if (dVal > 21) return endRound("win");
    if (pVal > dVal) return endRound("win");
    if (pVal < dVal) return endRound("lose");
    return endRound("push");
  }

  function endRound(outcome) {
    if (phase === "over") return;
    phase = "over";
    lastOutcome = outcome;
    render(true);

    const pVal = handValue(player);
    const dVal = handValue(dealer);
    let title;
    let msg;
    let delta = 0;

    switch (outcome) {
      case "bust":
        stats.losses++;
        stats.streak = 0;
        delta = -bet;
        title = "Bust 💥";
        msg = `You went over 21 with ${pVal}. Lost ${bet}.`;
        sfx("over");
        break;
      case "lose":
        stats.losses++;
        stats.streak = 0;
        delta = -bet;
        title = "Dealer wins";
        if (dVal === 21 && dealer.length === 2) msg = `Dealer blackjack. Lost ${bet}.`;
        else msg = `Dealer ${dVal} beats your ${pVal}. Lost ${bet}.`;
        sfx("over");
        break;
      case "push":
        stats.pushes++;
        stats.streak = 0;
        title = "Push";
        msg = `Both on ${pVal} — your bet comes back.`;
        sfx("pop");
        break;
      case "win":
        stats.wins++;
        stats.streak++;
        if (pVal === 21 && player.length > 2) stats.twentyOnes++;
        delta = bet;
        title = "You win! 🎉";
        msg = `Your ${pVal} beats the dealer's ${dVal}. Won ${bet}.`;
        sfx("win");
        break;
      case "blackjack":
        stats.wins++;
        stats.blackjacks++;
        stats.streak++;
        delta = Math.floor(bet * 1.5);
        title = "Blackjack! 🂡";
        msg = `Natural 21 — you profit ${delta} (3:2).`;
        sfx("win");
        break;
      default:
        title = "Hand over";
        msg = "";
    }

    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    stats.profit += delta;
    bank += delta;
    if (bank < 0) bank = 0;
    stats.bestBank = Math.max(stats.bestBank, bank);
    saveStats();
    checkAchievements();
    updateStatus();
    setControls();
    resultEl.textContent = msg;

    if (outcome === "win" || outcome === "blackjack") confetti(70);

    const broke = bank <= 0;
    const actions = [
      {
        label: broke ? "Restart with 100" : "New Round",
        onClick: () => {
          hideOverlay();
          if (broke) bankrupt();
          else newRound();
        },
      },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ];
    showOverlay(title, `${msg} Bankroll: ${bank}.`, actions);
  }

  function newRound() {
    if (phase !== "betting") {
      bet = 0;
      phase = "betting";
      paused = false;
      updateStatus();
      setControls();
    }
    hideOverlay();
  }

  function bankrupt() {
    bank = START_BANK;
    bet = 0;
    phase = "betting";
    paused = false;
    player = [];
    dealer = [];
    render(false);
    playerScoreEl.textContent = "";
    dealerScoreEl.textContent = "";
    resultEl.textContent = "Out of chips! Here are 100 fresh ones. Good luck.";
    updateStatus();
    setControls();
    saveStats();
    sfx("over");
    showOverlay("Out of chips! 💸", "Here are 100 fresh chips. Good luck!", [
      { label: "Back to the table", onClick: () => hideOverlay() },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Achievements check ----------
  function checkAchievements() {
    achv.check();
  }

  // ---------- Pause ----------
  function canPause() {
    return phase === "player" || phase === "dealer";
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or Esc to resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
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

    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (paused) return;
    const lower = key.toLowerCase();
    if (phase === "player" && lower === "h") {
      if (e.preventDefault) e.preventDefault();
      hit();
    }
    if (phase === "player" && lower === "s") {
      if (e.preventDefault) e.preventDefault();
      stand();
    }
  }

  function bindEvents() {
    document.querySelectorAll(".bet-btn").forEach((b) => {
      b.addEventListener("click", () => {
        audio.unlock();
        addBet(+b.dataset.amt);
      });
    });
    dealBtn.addEventListener("click", () => {
      audio.unlock();
      startRound();
    });
    dom.byId("hit").addEventListener("click", hit);
    dom.byId("stand").addEventListener("click", stand);

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    updateBadgeCount();
    updateStatus();
    setControls();
    render(false);
    bindEvents();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__BLACKJACK = {
    START_BANK,
    get phase() {
      return phase;
    },
    get bank() {
      return bank;
    },
    set bank(v) {
      bank = v;
    },
    get bet() {
      return bet;
    },
    get player() {
      return player.map((c) => ({ ...c }));
    },
    get dealer() {
      return dealer.map((c) => ({ ...c }));
    },
    get deckSize() {
      return deck.length;
    },
    get paused() {
      return paused;
    },
    get gameOver() {
      return phase === "over";
    },
    get lastOutcome() {
      return lastOutcome;
    },
    stats,
    ACHIEVEMENTS,
    handValue,
    rigDeck,
    addBet,
    startRound,
    hit,
    stand,
    dealerTick,
    advanceDealer,
    newRound,
    bankrupt,
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
