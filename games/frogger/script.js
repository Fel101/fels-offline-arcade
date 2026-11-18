// Frogger — hop across traffic and a river, fill all five home bays.
// Pure vanilla JS, fully offline.
// Modes: Classic (3 lives + per-frog timer), Time Attack (global countdown),
// Blitz (60s high-speed sprint), Daily (seeded crossing),
// Zen (untimed, infinite lives, slower traffic).
// Features: progressive levels, combos of forward progress, extra lives,
// 25 badges, persistent best scores, daily streaks, particles, sound, themes.
(() => {
  "use strict";

  const Arcade = window.Arcade;
  const { toast, overlay, badges: badgesApi, modal: modalApi, dom } = Arcade;

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const homesEl = document.getElementById("homes");
  const timeEl = document.getElementById("time");
  const timeLabelEl = document.getElementById("time-label");
  const hintEl = document.getElementById("hint");
  const pauseBtn = document.getElementById("pause");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");
  const toastsEl = document.getElementById("toasts");
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  // ---------- Geometry ----------
  const COLS = 13;
  const ROWS = 12;
  const CELL = 38;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const GOAL_ROW = 0;
  const RIVER_ROWS = [1, 2, 3, 4, 5];
  const MEDIAN_ROW = 6;
  const ROAD_ROWS = [7, 8, 9, 10];
  const START_ROW = 11;
  const HOME_COLS = [0, 3, 6, 9, 12];
  const FROG_TIME = 30; // seconds per frog in Classic / Daily
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- Lane configuration ----------
  const RIVER_CFG = [
    { row: 1, dir: 1, speed: 1.05, kind: "log", len: [3, 5], gap: [2, 4] },
    { row: 2, dir: -1, speed: 1.45, kind: "turtle", len: [2, 3], gap: [2, 3] },
    { row: 3, dir: 1, speed: 1.75, kind: "log", len: [2, 4], gap: [2, 4] },
    { row: 4, dir: -1, speed: 1.25, kind: "log", len: [3, 5], gap: [2, 3] },
    { row: 5, dir: 1, speed: 1.95, kind: "turtle", len: [2, 3], gap: [2, 4] },
  ];
  const ROAD_CFG = [
    { row: 7, dir: 1, speed: 1.65, kind: "car", len: [1, 1], gap: [2, 4] },
    { row: 8, dir: -1, speed: 1.05, kind: "truck", len: [2, 2], gap: [3, 5] },
    { row: 9, dir: 1, speed: 2.15, kind: "car", len: [1, 1], gap: [2, 3] },
    { row: 10, dir: -1, speed: 1.35, kind: "car", len: [1, 2], gap: [2, 4] },
  ];
  const CAR_COLORS = ["#ff5b5b", "#ffd23f", "#5ad1b8", "#6fb8ff", "#ff8fc4", "#ffa94d"];
  const MODE_ORDER = ["classic", "attack", "blitz", "daily", "zen"];

  const MODES = {
    classic: {
      name: "Classic",
      lives: 3,
      speed: 1,
      attackTime: 0,
      hint: "Three lives · 30s per frog · fill all five home bays",
    },
    attack: {
      name: "Time Attack",
      lives: 3,
      speed: 1.08,
      attackTime: 120,
      hint: "120s countdown · each home +10s · each level +20s",
    },
    blitz: {
      name: "Blitz",
      lives: 2,
      speed: 1.3,
      attackTime: 60,
      hint: "60s sprint · fast traffic · 2 lives · +10s per home",
    },
    daily: {
      name: "Daily",
      lives: 3,
      speed: 1,
      attackTime: 0,
      hint: "One seeded crossing a day · fill all five homes",
    },
    zen: {
      name: "Zen",
      lives: Infinity,
      speed: 0.7,
      attackTime: 0,
      hint: "No timer · infinite lives · slower traffic",
    },
  };

  const ACHIEVEMENTS = [
    { id: "first_home", icon: "🏠", name: "First Crossing", desc: "Reach your first home bay.", stat: "totalHomes", goal: 1 },
    { id: "home10", icon: "🐸", name: "Getting There", desc: "Reach 10 home bays.", stat: "totalHomes", goal: 10 },
    { id: "home25", icon: "🛣️", name: "Frog Highway", desc: "Reach 25 home bays.", stat: "totalHomes", goal: 25 },
    { id: "home100", icon: "🌍", name: "Migration", desc: "Reach 100 home bays.", stat: "totalHomes", goal: 100 },
    { id: "level2", icon: "🌊", name: "Pond Hopper", desc: "Reach level 2.", stat: "maxLevel", goal: 2 },
    { id: "level3", icon: "🏞️", name: "River Runner", desc: "Reach level 3.", stat: "maxLevel", goal: 3 },
    { id: "level5", icon: "🦸", name: "Highway Hero", desc: "Reach level 5.", stat: "maxLevel", goal: 5 },
    { id: "score1k", icon: "💯", name: "Four Figures", desc: "Score 1,000 in a single run.", stat: "maxScore", goal: 1000 },
    { id: "score5k", icon: "🎰", name: "High Roller", desc: "Score 5,000 in a single run.", stat: "maxScore", goal: 5000 },
    { id: "score10k", icon: "👑", name: "Legend", desc: "Score 10,000 in a single run.", stat: "maxScore", goal: 10000 },
    { id: "speed10", icon: "⚡", name: "Quick Feet", desc: "Reach a home in under 10 seconds.", stat: "fastestHome", goal: 10 },
    { id: "speed5", icon: "🚀", name: "Lightning Frog", desc: "Reach a home in under 5 seconds.", stat: "fastestHome", goal: 5 },
    { id: "flawless", icon: "✨", name: "Flawless", desc: "Clear a level without dying.", stat: "flawlessLevels", goal: 1 },
    { id: "flawless3", icon: "🛡️", name: "Untouchable", desc: "Clear 3 levels without dying.", stat: "flawlessLevels", goal: 3 },
    { id: "extraLife", icon: "❤️", name: "Nine Lives", desc: "Earn an extra life.", stat: "extraLives", goal: 1 },
    { id: "closeCall", icon: "😅", name: "Close Shave", desc: "Reach a home with under 1s left.", stat: "closeCalls", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Against the Clock", desc: "Fill all five homes in Time Attack.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily crossing.", stat: "dailyWins", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen", icon: "🧘", name: "Zen Master", desc: "Score 2,000 in Zen mode.", stat: "zenScore", goal: 2000 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Clear a level between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "runs10", icon: "🎮", name: "Regular", desc: "Start 10 runs.", stat: "totalRuns", goal: 10 },
    { id: "deaths25", icon: "💥", name: "Crash Test", desc: "Lose 25 frogs.", stat: "totalDeaths", goal: 25 },
    { id: "logRider", icon: "🪵", name: "Log Rider", desc: "Travel 100 tiles on logs.", stat: "logDistance", goal: 100 },
  ];



  const DEFAULT_STATS = {
    totalRuns: 0,
    totalHomes: 0,
    totalDeaths: 0,
    maxScore: 0,
    maxLevel: 1,
    fastestHome: 0,
    flawlessLevels: 0,
    extraLives: 0,
    closeCalls: 0,
    attackWins: 0,
    dailyWins: 0,
    zenScore: 0,
    nightWins: 0,
    logDistance: 0,
  };

  // ---------- Storage ----------
  const store = Arcade.store;

  const K = {
    best: (mode) => `frogger-best-v1-${mode}`,
    stats: "frogger-stats-v1",
    achv: "frogger-achv-v1",
    sound: "frogger-sound",
    mode: "frogger-mode",
    daily: "frogger-daily-v1",
  };

  const storedStats = store.json(K.stats, {});
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  let daily = store.json(K.daily, null);
  if (!daily || typeof daily !== "object" || Array.isArray(daily)) daily = { streak: 0, lastDate: "", history: {} };
  if (!daily.history || typeof daily.history !== "object") daily.history = {};
  if (!Number.isFinite(daily.streak)) daily.streak = 0;

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
    };
  }
  let PAL = readPalette();

  const C = {
    grass: "#1f6f3f",
    grassDark: "#185a33",
    water: "#123a6b",
    waterDeep: "#0a2447",
    road: "#24242c",
    roadEdge: "#2c2c36",
    log: "#8a5a2b",
    logDark: "#65401c",
    turtle: "#3fae5a",
    turtleDark: "#2c7d3f",
    frog: "#7ed957",
    frogDark: "#4f9e2f",
    frogBelly: "#c8f0a0",
    home: "#0b2a4a",
  };

  // ---------- Audio ----------
  const soundCtl = Arcade.audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });
  let soundOn = soundCtl.enabled;

  Arcade.audio.define("hop", [
    [420, 0, 0.05, "triangle", 0.03, 620],
  ]);
  Arcade.audio.define("bump", [
    [180, 0, 0.08, "square", 0.025, 140],
  ]);
  Arcade.audio.define("splash", [
    [300, 0, 0.28, "sine", 0.05, 70],
    [520, 0.02, 0.16, "triangle", 0.025, 180],
  ]);
  Arcade.audio.define("hit", [
    [150, 0, 0.32, "sawtooth", 0.06, 50],
    [90, 0.03, 0.3, "square", 0.04, 35],
  ]);
  Arcade.audio.define("home", [
    [523, 0, 0.1, "triangle", 0.045],
    [659, 0.08, 0.1, "triangle", 0.045],
    [784, 0.16, 0.16, "triangle", 0.045],
  ]);
  Arcade.audio.define("level", [
    [523, 0, 0.12, "sine", 0.05],
    [659, 0.1, 0.12, "sine", 0.05],
    [784, 0.2, 0.14, "sine", 0.05],
    [1047, 0.32, 0.24, "sine", 0.045],
  ]);
  Arcade.audio.define("extra", [
    [660, 0, 0.1, "triangle", 0.05],
    [880, 0.09, 0.1, "triangle", 0.05],
    [1100, 0.18, 0.18, "triangle", 0.05],
  ]);
  Arcade.audio.define("win", [
    [523, 0, 0.12, "sine", 0.05],
    [659, 0.1, 0.12, "sine", 0.05],
    [784, 0.2, 0.16, "sine", 0.05],
    [1047, 0.32, 0.3, "sine", 0.045],
  ]);
  Arcade.audio.define("over", [
    [320, 0, 0.5, "sawtooth", 0.055, 60],
  ]);
  Arcade.audio.define("achv", [
    [587, 0, 0.1, "triangle", 0.04],
    [740, 0.09, 0.1, "triangle", 0.04],
    [880, 0.18, 0.16, "triangle", 0.04],
  ]);
  Arcade.audio.define("click", [
    [600, 0, 0.035, "sine", 0.02],
  ]);

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
      `Badges and achievements: ${achv.count()} of ${ACHIEVEMENTS.length} unlocked`
    );
  }

  // ---------- Small helpers ----------
  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function dateStr(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randRange(a, b) {
    return a + state.rng() * (b - a);
  }

  function randInt(a, b) {
    return Math.floor(randRange(a, b + 1));
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Optional haptic tap on supported phones; silently ignored elsewhere.
  function buzz(ms) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {
      /* not supported */
    }
  }

  // Time Attack and Blitz share the global-countdown behaviour.
  function isAttackLike() {
    return state.mode === "attack" || state.mode === "blitz";
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    score: 0,
    level: 1,
    lives: 3,
    speedMul: 1,
    homes: [false, false, false, false, false],
    homeCount: 0,
    deathsThisLevel: 0,
    timeLeft: 0,
    nextExtraLife: 2000,
    over: false,
    won: false,
    paused: false,
    running: true,
    countdown: 0,
    respawnTimer: 0,
    runTime: 0,
    rng: Math.random,
  };

  let best = 0;
  let bestAtStart = 0;
  let lanes = [];
  let laneByRow = {};
  let frog = null;
  let particles = [];
  let floaters = [];
  let ripples = [];
  let shake = 0;
  let flash = 0;
  let lastTs = 0;
  let nowMs = performance.now();
  let lastTimeText = "";
  let resumeAfterModal = false;
  let pointerStart = null;

  // ---------- Lane generation ----------
  function makeLane(cfg) {
    const items = [];
    let x = -randRange(0, 3);
    let guard = 0;
    while (x < COLS + 3 && guard++ < 60) {
      const len = randInt(cfg.len[0], cfg.len[1]);
      items.push({
        x,
        len,
        kind: cfg.kind,
        color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
        bob: randRange(0, Math.PI * 2),
      });
      x += len + randInt(cfg.gap[0], cfg.gap[1]);
    }
    return Object.assign({}, cfg, { items });
  }

  function buildLanes() {
    lanes = [];
    laneByRow = {};
    for (const cfg of RIVER_CFG) {
      const lane = makeLane(cfg);
      lanes.push(lane);
      laneByRow[cfg.row] = lane;
    }
    for (const cfg of ROAD_CFG) {
      const lane = makeLane(cfg);
      lanes.push(lane);
      laneByRow[cfg.row] = lane;
    }
  }

  function updateLanes(dt) {
    // Speeds are tiles per second; the loop feeds milliseconds.
    const dts = dt / 1000;
    for (const lane of lanes) {
      const step = lane.dir * lane.speed * state.speedMul * dts;
      for (const it of lane.items) {
        it.x += step;
        if (lane.dir > 0 && it.x > COLS + 1) {
          it.x = -it.len - randRange(1, 3);
          it.color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
        } else if (lane.dir < 0 && it.x + it.len < -1) {
          it.x = COLS + randRange(1, 3);
          it.color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
        }
      }
    }
  }

  function platformAt(row, x) {
    const lane = laneByRow[row];
    if (!lane) return null;
    const center = x + 0.5;
    for (const it of lane.items) {
      if (center > it.x && center < it.x + it.len) return it;
    }
    return null;
  }

  function vehicleHit(row, x) {
    const lane = laneByRow[row];
    if (!lane) return false;
    const left = x + 0.22;
    const right = x + 0.78;
    for (const it of lane.items) {
      if (right > it.x && left < it.x + it.len) return true;
    }
    return false;
  }

  function homeAtX(x) {
    const center = x + 0.5;
    let bestHome = -1;
    let bestDist = 0.8;
    for (let i = 0; i < HOME_COLS.length; i++) {
      const d = Math.abs(center - (HOME_COLS[i] + 0.5));
      if (d < bestDist) {
        bestDist = d;
        bestHome = i;
      }
    }
    return bestHome;
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  function loadBest() {
    best = Number(store.get(K.best(state.mode), 0)) || 0;
    bestEl.textContent = best;
  }

  function saveBest() {
    if (state.score > best) {
      best = state.score;
      bestEl.textContent = best;
      store.set(K.best(state.mode), String(best));
    }
  }


  // ---------- Achievements ----------
  toast.bind(document.getElementById("toasts"));

  // Time-based badges are "lower is better"; give them a predicate and a
  // progress bar that fills as the time drops.
  const INVERTED_STATS = [];
  if (INVERTED_STATS.length) {
    for (const def of ACHIEVEMENTS) {
      if (!INVERTED_STATS.includes(def.stat)) continue;
      if (typeof def.satisfied === "function") continue;
      def.satisfied = () => {
        const ms = stats[def.stat] || 0;
        return ms > 0 && ms <= def.goal * 1000;
      };
      def.progress = () => {
        const ms = stats[def.stat] || 0;
        if (!ms) return { text: "No solve yet" };
        return { text: "Best " + formatTime(ms) };
      };
    }
  }

  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => {
      if (key === "dailyStreak") return daily.streak;
      if (typeof stats[key] === "number") return stats[key];
      return 0;
    },
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
      records: () => {
        const rows = [
          ["Best", best],
          ["Best level", stats.maxLevel],
          ["Homes", stats.totalHomes],
          ["Daily streak", daily.streak + "d"],
          ["Runs", stats.totalRuns],
          ["Frogs lost", stats.totalDeaths],
        ];
        for (const m of ["attack", "blitz"]) {
          const v = Number(store.get(K.best(m), 0)) || 0;
          if (v > 0) rows.push([MODES[m].name + " best", v]);
        }
        return rows;
      },
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (state.running && !state.paused && !state.over) {
        state.paused = true;
        resumeAfterModal = true;
        pauseBtn.textContent = "▶ Resume";
      }
      const closeBtn = achvModal.querySelector(".snake-modal__head [data-close]");
      if (closeBtn) closeBtn.focus();
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!state.over) {
          state.paused = false;
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
  function showOverlay(title, msg, actions) {
    return overlay.show(title, msg, actions);
  }
  function currentOverlayEl() {
    return overlay.current();
  }

  function focusModeBar() {
    const chip = document.querySelector(".mode-chip");
    if (chip) chip.focus();
  }

  function setPaused(p, silent) {
    if (state.over || !state.running) return;
    state.paused = p;
    pauseBtn.textContent = p ? "▶ Resume" : "Pause";
    if (p && !silent) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); reset(); } },
      ]);
    } else if (!p) {
      hideOverlay();
    }
  }

  function togglePause() {
    if (state.over || !state.running) return;
    setPaused(!state.paused, false);
  }

  // ---------- Effects ----------
  function burst(px, py, color, count) {
    const n = REDUCE ? Math.min(count, 8) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 170;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floater(px, py, text, color) {
    floaters.push({ x: px, y: py, text, color, life: 1.1, max: 1.1 });
  }

  function floaterCenter(text, color) {
    floater(W / 2, H / 2, text, color);
  }

  // Provided by the shared core.
  const confetti = (count) => Arcade.confetti(count === undefined ? 80 : count);

  function updateEffects(dt) {
    const dts = Math.min(dt, 50) / 1000;
    for (const p of particles) {
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 260 * dts;
      p.life -= dts;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floaters) {
      f.life -= dts;
      f.y -= 28 * dts;
    }
    floaters = floaters.filter((f) => f.life > 0);

    for (const r of ripples) {
      r.r += 70 * dts;
      r.life -= dts;
    }
    ripples = ripples.filter((r) => r.life > 0);
    if (flash > 0) flash = Math.max(0, flash - dts * 2.4);

    if (shake > 0) {
      shake *= Math.pow(0.001, dts);
      if (shake < 0.4) shake = 0;
    }
  }

  // ---------- HUD ----------
  function updateTime() {
    let text;
    if (state.mode === "zen") text = "∞";
    else if (isAttackLike()) text = formatTime(state.timeLeft);
    else text = formatTime(frog ? frog.timeLeft : 0);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    let danger = false;
    if (isAttackLike()) danger = state.timeLeft <= 15;
    else if (state.mode === "classic" || state.mode === "daily") danger = !!frog && frog.timeLeft <= 5;
    timeEl.classList.toggle("is-danger", danger);
    timeLabelEl.textContent = isAttackLike() ? "Left" : "Time";
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    bestEl.textContent = best;
    livesEl.textContent = state.mode === "zen" ? "∞" : state.lives;
    levelEl.textContent = state.level;
    homesEl.textContent = `${state.homeCount}/5`;
    updateTime();
  }

  // ---------- Game flow ----------
  function respawnFrog() {
    const timed = state.mode === "classic" || state.mode === "daily";
    frog = {
      x: 6,
      row: START_ROW,
      drawX: 6,
      drawY: START_ROW,
      hop: 0,
      alive: true,
      elapsed: 0,
      maxRow: START_ROW,
      facing: "up",
      timeLeft: timed ? FROG_TIME : 0,
    };
    state.respawnTimer = 0;
    lastTimeText = "";
    updateHUD();
  }

  function reset() {
    hideOverlay();
    state.score = 0;
    state.level = 1;
    state.lives = MODES[state.mode].lives;
    state.speedMul = MODES[state.mode].speed;
    state.homes = [false, false, false, false, false];
    state.homeCount = 0;
    state.deathsThisLevel = 0;
    state.timeLeft = MODES[state.mode].attackTime || 0;
    state.nextExtraLife = 2000;
    state.over = false;
    state.won = false;
    state.paused = false;
    state.running = true;
    state.countdown = 2100;
    state.respawnTimer = 0;
    state.runTime = 0;
    state.rng = state.mode === "daily" ? mulberry32(hashSeed("frogger-" + dateStr())) : Math.random;

    particles = [];
    floaters = [];
    ripples = [];
    shake = 0;
    flash = 0;
    lastTimeText = "";
    buildLanes();
    respawnFrog();

    stats.totalRuns++;
    saveStats();
    checkAchievements();

    loadBest();
    bestAtStart = best;
    pauseBtn.textContent = "Pause";
    updateHUD();
    updateTime();
    lastTs = 0;
    draw(performance.now());
  }

  function addScore(n) {
    state.score += n;
    saveBest();
    stats.maxScore = Math.max(stats.maxScore, state.score);
    if (state.mode === "zen") stats.zenScore = Math.max(stats.zenScore, state.score);

    while (state.score >= state.nextExtraLife) {
      state.nextExtraLife += 2000;
      if (state.mode !== "zen") {
        state.lives = Math.min(5, state.lives + 1);
        stats.extraLives++;
        sfx("extra");
        toast.show("Extra Life!", "+1 life", "❤️");
      }
    }
    updateHUD();
    saveStats();
  }

  function reachHome() {
    const hi = homeAtX(frog.x);
    if (hi === -1) {
      die("water");
      return;
    }
    if (state.homes[hi]) {
      // Should be blocked by move(), but stay safe.
      frog.row = 1;
      return;
    }

    state.homes[hi] = true;
    state.homeCount++;
    stats.totalHomes++;

    const timeBonus = 50 + Math.round(Math.max(0, frog.timeLeft) * 2);
    addScore(timeBonus);
    floater(HOME_COLS[hi] * CELL + CELL / 2, CELL * 0.5, "+" + timeBonus, PAL.accent2);

    const t = frog.elapsed;
    if (t > 0 && (!stats.fastestHome || t < stats.fastestHome)) stats.fastestHome = t;
    if ((state.mode === "classic" || state.mode === "daily") && frog.timeLeft < 1) stats.closeCalls++;
    if (isAttackLike()) state.timeLeft += 10;

    sfx("home");
    flash = Math.max(flash, 0.45);
    buzz(18);
    const px = HOME_COLS[hi] * CELL + CELL / 2;
    burst(px, CELL * 0.5, PAL.accent2, 20);

    saveStats();
    checkAchievements();
    updateHUD();

    if (state.homeCount >= 5) {
      if (state.mode === "daily") dailyComplete();
      else levelComplete();
    } else {
      respawnFrog();
    }
  }

  function levelComplete() {
    const bonus = 200 * state.level;
    addScore(bonus);
    stats.maxLevel = Math.max(stats.maxLevel, state.level + 1);
    if (state.deathsThisLevel === 0) stats.flawlessLevels++;
    if (new Date().getHours() < 5) stats.nightWins++;
    if (state.mode === "attack") stats.attackWins++;

    state.level++;
    state.speedMul = MODES[state.mode].speed + (state.level - 1) * 0.14;
    state.homes = [false, false, false, false, false];
    state.homeCount = 0;
    state.deathsThisLevel = 0;
    if (isAttackLike()) state.timeLeft += 20;

    sfx("level");
    flash = 1;
    buzz(40);
    confetti();
    floaterCenter("Level " + state.level + "!", PAL.accent2);
    saveStats();
    checkAchievements();
    updateHUD();
    respawnFrog();
  }

  function die(reason) {
    if (!frog || !frog.alive || state.over) return;
    frog.alive = false;
    state.deathsThisLevel++;
    stats.totalDeaths++;

    const px = frog.drawX * CELL + CELL / 2;
    const py = frog.drawY * CELL + CELL * 0.55;
    const water = reason === "water" || reason === "swept";
    burst(px, py, water ? "#5ab0ff" : "#ff7b3d", 28);
    sfx(water ? "splash" : "hit");
    if (!REDUCE) shake = 14;
    flash = Math.max(flash, water ? 0.35 : 0.5);
    buzz(water ? 15 : 30);
    if (water) {
      for (let k = 0; k < 3; k++) {
        const life = 0.55 + k * 0.16;
        ripples.push({ x: px, y: py, r: 5 + k * 5, life, max: life });
      }
    }

    if (state.mode !== "zen") {
      state.lives--;
      if (state.lives <= 0) {
        updateHUD();
        saveStats();
        checkAchievements();
        gameOver(reason);
        return;
      }
    }

    state.respawnTimer = 800;
    saveStats();
    checkAchievements();
    updateHUD();
  }

  function gameOver(reason) {
    if (state.over) return;
    state.over = true;
    state.won = false;
    state.running = false;
    stats.maxScore = Math.max(stats.maxScore, state.score);
    stats.maxLevel = Math.max(stats.maxLevel, state.level);
    saveStats();
    saveBest();
    checkAchievements();
    sfx("over");
    updateHUD();

    const isRecord = state.score > bestAtStart && state.score > 0;
    const title = reason === "time" ? "Time's Up! ⏱" : "Game Over";
    const msg =
      reason === "time"
        ? `The clock ran out on level ${state.level} · Score ${state.score}${isRecord ? " · 🏆 New Best!" : ""}`
        : `No lives left on level ${state.level} · Score ${state.score}${isRecord ? " · 🏆 New Best!" : ""}`;

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); reset(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function recordDailyWin() {
    const today = dateStr();
    if (daily.lastDate === today) return;
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { s: state.score, t: Math.round(state.runTime) };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailyWins++;
    store.jsonSet(K.daily, daily);
  }

  function dailyComplete() {
    if (state.over) return;
    state.over = true;
    state.won = true;
    state.running = false;
    stats.maxScore = Math.max(stats.maxScore, state.score);
    recordDailyWin();
    saveStats();
    saveBest();
    checkAchievements();
    sfx("win");
    confetti();
    updateHUD();

    const isRecord = state.score > bestAtStart && state.score > 0;
    showOverlay(
      "Daily Complete! 🎉",
      `All five homes filled · ${formatTime(state.runTime)} · Score ${state.score}${isRecord ? " · 🏆 New Best!" : ""}`,
      [
        { label: "Play Again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
        { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
      ]
    );
  }

  // ---------- Movement ----------
  function canMove() {
    return (
      state.running &&
      !state.paused &&
      !state.over &&
      state.countdown <= 0 &&
      state.respawnTimer <= 0 &&
      !!frog &&
      frog.alive
    );
  }

  function move(dx, drow) {
    if (!canMove()) return;
    let nx = frog.x + dx;
    let nr = frog.row + drow;
    if (nr < GOAL_ROW) nr = GOAL_ROW;
    if (nr > START_ROW) nr = START_ROW;
    if (nx < 0) nx = 0;
    if (nx > COLS - 1) nx = COLS - 1;
    if (nx === frog.x && nr === frog.row) return;

    if (nr === GOAL_ROW) {
      const hi = homeAtX(nx);
      if (hi === -1 || state.homes[hi]) {
        sfx("bump");
        return;
      }
    }

    frog.x = nx;
    frog.row = nr;
    frog.hop = 1;
    if (drow < 0) frog.facing = "up";
    else if (drow > 0) frog.facing = "down";
    else if (dx < 0) frog.facing = "left";
    else if (dx > 0) frog.facing = "right";
    sfx("hop");

    // A little dust/spray kick-up behind each hop.
    const px = nx * CELL + CELL / 2;
    const py = nr * CELL + CELL * 0.85;
    const inWater = nr >= 1 && nr <= 5;
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 70,
        vy: -Math.random() * 35,
        life: 0.22 + Math.random() * 0.2,
        max: 0.42,
        color: inWater ? "rgba(180,225,255,0.7)" : "rgba(215,230,195,0.7)",
        size: 1.4 + Math.random() * 2,
      });
    }

    if (nr < frog.maxRow) {
      frog.maxRow = nr;
      addScore(10);
    }

    if (nr === GOAL_ROW) reachHome();
  }

  // ---------- Update ----------
  function updateTimers(dt) {
    const dts = dt / 1000;
    if (isAttackLike()) {
      state.timeLeft -= dts;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateHUD();
        gameOver("time");
        return;
      }
    }
    if (frog && frog.alive) {
      frog.elapsed += dts;
      if (state.mode === "classic" || state.mode === "daily") {
        frog.timeLeft -= dts;
        if (frog.timeLeft <= 0) {
          frog.timeLeft = 0;
          updateHUD();
          die("time");
          return;
        }
      }
    }
    updateTime();
  }

  function updateFrog(dt) {
    if (!frog) return;
    const dts = dt / 1000;

    if (state.respawnTimer > 0) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) {
        state.respawnTimer = 0;
        respawnFrog();
      }
      return;
    }
    if (!frog.alive) return;

    const k = Math.min(1, dt * 0.02);
    frog.drawX += (frog.x - frog.drawX) * k;
    frog.drawY += (frog.row - frog.drawY) * k;
    frog.hop = Math.max(0, frog.hop - dt * 0.006);

    if (frog.row >= 1 && frog.row <= 5) {
      const lane = laneByRow[frog.row];
      const p = platformAt(frog.row, frog.x);
      if (!p) {
        die("water");
        return;
      }
      const carry = lane.dir * lane.speed * state.speedMul * dts;
      frog.x += carry;
      stats.logDistance += Math.abs(carry);
      if (frog.x < -0.3 || frog.x > COLS - 0.7) {
        die("swept");
        return;
      }
    }

    if (frog.row >= 7 && frog.row <= 10) {
      if (vehicleHit(frog.row, frog.x)) {
        die("car");
        return;
      }
    }
  }

  // ---------- Drawing ----------
  function lgrad(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    return g;
  }

  function drawGrass(row) {
    const y = row * CELL;
    ctx.fillStyle = lgrad(0, y, 0, y + CELL, [
      [0, row === GOAL_ROW ? "#2b9151" : row === START_ROW ? "#247e47" : C.grass],
      [1, C.grassDark],
    ]);
    ctx.fillRect(0, y, W, CELL);

    // Tufts of grass along the bank edge.
    ctx.strokeStyle = "rgba(140,220,150,0.32)";
    ctx.lineWidth = 1.5;
    for (let x = 2; x < W; x += 13) {
      const h = 3 + ((x * 7 + row * 13) % 6);
      ctx.beginPath();
      ctx.moveTo(x, y + CELL);
      ctx.lineTo(x - 2, y + CELL - h);
      ctx.moveTo(x, y + CELL);
      ctx.lineTo(x + 2, y + CELL - h - 1);
      ctx.stroke();
    }

    // Scattered wildflowers.
    for (let x = 10; x < W; x += 47) {
      const fx = x + ((row * 17) % 13);
      const fy = y + 9 + ((x * 3) % 16);
      const hue = (x + row * 31) % 3;
      ctx.fillStyle = hue === 0 ? "#ffe27a" : hue === 1 ? "#ff9ec4" : "#dbe8ff";
      ctx.beginPath();
      ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,250,215,0.85)";
      ctx.beginPath();
      ctx.arc(fx, fy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWater() {
    const t = nowMs * 0.001;
    ctx.save();
    for (let i = 0; i < RIVER_ROWS.length; i++) {
      const yBase = RIVER_ROWS[i] * CELL;

      // Layered moving wave lines.
      ctx.lineWidth = 2;
      for (let line = 0; line < 3; line++) {
        ctx.strokeStyle = line === 0 ? "rgba(190,230,255,0.20)" : "rgba(140,200,255,0.12)";
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y =
            yBase +
            CELL * (0.26 + line * 0.25) +
            Math.sin(x * 0.045 + t * 1.6 + i * 1.7 + line * 2.3) * (2 + line * 0.6);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Shimmering flecks on the surface.
      for (let k = 0; k < 7; k++) {
        const sx = ((k * 83 + i * 47 + t * (8 + (k % 3) * 5)) % (W + 40)) - 20;
        const sy = yBase + 8 + ((k * 29) % (CELL - 16));
        const a = 0.12 + 0.16 * Math.abs(Math.sin(t * 2 + k + i));
        ctx.fillStyle = `rgba(220,245,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (k % 2), 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny bubbles rising through the depths.
      for (let k = 0; k < 4; k++) {
        const bx = (k * 113 + i * 61) % W;
        const progress = (t * 0.35 + k * 0.27) % 1;
        const by = yBase + CELL - progress * CELL;
        ctx.globalAlpha = 0.28 * (1 - progress);
        ctx.strokeStyle = "#bfe6ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 + (k % 2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawScene() {
    // River: alternating deep-blue bands.
    for (const r of RIVER_ROWS) {
      const y = r * CELL;
      ctx.fillStyle = lgrad(0, y, 0, y + CELL, [
        [0, r % 2 ? "#164a80" : C.water],
        [1, C.waterDeep],
      ]);
      ctx.fillRect(0, y, W, CELL);
    }
    drawWater();

    // Road: shaded asphalt with curbs.
    for (const r of ROAD_ROWS) {
      const y = r * CELL;
      ctx.fillStyle = lgrad(0, y, 0, y + CELL, [
        [0, r % 2 === 0 ? "#292931" : "#22222a"],
        [1, r % 2 === 0 ? "#1e1e26" : "#191920"],
      ]);
      ctx.fillRect(0, y, W, CELL);
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, W, 3);
    ctx.fillRect(0, (ROAD_ROWS[ROAD_ROWS.length - 1] + 1) * CELL - 3, W, 3);

    ctx.strokeStyle = "rgba(235,225,170,0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    for (let r = 7; r < 11; r++) {
      const y = r * CELL;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Manhole covers add a little road texture.
    for (const r of ROAD_ROWS) {
      for (let k = 0; k < 2; k++) {
        const mx = ((k * 211 + r * 73) % (W - 40)) + 20;
        const my = r * CELL + CELL / 2;
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(mx, my, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(180,180,190,0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Grass banks (goal, median, start).
    for (const r of [GOAL_ROW, MEDIAN_ROW, START_ROW]) {
      ctx.fillStyle = C.grass;
      ctx.fillRect(0, r * CELL, W, CELL);
      drawGrass(r);
    }

    // Soft shadows where each bank meets the water or road.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, CELL - 3, W, 3);
    ctx.fillRect(0, MEDIAN_ROW * CELL - 3, W, 3);
    ctx.fillRect(0, START_ROW * CELL - 3, W, 3);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, W, 2);
    ctx.fillRect(0, (RIVER_ROWS[RIVER_ROWS.length - 1] + 1) * CELL, W, 2);
  }

  function drawMiniFrog(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = lgrad(-CELL * 0.2, -CELL * 0.2, CELL * 0.2, CELL * 0.2, [
      [0, "#b6f08a"], [1, C.frogDark],
    ]);
    ctx.beginPath();
    ctx.ellipse(0, 2, CELL * 0.2, CELL * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-CELL * 0.08, -CELL * 0.08, CELL * 0.06, 0, Math.PI * 2);
    ctx.arc(CELL * 0.08, -CELL * 0.08, CELL * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(-CELL * 0.08, -CELL * 0.08, CELL * 0.025, 0, Math.PI * 2);
    ctx.arc(CELL * 0.08, -CELL * 0.08, CELL * 0.025, 0, Math.PI * 2);
    ctx.fill();
    // Content little smile.
    ctx.strokeStyle = "rgba(20,70,30,0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, CELL * 0.05, CELL * 0.06, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawHomes() {
    const t = nowMs * 0.001;
    for (let i = 0; i < HOME_COLS.length; i++) {
      const cx = HOME_COLS[i] * CELL + CELL / 2;
      const cy = CELL * 0.52;
      const filled = state.homes[i];

      // Dark water socket.
      ctx.fillStyle = "rgba(6,26,45,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, CELL * 0.42, CELL * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      // A lily pad with its characteristic notch.
      ctx.fillStyle = filled ? "#3a9c58" : "#2c7e49";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, CELL * 0.38, CELL * 0.32, 0, 0.15, Math.PI * 2 - 0.15);
      ctx.fill();
      ctx.fillStyle = C.grassDark;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx + CELL * 0.36, cy - 1);
      ctx.lineTo(cx + CELL * 0.36, cy + 8);
      ctx.closePath();
      ctx.fill();

      // Glowing ring — pulses gently while the bay is empty.
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.2);
      ctx.strokeStyle = filled ? PAL.accent2 : `rgba(160,230,190,${0.45 + pulse * 0.4})`;
      ctx.lineWidth = filled ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      if (filled) {
        drawMiniFrog(cx, cy);
        ctx.fillStyle = `rgba(255,245,170,${0.5 + 0.5 * Math.sin(t * 5 + i)})`;
        ctx.beginPath();
        ctx.arc(cx + CELL * 0.22, cy - CELL * 0.2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(180,230,255,${0.05 + pulse * 0.07})`;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawLog(it, y) {
    const x = it.x * CELL;
    const w = it.len * CELL;
    const h = CELL * 0.7;
    const yy = y + (CELL - h) / 2;
    ctx.save();

    // Shadow beneath the floating log.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(x + 2, yy + 4, w - 4, h, h / 2);
    ctx.fill();

    // Rounded, shaded timber.
    ctx.fillStyle = lgrad(0, yy, 0, yy + h, [
      [0, "#ac763f"], [0.45, C.log], [1, C.logDark],
    ]);
    roundRect(x + 2, yy, w - 4, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = C.logDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bark grain.
    ctx.strokeStyle = "rgba(70,40,15,0.45)";
    ctx.lineWidth = 1.4;
    for (let i = 1; i < it.len; i++) {
      const lx = x + i * CELL;
      ctx.beginPath();
      ctx.moveTo(lx, yy + 4);
      ctx.lineTo(lx, yy + h - 4);
      ctx.stroke();
    }
    for (let g = 1; g <= 2; g++) {
      ctx.strokeStyle = "rgba(255,220,165,0.20)";
      ctx.beginPath();
      ctx.moveTo(x + 8, yy + 5 + g * 7);
      ctx.lineTo(x + w - 8, yy + 5 + g * 7);
      ctx.stroke();
    }

    // Growth rings at each cut end.
    for (const ex of [x + 7, x + w - 7]) {
      ctx.strokeStyle = "rgba(60,35,12,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(ex, yy + h / 2, 4, h * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ex, yy + h / 2, 2, h * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // A splash of moss.
    ctx.fillStyle = "rgba(110,170,80,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.3, yy + 3, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTurtles(it, y) {
    const t = nowMs * 0.001;
    for (let i = 0; i < it.len; i++) {
      const cx = (it.x + i + 0.5) * CELL;
      const cy = y + CELL * 0.56 + Math.sin(t * 3 + it.bob + i) * 1.8;
      ctx.save();
      ctx.translate(cx, cy);

      // Paddling flippers.
      ctx.fillStyle = C.turtleDark;
      ctx.beginPath();
      ctx.ellipse(-CELL * 0.32, CELL * 0.1 + Math.sin(t * 6 + i) * 2, CELL * 0.11, CELL * 0.06, -0.5, 0, Math.PI * 2);
      ctx.ellipse(CELL * 0.32, CELL * 0.1 - Math.sin(t * 6 + i) * 2, CELL * 0.11, CELL * 0.06, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Shell.
      ctx.fillStyle = lgrad(-CELL * 0.3, -CELL * 0.3, CELL * 0.3, CELL * 0.3, [
        [0, "#63d37e"], [0.5, C.turtle], [1, C.turtleDark],
      ]);
      ctx.beginPath();
      ctx.ellipse(0, 0, CELL * 0.34, CELL * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.turtleDark;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scute pattern.
      ctx.strokeStyle = "rgba(20,80,40,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, CELL * 0.18, CELL * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * CELL * 0.17, Math.sin(a) * CELL * 0.13);
        ctx.lineTo(Math.cos(a) * CELL * 0.31, Math.sin(a) * CELL * 0.25);
        ctx.stroke();
      }

      // Head with an eye.
      const hx = it.dir > 0 ? CELL * 0.38 : -CELL * 0.38;
      ctx.fillStyle = C.turtle;
      ctx.beginPath();
      ctx.arc(hx, -CELL * 0.04, CELL * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.turtleDark;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#101014";
      ctx.beginPath();
      ctx.arc(hx + (it.dir > 0 ? 3 : -3), -CELL * 0.07, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCar(it, y, dir) {
    const x = it.x * CELL;
    const w = it.len * CELL - 6;
    const h = CELL * 0.6;
    const xx = x + 3;
    const yy = y + (CELL - h) / 2;
    const front = dir > 0 ? xx + w : xx;

    ctx.save();
    // Ground shadow.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(xx + 2, yy + 4, w, h, 7);
    ctx.fill();

    // Body with a painted highlight along the roof.
    ctx.fillStyle = lgrad(0, yy, 0, yy + h, [
      [0, "rgba(255,255,255,0.35)"], [0.28, it.color], [1, it.color],
    ]);
    roundRect(xx, yy, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Windshield + a glint.
    ctx.fillStyle = "rgba(190,225,255,0.92)";
    const wx = dir > 0 ? xx + w * 0.56 : xx + w * 0.16;
    roundRect(wx, yy + 3, w * 0.28, h - 6, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(wx + 2, yy + 4, w * 0.1, h - 8, 2);
    ctx.fill();

    // Door seam.
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xx + w * 0.45, yy + 4);
    ctx.lineTo(xx + w * 0.45, yy + h - 3);
    ctx.stroke();

    // Headlights (with a soft glow) and tail lights.
    for (let g = 3; g >= 1; g--) {
      ctx.fillStyle = `rgba(255,245,190,${0.06 * g})`;
      ctx.beginPath();
      ctx.arc(front, yy + h * 0.35, 3 + g * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff3c0";
    ctx.beginPath();
    ctx.arc(front, yy + h * 0.35, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5a4a";
    const back = dir > 0 ? xx : xx + w;
    ctx.fillRect(back - (dir > 0 ? 2 : 0), yy + h * 0.32, 2, 4);

    // Wheels with hubs.
    ctx.fillStyle = "#15151a";
    const wy = yy + h - 1;
    for (const fx of [xx + w * 0.22, xx + w * 0.78]) {
      ctx.beginPath();
      ctx.arc(fx, wy, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(200,205,215,0.7)";
    for (const fx of [xx + w * 0.22, xx + w * 0.78]) {
      ctx.beginPath();
      ctx.arc(fx, wy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTruck(it, y, dir) {
    const x = it.x * CELL;
    const w = it.len * CELL - 6;
    const h = CELL * 0.66;
    const xx = x + 3;
    const yy = y + (CELL - h) / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(xx + 2, yy + 4, w, h, 5);
    ctx.fill();

    // Box trailer with a painted stripe and rivets.
    ctx.fillStyle = lgrad(0, yy, 0, yy + h, [
      [0, "#e2e6ee"], [1, "#aeb4c1"],
    ]);
    roundRect(xx, yy, w * 0.62, h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(70,90,120,0.35)";
    ctx.fillRect(xx + 2, yy + h * 0.55, w * 0.58, 3);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(xx + 6 + k * (w * 0.14), yy + 6, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cab.
    ctx.fillStyle = lgrad(0, yy, 0, yy + h, [
      [0, "rgba(255,255,255,0.3)"], [0.3, it.color], [1, it.color],
    ]);
    const cabX = dir > 0 ? xx + w * 0.62 : xx;
    roundRect(cabX, yy + 2, w * 0.38, h - 2, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.stroke();

    // Cab window.
    ctx.fillStyle = "rgba(190,225,255,0.92)";
    const wx = dir > 0 ? xx + w * 0.81 : xx + w * 0.06;
    roundRect(wx, yy + 5, w * 0.13, h - 11, 2);
    ctx.fill();

    // Headlight glow at the front.
    const front = dir > 0 ? xx + w : xx;
    ctx.fillStyle = "rgba(255,245,190,0.55)";
    ctx.beginPath();
    ctx.arc(front, yy + h * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();

    // Wheels with hubs.
    const wy = yy + h - 1;
    for (const fx of [xx + w * 0.16, xx + w * 0.5, xx + w * 0.84]) {
      ctx.fillStyle = "#15151a";
      ctx.beginPath();
      ctx.arc(fx, wy, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(200,205,215,0.7)";
      ctx.beginPath();
      ctx.arc(fx, wy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLanes() {
    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const it of lane.items) {
        if (it.x > COLS + 1 || it.x + it.len < -1) continue;
        if (lane.kind === "log") drawLog(it, y);
        else if (lane.kind === "turtle") drawTurtles(it, y);
        else if (lane.kind === "truck") drawTruck(it, y, lane.dir);
        else drawCar(it, y, lane.dir);
      }
    }
  }

  function drawFrog() {
    if (!frog || !frog.alive || state.respawnTimer > 0) return;
    const fx = frog.drawX * CELL + CELL / 2;
    const fy = frog.drawY * CELL + CELL * 0.58;
    const hop = frog.hop;
    const t = nowMs * 0.001;
    const facing = frog.facing || "up";
    const rot =
      facing === "left" ? -Math.PI / 2 :
      facing === "right" ? Math.PI / 2 :
      facing === "down" ? Math.PI : 0;
    const blink = t % 4.3 > 4.15;

    ctx.save();
    // Shadow stays flat on the ground while the frog lifts during a hop.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(fx, fy + CELL * 0.24, CELL * (0.3 - hop * 0.05), CELL * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(fx, fy - hop * 6);
    ctx.rotate(rot);
    ctx.scale(1 + hop * 0.1, 1 - hop * 0.08);

    // Back legs with a gentle kick.
    const kick = Math.sin(t * 14) * 2;
    ctx.fillStyle = C.frogDark;
    ctx.beginPath();
    ctx.ellipse(-CELL * 0.3, CELL * 0.18 + kick, CELL * 0.15, CELL * 0.09, -0.5, 0, Math.PI * 2);
    ctx.ellipse(CELL * 0.3, CELL * 0.18 - kick, CELL * 0.15, CELL * 0.09, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Shaded body.
    ctx.fillStyle = lgrad(-CELL * 0.3, -CELL * 0.3, CELL * 0.3, CELL * 0.3, [
      [0, "#b6f08a"], [0.5, C.frog], [1, C.frogDark],
    ]);
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.34, CELL * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,80,30,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Freckles.
    ctx.fillStyle = "rgba(60,130,50,0.35)";
    for (const s of [[-0.15, -0.05, 0.06], [0.16, 0.02, 0.05], [0.02, 0.16, 0.04]]) {
      ctx.beginPath();
      ctx.arc(s[0] * CELL, s[1] * CELL, s[2] * CELL, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pale belly.
    ctx.fillStyle = C.frogBelly;
    ctx.beginPath();
    ctx.ellipse(0, CELL * 0.1, CELL * 0.2, CELL * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bulging eyes with an occasional blink.
    for (const ex of [-CELL * 0.16, CELL * 0.16]) {
      ctx.fillStyle = C.frog;
      ctx.beginPath();
      ctx.arc(ex, -CELL * 0.2, CELL * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(ex, -CELL * 0.21, CELL * 0.095, blink ? CELL * 0.02 : CELL * 0.095, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = "#101014";
        ctx.beginPath();
        ctx.arc(ex, -CELL * 0.2, CELL * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(ex - CELL * 0.02, -CELL * 0.23, CELL * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 18px 'Segoe UI', system-ui, sans-serif";
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRipples() {
    for (const r of ripples) {
      const a = Math.max(0, r.life / r.max);
      ctx.strokeStyle = `rgba(200,235,255,${a * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAmbient() {
    // Fireflies drifting over the two grass banks.
    const t = nowMs * 0.001;
    for (let i = 0; i < 12; i++) {
      const bx = (i * 97 + 31) % W;
      const row = i % 2 ? START_ROW : MEDIAN_ROW;
      const by = row * CELL + 8 + ((i * 13) % (CELL - 16));
      const a = (0.22 + 0.34 * Math.abs(Math.sin(t * 1.3 + i * 1.7))) * (REDUCE ? 0.5 : 1);
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.beginPath();
      ctx.arc(bx + Math.sin(t * 0.7 + i) * 6, by, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCountdown() {
    const label =
      state.countdown > 1400 ? "3" : state.countdown > 700 ? "2" : state.countdown > 200 ? "1" : "GO!";
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(8,12,20,0.65)";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, CELL * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.accent2;
    ctx.shadowColor = PAL.accent2;
    ctx.shadowBlur = 22;
    ctx.font =
      label === "GO!"
        ? "900 44px 'Segoe UI', system-ui, sans-serif"
        : "900 58px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(label, W / 2, H / 2 + 3);
    ctx.restore();
  }

  function draw(ts) {
    if (ts) nowMs = ts;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawScene();
    drawAmbient();
    drawHomes();
    drawLanes();
    drawRipples();
    drawFrog();
    drawParticles();
    drawFloaters();
    drawVignette();
    if (state.countdown > 0 && !state.paused && !state.over) drawCountdown();
    if (flash > 0.02 && !REDUCE) {
      ctx.globalAlpha = Math.min(0.35, flash * 0.35);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---------- Main loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;
    nowMs = ts;

    if (state.running && !state.paused && !state.over) {
      if (state.countdown > 0) {
        state.countdown = Math.max(0, state.countdown - dt);
      } else {
        state.runTime += dt / 1000;
        updateLanes(dt);
        updateFrog(dt);
        if (!state.over) updateTimers(dt);
      }
    }

    updateEffects(dt);
    draw(ts);
  }

  // ---------- Input ----------
  function setMode(m, force) {
    if (!MODES[m]) return;
    const changed = m !== state.mode;
    state.mode = m;
    store.set(K.mode, m);
    document.querySelectorAll(".mode-chip").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false");
    });
    hintEl.textContent = `${MODES[m].hint} · P to pause`;
    loadBest();
    if (changed || force) reset();
  }

  function bindEvents() {
    document.querySelectorAll(".mode-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m] || m === state.mode) return;
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

    document.getElementById("badges2").addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    achvModal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeAchv);
    });

    document.querySelectorAll(".dpad button").forEach((btn) => {
      const go = () => {
        const d = btn.dataset.dir;
        if (d === "up") move(0, -1);
        else if (d === "down") move(0, 1);
        else if (d === "left") move(-1, 0);
        else if (d === "right") move(1, 0);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        go();
      });
      btn.addEventListener("click", go);
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

      // 1-5 switch modes, matching the chip order.
      if (/^[1-5]$/.test(k)) {
        const m = MODE_ORDER[Number(k) - 1];
        if (m && MODES[m] && m !== state.mode) {
          sfx("click");
          setMode(m);
        }
        e.preventDefault();
        return;
      }

      if (lower === "arrowup" || lower === "w") {
        move(0, -1);
        e.preventDefault();
      } else if (lower === "arrowdown" || lower === "s") {
        move(0, 1);
        e.preventDefault();
      } else if (lower === "arrowleft" || lower === "a") {
        move(-1, 0);
        e.preventDefault();
      } else if (lower === "arrowright" || lower === "d") {
        move(1, 0);
        e.preventDefault();
      } else if (lower === "p") {
        togglePause();
        e.preventDefault();
      } else if (k === " " || k === "Enter") {
        if (state.countdown > 0 && state.running && !state.paused && !state.over) {
          state.countdown = 0;
          e.preventDefault();
        } else if (state.over) {
          hideOverlay();
          reset();
          e.preventDefault();
        } else if (state.paused) {
          setPaused(false, true);
          e.preventDefault();
        }
      } else if (k === "Escape") {
        if (state.paused) setPaused(false, true);
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
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
      else move(0, dy > 0 ? 1 : -1);
    });
    canvas.addEventListener("pointercancel", () => {
      pointerStart = null;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.running && !state.paused && !state.over) setPaused(true, false);
    });

    window.addEventListener("blur", () => {
      if (state.running && !state.paused && !state.over && achvModal.hidden) setPaused(true, false);
    });

    window.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
    window.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = store.get(K.sound, "on") !== "off";
    updateSoundBtn();
    updateBadgeCount();
    bindEvents();

    const savedMode = store.get(K.mode, "classic");
    setMode(MODES[savedMode] ? savedMode : "classic", true);
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Embedded test hook (also useful for debugging in the console).
  function __ACHV_LIST__() { return achv.list(); }
  window.__F = {
    state, stats, daily, MODES, MODE_ORDER, ACHIEVEMENTS, HOME_COLS, RIVER_ROWS, ROAD_ROWS,
    COLS, ROWS, CELL, W, H, GOAL_ROW, START_ROW, MEDIAN_ROW,
    get flash() { return flash; },
    ripples: () => ripples.slice(),
    isAttackLike,
    unlocked: () => __ACHV_LIST__,
    getFrog: () => frog,
    setFrog: (f) => { frog = f; },
    getLanes: () => lanes,
    setLanes: (l) => {
      lanes = l;
      laneByRow = {};
      for (const lane of l) laneByRow[lane.row] = lane;
    },
    getBest: () => best,
    setBest: (b) => { best = b; bestEl.textContent = b; },
    snap: () => ({
      mode: state.mode, score: state.score, level: state.level, lives: state.lives,
      speedMul: state.speedMul, homes: state.homes.slice(), homeCount: state.homeCount,
      deathsThisLevel: state.deathsThisLevel, timeLeft: state.timeLeft,
      over: state.over, won: state.won, paused: state.paused, running: state.running,
      countdown: state.countdown, respawnTimer: state.respawnTimer, runTime: state.runTime,
      frog: frog ? {
        x: frog.x, row: frog.row, alive: frog.alive, elapsed: frog.elapsed,
        maxRow: frog.maxRow, timeLeft: frog.timeLeft,
      } : null,
      scoreEl: document.getElementById("score").textContent,
      bestEl: document.getElementById("best").textContent,
      livesEl: document.getElementById("lives").textContent,
      levelEl: document.getElementById("level").textContent,
      homesEl: document.getElementById("homes").textContent,
      timeEl: document.getElementById("time").textContent,
      overlayTitle: overlay ? overlay.info().title : null,
      overlayMsg: overlay ? overlay.info().msg : null,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: __ACHV_LIST__(),
    }),
    reset, setMode, respawnFrog, move, reachHome, levelComplete, die, gameOver,
    dailyComplete, addScore, checkAchievements, saveStats, saveBest, updateHUD,
    updateTime, updateTimers, updateFrog, updateLanes, platformAt, vehicleHit,
    homeAtX, buildLanes, makeLane, draw, loop, formatTime, dateStr, loadBest,
    burst, floater, updateEffects, canMove,
  };

  init();
})();