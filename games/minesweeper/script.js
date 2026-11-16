// Minesweeper — classic rules plus modern polish. Pure vanilla JS, fully offline.
// Modes: Classic (flags + timer), Time Attack (countdown), Daily (seeded),
// Zen (untimed, unlimited hints).
// Features: 3 difficulties, first-click-safe openings, chording, question marks,
// touch flag mode + long-press, keyboard play, 27 badges, persistent best
// times/scores, daily streaks, sound, confetti, and theme-aware styling.
(() => {
  "use strict";

  // ---------- DOM ----------
  const boardEl = document.getElementById("board");
  const boardWrapEl = document.getElementById("board-wrap");
  const minesEl = document.getElementById("mines");
  const timeEl = document.getElementById("time");
  const timeLabelEl = document.getElementById("time-label");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const hintsEl = document.getElementById("hints");
  const progressEl = document.querySelector(".ms-progress");
  const progressFillEl = document.getElementById("ms-progress-fill");
  const hintEl = document.getElementById("hint");

  const faceBtn = document.getElementById("face-btn");
  const pauseBtn = document.getElementById("pause");
  const flagBtn = document.getElementById("flag-btn");
  const hintBtn = document.getElementById("hint-btn");
  const newGameBtn = document.getElementById("new-game");
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

  // ---------- Constants ----------
  const DIFFS = {
    beginner: { name: "Beginner", rows: 9, cols: 9, mines: 10, par: 60, bonus: 500, attackTime: 60 },
    intermediate: { name: "Intermediate", rows: 16, cols: 16, mines: 40, par: 240, bonus: 1200, attackTime: 300 },
    expert: { name: "Expert", rows: 16, cols: 30, mines: 99, par: 600, bonus: 2500, attackTime: 720 },
  };

  const MODES = {
    classic: { name: "Classic", hints: 3, hint: "Classic rules · flags, timer, 3 hints — click to reveal, right-click to flag" },
    attack: { name: "Time Attack", hints: 2, hint: "Clear the board before the countdown hits zero · 2 hints" },
    daily: { name: "Daily", hints: 3, hint: "One seeded board a day — build your streak" },
    zen: { name: "Zen", hints: Infinity, hint: "Untimed and relaxed · unlimited hints · no pressure" },
  };

  const DIFF_ORDER = ["beginner", "intermediate", "expert"];

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Sweep", desc: "Win your first board.", stat: "wins", goal: 1 },
    { id: "winBeginner", icon: "🌱", name: "Rookie", desc: "Win on Beginner.", stat: "winsBeginner", goal: 1 },
    { id: "winIntermediate", icon: "🌿", name: "Surveyor", desc: "Win on Intermediate.", stat: "winsIntermediate", goal: 1 },
    { id: "winExpert", icon: "💎", name: "Expert Sweeper", desc: "Win on Expert.", stat: "winsExpert", goal: 1 },
    { id: "allDiffs", icon: "🌈", name: "All-Rounder", desc: "Win on every difficulty.", stat: "diffsWon", goal: 3 },
    { id: "wins10", icon: "👍", name: "Getting Good", desc: "Win 10 boards.", stat: "wins", goal: 10 },
    { id: "wins50", icon: "🎖️", name: "Veteran", desc: "Win 50 boards.", stat: "wins", goal: 50 },
    { id: "wins100", icon: "👑", name: "Legend", desc: "Win 100 boards.", stat: "wins", goal: 100 },
    { id: "speed10", icon: "⚡", name: "Quick Click", desc: "Win any board in under 10 seconds.", stat: "bestTime", goal: 10 },
    { id: "speed5", icon: "🚀", name: "Lightning", desc: "Win any board in under 5 seconds.", stat: "bestTime", goal: 5 },
    { id: "speed60", icon: "💨", name: "Swift", desc: "Win any board in under 1:00.", stat: "bestTime", goal: 60 },
    { id: "speed180", icon: "🌪️", name: "Blur", desc: "Win any board in under 3:00.", stat: "bestTime", goal: 180 },
    { id: "noFlags", icon: "🧠", name: "Trust Your Logic", desc: "Win without placing a single flag.", stat: "noFlagWins", goal: 1 },
    { id: "noHints", icon: "🔍", name: "Pure Logic", desc: "Win without using a hint.", stat: "noHintWins", goal: 1 },
    { id: "perfect", icon: "✨", name: "Flawless Sweep", desc: "Win with every mine correctly flagged.", stat: "perfectFlagWins", goal: 1 },
    { id: "cells100", icon: "🔢", name: "Spotter", desc: "Reveal 100 safe squares.", stat: "cellsRevealed", goal: 100 },
    { id: "cells1000", icon: "🗺️", name: "Cartographer", desc: "Reveal 1,000 safe squares.", stat: "cellsRevealed", goal: 1000 },
    { id: "flags100", icon: "🚩", name: "Flag Bearer", desc: "Place 100 flags.", stat: "flagsPlaced", goal: 100 },
    { id: "chords50", icon: "🖱️", name: "Power Clicker", desc: "Chord 50 times.", stat: "chords", goal: 50 },
    { id: "hint", icon: "💡", name: "Hint Master", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Against the Clock", desc: "Win a Time Attack.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily board.", stat: "dailyWins", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Win between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "score10k", icon: "💯", name: "High Scorer", desc: "Score 10,000 in a single game.", stat: "bestScore", goal: 10000 },
    { id: "streak5", icon: "🔥", name: "On a Roll", desc: "Win 5 boards in a row.", stat: "bestWinStreak", goal: 5 },
  ];

  const DEFAULT_STATS = {
    played: 0,
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestWinStreak: 0,
    cellsRevealed: 0,
    flagsPlaced: 0,
    chords: 0,
    hintsUsed: 0,
    winsBeginner: 0,
    winsIntermediate: 0,
    winsExpert: 0,
    noHintWins: 0,
    noFlagWins: 0,
    perfectFlagWins: 0,
    attackWins: 0,
    dailyWins: 0,
    nightWins: 0,
    totalTime: 0,
    bestTime: 0,
    bestScore: 0,
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
    best: (mode, diff) => `ms-best-v1-${mode}-${diff}`,
    stats: "ms-stats-v1",
    achv: "ms-achv-v1",
    sound: "ms-sound",
    mode: "ms-mode",
    diff: "ms-diff",
    daily: "ms-daily-v1",
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

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "beginner",
    rows: 9,
    cols: 9,
    mines: 10,
    cells: [],
    started: false,
    paused: false,
    over: false,
    won: false,
    showMines: false,
    exploded: null,
    flags: 0,
    flagsPlaced: 0,
    revealedCount: 0,
    safeTotal: 71,
    elapsed: 0,
    remaining: 0,
    hintsLeft: 3,
    hintsTotal: 3,
    hintsUsed: 0,
    score: 0,
    chords: 0,
    firstClick: true,
    flagMode: false,
    pressing: false,
    cursor: { r: 0, c: 0 },
    rand: Math.random,
    lastTick: -1,
  };

  let overlayEl = null;
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let suppressClick = false;
  let pressTimer = null;

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
        case "reveal":
          note(660, 0, 0.045, "sine", 0.025);
          break;
        case "flag":
          note(300, 0, 0.06, "square", 0.03, 220);
          break;
        case "unflag":
          note(240, 0, 0.05, "square", 0.022, 320);
          break;
        case "chord":
          note(520, 0, 0.05, "triangle", 0.03);
          note(700, 0.035, 0.06, "triangle", 0.025);
          break;
        case "boom":
          note(140, 0, 0.5, "sawtooth", 0.06, 40);
          note(90, 0.02, 0.4, "square", 0.04, 30);
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
        case "hint":
          note(440, 0, 0.08, "sine", 0.04);
          note(660, 0.07, 0.1, "sine", 0.04);
          break;
        case "achv":
          note(587, 0, 0.1, "triangle", 0.04);
          note(740, 0.09, 0.1, "triangle", 0.04);
          note(880, 0.18, 0.16, "triangle", 0.04);
          break;
        case "tick":
          note(880, 0, 0.04, "square", 0.02);
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

  // ---------- Helpers ----------
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function currentCfg() {
    return DIFFS[state.diff] || DIFFS.beginner;
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

  function shuffle(a, rand) {
    const r = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) out.push([nr, nc]);
      }
    }
    return out;
  }

  function diffsWon() {
    let n = 0;
    if (stats.winsBeginner > 0) n++;
    if (stats.winsIntermediate > 0) n++;
    if (stats.winsExpert > 0) n++;
    return n;
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec) return "—";
    if (state.mode === "zen") return rec.s ? String(rec.s) : "—";
    return rec.t ? formatTime(rec.t) : "—";
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

  function pushToast(a) {
    showToast(a.name, a.desc, a.icon);
  }

  // ---------- Achievements ----------
  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      let done = false;
      if (a.stat === "bestTime") {
        done = stats.bestTime > 0 && stats.bestTime <= a.goal * 1000;
      } else if (a.stat === "diffsWon") {
        done = diffsWon() >= a.goal;
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
    const isTime = a.stat === "bestTime";
    const ariaMax = isTime ? 100 : a.goal;
    const ariaNow = isTime
      ? Math.round(pct)
      : Math.min(Math.floor(stats[a.stat] || 0), a.goal);
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
        progressText = ok || done ? "Unlocked" : ms > 0 ? `Best ${formatTime(ms)}` : "No win yet";
        return achvCard(a, done || ok, pct, progressText);
      }
      if (a.stat === "diffsWon") {
        const raw = diffsWon();
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

    const played = stats.played || 0;
    const rate = played > 0 ? Math.round((stats.wins / played) * 100) : 0;
    const records = [
      ["Best", bestLabel()],
      ["Wins", stats.wins],
      ["Win rate", rate + "%"],
      ["Daily streak", daily.streak + "d"],
      ["Best score", stats.bestScore],
      ["Best win streak", stats.bestWinStreak],
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
      boardEl.classList.add("is-paused");
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
        boardEl.classList.remove("is-paused");
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
    boardEl.classList.toggle("is-paused", p);
    if (p && !silent) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); newGame(); } },
      ]);
    } else if (!p) {
      hideOverlay();
    }
    updateFace();
  }

  function togglePause() {
    if (state.over || !state.started) return;
    setPaused(!state.paused, false);
  }

  // ---------- Board ----------
  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${state.cols}, var(--ms-cell, 34px))`;
    state.cells = [];
    for (let r = 0; r < state.rows; r++) {
      const row = [];
      for (let c = 0; c < state.cols; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ms-cell";
        b.dataset.r = r;
        b.dataset.c = c;
        b.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}, hidden`);
        b.addEventListener("click", () => onCellClick(r, c));
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          onContextFlag(r, c);
        });
        b.addEventListener("auxclick", (e) => {
          if (e.button === 1) {
            e.preventDefault();
            chord(r, c);
          }
        });
        b.addEventListener("pointerdown", (e) => onPointerDown(e, r, c));
        b.addEventListener("pointerup", clearPress);
        b.addEventListener("pointerleave", clearPress);
        b.addEventListener("pointercancel", clearPress);
        b.addEventListener("focus", () => {
          state.cursor = { r, c };
        });
        boardEl.appendChild(b);
        row.push({
          mine: false,
          adj: 0,
          revealed: false,
          flagged: false,
          question: false,
          el: b,
        });
      }
      state.cells.push(row);
    }
    // Keep keyboard focus inside the board after a rebuild.
    state.cursor = { r: 0, c: 0 };
  }

  function layoutBoard() {
    const gap = 3;
    // Subtract the wrap padding (8) and the board's own padding + border (18).
    const avail = Math.max(160, boardWrapEl.clientWidth - 26);
    let size = Math.floor((avail - gap * (state.cols - 1)) / state.cols);
    size = Math.max(20, Math.min(44, size));
    boardEl.style.setProperty("--ms-cell", size + "px");
  }

  // ---------- Game flow ----------
  function newGame() {
    hideOverlay();
    const cfg = currentCfg();
    state.rows = cfg.rows;
    state.cols = cfg.cols;
    state.mines = cfg.mines;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.won = false;
    state.showMines = false;
    state.exploded = null;
    state.flags = 0;
    state.flagsPlaced = 0;
    state.revealedCount = 0;
    state.safeTotal = cfg.rows * cfg.cols - cfg.mines;
    state.elapsed = 0;
    state.remaining = state.mode === "attack" ? cfg.attackTime * 1000 : 0;
    state.hintsTotal = MODES[state.mode].hints;
    state.hintsLeft = state.hintsTotal;
    state.hintsUsed = 0;
    state.score = 0;
    state.chords = 0;
    state.firstClick = true;
    state.flagMode = false;
    state.pressing = false;
    state.lastTick = -1;
    state.rand =
      state.mode === "daily"
        ? mulberry32(hashSeed(`ms-${dateStr()}-${state.diff}`))
        : Math.random;

    flagBtn.setAttribute("aria-pressed", "false");
    flagBtn.classList.remove("is-active");
    boardEl.classList.remove("is-paused");
    pauseBtn.textContent = "Pause";
    lastTimeText = "";
    lastTs = 0;

    buildBoard();
    layoutBoard();
    renderAll();
    updateModeUI();
    updateHUD();
    updateTimeDisplay();
    updateFace();
  }

  function placeMines(sr, sc) {
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = sr + dr;
        const c = sc + dc;
        if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) safe.add(r * state.cols + c);
      }
    }
    let candidates = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!safe.has(r * state.cols + c)) candidates.push(r * state.cols + c);
      }
    }
    // Tiny boards: fall back to only protecting the clicked square.
    if (candidates.length < state.mines) {
      candidates = [];
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          if (!(r === sr && c === sc)) candidates.push(r * state.cols + c);
        }
      }
    }
    shuffle(candidates, state.rand);
    for (let i = 0; i < state.mines && i < candidates.length; i++) {
      const idx = candidates[i];
      state.cells[(idx / state.cols) | 0][idx % state.cols].mine = true;
    }
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.cells[r][c];
        if (cell.mine) continue;
        let n = 0;
        for (const [nr, nc] of neighbors(r, c)) if (state.cells[nr][nc].mine) n++;
        cell.adj = n;
      }
    }
  }

  function startGame(r, c) {
    state.started = true;
    placeMines(r, c);
    stats.played++;
    saveStats();
  }

  function onCellClick(r, c) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (state.over || state.paused) return;
    const cell = state.cells[r][c];
    if (state.flagMode) {
      toggleFlag(r, c, false);
      return;
    }
    if (cell.flagged) return;
    if (cell.revealed) {
      if (cell.adj > 0) chord(r, c);
      return;
    }
    if (state.firstClick) {
      state.firstClick = false;
      startGame(r, c);
    }
    if (cell.mine) {
      cell.revealed = true;
      lose(r, c);
      return;
    }
    floodReveal(r, c);
    sfx("reveal");
    afterMove();
  }

  function onContextFlag(r, c) {
    // Touch long-press sets `pressing`; the timer handles that flag itself.
    if (state.pressing) return;
    toggleFlag(r, c, true);
  }

  function floodReveal(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cell = state.cells[cr][cc];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      cell.question = false;
      state.revealedCount++;
      stats.cellsRevealed++;
      state.score += 10;
      renderCell(cr, cc);
      if (cell.adj === 0) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          const n = state.cells[nr][nc];
          if (!n.revealed && !n.flagged) stack.push([nr, nc]);
        }
      }
    }
  }

  function chord(r, c) {
    if (state.over || state.paused || !state.started) return;
    const cell = state.cells[r][c];
    if (!cell.revealed || cell.adj === 0) return;
    const nbrs = neighbors(r, c);
    let flags = 0;
    for (const [nr, nc] of nbrs) if (state.cells[nr][nc].flagged) flags++;
    if (flags !== cell.adj) {
      shakeCell(r, c);
      sfx("error");
      return;
    }
    let hit = null;
    for (const [nr, nc] of nbrs) {
      const n = state.cells[nr][nc];
      if (!n.flagged && !n.revealed && n.mine) {
        hit = [nr, nc];
        break;
      }
    }
    state.chords++;
    stats.chords++;
    if (hit) {
      const [hr, hc] = hit;
      state.cells[hr][hc].revealed = true;
      lose(hr, hc);
      return;
    }
    for (const [nr, nc] of nbrs) {
      const n = state.cells[nr][nc];
      if (!n.flagged && !n.revealed) floodReveal(nr, nc);
    }
    sfx("chord");
    afterMove();
  }

  function toggleFlag(r, c, allowQuestion) {
    if (state.over || state.paused) return;
    const cell = state.cells[r][c];
    if (cell.revealed) return;
    if (cell.flagged) {
      cell.flagged = false;
      if (allowQuestion) cell.question = true;
      state.flags = Math.max(0, state.flags - 1);
      sfx("unflag");
    } else if (cell.question) {
      cell.question = false;
      sfx("click");
    } else {
      cell.flagged = true;
      cell.question = false;
      state.flags++;
      state.flagsPlaced++;
      stats.flagsPlaced++;
      sfx("flag");
    }
    renderCell(r, c);
    updateHUD();
    checkAchievements();
  }

  function useHint() {
    if (state.over || state.paused) return;
    if (!state.started) {
      showToast("Start first", "Reveal a square to begin the board.", "👆");
      return;
    }
    if (state.hintsLeft <= 0) {
      showToast("No hints left", state.mode === "zen" ? "Zen has unlimited hints." : "You've used all your hints.", "💡");
      return;
    }
    const zeros = [];
    const others = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.cells[r][c];
        if (cell.revealed || cell.flagged || cell.mine) continue;
        if (cell.adj === 0) zeros.push([r, c]);
        else others.push([r, c]);
      }
    }
    const pool = zeros.length ? zeros : others;
    if (!pool.length) return;
    const [r, c] = pool[(Math.random() * pool.length) | 0];
    state.hintsLeft = Math.max(0, state.hintsLeft - 1);
    state.hintsUsed++;
    stats.hintsUsed++;
    state.score = Math.max(0, state.score - 50);
    floodReveal(r, c);
    sfx("hint");
    afterMove();
    flashCell(r, c);
  }

  function afterMove() {
    renderAll();
    updateHUD();
    checkAchievements();
    checkWin();
  }

  // ---------- Win / lose ----------
  function checkWin() {
    if (state.over) return true;
    if (state.revealedCount >= state.safeTotal) {
      win();
      return true;
    }
    return false;
  }

  function saveBest(won) {
    const key = K.best(state.mode, state.diff);
    const prev = store.json(key, null);
    const t = won && state.mode !== "zen" ? Math.round(state.elapsed) : (prev && prev.t) || 0;
    const s = Math.max((prev && prev.s) || 0, state.score);
    store.jsonSet(key, { t, s });
  }

  function recordDailyWin() {
    const today = dateStr();
    if (daily.lastDate === today) return;
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { t: Math.round(state.elapsed), s: state.score };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailyWins++;
    store.jsonSet(K.daily, daily);
  }

  function win() {
    if (state.over) return;
    state.over = true;
    state.won = true;
    state.showMines = false;

    // Auto-flag every remaining mine for the classic finish.
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.cells[r][c];
        if (cell.mine && !cell.flagged) {
          cell.flagged = true;
          cell.question = false;
        }
      }
    }
    state.flags = state.mines;

    const cfg = currentCfg();
    const secs = Math.floor(state.elapsed / 1000);
    let bonus = cfg.bonus + Math.max(0, cfg.par - secs) * 5;
    if (state.mode === "attack") bonus += 500;
    if (state.hintsUsed === 0) bonus += 500;
    if (state.flagsPlaced === 0) bonus += 300;
    state.score += bonus;

    let correctFlags = 0;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.cells[r][c];
        if (cell.flagged && cell.mine) correctFlags++;
      }
    }

    stats.wins++;
    stats.winStreak++;
    stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.winStreak);
    stats["wins" + cap(state.diff)]++;
    if (state.hintsUsed === 0) stats.noHintWins++;
    if (state.flagsPlaced === 0) stats.noFlagWins++;
    if (state.flagsPlaced > 0 && correctFlags === state.mines) stats.perfectFlagWins++;
    if (state.mode === "attack") stats.attackWins++;
    if (new Date().getHours() < 5) stats.nightWins++;
    if (!stats.bestTime || state.elapsed < stats.bestTime) stats.bestTime = Math.round(state.elapsed);
    if (state.score > stats.bestScore) stats.bestScore = state.score;
    stats.totalTime += Math.round(state.elapsed);

    const prevRec = store.json(K.best(state.mode, state.diff), null);
    const prevTime = prevRec && prevRec.t ? prevRec.t : 0;
    const isRecord = state.mode !== "zen" && (!prevTime || Math.round(state.elapsed) < prevTime);

    saveBest(true);
    if (state.mode === "daily") recordDailyWin();
    saveStats();
    checkAchievements();

    renderAll();
    updateHUD();
    updateFace();
    sfx("win");
    confetti();

    showOverlay(
      "Board Cleared! 🎉",
      `${cfg.name} · ${formatTime(state.elapsed)} · Score ${state.score}` +
        `${state.hintsUsed === 0 ? " · No hints ✨" : ""}` +
        `${state.flagsPlaced === 0 ? " · No flags 🧠" : ""}` +
        `${isRecord ? " · New Best!" : ""}`,
      [
        { label: "Play Again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
        { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
      ]
    );
  }

  function lose(r, c, reason) {
    if (state.over) return;
    state.over = true;
    state.won = false;
    state.showMines = true;
    state.exploded = r >= 0 ? { r, c } : null;

    stats.losses++;
    stats.winStreak = 0;
    stats.totalTime += Math.round(state.elapsed);
    saveStats();
    saveBest(false);

    renderAll();
    updateHUD();
    updateFace();
    sfx("boom");
    shakeBoard();
    checkAchievements();

    const title = reason === "time" ? "Time's Up! ⏱" : "Boom! 💥";
    const msg =
      reason === "time"
        ? `The clock beat you — ${state.revealedCount} of ${state.safeTotal} safe squares cleared.`
        : `You hit a mine after ${formatTime(state.elapsed)} · ${state.revealedCount}/${state.safeTotal} cleared.`;
    showOverlay(title, msg, [
      { label: "Try Again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  // ---------- Rendering ----------
  function renderCell(r, c) {
    const cell = state.cells[r][c];
    const el = cell.el;
    let cls = "ms-cell";
    let text = "";
    let label = `Row ${r + 1}, column ${c + 1}`;

    if (state.exploded && state.exploded.r === r && state.exploded.c === c) {
      cls += " is-exploded";
      text = "💥";
      label += ", exploded";
    } else if (cell.revealed) {
      cls += " is-revealed";
      if (cell.mine) {
        cls += " is-mine";
        text = "💣";
        label += ", mine";
      } else if (cell.adj > 0) {
        cls += " n" + cell.adj;
        text = String(cell.adj);
        label += `, ${cell.adj}`;
      } else {
        label += ", empty";
      }
    } else if (state.showMines && cell.mine) {
      cls += " is-mine is-shown";
      text = "💣";
      label += ", mine";
    } else if (cell.flagged) {
      cls += " is-flagged";
      if (state.showMines && !cell.mine) {
        cls += " is-wrong";
        text = "❌";
        label += ", wrong flag";
      } else {
        text = "🚩";
        label += ", flagged";
      }
    } else if (cell.question) {
      cls += " is-question";
      text = "❓";
      label += ", question";
    } else {
      label += ", hidden";
    }

    el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    el.setAttribute("aria-label", label);
  }

  function renderAll() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) renderCell(r, c);
    }
    if (state.showMines) staggerMines();
  }

  function staggerMines() {
    if (REDUCE || !state.exploded) return;
    const { r: er, c: ec } = state.exploded;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.cells[r][c];
        if (!cell.mine || cell.flagged) continue;
        const d = Math.abs(r - er) + Math.abs(c - ec);
        cell.el.style.animationDelay = Math.min(400, d * 18) + "ms";
      }
    }
  }

  function shakeCell(r, c) {
    if (REDUCE) return;
    const el = state.cells[r][c].el;
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
    const el = state.cells[r][c].el;
    el.classList.remove("hint-flash");
    void el.offsetWidth;
    el.classList.add("hint-flash");
  }

  // ---------- HUD ----------
  function updateHUD() {
    const remainingMines = state.mines - state.flags;
    minesEl.textContent = remainingMines;
    minesEl.classList.toggle("is-danger", remainingMines < 0);
    scoreEl.textContent = state.score;
    bestEl.textContent = bestLabel();
    hintsEl.textContent = Number.isFinite(state.hintsLeft) ? state.hintsLeft : "∞";
    const pct = state.safeTotal > 0 ? Math.round((state.revealedCount / state.safeTotal) * 100) : 0;
    progressFillEl.style.width = pct + "%";
    progressEl.setAttribute("aria-valuenow", String(pct));
    flagBtn.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
    flagBtn.classList.toggle("is-active", state.flagMode);
    hintBtn.disabled = !canEdit() || state.hintsLeft <= 0;
    pauseBtn.disabled = !state.started || state.over;
    timeLabelEl.textContent = state.mode === "attack" ? "Left" : "Time";
  }

  function updateTimeDisplay() {
    const ms = state.mode === "attack" ? state.remaining : state.elapsed;
    const t = formatTime(ms);
    if (t !== lastTimeText) {
      lastTimeText = t;
      timeEl.textContent = t;
      timeEl.classList.toggle("is-danger", state.mode === "attack" && state.remaining <= 10000);
    }
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffBar.hidden = state.mode === "daily";
    newGameBtn.disabled = false;
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    updateHint();
  }

  function updateHint() {
    const cfg = MODES[state.mode];
    if (state.mode === "daily") {
      hintEl.textContent = `${cfg.hint} · Current streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}`;
    } else {
      hintEl.textContent = cfg.hint;
    }
  }

  function updateFace() {
    let face = "🙂";
    if (state.over) face = state.won ? "😎" : "😵";
    else if (state.pressing) face = "😮";
    if (faceBtn.textContent !== face) faceBtn.textContent = face;
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

  // ---------- Input ----------
  function onPointerDown(e, r, c) {
    if (e.button !== undefined && e.button !== 0) return;
    state.pressing = true;
    updateFace();
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 600);
      toggleFlag(r, c, false);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {
          /* ignore */
        }
      }
    }, 380);
  }

  function clearPress() {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (state.pressing) {
      state.pressing = false;
      updateFace();
    }
  }

  function moveCursor(dr, dc) {
    let r = state.cursor.r;
    let c = state.cursor.c;
    for (let i = 0; i < Math.max(state.rows, state.cols); i++) {
      r = Math.min(state.rows - 1, Math.max(0, r + dr));
      c = Math.min(state.cols - 1, Math.max(0, c + dc));
      const cell = state.cells[r] && state.cells[r][c];
      if (cell) {
        cell.el.focus({ preventScroll: true });
        state.cursor = { r, c };
        return;
      }
    }
  }

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

    if (k === "Escape") {
      if (state.paused) setPaused(false, true);
      return;
    }
    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (state.over || state.paused) return;

    if (k === "ArrowUp") { e.preventDefault(); moveCursor(-1, 0); return; }
    if (k === "ArrowDown") { e.preventDefault(); moveCursor(1, 0); return; }
    if (k === "ArrowLeft") { e.preventDefault(); moveCursor(0, -1); return; }
    if (k === "ArrowRight") { e.preventDefault(); moveCursor(0, 1); return; }

    const { r, c } = state.cursor;
    if (lower === "f") {
      e.preventDefault();
      toggleFlag(r, c, false);
      return;
    }
    if (lower === "c") {
      e.preventDefault();
      chord(r, c);
      return;
    }
    if (lower === "h") {
      e.preventDefault();
      useHint();
    }
  }

  function bindEvents() {
    modeChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m] || m === state.mode) return;
        sfx("click");
        setMode(m);
      });
    });

    diffChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.diff;
        if (!DIFFS[d] || d === state.diff) return;
        sfx("click");
        setDiff(d);
      });
    });

    flagBtn.addEventListener("click", () => {
      if (state.over) return;
      state.flagMode = !state.flagMode;
      sfx("click");
      updateHUD();
      showToast(
        state.flagMode ? "Flag mode on" : "Flag mode off",
        state.flagMode ? "Taps now place flags. Tap again to remove." : "Taps reveal squares again.",
        "🚩"
      );
    });

    hintBtn.addEventListener("click", () => {
      sfx("click");
      useHint();
    });

    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });

    newGameBtn.addEventListener("click", () => {
      sfx("click");
      newGame();
    });

    faceBtn.addEventListener("click", () => {
      sfx("click");
      newGame();
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

    window.addEventListener("resize", () => {
      window.clearTimeout(bindEvents._resize);
      bindEvents._resize = window.setTimeout(layoutBoard, 120);
    });
    window.addEventListener("load", layoutBoard);

    window.addEventListener("pointerdown", ensureAudio, { once: true, capture: true });
    window.addEventListener("keydown", ensureAudio, { once: true, capture: true });
  }

  // ---------- Mode / difficulty ----------
  function setMode(m, force) {
    if (!MODES[m]) return;
    const changed = m !== state.mode;
    state.mode = m;
    store.set(K.mode, m);
    if (m === "daily") {
      state.diff = "intermediate";
      store.set(K.diff, state.diff);
    }
    updateModeUI();
    if (changed || force) newGame();
  }

  function setDiff(d) {
    if (!DIFFS[d] || d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    updateModeUI();
    newGame();
  }

  // ---------- Loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;

    if (state.started && !state.over && !state.paused && state.mode !== "zen") {
      state.elapsed += dt;
      if (state.mode === "attack") {
        const cfg = currentCfg();
        state.remaining = Math.max(0, cfg.attackTime * 1000 - state.elapsed);
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          lose(-1, -1, "time");
          return;
        }
        const sec = Math.ceil(state.remaining / 1000);
        if (sec <= 10 && sec !== state.lastTick) {
          state.lastTick = sec;
          sfx("tick");
        }
      }
      updateTimeDisplay();
    }
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = store.get(K.sound, "on") !== "off";
    state.diff = store.get(K.diff, "beginner");
    if (!DIFFS[state.diff]) state.diff = "beginner";

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