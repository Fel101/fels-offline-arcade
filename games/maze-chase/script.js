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

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants ----------
  const START_LIVES = 3;

  const PLAYER_TICK = 7;
  const GHOST_TICK = 9;
  const POWER_GHOST_TICK = 13;
  const POWER_FRAMES = 480; // ~8 seconds at 60fps
  const GHOST_COLORS = ["#ff5b5b", "#ffb3d9", "#5ad1e6", "#ffb347"];

  // Dots mark public corridors. The centre pen uses spaces and an exit gate.
  const MAZE = [
    "#######################",
    "#.........###.........#",
    "#.###.###.###.###.###.#",
    "#.###.....###.....###.#",
    "#.###.###.###.###.###.#",
    "#.....................#",
    "#.#####.###.###.#####.#",
    "#.#####.###.###.#####.#",
    "#.......###.###.......#",
    "####.##.###.###.##.####",
    "####.##.........##.####",
    "####.##.###=###.##.####",
    "........##   ##........",
    "####.##.#######.##.####",
    "####.##.........##.####",
    "####.##.###.###.##.####",
    "#.......###.###.......#",
    "#.#####.........#####.#",
    "#.#####.#######.#####.#",
    "#.........###.........#",
    "###.#.###.###.###.#.###",
    "#...#.###.###.###.#...#",
    "#.###.###.###.###.###.#",
    "#.....................#",
    "#######################",
  ];
  const MAZE_W = MAZE[0].length;
  const MAZE_H = MAZE.length;
  const CELL = canvas.width / MAZE_W;
  const LOGICAL_W = CELL * MAZE_W, LOGICAL_H = CELL * MAZE_H;
  window.Arcade.util.hidpiCanvas(canvas, ctx, LOGICAL_W, LOGICAL_H);
  const PLAYER_START = [17, 11];
  const GATE = [11, 11];
  const TUNNEL_ROW = 12;
  const PEN_STARTS = [[10, 11], [12, 11], [12, 10], [12, 12]]; // red, pink, cyan, orange
  const SCATTER_CORNERS = [[1, MAZE_W - 2], [1, 1], [MAZE_H - 2, MAZE_W - 2], [MAZE_H - 2, 1]];
  // Classic alternation: scatter, chase, scatter, chase … then chase forever.
  const MODE_SCHEDULE = [7 * 60, 20 * 60, 7 * 60, 20 * 60, 5 * 60, 20 * 60, 5 * 60, Infinity];
  // Ghosts break distance ties in this order (the original arcade priority).
  const GHOST_DIRS = [[-1, 0], [0, -1], [1, 0], [0, 1]];

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
      badgesOpen = true;
      tickCarry = 0;
      renderAchvGrid();
    },
    onClose: () => {
      badgesOpen = false;
      tickCarry = 0; // closing the dialog must not replay held-up time
      // Focus is restored to the real opener by the shared modal helper, so
      // the header button and the overlay action both return focus correctly.
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
  let badgesOpen = false; // the Badges dialog owns input while it is up
  let tickCarry = 0; // leftover milliseconds for the fixed-step simulation
  let modeIndex = 0; // scatter/chase schedule position
  let modeTimer = 0;
  let scatterMode = true;

  // ---------- Maze ----------
  function generateMaze() {
    return MAZE.map((row) => row.slice());
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

    // Four corner power pellets, exactly like the arcade board.
    for (const [r, c] of [[1, 1], [1, MAZE_W - 2], [MAZE_H - 2, 1], [MAZE_H - 2, MAZE_W - 2]]) {
      if (d[r][c] === 1) d[r][c] = 2;
    }

    playerStart = PLAYER_START.slice();
    ghostStarts = PEN_STARTS.map((p) => p.slice());
    modeIndex = 0;
    modeTimer = 0;
    scatterMode = true;

    // Clear dots under the player and ghosts.
    d[playerStart[0]][playerStart[1]] = 0;
    for (const [r, c] of ghostStarts) d[r][c] = 0;

    dots = d;
    dotsRemaining = 0;
    for (let r = 0; r < MAZE_H; r++)
      for (let c = 0; c < MAZE_W; c++) if (dots[r][c] > 0) dotsRemaining++;

    resetPositions();
  }

  function inPen(g) {
    const tile = maze[g.r][g.c];
    return tile === " " || tile === "=";
  }

  function resetPositions() {
    tickCarry = 0;
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
      prevR: r,
      prevC: c,
      leaving: inPen({ r, c }),
    }));
    powerTimer = 0;
    ghostCombo = 0;
  }

  // ---------- Helpers ----------
  function canMove(r, c) {
    return maze[r]?.[c] === ".";
  }

  function canStep(r, c, dr, dc) {
    const [nr, nc] = advance(r, c, dr, dc);
    return canMove(nr, nc);
  }
  function advance(r, c, dr, dc) {
    let nr = r + dr, nc = c + dc;
    if (nc < 0) nc = MAZE_W - 1;
    else if (nc >= MAZE_W) nc = 0;
    return [nr, nc];
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
    tickCarry = 0;
    setupBoard();
    state = "ready";
    hideOverlay();
    updateStatus();
    showStartOverlay();
  }

  function startGame() {
    hideOverlay();
    tickCarry = 0;
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
      // Frightened ghosts turn tail immediately, like the arcade original.
      for (const g of ghosts) g.dir = [-g.dir[0], -g.dir[1]];
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
    tickCarry = 0;
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
  // Each ghost has its own personality in chase mode, and its own corner in
  // scatter mode. The two modes alternate on the classic schedule.
  function ghostTarget(g) {
    const idx = ghosts.indexOf(g);
    if (scatterMode) return SCATTER_CORNERS[idx] || [player.r, player.c];
    if (idx === 1) {
      // Pink: ambush four cells ahead of the player.
      let ahead = [player.r + player.dir[0] * 4, player.c + player.dir[1] * 4];
      if (!canMove(ahead[0], ahead[1])) ahead = [player.r, player.c];
      return ahead;
    }
    if (idx === 2) {
      // Cyan: the arcade "multi-target" — reflect a point 2 ahead through Red.
      const red = ghosts[0];
      const ahead = [player.r + player.dir[0] * 2, player.c + player.dir[1] * 2];
      return [ahead[0] + (ahead[0] - red.r), ahead[1] + (ahead[1] - red.c)];
    }
    if (idx === 3) {
      // Orange: chase from a distance, but peel away to his corner up close.
      return dist2([g.r, g.c], [player.r, player.c]) > 64 ? [player.r, player.c] : SCATTER_CORNERS[3];
    }
    return [player.r, player.c]; // Red: direct chase.
  }

  function moveGhost(g) {
    if (g.leaving) {
      const dc = Math.sign(GATE[1] - g.c);
      const dr = dc === 0 ? -1 : 0;
      g.dir = [dr, dc];
      g.r += dr;
      g.c += dc;
      g.leaving = inPen(g);
      return;
    }

    const rev = [-g.dir[0], -g.dir[1]];
    let options = GHOST_DIRS.filter(
      ([dr, dc]) => canStep(g.r, g.c, dr, dc) && !(dr === rev[0] && dc === rev[1])
    );
    if (options.length === 0) options = GHOST_DIRS.filter(([dr, dc]) => canStep(g.r, g.c, dr, dc));
    if (options.length === 0) return;

    // GHOST_DIRS is ordered up, left, down, right, so with a strict `<`
    // comparison ties resolve exactly like the original arcade game.
    const target = powerTimer > 0 ? null : ghostTarget(g);
    let best = options[0];
    let bestD = powerTimer > 0 ? -Infinity : Infinity;
    for (const [dr, dc] of options) {
      const nr = g.r + dr, nc = g.c + dc;
      const d = target
        ? (nr - target[0]) ** 2 + (nc - target[1]) ** 2
        : (nr - player.r) ** 2 + (nc - player.c) ** 2;
      if (powerTimer > 0 ? d > bestD : d < bestD) {
        bestD = d;
        best = [dr, dc];
      }
    }
    g.dir = best;
    const [nr, nc] = advance(g.r, g.c, g.dir[0], g.dir[1]);
    g.r = nr;
    g.c = nc;
  }

  // ---------- Update ----------
  function update() {
    if (state !== "playing" || paused || badgesOpen) return;
    frame++;

    // Remember where everyone stood: a player and ghost can pass straight
    // through each other in one tick, which a final-position check misses.
    const prevPlayerR = player.r;
    const prevPlayerC = player.c;

    if (powerTimer > 0) powerTimer--;

    // Scatter / chase schedule; ghosts reverse when the mode flips.
    modeTimer++;
    if (modeTimer >= MODE_SCHEDULE[modeIndex]) {
      modeTimer = 0;
      scatterMode = !scatterMode;
      if (modeIndex < MODE_SCHEDULE.length - 1) modeIndex++;
      for (const g of ghosts) g.dir = [-g.dir[0], -g.dir[1]];
    }

    // Player.
    if (player.cooldown > 0) player.cooldown--;
    if (player.cooldown <= 0) {
      const [ndr, ndc] = player.nextDir;
      if ((ndr || ndc) && canStep(player.r, player.c, ndr, ndc)) player.dir = [ndr, ndc];
      const [dr, dc] = player.dir;
      if ((dr || dc) && canStep(player.r, player.c, dr, dc)) {
        const [nr, nc] = advance(player.r, player.c, dr, dc);
        player.r = nr;
        player.c = nc;
        eat();
      }
      player.cooldown = PLAYER_TICK;
    }

    if (dotsRemaining <= 0) return nextLevel();

    // Ghosts.
    for (const g of ghosts) {
      if (g.cooldown > 0) g.cooldown--;
      if (g.cooldown <= 0) {
        g.prevR = g.r;
        g.prevC = g.c;
        moveGhost(g);
        g.cooldown = powerTimer > 0 ? POWER_GHOST_TICK : Math.max(5, GHOST_TICK - (level - 1));
      }
    }

    // Collisions: same tile, or the two swapped tiles during this tick (the
    // tunnel wrap works too because the old and new cells are compared as-is).
    for (const g of ghosts) {
      const sameTile = g.r === player.r && g.c === player.c;
      const swapped =
        g.prevR === player.r && g.prevC === player.c &&
        prevPlayerR === g.r && prevPlayerC === g.c;
      if (!sameTile && !swapped) continue;
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
        g.leaving = inPen(g);
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
  function buildWallPath() {
    const path = new Path2D();
    const radius = CELL * 0.28;
    const spokes = [[0, -radius], [radius, 0], [0, radius], [-radius, 0]];
    const isWall = (r, c) => (MAZE[r]?.[Math.min(MAZE_W - 1, Math.max(0, c))] ?? "#") === "#";

    // Trace the boundary at each grid corner. Neighboring segments meet at
    // their spokes, while a curve rounds each turn around a wall island.
    for (let r = 0; r <= MAZE_H; r++) {
      for (let c = 0; c <= MAZE_W; c++) {
        const nw = isWall(r - 1, c - 1), ne = isWall(r - 1, c);
        const sw = isWall(r, c - 1), se = isWall(r, c);
        const x = c * CELL, y = r * CELL;
        const edges = [nw !== ne, ne !== se, se !== sw, sw !== nw];

        if (edges[2]) { path.moveTo(x, y + radius); path.lineTo(x, y + CELL - radius); }
        if (edges[1]) { path.moveTo(x + radius, y); path.lineTo(x + CELL - radius, y); }

        const turns = edges.flatMap((edge, i) => edge ? [i] : []);
        const pairs = turns.length === 4 ? (nw ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]]) : [turns];
        for (const [from, to] of pairs) {
          if (from === undefined) continue;
          const [ax, ay] = spokes[from], [bx, by] = spokes[to];
          path.moveTo(x + ax, y + ay);
          path.quadraticCurveTo(x, y, x + bx, y + by);
        }
      }
    }
    return path;
  }

  const wallPath = buildWallPath();

  function drawMaze() {
    ctx.fillStyle = "#05060c";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // A second blue outline follows the board edge and opens at the tunnels.
    const inset = CELL * 0.25;
    const tunnelY = TUNNEL_ROW * CELL;
    ctx.beginPath();
    for (const [edge, end, sign] of [[inset, tunnelY, 1], [LOGICAL_H - inset, tunnelY + CELL, -1]]) {
      ctx.moveTo(inset, end);
      ctx.lineTo(inset, edge + sign * CELL * 0.5);
      ctx.quadraticCurveTo(inset, edge, inset + CELL * 0.5, edge);
      ctx.lineTo(LOGICAL_W - inset - CELL * 0.5, edge);
      ctx.quadraticCurveTo(LOGICAL_W - inset, edge, LOGICAL_W - inset, edge + sign * CELL * 0.5);
      ctx.lineTo(LOGICAL_W - inset, end);
    }

    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#102765";
    ctx.stroke(wallPath);
    ctx.stroke();
    ctx.lineWidth = 2.3;
    ctx.strokeStyle = "#628aff";
    ctx.stroke(wallPath);
    ctx.stroke();

    const [row, col] = GATE;
    ctx.fillStyle = "#ffb5d9";
    ctx.fillRect(col * CELL + 1, (row + 0.5) * CELL - 1.5, CELL - 2, 3);
  }

  function draw() {
    drawMaze();

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
    const [dr, dc] = player.dir;
    const heading = Math.atan2(dr, dc);
    const mouth = 0.29 + 0.19 * Math.sin(frame * Math.PI / 7);
    ctx.fillStyle = "#ffd94d";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, pr, heading + mouth, heading + 2 * Math.PI - mouth);
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
    tickCarry = 0; // a pause must not bank time for a catch-up burst
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
    if (badgesOpen) return; // the dialog owns keyboard and swipe input
    if (state === "ready") startGame();
    if (state !== "playing" || paused) return;
    player.nextDir = [dr, dc];
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
  // The shared loop supplies elapsed milliseconds. Advance the simulation at
  // a fixed 60 ticks/second so speeds and the 480-tick power duration are the
  // same on 60 Hz, 120 Hz or any other display. Drawing stays per frame.
  const TICK_MS = 1000 / 60;

  function onFrame(dt) {
    if (state === "playing" && !paused && !badgesOpen) {
      tickCarry += dt;
      let guard = 0;
      while (tickCarry >= TICK_MS && guard++ < 12) {
        const before = state;
        update();
        tickCarry = Math.max(0, tickCarry - TICK_MS); // update() may reset it
        if (state !== before || state !== "playing" || paused || badgesOpen) {
          tickCarry = 0;
          break;
        }
      }
    } else {
      tickCarry = 0;
    }
    draw();
  }

  const gameLoop = loopApi.create(onFrame);

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
    TICK_MS,
    tickLoop: (dt) => onFrame(dt),
    get tickCarry() { return tickCarry; },
    get maze() { return maze.map((row) => [...row]); },
    get dots() { return dots.map((row) => row.slice()); },
    get player() { return { r: player.r, c: player.c, dir: player.dir.slice(), nextDir: player.nextDir.slice() }; },
    get ghosts() { return ghosts.map((g) => ({ r: g.r, c: g.c, dir: g.dir.slice(), color: g.color, leaving: !!g.leaving })); },
    get score() { return score; },
    get lives() { return lives; },
    get level() { return level; },
    get dotsRemaining() { return dotsRemaining; },
    get powerTimer() { return powerTimer; },
    get state() { return state; },
    get paused() { return paused; },
    get badgesOpen() { return badgesOpen; },
    get scatterMode() { return scatterMode; },
    get modeIndex() { return modeIndex; },
    GHOST_DIRS,
    PEN_STARTS,
    SCATTER_CORNERS,
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
    setGhost: (i, r, c) => { if (ghosts[i]) { ghosts[i].r = r; ghosts[i].c = c; ghosts[i].prevR = r; ghosts[i].prevC = c; ghosts[i].cooldown = 9999; ghosts[i].leaving = false; } },
    setGhostDir: (i, dr, dc) => { if (ghosts[i]) ghosts[i].dir = [dr, dc]; },
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
