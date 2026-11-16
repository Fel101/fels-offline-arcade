// Tic-Tac-Toe — you vs the machine. Pure vanilla JS, fully offline.
// Modes: Classic (perfect AI), Blitz (beat it 3x), Daily (seeded), 2 Player.
// Shared plumbing comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    util,
    audio,
    toast,
    overlay,
    confetti,
    badges: badgesApi,
    modal: modalApi,
    dom,
  } = window.Arcade;

  const { formatTime, hashSeed, mulberry32 } = util;
  const sfx = audio.sfx;
  const showToast = toast.show;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;
  const createBadges = badgesApi.create;
  const createModal = modalApi.create;

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const boardWrap = dom.byId("board-wrap");
  const countdownEl = dom.byId("countdown");
  const countdownNumEl = dom.byId("countdown-num");
  const youEl = dom.byId("you");
  const drawsEl = dom.byId("draws");
  const cpuEl = dom.byId("cpu");
  const streakEl = dom.byId("streak");
  const timeEl = dom.byId("time");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const newGameBtn = dom.byId("new-game");
  const pauseBtn = dom.byId("pause");
  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const modeChips = dom.all(".mode-chip");
  const diffChips = dom.all(".diff-chip");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  // ---------- Constants ----------
  const HUMAN = "X";
  const AI = "O";

  const MODES = {
    classic: { name: "Classic", timed: false },
    blitz: { name: "Blitz", timed: true, baseTime: 120, target: 3 },
    daily: { name: "Daily", timed: false },
    two: { name: "2 Player", timed: false, twoPlayer: true },
  };

  // blunder = chance the AI ignores its best move entirely.
  const DIFFS = {
    chill: { name: "Chill", blunder: 0.55 },
    cunning: { name: "Cunning", blunder: 0.2 },
    ruthless: { name: "Ruthless", blunder: 0 },
  };

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  const ACHIEVEMENTS = [
    { id: "first", icon: "❌", name: "First Game", desc: "Play your first match.", stat: "games", goal: 1 },
    { id: "win1", icon: "🎉", name: "Winner", desc: "Beat the AI.", stat: "wins", goal: 1 },
    { id: "win10", icon: "🏆", name: "Ten Wins", desc: "Beat the AI 10 times.", stat: "wins", goal: 10 },
    { id: "win50", icon: "👑", name: "Tic-Tac-Toe Royalty", desc: "Beat the AI 50 times.", stat: "wins", goal: 50 },
    { id: "draw1", icon: "🤝", name: "Stalemate", desc: "Force a draw.", stat: "draws", goal: 1 },
    { id: "draw10", icon: "🧱", name: "Wall", desc: "Force 10 draws.", stat: "draws", goal: 10 },
    { id: "ruthless", icon: "🤖", name: "Giant Slayer", desc: "Beat Ruthless AI.", stat: "ruthlessWins", goal: 1 },
    { id: "ruthless5", icon: "⚔️", name: "Ruthless Hunter", desc: "Beat Ruthless AI 5 times.", stat: "ruthlessWins", goal: 5 },
    { id: "chill", icon: "🌴", name: "Warm Up", desc: "Beat Chill AI 5 times.", stat: "chillWins", goal: 5 },
    { id: "blitz", icon: "⚡", name: "Blitz Win", desc: "Win a Blitz round.", stat: "blitzWins", goal: 1 },
    { id: "blitz3", icon: "🚀", name: "Triple Threat", desc: "Win 3 Blitz rounds.", stat: "blitzWins", goal: 3 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Finish the Daily match.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "two", icon: "👥", name: "Couch Rival", desc: "Finish a 2-player match.", stat: "twoWins", goal: 1 },
    { id: "streak3", icon: "🔥", name: "Hat Trick", desc: "Win 3 in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🌋", name: "Unstoppable", desc: "Win 5 in a row.", stat: "bestStreak", goal: 5 },
    { id: "quick", icon: "💨", name: "Speed Match", desc: "Win a match in 3 moves.", stat: "quickWins", goal: 1 },
    { id: "corner", icon: "📐", name: "Corner Office", desc: "Win with a corner-to-corner line.", stat: "cornerWins", goal: 1 },
    { id: "comeback", icon: "💪", name: "Comeback", desc: "Win after losing 3 in a row.", stat: "comeback", goal: 1 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Win a match between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Play 10 matches.", stat: "games", goal: 10 },
    { id: "games50", icon: "🎯", name: "Devoted", desc: "Play 50 matches.", stat: "games", goal: 50 },
    { id: "flawless", icon: "✨", name: "Flawless", desc: "Win without ever being threatened.", stat: "flawless", goal: 1 },
  ];

  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    bestStreak: 0,
    streak: 0,
    ruthlessWins: 0,
    chillWins: 0,
    blitzWins: 0,
    dailySolves: 0,
    twoWins: 0,
    quickWins: 0,
    cornerWins: 0,
    comeback: 0,
    nightWins: 0,
    flawless: 0,
    playTime: 0,
  };

  const K = makeKeys("tic-tac-toe");

  // ---------- Persistent state ----------
  const storedStats = store.json(K.stats, {});
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  let daily = store.json(K.daily, null);
  if (!daily || typeof daily !== "object" || Array.isArray(daily)) {
    daily = { streak: 0, lastDate: "", history: {} };
  }
  if (!daily.history || typeof daily.history !== "object") daily.history = {};
  if (!Number.isFinite(daily.streak)) daily.streak = 0;

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "chill",
    board: new Array(9).fill(""),
    turn: HUMAN,
    gameOver: false,
    winner: null,
    line: null,
    scores: { you: 0, draws: 0, cpu: 0 },
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    blitzWins: 0,
    plies: 0,
    everThreatened: false,
  };

  let cellEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let aiTimer = 0;
  let matchRand = Math.random;

  // ---------- Achievements ----------
  function statValue(key) {
    if (key === "dailyStreak") return daily.streak;
    return stats[key] || 0;
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  const achv = createBadges(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: statValue,
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

  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Wins", stats.wins],
        ["Draws", stats.draws],
        ["Played", stats.games],
        ["Best streak", stats.bestStreak],
        ["Daily streak", daily.streak + "d"],
      ],
    });
  }

  const achvModalCtl = createModal(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!state.gameOver && !state.paused && state.started) {
        state.paused = true;
        resumeAfterModal = true;
        pauseBtn.textContent = "▶ Resume";
        window.clearTimeout(aiTimer);
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!state.gameOver) {
          state.paused = false;
          pauseBtn.textContent = "Pause";
          maybeAiMove();
        }
      }
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

  // ---------- Rules ----------
  function winnerOf(b) {
    for (const [x, y, z] of LINES) {
      if (b[x] && b[x] === b[y] && b[x] === b[z]) {
        return { player: b[x], line: [x, y, z] };
      }
    }
    return null;
  }

  function isFull(b) {
    return b.every((v) => v);
  }

  function available(b) {
    const out = [];
    for (let i = 0; i < 9; i++) if (!b[i]) out.push(i);
    return out;
  }

  function isTwoPlayer() {
    return MODES[state.mode].twoPlayer;
  }

  function turnMark() {
    return state.turn;
  }

  // ---------- AI ----------
  /** Minimax with depth preference so the AI wins fast and stalls long. */
  function minimax(b, player, depth) {
    const w = winnerOf(b);
    if (w) return w.player === AI ? 10 - depth : depth - 10;
    if (isFull(b)) return 0;

    if (player === AI) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        b[i] = AI;
        best = Math.max(best, minimax(b, HUMAN, depth + 1));
        b[i] = "";
      }
      return best;
    }

    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = HUMAN;
      best = Math.min(best, minimax(b, AI, depth + 1));
      b[i] = "";
    }
    return best;
  }

  function bestMoves() {
    const board = state.board.slice();
    let bestScore = -Infinity;
    let picks = [];
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = AI;
      const score = minimax(board, HUMAN, 0);
      board[i] = "";
      if (score > bestScore) {
        bestScore = score;
        picks = [i];
      } else if (score === bestScore) {
        picks.push(i);
      }
    }
    return picks;
  }

  function chooseAiMove() {
    const moves = bestMoves();
    if (!moves.length) return -1;

    const cfg = DIFFS[state.diff];
    // On lower difficulties, sometimes play a random legal move instead.
    if (cfg.blunder > 0 && matchRand() < cfg.blunder) {
      const open = available(state.board);
      if (!open.length) return -1;
      return open[Math.floor(matchRand() * open.length)];
    }

    // Among equally optimal moves, prefer the centre, then corners.
    if (moves.length === 1) return moves[0];
    const centre = 4;
    if (moves.includes(centre)) return centre;
    const corners = moves.filter((m) => [0, 2, 6, 8].includes(m));
    if (corners.length) return corners[Math.floor(matchRand() * corners.length)];
    return moves[Math.floor(matchRand() * moves.length)];
  }

  // ---------- Rendering ----------
  function buildBoard() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    boardEl.style.gridTemplateColumns = "repeat(3, 1fr)";
    cellEls = [];

    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ttt-cell";
      btn.dataset.idx = String(i);
      btn.innerHTML = `<span class="ttt-cell__mark" aria-hidden="true"></span>`;
      btn.setAttribute("aria-label", `Square ${i + 1}, empty`);
      btn.addEventListener("click", () => onCellClick(i));
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
  }

  function renderBoard() {
    for (let i = 0; i < 9; i++) {
      const el = cellEls[i];
      if (!el) continue;
      const v = state.board[i];
      const markEl = el.querySelector(".ttt-cell__mark");
      if (markEl) markEl.textContent = v;
      el.dataset.mark = v;
      el.classList.toggle("is-x", v === HUMAN);
      el.classList.toggle("is-o", v === AI);
      el.classList.toggle("is-win", !!(state.line && state.line.includes(i)));
      const row = Math.floor(i / 3) + 1;
      const col = (i % 3) + 1;
      el.setAttribute(
        "aria-label",
        `Square ${i + 1}, row ${row} column ${col}, ${v === HUMAN ? "X" : v === AI ? "O" : "empty"}`
      );
      el.disabled = !!v || state.gameOver;
    }
  }

  function updateHUD() {
    youEl.textContent = String(state.scores.you);
    drawsEl.textContent = String(state.scores.draws);
    cpuEl.textContent = String(state.scores.cpu);
    streakEl.textContent = String(stats.streak);
    timeEl.textContent = MODES[state.mode].timed
      ? formatTime(state.remaining)
      : formatTime(state.elapsed);
  }

  function updateTimeDisplay() {
    const text = MODES[state.mode].timed
      ? formatTime(state.remaining)
      : formatTime(state.elapsed);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    timeEl.classList.toggle(
      "is-danger",
      MODES[state.mode].timed && state.remaining <= 15000 && state.started && !state.gameOver
    );
  }

  function updateCountdown() {
    if (state.started || state.countdown <= 0) {
      countdownEl.hidden = true;
      return;
    }
    countdownEl.hidden = false;
    const label = String(Math.min(3, Math.max(1, Math.ceil(state.countdown / 400))));
    if (countdownNumEl.textContent !== label) {
      countdownNumEl.textContent = label;
      countdownNumEl.style.animation = "none";
      void countdownNumEl.offsetWidth;
      countdownNumEl.style.animation = "";
    }
  }

  function updateHint() {
    const m = MODES[state.mode];
    const d = DIFFS[state.diff];
    let text;
    if (m.twoPlayer) text = "2 Player · X and O share the board";
    else if (state.mode === "blitz") text = `Blitz · ${d.name} AI · win ${m.target} in ${m.baseTime}s`;
    else if (state.mode === "daily") text = `Daily · ${d.name} AI · streak ${daily.streak}d`;
    else text = `Classic · ${d.name} AI`;
    hintEl.textContent =
      text +
      (m.twoPlayer
        ? " · Click a square · X goes first"
        : " · You are X · Click a square · Arrows + Enter also work");
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) => {
      b.disabled = isTwoPlayer();
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false");
    });
    newGameBtn.disabled = state.mode === "daily";
    updateHint();
    updateHUD();
  }

  function bestLabel() {
    return stats.wins > 0 ? String(stats.wins) : "—";
  }

  // ---------- Game flow ----------
  function resetBoard() {
    hideOverlay();
    window.clearTimeout(aiTimer);
    state.board = new Array(9).fill("");
    state.turn = HUMAN;
    state.gameOver = false;
    state.winner = null;
    state.line = null;
    state.plies = 0;
    state.everThreatened = false;
    renderBoard();
  }

  function newMatch() {
    hideOverlay();
    window.clearTimeout(aiTimer);

    state.board = new Array(9).fill("");
    state.turn = HUMAN;
    state.gameOver = false;
    state.winner = null;
    state.line = null;
    state.plies = 0;
    state.everThreatened = false;
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed ? MODES[state.mode].baseTime * 1000 : 0;
    state.countdown = 1200;
    state.started = false;
    state.paused = false;
    state.blitzWins = 0;

    matchRand = state.mode === "daily"
      ? mulberry32(hashSeed(`${util.dateStr()}-${state.diff}`))
      : Math.random;

    lastTimeText = "";
    pauseBtn.textContent = "Pause";
    buildBoard();
    renderBoard();
    updateModeUI();
    updateCountdown();
    updateTimeDisplay();
    updateHUD();

    lastTs = performance.now();
  }

  function setMode(m) {
    if (!MODES[m] || m === state.mode) return;
    state.mode = m;
    store.set(K.mode, m);
    newMatch();
  }

  function setDiff(d) {
    if (!DIFFS[d] || d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    newMatch();
  }

  function startPlay() {
    if (state.started) return;
    state.started = true;
    state.countdown = 0;
    updateCountdown();
    sfx("click");
    updateHUD();
  }

  // ---------- Play ----------
  function onCellClick(i) {
    if (!canEdit()) return;
    if (state.board[i]) return;
    place(i, turnMark());
  }

  function place(i, mark) {
    state.board[i] = mark;
    state.plies++;
    sfx("place");
    renderBoard();

    const w = winnerOf(state.board);
    if (w) {
      finishMatch(w.player, w.line);
      return;
    }
    if (isFull(state.board)) {
      finishMatch("draw", null);
      return;
    }

    // Did the opponent just create a threat?
    const threats = countThreats(state.board, mark === HUMAN ? AI : HUMAN);
    if (threats > 0) state.everThreatened = true;

    state.turn = mark === HUMAN ? AI : HUMAN;
    dom.announce(
      liveEl,
      `${mark} played square ${i + 1}. ${state.turn === HUMAN ? "Your turn." : "Computer thinking."}`
    );
    maybeAiMove();
  }

  function countThreats(b, mark) {
    let n = 0;
    for (const [x, y, z] of LINES) {
      const vals = [b[x], b[y], b[z]];
      const marks = vals.filter((v) => v === mark).length;
      const empties = vals.filter((v) => !v).length;
      if (marks === 2 && empties === 1) n++;
    }
    return n;
  }

  function maybeAiMove() {
    if (isTwoPlayer()) return;
    if (state.gameOver || state.turn !== AI) return;
    if (!canEdit()) return;

    window.clearTimeout(aiTimer);
    const delay = 260 + Math.floor(Math.random() * 220);
    aiTimer = window.setTimeout(() => {
      if (state.gameOver || state.turn !== AI || !canEdit()) return;
      const move = chooseAiMove();
      if (move < 0) return;
      place(move, AI);
    }, delay);
  }

  function finishMatch(result, line) {
    if (state.gameOver) return;
    state.gameOver = true;
    state.winner = result;
    state.line = line;
    state.started = false;
    window.clearTimeout(aiTimer);

    const twoPlayer = isTwoPlayer();
    const humanWon = result === HUMAN;
    const draw = result === "draw";

    stats.games++;
    if (draw) {
      stats.draws++;
      state.scores.draws++;
    } else if (twoPlayer) {
      // In 2-player, X is "you" and O is the other player.
      if (result === HUMAN) {
        stats.wins++;
        state.scores.you++;
      } else {
        stats.losses++;
        state.scores.cpu++;
      }
      stats.twoWins++;
    } else if (humanWon) {
      stats.wins++;
      state.scores.you++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);

      if (state.diff === "ruthless") stats.ruthlessWins++;
      if (state.diff === "chill") stats.chillWins++;
      if (state.plies <= 5) stats.quickWins++;
      if (line && line.includes(0) && line.includes(8)) stats.cornerWins++;
      if (line && line.includes(2) && line.includes(6)) stats.cornerWins++;
      if (!state.everThreatened) stats.flawless++;
      if (new Date().getHours() < 5) stats.nightWins++;

      if (state.mode === "blitz") {
        state.blitzWins++;
        stats.blitzWins = Math.max(stats.blitzWins, 0) + 0;
        stats.blitzWins++;
      }
    } else {
      stats.losses++;
      state.scores.cpu++;
      stats.streak = 0;
    }

    if (state.mode === "daily") recordDailyWin(result);

    // Persist the best result for this mode + difficulty.
    const score = humanWon ? 3 : draw ? 1 : 0;
    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevBest = prev && Number.isFinite(prev.s) ? prev.s : -1;
    if (score > prevBest) {
      store.jsonSet(K.best(state.mode, state.diff), { s: score, w: stats.wins });
    }

    saveStats();
    checkAchievements();

    renderBoard();
    updateHUD();
    updateTimeDisplay();

    sfx(humanWon ? "win" : draw ? "word" : "over");
    if (humanWon) confetti(state.diff === "ruthless" ? 120 : 80);

    const title = draw
      ? "Draw! 🤝"
      : humanWon
        ? twoPlayer
          ? "X wins! 🎉"
          : "You win! 🎉"
        : twoPlayer
          ? "O wins!"
          : "CPU wins 🤖";
    const msg =
      `${DIFFS[state.diff].name}${twoPlayer ? "" : " AI"} · ` +
      `${stats.wins}W / ${stats.draws}D / ${stats.losses}L` +
      (state.mode === "blitz" ? ` · Blitz ${state.blitzWins}/3` : "");

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); newMatch(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function recordDailyWin(result) {
    if (state.mode !== "daily") return;
    const today = util.dateStr();
    if (daily.lastDate === today) return;
    daily.streak = daily.lastDate === util.yesterdayStr() ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { r: result, d: state.diff };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
    saveStats();
  }

  function canEdit() {
    return state.started && !state.paused && !state.gameOver && achvModal.hidden;
  }

  function focusModeBar() {
    const chip = document.querySelector(".mode-chip");
    if (chip) chip.focus();
  }

  function setPaused(p, silent) {
    if (state.gameOver || !state.started) return;
    state.paused = p;
    pauseBtn.textContent = p ? "▶ Resume" : "Pause";
    if (p) {
      window.clearTimeout(aiTimer);
      if (!silent) {
        showOverlay("Paused", "Take a breath — press P or hit Resume.", [
          { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
          { label: "Restart", ghost: true, onClick: () => { hideOverlay(); newMatch(); } },
        ]);
      }
    } else {
      hideOverlay();
      maybeAiMove();
    }
  }

  function togglePause() {
    if (state.gameOver || !state.started) return;
    setPaused(!state.paused, false);
  }

  // ---------- Loop ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;
    if (dt < 0) dt = 0;

    if (!state.started && !state.gameOver && !state.paused && achvModal.hidden) {
      if (state.countdown > 0) {
        state.countdown = Math.max(0, state.countdown - dt);
        if (state.countdown === 0) {
          state.started = true;
          sfx("click");
          updateHUD();
          maybeAiMove();
        }
        updateCountdown();
      }
    }

    if (state.started && !state.gameOver && !state.paused && achvModal.hidden) {
      state.elapsed += dt;
      if (MODES[state.mode].timed) {
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          endByTime();
          return;
        }
      }
    }

    updateTimeDisplay();
  }

  function endByTime() {
    if (state.gameOver) return;
    state.gameOver = true;
    state.started = false;
    window.clearTimeout(aiTimer);

    const won = state.blitzWins >= MODES.blitz.target;
    sfx(won ? "win" : "over");

    const title = won ? "Blitz Cleared! ⚡" : "Time's up! ⏰";
    const msg = `${state.blitzWins}/${MODES.blitz.target} wins · ${stats.wins}W / ${stats.draws}D / ${stats.losses}L`;

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); newMatch(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  // ---------- Input ----------
  function onKeyDown(e) {
    const lower = e.key.toLowerCase();

    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        closeAchv();
        e.preventDefault();
      }
      return;
    }

    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state.gameOver) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        newMatch();
      }
      return;
    }

    if (state.paused) return;

    // Number keys 1-9 play a square.
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      e.preventDefault();
      onCellClick(n - 1);
      return;
    }

    if (lower === "n" && state.mode !== "daily") newMatch();
  }

  function bindEvents() {
    modeChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m] || m === state.mode) return;
        sfx("click");
        setMode(m);
      });
    });

    diffChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.diff;
        if (!DIFFS[d] || d === state.diff) return;
        sfx("click");
        setDiff(d);
      });
    });

    newGameBtn.addEventListener("click", () => {
      sfx("click");
      if (state.mode !== "daily") newMatch();
    });
    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2) {
      badges2.addEventListener("click", () => {
        sfx("click");
        openAchv();
      });
    }

    document.addEventListener("keydown", onKeyDown);

    window.addEventListener("blur", () => {
      if (!state.gameOver && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !state.gameOver && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    const savedDiff = store.get(K.diff, "chill");
    state.diff = DIFFS[savedDiff] ? savedDiff : "chill";

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    updateBadgeCount();
    bindEvents();
    newMatch();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__TTT = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    LINES,
    winnerOf,
    isFull,
    available,
    minimax,
    bestMoves,
    chooseAiMove,
    place,
    onCellClick,
    finishMatch,
    newMatch,
    setMode,
    setDiff,
    startPlay,
    endByTime,
    checkAchievements,
    saveStats,
    loop,
    setPaused,
    togglePause,
    unlocked: () => achv.list(),
    snap: () => ({
      mode: state.mode,
      diff: state.diff,
      board: state.board.slice(),
      turn: state.turn,
      plies: state.plies,
      gameOver: state.gameOver,
      winner: state.winner,
      line: state.line,
      blitzWins: state.blitzWins,
      scores: Object.assign({}, state.scores),
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      cellEls: cellEls.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
  };

  init();
})();