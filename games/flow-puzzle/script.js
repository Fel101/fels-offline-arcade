// Flow — pure vanilla JS, fully offline. Pipe-connection puzzles.
//
// Each level is a FULL SOLUTION GRID of color ids (5 rows × 5 chars,
// every cell colored, '.' would mean "must be filled by pipes" and is
// unused here because all levels ship complete solutions). Endpoints
// (dots) are stored separately per color, so no inference is needed.
// All 8 grids were machine-validated: full 25-cell coverage, one
// simple orthogonal path per color, dots = path endpoints.
//
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges,
// modal) comes from ../../js/arcade-core.js.
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
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const levelNumEl = dom.byId("level-num");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const levelSelect = dom.byId("level-select");
  const resetBtn = dom.byId("reset-level");
  const hintEl = dom.byId("hint");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  const SIZE = 5;
  const CELL_COUNT = SIZE * SIZE;
  const idx = (r, c) => r * SIZE + c;

  const HEX = {
    A: "#ff6b6b",
    B: "#4dabf7",
    C: "#51cf66",
    D: "#ffd43b",
    E: "#b197fc",
    F: "#ffa94d",
    G: "#f783ac",
    H: "#58e0c9",
  };

  const LEVELS = [
    {
      rows: ["AAABB", "AAACB", "AAACB", "AABBB", "AABBB"],
      dots: { A: [[0, 0], [0, 2]], B: [[0, 3], [3, 3]], C: [[1, 3], [2, 3]] },
    },
    {
      rows: ["AAAAA", "BBBBA", "BCCCC", "BDDDC", "BDDDC"],
      dots: { A: [[0, 0], [1, 4]], B: [[1, 3], [4, 0]], C: [[2, 1], [4, 4]], D: [[3, 1], [4, 1]] },
    },
    {
      rows: ["AAAAA", "DDDDB", "CEEDB", "CEEEB", "CCCBB"],
      dots: { A: [[0, 0], [0, 4]], B: [[1, 4], [4, 3]], C: [[4, 2], [2, 0]], D: [[1, 0], [2, 3]], E: [[3, 3], [2, 2]] },
    },
    {
      rows: ["ACCEF", "ACCEF", "ABDEF", "ABDEF", "BBDDF"],
      dots: { A: [[0, 0], [3, 0]], B: [[4, 0], [2, 1]], C: [[1, 1], [1, 2]], D: [[2, 2], [4, 3]], E: [[3, 3], [0, 3]], F: [[0, 4], [4, 4]] },
    },
    {
      rows: ["AAAAA", "DDEEB", "DFFEB", "DFFEB", "CCCCB"],
      dots: { A: [[0, 0], [0, 4]], B: [[1, 4], [4, 4]], C: [[4, 3], [4, 0]], D: [[3, 0], [1, 1]], E: [[1, 2], [3, 3]], F: [[3, 2], [2, 2]] },
    },
    {
      rows: ["AAAAB", "DEEEB", "DGGEB", "DFFFB", "DCCCC"],
      dots: { A: [[0, 0], [0, 3]], B: [[0, 4], [3, 4]], C: [[4, 4], [4, 1]], D: [[4, 0], [1, 0]], E: [[1, 1], [2, 3]], F: [[3, 3], [3, 1]], G: [[2, 1], [2, 2]] },
    },
    {
      rows: ["AAAAB", "CCBBB", "CCDDD", "EEEED", "FFFGG"],
      dots: { A: [[0, 0], [0, 3]], B: [[0, 4], [1, 2]], C: [[1, 1], [2, 1]], D: [[2, 2], [3, 4]], E: [[3, 3], [3, 0]], F: [[4, 0], [4, 2]], G: [[4, 3], [4, 4]] },
    },
    {
      rows: ["ACDFG", "ACDFG", "ACDFG", "BBDEH", "BBEEH"],
      dots: { A: [[0, 0], [2, 0]], B: [[3, 0], [3, 1]], C: [[2, 1], [0, 1]], D: [[0, 2], [3, 2]], E: [[4, 2], [3, 3]], F: [[2, 3], [0, 3]], G: [[0, 4], [2, 4]], H: [[3, 4], [4, 4]] },
    },
  ];

  // Precompute dot index maps per level.
  const LEVEL_DATA = LEVELS.map((L) => {
    const dots = {};
    const dotOf = {};
    for (const [col, pair] of Object.entries(L.dots)) {
      dots[col] = pair.map(([r, c]) => idx(r, c));
      for (const [r, c] of pair) dotOf[idx(r, c)] = col;
    }
    return { dots, dotOf, colors: Object.keys(L.dots) };
  });

  const HINT_DEFAULT =
    "Connect matching dots with pipes. Fill every cell — click a dot to start its pipe, then click adjacent cells. Click an endpoint again to clear its pipe. P pauses.";

  const K = makeKeys("flow");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    wins: 0,
    streak: 0,
    bestStreak: 0,
    cleanWins: 0, // levels finished with no backtrack and no reset
    cleanStreak: 0,
    cells: 0, // cells drawn, career
    backtracks: 0, // cells retracted, career
    resets: 0,
    solved: [], // level numbers solved at least once
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (typeof DEFAULT_STATS[key] === "number" && !Number.isFinite(stats[key])) {
      stats[key] = DEFAULT_STATS[key];
    }
  }
  if (!Array.isArray(stats.solved)) stats.solved = [];
  stats.solved = stats.solved.filter((n) => typeof n === "number");

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // Carry the pre-core win counter (flow-wins) over.
  function migrateLegacy() {
    const raw = store.get("flow-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("flow-wins");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Complete your first level.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Complete 5 levels.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Complete 10 levels.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Complete 2 levels without a reset.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Complete 3 levels without a reset.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Complete 5 levels without a reset.", stat: "bestStreak", goal: 5 },
    { id: "clean", icon: "💎", name: "Direct Route", desc: "Finish a level with no backtracking.", stat: "cleanWins", goal: 1 },
    { id: "clean5", icon: "🧠", name: "Sharp Eye", desc: "Finish 5 levels with no backtracking.", stat: "cleanWins", goal: 5 },
    { id: "clean3", icon: "✨", name: "Flawless Run", desc: "Finish 3 levels in a row without a backtrack.", stat: "cleanStreak", goal: 3 },
    { id: "cells100", icon: "🧱", name: "Pipe Fitter", desc: "Draw 100 pipe cells in total.", stat: "cells", goal: 100 },
    { id: "cells500", icon: "🏗️", name: "Plumber", desc: "Draw 500 pipe cells in total.", stat: "cells", goal: 500 },
    { id: "reset10", icon: "🔄", name: "Fresh Start", desc: "Reset levels 10 times.", stat: "resets", goal: 10 },
    { id: "back25", icon: "↩️", name: "Second Thoughts", desc: "Retract 25 pipe cells in total.", stat: "backtracks", goal: 25 },
    {
      id: "all8",
      icon: "🏁",
      name: "Completionist",
      desc: "Solve all 8 levels.",
      goal: LEVELS.length,
      satisfied: () => stats.solved.length >= LEVELS.length,
      progress: () => {
        const n = stats.solved.length;
        return {
          pct: (n / LEVELS.length) * 100,
          now: n,
          text: n >= LEVELS.length ? "Unlocked" : n + " / " + LEVELS.length + " levels",
        };
      },
    },
  ];

  // ---------- Badges UI ----------
  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => (typeof stats[key] === "number" ? stats[key] : 0),
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
      records: () => [
        ["Levels solved", stats.wins],
        ["Streak", stats.streak],
        ["Best streak", stats.bestStreak],
        ["Levels cleared", stats.solved.length + " / " + LEVELS.length],
        ["Cells drawn", stats.cells],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
    },
    onClose: () => {
      const target = overlay.isOpen() ? document.querySelector(".overlay .btn") : badgesBtn;
      if (target && target.focus) target.focus();
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

  // ---------- State ----------
  let levelIdx = 0;
  let pipes = {}; // color -> array of cell indices, starting at a dot
  let completed = {}; // color -> true when connected dot-to-dot
  let active = null; // color currently being drawn, or null
  let paint = new Array(CELL_COUNT).fill(null); // cell index -> color | null
  let roundOver = false;
  let paused = false;
  let roundBacktracks = 0;
  let roundResets = 0;

  const current = () => LEVEL_DATA[levelIdx];

  function adjacent(a, b) {
    const ar = Math.floor(a / SIZE);
    const ac = a % SIZE;
    const br = Math.floor(b / SIZE);
    const bc = b % SIZE;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function rebuild() {
    paint = new Array(CELL_COUNT).fill(null);
    for (const col of Object.keys(pipes)) {
      for (const i of pipes[col]) paint[i] = col;
    }
    render();
  }

  function render() {
    const L = current();
    boardEl.innerHTML = "";
    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "flow-cell";
      const painted = paint[i];
      const dotCol = L.dotOf[i];
      const shown = painted || dotCol;
      if (shown) cell.style.setProperty("--c", HEX[shown]);
      if (painted) cell.classList.add("painted");
      if (dotCol) cell.classList.add("dot");
      if (painted && completed[painted]) cell.classList.add("locked");
      cell.setAttribute(
        "aria-label",
        dotCol ? `Dot ${dotCol}` : painted ? `Pipe ${painted}` : "Empty"
      );
      cell.addEventListener("click", () => {
        audio.unlock();
        handleCellClick(i);
      });
      boardEl.appendChild(cell);
    }
  }

  function updateStatus() {
    levelNumEl.textContent = levelIdx + 1;
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    hintEl.textContent = HINT_DEFAULT;
  }

  function trackCellsAdded(n) {
    if (!n) return;
    stats.cells += n;
    saveStats();
    checkAchievements();
  }

  function trackBacktrack(n) {
    if (!n) return;
    stats.backtracks += n;
    roundBacktracks += n;
    saveStats();
    checkAchievements();
  }

  function handleCellClick(i) {
    if (paused || roundOver) return;
    const L = current();
    const dotCol = L.dotOf[i];
    if (dotCol) {
      handleDotClick(i, dotCol);
      return;
    }

    if (active) {
      const pipe = pipes[active];
      const tip = pipe[pipe.length - 1];

      if (adjacent(i, tip)) {
        if (paint[i] === active) {
          // Clicking the cell just before the tip pops one cell; any earlier
          // cell of the pipe truncates back to it.
          const keep = pipe.indexOf(i) + 1;
          const lost = pipe.length - keep;
          pipes[active] = pipe.slice(0, keep);
          trackBacktrack(lost);
        } else if (paint[i]) {
          return; // painted by another color — cannot draw through it
        } else {
          pipe.push(i);
          trackCellsAdded(1);
        }
        rebuild();
        return;
      }

      if (paint[i] === active) {
        // non-adjacent truncate back to that cell
        const keep = pipe.indexOf(i) + 1;
        const lost = pipe.length - keep;
        pipes[active] = pipe.slice(0, keep);
        trackBacktrack(lost);
        rebuild();
      }
      return;
    }

    // No active color: tapping a painted, unlocked pipe cell re-activates that
    // color with the pipe truncated to that cell (Flow Free style).
    const owner = paint[i];
    if (owner && !completed[owner]) {
      active = owner;
      const keep = pipes[owner].indexOf(i) + 1;
      const lost = pipes[owner].length - keep;
      pipes[owner] = pipes[owner].slice(0, keep);
      trackBacktrack(lost);
      rebuild();
    }
  }

  function handleDotClick(i, col) {
    if (paused || roundOver) return;
    const L = current();

    // Clicking an endpoint again clears that color's pipe.
    if (completed[col]) {
      delete pipes[col];
      delete completed[col];
      if (active === col) active = null;
      rebuild();
      return;
    }

    const pipe = pipes[col];
    if (active === col && pipe && pipe.length) {
      const start = pipe[0];
      const other = L.dots[col].find((d) => d !== start);
      if (i === start) {
        // clicking the starting endpoint again clears the pipe
        delete pipes[col];
        active = null;
        rebuild();
        return;
      }
      if (i === other && adjacent(i, pipe[pipe.length - 1])) {
        pipe.push(other);
        trackCellsAdded(1);
        completed[col] = true;
        active = null;
        rebuild();
        checkWin();
        return;
      }
      return; // far end-dot not reachable yet — keep drawing
    }

    // Start drawing this color from this dot, discarding any partial pipe.
    pipes[col] = [i];
    active = col;
    trackCellsAdded(1);
    rebuild();
  }

  function checkWin() {
    const L = current();
    if (!L.colors.every((c) => completed[c])) return;
    let paintedCells = 0;
    for (const col of Object.keys(pipes)) paintedCells += pipes[col].length;
    if (paintedCells !== CELL_COUNT) return;

    roundOver = true;
    const clean = roundBacktracks === 0 && roundResets === 0;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (clean) {
      stats.cleanWins++;
      stats.cleanStreak++;
    } else {
      stats.cleanStreak = 0;
    }
    const levelNo = levelIdx + 1;
    if (stats.solved.indexOf(levelNo) === -1) stats.solved.push(levelNo);
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(90);
    const isLast = levelIdx === LEVELS.length - 1;
    const extras = [];
    if (clean) extras.push("No backtracking!");
    showOverlay(
      "Level Complete! 🎉",
      `Level ${levelNo} solved — every pipe connected. ` +
        (extras.length ? extras.join(" ") + " " : "") +
        `Streak ${stats.streak}.`,
      [
        {
          label: isLast ? "Replay from Level 1" : "Next Level →",
          onClick: () => {
            hideOverlay();
            loadLevel((levelIdx + 1) % LEVELS.length);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function loadLevel(i, opts) {
    levelIdx = i;
    pipes = {};
    completed = {};
    active = null;
    roundOver = false;
    paused = false;
    roundBacktracks = 0;
    roundResets = opts && opts.reset ? 1 : 0;
    hideOverlay();
    if (levelSelect.value !== String(i)) levelSelect.value = String(i);
    rebuild();
    updateStatus();
  }

  function resetLevel() {
    if (paused) return;
    sfx("click");
    stats.resets++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    loadLevel(levelIdx, { reset: true });
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (roundOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "Restart level", ghost: true, onClick: () => { hideOverlay(); setPaused(false); resetLevel(); } },
      ]);
    } else {
      hideOverlay();
    }
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Input ----------
  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (String(e.key || "").toLowerCase() === "p") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    levelSelect.addEventListener("change", () => {
      audio.unlock();
      loadLevel(Number(levelSelect.value));
    });
    resetBtn.addEventListener("click", resetLevel);

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!roundOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !roundOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // Test hook helper: the full-coverage path for one colour of one level.
  function pathFor(li, col) {
    const L = LEVELS[li];
    const data = LEVEL_DATA[li];
    if (!L || !data.dots[col]) return null;
    const cells = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (L.rows[r][c] === col) cells.add(idx(r, c));
      }
    }
    const start = data.dots[col][0];
    const end = data.dots[col][1];
    const path = [start];
    const seen = new Set([start]);
    function dfs(cur) {
      if (path.length === cells.size) return cur === end;
      const cands = [cur - SIZE, cur + SIZE, cur - 1, cur + 1];
      for (const next of cands) {
        if (next < 0 || next >= CELL_COUNT) continue;
        if (!adjacent(cur, next)) continue;
        if (!cells.has(next) || seen.has(next)) continue;
        seen.add(next);
        path.push(next);
        if (dfs(next)) return true;
        seen.delete(next);
        path.pop();
      }
      return false;
    }
    return dfs(start) ? path.slice() : null;
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();

    LEVELS.forEach((_, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Level ${i + 1} of ${LEVELS.length}`;
      levelSelect.appendChild(opt);
    });

    bindEvents();
    loadLevel(0);
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__FLOW = {
    SIZE,
    CELL_COUNT,
    HEX,
    LEVELS,
    LEVEL_DATA,
    idx,
    get levelIdx() { return levelIdx; },
    get pipes() { return JSON.parse(JSON.stringify(pipes)); },
    get completed() { return Object.assign({}, completed); },
    get active() { return active; },
    get paint() { return paint.slice(); },
    get roundOver() { return roundOver; },
    get paused() { return paused; },
    get roundBacktracks() { return roundBacktracks; },
    get roundResets() { return roundResets; },
    get paintCount() { return paint.filter(Boolean).length; },
    stats,
    ACHIEVEMENTS,
    adjacent,
    handleCellClick,
    handleDotClick,
    pathFor,
    checkWin,
    loadLevel,
    resetLevel,
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
