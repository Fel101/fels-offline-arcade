// Nine Men's Morris — pure vanilla JS, fully offline, with a minimax AI.
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
  const boardSvgEl = dom.byId("board-svg");
  const pointsEl = dom.byId("points");
  const turnEl = dom.byId("turn");
  const turnLineEl = dom.byId("turn-line");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const aiDiffSel = dom.byId("ai-diff");
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
  const SIZE = 24;
  const HUMAN = "B";
  const AI = "W";
  const START_PIECES = 9;
  const AI_DELAY = 300;
  const DIFF_DEPTH = { easy: 1, normal: 3, hard: 4 };
  const HINT_DEFAULT =
    "Place all nine pieces, then move along the lines. Three in a row is a mill — click an enemy piece to remove it. P pauses.";

  // Points: 0-7 outer square, 8-15 middle, 16-23 inner (clockwise from top-left).
  const COORDS = [
    [0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50],
    [20, 20], [50, 20], [80, 20], [80, 50], [80, 80], [50, 80], [20, 80], [20, 50],
    [40, 40], [50, 40], [60, 40], [60, 50], [60, 60], [50, 60], [40, 60], [40, 50],
  ];

  const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
    [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 8],
    [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 16],
    [1, 9], [9, 17],
    [3, 11], [11, 19],
    [5, 13], [13, 21],
    [7, 15], [15, 23],
  ];

  const MILLS = [
    [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
    [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
    [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
    [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23],
  ];

  const ADJ = (() => {
    const a = Array.from({ length: SIZE }, () => []);
    for (const [x, y] of EDGES) { a[x].push(y); a[y].push(x); }
    return a;
  })();

  const K = makeKeys("nine-mens-morris");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    totalMoves: 0,
    mills: 0, // mills formed (career)
    fastWins: 0, // wins in <= 60 moves
    flawlessWins: 0, // wins without losing a piece
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
    { id: "first", icon: "🎯", name: "First Win", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "mills10", icon: "⚙️", name: "Miller", desc: "Form 10 mills.", stat: "mills", goal: 10 },
    { id: "mills50", icon: "🏭", name: "Millwright", desc: "Form 50 mills.", stat: "mills", goal: 50 },
    { id: "moves100", icon: "👣", name: "Wanderer", desc: "Make 100 moves.", stat: "totalMoves", goal: 100 },
    { id: "fast60", icon: "💨", name: "Quick Win", desc: "Win in 60 moves or fewer.", stat: "fastWins", goal: 1 },
    { id: "flawless", icon: "🛡️", name: "Flawless", desc: "Win without losing a piece.", stat: "flawlessWins", goal: 1 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
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
        ["Moves", stats.totalMoves],
        ["Mills", stats.mills],
        ["Best streak", stats.bestStreak],
        ["Flawless wins", stats.flawlessWins],
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

  // ---------- Pure rules ----------
  function other(p) { return p === HUMAN ? AI : HUMAN; }

  function createInitialState() {
    return {
      board: new Array(SIZE).fill(null),
      hand: { B: START_PIECES, W: START_PIECES },
      phase: "place", // "place" | "move" | "over"
      turn: HUMAN,
      pendingRemoval: false,
      winner: null,
    };
  }

  function cloneState(s) {
    return {
      board: s.board.slice(),
      hand: { B: s.hand.B, W: s.hand.W },
      phase: s.phase,
      turn: s.turn,
      pendingRemoval: s.pendingRemoval,
      winner: s.winner,
    };
  }

  function countOnBoard(board, p) {
    let n = 0;
    for (let i = 0; i < SIZE; i++) if (board[i] === p) n++;
    return n;
  }

  function totalPieces(s, p) {
    return s.hand[p] + countOnBoard(s.board, p);
  }

  function inAnyMill(board, idx, p) {
    for (const mill of MILLS) {
      if (mill.indexOf(idx) !== -1 && mill.every((i) => board[i] === p)) return true;
    }
    return false;
  }

  function formsMill(board, p, idx) {
    return inAnyMill(board, idx, p);
  }

  function removable(s) {
    const opp = other(s.turn);
    const oppPieces = [];
    for (let i = 0; i < SIZE; i++) if (s.board[i] === opp) oppPieces.push(i);
    const notInMill = oppPieces.filter((i) => !inAnyMill(s.board, i, opp));
    return notInMill.length ? notInMill : oppPieces;
  }

  function canRemove(s, idx) {
    return removable(s).indexOf(idx) !== -1;
  }

  function isLegalStep(s, p, from, to) {
    if (countOnBoard(s.board, p) === 3) return true; // flying with three pieces
    return ADJ[from].indexOf(to) !== -1;
  }

  function generateMovesFor(s, player) {
    const moves = [];
    if (s.phase === "over") return moves;
    if (s.pendingRemoval) {
      if (s.turn !== player) return moves;
      for (const at of removable(s)) moves.push({ type: "remove", at });
      return moves;
    }
    if (s.phase === "place") {
      if (s.hand[player] <= 0) return moves;
      for (let i = 0; i < SIZE; i++) if (s.board[i] === null) moves.push({ type: "place", to: i });
      return moves;
    }
    for (let from = 0; from < SIZE; from++) {
      if (s.board[from] !== player) continue;
      for (let to = 0; to < SIZE; to++) {
        if (s.board[to] === null && isLegalStep(s, player, from, to)) {
          moves.push({ type: "move", from, to });
        }
      }
    }
    return moves;
  }

  function generateMoves(s) {
    return generateMovesFor(s, s.turn);
  }

  function endTurn(s, mover) {
    const opp = other(mover);
    if (totalPieces(s, opp) < 3) {
      s.winner = mover;
      s.phase = "over";
      return s;
    }
    s.turn = opp;
    if (s.phase === "move" && generateMovesFor(s, opp).length === 0) {
      s.winner = mover;
      s.phase = "over";
    }
    return s;
  }

  function applyMove(state, move) {
    const s = cloneState(state);
    const p = s.turn;
    if (move.type === "place") {
      if (s.phase !== "place" || s.hand[p] <= 0 || s.board[move.to] !== null) return s;
      s.board[move.to] = p;
      s.hand[p]--;
      if (s.hand.B === 0 && s.hand.W === 0) s.phase = "move";
      if (formsMill(s.board, p, move.to)) {
        s.pendingRemoval = true;
        return s;
      }
      return endTurn(s, p);
    }
    if (move.type === "move") {
      if (s.phase !== "move" || s.board[move.from] !== p || s.board[move.to] !== null) return s;
      if (!isLegalStep(s, p, move.from, move.to)) return s;
      s.board[move.from] = null;
      s.board[move.to] = p;
      if (formsMill(s.board, p, move.to)) {
        s.pendingRemoval = true;
        return s;
      }
      return endTurn(s, p);
    }
    if (move.type === "remove") {
      if (!s.pendingRemoval) return s;
      if (s.board[move.at] !== other(p)) return s;
      if (!canRemove(s, move.at)) return s;
      s.board[move.at] = null;
      s.pendingRemoval = false;
      return endTurn(s, p);
    }
    return s;
  }

  // ---------- AI ----------
  function countMills(board, p) {
    let n = 0;
    for (const mill of MILLS) if (mill.every((i) => board[i] === p)) n++;
    return n;
  }

  function countTwos(board, p) {
    let n = 0;
    for (const mill of MILLS) {
      let mine = 0;
      let empty = 0;
      for (const i of mill) {
        if (board[i] === p) mine++;
        else if (board[i] === null) empty++;
      }
      if (mine === 2 && empty === 1) n++;
    }
    return n;
  }

  function evaluate(s, me) {
    if (s.phase === "over") return s.winner === me ? 100000 : -100000;
    const opp = other(me);
    let score = (totalPieces(s, me) - totalPieces(s, opp)) * 100;
    score += (countMills(s.board, me) - countMills(s.board, opp)) * 20;
    score += (countTwos(s.board, me) - countTwos(s.board, opp)) * 4;
    if (s.phase === "move") {
      score += (generateMovesFor(s, me).length - generateMovesFor(s, opp).length) * 1;
    }
    return score;
  }

  function minimax(s, depth, alpha, beta) {
    if (s.phase === "over" || depth <= 0) return evaluate(s, AI);
    const maximizing = s.turn === AI;
    const moves = generateMoves(s);
    if (moves.length === 0) return evaluate(s, AI);

    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        const score = minimax(applyMove(s, m), depth - 1, alpha, beta);
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      const score = minimax(applyMove(s, m), depth - 1, alpha, beta);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAiMove(s, diff) {
    const depth = DIFF_DEPTH[diff] || DIFF_DEPTH.normal;
    let best = -Infinity;
    let bestMove = null;
    for (const m of generateMoves(s)) {
      const score = minimax(applyMove(s, m), depth - 1, -Infinity, Infinity);
      if (score > best) {
        best = score;
        bestMove = m;
      }
    }
    return bestMove;
  }

  // ---------- Live game ----------
  let state = createInitialState();
  let selected = null;
  let moves = 0;
  let piecesLost = 0;
  let gameOver = false;
  let paused = false;
  let currentDiff = "normal";
  let aiTimer = null;
  let rng = Math.random;

  function buildSvg() {
    const lines = EDGES.map(([a, b]) => {
      const [x1, y1] = COORDS[a];
      const [x2, y2] = COORDS[b];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }).join("");
    return (
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` +
      `<g stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke">${lines}</g>` +
      `</svg>`
    );
  }

  function updateHud() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    if (gameOver) {
      turnEl.textContent = "Game over";
      turnLineEl.textContent = state.winner === HUMAN ? "You win!" : "CPU wins";
    } else if (state.turn === AI) {
      turnEl.textContent = "CPU";
      turnLineEl.textContent = "CPU is thinking…";
    } else if (state.pendingRemoval) {
      turnEl.textContent = "Remove";
      turnLineEl.textContent = "Mill! Click an enemy piece to remove it";
    } else if (state.phase === "place") {
      turnEl.textContent = "You";
      turnLineEl.textContent = "Place a piece on an empty point";
    } else {
      turnEl.textContent = "You";
      turnLineEl.textContent = selected === null ? "Select a piece, then move it" : "Now click a highlighted destination";
    }
  }

  function render() {
    pointsEl.innerHTML = "";
    const removableSet = state.pendingRemoval && state.turn === HUMAN ? new Set(removable(state)) : null;

    for (let i = 0; i < SIZE; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "point";
      const v = state.board[i];
      if (v === HUMAN) btn.className += " point--you";
      else if (v === AI) btn.className += " point--cpu";
      if (selected === i) btn.className += " point--sel";
      if (removableSet && removableSet.has(i)) btn.className += " point--removable";
      btn.style.left = COORDS[i][0] + "%";
      btn.style.top = COORDS[i][1] + "%";
      btn.setAttribute("data-point", String(i));
      btn.setAttribute("aria-label", v === HUMAN ? `Your piece at point ${i + 1}` : v === AI ? `CPU piece at point ${i + 1}` : `Empty point ${i + 1}`);
      btn.disabled = gameOver || paused || state.turn !== HUMAN;
      pointsEl.appendChild(btn);
    }
    updateHud();
  }

  function clearAiTimer() {
    if (aiTimer) {
      window.clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function scheduleAi() {
    clearAiTimer();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      aiMove();
    }, AI_DELAY);
  }

  function applyLiveMove(move) {
    const humanBefore = totalPieces(state, HUMAN);
    state = applyMove(state, move);
    const humanAfter = totalPieces(state, HUMAN);
    if (humanAfter < humanBefore) piecesLost += humanBefore - humanAfter;
    if ((move.type === "place" || move.type === "move") && state.pendingRemoval) stats.mills++;
    moves++;
    stats.totalMoves++;
    saveStats();
    checkAchievements();
  }

  function afterLiveMove() {
    render();
    if (state.phase === "over") return endGame();
    if (state.turn === AI) scheduleAi();
  }

  function aiMove() {
    if (gameOver || paused || state.turn !== AI || state.phase === "over") return;
    const move = chooseAiMove(state, currentDiff);
    if (!move) {
      state = Object.assign(cloneState(state), { turn: AI, winner: HUMAN, phase: "over" });
      return afterLiveMove();
    }
    applyLiveMove(move);
    sfx(move.type === "remove" ? "pop" : "place");
    afterLiveMove();
  }

  function onPointClick(idx) {
    if (gameOver || paused) return;
    audio.unlock();
    if (state.turn !== HUMAN) return;

    if (state.pendingRemoval) {
      if (state.board[idx] === AI && canRemove(state, idx)) {
        applyLiveMove({ type: "remove", at: idx });
        sfx("pop");
        afterLiveMove();
      } else {
        sfx("error");
      }
      return;
    }

    if (state.phase === "place") {
      if (state.board[idx] !== null) return;
      applyLiveMove({ type: "place", to: idx });
      sfx("place");
      afterLiveMove();
      return;
    }

    // Moving phase.
    if (state.board[idx] === HUMAN) {
      selected = selected === idx ? null : idx;
      sfx("click");
      render();
      return;
    }
    if (selected !== null && state.board[idx] === null) {
      const fake = { board: state.board, turn: HUMAN };
      if (isLegalStep(fake, HUMAN, selected, idx)) {
        applyLiveMove({ type: "move", from: selected, to: idx });
        selected = null;
        sfx("place");
        afterLiveMove();
      } else {
        sfx("error");
      }
      return;
    }
    selected = null;
    render();
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    clearAiTimer();
    stats.games++;
    if (state.winner === HUMAN) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (moves <= 60) stats.fastWins++;
      if (piecesLost === 0) stats.flawlessWins++;
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();
    if (state.winner === HUMAN) {
      sfx("win");
      confetti(90);
      showOverlay("You win! 🎉", `You beat the CPU in ${moves} moves.`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      sfx("over");
      showOverlay("CPU wins 🤖", "The computer outplayed you. Try again!", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
  }

  function newGame() {
    clearAiTimer();
    state = createInitialState();
    selected = null;
    moves = 0;
    piecesLost = 0;
    gameOver = false;
    paused = false;
    currentDiff = aiDiffSel.value || "normal";
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function setDiff(name) {
    aiDiffSel.value = name;
    newGame();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
      if (state.turn === AI && state.phase !== "over") scheduleAi();
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

  function onBoardClick(e) {
    const pt = e.target && e.target.closest ? e.target.closest(".point") : null;
    if (!pt) return;
    const idx = parseInt(pt.getAttribute("data-point"), 10);
    if (Number.isFinite(idx)) onPointClick(idx);
  }

  function bindEvents() {
    pointsEl.addEventListener("click", onBoardClick);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    aiDiffSel.addEventListener("change", () => { sfx("click"); newGame(); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
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
    boardSvgEl.innerHTML = buildSvg();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__NINE_MENS_MORRIS = {
    SIZE,
    HUMAN,
    AI,
    START_PIECES,
    COORDS,
    EDGES,
    MILLS,
    ADJ,
    get state() { return cloneState(state); },
    get board() { return state.board.slice(); },
    get hand() { return Object.assign({}, state.hand); },
    get phase() { return state.phase; },
    get turn() { return state.turn; },
    get pendingRemoval() { return state.pendingRemoval; },
    get winner() { return state.winner; },
    get selected() { return selected; },
    get moves() { return moves; },
    get piecesLost() { return piecesLost; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get diff() { return currentDiff; },
    stats,
    ACHIEVEMENTS,
    createInitialState,
    cloneState,
    countOnBoard,
    totalPieces,
    inAnyMill,
    formsMill,
    removable,
    canRemove,
    isLegalStep,
    generateMovesFor,
    generateMoves,
    endTurn,
    applyMove,
    evaluate,
    minimax,
    chooseAiMove,
    onPointClick,
    aiMove,
    endGame,
    newGame,
    setDiff,
    // Test-only: deterministic RNG.
    setRng: (fn) => { rng = typeof fn === "function" ? fn : Math.random; },
    // Test-only: install a live state.
    setState: (s) => {
      s = Object.assign(createInitialState(), s || {});
      state = cloneState(s);
      selected = null;
      if (Number.isFinite(s.moves)) moves = s.moves;
      if (Number.isFinite(s.piecesLost)) piecesLost = s.piecesLost;
      gameOver = !!s.gameOver;
      paused = false;
      hideOverlay();
      render();
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