// Frogger — hop across traffic and a river, fill all five home bays.
// Pure vanilla JS, fully offline.
// Modes: Classic (3 lives + per-frog timer), Time Attack (global countdown),
// Daily (seeded crossing), Zen (untimed, infinite lives, slower traffic).
// Features: progressive levels, combos of forward progress, extra lives,
// 25 badges, persistent best scores, daily streaks, particles, sound, themes.
(() => {
  "use strict";

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

  // ---------- Achievements ----------
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
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage blocked */
      }
    },
    num(key, fallback = 0) {
      const n = Number(this.get(key, fallback));
      return Number.isFinite(n) ? n : fallback;
    },
    json(key, fallback) {
      try {
        const raw = this.get(key, null);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    jsonSet(key, value) {
      this.set(key, JSON.stringify(value));
    },
  };

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

  const storedAchv = store.json(K.achv, []);
  let unlocked = new Set(Array.isArray(storedAchv) ? storedAchv : []);
  unlocked = new Set(Array.from(unlocked).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)));

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
  let soundOn = store.get(K.sound, "on") !== "off";
  let actx = null;

  function ensureAudio() {
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === "suspended") actx.resume();
    } catch {
      actx = null;
    }
  }

  function sfx(name) {
    if (!soundOn) return;
    ensureAudio();
    if (!actx) return;
    try {
      const t = actx.currentTime;
      const note = (freq, start, dur, type = "sine", vol = 0.05, endFreq = null) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t + start);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + start + dur);
        g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(vol, t + start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(g).connect(actx.destination);
        o.start(t + start);
        o.stop(t + start + dur + 0.03);
      };
      switch (name) {
        case "hop":
          note(420, 0, 0.05, "triangle", 0.03, 620);
          break;
        case "bump":
          note(180, 0, 0.08, "square", 0.025, 140);
          break;
        case "splash":
          note(300, 0, 0.28, "sine", 0.05, 70);
          note(520, 0.02, 0.16, "triangle", 0.025, 180);
          break;
        case "hit":
          note(150, 0, 0.32, "sawtooth", 0.06, 50);
          note(90, 0.03, 0.3, "square", 0.04, 35);
          break;
        case "home":
          note(523, 0, 0.1, "triangle", 0.045);
          note(659, 0.08, 0.1, "triangle", 0.045);
          note(784, 0.16, 0.16, "triangle", 0.045);
          break;
        case "level":
          note(523, 0, 0.12, "sine", 0.05);
          note(659, 0.1, 0.12, "sine", 0.05);
          note(784, 0.2, 0.14, "sine", 0.05);
          note(1047, 0.32, 0.24, "sine", 0.045);
          break;
        case "extra":
          note(660, 0, 0.1, "triangle", 0.05);
          note(880, 0.09, 0.1, "triangle", 0.05);
          note(1100, 0.18, 0.18, "triangle", 0.05);
          break;
        case "win":
          note(523, 0, 0.12, "sine", 0.05);
          note(659, 0.1, 0.12, "sine", 0.05);
          note(784, 0.2, 0.16, "sine", 0.05);
          note(1047, 0.32, 0.3, "sine", 0.045);
          break;
        case "over":
          note(320, 0, 0.5, "sawtooth", 0.055, 60);
          break;
        case "achv":
          note(587, 0, 0.1, "triangle", 0.04);
          note(740, 0.09, 0.1, "triangle", 0.04);
          note(880, 0.18, 0.16, "triangle", 0.04);
          break;
        case "click":
          note(600, 0, 0.035, "sine", 0.02);
          break;
        default:
          break;
      }
    } catch {
      /* audio is a nice-to-have */
    }
  }

  function updateSoundBtn() {
    soundIconEl.textContent = soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    const label = soundOn ? "Mute sound" : "Enable sound";
    soundBtn.setAttribute("aria-label", label);
    soundBtn.title = label;
  }

  function updateBadgeCount() {
    badgeCountEl.textContent = unlocked.size;
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${unlocked.size} of ${ACHIEVEMENTS.length} unlocked`
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
  let shake = 0;
  let lastTs = 0;
  let nowMs = performance.now();
  let lastTimeText = "";
  let overlayEl = null;
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
    best = store.num(K.best(state.mode), 0);
    bestEl.textContent = best;
  }

  function saveBest() {
    if (state.score > best) {
      best = state.score;
      bestEl.textContent = best;
      store.set(K.best(state.mode), String(best));
    }
  }

  // ---------- Toasts & achievements ----------
  function showToast(title, desc, icon) {
    const el = document.createElement("div");
    el.className = "snake-toast";
    el.innerHTML =
      `<span class="snake-toast__icon" aria-hidden="true"></span>` +
      `<div class="snake-toast__body"><strong></strong><span></span></div>`;
    el.querySelector(".snake-toast__icon").textContent = icon || "💬";
    el.querySelector("strong").textContent = title;
    el.querySelector("span").textContent = desc || "";
    toastsEl.appendChild(el);
    window.setTimeout(() => el.classList.add("is-out"), 3000);
    window.setTimeout(() => el.remove(), 3450);
  }

  function pushToast(a) {
    showToast(a.name, a.desc, a.icon);
  }

  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      let done = false;
      if (a.stat === "fastestHome") {
        done = stats.fastestHome > 0 && stats.fastestHome <= a.goal;
      } else if (a.stat === "dailyStreak") {
        done = daily.streak >= a.goal;
      } else {
        done = (stats[a.stat] || 0) >= a.goal;
      }
      if (done) {
        unlocked.add(a.id);
        changed = true;
        pushToast(a);
      }
    }
    if (changed) {
      sfx("achv");
      store.jsonSet(K.achv, Array.from(unlocked));
      updateBadgeCount();
      if (!achvModal.hidden) renderAchvGrid();
    }
  }

  function achvCard(a, done, pct, progressText) {
    const isTime = a.stat === "fastestHome";
    const ariaMax = isTime ? 100 : a.goal;
    const ariaNow = isTime ? Math.round(pct) : Math.min(Math.floor(stats[a.stat] || 0), a.goal);
    return (
      `<div class="achv ${done ? "achv--done" : "achv--locked"}">` +
      `<div class="achv__icon" aria-hidden="true">${a.icon}</div>` +
      `<div class="achv__body">` +
      `<div class="achv__name"><span>${a.name}</span>${done ? '<span class="achv__tick" aria-label="Unlocked">✔</span>' : ""}</div>` +
      `<div class="achv__desc">${a.desc}</div>` +
      `<div class="achv__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${ariaMax}" aria-valuenow="${ariaNow}"><span style="width:${pct}%"></span></div>` +
      `<div class="achv__progress">${progressText}</div>` +
      `</div></div>`
    );
  }

  function renderAchvGrid() {
    achvGrid.innerHTML = ACHIEVEMENTS.map((a) => {
      const done = unlocked.has(a.id);
      let pct;
      let progressText;
      if (a.stat === "fastestHome") {
        const v = stats.fastestHome || 0;
        const ok = v > 0 && v <= a.goal;
        pct = v > 0 ? Math.max(0, Math.min(100, (a.goal / v) * 100)) : 0;
        progressText = ok || done ? "Unlocked" : v > 0 ? `Best ${v.toFixed(1)}s` : "No home yet";
        return achvCard(a, done || ok, pct, progressText);
      }
      if (a.stat === "dailyStreak") {
        pct = done ? 100 : Math.min(100, (daily.streak / a.goal) * 100);
        progressText = done ? "Unlocked" : `${daily.streak} / ${a.goal} days`;
        return achvCard(a, done, pct, progressText);
      }
      const raw = stats[a.stat] || 0;
      pct = done ? 100 : Math.max(0, Math.min(100, (raw / a.goal) * 100));
      progressText = done ? "Unlocked" : `${Math.min(Math.floor(raw), a.goal)} / ${a.goal}`;
      return achvCard(a, done, pct, progressText);
    }).join("");

    const records = [
      ["Best", best],
      ["Best level", stats.maxLevel],
      ["Homes", stats.totalHomes],
      ["Daily streak", daily.streak + "d"],
      ["Runs", stats.totalRuns],
      ["Frogs lost", stats.totalDeaths],
    ];
    achvRecordsEl.innerHTML = records
      .map(([label, val]) => `<span>${label} <b>${val}</b></span>`)
      .join("");

    achvCountEl.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  }

  function openAchv() {
    renderAchvGrid();
    achvModal.hidden = false;
    document.body.classList.add("modal-open");
    if (state.running && !state.paused && !state.over) {
      state.paused = true;
      resumeAfterModal = true;
      pauseBtn.textContent = "▶ Resume";
    }
    const closeBtn = achvModal.querySelector(".snake-modal__head [data-close]");
    if (closeBtn) closeBtn.focus();
  }

  function closeAchv() {
    if (achvModal.hidden) return;
    achvModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (resumeAfterModal) {
      resumeAfterModal = false;
      if (!state.over) {
        state.paused = false;
        pauseBtn.textContent = "Pause";
      }
    }
    const focusTarget = overlayEl ? overlayEl.querySelector(".btn") : badgesBtn;
    if (focusTarget) focusTarget.focus();
  }

  // ---------- Overlay ----------
  function hideOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  function showOverlay(title, msg, actions) {
    hideOverlay();
    overlayEl = document.createElement("div");
    overlayEl.className = "overlay";
    overlayEl.dataset.title = title;
    overlayEl.dataset.msg = msg;
    const box = document.createElement("div");
    box.className = "overlay__box";
    box.innerHTML = `<h2></h2><p></p><div class="overlay__actions"></div>`;
    box.querySelector("h2").textContent = title;
    box.querySelector("p").textContent = msg;
    const actionsEl = box.querySelector(".overlay__actions");
    for (const action of actions || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = action.ghost ? "btn btn--ghost" : "btn";
      b.textContent = action.label;
      b.addEventListener("click", action.onClick);
      actionsEl.appendChild(b);
    }
    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);
    const first = overlayEl.querySelector(".btn");
    if (first) first.focus();
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

  function confetti() {
    if (REDUCE) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = [PAL.accent, PAL.accent2, PAL.accent3, PAL.danger, PAL.text];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
      s.style.animationDelay = Math.random() * 0.5 + "s";
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    window.setTimeout(() => wrap.remove(), 4200);
  }

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

    if (shake > 0) {
      shake *= Math.pow(0.001, dts);
      if (shake < 0.4) shake = 0;
    }
  }

  // ---------- HUD ----------
  function updateTime() {
    let text;
    if (state.mode === "zen") text = "∞";
    else if (state.mode === "attack") text = formatTime(state.timeLeft);
    else text = formatTime(frog ? frog.timeLeft : 0);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    let danger = false;
    if (state.mode === "attack") danger = state.timeLeft <= 15;
    else if (state.mode === "classic" || state.mode === "daily") danger = !!frog && frog.timeLeft <= 5;
    timeEl.classList.toggle("is-danger", danger);
    timeLabelEl.textContent = state.mode === "attack" ? "Left" : "Time";
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
    shake = 0;
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
        showToast("Extra Life!", "+1 life", "❤️");
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
    if (state.mode === "attack") state.timeLeft += 10;

    sfx("home");
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
    if (state.mode === "attack") state.timeLeft += 20;

    sfx("level");
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
    sfx("hop");

    if (nr < frog.maxRow) {
      frog.maxRow = nr;
      addScore(10);
    }

    if (nr === GOAL_ROW) reachHome();
  }

  // ---------- Update ----------
  function updateTimers(dt) {
    const dts = dt / 1000;
    if (state.mode === "attack") {
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
  function drawGrass(row) {
    const y = row * CELL;
    ctx.fillStyle = C.grassDark;
    for (let x = 0; x < W; x += 14) {
      const h = 4 + ((x * 7 + row * 13) % 5);
      ctx.fillRect(x + 3, y + CELL - h, 2, h);
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 6; x < W; x += 22) {
      ctx.fillRect(x, y + 4, 8, 2);
    }
  }

  function drawWater() {
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < RIVER_ROWS.length; i++) {
      const yBase = RIVER_ROWS[i] * CELL;
      ctx.strokeStyle = "rgba(140,200,255,0.16)";
      for (let line = 0; line < 2; line++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 10) {
          const y =
            yBase +
            CELL * (0.35 + line * 0.35) +
            Math.sin(x * 0.05 + nowMs * 0.0016 + i * 1.3 + line * 2.1) * 2.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawScene() {
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, 0, W, CELL);
    ctx.fillRect(0, MEDIAN_ROW * CELL, W, CELL);
    ctx.fillRect(0, START_ROW * CELL, W, CELL);
    drawGrass(0);
    drawGrass(MEDIAN_ROW);
    drawGrass(START_ROW);

    for (const r of RIVER_ROWS) {
      const y = r * CELL;
      const g = ctx.createLinearGradient(0, y, 0, y + CELL);
      g.addColorStop(0, C.water);
      g.addColorStop(1, C.waterDeep);
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, CELL);
    }
    drawWater();

    for (const r of ROAD_ROWS) {
      ctx.fillStyle = r % 2 === 0 ? C.road : C.roadEdge;
      ctx.fillRect(0, r * CELL, W, CELL);
    }

    ctx.strokeStyle = "rgba(230,220,160,0.5)";
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

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, W, 3);
    ctx.fillRect(0, (ROAD_ROWS[ROAD_ROWS.length - 1] + 1) * CELL - 3, W, 3);
  }

  function drawMiniFrog(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = C.frog;
    ctx.beginPath();
    ctx.ellipse(0, 2, CELL * 0.2, CELL * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.restore();
  }

  function drawHomes() {
    for (let i = 0; i < HOME_COLS.length; i++) {
      const cx = HOME_COLS[i] * CELL + CELL / 2;
      const cy = CELL * 0.52;
      const filled = state.homes[i];
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = filled ? "rgba(20,60,40,0.9)" : C.home;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = filled ? PAL.accent2 : "rgba(120,200,150,0.55)";
      ctx.stroke();

      if (filled) {
        drawMiniFrog(cx, cy);
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.004 + i * 1.2);
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,230,255,${0.06 + pulse * 0.08})`;
        ctx.fill();
      }
    }
  }

  function drawLog(it, y) {
    const x = it.x * CELL;
    const w = it.len * CELL;
    const h = CELL * 0.68;
    const yy = y + (CELL - h) / 2;
    ctx.save();
    ctx.fillStyle = C.log;
    roundRect(x + 2, yy, w - 4, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = C.logDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = "rgba(80,50,20,0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < it.len; i++) {
      const lx = x + i * CELL;
      ctx.beginPath();
      ctx.moveTo(lx, yy + 4);
      ctx.lineTo(lx, yy + h - 4);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,220,160,0.25)";
    ctx.beginPath();
    ctx.moveTo(x + 8, yy + 5);
    ctx.lineTo(x + w - 8, yy + 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawTurtles(it, y) {
    for (let i = 0; i < it.len; i++) {
      const cx = (it.x + i + 0.5) * CELL;
      const cy = y + CELL * 0.56 + Math.sin(nowMs * 0.003 + it.bob + i) * 1.5;
      ctx.save();
      ctx.translate(cx, cy);

      ctx.fillStyle = C.turtleDark;
      ctx.beginPath();
      ctx.ellipse(-CELL * 0.3, CELL * 0.08, CELL * 0.1, CELL * 0.06, -0.5, 0, Math.PI * 2);
      ctx.ellipse(CELL * 0.3, CELL * 0.08, CELL * 0.1, CELL * 0.06, 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = C.turtle;
      ctx.beginPath();
      ctx.ellipse(0, 0, CELL * 0.34, CELL * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.turtleDark;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, CELL * 0.18, CELL * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = C.turtle;
      ctx.beginPath();
      ctx.arc(CELL * 0.32, -CELL * 0.04, CELL * 0.11, 0, Math.PI * 2);
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

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(xx + 2, yy + 4, w, h, 7);
    ctx.fill();

    ctx.fillStyle = it.color;
    roundRect(xx, yy, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(190,225,255,0.9)";
    const wx = dir > 0 ? xx + w * 0.58 : xx + w * 0.14;
    roundRect(wx, yy + 3, w * 0.28, h - 6, 3);
    ctx.fill();

    ctx.fillStyle = "#15151a";
    const wy = yy + h - 1;
    ctx.beginPath();
    ctx.arc(xx + w * 0.22, wy, 4, 0, Math.PI * 2);
    ctx.arc(xx + w * 0.78, wy, 4, 0, Math.PI * 2);
    ctx.fill();
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

    ctx.fillStyle = "#c9cdd8";
    roundRect(xx, yy, w * 0.62, h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = it.color;
    const cabX = dir > 0 ? xx + w * 0.62 : xx;
    roundRect(cabX, yy + 2, w * 0.38, h - 2, 5);
    ctx.fill();

    ctx.fillStyle = "rgba(190,225,255,0.9)";
    const wx = dir > 0 ? xx + w * 0.82 : xx + w * 0.06;
    roundRect(wx, yy + 5, w * 0.12, h - 10, 2);
    ctx.fill();

    ctx.fillStyle = "#15151a";
    const wy = yy + h - 1;
    ctx.beginPath();
    ctx.arc(xx + w * 0.18, wy, 4, 0, Math.PI * 2);
    ctx.arc(xx + w * 0.5, wy, 4, 0, Math.PI * 2);
    ctx.arc(xx + w * 0.82, wy, 4, 0, Math.PI * 2);
    ctx.fill();
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

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(fx, fy + CELL * 0.24, CELL * 0.3, CELL * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(fx, fy - hop * 5);
    ctx.scale(1 + hop * 0.08, 1 - hop * 0.06);

    ctx.fillStyle = C.frogDark;
    ctx.beginPath();
    ctx.ellipse(-CELL * 0.28, CELL * 0.16, CELL * 0.14, CELL * 0.09, -0.4, 0, Math.PI * 2);
    ctx.ellipse(CELL * 0.28, CELL * 0.16, CELL * 0.14, CELL * 0.09, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = C.frog;
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.34, CELL * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.frogDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = C.frogBelly;
    ctx.beginPath();
    ctx.ellipse(0, CELL * 0.08, CELL * 0.22, CELL * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const ex of [-CELL * 0.16, CELL * 0.16]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, -CELL * 0.2, CELL * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#101014";
      ctx.beginPath();
      ctx.arc(ex, -CELL * 0.19, CELL * 0.055, 0, Math.PI * 2);
      ctx.fill();
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
    drawHomes();
    drawLanes();
    drawFrog();
    drawParticles();
    drawFloaters();
    if (state.countdown > 0 && !state.paused && !state.over) drawCountdown();
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

    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      store.set(K.sound, soundOn ? "on" : "off");
      updateSoundBtn();
      if (soundOn) {
        ensureAudio();
        sfx("click");
      }
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

  init();
})();