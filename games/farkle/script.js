// Farkle — push-your-luck dice game. Pure vanilla JS, fully offline.
// Reach the target score within a limited number of turns.
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
  const diceEl = dom.byId("dice");
  const totalEl = dom.byId("total");
  const turnScoreEl = dom.byId("turn-score");
  const turnNumEl = dom.byId("turn-num");
  const selectionEl = dom.byId("selection");
  const rollBtn = dom.byId("roll-btn");
  const bankBtn = dom.byId("bank-btn");
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
  const DICE = 6;
  const TARGET = 3000;
  const MAX_TURNS = 10;
  const HINT_DEFAULT =
    "Reach 3000 points in 10 turns. Keep scoring dice, then Roll Again or Bank. A roll with no scoring dice is a Farkle and loses the turn.";

  const K = makeKeys("farkle");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    bestScore: 0, // best single-game score
    totalScore: 0, // career points banked
    farkles: 0,
    hotDice: 0,
    totalRolls: 0,
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
    { id: "first", icon: "🎯", name: "First Win", desc: "Reach the target score.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Reach the target 5 times.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Reach the target 10 times.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Reach the target 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Reach the target 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Reach the target 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "score5k", icon: "5️⃣", name: "High Roller", desc: "Score 5,000+ in one game.", stat: "bestScore", goal: 5000 },
    { id: "score10k", icon: "💰", name: "Jackpot", desc: "Score 10,000+ in one game.", stat: "bestScore", goal: 10000 },
    { id: "hot1", icon: "🔥", name: "Hot Dice", desc: "Score with all six dice at once.", stat: "hotDice", goal: 1 },
    { id: "hot5", icon: "🌋", name: "Inferno", desc: "Roll hot dice 5 times.", stat: "hotDice", goal: 5 },
    { id: "farkle10", icon: "💥", name: "Bust", desc: "Farkle 10 times.", stat: "farkles", goal: 10 },
    { id: "rolls100", icon: "🎲", name: "Frequent Flyer", desc: "Roll the dice 100 times.", stat: "totalRolls", goal: 100 },
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
        ["Best score", stats.bestScore],
        ["Best streak", stats.bestStreak],
        ["Farkles", stats.farkles],
        ["Hot dice", stats.hotDice],
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
  let dice = [1, 1, 1, 1, 1, 1];
  let held = [false, false, false, false, false, false];
  let setAside = [false, false, false, false, false, false];
  let turnScore = 0;
  let totalScore = 0;
  let turn = 1;
  let gameOver = false;
  let paused = false;
  let rng = Math.random;

  function rollDie() {
    return 1 + Math.floor(rng() * 6);
  }

  // ---------- Scoring ----------
  /**
   * Score a set of dice that are being set aside.
   * Returns { score, valid }. `valid` is false when any die is not part of a
   * scoring combination (so the player cannot keep a lone 2, for example).
   */
  function scoreSelection(values) {
    if (!values || values.length === 0) return { score: 0, valid: false };
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of values) {
      if (!Number.isInteger(v) || v < 1 || v > 6) return { score: 0, valid: false };
      counts[v]++;
    }

    // Straight 1-6.
    if (
      values.length === 6 &&
      counts[1] === 1 && counts[2] === 1 && counts[3] === 1 &&
      counts[4] === 1 && counts[5] === 1 && counts[6] === 1
    ) {
      return { score: 1500, valid: true };
    }

    // Three pairs.
    if (values.length === 6) {
      let pairs = 0;
      for (let f = 1; f <= 6; f++) if (counts[f] === 2) pairs++;
      if (pairs === 3) return { score: 1500, valid: true };
    }

    let score = 0;
    for (let f = 1; f <= 6; f++) {
      const c = counts[f];
      if (c >= 3) {
        if (c === 3) score += f === 1 ? 1000 : f * 100;
        else if (c === 4) score += 2000;
        else if (c === 5) score += 3000;
        else score += 4000;
      }
    }

    // Leftover single 1s and 5s (only when they were not consumed by n-of-a-kind).
    if (counts[1] < 3) score += counts[1] * 100;
    if (counts[5] < 3) score += counts[5] * 50;

    // Any other leftover dice make the selection invalid.
    for (let f = 2; f <= 6; f++) {
      if (f === 5) continue;
      if (counts[f] > 0 && counts[f] < 3) return { score: 0, valid: false };
    }

    return { score, valid: score > 0 };
  }

  /** True when at least one scoring combination exists in `values`. */
  function hasScore(values) {
    if (!values || values.length === 0) return false;
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of values) {
      if (!Number.isInteger(v) || v < 1 || v > 6) continue;
      counts[v]++;
      if (v === 1 || v === 5) return true;
    }
    for (let f = 1; f <= 6; f++) if (counts[f] >= 3) return true;
    if (values.length === 6) {
      let allOne = true;
      let pairs = 0;
      for (let f = 1; f <= 6; f++) {
        if (counts[f] !== 1) allOne = false;
        if (counts[f] === 2) pairs++;
      }
      if (allOne || pairs === 3) return true;
    }
    return false;
  }

  function selectionInfo() {
    const values = [];
    for (let i = 0; i < DICE; i++) if (held[i] && !setAside[i]) values.push(dice[i]);
    return scoreSelection(values);
  }

  // ---------- Turn flow ----------
  function startTurn() {
    turnScore = 0;
    held = [false, false, false, false, false, false];
    setAside = [false, false, false, false, false, false];
    dice = [rollDie(), rollDie(), rollDie(), rollDie(), rollDie(), rollDie()];
    stats.totalRolls++;
    if (!hasScore(dice)) {
      saveStats();
      checkAchievements();
      farkle();
      return;
    }
    saveStats();
    checkAchievements();
    render();
  }

  function farkle() {
    stats.farkles++;
    turnScore = 0;
    held = [false, false, false, false, false, false];
    setAside = [false, false, false, false, false, false];
    sfx("error");
    toast.show("Farkle!", "No scoring dice — turn lost.", "💥");
    saveStats();
    checkAchievements();
    endTurn();
  }

  function roll() {
    if (gameOver || paused) return;
    const sel = selectionInfo();
    if (!sel.valid || sel.score <= 0) return;

    turnScore += sel.score;

    // Lock in the dice the player chose.
    for (let i = 0; i < DICE; i++) {
      if (held[i]) {
        held[i] = false;
        setAside[i] = true;
      }
    }

    let rollIdx;
    if (setAside.every(Boolean)) {
      // Hot dice: all six scored — pick them all back up.
      stats.hotDice++;
      setAside = [false, false, false, false, false, false];
      rollIdx = [0, 1, 2, 3, 4, 5];
    } else {
      rollIdx = [];
      for (let i = 0; i < DICE; i++) if (!setAside[i]) rollIdx.push(i);
    }

    for (const i of rollIdx) dice[i] = rollDie();
    stats.totalRolls++;
    sfx("place");
    saveStats();
    checkAchievements();

    const newValues = rollIdx.map((i) => dice[i]);
    if (!hasScore(newValues)) {
      farkle();
    } else {
      render();
    }
  }

  function bank() {
    if (gameOver || paused) return;
    const sel = selectionInfo();
    if (sel.valid && sel.score > 0) turnScore += sel.score;
    if (turnScore <= 0) return;

    totalScore += turnScore;
    stats.totalScore += turnScore;
    turnScore = 0;
    held = [false, false, false, false, false, false];
    setAside = [false, false, false, false, false, false];
    sfx("match");
    saveStats();
    checkAchievements();
    endTurn();
  }

  function endTurn() {
    turnScore = 0;
    held = [false, false, false, false, false, false];
    setAside = [false, false, false, false, false, false];
    if (totalScore >= TARGET) return win();
    if (turn >= MAX_TURNS) return lose();
    turn++;
    startTurn();
  }

  function win() {
    gameOver = true;
    stats.games++;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    stats.bestScore = Math.max(stats.bestScore, totalScore);
    saveStats();
    checkAchievements();
    render();
    sfx("win");
    confetti(90);
    showOverlay(
      "Target reached! 🎉",
      `You scored ${totalScore} in ${turn} turn${turn === 1 ? "" : "s"}.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function lose() {
    gameOver = true;
    stats.games++;
    stats.losses++;
    stats.streak = 0;
    stats.bestScore = Math.max(stats.bestScore, totalScore);
    saveStats();
    checkAchievements();
    render();
    sfx("over");
    showOverlay("Out of turns", `You scored ${totalScore} of ${TARGET}.`, [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Rendering ----------
  function render() {
    totalEl.textContent = totalScore;
    turnScoreEl.textContent = turnScore;
    turnNumEl.textContent = `${turn} / ${MAX_TURNS}`;

    diceEl.innerHTML = "";
    for (let i = 0; i < DICE; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "die";
      if (setAside[i]) btn.classList.add("die--set");
      if (held[i]) btn.classList.add("die--held");
      if (!setAside[i] && (dice[i] === 1 || dice[i] === 5)) btn.classList.add("die--scoring");
      btn.textContent = dice[i];
      btn.disabled = gameOver || paused || setAside[i];
      btn.setAttribute(
        "aria-label",
        setAside[i]
          ? `Die ${i + 1}: ${dice[i]} (set aside)`
          : `Die ${i + 1}: ${dice[i]}${held[i] ? ", held" : ""}`
      );
      btn.setAttribute("aria-pressed", held[i] ? "true" : "false");
      diceEl.appendChild(btn);
    }

    const sel = selectionInfo();
    if (gameOver) {
      selectionEl.textContent = "Game over.";
    } else if (paused) {
      selectionEl.textContent = "Paused.";
    } else if (sel.valid && sel.score > 0) {
      selectionEl.textContent = `Keep: ${sel.score} points`;
    } else if (held.some(Boolean)) {
      selectionEl.textContent = "That selection doesn't score.";
    } else {
      selectionEl.textContent = "Tap dice to set them aside.";
    }

    rollBtn.disabled = gameOver || paused || !(sel.valid && sel.score > 0);
    bankBtn.disabled = gameOver || paused || !(turnScore > 0 || (sel.valid && sel.score > 0));
  }

  // ---------- Flow helpers ----------
  function toggleHold(i) {
    if (gameOver || paused) return;
    if (i < 0 || i >= DICE || setAside[i]) return;
    held[i] = !held[i];
    sfx("click");
    render();
  }

  function newGame() {
    totalScore = 0;
    turn = 1;
    turnScore = 0;
    held = [false, false, false, false, false, false];
    setAside = [false, false, false, false, false, false];
    dice = [1, 1, 1, 1, 1, 1];
    gameOver = false;
    paused = false;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    startTurn();
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

  function onDiceClick(e) {
    const die = e.target && e.target.closest ? e.target.closest(".die") : null;
    if (!die) return;
    audio.unlock();
    const idx = [...diceEl.children].indexOf(die);
    if (idx < 0) return;
    toggleHold(idx);
  }

  function bindEvents() {
    diceEl.addEventListener("click", onDiceClick);
    rollBtn.addEventListener("click", () => { sfx("click"); roll(); });
    bankBtn.addEventListener("click", () => { sfx("click"); bank(); });
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
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__FARKLE = {
    DICE,
    TARGET,
    MAX_TURNS,
    get dice() { return dice.slice(); },
    get held() { return held.slice(); },
    get setAside() { return setAside.slice(); },
    get turnScore() { return turnScore; },
    get totalScore() { return totalScore; },
    get turn() { return turn; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    stats,
    ACHIEVEMENTS,
    scoreSelection,
    hasScore,
    selectionInfo,
    toggleHold,
    roll,
    bank,
    farkle,
    startTurn,
    endTurn,
    win,
    lose,
    newGame,
    // Test-only: set a deterministic RNG (returns floats in [0,1)).
    setRng: (fn) => { rng = typeof fn === "function" ? fn : Math.random; },
    // Test-only: install a position.
    setState: (s) => {
      s = s || {};
      if (s.dice) dice = s.dice.slice();
      held = s.held ? s.held.slice() : [false, false, false, false, false, false];
      setAside = s.setAside ? s.setAside.slice() : [false, false, false, false, false, false];
      if (Number.isFinite(s.turnScore)) turnScore = s.turnScore;
      if (Number.isFinite(s.totalScore)) totalScore = s.totalScore;
      if (Number.isFinite(s.turn)) turn = s.turn;
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