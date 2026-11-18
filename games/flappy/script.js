// Flappy — pure vanilla JS, fully offline.
// One-button flappy-bird-style flyer with five modes and hand-drawn canvas art.
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
    util,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;
  const clamp = util.clamp;
  const TAU = Math.PI * 2;

  // ---------- DOM ----------
  const canvas = dom.byId("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = dom.byId("score");
  const bestEl = dom.byId("best");
  const gamesEl = dom.byId("games");
  const restartBtn = dom.byId("restart");
  const modeLabelEl = dom.byId("mode-label");
  const extraStatEl = dom.byId("extra-stat");
  const extraLabelEl = dom.byId("extra-label");
  const extraValueEl = dom.byId("extra-value");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants (classic-mode values are test-pinned) ----------
  const W = canvas.width;
  const H = canvas.height;
  window.Arcade.util.hidpiCanvas(canvas, ctx, W, H);
  const GRAVITY = 0.35;
  const FLAP = -6.5;
  const PIPE_SPEED = 2.4;
  const PIPE_W = 64;
  const GAP = 150;
  const GROUND_H = 40;
  const BIRD_R = 13;
  const BIRD_X = 90;

  const K = makeKeys("flappy");

  // ---------- Palettes ----------
  const THEMES = {
    classic: {
      sky: ["#4a90d9", "#8fd0f0", "#d9f1fb"], sun: "#fff3b0", cloud: "rgba(255,255,255,0.88)",
      hills: ["#7fc98a", "#4fa85f", "#2f7d48"],
      pipe: ["#7ee06a", "#4bb23f", "#2c7d2a"], cap: ["#a4f08f", "#3e9c34"],
      ground: ["#e7cf82", "#c7a450", "#4f9a45"],
      bird: ["#ffd453", "#ffc02e", "#e8971b"], birdWing: "#f0a63a", birdDark: "#d9881b",
    },
    sprint: {
      sky: ["#ff7e5f", "#ffb07c", "#ffe0b2"], sun: "#fff0c0", cloud: "rgba(255,240,225,0.8)",
      hills: ["#c26b5a", "#9c4f4a", "#6d3442"],
      pipe: ["#63d6c4", "#38ad9e", "#217c74"], cap: ["#8ff0df", "#27877e"],
      ground: ["#d9b07a", "#a98152", "#4b8d6a"],
      bird: ["#ffe083", "#ffc24d", "#e29426"], birdWing: "#f5a53c", birdDark: "#cf7a1d",
    },
    hard: {
      sky: ["#2b1e4a", "#59356e", "#9b5b76"], sun: "#ff8fa3", cloud: "rgba(190,170,210,0.35)",
      hills: ["#4a3358", "#352546", "#241a35"],
      pipe: ["#ff7d7d", "#d94f5f", "#9c2f45"], cap: ["#ff9c9c", "#a3344a"],
      ground: ["#5b4a62", "#3d3147", "#b4526a"],
      bird: ["#ff9a8b", "#ff6b6b", "#c93b50"], birdWing: "#e85555", birdDark: "#a83245",
    },
    zen: {
      sky: ["#9fd8e8", "#cdeaf0", "#fdf3e0"], sun: "#fff6d8", cloud: "rgba(255,255,255,0.92)",
      hills: ["#a7d9a0", "#7fc492", "#56a47e"],
      pipe: ["#a8e6c4", "#77c9a0", "#4f9d7d"], cap: ["#c6f6da", "#5cae88"],
      ground: ["#efe0ab", "#d5be82", "#6fb98a"],
      bird: ["#d9f0ff", "#9fd8f5", "#5aa7d6"], birdWing: "#79bfe4", birdDark: "#4788b8",
    },
    daily: {
      sky: ["#0b1c3a", "#1b3a68", "#35629b"], sun: "#f4f7ff", cloud: "rgba(180,205,245,0.35)",
      hills: ["#244a72", "#183555", "#102340"], stars: true,
      pipe: ["#7fe3ff", "#43b6dd", "#257fae"], cap: ["#a9efff", "#2b8fb8"],
      ground: ["#3d5573", "#2a3c56", "#63c2d8"],
      bird: ["#ffffff", "#dce9ff", "#9fb6dc"], birdWing: "#b9cee8", birdDark: "#7890b5",
    },
  };

  // ---------- Modes ----------
  // Classic values exactly match the pinned constants so the original
  // behaviour (and its tests) is unchanged. Other modes tweak the config.
  const MODES = {
    classic: {
      label: "Classic", theme: THEMES.classic,
      gravity: GRAVITY, flap: FLAP, speed: PIPE_SPEED, gap: GAP,
      spawnBase: 90, spawnMin: 72, spawnStep: 2, margin: 70,
      lives: 1, timed: 0, seeded: false,
    },
    sprint: {
      label: "Sprint", theme: THEMES.sprint,
      gravity: 0.36, flap: -6.4, speed: 2.8, gap: 142,
      spawnBase: 82, spawnMin: 66, spawnStep: 2, margin: 70,
      lives: 1, timed: 60, seeded: false,
    },
    hard: {
      label: "Hard", theme: THEMES.hard,
      gravity: 0.44, flap: -6.3, speed: 3.4, gap: 124,
      spawnBase: 74, spawnMin: 60, spawnStep: 2, margin: 66,
      lives: 1, timed: 0, seeded: false,
    },
    zen: {
      label: "Zen", theme: THEMES.zen,
      gravity: 0.28, flap: -6.0, speed: 1.9, gap: 190,
      spawnBase: 104, spawnMin: 92, spawnStep: 2, margin: 70,
      lives: 3, timed: 0, seeded: false,
    },
    daily: {
      label: "Daily", theme: THEMES.daily,
      gravity: GRAVITY, flap: FLAP, speed: PIPE_SPEED, gap: GAP,
      spawnBase: 90, spawnMin: 72, spawnStep: 2, margin: 70,
      lives: 1, timed: 0, seeded: true,
    },
  };
  const MODE_ORDER = ["classic", "sprint", "hard", "zen", "daily"];
  let mode = "classic";
  let cfg = MODES[mode];

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    best: 0,
    pipes: 0,
    flaps: 0,
    crashes: 0,
    bestSprint: 0,
    bestHard: 0,
    bestZen: 0,
    bestDaily: 0,
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

  // Optional haptic tap on supported phones; silently ignored elsewhere.
  function buzz(ms) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {
      /* not supported */
    }
  }

  function modeBestKey() {
    return { sprint: "bestSprint", hard: "bestHard", zen: "bestZen", daily: "bestDaily" }[mode] || null;
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
      records: () => {
        const rows = [
          ["Runs", stats.games],
          ["Best", stats.best],
          ["Pipes", stats.pipes],
          ["Flaps", stats.flaps],
          ["Crashes", stats.crashes],
        ];
        for (const m of MODE_ORDER.slice(1)) {
          const key = modeBestKeyFor(m);
          if (stats[key]) rows.push([MODES[m].label + " best", stats[key]]);
        }
        return rows;
      },
    });
  }

  function modeBestKeyFor(m) {
    return { sprint: "bestSprint", hard: "bestHard", zen: "bestZen", daily: "bestDaily" }[m] || null;
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
  audio.define("hurt", [[260, 0, 0.09, "sawtooth", 0.035, 150]]);
  audio.define("medal", [[660, 0, 0.07, "sine", 0.035], [990, 0.07, 0.1, "sine", 0.03]]);

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

  // Visual / mode state.
  let lives = 1;
  let invuln = 0;
  let timeLeft = 0;
  let scroll = 0;
  let wingPhase = 0;
  let shake = 0;
  let flash = 0;
  let particles = [];
  let popups = [];
  let dayRand = null;
  const clouds = [
    { x: 60, y: 86, s: 1.1, speed: 0.22, alpha: 0.85 },
    { x: 230, y: 156, s: 0.8, speed: 0.34, alpha: 0.7 },
    { x: 340, y: 250, s: 0.95, speed: 0.18, alpha: 0.6 },
    { x: 130, y: 320, s: 0.7, speed: 0.28, alpha: 0.5 },
  ];
  const stars = [];
  for (let i = 0; i < 26; i++) {
    stars.push({ x: (i * 97 + 23) % W, y: (i * 53 + 11) % 300, s: (i % 3) * 0.5 + 0.7, p: i * 0.7 });
  }

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
    lives = cfg.lives;
    invuln = 0;
    timeLeft = cfg.timed ? cfg.timed * 60 : 0;
    particles = [];
    popups = [];
    shake = 0;
    flash = 0;
    dayRand = cfg.seeded ? util.mulberry32(util.hashSeed("flappy-" + util.dateStr())) : null;
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
    if (modeLabelEl) modeLabelEl.textContent = cfg.label;
    if (extraStatEl) {
      if (cfg.timed) {
        extraStatEl.hidden = false;
        if (extraLabelEl) extraLabelEl.textContent = "Time";
        if (extraValueEl) {
          extraValueEl.textContent = Math.ceil(timeLeft / 60) + "s";
          extraValueEl.classList.toggle("is-low", timeLeft <= 10 * 60);
        }
      } else if (cfg.lives > 1) {
        extraStatEl.hidden = false;
        if (extraLabelEl) extraLabelEl.textContent = "Lives";
        if (extraValueEl) {
          extraValueEl.textContent = "❤".repeat(Math.max(0, lives));
          extraValueEl.classList.remove("is-low");
        }
      } else {
        extraStatEl.hidden = true;
      }
    }
  }

  function spawnInterval() {
    // Pipes get very slightly denser as the score climbs.
    return Math.max(cfg.spawnMin, cfg.spawnBase - Math.floor(score / 4) * cfg.spawnStep);
  }

  function spawnPipe() {
    const margin = cfg.margin;
    const rand = dayRand || Math.random;
    const gapCenter = margin + cfg.gap / 2 + rand() * (H - GROUND_H - margin * 2 - cfg.gap);
    pipes.push({ x: W + 10, gapTop: gapCenter - cfg.gap / 2, passed: false });
  }

  // ---------- Flow ----------
  function flap() {
    if (paused) return;
    if (state === "ready") {
      hideOverlay();
      state = "playing";
      beginRun();
      bird.vy = cfg.flap;
      stats.flaps++;
      saveStats();
      checkAchievements();
      sfx("flap");
      addPuff();
      return;
    }
    if (state !== "playing") return;
    bird.vy = cfg.flap;
    stats.flaps++;
    checkAchievements();
    sfx("flap");
    addPuff();
  }

  function addScore() {
    score++;
    stats.pipes++;
    stats.best = Math.max(stats.best, score);
    const mk = modeBestKey();
    if (mk) stats[mk] = Math.max(stats[mk], score);
    saveStats();
    checkAchievements();
    updateStatus();
    sfx("point");
    addSparkle();
    popups.push({ x: BIRD_X + 26, y: bird.y - 14, text: "+" + score, life: 34, max: 34 });
    flash = 0.5;
    if (score > 0 && score % 10 === 0) sfx("medal");
  }

  function crash() {
    if (state !== "playing") return;
    // Zen-style modes soak up a hit instead of ending the run.
    if (lives > 1 && invuln <= 0) {
      lives--;
      invuln = 70;
      bird.vy = cfg.flap * 0.7;
      burst(bird.y, 10, "rgba(255,255,255,0.9)");
      shake = 1;
      buzz(20);
      sfx("hurt");
      updateStatus();
      return;
    }
    state = "over";
    paused = false;

    stats.crashes++;
    stats.best = Math.max(stats.best, score);
    const mk = modeBestKey();
    if (mk) stats[mk] = Math.max(stats[mk], score);
    saveStats();
    checkAchievements();
    updateStatus();

    burst(bird.y, 22, cfg.theme.bird[1]);
    shake = 1;

    const isRecord = score > runStartBest;
    buzz(isRecord ? 40 : 25);
    if (isRecord) {
      sfx("win");
      confetti(80);
      flash = 1;
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

  function timeUp() {
    if (state !== "playing") return;
    state = "over";
    paused = false;
    stats.best = Math.max(stats.best, score);
    const mk = modeBestKey();
    if (mk) stats[mk] = Math.max(stats[mk], score);
    saveStats();
    checkAchievements();
    updateStatus();
    sfx("over");
    showOverlay("Time's up! ⏱️", `Score: ${score}. Best: ${stats.best}. Run ${stats.games}.`, [
      {
        label: "Play again",
        onClick: () => {
          hideOverlay();
          reset(false);
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

  function setMode(next) {
    if (!MODES[next] || next === mode) return;
    mode = next;
    cfg = MODES[mode];
    sfx("select");
    updateModeUI();
    reset(true);
    showStartOverlay();
  }

  function updateModeUI() {
    dom.all(".mode-chip").forEach((btn) => {
      const on = btn.dataset && btn.dataset.mode === mode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (modeLabelEl) modeLabelEl.textContent = cfg.label;
  }

  // ---------- Particles ----------
  function addPuff() {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: BIRD_X - 8, y: bird.y + 6 + (Math.random() - 0.5) * 8,
        vx: -1.4 - Math.random() * 1.2, vy: (Math.random() - 0.5) * 1.2,
        gravity: 0.01, life: 18 + Math.random() * 10, max: 28,
        size: 2 + Math.random() * 2.5, color: "rgba(255,255,255,0.85)",
      });
    }
  }

  function addSparkle() {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      particles.push({
        x: BIRD_X, y: bird.y,
        vx: Math.cos(a) * (1.5 + Math.random()), vy: Math.sin(a) * (1.5 + Math.random()),
        gravity: 0.04, life: 22 + Math.random() * 12, max: 34,
        size: 2 + Math.random() * 2, color: i % 2 ? "#fff3a8" : "#ffffff",
      });
    }
  }

  function burst(y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = 1.5 + Math.random() * 3;
      particles.push({
        x: BIRD_X, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        gravity: 0.12, life: 30 + Math.random() * 20, max: 50,
        size: 2 + Math.random() * 3, color,
      });
    }
  }

  function updateEffects() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const q of popups) {
      q.y -= 0.7;
      q.life--;
    }
    popups = popups.filter((q) => q.life > 0);
    if (shake > 0) shake *= 0.86;
    if (flash > 0) flash *= 0.88;
    if (invuln > 0) invuln--;
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
    scroll += cfg.speed * 0.5;
    wingPhase += 0.22;
    if (state !== "playing") return;
    if (paused) return;

    frame++;
    if (cfg.timed) {
      timeLeft--;
      if (timeLeft <= 0) return timeUp();
      if (frame % 30 === 0) updateStatus();
    }

    spawnIn--;
    if (spawnIn <= 0) {
      spawnPipe();
      spawnIn = spawnInterval();
    }

    bird.vy += cfg.gravity;
    bird.y += bird.vy;

    for (const p of pipes) p.x -= cfg.speed;
    pipes = pipes.filter((p) => p.x + PIPE_W > -4);

    // Scoring — pipe fully behind the bird.
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true;
        addScore();
      }
    }

    // Ceiling / ground.
    if (bird.y - BIRD_R <= 0 || bird.y + BIRD_R >= H - GROUND_H) {
      if (lives > 1 && invuln > 0) {
        // Gentle bounce while briefly invulnerable (Zen modes).
        if (bird.y - BIRD_R <= 0) { bird.y = BIRD_R + 2; bird.vy = Math.abs(bird.vy) * 0.4; }
        else { bird.y = H - GROUND_H - BIRD_R - 2; bird.vy = -Math.abs(bird.vy) * 0.4; }
      } else {
        return crash();
      }
    }

    // Pipes.
    if (invuln <= 0) {
      const gapBottom = (p) => p.gapTop + cfg.gap;
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
  }

  // ---------- Rendering ----------
  function grad(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    return g;
  }

  function drawSky(theme) {
    ctx.fillStyle = grad(0, 0, 0, H, [[0, theme.sky[0]], [0.55, theme.sky[1]], [1, theme.sky[2]]]);
    ctx.fillRect(0, 0, W, H);
  }

  function drawSun(theme) {
    const sx = 322, sy = 76;
    if (theme.stars) {
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(bob * 0.6 + s.p));
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 5; i >= 1; i--) {
      ctx.globalAlpha = 0.035 * (6 - i);
      ctx.fillStyle = theme.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 24 + i * 13, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(sx - 7, sy - 7, 7, 0, TAU);
    ctx.fill();
  }

  function drawClouds(theme) {
    const span = W + 150;
    ctx.fillStyle = theme.cloud;
    for (const c of clouds) {
      const x = (((c.x - scroll * c.speed) % span) + span) % span - 75;
      ctx.globalAlpha = c.alpha;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 27 * c.s, 12 * c.s, 0, 0, TAU);
      ctx.ellipse(x + 19 * c.s, c.y + 4, 19 * c.s, 10 * c.s, 0, 0, TAU);
      ctx.ellipse(x - 18 * c.s, c.y + 5, 17 * c.s, 9 * c.s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHills(theme) {
    const layer = (baseY, amp, color, speed) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const off = scroll * speed;
      for (let x = -8; x <= W + 8; x += 8) {
        const y = baseY + Math.sin((x + off) * 0.014) * amp + Math.sin((x + off) * 0.031) * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };
    layer(H - GROUND_H - 74, 26, theme.hills[0], 0.25);
    layer(H - GROUND_H - 44, 18, theme.hills[1], 0.45);
    layer(H - GROUND_H - 20, 10, theme.hills[2], 0.7);
  }

  function drawPipe(x, y, h, isTop, theme) {
    if (h <= 0) return;
    ctx.fillStyle = grad(x, 0, x + PIPE_W, 0, [
      [0, theme.pipe[2]], [0.18, theme.pipe[1]], [0.55, theme.pipe[0]],
      [0.85, theme.pipe[1]], [1, theme.pipe[2]],
    ]);
    ctx.fillRect(x, y, PIPE_W, h);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + 8, y, 6, h);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(x + PIPE_W - 12, y, 6, h);

    const capH = 24;
    const capY = isTop ? y + h - capH : y;
    ctx.fillStyle = theme.cap[0];
    ctx.fillRect(x - 5, capY, PIPE_W + 10, capH);
    ctx.fillStyle = theme.cap[1];
    ctx.fillRect(x - 5, capY + (isTop ? 0 : capH - 5), PIPE_W + 10, 5);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - 5, capY + (isTop ? 0 : 4), PIPE_W + 10, 3);
  }

  function drawPipes(theme) {
    for (const p of pipes) {
      const gapBottom = p.gapTop + cfg.gap;
      drawPipe(p.x, 0, p.gapTop, true, theme);
      drawPipe(p.x, gapBottom, H - GROUND_H - gapBottom, false, theme);
    }
  }

  function drawGround(theme) {
    const gy = H - GROUND_H;
    ctx.fillStyle = theme.ground[2];
    ctx.fillRect(0, gy, W, 8);
    ctx.fillStyle = theme.ground[0];
    ctx.fillRect(0, gy + 8, W, GROUND_H - 8);
    ctx.fillStyle = theme.ground[1];
    const off = (scroll * cfg.speed) % 26;
    for (let x = -26 + off; x < W; x += 26) ctx.fillRect(x, gy + 14, 13, GROUND_H - 14);
    ctx.fillStyle = theme.ground[2];
    for (let x = -20 + off; x < W; x += 20) {
      ctx.fillRect(x, gy - 4, 3, 5);
      ctx.fillRect(x + 7, gy - 7, 3, 8);
    }
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, gy, W, 2);
  }

  function drawBird(theme) {
    const by = state === "ready" ? bird.y + Math.sin(bob) * 8 : bird.y;
    if (invuln > 0 && Math.floor(invuln / 6) % 2 === 0) return;
    const angle = clamp(bird.vy * 0.07, -0.55, 1.15);
    ctx.save();
    ctx.translate(BIRD_X, by);
    ctx.rotate(angle);

    // Tail.
    ctx.fillStyle = theme.birdDark;
    ctx.beginPath();
    ctx.moveTo(-BIRD_R + 2, 0);
    ctx.lineTo(-BIRD_R - 11, -7);
    ctx.lineTo(-BIRD_R - 9, 8);
    ctx.closePath();
    ctx.fill();

    // Body.
    ctx.fillStyle = grad(-BIRD_R, -BIRD_R, BIRD_R, BIRD_R, [
      [0, theme.bird[0]], [0.55, theme.bird[1]], [1, theme.bird[2]],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.beginPath();
    ctx.ellipse(1, 5, 8, 5, 0, 0, TAU);
    ctx.fill();

    // Animated wing.
    const wf = Math.sin(wingPhase);
    ctx.save();
    ctx.translate(-3, 1);
    ctx.rotate(-0.35 + wf * 0.45);
    ctx.fillStyle = theme.birdWing;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Beak.
    ctx.fillStyle = "#ff7a3d";
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 2, -2);
    ctx.lineTo(BIRD_R + 10, 2);
    ctx.lineTo(BIRD_R - 2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e85f28";
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 2, 2);
    ctx.lineTo(BIRD_R + 10, 2);
    ctx.lineTo(BIRD_R - 2, 6);
    ctx.closePath();
    ctx.fill();

    // Eye.
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(5, -5, 5.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#16202c";
    ctx.beginPath();
    ctx.arc(6.4, -5, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -6, 0.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    for (const q of popups) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = "#fff3a8";
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(theme) {
    // Mode plaque.
    ctx.textAlign = "left";
    ctx.font = "bold 12px 'Segoe UI', sans-serif";
    const label = mode === "daily" ? cfg.label + " · " + util.dateStr() : cfg.label;
    const w = (ctx.measureText(label).width || 60) + 18;
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(8, 8, w, 24);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(label, 17, 24);

    if (cfg.timed) {
      const t = Math.max(0, Math.ceil(timeLeft / 60));
      ctx.textAlign = "right";
      ctx.font = "bold 18px 'Segoe UI', sans-serif";
      ctx.fillStyle = t <= 10 && Math.floor(bob * 3) % 2 ? "#ff8a8a" : "#fff";
      ctx.fillText(t + "s", W - 14, 27);
    } else if (lives > 1) {
      ctx.textAlign = "right";
      ctx.font = "bold 16px 'Segoe UI', sans-serif";
      ctx.fillStyle = "#ff8fa3";
      ctx.fillText("❤".repeat(Math.max(0, lives)), W - 14, 26);
    }

    // Score number on the canvas as well as the HUD.
    ctx.textAlign = "center";
    ctx.font = "bold 34px 'Segoe UI', sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(String(score), W / 2, 58);
    ctx.fillText(String(score), W / 2, 58);
  }

  function drawReadyPrompt() {
    const t = Math.sin(bob * 0.7);
    ctx.textAlign = "center";
    ctx.font = "bold 30px 'Segoe UI', sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.strokeText("GET READY", W / 2 + 2, 122);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("GET READY", W / 2, 120);
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255," + (0.65 + 0.3 * t) + ")";
    ctx.fillText("TAP / SPACE TO FLY", W / 2, 150);
  }

  function draw() {
    const theme = cfg.theme;
    drawSky(theme);
    drawSun(theme);
    drawClouds(theme);
    drawHills(theme);
    drawPipes(theme);
    drawGround(theme);
    drawEffects();
    if (shake > 0.02) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);
    }
    drawBird(theme);
    if (shake > 0.02) ctx.restore();
    drawHud(theme);
    if (state === "ready") drawReadyPrompt();
    if (flash > 0.02) {
      ctx.globalAlpha = Math.min(0.5, flash * 0.5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Overlays ----------
  function showStartOverlay() {
    showOverlay("Flappy", "Tap / Space to flap. Thread the pipes to score — pick a mode above!", [
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
    if (key >= "1" && key <= "5") {
      const next = MODE_ORDER[Number(key) - 1];
      if (e.preventDefault) e.preventDefault();
      setMode(next);
      return;
    }
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

    dom.all(".mode-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.unlock();
        setMode(btn.dataset && btn.dataset.mode);
      });
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
    updateEffects();
    update();
    draw();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    updateModeUI();
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
    MODES,
    MODE_ORDER,
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
    get mode() {
      return mode;
    },
    get lives() {
      return lives;
    },
    get timeLeft() {
      return timeLeft;
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
      mode,
      lives,
      timeLeft,
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
    setMode,
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
    particles: () => particles.slice(),
    popups: () => popups.slice(),
  };

  init();
})();
