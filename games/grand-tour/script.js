// Grand Tour — draw one closed loop that visits every dot exactly once.
// Pure vanilla JS, fully offline.
// Modes: Classic (relaxed), Time Attack (countdown), Daily (seeded), Zen (untimed).
// Features: 4 difficulties, unique-solution generation, locked clues, X marks,
// undo/redo, reset, hypothesis branches, hints, 24 badges, persistent best times,
// daily streaks, sound, confetti, and theme-aware SVG styling.
(() => {
  "use strict";

  const Arcade = window.Arcade;
  const { toast, overlay, badges: badgesApi, modal: modalApi, dom } = Arcade;

  // ---------- DOM ----------
  const boardEl = document.getElementById("board");
  const countdownEl = document.getElementById("countdown");
  const countdownNumEl = document.getElementById("countdown-num");
  const timeEl = document.getElementById("time");
  const edgesEl = document.getElementById("edges");
  const dotsEl = document.getElementById("dots");
  const hintsEl = document.getElementById("hints");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");

  const pauseBtn = document.getElementById("pause");
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const hintBtn = document.getElementById("hint-btn");
  const branchBtn = document.getElementById("branch-btn");
  const markBtn = document.getElementById("mark-btn");
  const newGameBtn = document.getElementById("new-game");
  const resetBtn = document.getElementById("reset-btn");
  const checkBtn = document.getElementById("check");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");

  const branchBar = document.getElementById("branch-bar");
  const branchKeepBtn = document.getElementById("branch-keep");
  const branchDiscardBtn = document.getElementById("branch-discard");

  const modeChips = Array.from(document.querySelectorAll(".mode-chip"));
  const diffChips = Array.from(document.querySelectorAll(".diff-chip"));

  const toastsEl = document.getElementById("toasts");
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  // ---------- Constants ----------
  const MODES = {
    classic: {
      name: "Classic",
      timed: false,
      hints: 3,
      hint: "Relaxed solve · 3 hints · beat your best time",
    },
    attack: {
      name: "Time Attack",
      timed: true,
      hints: 2,
      hint: "Solve before the clock runs out · 2 hints",
    },
    daily: {
      name: "Daily",
      timed: false,
      hints: 3,
      hint: "One seeded puzzle a day — build your streak",
    },
    zen: {
      name: "Zen",
      timed: false,
      hints: Infinity,
      hint: "No clock, unlimited hints — just flow",
    },
  };

  const DIFFS = {
    easy: {
      name: "Easy",
      rows: 4,
      cols: 6,
      target: 0.55,
      par: 120,
      bonus: 200,
      timeLimit: 240,
    },
    medium: {
      name: "Medium",
      rows: 6,
      cols: 6,
      target: 0.4,
      par: 240,
      bonus: 400,
      timeLimit: 300,
    },
    hard: {
      name: "Hard",
      rows: 6,
      cols: 7,
      target: 0.3,
      par: 360,
      bonus: 700,
      timeLimit: 420,
    },
    expert: {
      name: "Expert",
      rows: 8,
      cols: 8,
      target: 0.22,
      par: 480,
      bonus: 1000,
      timeLimit: 540,
    },
  };

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Loop", desc: "Complete your first puzzle.", stat: "solves", goal: 1 },
    { id: "easy", icon: "🌱", name: "Easy Rider", desc: "Solve an Easy puzzle.", stat: "solvesEasy", goal: 1 },
    { id: "medium", icon: "🌿", name: "Middle Ground", desc: "Solve a Medium puzzle.", stat: "solvesMedium", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Way", desc: "Solve a Hard puzzle.", stat: "solvesHard", goal: 1 },
    { id: "expert", icon: "💎", name: "Grand Tour", desc: "Solve an Expert puzzle.", stat: "solvesExpert", goal: 1 },
    { id: "allDiffs", icon: "🌈", name: "Full Circuit", desc: "Solve every difficulty.", stat: "diffsSolved", goal: 4 },
    { id: "speed5", icon: "⏱️", name: "Quick Thinker", desc: "Solve any puzzle in under 5:00.", stat: "bestTime", goal: 300 },
    { id: "speed3", icon: "🚀", name: "Speed Demon", desc: "Solve any puzzle in under 3:00.", stat: "bestTime", goal: 180 },
    { id: "speed2", icon: "⚡", name: "Lightning", desc: "Solve any puzzle in under 2:00.", stat: "bestTime", goal: 120 },
    { id: "flawless", icon: "✨", name: "Pure Logic", desc: "Solve without using a hint.", stat: "noHintSolves", goal: 1 },
    { id: "clean", icon: "🛡️", name: "First Try", desc: "Solve without undo, redo or reset.", stat: "cleanSolves", goal: 1 },
    { id: "unmarked", icon: "🚫", name: "Unmarked", desc: "Solve without placing any X marks.", stat: "noMarkSolves", goal: 1 },
    { id: "hint", icon: "💡", name: "Hint Master", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "hint10", icon: "🔦", name: "Hint Collector", desc: "Use 10 hints.", stat: "hintsUsed", goal: 10 },
    { id: "undo", icon: "↶", name: "Second Thoughts", desc: "Use undo.", stat: "undos", goal: 1 },
    { id: "branch", icon: "🌿", name: "What If?", desc: "Try a hypothesis branch.", stat: "branches", goal: 1 },
    { id: "mark", icon: "✕", name: "Crossed Out", desc: "Place 25 X marks.", stat: "marks", goal: 25 },
    { id: "edges100", icon: "🧵", name: "Line Worker", desc: "Place 100 player lines.", stat: "edgesPlaced", goal: 100 },
    { id: "edges500", icon: "🏗️", name: "Grid Master", desc: "Place 500 player lines.", stat: "edgesPlaced", goal: 500 },
    { id: "attack", icon: "⏱️", name: "Against the Clock", desc: "Win a Time Attack.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily puzzle.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Solve between midnight and 5 AM.", stat: "nightSolves", goal: 1 },
  ];

  const DEFAULT_STATS = {
    solves: 0,
    solvesEasy: 0,
    solvesMedium: 0,
    solvesHard: 0,
    solvesExpert: 0,
    bestTime: 0,
    bestScore: 0,
    totalTime: 0,
    noHintSolves: 0,
    cleanSolves: 0,
    noMarkSolves: 0,
    hintsUsed: 0,
    undos: 0,
    resets: 0,
    branches: 0,
    marks: 0,
    edgesPlaced: 0,
    attackWins: 0,
    dailySolves: 0,
    nightSolves: 0,
  };

  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- Storage ----------
  const store = Arcade.store;

  const K = {
    best: (mode, diff) => `grand-tour-best-v1-${mode}-${diff}`,
    stats: "grand-tour-stats-v1",
    achv: "grand-tour-achv-v1",
    sound: "grand-tour-sound",
    mode: "grand-tour-mode",
    diff: "grand-tour-diff",
    daily: "grand-tour-daily-v1",
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

  // ---------- Audio ----------
  const soundCtl = Arcade.audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });
  let soundOn = soundCtl.enabled;
  let actx = null;

  Arcade.audio.define("place", [
    [520, 0, 0.06, "triangle", 0.035],
    [780, 0.035, 0.055, "triangle", 0.022],
  ]);
  Arcade.audio.define("erase", [
    [300, 0, 0.06, "sine", 0.028, 190],
  ]);
  Arcade.audio.define("mark", [
    [240, 0, 0.05, "square", 0.02, 180],
  ]);
  Arcade.audio.define("error", [
    [180, 0, 0.15, "sawtooth", 0.04, 95],
  ]);
  Arcade.audio.define("hint", [
    [440, 0, 0.08, "sine", 0.038],
    [660, 0.07, 0.1, "sine", 0.038],
  ]);
  Arcade.audio.define("score", [
    [660, 0, 0.07, "triangle", 0.04],
    [880, 0.06, 0.11, "triangle", 0.04],
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

  // ---------- Small helpers ----------
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function canEdit() {
    return state.started && !state.paused && !state.over && achvModal.hidden;
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

  function shuffle(arr, rand) {
    const r = rand || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ---------- Graph ----------
  function buildGraph(rows, cols) {
    const edgeA = [];
    const edgeB = [];
    const edgeIds = [];
    const edgeIndex = new Map();
    const inc = Array.from({ length: rows * cols }, () => []);

    const add = (id, a, b) => {
      const ei = edgeA.length;
      edgeA.push(a);
      edgeB.push(b);
      edgeIds.push(id);
      edgeIndex.set(id, ei);
      inc[a].push(ei);
      inc[b].push(ei);
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        add(`h${r}_${c}`, r * cols + c, r * cols + c + 1);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        add(`v${r}_${c}`, r * cols + c, (r + 1) * cols + c);
      }
    }

    return { rows, cols, V: rows * cols, E: edgeA.length, edgeA, edgeB, edgeIds, edgeIndex, inc };
  }

  const graphCache = new Map();
  function getGraph(rows, cols) {
    const key = `${rows}x${cols}`;
    if (!graphCache.has(key)) graphCache.set(key, buildGraph(rows, cols));
    return graphCache.get(key);
  }

  function edgeIdBetween(a, b, cols) {
    const r1 = Math.floor(a / cols);
    const c1 = a % cols;
    const r2 = Math.floor(b / cols);
    const c2 = b % cols;
    if (r1 === r2) return `h${r1}_${Math.min(c1, c2)}`;
    return `v${Math.min(r1, r2)}_${c1}`;
  }

  // ---------- Cycle generation ----------
  // A simple Hamiltonian cycle for a grid with an even number of columns.
  // The top row is reserved as the return corridor.
  function buildBaseCycleEvenCols(rows, cols) {
    const cycle = [];
    for (let r = 0; r < rows; r++) cycle.push(r * cols);
    for (let c = 1; c < cols; c++) {
      if (c % 2 === 1) {
        for (let r = rows - 1; r >= 1; r--) cycle.push(r * cols + c);
      } else {
        for (let r = 1; r < rows; r++) cycle.push(r * cols + c);
      }
    }
    for (let c = cols - 1; c >= 1; c--) cycle.push(c);
    return cycle;
  }

  function buildBaseCycle(rows, cols) {
    if (cols % 2 === 0) return buildBaseCycleEvenCols(rows, cols);
    // Transpose a grid with an even number of columns.
    const transposed = buildBaseCycleEvenCols(cols, rows);
    return transposed.map((v) => {
      const r2 = Math.floor(v / rows);
      const c2 = v % rows;
      return c2 * cols + r2;
    });
  }

  // Random 2-opt switches preserve a single Hamiltonian cycle.
  function randomizeCycle(cycle, rand, rows, cols, iterations) {
    const n = cycle.length;
    const adjacent = (a, b) => {
      const r1 = Math.floor(a / cols);
      const c1 = a % cols;
      const r2 = Math.floor(b / cols);
      const c2 = b % cols;
      return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    };

    for (let it = 0; it < iterations; it++) {
      let i = Math.floor(rand() * (n - 1));
      let j = i + 1 + Math.floor(rand() * (n - 1 - i));
      if (j - i < 2) continue;
      if (i === 0 && j === n - 1) continue;

      const a = cycle[i];
      const b = cycle[j];
      const c = cycle[i + 1];
      const d = cycle[(j + 1) % n];
      if (!adjacent(a, b) || !adjacent(c, d)) continue;

      const head = cycle.slice(0, i + 1);
      const mid = cycle.slice(i + 1, j + 1).reverse();
      const tail = cycle.slice(j + 1);
      cycle.length = 0;
      cycle.push(...head, ...mid, ...tail);
    }
  }

  function cycleEdges(cycle, cols) {
    const set = new Set();
    const n = cycle.length;
    for (let i = 0; i < n; i++) {
      set.add(edgeIdBetween(cycle[i], cycle[(i + 1) % n], cols));
    }
    return set;
  }

  function cycleIsValid(cycle, rows, cols) {
    const n = rows * cols;
    if (cycle.length !== n) return false;
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = cycle[i];
      if (v < 0 || v >= n || seen[v]) return false;
      seen[v] = 1;
      if (i > 0) {
        const p = cycle[i - 1];
        const r1 = Math.floor(p / cols);
        const c1 = p % cols;
        const r2 = Math.floor(v / cols);
        const c2 = v % cols;
        if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
      }
    }
    const first = cycle[0];
    const last = cycle[n - 1];
    const r1 = Math.floor(first / cols);
    const c1 = first % cols;
    const r2 = Math.floor(last / cols);
    const c2 = last % cols;
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  // ---------- Solution counter ----------
  function findIn(parent, x) {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  }

  // Counts Hamiltonian cycles containing every clue edge, stopping at `limit`.
  // Returns { count, capped }. `capped` means the search budget ran out, so the
  // caller must treat the result as "not proven unique".
  function countSolutions(graph, clueSet, limit, maxNodes) {
    const { edgeA, edgeB, edgeIndex, inc, V, E } = graph;
    const st = new Int8Array(E);
    const deg = new Int32Array(V);
    const parent = new Int32Array(V);
    const size = new Int32Array(V);
    for (let i = 0; i < V; i++) {
      parent[i] = i;
      size[i] = 1;
    }

    let nodes = 0;
    let capped = false;
    let solutions = 0;

    function applyOn(s, d, p, sz, ei) {
      if (s[ei] === 1) return true;
      if (s[ei] === -1) return false;
      const a = edgeA[ei];
      const b = edgeB[ei];
      if (d[a] >= 2 || d[b] >= 2) return false;

      let ra = findIn(p, a);
      let rb = findIn(p, b);
      if (ra === rb) {
        if (sz[ra] !== V) return false;
      } else {
        if (sz[ra] < sz[rb]) {
          const tmp = ra;
          ra = rb;
          rb = tmp;
        }
        p[rb] = ra;
        sz[ra] += sz[rb];
      }

      s[ei] = 1;
      d[a]++;
      d[b]++;
      return true;
    }

    for (const id of clueSet) {
      const ei = edgeIndex.get(id);
      if (ei === undefined) continue;
      if (!applyOn(st, deg, parent, size, ei)) return { count: 0, capped: false };
    }

    function dfs(s, d, p, sz) {
      if (capped) return;
      nodes++;
      if (nodes > maxNodes) {
        capped = true;
        return;
      }

      // Propagate forced edges and forced-off edges until stable.
      let changed = true;
      let guard = 0;
      while (changed) {
        if (capped) return;
        if (++guard > 4 * V + 32) {
          capped = true;
          return;
        }
        changed = false;

        for (let v = 0; v < V; v++) {
          if (d[v] > 2) return;
          let avail = 0;
          for (let k = 0; k < inc[v].length; k++) {
            if (s[inc[v][k]] !== -1) avail++;
          }
          const need = 2 - d[v];
          if (need < 0) return;
          if (avail < need) return;

          if (d[v] === 2) {
            let off = false;
            for (let k = 0; k < inc[v].length; k++) {
              const ei = inc[v][k];
              if (s[ei] === 0) {
                s[ei] = -1;
                off = true;
              }
            }
            if (off) changed = true;
          } else if (avail === need) {
            for (let k = 0; k < inc[v].length; k++) {
              const ei = inc[v][k];
              if (s[ei] !== 0) continue;
              if (!applyOn(s, d, p, sz, ei)) return;
              changed = true;
            }
          }
        }
      }
      if (capped) return;

      let allTwo = true;
      for (let v = 0; v < V; v++) {
        if (d[v] !== 2) {
          allTwo = false;
          break;
        }
      }

      if (allTwo) {
        const r0 = findIn(p, 0);
        let connected = true;
        for (let v = 1; v < V; v++) {
          if (findIn(p, v) !== r0) {
            connected = false;
            break;
          }
        }
        if (connected) solutions++;
        return;
      }

      let bestV = -1;
      let bestAvail = Infinity;
      let bestNeed = 0;
      for (let v = 0; v < V; v++) {
        if (d[v] >= 2) continue;
        let avail = 0;
        for (let k = 0; k < inc[v].length; k++) {
          if (s[inc[v][k]] !== -1) avail++;
        }
        const need = 2 - d[v];
        if (avail < need) return;
        if (avail < bestAvail) {
          bestAvail = avail;
          bestV = v;
          bestNeed = need;
        }
      }
      if (bestV < 0) return;

      const opts = [];
      for (let k = 0; k < inc[bestV].length; k++) {
        const ei = inc[bestV][k];
        if (s[ei] === 0) opts.push(ei);
      }
      if (opts.length < bestNeed) return;

      if (bestNeed === 1) {
        for (let i = 0; i < opts.length; i++) {
          if (capped || solutions >= limit) return;
          const ns = s.slice();
          const nd = d.slice();
          const np = p.slice();
          const nsz = sz.slice();
          if (applyOn(ns, nd, np, nsz, opts[i])) dfs(ns, nd, np, nsz);
        }
      } else {
        for (let i = 0; i < opts.length - 1; i++) {
          for (let j = i + 1; j < opts.length; j++) {
            if (capped || solutions >= limit) return;
            const ns = s.slice();
            const nd = d.slice();
            const np = p.slice();
            const nsz = sz.slice();
            if (applyOn(ns, nd, np, nsz, opts[i]) && applyOn(ns, nd, np, nsz, opts[j])) {
              dfs(ns, nd, np, nsz);
            }
          }
        }
      }
    }

    dfs(st, deg, parent, size);
    return { count: solutions, capped };
  }

  // ---------- Puzzle generation ----------
  function generatePuzzle(diffKey, seedStr) {
    const cfg = DIFFS[diffKey] || DIFFS.medium;
    const rand = seedStr ? mulberry32(hashSeed(seedStr)) : Math.random;
    const rows = cfg.rows;
    const cols = cfg.cols;
    const graph = getGraph(rows, cols);

    let cycle = buildBaseCycle(rows, cols);
    if (!cycleIsValid(cycle, rows, cols)) {
      // Should never happen, but never ship a broken board.
      cycle = buildBaseCycleEvenCols(rows, cols);
    }
    randomizeCycle(cycle, rand, rows, cols, Math.max(900, rows * cols * 60));
    if (!cycleIsValid(cycle, rows, cols)) {
      cycle = buildBaseCycle(rows, cols);
    }

    const solution = cycleEdges(cycle, cols);
    const solutionEdges = Array.from(solution);
    const shuffled = shuffle(solutionEdges.slice(), rand);
    const clues = new Set();
    const budget = 220000;

    // Add clue edges until the solution is unique.
    for (const id of shuffled) {
      clues.add(id);
      const res = countSolutions(graph, clues, 2, budget);
      if (res.count === 1 && !res.capped) break;
    }

    const target = Math.max(4, Math.round(solution.size * cfg.target));
    if (clues.size < target) {
      // Easier difficulty: keep more starting edges.
      for (const id of shuffled) {
        if (clues.size >= target) break;
        clues.add(id);
      }
    } else if (clues.size > target) {
      // Harder difficulty: try to unlock redundant clues.
      const order = shuffle(Array.from(clues), rand);
      for (const id of order) {
        if (clues.size <= target) break;
        clues.delete(id);
        const res = countSolutions(graph, clues, 2, budget);
        if (!(res.count === 1 && !res.capped)) clues.add(id);
      }
    }

    // Final safety check: the shipped puzzle must have exactly one solution.
    const check = countSolutions(graph, clues, 2, budget);
    if (!(check.count === 1 && !check.capped)) {
      for (const id of solution) clues.add(id);
    }

    return { rows, cols, graph, solution, clues };
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "medium",
    rows: 6,
    cols: 6,
    graph: null,
    solution: new Set(),
    clues: new Set(),
    lines: new Set(),
    marks: new Set(),
    history: [],
    future: [],
    branching: false,
    branchTouched: new Set(),
    branchSnapshot: null,
    markMode: false,
    hintsLeft: 3,
    hintsUsed: 0,
    undos: 0,
    redos: 0,
    resets: 0,
    marksUsed: 0,
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    won: false,
    score: 0,
  };

  let edgeEls = new Map();
  let dotEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  const paint = { active: false, value: false };

  // ---------- Toasts ----------
  // ---------- Achievements ----------
  toast.bind(document.getElementById("toasts"));

  // Time-based badges are "lower is better"; give them a predicate and a
  // progress bar that fills as the time drops.
  const INVERTED_STATS = ["bestTime"];
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
      ["Lines placed", stats.edgesPlaced],
      ["Best score", stats.bestScore],
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
    if (p) paint.active = false;
    state.paused = p;
    pauseBtn.textContent = p ? "▶ Resume" : "Pause";
    if (p && !silent) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); newPuzzle(); } },
      ]);
    } else if (!p) {
      hideOverlay();
    }
  }

  function togglePause() {
    if (state.over || !state.started) return;
    setPaused(!state.paused, false);
  }

  // ---------- Board geometry ----------
  function edgeGeom(id, cell, pad) {
    const parts = id.slice(1).split("_");
    const r = Number(parts[0]);
    const c = Number(parts[1]);
    if (id.charAt(0) === "h") {
      const x1 = pad + c * cell;
      const y1 = pad + r * cell;
      return { x1, y1, x2: x1 + cell, y2: y1, mx: x1 + cell / 2, my: y1 };
    }
    const x1 = pad + c * cell;
    const y1 = pad + r * cell;
    return { x1, y1, x2: x1, y2: y1 + cell, mx: x1, my: y1 + cell / 2 };
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const k in attrs) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function buildBoard() {
    const { rows, cols, graph } = state;
    if (!graph) return;
    const cell = 64;
    const pad = 30;
    const w = (cols - 1) * cell + pad * 2;
    const h = (rows - 1) * cell + pad * 2;

    const svg = boardEl;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const bg = svgEl("rect", {
      x: 0,
      y: 0,
      width: w,
      height: h,
      rx: 18,
      class: "gt-bg",
      "aria-hidden": "true",
    });
    svg.appendChild(bg);

    const edgeLayer = svgEl("g", { class: "gt-layer-edges" });
    edgeEls = new Map();
    for (const id of graph.edgeIds) {
      const g = edgeGeom(id, cell, pad);
      const group = svgEl("g", {
        class: "gt-edge",
        "data-edge": id,
        tabindex: "0",
        focusable: "true",
        role: "button",
      });
      const line = svgEl("line", {
        x1: g.x1,
        y1: g.y1,
        x2: g.x2,
        y2: g.y2,
        class: "gt-line",
      });
      const mark = svgEl("g", { class: "gt-mark", transform: `translate(${g.mx} ${g.my})` });
      mark.appendChild(svgEl("line", { x1: -6, y1: -6, x2: 6, y2: 6 }));
      mark.appendChild(svgEl("line", { x1: 6, y1: -6, x2: -6, y2: 6 }));
      const hit = svgEl("line", {
        x1: g.x1,
        y1: g.y1,
        x2: g.x2,
        y2: g.y2,
        class: "gt-hit",
      });
      group.appendChild(line);
      group.appendChild(mark);
      group.appendChild(hit);
      edgeLayer.appendChild(group);
      edgeEls.set(id, { g: group, line, mark, hit, ...g });
    }
    svg.appendChild(edgeLayer);

    const dotLayer = svgEl("g", { class: "gt-layer-dots", "aria-hidden": "true" });
    dotEls = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dot = svgEl("circle", {
          cx: pad + c * cell,
          cy: pad + r * cell,
          r: 4.6,
          class: "gt-dot",
        });
        dotLayer.appendChild(dot);
        dotEls.push(dot);
      }
    }
    svg.appendChild(dotLayer);
    updateMarkCursor();
  }

  function edgeLabel(id) {
    const parts = id.slice(1).split("_");
    const r = Number(parts[0]);
    const c = Number(parts[1]);
    if (id.charAt(0) === "h") {
      return `Horizontal edge, row ${r + 1}, column ${c + 1} to ${c + 2}`;
    }
    return `Vertical edge, row ${r + 1} to ${r + 2}, column ${c + 1}`;
  }

  function currentDegrees() {
    const deg = new Int32Array(state.graph ? state.graph.V : 0);
    if (!state.graph) return deg;
    for (const id of state.clues) {
      const ei = state.graph.edgeIndex.get(id);
      if (ei === undefined) continue;
      deg[state.graph.edgeA[ei]]++;
      deg[state.graph.edgeB[ei]]++;
    }
    for (const id of state.lines) {
      if (state.clues.has(id)) continue;
      const ei = state.graph.edgeIndex.get(id);
      if (ei === undefined) continue;
      deg[state.graph.edgeA[ei]]++;
      deg[state.graph.edgeB[ei]]++;
    }
    return deg;
  }

  function renderBoard() {
    if (!state.graph) return;
    const deg = currentDegrees();
    for (const id of state.graph.edgeIds) {
      const els = edgeEls.get(id);
      if (!els) continue;
      const clue = state.clues.has(id);
      const line = state.lines.has(id);
      const branch = state.branching && state.branchTouched.has(id) && line;
      els.line.setAttribute(
        "class",
        "gt-line " +
          (clue
            ? "gt-line--clue"
            : line
              ? branch
                ? "gt-line--branch"
                : "gt-line--player"
              : "gt-line--off")
      );
      els.line.style.display = clue || line ? "" : "none";
      els.mark.style.display = !clue && !line && state.marks.has(id) ? "" : "none";

      let label = edgeLabel(id);
      if (clue) label += ", locked clue";
      else if (line) label += branch ? ", branch line" : ", line";
      else if (state.marks.has(id)) label += ", marked no line";
      else label += ", empty";
      els.g.setAttribute("aria-label", label);
      els.g.setAttribute("aria-pressed", clue || line ? "true" : "false");
    }

    for (let v = 0; v < state.graph.V; v++) {
      const el = dotEls[v];
      if (!el) continue;
      const d = deg[v];
      el.setAttribute(
        "class",
        "gt-dot" +
          (d === 1 ? " gt-dot--deg1" : d > 2 ? " gt-dot--deg3" : d === 0 ? " gt-dot--deg0" : "")
      );
    }
  }

  function updateMarkCursor() {
    boardEl.classList.toggle("gt-board--mark", state.markMode);
    markBtn.setAttribute("aria-pressed", state.markMode ? "true" : "false");
    markBtn.textContent = state.markMode ? "✕ Marking" : "✕ Mark";
  }

  // ---------- History ----------
  function snapshot() {
    return { lines: Array.from(state.lines), marks: Array.from(state.marks) };
  }

  function restoreSnapshot(snap) {
    state.lines = new Set(snap.lines);
    state.marks = new Set(snap.marks);
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 400) state.history.shift();
    state.future.length = 0;
  }

  function undo() {
    if (!canEdit()) return;
    const prev = state.history.pop();
    if (!prev) {
      toast.show("Nothing to undo", "Every move so far is still ahead of you.", "↶");
      return;
    }
    state.future.push(snapshot());
    restoreSnapshot(prev);
    state.undos++;
    stats.undos++;
    state.score = Math.max(0, state.score - 10);
    sfx("click");
    afterChange();
  }

  function redo() {
    if (!canEdit()) return;
    const next = state.future.pop();
    if (!next) {
      toast.show("Nothing to redo", "You're at the latest move.", "↷");
      return;
    }
    state.history.push(snapshot());
    if (state.history.length > 400) state.history.shift();
    restoreSnapshot(next);
    state.redos++;
    state.score += 5;
    sfx("click");
    afterChange();
  }

  // ---------- Actions ----------
  function applyLine(id, on) {
    if (!canEdit()) return false;
    if (state.clues.has(id)) return false;
    const has = state.lines.has(id);
    if (on === has) return false;

    pushHistory();
    if (on) {
      state.lines.add(id);
      state.marks.delete(id);
      state.score += 10;
      stats.edgesPlaced++;
      if (state.branching) state.branchTouched.add(id);
      sfx("place");
    } else {
      state.lines.delete(id);
      state.score = Math.max(0, state.score - 5);
      sfx("erase");
    }
    afterChange();
    return true;
  }

  function toggleMark(id) {
    if (!canEdit()) return;
    if (state.clues.has(id)) {
      lockedFeedback(id);
      return;
    }
    pushHistory();
    if (state.marks.has(id)) {
      state.marks.delete(id);
      state.score = Math.max(0, state.score - 1);
      sfx("erase");
    } else {
      state.marks.add(id);
      if (state.lines.has(id)) state.lines.delete(id);
      state.score += 2;
      stats.marks++;
      state.marksUsed++;
      if (state.branching) state.branchTouched.add(id);
      sfx("mark");
    }
    afterChange();
  }

  function useHint() {
    if (!canEdit()) return;
    if (state.mode !== "zen" && state.hintsLeft <= 0) {
      toast.show("No hints left", "You've used all your hints for this puzzle.", "💡");
      sfx("error");
      return;
    }

    const missing = [];
    for (const id of state.solution) {
      if (!state.clues.has(id) && !state.lines.has(id)) missing.push(id);
    }
    if (!missing.length) {
      checkBoard(true);
      return;
    }

    // Prefer an edge whose endpoints both have room for another line.
    const deg = currentDegrees();
    let candidates = [];
    for (const id of missing) {
      const ei = state.graph.edgeIndex.get(id);
      if (ei === undefined) continue;
      const a = state.graph.edgeA[ei];
      const b = state.graph.edgeB[ei];
      if (deg[a] < 2 && deg[b] < 2) candidates.push(id);
    }
    if (!candidates.length) candidates = missing;

    const id = candidates[Math.floor(Math.random() * candidates.length)];
    pushHistory();
    state.lines.add(id);
    state.marks.delete(id);
    state.score = Math.max(0, state.score - 50);
    state.hintsUsed++;
    stats.hintsUsed++;
    if (state.mode !== "zen") state.hintsLeft--;
    if (state.branching) state.branchTouched.add(id);
    sfx("hint");
    flashEdge(id);
    afterChange();
  }

  function lockedFeedback(id) {
    sfx("error");
    const els = edgeEls.get(id);
    if (els) {
      els.g.classList.remove("gt-edge--bad");
      void els.g.getBoundingClientRect();
      els.g.classList.add("gt-edge--bad");
      window.setTimeout(() => els.g.classList.remove("gt-edge--bad"), 420);
    }
    toast.show("Locked clue", "Starting edges can't be changed.", "🔒");
  }

  function flashEdge(id) {
    const els = edgeEls.get(id);
    if (!els) return;
    els.g.classList.remove("gt-edge--hint");
    void els.g.getBoundingClientRect();
    els.g.classList.add("gt-edge--hint");
    window.setTimeout(() => els.g.classList.remove("gt-edge--hint"), 950);
  }

  // ---------- Branch mode ----------
  function enterBranch() {
    if (!canEdit() || state.branching) return;
    state.branchSnapshot = {
      snap: snapshot(),
      history: state.history.slice(),
      future: state.future.slice(),
    };
    state.branching = true;
    state.branchTouched = new Set();
    stats.branches++;
    saveStats();
    branchBar.hidden = false;
    branchBtn.setAttribute("aria-pressed", "true");
    branchBtn.textContent = "🌿 Branching";
    sfx("click");
    toast.show("Hypothesis mode", "Test a path — Keep or Discard when you're done.", "🌿");
    updateHUD();
    renderBoard();
    checkAchievements();
  }

  function keepBranch() {
    if (!state.branching) return;
    state.branching = false;
    state.branchTouched.clear();
    state.branchSnapshot = null;
    branchBar.hidden = true;
    branchBtn.setAttribute("aria-pressed", "false");
    branchBtn.textContent = "🌿 Branch";
    toast.show("Branch kept", "Those lines are now part of your solution.", "✅");
    sfx("score");
    afterChange();
  }

  function discardBranch() {
    if (!state.branching || !state.branchSnapshot) return;
    state.lines = new Set(state.branchSnapshot.snap.lines);
    state.marks = new Set(state.branchSnapshot.snap.marks);
    state.history = state.branchSnapshot.history.slice();
    state.future = state.branchSnapshot.future.slice();
    state.branching = false;
    state.branchTouched.clear();
    state.branchSnapshot = null;
    branchBar.hidden = true;
    branchBtn.setAttribute("aria-pressed", "false");
    branchBtn.textContent = "🌿 Branch";
    toast.show("Branch discarded", "Back to where you were.", "↩️");
    sfx("erase");
    afterChange();
  }

  function cancelBranch() {
    state.branching = false;
    state.branchTouched.clear();
    state.branchSnapshot = null;
    branchBar.hidden = true;
    branchBtn.setAttribute("aria-pressed", "false");
    branchBtn.textContent = "🌿 Branch";
  }

  function toggleBranch() {
    if (state.branching) discardBranch();
    else enterBranch();
  }

  // ---------- Win / lose ----------
  function evaluateBoard() {
    const { graph, clues, lines } = state;
    if (!graph) return { solved: false, reason: "empty" };

    const V = graph.V;
    const deg = new Int32Array(V);
    const on = [];

    for (const id of clues) {
      const ei = graph.edgeIndex.get(id);
      if (ei === undefined) return { solved: false, reason: "clue" };
      deg[graph.edgeA[ei]]++;
      deg[graph.edgeB[ei]]++;
      on.push(ei);
    }
    for (const id of lines) {
      if (clues.has(id)) continue;
      const ei = graph.edgeIndex.get(id);
      if (ei === undefined) continue;
      deg[graph.edgeA[ei]]++;
      deg[graph.edgeB[ei]]++;
      on.push(ei);
    }

    let zero = 0;
    let one = 0;
    let tooMany = 0;
    for (let v = 0; v < V; v++) {
      if (deg[v] === 0) zero++;
      else if (deg[v] === 1) one++;
      else if (deg[v] > 2) tooMany++;
    }
    if (zero || one || tooMany) {
      return { solved: false, reason: "degree", zero, one, tooMany };
    }

    // Every dot has degree two. A 2-regular graph is a disjoint union of
    // cycles, so count components to reject multiple mini-loops.
    const adj = Array.from({ length: V }, () => []);
    for (const ei of on) {
      const a = graph.edgeA[ei];
      const b = graph.edgeB[ei];
      adj[a].push(b);
      adj[b].push(a);
    }
    const seen = new Uint8Array(V);
    let components = 0;
    for (let s = 0; s < V; s++) {
      if (seen[s]) continue;
      components++;
      const stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const v = stack.pop();
        for (const w of adj[v]) {
          if (!seen[w]) {
            seen[w] = 1;
            stack.push(w);
          }
        }
      }
    }

    // No crossings are possible: every edge joins orthogonally adjacent dots,
    // so edges can only meet at shared vertices.
    if (components === 1) return { solved: true, reason: "solved", components };
    return { solved: false, reason: "loops", components };
  }

  function checkBoard(silent) {
    if (!state.started || state.over) return false;
    const res = evaluateBoard();
    if (res.solved) {
      win();
      return true;
    }
    if (!silent) {
      let msg;
      if (res.reason === "degree") {
        if (res.tooMany > 0) {
          msg = `${res.tooMany} dot${res.tooMany === 1 ? " has" : "s have"} more than two lines — every dot needs exactly two.`;
        } else if (res.one > 0 && res.zero > 0) {
          msg = `${res.one} open end${res.one === 1 ? "" : "s"} and ${res.zero} empty dot${res.zero === 1 ? "" : "s"} — keep connecting.`;
        } else if (res.one > 0) {
          msg = `${res.one} open end${res.one === 1 ? "" : "s"} — keep going until every dot has two lines.`;
        } else {
          msg = `${res.zero} dot${res.zero === 1 ? " is" : "s are"} still empty.`;
        }
      } else if (res.reason === "loops") {
        msg = `${res.components} separate loops — join them into one single circuit.`;
      } else {
        msg = "Keep drawing — every dot needs two lines and one single loop.";
      }
      toast.show("Not quite yet", msg, "🔎");
      sfx("click");
    }
    return false;
  }

  function win() {
    if (state.over || !state.started) return;
    if (!evaluateBoard().solved) return;

    state.over = true;
    state.won = true;
    state.paused = false;
    paint.active = false;

    const cfg = DIFFS[state.diff];
    const secs = state.elapsed / 1000;
    const timeBonus = state.mode === "zen" ? 0 : Math.max(0, cfg.par - secs) * 5;
    let bonus = cfg.bonus + timeBonus;
    if (state.mode === "attack") bonus += 500;
    if (state.mode === "daily") bonus += 300;
    state.score += Math.round(bonus);
    stats.bestScore = Math.max(stats.bestScore || 0, state.score);

    stats.solves++;
    stats["solves" + cap(state.diff)]++;
    if (state.mode !== "zen") {
      const elapsedMs = Math.max(1, Math.round(state.elapsed));
      stats.totalTime += elapsedMs;
      if (!stats.bestTime || elapsedMs < stats.bestTime) stats.bestTime = elapsedMs;
    }
    if (state.hintsUsed === 0) stats.noHintSolves++;
    if (state.hintsUsed === 0 && state.undos === 0 && state.redos === 0 && state.resets === 0) {
      stats.cleanSolves++;
    }
    if (state.marksUsed === 0) stats.noMarkSolves++;
    if (state.mode === "attack") stats.attackWins++;
    if (new Date().getHours() < 5) stats.nightSolves++;

    const prevBest = store.json(K.best(state.mode, state.diff), null);
    const prevTime = prevBest && prevBest.t ? prevBest.t : 0;
    const elapsedMs = Math.max(1, Math.round(state.elapsed));
    const isRecord = state.mode !== "zen" && (!prevTime || elapsedMs < prevTime);

    saveStats();
    saveBest(true);
    if (state.mode === "daily") recordDailyWin();
    checkAchievements();
    updateHUD();
    sfx("win");
    confetti();

    const timeText = state.mode === "zen" ? "Zen solve" : formatTime(state.elapsed);
    const msg =
      `${cfg.name} · ${state.rows}×${state.cols} · ${timeText} · Score ${state.score}` +
      (state.hintsUsed === 0 ? " · No hints ✨" : "") +
      (isRecord ? " · New Best!" : "");

    showOverlay("Solved! 🎉", msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); newPuzzle(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function lose(title, msg) {
    if (state.over) return;
    cancelBranch();
    paint.active = false;
    state.over = true;
    state.won = false;
    state.paused = false;
    stats.totalTime += Math.round(state.elapsed);
    saveStats();
    saveBest(false);
    sfx("over");
    updateHUD();
    showOverlay(title, msg, [
      { label: "Try Again", onClick: () => { hideOverlay(); newPuzzle(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function saveBest(won) {
    if (state.mode === "zen") return;
    const key = K.best(state.mode, state.diff);
    const prev = store.json(key, null);
    const t = won ? Math.max(1, Math.round(state.elapsed)) : (prev && prev.t) || 0;
    const s = Math.max((prev && prev.s) || 0, state.score);
    store.jsonSet(key, { t, s });
  }

  function recordDailyWin() {
    if (state.mode !== "daily") return;
    const today = dateStr();
    if (daily.lastDate === today) return;
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dateStr(yesterdayDate);
    daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { t: Math.max(1, Math.round(state.elapsed)), d: state.diff };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
    saveStats();
  }

  // ---------- Effects ----------
  // Provided by the shared core.
  const confetti = (count) => Arcade.confetti(count === undefined ? 80 : count);

  // ---------- HUD ----------
  function bestLabel() {
    if (state.mode === "zen") return "—";
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.t) return "—";
    return formatTime(rec.t);
  }

  function updateHUD() {
    if (!state.graph) return;
    const on = state.clues.size + state.lines.size;
    edgesEl.textContent = `${on}/${state.graph.V}`;
    edgesEl.classList.toggle("is-danger", on > state.graph.V);
    dotsEl.textContent = String(state.graph.V);
    hintsEl.textContent = state.mode === "zen" ? "∞" : String(state.hintsLeft);
    scoreEl.textContent = String(state.score);
    bestEl.textContent = bestLabel();
    undoBtn.disabled = !state.history.length || !canEdit();
    redoBtn.disabled = !state.future.length || !canEdit();
    hintBtn.disabled = state.mode !== "zen" && state.hintsLeft <= 0;
  }

  function updateTimeDisplay() {
    let text;
    if (state.mode === "zen") text = "∞";
    else if (MODES[state.mode].timed) text = formatTime(state.remaining);
    else text = formatTime(state.elapsed);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    timeEl.classList.toggle(
      "is-danger",
      MODES[state.mode].timed && state.remaining <= 30000 && state.started && !state.over
    );
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
    let text = cfg.hint;
    if (state.mode === "daily") text += ` · Streak ${daily.streak}d`;
    if (state.diff) text += ` · ${DIFFS[state.diff].name}`;
    text += " · Click or drag an edge · Right-click to mark ✕";
    hintEl.textContent = text;
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    newGameBtn.disabled = state.mode === "daily";
    updateHint();
    updateHUD();
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // ---------- Game flow ----------
  function newPuzzle() {
    hideOverlay();
    cancelBranch();
    paint.active = false;

    const seed = state.mode === "daily" ? `${dateStr()}-${state.diff}` : null;
    const gen = generatePuzzle(state.diff, seed);

    state.rows = gen.rows;
    state.cols = gen.cols;
    state.graph = gen.graph;
    state.solution = gen.solution;
    state.clues = gen.clues;
    state.lines = new Set();
    state.marks = new Set();
    state.history = [];
    state.future = [];
    state.branchTouched = new Set();
    state.branchSnapshot = null;
    state.markMode = false;
    state.score = 0;
    state.hintsLeft = MODES[state.mode].hints;
    state.hintsUsed = 0;
    state.undos = 0;
    state.redos = 0;
    state.resets = 0;
    state.marksUsed = 0;
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed ? DIFFS[state.diff].timeLimit * 1000 : 0;
    state.started = false;
    state.countdown = 1200;
    state.paused = false;
    state.over = false;
    state.won = false;
    lastTimeText = "";
    pauseBtn.textContent = "Pause";
    branchBar.hidden = true;
    branchBtn.setAttribute("aria-pressed", "false");
    branchBtn.textContent = "🌿 Branch";

    buildBoard();
    renderBoard();
    updateModeUI();
    updateCountdown();
    updateTimeDisplay();
    updateHUD();
    updateMarkCursor();
    lastTs = performance.now();
  }

  function resetProgress() {
    hideOverlay();
    cancelBranch();
    paint.active = false;
    pushHistory();
    state.lines.clear();
    state.marks.clear();
    state.score = Math.max(0, state.score - 100);
    state.resets++;
    stats.resets++;
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed ? DIFFS[state.diff].timeLimit * 1000 : 0;
    state.started = true;
    state.countdown = 0;
    state.paused = false;
    state.over = false;
    state.won = false;
    pauseBtn.textContent = "Pause";
    lastTimeText = "";
    updateCountdown();
    updateTimeDisplay();
    updateHUD();
    renderBoard();
    saveStats();
    sfx("erase");
    toast.show("Progress reset", "Your lines are cleared — the clues stay locked.", "↺");
  }

  function setMode(m, force) {
    if (!MODES[m]) return;
    const changed = m !== state.mode;
    state.mode = m;
    store.set(K.mode, m);
    updateModeUI();
    if (changed || force) newPuzzle();
  }

  function setDiff(d) {
    if (!DIFFS[d]) return;
    if (d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === d ? "true" : "false")
    );
    newPuzzle();
  }

  function startPlay() {
    if (state.started) return;
    state.started = true;
    state.countdown = 0;
    updateCountdown();
    sfx("click");
    updateHUD();
  }

  function afterChange() {
    renderBoard();
    updateHUD();
    checkAchievements();
    if (!state.branching) checkBoard(true);
  }

  // ---------- Main loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;

    if (!state.started && !state.over && !state.paused && achvModal.hidden) {
      state.countdown = Math.max(0, state.countdown - dt);
      if (state.countdown === 0) startPlay();
      updateCountdown();
    }

    if (state.started && !state.over && !state.paused && achvModal.hidden) {
      if (MODES[state.mode].timed) {
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          lose(
            "Time's up",
            `The clock beat you — ${state.clues.size + state.lines.size} of ${state.graph.V} edges placed.`
          );
          return;
        }
      } else if (state.mode !== "zen") {
        state.elapsed += dt;
      }
    }

    updateTimeDisplay();
  }

  // ---------- Input ----------
  function closestEdge(el) {
    let node = el;
    while (node && node !== boardEl) {
      if (node.dataset && node.dataset.edge) return node;
      node = node.parentNode;
    }
    return null;
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const group = closestEdge(e.target);
    if (!group) return;
    if (!canEdit()) return;
    const id = group.dataset.edge;

    if (group.focus) {
      try {
        group.focus({ preventScroll: true });
      } catch {
        /* older browsers */
      }
    }

    if (e.shiftKey) {
      e.preventDefault();
      toggleMark(id);
      return;
    }
    if (state.markMode) {
      e.preventDefault();
      toggleMark(id);
      return;
    }
    if (state.clues.has(id)) {
      e.preventDefault();
      lockedFeedback(id);
      return;
    }

    paint.active = true;
    paint.value = !state.lines.has(id);
    e.preventDefault();
    applyLine(id, paint.value);
  }

  function onPointerOver(e) {
    if (!paint.active) return;
    const group = closestEdge(e.target);
    if (!group) return;
    const id = group.dataset.edge;
    if (state.clues.has(id)) return;
    applyLine(id, paint.value);
  }

  function onPointerUp() {
    paint.active = false;
  }

  function onContextMenu(e) {
    const group = closestEdge(e.target);
    if (!group) return;
    e.preventDefault();
    if (!canEdit()) return;
    toggleMark(group.dataset.edge);
  }

  function onBoardKeyDown(e) {
    const group = closestEdge(e.target);
    if (!group) return;
    const id = group.dataset.edge;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!canEdit()) return;
      if (e.shiftKey || state.markMode) {
        toggleMark(id);
      } else if (state.clues.has(id)) {
        lockedFeedback(id);
      } else {
        applyLine(id, !state.lines.has(id));
      }
    } else if (e.key === "x" || e.key === "X") {
      e.preventDefault();
      toggleMark(id);
    }
  }

  function onKeyDown(e) {
    const k = e.key;
    const lower = k.toLowerCase();

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

    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    const onEdge = !!closestEdge(e.target);
    if (onEdge && (k === "Enter" || k === " " || lower === "x")) return;
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
      if (state.branching) {
        discardBranch();
        e.preventDefault();
      } else if (state.paused) {
        setPaused(false, true);
        e.preventDefault();
      }
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
        newPuzzle();
      }
      return;
    }

    if (state.paused) return;

    if (lower === "u") {
      undo();
      return;
    }
    if (lower === "h") {
      useHint();
      return;
    }
    if (lower === "b") {
      toggleBranch();
      return;
    }
    if (lower === "m") {
      state.markMode = !state.markMode;
      updateMarkCursor();
      updateHUD();
      toast.show(
        state.markMode ? "Mark mode on" : "Mark mode off",
        state.markMode ? "Tap edges to toggle ✕ marks." : "Tap edges to toggle lines.",
        state.markMode ? "✕" : "✏️"
      );
      sfx("click");
      return;
    }
    if (lower === "c") {
      checkBoard(false);
      return;
    }
    if (lower === "r") {
      resetProgress();
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

    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);
    hintBtn.addEventListener("click", useHint);
    branchBtn.addEventListener("click", toggleBranch);
    branchKeepBtn.addEventListener("click", keepBranch);
    branchDiscardBtn.addEventListener("click", discardBranch);
    markBtn.addEventListener("click", () => {
      state.markMode = !state.markMode;
      updateMarkCursor();
      updateHUD();
      toast.show(
        state.markMode ? "Mark mode on" : "Mark mode off",
        state.markMode ? "Tap edges to toggle ✕ marks." : "Tap edges to toggle lines.",
        state.markMode ? "✕" : "✏️"
      );
      sfx("click");
    });

    newGameBtn.addEventListener("click", () => {
      sfx("click");
      newPuzzle();
    });
    resetBtn.addEventListener("click", resetProgress);
    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });
    checkBtn.addEventListener("click", () => {
      sfx("click");
      checkBoard(false);
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

    boardEl.addEventListener("pointerdown", onPointerDown);
    boardEl.addEventListener("pointerover", onPointerOver);
    boardEl.addEventListener("pointerleave", onPointerUp);
    boardEl.addEventListener("contextmenu", onContextMenu);
    boardEl.addEventListener("keydown", onBoardKeyDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

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

    const savedDiff = store.get(K.diff, "medium");
    state.diff = DIFFS[savedDiff] ? savedDiff : "medium";

    updateSoundBtn();
    updateBadgeCount();
    bindEvents();

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    newPuzzle();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__GT = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    getGraph,
    buildGraph,
    buildBaseCycle,
    randomizeCycle,
    cycleIsValid,
    cycleEdges,
    countSolutions,
    generatePuzzle,
    edgeIdBetween,
    evaluateBoard,
    checkBoard,
    snapshot,
    restoreSnapshot,
    applyLine,
    toggleMark,
    useHint,
    undo,
    redo,
    resetProgress,
    newPuzzle,
    setMode,
    setDiff,
    enterBranch,
    keepBranch,
    discardBranch,
    currentDegrees,
    renderBoard,
    updateHUD,
    checkAchievements,
    saveStats,
    saveBest,
    win,
    lose,
    loop,
    startPlay,
    updateTimeDisplay,
    updateCountdown,
    setPaused,
    togglePause,
    buildBoard,
    unlocked: () => achv.list(),
    snap: () => ({
      mode: state.mode,
      diff: state.diff,
      rows: state.rows,
      cols: state.cols,
      clues: Array.from(state.clues),
      lines: Array.from(state.lines),
      marks: Array.from(state.marks),
      solution: Array.from(state.solution),
      score: state.score,
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
      undos: state.undos,
      redos: state.redos,
      resets: state.resets,
      marksUsed: state.marksUsed,
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      over: state.over,
      won: state.won,
      branching: state.branching,
      branchTouched: Array.from(state.branchTouched),
      markMode: state.markMode,
      history: state.history.length,
      future: state.future.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
      edgeEls: edgeEls.size,
      dotEls: dotEls.length,
    }),
  };

  init();
})();