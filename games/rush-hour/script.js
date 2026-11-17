// Rush Hour — slide the blocking cars out of the way and free the red car.
// Pure vanilla JS, fully offline. Shared plumbing (storage, audio, toasts,
// overlay, confetti, badges, modal) comes from ../../js/arcade-core.js.
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
  const gridEl = dom.byId("grid");
  const levelEl = dom.byId("level");
  const movesEl = dom.byId("moves");
  const parEl = dom.byId("par");
  const levelNameEl = dom.byId("level-name");
  const prevBtn = dom.byId("prev");
  const nextBtn = dom.byId("next");
  const restartBtn = dom.byId("restart");
  const undoBtn = dom.byId("undo");
  const hintBtn = dom.byId("hint");
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
  const N = 6;
  const TARGET_ID = "X";

  // Cars are { id, row, col, len, dir }. Horizontal cars vary `col`, vertical
  // cars vary `row`. The target is always the horizontal red car on row 2.
  const V = (id, row, col, len, dir) => ({ id, row, col, len, dir });
  const LEVELS = [
    {
      name: "First Gear",
      par: 5,
      vehicles: [V("X", 2, 0, 2, "h"), V("A", 2, 3, 2, "v")],
    },
    {
      name: "Cross Traffic",
      par: 3,
      vehicles: [
        V("X", 2, 2, 2, "h"),
        V("A", 0, 2, 2, "v"),
        V("B", 4, 1, 2, "h"),
        V("C", 1, 1, 2, "v"),
        V("D", 1, 3, 2, "h"),
        V("E", 3, 1, 2, "h"),
        V("F", 1, 0, 2, "v"),
        V("G", 4, 5, 2, "v"),
        V("H", 3, 3, 2, "h"),
        V("I", 1, 5, 2, "v"),
      ],
    },
    {
      name: "Detour",
      par: 6,
      vehicles: [V("X", 2, 0, 2, "h"), V("A", 2, 2, 3, "v"), V("B", 2, 4, 2, "v")],
    },
    {
      name: "Side Street",
      par: 6,
      vehicles: [
        V("X", 2, 1, 2, "h"),
        V("A", 4, 1, 2, "h"),
        V("B", 0, 1, 2, "v"),
        V("C", 1, 4, 2, "v"),
        V("D", 2, 5, 2, "v"),
        V("E", 0, 2, 2, "v"),
        V("F", 5, 0, 2, "h"),
        V("G", 3, 4, 2, "v"),
        V("H", 4, 5, 2, "v"),
        V("I", 5, 2, 2, "h"),
      ],
    },
    {
      name: "Rush Minute",
      par: 10,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 5, 0, 2, "h"),
        V("B", 0, 2, 2, "h"),
        V("C", 0, 5, 3, "v"),
        V("D", 0, 1, 2, "v"),
        V("E", 2, 4, 2, "v"),
        V("F", 1, 3, 2, "h"),
        V("G", 4, 4, 2, "v"),
        V("H", 5, 2, 2, "h"),
        V("I", 3, 2, 2, "v"),
      ],
    },
    {
      name: "Boxed In",
      par: 10,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 3, 0, 2, "h"),
        V("B", 4, 2, 2, "h"),
        V("C", 0, 1, 2, "h"),
        V("D", 1, 5, 2, "v"),
        V("E", 1, 2, 2, "v"),
        V("F", 0, 0, 2, "v"),
        V("G", 3, 2, 2, "h"),
        V("H", 1, 3, 2, "v"),
        V("I", 4, 0, 2, "v"),
      ],
    },
    {
      name: "Gridlock",
      par: 11,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 5, 0, 2, "h"),
        V("B", 1, 2, 2, "v"),
        V("C", 3, 0, 2, "v"),
        V("D", 3, 4, 2, "v"),
        V("E", 1, 3, 2, "v"),
        V("F", 0, 3, 2, "h"),
        V("G", 1, 4, 2, "v"),
        V("H", 0, 1, 2, "h"),
      ],
    },
    {
      name: "Tight Squeeze",
      par: 10,
      vehicles: [
        V("X", 2, 2, 2, "h"),
        V("A", 3, 3, 3, "v"),
        V("B", 0, 3, 2, "h"),
        V("C", 0, 1, 2, "h"),
        V("D", 1, 4, 2, "h"),
        V("E", 2, 4, 2, "v"),
        V("F", 5, 0, 2, "h"),
        V("G", 0, 0, 2, "v"),
        V("H", 2, 5, 2, "v"),
        V("I", 4, 0, 2, "h"),
        V("J", 4, 4, 2, "v"),
      ],
    },
    {
      name: "Bumpers",
      par: 15,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 1, 5, 2, "v"),
        V("B", 3, 2, 2, "h"),
        V("C", 1, 2, 2, "v"),
        V("D", 5, 4, 2, "h"),
        V("E", 1, 3, 2, "v"),
        V("F", 4, 1, 2, "v"),
        V("G", 0, 1, 2, "v"),
        V("H", 0, 3, 3, "h"),
        V("I", 4, 2, 2, "v"),
        V("J", 2, 4, 3, "v"),
      ],
    },
    {
      name: "Chain Reaction",
      par: 20,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 3, 5, 3, "v"),
        V("B", 3, 0, 2, "v"),
        V("C", 2, 2, 2, "v"),
        V("D", 1, 4, 2, "h"),
        V("E", 4, 4, 2, "v"),
        V("F", 4, 1, 2, "h"),
        V("G", 0, 2, 2, "v"),
        V("H", 0, 4, 2, "h"),
      ],
    },
    {
      name: "Downtown",
      par: 15,
      vehicles: [
        V("X", 2, 0, 2, "h"),
        V("A", 2, 2, 2, "v"),
        V("B", 0, 3, 2, "h"),
        V("C", 5, 2, 2, "h"),
        V("D", 1, 2, 2, "h"),
        V("E", 0, 1, 2, "h"),
        V("F", 3, 3, 3, "h"),
        V("G", 3, 1, 2, "v"),
        V("H", 0, 5, 3, "v"),
        V("I", 1, 0, 2, "h"),
        V("J", 4, 2, 2, "h"),
        V("K", 4, 4, 2, "h"),
      ],
    },
    {
      name: "Last Exit",
      par: 16,
      vehicles: [
        V("X", 2, 1, 2, "h"),
        V("A", 0, 5, 2, "v"),
        V("B", 0, 0, 2, "h"),
        V("C", 2, 3, 3, "v"),
        V("D", 3, 5, 3, "v"),
        V("E", 3, 1, 2, "h"),
        V("F", 1, 2, 2, "h"),
        V("G", 0, 4, 3, "v"),
        V("H", 2, 0, 3, "v"),
        V("I", 4, 2, 2, "v"),
        V("J", 1, 0, 2, "h"),
        V("K", 5, 3, 2, "h"),
      ],
    },
  ];

  const CAR_COLORS = [
    "#5ad1b8", "#5a96ff", "#ffd94d", "#a78bfa", "#5ad1e6", "#ff9f5a",
    "#f472b6", "#94d65a", "#facc15", "#67e8f9", "#c084fc", "#fbbf24",
    "#4ade80", "#38bdf8",
  ];
  const COLOR_NAMES = [
    "teal", "blue", "yellow", "purple", "cyan", "orange",
    "pink", "green", "gold", "sky", "violet", "amber",
    "mint", "azure",
  ];

  const K = makeKeys("rush-hour", { solved: "rush-hour-solved-v1" });

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    solved: 0,
    perfects: 0,
    efficient: 0,
    noHint: 0,
    noUndo: 0,
    totalMoves: 0,
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  const storedSolved = store.json(K.solved, null);
  let solvedMap =
    storedSolved && typeof storedSolved === "object" && !Array.isArray(storedSolved)
      ? storedSolved
      : {};

  function saveStats() {
    store.jsonSet(K.stats, stats);
    store.jsonSet(K.solved, solvedMap);
  }

  function migrateLegacy() {
    recomputeSolved();
    saveStats();
  }

  function recomputeSolved() {
    let count = 0;
    for (const k of Object.keys(solvedMap)) if (solvedMap[k]) count++;
    stats.solved = count;
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🚗", name: "First Escape", desc: "Clear your first level.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏁", name: "Getting Somewhere", desc: "Clear 5 levels.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏆", name: "Gridlock Master", desc: "Clear 10 levels.", stat: "wins", goal: 10 },
    { id: "solve6", icon: "🗺️", name: "Explorer", desc: "Solve 6 different levels.", stat: "solved", goal: 6 },
    { id: "solve12", icon: "👑", name: "Rush Hour Royalty", desc: "Solve all 12 levels.", stat: "solved", goal: 12 },
    { id: "perfect1", icon: "⭐", name: "Perfect Run", desc: "Clear a level in par.", stat: "perfects", goal: 1 },
    { id: "perfect5", icon: "🌟", name: "Perfectionist", desc: "Clear 5 levels in par.", stat: "perfects", goal: 5 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Play 10 levels.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Play 25 levels.", stat: "games", goal: 25 },
    { id: "efficient", icon: "🎯", name: "Efficient", desc: "Clear a level at or under par.", stat: "efficient", goal: 1 },
    { id: "nohint", icon: "🧠", name: "Unassisted", desc: "Clear a level without a hint.", stat: "noHint", goal: 1 },
    { id: "noundo", icon: "🚀", name: "No Rewind", desc: "Clear a level without undoing.", stat: "noUndo", goal: 1 },
    { id: "moves100", icon: "📏", name: "Road Warrior", desc: "Make 100 moves in total.", stat: "totalMoves", goal: 100 },
    { id: "perfect12", icon: "💎", name: "Flawless", desc: "Clear all 12 levels in par.", stat: "perfects", goal: 12 },
  ];

  // ---------- Badges UI ----------
  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => (Number.isFinite(stats[key]) ? stats[key] : 0),
    onUnlock: () => {
      updateBadgeCount();
      saveStats();
    },
    onRender: () => {
      if (!achvModal.hidden) renderAchvGrid();
    },
  });

  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  function checkAchievements() {
    achv.check();
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Levels cleared", stats.wins],
        ["Distinct levels", stats.solved + " / " + LEVELS.length],
        ["In-par clears", stats.perfects],
        ["Total moves", stats.totalMoves],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
    },
    onClose: () => {
      if (badgesBtn.focus) badgesBtn.focus();
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
  audio.define("slide", [[420, 0, 0.05, "triangle", 0.035]]);
  audio.define("blocked", [[150, 0, 0.08, "square", 0.03]]);
  audio.define("win", [[523, 0, 0.1, "triangle", 0.05], [659, 0.1, 0.1, "triangle", 0.05], [784, 0.2, 0.16, "triangle", 0.05]]);

  // ---------- State ----------
  let vehicles = [];
  let levelIndex = 0;
  let moves = 0;
  let history = []; // snapshots of positions, one per committed move
  let selected = -1;
  let won = false;
  let paused = false;
  let hintsUsed = 0;
  let undosUsed = 0;
  let countedThisAttempt = false;
  let carEls = [];
  let drag = null;
  const levelPar = []; // cached optimal cell-slide counts per level

  // ---------- Geometry helpers ----------
  function targetCar(list) {
    const t = list || vehicles;
    for (const v of t) if (v.id === TARGET_ID) return v;
    return t[0];
  }

  function buildOcc(list) {
    const g = Array.from({ length: N }, () => new Array(N).fill(-1));
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      for (let k = 0; k < v.len; k++) {
        const r = v.dir === "v" ? v.row + k : v.row;
        const c = v.dir === "h" ? v.col + k : v.col;
        if (r >= 0 && r < N && c >= 0 && c < N) g[r][c] = i;
      }
    }
    return g;
  }

  function legalPositionsFor(list, occ, i) {
    const v = list[i];
    const out = [];
    if (v.dir === "h") {
      for (let c = 0; c <= N - v.len; c++) {
        if (c === v.col) continue;
        let ok = true;
        for (let k = 0; k < v.len; k++) {
          const cell = occ[v.row][c + k];
          if (cell !== -1 && cell !== i) { ok = false; break; }
        }
        if (!ok) continue;
        let path = true;
        const lo = Math.min(c, v.col);
        const hi = Math.max(c, v.col);
        for (let cc = lo; cc <= hi && path; cc++) {
          for (let k = 0; k < v.len; k++) {
            const cell = occ[v.row][cc + k];
            if (cell !== -1 && cell !== i) { path = false; break; }
          }
        }
        if (path) out.push(c);
      }
    } else {
      for (let r = 0; r <= N - v.len; r++) {
        if (r === v.row) continue;
        let ok = true;
        for (let k = 0; k < v.len; k++) {
          const cell = occ[r + k][v.col];
          if (cell !== -1 && cell !== i) { ok = false; break; }
        }
        if (!ok) continue;
        let path = true;
        const lo = Math.min(r, v.row);
        const hi = Math.max(r, v.row);
        for (let rr = lo; rr <= hi && path; rr++) {
          for (let k = 0; k < v.len; k++) {
            const cell = occ[rr + k][v.col];
            if (cell !== -1 && cell !== i) { path = false; break; }
          }
        }
        if (path) out.push(r);
      }
    }
    return out;
  }

  function rangeFor(i) {
    const v = vehicles[i];
    const occ = buildOcc(vehicles);
    const list = legalPositionsFor(vehicles, occ, i);
    let min = v.dir === "h" ? v.col : v.row;
    let max = min;
    for (const p of list) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min, max };
  }

  function positionsArray() {
    return vehicles.map((v) => (v.dir === "h" ? v.col : v.row));
  }

  function applyPositions(arr) {
    vehicles.forEach((v, i) => {
      if (v.dir === "h") v.col = arr[i];
      else v.row = arr[i];
    });
  }

  function applyPosToList(list, arr) {
    return list.map((v, i) =>
      v.dir === "h" ? Object.assign({}, v, { col: arr[i] }) : Object.assign({}, v, { row: arr[i] })
    );
  }

  function setCarPos(i, pos) {
    const v = vehicles[i];
    if (!v) return;
    if (v.dir === "h") v.col = pos;
    else v.row = pos;
  }

  // Can car `i` sit with its leading coordinate at `pos` (ignoring its own cells)?
  function canPlaceAt(list, occ, i, pos) {
    const v = list[i];
    if (v.dir === "h") {
      if (pos < 0 || pos + v.len > N) return false;
      for (let k = 0; k < v.len; k++) {
        const cell = occ[v.row][pos + k];
        if (cell !== -1 && cell !== i) return false;
      }
      return true;
    }
    if (pos < 0 || pos + v.len > N) return false;
    for (let k = 0; k < v.len; k++) {
      const cell = occ[pos + k][v.col];
      if (cell !== -1 && cell !== i) return false;
    }
    return true;
  }

  // Minimum number of single-cell slides needed to free the target.
  function computePar(list) {
    const n = list.length;
    const tIdx = list.findIndex((v) => v.id === TARGET_ID);
    const t = list[tIdx];
    const start = list.map((v) => (v.dir === "h" ? v.col : v.row));
    if (t.dir === "h" && start[tIdx] + t.len === N) return 0;
    const key = (p) => p.join(",");
    const seen = new Set([key(start)]);
    let frontier = [{ pos: start, d: 0 }];
    let nodes = 0;
    while (frontier.length) {
      const next = [];
      for (const node of frontier) {
        if (++nodes > 300000) return null;
        const cur = applyPosToList(list, node.pos);
        const occ = buildOcc(cur);
        for (let i = 0; i < n; i++) {
          const v = cur[i];
          const curPos = node.pos[i];
          for (const step of [-1, 1]) {
            const pos = curPos + step;
            if (!canPlaceAt(cur, occ, i, pos)) continue;
            const np = node.pos.slice();
            np[i] = pos;
            const k = key(np);
            if (seen.has(k)) continue;
            seen.add(k);
            if (i === tIdx && pos + v.len === N) return node.d + 1;
            next.push({ pos: np, d: node.d + 1 });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  function currentPar() {
    return levelPar[levelIndex] != null ? levelPar[levelIndex] : LEVELS[levelIndex].par;
  }

  // ---------- Solver (used for hints + level validation) ----------
  function bfsSolve(list, maxNodes) {
    const n = list.length;
    const tIdx = list.findIndex((v) => v.id === TARGET_ID);
    const t = list[tIdx];
    const startPos = list.map((v) => (v.dir === "h" ? v.col : v.row));
    if (t.dir === "h" && startPos[tIdx] + t.len === N) return { moves: 0, first: null };

    const key = (p) => p.join(",");
    const seen = new Set([key(startPos)]);
    let frontier = [{ pos: startPos, first: null, d: 0 }];
    let nodes = 0;

    while (frontier.length) {
      const next = [];
      for (const node of frontier) {
        if (++nodes > (maxNodes || 160000)) return null;
        const curList = applyPosToList(list, node.pos);
        const occ = buildOcc(curList);
        for (let i = 0; i < n; i++) {
          const v = curList[i];
          const options = legalPositionsFor(curList, occ, i);
          for (const pos of options) {
            const np = node.pos.slice();
            np[i] = pos;
            const k = key(np);
            if (seen.has(k)) continue;
            seen.add(k);
            const first = node.first || { i, pos };
            if (i === tIdx && pos + v.len === N) return { moves: node.d + 1, first };
            next.push({ pos: np, first, d: node.d + 1 });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  // ---------- Rendering ----------
  function carColor(i) {
    if (vehicles[i] && vehicles[i].id === TARGET_ID) return "#ff5b5b";
    return CAR_COLORS[(i - 1 + CAR_COLORS.length) % CAR_COLORS.length];
  }

  function carColorName(i) {
    if (vehicles[i] && vehicles[i].id === TARGET_ID) return "red";
    return COLOR_NAMES[(i - 1 + COLOR_NAMES.length) % COLOR_NAMES.length];
  }

  function carLabel(v, i) {
    const kind = v.id === TARGET_ID ? "red target car" : v.id + " car";
    return `${kind}, ${v.dir === "h" ? "horizontal" : "vertical"}, row ${v.row + 1}, column ${v.col + 1}, length ${v.len}. Use arrow keys to slide.`;
  }

  function buildBoard() {
    gridEl.innerHTML = "";
    carEls = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        cell.className = "rh-cell";
        gridEl.appendChild(cell);
      }
    }
    vehicles.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rh-car";
      if (v.id === TARGET_ID) b.classList.add("rh-car--target");
      b.style.background = carColor(i);
      b.textContent = v.id === TARGET_ID ? "→" : v.dir === "h" ? "↔" : "↕";
      b.setAttribute("aria-label", carLabel(v, i));
      b.addEventListener("pointerdown", (e) => onPointerDown(e, i));
      gridEl.appendChild(b);
      carEls.push(b);
    });
    layout();
  }

  function layout() {
    vehicles.forEach((v, i) => {
      const el = carEls[i];
      if (!el) return;
      const wCells = v.dir === "h" ? v.len : 1;
      const hCells = v.dir === "v" ? v.len : 1;
      el.style.left = (v.col / N) * 100 + "%";
      el.style.top = (v.row / N) * 100 + "%";
      el.style.width = (wCells / N) * 100 + "%";
      el.style.height = (hCells / N) * 100 + "%";
      el.classList.toggle("rh-car--sel", selected === i);
      el.setAttribute("aria-label", carLabel(v, i));
    });
  }

  function updateStatus() {
    levelEl.textContent = levelIndex + 1 + "/" + LEVELS.length;
    movesEl.textContent = moves;
    parEl.textContent = currentPar();
    levelNameEl.textContent = LEVELS[levelIndex].name;
    undoBtn.disabled = history.length === 0 || won;
  }

  // ---------- Flow ----------
  function loadLevel(idx, intro) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, idx));
    const def = LEVELS[levelIndex];
    vehicles = def.vehicles.map((v) => Object.assign({}, v));
    if (levelPar[levelIndex] == null) {
      const p = computePar(vehicles);
      if (p != null) levelPar[levelIndex] = p;
    }
    moves = 0;
    history = [];
    selected = -1;
    won = false;
    paused = false;
    hintsUsed = 0;
    undosUsed = 0;
    countedThisAttempt = false;
    drag = null;
    hideOverlay();
    buildBoard();
    updateStatus();
    hintEl.textContent =
      "Click a car, then use the arrow keys (or drag it) to slide along its lane. Each cell you slide counts as a move. Free the red car at the right edge. P pauses.";
    if (intro) showStartOverlay();
  }

  function showStartOverlay() {
    const def = LEVELS[levelIndex];
    showOverlay(
      def.name,
      `Level ${levelIndex + 1} of ${LEVELS.length} · Par ${currentPar()} · Each cell you slide counts as a move. Free the red car!`,
      [
        { label: levelIndex === 0 ? "Start" : "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function noteFirstMove() {
    if (countedThisAttempt) return;
    countedThisAttempt = true;
    stats.games++;
    saveStats();
    checkAchievements();
  }

  function commitMove(snapshot, cost) {
    const c = cost && cost > 0 ? cost : 1;
    history.push({ snap: snapshot, cost: c });
    moves += c;
    noteFirstMove();
    sfx("slide");
    layout();
    updateStatus();
    checkWin();
  }

  function checkWin() {
    if (won) return;
    const t = targetCar();
    if (!t || t.col + t.len !== N) return;

    won = true;
    const par = currentPar();
    const stars = moves <= par ? 3 : moves <= par + 6 ? 2 : 1;

    stats.wins++;
    stats.totalMoves += moves;
    if (!solvedMap[levelIndex]) {
      solvedMap[levelIndex] = true;
      recomputeSolved();
    }
    if (moves <= par) stats.perfects++;
    if (moves <= par + 3) stats.efficient++;
    if (hintsUsed === 0) stats.noHint++;
    if (undosUsed === 0) stats.noUndo++;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(stars === 3 ? 110 : 70);

    const starStr = "★".repeat(stars) + "☆".repeat(3 - stars);
    const btns = [];
    if (levelIndex < LEVELS.length - 1) {
      btns.push({
        label: "Next level →",
        onClick: () => { hideOverlay(); loadLevel(levelIndex + 1, false); },
      });
    }
    btns.push({ label: "Replay", ghost: true, onClick: () => { hideOverlay(); loadLevel(levelIndex, false); } });
    btns.push({ label: "Badges", ghost: true, onClick: () => openAchv() });

    showOverlay(
      "Level Clear! " + starStr,
      `Solved in ${moves} move${moves === 1 ? "" : "s"} (par ${par}) · ${LEVELS[levelIndex].name}.`,
      btns
    );
  }

  function restart() {
    sfx("click");
    loadLevel(levelIndex, false);
  }

  function undo() {
    if (!history.length || won) return;
    const entry = history.pop();
    applyPositions(entry.snap);
    moves = Math.max(0, moves - entry.cost);
    undosUsed++;
    selected = -1;
    sfx("click");
    layout();
    updateStatus();
  }

  function selectCar(i) {
    if (i < 0 || i >= vehicles.length) return;
    selected = i;
    sfx("select");
    layout();
  }

  function nudge(i, dir) {
    if (won || paused) return;
    const v = vehicles[i];
    if (!v) return;
    const pos = v.dir === "h" ? v.col : v.row;
    const range = rangeFor(i);
    const np = pos + dir;
    if (np < range.min || np > range.max) {
      sfx("blocked");
      return;
    }
    selected = i;
    const snapshot = positionsArray();
    setCarPos(i, np);
    commitMove(snapshot, 1);
  }

  function useHint() {
    if (won || paused) return;
    const sol = bfsSolve(vehicles, 160000);
    if (!sol || !sol.first) {
      toast.show("No hint", "Try undoing a move or restarting.", "💡");
      return;
    }
    hintsUsed++;
    const { i, pos } = sol.first;
    selected = i;
    layout();
    const v = vehicles[i];
    if (carEls[i]) {
      carEls[i].classList.add("rh-car--hint");
      setTimeout(() => {
        if (carEls[i]) carEls[i].classList.remove("rh-car--hint");
      }, 2200);
    }
    const dir =
      v.dir === "h" ? (pos > v.col ? "right" : "left") : pos > v.row ? "down" : "up";
    toast.show("Hint", `Slide the ${carColorName(i)} car ${dir}.`, "💡");
    sfx("hint");
  }

  // ---------- Pause ----------
  function canPause() {
    return !won;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Input ----------
  function onPointerDown(e, i) {
    if (e.preventDefault) e.preventDefault();
    if (won || paused || !achvModal.hidden) return;
    if (overlay.isOpen()) return;
    audio.unlock();
    selected = i;
    layout();
    const rect = gridEl.getBoundingClientRect();
    const cell = rect.width / N;
    const v = vehicles[i];
    drag = {
      i,
      startX: e.clientX,
      startY: e.clientY,
      cell,
      base: v.dir === "h" ? v.col : v.row,
      startPos: v.dir === "h" ? v.col : v.row,
      snapshot: positionsArray(),
    };
    if (carEls[i]) {
      carEls[i].classList.add("rh-car--drag");
      try { carEls[i].setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    sfx("select");
  }

  function onPointerMove(e) {
    if (!drag) return;
    const v = vehicles[drag.i];
    if (!v) return;
    const deltaPx = v.dir === "h" ? e.clientX - drag.startX : e.clientY - drag.startY;
    const steps = Math.round(deltaPx / drag.cell);
    const range = rangeFor(drag.i);
    let pos = drag.base + steps;
    if (pos < range.min) pos = range.min;
    if (pos > range.max) pos = range.max;
    setCarPos(drag.i, pos);
    layout();
  }

  function onPointerUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (carEls[d.i]) carEls[d.i].classList.remove("rh-car--drag");
    const v = vehicles[d.i];
    if (!v) return;
    const finalPos = v.dir === "h" ? v.col : v.row;
    const cost = Math.abs(finalPos - d.startPos);
    if (cost > 0) commitMove(d.snapshot, cost);
  }

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

    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (overlay.isOpen() || won || paused) return;
    if (selected < 0 || !vehicles[selected]) return;
    const v = vehicles[selected];
    if (v.dir === "h") {
      if (key === "ArrowLeft" || key === "a" || key === "A") { if (e.preventDefault) e.preventDefault(); nudge(selected, -1); }
      else if (key === "ArrowRight" || key === "d" || key === "D") { if (e.preventDefault) e.preventDefault(); nudge(selected, 1); }
    } else {
      if (key === "ArrowUp" || key === "w" || key === "W") { if (e.preventDefault) e.preventDefault(); nudge(selected, -1); }
      else if (key === "ArrowDown" || key === "s" || key === "S") { if (e.preventDefault) e.preventDefault(); nudge(selected, 1); }
    }
  }

  function bindEvents() {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("keydown", onKeyDown);

    prevBtn.addEventListener("click", () => {
      audio.unlock();
      if (levelIndex > 0) { sfx("click"); loadLevel(levelIndex - 1, false); }
    });
    nextBtn.addEventListener("click", () => {
      audio.unlock();
      if (levelIndex < LEVELS.length - 1) { sfx("click"); loadLevel(levelIndex + 1, false); }
    });
    restartBtn.addEventListener("click", () => { audio.unlock(); restart(); });
    undoBtn.addEventListener("click", () => { audio.unlock(); undo(); });
    hintBtn.addEventListener("click", () => { audio.unlock(); useHint(); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    loadLevel(0, true);
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__RUSH_HOUR = {
    N,
    LEVELS,
    stats,
    ACHIEVEMENTS,
    get vehicles() { return vehicles.map((v) => Object.assign({}, v)); },
    get levelIndex() { return levelIndex; },
    get moves() { return moves; },
    get won() { return won; },
    get paused() { return paused; },
    get selected() { return selected; },
    get historyLength() { return history.length; },
    get hintsUsed() { return hintsUsed; },
    get undosUsed() { return undosUsed; },
    get levelName() { return LEVELS[levelIndex].name; },
    get par() { return currentPar(); },
    get levelPar() { return levelPar.slice(); },
    get solvedCount() { return stats.solved; },
    target: () => Object.assign({}, targetCar()),
    buildOcc,
    canPlaceAt,
    legalPositionsFor,
    rangeFor,
    computePar,
    currentPar,
    bfsSolve,
    loadLevel,
    restart,
    undo,
    useHint,
    nudge,
    selectCar,
    setCarPos,
    checkWin,
    positionsArray,
    applyPositions,
    recomputeSolved,
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    setPaused,
    togglePause,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();