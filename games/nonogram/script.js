// Nonogram (5x5 Picross) — pure vanilla JS, fully offline, handcrafted puzzles.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
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
  const gridEl = dom.byId("ngrid");
  const puzzleNumEl = dom.byId("puzzle-num");
  const movesEl = dom.byId("moves");
  const streakEl = dom.byId("streak");
  const winsEl = dom.byId("wins");
  const newPuzzleBtn = dom.byId("new-puzzle");
  const resetBtn = dom.byId("reset");
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

  // ---------- Constants ----------
  // Handcrafted 5x5 solution patterns (1 = filled, 0 = empty).
  const PUZZLES = [
    { name: "Heart",    rows: ["01010", "11111", "11111", "01110", "00100"] },
    { name: "Sailboat", rows: ["00100", "01100", "11100", "11111", "01110"] },
    { name: "Tree",     rows: ["00100", "01110", "11111", "00100", "00100"] },
    { name: "Mushroom", rows: ["01110", "11111", "01110", "00100", "00100"] },
    { name: "Diamond",  rows: ["00100", "01110", "11111", "01110", "00100"] },
    { name: "Invader",  rows: ["00100", "10101", "11111", "01010", "10001"] },
    { name: "Cross",    rows: ["10001", "01010", "00100", "01010", "10001"] },
    { name: "Smiley",   rows: ["01110", "10001", "10101", "11011", "01110"] },
    { name: "Cat",      rows: ["10001", "11011", "11111", "10101", "11111"] },
    { name: "Key",      rows: ["01100", "10010", "01100", "00100", "00110"] },
    { name: "Crown",    rows: ["10101", "11111", "01110", "01110", "11111"] },
    { name: "Flower",   rows: ["01010", "11111", "11110", "00100", "01110"] },
  ];
  const SIZE = 5;
  const EMPTY = 0, FILLED = 1, MARKED = 2;
  const HINT_DEFAULT = "Left click to fill a cell, right click to mark it empty (✕). Fill the cells to match the picture. P pauses.";

  const K = makeKeys("nonogram");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    wins: 0,
    streak: 0,
    bestStreak: 0,
    moves: 0, // every fill/mark click, career
    marks: 0, // mark clicks, career
    cleanWins: 0, // no wasted fill clicks and no marks
    annotatedWins: 0, // every empty cell marked (✕)
    solved: [], // names of pictures solved at least once
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
  stats.solved = stats.solved.filter((n) => typeof n === "string");

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // Carry the pre-core win counter (nonogram-wins) over.
  function migrateLegacy() {
    const raw = store.get("nonogram-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("nonogram-wins");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Solve your first picture.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Solve 5 pictures.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Solve 10 pictures.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Solve 2 pictures in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Solve 3 pictures in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Solve 5 pictures in a row.", stat: "bestStreak", goal: 5 },
    {
      id: "clean",
      icon: "💎",
      name: "Precise",
      desc: "Solve a picture with every click a needed fill.",
      stat: "cleanWins",
      goal: 1,
    },
    { id: "clean5", icon: "🧠", name: "Sharp Eye", desc: "Solve 5 pictures with no wasted clicks.", stat: "cleanWins", goal: 5 },
    { id: "marks10", icon: "✕", name: "Crosser", desc: "Place 10 empty-cell marks in total.", stat: "marks", goal: 10 },
    { id: "annotated", icon: "📝", name: "Full Notes", desc: "Solve a picture with every empty cell marked.", stat: "annotatedWins", goal: 1 },
    { id: "moves100", icon: "👆", name: "Clicker", desc: "Make 100 cell clicks in total.", stat: "moves", goal: 100 },
    { id: "moves500", icon: "🖱️", name: "Dedicated", desc: "Make 500 cell clicks in total.", stat: "moves", goal: 500 },
    {
      id: "all6",
      icon: "🖼️",
      name: "Collector",
      desc: "Solve 6 different pictures.",
      goal: 6,
      satisfied: () => stats.solved.length >= 6,
      progress: () => {
        const n = stats.solved.length;
        return { pct: (n / 6) * 100, now: n, text: n >= 6 ? "Unlocked" : n + " / 6 pictures" };
      },
    },
    {
      id: "all12",
      icon: "🏛️",
      name: "Curator",
      desc: "Solve all 12 pictures.",
      goal: 12,
      satisfied: () => stats.solved.length >= PUZZLES.length,
      progress: () => {
        const n = stats.solved.length;
        return {
          pct: (n / PUZZLES.length) * 100,
          now: n,
          text: n >= PUZZLES.length ? "Unlocked" : n + " / " + PUZZLES.length + " pictures",
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
        ["Solved", stats.wins],
        ["Streak", stats.streak],
        ["Best streak", stats.bestStreak],
        ["Pictures solved", stats.solved.length + " / " + PUZZLES.length],
        ["Cell clicks", stats.moves],
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
  let puzzleIndex, solution, grid, moves, marks, won;
  let paused = false;
  let cellEls = [];

  // Runs of filled cells in a line, e.g. [3,1]. Empty line → [0].
  function runs(line) {
    const out = [];
    let count = 0;
    for (const v of line) {
      if (v) {
        count++;
      } else if (count) {
        out.push(count);
        count = 0;
      }
    }
    if (count) out.push(count);
    return out.length ? out : [0];
  }

  function rowClue(r) {
    return runs(solution[r]);
  }
  function colClue(c) {
    return runs(solution.map((row) => row[c]));
  }

  function filledCount() {
    let n = 0;
    for (const row of solution) for (const v of row) if (v) n++;
    return n;
  }

  function updateStatus() {
    puzzleNumEl.textContent = puzzleIndex + 1;
    movesEl.textContent = moves;
    streakEl.textContent = stats.streak;
    winsEl.textContent = stats.wins;
    hintEl.textContent = HINT_DEFAULT;
  }

  function makeClue(numbers, extraClass) {
    const clue = document.createElement("div");
    clue.className = "clue" + (extraClass ? " " + extraClass : "");
    for (const n of numbers) {
      const s = document.createElement("span");
      s.textContent = n;
      clue.appendChild(s);
    }
    return clue;
  }

  function render() {
    gridEl.innerHTML = "";
    cellEls = [];

    const corner = document.createElement("div");
    corner.className = "ngrid__corner";
    gridEl.appendChild(corner);

    for (let c = 0; c < SIZE; c++) gridEl.appendChild(makeClue(colClue(c), "clue--col"));

    for (let r = 0; r < SIZE; r++) {
      gridEl.appendChild(makeClue(rowClue(r), "clue--row"));
      const rowEls = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ncell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
        paintCell(cell, grid[r][c]);
        cell.addEventListener("click", () => {
          audio.unlock();
          onLeft(r, c);
        });
        cell.addEventListener("contextmenu", (e) => {
          if (e.preventDefault) e.preventDefault();
          audio.unlock();
          onRight(r, c);
        });
        gridEl.appendChild(cell);
        rowEls.push(cell);
      }
      cellEls.push(rowEls);
    }
  }

  function paintCell(cell, state) {
    cell.classList.toggle("filled", state === FILLED);
    cell.classList.toggle("marked", state === MARKED);
    cell.textContent = state === MARKED ? "✕" : "";
  }

  function refreshCell(r, c) {
    const cell = cellEls[r] && cellEls[r][c];
    if (cell) paintCell(cell, grid[r][c]);
  }

  function onLeft(r, c) {
    if (won || paused) return;
    grid[r][c] = grid[r][c] === FILLED ? EMPTY : FILLED;
    moves++;
    stats.moves++;
    saveStats();
    checkAchievements();
    sfx(grid[r][c] === FILLED ? "place" : "select");
    refreshCell(r, c);
    updateStatus();
    checkWin();
  }

  function onRight(r, c) {
    if (won || paused) return;
    grid[r][c] = grid[r][c] === MARKED ? EMPTY : MARKED;
    moves++;
    marks++;
    stats.moves++;
    stats.marks++;
    saveStats();
    checkAchievements();
    sfx("tick");
    refreshCell(r, c);
    updateStatus();
  }

  function checkWin() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((grid[r][c] === FILLED) !== (solution[r][c] === 1)) return;
      }
    }
    won = true;
    const total = SIZE * SIZE;
    const filled = filledCount();
    const clean = moves === filled && marks === 0;
    const annotated = marks === total - filled;

    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (clean) stats.cleanWins++;
    if (annotated) stats.annotatedWins++;
    const name = PUZZLES[puzzleIndex].name;
    if (stats.solved.indexOf(name) === -1) stats.solved.push(name);
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(90);
    const extras = [];
    if (clean) extras.push("No wasted clicks!");
    if (annotated) extras.push("Fully annotated!");
    showOverlay(
      "Solved! 🎉",
      `${name} — completed in ${moves} move${moves === 1 ? "" : "s"}. ` +
        (extras.length ? extras.join(" ") + " " : "") +
        `Streak ${stats.streak}.`,
      [
        { label: "New puzzle", onClick: () => { hideOverlay(); newPuzzle(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function loadPuzzle(index) {
    puzzleIndex = ((index % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
    solution = PUZZLES[puzzleIndex].rows.map((row) => row.split("").map(Number));
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
    moves = 0;
    marks = 0;
    won = false;
    paused = false;
    render();
    updateStatus();
  }

  function resetPuzzle() {
    if (paused || won) return;
    hideOverlay();
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
    moves = 0;
    marks = 0;
    sfx("flip");
    render();
    updateStatus();
  }

  function newPuzzle() {
    hideOverlay();
    let next = puzzleIndex;
    while (PUZZLES.length > 1 && next === puzzleIndex) {
      next = Math.floor(Math.random() * PUZZLES.length);
    }
    loadPuzzle(next);
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (won || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New puzzle", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newPuzzle(); } },
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
    newPuzzleBtn.addEventListener("click", () => { sfx("click"); newPuzzle(); });
    resetBtn.addEventListener("click", () => { sfx("click"); resetPuzzle(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!won && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !won && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    loadPuzzle(Math.floor(Math.random() * PUZZLES.length));
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__NONOGRAM = {
    PUZZLES,
    SIZE,
    EMPTY,
    FILLED,
    MARKED,
    get puzzleIndex() { return puzzleIndex; },
    get solution() { return solution.map((row) => row.slice()); },
    get grid() { return grid.map((row) => row.slice()); },
    get moves() { return moves; },
    get marks() { return marks; },
    get won() { return won; },
    get paused() { return paused; },
    get cells() { return cellEls; },
    stats,
    ACHIEVEMENTS,
    runs,
    rowClue,
    colClue,
    filledCount,
    onLeft,
    onRight,
    loadPuzzle,
    resetPuzzle,
    newPuzzle,
    // Test-only: pin a puzzle by index.
    setPuzzle: (index) => {
      hideOverlay();
      loadPuzzle(index);
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
