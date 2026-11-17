// Go (9×9) — place stones, capture groups, surround territory.
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
  const boardEl = dom.byId("board");
  const capBlackEl = dom.byId("cap-black");
  const capWhiteEl = dom.byId("cap-white");
  const turnEl = dom.byId("turn");
  const passBtn = dom.byId("pass");
  const undoBtn = dom.byId("undo");
  const restartBtn = dom.byId("restart");
  const hintEl = dom.byId("hint");
  const modeCpuBtn = dom.byId("mode-cpu");
  const mode2pBtn = dom.byId("mode-2p");

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
  const N = 9;
  const BLACK = 1;
  const WHITE = 2;
  const KOMI = 5.5;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const HOSHI = new Set([2 * N + 2, 2 * N + 6, 6 * N + 2, 6 * N + 6, 4 * N + 4]);

  const K = makeKeys("go");

  // ---------- Seeded RNG (CPU variety) ----------
  let rngState = 0x1f2e3d4c;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    captures: 0,
    moves: 0,
    bestMargin: 0,
    bigCapture: 0,
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
    { id: "first", icon: "🎉", name: "First Game", desc: "Finish your first game.", stat: "games", goal: 1 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Finish 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Finish 25 games.", stat: "games", goal: 25 },
    { id: "games50", icon: "🥷", name: "Dedicated", desc: "Finish 50 games.", stat: "games", goal: 50 },
    { id: "win1", icon: "🏁", name: "First Win", desc: "Win a game as Black.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏆", name: "Winner", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "cap10", icon: "🪨", name: "Capturer", desc: "Capture 10 stones.", stat: "captures", goal: 10 },
    { id: "cap50", icon: "🗿", name: "Stone Hunter", desc: "Capture 50 stones.", stat: "captures", goal: 50 },
    { id: "cap100", icon: "🧱", name: "Wrecker", desc: "Capture 100 stones.", stat: "captures", goal: 100 },
    { id: "bigcap5", icon: "💥", name: "Big Capture", desc: "Capture 5+ stones in one move.", stat: "bigCapture", goal: 5 },
    { id: "margin10", icon: "📏", name: "Comfortable", desc: "Win by 10+ points.", stat: "bestMargin", goal: 10 },
    { id: "margin30", icon: "🎯", name: "Dominant", desc: "Win by 30+ points.", stat: "bestMargin", goal: 30 },
    { id: "moves100", icon: "🚶", name: "Pathfinder", desc: "Play 100 moves in total.", stat: "moves", goal: 100 },
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
        ["Games", stats.games],
        ["Wins", stats.wins],
        ["Captures", stats.captures],
        ["Best margin", stats.bestMargin],
        ["Biggest capture", stats.bigCapture],
        ["Moves", stats.moves],
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
  audio.define("stone", [[420, 0, 0.04, "triangle", 0.03]]);
  audio.define("capture", [[520, 0, 0.06, "triangle", 0.04], [760, 0.06, 0.08, "triangle", 0.04]]);
  audio.define("illegal", [[160, 0, 0.08, "square", 0.03]]);

  // ---------- State ----------
  let board = emptyBoard();
  let current = BLACK;
  let captures = { 1: 0, 2: 0 };
  let passes = 0;
  let koHash = null;
  let history = [];
  let lastMove = null;
  let movesThisGame = 0;
  let gameBigCapture = 0;
  let gameOver = false;
  let paused = false;
  let mode = "cpu";
  let aiTimer = 0;

  // ---------- Board helpers ----------
  function emptyBoard() {
    return Array.from({ length: N }, () => new Array(N).fill(0));
  }

  function boardHash(bd) {
    return bd.map((row) => row.join("")).join("|");
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function collectGroup(bd, r, c) {
    const color = bd[r][c];
    const stack = [[r, c]];
    const seen = new Set([r * N + c]);
    const cells = [];
    const libs = new Set();
    while (stack.length) {
      const [cr, cc] = stack.pop();
      cells.push([cr, cc]);
      for (const [dr, dc] of DIRS) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (!inBounds(nr, nc)) continue;
        const v = bd[nr][nc];
        if (v === 0) libs.add(nr * N + nc);
        else if (v === color && !seen.has(nr * N + nc)) {
          seen.add(nr * N + nc);
          stack.push([nr, nc]);
        }
      }
    }
    return { cells, liberties: libs.size };
  }

  /**
   * Try placing `color` at r,c on a copy of `bd`.
   * Returns null for suicide, otherwise { board, captured, ownLiberties }.
   */
  function simulate(bd, r, c, color) {
    if (!inBounds(r, c) || bd[r][c] !== 0) return null;
    const nb = bd.map((row) => row.slice());
    nb[r][c] = color;
    const opp = color === BLACK ? WHITE : BLACK;
    let captured = 0;
    const checked = new Set();

    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || nb[nr][nc] !== opp) continue;
      const group = collectGroup(nb, nr, nc);
      const key = group.cells
        .map(([gr, gc]) => gr * N + gc)
        .sort((a, b) => a - b)
        .join(",");
      if (checked.has(key)) continue;
      checked.add(key);
      if (group.liberties === 0) {
        for (const [gr, gc] of group.cells) {
          nb[gr][gc] = 0;
          captured++;
        }
      }
    }

    const own = collectGroup(nb, r, c);
    if (own.liberties === 0) return null; // suicide
    return { board: nb, captured, ownLiberties: own.liberties };
  }

  function isOwnEye(bd, r, c, color) {
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      if (bd[nr][nc] !== color) return false;
    }
    return true;
  }

  function stonesOnBoard() {
    let n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] !== 0) n++;
    return n;
  }

  function snapshot() {
    return {
      board: board.map((row) => row.slice()),
      current,
      captures: { 1: captures[1], 2: captures[2] },
      passes,
      koHash,
      lastMove: lastMove ? { r: lastMove.r, c: lastMove.c } : null,
      movesThisGame,
      gameBigCapture,
    };
  }

  function restore(s) {
    board = s.board.map((row) => row.slice());
    current = s.current;
    captures = { 1: s.captures[1], 2: s.captures[2] };
    passes = s.passes;
    koHash = s.koHash;
    lastMove = s.lastMove ? { r: s.lastMove.r, c: s.lastMove.c } : null;
    movesThisGame = s.movesThisGame;
    gameBigCapture = s.gameBigCapture;
  }

  // ---------- Rendering ----------
  function render() {
    boardEl.innerHTML = "";
    boardEl.className = "gg-board " + (current === BLACK ? "gg-board--black" : "gg-board--white");
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "gg-cell";
        if (c === N - 1) cell.classList.add("gg-cell--last-col");
        if (r === N - 1) cell.classList.add("gg-cell--last-row");
        if (HOSHI.has(r * N + c)) cell.classList.add("gg-cell--hoshi");

        const v = board[r][c];
        if (v === 0) cell.classList.add("gg-cell--empty");
        if (v !== 0) {
          const st = document.createElement("div");
          st.className = "gg-stone " + (v === BLACK ? "gg-stone--black" : "gg-stone--white");
          if (lastMove && lastMove.r === r && lastMove.c === c) st.classList.add("gg-stone--last");
          cell.appendChild(st);
        }
        cell.setAttribute(
          "aria-label",
          v === 0 ? `Empty ${r + 1}, ${c + 1}` : `${v === BLACK ? "Black" : "White"} stone ${r + 1}, ${c + 1}`
        );
        cell.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
    undoBtn.disabled = history.length === 0 || gameOver;
  }

  function updateStatus() {
    capBlackEl.textContent = captures[BLACK];
    capWhiteEl.textContent = captures[WHITE];
    turnEl.textContent = gameOver ? "—" : current === BLACK ? "●" : "○";
  }

  // ---------- Flow ----------
  function newGame(intro) {
    clearTimeout(aiTimer);
    aiTimer = 0;
    board = emptyBoard();
    current = BLACK;
    captures = { 1: 0, 2: 0 };
    passes = 0;
    koHash = null;
    history = [];
    lastMove = null;
    movesThisGame = 0;
    gameBigCapture = 0;
    gameOver = false;
    paused = false;
    hideOverlay();
    hintEl.textContent =
      mode === "cpu"
        ? "You are Black ● and move first. Click an empty intersection to place a stone. Two passes end the game. P pauses."
        : "Black ● to play. Two players share this board — two passes end the game. P pauses.";
    render();
    updateStatus();
    if (intro) showStartOverlay();
  }

  function showStartOverlay() {
    showOverlay(
      "Go",
      "9×9 · You are Black ● and move first. Surround more territory than White to win. Two passes end the game.",
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function play(r, c) {
    if (gameOver || paused) return { ok: false, reason: "inactive" };
    if (!inBounds(r, c)) return { ok: false, reason: "bounds" };
    if (board[r][c] !== 0) return { ok: false, reason: "occupied" };

    const color = current;
    const res = simulate(board, r, c, color);
    if (!res) {
      sfx("illegal");
      return { ok: false, reason: "suicide" };
    }
    const newHash = boardHash(res.board);
    if (newHash === koHash) {
      sfx("illegal");
      toast.show("Ko", "You can't recapture immediately — play elsewhere first.", "🔁");
      return { ok: false, reason: "ko" };
    }

    history.push(snapshot());
    const beforeHash = boardHash(board);
    board = res.board;
    captures[color] += res.captured;
    if (res.captured > gameBigCapture) gameBigCapture = res.captured;
    movesThisGame++;
    lastMove = { r, c };
    passes = 0;
    koHash = beforeHash;
    current = color === BLACK ? WHITE : BLACK;

    if (res.captured > 0) {
      sfx("capture");
      if (res.captured >= 3) confetti(Math.min(40, res.captured * 8));
    } else {
      sfx("stone");
    }

    render();
    updateStatus();
    maybeAI();
    return { ok: true, captured: res.captured };
  }

  function pass() {
    if (gameOver || paused) return;
    history.push(snapshot());
    passes++;
    koHash = null;
    lastMove = null;
    current = current === BLACK ? WHITE : BLACK;
    sfx("stone");
    render();
    updateStatus();
    if (passes >= 2) {
      endGame();
      return;
    }
    maybeAI();
  }

  function undo() {
    if (!history.length || gameOver) return;
    restore(history.pop());
    if (mode === "cpu") {
      let guard = 0;
      while (history.length && current === WHITE && guard++ < 4) restore(history.pop());
    }
    sfx("click");
    render();
    updateStatus();
  }

  // ---------- Scoring ----------
  function scoreBoard() {
    let black = 0;
    let white = 0;
    const seen = Array.from({ length: N }, () => new Array(N).fill(false));

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] === BLACK) black++;
        else if (board[r][c] === WHITE) white++;
      }
    }

    // Flood-fill empty regions and award surrounded territory.
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 0 || seen[r][c]) continue;
        const stack = [[r, c]];
        seen[r][c] = true;
        const region = [];
        const borders = new Set();
        while (stack.length) {
          const [cr, cc] = stack.pop();
          region.push([cr, cc]);
          for (const [dr, dc] of DIRS) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (!inBounds(nr, nc)) {
              borders.add("edge");
              continue;
            }
            const v = board[nr][nc];
            if (v === 0) {
              if (!seen[nr][nc]) {
                seen[nr][nc] = true;
                stack.push([nr, nc]);
              }
            } else {
              borders.add(v === BLACK ? "b" : "w");
            }
          }
        }
        if (borders.size === 1 && borders.has("b")) black += region.length;
        else if (borders.size === 1 && borders.has("w")) white += region.length;
      }
    }

    white += KOMI;
    const diff = black - white;
    return { black, white, diff, winner: diff > 0 ? BLACK : WHITE };
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    clearTimeout(aiTimer);
    aiTimer = 0;

    const s = scoreBoard();
    const margin = Math.abs(s.diff);

    stats.games++;
    stats.moves += movesThisGame;
    stats.captures += captures[BLACK];
    if (gameBigCapture > stats.bigCapture) stats.bigCapture = gameBigCapture;
    if (s.winner === BLACK) {
      stats.wins++;
      if (margin > stats.bestMargin) stats.bestMargin = margin;
    } else {
      stats.losses++;
    }
    saveStats();
    checkAchievements();
    render();
    updateStatus();

    if (s.winner === BLACK) {
      sfx("win");
      confetti(100);
    } else {
      sfx("over");
    }

    const marginStr = Number.isInteger(margin) ? String(margin) : margin.toFixed(1);
    showOverlay(
      s.winner === BLACK ? "Black wins! 🎉" : "White wins",
      `Black ${s.black} · White ${s.white} (komi ${KOMI}) · ${s.winner === BLACK ? "Black" : "White"} +${marginStr}.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(false); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- CPU ----------
  function chooseAIMove() {
    const color = WHITE;
    let best = null;
    let bestScore = -Infinity;
    const stones = stonesOnBoard();

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 0) continue;
        const res = simulate(board, r, c, color);
        if (!res) continue;
        if (boardHash(res.board) === koHash) continue;

        let s = 0;
        if (res.captured > 0) s += 14 * res.captured;

        const libs = res.ownLiberties;
        if (libs === 1 && res.captured === 0) s -= 60;
        else if (libs === 2) s += 3;
        else s += Math.min(libs, 6) * 0.6;

        let near = 0;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            if (board[nr][nc] !== 0) near++;
          }
        }
        s += near * 0.7;
        s += (4 - (Math.abs(r - 4) + Math.abs(c - 4))) * 0.15;

        if (isOwnEye(board, r, c, color)) s -= 120;
        if ((r === 0 || r === N - 1 || c === 0 || c === N - 1) && stones < 20) s -= 2;

        s += rand() * 0.5;
        if (s > bestScore) {
          bestScore = s;
          best = { r, c };
        }
      }
    }

    if (!best) return null;
    if (bestScore < -20) return null;
    return best;
  }

  function aiMove() {
    if (mode !== "cpu" || current !== WHITE || gameOver || paused) return null;
    const mv = chooseAIMove();
    if (!mv) {
      pass();
      return null;
    }
    const res = play(mv.r, mv.c);
    return res.ok ? mv : null;
  }

  function maybeAI() {
    if (mode !== "cpu" || current !== WHITE || gameOver || paused) return;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiTimer = 0;
      aiMove();
    }, 220);
  }

  // ---------- Pause ----------
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      clearTimeout(aiTimer);
      aiTimer = 0;
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); if (mode === "cpu" && current === WHITE) maybeAI(); } },
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
  function onCellClick(r, c) {
    audio.unlock();
    if (mode === "cpu" && current === WHITE) return;
    play(r, c);
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
    if (overlay.isOpen() || gameOver || paused) return;
    if (key === "u" || key === "U") {
      if (e.preventDefault) e.preventDefault();
      undo();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    passBtn.addEventListener("click", () => { audio.unlock(); pass(); });
    undoBtn.addEventListener("click", () => { audio.unlock(); undo(); });
    restartBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); newGame(false); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    modeCpuBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      if (mode !== "cpu") {
        mode = "cpu";
        syncModeChips();
        newGame(false);
      }
    });
    mode2pBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      if (mode !== "2p") {
        mode = "2p";
        syncModeChips();
        newGame(false);
      }
    });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });

    audio.bindUnlock();
  }

  function syncModeChips() {
    modeCpuBtn.setAttribute("aria-pressed", String(mode === "cpu"));
    mode2pBtn.setAttribute("aria-pressed", String(mode === "2p"));
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame(true);
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__GO = {
    N,
    BLACK,
    WHITE,
    KOMI,
    stats,
    ACHIEVEMENTS,
    get board() { return board.map((row) => row.slice()); },
    get current() { return current; },
    get captures() { return { 1: captures[1], 2: captures[2] }; },
    get passes() { return passes; },
    get koHash() { return koHash; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get mode() { return mode; },
    get historyLength() { return history.length; },
    get lastMove() { return lastMove ? { r: lastMove.r, c: lastMove.c } : null; },
    get movesThisGame() { return movesThisGame; },
    get gameBigCapture() { return gameBigCapture; },
    emptyBoard,
    boardHash,
    collectGroup,
    simulate,
    isOwnEye,
    play,
    pass,
    undo,
    aiMove,
    chooseAIMove,
    scoreBoard,
    endGame,
    newGame,
    setPaused,
    togglePause,
    setMode: (m) => { mode = m === "2p" ? "2p" : "cpu"; syncModeChips(); newGame(false); },
    setBoard: (bd, cur) => { board = bd.map((row) => row.slice()); if (cur === BLACK || cur === WHITE) current = cur; render(); updateStatus(); },
    setCaptures: (c) => { captures = { 1: c[1] || 0, 2: c[2] || 0 }; updateStatus(); },
    setKoHash: (h) => { koHash = h; },
    setPlayer: (p) => { current = p; render(); updateStatus(); },
    setSeed: (n) => { rngState = n >>> 0; },
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();