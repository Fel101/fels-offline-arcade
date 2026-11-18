// Breakout — pure vanilla JS, fully offline.
// Smash all 40 bricks before your 3 lives run out.
// Shared plumbing (storage, audio, toasts, overlay, badges, modal)
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
  const canvas = dom.byId("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = dom.byId("score");
  const livesEl = dom.byId("lives");
  const bestEl = dom.byId("best");
  const launchBtn = dom.byId("launch");
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
  const W = canvas.width, H = canvas.height;
  window.Arcade.util.hidpiCanvas(canvas, ctx, W, H);
  const COLS = 8, ROWS = 5, PAD = 8, TOP = 60;
  const BRICK_W = (W - PAD * (COLS + 1)) / COLS;
  const BRICK_H = 22;
  const TOTAL_BRICKS = COLS * ROWS;
  const ROW_COLORS = ["#ff6b6b", "#ff9f43", "#ffcc4d", "#6bd66b", "#58e0c9"];

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🧱", name: "First Brick", desc: "Smash your first brick.", stat: "bricks", goal: 1 },
    { id: "brick50", icon: "🧨", name: "Demolition", desc: "Smash 50 bricks in total.", stat: "bricks", goal: 50 },
    { id: "brick250", icon: "🏗️", name: "Masonry", desc: "Smash 250 bricks in total.", stat: "bricks", goal: 250 },
    { id: "brick1000", icon: "🏛️", name: "Cathedral", desc: "Smash 1,000 bricks in total.", stat: "bricks", goal: 1000 },
    { id: "score100", icon: "💯", name: "Century", desc: "Score 100 in a single game.", stat: "bestScore", goal: 100 },
    { id: "score300", icon: "🎯", name: "Sharpshooter", desc: "Score 300 in a single game.", stat: "bestScore", goal: 300 },
    { id: "clear1", icon: "🌟", name: "First Clear", desc: "Clear the whole board.", stat: "wins", goal: 1 },
    { id: "wins5", icon: "🏆", name: "Wall Buster", desc: "Clear the board 5 times.", stat: "wins", goal: 5 },
    { id: "wins25", icon: "👑", name: "Brick King", desc: "Clear the board 25 times.", stat: "wins", goal: 25 },
    { id: "perfect", icon: "💎", name: "Flawless", desc: "Clear the board without losing a life.", stat: "perfectWins", goal: 1 },
    { id: "games10", icon: "🎮", name: "Seasoned", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games50", icon: "🕹️", name: "Arcade Regular", desc: "Play 50 games.", stat: "games", goal: 50 },
    { id: "grinder", icon: "🔥", name: "Grinder", desc: "Lose a game with 250+ bricks smashed in total.", stat: "grindGames", goal: 1 },
    { id: "lives20", icon: "❤️", name: "Tough Crowd", desc: "Lose 20 lives across all games.", stat: "livesLost", goal: 20 },
  ];

  const DEFAULT_STATS = {
    bestScore: 0,
    bricks: 0,
    wins: 0,
    games: 0,
    perfectWins: 0,
    grindGames: 0,
    livesLost: 0,
  };

  const K = makeKeys("breakout");

  // ---------- Persistent stats ----------
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

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("brick", [[620, 0, 0.045, "square", 0.04]]);
  audio.define("paddle", [[440, 0, 0.045, "square", 0.04]]);
  audio.define("wall", [[330, 0, 0.035, "sine", 0.04]]);

  // ---------- State ----------
  let score, lives, bricks, ball, paddle, launched, paused, bricksThisGame;
  let resumeAfterModal = false;

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
        ["Best score", stats.bestScore],
        ["Bricks smashed", stats.bricks],
        ["Boards cleared", stats.wins],
        ["Flawless clears", stats.perfectWins],
        ["Games played", stats.games],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (launched && !paused) {
        paused = true;
        resumeAfterModal = true;
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (launched) paused = false;
      }
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

  // ---------- Game setup ----------
  function newBricks() {
    const arr = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        arr.push({ x: PAD + c * (BRICK_W + PAD), y: TOP + r * (BRICK_H + PAD),
                   w: BRICK_W, h: BRICK_H, color: ROW_COLORS[r], alive: true });
      }
    }
    return arr;
  }

  function reset() {
    score = 0; lives = 3; bricksThisGame = 0;
    bricks = newBricks();
    paddle = { w: 90, h: 12, x: W / 2 - 45 };
    launchBall();
    paused = false;
    updateStats();
    hideOverlay();
  }

  function launchBall() {
    launched = false;
    ball = { x: paddle.x + paddle.w / 2, y: H - 30, size: 8, vx: 0, vy: 0 };
  }

  function go() {
    if (launched) return;
    const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2; // up-ish spread
    const speed = 6;
    ball.vx = speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    launched = true;
    sfx("click");
  }

  function updateStats() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    bestEl.textContent = stats.bestScore;
  }

  // ---------- Input ----------
  function bindInput() {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.height);
      paddle.x = Math.max(0, Math.min(W - paddle.w, mx - paddle.w / 2));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") paddle.x = Math.max(0, paddle.x - 35);
      if (e.key === "ArrowRight") paddle.x = Math.min(W - paddle.w, paddle.x + 35);
      if (e.key === " ") { go(); e.preventDefault(); }
      if (e.key === "p" || e.key === "P") togglePause();
    });
    launchBtn.addEventListener("click", () => {
      audio.unlock();
      go();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && launched && !paused) togglePause();
    });
    window.addEventListener("blur", () => {
      if (launched && !paused && achvModal.hidden) togglePause();
    });

    audio.bindUnlock();
  }

  function togglePause() {
    if (!launched) return;
    paused = !paused;
    if (paused) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); paused = false; } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); reset(); } },
      ]);
    } else {
      hideOverlay();
    }
  }

  // ---------- Physics ----------
  function update() {
    if (!launched) { ball.x = paddle.x + paddle.w / 2; return; }
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x < ball.size || ball.x > W - ball.size) { ball.vx *= -1; sfx("wall"); }
    if (ball.y < ball.size) { ball.vy *= -1; sfx("wall"); }

    // Paddle
    if (ball.vy > 0 && ball.y + ball.size >= H - 24 - paddle.h &&
        ball.y + ball.size <= H - 24 + 8 &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
      const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = rel * (Math.PI / 3);
      const speed = Math.min(9, Math.hypot(ball.vx, ball.vy) + 0.15);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
      sfx("paddle");
    }

    // Ball lost
    if (ball.y > H) {
      lives--;
      stats.livesLost++;
      updateStats();
      sfx("error");
      if (lives <= 0) return endGame(false);
      launchBall();
      saveStats();
      checkAchievements();
      return;
    }

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.size > b.x && ball.x - ball.size < b.x + b.w &&
          ball.y + ball.size > b.y && ball.y - ball.size < b.y + b.h) {
        b.alive = false;
        score += 10;
        bricksThisGame++;
        stats.bricks++;
        stats.bestScore = Math.max(stats.bestScore, score);
        updateStats();
        sfx("brick");
        // Reflect based on overlap depth
        const overlapX = Math.min(ball.x + ball.size - b.x, b.x + b.w - (ball.x - ball.size));
        const overlapY = Math.min(ball.y + ball.size - b.y, b.y + b.h - (ball.y - ball.size));
        if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
        saveStats();
        checkAchievements();
        break;
      }
    }

    if (bricks.every((b) => !b.alive)) endGame(true);
  }

  // ---------- Rendering ----------
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);
    bricks.forEach((b) => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });
    ctx.fillStyle = "#58e0c9";
    ctx.fillRect(paddle.x, H - 24 - paddle.h, paddle.w, paddle.h);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function endGame(won) {
    launched = false;
    paused = false;

    stats.games++;
    stats.bestScore = Math.max(stats.bestScore, score);
    if (won) {
      stats.wins++;
      if (lives === 3) stats.perfectWins++;
    } else if (stats.bricks >= 250) {
      stats.grindGames++;
    }
    saveStats();
    checkAchievements();
    updateStats();
    sfx(won ? "win" : "over");
    if (won) confetti(90);

    showOverlay(
      won ? "You clear it! 🎉" : "Game Over",
      `Score: ${score}.`,
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

  function loop() {
    if (!paused) update();
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Init ----------
  function init() {
    updateBadgeCount();
    bindInput();
    reset();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__BREAKOUT = {
    ACHIEVEMENTS,
    TOTAL_BRICKS,
    stats,
    snap: () => ({
      score,
      lives,
      launched,
      paused,
      bricksThisGame,
      aliveBricks: bricks.filter((b) => b.alive).length,
      ball: ball ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, size: ball.size } : null,
      paddle: { x: paddle.x, w: paddle.w },
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    setBall: (x, y, vx, vy) => { ball = { x, y, vx, vy, size: 8 }; },
    setPaddleX: (x) => { paddle.x = x; },
    killBricks: (n) => {
      let killed = 0;
      for (const b of bricks) {
        if (killed >= n) break;
        if (b.alive) { b.alive = false; killed++; }
      }
      return killed;
    },
    newBricks,
    update,
    go,
    launchBall,
    reset,
    endGame,
    togglePause,
    checkAchievements,
    saveStats,
    updateBadgeCount,
    openAchv,
    closeAchv,
    overlay,
  };

  init();
})();
