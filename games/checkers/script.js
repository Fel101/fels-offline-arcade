// Checkers — pure vanilla JS, fully offline. Mandatory captures, multi-jumps, negamax AI.
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
  const statusEl = dom.byId("status");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const newGameBtn = dom.byId("new-game");
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
  const GLYPH = { m: "●", k: "♚" };
  const DEPTH = 3;
  const DRAW_QUIET = 160; // half-moves without capture/promotion -> draw
  const FAST_MOVES = 30; // wins inside this many of your own moves count as "fast"
  const AI_DELAY = 80;
  const HINT_DEFAULT = "You are Red. Captures are mandatory. P pauses.";

  const K = makeKeys("checkers");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    captures: 0, // enemy pieces captured by you
    kings: 0, // your men promoted to kings
    chains3: 0, // of your moves that captured 3+ pieces in one move
    fastWins: 0, // wins inside FAST_MOVES of your own moves
    totalMoves: 0, // your completed moves
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

  // Carry the pre-core win counter (checkers-wins) into stats.wins.
  function migrateLegacy() {
    const raw = store.get("checkers-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("checkers-wins");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "capture10", icon: "🎯", name: "Hunter", desc: "Capture 10 pieces.", stat: "captures", goal: 10 },
    { id: "capture50", icon: "🧹", name: "Sweeper", desc: "Capture 50 pieces.", stat: "captures", goal: 50 },
    { id: "king1", icon: "♚", name: "Crowned", desc: "Promote a man to king.", stat: "kings", goal: 1 },
    { id: "king5", icon: "🤴", name: "Royalty", desc: "Promote 5 men to kings.", stat: "kings", goal: 5 },
    { id: "chain3", icon: "⛓️", name: "Triple Jump", desc: "Capture 3+ pieces in a single move.", stat: "chains3", goal: 1 },
    { id: "fast5", icon: "💨", name: "Speed Run", desc: `Win 5 games inside ${FAST_MOVES} of your moves.`, stat: "fastWins", goal: 5 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 games.", stat: "games", goal: 20 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
    { id: "moves100", icon: "🚶", name: "Mover", desc: "Make 100 moves in total.", stat: "totalMoves", goal: 100 },
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
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Best streak", stats.bestStreak],
        ["Pieces captured", stats.captures],
        ["Kings crowned", stats.kings],
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
  let board, turn, selected, targets, gameOver, quiet, chain;
  let paused = false;
  let moveCount = 0; // your completed moves this game
  let chainCaps = 0; // captures in the current multi-jump
  let aiTimer = null;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (c) => (c === "r" ? "b" : "r");
  const isDark = (r, c) => (r + c) % 2 === 1;
  const dirOf = (c) => (c === "r" ? -1 : 1); // Red moves up the board
  const promoRow = (c) => (c === "r" ? 0 : 7);
  const countPieces = (b, color) => {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] && b[r][c].c === color) n++;
    return n;
  };

  function setup() {
    board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) board[r][c] = { t: "m", c: "b" };
    for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) board[r][c] = { t: "m", c: "r" };
    turn = "r";
    selected = null; targets = []; gameOver = false; quiet = 0; chain = null;
  }

  function cloneBoard(b) { return b.map((row) => row.map((p) => (p ? { t: p.t, c: p.c } : null))); }

  function dirsFor(p) {
    const rows = p.t === "k" ? [-1, 1] : [dirOf(p.c)];
    const out = [];
    for (const dr of rows) for (const dc of [-1, 1]) out.push([dr, dc]);
    return out;
  }

  function capturesFrom(b, r, c) {
    const p = b[r][c];
    const out = [];
    if (!p) return out;
    for (const [dr, dc] of dirsFor(p)) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!inBounds(tr, tc)) continue;
      const mid = b[mr][mc];
      if (mid && mid.c !== p.c && !b[tr][tc]) out.push({ fr: r, fc: c, tr, tc, capture: true });
    }
    return out;
  }

  // Legal moves for a side. cont = [r,c] forces continuation of a multi-jump.
  function legalMoves(b, color, cont) {
    if (cont) return capturesFrom(b, cont[0], cont[1]);
    let caps = [], quietMoves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.c !== color) continue;
      caps = caps.concat(capturesFrom(b, r, c));
      for (const [dr, dc] of dirsFor(p)) {
        const tr = r + dr, tc = c + dc;
        if (inBounds(tr, tc) && !b[tr][tc]) quietMoves.push({ fr: r, fc: c, tr, tc, capture: false });
      }
    }
    return caps.length ? caps : quietMoves; // captures are mandatory
  }

  // Apply a single-step move; returns true if a promotion happened (ends a chain).
  function applyMove(b, m) {
    const p = b[m.fr][m.fc];
    b[m.tr][m.tc] = p;
    b[m.fr][m.fc] = null;
    if (m.capture) b[(m.fr + m.tr) / 2][(m.fc + m.tc) / 2] = null;
    if (p.t === "m" && m.tr === promoRow(p.c)) { p.t = "k"; return true; }
    return false;
  }

  // ---- AI: negamax + alpha-beta ----
  function evalBoard(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const v = p.t === "k" ? 2 : 1;
      s += p.c === color ? v : -v;
    }
    return s;
  }

  const captureFirst = (a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0);

  function search(b, d, alpha, beta, color, cont) {
    const moves = legalMoves(b, color, cont);
    if (moves.length === 0) return -100000 - d; // side to move loses
    if (d === 0 && !cont) return evalBoard(b, color);
    moves.sort(captureFirst);
    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      const promoted = applyMove(nb, m);
      const more = m.capture && !promoted ? capturesFrom(nb, m.tr, m.tc) : [];
      const score = more.length
        ? search(nb, d, alpha, beta, color, [m.tr, m.tc]) // same side moves again
        : -search(nb, d - 1, -beta, -alpha, opp(color), null);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMoveFor(color, cont) {
    const moves = legalMoves(board, color, cont);
    if (!moves.length) return null;
    moves.sort(captureFirst);
    let best = -Infinity, picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      const promoted = applyMove(nb, m);
      const more = m.capture && !promoted ? capturesFrom(nb, m.tr, m.tc) : [];
      const s = more.length
        ? search(nb, DEPTH - 1, -Infinity, Infinity, color, [m.tr, m.tc])
        : -search(nb, DEPTH - 1, -Infinity, Infinity, opp(color), null);
      if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
    }
    return picks[(Math.random() * picks.length) | 0];
  }

  // ---- Rendering & interaction ----
  function updateHud() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.width = "100%";
      cell.style.aspectRatio = "1";
      cell.style.padding = "0";
      cell.style.fontSize = "clamp(1.1rem, 5vw, 2.2rem)";
      const dark = isDark(r, c);
      cell.style.background = dark ? "#1f7a49" : "#35a866";
      if (!dark) { cell.disabled = true; cell.style.cursor = "default"; }
      const p = board[r][c];
      if (p) {
        cell.textContent = GLYPH[p.t];
        cell.style.color = p.c === "r" ? "#ff6b6b" : "#14141f";
        cell.style.textShadow = p.c === "r"
          ? "0 0 3px #3a0d0d, 0 1px 2px #000"
          : "0 0 5px #eef0ff, 0 1px 2px #000";
      }
      if (selected && selected.r === r && selected.c === c) cell.style.boxShadow = "inset 0 0 0 3px var(--accent-2)";
      else if (targets.some((t) => t.tr === r && t.tc === c)) cell.style.boxShadow = "inset 0 0 0 3px var(--accent)";
      cell.addEventListener("click", () => { audio.unlock(); onCellClick(r, c); });
      boardEl.appendChild(cell);
    }
    updateHud();
  }

  function setStatus(t) { statusEl.textContent = t; }

  function onCellClick(r, c) {
    if (gameOver || paused || turn !== "r") return;
    // Mid multi-jump: only the jumping piece may act, only its jumps are legal.
    if (chain) {
      const move = targets.find((t) => t.tr === r && t.tc === c);
      if (move) doPlayerMove(move);
      return;
    }
    const p = board[r][c];
    if (selected) {
      const move = targets.find((t) => t.tr === r && t.tc === c);
      if (move) { doPlayerMove(move); return; }
    }
    if (p && p.c === "r") {
      selected = { r, c };
      targets = legalMoves(board, "r", null).filter((m) => m.fr === r && m.fc === c);
      if (targets.length) sfx("select");
    } else {
      selected = null; targets = [];
    }
    render();
  }

  function doPlayerMove(move) {
    if (!chain) chainCaps = 0; // first step of a fresh move
    chainCaps += move.capture ? 1 : 0;
    const promoted = applyMove(board, move);
    if (move.capture) stats.captures++;
    if (promoted) stats.kings++;
    quiet = move.capture || promoted ? 0 : quiet + 1;
    if (move.capture) sfx("match"); else if (promoted) sfx("long"); else sfx("place");
    const more = move.capture && !promoted ? capturesFrom(board, move.tr, move.tc) : [];
    if (more.length) { // forced continuation — keep the turn with the human
      chain = [move.tr, move.tc];
      selected = { r: move.tr, c: move.tc };
      targets = more;
      setStatus("Multi-jump — keep jumping!");
      render();
      return;
    }
    // The move is complete: book-keeping once, not per chain step.
    if (chainCaps >= 3) stats.chains3++;
    moveCount++;
    stats.totalMoves++;
    saveStats();
    checkAchievements();
    chain = null; selected = null; targets = [];
    turn = "b";
    afterMove();
  }

  function clearAiTimer() {
    if (aiTimer) {
      window.clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function scheduleAi() {
    clearAiTimer();
    setStatus("Thinking…");
    gameOver = "thinking"; // guard: block input while the AI is to move
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      aiGo();
    }, AI_DELAY);
  }

  function afterMove() {
    render();
    if (quiet >= DRAW_QUIET) return endOfGame(true);
    const bMoves = legalMoves(board, "b", null);
    if (bMoves.length === 0) return endOfGame(false);
    scheduleAi();
  }

  function aiGo() {
    if (paused) return;
    gameOver = false;
    let m = bestMoveFor("b", null);
    let promoted = m ? applyMove(board, m) : false;
    if (m) quiet = m.capture || promoted ? 0 : quiet + 1;
    if (m) sfx(m.capture ? "match" : "click");
    let guard = 0;
    while (m && m.capture && !promoted && guard++ < 16) { // AI completes its chain
      const more = capturesFrom(board, m.tr, m.tc);
      if (!more.length) break;
      m = bestMoveFor("b", [m.tr, m.tc]);
      if (!m) break;
      promoted = applyMove(board, m); // continuation moves are captures by construction
      quiet = 0;
    }
    turn = "r";
    gameOver = false;
    render();
    if (quiet >= DRAW_QUIET) return endOfGame(true);
    const rMoves = legalMoves(board, "r", null);
    if (rMoves.length === 0) return endOfGame(false);
    setStatus("Your move");
  }

  function endOfGame(forceDraw) {
    if (gameOver === true) return;
    gameOver = true;
    paused = false;
    clearAiTimer();
    const redPieces = countPieces(board, "r"), blackPieces = countPieces(board, "b");
    const redMoves = legalMoves(board, "r", null).length, blackMoves = legalMoves(board, "b", null).length;
    let title, msg, outcome;
    if (!forceDraw && (blackPieces === 0 || blackMoves === 0)) {
      title = "You win! 🎉"; msg = "The CPU has no moves left."; outcome = "win";
    } else if (!forceDraw && (redPieces === 0 || redMoves === 0)) {
      title = "CPU wins 🤖"; msg = "You have no moves left."; outcome = "loss";
    } else {
      title = "Draw"; msg = "Too many quiet moves — the game is drawn."; outcome = "draw";
    }

    stats.games++;
    if (outcome === "win") {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (moveCount <= FAST_MOVES) stats.fastWins++;
    } else if (outcome === "loss") {
      stats.losses++;
      stats.streak = 0;
    } else {
      stats.draws++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    updateHud();
    setStatus(title);

    const buttons = [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ];
    if (outcome === "win") {
      sfx("win");
      confetti(90);
      const fastMsg = moveCount <= FAST_MOVES
        ? ` Fast win in ${moveCount} move${moveCount === 1 ? "" : "s"}!`
        : "";
      showOverlay(title, msg + " Streak " + stats.streak + "." + fastMsg, buttons);
    } else if (outcome === "loss") {
      sfx("over");
      showOverlay(title, msg + " Better luck next time!", buttons);
    } else {
      sfx("hint");
      showOverlay(title, msg, buttons);
    }
  }

  function newGame() {
    clearAiTimer();
    setup();
    paused = false;
    moveCount = 0;
    chainCaps = 0;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
    setStatus("Your move");
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver === true || paused === p) return;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
      if (gameOver === "thinking") scheduleAi();
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
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (gameOver !== true && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && gameOver !== true && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__CHECKERS = {
    GLYPH,
    DEPTH,
    DRAW_QUIET,
    FAST_MOVES,
    get board() { return board.map((row) => row.map((p) => (p ? { t: p.t, c: p.c } : null))); },
    get turn() { return turn; },
    get selected() { return selected ? { r: selected.r, c: selected.c } : null; },
    get targets() { return targets.map((t) => ({ fr: t.fr, fc: t.fc, tr: t.tr, tc: t.tc, capture: t.capture })); },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get quiet() { return quiet; },
    get chain() { return chain ? chain.slice() : null; },
    get chainCaps() { return chainCaps; },
    get moveCount() { return moveCount; },
    stats,
    ACHIEVEMENTS,
    inBounds,
    isDark,
    countPieces,
    cloneBoard,
    dirsFor,
    capturesFrom,
    legalMoves,
    applyMove,
    evalBoard,
    search,
    bestMoveFor,
    click: onCellClick,
    aiGo,
    afterMove,
    endOfGame,
    newGame,
    // Test-only: install a position directly.
    setState: (b, t) => {
      board = cloneBoard(b);
      turn = t || "r";
      selected = null;
      targets = [];
      gameOver = false;
      paused = false;
      quiet = 0;
      chain = null;
      chainCaps = 0;
      moveCount = 0;
      hideOverlay();
      render();
      setStatus("Your move");
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
