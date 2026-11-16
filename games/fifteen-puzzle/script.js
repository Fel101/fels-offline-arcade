// 15 Puzzle — slide the tiles back into order. Pure vanilla JS, fully offline.
// Modes: Classic (no clock), Time Attack (countdown), Daily (seeded), Zen (untimed).
// Boards are shuffled by walking backwards from the solved state, so every
// puzzle is guaranteed solvable. Hints use a greedy Manhattan-distance
// lookahead, which is always a legal, helpful nudge.
//
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
  const timeEl = dom.byId("time");
  const movesEl = dom.byId("moves");
  const solvedEl = dom.byId("solved");
  const scoreEl = dom.byId("score");
  const hintsEl = dom.byId("hints");
  const bestEl = dom.byId("best");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const newGameBtn = dom.byId("new-game");
  const hintBtn = dom.byId("hint-btn");
  const pauseBtn = dom.byId("pause");
  const finishBtn = dom.byId("finish");
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
    classic: { name: "Classic", timed: false, hints: 3 },
    attack: { name: "Time Attack", timed: true, hints: 2 },
    daily: { name: "Daily", timed: false, hints: 3 },
    zen: { name: "Zen", timed: false, hints: Infinity },
  };

  // scramble = how many random-walk steps away from solved.
  const DIFFS = {
    easy: { name: "Easy", size: 3, scramble: 40, attackTime: 60 },
    normal: { name: "Normal", size: 4, scramble: 120, attackTime: 120 },
    hard: { name: "Hard", size: 5, scramble: 260, attackTime: 180 },
  };

  const ACHIEVEMENTS = [
    { id: "first", icon: "🧩", name: "First Solve", desc: "Solve your first puzzle.", stat: "solves", goal: 1 },
    { id: "solves5", icon: "🔢", name: "Five Solved", desc: "Solve 5 puzzles.", stat: "solves", goal: 5 },
    { id: "solves20", icon: "🏅", name: "Puzzle Veteran", desc: "Solve 20 puzzles.", stat: "solves", goal: 20 },
    { id: "solves50", icon: "🎖️", name: "Puzzle Master", desc: "Solve 50 puzzles.", stat: "solves", goal: 50 },
    { id: "hard", icon: "🔥", name: "Hard Mode", desc: "Solve a 5 × 5 puzzle.", stat: "hardSolves", goal: 1 },
    { id: "hard10", icon: "🌋", name: "Hard Veteran", desc: "Solve 10 hard puzzles.", stat: "hardSolves", goal: 10 },
    { id: "noHint", icon: "🛡️", name: "Pure Logic", desc: "Solve a puzzle without a hint.", stat: "noHintSolves", goal: 1 },
    { id: "noHint10", icon: "🧠", name: "Unassisted", desc: "Solve 10 puzzles without a hint.", stat: "noHintSolves", goal: 10 },
    { id: "hint", icon: "💡", name: "Helping Hand", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Beat the Clock", desc: "Solve a puzzle in Time Attack.", stat: "attackSolves", goal: 1 },
    { id: "attack3", icon: "🚀", name: "Blitz", desc: "Solve 3 puzzles in one Time Attack round.", stat: "attackBest", goal: 3 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Solve the Daily puzzle.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen", icon: "🌿", name: "Zen Master", desc: "Solve a Zen puzzle.", stat: "zenSolves", goal: 1 },
    { id: "speed", icon: "⚡", name: "Quick Thinker", desc: "Solve an Easy puzzle in under 20 seconds.", stat: "speed", goal: 1 },
    { id: "efficient", icon: "🎯", name: "Efficient", desc: "Solve a Normal puzzle in 120 moves or fewer.", stat: "efficient", goal: 1 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Solve a puzzle between midnight and 5 AM.", stat: "nightSolves", goal: 1 },
    { id: "score400", icon: "🌟", name: "High Scorer", desc: "Score 400+ in one round.", stat: "bestScore", goal: 400 },
    { id: "score1000", icon: "👑", name: "Puzzle Royalty", desc: "Score 1,000+ in one round.", stat: "bestScore", goal: 1000 },
    { id: "streak3", icon: "🔥", name: "On a Roll", desc: "Solve 3 puzzles without restarting.", stat: "bestStreak", goal: 3 },
    { id: "moves", icon: "🧮", name: "Persistent", desc: "Make 300 moves in one puzzle.", stat: "maxMoves", goal: 300 },
    { id: "perfect", icon: "✨", name: "Optimal-ish", desc: "Solve a puzzle in 80 moves or fewer.", stat: "perfectSolves", goal: 1 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Solve a puzzle after 150 moves.", stat: "comeback", goal: 1 },
  ];

  const DEFAULT_STATS = {
    solves: 0,
    bestScore: 0,
    hardSolves: 0,
    noHintSolves: 0,
    hintsUsed: 0,
    attackSolves: 0,
    attackBest: 0,
    dailySolves: 0,
    zenSolves: 0,
    speed: 0,
    efficient: 0,
    nightSolves: 0,
    bestStreak: 0,
    streak: 0,
    maxMoves: 0,
    perfectSolves: 0,
    comeback: 0,
    playTime: 0,
  };

  const K = makeKeys("fifteen-puzzle");

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
    size: 3,
    tiles: [],
    moves: 0,
    score: 0,
    solved: 0,
    hintsLeft: 3,
    hintsUsed: 0,
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    streak: 0,
    hintIdx: -1,
    history: [],
  };

  let tileEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let hintTimer = 0;

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
        ["Solved", stats.solves],
        ["Hard solved", stats.hardSolves],
        ["Daily streak", daily.streak + "d"],
        ["Best streak", stats.bestStreak],
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

  // ---------- Puzzle mechanics ----------
  function blankIndex() {
    return state.tiles.indexOf(0);
  }

  function isSolved() {
    const n = state.size;
    const total = n * n;
    for (let i = 0; i < total - 1; i++) if (state.tiles[i] !== i + 1) return false;
    return state.tiles[total - 1] === 0;
  }

  function neighboursOfBlank() {
    const b = blankIndex();
    const n = state.size;
    const br = Math.floor(b / n);
    const bc = b % n;
    const out = [];
    if (br > 0) out.push(b - n);
    if (br < n - 1) out.push(b + n);
    if (bc > 0) out.push(b - 1);
    if (bc < n - 1) out.push(b + 1);
    return out;
  }

  /** Total Manhattan distance of every tile from its goal. */
  function manhattan(tiles, n) {
    let d = 0;
    for (let i = 0; i < tiles.length; i++) {
      const v = tiles[i];
      if (!v) continue;
      const goal = v - 1;
      const gr = Math.floor(goal / n);
      const gc = goal % n;
      const r = Math.floor(i / n);
      const c = i % n;
      d += Math.abs(gr - r) + Math.abs(gc - c);
    }
    return d;
  }

  /** Swap the blank with the tile at index i (must be adjacent). */
  function swapWith(i) {
    const b = blankIndex();
    const tmp = state.tiles[b];
    state.tiles[b] = state.tiles[i];
    state.tiles[i] = tmp;
  }

  function canSlide(i) {
    return neighboursOfBlank().includes(i);
  }

  // ---------- Scrambling ----------
  /**
   * Walk backwards from the solved state. Every position on a random walk
   * from solved is reachable, so the result is always solvable — no parity
   * maths needed, and it naturally scales with the scramble length.
   */
  function scramble(rand, n, steps) {
    const total = n * n;
    const tiles = [];
    for (let i = 0; i < total - 1; i++) tiles.push(i + 1);
    tiles.push(0);

    let blank = total - 1;
    let previous = -1;

    for (let s = 0; s < steps; s++) {
      const br = Math.floor(blank / n);
      const bc = blank % n;
      const options = [];
      if (br > 0) options.push(blank - n);
      if (br < n - 1) options.push(blank + n);
      if (bc > 0) options.push(blank - 1);
      if (bc < n - 1) options.push(blank + 1);

      // Avoid immediately undoing the previous step.
      const filtered = options.filter((x) => x !== previous);
      const pool = filtered.length ? filtered : options;
      const pick = pool[Math.floor(rand() * pool.length)];

      tiles[blank] = tiles[pick];
      tiles[pick] = 0;
      previous = blank;
      blank = pick;
    }

    // Never hand back an already-solved board.
    let guard = 0;
    while (isSolvedTiles(tiles, n) && guard++ < 30) {
      const opts = [];
      const br = Math.floor(blank / n);
      const bc = blank % n;
      if (br > 0) opts.push(blank - n);
      if (br < n - 1) opts.push(blank + n);
      if (bc > 0) opts.push(blank - 1);
      if (bc < n - 1) opts.push(blank + 1);
      const pick = opts[Math.floor(rand() * opts.length)];
      tiles[blank] = tiles[pick];
      tiles[pick] = 0;
      blank = pick;
    }

    return tiles;
  }

  function isSolvedTiles(tiles, n) {
    const total = n * n;
    for (let i = 0; i < total - 1; i++) if (tiles[i] !== i + 1) return false;
    return tiles[total - 1] === 0;
  }

  // ---------- Hint ----------
  /**
   * Exact solver for the 3×3 board only.
   *
   * IDA* (iterative deepening A*) with the Manhattan-distance heuristic —
   * the classic optimal sliding-puzzle approach. On 3×3 the whole space is
   * 181,440 states, so this returns a genuinely optimal next move instantly.
   *
   * On 4×4 / 5×5 an exact solution is far too slow for an interactive hint,
   * so we fall back to a greedy Manhattan lookahead. That always returns a
   * legal move and avoids immediately undoing the player's last slide.
   */
  const IDA_NODE_BUDGET = 40000;

  function idaHint3(maxDepth) {
    const n = state.size;
    const start = state.tiles.slice();
    const blank = start.indexOf(0);
    const path = [];
    let nodes = 0;

    const neighbours = (b) => {
      const br = Math.floor(b / n);
      const bc = b % n;
      const out = [];
      if (br > 0) out.push(b - n);
      if (br < n - 1) out.push(b + n);
      if (bc > 0) out.push(b - 1);
      if (bc < n - 1) out.push(b + 1);
      return out;
    };

    function search(tiles, b, g, bound, lastBlank) {
      nodes++;
      if (nodes > IDA_NODE_BUDGET) return { aborted: true };

      const h = manhattan(tiles, n);
      if (h === 0) return { found: true };
      if (g + h > bound) return { bound: g + h };

      let min = Infinity;
      for (const nb of neighbours(b)) {
        if (nb === lastBlank) continue;
        const v = tiles[nb];
        tiles[b] = v;
        tiles[nb] = 0;
        path.push(v);

        const res = search(tiles, nb, g + 1, bound, b);
        if (res.found) return { found: true };
        if (res.aborted) return { aborted: true };
        if (res.bound < min) min = res.bound;

        path.pop();
        tiles[nb] = v;
        tiles[b] = 0;
      }
      return { bound: min };
    }

    let bound = manhattan(start, n);
    while (bound <= maxDepth) {
      path.length = 0;
      const res = search(start, blank, 0, bound, -1);
      if (res.found) return path.length ? path[0] : null;
      if (res.aborted) return undefined; // ran out of budget
      if (!Number.isFinite(res.bound)) return null;
      bound = res.bound;
    }
    return null;
  }

  /** Greedy: the legal slide that most reduces Manhattan distance. */
  function greedyHint() {
    const n = state.size;
    const options = neighboursOfBlank();
    if (!options.length) return -1;

    const lastMoved = state.history.length ? state.history[state.history.length - 1] : -1;
    const blank = blankIndex();
    let best = -1;
    let bestScore = Infinity;

    for (const i of options) {
      if (i === lastMoved && options.length > 1) continue;
      // Simulate the slide without mutating the live board: after moving the
      // tile at `i` into the blank, that tile sits at `blank` and the blank
      // sits at `i`. swapWith(i) twice would be wrong because the second call
      // reads a *new* blankIndex().
      const v = state.tiles[i];
      const before = state.tiles[blank];

      state.tiles[blank] = v;
      state.tiles[i] = 0;
      const d = manhattan(state.tiles, n);
      // Restore exactly.
      state.tiles[blank] = before;
      state.tiles[i] = v;

      if (d < bestScore) {
        bestScore = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Returns the board index of the tile to slide, or -1 if nothing can move.
   */
  function hintTileIndex() {
    const n = state.size;
    if (n === 3) {
      const exact = idaHint3(32);
      // `undefined` = node budget exhausted, `null` = no solution within the
      // depth bound. Both fall back to the greedy heuristic, which always
      // returns a legal move — better to nudge than to give up mid-solve.
      if (typeof exact === "number") {
        return state.tiles.indexOf(exact);
      }
    }
    return greedyHint();
  }

  /** Alias kept for tests and readability. */
  function findHint() {
    return hintTileIndex();
  }

  // ---------- Rendering ----------
  function buildBoard() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    boardEl.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    boardEl.dataset.size = String(state.size);
    tileEls = [];

    const total = state.size * state.size;
    for (let i = 0; i < total; i++) {
      const v = state.tiles[i];
      const el = document.createElement(v === 0 ? "div" : "button");
      if (v !== 0) el.type = "button";
      el.className = v === 0 ? "pz-blank" : "pz-tile";
      el.dataset.idx = String(i);
      if (v === 0) {
        el.setAttribute("aria-label", "Empty space");
      } else {
        el.innerHTML = `<span class="pz-tile__num"></span>`;
        el.setAttribute("aria-label", `Tile ${v}`);
        el.addEventListener("click", () => onTileClick(i));
      }
      boardEl.appendChild(el);
      tileEls.push(el);
    }
    paint();
  }

  /** Update numbers/labels without rebuilding the DOM. */
  function paint() {
    const movable = new Set(neighboursOfBlank());
    for (let i = 0; i < tileEls.length; i++) {
      const el = tileEls[i];
      const v = state.tiles[i];
      const isBlank = v === 0;
      const shouldBeBlank = el.classList.contains("pz-blank");

      // The blank moved — rebuild so the empty cell tracks it.
      if (isBlank !== shouldBeBlank) {
        buildBoard();
        return;
      }
      if (isBlank) continue;

      const numEl = el.querySelector(".pz-tile__num");
      if (numEl && numEl.textContent !== String(v)) numEl.textContent = String(v);
      el.dataset.value = String(v);
      el.classList.toggle("is-movable", movable.has(i));
      el.classList.toggle("is-hint", state.hintIdx === i);
      el.setAttribute("aria-label", `Tile ${v}${movable.has(i) ? ", can slide" : ""}`);
    }
  }

  function updateHUD() {
    timeEl.textContent = MODES[state.mode].timed
      ? formatTime(state.remaining)
      : formatTime(state.elapsed);
    movesEl.textContent = String(state.moves);
    solvedEl.textContent = String(state.solved);
    scoreEl.textContent = String(state.score);
    hintsEl.textContent = state.mode === "zen" ? "∞" : String(state.hintsLeft);
    bestEl.textContent = bestLabel();

    hintBtn.disabled = state.mode !== "zen" && state.hintsLeft <= 0;
    hintBtn.textContent = state.mode === "zen" ? "💡 Hint ∞" : `💡 Hint (${state.hintsLeft})`;
    finishBtn.disabled = !state.started || state.over;
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
      MODES[state.mode].timed && state.remaining <= 15000 && state.started && !state.over
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
    if (state.mode === "attack") text = `Time Attack · ${d.size}×${d.size} · ${d.attackTime}s`;
    else if (state.mode === "daily") text = `Daily · ${d.size}×${d.size} · streak ${daily.streak}d`;
    else if (state.mode === "zen") text = `Zen · ${d.size}×${d.size} · unlimited hints`;
    else text = `Classic · ${d.size}×${d.size} · no clock`;
    hintEl.textContent =
      text +
      " · Slide tiles into the gap with clicks or arrow keys / WASD · Put the tiles in order · H hint, P pause";
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    newGameBtn.disabled = state.mode === "daily";
    finishBtn.hidden = state.mode !== "zen";
    updateHint();
    updateHUD();
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.s) return "—";
    return String(rec.s);
  }

  // ---------- Flow ----------
  function newPuzzle(opts) {
    hideOverlay();
    window.clearTimeout(hintTimer);

    const keepClock = !!(opts && opts.keepClock);
    const keepStarted = !!(opts && opts.keepStarted);
    const d = DIFFS[state.diff];

    const seed = state.mode === "daily" ? `${util.dateStr()}-${state.diff}` : null;
    const rand = seed ? mulberry32(hashSeed(seed)) : Math.random;

    state.size = d.size;
    state.tiles = scramble(rand, d.size, d.scramble);
    state.moves = 0;
    state.hintIdx = -1;
    state.history = [];
    state.hintsUsed = 0;
    state.hintsLeft = MODES[state.mode].hints;

    if (keepClock) {
      state.over = false;
      state.paused = false;
    } else {
      state.score = 0;
      state.solved = 0;
      state.elapsed = 0;
      state.remaining = MODES[state.mode].timed ? d.attackTime * 1000 : 0;
      state.over = false;
      state.paused = false;
      state.streak = 0;
    }

    if (keepStarted && state.started) {
      state.countdown = 0;
    } else {
      state.countdown = 1200;
      state.started = false;
    }

    lastTimeText = "";
    pauseBtn.textContent = "Pause";

    buildBoard();
    updateModeUI();
    updateCountdown();
    updateTimeDisplay();
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
    updateModeUI();
    newPuzzle();
  }

  function setDiff(d) {
    if (!DIFFS[d] || d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    updateModeUI();
    newPuzzle();
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
  function onTileClick(i) {
    if (!canEdit()) return;
    if (state.tiles[i] === 0) return;
    if (!canSlide(i)) {
      // Shake the tile to show it can't move.
      const el = tileEls[i];
      if (el && el.classList) {
        el.classList.remove("is-bump");
        void el.offsetWidth;
        el.classList.add("is-bump");
      }
      sfx("error");
      return;
    }

    const value = state.tiles[i];
    state.history.push(value);
    swapWith(i);
    state.moves++;
    state.hintIdx = -1;

    sfx("pop");
    paint();
    updateHUD();

    if (isSolved()) {
      puzzleSolved();
      return;
    }

    dom.announce(liveEl, `Tile ${value} moved. ${state.moves} moves.`);
  }

  /** Arrow keys slide the tile in that direction into the gap. */
  function slideInDirection(dr, dc) {
    if (!canEdit()) return;
    const n = state.size;
    const b = blankIndex();
    const br = Math.floor(b / n);
    const bc = b % n;
    const tr = br - dr;
    const tc = bc - dc;
    if (tr < 0 || tr >= n || tc < 0 || tc >= n) return;
    onTileClick(tr * n + tc);
  }

  function puzzleSolved() {
    const d = DIFFS[state.diff];
    const par = d.scramble;
    const efficient = state.moves <= par;

    state.solved++;
    state.streak++;
    stats.solves++;
    stats.maxMoves = Math.max(stats.maxMoves, state.moves);
    stats.bestStreak = Math.max(stats.bestStreak, state.streak);
    stats.streak = state.streak;

    if (state.diff === "hard") stats.hardSolves++;
    if (state.hintsUsed === 0) stats.noHintSolves++;
    if (state.mode === "attack") {
      stats.attackSolves++;
      stats.attackBest = Math.max(stats.attackBest, state.solved);
    }
    if (state.mode === "zen") stats.zenSolves++;
    if (efficient) stats.perfectSolves++;
    if (state.diff === "normal" && state.moves <= 120) stats.efficient = 1;
    if (state.moves >= 150) stats.comeback = 1;
    if (state.diff === "easy" && state.elapsed < 20000 && state.mode !== "attack") stats.speed = 1;
    if (new Date().getHours() < 5) stats.nightSolves++;

    // Score: base by size, efficiency bonus, hint penalty.
    const base = d.size * d.size * 6;
    const efficiency = Math.max(0, par - state.moves) * 2;
    const hintPenalty = state.hintsUsed * 20;
    const boardScore = Math.max(25, base + efficiency - hintPenalty);
    state.score += boardScore;
    stats.bestScore = Math.max(stats.bestScore, state.score);

    if (state.mode === "daily") recordDailyWin();

    saveStats();
    checkAchievements();

    sfx("win");
    confetti(efficient ? 90 : 60);
    showToast(
      efficient ? "Solved! 🎯" : "Solved! 🧩",
      `${state.moves} moves · +${boardScore} points`,
      efficient ? "🎯" : "🧩"
    );

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevScore = prev && Number.isFinite(prev.s) ? prev.s : 0;
    if (state.score > prevScore || !prev) {
      store.jsonSet(K.best(state.mode, state.diff), { s: state.score, m: state.moves });
    }

    updateHUD();

    if (state.mode === "daily") {
      endRound("clear");
      return;
    }

    if (state.mode === "attack") {
      window.setTimeout(() => {
        if (!state.over) newPuzzle({ keepClock: true, keepStarted: true });
      }, 600);
      return;
    }

    window.setTimeout(() => {
      if (!state.over) newPuzzle({ keepStarted: true });
    }, 700);
  }

  function useHint() {
    if (!canEdit()) return;
    if (state.mode !== "zen" && state.hintsLeft <= 0) {
      showToast("No hints left", "You've used all your hints for this board.", "💡");
      sfx("error");
      return;
    }

    const pick = hintTileIndex();
    if (pick < 0) {
      showToast("Nothing to suggest", "Try a different direction.", "🤔");
      return;
    }

    state.hintIdx = pick;
    state.hintsUsed++;
    stats.hintsUsed++;
    if (state.mode !== "zen") state.hintsLeft--;
    saveStats();
    checkAchievements();

    const el = tileEls[pick];
    if (el && el.classList) {
      el.classList.add("is-hint");
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => {
        if (el.classList) el.classList.remove("is-hint");
        state.hintIdx = -1;
        paint();
      }, 2400);
    }

    sfx("hint");
    const r = Math.floor(pick / state.size) + 1;
    const c = (pick % state.size) + 1;
    showToast("Try this one", `Row ${r}, column ${c}`, "💡");
    dom.announce(liveEl, `Hint: row ${r}, column ${c}.`);
    updateHUD();
  }

  function endRound(reason) {
    if (state.over) return;
    state.over = true;
    state.paused = false;

    stats.playTime += Math.round(state.elapsed);
    saveStats();
    checkAchievements();
    updateHUD();

    const won = state.solved > 0;
    sfx(won ? "win" : "over");
    if (won) confetti(70);

    const title = won
      ? state.solved > 1
        ? `${state.solved} Puzzles Solved! 🎉`
        : "Puzzle Solved! 🧩"
      : "Time's up! ⏰";
    const msg =
      `${DIFFS[state.diff].size}×${DIFFS[state.diff].size} · ` +
      `${state.solved} solved · ${state.moves} moves this board · ` +
      `${formatTime(state.elapsed)} · Score ${state.score}`;

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); newPuzzle(); } },
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
    daily.history[today] = { s: state.score, m: state.moves, d: state.diff };
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
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); newPuzzle(); } },
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
      state.countdown = Math.max(0, state.countdown - dt);
      if (state.countdown === 0) startPlay();
      updateCountdown();
    }

    if (state.started && !state.over && !state.paused && achvModal.hidden) {
      state.elapsed += dt;
      if (MODES[state.mode].timed) {
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          endRound("time");
          return;
        }
      }
    }

    updateTimeDisplay();
  }

  // ---------- Input ----------
  const KEYMAP = {
    arrowup: [-1, 0], keyw: [-1, 0],
    arrowdown: [1, 0], keys: [1, 0],
    arrowleft: [0, -1], keya: [0, -1],
    arrowright: [0, 1], keyd: [0, 1],
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
        newPuzzle();
      }
      return;
    }

    if (state.paused) return;

    if (lower === "h") {
      useHint();
      return;
    }

    if (lower === "n" && state.mode !== "daily") {
      newPuzzle();
      return;
    }

    const dir = KEYMAP[lower];
    if (dir) {
      e.preventDefault();
      slideInDirection(dir[0], dir[1]);
    }
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

    hintBtn.addEventListener("click", useHint);
    newGameBtn.addEventListener("click", () => {
      sfx("click");
      if (state.mode !== "daily") newPuzzle();
    });
    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });
    finishBtn.addEventListener("click", () => {
      sfx("click");
      endRound("manual");
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
    newPuzzle();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__PZ = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    blankIndex,
    isSolved,
    isSolvedTiles,
    neighboursOfBlank,
    manhattan,
    scramble,
    canSlide,
    findHint,
    hintTileIndex,
    onTileClick,
    slideInDirection,
    useHint,
    puzzleSolved,
    newPuzzle,
    setMode,
    setDiff,
    startPlay,
    endRound,
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
      tiles: state.tiles.slice(),
      moves: state.moves,
      score: state.score,
      solved: state.solved,
      blank: blankIndex(),
      manhattan: manhattan(state.tiles, state.size),
      solvedNow: isSolved(),
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      over: state.over,
      cellEls: tileEls.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
  };

  init();
})();