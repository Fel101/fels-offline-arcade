// Minesweeper Variants — pure vanilla JS, fully offline.
// Classic flood-fill reveal, plus a "Saturation" mode where revealing a number
// also reveals every 8-connected neighbour showing the same number.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    util,
    audio,
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
  const mineCountEl = dom.byId("mine-count");
  const timeEl = dom.byId("time");
  const winsEl = dom.byId("wins");
  const difficultySel = dom.byId("difficulty");
  const variantSel = dom.byId("variant");
  const newGameBtn = dom.byId("new-game");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  const K = makeKeys("minesweeper-variants");

  // ---------- Constants ----------
  const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 },
  };

  const NUM_COLORS = {
    1: "#5a9cff", 2: "#6bd66b", 3: "#ff6b6b", 4: "#c67bff",
    5: "#ff9f43", 6: "#58e0c9", 7: "#eee", 8: "#9aa0c8",
  };

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    cells: 0,
    bestBeginner: 0,
    bestIntermediate: 0,
    bestExpert: 0,
    satWins: 0,
    expertWins: 0,
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
  // "Lower is better" time badges. Best-time stats use 0 as "no win yet";
  // a recorded win is always at least 1 second, so a 0-second test win is
  // stored as 1 to keep 0 meaningful. In normal play a win can't be 0s.
  function speedBadge(id, icon, name, desc, limit, key) {
    return {
      id,
      icon,
      name,
      desc,
      stat: key || "bestBeginner",
      goal: limit,
      satisfied: () => {
        const best = stats[key || "bestBeginner"] || 0;
        return best > 0 && best <= limit;
      },
      progress: () => {
        const best = stats[key || "bestBeginner"] || 0;
        if (!best) return { pct: 0, text: "No win yet" };
        if (best <= limit) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (limit / best) * 100), text: `Best ${best}s` };
      },
    };
  }

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Sweep", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🧹", name: "Clean Sweep", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏅", name: "Mine Marshal", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Ten Fields", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "On a Roll", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🚀", name: "Hot Streak", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🌟", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "cells250", icon: "🔍", name: "Sweeper", desc: "Reveal 250 safe cells.", stat: "cells", goal: 250 },
    { id: "cells1000", icon: "🏗️", name: "Excavator", desc: "Reveal 1,000 safe cells.", stat: "cells", goal: 1000 },
    speedBadge("fast120", "⏱️", "Quick Sweep", "Win on Beginner in 120 seconds or less.", 120, "bestBeginner"),
    speedBadge("fast60", "⚡", "Blink Clear", "Win on Beginner in 60 seconds or less.", 60, "bestBeginner"),
    { id: "sat10", icon: "🌈", name: "Saturation Pro", desc: "Win 10 games in Saturation mode.", stat: "satWins", goal: 10 },
    { id: "expert1", icon: "👑", name: "Expert Sweeper", desc: "Clear an Expert field.", stat: "expertWins", goal: 1 },
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
        ["Games", stats.games],
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Best streak", stats.bestStreak],
        ["Cells revealed", stats.cells],
        ["Best beginner", stats.bestBeginner ? `${stats.bestBeginner}s` : "—"],
        ["Saturation wins", stats.satWins],
        ["Expert wins", stats.expertWins || 0],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) setPaused(true);
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
  audio.define("reveal", [[520, 0, 0.04, "triangle", 0.03]]);
  audio.define("flag", [[300, 0, 0.05, "square", 0.035]]);
  audio.define("boom", [
    [140, 0, 0.14, "sawtooth", 0.06],
    [90, 0.12, 0.24, "sawtooth", 0.06],
  ]);

  // ---------- State ----------
  let cfg;
  let cells;
  let revealedCount;
  let flagsPlaced;
  let startTime;
  let timerId;
  let running;
  let gameOver;
  let paused;
  let resumeRunning;
  let gamesRecorded;

  // ---------- Board ----------
  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    const cellSize = cfg.cols > 20 ? 26 : 30;
    boardEl.dataset.cell = String(cellSize);
    for (let r = 0; r < cfg.rows; r++) {
      cells[r] = [];
      for (let c = 0; c < cfg.cols; c++) {
        const btn = document.createElement("button");
        btn.className = "cell ms-cell";
        btn.type = "button";
        btn.style.width = "100%";
        btn.style.aspectRatio = "1";
        btn.style.fontSize = "1rem";
        btn.dataset.r = r;
        btn.dataset.c = c;
        btn.addEventListener("click", () => reveal(r, c));
        btn.addEventListener("contextmenu", (e) => {
          if (e.preventDefault) e.preventDefault();
          toggleFlag(r, c);
        });
        boardEl.appendChild(btn);
        cells[r][c] = { btn, mine: false, revealed: false, flagged: false, adj: 0 };
      }
    }
  }

  function neighbours(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols) out.push([nr, nc]);
      }
    }
    return out;
  }

  function placeMines(safeR, safeC) {
    // Build every cell except the 3x3 safe zone, shuffle, take the first N.
    // Unlike a retry loop this always terminates, even with a constant RNG
    // (which the test harnesses use).
    const candidates = [];
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        candidates.push([r, c]);
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    const total = Math.min(cfg.mines, candidates.length);
    for (let i = 0; i < total; i++) {
      cells[candidates[i][0]][candidates[i][1]].mine = true;
    }
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        cells[r][c].adj = neighbours(r, c).filter(([nr, nc]) => cells[nr][nc].mine).length;
      }
    }
  }

  function startTimer() {
    startTime = Date.now();
    if (timerId) {
      try {
        clearInterval(timerId);
      } catch {
        /* ignore */
      }
    }
    timerId = setInterval(() => {
      timeEl.textContent = util.formatTime(Date.now() - startTime);
    }, 500);
  }

  function stopTimer() {
    if (timerId) {
      try {
        clearInterval(timerId);
      } catch {
        /* ignore */
      }
      timerId = 0;
    }
  }

  function elapsedSeconds() {
    if (!startTime) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  }

  function reveal(r, c) {
    if (gameOver || paused || !cells[r] || !cells[r][c]) return;
    const cell = cells[r][c];
    if (cell.revealed || cell.flagged) return;
    if (!running) {
      placeMines(r, c);
      running = true;
      recordGameStart();
      startTimer();
    }
    if (cell.mine) {
      lose(r, c);
      return;
    }

    const revealedBefore = revealedCount;
    if (variantSel.value === "saturation") saturationReveal(r, c);
    else floodReveal(r, c);
    stats.cells += revealedCount - revealedBefore;
    saveStats();
    sfx("reveal");
    checkWin();
  }

  // Classic: reveal the clicked cell; when it has no adjacent mines, cascade.
  function floodReveal(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [nr, nc] = stack.pop();
      const cell = cells[nr][nc];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      revealedCount++;
      renderCell(nr, nc);
      if (cell.adj === 0) {
        for (const [br, bc] of neighbours(nr, nc)) {
          if (!cells[br][bc].revealed) stack.push([br, bc]);
        }
      }
    }
  }

  // Saturation: reveal the clicked cell and every 8-connected neighbour with the
  // same number. An empty (0) cell cascades like the classic mode.
  function saturationReveal(r, c) {
    const val = cells[r][c].adj;
    if (val === 0) {
      floodReveal(r, c);
      return;
    }
    const stack = [[r, c]];
    const seen = new Set([r + "," + c]);
    while (stack.length) {
      const [nr, nc] = stack.pop();
      const cell = cells[nr][nc];
      if (cell.revealed || cell.flagged || cell.mine || cell.adj !== val) continue;
      cell.revealed = true;
      revealedCount++;
      renderCell(nr, nc);
      for (const [br, bc] of neighbours(nr, nc)) {
        const key = br + "," + bc;
        if (seen.has(key)) continue;
        if (cells[br][bc].adj !== val) continue;
        seen.add(key);
        stack.push([br, bc]);
      }
    }
  }

  function toggleFlag(r, c) {
    if (gameOver || paused || !cells[r] || !cells[r][c]) return;
    const cell = cells[r][c];
    if (cell.revealed) return;
    if (!running) {
      placeMines(r, c);
      running = true;
      recordGameStart();
      startTimer();
    }
    cell.flagged = !cell.flagged;
    cell.btn.textContent = cell.flagged ? "🚩" : "";
    flagsPlaced += cell.flagged ? 1 : -1;
    mineCountEl.textContent = cfg.mines - flagsPlaced;
    sfx("flag");
  }

  function renderCell(r, c) {
    const cell = cells[r][c];
    cell.btn.disabled = true;
    if (cell.adj > 0) {
      cell.btn.textContent = cell.adj;
      cell.btn.style.color = NUM_COLORS[cell.adj];
    }
  }

  function lose(r, c) {
    gameOver = true;
    running = false;
    stopTimer();
    stats.losses++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    updateStatus();
    cells[r][c].btn.textContent = "💣";
    cells[r][c].btn.style.background = "#ff6b6b";
    for (let i = 0; i < cfg.rows; i++) {
      for (let j = 0; j < cfg.cols; j++) {
        const cell = cells[i][j];
        if (cell.mine && !cell.flagged) {
          cell.btn.textContent = "💣";
          cell.btn.disabled = true;
        } else if (!cell.mine && cell.flagged) {
          cell.btn.textContent = "❌";
        }
      }
    }
    sfx("boom");
    showOverlay("Boom! 💣", "You hit a mine.", [
      { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  function checkWin() {
    if (revealedCount === cfg.rows * cfg.cols - cfg.mines) {
      gameOver = true;
      running = false;
      stopTimer();
      win();
    }
  }

  function win() {
    const secs = elapsedSeconds();
    const diff = difficultySel.value;
    const isSat = variantSel.value === "saturation";

    stats.wins++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    if (isSat) stats.satWins++;
    if (diff === "expert") stats.expertWins = (stats.expertWins || 0) + 1;

    let isRecord = false;
    const bestKey =
      diff === "beginner" ? "bestBeginner" : diff === "intermediate" ? "bestIntermediate" : "bestExpert";
    // Store seconds with a floor of 1 so 0 always means "no win yet" and the
    // "lower is better" badges stay well-defined.
    const recorded = Math.max(1, secs);
    if (!stats[bestKey] || recorded < stats[bestKey]) {
      stats[bestKey] = recorded;
      isRecord = true;
    }

    saveStats();
    checkAchievements();
    updateStatus();
    sfx("win");
    confetti(isRecord ? 90 : 60);
    showOverlay(
      "You Win! 🎉",
      `Cleared the ${diff} ${variantSel.value} field in ${util.formatTime(secs * 1000)}.` +
        (isRecord ? " New best!" : ""),
      [
        { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
  }

  // A game counts as played as soon as the first cell is opened or flagged.
  function recordGameStart() {
    if (gamesRecorded) return;
    gamesRecorded = true;
    stats.games++;
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function reset() {
    stopTimer();
    cfg = DIFFICULTIES[difficultySel.value] || DIFFICULTIES.beginner;
    cells = [];
    revealedCount = 0;
    flagsPlaced = 0;
    gameOver = false;
    running = false;
    paused = false;
    resumeRunning = false;
    gamesRecorded = false;
    startTime = 0;
    timeEl.textContent = "0";
    mineCountEl.textContent = cfg.mines;
    hideOverlay();
    buildBoard();
    updateStatus();
  }

  // ---- Pause ----
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return false;
    paused = p;
    if (p) {
      resumeRunning = running;
      stopTimer();
      showOverlay("Paused", "The field is on hold — press Esc or P to resume.", [
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
      if (resumeRunning && !gameOver) {
        running = true;
        startTimer();
      }
    }
    return true;
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---- Input ----
  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    newGameBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset();
    });
    difficultySel.addEventListener("change", () => {
      reset();
    });
    variantSel.addEventListener("change", () => {
      reset();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2)
      badges2.addEventListener("click", () => {
        sfx("click");
        openAchv();
      });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---- Init ----
  function init() {
    updateBadgeCount();
    bindEvents();
    reset();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__MINESWEEPER = {
    DIFFICULTIES,
    ACHIEVEMENTS,
    stats,
    get cfg() {
      return cfg ? Object.assign({}, cfg) : null;
    },
    get revealedCount() {
      return revealedCount;
    },
    get flagsPlaced() {
      return flagsPlaced;
    },
    get running() {
      return running;
    },
    get gameOver() {
      return gameOver;
    },
    get paused() {
      return paused;
    },
    get gamesRecorded() {
      return gamesRecorded;
    },
    snap: () => ({
      cfg: cfg ? Object.assign({}, cfg) : null,
      revealedCount,
      flagsPlaced,
      running,
      gameOver,
      paused,
      gamesRecorded,
      mineCount: mineCountEl.textContent,
      time: timeEl.textContent,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    cells: () => cells.map((row) => row.map((cell) => ({ mine: cell.mine, adj: cell.adj, revealed: cell.revealed, flagged: cell.flagged }))),
    cell: (r, c) => (cells[r] && cells[r][c] ? { mine: cells[r][c].mine, adj: cells[r][c].adj, revealed: cells[r][c].revealed, flagged: cells[r][c].flagged } : null),
    neighbours,
    placeMines,
    floodReveal,
    saturationReveal,
    reveal,
    toggleFlag,
    reset,
    newGame: reset,
    lose,
    checkWin,
    setPaused,
    togglePause,
    setVariant(v) {
      variantSel.value = v;
      reset();
    },
    setDifficulty(d) {
      difficultySel.value = d;
      reset();
    },
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
  };

  init();
})();