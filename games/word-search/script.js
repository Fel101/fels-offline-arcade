// Word Search — pure vanilla JS, fully offline. 12x12 grid, 6 themes.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
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

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const listEl = dom.byId("word-list");
  const themeSel = dom.byId("theme");
  const diffSel = dom.byId("difficulty");
  const foundEl = dom.byId("found");
  const timeEl = dom.byId("time");
  const winsEl = dom.byId("wins");
  const newGameBtn = dom.byId("new-game");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants ----------
  const GRID = 12;
  const THEMES = {
    Animals: ["LION", "TIGER", "ELEPHANT", "GIRAFFE", "ZEBRA", "MONKEY", "PANDA", "KOALA", "DOLPHIN", "CHEETAH", "GORILLA", "LEOPARD", "HAMSTER", "PENGUIN"],
    Space: ["COMET", "ORBIT", "GALAXY", "SATURN", "ROCKET", "PLANET", "NEBULA", "COSMOS", "MOON", "STAR", "VENUS", "PLUTO", "METEOR", "ASTEROID"],
    Ocean: ["WHALE", "SHARK", "CORAL", "REEF", "TURTLE", "OCTOPUS", "SEAL", "CRAB", "JELLYFISH", "SEAHORSE", "PELICAN", "CLAM", "LOBSTER", "OYSTER"],
    Food: ["PIZZA", "APPLE", "BANANA", "CARROT", "BREAD", "CHEESE", "COOKIE", "PASTA", "TACO", "MELON", "BERRY", "GRAPE", "MUFFIN", "WAFFLE"],
    Sports: ["SOCCER", "TENNIS", "HOCKEY", "BOXING", "RUGBY", "CRICKET", "KARATE", "JUDO", "GOLF", "BASEBALL", "SWIMMING", "RUNNING", "VOLLEYBALL", "CYCLING"],
    Dinosaurs: ["DINOSAUR", "RAPTOR", "FOSSIL", "JURASSIC", "TRICERATOPS", "STEGOSAURUS", "PTERODACTYL", "ANKYLOSAURUS", "VOLCANO", "EXTINCT", "FOOTPRINT", "SCALES", "SKULL", "BONES"],
  };
  const THEME_NAMES = Object.keys(THEMES);
  const COUNTS = { easy: 5, normal: 7, hard: 9 };

  // 8 directions: horizontal, vertical, diagonals — forwards and backwards.
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];

  const K = makeKeys("word-search");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    words: 0,
    bestTime: 0,
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
    themes: [],
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (key === "themes") continue;
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }
  if (!Array.isArray(stats.themes)) stats.themes = [];

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // The pre-core build only kept a win count.
  function migrateLegacy() {
    const raw = store.get("wordsearch-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("wordsearch-wins");
      saveStats();
    }
  }

  // "Lower is better" time badges: goal is in seconds.
  function timeBadge(id, icon, name, desc, seconds) {
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestTime",
      goal: seconds,
      satisfied: () => stats.bestTime > 0 && stats.bestTime <= seconds,
      progress: () => {
        const secs = stats.bestTime;
        if (!secs) return { pct: 0, text: "No finish yet" };
        if (secs <= seconds) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (seconds / secs) * 100), text: `Best ${secs}s` };
      },
    };
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🔍", name: "First Find", desc: "Finish your first word search.", stat: "wins", goal: 1 },
    { id: "win5", icon: "📗", name: "Puzzle Picker", desc: "Finish 5 word searches.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏅", name: "Grid Hunter", desc: "Finish 10 word searches.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Search Master", desc: "Finish 25 word searches.", stat: "wins", goal: 25 },
    { id: "words25", icon: "🔤", name: "Word Collector", desc: "Find 25 words in total.", stat: "words", goal: 25 },
    { id: "words100", icon: "📚", name: "Vocabulary", desc: "Find 100 words in total.", stat: "words", goal: 100 },
    { id: "games10", icon: "🎮", name: "Ten Grids", desc: "Start 10 puzzles.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Puzzle Shelf", desc: "Start 25 puzzles.", stat: "games", goal: 25 },
    timeBadge("quick120", "⏱️", "Under Two", "Finish a puzzle in under 2:00.", 120),
    timeBadge("quick60", "⚡", "Under a Minute", "Finish a puzzle in under 1:00.", 60),
    { id: "easyWin", icon: "🌱", name: "Warm Up", desc: "Finish an easy puzzle.", stat: "easyWins", goal: 1 },
    { id: "hardWin", icon: "🔥", name: "Deep Search", desc: "Finish a hard puzzle.", stat: "hardWins", goal: 1 },
    {
      id: "triDifficulty",
      icon: "🎚️",
      name: "All Sizes",
      desc: "Finish easy, normal and hard puzzles.",
      stat: "wins",
      goal: 0,
      satisfied: () => stats.easyWins >= 1 && stats.normalWins >= 1 && stats.hardWins >= 1,
    },
    {
      id: "allThemes",
      icon: "🗺️",
      name: "Globetrotter",
      desc: "Finish a puzzle in every theme.",
      stat: "wins",
      goal: 6,
      satisfied: () => stats.themes.length >= THEME_NAMES.length,
      progress: () => ({
        pct: Math.min(100, (stats.themes.length / THEME_NAMES.length) * 100),
        text: `${stats.themes.length} / ${THEME_NAMES.length} themes`,
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
        ["Puzzles", stats.games],
        ["Finished", stats.wins],
        ["Words found", stats.words],
        ["Best time", stats.bestTime ? `${stats.bestTime}s` : "—"],
        ["Themes", `${stats.themes.length}/${THEME_NAMES.length}`],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) setPaused(true);
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
  audio.define("select", [[520, 0, 0.03, "square", 0.018]]);
  audio.define("found", [[660, 0, 0.07, "triangle", 0.03], [880, 0.06, 0.1, "triangle", 0.03]]);

  // ---------- State ----------
  let grid;
  let cells;
  let words;
  let remaining;
  let foundCount;
  let selStart;
  let gameOver;
  let paused = false;
  let elapsed = 0;
  let timerId = 0;

  const randomLetter = () => String.fromCharCode(65 + ((Math.random() * 26) | 0));
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Grid building ----------
  function tryPlaceWord(g, word) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const [dr, dc] = DIRS[(Math.random() * DIRS.length) | 0];
      const r = (Math.random() * GRID) | 0;
      const c = (Math.random() * GRID) | 0;
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);
      if (endR < 0 || endR >= GRID || endC < 0 || endC >= GRID) continue;
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const cell = g[r + dr * i][c + dc * i];
        // Overlapping same-letter placements are allowed.
        if (cell !== "" && cell !== word[i]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) g[r + dr * i][c + dc * i] = word[i];
      return true;
    }
    // Rare when the board is crowded: sweep every direction and start cell so
    // a placeable word is never dropped.
    for (const [dr, dc] of DIRS) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const endR = r + dr * (word.length - 1);
          const endC = c + dc * (word.length - 1);
          if (endR < 0 || endR >= GRID || endC < 0 || endC >= GRID) continue;
          let fits = true;
          for (let i = 0; i < word.length; i++) {
            const cell = g[r + dr * i][c + dc * i];
            if (cell !== "" && cell !== word[i]) {
              fits = false;
              break;
            }
          }
          if (!fits) continue;
          for (let i = 0; i < word.length; i++) g[r + dr * i][c + dc * i] = word[i];
          return true;
        }
      }
    }
    return false;
  }

  function buildGrid(wordList) {
    // Place longer words first — much higher success rate.
    const ordered = [...wordList].sort((a, b) => b.length - a.length);
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = Array.from({ length: GRID }, () => Array(GRID).fill(""));
      const placed = [];
      let ok = true;
      for (const word of ordered) {
        if (tryPlaceWord(g, word)) placed.push(word);
        else {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (!g[r][c]) g[r][c] = randomLetter();
        }
      }
      return { grid: g, placed };
    }
    // Practically unreachable on a 12x12 board — fall back to whatever fit.
    const g = Array.from({ length: GRID }, () => Array(GRID).fill(""));
    const placed = [];
    for (const word of ordered) if (tryPlaceWord(g, word)) placed.push(word);
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (!g[r][c]) g[r][c] = randomLetter();
    return { grid: g, placed };
  }

  function cellAt(r, c) {
    return cells[r][c];
  }

  // ---------- Rendering ----------
  function renderBoard() {
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < GRID; r++) {
      const row = [];
      for (let c = 0; c < GRID; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell ws-cell";
        btn.textContent = grid[r][c];
        btn.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}, letter ${grid[r][c]}`);
        btn.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(btn);
        row.push(btn);
      }
      cells.push(row);
    }
  }

  function renderChips() {
    listEl.innerHTML = "";
    for (const word of [...words].sort()) {
      const chip = document.createElement("span");
      chip.className = "ws-chip";
      chip.textContent = word;
      chip.dataset.word = word;
      listEl.appendChild(chip);
    }
  }

  function strikeChip(word) {
    const chip = listEl.querySelector(`[data-word="${word}"]`);
    if (chip) chip.classList.add("ws-chip--found");
  }

  function updateStatus() {
    foundEl.textContent = `${foundCount}/${words.length}`;
    winsEl.textContent = stats.wins;
  }

  function clearSelection() {
    if (!cells) return;
    for (const row of cells) for (const btn of row) btn.classList.remove("sel");
    selStart = null;
  }

  function flashBad(line) {
    for (const { r, c } of line) cellAt(r, c).classList.add("bad");
    setTimeout(() => {
      for (const { r, c } of line) {
        const btn = cellAt(r, c);
        if (btn) btn.classList.remove("bad");
      }
    }, 600);
  }

  // ---------- Play ----------
  function onCellClick(r, c) {
    if (gameOver || paused) return false;
    if (!selStart) {
      selStart = { r, c };
      cellAt(r, c).classList.add("sel");
      sfx("select");
      return true;
    }
    const s = selStart;
    if (s.r === r && s.c === c) {
      clearSelection();
      return false;
    }

    const dr = r - s.r;
    const dc = c - s.c;
    const straight = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
    if (!straight) {
      flashBad([{ r: s.r, c: s.c }, { r, c }]);
      clearSelection();
      sfx("error");
      return false;
    }

    const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
    const stepR = Math.sign(dr);
    const stepC = Math.sign(dc);
    const line = [];
    let str = "";
    for (let i = 0; i < len; i++) {
      const rr = s.r + stepR * i;
      const cc = s.c + stepC * i;
      line.push({ r: rr, c: cc });
      if (grid[rr][cc]) str += grid[rr][cc]; // empty cells (never happens) ignored
    }
    const reversed = [...str].reverse().join("");
    const hit = remaining.find((w) => w === str || w === reversed);

    if (hit) {
      remaining = remaining.filter((w) => w !== hit);
      for (const { r: rr, c: cc } of line) {
        cellAt(rr, cc).classList.remove("sel");
        cellAt(rr, cc).classList.add("found");
      }
      foundCount++;
      stats.words++;
      saveStats();
      strikeChip(hit);
      updateStatus();
      selStart = null;
      sfx("found");
      checkAchievements();
      if (remaining.length === 0) endGame();
      return true;
    }

    flashBad(line);
    clearSelection();
    sfx("error");
    return false;
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    stopTimer();

    stats.wins++;
    const theme = themeSel.value || "Animals";
    const diff = diffSel.value || "normal";
    if (diff === "easy") stats.easyWins++;
    else if (diff === "hard") stats.hardWins++;
    else stats.normalWins++;
    if (stats.themes.indexOf(theme) === -1) stats.themes.push(theme);

    const isRecord = !stats.bestTime || elapsed < stats.bestTime;
    if (isRecord) stats.bestTime = elapsed;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(isRecord ? 90 : 60);

    showOverlay(
      "You found them all! 🎉",
      `Finished the ${theme} puzzle in ${elapsed}s.` + (isRecord ? " New best time!" : ""),
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

  // ---------- Timer ----------
  function tickTimer() {
    elapsed++;
    timeEl.textContent = String(elapsed);
  }

  function runTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tickTimer, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = 0;
  }

  // ---------- New puzzle ----------
  function loadPuzzle(built, theme, diff) {
    stopTimer();
    grid = built.grid;
    words = built.placed;
    remaining = [...words];
    foundCount = 0;
    selStart = null;
    gameOver = false;
    paused = false;
    elapsed = 0;
    hideOverlay();
    renderBoard();
    renderChips();
    updateStatus();
    timeEl.textContent = "0";
    void theme;
    void diff;
    runTimer();
  }

  function newGame() {
    const theme = themeSel.value || "Animals";
    const diff = diffSel.value || "normal";
    const count = COUNTS[diff] || COUNTS.normal;
    const picked = shuffle(THEMES[theme] || THEMES.Animals).slice(0, count);
    loadPuzzle(buildGrid(picked), theme, diff);
    stats.games++;
    saveStats();
    checkAchievements();
    updateStatus();
  }

  // ---------- Pause ----------
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      stopTimer();
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
      if (!gameOver) runTimer();
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
    if (key === "Escape" || key === "p" || key === "P") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    newGameBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newGame();
    });
    themeSel.addEventListener("change", () => {
      audio.unlock();
      sfx("click");
      newGame();
    });
    diffSel.addEventListener("change", () => {
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

    document.addEventListener("keydown", onKeyDown);
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
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  const hook = {
    GRID,
    THEMES,
    THEME_NAMES,
    COUNTS,
    DIRS,
    ACHIEVEMENTS,
    stats,
    get grid() {
      return grid.map((row) => row.slice());
    },
    get words() {
      return words.slice();
    },
    get remaining() {
      return remaining.slice();
    },
    get foundCount() {
      return foundCount;
    },
    get selStart() {
      return selStart ? { r: selStart.r, c: selStart.c } : null;
    },
    get gameOver() {
      return gameOver;
    },
    get paused() {
      return paused;
    },
    get elapsed() {
      return elapsed;
    },
    get theme() {
      return themeSel.value;
    },
    get difficulty() {
      return diffSel.value;
    },
    cell: (r, c) => (grid[r] ? grid[r][c] : undefined),
    click: onCellClick,
    selectLine: (r1, c1, r2, c2) => {
      onCellClick(r1, c1);
      return onCellClick(r2, c2);
    },
    locate: (word) => {
      const target = String(word).toUpperCase();
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (grid[r][c] !== target[0]) continue;
          for (const [dr, dc] of DIRS) {
            const endR = r + dr * (target.length - 1);
            const endC = c + dc * (target.length - 1);
            if (endR < 0 || endR >= GRID || endC < 0 || endC >= GRID) continue;
            let ok = true;
            for (let i = 0; i < target.length; i++) {
              if (grid[r + dr * i][c + dc * i] !== target[i]) {
                ok = false;
                break;
              }
            }
            if (ok) return { r, c, endR, endC };
          }
        }
      }
      return null;
    },
    solve: () => {
      for (const word of [...remaining]) {
        const loc = hook.locate(word);
        if (!loc) continue;
        hook.selectLine(loc.r, loc.c, loc.endR, loc.endC);
      }
      return gameOver;
    },
    setPuzzle: (cfg) => {
      const conf = cfg || {};
      const g = conf.grid || grid;
      const list = conf.words || words;
      loadPuzzle({ grid: g.map((row) => row.slice()), placed: list.slice() }, themeSel.value, diffSel.value);
    },
    setElapsed: (secs) => {
      elapsed = Math.max(0, Math.floor(Number(secs) || 0));
      timeEl.textContent = String(elapsed);
    },
    newGame,
    buildGrid,
    tryPlaceWord,
    endGame,
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
  window.__WORDSEARCH = hook;

  init();
})();
