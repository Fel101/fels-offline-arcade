// Math Cages / Calcudoku — fill the grid so every row and column is a permutation
// of 1..N and every cage hits its target. Pure vanilla JS, fully offline.
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
  const padEl = dom.byId("pad");
  const levelEl = dom.byId("level");
  const sizeEl = dom.byId("size");
  const mistakesEl = dom.byId("mistakes");
  const prevBtn = dom.byId("prev");
  const nextBtn = dom.byId("next");
  const restartBtn = dom.byId("restart");
  const undoBtn = dom.byId("undo");
  const checkBtn = dom.byId("check");
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

  // ---------- Puzzles (generated with verified unique solutions) ----------
  const PUZZLES = [{"size":4,"cages":[{"cells":[[0,0],[1,0]],"op":"-","target":1},{"cells":[[0,3],[1,3],[0,2]],"op":"+","target":8},{"cells":[[2,3]],"op":"=","target":3},{"cells":[[3,2],[3,1],[3,0],[3,3]],"op":"+","target":10},{"cells":[[2,0],[2,1],[2,2]],"op":"+","target":7},{"cells":[[0,1],[1,1]],"op":"/","target":3},{"cells":[[1,2]],"op":"=","target":1}],"solution":[[3,1,2,4],[4,3,1,2],[1,2,4,3],[2,4,3,1]]},{"size":4,"cages":[{"cells":[[0,0],[1,0],[0,1]],"op":"+","target":5},{"cells":[[3,2],[2,2]],"op":"/","target":3},{"cells":[[3,3]],"op":"=","target":4},{"cells":[[2,0],[3,0]],"op":"*","target":8},{"cells":[[0,2],[0,3],[1,2]],"op":"*","target":16},{"cells":[[1,1],[2,1]],"op":"*","target":8},{"cells":[[2,3],[1,3]],"op":"+","target":4},{"cells":[[3,1]],"op":"=","target":3}],"solution":[[3,1,4,2],[1,4,2,3],[4,2,3,1],[2,3,1,4]]},{"size":4,"cages":[{"cells":[[2,2],[1,2],[2,3]],"op":"+","target":10},{"cells":[[3,1],[3,0],[2,1],[3,2]],"op":"+","target":11},{"cells":[[0,1],[1,1],[0,2],[0,3]],"op":"*","target":6},{"cells":[[3,3]],"op":"=","target":2},{"cells":[[0,0],[1,0],[2,0]],"op":"*","target":8},{"cells":[[1,3]],"op":"=","target":3}],"solution":[[4,2,3,1],[2,1,4,3],[1,3,2,4],[3,4,1,2]]},{"size":4,"cages":[{"cells":[[2,2],[2,1]],"op":"/","target":2},{"cells":[[0,0],[0,1],[0,2],[1,2]],"op":"+","target":13},{"cells":[[3,1],[3,0]],"op":"*","target":4},{"cells":[[1,1],[1,0]],"op":"/","target":2},{"cells":[[2,0]],"op":"=","target":3},{"cells":[[2,3],[3,3],[1,3],[0,3]],"op":"*","target":24},{"cells":[[3,2]],"op":"=","target":3}],"solution":[[4,3,2,1],[2,1,4,3],[3,2,1,4],[1,4,3,2]]},{"size":4,"cages":[{"cells":[[3,2],[3,3],[2,3],[2,2]],"op":"+","target":9},{"cells":[[0,0],[1,0],[1,1]],"op":"+","target":7},{"cells":[[2,0]],"op":"=","target":3},{"cells":[[2,1]],"op":"=","target":4},{"cells":[[0,1],[0,2],[1,2]],"op":"*","target":24},{"cells":[[1,3],[0,3]],"op":"+","target":4},{"cells":[[3,1],[3,0]],"op":"/","target":3}],"solution":[[4,2,3,1],[2,1,4,3],[3,4,1,2],[1,3,2,4]]},{"size":4,"cages":[{"cells":[[0,0],[0,1],[1,1],[0,2]],"op":"*","target":12},{"cells":[[3,3],[3,2],[2,2],[2,3]],"op":"*","target":12},{"cells":[[1,2],[1,3],[0,3]],"op":"*","target":12},{"cells":[[1,0]],"op":"=","target":4},{"cells":[[3,0],[3,1]],"op":"/","target":2},{"cells":[[2,0],[2,1]],"op":"*","target":6}],"solution":[[1,3,4,2],[4,1,2,3],[3,2,1,4],[2,4,3,1]]},{"size":5,"cages":[{"cells":[[0,4],[1,4],[0,3],[1,3]],"op":"*","target":6},{"cells":[[4,4],[3,4],[3,3]],"op":"+","target":12},{"cells":[[3,2],[2,2],[3,1],[2,3]],"op":"*","target":4},{"cells":[[1,0],[0,0]],"op":"*","target":10},{"cells":[[2,1],[1,1]],"op":"+","target":7},{"cells":[[4,2],[4,3],[4,1]],"op":"+","target":11},{"cells":[[3,0],[2,0],[4,0]],"op":"*","target":12},{"cells":[[2,4]],"op":"=","target":5},{"cells":[[0,1],[0,2]],"op":"*","target":20},{"cells":[[1,2]],"op":"=","target":3}],"solution":[[2,5,4,3,1],[5,4,3,1,2],[4,3,1,2,5],[3,1,2,5,4],[1,2,5,4,3]]},{"size":5,"cages":[{"cells":[[2,4],[1,4],[2,3],[1,3]],"op":"+","target":8},{"cells":[[4,4],[3,4],[4,3]],"op":"*","target":60},{"cells":[[2,0],[2,1]],"op":"-","target":4},{"cells":[[1,1],[1,2]],"op":"-","target":2},{"cells":[[4,0],[4,1],[3,0]],"op":"*","target":6},{"cells":[[3,3],[3,2]],"op":"-","target":1},{"cells":[[3,1]],"op":"=","target":2},{"cells":[[4,2]],"op":"=","target":1},{"cells":[[0,2],[0,3],[0,4],[0,1]],"op":"+","target":12},{"cells":[[2,2]],"op":"=","target":4},{"cells":[[1,0],[0,0]],"op":"+","target":7}],"solution":[[3,4,2,1,5],[4,5,3,2,1],[5,1,4,3,2],[1,2,5,4,3],[2,3,1,5,4]]},{"size":5,"cages":[{"cells":[[0,3],[1,3],[1,4]],"op":"*","target":60},{"cells":[[0,0],[0,1]],"op":"+","target":5},{"cells":[[3,4],[3,3],[4,3]],"op":"+","target":6},{"cells":[[2,0],[3,0],[3,1],[4,0]],"op":"+","target":13},{"cells":[[4,1],[4,2]],"op":"+","target":9},{"cells":[[1,2],[2,2],[2,1]],"op":"+","target":7},{"cells":[[2,3],[2,4]],"op":"-","target":1},{"cells":[[0,4]],"op":"=","target":1},{"cells":[[1,1],[1,0]],"op":"+","target":6},{"cells":[[3,2]],"op":"=","target":1},{"cells":[[4,4]],"op":"=","target":2},{"cells":[[0,2]],"op":"=","target":4}],"solution":[[2,3,4,5,1],[5,1,2,3,4],[1,2,3,4,5],[4,5,1,2,3],[3,4,5,1,2]]},{"size":5,"cages":[{"cells":[[3,2],[3,3],[4,2]],"op":"+","target":10},{"cells":[[2,3]],"op":"=","target":4},{"cells":[[1,4],[0,4],[2,4]],"op":"*","target":6},{"cells":[[1,3],[1,2],[2,2]],"op":"*","target":6},{"cells":[[0,2],[0,1]],"op":"-","target":1},{"cells":[[3,4]],"op":"=","target":4},{"cells":[[0,0],[1,0]],"op":"/","target":4},{"cells":[[4,1],[4,0],[3,1],[3,0]],"op":"*","target":18},{"cells":[[2,0],[2,1]],"op":"+","target":7},{"cells":[[4,4],[4,3]],"op":"-","target":3},{"cells":[[0,3]],"op":"=","target":3},{"cells":[[1,1]],"op":"=","target":5}],"solution":[[1,4,5,3,2],[4,5,2,1,3],[5,2,3,4,1],[2,3,1,5,4],[3,1,4,2,5]]},{"size":5,"cages":[{"cells":[[0,1],[0,2]],"op":"-","target":4},{"cells":[[1,3],[1,4],[2,4],[2,3]],"op":"*","target":200},{"cells":[[1,2],[2,2]],"op":"-","target":1},{"cells":[[3,4],[4,4],[3,3],[3,2]],"op":"*","target":24},{"cells":[[4,3],[4,2],[4,1],[3,1]],"op":"+","target":11},{"cells":[[0,3],[0,4]],"op":"*","target":12},{"cells":[[1,1],[1,0]],"op":"/","target":3},{"cells":[[3,0],[4,0]],"op":"-","target":1},{"cells":[[2,0],[2,1]],"op":"*","target":12},{"cells":[[0,0]],"op":"=","target":2}],"solution":[[2,1,5,4,3],[1,3,2,5,4],[3,4,1,2,5],[5,2,4,3,1],[4,5,3,1,2]]},{"size":5,"cages":[{"cells":[[2,1]],"op":"=","target":4},{"cells":[[1,2],[1,1],[2,2]],"op":"+","target":10},{"cells":[[1,3]],"op":"=","target":4},{"cells":[[3,3],[3,4]],"op":"-","target":3},{"cells":[[3,2],[4,2],[3,1]],"op":"*","target":3},{"cells":[[2,0],[3,0]],"op":"*","target":12},{"cells":[[2,3],[2,4]],"op":"*","target":5},{"cells":[[0,3],[0,2],[0,1],[0,4]],"op":"+","target":14},{"cells":[[1,4]],"op":"=","target":1},{"cells":[[1,0],[0,0]],"op":"/","target":2},{"cells":[[4,0],[4,1]],"op":"+","target":7},{"cells":[[4,3],[4,4]],"op":"-","target":1}],"solution":[[1,5,4,2,3],[2,3,5,4,1],[3,4,2,1,5],[4,1,3,5,2],[5,2,1,3,4]]}];

  const K = makeKeys("kenken");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    solved4: 0,
    solved5: 0,
    perfect: 0,
    noHintWins: 0,
    mistakes: 0,
    hints: 0,
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

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  function migrateLegacy() {
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🔢", name: "First Fill", desc: "Solve your first puzzle.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏁", name: "Getting There", desc: "Solve 5 puzzles.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏆", name: "Grid Master", desc: "Solve 10 puzzles.", stat: "wins", goal: 10 },
    { id: "solve4", icon: "4️⃣", name: "Four by Four", desc: "Solve a 4×4 puzzle.", stat: "solved4", goal: 1 },
    { id: "solve5", icon: "5️⃣", name: "Five Alive", desc: "Solve a 5×5 puzzle.", stat: "solved5", goal: 1 },
    { id: "perfect1", icon: "⭐", name: "Flawless", desc: "Solve a puzzle with no mistakes.", stat: "perfect", goal: 1 },
    { id: "perfect5", icon: "🌟", name: "Perfectionist", desc: "Solve 5 puzzles with no mistakes.", stat: "perfect", goal: 5 },
    { id: "streak3", icon: "🔥", name: "Hat Trick", desc: "Solve 3 puzzles in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Solve 5 puzzles in a row.", stat: "bestStreak", goal: 5 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Play 10 puzzles.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Play 25 puzzles.", stat: "games", goal: 25 },
    { id: "nohint1", icon: "🧠", name: "Unassisted", desc: "Solve a puzzle without a hint.", stat: "noHintWins", goal: 1 },
    { id: "nohint5", icon: "🎓", name: "Self-Made", desc: "Solve 5 puzzles without a hint.", stat: "noHintWins", goal: 5 },
    {
      id: "allrounder",
      icon: "🌈",
      name: "All-Rounder",
      desc: "Solve 3 puzzles of each size.",
      stat: "solved4",
      goal: 3,
      satisfied: () => stats.solved4 >= 3 && stats.solved5 >= 3,
      progress: () => ({
        pct: Math.min(100, Math.round(((Math.min(stats.solved4, 3) + Math.min(stats.solved5, 3)) / 6) * 100)),
        now: Math.min(stats.solved4, 3) + Math.min(stats.solved5, 3),
        text: `${Math.min(stats.solved4, 3)}/3 · ${Math.min(stats.solved5, 3)}/3`,
      }),
    },
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
        ["Solved", stats.wins],
        ["4×4 / 5×5", stats.solved4 + " / " + stats.solved5],
        ["No-mistake solves", stats.perfect],
        ["Best streak", stats.bestStreak],
        ["Hints used", stats.hints],
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
  audio.define("place", [[520, 0, 0.04, "triangle", 0.03]]);
  audio.define("erase", [[300, 0, 0.04, "triangle", 0.025]]);
  audio.define("bad", [[170, 0, 0.09, "square", 0.035]]);
  audio.define("good", [[660, 0, 0.06, "triangle", 0.04], [880, 0.06, 0.08, "triangle", 0.04]]);

  // ---------- State ----------
  let puzzle = PUZZLES[0];
  let size = puzzle.size;
  let cages = puzzle.cages;
  let solution = puzzle.solution;
  let values = [];
  let cageOf = [];
  let anchorOf = [];
  let selected = { r: 0, c: 0 };
  let mistakes = 0;
  let hintsUsed = 0;
  let won = false;
  let paused = false;
  let history = [];
  let wrongCells = new Set();
  let hintCells = new Set();
  let countedThisAttempt = false;
  let fullToastShown = false;
  let levelIndex = 0;

  // ---------- Helpers ----------
  const key = (r, c) => r + "," + c;

  const OP_SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷", "=": "" };

  function cageLabel(cage) {
    if (cage.cells.length === 1) return String(cage.target);
    return cage.target + OP_SYMBOL[cage.op];
  }

  function buildCageIndex() {
    cageOf = Array.from({ length: size }, () => new Array(size).fill(-1));
    anchorOf = new Array(cages.length);
    cages.forEach((cage, ci) => {
      let best = null;
      for (const [r, c] of cage.cells) {
        cageOf[r][c] = ci;
        if (!best || r < best[0] || (r === best[0] && c < best[1])) best = [r, c];
      }
      anchorOf[ci] = best[0] * size + best[1];
    });
  }

  function zeros() {
    return Array.from({ length: size }, () => new Array(size).fill(0));
  }

  function isFull() {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (!values[r][c]) return false;
    return true;
  }

  function isCorrect() {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (values[r][c] !== solution[r][c]) return false;
    return true;
  }

  function computeConflicts() {
    const bad = new Set();
    for (let r = 0; r < size; r++) {
      const seen = new Map();
      for (let c = 0; c < size; c++) {
        const v = values[r][c];
        if (!v) continue;
        if (seen.has(v)) {
          bad.add(key(r, c));
          bad.add(key(r, seen.get(v)));
        } else seen.set(v, c);
      }
    }
    for (let c = 0; c < size; c++) {
      const seen = new Map();
      for (let r = 0; r < size; r++) {
        const v = values[r][c];
        if (!v) continue;
        if (seen.has(v)) {
          bad.add(key(r, c));
          bad.add(key(seen.get(v), c));
        } else seen.set(v, r);
      }
    }
    return bad;
  }

  function peersOf(sel) {
    const set = new Set();
    for (let c = 0; c < size; c++) if (c !== sel.c) set.add(key(sel.r, c));
    for (let r = 0; r < size; r++) if (r !== sel.r) set.add(key(r, sel.c));
    return set;
  }

  // ---------- Rendering ----------
  function render() {
    boardEl.style.setProperty("--n", size);
    boardEl.innerHTML = "";
    const conflicts = computeConflicts();
    const peers = selected ? peersOf(selected) : new Set();

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const ci = cageOf[r][c];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "kk-cell";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("data-r", String(r));
        cell.setAttribute("data-c", String(c));

        if (r === 0 || cageOf[r - 1][c] !== ci) cell.classList.add("bd-t");
        if (r === size - 1 || cageOf[r + 1][c] !== ci) cell.classList.add("bd-b");
        if (c === 0 || cageOf[r][c - 1] !== ci) cell.classList.add("bd-l");
        if (c === size - 1 || cageOf[r][c + 1] !== ci) cell.classList.add("bd-r");

        if (selected && selected.r === r && selected.c === c) cell.classList.add("kk-cell--sel");
        else if (peers.has(key(r, c))) cell.classList.add("kk-cell--peer");
        if (conflicts.has(key(r, c))) cell.classList.add("kk-cell--bad");
        if (wrongCells.has(key(r, c))) cell.classList.add("kk-cell--wrong");
        if (hintCells.has(key(r, c))) cell.classList.add("kk-cell--hint");

        const vspan = document.createElement("span");
        vspan.textContent = values[r][c] ? String(values[r][c]) : "";
        cell.appendChild(vspan);

        if (anchorOf[ci] === r * size + c) {
          const label = document.createElement("span");
          label.className = "kk-label";
          label.textContent = cageLabel(cages[ci]);
          cell.appendChild(label);
        }

        cell.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(cell);
      }
    }
    undoBtn.disabled = history.length === 0 || won;
  }

  function buildPad() {
    padEl.innerHTML = "";
    for (let v = 1; v <= size; v++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kk-key";
      b.textContent = String(v);
      b.setAttribute("aria-label", "Enter " + v);
      b.addEventListener("click", () => {
        audio.unlock();
        placeValue(v);
      });
      padEl.appendChild(b);
    }
    const erase = document.createElement("button");
    erase.type = "button";
    erase.className = "kk-key kk-key--erase";
    erase.textContent = "⌫ Erase";
    erase.setAttribute("aria-label", "Erase selected cell");
    erase.addEventListener("click", () => {
      audio.unlock();
      placeValue(0);
    });
    padEl.appendChild(erase);
  }

  function updateStatus() {
    levelEl.textContent = levelIndex + 1 + "/" + PUZZLES.length;
    sizeEl.textContent = size + "×" + size;
    mistakesEl.textContent = mistakes;
    undoBtn.disabled = history.length === 0 || won;
  }

  // ---------- Flow ----------
  function loadLevel(idx, intro) {
    levelIndex = Math.max(0, Math.min(PUZZLES.length - 1, idx));
    puzzle = PUZZLES[levelIndex];
    size = puzzle.size;
    cages = puzzle.cages;
    solution = puzzle.solution;
    values = zeros();
    buildCageIndex();
    selected = { r: 0, c: 0 };
    mistakes = 0;
    hintsUsed = 0;
    won = false;
    paused = false;
    history = [];
    wrongCells = new Set();
    hintCells = new Set();
    countedThisAttempt = false;
    fullToastShown = false;
    hideOverlay();
    buildPad();
    render();
    updateStatus();
    hintEl.textContent =
      "Fill each row and column with 1–" + size + " without repeats. Cages must hit their target using the shown operation. Click a cell and type or tap a number. P pauses.";
    if (intro) showStartOverlay();
  }

  function showStartOverlay() {
    showOverlay(
      "Math Cages",
      `${size}×${size} · Puzzle ${levelIndex + 1} of ${PUZZLES.length}. Fill rows and columns with 1–${size}, and make every cage hit its target.`,
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
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

  function pushHistory() {
    history.push(values.map((row) => row.slice()));
    if (history.length > 200) history.shift();
  }

  function placeValue(v) {
    if (won || paused || overlay.isOpen()) return;
    if (!selected) return;
    const { r, c } = selected;
    if (values[r][c] === v) return;
    pushHistory();
    values[r][c] = v;
    if (v) {
      wrongCells.delete(key(r, c));
      hintCells.delete(key(r, c));
    }
    noteFirstMove();
    sfx(v ? "place" : "erase");
    afterChange();
  }

  function afterChange() {
    render();
    updateStatus();
    if (isFull()) {
      fullToastShown = false;
      if (isCorrect()) win();
      else if (!fullToastShown) {
        fullToastShown = true;
        toast.show("So close", "Hit Check to find the slips.", "🔎");
        sfx("bad");
      }
    }
  }

  function selectCell(r, c) {
    if (won || paused || overlay.isOpen()) return;
    selected = { r, c };
    sfx("select");
    render();
  }

  function moveSelection(dr, dc) {
    if (!selected) selected = { r: 0, c: 0 };
    const nr = Math.max(0, Math.min(size - 1, selected.r + dr));
    const nc = Math.max(0, Math.min(size - 1, selected.c + dc));
    if (nr === selected.r && nc === selected.c) return;
    selected = { r: nr, c: nc };
    sfx("select");
    render();
  }

  function check() {
    if (won || paused) return;
    const wrong = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (values[r][c] && values[r][c] !== solution[r][c]) wrong.push([r, c]);

    if (wrong.length === 0) {
      if (isFull()) return win();
      sfx("good");
      toast.show("Looking good", "Every filled cell is correct so far.", "👍");
      return;
    }

    mistakes += wrong.length;
    stats.mistakes += wrong.length;
    wrong.forEach(([r, c]) => wrongCells.add(key(r, c)));
    sfx("bad");
    toast.show("Not quite", wrong.length + " cell" + (wrong.length === 1 ? "" : "s") + " to revisit.", "🤔");
    render();
    updateStatus();
    saveStats();
    checkAchievements();
  }

  function useHint() {
    if (won || paused) return;
    let cell = null;
    if (selected && values[selected.r][selected.c] !== solution[selected.r][selected.c]) {
      cell = selected;
    }
    if (!cell) {
      for (let r = 0; r < size && !cell; r++)
        for (let c = 0; c < size; c++)
          if (values[r][c] !== solution[r][c]) { cell = { r, c }; break; }
    }
    if (!cell) {
      toast.show("All correct", "Nothing left to reveal.", "✨");
      return;
    }
    hintsUsed++;
    stats.hints++;
    pushHistory();
    values[cell.r][cell.c] = solution[cell.r][cell.c];
    wrongCells.delete(key(cell.r, cell.c));
    hintCells.add(key(cell.r, cell.c));
    selected = { r: cell.r, c: cell.c };
    noteFirstMove();
    sfx("hint");
    saveStats();
    render();
    updateStatus();
    if (isFull() && isCorrect()) win();
  }

  function undo() {
    if (!history.length || won) return;
    values = history.pop().map((row) => row.slice());
    wrongCells.clear();
    hintCells.clear();
    fullToastShown = false;
    sfx("click");
    render();
    updateStatus();
  }

  function restart() {
    sfx("click");
    loadLevel(levelIndex, false);
  }

  // ---------- Win ----------
  function win() {
    if (won) return;
    won = true;
    paused = false;

    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (size === 4) stats.solved4++;
    else stats.solved5++;
    if (mistakes === 0) stats.perfect++;
    if (hintsUsed === 0) stats.noHintWins++;
    saveStats();
    checkAchievements();
    updateStatus();
    render();

    sfx("win");
    confetti(90);

    const btns = [];
    if (levelIndex < PUZZLES.length - 1) {
      btns.push({
        label: "Next puzzle →",
        onClick: () => { hideOverlay(); loadLevel(levelIndex + 1, false); },
      });
    }
    btns.push({ label: "Replay", ghost: true, onClick: () => { hideOverlay(); loadLevel(levelIndex, false); } });
    btns.push({ label: "Badges", ghost: true, onClick: () => openAchv() });

    showOverlay(
      "Solved! 🎉",
      `${size}×${size} · ${mistakes === 0 ? "No mistakes" : mistakes + " mistake" + (mistakes === 1 ? "" : "s")} · ${hintsUsed === 0 ? "no hints" : hintsUsed + " hint" + (hintsUsed === 1 ? "" : "s")}.`,
      btns
    );
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

    if (key >= "1" && key <= "9") {
      const n = parseInt(key, 10);
      if (n <= size) {
        if (e.preventDefault) e.preventDefault();
        placeValue(n);
      }
      return;
    }
    if (key === "Backspace" || key === "Delete" || key === "0") {
      if (e.preventDefault) e.preventDefault();
      placeValue(0);
      return;
    }
    if (key === "ArrowUp" || key === "w" || key === "W") { if (e.preventDefault) e.preventDefault(); moveSelection(-1, 0); }
    else if (key === "ArrowDown" || key === "s" || key === "S") { if (e.preventDefault) e.preventDefault(); moveSelection(1, 0); }
    else if (key === "ArrowLeft" || key === "a" || key === "A") { if (e.preventDefault) e.preventDefault(); moveSelection(0, -1); }
    else if (key === "ArrowRight" || key === "d" || key === "D") { if (e.preventDefault) e.preventDefault(); moveSelection(0, 1); }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    prevBtn.addEventListener("click", () => {
      audio.unlock();
      if (levelIndex > 0) { sfx("click"); loadLevel(levelIndex - 1, false); }
    });
    nextBtn.addEventListener("click", () => {
      audio.unlock();
      if (levelIndex < PUZZLES.length - 1) { sfx("click"); loadLevel(levelIndex + 1, false); }
    });
    restartBtn.addEventListener("click", () => { audio.unlock(); restart(); });
    undoBtn.addEventListener("click", () => { audio.unlock(); undo(); });
    checkBtn.addEventListener("click", () => { audio.unlock(); check(); });
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
  window.__KENKEN = {
    PUZZLES,
    stats,
    ACHIEVEMENTS,
    get puzzle() { return puzzle; },
    get size() { return size; },
    get cages() { return cages; },
    get solution() { return solution.map((row) => row.slice()); },
    get values() { return values.map((row) => row.slice()); },
    get selected() { return { r: selected.r, c: selected.c }; },
    get mistakes() { return mistakes; },
    get hintsUsed() { return hintsUsed; },
    get won() { return won; },
    get paused() { return paused; },
    get historyLength() { return history.length; },
    get levelIndex() { return levelIndex; },
    cageLabel,
    computeConflicts,
    isFull,
    isCorrect,
    loadLevel,
    placeValue,
    selectCell,
    moveSelection,
    check,
    useHint,
    undo,
    restart,
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