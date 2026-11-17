// Gomoku (Five in a Row) — pure vanilla JS, fully offline, with a pattern-based AI.
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
  const SIZE = 15;
  const MID = SIZE >> 1;
  const HUMAN = "B"; // black plays first
  const AI = "W"; // white
  const QUICK_MOVES = 20; // a win inside this many of your own stones counts as "quick"
  const AI_DELAY = 250;
  const WIN_SCORE = 1000000;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const HINT_DEFAULT =
    "Click an empty intersection to place your stone (●). Get five in a row. P pauses.";

  const K = makeKeys("gomoku");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
    quickWins: 0, // wins inside QUICK_MOVES of your own stones
    streak: 0,
    bestStreak: 0,
    totalMoves: 0, // every stone placed, by either side
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
    { id: "normal", icon: "🟡", name: "Street Level", desc: "Win on Normal.", stat: "normalWins", goal: 1 },
    { id: "hard", icon: "🟣", name: "Hard Mode", desc: "Win on Hard.", stat: "hardWins", goal: 1 },
    {
      id: "allDiff",
      icon: "🌈",
      name: "All Rounder",
      desc: "Win on Easy, Normal and Hard.",
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
    { id: "quick5", icon: "💨", name: "Lightning", desc: `Win 5 games within ${QUICK_MOVES} of your stones.`, stat: "quickWins", goal: 5 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 games.", stat: "games", goal: 20 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
    { id: "draw1", icon: "🤝", name: "Stalemate", desc: "Draw a game.", stat: "draws", goal: 1 },
    { id: "moves100", icon: "🪨", name: "Stone Layer", desc: "Place 100 stones in total.", stat: "totalMoves", goal: 100 },
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
        ["Stones placed", stats.totalMoves],
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
  let grid, currentTurn, gameOver, paused;
  let currentDiff = "normal";
  let moveCount = 0; // human stones this game
  let aiTimer = null;

  function newGrid() {
    return Array.from({ length: SIZE }, () => new Array(SIZE).fill(""));
  }

  // ---------- Rules ----------
  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function place(g, r, c, p) {
    if (!inside(r, c) || g[r][c] !== "") return false;
    g[r][c] = p;
    return true;
  }

  /** True if placing `p` at (r,c) makes five-or-more in a row through that point. */
  function checkWin(g, r, c, p) {
    for (const [dr, dc] of DIRS) {
      let n = 1;
      let rr = r - dr, cc = c - dc;
      while (inside(rr, cc) && g[rr][cc] === p) { n++; rr -= dr; cc -= dc; }
      rr = r + dr; cc = c + dc;
      while (inside(rr, cc) && g[rr][cc] === p) { n++; rr += dr; cc += dc; }
      if (n >= 5) return true;
    }
    return false;
  }

  function isFull(g) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (g[r][c] === "") return false;
    return true;
  }

  // ---------- AI ----------
  // Score a hypothetical stone of `p` at (r,c) in one direction, based on the
  // length of the run it creates and whether the ends are open.
  function lineScore(g, r, c, dr, dc, p) {
    let count = 1;
    let rr = r - dr, cc = c - dc;
    while (inside(rr, cc) && g[rr][cc] === p) { count++; rr -= dr; cc -= dc; }
    const openStart = inside(rr, cc) && g[rr][cc] === "";
    rr = r + dr; cc = c + dc;
    while (inside(rr, cc) && g[rr][cc] === p) { count++; rr += dr; cc += dc; }
    const openEnd = inside(rr, cc) && g[rr][cc] === "";
    return scoreFor(count, (openStart ? 1 : 0) + (openEnd ? 1 : 0));
  }

  function scoreFor(count, open) {
    if (count >= 5) return WIN_SCORE;
    if (open === 0) return 0;
    if (count === 4) return open === 2 ? 100000 : 10000;
    if (count === 3) return open === 2 ? 5000 : 500;
    if (count === 2) return open === 2 ? 200 : 50;
    return open === 2 ? 10 : 5;
  }

  /** Total pattern score for `p` playing at the empty point (r,c). */
  function pointScore(g, r, c, p) {
    let total = 0;
    for (const [dr, dc] of DIRS) {
      const s = lineScore(g, r, c, dr, dc, p);
      if (s >= WIN_SCORE) return WIN_SCORE; // a win dominates everything
      total += s;
    }
    return total;
  }

  // Empty cells within two steps of any stone (or the centre on an empty board).
  function candidates(g) {
    let any = false;
    for (let r = 0; r < SIZE && !any; r++)
      for (let c = 0; c < SIZE; c++)
        if (g[r][c] !== "") { any = true; break; }
    if (!any) return [[MID, MID]];

    const out = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] !== "") continue;
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr, cc = c + dc;
            if (inside(rr, cc) && g[rr][cc] !== "") { near = true; break; }
          }
        }
        if (near) out.push([r, c]);
      }
    }
    return out;
  }

  // Deterministic, pattern-based AI. Always takes a win, always blocks an
  // immediate loss, otherwise balances offence and (by difficulty) defence.
  function aiChooseMove(g, diff) {
    const d = diff || currentDiff || "normal";
    let best = null;
    let bestScore = -Infinity;

    for (const [r, c] of candidates(g)) {
      const my = pointScore(g, r, c, AI);
      const opp = pointScore(g, r, c, HUMAN);
      const centerBonus = (SIZE - (Math.abs(r - MID) + Math.abs(c - MID))) * 0.01;

      let score;
      if (my >= WIN_SCORE) score = 1e9 + centerBonus; // win now
      else if (opp >= WIN_SCORE) score = 9e8 + centerBonus; // block their win
      else {
        const w = d === "easy" ? 0.15 : d === "hard" ? 1.15 : 0.9;
        score = my + opp * w + centerBonus;
      }

      if (score > bestScore) { bestScore = score; best = [r, c]; }
    }
    return best;
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
    const mv = aiChooseMove(grid, currentDiff);
    if (!mv || !place(grid, mv[0], mv[1], AI)) return endGame("draw");
    stats.totalMoves++;
    saveStats();
    sfx("click");
    render();
    afterMove(AI, mv[0], mv[1]);
  }

  // ---------- Rendering & flow ----------
  function updateHud() {
    turnEl.textContent = currentTurn === HUMAN ? "You" : "CPU";
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${SIZE}, minmax(0, 1fr))`;
    boardEl.style.gridTemplateRows = `repeat(${SIZE}, minmax(0, 1fr))`;
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "gcell";
        const v = grid[r][c];
        if (v !== "") {
          const stone = document.createElement("span");
          stone.className = "stone " + (v === HUMAN ? "stone--you" : "stone--cpu");
          stone.setAttribute("aria-hidden", "true");
          cell.appendChild(stone);
        }
        cell.disabled = v !== "" || gameOver;
        cell.setAttribute(
          "aria-label",
          v === HUMAN ? "Your stone" : v === AI ? "CPU stone" : `Empty, row ${r + 1}, column ${c + 1}`
        );
        boardEl.appendChild(cell);
      }
    }
    updateHud();
  }

  function afterMove(player, r, c) {
    if (checkWin(grid, r, c, player)) return endGame(player);
    if (isFull(grid)) return endGame("draw");
    currentTurn = player === HUMAN ? AI : HUMAN;
    updateHud();
    if (currentTurn === AI) scheduleAi();
  }

  function playCell(r, c) {
    if (gameOver || paused || currentTurn !== HUMAN) return;
    if (!place(grid, r, c, HUMAN)) return;
    moveCount++;
    stats.totalMoves++;
    saveStats();
    sfx("place");
    render();
    afterMove(HUMAN, r, c);
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
      if (moveCount <= QUICK_MOVES) stats.quickWins++;
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
      showOverlay("Draw!", "The board is full — no five in a row.", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else if (result === HUMAN) {
      sfx("win");
      confetti(90);
      const quickMsg = moveCount <= QUICK_MOVES ? ` Fast finish in ${moveCount} stones!` : "";
      showOverlay(
        "You win! 🎉",
        `Five in a row against the CPU. Streak ${stats.streak}.${quickMsg}`,
        [
          { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else {
      sfx("over");
      showOverlay("CPU wins 🤖", "The computer connected five. Better luck next time!", [
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
    currentDiff = aiDiffSel.value || "normal";
    moveCount = 0;
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
    const cell = e.target && e.target.closest ? e.target.closest(".gcell") : null;
    if (!cell) return;
    audio.unlock();
    const idx = [...boardEl.children].indexOf(cell);
    if (idx < 0) return;
    playCell(Math.floor(idx / SIZE), idx % SIZE);
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
  window.__GOMOKU = {
    SIZE,
    MID,
    HUMAN,
    AI,
    QUICK_MOVES,
    get grid() { return grid.map((row) => row.slice()); },
    get turn() { return currentTurn; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get diff() { return currentDiff; },
    get moveCount() { return moveCount; },
    stats,
    ACHIEVEMENTS,
    newGrid,
    inside,
    place,
    checkWin,
    isFull,
    lineScore,
    scoreFor,
    pointScore,
    candidates,
    aiChooseMove,
    playCell,
    aiMove,
    afterMove,
    endGame,
    newGame,
    setDiff,
    // Test-only: install a position (the AI is exercised directly elsewhere;
    // this lets suites verify end-game stat accounting fast).
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