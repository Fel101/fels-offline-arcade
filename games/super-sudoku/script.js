// Super Sudoku — five overlapping sudoku cards, pure vanilla JS, fully offline.
// Modes: Classic (relaxed), Time Attack (3 mistakes), Daily Challenge (seeded).
// Features: 4 difficulties, pencil notes, hints, undo/redo, combos,
// per-card progress, 26 badges, persistent best times/scores, daily
// streaks, sound, confetti, and theme-aware styling.
(() => {
  "use strict";

  // ---------- DOM ----------
  const boardEl = document.getElementById("board");
  const countdownEl = document.getElementById("countdown");
  const countdownNumEl = document.getElementById("countdown-num");
  const timeEl = document.getElementById("time");
  const cardsEl = document.getElementById("cards");
  const cellsEl = document.getElementById("cells");
  const mistakesEl = document.getElementById("mistakes");
  const comboEl = document.getElementById("combo");
  const hintsEl = document.getElementById("hints");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");

  const pauseBtn = document.getElementById("pause");
  const notesBtn = document.getElementById("notes-btn");
  const hintBtn = document.getElementById("hint-btn");
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const newGameBtn = document.getElementById("new-game");
  const checkBtn = document.getElementById("check");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");

  const modeChips = Array.from(document.querySelectorAll(".mode-chip"));
  const diffChips = Array.from(document.querySelectorAll(".diff-chip"));
  const diffBar = document.getElementById("difficulty-bar");

  const toastsEl = document.getElementById("toasts");
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  // ---------- Geometry ----------
  // 21x21 lattice with five 9x9 cards in a quincunx. Each card overlaps the
  // centre card on one 3x3 box; the four corners only touch at that box.
  const N = 21;
  const CELL = 40;
  const OFFSETS = [
    [0, 0],    // top-left
    [12, 0],   // top-right
    [6, 6],    // centre
    [0, 12],   // bottom-left
    [12, 12],  // bottom-right
  ];
  const CARD_NAMES = ["Top Left", "Top Right", "Center", "Bottom Left", "Bottom Right"];

  // Cards already counted this run (so undoing/redoing doesn't double count).
  const countedCards = new Set();

  // ---------- Constants ----------
  const DIFFS = {
    easy: { name: "Easy", removes: 80, par: 2400, bonus: 600 },
    medium: { name: "Medium", removes: 120, par: 3600, bonus: 1200 },
    hard: { name: "Hard", removes: 150, par: 4800, bonus: 2000 },
    expert: { name: "Expert", removes: 170, par: 6000, bonus: 3000 },
  };

  const MODES = {
    classic: { name: "Classic", maxMistakes: 0, hints: 3, hint: "Five overlapping cards · 3 hints · no mistake limit" },
    attack: { name: "Time Attack", maxMistakes: 3, hints: 3, hint: "3 mistakes and it's over · beat the clock" },
    daily: { name: "Daily", maxMistakes: 0, hints: 3, hint: "One seeded puzzle a day — build your streak" },
  };

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Card", desc: "Complete a single card.", stat: "cardsCompleted", goal: 1 },
    { id: "half", icon: "🌗", name: "Halfway There", desc: "Complete three cards in one puzzle.", stat: "maxCardsInRun", goal: 3 },
    { id: "four", icon: "🌘", name: "Almost There", desc: "Complete four cards in one puzzle.", stat: "maxCardsInRun", goal: 4 },
    { id: "win", icon: "🏆", name: "Super Solver", desc: "Complete all five cards.", stat: "solves", goal: 1 },
    { id: "easy", icon: "🌱", name: "Easy Peasy", desc: "Solve on Easy.", stat: "solvesEasy", goal: 1 },
    { id: "medium", icon: "🌿", name: "Medium Rare", desc: "Solve on Medium.", stat: "solvesMedium", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Boiled", desc: "Solve on Hard.", stat: "solvesHard", goal: 1 },
    { id: "expert", icon: "💎", name: "Expert Mind", desc: "Solve on Expert.", stat: "solvesExpert", goal: 1 },
    { id: "allDiffs", icon: "🌈", name: "Full Spectrum", desc: "Solve every difficulty.", stat: "diffsSolved", goal: 4 },
    { id: "speed10", icon: "⚡", name: "Speed Demon", desc: "Solve a puzzle in under 10:00.", stat: "bestTime", goal: 600 },
    { id: "speed6", icon: "🚀", name: "Lightning", desc: "Solve a puzzle in under 6:00.", stat: "bestTime", goal: 360 },
    { id: "flawless", icon: "✨", name: "Flawless", desc: "Solve with zero mistakes.", stat: "flawlessSolves", goal: 1 },
    { id: "flawlessHard", icon: "🛡️", name: "Iron Will", desc: "Solve Hard or Expert with zero mistakes.", stat: "flawlessHard", goal: 1 },
    { id: "combo5", icon: "🔗", name: "In the Groove", desc: "Chain 5 correct entries in a row.", stat: "maxCombo", goal: 5 },
    { id: "combo10", icon: "🌊", name: "Unstoppable", desc: "Chain 10 correct entries in a row.", stat: "maxCombo", goal: 10 },
    { id: "combo20", icon: "🌋", name: "On Fire", desc: "Chain 20 correct entries in a row.", stat: "maxCombo", goal: 20 },
    { id: "notes", icon: "✏️", name: "Note Taker", desc: "Pencil in a note.", stat: "noteEntries", goal: 1 },
    { id: "hint", icon: "💡", name: "Hint Master", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "nohint", icon: "🧠", name: "Pure Logic", desc: "Solve without using hints.", stat: "noHintSolves", goal: 1 },
    { id: "undo", icon: "↶", name: "Second Thoughts", desc: "Use undo.", stat: "undos", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Against the Clock", desc: "Win a Time Attack.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily Challenge.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "cells500", icon: "🔢", name: "Sharpshooter", desc: "Place 500 correct cells.", stat: "correctCells", goal: 500 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Solve between midnight and 5 AM.", stat: "nightSolves", goal: 1 },
  ];

  const DEFAULT_STATS = {
    solves: 0,
    cardsCompleted: 0,
    maxCardsInRun: 0,
    correctCells: 0,
    maxCombo: 0,
    hintsUsed: 0,
    noteEntries: 0,
    undos: 0,
    solvesEasy: 0,
    solvesMedium: 0,
    solvesHard: 0,
    solvesExpert: 0,
    flawlessSolves: 0,
    flawlessHard: 0,
    noHintSolves: 0,
    attackWins: 0,
    dailySolves: 0,
    totalTime: 0,
    bestTime: 0,
    nightSolves: 0,
  };

  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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
    best: (mode, diff) => `super-sudoku-best-v1-${mode}-${diff}`,
    stats: "super-sudoku-stats-v1",
    achv: "super-sudoku-achv-v1",
    sound: "super-sudoku-sound",
    mode: "super-sudoku-mode",
    diff: "super-sudoku-diff",
    daily: "super-sudoku-daily-v1",
  };

  const storedStats = store.json(K.stats, {});
  let stats = Object.assign(
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
        case "place":
          note(520, 0, 0.07, "triangle", 0.04);
          note(780, 0.04, 0.06, "triangle", 0.025);
          break;
        case "card":
          note(523, 0, 0.09, "triangle", 0.045);
          note(659, 0.07, 0.09, "triangle", 0.045);
          note(784, 0.14, 0.14, "triangle", 0.045);
          break;
        case "note":
          note(340, 0, 0.05, "sine", 0.03);
          break;
        case "erase":
          note(260, 0, 0.07, "sine", 0.03, 160);
          break;
        case "error":
          note(180, 0, 0.16, "sawtooth", 0.045, 90);
          break;
        case "hint":
          note(440, 0, 0.08, "sine", 0.04);
          note(660, 0.07, 0.1, "sine", 0.04);
          break;
        case "win":
          note(523, 0, 0.12, "sine", 0.05);
          note(659, 0.1, 0.12, "sine", 0.05);
          note(784, 0.2, 0.16, "sine", 0.05);
          note(1047, 0.32, 0.3, "sine", 0.045);
          break;
        case "over":
          note(320, 0, 0.45, "sawtooth", 0.05, 70);
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

  // ---------- Generator ----------
  function emptyGrid() {
    return Array.from({ length: N }, () => new Array(N).fill(0));
  }

  function unitsFor(ox, oy) {
    const u = [];
    for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => [oy + r, ox + c]));
    for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => [oy + r, ox + c]));
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const cells = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push([oy + br * 3 + i, ox + bc * 3 + j]);
        u.push(cells);
      }
    }
    return u;
  }

  const UNITS = [];
  for (const [ox, oy] of OFFSETS) UNITS.push(...unitsFor(ox, oy));

  const CELL_UNITS = Array.from({ length: N }, () => Array.from({ length: N }, () => []));
  UNITS.forEach((cells, ui) => {
    for (const [r, c] of cells) CELL_UNITS[r][c].push(ui);
  });

  const ALL_CELLS = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (CELL_UNITS[r][c].length) ALL_CELLS.push([r, c]);
    }
  }

  function shuffle(a, rand) {
    const r = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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

  function candidates(g, r, c) {
    let used = 0;
    for (const ui of CELL_UNITS[r][c]) {
      for (const [rr, cc] of UNITS[ui]) {
        const v = g[rr][cc];
        if (v) used |= 1 << v;
      }
    }
    const out = [];
    for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) out.push(v);
    return out;
  }

  function findCell(g) {
    let best = null;
    for (const [r, c] of ALL_CELLS) {
      if (g[r][c]) continue;
      const cand = candidates(g, r, c);
      if (cand.length === 0) return { r, c, cand };
      if (!best || cand.length < best.cand.length) {
        best = { r, c, cand };
        if (cand.length === 1) return best;
      }
    }
    return best;
  }

  function fillGrid(g, rand) {
    const cell = findCell(g);
    if (!cell) return true;
    const nums = shuffle(cell.cand.slice(), rand);
    for (const v of nums) {
      g[cell.r][cell.c] = v;
      if (fillGrid(g, rand)) return true;
      g[cell.r][cell.c] = 0;
    }
    return false;
  }

  function countSolutions(g, limit = 2) {
    let count = 0;
    const w = g.map((row) => row.slice());
    function solve() {
      if (count >= limit) return;
      const cell = findCell(w);
      if (!cell) {
        count++;
        return;
      }
      for (const v of cell.cand) {
        w[cell.r][cell.c] = v;
        solve();
        w[cell.r][cell.c] = 0;
        if (count >= limit) return;
      }
    }
    solve();
    return count;
  }

  function generatePuzzle(diffKey, seedStr) {
    const cfg = DIFFS[diffKey] || DIFFS.medium;
    const rand = seedStr ? mulberry32(hashSeed(seedStr)) : Math.random;
    const full = emptyGrid();
    fillGrid(full, rand);
    const p = full.map((r) => r.slice());
    const spots = shuffle(ALL_CELLS.map(([r, c]) => r * N + c), rand);
    let removed = 0;
    for (const idx of spots) {
      if (removed >= cfg.removes) break;
      const r = (idx / N) | 0;
      const c = idx % N;
      const save = p[r][c];
      p[r][c] = 0;
      if (countSolutions(p, 2) === 1) removed++;
      else p[r][c] = save;
    }
    return { solution: full, puzzle: p };
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "medium",
    solution: null,
    puzzle: null,
    given: null,
    values: null,
    notes: null,
    selected: null,
    notesMode: false,
    mistakes: 0,
    hintsLeft: 3,
    hintsUsed: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    history: [],
    future: [],
    elapsed: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    won: false,
    total: 0,
  };

  let cellEls = [];
  let valEls = [];
  let notesEls = [];
  let overlayEl = null;
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";

  // ---------- Helpers ----------
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function maxMistakes() {
    return MODES[state.mode].maxMistakes || 0;
  }

  function canEdit() {
    return state.started && !state.paused && !state.over;
  }

  function formatTime(ms) {
    const total = Math.max(0, ms) / 1000;
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function dateStr(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function cardAt(r, c) {
    for (let i = 0; i < OFFSETS.length; i++) {
      const [ox, oy] = OFFSETS[i];
      if (r >= oy && r < oy + 9 && c >= ox && c < ox + 9) return i;
    }
    return -1;
  }

  function cardsAt(r, c) {
    const out = [];
    for (let i = 0; i < OFFSETS.length; i++) {
      const [ox, oy] = OFFSETS[i];
      if (r >= oy && r < oy + 9 && c >= ox && c < ox + 9) out.push(i);
    }
    return out;
  }

  // A card is complete when every one of its 81 cells matches the solution.
  function cardComplete(i) {
    const [ox, oy] = OFFSETS[i];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.values[oy + r][ox + c] !== state.solution[oy + r][ox + c]) return false;
      }
    }
    return true;
  }

  function completedCards() {
    const out = [];
    for (let i = 0; i < OFFSETS.length; i++) if (cardComplete(i)) out.push(i);
    return out;
  }

  function progress() {
    let filled = 0;
    for (const [r, c] of ALL_CELLS) {
      if (!state.given[r][c] && state.values[r][c] === state.solution[r][c]) filled++;
    }
    return { filled, total: state.total };
  }

  function snapshot() {
    return {
      score: state.score,
      combo: state.combo,
      mistakes: state.mistakes,
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
    };
  }

  function restoreSnapshot(s) {
    state.score = s.score;
    state.combo = s.combo;
    state.mistakes = s.mistakes;
    state.hintsLeft = s.hintsLeft;
    state.hintsUsed = s.hintsUsed;
  }

  function pushHistory(entry) {
    state.history.push(entry);
    if (state.history.length > 400) state.history.shift();
  }

  function diffsSolved() {
    return ["easy", "medium", "hard", "expert"].filter((d) => stats["solves" + cap(d)] > 0).length;
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.t) return "—";
    return formatTime(rec.t);
  }

  // ---------- Toasts ----------
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

  // ---------- Achievements ----------
  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      let done = false;
      if (a.stat === "bestTime") {
        done = stats.bestTime > 0 && stats.bestTime <= a.goal * 1000;
      } else if (a.stat === "diffsSolved") {
        done = diffsSolved() >= a.goal;
      } else if (a.stat === "dailyStreak") {
        done = daily.streak >= a.goal;
      } else {
        done = (stats[a.stat] || 0) >= a.goal;
      }
      if (done) {
        unlocked.add(a.id);
        changed = true;
        showToast(a.name, a.desc, a.icon);
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
    const isTime = a.stat === "bestTime";
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
      if (a.stat === "bestTime") {
        const ms = stats.bestTime || 0;
        const ok = ms > 0 && ms <= a.goal * 1000;
        pct = ms > 0 ? Math.min(100, ((a.goal * 1000) / ms) * 100) : 0;
        progressText = ok || done ? "Unlocked" : ms > 0 ? `Best ${formatTime(ms)}` : "No solve yet";
        return achvCard(a, done || ok, pct, progressText);
      }
      if (a.stat === "diffsSolved") {
        const raw = diffsSolved();
        pct = done ? 100 : Math.min(100, (raw / a.goal) * 100);
        progressText = done ? "Unlocked" : `${raw} / ${a.goal}`;
        return achvCard(a, done, pct, progressText);
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
      ["Best", bestLabel()],
      ["Solved", stats.solves],
      ["Cards", stats.cardsCompleted],
      ["Daily streak", daily.streak + "d"],
      ["Best combo", "x" + (stats.maxCombo || 0)],
      ["Correct cells", stats.correctCells],
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
    if (!state.over && !state.paused && state.started) {
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
    if (state.over || !state.started) return;
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
    if (state.over || !state.started) return;
    setPaused(!state.paused, false);
  }

  // ---------- Board rendering ----------
  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    cellEls = [];
    valEls = [];
    notesEls = [];
    for (let r = 0; r < N; r++) {
      cellEls[r] = [];
      valEls[r] = [];
      notesEls[r] = [];
      for (let c = 0; c < N; c++) {
        if (!CELL_UNITS[r][c].length) {
          const gap = document.createElement("div");
          gap.className = "super-gap";
          gap.setAttribute("aria-hidden", "true");
          boardEl.appendChild(gap);
          cellEls[r][c] = gap;
          valEls[r][c] = null;
          notesEls[r][c] = null;
          continue;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sudoku-cell";
        b.dataset.r = r;
        b.dataset.c = c;
        if (c % 3 === 0 && c !== 0) b.classList.add("box-right");
        if (r % 3 === 0 && r !== 0) b.classList.add("box-bottom");

        const val = document.createElement("span");
        val.className = "sudoku-cell__val";
        const notes = document.createElement("span");
        notes.className = "sudoku-cell__notes";
        for (let n = 1; n <= 9; n++) {
          const s = document.createElement("span");
          s.textContent = n;
          notes.appendChild(s);
        }
        b.appendChild(val);
        b.appendChild(notes);
        b.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(b);
        cellEls[r][c] = b;
        valEls[r][c] = val;
        notesEls[r][c] = notes;
      }
    }
  }

  function unitConflict(r, c, v) {
    for (const ui of CELL_UNITS[r][c]) {
      for (const [rr, cc] of UNITS[ui]) {
        if ((rr !== r || cc !== c) && state.values[rr][cc] === v) return true;
      }
    }
    return false;
  }

  function renderCell(r, c) {
    const el = cellEls[r][c];
    if (!el || !CELL_UNITS[r][c].length) return;
    const v = state.values[r][c];
    const isGiven = state.given[r][c];
    el.classList.toggle("given", isGiven);
    el.classList.toggle("error", !isGiven && v !== 0 && v !== state.solution[r][c]);
    el.classList.toggle("conflict", v !== 0 && unitConflict(r, c, v));

    valEls[r][c].textContent = v || "";

    const notesEl = notesEls[r][c];
    const showNotes = !isGiven && v === 0 && state.notes[r][c].size > 0;
    notesEl.style.display = showNotes ? "grid" : "none";
    if (showNotes) {
      const spans = notesEl.children;
      for (let n = 1; n <= 9; n++) spans[n - 1].classList.toggle("on", state.notes[r][c].has(n));
    }

    el.setAttribute(
      "aria-label",
      `Row ${r + 1}, column ${c + 1}${isGiven ? ", given " + v : v ? ", " + v : ", empty"}`
    );
  }

  function renderAllCells() {
    for (const [r, c] of ALL_CELLS) renderCell(r, c);
  }

  function updateHighlights() {
    const sel = state.selected;
    const sv = sel ? state.values[sel.r][sel.c] : 0;
    for (const [r, c] of ALL_CELLS) {
      const el = cellEls[r][c];
      const isSel = !!sel && r === sel.r && c === sel.c;
      const related = !!sel && !isSel && (r === sel.r || c === sel.c);
      el.classList.toggle("selected", isSel);
      el.classList.toggle("related", related);
      el.classList.toggle("same", !!sel && sv !== 0 && state.values[r][c] === sv && !isSel);
    }
  }

  function selectCell(r, c) {
    state.selected = { r, c };
    updateHighlights();
    const el = cellEls[r][c];
    if (el) el.focus({ preventScroll: true });
  }

  function moveSelection(dr, dc) {
    if (!state.selected) {
      selectCell(10, 10);
      return;
    }
    const r = Math.min(N - 1, Math.max(0, state.selected.r + dr));
    const c = Math.min(N - 1, Math.max(0, state.selected.c + dc));
    if (!CELL_UNITS[r][c].length) return;
    selectCell(r, c);
  }

  function shakeCell(r, c) {
    if (REDUCE) return;
    const el = cellEls[r][c];
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function shakeBoard() {
    if (REDUCE) return;
    boardEl.classList.remove("shake");
    void boardEl.offsetWidth;
    boardEl.classList.add("shake");
  }

  function flashCell(r, c) {
    if (REDUCE) return;
    const el = cellEls[r][c];
    if (!el) return;
    el.classList.remove("hint-flash");
    void el.offsetWidth;
    el.classList.add("hint-flash");
  }

  // ---------- Input actions ----------
  function clearPeerNotes(r, c, v) {
    const cleared = [];
    const rem = (rr, cc) => {
      if (state.notes[rr][cc].delete(v)) cleared.push({ r: rr, c: cc, n: v });
    };
    for (const ui of CELL_UNITS[r][c]) {
      for (const [rr, cc] of UNITS[ui]) rem(rr, cc);
    }
    return cleared;
  }

  function setCellValue(r, c, v, kind) {
    const prevV = state.values[r][c];
    if (prevV === v) {
      shakeCell(r, c);
      return;
    }
    const prevNotes = [...state.notes[r][c]];
    const prevSnap = snapshot();

    state.values[r][c] = v;
    state.notes[r][c].clear();
    const cleared = v !== 0 ? clearPeerNotes(r, c, v) : [];

    if (v === 0) {
      sfx("erase");
    } else if (v === state.solution[r][c]) {
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += 10 + Math.min(state.combo, 10) * 2;
      stats.correctCells++;
      sfx("place");
    } else {
      state.combo = 0;
      state.score = Math.max(0, state.score - 25);
      state.mistakes++;
      sfx("error");
      shakeBoard();
    }

    pushHistory({
      r, c, prevV, prevNotes,
      nextV: v, nextNotes: [], cleared,
      prevSnap, nextSnap: snapshot(), kind,
    });
    state.future = [];
    afterChange();

    if (v !== 0 && v !== state.solution[r][c] && maxMistakes() && state.mistakes >= maxMistakes()) {
      const p = progress();
      lose(
        "Out of Mistakes",
        `Three strikes — ${p.filled} of ${p.total} cells filled, ${completedCards().length}/5 cards done.`
      );
    }
  }

  function eraseCell(r, c) {
    if (!canEdit()) return;
    if (state.given[r][c]) return;
    if (state.values[r][c] === 0 && state.notes[r][c].size === 0) return;
    const prevV = state.values[r][c];
    const prevNotes = [...state.notes[r][c]];
    const prevSnap = snapshot();
    state.values[r][c] = 0;
    state.notes[r][c].clear();
    pushHistory({
      r, c, prevV, prevNotes,
      nextV: 0, nextNotes: [], cleared: [],
      prevSnap, nextSnap: snapshot(), kind: "erase",
    });
    state.future = [];
    sfx("erase");
    afterChange();
  }

  function toggleNote(r, c, n) {
    if (state.values[r][c] !== 0) return;
    const prevNotes = [...state.notes[r][c]];
    const prevSnap = snapshot();
    if (state.notes[r][c].has(n)) {
      state.notes[r][c].delete(n);
    } else {
      state.notes[r][c].add(n);
      stats.noteEntries++;
    }
    pushHistory({
      r, c, prevV: 0, prevNotes,
      nextV: 0, nextNotes: [...state.notes[r][c]],
      cleared: [], prevSnap, nextSnap: snapshot(), kind: "note",
    });
    state.future = [];
    sfx("note");
    afterChange();
  }

  function placeNumber(n) {
    if (!canEdit()) return;
    if (!state.selected) {
      showToast("Pick a cell first", "Click any empty square, then enter a number.", "👆");
      sfx("click");
      return;
    }
    const { r, c } = state.selected;
    if (state.given[r][c]) {
      shakeCell(r, c);
      return;
    }
    if (n === 0) {
      eraseCell(r, c);
      return;
    }
    if (state.notesMode) {
      toggleNote(r, c, n);
      return;
    }
    setCellValue(r, c, n, "place");
  }

  function undo() {
    if (!canEdit()) return;
    const e = state.history.pop();
    if (!e) {
      showToast("Nothing to undo", "Every move so far is still ahead of you.", "↶");
      return;
    }
    state.future.push(e);
    restoreSnapshot(e.prevSnap);
    state.values[e.r][e.c] = e.prevV;
    state.notes[e.r][e.c] = new Set(e.prevNotes);
    for (const cl of e.cleared) state.notes[cl.r][cl.c].add(cl.n);
    stats.undos++;
    sfx("click");
    afterChange();
  }

  function redo() {
    if (!canEdit()) return;
    const e = state.future.pop();
    if (!e) {
      showToast("Nothing to redo", "You're at the latest move.", "↷");
      return;
    }
    state.history.push(e);
    restoreSnapshot(e.nextSnap);
    state.values[e.r][e.c] = e.nextV;
    state.notes[e.r][e.c] = new Set(e.nextNotes);
    for (const cl of e.cleared) state.notes[cl.r][cl.c].delete(cl.n);
    sfx("click");
    afterChange();
  }

  function useHint() {
    if (!canEdit()) return;
    if (state.hintsLeft <= 0) {
      showToast("No hints left", "You've used all three hints.", "💡");
      return;
    }
    let target = state.selected;
    if (
      !target ||
      state.given[target.r][target.c] ||
      state.values[target.r][target.c] === state.solution[target.r][target.c]
    ) {
      const opts = [];
      for (const [r, c] of ALL_CELLS) {
        if (!state.given[r][c] && state.values[r][c] !== state.solution[r][c]) opts.push({ r, c });
      }
      if (!opts.length) return;
      target = opts[(Math.random() * opts.length) | 0];
    }
    const { r, c } = target;
    const prevV = state.values[r][c];
    const prevNotes = [...state.notes[r][c]];
    const prevSnap = snapshot();
    const cleared = clearPeerNotes(r, c, state.solution[r][c]);
    state.values[r][c] = state.solution[r][c];
    state.notes[r][c].clear();
    state.hintsLeft--;
    state.hintsUsed++;
    stats.hintsUsed++;
    state.combo = 0;
    state.score = Math.max(0, state.score - 50);
    pushHistory({
      r, c, prevV, prevNotes,
      nextV: state.values[r][c], nextNotes: [],
      cleared, prevSnap, nextSnap: snapshot(), kind: "hint",
    });
    state.future = [];
    selectCell(r, c);
    flashCell(r, c);
    sfx("hint");
    afterChange();
  }

  function toggleNotes() {
    state.notesMode = !state.notesMode;
    notesBtn.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    sfx("click");
    showToast(
      state.notesMode ? "Notes on" : "Notes off",
      state.notesMode ? "Number taps now pencil-mark candidates." : "Number taps place answers again.",
      "✏️"
    );
  }

  function checkBoard() {
    if (!canEdit()) return;
    let errors = 0;
    let empty = 0;
    for (const [r, c] of ALL_CELLS) {
      const v = state.values[r][c];
      if (v === 0) empty++;
      else if (v !== state.solution[r][c]) errors++;
    }
    if (errors === 0 && empty === 0) {
      checkWin();
      return;
    }
    if (errors === 0) {
      showToast("Looking good", `No mistakes so far — ${empty} cell${empty === 1 ? "" : "s"} to go.`, "✅");
      sfx("click");
    } else {
      showToast(`${errors} mistake${errors === 1 ? "" : "s"}`, "Those red cells don't match the solution.", "🚨");
      sfx("error");
    }
  }

  function afterChange() {
    renderAllCells();
    updateHighlights();
    updateHUD();

    const done = completedCards();
    let newlyDone = 0;
    for (const i of done) {
      if (!countedCards.has(i)) {
        countedCards.add(i);
        stats.cardsCompleted++;
        newlyDone++;
      }
    }
    if (newlyDone > 0) {
      stats.maxCardsInRun = Math.max(stats.maxCardsInRun, done.length);
      sfx("card");
      if (done.length < 5) {
        showToast(`Card ${done.length}/5 complete`, CARD_NAMES[done[done.length - 1]], "🃏");
      }
    }
    checkAchievements();
    checkWin();
  }

  // Cards already counted this run (so undoing/redoing doesn't double count).

  // ---------- Win / lose ----------
  function isComplete() {
    for (const [r, c] of ALL_CELLS) {
      if (state.values[r][c] !== state.solution[r][c]) return false;
    }
    return true;
  }

  function checkWin() {
    if (state.over) return true;
    if (!isComplete()) return false;
    win();
    return true;
  }

  function saveBest(won) {
    const key = K.best(state.mode, state.diff);
    const prev = store.json(key, null);
    const t = won ? Math.round(state.elapsed) : (prev && prev.t) || 0;
    store.jsonSet(key, { t, s: Math.max((prev && prev.s) || 0, state.score) });
  }

  function recordDailyWin() {
    const today = dateStr();
    if (daily.lastDate === today) return;
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { t: Math.round(state.elapsed), m: state.mistakes };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
  }

  function win() {
    if (state.over) return;
    state.over = true;
    state.won = true;

    const cfg = DIFFS[state.diff];
    const secs = Math.floor(state.elapsed / 1000);
    const timeBonus = Math.max(0, cfg.par - secs) * 3;
    let bonus = cfg.bonus + timeBonus;
    if (state.mode === "attack") bonus += 1500;
    state.score += bonus;

    stats.solves++;
    stats.totalTime += Math.round(state.elapsed);
    stats["solves" + cap(state.diff)]++;
    if (state.mistakes === 0) stats.flawlessSolves++;
    if (state.mistakes === 0 && (state.diff === "hard" || state.diff === "expert")) stats.flawlessHard++;
    if (state.hintsUsed === 0) stats.noHintSolves++;
    if (state.mode === "attack") stats.attackWins++;
    if (new Date().getHours() < 5) stats.nightSolves++;
    if (!stats.bestTime || state.elapsed < stats.bestTime) stats.bestTime = Math.round(state.elapsed);

    const prevBest = store.json(K.best(state.mode, state.diff), null);
    const prevTime = prevBest && prevBest.t ? prevBest.t : 0;
    const isRecord = !prevTime || Math.round(state.elapsed) < prevTime;

    saveStats();
    saveBest(true);
    if (state.mode === "daily") recordDailyWin();
    checkAchievements();
    updateHUD();
    sfx("win");
    confetti();

    showOverlay(
      "All Five Cards Solved! 🏆",
      `${cfg.name} · ${formatTime(state.elapsed)} · Score ${state.score}` +
        `${state.mistakes === 0 ? " · Flawless ✨" : ""}` +
        `${isRecord ? " · New Best!" : ""}`,
      [
        { label: "Play Again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
        { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
      ]
    );
  }

  function lose(title, msg) {
    if (state.over) return;
    state.over = true;
    state.won = false;
    stats.totalTime += Math.round(state.elapsed);
    saveStats();
    saveBest(false);
    checkAchievements();
    updateHUD();
    sfx("over");
    showOverlay(title, msg, [
      { label: "Try Again", onClick: () => { hideOverlay(); reset(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  // ---------- Effects ----------
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

  // ---------- HUD ----------
  function updateHUD() {
    if (!state.values || !state.solution) return;
    const done = completedCards().length;
    const p = progress();
    cardsEl.textContent = `${done}/5`;
    cellsEl.textContent = `${p.filled}/${p.total}`;
    mistakesEl.textContent = maxMistakes() ? `${state.mistakes}/${maxMistakes()}` : state.mistakes;
    mistakesEl.classList.toggle("is-danger", !!maxMistakes() && state.mistakes >= maxMistakes() - 1);
    comboEl.textContent = "x" + state.combo;
    hintsEl.textContent = state.hintsLeft;
    bestEl.textContent = bestLabel();
    undoBtn.disabled = !state.history.length || !canEdit();
    redoBtn.disabled = !state.future.length || !canEdit();
  }

  function updateTimeDisplay() {
    const t = formatTime(state.elapsed);
    if (t !== lastTimeText) {
      lastTimeText = t;
      timeEl.textContent = t;
    }
  }

  function updateCountdown() {
    if (state.started || state.countdown <= 0) {
      countdownEl.hidden = true;
      return;
    }
    countdownEl.hidden = false;
    const n = Math.ceil(state.countdown / 500);
    const label = String(Math.min(3, Math.max(1, n)));
    if (countdownNumEl.textContent !== label) {
      countdownNumEl.textContent = label;
      countdownNumEl.style.animation = "none";
      void countdownNumEl.offsetWidth;
      countdownNumEl.style.animation = "";
    }
  }

  function updateHint() {
    const cfg = MODES[state.mode];
    if (state.mode === "daily") {
      hintEl.textContent = `${cfg.hint} · Current streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}`;
    } else {
      hintEl.textContent = cfg.hint;
    }
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffBar.hidden = state.mode === "daily";
    newGameBtn.disabled = state.mode === "daily";
    updateDiffUI();
    updateHint();
    updateHUD();
  }

  function updateDiffUI() {
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // ---------- Game flow ----------
  function reset() {
    hideOverlay();
    const seed = state.mode === "daily" ? dateStr() : null;
    const gen = generatePuzzle(state.diff, seed);

    state.solution = gen.solution;
    state.puzzle = gen.puzzle;
    state.given = Array.from({ length: N }, () => new Array(N).fill(false));
    state.values = gen.puzzle.map((r) => r.slice());
    state.notes = Array.from({ length: N }, () => Array.from({ length: N }, () => new Set()));
    state.total = 0;
    for (const [r, c] of ALL_CELLS) {
      if (gen.puzzle[r][c]) state.given[r][c] = true;
      else state.total++;
    }
    state.selected = null;
    state.notesMode = false;
    state.mistakes = 0;
    state.hintsLeft = MODES[state.mode].hints;
    state.hintsUsed = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.score = 0;
    state.history = [];
    state.future = [];
    state.elapsed = 0;
    lastTimeText = "";
    timeEl.textContent = "0:00";
    state.started = false;
    state.paused = false;
    state.over = false;
    state.won = false;
    state.countdown = 1500;
    countedCards.clear();

    renderAllCells();
    updateModeUI();
    updateCountdown();
    pauseBtn.textContent = "Pause";
    notesBtn.setAttribute("aria-pressed", "false");
    lastTs = performance.now();
  }

  function startPlay() {
    state.started = true;
    state.countdown = 0;
    updateCountdown();
    sfx("click");
  }

  function setMode(m, force) {
    if (!MODES[m]) return;
    const changed = m !== state.mode;
    state.mode = m;
    store.set(K.mode, m);
    updateModeUI();
    if (changed || force) reset();
  }

  function setDiff(d) {
    if (!DIFFS[d]) return;
    if (d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    updateDiffUI();
    reset();
  }

  // ---------- Loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;

    if (!state.over && !state.paused) {
      if (!state.started) {
        state.countdown = Math.max(0, state.countdown - dt);
        if (state.countdown === 0) startPlay();
        updateCountdown();
      } else {
        state.elapsed += dt;
      }
    }

    updateTimeDisplay();
  }

  // ---------- Events ----------
  function onKeyDown(e) {
    const k = e.key;
    const lower = k.toLowerCase();

    if (!achvModal.hidden) {
      if (k === "Escape") {
        closeAchv();
        e.preventDefault();
      }
      return;
    }

    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (tag === "button" && (k === " " || k === "Enter")) return;

    if ((e.ctrlKey || e.metaKey) && lower === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && lower === "y") {
      e.preventDefault();
      redo();
      return;
    }

    if (k === "Escape") {
      if (state.paused) setPaused(false, true);
      return;
    }

    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state.over) {
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        reset();
      }
      return;
    }

    if (state.paused) return;

    if (k === "ArrowUp") { e.preventDefault(); moveSelection(-1, 0); return; }
    if (k === "ArrowDown") { e.preventDefault(); moveSelection(1, 0); return; }
    if (k === "ArrowLeft") { e.preventDefault(); moveSelection(0, -1); return; }
    if (k === "ArrowRight") { e.preventDefault(); moveSelection(0, 1); return; }

    if (k >= "1" && k <= "9") {
      placeNumber(+k);
      e.preventDefault();
      return;
    }
    if (k === "Backspace" || k === "Delete" || k === "0") {
      if (state.selected) eraseCell(state.selected.r, state.selected.c);
      e.preventDefault();
      return;
    }
    if (lower === "n") { toggleNotes(); return; }
    if (lower === "h") { useHint(); return; }
    if (lower === "u") { undo(); return; }
  }

  function bindEvents() {
    modeChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m]) return;
        if (m === state.mode) return;
        sfx("click");
        setMode(m);
      });
    });

    diffChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.diff;
        if (!DIFFS[d]) return;
        sfx("click");
        setDiff(d);
      });
    });

    document.querySelectorAll(".num-btn").forEach((btn) => {
      btn.addEventListener("click", () => placeNumber(+btn.dataset.n));
    });

    notesBtn.addEventListener("click", toggleNotes);
    hintBtn.addEventListener("click", useHint);
    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    newGameBtn.addEventListener("click", () => {
      sfx("click");
      reset();
    });

    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });

    checkBtn.addEventListener("click", () => {
      sfx("click");
      checkBoard();
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

    document.addEventListener("keydown", onKeyDown);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    window.addEventListener("blur", () => {
      if (!state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    window.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
    window.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = store.get(K.sound, "on") !== "off";
    state.diff = store.get(K.diff, "medium");
    if (!DIFFS[state.diff]) state.diff = "medium";

    buildBoard();
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