// Code Breaker — pure vanilla JS, fully offline. Classic code-breaking.
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
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const boardEl = dom.byId("board");
  const paletteEl = dom.byId("palette");
  const guessBtn = dom.byId("guess-btn");
  const newCodeBtn = dom.byId("new-code");
  const diffSel = dom.byId("difficulty");
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
  const MAX_ROWS = 10;
  const COLORS = [
    { name: "red", bg: "radial-gradient(circle at 34% 34%, #ff9d8a, #ef4d38 58%, #b0271a)" },
    { name: "yellow", bg: "radial-gradient(circle at 34% 34%, #fff3a0, #ffd94d 58%, #d9a613)" },
    { name: "green", bg: "radial-gradient(circle at 34% 34%, #a4ffc9, #2fd071 58%, #0f8f43)" },
    { name: "blue", bg: "radial-gradient(circle at 34% 34%, #a8e6ff, #38b6ef 58%, #0f6f9f)" },
    { name: "purple", bg: "radial-gradient(circle at 34% 34%, #e0b3ff, #a55ef0 58%, #6a1fb0)" },
    { name: "orange", bg: "radial-gradient(circle at 34% 34%, #ffd0a0, #ff8c1a 58%, #b3550a)" },
  ];
  const DIFFS = {
    easy: { pegs: 4, colors: 4 },
    normal: { pegs: 4, colors: 6 },
    hard: { pegs: 5, colors: 6 },
  };
  const FAST_GUESSES = 3; // cracking within this many counts as "fast"
  const HINT_DEFAULT =
    "Black = right color, right spot · White = right color, wrong spot. Click a filled peg to undo. P pauses.";

  const K = makeKeys("mastermind");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0, // codes played to the end (win or loss)
    wins: 0,
    oneShot: 0, // cracked in a single guess
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
    fastWins: 0, // cracked in FAST_GUESSES or fewer guesses
    streak: 0,
    bestStreak: 0,
    totalGuesses: 0,
    undos: 0,
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
   * Carry the pre-core counters (mastermind-wins, mastermind-streak) into
   * the standard stats blob, then drop the legacy keys so both formats
   * never diverge.
   */
  function migrateLegacy() {
    const rawWins = store.get("mastermind-wins", null);
    if (rawWins !== null && rawWins !== undefined) {
      const n = Number(rawWins);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("mastermind-wins");
    }
    const rawStreak = store.get("mastermind-streak", null);
    if (rawStreak !== null && rawStreak !== undefined) {
      const n = Number(rawStreak);
      if (Number.isFinite(n) && n > 0) {
        stats.streak = Math.max(stats.streak, n);
        stats.bestStreak = Math.max(stats.bestStreak, n);
      }
      store.remove("mastermind-streak");
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Crack", desc: "Crack your first code.", stat: "wins", goal: 1 },
    { id: "one", icon: "⚡", name: "One-Shot", desc: "Crack a code in a single guess.", stat: "oneShot", goal: 1 },
    { id: "easy", icon: "🟢", name: "Warm-Up", desc: "Crack a code on Easy.", stat: "easyWins", goal: 1 },
    { id: "normal", icon: "🟡", name: "Street Level", desc: "Crack a code on Normal.", stat: "normalWins", goal: 1 },
    { id: "hard", icon: "🟣", name: "Hard Mode", desc: "Crack a code on Hard.", stat: "hardWins", goal: 1 },
    {
      id: "allDiff",
      icon: "🌈",
      name: "All Rounder",
      desc: "Crack codes on Easy, Normal and Hard.",
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
    { id: "win5", icon: "🔁", name: "Serial Cracker", desc: "Crack 5 codes.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Code Master", desc: "Crack 10 codes.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Crack 2 codes in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Crack 3 codes in a row.", stat: "bestStreak", goal: 3 },
    { id: "fast5", icon: "💨", name: "Lightning", desc: "Crack 5 codes in 3 guesses or fewer.", stat: "fastWins", goal: 5 },
    { id: "guesses100", icon: "🚶", name: "Investigator", desc: "Make 100 guesses in total.", stat: "totalGuesses", goal: 100 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 codes to the end.", stat: "games", goal: 20 },
    { id: "undo10", icon: "↩️", name: "Second Thoughts", desc: "Undo 10 pegs.", stat: "undos", goal: 10 },
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
        ["Codes cracked", stats.wins],
        ["One-shot", stats.oneShot],
        ["Best streak", stats.bestStreak],
        ["Total guesses", stats.totalGuesses],
        ["Undos", stats.undos],
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
  let pegCount = 4, colorCount = 6;
  let currentDiff = "normal";
  let secret = [];
  let currentGuess = [];
  let rows = [];
  let gameOver = false;
  let paused = false;

  const colorBg = (i) => COLORS[i].bg;

  function updateHud() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    guessBtn.disabled = gameOver || paused || currentGuess.length !== pegCount;
  }

  // Standard two-pass scoring: exact matches → black pegs; for the rest,
  // each guess peg matching a remaining code peg → white peg.
  function scoreGuess(sec, guess) {
    let black = 0;
    const sLeft = [], gLeft = [];
    for (let i = 0; i < sec.length; i++) {
      if (sec[i] === guess[i]) black++;
      else { sLeft.push(sec[i]); gLeft.push(guess[i]); }
    }
    const counts = {};
    for (const c of sLeft) counts[c] = (counts[c] || 0) + 1;
    let white = 0;
    for (const c of gLeft) {
      if (counts[c] > 0) { white++; counts[c]--; }
    }
    return { black, white };
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < MAX_ROWS; r++) {
      const isCurrent = !gameOver && r === rows.length;
      const row = document.createElement("div");
      row.className = "mm-row" + (isCurrent ? " mm-row--current" : "");

      const num = document.createElement("span");
      num.className = "mm-row__num";
      num.textContent = String(r + 1).padStart(2, "0");
      row.appendChild(num);

      const pegs = document.createElement("div");
      pegs.className = "mm-pegs";
      for (let i = 0; i < pegCount; i++) {
        const peg = document.createElement("div");
        let filled = -1;
        if (r < rows.length) filled = rows[r].guess[i];
        else if (isCurrent && i < currentGuess.length) filled = currentGuess[i];
        if (filled >= 0) {
          peg.className = "mm-peg mm-peg--filled";
          peg.style.background = colorBg(filled);
          if (isCurrent) {
            peg.title = "Undo last peg";
            peg.addEventListener("click", () => { audio.unlock(); undoLastPeg(); });
          }
        } else {
          peg.className = "mm-peg mm-peg--empty";
        }
        pegs.appendChild(peg);
      }
      row.appendChild(pegs);

      // Feedback: small black/white pegs, two rows (2×2 for 4-peg games,
      // three columns × two rows for Hard's 5 pegs).
      const fb = document.createElement("div");
      fb.className = "mm-feedback";
      fb.style.gridTemplateColumns = "repeat(" + Math.ceil(pegCount / 2) + ", 13px)";
      const scored = r < rows.length ? rows[r] : null;
      for (let i = 0; i < pegCount; i++) {
        const cell = document.createElement("div");
        cell.className = "mm-fb";
        if (scored) {
          if (i < scored.black) cell.classList.add("mm-fb--black");
          else if (i < scored.black + scored.white) cell.classList.add("mm-fb--white");
        }
        fb.appendChild(cell);
      }
      row.appendChild(fb);
      boardEl.appendChild(row);
    }
    updateHud();
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    for (let i = 0; i < colorCount; i++) {
      const btn = document.createElement("button");
      btn.className = "mm-color";
      btn.style.background = colorBg(i);
      btn.title = COLORS[i].name;
      btn.setAttribute("aria-label", "Add " + COLORS[i].name);
      btn.addEventListener("click", () => { audio.unlock(); addColor(i); });
      paletteEl.appendChild(btn);
    }
  }

  // ---------- Game flow ----------
  function addColor(i) {
    if (gameOver || paused || i < 0 || i >= colorCount || currentGuess.length >= pegCount) return;
    currentGuess.push(i);
    sfx("select");
    renderBoard();
  }

  function undoLastPeg() {
    if (gameOver || paused || currentGuess.length === 0) return;
    currentGuess.pop();
    stats.undos++;
    saveStats();
    checkAchievements();
    sfx("flip");
    renderBoard();
  }

  function newGame() {
    const diff = DIFFS[diffSel.value] || DIFFS.normal;
    currentDiff = DIFFS[diffSel.value] ? diffSel.value : "normal";
    pegCount = diff.pegs;
    colorCount = diff.colors;
    secret = [];
    for (let i = 0; i < pegCount; i++) secret.push(Math.floor(Math.random() * colorCount));
    rows = [];
    currentGuess = [];
    gameOver = false;
    paused = false;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    renderPalette();
    renderBoard();
  }

  function secretNames() {
    return secret.map((c) => COLORS[c].name).join(" · ");
  }

  function onWin() {
    gameOver = true;
    paused = false;
    const n = rows.length;
    stats.games++;
    stats.wins++;
    if (n === 1) stats.oneShot++;
    if (n <= FAST_GUESSES) stats.fastWins++;
    if (currentDiff === "easy") stats.easyWins++;
    else if (currentDiff === "hard") stats.hardWins++;
    else stats.normalWins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    saveStats();
    checkAchievements();
    renderBoard();

    const oneShotMsg = n === 1 ? " A one-shot crack! ⚡" : "";
    sfx("win");
    confetti(90);
    showOverlay(
      "Code Cracked! 🎉",
      `Solved in ${n} ${n === 1 ? "guess" : "guesses"} · Streak ${stats.streak}.${oneShotMsg}`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function onLoss() {
    gameOver = true;
    paused = false;
    stats.games++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    renderBoard();

    sfx("over");
    showOverlay(
      "Out of Guesses 💀",
      `The code was: ${secretNames()}. Better luck next time!`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function doGuess() {
    if (gameOver || paused || currentGuess.length !== pegCount) return;
    const res = scoreGuess(secret, currentGuess);
    rows.push({ guess: currentGuess.slice(), black: res.black, white: res.white });
    currentGuess = [];
    stats.totalGuesses++;
    saveStats();
    checkAchievements();
    sfx("place");

    if (res.black === pegCount) {
      onWin();
      return;
    }
    if (rows.length >= MAX_ROWS) {
      onLoss();
      return;
    }
    renderBoard();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New code", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
    }
    renderBoard();
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
    guessBtn.addEventListener("click", () => { audio.unlock(); doGuess(); });
    newCodeBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    diffSel.addEventListener("change", () => { sfx("click"); newGame(); });

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
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__MASTERMIND = {
    get pegCount() { return pegCount; },
    get colorCount() { return colorCount; },
    get secret() { return secret.slice(); },
    get currentGuess() { return currentGuess.slice(); },
    get rows() { return rows.map((r) => ({ guess: r.guess.slice(), black: r.black, white: r.white })); },
    get rowsLength() { return rows.length; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get currentDiff() { return currentDiff; },
    stats,
    ACHIEVEMENTS,
    scoreGuess,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    addColor,
    undoLastPeg,
    newGame,
    setDiff: (d) => { diffSel.value = d; newGame(); },
    doGuess,
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
