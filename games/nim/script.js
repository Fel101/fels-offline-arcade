// Nim — pure vanilla JS, offline, perfect-play CPU via recursive win/loss search.
// Normal: taking the last counter wins. Misère: taking the last counter loses.
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
  const pileEl = dom.byId("pile");
  const pileCountEl = dom.byId("pile-count");
  const turnLabel = dom.byId("turn-label");
  const winsEl = dom.byId("wins");
  const lossesEl = dom.byId("losses");
  const streakEl = dom.byId("streak");
  const takeBtns = [dom.byId("take-1"), dom.byId("take-2"), dom.byId("take-3")];
  const modeNormalBtn = dom.byId("mode-normal");
  const modeMisereBtn = dom.byId("mode-misere");
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

  // ---------- Constants ----------
  const START = 15;

  const K = makeKeys("nim");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    wins: 0,
    losses: 0,
    games: 0,
    normalWins: 0,
    misereWins: 0,
    normalLosses: 0,
    misereLosses: 0,
    streak: 0,
    bestStreak: 0,
    comebackWins: 0,
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
   * Carry the pre-core counters (plain nim-wins / nim-losses numbers) into
   * the standard stats blob, then drop the legacy keys so both formats
   * never diverge.
   */
  function migrateLegacy() {
    let changed = false;
    for (const [legacyKey, statKey] of [["nim-wins", "wins"], ["nim-losses", "losses"]]) {
      const raw = store.get(legacyKey, null);
      if (raw === null || raw === undefined) continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats[statKey]) {
        stats[statKey] = n;
        changed = true;
      }
      store.remove(legacyKey);
    }
    if (changed) saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🪙", name: "First Steps", desc: "Play your first game.", stat: "games", goal: 1 },
    { id: "win1", icon: "🏆", name: "First Win", desc: "Beat the perfect CPU.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🌟", name: "Sharp Mind", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🧠", name: "Nim Mind", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Nim Master", desc: "Win 25 games.", stat: "wins", goal: 25 },
    { id: "loss10", icon: "💪", name: "Tough Crowd", desc: "Lose 10 games.", stat: "losses", goal: 10 },
    { id: "games50", icon: "🎮", name: "Seasoned", desc: "Play 50 games.", stat: "games", goal: 50 },
    { id: "normal3", icon: "🎯", name: "Classic Conqueror", desc: "Win 3 games in normal mode.", stat: "normalWins", goal: 3 },
    { id: "misere3", icon: "🃏", name: "Misère Master", desc: "Win 3 games in misère mode.", stat: "misereWins", goal: 3 },
    { id: "streak3", icon: "🔥", name: "Three in a Row", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "💎", name: "Unbeaten Run", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "streak10", icon: "🐉", name: "Nim Legend", desc: "Win 10 games in a row.", stat: "bestStreak", goal: 10 },
    { id: "comeback", icon: "💥", name: "Comeback", desc: "Win the game right after a loss.", stat: "comebackWins", goal: 1 },
    {
      id: "bothModes",
      icon: "⚖️",
      name: "Two-Sided",
      desc: "Win in both normal and misère modes.",
      stat: "wins",
      goal: 1,
      satisfied: () => stats.normalWins >= 1 && stats.misereWins >= 1,
      progress: () => {
        const a = stats.normalWins >= 1;
        const b = stats.misereWins >= 1;
        return {
          pct: a && b ? 100 : a || b ? 50 : 0,
          now: a || b ? 1 : 0,
          text: a && b ? "Unlocked" : a || b ? "One more mode to conquer" : "Win in both modes",
        };
      },
    },
  ];

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("take", [[520, 0, 0.05, "triangle", 0.04], [700, 0.04, 0.06, "triangle", 0.03]]);

  // ---------- State ----------
  let mode = "normal"; // normal | misere
  let pile = START;
  let turn = "you";
  let gameOver = false;
  let busy = false;
  let paused = false;
  let cpuTimer = 0;
  let lastResult = null; // "win" | "loss" | null — outcome of the previous finished game
  let resumeAfterModal = false;

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
        ["Normal wins", stats.normalWins],
        ["Misère wins", stats.misereWins],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) {
        paused = true;
        resumeAfterModal = true;
        clearCpuTimer();
        busy = false;
        updateControls();
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!gameOver) {
          paused = false;
          if (turn === "cpu") scheduleCpu();
          updateControls();
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

  // ---------- CPU — perfect play ----------
  // Is the position (n counters, side to move) winning?
  // Brute-force search over 1-3 removals + recursion, cached per mode.
  const cache = { normal: new Map(), misere: new Map() };
  function winPos(n, m) {
    if (cache[m].has(n)) return cache[m].get(n);
    let result = false;
    if (n > 0) {
      for (const take of [1, 2, 3]) {
        if (take > n) continue;
        const rest = n - take;
        if (rest === 0) {
          if (m === "normal") { result = true; break; } // taking last wins in normal
          continue; // taking last loses in misère — not a winning move
        }
        if (!winPos(rest, m)) { result = true; break; } // leave opponent a losing position
      }
    }
    cache[m].set(n, result);
    return result;
  }

  function cpuChooseMove() {
    const legal = [1, 2, 3].filter((t) => t <= pile);
    for (const take of legal) {
      const rest = pile - take;
      const winning = rest === 0 ? mode === "normal" : !winPos(rest, mode);
      if (winning) return take;
    }
    // No winning move — pick randomly among losing options.
    return legal[Math.floor(Math.random() * legal.length)];
  }

  // ---------- Rendering ----------
  function renderPile() {
    pileEl.innerHTML = "";
    for (let i = 0; i < START; i++) {
      const span = document.createElement("span");
      span.className = "token" + (i < START - pile ? " taken" : "");
      span.textContent = "🪙";
      pileEl.appendChild(span);
    }
    pileCountEl.textContent = pile;
  }

  function updateControls() {
    const canAct = !gameOver && !busy && !paused && turn === "you";
    takeBtns.forEach((btn, i) => { btn.disabled = !canAct || i + 1 > pile; });
  }

  function updateScore() {
    winsEl.textContent = stats.wins;
    lossesEl.textContent = stats.losses;
    streakEl.textContent = stats.streak;
  }

  // ---------- Game flow ----------
  function clearCpuTimer() {
    if (cpuTimer) {
      window.clearTimeout(cpuTimer);
      cpuTimer = 0;
    }
  }

  function scheduleCpu() {
    clearCpuTimer();
    cpuTimer = window.setTimeout(() => {
      cpuTimer = 0;
      cpuMove();
    }, 750);
  }

  function playerTake(n) {
    if (gameOver || busy || paused || turn !== "you") return false;
    if (!Number.isInteger(n) || n < 1 || n > 3 || n > pile) return false;
    applyTake(n, "you");
    return true;
  }

  function applyTake(n, who) {
    pile -= n;
    renderPile();
    sfx("take");
    if (pile === 0) {
      endGame(who);
      return;
    }
    turn = who === "you" ? "cpu" : "you";
    if (turn === "cpu") {
      busy = true;
      turnLabel.textContent = "CPU is thinking…";
    } else {
      turnLabel.textContent = "Your move — take 1 to 3";
    }
    updateControls();
    if (turn === "cpu") scheduleCpu();
  }

  function cpuMove() {
    if (gameOver || paused) return;
    const take = cpuChooseMove();
    busy = false;
    applyTake(take, "cpu");
  }

  function endGame(lastTaker) {
    gameOver = true;
    busy = false;
    paused = false;
    clearCpuTimer();

    const youTookLast = lastTaker === "you";
    const youWin = mode === "normal" ? youTookLast : !youTookLast;

    stats.games++;
    if (youWin) {
      stats.wins++;
      if (mode === "normal") stats.normalWins++;
      else stats.misereWins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (lastResult === "loss") stats.comebackWins++;
    } else {
      stats.losses++;
      if (mode === "normal") stats.normalLosses++;
      else stats.misereLosses++;
      stats.streak = 0;
    }
    lastResult = youWin ? "win" : "loss";
    saveStats();
    checkAchievements();

    turnLabel.textContent = youWin ? "You win!" : "CPU wins!";
    updateScore();
    updateControls();

    sfx(youWin ? "win" : "over");
    if (youWin) confetti(80);

    const modeName = mode === "normal" ? "Normal" : "Misère";
    const detail = youTookLast
      ? "You took the last counter."
      : "The CPU took the last counter.";
    const rule = mode === "normal"
      ? "Taking the last counter wins."
      : "Taking the last counter loses.";
    showOverlay(
      youWin ? "You win! 🎉" : "CPU wins 🤖",
      `${modeName} — ${detail} ${rule}`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function setMode(m) {
    if (m !== "normal" && m !== "misere") return;
    if (mode === m) return;
    mode = m;
    store.set(K.mode, m);
    updateModeUI();
    reset();
  }

  function updateModeUI() {
    modeNormalBtn.classList.toggle("active", mode === "normal");
    modeMisereBtn.classList.toggle("active", mode === "misere");
    modeNormalBtn.classList.toggle("btn--ghost", mode !== "normal");
    modeMisereBtn.classList.toggle("btn--ghost", mode !== "misere");
  }

  function reset() {
    clearCpuTimer();
    pile = START;
    turn = "you";
    gameOver = false;
    busy = false;
    paused = false;
    hideOverlay();
    turnLabel.textContent = "Your move — take 1 to 3";
    renderPile();
    updateControls();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      clearCpuTimer();
      busy = false;
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); reset(); } },
      ]);
    } else {
      hideOverlay();
      if (turn === "cpu") scheduleCpu();
    }
    updateControls();
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

    const lower = String(e.key || "").toLowerCase();
    if (lower === "p") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;

    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 3) {
      if (e.preventDefault) e.preventDefault();
      playerTake(n);
    }
  }

  function bindEvents() {
    takeBtns.forEach((btn, i) =>
      btn.addEventListener("click", () => {
        audio.unlock();
        playerTake(i + 1);
      })
    );
    modeNormalBtn.addEventListener("click", () => { sfx("click"); setMode("normal"); });
    modeMisereBtn.addEventListener("click", () => { sfx("click"); setMode("misere"); });
    newGameBtn.addEventListener("click", () => { sfx("click"); reset(); });
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
    const savedMode = store.get(K.mode, "normal");
    mode = savedMode === "misere" ? "misere" : "normal";
    updateModeUI();
    migrateLegacy();
    updateScore();
    updateBadgeCount();
    bindEvents();
    reset();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__NIM = {
    START,
    stats,
    ACHIEVEMENTS,
    snap: () => ({
      pile,
      turn,
      mode,
      gameOver,
      busy,
      paused,
      lastResult,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
      turnLabel: turnLabel.textContent,
      tokensTaken: Array.prototype.filter.call(pileEl.children, (c) => c.classList.contains("taken")).length,
      takeDisabled: takeBtns.map((b) => b.disabled),
    }),
    take: playerTake,
    cpuMove,
    setMode,
    reset,
    setPaused,
    togglePause,
    checkAchievements,
    saveStats,
    openAchv,
    closeAchv,
    winPos,
    cpuChooseMove,
    overlay,
  };

  init();
})();
