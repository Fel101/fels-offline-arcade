// Othello — pure vanilla JS, fully offline. Standard Reversi rules, negamax AI with positional weights.
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
  const countsEl = dom.byId("counts");
  const levelSel = dom.byId("level");
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
  // Weighted position matrix: corners are gold, X/C-squares near corners are poison.
  const WEIGHTS = [
    100, -25,  10,   5,   5,  10, -25, 100,
    -25, -40,  -5,  -5,  -5,  -5, -40, -25,
     10,  -5,   8,   2,   2,   8,  -5,  10,
      5,  -5,   2,   1,   1,   2,  -5,   5,
      5,  -5,   2,   1,   1,   2,  -5,   5,
     10,  -5,   8,   2,   2,   8,  -5,  10,
    -25, -40,  -5,  -5,  -5,  -5, -40, -25,
    100, -25,  10,   5,   5,  10, -25, 100,
  ];
  const DIFF_FACTOR = 2; // disc-differential weight in the static eval
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const HUMAN = "b", AI = "w";
  const DIFF_NAMES = { "2": "easy", "3": "normal", "4": "hard" };
  const FAST_MOVES = 24; // a win inside this many of your own moves counts as "fast"
  const AI_DELAY = 120;
  const HINT_DEFAULT = "You are Black and move first. Flank AI discs to flip them — most discs wins. P pauses.";

  const K = makeKeys("othello");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
    fastWins: 0, // wins inside FAST_MOVES of your own moves
    flips: 0, // discs you have flipped, career
    streak: 0,
    bestStreak: 0,
    totalMoves: 0, // your own moves, career
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

  // Carry the pre-core win counter (othello-wins) into stats.wins.
  function migrateLegacy() {
    const raw = store.get("othello-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("othello-wins");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "easy", icon: "🟢", name: "Warm-Up", desc: "Win on Easy.", stat: "easyWins", goal: 1 },
    { id: "normal", icon: "🟡", name: "Street Level", desc: "Win on Normal.", stat: "normalWins", goal: 1 },
    { id: "hard", icon: "🟣", name: "Hard Mode", desc: "Win on Hard.", stat: "hardWins", goal: 1 },
    {
      id: "allDiff",
      icon: "🌈",
      name: "All Rounder",
      desc: "Win on Easy, Normal and Hard.",
      stat: "wins",
      goal: 1,
      satisfied: () => stats.easyWins >= 1 && stats.normalWins >= 1 && stats.hardWins >= 1,
      progress: () => {
        const got = [stats.easyWins >= 1, stats.normalWins >= 1, stats.hardWins >= 1].filter(Boolean).length;
        return {
          pct: (got / 3) * 100,
          now: got,
          text: got === 3 ? "Unlocked" : got + " / 3 difficulties",
        };
      },
    },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "flip100", icon: "🔄", name: "Flipper", desc: "Flip 100 discs in total.", stat: "flips", goal: 100 },
    {
      id: "corners4",
      icon: "📐",
      name: "Cornered",
      desc: "Hold all four corners at once.",
      goal: 1,
      satisfied: () => countCorners(board, HUMAN) >= 4,
      progress: () => {
        const got = countCorners(board, HUMAN);
        return {
          pct: (got / 4) * 100,
          now: got,
          text: got === 4 ? "Unlocked" : got + " / 4 corners",
        };
      },
    },
    { id: "fast5", icon: "💨", name: "Lightning", desc: `Win 5 games within ${FAST_MOVES} of your moves.`, stat: "fastWins", goal: 5 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 games.", stat: "games", goal: 20 },
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
        ["Draws", stats.draws],
        ["Best streak", stats.bestStreak],
        ["Discs flipped", stats.flips],
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
  let board, turn, gameOver;
  let paused = false;
  let moveCount = 0; // your completed moves this game
  let aiDepth = 3;
  let currentDiff = "normal";
  let aiTimer = null;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (c) => (c === "b" ? "w" : "b");
  const cloneBoard = (b) => b.map((row) => row.slice());
  const countDiscs = (b, color) => {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === color) n++;
    return n;
  };
  const isCorner = (r, c) => (r === 0 || r === 7) && (c === 0 || c === 7);
  const countCorners = (b, color) => {
    let n = 0;
    for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7]]) if (b[r][c] === color) n++;
    return n;
  };

  function setup() {
    board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    board[3][3] = "w"; board[3][4] = "b";
    board[4][3] = "b"; board[4][4] = "w";
    turn = HUMAN;
    gameOver = false;
  }

  // ---------- Rules ----------
  // For an empty cell, list flanked discs in every direction. Returns move list.
  function legalMoves(b, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (b[r][c]) continue;
      const flips = [];
      for (const [dr, dc] of DIRS) {
        const line = [];
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc) && b[nr][nc] === opp(color)) {
          line.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (line.length && inBounds(nr, nc) && b[nr][nc] === color) flips.push(...line);
      }
      if (flips.length) moves.push({ r, c, flips });
    }
    return moves;
  }

  function applyDisc(b, m, color) {
    b[m.r][m.c] = color;
    for (const [r, c] of m.flips) b[r][c] = color;
  }

  // ---------- AI ----------
  function evalBoard(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      s += p === color ? WEIGHTS[r * 8 + c] : -WEIGHTS[r * 8 + c];
    }
    return s + (countDiscs(b, color) - countDiscs(b, opp(color))) * DIFF_FACTOR;
  }

  const byWeight = (a, b) => WEIGHTS[b.r * 8 + b.c] - WEIGHTS[a.r * 8 + a.c];

  function search(b, d, alpha, beta, color) {
    const moves = legalMoves(b, color);
    if (moves.length === 0) {
      if (legalMoves(b, opp(color)).length === 0) {
        const diff = countDiscs(b, color) - countDiscs(b, opp(color));
        return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0;
      }
      return -search(b, d - 1, -beta, -alpha, opp(color)); // pass: opponent moves again
    }
    if (d === 0) return evalBoard(b, color);
    moves.sort(byWeight);
    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      applyDisc(nb, m, color);
      const score = -search(nb, d - 1, -beta, -alpha, opp(color));
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMoveFor(color, d) {
    const moves = legalMoves(board, color);
    if (!moves.length) return null;
    moves.sort(byWeight);
    let best = -Infinity, picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      applyDisc(nb, m, color);
      const s = -search(nb, d - 1, -Infinity, Infinity, opp(color));
      if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
    }
    return picks[(Math.random() * picks.length) | 0];
  }

  // ---------- Rendering & interaction ----------
  function updateHud() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    updateCounts();
  }

  function updateCounts() {
    countsEl.textContent = `You ${countDiscs(board, HUMAN)} · AI ${countDiscs(board, AI)}`;
  }

  function render() {
    boardEl.innerHTML = "";
    const legal = gameOver === true || turn !== HUMAN
      ? []
      : legalMoves(board, HUMAN).map((m) => m.r * 8 + m.c);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.width = "100%";
      cell.style.aspectRatio = "1";
      cell.style.padding = "0";
      cell.style.fontSize = "clamp(1.2rem, 5.5vw, 2.4rem)";
      cell.style.background = (r + c) % 2 === 0 ? "radial-gradient(circle at 50% 42%, #2aa763, #1c7a48)" : "radial-gradient(circle at 50% 42%, #1f8a50, #146038)";
      const p = board[r][c];
      if (p) {
        cell.textContent = "●";
        if (p === HUMAN) {
          cell.style.color = "#14141f";
          cell.style.textShadow = "0 0 3px rgba(255,255,255,.35), 0 2px 2px #000";
        } else {
          cell.style.color = "#f2f2fa";
          cell.style.textShadow = "0 2px 2px #000, 0 0 3px #000";
        }
      } else if (legal.includes(r * 8 + c)) {
        cell.textContent = "•";
        cell.style.color = "var(--accent)";
      }
      cell.addEventListener("click", () => {
        audio.unlock();
        onCellClick(r, c);
      });
      boardEl.appendChild(cell);
    }
    updateHud();
  }

  function setStatus(t) { statusEl.textContent = t; }

  function clearAiTimer() {
    if (aiTimer) {
      window.clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function scheduleAi() {
    clearAiTimer();
    gameOver = "thinking"; // guard: block input while the AI is to move
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      aiGo();
    }, AI_DELAY);
  }

  // After a move (or pass), hand the turn over and handle passes / game over.
  function advance() {
    turn = opp(turn);
    let passMsg = null;
    if (legalMoves(board, turn).length === 0) {
      if (legalMoves(board, opp(turn)).length === 0) return endOfGame();
      passMsg = turn === HUMAN ? "You have no legal moves — turn passes" : "AI has no legal moves — turn passes";
      turn = opp(turn); // automatic pass
    }
    render();
    updateCounts();
    if (turn === AI) {
      setStatus(passMsg ? passMsg + " · AI thinking…" : "AI thinking…");
      scheduleAi();
    } else {
      setStatus(passMsg ? passMsg + " · Your move" : "Your move");
    }
  }

  function onCellClick(r, c) {
    if (gameOver || paused || turn !== HUMAN) return;
    const move = legalMoves(board, HUMAN).find((m) => m.r === r && m.c === c);
    if (!move) return;
    applyDisc(board, move, HUMAN);
    stats.flips += move.flips.length;
    stats.totalMoves++;
    moveCount++;
    saveStats();
    sfx(move.flips.length ? "flip" : "place");
    checkAchievements();
    advance();
  }

  function aiGo() {
    if (paused || gameOver === true) return;
    gameOver = false;
    const m = bestMoveFor(AI, aiDepth);
    if (m) {
      applyDisc(board, m, AI);
      sfx("click");
    }
    advance();
  }

  function endOfGame() {
    if (gameOver === true) return;
    gameOver = true;
    paused = false;
    clearAiTimer();
    const b = countDiscs(board, HUMAN), w = countDiscs(board, AI);
    let title, msg, outcome;
    if (b > w) {
      title = "You win! 🎉";
      msg = "Most discs on the board.";
      outcome = "win";
    } else if (w > b) {
      title = "CPU wins 🤖";
      msg = "The computer took the majority.";
      outcome = "loss";
    } else {
      title = "Draw";
      msg = "Perfectly balanced — nobody wins.";
      outcome = "draw";
    }

    stats.games++;
    if (outcome === "win") {
      stats.wins++;
      if (currentDiff === "easy") stats.easyWins++;
      else if (currentDiff === "hard") stats.hardWins++;
      else stats.normalWins++;
      if (moveCount <= FAST_MOVES) stats.fastWins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else if (outcome === "loss") {
      stats.losses++;
      stats.streak = 0;
    } else {
      stats.draws++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();
    setStatus(title);

    const buttons = [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ];
    const score = `Final: You ${b} · AI ${w}`;
    if (outcome === "win") {
      sfx("win");
      confetti(90);
      const shutout = w === 0 ? " Shutout!" : "";
      const fastMsg = moveCount <= FAST_MOVES ? ` Fast win in ${moveCount} move${moveCount === 1 ? "" : "s"}!` : "";
      showOverlay(title, score + "." + shutout + " Streak " + stats.streak + "." + fastMsg, buttons);
    } else if (outcome === "loss") {
      sfx("over");
      showOverlay(title, score + ". Better luck next time!", buttons);
    } else {
      sfx("hint");
      showOverlay(title, score + ".", buttons);
    }
  }

  function newGame() {
    clearAiTimer();
    setup();
    paused = false;
    moveCount = 0;
    aiDepth = parseInt(levelSel.value, 10) || 3;
    currentDiff = DIFF_NAMES[levelSel.value] || "normal";
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
    setStatus("Your move");
  }

  function setDiff(name) {
    const map = { easy: "2", normal: "3", hard: "4" };
    levelSel.value = map[name] || String(name);
    newGame();
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
    levelSel.addEventListener("change", () => { sfx("click"); newGame(); });

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
  window.__OTHELLO = {
    WEIGHTS,
    DIRS,
    HUMAN,
    AI,
    FAST_MOVES,
    get board() { return cloneBoard(board); },
    get turn() { return turn; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get aiDepth() { return aiDepth; },
    get diff() { return currentDiff; },
    get moveCount() { return moveCount; },
    stats,
    ACHIEVEMENTS,
    inBounds,
    isCorner,
    cloneBoard,
    countDiscs,
    countCorners,
    legalMoves,
    applyDisc,
    evalBoard,
    search,
    bestMoveFor,
    click: onCellClick,
    aiGo,
    advance,
    endOfGame,
    newGame,
    setDiff,
    // Test-only: install a position directly.
    setState: (b, t) => {
      clearAiTimer();
      board = cloneBoard(b);
      turn = t || HUMAN;
      gameOver = false;
      paused = false;
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
