// Light Trails — pure vanilla JS, fully offline. Light-trail duel vs the computer.
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
    loop: loopApi,
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const canvas = dom.byId("game");
  const ctx = canvas.getContext("2d");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const bestEl = dom.byId("best");
  const restartBtn = dom.byId("restart");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants ----------
  const CELL = 12;
  const SIZE = 40; // 40 x 40 grid -> 480 x 480 canvas
  const W = SIZE * CELL;
  const H = SIZE * CELL;
  const STEP_MS = 95; // one grid move per tick
  window.Arcade.util.hidpiCanvas(canvas, ctx, W, H);

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const ORDERS = ["up", "down", "left", "right"];

  const PLAYER_START = { gx: 3, gy: Math.floor(SIZE / 2), dir: "right" };
  const ENEMY_START = { gx: SIZE - 4, gy: Math.floor(SIZE / 2), dir: "left" };

  const K = makeKeys("tron");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    cells: 0,
    bestRun: 0,
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

  // The pre-core build only stored the best win count in one session.
  function migrateLegacy() {
    const raw = store.get("tron-best", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.bestStreak) stats.bestStreak = n;
      store.remove("tron-best");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🥇", name: "First Win", desc: "Outlast the enemy cycle.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏍️", name: "Circuit Rider", desc: "Win 5 rounds.", stat: "wins", goal: 5 },
    { id: "win10", icon: "⚡", name: "Grid Master", desc: "Win 10 rounds.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Program Elite", desc: "Win 25 rounds.", stat: "wins", goal: 25 },
    { id: "streak2", icon: "✌️", name: "Double", desc: "Win two rounds in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win three rounds in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🔥", name: "Unbroken", desc: "Win five rounds in a row.", stat: "bestStreak", goal: 5 },
    { id: "games10", icon: "🎮", name: "Ten Rounds", desc: "Race 10 rounds.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Grid Regular", desc: "Race 25 rounds.", stat: "games", goal: 25 },
    { id: "cells250", icon: "🧭", name: "Traveller", desc: "Drive 250 cells in total.", stat: "cells", goal: 250 },
    { id: "cells1000", icon: "🛣️", name: "Long Haul", desc: "Drive 1,000 cells in total.", stat: "cells", goal: 1000 },
    { id: "bestRun100", icon: "🏁", name: "Marathon", desc: "Survive 100 cells in one round.", stat: "bestRun", goal: 100 },
    { id: "loss10", icon: "💥", name: "Ten Crashes", desc: "Crash 10 cycles.", stat: "losses", goal: 10 },
    { id: "loss25", icon: "🛠️", name: "Scrap Heap", desc: "Crash 25 cycles.", stat: "losses", goal: 25 },
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
        ["Rounds", stats.games],
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Best streak", stats.bestStreak],
        ["Cells", stats.cells],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (state === "playing" && !paused) setPaused(true);
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
  audio.define("turn", [[520, 0, 0.03, "square", 0.018]]);
  audio.define("launch", [[300, 0, 0.08, "sawtooth", 0.03], [520, 0.07, 0.1, "sawtooth", 0.03]]);

  // ---------- Game state ----------
  let grid; // 0 empty, 1 player trail, 2 enemy trail
  let player;
  let enemy;
  let state; // ready | playing | over
  let acc;
  let paused = false;
  let runCells = 0;
  let runCounted = false;
  let runStartBestStreak = 0;

  const idx = (x, y) => y * SIZE + x;

  function newGrid() {
    return new Array(SIZE * SIZE).fill(0);
  }

  // ---------- Setup ----------
  function reset() {
    grid = newGrid();
    player = { gx: PLAYER_START.gx, gy: PLAYER_START.gy, dir: PLAYER_START.dir, dead: false };
    enemy = { gx: ENEMY_START.gx, gy: ENEMY_START.gy, dir: ENEMY_START.dir, dead: false };
    grid[idx(player.gx, player.gy)] = 1;
    grid[idx(enemy.gx, enemy.gy)] = 2;
    state = "ready";
    acc = 0;
    paused = false;
    runCells = 0;
    runCounted = false;
    runStartBestStreak = stats.bestStreak;
    hideOverlay();
    updateStatus();
  }

  function beginRun() {
    if (runCounted) return;
    runCounted = true;
    stats.games++;
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    bestEl.textContent = stats.bestStreak;
  }

  function start() {
    if (state !== "ready") return false;
    state = "playing";
    acc = 0;
    hideOverlay();
    beginRun();
    sfx("launch");
    return true;
  }

  // ---------- Steering ----------
  function turn(dir) {
    if (state !== "playing" || paused) return false;
    if (!DIRS[dir]) return false;
    if (dir === player.dir || dir === OPPOSITE[player.dir]) return false;
    player.dir = dir;
    sfx("turn");
    return true;
  }

  // ---------- AI: greedy — pick the direction that opens up the most space ----------
  const seenCells = new Uint8Array(SIZE * SIZE);
  const areaStack = new Int32Array(SIZE * SIZE);

  function openArea(x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 0;
    if (grid[idx(x, y)] !== 0) return 0;
    seenCells.fill(0);
    let count = 0;
    let top = 0;
    const start = idx(x, y);
    seenCells[start] = 1;
    areaStack[top++] = start;
    while (top > 0) {
      const cell = areaStack[--top];
      count++;
      const cx = cell % SIZE;
      const cy = (cell - cx) / SIZE;
      for (const d of ORDERS) {
        const ex = cx + DIRS[d].x;
        const ey = cy + DIRS[d].y;
        if (ex < 0 || ey < 0 || ex >= SIZE || ey >= SIZE) continue;
        const k = idx(ex, ey);
        if (grid[k] !== 0 || seenCells[k]) continue;
        seenCells[k] = 1;
        areaStack[top++] = k;
      }
    }
    return count;
  }

  function blocked(x, y, d) {
    const nx = x + DIRS[d].x;
    const ny = y + DIRS[d].y;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return true;
    return grid[idx(nx, ny)] !== 0;
  }

  function enemyMove() {
    let bestDir = enemy.dir;
    let bestScore = -Infinity;
    for (const d of ORDERS) {
      if (d === OPPOSITE[enemy.dir]) continue;
      if (blocked(enemy.gx, enemy.gy, d)) continue;
      const score = openArea(enemy.gx + DIRS[d].x, enemy.gy + DIRS[d].y) + Math.random() * 1.5;
      if (score > bestScore) {
        bestScore = score;
        bestDir = d;
      }
    }
    enemy.dir = bestDir;
  }

  // ---------- Simulation ----------
  function advance(cycle) {
    const nx = cycle.gx + DIRS[cycle.dir].x;
    const ny = cycle.gy + DIRS[cycle.dir].y;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) {
      cycle.dead = true;
      return false;
    }
    if (grid[idx(nx, ny)] !== 0) {
      cycle.dead = true;
      return false;
    }
    cycle.gx = nx;
    cycle.gy = ny;
    return true;
  }

  function step() {
    if (state !== "playing" || paused) return false;

    if (!advance(player)) {
      player.dead = true;
      endGame(false);
      return false;
    }
    grid[idx(player.gx, player.gy)] = 1;
    runCells++;
    stats.cells++;
    if (runCells > stats.bestRun) stats.bestRun = runCells;

    enemyMove();
    if (!advance(enemy)) {
      enemy.dead = true;
      endGame(true);
      return true;
    }
    grid[idx(enemy.gx, enemy.gy)] = 2;

    checkAchievements();
    updateStatus();
    return true;
  }

  function endGame(won) {
    if (state !== "playing") return;
    state = "over";
    paused = false;
    acc = 0;

    if (won) {
      stats.wins++;
      stats.streak++;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    if (runCells > stats.bestRun) stats.bestRun = runCells;
    saveStats();
    checkAchievements();
    updateStatus();

    const isRecord = won && stats.bestStreak > runStartBestStreak;
    if (won) {
      sfx("win");
      if (isRecord) confetti(80);
    } else {
      sfx("over");
    }

    const lines = won
      ? [
          `Streak ${stats.streak}. Best streak ${stats.bestStreak}.`,
          isRecord ? "New best streak! 🎉" : `Round ${stats.games} won.`,
        ]
      : [
          `Your cycle is scrap after ${runCells} ${runCells === 1 ? "cell" : "cells"}.`,
          `Streak lost. Best streak ${stats.bestStreak}.`,
        ];

    showOverlay(won ? "You outlasted it! 🎉" : "Crashed! 🚨", lines.join(" "), [
      {
        label: "Play again",
        onClick: () => {
          hideOverlay();
          reset();
          start();
        },
      },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Pause ----------
  function canPause() {
    return state === "playing";
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

  // ---------- Rendering ----------
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);

    // Faint circuit grid every fifth cell.
    ctx.strokeStyle = "rgba(88,224,201,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 5; i < SIZE; i += 5) {
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, H);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(W, i * CELL + 0.5);
    }
    ctx.stroke();

    // Trails.
    let owner = 0;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v) continue;
      if (v !== owner) {
        owner = v;
        ctx.fillStyle = v === 1 ? "#58e0c9" : "#ff6b6b";
      }
      const x = (i % SIZE) * CELL;
      const y = ((i - (i % SIZE)) / SIZE) * CELL;
      ctx.fillRect(x, y, CELL - 1, CELL - 1);
    }

    drawHead(player, "#a8fff0", "#58e0c9");
    drawHead(enemy, "#ffc2c2", "#ff6b6b");
  }

  function drawHead(cycle, bright, tint) {
    if (!cycle) return;
    const x = cycle.gx * CELL;
    const y = cycle.gy * CELL;
    ctx.save();
    ctx.shadowColor = tint;
    ctx.shadowBlur = 12;
    ctx.fillStyle = bright;
    ctx.fillRect(x, y, CELL - 1, CELL - 1);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 3, y + 3, CELL - 7, CELL - 7);
  }

  // ---------- Overlays ----------
  function showStartOverlay() {
    showOverlay("Light Trails", "Steer with arrows or WASD. Make the enemy cycle crash first!", [
      {
        label: "Start",
        onClick: () => {
          hideOverlay();
          start();
        },
      },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Input ----------
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
  };

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

    if (key === " " || key === "Spacebar" || key === "Enter") {
      if (e.preventDefault) e.preventDefault();
      if (paused) return;
      if (state === "ready") start();
      else if (state === "over") {
        reset();
        start();
      }
      return;
    }

    const dir = keyMap[key];
    if (dir) {
      if (e.preventDefault) e.preventDefault();
      turn(dir);
    }
  }

  function bindPad() {
    for (const btn of dom.all("[data-dir]")) {
      btn.addEventListener("click", () => {
        audio.unlock();
        turn(btn.getAttribute("data-dir"));
      });
    }
  }

  function bindSwipe() {
    let sx = 0;
    let sy = 0;
    let tracking = false;
    canvas.addEventListener("pointerdown", (e) => {
      audio.unlock();
      tracking = true;
      sx = e.clientX || 0;
      sy = e.clientY || 0;
      if (e.preventDefault) e.preventDefault();
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = (e.clientX || 0) - sx;
      const dy = (e.clientY || 0) - sy;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    });
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);
    bindPad();
    bindSwipe();

    restartBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset();
      showStartOverlay();
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

  // ---------- Main loop ----------
  function update(dt) {
    if (state !== "playing" || paused) {
      acc = 0;
      return;
    }
    acc += dt;
    let guard = 0;
    while (acc >= STEP_MS && guard++ < 4) {
      acc -= STEP_MS;
      step();
      if (state !== "playing") {
        acc = 0;
        break;
      }
    }
  }

  const gameLoop = loopApi.create((dt) => {
    update(dt);
    draw();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    reset();
    renderAchvGrid();
    showStartOverlay();
    gameLoop.start();
  }

  // Test hook — harmless in normal play.
  window.__TRON = {
    W,
    H,
    CELL,
    SIZE,
    STEP_MS,
    DIRS,
    OPPOSITE,
    ORDERS,
    PLAYER_START,
    ENEMY_START,
    ACHIEVEMENTS,
    stats,
    get state() {
      return state;
    },
    get paused() {
      return paused;
    },
    get runCells() {
      return runCells;
    },
    get player() {
      return Object.assign({}, player);
    },
    get enemy() {
      return Object.assign({}, enemy);
    },
    snap: () => {
      let playerCells = 0;
      let enemyCells = 0;
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] === 1) playerCells++;
        else if (grid[i] === 2) enemyCells++;
      }
      return {
        state,
        paused,
        acc,
        runCells,
        player: Object.assign({}, player),
        enemy: Object.assign({}, enemy),
        playerCells,
        enemyCells,
        stats: Object.assign({}, stats),
        unlocked: achv.list(),
        overlayTitle: overlay.info().title,
        overlayMsg: overlay.info().msg,
      };
    },
    cellAt: (gx, gy) => (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE ? null : grid[idx(gx, gy)]),
    openArea,
    blocked,
    setPlayer: (gx, gy, dir) => {
      player = {
        gx,
        gy,
        dir: dir === undefined ? player.dir : dir,
        dead: false,
      };
    },
    setEnemy: (gx, gy, dir) => {
      enemy = {
        gx,
        gy,
        dir: dir === undefined ? enemy.dir : dir,
        dead: false,
      };
    },
    setCells: (cells) => {
      grid = newGrid();
      for (const [x, y, owner] of cells || []) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        grid[idx(x, y)] = owner === 2 ? 2 : 1;
      }
    },
    clearTrails: () => {
      grid = newGrid();
    },
    step,
    update,
    draw,
    reset,
    start,
    endGame,
    turn,
    enemyMove,
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
