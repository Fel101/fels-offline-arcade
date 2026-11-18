// Kakuro — fill each run with 1-9 (no repeats) so it matches the clue sums.
// Pure vanilla JS, fully offline.
// Modes: Classic (relaxed), Time Attack (3 mistakes), Daily Challenge (seeded).
// Features: 4 difficulties, pencil notes, hints, undo/redo, combos,
// 25 badges, persistent best times/scores, daily streaks, sound,
// confetti, and theme-aware styling.
(() => {
  "use strict";

  const Arcade = window.Arcade;
  const { toast, overlay, badges: badgesApi, modal: modalApi, dom } = Arcade;

  // ---------- DOM ----------
  const boardEl = document.getElementById("board");
  const countdownEl = document.getElementById("countdown");
  const countdownNumEl = document.getElementById("countdown-num");
  const timeEl = document.getElementById("time");
  const cellsEl = document.getElementById("cells");
  const mistakesEl = document.getElementById("mistakes");
  const comboEl = document.getElementById("combo");
  const comboItem = document.getElementById("combo-item");
  const hintsEl = document.getElementById("hints");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");
  const combinationsEl = document.getElementById("clue-combinations");

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

  // ---------- Constants ----------
  const N = 9;
  const CLUE_PROMPT = "Select a clue to see its digit combinations.";

  const DIFFS = {
    easy: { name: "Easy", par: 600, bonus: 200 },
    medium: { name: "Medium", par: 900, bonus: 400 },
    hard: { name: "Hard", par: 1200, bonus: 700 },
    expert: { name: "Expert", par: 1500, bonus: 1000 },
  };

  // Original puzzles verified by eliminating unsupported digits across intersecting runs.
  // Each string contains the eight interior rows, with dots marking blocked cells.
  const PUZZLES = {
    easy: [
      "......../..14..../3125..../1249..../24.1832./97..621./....514./........",
      "...43162/...96385/....98../...27541/...38794/......52/......../........",
      "973...../651...../.421..75/.973..19/.896..98/...91387/....2153/........",
      "..4172../..84957./713.412./13..689./421...48/963...13/......../........",
      "25713.../78925.../14.68.97/...37168/...4968./.....37./......../........",
      "....45../....895./...9681./69573.../351...../..7459../..4217../..95....",
    ],
    medium: [
      "978...../132...../257869../.43216../689..869/19..1728/....23../....95..",
      ".26...../.69.3125/.38.8569/143.9846/3172..38/...4351./....19../........",
      "...739../...312../.....729/...62154/13794.68/62987.16/....5987/....183.",
      "......98/.....879/..256143/39184.86/57498.../....26../..2459../..5798..",
      "69....../13....../56..64../27..89../35217.../..7396../.75.4715/.19..859",
      "..9385../534172../978.593./....632./...138../...397../7912..../8765....",
    ],
    hard: [
      "....59../....71../5123.621/7612.813/93..5789/89467.../351247../683.12..",
      "..82..../..96..../..796.85/..571.31/19682.97/24..4678/48..3164/......43",
      "19....15/65...738/87.798../.13924../125.12../48.35.../..62315./..71459.",
      "13...14./243..87./495..751/..497312/...78935/.798562./.28...../.17.....",
      ".....598/....5184/29.71263/6798..../.281..../..7689../..321674/...43821",
      ".79864../.16785../..16..../473251../69.97638/56..9315/249...../187.....",
    ],
    expert: [
      "69.12.87/24.36125/4798.539/1534..../38.763../...64213/.....942/.....421",
      "..38917./.614723./.86..487/97.24351/64281.../891.28../72..59../....67..",
      "...63125/...72348/53.95.59/68.81.12/89756.36/.52.76../.41..524/.13..961",
      "..968.../683579../34.138../968...../412.28../..674312/..983754/..591.23",
    ],
  };

  const MODES = {
    classic: { name: "Classic", maxMistakes: 0, hints: 3, hint: "Use 1–9 to match each clue sum without repeats. Arrow keys move between cells. Use Check to validate your entries." },
    attack: { name: "Time Attack", maxMistakes: 3, hints: 3, hint: "3 mistakes and it's over · H for a hint · beat the clock" },
    daily: { name: "Daily", maxMistakes: 0, hints: 3, hint: "Solve today's puzzle to build your streak. Use Check to validate your entries." },
  };

  // "Lower is better" time badges: goal is in seconds, the stat in ms.
  function timeBadge(id, icon, name, desc, seconds) {
    const limit = seconds * 1000;
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestTime",
      goal: seconds,
      satisfied: () => (stats.bestTime || 0) > 0 && stats.bestTime <= limit,
      progress: () => {
        const ms = stats.bestTime || 0;
        if (!ms) return { pct: 0, text: "No solve yet" };
        if (ms <= limit) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (limit / ms) * 100), text: `Best ${formatTime(ms)}` };
      },
    };
  }

    const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Fill", desc: "Complete your first puzzle.", stat: "solves", goal: 1 },
    { id: "easy", icon: "🌱", name: "Easy Peasy", desc: "Solve an Easy puzzle.", stat: "solvesEasy", goal: 1 },
    { id: "medium", icon: "🌿", name: "Medium Rare", desc: "Solve a Medium puzzle.", stat: "solvesMedium", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Boiled", desc: "Solve a Hard puzzle.", stat: "solvesHard", goal: 1 },
    { id: "expert", icon: "💎", name: "Expert Mind", desc: "Solve an Expert puzzle.", stat: "solvesExpert", goal: 1 },
    { id: "allDiffs", icon: "🌈", name: "Full Spectrum", desc: "Solve every difficulty.", stat: "diffsSolved", goal: 4,
      value: () =>
        ["solvesEasy", "solvesMedium", "solvesHard", "solvesExpert"].filter((k) => (stats[k] || 0) > 0).length },
    timeBadge("speed3", "⚡", "Speed Demon", "Solve any puzzle in under 3:00.", 180),
    timeBadge("speed2", "🚀", "Lightning", "Solve any puzzle in under 2:00.", 120),
    { id: "flawless", icon: "✨", name: "Flawless", desc: "Solve with zero mistakes.", stat: "flawlessSolves", goal: 1 },
    { id: "flawlessHard", icon: "🛡️", name: "Iron Will", desc: "Solve Hard or Expert with zero mistakes.", stat: "flawlessHard", goal: 1 },
    { id: "combo5", icon: "🔗", name: "In the Groove", desc: "Chain 5 correct entries in a row.", stat: "maxCombo", goal: 5 },
    { id: "combo10", icon: "🌊", name: "Unstoppable", desc: "Chain 10 correct entries in a row.", stat: "maxCombo", goal: 10 },
    { id: "combo15", icon: "🌋", name: "On Fire", desc: "Chain 15 correct entries in a row.", stat: "maxCombo", goal: 15 },
    { id: "notes", icon: "✏️", name: "Note Taker", desc: "Pencil in a note.", stat: "noteEntries", goal: 1 },
    { id: "hint", icon: "💡", name: "Hint Master", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "nohint", icon: "🧠", name: "Pure Logic", desc: "Solve without using hints.", stat: "noHintSolves", goal: 1 },
    { id: "undo", icon: "↶", name: "Second Thoughts", desc: "Use undo.", stat: "undos", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Against the Clock", desc: "Win a Time Attack.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily Challenge.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "cells200", icon: "🔢", name: "Sharpshooter", desc: "Place 200 correct cells.", stat: "correctCells", goal: 200 },
    { id: "run", icon: "📏", name: "Perfect Run", desc: "Complete a run with no hints.", stat: "cleanRuns", goal: 1 },
    { id: "sums", icon: "🧮", name: "Sum Sense", desc: "Fill 100 cells correctly.", stat: "correctCells", goal: 100 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Solve between midnight and 5 AM.", stat: "nightSolves", goal: 1 },
  ];

  const DEFAULT_STATS = {
    solves: 0,
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
    cleanRuns: 0,
    totalTime: 0,
    bestTime: 0,
    nightSolves: 0,
  };

  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- Storage ----------
  const store = Arcade.store;

  const K = {
    best: (mode, diff) => `kakuro-best-v1-${mode}-${diff}`,
    stats: "kakuro-stats-v1",
    achv: "kakuro-achv-v1",
    sound: "kakuro-sound",
    mode: "kakuro-mode",
    diff: "kakuro-diff",
    daily: "kakuro-daily-v1",
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
  const soundCtl = Arcade.audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });
  let soundOn = soundCtl.enabled;
  let actx = null;

  Arcade.audio.define("place", [
    [520, 0, 0.07, "triangle", 0.04],
    [780, 0.04, 0.06, "triangle", 0.025],
  ]);
  Arcade.audio.define("note", [
    [340, 0, 0.05, "sine", 0.03],
  ]);
  Arcade.audio.define("erase", [
    [260, 0, 0.07, "sine", 0.03, 160],
  ]);
  Arcade.audio.define("error", [
    [180, 0, 0.16, "sawtooth", 0.045, 90],
  ]);
  Arcade.audio.define("hint", [
    [440, 0, 0.08, "sine", 0.04],
    [660, 0.07, 0.1, "sine", 0.04],
  ]);
  Arcade.audio.define("win", [
    [523, 0, 0.12, "sine", 0.05],
    [659, 0.1, 0.12, "sine", 0.05],
    [784, 0.2, 0.16, "sine", 0.05],
    [1047, 0.32, 0.3, "sine", 0.045],
  ]);
  Arcade.audio.define("over", [
    [320, 0, 0.45, "sawtooth", 0.05, 70],
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

  function isPlayable(r, c) {
    return !!state.playable?.[r]?.[c];
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

  function findRuns(playable) {
    const runs = [];
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        if (!playable[r][c]) { c++; continue; }
        const cells = [];
        while (c < N && playable[r][c]) { cells.push([r, c]); c++; }
        if (cells.length >= 2) runs.push({ cells, dir: "h" });
      }
    }
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        if (!playable[r][c]) { r++; continue; }
        const cells = [];
        while (r < N && playable[r][c]) { cells.push([r, c]); r++; }
        if (cells.length >= 2) runs.push({ cells, dir: "v" });
      }
    }
    return runs;
  }

  function sumOf(sol, cells) {
    let s = 0;
    for (const [r, c] of cells) s += sol[r][c];
    return s;
  }

  function buildClues(playable, sol) {
    const runs = findRuns(playable);
    const at = Array.from({ length: N }, () => Array.from({ length: N }, () => []));
    for (const run of runs) {
      run.sum = sumOf(sol, run.cells);
      for (const [r, c] of run.cells) at[r][c].push(run);
    }
    return { runs, at };
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "medium",
    solution: null,
    playable: null,
    values: null,
    notes: null,
    runs: [],
    runsAt: Array.from({ length: N }, () => Array.from({ length: N }, () => [])),
    selected: null,
    checked: false,
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
  const clueEls = new Map();
  let resumeAfterModal = false;
  let previousPuzzle = null;
  let lastTs = 0;
  let lastTimeText = "";

  function progress() {
    let filled = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isPlayable(r, c) && state.values[r][c]) filled++;
      }
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

  function puzzleDifficulty() {
    return state.mode === "daily" ? "medium" : state.diff;
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, puzzleDifficulty()), null);
    if (!rec || !rec.t) return "—";
    return formatTime(rec.t);
  }

  // ---------- Toasts ----------
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
      records: () => ([
      ["Best", bestLabel()],
      ["Solved", stats.solves],
      ["Daily streak", daily.streak + "d"],
      ["Total time", formatTime(stats.totalTime)],
      ["Correct cells", stats.correctCells],
      ["Best combo", "x" + (stats.maxCombo || 0)],
    ]),
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!state.over && !state.paused && state.started) {
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
  // A clue cell is never part of a run, so look at the playable cell that
  // starts the run it describes: below it for a down clue, right of it for
  // an across clue.
  function clueRun(r, c, dir) {
    if (dir === "v") {
      const rr = r + 1;
      if (rr >= N || !isPlayable(rr, c)) return null;
      return state.runsAt[rr][c].find((x) => x.dir === "v") || null;
    }
    const cc = c + 1;
    if (cc >= N || !isPlayable(r, cc)) return null;
    return state.runsAt[r][cc].find((x) => x.dir === "h") || null;
  }

  function digitCombinations(count, sum, used = new Set()) {
    const combinations = [];
    const digits = [];
    function collect(next, left, remaining) {
      if (left === 0) {
        if (remaining === 0) combinations.push(digits.slice());
        return;
      }
      for (let digit = next; digit <= 10 - left && digit <= remaining; digit++) {
        if (used.has(digit)) continue;
        digits.push(digit);
        collect(digit + 1, left - 1, remaining - digit);
        digits.pop();
      }
    }
    collect(1, count, sum);
    return combinations;
  }

  function makeClueButton(run) {
    const button = document.createElement("button");
    const across = run.dir === "h";
    const direction = across ? "Across" : "Down";
    const label = `${direction} ${run.sum} in ${run.cells.length} cells`;
    button.type = "button";
    button.className = `kakuro-clue__tri kakuro-clue__tri--${across ? "right" : "down"}`;
    button.textContent = run.sum;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", "clue-combinations");
    button.addEventListener("click", () => {
      const combinations = digitCombinations(run.cells.length, run.sum);
      combinationsEl.textContent = `${label} · ${combinations.map((digits) => digits.join(" + ")).join(" / ")}`;
      const [r, c] = run.cells[0];
      selectCell(r, c, false);
    });
    clueEls.set(run, button);
    return button;
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    combinationsEl.textContent = CLUE_PROMPT;
    cellEls = [];
    valEls = [];
    notesEls = [];
    clueEls.clear();
    for (let r = 0; r < N; r++) {
      cellEls[r] = [];
      valEls[r] = [];
      notesEls[r] = [];
      for (let c = 0; c < N; c++) {
        const wrap = document.createElement("div");
        wrap.className = "kakuro-cell";
        wrap.dataset.r = r;
        wrap.dataset.c = c;
        boardEl.appendChild(wrap);

        if (!isPlayable(r, c)) {
          const clue = document.createElement("div");
          clue.className = "kakuro-clue";
          const downRun = clueRun(r, c, "v");
          const rightRun = clueRun(r, c, "h");
          if (rightRun) clue.appendChild(makeClueButton(rightRun));
          if (downRun) clue.appendChild(makeClueButton(downRun));
          if (downRun || rightRun) clue.classList.add("kakuro-clue--split");
          wrap.appendChild(clue);
          cellEls[r][c] = null;
          valEls[r][c] = null;
          notesEls[r][c] = null;
          continue;
        }

        const b = document.createElement("button");
        b.type = "button";
        b.className = "sudoku-cell";
        b.dataset.r = r;
        b.dataset.c = c;

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
        b.addEventListener("focus", () => selectCell(r, c, false));
        wrap.appendChild(b);
        cellEls[r][c] = b;
        valEls[r][c] = val;
        notesEls[r][c] = notes;
      }
    }
  }

  function runComplete(run) {
    let sum = 0;
    const used = new Set();
    for (const [r, c] of run.cells) {
      const value = state.values[r][c];
      if (!value || used.has(value)) return false;
      used.add(value);
      sum += value;
    }
    return sum === run.sum;
  }

  function runHasError(run) {
    let remaining = run.sum;
    const used = new Set();
    for (const [r, c] of run.cells) {
      const value = state.values[r][c];
      if (!value) continue;
      if (used.has(value)) return true;
      used.add(value);
      remaining -= value;
    }
    return used.size > 0 && digitCombinations(run.cells.length - used.size, remaining, used).length === 0;
  }

  function renderCell(r, c, badRuns) {
    if (!isPlayable(r, c)) return;
    const el = cellEls[r][c];
    const v = state.values[r][c];
    el.classList.toggle("error", !!maxMistakes() && v !== 0 && v !== state.solution[r][c]);
    el.classList.toggle("conflict", v !== 0 && state.runsAt[r][c].some((run) => badRuns.has(run)));
    valEls[r][c].textContent = v || "";

    const notesEl = notesEls[r][c];
    const showNotes = v === 0 && state.notes[r][c].size > 0;
    notesEl.style.display = showNotes ? "grid" : "none";
    notesEl.classList.toggle("is-notes", showNotes);
    if (showNotes) {
      const spans = notesEl.children;
      for (let n = 1; n <= 9; n++) spans[n - 1].classList.toggle("on", state.notes[r][c].has(n));
    }

    el.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}${v ? ", " + v : ", empty"}`);
  }

  function renderAllCells() {
    const showChecks = state.checked || !!maxMistakes() || state.won;
    const badRuns = new Set(showChecks ? state.runs.filter(runHasError) : []);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) renderCell(r, c, badRuns);
    }
    for (const [run, button] of clueEls) {
      button.classList.toggle("done", showChecks && runComplete(run));
      button.classList.toggle("bad", badRuns.has(run));
    }
  }

  function updateHighlights() {
    const sel = state.selected;
    const sv = sel ? state.values[sel.r][sel.c] : 0;
    const selectedRuns = sel ? state.runsAt[sel.r][sel.c] : [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!isPlayable(r, c)) continue;
        const el = cellEls[r][c];
        const isSel = !!sel && r === sel.r && c === sel.c;
        const related = !isSel && state.runsAt[r][c].some((run) => selectedRuns.includes(run));
        el.classList.toggle("selected", isSel);
        el.classList.toggle("related", related);
        el.classList.toggle("same", !!sel && sv !== 0 && state.values[r][c] === sv && !isSel);
      }
    }
    for (const [run, button] of clueEls) button.classList.toggle("related", selectedRuns.includes(run));
  }

  function selectCell(r, c, focus = true) {
    if (!isPlayable(r, c)) return;
    state.selected = { r, c };
    updateHighlights();
    const el = cellEls[r][c];
    if (focus && el) el.focus({ preventScroll: true });
  }

  function firstPlayable() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (isPlayable(r, c)) return { r, c };
    return { r: 0, c: 0 };
  }

  function moveSelection(dr, dc) {
    if (!state.selected) {
      const f = firstPlayable();
      selectCell(f.r, f.c);
      return;
    }
    let r = state.selected.r + dr;
    let c = state.selected.c + dc;
    while (r >= 0 && r < N && c >= 0 && c < N) {
      if (isPlayable(r, c)) {
        selectCell(r, c);
        return;
      }
      r += dr;
      c += dc;
    }
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
    for (const run of state.runsAt[r][c]) {
      for (const [rr, cc] of run.cells) {
        if (rr === r && cc === c) continue;
        if (state.notes[rr][cc].delete(v)) cleared.push({ r: rr, c: cc, n: v });
      }
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
    } else if (!maxMistakes()) {
      sfx("place");
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
      lose("Out of Mistakes", `Three strikes — ${p.filled} of ${p.total} cells filled.`);
    }
  }

  function eraseCell(r, c) {
    if (!canEdit()) return;
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
      toast.show("Pick a cell first", "Click any empty square, then enter a number.", "👆");
      sfx("click");
      return;
    }
    const { r, c } = state.selected;
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
      toast.show("Nothing to undo", "Every move so far is still ahead of you.", "↶");
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
      toast.show("Nothing to redo", "You're at the latest move.", "↷");
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
      toast.show("No hints left", "You've used all three hints.", "💡");
      return;
    }
    let target = state.selected;
    if (!target || state.values[target.r][target.c] === state.solution[target.r][target.c]) {
      const opts = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (isPlayable(r, c) && state.values[r][c] !== state.solution[r][c]) opts.push({ r, c });
        }
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
    toast.show(
      state.notesMode ? "Notes on" : "Notes off",
      state.notesMode ? "Number taps now pencil-mark candidates." : "Number taps place answers again.",
      "✏️"
    );
  }

  function checkBoard() {
    if (!canEdit()) return;
    if (checkWin()) return;
    const errors = state.runs.filter(runHasError).length;
    if (errors && !state.checked && !maxMistakes()) state.mistakes++;
    state.checked = true;
    renderAllCells();
    updateHUD();

    if (errors) {
      toast.show(`${errors} ${errors === 1 ? "clue needs" : "clues need"} attention`, "Check the highlighted runs for repeats or impossible sums.", "🚨");
      sfx("error");
    } else {
      const empty = state.total - progress().filled;
      toast.show("Looking good", `${empty} empty ${empty === 1 ? "cell" : "cells"}. Try the remaining clues.`, "✅");
      sfx("click");
    }
  }

  function afterChange() {
    state.checked = false;
    renderAllCells();
    updateHighlights();
    updateHUD();
    checkAchievements();
    checkWin();
  }

  // ---------- Win / lose ----------
  function isComplete() {
    return state.runs.length > 0 && state.runs.every(runComplete);
  }

  function checkWin() {
    if (state.over) return true;
    if (!isComplete()) return false;
    win();
    return true;
  }

  function saveBest(won) {
    const key = K.best(state.mode, puzzleDifficulty());
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
    renderAllCells();

    const diff = puzzleDifficulty();
    const cfg = DIFFS[diff];
    const secs = Math.floor(state.elapsed / 1000);
    const timeBonus = Math.max(0, cfg.par - secs) * 5;
    let bonus = cfg.bonus + timeBonus;
    if (state.mode === "attack") bonus += 500;
    state.score += bonus;

    stats.solves++;
    if (!maxMistakes()) stats.correctCells += Math.max(0, state.total - state.hintsUsed);
    stats.totalTime += Math.round(state.elapsed);
    stats["solves" + cap(diff)]++;
    if (state.mistakes === 0) stats.flawlessSolves++;
    if (state.mistakes === 0 && (diff === "hard" || diff === "expert")) stats.flawlessHard++;
    if (state.hintsUsed === 0) {
      stats.noHintSolves++;
      stats.cleanRuns++;
    }
    if (state.mode === "attack") stats.attackWins++;
    if (new Date().getHours() < 5) stats.nightSolves++;
    if (!stats.bestTime || state.elapsed < stats.bestTime) stats.bestTime = Math.round(state.elapsed);

    const prevBest = store.json(K.best(state.mode, diff), null);
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
      "Solved! 🎉",
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
  // Provided by the shared core.
  const confetti = (count) => Arcade.confetti(count === undefined ? 80 : count);

  // ---------- HUD ----------
  function updateHUD() {
    if (!state.playable) return;
    const p = progress();
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
    comboItem.hidden = !maxMistakes();
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

  // ---------- Puzzle generation ----------
  function buildPuzzle(template, variant) {
    const source = template.split("/");
    const solution = Array.from({ length: N }, () => new Array(N).fill(0));

    // Reflections and transposition preserve the crossing runs. Replacing x
    // with 10 - x preserves distinct digits and maps each sum bijectively.
    for (let r = 1; r < N; r++) {
      for (let c = 1; c < N; c++) {
        let row = variant & 1 ? N - 1 - r : r - 1;
        let col = variant & 2 ? N - 1 - c : c - 1;
        if (variant & 4) [row, col] = [col, row];
        const digit = Number(source[row][col]);
        if (digit) solution[r][c] = variant & 8 ? 10 - digit : digit;
      }
    }

    const playable = solution.map((row) => row.map(Boolean));
    const { runs, at } = buildClues(playable, solution);
    return { solution, playable, runs, runsAt: at };
  }

  function generate(diffKey, seedStr, previousIndex = -1) {
    const templates = PUZZLES[diffKey];
    const rand = seedStr ? mulberry32(hashSeed(seedStr)) : Math.random;
    const excludePrevious = previousIndex >= 0 && templates.length > 1;
    let index = Math.floor(rand() * (templates.length - Number(excludePrevious)));
    if (excludePrevious && index >= previousIndex) index++;
    const variant = Math.floor(rand() * 16);
    return { ...buildPuzzle(templates[index], variant), index };
  }

  // ---------- Game flow ----------
  function reset() {
    hideOverlay();
    const seed = state.mode === "daily" ? dateStr() : null;
    const diff = puzzleDifficulty();
    const prev = !seed && previousPuzzle?.diff === diff ? previousPuzzle.index : -1;
    const gen = generate(diff, seed, prev);
    if (!seed) previousPuzzle = { diff, index: gen.index };

    state.solution = gen.solution;
    state.playable = gen.playable;
    state.runs = gen.runs;
    state.runsAt = gen.runsAt;
    state.values = Array.from({ length: N }, () => new Array(N).fill(0));
    state.notes = Array.from({ length: N }, () => Array.from({ length: N }, () => new Set()));
    state.selected = firstPlayable();
    state.checked = false;
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
    state.started = !maxMistakes();
    state.paused = false;
    state.over = false;
    state.won = false;
    state.countdown = state.started ? 0 : 1500;
    state.total = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (state.playable[r][c]) state.total++;

    buildBoard();
    renderAllCells();
    updateHighlights();
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
  window.__K = {
    state, stats, DIFFS, MODES, PUZZLES,
    unlocked: () => __ACHV_LIST__,
    snap: () => ({
      mode: state.mode, diff: state.diff,
      started: state.started, paused: state.paused, over: state.over, won: state.won,
      countdown: Math.round(state.countdown), elapsed: Math.round(state.elapsed),
      score: state.score, mistakes: state.mistakes, combo: state.combo, maxCombo: state.maxCombo,
      hintsLeft: state.hintsLeft, hintsUsed: state.hintsUsed, notesMode: state.notesMode,
      total: state.total,
      selected: state.selected ? { r: state.selected.r, c: state.selected.c } : null,
      values: state.values ? state.values.map((r) => r.slice()) : null,
      notes: state.notes ? state.notes.map((row) => row.map((s) => Array.from(s))) : null,
      playable: state.playable ? state.playable.map((r) => r.slice()) : null,
      solution: state.solution ? state.solution.map((r) => r.slice()) : null,
      runs: state.runs.map((run) => ({ dir: run.dir, sum: run.sum, cells: run.cells.map((x) => x.slice()) })),
      runsAt: state.runsAt.map((row) => row.map((list) => list.length)),
      history: state.history.length, future: state.future.length,
      overlayTitle: overlay ? overlay.info().title : null,
      overlayMsg: overlay ? overlay.info().msg : null,
      diffHidden: document.getElementById("difficulty-bar").hidden,
      newGameDisabled: document.getElementById("new-game").disabled,
      modePressed: Array.from(document.querySelectorAll(".mode-chip")).map((b) => b.getAttribute("aria-pressed")),
      diffPressed: Array.from(document.querySelectorAll(".diff-chip")).map((b) => b.getAttribute("aria-pressed")),
      cellsEl: document.getElementById("cells").textContent,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: __ACHV_LIST__(),
    }),
    setState: (o) => { Object.assign(state, o); },
    buildBoardNow: () => buildBoard(),
    setPuzzle: (sol, playable, runs, runsAt) => {
      state.solution = sol;
      state.playable = playable;
      state.runs = runs;
      state.runsAt = runsAt;
      state.values = Array.from({ length: 9 }, () => new Array(9).fill(0));
      state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
      state.selected = null; state.notesMode = false; state.checked = false;
      state.mistakes = 0; state.hintsLeft = 3; state.hintsUsed = 0;
      state.combo = 0; state.maxCombo = 0; state.score = 0;
      state.history = []; state.future = [];
      state.elapsed = 0; state.started = true; state.paused = false; state.over = false; state.won = false;
      state.total = 0;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (playable[r][c]) state.total++;
      buildBoard();
      renderAllCells(); updateHUD();
    },
    reset, setMode, setDiff, placeNumber, setCellValue, eraseCell, toggleNote,
    undo, redo, useHint, selectCell, checkWin, win, lose, generate, buildPuzzle,
    findRuns, sumOf, buildClues, dateStr, startPlay, checkBoard, toggleNotes, progress,
    renderAllCells, updateHUD, checkAchievements, firstPlayable, isPlayable, runComplete,
    runHasError, clueRun,
  };

  init();
})();
