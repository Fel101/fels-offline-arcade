// Flappy — pure vanilla JS, fully offline.
// One-button flappy-bird-style flyer: gravity, flap, pipes, crash.
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
  const GRAVITY = 0.35;
  const FLAP = -6.5;
  const PIPE_SPEED = 2.4;
  const PIPE_W = 64;
  const GAP = 150;
  const GROUND_H = 40;
  const BIRD_R = 13;
  const BIRD_X = 90;

  const K = makeKeys("flappy");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    best: 0,
    pipes: 0,
    flaps: 0,
    crashes: 0,
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
    const raw = store.get("flappy-best", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.best) stats.best = n;
      store.remove("flappy-best");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🐣", name: "First Flight", desc: "Pass your first pipe.", stat: "pipes", goal: 1 },
    { id: "score5", icon: "🎈", name: "Up and Away", desc: "Score 5 in one run.", stat: "best", goal: 5 },
    { id: "score10", icon: "🪁", name: "Pipe Cleaner", desc: "Score 10 in one run.", stat: "best", goal: 10 },
    { id: "score20", icon: "☁️", name: "Cloud Nine", desc: "Score 20 in one run.", stat: "best", goal: 20 },
    { id: "score30", icon: "👑", name: "Sky Legend", desc: "Score 30 in one run.", stat: "best", goal: 30 },
    { id: "games10", icon: "🎮", name: "Persistent", desc: "Play 10 runs.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Regular Flyer", desc: "Play 25 runs.", stat: "games", goal: 25 },
    { id: "flaps100", icon: "🪶", name: "Flapper", desc: "Flap 100 times.", stat: "flaps", goal: 100 },
    { id: "flaps500", icon: "💪", name: "Wing Workout", desc: "Flap 500 times.", stat: "flaps", goal: 500 },
    { id: "flaps1000", icon: "🦅", name: "Wings of Steel", desc: "Flap 1,000 times.", stat: "flaps", goal: 1000 },
    { id: "pipes50", icon: "🧱", name: "Plumber", desc: "Pass 50 pipes in total.", stat: "pipes", goal: 50 },
    { id: "pipes250", icon: "🏗️", name: "Pipe Dream", desc: "Pass 250 pipes in total.", stat: "pipes", goal: 250 },
    { id: "crashes10", icon: "💥", name: "Learning to Fall", desc: "Crash 10 times.", stat: "crashes", goal: 10 },
    { id: "crashes50", icon: "🛠️", name: "Crash Test Dummy", desc: "Crash 50 times.", stat: "crashes", goal: 50 },
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
        ["Runs", stats.games],
        ["Best", stats.best],
        ["Pipes", stats.pipes],
        ["Flaps", stats.flaps],
        ["Crashes", stats.crashes],
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
  audio.define("flap", [[420, 0, 0.04, "triangle", 0.03]]);
  audio.define("point", [[720, 0, 0.06, "triangle", 0.045]]);

  // ---------- Game state ----------
  let bird;
  let pipes;
  let score;
  let state; // ready | playing | over
  let frame;
  let spawnIn;
  let bob = 0;
  let paused = false;
  let runCounted = false;
  let runStartBest = 0;

  // ---------- Setup ----------
  function reset(toReady) {
    bird = { y: H / 2 - 40, vy: 0 };
    pipes = [];
    score = 0;
    frame = 0;
    spawnIn = 60; // the first pipe arrives a bit sooner
    bob = 0;
    paused = false;
    runCounted = false;
    runStartBest = stats.best;
    state = toReady ? "ready" : "playing";
    hideOverlay();
    updateStatus();
    if (!toReady) beginRun();
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
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(stats.best, score);
    gamesEl.textContent = stats.games;
  }

  function spawnInterval() {
    // Pipes get very slightly denser as the score climbs.
    return Math.max(72, 90 - Math.floor(score / 4) * 2);
  }

  function spawnPipe() {
    const margin = 70;
    const gapCenter = margin + GAP / 2 + Math.random() * (H - GROUND_H - margin * 2 - GAP);
    pipes.push({ x: W + 10, gapTop: gapCenter - GAP / 2, passed: false });
  }

  // ---------- Flow ----------
  function flap() {
    if (paused) return;
    if (state === "ready") {
      hideOverlay();
      state = "playing";
      beginRun();
      bird.vy = FLAP;
      stats.flaps++;
      saveStats();
      checkAchievements();
      sfx("flap");
      return;
    }
    if (state !== "playing") return;
    bird.vy = FLAP;
    stats.flaps++;
    checkAchievements();
    sfx("flap");
  }

  function addScore() {
    score++;
    stats.pipes++;
    stats.best = Math.max(stats.best, score);
    saveStats();
    checkAchievements();
    updateStatus();
    sfx("point");
  }

  function crash() {
    if (state !== "playing") return;
    state = "over";
    paused = false;

    stats.crashes++;
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
      `Score: ${score}. Best: ${stats.best}. Run ${stats.games}.`,
      [
        {
          label: "Play again",
          onClick: () => {
            hideOverlay();
            reset(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
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

  // ---------- Physics ----------
  function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function update() {
    bob += 0.05;
    if (state !== "playing") return;
    if (paused) return;

    frame++;
    spawnIn--;
    if (spawnIn <= 0) {
      spawnPipe();
      spawnIn = spawnInterval();
    }

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    for (const p of pipes) p.x -= PIPE_SPEED;
    pipes = pipes.filter((p) => p.x + PIPE_W > -4);

    // Scoring — pipe fully behind the bird.
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true;
        addScore();
      }
    }

    // Ceiling / ground.
    if (bird.y - BIRD_R <= 0 || bird.y + BIRD_R >= H - GROUND_H) return crash();

    // Pipes.
    const gapBottom = (p) => p.gapTop + GAP;
    for (const p of pipes) {
      if (BIRD_X + BIRD_R < p.x || BIRD_X - BIRD_R > p.x + PIPE_W) continue;
      if (circleHitsRect(BIRD_X, bird.y, BIRD_R, p.x, 0, PIPE_W, p.gapTop)) return crash();
      if (
        circleHitsRect(
          BIRD_X,
          bird.y,
          BIRD_R,
          p.x,
          gapBottom(p),
          PIPE_W,
          H - GROUND_H - gapBottom(p)
        )
      )
        return crash();
    }
  }

  // ---------- Rendering ----------
  function draw() {
    // Sky.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4a90d9");
    g.addColorStop(1, "#a8d8f0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sun + clouds (simple flat art).
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(330, 70, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const [cx, cy, s] of [[70, 90, 1], [190, 150, 0.8], [300, 220, 0.9]]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 26 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 18 * s, cy + 4 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 18 * s, cy + 4 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pipes.
    for (const p of pipes) {
      const gapBottom = p.gapTop + GAP;
      drawPipe(p.x, 0, p.gapTop, true);
      drawPipe(p.x, gapBottom, H - GROUND_H - gapBottom, false);
    }

    // Ground strip.
    ctx.fillStyle = "#d8b25a";
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "#8a6d3b";
    ctx.fillRect(0, H - GROUND_H, W, 6);

    // Bird.
    const by = state === "ready" ? bird.y + Math.sin(bob) * 8 : bird.y;
    ctx.fillStyle = "#ffcc4d";
    ctx.beginPath();
    ctx.arc(BIRD_X, by, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.fillStyle = "#f0a63a";
    ctx.beginPath();
    ctx.ellipse(BIRD_X - 4, by + 2, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = "#ff6b3d";
    ctx.beginPath();
    ctx.moveTo(BIRD_X + BIRD_R - 2, by - 1);
    ctx.lineTo(BIRD_X + BIRD_R + 9, by + 3);
    ctx.lineTo(BIRD_X + BIRD_R - 2, by + 6);
    ctx.closePath();
    ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(BIRD_X + 5, by - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(BIRD_X + 6.5, by - 4, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // "Get ready" hint on the start screen.
    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 22px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get Ready!", W / 2, 110);
    }
  }

  function drawPipe(x, y, h, isTop) {
    if (h <= 0) return;
    ctx.fillStyle = "#58c24a";
    ctx.fillRect(x, y, PIPE_W, h);
    ctx.fillStyle = "#3f9c34";
    ctx.fillRect(x, y, 8, h); // left shade
    ctx.fillRect(x + PIPE_W - 8, y, 8, h); // right shade
    // Cap at the gap edge.
    const capH = 22;
    const capY = isTop ? y + h - capH : y;
    ctx.fillStyle = "#6fdd5e";
    ctx.fillRect(x - 4, capY, PIPE_W + 8, capH);
    ctx.fillStyle = "#3f9c34";
    ctx.fillRect(x - 4, capY + (isTop ? 0 : capH - 4), PIPE_W + 8, 4);
  }

  // ---------- Overlays ----------
  function showStartOverlay() {
    showOverlay("Flappy", "Click / Space to flap. Thread the pipes to score!", [
      {
        label: "Start",
        onClick: () => {
          hideOverlay();
          state = "playing";
          beginRun();
        },
      },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
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
      if (state === "over") {
        reset(false);
        return;
      }
      flap();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", (e) => {
      if (e.preventDefault) e.preventDefault();
      audio.unlock();
      if (paused || state === "over") return; // use the overlay button
      flap();
    });
    restartBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset(true);
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
  const gameLoop = loopApi.create(() => {
    update();
    draw();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    reset(true);
    renderAchvGrid();
    showStartOverlay();
    gameLoop.start();
  }

  // Test hook — harmless in normal play.
  window.__FLAPPY = {
    W,
    H,
    GRAVITY,
    FLAP,
    GAP,
    GROUND_H,
    BIRD_R,
    BIRD_X,
    PIPE_W,
    ACHIEVEMENTS,
    stats,
    get state() {
      return state;
    },
    get paused() {
      return paused;
    },
    get score() {
      return score;
    },
    snap: () => ({
      state,
      paused,
      score,
      frame,
      spawnIn,
      bird: { y: bird.y, vy: bird.vy },
      pipes: pipes.map((p) => ({ x: p.x, gapTop: p.gapTop, passed: p.passed })),
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    setBird: (y, vy) => {
      bird.y = y;
      bird.vy = vy === undefined ? 0 : vy;
    },
    setPipes: (arr) => {
      pipes = (arr || []).map((p) => ({
        x: p.x,
        gapTop: p.gapTop,
        passed: !!p.passed,
      }));
    },
    addPipe: (x, gapTop) => {
      pipes.push({ x, gapTop, passed: false });
    },
    setSpawnIn: (n) => {
      spawnIn = n;
    },
    step: update,
    draw,
    reset,
    flap,
    crash,
    spawnPipe,
    beginRun,
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
