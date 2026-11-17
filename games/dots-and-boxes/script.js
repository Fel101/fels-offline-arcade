// Dots & Boxes — pure vanilla JS, offline, greedy-with-avoidance AI.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
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
  const youScoreEl = dom.byId("you-score");
  const cpuScoreEl = dom.byId("cpu-score");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const turnLabel = dom.byId("turn-label");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  const K = makeKeys("dots-and-boxes");

  const DOTS = 5;
  const BOXES = 4;
  const TOTAL_BOXES = BOXES * BOXES;
  const AI_DELAY = 550;

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    boxes: 0,
    boxesBest: 0,
    shutouts: 0,
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

  // The pre-core build only kept a win count.
  function migrateLegacy() {
    const raw = store.get("dots-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("dots-wins");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Box", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "📦", name: "Box Collector", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏅", name: "Grid Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Ten Grids", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "On a Roll", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🚀", name: "Hot Streak", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🌟", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "boxes50", icon: "🧱", name: "Brick Layer", desc: "Claim 50 boxes in total.", stat: "boxes", goal: 50 },
    { id: "boxes150", icon: "🏗️", name: "Master Builder", desc: "Claim 150 boxes in total.", stat: "boxes", goal: 150 },
    { id: "shutout1", icon: "🧼", name: "Clean Sheet", desc: "Win without conceding a box.", stat: "shutouts", goal: 1 },
    { id: "shutout3", icon: "🛡️", name: "Lockdown", desc: "Win 3 games without conceding a box.", stat: "shutouts", goal: 3 },
    { id: "big12", icon: "🗺️", name: "Land Grab", desc: "Claim 12 boxes in one game.", stat: "boxesBest", goal: 12 },
    { id: "big16", icon: "👑", name: "Perfection", desc: "Claim all 16 boxes in one game.", stat: "boxesBest", goal: 16 },
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
        ["Draws", stats.draws],
        ["Best streak", stats.bestStreak],
        ["Boxes", stats.boxes],
        ["Best game", stats.boxesBest],
        ["Shutouts", stats.shutouts],
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
  audio.define("line", [[320, 0, 0.045, "triangle", 0.03]]);
  audio.define("box", [[440, 0, 0.06, "triangle", 0.04], [660, 0.06, 0.1, "triangle", 0.04]]);

  // ---------- State ----------
  let hLines;
  let vLines;
  let boxes;
  let scores;
  let turn;
  let gameOver;
  let busy;
  let paused;
  let cpuEnabled = true;
  let aiPending = false;
  let aiTimer = 0;

  const hBtns = [];
  const vBtns = [];
  const boxEls = [];

  // Build the 9x9 grid explicitly: dot/line/dot pattern.
  function buildGrid9x9() {
    boardEl.innerHTML = "";
    hBtns.length = 0;
    vBtns.length = 0;
    boxEls.length = 0;
    for (let gr = 0; gr < 9; gr++) {
      if (gr % 2 === 0) hBtns.push(new Array(BOXES).fill(null));
      else vBtns.push(new Array(DOTS).fill(null));
      if (gr % 2 === 1) boxEls.push(new Array(BOXES).fill(null));
      const dotRow = gr / 2;
      const boxRow = (gr - 1) / 2;
      for (let gc = 0; gc < 9; gc++) {
        const dotCol = gc / 2;
        const boxCol = (gc - 1) / 2;
        if (gr % 2 === 0 && gc % 2 === 0) {
          const dot = document.createElement("div");
          dot.className = "dot";
          boardEl.appendChild(dot);
        } else if (gr % 2 === 0 && gc % 2 === 1) {
          const line = document.createElement("button");
          line.className = "line line--h";
          line.type = "button";
          line.setAttribute(
            "aria-label",
            `Horizontal line row ${dotRow + 1}, segment ${boxCol + 1}`
          );
          line.innerHTML = '<div class="line__bar"></div>';
          line.addEventListener("click", () => humanClaim("h", dotRow, boxCol));
          boardEl.appendChild(line);
          hBtns[dotRow][boxCol] = line;
        } else if (gr % 2 === 1 && gc % 2 === 0) {
          const line = document.createElement("button");
          line.className = "line line--v";
          line.type = "button";
          line.setAttribute("aria-label", `Vertical line col ${dotCol + 1}, segment ${boxRow + 1}`);
          line.innerHTML = '<div class="line__bar"></div>';
          line.addEventListener("click", () => humanClaim("v", boxRow, dotCol));
          boardEl.appendChild(line);
          vBtns[boxRow][dotCol] = line;
        } else {
          const box = document.createElement("div");
          box.className = "box";
          box.textContent = "·";
          boardEl.appendChild(box);
          boxEls[boxRow][boxCol] = box;
        }
      }
    }
  }

  function boxSides(br, bc) {
    let n = 0;
    if (hLines[br][bc]) n++;
    if (hLines[br + 1][bc]) n++;
    if (vLines[br][bc]) n++;
    if (vLines[br][bc + 1]) n++;
    return n;
  }

  function renderLine(type, r, c) {
    const btn = type === "h" ? hBtns[r][c] : vBtns[r][c];
    const owner = type === "h" ? hLines[r][c] : vLines[r][c];
    btn.classList.toggle("claimed-you", owner === "you");
    btn.classList.toggle("claimed-cpu", owner === "cpu");
    btn.disabled = !!owner;
  }

  function renderBox(br, bc) {
    const el = boxEls[br][bc];
    const owner = boxes[br][bc];
    el.classList.toggle("filled-you", owner === "you");
    el.classList.toggle("filled-cpu", owner === "cpu");
    el.textContent = owner === "you" ? "Y" : owner === "cpu" ? "C" : "·";
  }

  function render() {
    for (let r = 0; r < DOTS; r++) {
      for (let c = 0; c < BOXES; c++) renderLine("h", r, c);
    }
    for (let r = 0; r < BOXES; r++) {
      for (let c = 0; c < DOTS; c++) renderLine("v", r, c);
    }
    for (let r = 0; r < BOXES; r++) {
      for (let c = 0; c < BOXES; c++) renderBox(r, c);
    }
    youScoreEl.textContent = scores.you;
    cpuScoreEl.textContent = scores.cpu;
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function allBoxesFilled() {
    for (let r = 0; r < BOXES; r++) {
      for (let c = 0; c < BOXES; c++) if (!boxes[r][c]) return false;
    }
    return true;
  }

  function affectedBoxes(type, r, c) {
    const list = [];
    if (type === "h") {
      if (r > 0) list.push([r - 1, c]);
      if (r < BOXES) list.push([r, c]);
    } else {
      if (c > 0) list.push([r, c - 1]);
      if (c < BOXES) list.push([r, c]);
    }
    return list;
  }

  function clearAiTimer() {
    if (aiTimer) {
      try {
        clearTimeout(aiTimer);
      } catch {
        /* ignore */
      }
      aiTimer = 0;
    }
  }

  function armAiTimer() {
    clearAiTimer();
    aiTimer = setTimeout(aiMove, AI_DELAY);
  }

  function claimLine(type, r, c, who) {
    if (type === "h") hLines[r][c] = who;
    else vLines[r][c] = who;

    let completed = 0;
    for (const [br, bc] of affectedBoxes(type, r, c)) {
      if (!boxes[br][bc] && boxSides(br, bc) === 4) {
        boxes[br][bc] = who;
        scores[who]++;
        completed++;
      }
    }
    if (completed > 0) sfx("box");
    else sfx("line");
    render();
    if (allBoxesFilled()) {
      endGame();
      return completed;
    }
    if (completed === 0) turn = turn === "you" ? "cpu" : "you";
    turnLabel.textContent = turn === "you" ? "Your line — draw any segment" : "CPU is thinking…";
    if (turn === "cpu" && !gameOver) {
      if (cpuEnabled) {
        busy = true;
        aiPending = true;
        armAiTimer();
      } else {
        // CPU disabled (manual play / tests): keep the turn with the human.
        turn = "you";
        turnLabel.textContent = "Your line — draw any segment";
        busy = false;
      }
    } else {
      busy = false;
    }
    return completed;
  }

  function humanClaim(type, r, c) {
    if (gameOver || busy || paused || turn !== "you") return false;
    if (type === "h" ? hLines[r][c] : vLines[r][c]) return false;
    claimLine(type, r, c, "you");
    return true;
  }

  // AI: 1) take any line completing a box (greedy);
  //     2) else avoid lines that would give the opponent a third side;
  //     3) else random.
  function analyse(type, r, c) {
    let completes = 0;
    let makesThird = 0;
    for (const [br, bc] of affectedBoxes(type, r, c)) {
      const sides = boxSides(br, bc);
      if (sides === 3) completes++;
      else if (sides === 2) makesThird++;
    }
    return { type, r, c, completes, makesThird };
  }

  function aiChoose() {
    const candidates = [];
    for (let r = 0; r < DOTS; r++) {
      for (let c = 0; c < BOXES; c++) {
        if (!hLines[r][c]) candidates.push(analyse("h", r, c));
      }
    }
    for (let r = 0; r < BOXES; r++) {
      for (let c = 0; c < DOTS; c++) {
        if (!vLines[r][c]) candidates.push(analyse("v", r, c));
      }
    }
    const completing = candidates.filter((x) => x.completes > 0);
    if (completing.length) {
      completing.sort((a, b) => b.completes - a.completes);
      return completing[0];
    }
    const safe = candidates.filter((x) => x.makesThird === 0);
    const pool = safe.length ? safe : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function aiMove() {
    aiTimer = 0;
    if (gameOver || paused || turn !== "cpu") return false;
    aiPending = false;
    busy = false;
    const choice = aiChoose();
    if (choice) claimLine(choice.type, choice.r, choice.c, "cpu");
    return true;
  }

  function endGame() {
    if (gameOver) return false;
    gameOver = true;
    busy = false;
    aiPending = false;
    paused = false;
    clearAiTimer();

    const prevBest = stats.boxesBest || 0;
    stats.boxes += scores.you;
    if (scores.you > prevBest) stats.boxesBest = scores.you;
    const isRecord = scores.you > prevBest;

    let result;
    if (scores.you > scores.cpu) {
      result = "win";
      stats.wins++;
      stats.streak++;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (scores.cpu === 0) stats.shutouts++;
    } else if (scores.cpu > scores.you) {
      result = "loss";
      stats.losses++;
      stats.streak = 0;
    } else {
      result = "draw";
      stats.draws++;
      stats.streak = 0;
    }

    saveStats();
    checkAchievements();
    render();

    if (result === "win") {
      turnLabel.textContent = "You win!";
      sfx("win");
      confetti(isRecord ? 90 : 60);
      showOverlay(
        "You win! 🎉",
        `Final score — You ${scores.you}, CPU ${scores.cpu}.` +
          (scores.cpu === 0 ? " Clean sheet!" : "") +
          (isRecord ? " New best!" : ""),
        [
          { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else if (result === "loss") {
      turnLabel.textContent = "CPU wins";
      sfx("over");
      showOverlay(
        "CPU wins 🤖",
        `Final score — You ${scores.you}, CPU ${scores.cpu}. Try to grab more boxes!`,
        [
          { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else {
      turnLabel.textContent = "Draw!";
      sfx("tick");
      showOverlay("Draw! 🤝", `Final score — You ${scores.you}, CPU ${scores.cpu}.`, [
        { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
    return result;
  }

  // ---- Pause ----
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return false;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "The grid is on hold — press Esc or P to resume.", [
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
      if (aiPending && turn === "cpu" && !gameOver) armAiTimer();
    }
    render();
    return true;
  }

  function togglePause() {
    setPaused(!paused);
  }

  function reset() {
    clearAiTimer();
    hLines = Array.from({ length: DOTS }, () => new Array(BOXES).fill(null));
    vLines = Array.from({ length: BOXES }, () => new Array(DOTS).fill(null));
    boxes = Array.from({ length: BOXES }, () => new Array(BOXES).fill(null));
    scores = { you: 0, cpu: 0 };
    turn = "you";
    gameOver = false;
    busy = false;
    paused = false;
    aiPending = false;
    stats.games++;
    saveStats();
    checkAchievements();
    hideOverlay();
    turnLabel.textContent = "Your line — draw any segment";
    render();
    return true;
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

    const newGameBtn = dom.byId("new-game");
    if (newGameBtn)
      newGameBtn.addEventListener("click", () => {
        audio.unlock();
        sfx("click");
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
    migrateLegacy();
    buildGrid9x9();
    updateBadgeCount();
    bindEvents();
    reset();
    renderAchvGrid();
  }

  window.__DOTS = {
    DOTS,
    BOXES,
    TOTAL_BOXES,
    ACHIEVEMENTS,
    stats,
    get hLines() {
      return hLines.map((row) => row.slice());
    },
    get vLines() {
      return vLines.map((row) => row.slice());
    },
    get boxes() {
      return boxes.map((row) => row.slice());
    },
    get scores() {
      return { you: scores.you, cpu: scores.cpu };
    },
    get turn() {
      return turn;
    },
    get gameOver() {
      return gameOver;
    },
    get busy() {
      return busy;
    },
    get paused() {
      return paused;
    },
    get turnLabel() {
      return turnLabel.textContent;
    },
    setCpuEnabled(v) {
      cpuEnabled = !!v;
    },
    setTurn(t) {
      turn = t === "cpu" ? "cpu" : "you";
      gameOver = false;
      busy = false;
      paused = false;
      aiPending = false;
      clearAiTimer();
      hideOverlay();
      turnLabel.textContent = turn === "you" ? "Your line — draw any segment" : "CPU is thinking…";
      render();
      return turn;
    },
    snap: () => ({
      hLines: hLines.map((row) => row.slice()),
      vLines: vLines.map((row) => row.slice()),
      boxes: boxes.map((row) => row.slice()),
      scores: { you: scores.you, cpu: scores.cpu },
      turn,
      gameOver,
      busy,
      paused,
      turnLabel: turnLabel.textContent,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    draw: humanClaim,
    claim: claimLine,
    cpuMove: aiMove,
    aiChoose,
    analyse,
    boxSides,
    affectedBoxes,
    allBoxesFilled,
    reset,
    newGame: reset,
    endGame,
    setPaused,
    togglePause,
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
