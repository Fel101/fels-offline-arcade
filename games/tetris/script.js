// Tetris — pure vanilla JS, fully offline.
// Modes: Marathon (endless), Sprint 40, Vs AI (race a rival).
// Features: 7-bag, hold, 3-piece next queue, ghost, lock delay, wall kicks,
// combos, back-to-back Tetris, persistent high scores, 24 achievements,
// sound, particles, theme-aware canvas, and an AI rival with 3 difficulties.
//
// Shared plumbing (storage, audio, toasts, overlay, badges, modal) comes
// from ../../js/arcade-core.js.
(() => {
  "use strict";

  const Arcade = window.Arcade;
  const { toast, overlay, badges: badgesApi, modal: modalApi, dom } = Arcade;

  // ---------- DOM ----------
  const board = document.getElementById("board");
  const bctx = setupCanvas(board, 280, 560);
  const nextCanvas = document.getElementById("next");
  const nctx = setupCanvas(nextCanvas, 112, 252);
  const holdCanvas = document.getElementById("hold");
  const hctx = setupCanvas(holdCanvas, 112, 84);
  const rivalCanvas = document.getElementById("rival");
  const rctx = setupCanvas(rivalCanvas, 140, 280);

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");

  const pauseBtn = document.getElementById("pause");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");

  const aiDifficultyEl = document.getElementById("ai-difficulty");
  const aiChips = Array.from(document.querySelectorAll(".ai-chip"));
  const rivalPanel = document.getElementById("rival-panel");
  const rivalLinesEl = document.getElementById("rival-lines");
  const rivalPiecesEl = document.getElementById("rival-pieces");
  const rivalDiffEl = document.getElementById("rival-diff");

  const raceTrack = document.getElementById("race-track");
  const racePlayerFill = document.getElementById("race-player-fill");
  const racePlayerText = document.getElementById("race-player-text");
  const raceRivalRow = document.getElementById("race-rival-row");
  const raceAiFill = document.getElementById("race-ai-fill");
  const raceAiText = document.getElementById("race-ai-text");

  const toastsEl = document.getElementById("toasts");
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  const modeChips = Array.from(document.querySelectorAll(".mode-chip"));

  // ---------- Constants ----------
  const COLS = 10;
  const ROWS = 20;
  const CELL = 28;
  const BOARD_W = COLS * CELL;
  const BOARD_H = ROWS * CELL;
  const RIVAL_CELL = 14;
  const RIVAL_W = COLS * RIVAL_CELL;
  const RIVAL_H = ROWS * RIVAL_CELL;

  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;
  const SPRINT_GOAL = 40;
  const AI_GOAL = 40;
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
  };
  const COLORS = {
    I: "#38d6c4",
    O: "#ffd23f",
    T: "#b06bff",
    S: "#4ade80",
    Z: "#ff5b6e",
    J: "#4d9dff",
    L: "#ff9f43",
  };

  const MODES = {
    marathon: {
      name: "Marathon",
      goal: 0,
      ai: false,
      sprint: false,
      hint: "Endless marathon — speed rises every 10 lines.",
    },
    sprint: {
      name: "Sprint 40",
      goal: SPRINT_GOAL,
      ai: false,
      sprint: true,
      hint: "Clear 40 lines as fast as you can.",
    },
    ai: {
      name: "Vs AI",
      goal: AI_GOAL,
      ai: true,
      sprint: false,
      hint: "Race the AI rival to 40 lines.",
    },
  };

  const AI_DIFFS = {
    chill: { name: "Chill", base: 900, noise: 40 },
    smart: { name: "Smart", base: 650, noise: 3 },
    expert: { name: "Expert", base: 420, noise: 0 },
  };

  const ACHIEVEMENTS = [
    { id: "first", icon: "📏", name: "First Line", desc: "Clear your first line.", stat: "totalLines", goal: 1 },
    { id: "double", icon: "✌️", name: "Double Down", desc: "Clear 2 lines at once.", stat: "doubles", goal: 1 },
    { id: "triple", icon: "🎯", name: "Triple Threat", desc: "Clear 3 lines at once.", stat: "triples", goal: 1 },
    { id: "tetris", icon: "🎉", name: "Tetris!", desc: "Clear 4 lines at once.", stat: "tetrises", goal: 1 },
    { id: "combo2", icon: "🔗", name: "In the Groove", desc: "Chain 2 line clears in a row.", stat: "maxCombo", goal: 2 },
    { id: "combo4", icon: "🔥", name: "Unstoppable", desc: "Chain 4 line clears in a row.", stat: "maxCombo", goal: 4 },
    { id: "back2back", icon: "♻️", name: "Back-to-Back", desc: "Land two Tetrises in a row.", stat: "backToBacks", goal: 1 },
    { id: "score1k", icon: "💯", name: "Four Figures", desc: "Score 1,000 in one run.", stat: "maxScore", goal: 1000 },
    { id: "score5k", icon: "💎", name: "High Roller", desc: "Score 5,000 in one run.", stat: "maxScore", goal: 5000 },
    { id: "score10k", icon: "👑", name: "Five Digits", desc: "Score 10,000 in one run.", stat: "maxScore", goal: 10000 },
    { id: "lines10", icon: "📊", name: "Getting Started", desc: "Clear 10 lines in total.", stat: "totalLines", goal: 10 },
    { id: "lines40", icon: "🏁", name: "Forty Strong", desc: "Clear 40 lines in total.", stat: "totalLines", goal: 40 },
    { id: "lines100", icon: "🚀", name: "Century", desc: "Clear 100 lines in total.", stat: "totalLines", goal: 100 },
    { id: "level5", icon: "⚡", name: "Level Up", desc: "Reach level 5.", stat: "maxLevel", goal: 5 },
    { id: "level10", icon: "🌟", name: "Double Digits", desc: "Reach level 10.", stat: "maxLevel", goal: 10 },
    { id: "hold", icon: "🙌", name: "Hold Up", desc: "Use the hold slot.", stat: "totalHolds", goal: 1 },
    { id: "drops50", icon: "⬇️", name: "Drop It", desc: "Hard drop 50 pieces.", stat: "totalHardDrops", goal: 50 },
    { id: "sprint", icon: "🏃", name: "Sprint", desc: "Finish a 40-line Sprint.", stat: "sprints", goal: 1 },
    // Sprint badges measure a time, so lower is better: `satisfied` inverts
    // the comparison and `progress` fills the bar as the time drops.
    {
      id: "under3",
      icon: "⏱️",
      name: "Speed Demon",
      desc: "Finish a Sprint under 3:00.",
      stat: "sprintBest",
      goal: 180,
      satisfied: () => records.sprintBest > 0 && records.sprintBest <= 180 * 1000,
      progress: () => {
        const ms = records.sprintBest || 0;
        if (!ms) return { text: "No sprint yet" };
        if (ms <= 180 * 1000) return { text: `Best ${formatTime(ms)}` };
        return { text: `Best ${formatTime(ms)}` };
      },
    },
    {
      id: "under2",
      icon: "🚄",
      name: "Bullet Train",
      desc: "Finish a Sprint under 2:00.",
      stat: "sprintBest",
      goal: 120,
      satisfied: () => records.sprintBest > 0 && records.sprintBest <= 120 * 1000,
      progress: () => {
        const ms = records.sprintBest || 0;
        if (!ms) return { text: "No sprint yet" };
        return { text: `Best ${formatTime(ms)}` };
      },
    },
    { id: "rival", icon: "🤖", name: "Rival Slayer", desc: "Win a race against the AI.", stat: "aiWins", goal: 1 },
    { id: "rival3", icon: "🏆", name: "Rival Hunter", desc: "Win 3 races against the AI.", stat: "aiWins", goal: 3 },
    { id: "marathon5", icon: "🕔", name: "Marathoner", desc: "Survive 5 minutes in Marathon.", stat: "marathonTime", goal: 300 },
    { id: "pieces100", icon: "🧱", name: "Piece Master", desc: "Place 100 pieces.", stat: "totalPieces", goal: 100 },
  ];

  const DEFAULT_RECORDS = {
    totalLines: 0,
    totalPieces: 0,
    totalHardDrops: 0,
    totalHolds: 0,
    maxScore: 0,
    maxLines: 0,
    maxLevel: 1,
    maxCombo: 0,
    doubles: 0,
    triples: 0,
    tetrises: 0,
    backToBacks: 0,
    sprints: 0,
    sprintBest: 0,
    aiWins: 0,
    marathonTime: 0,
    totalRuns: 0,
  };

  // ---------- Storage ----------
  const store = Arcade.store;

  const K = {
    // Legacy keys — kept exactly as they were so existing saves still load.
    best: (m) => `tetris-best-${m}`,
    sprintBest: "tetris-sprint-best",
    stats: "tetris-stats-v1",
    achv: "tetris-achv-v1",
    sound: "tetris-sound",
    mode: "tetris-mode",
    diff: "tetris-ai-diff",
  };

  const storedRecords = store.json(K.stats, {});
  let records = Object.assign(
    {},
    DEFAULT_RECORDS,
    storedRecords && typeof storedRecords === "object" && !Array.isArray(storedRecords) ? storedRecords : {}
  );
  for (const key of Object.keys(DEFAULT_RECORDS)) {
    if (!Number.isFinite(records[key])) records[key] = DEFAULT_RECORDS[key];
  }

  // Achievement unlock state lives in the shared badge registry below.

  let sprintBest = Math.max(records.sprintBest || 0, Number(store.get(K.sprintBest, 0)) || 0);
  records.sprintBest = sprintBest;

  // ---------- Palette ----------
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      accent: get("--accent", "#5ad1b8"),
      accent2: get("--accent-2", "#ffd94d"),
      accent3: get("--accent-3", "#ff5ea8"),
      danger: get("--danger", "#ff5b5b"),
      text: get("--text", "#f2f3f7"),
      muted: get("--muted", "#9a9aa8"),
      line: get("--glass-border", "rgba(255,255,255,0.11)"),
    };
  }
  let PAL = readPalette();

  // ---------- Canvas setup ----------
  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // ---------- Audio ----------
  const soundCtl = Arcade.audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });
  let soundOn = soundCtl.enabled;
  let actx = null;

  Arcade.audio.define("move", [[220, 0, 0.035, "square", 0.018]]);
  Arcade.audio.define("rotate", [[330, 0, 0.045, "square", 0.02]]);
  Arcade.audio.define("lock", [[150, 0, 0.07, "sine", 0.035, 90]]);
  Arcade.audio.define("clear", [
    [440, 0, 0.09, "triangle", 0.045],
    [660, 0.06, 0.12, "triangle", 0.04],
  ]);
  Arcade.audio.define("tetris", [
    [440, 0, 0.1, "triangle", 0.05],
    [660, 0.07, 0.11, "triangle", 0.05],
    [880, 0.14, 0.12, "triangle", 0.05],
    [1320, 0.22, 0.22, "triangle", 0.045],
  ]);
  Arcade.audio.define("levelup", [
    [523, 0, 0.1, "sine", 0.04],
    [659, 0.08, 0.1, "sine", 0.04],
    [784, 0.16, 0.18, "sine", 0.04],
  ]);
  Arcade.audio.define("hold", [[300, 0, 0.14, "sine", 0.035, 520]]);
  Arcade.audio.define("drop", [[220, 0, 0.1, "square", 0.035, 70]]);
  Arcade.audio.define("over", [[320, 0, 0.45, "sawtooth", 0.05, 60]]);
  Arcade.audio.define("win", [
    [523, 0, 0.12, "sine", 0.05],
    [659, 0.1, 0.12, "sine", 0.05],
    [784, 0.2, 0.18, "sine", 0.05],
    [1047, 0.32, 0.3, "sine", 0.045],
  ]);
  Arcade.audio.define("click", [[600, 0, 0.035, "sine", 0.02]]);

  function ensureAudio() {
    Arcade.audio.unlock();
  }

  function sfx(name) {
    if (!soundOn) return;
    Arcade.audio.sfx(name);
  }

  function updateSoundBtn() {
    soundIconEl.textContent = soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    const label = soundOn ? "Mute sound" : "Enable sound";
    soundBtn.setAttribute("aria-label", label);
    soundBtn.title = label;
  }

  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  // ---------- State ----------
  let grid;
  let current = null;
  let queue = [];
  let bag = [];
  let holdPiece = null;
  let canHold = true;

  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 800;
  let dropAcc = 0;
  let lockTimer = 0;
  let lockResets = 0;
  let combo = 0;
  let lastClearWasTetris = false;

  let gameTime = 0;
  let lastSec = 0;
  let lastTimeText = "";

  let countdown = 0;
  let started = false;
  let paused = false;
  let gameOver = false;

  let bestScore = 0;
  let bestAtStart = 0;

  let mode = "marathon";
  let modeCfg = MODES.marathon;
  let aiDiff = "smart";
  let ai = null;

  let particles = [];
  let floaters = [];
  let shake = 0;
  let flashRows = [];
  let flashUntil = 0;

  let overlayEl = null; // kept for the test hook
  function currentOverlayEl() {
    return overlay.current();
  }
  let resumeAfterModal = false;
  let lastTs = 0;

  // ---------- Helpers ----------
  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function nextKey() {
    if (!bag.length) {
      bag = Object.keys(SHAPES).slice();
      shuffle(bag);
    }
    return bag.pop();
  }

  function makePiece(key) {
    const shape = SHAPES[key].map((r) => [...r]);
    return {
      key,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: 0,
      rot: 0,
    };
  }

  function rotateMatrix(m) {
    const rows = m.length;
    const cols = m[0].length;
    const res = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        res[c][rows - 1 - r] = m[r][c];
      }
    }
    return res;
  }

  function collides(piece, g) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const nx = piece.x + c;
        const ny = piece.y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && g[ny][nx]) return true;
      }
    }
    return false;
  }

  function mergePiece(piece, g) {
    let above = false;
    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const ny = piece.y + r;
        const nx = piece.x + c;
        if (ny < 0) {
          above = true;
          return;
        }
        if (ny < ROWS && nx >= 0 && nx < COLS) g[ny][nx] = piece.key;
      });
    });
    return above;
  }

  function findFullRows(g) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      if (g[r].every(Boolean)) rows.push(r);
    }
    return rows;
  }

  function removeRows(g, rows) {
    for (let i = rows.length - 1; i >= 0; i--) {
      g.splice(rows[i], 1);
      g.unshift(new Array(COLS).fill(null));
    }
  }

  function clearGrid(g) {
    const rows = findFullRows(g);
    removeRows(g, rows);
    return rows.length;
  }

  function formatTime(ms) {
    const total = Math.max(0, ms) / 1000;
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const d = Math.floor((total * 10) % 10);
    return `${m}:${String(s).padStart(2, "0")}.${d}`;
  }

  function addScore(points) {
    if (!points) return;
    score += points;
    records.maxScore = Math.max(records.maxScore, score);
    scoreEl.textContent = score;
    if (mode !== "sprint" && score > bestScore) {
      bestScore = score;
      bestEl.textContent = bestScore;
      store.set(K.best(mode), String(bestScore));
    }
  }

  function saveRecords() {
    store.jsonSet(K.stats, records);
  }

  function loadBest() {
    if (mode === "sprint") {
      bestScore = 0;
    } else {
      bestScore = Number(store.get(K.best(mode), 0)) || 0;
    }
    bestAtStart = mode === "sprint" ? sprintBest : bestScore;
  }

  // ---------- Toasts & achievements ----------
  toast.bind(document.getElementById("toasts"));

  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => records[key] || 0,
    onUnlock: () => {
      updateBadgeCount();
      saveRecords();
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
        ["Marathon", Number(store.get(K.best("marathon"), 0)) || 0],
        ["Sprint", sprintBest ? formatTime(sprintBest) : "—"],
        ["AI wins", records.aiWins],
        ["Lines", records.totalLines],
        ["Pieces", records.totalPieces],
        ["Runs", records.totalRuns],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) {
        paused = true;
        resumeAfterModal = true;
        pauseBtn.textContent = "▶ Resume";
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!gameOver) {
          paused = false;
          pauseBtn.textContent = "Pause";
        }
      }
      const target = overlay.isOpen() ? document.querySelector(".overlay .btn") : badgesBtn;
      if (target) target.focus();
    },
  });

  function openAchv() {
    achvModalCtl.open();
  }

  function closeAchv() {
    achvModalCtl.close();
  }

  // ---------- Overlay ----------
  // Provided by the shared core. `overlayEl` is kept as a live reference so
  // existing test hooks that inspect overlayEl.dataset still work.
  const hideOverlay = () => overlay.hide();

  function setPaused(p, silent) {
    if (gameOver) return;
    paused = p;
    pauseBtn.textContent = p ? "▶ Resume" : "Pause";
    if (p && !silent) {
      overlay.show("Paused", "Take a breath — press P or hit Resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false, true);
          },
        },
        {
          label: "Restart",
          ghost: true,
          onClick: () => {
            hideOverlay();
            reset();
          },
        },
      ]);
    } else if (!p) {
      hideOverlay();
    }
  }

  function togglePause() {
    if (gameOver) return;
    setPaused(!paused, false);
  }

  // ---------- Player piece flow ----------
  function resetPiecePosition() {
    if (!current) return;
    current.y = 0;
    current.x = Math.floor((COLS - current.shape[0].length) / 2);
    current.rot = 0;
  }

  function spawnNext() {
    current = queue.shift();
    queue.push(makePiece(nextKey()));
    resetPiecePosition();
    drawNext();
    if (collides(current, grid)) topOut();
  }

  function topOut() {
    current = null;
    if (mode === "ai") {
      finishGame("rival", `You topped out with ${lines}/${AI_GOAL} lines.`);
    } else {
      finishGame("topout");
    }
  }

  function tryMove(dx, dy) {
    if (!current) return false;
    const moved = { ...current, x: current.x + dx, y: current.y + dy };
    if (collides(moved, grid)) return false;
    current = moved;
    if (dy === 0) {
      if (lockResets < MAX_LOCK_RESETS) {
        lockTimer = 0;
        lockResets++;
      }
    } else {
      lockTimer = 0;
    }
    return true;
  }

  function tryRotate() {
    if (!current || current.key === "O") return true;
    const rotated = rotateMatrix(current.shape);
    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
    ];
    for (const [dx, dy] of kicks) {
      const test = { ...current, shape: rotated, x: current.x + dx, y: current.y + dy };
      if (!collides(test, grid)) {
        current = test;
        current.rot = (current.rot + 1) % 4;
        lockTimer = 0;
        if (lockResets < MAX_LOCK_RESETS) lockResets++;
        return true;
      }
    }
    return false;
  }

  function softDrop() {
    if (!started || !current) return;
    if (tryMove(0, 1)) {
      addScore(1);
      dropAcc = 0;
      updateHUD();
      drawBoard();
    }
  }

  function hardDrop() {
    if (!started || !current) return;
    let dist = 0;
    while (tryMove(0, 1)) dist++;
    if (dist) addScore(dist * 2);
    records.totalHardDrops++;
    saveRecords();
    checkAchievements();
    sfx("drop");
    lockPiece();
    updateHUD();
    drawBoard();
  }

  function hold() {
    if (!started || !current || !canHold) return;
    records.totalHolds++;
    const cur = current;
    if (holdPiece) {
      const swap = holdPiece;
      holdPiece = cur.key;
      current = makePiece(swap);
      resetPiecePosition();
      if (collides(current, grid)) {
        topOut();
        return;
      }
    } else {
      holdPiece = cur.key;
      spawnNext();
    }
    canHold = false;
    lockTimer = 0;
    lockResets = 0;
    dropAcc = 0;
    sfx("hold");
    saveRecords();
    checkAchievements();
    drawHold();
    drawBoard();
    updateHUD();
  }

  function lockPiece() {
    if (!current) return;
    const above = mergePiece(current, grid);
    records.totalPieces++;
    records.maxScore = Math.max(records.maxScore, score);
    current = null;

    if (above) {
      topOut();
      saveRecords();
      checkAchievements();
      return;
    }

    const full = findFullRows(grid);
    let cleared = 0;

    if (full.length) {
      flashRows = full.slice();
      flashUntil = performance.now() + 150;
      for (const r of full) {
        for (let i = 0; i < COLS; i += 2) {
          burstCell(i + Math.random(), r, COLORS[currentKeyAt(r, i)] || PAL.accent, 2);
        }
      }

      cleared = full.length;
      removeRows(grid, full);

      const base = [0, 100, 300, 500, 800][cleared] * level;
      combo++;
      let points = base;
      if (combo > 1) points += 50 * (combo - 1) * level;

      if (cleared === 4) {
        if (lastClearWasTetris) {
          points = Math.floor(points * 1.5);
          records.backToBacks++;
        }
        records.tetrises++;
        lastClearWasTetris = true;
      } else {
        lastClearWasTetris = false;
      }
      if (cleared === 2) records.doubles++;
      if (cleared === 3) records.triples++;

      addScore(points);
      lines += cleared;
      records.totalLines += cleared;
      records.maxLines = Math.max(records.maxLines, lines);
      records.maxCombo = Math.max(records.maxCombo, combo);

      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = newLevel;
        dropInterval = Math.max(70, 800 - (level - 1) * 70);
        records.maxLevel = Math.max(records.maxLevel, level);
        levelUp();
      }

      sfx(cleared === 4 ? "tetris" : "clear");
      if (cleared === 4) shake = REDUCE ? 0 : 10;

      const label = ["", "Single", "Double", "Triple", "TETRIS!"][cleared];
      floater(BOARD_W / 2, (full[0] + 0.5) * CELL, `${label}${combo > 1 ? ` x${combo}` : ""} +${points}`, cleared === 4 ? PAL.accent2 : PAL.accent);

      checkRaceProgress();
    } else {
      combo = 0;
      lastClearWasTetris = false;
      sfx("lock");
    }

    canHold = true;
    saveRecords();
    checkAchievements();
    if (!gameOver) spawnNext();
    updateHUD();
    drawBoard();
  }

  function currentKeyAt(row, col) {
    for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + 1); c++) {
      if (grid[row] && grid[row][c]) return grid[row][c];
    }
    return "I";
  }

  function levelUp() {
    floater(BOARD_W / 2, CELL * 4, `LEVEL ${level}`, PAL.accent2);
    sfx("levelup");
  }

  function checkRaceProgress() {
    if (gameOver) return;
    if (mode === "sprint" && lines >= SPRINT_GOAL) {
      finishGame("sprint");
    } else if (mode === "ai" && lines >= AI_GOAL) {
      finishGame("win");
    }
  }

  // ---------- AI rival ----------
  function initAI() {
    const a = {
      grid: emptyGrid(),
      bag: [],
      queue: [],
      current: null,
      target: null,
      lines: 0,
      score: 0,
      pieces: 0,
      over: false,
      animStart: 0,
      animDuration: 1,
    };
    ai = a;
    for (let i = 0; i < 3; i++) a.queue.push(makePiece(aiNextKey()));
    return a;
  }

  function aiNextKey() {
    if (!ai.bag.length) {
      ai.bag = Object.keys(SHAPES).slice();
      shuffle(ai.bag);
    }
    return ai.bag.pop();
  }

  function aiInterval() {
    const cfg = AI_DIFFS[aiDiff] || AI_DIFFS.smart;
    return cfg.base * Math.max(0.65, 1 - ai.lines / 200);
  }

  function evaluateGrid(g) {
    const heights = new Array(COLS).fill(0);
    let holes = 0;
    for (let x = 0; x < COLS; x++) {
      let seen = false;
      for (let y = 0; y < ROWS; y++) {
        if (g[y][x]) {
          if (!seen) {
            heights[x] = ROWS - y;
            seen = true;
          }
        } else if (seen) {
          holes++;
        }
      }
    }
    let agg = 0;
    let bump = 0;
    for (let x = 0; x < COLS; x++) {
      agg += heights[x];
      if (x > 0) bump += Math.abs(heights[x] - heights[x - 1]);
    }
    return { agg, holes, bump, max: Math.max(...heights) };
  }

  function aiBestPlacement(g, piece) {
    const cfg = AI_DIFFS[aiDiff] || AI_DIFFS.smart;
    let best = null;
    let shape = piece.shape;
    for (let rot = 0; rot < 4; rot++) {
      for (let x = -shape[0].length + 1; x < COLS; x++) {
        const test = { key: piece.key, shape, x, y: 0 };
        if (collides(test, g)) continue;
        let y = 0;
        while (!collides({ ...test, y: y + 1 }, g)) y++;
        const clone = g.map((row) => row.slice());
        mergePiece({ key: piece.key, shape, x, y }, clone);
        const cleared = clearGrid(clone);
        const ev = evaluateGrid(clone);
        let value =
          -0.51 * ev.agg +
          0.76 * cleared -
          0.36 * ev.holes -
          0.18 * ev.bump -
          0.1 * ev.max;
        if (cfg.noise) value += Math.random() * cfg.noise;
        if (!best || value > best.value) {
          best = { value, shape, x, y };
        }
      }
      shape = rotateMatrix(shape);
    }
    return best;
  }

  function aiSpawn(t) {
    if (!ai || ai.over) return;
    ai.current = ai.queue.shift();
    ai.queue.push(makePiece(aiNextKey()));
    const target = aiBestPlacement(ai.grid, ai.current);
    if (!target) {
      ai.over = true;
      ai.target = null;
      if (!gameOver) finishGame("win", "The rival topped out. You win!");
      return;
    }
    ai.target = target;
    ai.animStart = t;
    ai.animDuration = aiInterval();
  }

  function aiLock() {
    if (!ai || ai.over || !ai.target || !ai.current) return;
    mergePiece({ key: ai.current.key, shape: ai.target.shape, x: ai.target.x, y: ai.target.y }, ai.grid);
    const cleared = clearGrid(ai.grid);
    if (cleared) {
      ai.lines += cleared;
      ai.score += [0, 100, 300, 500, 800][cleared] * (Math.floor(ai.lines / 10) + 1);
    }
    ai.pieces++;
    updateRivalHUD();
    updateRace();

    if (ai.lines >= AI_GOAL) {
      finishGame("rival");
      return;
    }
    aiSpawn(gameTime);
  }

  function updateAI() {
    if (!ai || ai.over) return;
    if (gameTime - ai.animStart >= ai.animDuration) {
      aiLock();
    }
  }

  // ---------- Effects ----------
  function burstCell(cx, cy, color, n) {
    const px = cx * CELL;
    const py = cy * CELL;
    const count = REDUCE ? Math.min(n, 4) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      const life = 0.35 + Math.random() * 0.4;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 1.0, max: 1.0 });
    if (floaters.length > 24) floaters.shift();
  }

  function updateEffects(dt) {
    const dts = Math.min(dt, 50) / 1000;
    for (const p of particles) {
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 180 * dts;
      p.life -= dts;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floaters) {
      f.life -= dts;
      f.y -= 28 * dts;
    }
    floaters = floaters.filter((f) => f.life > 0);

    if (shake > 0) {
      shake *= Math.pow(0.001, dts);
      if (shake < 0.4) shake = 0;
    }
  }

  // ---------- Rendering ----------
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBlock(ctx, x, y, size, color, alpha) {
    const pad = Math.max(1, size * 0.055);
    const s = size - pad * 2;
    const r = Math.min(size * 0.22, 7);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    roundRect(ctx, x + pad, y + pad, s, s, r);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x + pad + s * 0.14, y + pad + s * 0.12, s * 0.72, s * 0.28, r * 0.6);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    roundRect(ctx, x + pad, y + pad, s, s, r);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawGridLines(ctx, cell, w, h) {
    ctx.save();
    ctx.strokeStyle = PAL.line;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      const px = x * cell + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = 1; y < ROWS; y++) {
      const py = y * cell + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPiece(ctx, key, shape, x, y, cell, alpha) {
    const color = COLORS[key] || PAL.accent;
    shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v) drawBlock(ctx, (x + c) * cell, (y + r) * cell, cell, color, alpha);
      });
    });
  }

  function drawMiniPiece(ctx, key, cx, cy, cell) {
    const shape = SHAPES[key];
    if (!shape) return;
    const w = shape[0].length * cell;
    const h = shape.length * cell;
    const ox = cx - w / 2;
    const oy = cy - h / 2;
    shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v) drawBlock(ctx, ox + c * cell, oy + r * cell, cell, COLORS[key], 1);
      });
    });
  }

  function drawBoard() {
    bctx.save();
    bctx.clearRect(0, 0, BOARD_W, BOARD_H);
    if (shake > 0.4) {
      const s = shake;
      bctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawGridLines(bctx, CELL, BOARD_W, BOARD_H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawBlock(bctx, c * CELL, r * CELL, CELL, COLORS[grid[r][c]], 1);
      }
    }

    if (current) {
      let ghost = { ...current, shape: current.shape };
      while (!collides({ ...ghost, y: ghost.y + 1 }, grid)) ghost.y++;
      if (ghost.y !== current.y) {
        drawPiece(bctx, current.key, current.shape, current.x, ghost.y, CELL, 0.16);
      }
      drawPiece(bctx, current.key, current.shape, current.x, current.y, CELL, 1);
    }

    if (flashRows.length && performance.now() < flashUntil) {
      bctx.fillStyle = "rgba(255,255,255,0.5)";
      for (const r of flashRows) bctx.fillRect(0, r * CELL, BOARD_W, CELL);
    }

    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      bctx.globalAlpha = a;
      bctx.fillStyle = p.color;
      bctx.beginPath();
      bctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      bctx.fill();
    }
    bctx.globalAlpha = 1;

    if (floaters.length) {
      bctx.save();
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      bctx.font = "900 17px 'Segoe UI', system-ui, sans-serif";
      for (const f of floaters) {
        const a = Math.max(0, Math.min(1, (f.life / f.max) * 1.6));
        bctx.globalAlpha = a;
        bctx.fillStyle = f.color;
        bctx.shadowColor = "rgba(0,0,0,0.5)";
        bctx.shadowBlur = 4;
        bctx.fillText(f.text, f.x, f.y);
      }
      bctx.restore();
    }

    if (!started && countdown > 0 && !paused && !gameOver) drawCountdown();

    bctx.restore();
  }

  function drawCountdown() {
    const label = countdown > 1400 ? "3" : countdown > 700 ? "2" : countdown > 200 ? "1" : "GO!";
    bctx.save();
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";

    bctx.globalAlpha = 0.55;
    bctx.fillStyle = "rgba(8, 10, 18, 0.7)";
    bctx.beginPath();
    bctx.arc(BOARD_W / 2, BOARD_H / 2, CELL * 2.6, 0, Math.PI * 2);
    bctx.fill();

    bctx.globalAlpha = 1;
    bctx.fillStyle = PAL.accent;
    bctx.shadowColor = PAL.accent;
    bctx.shadowBlur = 22;
    bctx.font = label === "GO!"
      ? "900 48px 'Segoe UI', system-ui, sans-serif"
      : "900 62px 'Segoe UI', system-ui, sans-serif";
    bctx.fillText(label, BOARD_W / 2, BOARD_H / 2 + 3);
    bctx.restore();
  }

  function drawNext() {
    nctx.clearRect(0, 0, 112, 252);
    const cell = 18;
    for (let i = 0; i < 3; i++) {
      if (!queue[i]) continue;
      drawMiniPiece(nctx, queue[i].key, 56, 42 + i * 84, cell);
    }
  }

  function drawHold() {
    hctx.clearRect(0, 0, 112, 84);
    if (holdPiece) drawMiniPiece(hctx, holdPiece, 56, 42, 18);
  }

  function drawRival() {
    if (!ai) return;
    rctx.save();
    rctx.clearRect(0, 0, RIVAL_W, RIVAL_H);
    drawGridLines(rctx, RIVAL_CELL, RIVAL_W, RIVAL_H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (ai.grid[r][c]) drawBlock(rctx, c * RIVAL_CELL, r * RIVAL_CELL, RIVAL_CELL, COLORS[ai.grid[r][c]], 1);
      }
    }

    if (!ai.over && ai.current && ai.target) {
      const p = Math.max(0, Math.min(1, (gameTime - ai.animStart) / Math.max(1, ai.animDuration)));
      const ease = 1 - Math.pow(1 - p, 3);
      const y = Math.round(ai.target.y * ease);
      drawPiece(rctx, ai.current.key, ai.target.shape, ai.target.x, ai.target.y, RIVAL_CELL, 0.14);
      drawPiece(rctx, ai.current.key, ai.target.shape, ai.target.x, y, RIVAL_CELL, 1);
    }

    if (ai.over) {
      rctx.fillStyle = "rgba(120, 20, 30, 0.45)";
      rctx.fillRect(0, 0, RIVAL_W, RIVAL_H);
      rctx.fillStyle = PAL.text;
      rctx.font = "900 11px 'Segoe UI', system-ui, sans-serif";
      rctx.textAlign = "center";
      rctx.textBaseline = "middle";
      rctx.fillText("RIVAL DOWN", RIVAL_W / 2, RIVAL_H / 2);
    }

    rctx.restore();
  }

  function draw() {
    drawBoard();
    drawNext();
    drawHold();
    drawRival();
  }

  // ---------- HUD ----------
  function updateHUD() {
    scoreEl.textContent = score;
    linesEl.textContent = modeCfg.goal ? `${lines}/${modeCfg.goal}` : lines;
    levelEl.textContent = level;
    bestEl.textContent = mode === "sprint" ? (sprintBest ? formatTime(sprintBest) : "—") : bestScore;
  }

  function updateTimeDisplay() {
    const t = formatTime(gameTime);
    if (t !== lastTimeText) {
      lastTimeText = t;
      timeEl.textContent = t;
    }
  }

  function updateRace() {
    if (!modeCfg.goal) return;
    racePlayerText.textContent = `${Math.min(lines, modeCfg.goal)}/${modeCfg.goal}`;
    racePlayerFill.style.width = Math.min(100, (lines / modeCfg.goal) * 100) + "%";
    if (ai) {
      raceAiText.textContent = `${Math.min(ai.lines, modeCfg.goal)}/${modeCfg.goal}`;
      raceAiFill.style.width = Math.min(100, (ai.lines / modeCfg.goal) * 100) + "%";
    }
  }

  function updateRivalHUD() {
    if (!ai) return;
    rivalLinesEl.textContent = ai.lines;
    rivalPiecesEl.textContent = ai.pieces + " pcs";
    rivalDiffEl.textContent = (AI_DIFFS[aiDiff] || AI_DIFFS.smart).name;
  }

  function updateAiDiffUI() {
    aiChips.forEach((chip) => {
      chip.setAttribute("aria-pressed", chip.dataset.diff === aiDiff ? "true" : "false");
    });
    if (ai) rivalDiffEl.textContent = (AI_DIFFS[aiDiff] || AI_DIFFS.smart).name;
  }

  // ---------- Game flow ----------
  function reset() {
    hideOverlay();
    grid = emptyGrid();
    bag = [];
    queue = [makePiece(nextKey()), makePiece(nextKey()), makePiece(nextKey())];
    holdPiece = null;
    canHold = true;

    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    dropAcc = 0;
    lockTimer = 0;
    lockResets = 0;
    combo = 0;
    lastClearWasTetris = false;

    gameTime = 0;
    lastSec = 0;
    lastTimeText = "";

    countdown = 2100;
    started = false;
    paused = false;
    gameOver = false;
    resumeAfterModal = false;

    particles = [];
    floaters = [];
    shake = 0;
    flashRows = [];
    flashUntil = 0;

    current = null;
    ai = modeCfg.ai ? initAI() : null;

    spawnNext();
    if (ai) {
      aiSpawn(0);
      updateRivalHUD();
    }

    bestAtStart = mode === "sprint" ? sprintBest : bestScore;

    records.totalRuns++;
    saveRecords();

    pauseBtn.textContent = "Pause";
    updateHUD();
    updateRace();
    drawHold();
    drawNext();
    checkAchievements();

    lastTs = performance.now();
    draw();
  }

  function startPlay() {
    started = true;
    countdown = 0;
    if (ai) {
      ai.animStart = gameTime;
      ai.animDuration = aiInterval();
    }
  }

  function setMode(m) {
    if (!MODES[m]) return;
    mode = m;
    modeCfg = MODES[m];
    store.set(K.mode, m);

    modeChips.forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false");
    });

    aiDifficultyEl.hidden = m !== "ai";
    rivalPanel.hidden = m !== "ai";
    raceTrack.hidden = m === "marathon";
    raceRivalRow.hidden = m !== "ai";

    loadBest();
    reset();
  }

  function finishGame(kind, extra) {
    if (gameOver) return;
    gameOver = true;
    paused = false;

    const isRecord =
      kind === "sprint"
        ? sprintBest === 0 || gameTime < sprintBest
        : mode !== "sprint" && score > bestAtStart;

    if (kind === "sprint") {
      if (sprintBest === 0 || gameTime < sprintBest) {
        sprintBest = Math.round(gameTime);
        records.sprintBest = sprintBest;
        store.set(K.sprintBest, String(sprintBest));
      }
      records.sprints++;
    }
    if (kind === "win") records.aiWins++;
    if (mode === "marathon") {
      records.marathonTime = Math.max(records.marathonTime, Math.floor(gameTime / 1000));
    }

    records.maxScore = Math.max(records.maxScore, score);
    records.maxLines = Math.max(records.maxLines, lines);
    records.maxLevel = Math.max(records.maxLevel, level);

    saveRecords();
    checkAchievements();
    updateHUD();
    updateRace();
    draw();

    let title;
    let msg;

    if (kind === "sprint") {
      title = "Sprint Complete!";
      msg = `40 lines in ${formatTime(gameTime)}${isRecord ? " · 🏆 New Best!" : ""}.`;
      sfx("win");
    } else if (kind === "win") {
      title = "You Win!";
      msg = extra || `You reached 40 lines first. Score ${score}${isRecord ? " · 🏆 New Best!" : ""}.`;
      sfx("win");
    } else if (kind === "rival") {
      title = "Rival Wins";
      msg = extra || `The rival reached 40 lines first. You had ${lines}/40.`;
      sfx("over");
    } else if (mode === "sprint") {
      title = "Sprint Failed";
      msg = `${lines}/40 lines in ${formatTime(gameTime)}.`;
      sfx("over");
    } else {
      title = "Game Over";
      msg = `Score ${score} · ${lines} lines · ${formatTime(gameTime)}${isRecord ? " · 🏆 New Best!" : ""}.`;
      sfx("over");
    }

    overlay.show(title, msg, [
      {
        label: "Play Again",
        onClick: () => {
          hideOverlay();
          reset();
        },
      },
      {
        label: "Badges",
        ghost: true,
        onClick: () => {
          openAchv();
        },
      },
      {
        label: "Change Mode",
        ghost: true,
        onClick: () => {
          hideOverlay();
          const chip = document.querySelector(".mode-chip");
          if (chip) chip.focus();
        },
      },
    ]);
  }

  // ---------- Update ----------
  function updatePlayer(dt) {
    if (!current) return;
    const grounded = collides({ ...current, y: current.y + 1 }, grid);
    if (grounded) {
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY) lockPiece();
    } else {
      lockTimer = 0;
      dropAcc += dt;
      if (dropAcc >= dropInterval) {
        dropAcc = 0;
        tryMove(0, 1);
      }
    }
  }

  function updatePerSecond() {
    const sec = Math.floor(gameTime / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      if (mode === "marathon") {
        records.marathonTime = Math.max(records.marathonTime, sec);
      }
      saveRecords();
      checkAchievements();
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;

    if (!gameOver && !paused) {
      if (!started) {
        countdown = Math.max(0, countdown - dt);
        if (countdown === 0) startPlay();
      } else {
        gameTime += dt;
        updatePlayer(dt);
        if (mode === "ai" && !gameOver) updateAI();
        if (!gameOver) updatePerSecond();
      }
    }

    updateEffects(dt);
    updateTimeDisplay();
    draw();
  }

  // ---------- Input ----------
  function moveLeft() {
    if (gameOver || paused || !current) return;
    if (tryMove(-1, 0)) {
      sfx("move");
      drawBoard();
    }
  }

  function moveRight() {
    if (gameOver || paused || !current) return;
    if (tryMove(1, 0)) {
      sfx("move");
      drawBoard();
    }
  }

  function rotate() {
    if (gameOver || paused || !current) return;
    if (tryRotate()) {
      sfx("rotate");
      drawBoard();
    }
  }

  function bindEvents() {
    modeChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m]) return;
        if (m === mode && !gameOver) return;
        sfx("click");
        setMode(m);
      });
    });

    aiChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.diff;
        if (!AI_DIFFS[d]) return;
        aiDiff = d;
        store.set(K.diff, d);
        updateAiDiffUI();
        sfx("click");
      });
    });

    document.getElementById("restart").addEventListener("click", () => {
      sfx("click");
      reset();
    });

    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    document.getElementById("badges2").addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    achvModal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeAchv);
    });

    // Sound button is wired by Arcade.audio.bindButton above.

    document.querySelectorAll(".touch-controls button").forEach((btn) => {
      const act = btn.dataset.act;
      const action = () => {
        if (act === "left") moveLeft();
        else if (act === "right") moveRight();
        else if (act === "rotate") rotate();
        else if (act === "down") softDrop();
        else if (act === "drop") hardDrop();
        else if (act === "hold") hold();
      };
      const repeat = act === "left" || act === "right" || act === "down";
      let delay = null;
      let interval = null;
      const stop = () => {
        if (delay) clearTimeout(delay);
        if (interval) clearInterval(interval);
        delay = null;
        interval = null;
      };
      const fire = () => {
        if (!gameOver && !paused) action();
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        fire();
        if (repeat && !gameOver && !paused) {
          delay = window.setTimeout(() => {
            interval = window.setInterval(fire, 55);
          }, 180);
        }
      });
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
      btn.addEventListener("click", (e) => {
        if (e.detail === 0) fire();
      });
    });

    document.addEventListener("keydown", (e) => {
      const k = e.key;
      const lower = k.toLowerCase();
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();

      if (!achvModal.hidden) {
        if (k === "Escape") {
          closeAchv();
          e.preventDefault();
        } else if (k === "Tab") {
          const focusable = achvModal.querySelector(".snake-modal__head [data-close]");
          if (focusable) {
            focusable.focus();
            e.preventDefault();
          }
        }
        return;
      }

      if (tag === "button" && (k === " " || k === "Enter")) return;

      if (lower.startsWith("arrow")) e.preventDefault();

      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (gameOver) {
          reset();
          return;
        }
        if (paused) {
          setPaused(false, true);
          return;
        }
        if (!started) {
          startPlay();
          return;
        }
        hardDrop();
        return;
      }

      if (lower === "p") {
        e.preventDefault();
        togglePause();
        return;
      }

      if (lower === "r") {
        e.preventDefault();
        reset();
        return;
      }

      if (k === "Escape") {
        if (paused) setPaused(false, true);
        return;
      }

      if (gameOver || paused) return;

      if (lower === "arrowleft" || lower === "a") {
        moveLeft();
      } else if (lower === "arrowright" || lower === "d") {
        moveRight();
      } else if (lower === "arrowdown" || lower === "s") {
        softDrop();
      } else if (lower === "arrowup" || lower === "x" || lower === "w") {
        rotate();
      } else if (lower === "c" || lower === "shift") {
        hold();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden) setPaused(true, false);
    });

    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden) setPaused(true, false);
    });

    window.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
    window.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = soundCtl.enabled;
    aiDiff = store.get(K.diff, "smart");
    if (!AI_DIFFS[aiDiff]) aiDiff = "smart";

    updateSoundBtn();
    updateBadgeCount();
    updateAiDiffUI();
    bindEvents();

    const savedMode = store.get(K.mode, "marathon");
    setMode(MODES[savedMode] ? savedMode : "marathon");
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  init();
})();