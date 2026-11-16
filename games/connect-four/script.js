// Connect Four — pure vanilla JS, fully offline, with minimax AI.
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
  const ROWS = 6, COLS = 7;
  const HUMAN = "R", AI = "Y";
  const DIFF_NAMES = { "4": "easy", "6": "normal", "8": "hard" };
  const FAST_MOVES = 12; // a win inside this many of your own drops counts as "fast"
  const AI_DELAY = 250;
  const HINT_DEFAULT = "Click a column to drop your disc (🔴). Get four in a row. P pauses.";

  const K = makeKeys("connect-four");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
    fastWins: 0, // wins inside FAST_MOVES of your own drops
    streak: 0,
    bestStreak: 0,
    totalMoves: 0, // every disc dropped, by either side
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
    { id: "easy", icon: "🟢", name: "Warm-Up", desc: "Win on Easy.", stat: "easyWins", goal: 1 },
    { id: "normal", icon: "🟡", name: "Street Level", desc: "Win on Medium.", stat: "normalWins", goal: 1 },
    { id: "hard", icon: "🟣", name: "Hard Mode", desc: "Win on Hard.", stat: "hardWins", goal: 1 },
    {
      id: "allDiff",
      icon: "🌈",
      name: "All Rounder",
      desc: "Win on Easy, Medium and Hard.",
      stat: "wins",
      goal: 1,
      satisfied: () => stats.easyWins >= 1 && stats.normalWins >= 1 && stats.hardWins >= 1,
      progress: () => {
        const got = [stats.easyWins >= 1, stats.normalWins >= 1, stats.hardWins >= 1].filter(Boolean).length;
        return {
          pct: (got / 3) * 100,
          now: got,
          text: got === 3 ? "Unlocked" : got + " / 3 difficulties",
        };
      },
    },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "fast5", icon: "💨", name: "Lightning", desc: `Win 5 games within ${FAST_MOVES} of your drops.`, stat: "fastWins", goal: 5 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 games.", stat: "games", goal: 20 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
    { id: "draw1", icon: "🤝", name: "Stalemate", desc: "Draw a game.", stat: "draws", goal: 1 },
    { id: "moves100", icon: "💧", name: "Dropper", desc: "Drop 100 discs in total.", stat: "totalMoves", goal: 100 },
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
        ["Discs dropped", stats.totalMoves],
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
  let grid, currentTurn, gameOver, aiDepth;
  let currentDiff = "normal";
  let paused = false;
  let moveCount = 0; // human drops this game
  let aiTimer = null;

  function newGrid() { return Array.from({ length: ROWS }, () => new Array(COLS).fill("")); }

  function centerFirst() { return [3, 2, 4, 1, 5, 0, 6]; }

  // ---------- Rules ----------
  function valid(col) { return grid[0][col] === ""; }
  function full(g) { return g[0].every((c) => c !== ""); }

  function drop(g, col, p) {
    for (let r = ROWS - 1; r >= 0; r--) if (g[r][col] === "") { g[r][col] = p; return r; }
    return -1;
  }

  function won(g, p) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== p) continue;
        for (const [dr, dc] of dirs) {
          let count = 1;
          for (let k = 1; k < 4; k++) {
            const nr = r + dr * k, nc = c + dc * k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || g[nr][nc] !== p) break;
            count++;
          }
          if (count === 4) return true;
        }
      }
    }
    return false;
  }

  function getWinner(g) {
    if (won(g, AI)) return AI;
    if (won(g, HUMAN)) return HUMAN;
    return null;
  }

  // ---------- AI ----------
  // Heuristic evaluation of non-terminal positions.
  function evaluate(g) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      if (g[r][3] === AI) score += 3;
      else if (g[r][3] === HUMAN) score -= 3;
    }
    const windows = [];
    // horizontal
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r][c + 1], g[r][c + 2], g[r][c + 3]]);
    // vertical
    for (let r = 0; r <= ROWS - 4; r++)
      for (let c = 0; c < COLS; c++)
        windows.push([g[r][c], g[r + 1][c], g[r + 2][c], g[r + 3][c]]);
    // diagonals
    for (let r = 0; r <= ROWS - 4; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r + 1][c + 1], g[r + 2][c + 2], g[r + 3][c + 3]]);
    for (let r = 3; r < ROWS; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r - 1][c + 1], g[r - 2][c + 2], g[r - 3][c + 3]]);

    for (const w of windows) {
      const ai = w.filter((x) => x === AI).length;
      const hu = w.filter((x) => x === HUMAN).length;
      if (hu === 0 && ai) score += ai * ai;
      else if (ai === 0 && hu) score -= hu * hu;
    }
    return score;
  }

  function minimax(g, depth, alpha, beta, maximizing) {
    const w = getWinner(g);
    if (w === AI) return 100000 + depth;
    if (w === HUMAN) return -100000 - depth;
    if (full(g)) return 0;
    if (depth === 0) return evaluate(g);

    const order = centerFirst();
    if (maximizing) {
      let best = -Infinity;
      for (const col of order) {
        if (!validCol(g, col)) continue;
        const r = drop(g, col, AI);
        best = Math.max(best, minimax(g, depth - 1, alpha, beta, false));
        g[r][col] = "";
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const col of order) {
        if (!validCol(g, col)) continue;
        const r = drop(g, col, HUMAN);
        best = Math.min(best, minimax(g, depth - 1, alpha, beta, true));
        g[r][col] = "";
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function validCol(g, col) { return g[0][col] === ""; }

  /** Best column for the AI on `g` (ties go to the most central column). */
  function chooseAiColumn(g, depth) {
    const d = depth === undefined ? aiDepth : depth;
    let bestScore = -Infinity, bestCol = -1;
    for (const col of centerFirst()) {
      if (!validCol(g, col)) continue;
      const r = drop(g, col, AI);
      const score = minimax(g, d - 1, -Infinity, Infinity, false);
      g[r][col] = "";
      if (score > bestScore) { bestScore = score; bestCol = col; }
    }
    return bestCol;
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
    if (gameOver || paused || currentTurn !== AI) return;
    const col = chooseAiColumn(grid);
    if (col === -1) return;
    const r = drop(grid, col, AI);
    stats.totalMoves++;
    saveStats();
    sfx("click");
    render();
    afterMove(AI, col, r);
  }

  // ---------- Rendering & flow ----------
  function updateHud() {
    turnEl.textContent = currentTurn === HUMAN ? "You" : "CPU";
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.style.width = "46px";
        cell.style.height = "46px";
        cell.style.fontSize = "1.5rem";
        cell.textContent = grid[r][c] === HUMAN ? "🔴" : grid[r][c] === AI ? "🟡" : "";
        cell.setAttribute("aria-label", grid[r][c] === HUMAN ? "Red disc" : grid[r][c] === AI ? "Yellow disc" : "Empty cell");
        boardEl.appendChild(cell);
      }
    }
    updateHud();
  }

  function afterMove(player, col, row) {
    const w = getWinner(grid);
    if (w) return endGame(w);
    if (full(grid)) return endGame("draw");
    currentTurn = player === HUMAN ? AI : HUMAN;
    updateHud();
    if (currentTurn === AI) scheduleAi();
  }

  function playColumn(col) {
    if (gameOver || paused || currentTurn !== HUMAN) return;
    if (!valid(col)) return;
    const r = drop(grid, col, HUMAN);
    moveCount++;
    stats.totalMoves++;
    saveStats();
    sfx("place");
    render();
    afterMove(HUMAN, col, r);
  }

  function endGame(result) {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    clearAiTimer();
    stats.games++;
    if (result === "draw") {
      stats.draws++;
      stats.streak = 0;
    } else if (result === HUMAN) {
      stats.wins++;
      if (currentDiff === "easy") stats.easyWins++;
      else if (currentDiff === "hard") stats.hardWins++;
      else stats.normalWins++;
      if (moveCount <= FAST_MOVES) stats.fastWins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();

    if (result === "draw") {
      sfx("hint");
      showOverlay("Draw!", "The board is full. Nobody connected four.", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else if (result === HUMAN) {
      sfx("win");
      confetti(90);
      const fastMsg = moveCount <= FAST_MOVES ? ` Fast finish in ${moveCount} drops!` : "";
      showOverlay(
        "You win! 🎉",
        `Four in a row against the CPU. Streak ${stats.streak}.${fastMsg}`,
        [
          { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else {
      sfx("over");
      showOverlay("CPU wins 🤖", "Four in a row for the computer. Better luck next time!", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
  }

  function newGame() {
    clearAiTimer();
    grid = newGrid();
    currentTurn = HUMAN;
    gameOver = false;
    paused = false;
    aiDepth = parseInt(aiDiffSel.value, 10) || 6;
    currentDiff = DIFF_NAMES[aiDiffSel.value] || "normal";
    moveCount = 0;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function setDiff(name) {
    const map = { easy: "4", normal: "6", hard: "8" };
    aiDiffSel.value = map[name] || String(name);
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
      if (currentTurn === AI && !gameOver) scheduleAi();
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
    const cell = e.target && e.target.closest ? e.target.closest(".cell") : null;
    if (!cell) return;
    audio.unlock();
    const idx = [...boardEl.children].indexOf(cell);
    if (idx >= 0) playColumn(idx % COLS);
  }

  function bindEvents() {
    boardEl.addEventListener("click", onBoardClick);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    aiDiffSel.addEventListener("change", () => { sfx("click"); newGame(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
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
  window.__CONNECT4 = {
    ROWS,
    COLS,
    HUMAN,
    AI,
    get grid() { return grid.map((r) => r.slice()); },
    get turn() { return currentTurn; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get aiDepth() { return aiDepth; },
    get diff() { return currentDiff; },
    get moveCount() { return moveCount; },
    stats,
    ACHIEVEMENTS,
    newGrid,
    centerFirst,
    valid,
    full,
    drop,
    won,
    getWinner,
    evaluate,
    minimax,
    chooseAiColumn,
    playColumn,
    aiMove,
    afterMove,
    endGame,
    newGame,
    setDiff,
    // Test-only: install a position (the AI/minimax are exercised directly
    // elsewhere; this lets suites verify end-game stat accounting fast).
    setState: (g, turn) => {
      grid = g.map((row) => row.slice());
      currentTurn = turn || HUMAN;
      gameOver = false;
      paused = false;
      moveCount = 0;
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
