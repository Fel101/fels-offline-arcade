// Space Invaders — pure vanilla JS, fully offline.
// Defend against descending waves of aliens. Shared plumbing (storage, audio,
// toasts, overlay, confetti, badges, modal, loop) comes from ../../js/arcade-core.js.
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
  const waveEl = dom.byId("wave");
  const livesEl = dom.byId("lives");
  const restartBtn = dom.byId("restart");
  const hintEl = dom.byId("hint");

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
  window.Arcade.util.hidpiCanvas(canvas, ctx, W, H);
  const START_LIVES = 3;

  const PLAYER_W = 34, PLAYER_H = 18;
  const PLAYER_Y = H - 42;
  const PLAYER_SPEED = 4.6;

  const BULLET_W = 3, BULLET_H = 10, BULLET_SPEED = 7.2;
  const MAX_BULLETS = 2;
  const FIRE_COOLDOWN = 9;

  const BOMB_W = 4, BOMB_H = 11, BOMB_SPEED = 2.9;

  const ALIEN_COLS = 10, ALIEN_ROWS = 5;
  const ALIEN_W = 24, ALIEN_H = 16;
  const ALIEN_GAP_X = 12, ALIEN_GAP_Y = 10;
  const ALIEN_LEFT = 30, ALIEN_TOP = 68;
  const ALIEN_DROP = 12;
  const ALIEN_POINTS = [30, 20, 20, 10, 10];

  const UFO_W = 38, UFO_H = 16, UFO_Y = 38, UFO_SPEED = 1.6;

  const BUNKER_COUNT = 4, BUNKER_W = 54, BUNKER_H = 28, BUNKER_HP = 6;
  const BUNKER_Y = H - 118;

  const K = makeKeys("space-invaders");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    bestScore: 0,
    kills: 0,
    waves: 0,
    shots: 0,
    hits: 0,
    bestAccuracy: 0,
    livesLost: 0,
    ufos: 0,
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
    { id: "first", icon: "👾", name: "First Contact", desc: "Destroy your first alien.", stat: "kills", goal: 1 },
    { id: "kills50", icon: "🔫", name: "Gunner", desc: "Destroy 50 aliens.", stat: "kills", goal: 50 },
    { id: "kills250", icon: "💥", name: "Exterminator", desc: "Destroy 250 aliens.", stat: "kills", goal: 250 },
    { id: "score500", icon: "5️⃣", name: "Defender", desc: "Score 500 in a single game.", stat: "bestScore", goal: 500 },
    { id: "score1500", icon: "🌟", name: "Star Pilot", desc: "Score 1,500 in a single game.", stat: "bestScore", goal: 1500 },
    { id: "wave3", icon: "🌊", name: "Hold the Line", desc: "Reach wave 3.", stat: "waves", goal: 3 },
    { id: "wave5", icon: "🛡️", name: "Veteran", desc: "Reach wave 5.", stat: "waves", goal: 5 },
    { id: "wave10", icon: "👑", name: "Earth's Champion", desc: "Reach wave 10.", stat: "waves", goal: 10 },
    { id: "games10", icon: "🎮", name: "Recruit", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "acc50", icon: "🎯", name: "Sharpshooter", desc: "Finish a game with 50%+ accuracy.", stat: "bestAccuracy", goal: 50 },
    { id: "ufo1", icon: "🛸", name: "Close Encounter", desc: "Shoot down a UFO.", stat: "ufos", goal: 1 },
    { id: "ufo10", icon: "👽", name: "UFO Hunter", desc: "Shoot down 10 UFOs.", stat: "ufos", goal: 10 },
    { id: "lives20", icon: "❤️", name: "Nine Lives", desc: "Lose 20 lives across all games.", stat: "livesLost", goal: 20 },
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
        ["Best score", stats.bestScore],
        ["Aliens", stats.kills],
        ["Best wave", stats.waves],
        ["Accuracy", stats.bestAccuracy + "%"],
        ["UFOs", stats.ufos],
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

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("shoot", [[880, 0, 0.04, "square", 0.03]]);
  audio.define("kill", [[220, 0, 0.09, "sawtooth", 0.05]]);
  audio.define("ufo", [[520, 0, 0.05, "triangle", 0.05], [780, 0.06, 0.08, "triangle", 0.05]]);
  audio.define("wave", [[440, 0, 0.08, "triangle", 0.05], [660, 0.09, 0.12, "triangle", 0.05]]);

  // ---------- State ----------
  let player;
  let aliens;
  let bullets;
  let bombs;
  let bunkers;
  let ufo;
  let ufoIn;
  let alienFireIn;
  let alienDir;
  let frame;
  let score;
  let lives;
  let wave;
  let state; // ready | playing | over
  let paused = false;
  let shotsThisGame;
  let hitsThisGame;
  let invuln;
  let runStartBest;
  const input = { left: false, right: false, shoot: false };

  const stars = (() => {
    const out = [];
    for (let i = 0; i < 60; i++) {
      out.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4 });
    }
    return out;
  })();

  // ---------- Setup ----------
  function spawnAliens() {
    aliens = [];
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        aliens.push({
          x: ALIEN_LEFT + c * (ALIEN_W + ALIEN_GAP_X),
          y: ALIEN_TOP + r * (ALIEN_H + ALIEN_GAP_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          row: r,
          col: c,
          points: ALIEN_POINTS[r],
          alive: true,
        });
      }
    }
    alienDir = 1;
    alienFireIn = 50;
  }

  function spawnBunkers() {
    bunkers = [];
    for (let i = 0; i < BUNKER_COUNT; i++) {
      bunkers.push({
        x: 24 + i * 92,
        y: BUNKER_Y,
        w: BUNKER_W,
        h: BUNKER_H,
        hp: BUNKER_HP,
      });
    }
  }

  function reset(toReady) {
    player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H, cooldown: 0 };
    bullets = [];
    bombs = [];
    ufo = null;
    ufoIn = 700;
    frame = 0;
    score = 0;
    lives = START_LIVES;
    wave = 1;
    invuln = 0;
    paused = false;
    shotsThisGame = 0;
    hitsThisGame = 0;
    runStartBest = stats.bestScore;
    spawnAliens();
    spawnBunkers();
    input.left = input.right = input.shoot = false;
    state = toReady ? "ready" : "playing";
    hideOverlay();
    updateStatus();
    if (!toReady) beginRun();
  }

  function beginRun() {
    stats.games++;
    stats.waves = Math.max(stats.waves, 1);
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function updateStatus() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(stats.bestScore, score);
    waveEl.textContent = wave;
    livesEl.textContent = lives;
  }

  // ---------- Flow ----------
  function fire() {
    if (state !== "playing" || paused) return;
    if (player.cooldown > 0 || bullets.length >= MAX_BULLETS) return;
    bullets.push({ x: player.x + player.w / 2 - BULLET_W / 2, y: player.y - BULLET_H, w: BULLET_W, h: BULLET_H });
    player.cooldown = FIRE_COOLDOWN;
    stats.shots++;
    shotsThisGame++;
    sfx("shoot");
  }

  function loseLife() {
    lives--;
    stats.livesLost++;
    invuln = 90;
    player.x = W / 2 - player.w / 2;
    updateStatus();
    sfx("kill");
    saveStats();
    checkAchievements();
    if (lives <= 0) endGame(false);
  }

  function spawnAlienBomb() {
    const shooters = [];
    for (let c = 0; c < ALIEN_COLS; c++) {
      let bottom = null;
      for (const a of aliens) {
        if (a.alive && a.col === c && (!bottom || a.y > bottom.y)) bottom = a;
      }
      if (bottom) shooters.push(bottom);
    }
    if (!shooters.length) return;
    const a = shooters[Math.floor(Math.random() * shooters.length)];
    bombs.push({ x: a.x + a.w / 2 - BOMB_W / 2, y: a.y + a.h, w: BOMB_W, h: BOMB_H });
  }

  function endGame(won) {
    state = "over";
    paused = false;

    stats.games += 0; // games already counted at run start
    stats.bestScore = Math.max(stats.bestScore, score);
    stats.waves = Math.max(stats.waves, wave);
    const acc = shotsThisGame > 0 ? Math.round((hitsThisGame / shotsThisGame) * 100) : 0;
    stats.bestAccuracy = Math.max(stats.bestAccuracy, acc);
    saveStats();
    checkAchievements();
    updateStatus();

    const isRecord = score > runStartBest;
    if (isRecord) {
      sfx("win");
      confetti(90);
    } else {
      sfx("over");
    }

    showOverlay(
      isRecord ? "New Best! 🎉" : "Game Over",
      `Score ${score} · Wave ${wave} · Accuracy ${acc}%.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); reset(false); } },
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

  // ---------- Collision ----------
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---------- Update ----------
  function update() {
    if (state !== "playing" || paused) return;
    frame++;
    if (player.cooldown > 0) player.cooldown--;
    if (invuln > 0) invuln--;

    // Player movement.
    if (input.left) player.x -= PLAYER_SPEED;
    if (input.right) player.x += PLAYER_SPEED;
    player.x = Math.max(0, Math.min(W - player.w, player.x));

    // Firing.
    if (input.shoot) fire();

    // Bullets.
    for (const b of bullets) b.y -= BULLET_SPEED;
    bullets = bullets.filter((b) => b.y + b.h > 0);

    // Bombs.
    for (const b of bombs) b.y += BOMB_SPEED;
    bombs = bombs.filter((b) => b.y < H + 20);

    // Alien fleet movement.
    const aliveAliens = aliens.filter((a) => a.alive);
    if (aliveAliens.length > 0) {
      const speed = 0.35 + (1 - aliveAliens.length / aliens.length) * 1.1 + (wave - 1) * 0.12;
      const dx = alienDir * speed;
      let hitEdge = false;
      for (const a of aliveAliens) {
        if (a.x + dx < 6 || a.x + a.w + dx > W - 6) { hitEdge = true; break; }
      }
      if (hitEdge) {
        alienDir *= -1;
        for (const a of aliveAliens) a.y += ALIEN_DROP;
      } else {
        for (const a of aliveAliens) a.x += dx;
      }
    }

    // Alien fire.
    alienFireIn--;
    if (alienFireIn <= 0 && aliveAliens.length > 0) {
      spawnAlienBomb();
      alienFireIn = Math.max(16, 52 - wave * 4) + Math.floor(Math.random() * 18);
    }

    // UFO.
    if (!ufo) {
      ufoIn--;
      if (ufoIn <= 0) {
        const fromLeft = Math.random() < 0.5;
        ufo = { x: fromLeft ? -UFO_W : W, y: UFO_Y, vx: fromLeft ? UFO_SPEED : -UFO_SPEED };
        ufoIn = 800 + Math.floor(Math.random() * 600);
      }
    } else {
      ufo.x += ufo.vx;
      if (ufo.x < -UFO_W - 12 || ufo.x > W + 12) ufo = null;
    }

    // Player bullets vs targets.
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      let hit = false;

      if (ufo && overlap(b.x, b.y, b.w, b.h, ufo.x, ufo.y, UFO_W, UFO_H)) {
        const bonus = 50 + Math.floor(Math.random() * 6) * 50;
        score += bonus;
        stats.ufos++;
        stats.hits++;
        hitsThisGame++;
        stats.bestScore = Math.max(stats.bestScore, score);
        ufo = null;
        hit = true;
        sfx("ufo");
      }

      if (!hit) {
        for (const a of aliens) {
          if (!a.alive) continue;
          if (overlap(b.x, b.y, b.w, b.h, a.x, a.y, a.w, a.h)) {
            a.alive = false;
            score += a.points;
            stats.kills++;
            stats.hits++;
            hitsThisGame++;
            stats.bestScore = Math.max(stats.bestScore, score);
            hit = true;
            sfx("kill");
            break;
          }
        }
      }

      if (!hit) {
        for (const bunker of bunkers) {
          if (bunker.hp <= 0) continue;
          if (overlap(b.x, b.y, b.w, b.h, bunker.x, bunker.y, bunker.w, bunker.h)) {
            bunker.hp--;
            hit = true;
            break;
          }
        }
      }

      if (hit) bullets.splice(i, 1);
      updateStatus();
      saveStats();
      checkAchievements();
    }

    // Bombs vs player / bunkers.
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i];
      let hit = false;

      if (invuln <= 0 && overlap(bomb.x, bomb.y, bomb.w, bomb.h, player.x, player.y, player.w, player.h)) {
        hit = true;
        loseLife();
        if (state !== "playing") return;
      }

      if (!hit) {
        for (const bunker of bunkers) {
          if (bunker.hp <= 0) continue;
          if (overlap(bomb.x, bomb.y, bomb.w, bomb.h, bunker.x, bunker.y, bunker.w, bunker.h)) {
            bunker.hp--;
            hit = true;
            break;
          }
        }
      }

      if (hit) bombs.splice(i, 1);
    }

    // Aliens reaching the ground.
    for (const a of aliens) {
      if (a.alive && a.y + a.h >= player.y - 2) {
        return endGame(false);
      }
    }

    // Wave cleared.
    if (aliens.every((a) => !a.alive)) {
      wave++;
      stats.waves = Math.max(stats.waves, wave);
      score += 50;
      stats.bestScore = Math.max(stats.bestScore, score);
      spawnAliens();
      sfx("wave");
      saveStats();
      checkAchievements();
      updateStatus();
    }
  }

  // ---------- Rendering ----------
  function draw() {
    ctx.fillStyle = "#070912";
    ctx.fillRect(0, 0, W, H);

    // Stars.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (const s of stars) ctx.fillRect(s.x, s.y, s.s, s.s);

    // Bunkers.
    for (const bunker of bunkers) {
      if (bunker.hp <= 0) continue;
      const alpha = 0.3 + 0.7 * (bunker.hp / BUNKER_HP);
      ctx.fillStyle = `rgba(110, 220, 140, ${alpha})`;
      ctx.fillRect(bunker.x, bunker.y, bunker.w, bunker.h * 0.5);
      ctx.fillRect(bunker.x, bunker.y, bunker.w * 0.22, bunker.h);
      ctx.fillRect(bunker.x + bunker.w * 0.78, bunker.y, bunker.w * 0.22, bunker.h);
    }

    // Aliens.
    for (const a of aliens) if (a.alive) drawAlien(a);

    // UFO.
    if (ufo) {
      ctx.fillStyle = "#ff5ea8";
      ctx.beginPath();
      ctx.ellipse(ufo.x + UFO_W / 2, ufo.y + UFO_H * 0.62, UFO_W / 2, UFO_H * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd94d";
      ctx.beginPath();
      ctx.ellipse(ufo.x + UFO_W / 2, ufo.y + UFO_H * 0.3, UFO_W * 0.26, UFO_H * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player.
    drawPlayer();

    // Bullets.
    ctx.fillStyle = "#7df9ff";
    for (const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    // Bombs.
    ctx.fillStyle = "#ffcc4d";
    for (const b of bombs) {
      ctx.fillRect(b.x, b.y, b.w, 4);
      ctx.fillRect(b.x + 1, b.y + 4, b.w - 2, 4);
      ctx.fillRect(b.x, b.y + 8, b.w, 3);
    }

    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 22px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get Ready!", W / 2, H / 2);
    }
  }

  function drawAlien(a) {
    const colors = ["#ff5ea8", "#ffd94d", "#5ad1b8", "#7df9ff", "#a78bfa"];
    const color = colors[a.row % colors.length];
    const legPhase = (frame >> 3) % 2;
    ctx.fillStyle = color;
    ctx.fillRect(a.x + 3, a.y + 2, a.w - 6, a.h - 5);
    ctx.fillRect(a.x, a.y + 5, a.w, a.h - 9);
    ctx.fillStyle = "#070912";
    ctx.fillRect(a.x + 6, a.y + 5, 4, 4);
    ctx.fillRect(a.x + a.w - 10, a.y + 5, 4, 4);
    ctx.fillStyle = color;
    const ly = a.y + a.h - 4 + (legPhase ? 0 : 2);
    ctx.fillRect(a.x + 1, ly, 5, 4);
    ctx.fillRect(a.x + a.w - 6, ly, 5, 4);
  }

  function drawPlayer() {
    if (invuln > 0 && (frame >> 2) % 2 === 0) return; // blink while invulnerable
    ctx.fillStyle = "#5ad1b8";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y + player.h);
    ctx.lineTo(player.x + player.w / 2, player.y);
    ctx.lineTo(player.x + player.w, player.y + player.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd94d";
    ctx.fillRect(player.x + player.w / 2 - 2, player.y - 5, 4, 7);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(player.x + 6, player.y + player.h - 6, player.w - 12, 4);
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
    if (key === "ArrowLeft" || key === "a" || key === "A") { input.left = true; if (e.preventDefault) e.preventDefault(); }
    if (key === "ArrowRight" || key === "d" || key === "D") { input.right = true; if (e.preventDefault) e.preventDefault(); }
    if (key === " " || key === "Spacebar") { input.shoot = true; if (e.preventDefault) e.preventDefault(); }
  }

  function onKeyUp(e) {
    const key = String(e.key || "");
    if (key === "ArrowLeft" || key === "a" || key === "A") input.left = false;
    if (key === "ArrowRight" || key === "d" || key === "D") input.right = false;
    if (key === " " || key === "Spacebar") input.shoot = false;
  }

  function pointerX(e) {
    const rect = canvas.getBoundingClientRect();
    return (e.clientX - rect.left) * (W / rect.width);
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    canvas.addEventListener("pointermove", (e) => {
      if (state !== "playing" || paused) return;
      player.x = Math.max(0, Math.min(W - player.w, pointerX(e) - player.w / 2));
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (e.preventDefault) e.preventDefault();
      audio.unlock();
      if (state !== "playing" || paused) return;
      player.x = Math.max(0, Math.min(W - player.w, pointerX(e) - player.w / 2));
      input.shoot = true;
      fire();
    });
    window.addEventListener("pointerup", () => { input.shoot = false; });

    restartBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset(true);
      showStartOverlay();
    });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Start overlay ----------
  function showStartOverlay() {
    showOverlay("Space Invaders", "Move with ←/→, A/D or the pointer. Press Space to fire. Clear the waves!", [
      { label: "Start", onClick: () => { hideOverlay(); state = "playing"; beginRun(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
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
  window.__SPACE_INVADERS = {
    W,
    H,
    START_LIVES,
    PLAYER_W,
    PLAYER_H,
    PLAYER_Y,
    ALIEN_COLS,
    ALIEN_ROWS,
    ALIEN_W,
    ALIEN_H,
    UFO_W,
    UFO_H,
    BUNKER_HP,
    ACHIEVEMENTS,
    stats,
    get state() { return state; },
    get paused() { return paused; },
    get score() { return score; },
    get lives() { return lives; },
    get wave() { return wave; },
    get playerX() { return player.x; },
    get shotsThisGame() { return shotsThisGame; },
    get hitsThisGame() { return hitsThisGame; },
    get invuln() { return invuln; },
    snap: () => ({
      state,
      paused,
      score,
      lives,
      wave,
      playerX: player.x,
      aliensAlive: aliens.filter((a) => a.alive).length,
      bullets: bullets.length,
      bombs: bombs.length,
      bunkers: bunkers.map((b) => ({ x: b.x, y: b.y, hp: b.hp, w: b.w, h: b.h })),
      ufo: ufo ? { x: ufo.x, y: ufo.y, vx: ufo.vx } : null,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    getAliens: () => aliens.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h, row: a.row, alive: a.alive })),
    getBunkers: () => bunkers.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, hp: b.hp })),
    setInput: (o) => { if (o.left !== undefined) input.left = !!o.left; if (o.right !== undefined) input.right = !!o.right; if (o.shoot !== undefined) input.shoot = !!o.shoot; },
    setPlayerX: (x) => { player.x = Math.max(0, Math.min(W - player.w, x)); },
    setLives: (n) => { lives = n; updateStatus(); },
    setWave: (n) => { wave = n; updateStatus(); },
    addBullet: (x, y) => { bullets.push({ x, y, w: BULLET_W, h: BULLET_H }); },
    addBomb: (x, y) => { bombs.push({ x, y, w: BOMB_W, h: BOMB_H }); },
    setUfo: (x, y, vx) => { ufo = { x, y, vx: vx || 0 }; },
    clearAliens: () => { for (const a of aliens) a.alive = false; },
    lowerAliens: (dy) => { for (const a of aliens) if (a.alive) a.y += dy; },
    spawnAlienBomb,
    spawnUfo: () => { const fromLeft = Math.random() < 0.5; ufo = { x: fromLeft ? -UFO_W : W, y: UFO_Y, vx: fromLeft ? UFO_SPEED : -UFO_SPEED }; },
    reset,
    // Test-only: fresh board without counting a game.
    resetBoard: () => {
      player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H, cooldown: 0 };
      bullets = [];
      bombs = [];
      ufo = null;
      ufoIn = 700;
      frame = 0;
      score = 0;
      lives = START_LIVES;
      wave = 1;
      invuln = 0;
      paused = false;
      shotsThisGame = 0;
      hitsThisGame = 0;
      spawnAliens();
      spawnBunkers();
      input.left = input.right = input.shoot = false;
      state = "playing";
      hideOverlay();
      updateStatus();
    },
    start: () => { hideOverlay(); state = "playing"; beginRun(); },
    step: update,
    draw,
    fire,
    loseLife,
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