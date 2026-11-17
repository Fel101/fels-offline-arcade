// Maze Chase — a Pac-Man-style maze game. Pure vanilla JS, fully offline.
// Eat every dot, dodge the ghosts, grab power pellets. Shared plumbing (storage,
// audio, toasts, overlay, confetti, badges, modal, loop) comes from
// ../../js/arcade-core.js.
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
  const levelEl = dom.byId("level");
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
  const MAZE_W = 19;
  const MAZE_H = 19;
  const CELL = canvas.width / MAZE_W; // 20
  const START_LIVES = 3;

  const PLAYER_TICK = 7;
  const GHOST_TICK = 9;
  const POWER_GHOST_TICK = 13;
  const POWER_FRAMES = 480; // ~8 seconds at 60fps
  const GHOST_COLORS = ["#ff5b5b", "#ffb3d9", "#5ad1e6", "#ffb347"];
  const HINT_DEFAULT =
    "Arrow keys / WASD to move. Eat every dot. Power pellets let you eat ghosts for bonus points. P pauses.";

  const K = makeKeys("maze-chase");

  // ---------- Seeded RNG ----------
  let rngState = 0x51ed270b;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function randInt(n) {
    return Math.floor(rand() * n);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    bestScore: 0,
    dots: 0,
    levels: 0,
    ghosts: 0,
    pellets: 0,
    livesLost: 0,
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
    { id: "first", icon: "🟡", name: "First Bite", desc: "Eat your first dot.", stat: "dots", goal: 1 },
    { id: "dots100", icon: "🍽️", name: "Snacker", desc: "Eat 100 dots.", stat: "dots", goal: 100 },
    { id: "dots500", icon: "🍴", name: "Banquet", desc: "Eat 500 dots.", stat: "dots", goal: 500 },
    { id: "score1k", icon: "1️⃣", name: "Scorer", desc: "Score 1,000 in a single game.", stat: "bestScore", goal: 1000 },
    { id: "score5k", icon: "💰", name: "High Roller", desc: "Score 5,000 in a single game.", stat: "bestScore", goal: 5000 },
    { id: "level3", icon: "🌀", name: "Explorer", desc: "Reach level 3.", stat: "levels", goal: 3 },
    { id: "level5", icon: "🗺️", name: "Pathfinder", desc: "Reach level 5.", stat: "levels", goal: 5 },
    { id: "level10", icon: "👑", name: "Labyrinth Lord", desc: "Reach level 10.", stat: "levels", goal: 10 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "ghost1", icon: "👻", name: "Ghost Eater", desc: "Eat a ghost.", stat: "ghosts", goal: 1 },
    { id: "ghost10", icon: "🎃", name: "Spook Hunter", desc: "Eat 10 ghosts.", stat: "ghosts", goal: 10 },
    { id: "pellets25", icon: "⚡", name: "Power Up", desc: "Eat 25 power pellets.", stat: "pellets", goal: 25 },
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
        ["Dots eaten", stats.dots],
        ["Best level", stats.levels],
        ["Ghosts eaten", stats.ghosts],
        ["Power pellets", stats.pellets],
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
  audio.define("dot", [[520, 0, 0.03, "square", 0.02]]);
  audio.define("power", [[330, 0, 0.08, "triangle", 0.05], [660, 0.08, 0.1, "triangle", 0.05]]);
  audio.define("eatGhost", [[740, 0, 0.06, "triangle", 0.05], [980, 0.06, 0.08, "triangle", 0.05]]);
  audio.define("death", [[400, 0, 0.12, "sawtooth", 0.05], [200, 0.14, 0.18, "sawtooth", 0.05]]);
  audio.define("level", [[440, 0, 0.1, "triangle", 0.05], [660, 0.1, 0.1, "triangle", 0.05], [880, 0.2, 0.14, "triangle", 0.05]]);

  // ---------- State ----------
  let maze;
  let dots;
  let dotsRemaining;
  let playerStart;
  let ghostStarts;
  let player = { r: 0, c: 0, dir: [0, 0], nextDir: [0, 0], cooldown: 0 };
  let ghosts;
  let score;
  let lives;
  let level;
  let powerTimer;
  let ghostCombo;
  let frame;
  let state; // ready | playing | over
  let paused = false;

  // ---------- Maze generation ----------
  function generateMaze() {
    const g = Array.from({ length: MAZE_H }, () => new Array(MAZE_W).fill("#"));
    const stack = [[1, 1]];
    g[1][1] = ".";
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const dirs = shuffle([[-2, 0], [2, 0], [0, -2], [0, 2]]);
      let moved = false;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr > 0 && nr < MAZE_H - 1 && nc > 0 && nc < MAZE_W - 1 && g[nr][nc] === "#") {
          g[r + dr / 2][c + dc / 2] = ".";
          g[nr][nc] = ".";
          stack.push([nr, nc]);
          moved = true;
          break;
        }
      }
      if (!moved) stack.pop();
    }

    // Knock out a few walls to create loops (more interesting than a perfect maze).
    for (let r = 1; r < MAZE_H - 1; r++) {
      for (let c = 1; c < MAZE_W - 1; c++) {
        if (g[r][c] !== "#") continue;
        const horiz = g[r][c - 1] === "." && g[r][c + 1] === ".";
        const vert = g[r - 1][c] === "." && g[r + 1][c] === ".";
        if ((horiz || vert) && rand() < 0.11) g[r][c] = ".";
      }
    }
    return g;
  }

  function dist2(a, b) {
    const dr = a[0] - b[0];
    const dc = a[1] - b[1];
    return dr * dr + dc * dc;
  }

  function setupBoard() {
    maze = generateMaze();

    const d = Array.from({ length: MAZE_H }, () => new Array(MAZE_W).fill(0));
    let count = 0;
    for (let r = 0; r < MAZE_H; r++) {
      for (let c = 0; c < MAZE_W; c++) {
        if (maze[r][c] === ".") {
          d[r][c] = 1;
          count++;
        }
      }
    }

    // Power pellets near the corners.
    for (const [r, c] of [[1, MAZE_W - 2], [MAZE_H - 2, 1], [MAZE_H - 2, MAZE_W - 2], [1, 9]]) {
      if (d[r][c] === 1) d[r][c] = 2;
    }

    playerStart = [1, 1];

    // Ghost starts: the four open cells closest to the centre.
    const open = [];
    for (let r = 0; r < MAZE_H; r++)
      for (let c = 0; c < MAZE_W; c++) if (maze[r][c] === ".") open.push([r, c]);
    open.sort((a, b) => dist2(a, [9, 9]) - dist2(b, [9, 9]));
    ghostStarts = open.slice(0, 4);

    // Clear dots under the player and ghosts.
    d[playerStart[0]][playerStart[1]] = 0;
    for (const [r, c] of ghostStarts) d[r][c] = 0;

    dots = d;
    dotsRemaining = 0;
    for (let r = 0; r < MAZE_H; r++)
      for (let c = 0; c < MAZE_W; c++) if (dots[r][c] > 0) dotsRemaining++;

    resetPositions();
  }

  function resetPositions() {
    player.r = playerStart[0];
    player.c = playerStart[1];
    player.dir = [0, 0];
    player.nextDir = [0, 0];
    player.cooldown = 0;
    ghosts = ghostStarts.map(([r, c], i) => ({
      r,
      c,
      start: [r, c],
      dir: [0, 1],
      color: GHOST_COLORS[i],
      cooldown: i * 4,
      target: [9, 9],
    }));
    powerTimer = 0;
    ghostCombo = 0;
  }

  // ---------- Helpers ----------
  function canMove(r, c) {
    return r >= 0 && r < MAZE_H && c >= 0 && c < MAZE_W && maze[r][c] !== "#";
  }

  function randomOpenCell() {
    for (let tries = 0; tries < 200; tries++) {
      const r = 1 + randInt(MAZE_H - 2);
      const c = 1 + randInt(MAZE_W - 2);
      if (maze[r][c] === ".") return [r, c];
    }
    return [1, 1];
  }

  function updateStatus() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    livesEl.textContent = lives;
  }

  // ---------- Flow ----------
  function newGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    frame = 0;
    paused = false;
    setupBoard();
    state = "ready";
    hideOverlay();
    updateStatus();
    showStartOverlay();
  }

  function startGame() {
    hideOverlay();
    state = "playing";
    stats.games++;
    stats.levels = Math.max(stats.levels, level);
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function eat() {
    const d = dots[player.r][player.c];
    if (d === 1) {
      dots[player.r][player.c] = 0;
      dotsRemaining--;
      score += 10;
      stats.dots++;
      sfx("dot");
    } else if (d === 2) {
      dots[player.r][player.c] = 0;
      dotsRemaining--;
      score += 50;
      stats.pellets++;
      powerTimer = POWER_FRAMES;
      ghostCombo = 0;
      sfx("power");
      toast.show("Power!", "The ghosts are vulnerable — eat them!", "⚡");
    } else {
      return;
    }
    stats.bestScore = Math.max(stats.bestScore, score);
    updateStatus();
    saveStats();
    checkAchievements();
  }

  function loseLife() {
    lives--;
    stats.livesLost++;
    sfx("death");
    if (lives <= 0) return endGame();
    resetPositions();
    updateStatus();
    saveStats();
    checkAchievements();
  }

  function nextLevel() {
    level++;
    stats.levels = Math.max(stats.levels, level);
    score += 200;
    stats.bestScore = Math.max(stats.bestScore, score);
    setupBoard();
    sfx("level");
    toast.show("Level " + level, "The maze is rebuilt — faster ghosts!", "🌀");
    updateStatus();
    saveStats();
    checkAchievements();
  }

  function endGame() {
    state = "over";
    paused = false;
    stats.bestScore = Math.max(stats.bestScore, score);
    saveStats();
    checkAchievements();
    updateStatus();
    sfx("over");
    showOverlay("Game Over", `Score ${score} · Level ${level}.`, [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Ghost AI ----------
  function ghostTarget(g) {
    const idx = ghosts.indexOf(g);
    if (idx === 1) {
      // Pink: aim four cells ahead of the player.
      let ahead = [player.r + player.dir[0] * 4, player.c + player.dir[1] * 4];
      if (!canMove(ahead[0], ahead[1])) ahead = [player.r, player.c];
      return ahead;
    }
    if (idx === 2) {
      // Cyan: wander toward a periodically chosen target.
      return g.target || [9, 9];
    }
    if (idx === 3) {
      // Orange: chase when far, retreat to a corner when close.
      return dist2([g.r, g.c], [player.r, player.c]) > 64 ? [player.r, player.c] : [1, 1];
    }
    return [player.r, player.c]; // Red: direct chase.
  }

  function moveGhost(g) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const rev = [-g.dir[0], -g.dir[1]];
    let options = dirs.filter(
      ([dr, dc]) => canMove(g.r + dr, g.c + dc) && !(dr === rev[0] && dc === rev[1])
    );
    if (options.length === 0) options = dirs.filter(([dr, dc]) => canMove(g.r + dr, g.c + dc));
    if (options.length === 0) return;

    if (powerTimer > 0) {
      // Flee: maximise distance from the player.
      let best = options[0];
      let bestD = -1;
      for (const [dr, dc] of options) {
        const d = (g.r + dr - player.r) ** 2 + (g.c + dc - player.c) ** 2;
        if (d > bestD) {
          bestD = d;
          best = [dr, dc];
        }
      }
      g.dir = best;
    } else {
      const target = ghostTarget(g);
      let best = options[0];
      let bestD = Infinity;
      for (const [dr, dc] of options) {
        const d = (g.r + dr - target[0]) ** 2 + (g.c + dc - target[1]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = [dr, dc];
        }
      }
      g.dir = best;
    }
    g.r += g.dir[0];
    g.c += g.dir[1];
  }

  // ---------- Update ----------
  function update() {
    if (state !== "playing" || paused) return;
    frame++;

    if (powerTimer > 0) powerTimer--;

    // Player.
    if (player.cooldown > 0) player.cooldown--;
    if (player.cooldown <= 0) {
      const [ndr, ndc] = player.nextDir;
      if ((ndr || ndc) && canMove(player.r + ndr, player.c + ndc)) player.dir = [ndr, ndc];
      const [dr, dc] = player.dir;
      if ((dr || dc) && canMove(player.r + dr, player.c + dc)) {
        player.r += dr;
        player.c += dc;
        eat();
      }
      player.cooldown = PLAYER_TICK;
    }

    if (dotsRemaining <= 0) return nextLevel();

    // Ghosts.
    for (const g of ghosts) {
      if (g.cooldown > 0) g.cooldown--;
      if (g.cooldown <= 0) {
        moveGhost(g);
        g.cooldown = powerTimer > 0 ? POWER_GHOST_TICK : Math.max(5, GHOST_TICK - (level - 1));
      }
    }
    if (frame % 180 === 0 && ghosts[2]) ghosts[2].target = randomOpenCell();

    // Collisions.
    for (const g of ghosts) {
      if (g.r !== player.r || g.c !== player.c) continue;
      if (powerTimer > 0) {
        const pts = 200 * Math.pow(2, Math.min(ghostCombo, 3));
        score += pts;
        stats.ghosts++;
        ghostCombo++;
        stats.bestScore = Math.max(stats.bestScore, score);
        sfx("eatGhost");
        g.r = g.start[0];
        g.c = g.start[1];
        g.cooldown = 60;
        updateStatus();
        saveStats();
        checkAchievements();
      } else {
        loseLife();
        return;
      }
    }
  }

  // ---------- Rendering ----------
  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#05060c";
    ctx.fillRect(0, 0, W, H);

    // Walls.
    ctx.fillStyle = "#1b3bd0";
    for (let r = 0; r < MAZE_H; r++) {
      for (let c = 0; c < MAZE_W; c++) {
        if (maze[r][c] === "#") {
          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }

    // Dots.
    const cx = (c) => c * CELL + CELL / 2;
    const cy = (r) => r * CELL + CELL / 2;
    const blink = (frame >> 3) % 2 === 0;
    for (let r = 0; r < MAZE_H; r++) {
      for (let c = 0; c < MAZE_W; c++) {
        const d = dots[r][c];
        if (d === 1) {
          ctx.fillStyle = "#ffd9a0";
          ctx.beginPath();
          ctx.arc(cx(c), cy(r), 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (d === 2) {
          if (blink) {
            ctx.fillStyle = "#ffe9a8";
            ctx.beginPath();
            ctx.arc(cx(c), cy(r), 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Player.
    const px = cx(player.c);
    const py = cy(player.r);
    const pr = CELL * 0.42;
    ctx.fillStyle = "#ffd94d";
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    // Mouth wedge.
    const ang = Math.atan2(player.dir[1], player.dir[0]);
    const mouth = (frame >> 2) % 2 === 0 ? 0.22 : 0.46;
    ctx.fillStyle = "#05060c";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang - mouth) * pr, py + Math.sin(ang - mouth) * pr);
    ctx.lineTo(px + Math.cos(ang + mouth) * pr, py + Math.sin(ang + mouth) * pr);
    ctx.closePath();
    ctx.fill();

    // Ghosts.
    for (const g of ghosts) {
      const gx = cx(g.c);
      const gy = cy(g.r);
      const gr = CELL * 0.4;
      const vulnerable = powerTimer > 0;
      ctx.fillStyle = vulnerable ? "#5a7dff" : g.color;
      ctx.beginPath();
      ctx.arc(gx, gy - gr * 0.1, gr, Math.PI, 0);
      ctx.lineTo(gx + gr, gy + gr * 0.75);
      ctx.lineTo(gx + gr * 0.5, gy + gr * 0.4);
      ctx.lineTo(gx, gy + gr * 0.75);
      ctx.lineTo(gx - gr * 0.5, gy + gr * 0.4);
      ctx.lineTo(gx - gr, gy + gr * 0.75);
      ctx.closePath();
      ctx.fill();
      // Eyes.
      ctx.fillStyle = "#fff";
      ctx.fillRect(gx - gr * 0.55, gy - gr * 0.35, gr * 0.4, gr * 0.45);
      ctx.fillRect(gx + gr * 0.15, gy - gr * 0.35, gr * 0.4, gr * 0.45);
      ctx.fillStyle = "#111";
      ctx.fillRect(gx - gr * 0.45, gy - gr * 0.22, gr * 0.18, gr * 0.22);
      ctx.fillRect(gx + gr * 0.25, gy - gr * 0.22, gr * 0.18, gr * 0.22);
    }
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (state !== "playing" || paused === p) return;
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
  function setDir(dr, dc) {
    if (state === "ready") startGame();
    if (state !== "playing" || paused) return;
    player.nextDir = [dr, dc];
    if (player.dir[0] === 0 && player.dir[1] === 0) player.dir = [dr, dc];
  }

  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    const key = String(e.key || "");
    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (key === "ArrowUp" || key === "w" || key === "W") { if (e.preventDefault) e.preventDefault(); setDir(-1, 0); }
    else if (key === "ArrowDown" || key === "s" || key === "S") { if (e.preventDefault) e.preventDefault(); setDir(1, 0); }
    else if (key === "ArrowLeft" || key === "a" || key === "A") { if (e.preventDefault) e.preventDefault(); setDir(0, -1); }
    else if (key === "ArrowRight" || key === "d" || key === "D") { if (e.preventDefault) e.preventDefault(); setDir(0, 1); }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    let pointerStart = null;
    canvas.addEventListener("pointerdown", (e) => {
      audio.unlock();
      pointerStart = [e.clientX, e.clientY];
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!pointerStart) return;
      const dx = e.clientX - pointerStart[0];
      const dy = e.clientY - pointerStart[1];
      pointerStart = null;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return; // a tap, not a swipe
      if (Math.abs(dx) > Math.abs(dy)) setDir(0, dx > 0 ? 1 : -1);
      else setDir(dy > 0 ? 1 : -1, 0);
    });

    restartBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newGame();
    });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    window.addEventListener("blur", () => {
      if (state === "playing" && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state === "playing" && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  function showStartOverlay() {
    showOverlay("Maze Chase", "Eat every dot, dodge the ghosts. Grab a power pellet to turn the tables!", [
      { label: "Start", onClick: startGame },
      { label: "Badges", ghost: true, onClick: openAchv },
    ]);
  }

  // ---------- Loop ----------
  const gameLoop = loopApi.create(() => {
    update();
    draw();
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
  window.__MAZE_CHASE = {
    MAZE_W,
    MAZE_H,
    CELL,
    START_LIVES,
    PLAYER_TICK,
    POWER_FRAMES,
    get maze() { return maze.map((row) => row.slice()); },
    get dots() { return dots.map((row) => row.slice()); },
    get player() { return { r: player.r, c: player.c, dir: player.dir.slice(), nextDir: player.nextDir.slice() }; },
    get ghosts() { return ghosts.map((g) => ({ r: g.r, c: g.c, color: g.color })); },
    get score() { return score; },
    get lives() { return lives; },
    get level() { return level; },
    get dotsRemaining() { return dotsRemaining; },
    get powerTimer() { return powerTimer; },
    get state() { return state; },
    get paused() { return paused; },
    stats,
    ACHIEVEMENTS,
    generateMaze,
    canMove,
    dist2,
    setDir,
    step: update,
    draw,
    eat,
    moveGhost,
    nextLevel,
    loseLife,
    endGame,
    startGame,
    newGame,
    setSeed: (n) => { rngState = n >>> 0; },
    setPlayerPos: (r, c) => { player.r = r; player.c = c; player.dir = [0, 0]; player.nextDir = [0, 0]; },
    setPlayerDir: (dr, dc) => { player.dir = [dr, dc]; player.nextDir = [dr, dc]; },
    setLives: (n) => { lives = n; updateStatus(); },
    setLevel: (n) => { level = n; updateStatus(); },
    setPowerTimer: (n) => { powerTimer = n; },
    setGhost: (i, r, c) => { if (ghosts[i]) { ghosts[i].r = r; ghosts[i].c = c; ghosts[i].cooldown = 9999; } },
    setGhostCooldown: (n) => { for (const g of ghosts) g.cooldown = n; },
    setDots: (d) => {
      dots = d.map((row) => row.slice());
      dotsRemaining = 0;
      for (let r = 0; r < MAZE_H; r++)
        for (let c = 0; c < MAZE_W; c++) if (dots[r][c] > 0) dotsRemaining++;
    },
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