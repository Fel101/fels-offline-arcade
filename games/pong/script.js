// Pong — pure vanilla JS, fully offline.
// First to 5 wins. Mouse or ↑/↓ vs a CPU with three speeds.
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
  const showToast = toast.show;

  // ---------- DOM ----------
  const canvas = dom.byId("game");
  const ctx = canvas.getContext("2d");
  const playerEl = dom.byId("player");
  const cpuEl = dom.byId("cpu");
  const winsEl = dom.byId("wins");
  const startBtn = dom.byId("start");
  const diffSel = dom.byId("difficulty");
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
  const PADDLE_H = 80, PADDLE_W = 12, WIN_SCORE = 5;
  const DIFFS = { easy: 0.06, medium: 0.1, hard: 0.16 };

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "debut", icon: "🏓", name: "Debut", desc: "Win your first match.", stat: "wins", goal: 1 },
    { id: "five", icon: "🎖️", name: "Matchmaker", desc: "Win 5 matches.", stat: "wins", goal: 5 },
    { id: "twentyfive", icon: "🏆", name: "Champion", desc: "Win 25 matches.", stat: "wins", goal: 25 },
    { id: "fifty", icon: "👑", name: "Legend", desc: "Win 50 matches.", stat: "wins", goal: 50 },
    { id: "hard1", icon: "🔥", name: "Hard Court", desc: "Win a match on Hard.", stat: "hardWins", goal: 1 },
    { id: "sweeps", icon: "💯", name: "Clean Sweep", desc: "Win a match 5–0.", stat: "sweeps", goal: 1 },
    { id: "clutch", icon: "🫀", name: "Clutch", desc: "Win a match 5–4.", stat: "clutch", goal: 1 },
    { id: "comeback", icon: "🎢", name: "Cameback", desc: "Win a match after trailing.", stat: "comebacks", goal: 1 },
    { id: "rally10", icon: "🏸", name: "Ping Pong", desc: "10 paddle hits in one rally.", stat: "maxRally", goal: 10 },
    { id: "rally25", icon: "⚡", name: "Tennis Player", desc: "25 paddle hits in one rally.", stat: "maxRally", goal: 25 },
    { id: "rally50", icon: "🌟", name: "Superstar", desc: "50 paddle hits in one rally.", stat: "maxRally", goal: 50 },
    { id: "games10", icon: "🎮", name: "Seasoned", desc: "Play 10 matches.", stat: "rounds", goal: 10 },
    { id: "games50", icon: "🕹️", name: "Arcade Regular", desc: "Play 50 matches.", stat: "rounds", goal: 50 },
    { id: "games100", icon: "🏛️", name: "Centurion", desc: "Play 100 matches.", stat: "rounds", goal: 100 },
  ];

  const DEFAULT_STATS = {
    wins: 0,
    losses: 0,
    rounds: 0,
    hardWins: 0,
    sweeps: 0,
    clutch: 0,
    comebacks: 0,
    maxRally: 0,
    maxSpeed: 0,
  };

  const K = makeKeys("pong");

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
  audio.define("paddle", [[480, 0, 0.04, "square", 0.045]]);
  audio.define("wall", [[320, 0, 0.035, "sine", 0.04]]);
  audio.define("point", [
    [520, 0, 0.05, "triangle", 0.05],
    [390, 0.045, 0.07, "triangle", 0.04],
  ]);

  // ---------- State ----------
  let playerScore, cpuScore, running, paused, aiSpeed;
  let difficulty = "medium";
  let mouseY = null;
  let keys = { up: false, down: false };
  let ball = null;
  let rally = 0;
  let everTrailed = false;
  let resumeAfterModal = false;

  const paddleL = { x: 20, y: H / 2 - PADDLE_H / 2, w: PADDLE_W };
  const paddleR = { x: W - 20 - PADDLE_W, y: H / 2 - PADDLE_H / 2, w: PADDLE_W };

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
        ["Matches", stats.rounds],
        ["Best rally", stats.maxRally],
        ["Fastest ball", stats.maxSpeed.toFixed(1)],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (running && !paused) {
        paused = true;
        resumeAfterModal = true;
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (running) paused = false;
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
  function resetBall(dir) {
    ball = {
      x: W / 2, y: H / 2, size: 10,
      vx: 5 * (dir || (Math.random() < 0.5 ? 1 : -1)),
      vy: (Math.random() * 4 - 2),
    };
  }

  function resetGame() {
    playerScore = 0; cpuScore = 0;
    rally = 0;
    everTrailed = false;
    aiSpeed = DIFFS[difficulty] || DIFFS.medium;
    updateScores();
    paddleL.y = H / 2 - PADDLE_H / 2;
    paddleR.y = H / 2 - PADDLE_H / 2;
    resetBall();
    running = false;
    paused = false;
  }

  function updateScores() {
    playerEl.textContent = playerScore;
    cpuEl.textContent = cpuScore;
  }

  function setDifficulty(d, persist) {
    if (!DIFFS[d]) return;
    difficulty = d;
    aiSpeed = DIFFS[d];
    if (diffSel) diffSel.value = d;
    if (persist !== false) store.set(K.diff, d);
  }

  // ---------- Input ----------
  function bindInput() {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseY = (e.clientY - rect.top) * (H / rect.height);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") keys.up = true;
      if (e.key === "ArrowDown") keys.down = true;
      if (e.key === "p" || e.key === "P") togglePause();
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowDown") keys.down = false;
    });

    startBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) resetGame();
      running = true;
      paused = false;
    });

    diffSel.addEventListener("change", () => {
      setDifficulty(diffSel.value);
      sfx("select");
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !paused) togglePause();
    });
    window.addEventListener("blur", () => {
      if (running && !paused && achvModal.hidden) togglePause();
    });

    audio.bindUnlock();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); paused = false; } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); resetGame(); } },
      ]);
    } else {
      hideOverlay();
    }
  }

  // ---------- Physics ----------
  function movePaddles() {
    const speed = 8;
    if (keys.up) paddleL.y -= speed;
    if (keys.down) paddleL.y += speed;
    if (mouseY !== null) {
      const target = mouseY - PADDLE_H / 2;
      paddleL.y += (target - paddleL.y) * 0.4;
    }
    paddleL.y = Math.max(0, Math.min(H - PADDLE_H, paddleL.y));

    // AI follows the ball with limited speed.
    const target = ball.y - PADDLE_H / 2;
    paddleR.y += Math.max(-aiSpeed * 12, Math.min(aiSpeed * 12, target - paddleR.y));
    paddleR.y = Math.max(0, Math.min(H - PADDLE_H, paddleR.y));
  }

  function bounce(paddle) {
    const rel = ball.y - (paddle.y + PADDLE_H / 2);
    const norm = rel / (PADDLE_H / 2);
    const angle = norm * (Math.PI / 3); // up to 60°
    const speed = Math.min(11, Math.hypot(ball.vx, ball.vy) + 0.3);
    const dir = paddle === paddleL ? 1 : -1;
    ball.vx = dir * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    rally++;
    stats.maxRally = Math.max(stats.maxRally, rally);
    stats.maxSpeed = Math.max(stats.maxSpeed, Math.hypot(ball.vx, ball.vy));
    sfx("paddle");
  }

  function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y < ball.size) { ball.y = ball.size; ball.vy *= -1; sfx("wall"); }
    if (ball.y > H - ball.size) { ball.y = H - ball.size; ball.vy *= -1; sfx("wall"); }

    // Left paddle
    if (ball.vx < 0 && ball.x - ball.size < paddleL.x + paddleL.w &&
        ball.x > paddleL.x && ball.y > paddleL.y && ball.y < paddleL.y + PADDLE_H) {
      bounce(paddleL);
    }
    // Right paddle
    if (ball.vx > 0 && ball.x + ball.size > paddleR.x &&
        ball.x < paddleR.x + paddleR.w && ball.y > paddleR.y && ball.y < paddleR.y + PADDLE_H) {
      bounce(paddleR);
    }

    // Scoring
    if (ball.x < 0) { cpuScore++; scored(); }
    else if (ball.x > W) { playerScore++; scored(); }
  }

  function scored() {
    updateScores();
    if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) return endGame();
    if (cpuScore > playerScore) everTrailed = true;
    rally = 0;
    sfx("point");
    resetBall(playerScore > cpuScore ? -1 : 1);
  }

  // ---------- Rendering ----------
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);
    // center dashed line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#58e0c9";
    ctx.fillRect(paddleL.x, paddleL.y, paddleL.w, PADDLE_H);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(paddleR.x, paddleR.y, paddleR.w, PADDLE_H);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function endGame() {
    running = false;
    paused = false;
    const youWon = playerScore >= WIN_SCORE;

    stats.rounds++;
    stats.maxRally = Math.max(stats.maxRally, rally);
    if (youWon) {
      stats.wins++;
      if (difficulty === "hard") stats.hardWins++;
      if (cpuScore === 0) stats.sweeps++;
      if (cpuScore === WIN_SCORE - 1) stats.clutch++;
      if (everTrailed) stats.comebacks++;
    } else {
      stats.losses++;
    }
    saveStats();
    checkAchievements();
    winsEl.textContent = stats.wins;
    sfx(youWon ? "win" : "over");
    if (youWon) confetti(80);

    showOverlay(
      youWon ? "You win! 🎉" : "CPU wins 🤖",
      `Final score ${playerScore} – ${cpuScore}.`,
      [
        {
          label: "Play again",
          onClick: () => {
            hideOverlay();
            resetGame();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function loop() {
    if (!paused) {
      movePaddles();
      if (running) updateBall();
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Init ----------
  function init() {
    const savedDiff = store.get(K.diff, "medium");
    setDifficulty(DIFFS[savedDiff] ? savedDiff : "medium", false);
    winsEl.textContent = stats.wins;
    updateBadgeCount();
    bindInput();
    resetGame();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__PONG = {
    DIFFS,
    ACHIEVEMENTS,
    stats,
    paddleL,
    paddleR,
    snap: () => ({
      playerScore,
      cpuScore,
      running,
      paused,
      rally,
      everTrailed,
      difficulty,
      aiSpeed,
      ball: ball ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, size: ball.size } : null,
      paddleLY: paddleL.y,
      paddleRY: paddleR.y,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    setBall: (x, y, vx, vy) => { ball = { x, y, vx, vy, size: 10 }; },
    setPaddleY: (which, y) => {
      (which === "l" ? paddleL : paddleR).y = y;
    },
    movePaddles,
    updateBall,
    bounce,
    scored,
    resetGame,
    startGame: () => {
      if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) resetGame();
      running = true;
      paused = false;
    },
    endGame,
    togglePause,
    setDifficulty,
    checkAchievements,
    saveStats,
    updateBadgeCount,
    openAchv,
    closeAchv,
    overlay,
  };

  init();
})();
