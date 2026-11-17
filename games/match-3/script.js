// Match 3 — swap gems, match three or more, chain cascades.
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
  const scoreEl = dom.byId("score");
  const targetEl = dom.byId("target");
  const movesEl = dom.byId("moves");
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
  const SIZE = 8;
  const TYPES = 6;
  const START_MOVES = 30;
  const TARGET = 2500;
  const GLYPHS = ["●", "◆", "▲", "★", "■", "⬢"];
  const GEM_NAMES = ["red", "blue", "green", "yellow", "purple", "cyan"];
  const HINT_DEFAULT =
    "Click a gem, then an adjacent gem to swap. Match 3 or more in a row to clear them. Reach 2,500 points in 30 moves. P pauses.";

  const K = makeKeys("match-3");

  // ---------- Seeded RNG (deterministic for tests, varied in play) ----------
  let rngState = 0x2f6e2b1;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function randType() {
    return Math.floor(rand() * TYPES);
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    bestScore: 0,
    totalCleared: 0,
    bestCascade: 0,
    fives: 0,
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
    { id: "first", icon: "🎯", name: "First Win", desc: "Reach the target score.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Reach the target 5 times.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Reach the target 10 times.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Reach the target 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Reach the target 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Reach the target 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "score2k", icon: "2️⃣", name: "High Scorer", desc: "Score 2,000 in a single game.", stat: "bestScore", goal: 2000 },
    { id: "score5k", icon: "💰", name: "Jackpot", desc: "Score 5,000 in a single game.", stat: "bestScore", goal: 5000 },
    { id: "clear500", icon: "💎", name: "Gem Cutter", desc: "Clear 500 gems in total.", stat: "totalCleared", goal: 500 },
    { id: "cascade4", icon: "🌊", name: "Chain Reaction", desc: "Trigger a 4× cascade.", stat: "bestCascade", goal: 4 },
    { id: "fives1", icon: "🌈", name: "Five Alive", desc: "Make a match of five or more.", stat: "fives", goal: 1 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Run out of moves 10 times — keep trying!", stat: "losses", goal: 10 },
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
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Best score", stats.bestScore],
        ["Gems cleared", stats.totalCleared],
        ["Best cascade", stats.bestCascade + "×"],
        ["Best streak", stats.bestStreak],
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
  audio.define("swap", [[520, 0, 0.04, "triangle", 0.035]]);
  audio.define("match", [[660, 0, 0.05, "triangle", 0.045], [880, 0.05, 0.07, "triangle", 0.045]]);
  audio.define("bad", [[180, 0, 0.08, "square", 0.04]]);

  // ---------- State ----------
  let grid;
  let score;
  let moves;
  let selected; // {r,c} | null
  let gameOver;
  let paused;
  let animTimer = null; // pending animation step (browser only)
  let animToken = 0; // invalidates in-flight animation steps

  // ---------- Grid helpers ----------
  function newGrid() {
    return Array.from({ length: SIZE }, () => new Array(SIZE).fill(-1));
  }

  function swapCells(g, r1, c1, r2, c2) {
    const t = g[r1][c1];
    g[r1][c1] = g[r2][c2];
    g[r2][c2] = t;
  }

  /**
   * Find all matched cells. Returns { matched, fives }.
   * `matched` is a SIZE×SIZE boolean grid; `fives` counts runs of 5+.
   */
  function findMatches(g) {
    const matched = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    let fives = 0;

    for (let r = 0; r < SIZE; r++) {
      let c = 0;
      while (c < SIZE) {
        const t = g[r][c];
        let end = c + 1;
        while (end < SIZE && g[r][end] === t) end++;
        if (t !== -1 && end - c >= 3) {
          for (let k = c; k < end; k++) matched[r][k] = true;
          if (end - c >= 5) fives++;
        }
        c = end;
      }
    }

    for (let c = 0; c < SIZE; c++) {
      let r = 0;
      while (r < SIZE) {
        const t = g[r][c];
        let end = r + 1;
        while (end < SIZE && g[end][c] === t) end++;
        if (t !== -1 && end - r >= 3) {
          for (let k = r; k < end; k++) matched[k][c] = true;
          if (end - r >= 5) fives++;
        }
        r = end;
      }
    }

    return { matched, fives };
  }

  function anyMatched(matched) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (matched[r][c]) return true;
    return false;
  }

  function hasPossibleMove(g) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (c + 1 < SIZE) {
          swapCells(g, r, c, r, c + 1);
          const m = findMatches(g).matched;
          swapCells(g, r, c, r, c + 1);
          if (anyMatched(m)) return true;
        }
        if (r + 1 < SIZE) {
          swapCells(g, r, c, r + 1, c);
          const m = findMatches(g).matched;
          swapCells(g, r, c, r + 1, c);
          if (anyMatched(m)) return true;
        }
      }
    }
    return false;
  }

  function generateGrid() {
    let last = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const g = newGrid();
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          let t;
          let guard = 0;
          do {
            t = randType();
            guard++;
          } while (
            guard < 30 &&
            ((c >= 2 && g[r][c - 1] === t && g[r][c - 2] === t) ||
              (r >= 2 && g[r - 1][c] === t && g[r - 2][c] === t))
          );
          g[r][c] = t;
        }
      }
      last = g;
      if (hasPossibleMove(g)) return g;
    }
    return last || newGrid();
  }

  function collapse(g) {
    for (let c = 0; c < SIZE; c++) {
      const col = [];
      for (let r = SIZE - 1; r >= 0; r--) if (g[r][c] !== -1) col.push(g[r][c]);
      for (let r = SIZE - 1; r >= 0; r--) {
        const idx = SIZE - 1 - r;
        g[r][c] = idx < col.length ? col[idx] : randType();
      }
    }
  }

  // Same result and RNG order as collapse(), but also reports how many rows each
  // gem fell (new gems report a full column drop) so the UI can animate gravity.
  function collapseWithFall(g) {
    const fall = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
    for (let c = 0; c < SIZE; c++) {
      const survivors = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        if (g[r][c] !== -1) survivors.push({ t: g[r][c], old: r });
      }
      const fresh = SIZE - survivors.length;
      for (let i = 0; i < survivors.length; i++) {
        const nr = SIZE - 1 - i;
        g[nr][c] = survivors[i].t;
        fall[nr][c] = nr - survivors[i].old;
      }
      // Keep the original descending RNG call order.
      for (let r = fresh - 1; r >= 0; r--) {
        g[r][c] = randType();
        fall[r][c] = fresh;
      }
    }
    return fall;
  }

  function cloneGrid(g) {
    return g.map((row) => row.slice());
  }

  /**
   * Resolve all matches and cascades in place.
   * Returns { cleared, cascades, points, fives }.
   * When `trace` is an array, records { kind, grid, matched|fall } frames so the
   * UI can replay the clears and gravity drops.
   */
  function resolve(g, trace) {
    let cleared = 0;
    let cascades = 0;
    let points = 0;
    let fives = 0;
    let guard = 0;

    while (guard++ < 60) {
      const { matched, fives: f } = findMatches(g);
      if (!anyMatched(matched)) break;

      cascades++;
      fives += f;

      if (trace) {
        trace.push({ kind: "clear", grid: cloneGrid(g), matched: matched.map((row) => row.slice()) });
      }

      let count = 0;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (matched[r][c]) {
            count++;
            g[r][c] = -1;
          }
        }
      }

      cleared += count;
      points += count * 10 * cascades;
      const fall = collapseWithFall(g);
      if (trace) {
        trace.push({ kind: "fall", grid: cloneGrid(g), fall });
      }
    }

    return { cleared, cascades, points, fives };
  }

  // ---------- Flow ----------
  function newGame() {
    cancelAnim();
    grid = generateGrid();
    score = 0;
    moves = START_MOVES;
    selected = null;
    gameOver = false;
    paused = false;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function updateHud() {
    scoreEl.textContent = score;
    targetEl.textContent = TARGET;
    movesEl.textContent = moves;
  }

  // Build a CSS calc() offset for the swap slide (one cell + the grid gap).
  function offsetCss(d) {
    if (!d) return "0";
    const pct = d * 100;
    const px = Math.abs(d * 4);
    return `calc(${pct}% ${d < 0 ? "-" : "+"} ${px}px)`;
  }

  function render(opts) {
    opts = opts || {};
    const g = opts.grid || grid;
    const swap = opts.swap || null;
    const bad = opts.bad || null;
    const clearing = opts.clearing || null;
    const fall = opts.fall || null;
    const locked = !!opts.locked;
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        const t = g[r][c];
        let cls = "gem";
        if (t >= 0) cls += " gem--" + t;
        if (selected && selected.r === r && selected.c === c) cls += " gem--sel";
        if (bad && bad.some((b) => b[0] === r && b[1] === c)) cls += " gem--bad";
        if (clearing && clearing[r][c]) cls += " gem--clear";

        // If this gem just slid in from a neighbour, offset its start position.
        let moving = false;
        let mdx = 0;
        let mdy = 0;
        if (swap) {
          if (r === swap.r1 && c === swap.c1) {
            mdx = swap.c2 - swap.c1;
            mdy = swap.r2 - swap.r1;
            moving = true;
          } else if (r === swap.r2 && c === swap.c2) {
            mdx = swap.c1 - swap.c2;
            mdy = swap.r1 - swap.r2;
            moving = true;
          }
        }
        if (moving) cls += " gem--swap";

        // How far this gem fell during the last collapse (rows).
        let drop = 0;
        if (fall && t >= 0) drop = fall[r][c] || 0;
        if (drop > 0) cls += " gem--fall";

        btn.className = cls;
        btn.disabled = locked || gameOver || paused;
        btn.setAttribute("data-r", String(r));
        btn.setAttribute("data-c", String(c));
        btn.setAttribute(
          "aria-label",
          t >= 0 ? `${GEM_NAMES[t]} gem, row ${r + 1}, column ${c + 1}` : "Empty"
        );

        if (t >= 0) {
          const shape = document.createElement("span");
          shape.className = "gem__shape";
          shape.setAttribute("aria-hidden", "true");
          btn.appendChild(shape);
        }
        if (moving) {
          btn.style.setProperty("--sx", offsetCss(mdx));
          btn.style.setProperty("--sy", offsetCss(mdy));
        }
        if (drop > 0) {
          // 1 row ≈ 134% of a gem's own height (82% of the cell + the grid gap).
          btn.style.setProperty("--fall", `${-drop * 134}%`);
        }

        boardEl.appendChild(btn);
      }
    }
    updateHud();
  }

  function adjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  // ---------- Animation playback ----------
  // Resolution is synchronous (tests rely on it); the trace is a cosmetic replay.
  // window.setTimeout is used so the Node harness's stub never fires it.
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function cancelAnim() {
    animToken++;
    if (animTimer !== null) {
      window.clearTimeout(animTimer);
      animTimer = null;
    }
  }

  function later(fn, ms) {
    const token = animToken;
    animTimer = window.setTimeout(() => {
      animTimer = null;
      if (token === animToken) fn();
    }, ms);
  }

  // Play: swap slide -> for each cascade (clear -> fall) -> settle on final board.
  function startTrace(trace, swapInfo, swapGrid) {
    cancelAnim();
    const token = animToken;
    let i = 0;

    // Frame 0: the swapped board, with the two gems sliding in.
    render({ grid: swapGrid, swap: swapInfo, locked: true });
    later(step, 240);

    function step() {
      if (token !== animToken) return;
      if (i >= trace.length) {
        render(); // settle on the real, final board
        return;
      }
      const f = trace[i++];
      if (f.kind === "clear") {
        render({ grid: f.grid, clearing: f.matched, locked: true });
        later(step, 260);
      } else {
        render({ grid: f.grid, fall: f.fall, locked: true });
        later(step, 360);
      }
    }
  }

  function trySwap(r1, c1, r2, c2) {
    if (gameOver || paused) return false;
    if (!adjacent(r1, c1, r2, c2)) return false;

    swapCells(grid, r1, c1, r2, c2);
    const swapGrid = cloneGrid(grid);
    const trace = [];
    const res = resolve(grid, trace);

    if (res.cleared === 0) {
      swapCells(grid, r1, c1, r2, c2); // revert the invalid swap
      sfx("bad");
      render({ bad: [[r1, c1], [r2, c2]] });
      return false;
    }

    moves--;
    score += res.points;
    stats.totalCleared += res.cleared;
    stats.bestCascade = Math.max(stats.bestCascade, res.cascades);
    stats.fives += res.fives;
    stats.bestScore = Math.max(stats.bestScore, score);
    saveStats();
    checkAchievements();

    sfx(res.cascades > 1 ? "match" : "swap");
    if (res.cascades > 1) confetti(Math.min(60, 15 * res.cascades));

    selected = null;

    // Keep the board playable if it has no moves left.
    let reshuffled = false;
    if (!hasPossibleMove(grid)) {
      grid = generateGrid();
      reshuffled = true;
      toast.show("No moves", "The board was reshuffled.", "🔀");
    }

    if (reshuffled) {
      render();
      checkEnd();
      return true;
    }

    // Evaluate the end state first: a win/loss overlay should not fight the replay.
    checkEnd();
    if (gameOver) return true;

    if (trace.length && !prefersReducedMotion()) {
      startTrace(trace, { r1, c1, r2, c2 }, swapGrid);
      return true;
    }

    // No animation (reduced motion): show the swap slide on the final board.
    render({ swap: { r1, c1, r2, c2 } });
    return true;
  }

  function selectCell(r, c) {
    if (gameOver || paused) return;
    cancelAnim();
    if (!selected) {
      selected = { r, c };
      sfx("click");
      render();
      return;
    }
    if (selected.r === r && selected.c === c) {
      selected = null;
      render();
      return;
    }
    if (adjacent(selected.r, selected.c, r, c)) {
      const from = selected;
      selected = null;
      trySwap(from.r, from.c, r, c);
      return;
    }
    selected = { r, c };
    sfx("click");
    render();
  }

  function checkEnd() {
    if (gameOver) return;
    if (score >= TARGET) return endGame(true);
    if (moves <= 0) return endGame(false);
  }

  function endGame(won) {
    cancelAnim();
    gameOver = true;
    paused = false;
    stats.games++;
    stats.bestScore = Math.max(stats.bestScore, score);
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();

    if (won) {
      sfx("win");
      confetti(90);
      showOverlay("Target reached! 🎉", `You scored ${score} in ${START_MOVES - moves} moves.`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      sfx("over");
      showOverlay("Out of moves", `You scored ${score} of ${TARGET}.`, [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    cancelAnim();
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New game", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
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
    const gem = e.target && e.target.closest ? e.target.closest(".gem") : null;
    if (!gem) return;
    audio.unlock();
    const r = parseInt(gem.getAttribute("data-r"), 10);
    const c = parseInt(gem.getAttribute("data-c"), 10);
    if (Number.isFinite(r) && Number.isFinite(c)) selectCell(r, c);
  }

  function bindEvents() {
    boardEl.addEventListener("click", onBoardClick);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });

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
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__MATCH3 = {
    SIZE,
    TYPES,
    START_MOVES,
    TARGET,
    GLYPHS,
    get grid() { return grid.map((row) => row.slice()); },
    get score() { return score; },
    get moves() { return moves; },
    get selected() { return selected ? { r: selected.r, c: selected.c } : null; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    stats,
    ACHIEVEMENTS,
    newGrid,
    swapCells,
    findMatches,
    anyMatched,
    hasPossibleMove,
    generateGrid,
    collapse,
    resolve,
    trySwap,
    selectCell,
    checkEnd,
    endGame,
    newGame,
    // Test-only: set the RNG seed.
    setSeed: (n) => { rngState = n >>> 0; },
    // Test-only: install a position.
    setState: (s) => {
      s = s || {};
      cancelAnim();
      if (s.grid) grid = s.grid.map((row) => row.slice());
      if (Number.isFinite(s.score)) score = s.score;
      if (Number.isFinite(s.moves)) moves = s.moves;
      selected = null;
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