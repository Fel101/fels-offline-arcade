// Cryptogram — puzzle-book substitution cipher, fully offline. Pure vanilla JS.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    util,
    audio,
    overlay,
    confetti,
    badges: badgesApi,
    modal: modalApi,
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;
  const formatTime = util.formatTime;

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const keyboardEl = dom.byId("keyboard");
  const solvesEl = dom.byId("solves");
  const timeEl = dom.byId("time");
  const bestEl = dom.byId("best");
  const sourceEl = dom.byId("source");

  const hintBtn = dom.byId("hint");
  const resetBtn = dom.byId("reset");
  const newBtn = dom.byId("new-puzzle");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants ----------
  const QUOTES = [
    { text: "A FRIEND IN NEED IS A FRIEND INDEED", source: "proverb" },
    { text: "THE EARLY BIRD CATCHES THE WORM", source: "proverb" },
    { text: "EVERY EXPERT WAS ONCE A BEGINNER", source: "proverb" },
    { text: "PRACTICE MAKES PERFECT", source: "proverb" },
    { text: "SLOW AND STEADY WINS THE RACE", source: "Aesop" },
    { text: "HONESTY IS THE BEST POLICY", source: "proverb" },
    { text: "THINK OUTSIDE THE BOX", source: "proverb" },
    { text: "IF AT FIRST YOU DO NOT SUCCEED TRY AGAIN", source: "proverb" },
    { text: "A ROLLING STONE GATHERS NO MOSS", source: "proverb" },
    { text: "ALWAYS LEAVE THEM LAUGHING", source: "proverb" },
    { text: "YOU CANT GO HOME AGAIN", source: "Thomas Wolfe" },
    { text: "FOUR SCORE AND SEVEN YEARS", source: "Lincoln" },
  ];

  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const K = makeKeys("cryptogram");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    solves: 0,
    hints: 0,
    letters: 0,
    flawless: 0,
    bestTime: 0,
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

  // The pre-core build only counted wins.
  function migrateLegacy() {
    const raw = store.get("cryptogram-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.solves) stats.solves = n;
      store.remove("cryptogram-wins");
      saveStats();
    }
  }

  // "Lower is better" time badges: goal is in seconds, the stat in ms.
  function timeBadge(id, icon, name, desc, seconds) {
    const limit = seconds * 1000;
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestTime",
      goal: seconds,
      satisfied: () => (stats.bestTime || 0) > 0 && stats.bestTime <= limit,
      progress: () => {
        const ms = stats.bestTime || 0;
        if (!ms) return { pct: 0, text: "No solve yet" };
        if (ms <= limit) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (limit / ms) * 100), text: `Best ${formatTime(ms)}` };
      },
    };
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Decode", desc: "Solve your first cryptogram.", stat: "solves", goal: 1 },
    { id: "solves5", icon: "🔓", name: "Codebreaker", desc: "Solve 5 cryptograms.", stat: "solves", goal: 5 },
    { id: "solves10", icon: "🧠", name: "Cryptanalyst", desc: "Solve 10 cryptograms.", stat: "solves", goal: 10 },
    { id: "solves25", icon: "👑", name: "Cipher Master", desc: "Solve 25 cryptograms.", stat: "solves", goal: 25 },
    { id: "games10", icon: "📜", name: "Ten Puzzles", desc: "Start 10 puzzles.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Puzzle Shelf", desc: "Start 25 puzzles.", stat: "games", goal: 25 },
    { id: "hint25", icon: "💡", name: "Nudge", desc: "Use 25 hints.", stat: "hints", goal: 25 },
    { id: "hint100", icon: "🔦", name: "Hint Addict", desc: "Use 100 hints.", stat: "hints", goal: 100 },
    timeBadge("quick300", "⏱️", "Under Five", "Solve a cryptogram in under 5:00.", 300),
    timeBadge("quick180", "⚡", "Under Three", "Solve a cryptogram in under 3:00.", 180),
    timeBadge("quick120", "🚀", "Under Two", "Solve a cryptogram in under 2:00.", 120),
    { id: "flawless1", icon: "✨", name: "Clean Solve", desc: "Solve without using a hint.", stat: "flawless", goal: 1 },
    { id: "flawless5", icon: "🧼", name: "Spotless", desc: "Solve 5 puzzles without hints.", stat: "flawless", goal: 5 },
    { id: "letters500", icon: "⌨️", name: "Typist", desc: "Type 500 letters into the grid.", stat: "letters", goal: 500 },
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
        ["Puzzles", stats.games],
        ["Solved", stats.solves],
        ["Hints", stats.hints],
        ["Best time", stats.bestTime ? formatTime(stats.bestTime) : "—"],
        ["Clean solves", stats.flawless],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!solved && !paused) setPaused(true);
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

  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("letter", [[640, 0, 0.025, "triangle", 0.02]]);
  audio.define("erase", [[300, 0, 0.05, "sine", 0.025]]);
  audio.define("hint", [[440, 0, 0.08, "sine", 0.035], [660, 0.07, 0.1, "sine", 0.035]]);

  // ---------- Game state ----------
  let quote = QUOTES[0];
  let cipher = {}; // plain -> cipher
  let plainOf = {}; // cipher -> plain
  let mapping = {}; // cipher -> typed plain
  let hinted = new Set(); // cipher letters revealed by a hint
  let selected = null;
  let cells = [];
  let solved = false;
  let paused = false;
  let lastQuoteIndex = -1;
  let hintsThisPuzzle = 0;

  // Timer: elapsedMs holds finished segments, runningSince the live one.
  let elapsedMs = 0;
  let runningSince = 0;
  let timerOn = false;
  let timerId = 0;
  let solveMs = 0;

  function clockMs() {
    return elapsedMs + (runningSince ? Date.now() - runningSince : 0);
  }

  function tickClock() {
    timeEl.textContent = Math.floor(clockMs() / 1000);
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    elapsedMs = 0;
    runningSince = Date.now();
    timerOn = true;
    tickClock();
    timerId = setInterval(tickClock, 250);
  }

  function stopTimer() {
    if (runningSince) {
      elapsedMs += Date.now() - runningSince;
      runningSince = 0;
    }
    timerOn = false;
    if (timerId) clearInterval(timerId);
    timerId = 0;
    tickClock();
  }

  function pauseTimer() {
    if (timerOn && runningSince) {
      elapsedMs += Date.now() - runningSince;
      runningSince = 0;
    }
  }

  function resumeTimer() {
    if (timerOn && !runningSince) runningSince = Date.now();
  }

  // ---------- Cipher ----------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildCipher(perm) {
    const next = {};
    const back = {};
    ALPHABET.split("").forEach((p, i) => {
      next[p] = perm[i];
      back[perm[i]] = p;
    });
    return { cipher: next, plainOf: back };
  }

  // Random substitution where no letter maps to itself. Bounded so a stubborn
  // random stream can never hang the page; falls back to a rotation.
  function makeCipher() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const perm = shuffle(ALPHABET.split(""));
      if (perm.every((ch, i) => ch !== ALPHABET[i])) return buildCipher(perm);
    }
    const perm = ALPHABET.split("").map((_, i) => ALPHABET[(i + 7) % 26]);
    return buildCipher(perm);
  }

  function quoteToCipher(plain) {
    return cipher[plain];
  }

  function uniqueCipherLetters() {
    return [...new Set(cells.map((cell) => cell.cipher))];
  }

  // ---------- Status ----------
  function updateStatus() {
    solvesEl.textContent = stats.solves;
    bestEl.textContent = stats.bestTime ? formatTime(stats.bestTime) : "—";
    tickClock();
  }

  // ---------- Board ----------
  function renderBoard() {
    boardEl.innerHTML = "";
    cells = [];
    for (const word of quote.text.split(" ")) {
      const wordEl = document.createElement("div");
      wordEl.className = "crypto-word";
      for (const plain of word) {
        const cipherLetter = quoteToCipher(plain);
        const cell = document.createElement("div");
        cell.className = "crypto-cell";
        const cipherEl = document.createElement("div");
        cipherEl.className = "crypto-cipher";
        cipherEl.textContent = cipherLetter;
        const slot = document.createElement("button");
        slot.className = "crypto-slot";
        slot.type = "button";
        slot.dataset.cipher = cipherLetter;
        slot.addEventListener("click", () => selectCipher(cipherLetter));
        cell.appendChild(cipherEl);
        cell.appendChild(slot);
        wordEl.appendChild(cell);
        cells.push({ cipher: cipherLetter, plain, slot });
      }
      boardEl.appendChild(wordEl);
    }
    refreshSlots();
  }

  function refreshSlots() {
    for (const { cipher: c, slot } of cells) {
      slot.textContent = mapping[c] || "";
      slot.classList.toggle("selected", c === selected);
      slot.classList.toggle("locked", hinted.has(c));
      slot.disabled = hinted.has(c);
      slot.setAttribute("aria-label", `Cipher ${c}${mapping[c] ? ", " + mapping[c] : ", empty"}`);
    }
  }

  function selectCipher(c) {
    if (solved || paused) return;
    selected = c;
    refreshSlots();
  }

  // ---------- Play ----------
  function typeLetter(ch) {
    if (solved || paused || !selected || hinted.has(selected)) return false;
    mapping[selected] = ch;
    stats.letters++;
    saveStats();
    refreshSlots();
    sfx("letter");
    checkAchievements();
    winCheck();
    return true;
  }

  function clearSelected() {
    if (solved || paused || !selected || hinted.has(selected)) return false;
    delete mapping[selected];
    refreshSlots();
    sfx("erase");
    return true;
  }

  function hint() {
    if (solved || paused) return false;
    const candidates = uniqueCipherLetters().filter(
      (c) => !hinted.has(c) && mapping[c] !== plainOf[c]
    );
    if (!candidates.length) {
      sfx("error");
      return false;
    }
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    mapping[c] = plainOf[c];
    hinted.add(c);
    hintsThisPuzzle++;
    stats.hints++;
    saveStats();
    refreshSlots();
    sfx("hint");
    checkAchievements();
    winCheck();
    return true;
  }

  function reset() {
    if (solved || paused) return false;
    for (const c of uniqueCipherLetters()) {
      if (!hinted.has(c)) delete mapping[c];
    }
    startTimer();
    refreshSlots();
    sfx("erase");
    return true;
  }

  // ---------- Win ----------
  function winCheck() {
    if (solved || !cells.length) return false;
    for (const { cipher: c, plain } of cells) {
      if (mapping[c] !== plain) return false;
    }
    endGame();
    return true;
  }

  function endGame() {
    if (solved) return;
    solved = true;
    paused = false;
    stopTimer();
    solveMs = clockMs();

    stats.solves++;
    if (hintsThisPuzzle === 0) stats.flawless++;
    const isRecord = !stats.bestTime || solveMs < stats.bestTime;
    if (isRecord) stats.bestTime = solveMs;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(isRecord ? 90 : 60);

    showOverlay(
      "Solved! 🎉",
      `“${quote.text}” — ${quote.source}. Solved in ${formatTime(solveMs)}.` +
        (isRecord ? " New best time!" : ""),
      [
        {
          label: "Play again",
          onClick: () => {
            hideOverlay();
            newGame();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Keyboard ----------
  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_ROWS.forEach((letters, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      if (i === 2) rowEl.appendChild(makeKey("⌫", "key key--wide", clearSelected));
      for (const ch of letters) rowEl.appendChild(makeKey(ch, "key", () => typeLetter(ch)));
      keyboardEl.appendChild(rowEl);
    });
  }

  function makeKey(label, className, onClick) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      audio.unlock();
      onClick();
    });
    return btn;
  }

  // ---------- Pause ----------
  function canPause() {
    return !solved;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      pauseTimer();
      showOverlay("Paused", "The clock is stopped — press Esc to resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      resumeTimer();
      hideOverlay();
    }
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- New puzzle ----------
  function setPuzzle(cfg) {
    const conf = cfg || {};
    const text = conf.text || QUOTES[Math.floor(Math.random() * QUOTES.length)].text;
    quote = { text, source: conf.source || "proverb" };

    if (conf.map && typeof conf.map === "object") {
      cipher = Object.assign({}, conf.map);
      plainOf = {};
      for (const plain of Object.keys(cipher)) plainOf[cipher[plain]] = plain;
    } else {
      const made = makeCipher();
      cipher = made.cipher;
      plainOf = made.plainOf;
    }

    mapping = {};
    hinted = new Set();
    selected = null;
    solved = false;
    paused = false;
    hintsThisPuzzle = 0;
    solveMs = 0;
    sourceEl.textContent = quote.source;
    hideOverlay();
    renderBoard();
    startTimer();
    updateStatus();
  }

  function newGame() {
    let idx = Math.floor(Math.random() * QUOTES.length);
    if (QUOTES.length > 1 && idx === lastQuoteIndex) idx = (idx + 1) % QUOTES.length;
    lastQuoteIndex = idx;
    stats.games++;
    saveStats();
    setPuzzle({ text: QUOTES[idx].text, source: QUOTES[idx].source });
    checkAchievements();
    updateStatus();
    return quote;
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

    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      if (e.preventDefault) e.preventDefault();
      clearSelected();
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key || "")) {
      if (e.preventDefault) e.preventDefault();
      typeLetter(e.key.toUpperCase());
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    hintBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      hint();
    });
    resetBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset();
    });
    newBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newGame();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2)
      badges2.addEventListener("click", () => {
        sfx("click");
        openAchv();
      });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    buildKeyboard();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__CRYPTOGRAM = {
    QUOTES,
    ALPHABET,
    ACHIEVEMENTS,
    stats,
    get quote() {
      return quote;
    },
    get solved() {
      return solved;
    },
    get paused() {
      return paused;
    },
    get selected() {
      return selected;
    },
    get mapping() {
      return Object.assign({}, mapping);
    },
    get hinted() {
      return Array.from(hinted);
    },
    get cells() {
      return cells.map((c) => Object.assign({}, c));
    },
    elapsed: clockMs,
    snap: () => ({
      solved,
      paused,
      selected,
      quote: { text: quote.text, source: quote.source },
      mapping: Object.assign({}, mapping),
      hinted: Array.from(hinted),
      cipher: Object.assign({}, cipher),
      plainOf: Object.assign({}, plainOf),
      cells: cells.length,
      unique: uniqueCipherLetters().length,
      elapsed: clockMs(),
      solveMs,
      hintsThisPuzzle,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    setPuzzle,
    setMapping: (obj) => {
      mapping = Object.assign({}, obj || {});
      refreshSlots();
    },
    select: selectCipher,
    type: typeLetter,
    clearSelected,
    hint,
    reset,
    newGame,
    solve: () => {
      for (const c of uniqueCipherLetters()) mapping[c] = plainOf[c];
      refreshSlots();
      return winCheck();
    },
    winCheck,
    endGame,
    setElapsed: (ms) => {
      elapsedMs = Math.max(0, Number(ms) || 0);
      if (runningSince) runningSince = Date.now();
      tickClock();
    },
    setPaused,
    togglePause,
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
