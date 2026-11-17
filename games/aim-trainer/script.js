// Aim Trainer — click the targets fast, chase accuracy and reaction time.
// Pure vanilla JS, fully offline. Shared plumbing (storage, audio, toasts,
// overlay, confetti, badges, modal, loop) comes from ../../js/arcade-core.js.
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
  const timeEl = dom.byId("time");
  const accEl = dom.byId("acc");
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
  const ROUND_MS = 30000;
  const TARGET_SCORE = 1500;
  const TARGET_LIFETIME = 1300;
  const TARGET_MIN_R = 16;
  const TARGET_MAX_R = 30;
  const MARGIN = 46;

  const K = makeKeys("aim-trainer");

  // ---------- Seeded RNG ----------
  let rngState = 0x7f4a1c3;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    bestScore: 0,
    hits: 0,
    misses: 0,
    shots: 0,
    bestAccuracy: 0,
    bestReaction: 0, // fastest hit in ms (0 = none yet)
    bullseyes: 0,
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

  function migrateLegacy() {
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Reach the target score.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Reach the target 5 times.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Reach the target 10 times.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 rounds.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Play 25 rounds.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Reach the target 2 rounds in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Reach the target 3 rounds in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Reach the target 5 rounds in a row.", stat: "bestStreak", goal: 5 },
    { id: "score1k", icon: "1️⃣", name: "Sharpshooter", desc: "Score 1,000 in a round.", stat: "bestScore", goal: 1000 },
    { id: "score2k", icon: "💰", name: "Deadeye", desc: "Score 2,000 in a round.", stat: "bestScore", goal: 2000 },
    { id: "accuracy80", icon: "📊", name: "On Target", desc: "Finish a round with 80% accuracy.", stat: "bestAccuracy", goal: 80 },
    {
      id: "reaction300",
      icon: "⏱️",
      name: "Quick Draw",
      desc: "Hit a target within 300 ms.",
      stat: "bestReaction",
      goal: 1,
      satisfied: () => stats.bestReaction > 0 && stats.bestReaction <= 300,
      progress: () => ({
        pct: stats.bestReaction > 0 ? Math.max(0, 100 - (stats.bestReaction / 600) * 100) : 0,
        now: stats.bestReaction > 0 ? 1 : 0,
        text: stats.bestReaction > 0 ? `${stats.bestReaction} ms` : "—",
      }),
    },
    {
      id: "reaction200",
      icon: "🚀",
      name: "Lightning",
      desc: "Hit a target within 200 ms.",
      stat: "bestReaction",
      goal: 1,
      satisfied: () => stats.bestReaction > 0 && stats.bestReaction <= 200,
      progress: () => ({
        pct: stats.bestReaction > 0 ? Math.max(0, 100 - (stats.bestReaction / 400) * 100) : 0,
        now: stats.bestReaction > 0 ? 1 : 0,
        text: stats.bestReaction > 0 ? `${stats.bestReaction} ms` : "—",
      }),
    },
    { id: "bullseye25", icon: "🎯", name: "Bullseye", desc: "Hit 25 bullseyes.", stat: "bullseyes", goal: 25 },
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
        ["Wins", stats.wins],
        ["Rounds", stats.games],
        ["Best score", stats.bestScore],
        ["Best accuracy", stats.bestAccuracy + "%"],
        ["Best reaction", stats.bestReaction ? stats.bestReaction + " ms" : "—"],
        ["Bullseyes", stats.bullseyes],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
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
  audio.define("hit", [[620, 0, 0.04, "triangle", 0.04]]);
  audio.define("miss", [[180, 0, 0.07, "square", 0.035]]);

  // ---------- State ----------
  let target = null;
  let score = 0;
  let combo = 0;
  let roundTime = ROUND_MS;
  let running = false;
  let gameOver = false;
  let paused = false;

  let roundHits = 0;
  let roundMisses = 0;
  let roundShots = 0;
  let roundBullseyes = 0;
  let roundBestReaction = 0;
  let hitFlash = null;

  // ---------- Flow ----------
  function spawnTarget() {
    const r = TARGET_MIN_R + rand() * (TARGET_MAX_R - TARGET_MIN_R);
    const x = MARGIN + rand() * (W - MARGIN * 2);
    const y = MARGIN + rand() * (H - MARGIN * 2);
    target = { x, y, r, age: 0, lifetime: TARGET_LIFETIME };
  }

  function newGame() {
    score = 0;
    combo = 0;
    roundTime = ROUND_MS;
    roundHits = roundMisses = roundShots = roundBullseyes = 0;
    roundBestReaction = 0;
    target = null;
    running = false;
    gameOver = false;
    paused = false;
    hitFlash = null;
    hideOverlay();
    updateStatus();
    render();
    showStartOverlay();
  }

  function startRound() {
    hideOverlay();
    score = 0;
    combo = 0;
    roundTime = ROUND_MS;
    roundHits = roundMisses = roundShots = roundBullseyes = 0;
    roundBestReaction = 0;
    hitFlash = null;
    target = null;
    running = true;
    gameOver = false;
    paused = false;
    spawnTarget();
    updateStatus();
    render();
  }

  function pointsFor(t) {
    const sizeBonus = Math.round((TARGET_MAX_R - t.r) * 4);
    const speedBonus = Math.max(0, Math.round((t.lifetime - t.age) / 12));
    const comboBonus = Math.min(combo, 10) * 5;
    return 50 + sizeBonus + speedBonus + comboBonus;
  }

  function updateStatus() {
    scoreEl.textContent = score;
    timeEl.textContent = Math.ceil(roundTime / 1000);
    accEl.textContent = roundShots > 0 ? Math.round((roundHits / roundShots) * 100) + "%" : "—";
  }

  function step(dt) {
    if (!running || paused || gameOver) return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    roundTime -= dt;
    if (roundTime <= 0) {
      roundTime = 0;
      return endRound();
    }

    if (hitFlash) {
      hitFlash.t -= dt;
      if (hitFlash.t <= 0) hitFlash = null;
    }

    if (!target) spawnTarget();
    else {
      target.age += dt;
      if (target.age >= target.lifetime) {
        combo = 0;
        spawnTarget();
      }
    }
    updateStatus();
    render();
  }

  function click(x, y) {
    if (!running || paused || gameOver) return;
    if (!target) {
      spawnTarget();
      return;
    }

    const dx = x - target.x;
    const dy = y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    roundShots++;
    stats.shots++;

    if (dist <= target.r) {
      roundHits++;
      stats.hits++;
      combo++;
      const bull = dist <= target.r * 0.35;
      if (bull) {
        roundBullseyes++;
        stats.bullseyes++;
      }
      const reaction = target.age;
      if (reaction > 0 && (roundBestReaction === 0 || reaction < roundBestReaction)) {
        roundBestReaction = reaction;
      }
      score += pointsFor(target);
      stats.bestScore = Math.max(stats.bestScore, score);
      hitFlash = { x, y, t: 180 };
      sfx(bull ? "match" : "hit");
      spawnTarget();
    } else {
      roundMisses++;
      stats.misses++;
      combo = 0;
      sfx("miss");
    }

    saveStats();
    checkAchievements();
    updateStatus();
    render();
  }

  function endRound() {
    if (!running) return;
    running = false;
    gameOver = true;

    const accuracy = roundShots > 0 ? Math.round((roundHits / roundShots) * 100) : 0;
    stats.games++;
    stats.bestScore = Math.max(stats.bestScore, score);
    stats.bestAccuracy = Math.max(stats.bestAccuracy, accuracy);
    if (roundBestReaction > 0 && (stats.bestReaction === 0 || roundBestReaction < stats.bestReaction)) {
      stats.bestReaction = roundBestReaction;
    }

    const won = score >= TARGET_SCORE;
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.losses++;
      stats.streak = 0;
    }

    saveStats();
    checkAchievements();
    updateStatus();
    render();

    sfx(won ? "win" : "over");
    if (won) confetti(90);

    showOverlay(
      won ? "Target reached! 🎉" : "Time's up!",
      `Score ${score} · Accuracy ${accuracy}% · Best reaction ${stats.bestReaction ? stats.bestReaction + " ms" : "—"}.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); startRound(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (!running || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
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

    if (String(e.key || "").toLowerCase() === "p" || e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function onPointerDown(e) {
    if (e.preventDefault) e.preventDefault();
    audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    click(x, y);
  }

  function bindEvents() {
    canvas.addEventListener("pointerdown", onPointerDown);
    restartBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); newGame(); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (running && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  function showStartOverlay() {
    showOverlay("Aim Trainer", "Click the targets as fast as you can. Reach 1,500 points in 30 seconds!", [
      { label: "Start", onClick: startRound },
      { label: "Badges", ghost: true, onClick: openAchv },
    ]);
  }

  // ---------- Rendering ----------
  function render() {
    ctx.fillStyle = "#080a12";
    ctx.fillRect(0, 0, W, H);

    // Subtle grid.
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= W; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(W, i);
      ctx.stroke();
    }

    // Timer bar.
    const frac = Math.max(0, Math.min(1, roundTime / ROUND_MS));
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = frac > 0.3 ? "#5ad1b8" : "#ff5b5b";
    ctx.fillRect(0, 0, W * frac, 8);

    // Target.
    if (target && !gameOver) {
      ctx.fillStyle = "rgba(255,94,94,0.92)";
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Shrinking lifetime ring.
      const life = Math.max(0, 1 - target.age / target.lifetime);
      ctx.strokeStyle = "#5ad1b8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
      ctx.stroke();
    }

    // Hit flash.
    if (hitFlash) {
      const a = Math.max(0, hitFlash.t / 180);
      ctx.strokeStyle = "rgba(90,209,184," + a.toFixed(3) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hitFlash.x, hitFlash.y, 10 + (1 - a) * 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Combo.
    if (combo > 1) {
      ctx.fillStyle = "#ffd94d";
      ctx.font = "bold 26px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("x" + combo, W / 2, 46);
    }

    if (!running && !gameOver) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 22px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click Start", W / 2, H / 2);
    }
  }

  // ---------- Loop ----------
  const gameLoop = loopApi.create((dt) => {
    step(dt);
    render();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame();
    renderAchvGrid();
    gameLoop.start();
  }

  // Test hook — harmless in normal play.
  window.__AIM_TRAINER = {
    W,
    H,
    ROUND_MS,
    TARGET_SCORE,
    TARGET_LIFETIME,
    TARGET_MIN_R,
    TARGET_MAX_R,
    get target() { return target ? { x: target.x, y: target.y, r: target.r, age: target.age, lifetime: target.lifetime } : null; },
    get score() { return score; },
    get combo() { return combo; },
    get roundTime() { return roundTime; },
    get running() { return running; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get roundHits() { return roundHits; },
    get roundMisses() { return roundMisses; },
    get roundShots() { return roundShots; },
    get roundBullseyes() { return roundBullseyes; },
    get roundBestReaction() { return roundBestReaction; },
    stats,
    ACHIEVEMENTS,
    pointsFor,
    spawnTarget,
    newGame,
    startRound,
    step,
    click,
    endRound,
    setSeed: (n) => { rngState = n >>> 0; },
    setTarget: (x, y, r, age) => { target = { x, y, r, age: age || 0, lifetime: TARGET_LIFETIME }; },
    setTargetAge: (age) => { if (target) target.age = age; },
    setRoundTime: (ms) => { roundTime = ms; },
    setScore: (n) => { score = n; },
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