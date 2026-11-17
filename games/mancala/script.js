// Mancala (Kalah) — pure vanilla JS, fully offline, with a minimax AI.
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
  const boardEl = dom.byId("board");
  const turnEl = dom.byId("turn");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const aiDiffSel = dom.byId("ai-diff");
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
  const SOUTH = "S"; // human, bottom row
  const NORTH = "N"; // CPU, top row
  const SOUTH_STORE = 6;
  const NORTH_STORE = 13;
  const START_STONES = 4;
  const PITS_PER_SIDE = 6;
  const AI_DELAY = 300;
  const DIFF_DEPTH = { easy: 1, normal: 4, hard: 7 };
  const HINT_DEFAULT =
    "Pick one of your pits (bottom row) to sow its stones. Land in your store for another turn. P pauses.";

  const K = makeKeys("mancala");

  function storeOf(player) { return player === SOUTH ? SOUTH_STORE : NORTH_STORE; }
  function oppStoreOf(player) { return player === SOUTH ? NORTH_STORE : SOUTH_STORE; }
  function other(player) { return player === SOUTH ? NORTH : SOUTH; }
  function isMyPit(player, i) {
    return player === SOUTH ? i >= 0 && i < PITS_PER_SIDE : i > SOUTH_STORE && i < NORTH_STORE;
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    captures: 0, // stones the human captured
    biggestCapture: 0, // most stones captured in a single move
    shutouts: 0, // wins where the CPU finishes on 0
    totalMoves: 0, // every move made, by either side
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

  // This game never had a pre-core save format — nothing to migrate.
  function migrateLegacy() {
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "captures25", icon: "💎", name: "Gatherer", desc: "Capture 25 stones in total.", stat: "captures", goal: 25 },
    { id: "bigCapture", icon: "🪙", name: "Big Haul", desc: "Capture 10+ stones in one move.", stat: "biggestCapture", goal: 10 },
    { id: "shutout1", icon: "🧱", name: "Shutout", desc: "Win with the CPU on 0.", stat: "shutouts", goal: 1 },
    { id: "shutout3", icon: "🏰", name: "Fortress", desc: "Win 3 games by a shutout.", stat: "shutouts", goal: 3 },
    { id: "moves100", icon: "🔄", name: "Sower", desc: "Make 100 moves in total.", stat: "totalMoves", goal: 100 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
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
        ["Draws", stats.draws],
        ["Best streak", stats.bestStreak],
        ["Stones captured", stats.captures],
        ["Biggest capture", stats.biggestCapture],
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
  let board, currentTurn, gameOver, paused;
  let currentDiff = "normal";
  let aiTimer = null;

  function initialBoard() {
    const b = new Array(14).fill(0);
    for (let i = 0; i < 14; i++) {
      if (i === SOUTH_STORE || i === NORTH_STORE) b[i] = 0;
      else b[i] = START_STONES;
    }
    return b;
    // (pits 0-5 and 7-12 get START_STONES; both stores start empty)
  }

  // ---------- Rules ----------
  function southEmpty(b) {
    for (let i = 0; i < PITS_PER_SIDE; i++) if (b[i] > 0) return false;
    return true;
  }
  function northEmpty(b) {
    for (let i = SOUTH_STORE + 1; i < NORTH_STORE; i++) if (b[i] > 0) return false;
    return true;
  }
  function isGameOver(b) {
    return southEmpty(b) || northEmpty(b);
  }

  function collectRemaining(b) {
    for (let i = 0; i < PITS_PER_SIDE; i++) { b[SOUTH_STORE] += b[i]; b[i] = 0; }
    for (let i = SOUTH_STORE + 1; i < NORTH_STORE; i++) { b[NORTH_STORE] += b[i]; b[i] = 0; }
  }

  function legalMoves(b, player) {
    const out = [];
    const lo = player === SOUTH ? 0 : SOUTH_STORE + 1;
    const hi = player === SOUTH ? PITS_PER_SIDE : NORTH_STORE;
    for (let i = lo; i < hi; i++) if (b[i] > 0) out.push(i);
    return out;
  }

  /**
   * Sow `player`'s stones from `pit`, applying captures and extra turns.
   * Mutates `b` and returns { extra, gameOver, captured }.
   */
  function applyMove(b, player, pit) {
    const myStore = storeOf(player);
    const oppStore = oppStoreOf(player);
    if (b[pit] <= 0) return { extra: false, gameOver: isGameOver(b), captured: 0 };

    let stones = b[pit];
    b[pit] = 0;
    let i = pit;
    while (stones > 0) {
      i = (i + 1) % 14;
      if (i === oppStore) continue; // skip the opponent's store
      b[i]++;
      stones--;
    }

    let captured = 0;
    if (isMyPit(player, i) && b[i] === 1) {
      const opp = 12 - i; // opposite pit
      if (b[opp] > 0) {
        captured = b[i] + b[opp];
        b[myStore] += captured;
        b[i] = 0;
        b[opp] = 0;
      }
    }

    const extra = i === myStore;
    let gameOver = false;
    if (isGameOver(b)) {
      collectRemaining(b);
      gameOver = true;
    }
    return { extra, gameOver, captured };
  }

  // ---------- AI ----------
  function finalScore(b, player) {
    return b[storeOf(player)] - b[storeOf(other(player))];
  }

  // Negamax from `player`'s perspective, with support for extra turns.
  function negamax(b, player, depth, alpha, beta) {
    if (isGameOver(b)) return finalScore(b, player);
    if (depth <= 0) return finalScore(b, player);
    const moves = legalMoves(b, player);
    if (moves.length === 0) return finalScore(b, player);

    let best = -Infinity;
    for (const m of moves) {
      const nb = b.slice();
      const res = applyMove(nb, player, m);
      let score;
      if (res.gameOver) score = finalScore(nb, player);
      else if (res.extra) score = negamax(nb, player, depth - 1, alpha, beta);
      else score = -negamax(nb, other(player), depth - 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Deterministic minimax: ties go to the lowest pit index.
  function chooseAiMove(b, diff) {
    const depth = DIFF_DEPTH[diff] || DIFF_DEPTH.normal;
    let best = -Infinity;
    let bestMove = null;
    for (const m of legalMoves(b, NORTH)) {
      const nb = b.slice();
      const res = applyMove(nb, NORTH, m);
      let score;
      if (res.gameOver) score = finalScore(nb, NORTH);
      else if (res.extra) score = negamax(nb, NORTH, depth - 1, -Infinity, Infinity);
      else score = -negamax(nb, SOUTH, depth - 1, -Infinity, Infinity);
      if (score > best) { best = score; bestMove = m; }
    }
    return bestMove;
  }

  function clearAiTimer() {
    if (aiTimer) {
      window.clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function scheduleAi() {
    clearAiTimer();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      aiMove();
    }, AI_DELAY);
  }

  function aiMove() {
    if (gameOver || paused || currentTurn !== NORTH) return;
    const mv = chooseAiMove(board, currentDiff);
    if (mv == null || board[mv] <= 0) return endGame();
    const res = applyMove(board, NORTH, mv);
    stats.totalMoves++;
    saveStats();
    sfx("click");
    render();
    afterMove(NORTH, res);
  }

  // ---------- Rendering & flow ----------
  function updateHud() {
    turnEl.textContent = gameOver ? "Game over" : currentTurn === SOUTH ? "Your move" : "CPU thinking";
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function makeStore(idx, label, mine) {
    const s = document.createElement("div");
    s.className = "store " + (mine ? "store--you" : "store--cpu");
    s.setAttribute("data-store", String(idx));
    const count = document.createElement("span");
    count.className = "store__count";
    count.textContent = board[idx];
    const small = document.createElement("small");
    small.textContent = label;
    s.appendChild(count);
    s.appendChild(small);
    return s;
  }

  function render() {
    boardEl.innerHTML = "";

    // CPU store (left)
    boardEl.appendChild(makeStore(NORTH_STORE, "CPU", false));

    // Pits: top row (CPU) right-to-left, then bottom row (human) left-to-right
    const pits = document.createElement("div");
    pits.className = "pits";
    const order = [12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5];
    for (const idx of order) {
      const mine = idx < PITS_PER_SIDE;
      const n = board[idx];
      const pit = document.createElement("button");
      pit.type = "button";
      pit.className = "pit " + (mine ? "pit--you" : "pit--cpu") + (n === 0 ? " pit--empty" : "");
      pit.setAttribute("data-pit", String(idx));
      pit.textContent = n;
      pit.disabled = gameOver || paused || !mine || currentTurn !== SOUTH || n === 0;
      pit.setAttribute(
        "aria-label",
        `${mine ? "Your" : "CPU"} pit ${mine ? idx + 1 : 13 - idx}: ${n} stone${n === 1 ? "" : "s"}`
      );
      pits.appendChild(pit);
    }
    boardEl.appendChild(pits);

    // Human store (right)
    boardEl.appendChild(makeStore(SOUTH_STORE, "You", true));

    updateHud();
  }

  function afterMove(player, res) {
    if (res.gameOver) return endGame();
    if (res.extra) {
      // Same player moves again.
      if (player === NORTH) scheduleAi();
      else updateHud();
      return;
    }
    currentTurn = player === SOUTH ? NORTH : SOUTH;
    updateHud();
    if (currentTurn === NORTH) scheduleAi();
  }

  function playPit(idx) {
    if (gameOver || paused || currentTurn !== SOUTH) return;
    if (idx < 0 || idx >= PITS_PER_SIDE || board[idx] <= 0) return;
    const res = applyMove(board, SOUTH, idx);
    stats.totalMoves++;
    stats.captures += res.captured;
    if (res.captured > stats.biggestCapture) stats.biggestCapture = res.captured;
    saveStats();
    sfx("place");
    render();
    afterMove(SOUTH, res);
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    clearAiTimer();

    const you = board[SOUTH_STORE];
    const cpu = board[NORTH_STORE];
    stats.games++;
    if (you > cpu) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (cpu === 0) stats.shutouts++;
    } else if (cpu > you) {
      stats.losses++;
      stats.streak = 0;
    } else {
      stats.draws++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();

    if (you > cpu) {
      sfx("win");
      confetti(90);
      const shut = cpu === 0 ? " A shutout!" : "";
      showOverlay("You win! 🎉", `Final score ${you} – ${cpu}. Streak ${stats.streak}.${shut}`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else if (cpu > you) {
      sfx("over");
      showOverlay("CPU wins 🤖", `Final score ${you} – ${cpu}. Better luck next time!`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      sfx("hint");
      showOverlay("Draw!", `Both stores finished on ${you}.`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
  }

  function newGame() {
    clearAiTimer();
    board = initialBoard();
    currentTurn = SOUTH;
    gameOver = false;
    paused = false;
    currentDiff = aiDiffSel.value || "normal";
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function setDiff(name) {
    aiDiffSel.value = name;
    newGame();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
      if (currentTurn === NORTH && !gameOver) scheduleAi();
    }
    updateHud();
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

  function onBoardClick(e) {
    const pit = e.target && e.target.closest ? e.target.closest(".pit") : null;
    if (!pit) return;
    audio.unlock();
    const idx = parseInt(pit.getAttribute("data-pit"), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= PITS_PER_SIDE) return;
    playPit(idx);
  }

  function bindEvents() {
    boardEl.addEventListener("click", onBoardClick);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    aiDiffSel.addEventListener("change", () => { sfx("click"); newGame(); });

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
  window.__MANCALA = {
    SOUTH,
    NORTH,
    SOUTH_STORE,
    NORTH_STORE,
    START_STONES,
    get board() { return board.slice(); },
    get turn() { return currentTurn; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get diff() { return currentDiff; },
    stats,
    ACHIEVEMENTS,
    initialBoard,
    storeOf,
    oppStoreOf,
    other,
    isMyPit,
    southEmpty,
    northEmpty,
    isGameOver,
    collectRemaining,
    legalMoves,
    applyMove,
    finalScore,
    negamax,
    chooseAiMove,
    playPit,
    aiMove,
    afterMove,
    endGame,
    newGame,
    setDiff,
    // Test-only: install a position.
    setState: (b, turn) => {
      board = b.slice();
      currentTurn = turn || SOUTH;
      gameOver = false;
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