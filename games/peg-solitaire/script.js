// Peg Solitaire — classic English board (cross-shaped, 33 holes). Fully offline.
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
  const pegsLeftEl = dom.byId("pegs-left");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const undoBtn = dom.byId("undo");
  const newGameBtn = dom.byId("new-game");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  // ---------- Board geometry ----------
  // 7×7 validity mask — the cross: arms of rows 0,1,5,6 only span cols 2..4.
  const isValid = (r, c) =>
    (r >= 0 && r < 7 && c >= 0 && c < 7) &&
    ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const EMPTY = 0, PEG = 1, VOID = -1;
  const HISTORY_CAP = 200;
  const CENTER = [3, 3];
  const CORNERS = [[0, 3], [3, 0], [3, 6], [6, 3]];

  const K = makeKeys("peg-solitaire");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0, // boards played to completion
    wins: 0, // perfect solves (one peg left)
    perfectCenter: 0, // wins with the last peg in the center
    perfectCorner: 0, // wins with the last peg in a corner
    streak: 0,
    bestStreak: 0,
    nearlyWins: 0, // boards that ended with exactly 2 pegs
    totalMoves: 0,
    undone: 0,
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

  /**
   * Carry the pre-core win counter into the standard stats blob, then drop
   * the legacy key so both formats never diverge.
   */
  function migrateLegacy() {
    const raw = store.get("pegsol-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("pegsol-wins");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Board", desc: "Play a board through to the end.", stat: "games", goal: 1 },
    { id: "win1", icon: "🏆", name: "Perfect Solve", desc: "Leave exactly one peg.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🧪", name: "Consistent", desc: "Perfectly solve 5 boards.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Solitaire Master", desc: "Perfectly solve 10 boards.", stat: "wins", goal: 10 },
    { id: "center", icon: "🎪", name: "Center Stage", desc: "End a win with the peg in the center hole.", stat: "perfectCenter", goal: 1 },
    { id: "corner", icon: "💎", name: "Corner Shot", desc: "End a win with the peg in a corner.", stat: "perfectCorner", goal: 1 },
    {
      id: "both",
      icon: "⚖️",
      name: "Any Position",
      desc: "Win with the peg in both the center and a corner.",
      stat: "wins",
      goal: 1,
      satisfied: () => stats.perfectCenter >= 1 && stats.perfectCorner >= 1,
      progress: () => {
        const a = stats.perfectCenter >= 1;
        const b = stats.perfectCorner >= 1;
        return {
          pct: a && b ? 100 : a || b ? 50 : 0,
          now: a || b ? 1 : 0,
          text: a && b ? "Unlocked" : a || b ? "One more position to conquer" : "Win in both positions",
        };
      },
    },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 boards in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎖️", name: "Three in a Row", desc: "Win 3 boards in a row.", stat: "bestStreak", goal: 3 },
    { id: "nearly10", icon: "😅", name: "So Close", desc: "End 10 boards with just 2 pegs left.", stat: "nearlyWins", goal: 10 },
    { id: "moves100", icon: "🚶", name: "Jumper", desc: "Make 100 jumps in total.", stat: "totalMoves", goal: 100 },
    { id: "moves500", icon: "🏃", name: "Marathon", desc: "Make 500 jumps in total.", stat: "totalMoves", goal: 500 },
    { id: "games20", icon: "🎮", name: "Regular", desc: "Play 20 boards.", stat: "games", goal: 20 },
    { id: "undo10", icon: "↩️", name: "Second Thoughts", desc: "Use undo 10 times.", stat: "undone", goal: 10 },
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
    getStat: (key) => stats[key] || 0,
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
        ["Boards played", stats.games],
        ["Perfect solves", stats.wins],
        ["Center wins", stats.perfectCenter],
        ["Corner wins", stats.perfectCorner],
        ["Best streak", stats.bestStreak],
        ["Total jumps", stats.totalMoves],
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
  let board;
  let selected = null;
  let moves = 0;
  let history = [];
  let gameOver = false;
  let paused = false;

  function pegCount() {
    let n = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (board[r][c] === PEG) n++;
    return n;
  }

  function lastPegPos() {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) if (board[r][c] === PEG) return [r, c];
    return null;
  }

  function movesFrom(r, c) {
    if (!isValid(r, c) || board[r][c] !== PEG) return [];
    const out = [];
    for (const [dr, dc] of DIRS) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!isValid(tr, tc)) continue;
      if (board[mr][mc] === PEG && board[tr][tc] === EMPTY) out.push({ over: [mr, mc], to: [tr, tc] });
    }
    return out;
  }

  function anyMovesLeft() {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++)
        if (board[r][c] === PEG && movesFrom(r, c).length) return true;
    return false;
  }

  // ---------- Rendering ----------
  function updateHud() {
    movesEl.textContent = moves;
    pegsLeftEl.textContent = pegCount();
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    undoBtn.disabled = gameOver || paused || history.length === 0;
    newGameBtn.disabled = false;
  }

  function render() {
    boardEl.innerHTML = "";
    const targets = selected ? movesFrom(selected[0], selected[1]).map((m) => m.to.join(",")) : [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (!isValid(r, c)) {
          const spacer = document.createElement("div");
          spacer.className = "peg-invalid";
          boardEl.appendChild(spacer);
          continue;
        }
        const cell = document.createElement("button");
        cell.className = "peg-cell";
        cell.setAttribute("aria-label", board[r][c] === PEG ? "Peg" : "Empty hole");
        if (board[r][c] === PEG) {
          const peg = document.createElement("span");
          peg.className = "peg";
          cell.appendChild(peg);
          if (selected && selected[0] === r && selected[1] === c) cell.classList.add("peg-cell--selected");
        } else if (targets.includes(r + "," + c)) {
          cell.classList.add("peg-cell--target");
        }
        cell.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
    updateHud();
  }

  function pushHistory() {
    history.push({ board: board.map((row) => row.slice()), moves });
    if (history.length > HISTORY_CAP) history.shift();
  }

  // ---------- Game flow ----------
  function onCellClick(r, c) {
    if (gameOver || paused) return;
    if (!isValid(r, c)) return;
    if (board[r][c] === PEG) {
      // Clicking another peg re-selects; clicking the selected peg deselects.
      const wasSelected = selected && selected[0] === r && selected[1] === c;
      selected = wasSelected ? null : [r, c];
      if (!wasSelected) sfx("select");
      render();
      return;
    }
    if (selected) {
      const move = movesFrom(selected[0], selected[1]).find((m) => m.to[0] === r && m.to[1] === c);
      if (move) {
        pushHistory();
        board[selected[0]][selected[1]] = EMPTY;
        board[move.over[0]][move.over[1]] = EMPTY;
        board[r][c] = PEG;
        moves++;
        stats.totalMoves++;
        selected = null;
        sfx("place");
        render();
        checkEnd();
        return;
      }
      // Invalid destination — deselect.
      selected = null;
      render();
    }
  }

  function undo() {
    if (paused || !history.length) return;
    const snap = history.pop();
    board = snap.board.map((row) => row.slice());
    moves = snap.moves;
    selected = null;
    gameOver = false;
    paused = false;
    stats.undone++;
    saveStats();
    checkAchievements();
    sfx("flip");
    hideOverlay();
    render();
  }

  function checkEnd() {
    if (anyMovesLeft()) return;
    gameOver = true;
    paused = false;
    const n = pegCount();
    const last = lastPegPos();

    stats.games++;
    if (n === 1) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (last && last[0] === CENTER[0] && last[1] === CENTER[1]) stats.perfectCenter++;
      if (last && CORNERS.some(([cr, cc]) => cr === last[0] && cc === last[1])) stats.perfectCorner++;
    } else {
      stats.streak = 0;
      if (n === 2) stats.nearlyWins++;
    }
    saveStats();
    checkAchievements();
    render();

    if (n === 1) {
      sfx("win");
      confetti(90);
      showOverlay("Perfect solve! 🏆", `One peg left in ${moves} moves. Beautifully played!`, [
        { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      sfx("over");
      showOverlay(`Game over — ${n} pegs left`, "No jumps remain. Better luck next board!", [
        { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
  }

  function reset() {
    board = [];
    for (let r = 0; r < 7; r++) {
      const row = [];
      for (let c = 0; c < 7; c++) row.push(isValid(r, c) ? PEG : VOID);
      board.push(row);
    }
    board[3][3] = EMPTY; // standard: center hole starts empty
    moves = 0;
    history = [];
    selected = null;
    gameOver = false;
    paused = false;
    hideOverlay();
    render();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New board", ghost: true, onClick: () => { hideOverlay(); setPaused(false); reset(); } },
      ]);
    } else {
      hideOverlay();
    }
    render();
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
    undoBtn.addEventListener("click", () => { sfx("click"); undo(); });
    newGameBtn.addEventListener("click", () => { sfx("click"); reset(); });

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
    reset();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__PEGSOL = {
    board: () => board.map((row) => row.slice()),
    pegsLeft: pegCount,
    lastPeg: lastPegPos,
    movesFrom,
    anyMovesLeft,
    get moves() { return moves; },
    get selected() { return selected ? selected.slice() : null; },
    get history() { return history.length; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    stats,
    ACHIEVEMENTS,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    click: onCellClick,
    undo,
    newGame: reset,
    setPaused,
    togglePause,
    checkAchievements,
    saveStats,
    openAchv,
    closeAchv,
    overlay,
  };

  init();
})();
