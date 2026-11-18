// Snake — pure vanilla JS, fully offline.
// Modes: Classic, Endless (wrap), Zen (no death), Vs AI (rival snake).
// Features: combos, power-up food, persistent per-mode high scores,
// 19 badges/achievements with progress + toasts, particles, sound, themes.
//
// Shared plumbing (storage, audio, toasts, overlay, badges, modal) comes
// from ../../js/arcade-core.js.
(() => {
  "use strict";

  const Arcade = window.Arcade;
  const { toast, overlay, badges: badgesApi, modal: modalApi, dom } = Arcade;
  const sfxNative = Arcade.audio.sfx;

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const lengthEl = document.getElementById("length");
  const comboEl = document.getElementById("combo");
  const rivalItem = document.getElementById("rival-item");
  const rivalEl = document.getElementById("rival");
  const comboFill = document.getElementById("combo-fill");
  const hintEl = document.getElementById("hint");
  const pauseBtn = document.getElementById("pause");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");
  toast.bind(document.getElementById("toasts"));
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  // ---------- Constants ----------
  const GRID = 20;
  const SIZE = 480;
  const CELL = SIZE / GRID;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const COMBO_WINDOW = 3600; // ms to keep a combo alive
  const MAX_COMBO = 9;
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  canvas.width = Math.round(SIZE * DPR);
  canvas.height = Math.round(SIZE * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const DIRS4 = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const FOOD = {
    apple: { points: 10, color: "#ff5b5b", label: "Apple" },
    golden: { points: 50, color: "#ffb020", label: "Golden apple" },
    ghost: { points: 20, color: "#8be9fd", label: "Ghost berry" },
    slow: { points: 20, color: "#6fb8ff", label: "Slow berry" },
  };

  const MODES = {
    classic: {
      name: "Classic",
      baseStep: 130,
      minStep: 66,
      ramp: true,
      wrap: false,
      selfKill: true,
      ai: false,
      hint: "Walls and your own tail end the run.",
    },
    endless: {
      name: "Endless",
      baseStep: 120,
      minStep: 60,
      ramp: true,
      wrap: true,
      selfKill: true,
      ai: false,
      hint: "Walls wrap around — one life, endless chase.",
    },
    zen: {
      name: "Zen",
      baseStep: 145,
      minStep: 145,
      ramp: false,
      wrap: true,
      selfKill: false,
      ai: false,
      hint: "No walls, no death. Just flow.",
    },
    ai: {
      name: "Vs AI",
      baseStep: 132,
      minStep: 68,
      ramp: true,
      wrap: false,
      selfKill: true,
      ai: true,
      hint: "Race the rival snake for food. Don't hit it.",
    },
  };

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🍎", name: "First Bite", desc: "Eat your first apple.", stat: "totalFood", goal: 1 },
    { id: "snack", icon: "🍏", name: "Snack Attack", desc: "Eat 25 apples across all runs.", stat: "totalFood", goal: 25 },
    { id: "glutton", icon: "🍽️", name: "Bottomless Pit", desc: "Eat 100 apples across all runs.", stat: "totalFood", goal: 100 },
    { id: "combo3", icon: "🔥", name: "On Fire", desc: "Reach a x3 combo.", stat: "maxCombo", goal: 3 },
    { id: "combo5", icon: "⚡", name: "Unstoppable", desc: "Reach a x5 combo.", stat: "maxCombo", goal: 5 },
    { id: "golden", icon: "⭐", name: "Golden Touch", desc: "Eat a golden apple.", stat: "golden", goal: 1 },
    { id: "gold10", icon: "🌟", name: "Midas", desc: "Eat 10 golden apples.", stat: "golden", goal: 10 },
    { id: "ghost", icon: "👻", name: "Phantom", desc: "Eat a ghost berry.", stat: "ghost", goal: 1 },
    { id: "slow", icon: "🐢", name: "Slow Burn", desc: "Eat a slow berry.", stat: "slow", goal: 1 },
    { id: "score1k", icon: "💯", name: "Four Figures", desc: "Score 1,000 in a single run.", stat: "maxScore", goal: 1000 },
    { id: "score25", icon: "👑", name: "High Roller", desc: "Score 2,500 in a single run.", stat: "maxScore", goal: 2500 },
    { id: "time3", icon: "🏃", name: "Marathon", desc: "Survive 3 minutes in one run.", stat: "maxTime", goal: 180 },
    { id: "len30", icon: "🐍", name: "Long Boi", desc: "Grow to 30 segments.", stat: "maxLen", goal: 30 },
    { id: "len50", icon: "🐉", name: "Anaconda", desc: "Grow to 50 segments.", stat: "maxLen", goal: 50 },
    { id: "board", icon: "🧩", name: "Board Hog", desc: "Grow to 100 segments (25% of the board).", stat: "maxLen", goal: 100 },
    { id: "rival", icon: "🤖", name: "Giant Slayer", desc: "Make the AI rival crash 3 times.", stat: "rivalKO", goal: 3 },
    { id: "zen", icon: "☯️", name: "Zen Master", desc: "Score 500 in Zen mode.", stat: "zenScore", goal: 500 },
    { id: "endless", icon: "♾️", name: "Voyager", desc: "Survive 5 minutes in Endless mode.", stat: "endlessTime", goal: 300 },
    { id: "regular", icon: "🎮", name: "Regular", desc: "Start 10 runs.", stat: "totalRuns", goal: 10 },
  ];

  const DEFAULT_RECORDS = {
    totalFood: 0,
    totalRuns: 0,
    maxScore: 0,
    maxLen: 3,
    maxCombo: 1,
    maxTime: 0,
    golden: 0,
    ghost: 0,
    slow: 0,
    rivalKO: 0,
    zenScore: 0,
    endlessTime: 0,
  };

  // ---------- Storage (file:// safe) ----------
  const store = Arcade.store;

  const K = {
    // Legacy keys — kept exactly as they were so existing saves still load.
    best: (mode) => `snake-best-${mode}`,
    stats: "snake-stats-v1",
    achv: "snake-achv-v1",
    sound: "snake-sound",
    mode: "snake-mode",
  };

  const legacyBest = Number(store.get("snake-best", 0)) || 0;

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

  // ---------- Palette (theme aware) ----------
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

  // ---------- Audio ----------
  // Snake's sounds, registered on the shared core so the plumbing (unlock
  // gating, mute persistence, AudioContext lifetime) lives in one place.
  const soundCtl = Arcade.audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });
  let soundOn = soundCtl.enabled;
  let actx = null;

  // "eat" is dynamic (pitch rises with the combo), so it is built per call.
  Arcade.audio.define("golden", [
    [660, 0, 0.09, "triangle", 0.05],
    [880, 0.07, 0.11, "triangle", 0.05],
    [1320, 0.15, 0.16, "triangle", 0.045],
  ]);
  Arcade.audio.define("power", [[300, 0, 0.22, "sine", 0.05, 900]]);
  Arcade.audio.define("rival", [[240, 0, 0.12, "sawtooth", 0.035, 150]]);
  Arcade.audio.define("die", [
    [320, 0, 0.5, "sawtooth", 0.06, 60],
    [160, 0.05, 0.55, "square", 0.04, 40],
  ]);
  Arcade.audio.define("click", [[600, 0, 0.04, "sine", 0.025]]);

  function ensureAudio() {
    Arcade.audio.unlock();
  }

  function sfx(name) {
    if (!soundOn) return;
    if (name === "eat") {
      // Pitch climbs with the combo — a nice touch that a static table can't do.
      const freq = 420 + Math.min(combo, 9) * 55;
      Arcade.audio.define("eat", [[freq, 0, 0.08, "square", 0.035]]);
      Arcade.audio.sfx("eat");
      return;
    }
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
  let mode = "classic";
  let modeCfg = MODES.classic;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let queue = [];
  let food = null;
  let ai = null;
  let score = 0;
  let best = 0;
  let bestAtStart = 0;
  let combo = 1;
  let comboTimer = 0;
  let eaten = 0;
  let runTime = 0;
  let lastSec = 0;
  let running = false;
  let paused = false;
  let over = false;
  let acc = 0;
  let lastTs = 0;
  let nowMs = performance.now();
  let ghostUntil = 0;
  let slowUntil = 0;
  let aiSlowPhase = 0;
  let shake = 0;
  let countdown = 0;
  let particles = [];
  let floaters = [];
  let overlayEl = null;
  let resumeAfterModal = false;
  let pointerStart = null;

  // ---------- Small helpers ----------
  const key = (x, y) => `${x},${y}`;

  function wrapCell(x, y) {
    if (!modeCfg.wrap) return { x, y };
    return { x: (x + GRID) % GRID, y: (y + GRID) % GRID };
  }

  function bodyHas(body, cell) {
    for (const s of body) if (s.x === cell.x && s.y === cell.y) return true;
    return false;
  }

  function ghostActive() {
    return nowMs < ghostUntil;
  }

  function slowActive() {
    return nowMs < slowUntil;
  }

  function bestOf(m) {
    return Number(store.get(K.best(m), 0)) || (m === "classic" ? legacyBest : 0);
  }

  function loadBest() {
    best = bestOf(mode);
    bestEl.textContent = best;
  }

  function currentStep() {
    if (!modeCfg.ramp) return modeCfg.baseStep;
    let step = Math.max(modeCfg.minStep, modeCfg.baseStep - eaten * 2.4);
    if (slowActive()) step *= 1.65;
    return step;
  }

  function saveRecords() {
    store.jsonSet(K.stats, records);
  }

  function updateHUD() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    lengthEl.textContent = snake.length;
    comboEl.textContent = "x" + combo;
    if (rivalItem && !rivalItem.hidden) rivalEl.textContent = ai ? ai.score : 0;
  }

  // ---------- Toasts & achievements UI ----------
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
        ["Classic", bestOf("classic")],
        ["Endless", bestOf("endless")],
        ["Zen", bestOf("zen")],
        ["Vs AI", bestOf("ai")],
        ["Apples", records.totalFood],
        ["Runs", records.totalRuns],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (running && !paused && !over) {
        paused = true;
        resumeAfterModal = true;
        pauseBtn.textContent = "▶ Resume";
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!over) {
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
  // Provided by the shared core.
  const hideOverlay = () => overlay.hide();

  function setPaused(p, silent) {
    if (over || !running) return;
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
    if (over || !running) return;
    setPaused(!paused, false);
  }

  // ---------- Food ----------
  function placeFood(forceType) {
    const blocked = new Set();
    for (const c of snake) blocked.add(key(c.x, c.y));
    if (ai && ai.alive) for (const c of ai.snake) blocked.add(key(c.x, c.y));

    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!blocked.has(key(x, y))) free.push({ x, y });
      }
    }

    if (!free.length) {
      food = null;
      boardCleared();
      return;
    }

    const cell = free[Math.floor(Math.random() * free.length)];
    let type = forceType;
    if (!type) {
      const r = Math.random();
      if (r > 0.9) type = "golden";
      else if (r > 0.8) type = "ghost";
      else if (r > 0.72) type = "slow";
      else type = "apple";
    }

    const now = performance.now();
    food = {
      x: cell.x,
      y: cell.y,
      type,
      born: now,
      expires: type === "apple" ? 0 : now + (type === "golden" ? 9000 : 8000),
    };
  }

  // ---------- AI rival ----------
  function makeAI() {
    const blocked = new Set(snake.map((c) => key(c.x, c.y)));
    if (food) blocked.add(key(food.x, food.y));
    for (let t = 0; t < 60; t++) {
      const y = 2 + Math.floor(Math.random() * (GRID - 4));
      const hx = GRID - 5 - Math.floor(Math.random() * 4);
      const cells = [
        { x: hx, y },
        { x: hx + 1, y },
        { x: hx + 2, y },
        { x: hx + 3, y },
      ];
      if (cells.every((c) => c.x >= 0 && c.x < GRID && !blocked.has(key(c.x, c.y)))) {
        return { snake: cells, dir: { x: -1, y: 0 }, score: 0, alive: true, respawnIn: 0 };
      }
    }
    return {
      snake: [
        { x: GRID - 2, y: 1 },
        { x: GRID - 3, y: 1 },
        { x: GRID - 4, y: 1 },
        { x: GRID - 5, y: 1 },
      ],
      dir: { x: -1, y: 0 },
      score: 0,
      alive: true,
      respawnIn: 0,
    };
  }

  function aiBlocked() {
    const b = new Set();
    for (const c of snake) b.add(key(c.x, c.y));
    if (ai && ai.alive) {
      for (let i = 1; i < ai.snake.length - 1; i++) {
        const c = ai.snake[i];
        b.add(key(c.x, c.y));
      }
    }
    return b;
  }

  function bfsFrom(target, blocked) {
    const dist = new Map();
    const q = [{ x: target.x, y: target.y }];
    dist.set(key(target.x, target.y), 0);
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      const d = dist.get(key(c.x, c.y));
      for (const dd of DIRS4) {
        const n = wrapCell(c.x + dd.x, c.y + dd.y);
        if (n.x < 0 || n.y < 0 || n.x >= GRID || n.y >= GRID) continue;
        const k = key(n.x, n.y);
        if (blocked.has(k) || dist.has(k)) continue;
        dist.set(k, d + 1);
        q.push(n);
      }
    }
    return dist;
  }

  function areaSize(sx, sy, blocked) {
    const seen = new Set([key(sx, sy)]);
    const stack = [{ x: sx, y: sy }];
    let n = 0;
    while (stack.length && n < GRID * GRID) {
      const c = stack.pop();
      n++;
      for (const d of DIRS4) {
        const w = wrapCell(c.x + d.x, c.y + d.y);
        if (w.x < 0 || w.y < 0 || w.x >= GRID || w.y >= GRID) continue;
        const k = key(w.x, w.y);
        if (blocked.has(k) || seen.has(k)) continue;
        seen.add(k);
        stack.push(w);
      }
    }
    return n;
  }

  function aiThink() {
    if (!ai || !ai.alive || !food) return;
    const head = ai.snake[0];
    const blocked = aiBlocked();
    const dist = bfsFrom(food, blocked);
    const rev = { x: -ai.dir.x, y: -ai.dir.y };
    const opts = [];

    for (const d of DIRS4) {
      if (d.x === rev.x && d.y === rev.y) continue;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (blocked.has(key(nx, ny))) continue;
      opts.push({ d, x: nx, y: ny });
    }
    if (!opts.length) return;

    // A small chance to play imperfectly so a human can win the food race.
    if (Math.random() < 0.07) {
      ai.dir = opts[Math.floor(Math.random() * opts.length)].d;
      return;
    }

    let bestOpt = opts[0];
    let bestVal = Infinity;
    for (const o of opts) {
      const k = key(o.x, o.y);
      let val = dist.has(k) ? dist.get(k) : Infinity;
      if (!Number.isFinite(val)) val = 100000 - areaSize(o.x, o.y, blocked);
      val += Math.random() * 0.35;
      if (val < bestVal) {
        bestVal = val;
        bestOpt = o;
      }
    }
    ai.dir = bestOpt.d;
  }

  function tickAI() {
    if (!ai || !ai.alive) return;
    aiThink();

    const head = ai.snake[0];
    const nx = head.x + ai.dir.x;
    const ny = head.y + ai.dir.y;

    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return killAI();
    const willEat = food && nx === food.x && ny === food.y;
    const selfBody = willEat ? ai.snake : ai.snake.slice(0, -1);
    if (bodyHas(selfBody, { x: nx, y: ny })) return killAI();
    if (bodyHas(snake, { x: nx, y: ny })) return killAI();

    ai.snake.unshift({ x: nx, y: ny });
    if (willEat) {
      ai.score += 10;
      burst(food.x, food.y, PAL.danger, 10);
      sfx("rival");
      placeFood();
    } else {
      ai.snake.pop();
    }
  }

  function killAI() {
    if (!ai || !ai.alive) return;
    ai.alive = false;
    ai.respawnIn = 1100;
    records.rivalKO = (records.rivalKO || 0) + 1;
    const h = ai.snake[0];
    burst(h.x, h.y, PAL.danger, 22);
    floater(h.x, h.y, "Rival down!", PAL.danger);
    sfx("rival");
    saveRecords();
    checkAchievements();
  }

  function respawnAI() {
    const blocked = new Set(snake.map((c) => key(c.x, c.y)));
    if (food) blocked.add(key(food.x, food.y));
    for (let t = 0; t < 120; t++) {
      const y = 2 + Math.floor(Math.random() * (GRID - 4));
      const hx = 5 + Math.floor(Math.random() * (GRID - 10));
      const cells = [
        { x: hx, y },
        { x: hx - 1, y },
        { x: hx - 2, y },
        { x: hx - 3, y },
      ];
      if (cells.every((c) => c.x >= 0 && c.x < GRID && !blocked.has(key(c.x, c.y)))) {
        ai.snake = cells;
        ai.dir = { x: 1, y: 0 };
        ai.alive = true;
        return;
      }
    }
    ai.snake = [
      { x: GRID - 2, y: 1 },
      { x: GRID - 3, y: 1 },
      { x: GRID - 4, y: 1 },
      { x: GRID - 5, y: 1 },
    ];
    ai.dir = { x: -1, y: 0 };
    ai.alive = true;
  }

  // ---------- Effects ----------
  function burst(cx, cy, color, n) {
    const count = REDUCE ? Math.min(n, 6) : n;
    const px = cx * CELL + CELL / 2;
    const py = cy * CELL + CELL / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 150;
      const life = 0.45 + Math.random() * 0.45;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        color,
        size: 1.8 + Math.random() * 3,
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function floater(cx, cy, text, color) {
    floaters.push({
      x: cx * CELL + CELL / 2,
      y: cy * CELL + CELL / 2,
      text,
      color,
      life: 0.95,
      max: 0.95,
    });
    if (floaters.length > 30) floaters.shift();
  }

  function updateEffects(dt) {
    const dts = Math.min(dt, 50) / 1000;
    for (const p of particles) {
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 220 * dts;
      p.life -= dts;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floaters) {
      f.life -= dts;
      f.y -= 30 * dts;
    }
    floaters = floaters.filter((f) => f.life > 0);

    if (shake > 0) {
      shake *= Math.pow(0.001, dts);
      if (shake < 0.4) shake = 0;
    }
  }

  // ---------- Game flow ----------
  function reset() {
    hideOverlay();
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    queue = [];
    score = 0;
    combo = 1;
    comboTimer = 0;
    eaten = 0;
    runTime = 0;
    lastSec = 0;
    acc = 0;
    ghostUntil = 0;
    slowUntil = 0;
    aiSlowPhase = 0;
    shake = 0;
    countdown = 2100;
    particles = [];
    floaters = [];
    over = false;
    paused = false;
    running = true;
    resumeAfterModal = false;
    ai = modeCfg.ai ? makeAI() : null;
    food = null;
    placeFood();
    bestAtStart = best;

    records.totalRuns++;
    saveRecords();

    pauseBtn.textContent = "Pause";
    updateHUD();
    comboFill.style.width = "0%";
    checkAchievements();

    nowMs = performance.now();
    lastTs = nowMs;
    draw(nowMs);
  }

  function addScore(base) {
    const mult = combo;
    const gain = base * mult;
    score += gain;
    combo = Math.min(combo + 1, MAX_COMBO);
    comboTimer = COMBO_WINDOW;
    records.maxCombo = Math.max(records.maxCombo, combo);
    records.maxScore = Math.max(records.maxScore, score);
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      store.set(K.best(mode), String(best));
    }
    return gain;
  }

  function eatFood(now) {
    const type = food.type;
    const def = FOOD[type] || FOOD.apple;
    const gained = addScore(def.points);

    records.totalFood++;
    if (type === "golden") records.golden++;
    else if (type === "ghost") records.ghost++;
    else if (type === "slow") records.slow++;
    records.maxLen = Math.max(records.maxLen, snake.length);
    if (mode === "zen") records.zenScore = Math.max(records.zenScore, score);

    burst(food.x, food.y, def.color, type === "golden" ? 22 : 14);
    floater(food.x, food.y, "+" + gained, def.color);
    sfx(type === "golden" ? "golden" : "eat");

    if (type === "ghost") {
      ghostUntil = now + 7000;
      sfx("power");
    } else if (type === "slow") {
      slowUntil = now + 6000;
      sfx("power");
    }

    eaten++;
    placeFood();
    saveRecords();
    checkAchievements();
    updateHUD();
  }

  function tick(now) {
    if (over) return;

    if (queue.length) dir = queue.shift();

    const raw = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const head = modeCfg.wrap ? wrapCell(raw.x, raw.y) : raw;

    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      return die("wall");
    }

    const willEat = food && head.x === food.x && head.y === food.y;

    if (modeCfg.selfKill && !ghostActive()) {
      const body = willEat ? snake : snake.slice(0, -1);
      if (bodyHas(body, head)) return die("self");
    }

    if (ai && ai.alive && bodyHas(ai.snake, head)) return die("rival");

    snake.unshift(head);
    if (willEat) eatFood(now);
    else snake.pop();

    if (over) return;
    if (ai && ai.alive) {
      if (slowActive()) {
        // Time-warp: the rival is slowed along with the player.
        aiSlowPhase = (aiSlowPhase + 1) % 2;
        if (aiSlowPhase === 0) tickAI();
      } else {
        aiSlowPhase = 0;
        tickAI();
      }
    }
    if (over) return;

    if (food && food.expires && now > food.expires) placeFood("apple");

    updateHUD();
  }

  function die(reason) {
    if (over) return;
    over = true;
    running = false;
    const isRecord = score > bestAtStart && score > 0;
    shake = REDUCE ? 0 : 16;
    burst(snake[0].x, snake[0].y, isRecord ? "#ffd23f" : "#ff5b5b", isRecord ? 40 : 26);
    sfx(isRecord ? "golden" : "die");

    records.maxScore = Math.max(records.maxScore, score);
    saveRecords();
    checkAchievements();
    updateHUD();
    draw(nowMs);

    const reasonText =
      reason === "wall"
        ? "You hit the wall."
        : reason === "self"
        ? "You bit your own tail."
        : reason === "rival"
        ? "You ran into the rival."
        : "Run over.";

    overlay.show("Game Over", `${reasonText} Score ${score}${isRecord ? " · 🏆 New Best!" : ""}.`, [
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

  function boardCleared() {
    if (over) return;
    over = true;
    running = false;
    records.maxScore = Math.max(records.maxScore, score);
    records.maxLen = Math.max(records.maxLen, snake.length);
    if (mode === "zen") records.zenScore = Math.max(records.zenScore, score);
    saveRecords();
    checkAchievements();
    sfx("golden");

    const isRecord = score > bestAtStart && score > 0;
    overlay.show("Board Cleared!", `Every cell is filled. Score ${score}${isRecord ? " · 🏆 New Best!" : ""}.`, [
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

  // ---------- Input ----------
  function queueDirection(nx, ny) {
    if (!running || paused || over) return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (nx === -last.x && ny === -last.y) return;
    if (nx === last.x && ny === last.y) return;
    if (queue.length >= 2) queue.shift();
    queue.push({ x: nx, y: ny });
  }

  function setMode(m) {
    if (!MODES[m]) return;
    mode = m;
    modeCfg = MODES[m];
    store.set(K.mode, m);

    document.querySelectorAll(".mode-chip").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false");
    });

    rivalItem.hidden = m !== "ai";

    hintEl.textContent = `${modeCfg.hint} · P to pause`;
    loadBest();
    reset();
  }

  // ---------- Rendering ----------
  function hexToRgb(hex) {
    let h = String(hex).trim().replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return { r: 255, g: 255, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function starPath(cx, cy, spikes, outer, inner) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    for (let i = 0; i < spikes; i++) {
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    }
    ctx.closePath();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = PAL.line;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = i * CELL + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawFood(now) {
    if (!food) return;
    const def = FOOD[food.type] || FOOD.apple;
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    const pulse = REDUCE ? 1 : 1 + Math.sin(now / 210 + food.born * 0.01) * 0.06;
    const r = CELL * (food.type === "golden" ? 0.33 : 0.3) * pulse;

    ctx.save();
    ctx.translate(cx, cy);

    // expiry ring for timed food
    if (food.expires) {
      const total = food.type === "golden" ? 9000 : 8000;
      const remain = Math.max(0, Math.min(1, (food.expires - now) / total));
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain);
      ctx.strokeStyle = rgba(def.color, 0.85);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.shadowColor = def.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = def.color;

    if (food.type === "golden") {
      starPath(0, 0, 5, r * 1.12, r * 0.48);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.3, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.stroke();

      if (food.type === "apple") {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.32, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.ellipse(r * 0.34, -r * 0.92, r * 0.36, r * 0.16, -0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (food.type === "ghost") {
        ctx.fillStyle = "rgba(12, 30, 58, 0.78)";
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.08, r * 0.14, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.08, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, r * 0.3, r * 0.26, 0, Math.PI);
        ctx.fill();
      } else if (food.type === "slow") {
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * -r * 0.58, Math.sin(a) * -r * 0.58);
          ctx.lineTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function drawSnake(segments, d, color, isPlayer) {
    const n = segments.length;
    if (!n) return;
    const ghosted = isPlayer && ghostActive();
    const size = CELL - 2.4;
    const rad = Math.min(8, size * 0.36);

    for (let i = n - 1; i >= 1; i--) {
      const s = segments[i];
      const t = n === 1 ? 0 : i / (n - 1);
      ctx.globalAlpha = ghosted ? 0.38 : 0.95 - 0.5 * t;
      ctx.fillStyle = color;
      roundRect(s.x * CELL + 1.2, s.y * CELL + 1.2, size, size, rad);
      ctx.fill();
    }

    const h = segments[0];
    const hx = h.x * CELL + 1.2;
    const hy = h.y * CELL + 1.2;

    ctx.globalAlpha = ghosted ? 0.55 : 1;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = ghosted ? 6 : 16;
    ctx.fillStyle = color;
    roundRect(hx, hy, size, size, rad);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    const cx = h.x * CELL + CELL / 2;
    const cy = h.y * CELL + CELL / 2;
    const ang = Math.atan2(d.y, d.x);
    const eyeFwd = CELL * 0.17;
    const eyeOff = CELL * 0.19;
    const er = Math.max(1.7, CELL * 0.095);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(eyeFwd, sign * eyeOff, er, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeFwd + er * 0.38, sign * eyeOff, er * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0d16";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    if (!floaters.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 16px 'Segoe UI', system-ui, sans-serif";
    for (const f of floaters) {
      const a = Math.max(0, Math.min(1, (f.life / f.max) * 1.6));
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function draw(ts) {
    if (ts) nowMs = ts;
    ctx.save();
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (shake > 0.4) {
      const s = shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawGrid();
    drawFood(nowMs);
    if (ai && ai.alive) drawSnake(ai.snake, ai.dir, PAL.danger, false);
    drawSnake(snake, dir, PAL.accent, true);
    drawParticles();
    drawFloaters();
    if (countdown > 0 && !paused && !over) drawCountdown();
    ctx.restore();
  }

  function drawCountdown() {
    const label = countdown > 1400 ? "3" : countdown > 700 ? "2" : countdown > 200 ? "1" : "GO!";
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(8, 10, 18, 0.65)";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, CELL * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.accent;
    ctx.shadowColor = PAL.accent;
    ctx.shadowBlur = 20;
    ctx.font = label === "GO!"
      ? "900 46px 'Segoe UI', system-ui, sans-serif"
      : "900 60px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(label, SIZE / 2, SIZE / 2 + 3);
    ctx.restore();
  }

  // ---------- Main loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 120) dt = 120;
    nowMs = ts;

    if (running && !paused && !over) {
      if (countdown > 0) {
        countdown = Math.max(0, countdown - dt);
        comboFill.style.width = "0%";
      } else {
        runTime += dt / 1000;

        if (comboTimer > 0) {
          comboTimer -= dt;
          if (comboTimer <= 0) {
            comboTimer = 0;
            if (combo > 1) {
              combo = 1;
              updateHUD();
            }
          }
        }

        const sec = Math.floor(runTime);
        if (sec !== lastSec) {
          lastSec = sec;
          records.maxTime = Math.max(records.maxTime, sec);
          if (mode === "endless") records.endlessTime = Math.max(records.endlessTime, sec);
          saveRecords();
          checkAchievements();
        }

        if (ai && !ai.alive) {
          ai.respawnIn -= dt;
          if (ai.respawnIn <= 0) respawnAI();
        }

        acc += dt;
        let guard = 0;
        while (acc >= currentStep() && !over && guard++ < 6) {
          acc -= currentStep();
          tick(ts);
        }

        if (combo > 1 && comboTimer > 0) {
          comboFill.style.width = Math.min(100, (comboTimer / COMBO_WINDOW) * 100) + "%";
        } else {
          comboFill.style.width = "0%";
        }
      }
    } else {
      comboFill.style.width = "0%";
    }

    updateEffects(dt);
    draw(ts);
  }

  // ---------- Events ----------
  function bindEvents() {
    document.querySelectorAll(".mode-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m]) return;
        if (m === mode && !over) return;
        sfx("click");
        setMode(m);
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

    achvModal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeAchv);
    });

    // Sound button is wired by Arcade.audio.bindButton above.

    document.querySelectorAll(".dpad button").forEach((btn) => {
      const move = () => {
        const d = btn.dataset.dir;
        if (d === "up") queueDirection(0, -1);
        else if (d === "down") queueDirection(0, 1);
        else if (d === "left") queueDirection(-1, 0);
        else if (d === "right") queueDirection(1, 0);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        move();
      });
      // Keyboard activation (Enter/Space) also works on the D-pad.
      btn.addEventListener("click", move);
    });

    document.addEventListener("keydown", (e) => {
      const k = e.key;
      const lower = k.toLowerCase();
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();

      // The badges dialog owns the keyboard while it is open.
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

      if (lower === "arrowup" || lower === "w") {
        queueDirection(0, -1);
        e.preventDefault();
      } else if (lower === "arrowdown" || lower === "s") {
        queueDirection(0, 1);
        e.preventDefault();
      } else if (lower === "arrowleft" || lower === "a") {
        queueDirection(-1, 0);
        e.preventDefault();
      } else if (lower === "arrowright" || lower === "d") {
        queueDirection(1, 0);
        e.preventDefault();
      } else if (lower === "p") {
        togglePause();
        e.preventDefault();
      } else if (k === " " || k === "Enter") {
        if (!achvModal.hidden) return;
        if (countdown > 0 && running && !paused && !over) {
          countdown = 0;
          e.preventDefault();
          return;
        }
        if (over) {
          hideOverlay();
          reset();
          e.preventDefault();
        } else if (paused) {
          setPaused(false, true);
          e.preventDefault();
        }
      } else if (k === "Escape") {
        if (!achvModal.hidden) closeAchv();
        else if (paused) setPaused(false, true);
      }
    });

    canvas.addEventListener("pointerdown", (e) => {
      pointerStart = { x: e.clientX, y: e.clientY };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!pointerStart) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? 1 : -1, 0);
      else queueDirection(0, dy > 0 ? 1 : -1);
    });
    canvas.addEventListener("pointercancel", () => {
      pointerStart = null;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !paused && !over) setPaused(true, false);
    });

    window.addEventListener("blur", () => {
      if (running && !paused && !over && achvModal.hidden) setPaused(true, false);
    });

    window.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
    window.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = soundCtl.enabled;
    updateSoundBtn();
    updateBadgeCount();
    bindEvents();

    const savedMode = store.get(K.mode, "classic");
    setMode(MODES[savedMode] ? savedMode : "classic");
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Embedded test hook (also useful for debugging in the console).
  function __ACHV_LIST__() { return achv.list(); }
  window.__T = {
    snap: () => ({
      snake: snake.map((c) => ({ x: c.x, y: c.y })),
      dir: { x: dir.x, y: dir.y },
      food: food ? { x: food.x, y: food.y, type: food.type } : null,
      score, combo, comboTimer, mode, over, running, paused, best,
      countdown: Math.round(countdown),
      ghostActive: ghostActive(), slowActive: slowActive(),
      step: currentStep(),
      records: Object.assign({}, records),
      unlocked: __ACHV_LIST__(),
      ai: ai ? { snake: ai.snake.map((c) => ({ x: c.x, y: c.y })), dir: { x: ai.dir.x, y: ai.dir.y }, score: ai.score, alive: ai.alive } : null,
    }),
    setFood: (x, y, type) => { food = { x, y, type: type || "apple", born: performance.now(), expires: 0 }; },
    setSnake: (arr, d) => { snake = arr.map((c) => ({ x: c.x, y: c.y })); if (d) dir = { x: d.x, y: d.y }; queue = []; },
    setDir: (x, y) => { dir = { x, y }; queue = []; },
    setAI: (arr, d) => { ai = { snake: arr.map((c) => ({ x: c.x, y: c.y })), dir: { x: d.x, y: d.y }, score: 0, alive: true, respawnIn: 0 }; },
    setNow: (ms) => { nowMs = ms; },
    skipCountdown: () => { countdown = 0; },
    tick: (ms) => { nowMs = ms || performance.now(); tick(nowMs); },
    tickAI: (ms) => { nowMs = ms || performance.now(); tickAI(nowMs); },
    respawnAI,
    reset,
    setMode,
    currentStep,
  };

  init();
})();