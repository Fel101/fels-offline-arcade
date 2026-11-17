// Stack — pure vanilla JS, fully offline.
// Timing tower-stacking: drop the sliding block, overhang gets sliced off.
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
  const scoreEl = dom.byId("score");
  const bestEl = dom.byId("best");
  const gamesEl = dom.byId("games");
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
  const W = canvas.width;
  const H = canvas.height;
  const BLOCK_H = 24;
  const ANCHOR_Y = 150; // screen y of the newest (top) block's top edge
  const MOVE_Y = ANCHOR_Y - BLOCK_H; // the sliding block hovers in the slot above
  const MIN_SLICE = 1; // overhangs thinner than this are discarded, never placed

  const K = makeKeys("stack");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    best: 0,
    blocks: 0,
    perfects: 0,
    slices: 0,
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

  // Carry the pre-core best score across.
  function migrateLegacy() {
    const raw = store.get("stack-best", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.best) stats.best = n;
      store.remove("stack-best");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Drop", desc: "Place your first block.", stat: "blocks", goal: 1 },
    { id: "blocks50", icon: "🧱", name: "Bricklayer", desc: "Place 50 blocks.", stat: "blocks", goal: 50 },
    { id: "blocks250", icon: "🏗️", name: "Skyscraper", desc: "Place 250 blocks.", stat: "blocks", goal: 250 },
    { id: "best10", icon: "🎯", name: "Ten High", desc: "Score 10 in one tower.", stat: "best", goal: 10 },
    { id: "best25", icon: "🏙️", name: "Cloudline", desc: "Score 25 in one tower.", stat: "best", goal: 25 },
    { id: "best50", icon: "🌆", name: "Skyline", desc: "Score 50 in one tower.", stat: "best", goal: 50 },
    { id: "best100", icon: "🌌", name: "Stratosphere", desc: "Score 100 in one tower.", stat: "best", goal: 100 },
    { id: "perfect1", icon: "✨", name: "Perfect Drop", desc: "Land a perfect drop.", stat: "perfects", goal: 1 },
    { id: "perfect10", icon: "💎", name: "Precision", desc: "Land 10 perfect drops.", stat: "perfects", goal: 10 },
    { id: "perfect50", icon: "🎖️", name: "Dead Centre", desc: "Land 50 perfect drops.", stat: "perfects", goal: 50 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Build 10 towers.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Devoted", desc: "Build 25 towers.", stat: "games", goal: 25 },
    { id: "slice25", icon: "✂️", name: "Trimmer", desc: "Slice off 25 overhangs.", stat: "slices", goal: 25 },
    { id: "slice100", icon: "🔪", name: "Sculptor", desc: "Slice off 100 overhangs.", stat: "slices", goal: 100 },
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
        ["Towers", stats.games],
        ["Best", stats.best],
        ["Blocks", stats.blocks],
        ["Perfects", stats.perfects],
        ["Overhangs cut", stats.slices],
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

  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("drop", [[340, 0, 0.05, "square", 0.035]]);
  audio.define("perfect", [[720, 0, 0.07, "triangle", 0.045], [960, 0.06, 0.1, "triangle", 0.045]]);

  // ---------- Game state ----------
  let blocks;
  let moving;
  let slices;
  let floaters;
  let camEase;
  let score;
  let gameOver;
  let paused = false;
  let runCounted = false;
  let runStartBest = 0;

  function blockColor(level) {
    // Hue cycles per level — a slow gradient up the tower.
    return `hsl(${(190 + level * 14) % 360} 65% 58%)`;
  }

  function reset() {
    blocks = []; // level = index; level 0 was placed first
    moving = newMovingBlock(180);
    slices = []; // overhang pieces falling away
    floaters = []; // "PERFECT!" pop-ups
    camEase = 0; // eases from -BLOCK_H back to 0 after each drop
    score = 0;
    gameOver = false;
    paused = false;
    runCounted = false;
    runStartBest = stats.best;
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

  function newMovingBlock(width) {
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? 0 : W - width,
      w: width,
      dir: fromLeft ? 1 : -1,
      speed: blockSpeed(),
    };
  }

  function blockSpeed() {
    // Speeds up a little every 8 blocks placed.
    return Math.min(9, 2.4 + Math.floor(blocks.length / 8) * 0.55);
  }

  function updateStatus() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(stats.best, score);
    gamesEl.textContent = stats.games;
  }

  function drop() {
    if (gameOver || paused) return;
    const first = blocks.length === 0;
    const top = first ? null : blocks[blocks.length - 1];
    const mx = moving.x;
    const mw = moving.w;

    if (first) {
      beginRun();
      // First block: lands anywhere, full width kept.
      placeBlock({ x: mx, w: mw });
      sfx("drop");
      return;
    }

    const overlapLeft = Math.max(mx, top.x);
    const overlapRight = Math.min(mx + mw, top.x + top.w);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 0) {
      // Missed completely — the whole block tumbles away.
      slices.push({ x: mx, w: mw, y: MOVE_Y, vy: 0, color: blockColor(blocks.length) });
      endGame();
      return;
    }

    const perfect = overlap >= 0.95 * mw;
    if (perfect) {
      // Keep the moving block full-width, no slice, small bonus (+1).
      blocks.push({ x: mx, w: mw, color: blockColor(blocks.length) });
      score += 2; // 1 for the block + 1 perfect bonus
      stats.blocks++;
      stats.perfects++;
      stats.best = Math.max(stats.best, score);
      camEase -= BLOCK_H;
      floaters.push({ text: "PERFECT!", y: ANCHOR_Y - 10, alpha: 1 });
      saveStats();
      checkAchievements();
      updateStatus();
      moving = newMovingBlock(mw);
      sfx("perfect");
      return;
    }

    placeBlock({ x: overlapLeft, w: overlap });
    sfx("drop");

    // Overhanging slice(s) fall away.
    if (mx < top.x && top.x - mx >= MIN_SLICE) {
      slices.push({ x: mx, w: top.x - mx, y: MOVE_Y, vy: 0, color: blockColor(blocks.length - 1) });
      stats.slices++;
    }
    const rightEnd = mx + mw;
    const topRight = top.x + top.w;
    if (rightEnd > topRight && rightEnd - topRight >= MIN_SLICE) {
      slices.push({
        x: topRight,
        w: rightEnd - topRight,
        y: MOVE_Y,
        vy: 0,
        color: blockColor(blocks.length - 1),
      });
      stats.slices++;
    }
    saveStats();
    checkAchievements();
  }

  function placeBlock(block) {
    const level = blocks.length;
    blocks.push({ x: block.x, w: block.w, color: blockColor(level) });
    score += 1;
    stats.blocks++;
    stats.best = Math.max(stats.best, score);
    camEase -= BLOCK_H; // whole tower appears one block high, then slides down
    saveStats();
    checkAchievements();
    updateStatus();
    moving = newMovingBlock(block.w);
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    paused = false;

    stats.best = Math.max(stats.best, score);
    saveStats();
    checkAchievements();
    updateStatus();

    const isRecord = score > runStartBest;
    if (isRecord) {
      sfx("win");
      confetti(80);
    } else {
      sfx("over");
    }

    showOverlay(
      isRecord ? "New Best! 🎉" : "Game Over",
      `Score: ${score}. Best: ${stats.best}. Tower ${stats.games}.`,
      [
        {
          label: "Play again",
          onClick: () => {
            hideOverlay();
            reset();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Pause ----------
  function canPause() {
    return !gameOver;
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

  // ---------- Update ----------
  function update() {
    if (paused) return;
    if (!gameOver) {
      moving.x += moving.dir * moving.speed;
      if (moving.x <= 0) {
        moving.x = 0;
        moving.dir = 1;
      } else if (moving.x + moving.w >= W) {
        moving.x = W - moving.w;
        moving.dir = -1;
      }
    }
    camEase += (0 - camEase) * 0.18;
    if (Math.abs(camEase) < 0.3) camEase = 0;

    for (const s of slices) {
      s.vy += 0.5;
      s.y += s.vy;
    }
    slices = slices.filter((s) => s.y < H + BLOCK_H * 2);

    for (const f of floaters) {
      f.y -= 0.8;
      f.alpha -= 0.02;
    }
    floaters = floaters.filter((f) => f.alpha > 0);
  }

  // ---------- Rendering ----------
  function blockY(level) {
    // Newest block sits at ANCHOR_Y; older blocks extend downward.
    return ANCHOR_Y + (blocks.length - 1 - level) * BLOCK_H + camEase;
  }

  function draw() {
    // Background — simple vertical gradient with a few static stars.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#12142e");
    g.addColorStop(1, "#1e2044");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (const [sx, sy, sr] of [[52, 60, 1.4], [330, 42, 1.2], [210, 88, 1.6], [120, 132, 1.1], [288, 118, 1.3], [370, 160, 1.5]]) {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tower blocks (cull anything off the bottom).
    for (let i = 0; i < blocks.length; i++) {
      const y = blockY(i);
      if (y > H + BLOCK_H) continue;
      drawBlock(blocks[i].x, y, blocks[i].w, blocks[i].color);
    }

    // Falling overhang slices.
    for (const s of slices) drawBlock(s.x, s.y, s.w, s.color);

    // Sliding block.
    if (!gameOver) {
      ctx.save();
      ctx.shadowColor = "rgba(88,224,201,0.6)";
      ctx.shadowBlur = 12;
      drawBlock(moving.x, MOVE_Y, moving.w, blockColor(blocks.length));
      ctx.restore();
    }

    // Floating PERFECT! texts.
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.fillStyle = "#ffcc4d";
      ctx.font = "bold 20px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, W / 2, f.y);
      ctx.globalAlpha = 1;
    }

    // Drop hint while playing.
    if (!gameOver && blocks.length === 0) {
      ctx.fillStyle = "rgba(238,240,255,0.75)";
      ctx.font = "14px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Space / click to drop", W / 2, H - 40);
    }
  }

  function drawBlock(x, y, w, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, BLOCK_H);
    ctx.fillStyle = "rgba(255,255,255,0.22)"; // top highlight
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "rgba(0,0,0,0.28)"; // bottom shade
    ctx.fillRect(x, y + BLOCK_H - 4, w, 4);
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
    if (key === " " || key === "Spacebar") {
      if (e.preventDefault) e.preventDefault();
      if (paused) return;
      if (gameOver) {
        reset();
        return;
      }
      drop();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", (e) => {
      if (e.preventDefault) e.preventDefault();
      audio.unlock();
      if (paused || gameOver) return; // use the overlay button
      drop();
    });
    restartBtn.addEventListener("click", () => {
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

  // ---------- Main loop ----------
  const gameLoop = loopApi.create(() => {
    update();
    draw();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    reset();
    renderAchvGrid();
    gameLoop.start();
  }

  // Test hook — harmless in normal play.
  window.__STACK = {
    W,
    H,
    BLOCK_H,
    ANCHOR_Y,
    MOVE_Y,
    ACHIEVEMENTS,
    stats,
    get score() {
      return score;
    },
    get gameOver() {
      return gameOver;
    },
    get paused() {
      return paused;
    },
    snap: () => ({
      score,
      gameOver,
      paused,
      camEase,
      blocks: blocks.map((b) => ({ x: b.x, w: b.w })),
      moving: { x: moving.x, w: moving.w, dir: moving.dir, speed: moving.speed },
      slices: slices.map((s) => ({ x: s.x, w: s.w, y: s.y })),
      floaters: floaters.length,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    setMoving: (x, w, dir, speed) => {
      moving = {
        x,
        w: w === undefined ? moving.w : w,
        dir: dir === undefined ? moving.dir : dir,
        speed: speed === undefined ? moving.speed : speed,
      };
    },
    setBlocks: (arr) => {
      blocks = (arr || []).map((b, i) => ({ x: b.x, w: b.w, color: blockColor(i) }));
    },
    step: update,
    draw,
    reset,
    drop,
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
    overlay,
  };

  init();
})();
