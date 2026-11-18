// Sokoban — box-pushing puzzle. Fully offline, vanilla JS.
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
  const boardEl = dom.byId("board");
  const movesEl = dom.byId("moves");
  const levelEl = dom.byId("level");
  const solvedEl = dom.byId("solved");
  const levelLabelEl = dom.byId("level-label");
  const hintEl = dom.byId("hint");
  const placedEl = dom.byId("placed");
  const bestEl = dom.byId("best-moves");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  // Levels verified solvable by an A* push-space search (see repo history).
  const LEVELS = [
    { name: "First Push", map: [
      "#######",
      "#     #",
      "# @$. #",
      "#     #",
      "#######",
    ] },
    { name: "Double Shift", map: [
      "########",
      "#      #",
      "# @ $ .#",
      "#      #",
      "########",
    ] },
    { name: "Walk Around", map: [
      "########",
      "#.     #",
      "#$     #",
      "#      #",
      "#  @   #",
      "########",
    ] },
    { name: "Detour", map: [
      "########",
      "#.     #",
      "#      #",
      "# $    #",
      "# # @  #",
      "#      #",
      "########",
    ] },
    { name: "Twin Boxes", map: [
      "########",
      "#  . . #",
      "#  $ $ #",
      "#   @  #",
      "#      #",
      "########",
    ] },
    { name: "Split Halls", map: [
      "#########",
      "#   #   #",
      "# . # . #",
      "# $   $ #",
      "#   @   #",
      "#       #",
      "#########",
    ] },
    { name: "Triple Threat", map: [
      "#########",
      "#   #   #",
      "# . . . #",
      "# $ $ $ #",
      "#   @   #",
      "#       #",
      "#########",
    ] },
    { name: "Inset Targets", map: [
      "#########",
      "#       #",
      "# $ $ $ #",
      "# .#.#. #",
      "#       #",
      "#   @   #",
      "#########",
    ] },
    { name: "Four Corners", map: [
      "##########",
      "#        #",
      "# $ $ $ $#",
      "# . . . .#",
      "#   @    #",
      "#        #",
      "##########",
    ] },
    { name: "Twin Vaults", map: [
      "############",
      "#          #",
      "# .      . #",
      "# $  ##  $ #",
      "#    ##    #",
      "# $  @  $  #",
      "# .  #   . #",
      "############",
    ] },
    { name: "Master's Hall", map: [
      "############",
      "#  . . .   #",
      "#  $ $ $   #",
      "# #  @  #  #",
      "#  $ $ $   #",
      "#  . . .   #",
      "############",
    ] },
    { name: "Cross Push", map: [
      "###########",
      "#    .    #",
      "#    $    #",
      "# . $ $ . #",
      "# #  @  # #",
      "# . $ $ . #",
      "#    $    #",
      "#    .    #",
      "###########",
    ] },
  ];

  const TOTAL = LEVELS.length;
  const HISTORY_CAP = 500;
  const HINT_DEFAULT =
    "Push every box onto a glowing target — you can't pull boxes. Arrow keys / WASD move, U undoes, Esc pauses. Red crates are wedged — Undo!";

  const K = makeKeys("sokoban");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    wins: 0,
    streak: 0,
    bestStreak: 0,
    moves: 0, // every successful step, career
    pushes: 0, // every box push, career
    undos: 0,
    resets: 0,
    cleanWins: 0, // solved without undo or reset
    solved: [], // level numbers (1-based)
    bestMoves: {}, // fewest moves used per level number — replay value
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
  stats.solved = stats.solved.filter((n) => typeof n === "number" && n >= 1 && n <= TOTAL);
  if (!stats.bestMoves || typeof stats.bestMoves !== "object" || Array.isArray(stats.bestMoves)) {
    stats.bestMoves = {};
  }
  for (const n of Object.keys(stats.bestMoves)) {
    const v = stats.bestMoves[n];
    if (!Number.isFinite(v) || v < 1 || !/^\d+$/.test(n) || +n < 1 || +n > TOTAL) delete stats.bestMoves[n];
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // Carry the pre-core solved bitmask (sokoban-done) over.
  function migrateLegacy() {
    const raw = store.get("sokoban-done", null);
    if (raw !== null && raw !== undefined) {
      const mask = Number(raw) || 0;
      let count = 0;
      for (let i = 0; i < TOTAL; i++) {
        if ((mask >> i) & 1) {
          count++;
          if (stats.solved.indexOf(i + 1) === -1) stats.solved.push(i + 1);
        }
      }
      if (count > stats.wins) stats.wins = count;
      store.remove("sokoban-done");
    }
    stats.solved.sort((a, b) => a - b);
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Clear your first warehouse.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Clear 5 warehouses.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Clear 10 warehouses.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Clear 2 warehouses without a reset.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Clear 3 warehouses without a reset.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Clear 5 warehouses without a reset.", stat: "bestStreak", goal: 5 },
    { id: "clean", icon: "💎", name: "Direct Route", desc: "Clear a warehouse without undo or reset.", stat: "cleanWins", goal: 1 },
    { id: "clean5", icon: "🧠", name: "Sharp Eye", desc: "Clear 5 warehouses without undo or reset.", stat: "cleanWins", goal: 5 },
    { id: "moves100", icon: "👣", name: "Sure Footed", desc: "Take 100 steps in total.", stat: "moves", goal: 100 },
    { id: "moves500", icon: "🥾", name: "Long Haul", desc: "Take 500 steps in total.", stat: "moves", goal: 500 },
    { id: "pushes100", icon: "📦", name: "Box Mover", desc: "Push 100 boxes in total.", stat: "pushes", goal: 100 },
    { id: "undo25", icon: "↩️", name: "Second Thoughts", desc: "Undo 25 moves in total.", stat: "undos", goal: 25 },
    { id: "reset10", icon: "🔄", name: "Fresh Start", desc: "Reset levels 10 times.", stat: "resets", goal: 10 },
    {
      id: "all12",
      icon: "🏭",
      name: "Warehouse Master",
      desc: "Clear all 12 warehouses.",
      goal: TOTAL,
      satisfied: () => stats.solved.length >= TOTAL,
      progress: () => {
        const n = stats.solved.length;
        return {
          pct: (n / TOTAL) * 100,
          now: n,
          text: n >= TOTAL ? "Unlocked" : n + " / " + TOTAL + " warehouses",
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
        ["Cleared", stats.wins],
        ["Streak", stats.streak],
        ["Best streak", stats.bestStreak],
        ["Warehouses", stats.solved.length + " / " + TOTAL],
        ["Steps", stats.moves],
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
  let levelIndex;
  let grid;
  let targets;
  let boxes;
  let player;
  let rows;
  let cols;
  let moves;
  let history;
  let gameOver;
  let paused = false;
  let roundUndos = 0;
  let roundResets = 0;
  let facing = "right"; // which way the worker is looking
  let moveFx = null; // { dir, boxIdx, placed } — one-shot visual feedback
  let stuckWarned = new Set(); // crates we've already warned about this round

  const idx = (r, c) => r * cols + c;

  function dirName(dr, dc) {
    if (dr < 0) return "up";
    if (dr > 0) return "down";
    if (dc < 0) return "left";
    return "right";
  }

  // A crate against two perpendicular walls can never be pushed out again.
  // Genuine deadlock detection: cheap, exact, and only advisory.
  function stuckBoxes() {
    const out = new Set();
    for (const i of boxes) {
      if (targets.has(i)) continue;
      const r = Math.floor(i / cols), c = i % cols;
      const up = !!grid[r - 1] && grid[r - 1][c] === 1;
      const down = !!grid[r + 1] && grid[r + 1][c] === 1;
      const left = grid[r][c - 1] === 1;
      const right = grid[r][c + 1] === 1;
      if ((up || down) && (left || right)) out.add(i);
    }
    return out;
  }

  function solvedSet() {
    return new Set(stats.solved);
  }

  function firstUnsolved() {
    const done = solvedSet();
    for (let i = 0; i < TOTAL; i++) if (!done.has(i + 1)) return i;
    return 0;
  }

  function loadLevel(i, opts) {
    levelIndex = ((i % TOTAL) + TOTAL) % TOTAL;
    const map = LEVELS[levelIndex].map;
    rows = map.length;
    cols = map[0].length;
    grid = [];
    targets = new Set();
    boxes = new Set();
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c];
        row.push(ch === "#" ? 1 : 0);
        if (ch === "." || ch === "*" || ch === "+") targets.add(idx(r, c));
        if (ch === "$" || ch === "*") boxes.add(idx(r, c));
        if (ch === "@" || ch === "+") player = { r, c };
      }
      grid.push(row);
    }
    moves = 0;
    history = [];
    gameOver = false;
    paused = false;
    roundUndos = 0;
    roundResets = opts && opts.reset ? 1 : 0;
    facing = "right";
    moveFx = null;
    stuckWarned = new Set();
    hideOverlay();
    levelLabelEl.textContent = `Level ${levelIndex + 1}: ${LEVELS[levelIndex].name}`;
    render();
    updateStatus();
  }

  function updateStatus() {
    movesEl.textContent = moves;
    levelEl.textContent = `${levelIndex + 1}/${TOTAL}`;
    solvedEl.textContent = `${stats.solved.length}/${TOTAL}`;
    hintEl.textContent = HINT_DEFAULT;
    let placed = 0;
    for (const b of boxes) if (targets.has(b)) placed++;
    if (placedEl) placedEl.textContent = `${placed}/${targets.size}`;
    if (bestEl) {
      const best = stats.bestMoves[levelIndex + 1];
      bestEl.textContent = Number.isFinite(best) ? String(best) : "—";
    }
  }

  function cellSize() {
    if (cols >= 11) return 40;
    if (cols >= 9) return 46;
    return 54;
  }

  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    boardEl.innerHTML = "";
    const size = cellSize();
    const stuck = stuckBoxes();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(r, c);
        const wall = grid[r][c] === 1;
        const target = targets.has(i);
        const box = boxes.has(i);
        let cls = "sk-cell";
        if (wall) cls += " sk-wall";
        else {
          cls += " sk-floor";
          if (target && !box) cls += " sk-target"; // crate covers the dot; solved crates glow instead
        }
        const div = document.createElement("div");
        div.className = cls;
        div.style.width = size + "px";
        div.style.height = size + "px";
        if (box) {
          const b = document.createElement("div");
          b.className = "sk-box" + (target ? " sk-box--done" : "");
          if (moveFx && moveFx.boxIdx === i) {
            b.classList.add("sk-box--pushed", "sk-box--push-" + moveFx.dir);
            if (moveFx.placed) b.classList.add("sk-box--placed");
          }
          if (stuck.has(i)) b.classList.add("sk-box--stuck");
          b.style.width = "88%";
          b.style.height = "88%";
          div.appendChild(b);
        }
        if (player.r === r && player.c === c) {
          const p = document.createElement("div");
          p.className = "sk-player sk-player--" + facing;
          if (moveFx) p.classList.add("sk-player--step");
          p.style.width = "72%";
          p.style.height = "72%";
          div.appendChild(p);
        }
        div.setAttribute("aria-label", wall ? "Wall" : target ? "Target" : "Floor");
        boardEl.appendChild(div);
      }
    }
    moveFx = null; // feedback is a one-shot flourish
  }

  function pushHistory() {
    history.push({ player: { ...player }, boxes: [...boxes], moves });
    if (history.length > HISTORY_CAP) history.shift();
  }

  function tryMove(dr, dc) {
    if (gameOver || paused) return;
    const nr = player.r + dr;
    const nc = player.c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    if (grid[nr][nc] === 1) return;
    const dir = dirName(dr, dc);
    const nIdx = idx(nr, nc);
    if (boxes.has(nIdx)) {
      const br = nr + dr;
      const bc = nc + dc;
      if (br < 0 || bc < 0 || br >= rows || bc >= cols) return;
      if (grid[br][bc] === 1) return;
      const bIdx = idx(br, bc);
      if (boxes.has(bIdx)) return; // can't push two boxes
      pushHistory();
      boxes.delete(nIdx);
      boxes.add(bIdx);
      player = { r: nr, c: nc };
      facing = dir;
      moveFx = { dir, boxIdx: bIdx, placed: targets.has(bIdx) };
      moves++;
      stats.moves++;
      stats.pushes++;
      saveStats();
      checkAchievements();
      sfx("place");
      render();
      updateStatus();
      // Advisory only: a wedged crate is a genuine dead end, so warn once.
      for (const s of stuckBoxes()) {
        if (!stuckWarned.has(s)) {
          stuckWarned.add(s);
          toast.show(
            "Crate wedged!",
            "That crate is stuck in a corner — Undo to back out.",
            "⚠️"
          );
          break;
        }
      }
      checkSolved();
    } else {
      pushHistory();
      player = { r: nr, c: nc };
      facing = dir;
      moveFx = { dir };
      moves++;
      stats.moves++;
      saveStats();
      checkAchievements();
      sfx("tick");
      render();
      updateStatus();
    }
  }

  function undo() {
    if (gameOver || paused || !history.length) return;
    const snap = history.pop();
    player = { ...snap.player };
    boxes = new Set(snap.boxes);
    moves = snap.moves;
    moveFx = null;
    roundUndos++;
    stats.undos++;
    saveStats();
    checkAchievements();
    sfx("flip");
    render();
    updateStatus();
  }

  function resetLevel() {
    if (paused) return;
    stats.resets++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    sfx("click");
    loadLevel(levelIndex, { reset: true });
  }

  function checkSolved() {
    for (const b of boxes) if (!targets.has(b)) return;
    gameOver = true;
    const levelNo = levelIndex + 1;
    const wasNew = stats.solved.indexOf(levelNo) === -1;
    if (wasNew) stats.solved.push(levelNo);
    stats.solved.sort((a, b) => a - b);
    const clean = roundUndos === 0 && roundResets === 0;
    const prevBest = stats.bestMoves[levelNo];
    const newBest = !Number.isFinite(prevBest) || moves < prevBest;
    if (newBest) stats.bestMoves[levelNo] = moves;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (clean) stats.cleanWins++;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(90);
    const nowAll = stats.solved.length === TOTAL;
    const last = levelIndex === TOTAL - 1;
    const nextLabel = nowAll ? "Replay from Level 1" : last ? "Back to Level 1" : "Next Level →";
    showOverlay(
      nowAll && wasNew ? "You are a Sokoban master! 🏆" : "Level complete! 🎉",
      nowAll && wasNew
        ? `All ${TOTAL} warehouses cleared. Legendary box-pushing!`
        : `Solved in ${moves} move${moves === 1 ? "" : "s"}. ` +
          (clean ? "No undo, no reset! " : "") +
          (newBest ? "New best! " : "") +
          `Streak ${stats.streak}. Cleared ${stats.solved.length} / ${TOTAL}.`,
      [
        {
          label: nextLabel,
          onClick: () => {
            hideOverlay();
            loadLevel(nowAll ? 0 : levelIndex + 1);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press Esc or hit Resume.", [
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
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  };

  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    const dir = KEYS[e.key];
    if (dir) {
      if (e.preventDefault) e.preventDefault();
      tryMove(DIRS[dir][0], DIRS[dir][1]);
      return;
    }
    if (e.key === "u" || e.key === "U") {
      if (e.preventDefault) e.preventDefault();
      undo();
    }
  }

  function bindEvents() {
    document.querySelectorAll(".dpad button[data-dir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = DIRS[btn.dataset.dir];
        if (d) {
          audio.unlock();
          tryMove(d[0], d[1]);
        }
      });
    });

    dom.byId("undo").addEventListener("click", () => { sfx("click"); undo(); });
    dom.byId("reset-level").addEventListener("click", resetLevel);
    dom.byId("level-prev").addEventListener("click", () => { sfx("click"); loadLevel(levelIndex - 1); });
    dom.byId("level-next").addEventListener("click", () => { sfx("click"); loadLevel(levelIndex + 1); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    loadLevel(firstUnsolved());
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__SOKOBAN = {
    LEVELS,
    TOTAL,
    DIRS,
    idx: (r, c) => r * cols + c,
    get levelIndex() { return levelIndex; },
    get rows() { return rows; },
    get cols() { return cols; },
    get moves() { return moves; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get roundUndos() { return roundUndos; },
    get roundResets() { return roundResets; },
    get historyLength() { return history.length; },
    get facing() { return facing; },
    stuckBoxes: () => [...stuckBoxes()],
    get state() {
      return {
        rows,
        cols,
        grid: grid.map((row) => row.slice()),
        targets: [...targets],
        boxes: [...boxes],
        player: { ...player },
        moves,
        gameOver,
        paused,
      };
    },
    stats,
    ACHIEVEMENTS,
    tryMove,
    undo,
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
