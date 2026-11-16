// 2048 — merge tiles to reach 2048. Pure vanilla JS, fully offline.
// Modes: Classic, Sprint (beat the clock to 2048), Daily (seeded), Zen (undo).
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
  const scoreEl = dom.byId("score");
  const bestEl = dom.byId("best");
  const topEl = dom.byId("top");
  const movesEl = dom.byId("moves");
  const timeEl = dom.byId("time");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const newGameBtn = dom.byId("new-game");
  const undoBtn = dom.byId("undo");
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
  const MODES = {
    classic: { name: "Classic", timed: false },
    sprint: { name: "Sprint", timed: true, sprintTarget: 2048 },
    daily: { name: "Daily", timed: false },
    zen: { name: "Zen", timed: false },
  };

  // size = board dimension, spawns = tiles added per move, fourChance = P(4)
  const DIFFS = {
    easy: { name: "Easy", size: 4, spawns: 1, fourChance: 0.1 },
    normal: { name: "Normal", size: 5, spawns: 1, fourChance: 0.1 },
    hard: { name: "Hard", size: 5, spawns: 2, fourChance: 0.1 },
  };

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Merge", desc: "Make your first merge.", stat: "merges", goal: 1 },
    { id: "tile128", icon: "🟧", name: "128 Club", desc: "Build a 128 tile.", stat: "topTile", goal: 128 },
    { id: "tile256", icon: "🟨", name: "256 Club", desc: "Build a 256 tile.", stat: "topTile", goal: 256 },
    { id: "tile512", icon: "🌟", name: "512 Club", desc: "Build a 512 tile.", stat: "topTile", goal: 512 },
    { id: "win", icon: "🏆", name: "2048!", desc: "Reach the 2048 tile.", stat: "wins", goal: 1 },
    { id: "win10", icon: "👑", name: "Ten Wins", desc: "Reach 2048 ten times.", stat: "wins", goal: 10 },
    { id: "tile4096", icon: "💎", name: "Beyond", desc: "Build a 4096 tile.", stat: "topTile", goal: 4096 },
    { id: "score5000", icon: "🚀", name: "High Scorer", desc: "Score 5,000 in one game.", stat: "bestScore", goal: 5000 },
    { id: "score20000", icon: "🌌", name: "Legend", desc: "Score 20,000 in one game.", stat: "bestScore", goal: 20000 },
    { id: "moves100", icon: "💯", name: "Century", desc: "Make 100 moves in one game.", stat: "maxMoves", goal: 100 },
    { id: "moves300", icon: "🧮", name: "Marathon", desc: "Make 300 moves in one game.", stat: "maxMoves", goal: 300 },
    { id: "sprint", icon: "⚡", name: "Speedrun", desc: "Reach 2048 in Sprint under 3 minutes.", stat: "sprintFast", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Finish the Daily board.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen", icon: "🌿", name: "Zen Master", desc: "Reach 1024 in Zen.", stat: "zenTop", goal: 1024 },
    { id: "undo", icon: "↩️", name: "Second Chance", desc: "Use undo.", stat: "undos", goal: 1 },
    { id: "undo25", icon: "🔁", name: "Undo Habit", desc: "Use undo 25 times.", stat: "undos", goal: 25 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Reach 512 between midnight and 5 AM.", stat: "nightTop", goal: 512 },
    { id: "games", icon: "🎮", name: "Regular", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "efficient", icon: "🧠", name: "Efficient", desc: "Reach 512 in 80 moves or fewer.", stat: "efficient", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Mode", desc: "Reach 1024 on Hard.", stat: "hardTop", goal: 1024 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Reach 256 after 30 undos.", stat: "comeback", goal: 1 },
    { id: "totalMerges", icon: "🔢", name: "Merge Machine", desc: "Make 2,000 merges in total.", stat: "merges", goal: 2000 },
  ];

  const DEFAULT_STATS = {
    games: 0,
    merges: 0,
    wins: 0,
    bestScore: 0,
    topTile: 0,
    maxMoves: 0,
    sprintFast: 0,
    dailySolves: 0,
    zenTop: 0,
    undos: 0,
    nightTop: 0,
    efficient: 0,
    hardTop: 0,
    comeback: 0,
    playTime: 0,
  };

  const K = makeKeys("2048");

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
    diff: "easy",
    size: 4,
    grid: [],
    score: 0,
    moves: 0,
    merges: 0,
    topTile: 2,
    history: [],
    elapsed: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    won: false,
    keptPlaying: false,
  };

  let cellEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let roundRand = Math.random;

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
        ["Best", stats.bestScore],
        ["Top tile", stats.topTile || "—"],
        ["Wins", stats.wins],
        ["Games", stats.games],
        ["Daily streak", daily.streak + "d"],
      ],
    });
  }

  const achvModalCtl = createModal(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!state.over && !state.paused && state.started) {
        state.paused = true;
        resumeAfterModal = true;
        pauseBtn.textContent = "▶ Resume";
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!state.over) {
          state.paused = false;
          pauseBtn.textContent = "Pause";
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

  // ---------- Board mechanics ----------
  function orders() {
    const n = state.size;
    const o = { left: [], right: [], up: [], down: [] };
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push([r, c]);
      o.left.push(row);
      o.right.push(row.slice().reverse());
    }
    for (let c = 0; c < n; c++) {
      const col = [];
      for (let r = 0; r < n; r++) col.push([r, c]);
      o.up.push(col);
      o.down.push(col.slice().reverse());
    }
    return o;
  }

  function emptyCells() {
    const out = [];
    for (let r = 0; r < state.size; r++)
      for (let c = 0; c < state.size; c++) if (!state.grid[r][c]) out.push([r, c]);
    return out;
  }

  function addRandom() {
    const empty = emptyCells();
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(roundRand() * empty.length)];
    const fourChance = DIFFS[state.diff].fourChance;
    state.grid[r][c] = roundRand() < fourChance ? 4 : 2;
  }

  /** Compress+merge one line. Returns { line, gained, merged }. */
  function collapse(line) {
    const vals = line.filter((v) => v);
    let gained = 0;
    let merged = 0;
    for (let i = 0; i < vals.length - 1; i++) {
      if (vals[i] === vals[i + 1]) {
        vals[i] *= 2;
        gained += vals[i];
        merged++;
        vals.splice(i + 1, 1);
      }
    }
    while (vals.length < line.length) vals.push(0);
    return { line: vals, gained, merged };
  }

  function snapshot() {
    return {
      grid: state.grid.map((row) => row.slice()),
      score: state.score,
      moves: state.moves,
      merges: state.merges,
      topTile: state.topTile,
      won: state.won,
      keptPlaying: state.keptPlaying,
    };
  }

  function restore(snap) {
    state.grid = snap.grid.map((row) => row.slice());
    state.score = snap.score;
    state.moves = snap.moves;
    state.merges = snap.merges;
    state.topTile = snap.topTile;
    state.won = snap.won;
    state.keptPlaying = snap.keptPlaying;
    render();
    updateHUD();
  }

  function canMove() {
    const n = state.size;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = state.grid[r][c];
        if (!v) return true;
        if (c < n - 1 && state.grid[r][c + 1] === v) return true;
        if (r < n - 1 && state.grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  function move(dir) {
    if (!canEdit()) return;
    const before = state.grid.map((row) => row.slice());
    const ord = orders()[dir];
    let gained = 0;
    let merged = 0;

    for (const line of ord) {
      const vals = line.map(([r, c]) => state.grid[r][c]);
      const res = collapse(vals);
      gained += res.gained;
      merged += res.merged;
      line.forEach(([r, c], i) => {
        state.grid[r][c] = res.line[i];
      });
    }

    const changed = JSON.stringify(before) !== JSON.stringify(state.grid);
    if (!changed) {
      // A nudge tells the player the move was a no-op.
      boardWrap.classList.remove("is-bump");
      void boardWrap.offsetWidth;
      boardWrap.classList.add("is-bump");
      return;
    }

    // Snapshot the position BEFORE this move so undo actually rewinds.
    // Zen keeps unlimited history; other modes keep the last 20.
    state.history.push({
      grid: before,
      score: state.score,
      moves: state.moves,
      merges: state.merges,
      topTile: state.topTile,
      won: state.won,
      keptPlaying: state.keptPlaying,
    });
    if (state.mode !== "zen" && state.history.length > 20) state.history.shift();

    state.moves++;
    state.score += gained;
    state.merges += merged;

    const spawns = DIFFS[state.diff].spawns;
    for (let i = 0; i < spawns; i++) addRandom();

    state.topTile = highestTile();
    stats.merges += merged;
    if (state.moves > stats.maxMoves) stats.maxMoves = state.moves;
    if (state.score > stats.bestScore) stats.bestScore = state.score;

    sfx(merged > 0 ? "place" : "pop");
    render();
    updateHUD();
    checkAchievements();
    saveStats();

    if (merged > 0) {
      dom.announce(liveEl, `Merged. Score ${state.score}. Highest tile ${state.topTile}.`);
    }

    if (!state.won && state.topTile >= 2048) {
      state.won = true;
      stats.wins++;
      if (state.diff === "hard" && state.topTile >= 2048) {
        stats.hardTop = Math.max(stats.hardTop, state.topTile);
      }
      if (state.mode === "sprint" && state.elapsed <= 180000) stats.sprintFast = 1;
      if (state.diff === "easy" && state.moves <= 80 && state.topTile >= 512) stats.efficient = 1;
      if (state.undos >= 30 && state.topTile >= 256) stats.comeback = 1;
      saveStats();
      checkAchievements();
      sfx("win");
      confetti(110);
      showOverlay("You win! 🎉", `2048 in ${state.moves} moves · ${formatTime(state.elapsed)} · Score ${state.score}`, [
        { label: "Keep Going", onClick: () => { hideOverlay(); state.keptPlaying = true; } },
        { label: "New Game", ghost: true, onClick: () => { hideOverlay(); resetGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
      return;
    }

    if (!canMove()) {
      endGame("blocked");
    }
  }

  function highestTile() {
    let top = 0;
    for (const row of state.grid) for (const v of row) if (v > top) top = v;
    return top;
  }

  function undo() {
    if (!canEdit()) return;
    if (!state.history.length) {
      showToast("Nothing to undo", "Make a move first.", "↩️");
      sfx("error");
      return;
    }
    const prev = state.history.pop();
    stats.undos++;
    saveStats();
    checkAchievements();
    restore(prev);
    sfx("click");
    dom.announce(liveEl, "Move undone.");
  }

  // ---------- Rendering ----------
  function buildBoard() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    const n = state.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.dataset.size = String(n);
    cellEls = [];

    for (let i = 0; i < n * n; i++) {
      const cell = document.createElement("div");
      cell.className = "g2048-cell";
      cell.dataset.idx = String(i);
      cell.innerHTML = `<span class="g2048-cell__val"></span>`;
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function render() {
    for (let i = 0; i < cellEls.length; i++) {
      const v = state.grid[Math.floor(i / state.size)][i % state.size];
      const cell = cellEls[i];
      const valEl = cell.querySelector(".g2048-cell__val");
      if (valEl) valEl.textContent = v ? String(v) : "";
      cell.dataset.value = v ? String(v) : "";
      cell.className = "g2048-cell" + (v ? " is-filled" : "");
      if (v) {
        // Pick a colour tier from the exponent.
        const exp = Math.min(11, Math.round(Math.log2(v)));
        cell.dataset.exp = String(exp);
      } else {
        delete cell.dataset.exp;
      }
    }
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    topEl.textContent = state.topTile ? String(state.topTile) : "—";
    movesEl.textContent = String(state.moves);
    bestEl.textContent = bestLabel();
    undoBtn.disabled = state.history.length === 0 || state.over;
  }

  function updateTimeDisplay() {
    const text = state.mode === "sprint"
      ? formatTime(state.elapsed)
      : formatTime(state.elapsed);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    timeEl.classList.toggle(
      "is-danger",
      state.mode === "sprint" && state.elapsed > 180000 && state.started && !state.over
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
    const d = DIFFS[state.diff];
    const m = MODES[state.mode];
    let text;
    if (state.mode === "sprint") text = `Sprint · ${d.size}×${d.size} · beat the clock to 2048`;
    else if (state.mode === "daily") text = `Daily · ${d.size}×${d.size} · streak ${daily.streak}d`;
    else if (state.mode === "zen") text = `Zen · ${d.size}×${d.size} · unlimited undo`;
    else text = `Classic · ${d.size}×${d.size} · no clock`;
    hintEl.textContent =
      text +
      " · Arrow keys / WASD or swipe · Merge matching tiles to reach 2048 · Z undoes";
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    newGameBtn.disabled = state.mode === "daily";
    updateHint();
    updateHUD();
    updateTimeDisplay();
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.s) return "—";
    return String(rec.s);
  }

  // ---------- Game flow ----------
  function resetGame() {
    hideOverlay();
    const d = DIFFS[state.diff];
    state.size = d.size;
    state.grid = Array.from({ length: d.size }, () => new Array(d.size).fill(0));
    state.score = 0;
    state.moves = 0;
    state.merges = 0;
    state.topTile = 2;
    state.history = [];
    state.elapsed = 0;
    state.countdown = 1200;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.won = false;
    state.keptPlaying = false;

    roundRand = state.mode === "daily"
      ? mulberry32(hashSeed(`${util.dateStr()}-${state.diff}`))
      : Math.random;

    const spawns = DIFFS[state.diff].spawns;
    for (let i = 0; i < 2; i++) {
      addRandom();
      if (spawns > 1 && i === 0) addRandom();
    }

    stats.games++;
    stats.topTile = Math.max(stats.topTile, state.topTile);
    saveStats();

    lastTimeText = "";
    pauseBtn.textContent = "Pause";
    buildBoard();
    render();
    updateModeUI();
    updateCountdown();
    updateHUD();

    boardWrap.classList.remove("is-shaking");
    void boardWrap.offsetWidth;
    boardWrap.classList.add("is-shaking");
    window.setTimeout(() => boardWrap.classList.remove("is-shaking"), 460);

    lastTs = performance.now();
  }

  function setMode(m) {
    if (!MODES[m] || m === state.mode) return;
    state.mode = m;
    store.set(K.mode, m);
    resetGame();
  }

  function setDiff(d) {
    if (!DIFFS[d] || d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    resetGame();
  }

  function endGame(reason) {
    if (state.over) return;
    state.over = true;
    state.paused = false;
    stats.playTime += Math.round(state.elapsed);
    stats.topTile = Math.max(stats.topTile, state.topTile);
    stats.bestScore = Math.max(stats.bestScore, state.score);

    if (state.mode === "daily") recordDailyWin();
    if (state.topTile >= 512 && new Date().getHours() < 5) {
      stats.nightTop = Math.max(stats.nightTop, state.topTile);
    }
    if (state.topTile >= 1024 && state.diff === "hard") {
      stats.hardTop = Math.max(stats.hardTop, state.topTile);
    }
    if (state.mode === "zen") stats.zenTop = Math.max(stats.zenTop, state.topTile);

    saveStats();
    checkAchievements();

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevScore = prev && Number.isFinite(prev.s) ? prev.s : 0;
    const isRecord = state.score > prevScore || !prev;
    if (isRecord) store.jsonSet(K.best(state.mode, state.diff), { s: state.score, t: state.topTile });

    sfx("over");
    render();
    updateHUD();

    const title = state.won ? "You win! 🎉" : "Game Over";
    const msg =
      `${DIFFS[state.diff].size}×${DIFFS[state.diff].size} · Score ${state.score} · ` +
      `Top tile ${state.topTile} · ${state.moves} moves · ${formatTime(state.elapsed)}` +
      (isRecord ? " · New Best!" : "");

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); resetGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function recordDailyWin() {
    if (state.mode !== "daily") return;
    const today = util.dateStr();
    if (daily.lastDate === today) return;
    daily.streak = daily.lastDate === util.yesterdayStr() ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { s: state.score, t: state.topTile, d: state.diff };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
    saveStats();
  }

  function canEdit() {
    return state.started && !state.paused && !state.over && achvModal.hidden;
  }

  function focusModeBar() {
    const chip = document.querySelector(".mode-chip");
    if (chip) chip.focus();
  }

  function setPaused(p, silent) {
    if (state.over || !state.started) return;
    state.paused = p;
    pauseBtn.textContent = p ? "▶ Resume" : "Pause";
    if (p && !silent) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); resetGame(); } },
      ]);
    } else if (!p) {
      hideOverlay();
    }
  }

  function togglePause() {
    if (state.over || !state.started) return;
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

    if (!state.started && !state.over && !state.paused && achvModal.hidden) {
      if (state.countdown > 0) {
        state.countdown = Math.max(0, state.countdown - dt);
        if (state.countdown === 0) {
          state.started = true;
          sfx("click");
          updateHUD();
        }
        updateCountdown();
      }
    }

    if (state.started && !state.over && !state.paused && achvModal.hidden) {
      state.elapsed += dt;
      // Sprint counts UP as your score — the faster you finish, the better.
      if (state.mode === "sprint" && state.topTile >= 2048) {
        // handled on the winning move
      }
    }

    updateTimeDisplay();
  }

  // ---------- Input ----------
  const KEYMAP = {
    arrowleft: "left", keya: "left",
    arrowright: "right", keyd: "right",
    arrowup: "up", keyw: "up",
    arrowdown: "down", keys: "down",
  };

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

    if (state.over) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        resetGame();
      }
      return;
    }

    if (state.paused) return;

    if (lower === "z") {
      e.preventDefault();
      undo();
      return;
    }

    const dir = KEYMAP[lower];
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  }

  function bindSwipe() {
    let sx = 0;
    let sy = 0;
    let active = false;

    const start = (x, y) => {
      sx = x;
      sy = y;
      active = true;
    };
    const end = (x, y) => {
      if (!active) return;
      active = false;
      const dx = x - sx;
      const dy = y - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
      else move(dy > 0 ? "down" : "up");
    };

    boardEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches && e.touches[0]) start(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: true }
    );
    boardEl.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          end(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
      },
      { passive: true }
    );

    // Pointer drag for mouse users.
    boardEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      start(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return;
      end(e.clientX, e.clientY);
    });
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
      if (state.mode !== "daily") resetGame();
    });
    undoBtn.addEventListener("click", () => {
      sfx("click");
      undo();
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
    bindSwipe();

    window.addEventListener("blur", () => {
      if (!state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    const savedDiff = store.get(K.diff, "easy");
    state.diff = DIFFS[savedDiff] ? savedDiff : "easy";
    state.size = DIFFS[state.diff].size;

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    updateBadgeCount();
    bindEvents();
    resetGame();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__G2048 = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    collapse,
    orders,
    emptyCells,
    addRandom,
    canMove,
    move,
    undo,
    highestTile,
    resetGame,
    setMode,
    setDiff,
    endGame,
    checkAchievements,
    saveStats,
    loop,
    setPaused,
    togglePause,
    unlocked: () => achv.list(),
    snap: () => ({
      mode: state.mode,
      diff: state.diff,
      size: state.size,
      grid: state.grid.map((r) => r.slice()),
      score: state.score,
      moves: state.moves,
      merges: state.merges,
      topTile: state.topTile,
      historyLen: state.history.length,
      elapsed: state.elapsed,
      started: state.started,
      paused: state.paused,
      over: state.over,
      won: state.won,
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