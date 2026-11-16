// Memory — flip pairs of cards. Pure vanilla JS, fully offline.
// Modes: Classic (no clock), Time Attack (countdown), Daily (seeded), Zen (untimed).
// Shared plumbing (storage, seeded RNG, audio, toasts, overlay, confetti,
// badges, modal) comes from ../../js/arcade-core.js.
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
  const pairsEl = dom.byId("pairs");
  const scoreEl = dom.byId("score");
  const hintsEl = dom.byId("hints");
  const bestEl = dom.byId("best");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const pauseBtn = dom.byId("pause");
  const hintBtn = dom.byId("hint-btn");
  const newGameBtn = dom.byId("new-game");
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
    classic: { name: "Classic", timed: false, baseTime: 0, hints: 3 },
    attack: { name: "Time Attack", timed: true, baseTime: 0, hints: 2 },
    daily: { name: "Daily", timed: false, baseTime: 0, hints: 3 },
    zen: { name: "Zen", timed: false, baseTime: 0, hints: Infinity },
  };

  // pairs / columns per difficulty
  const DIFFS = {
    easy: { name: "Easy", pairs: 6, cols: 4, attackTime: 60, bonus: 0 },
    normal: { name: "Normal", pairs: 8, cols: 4, attackTime: 90, bonus: 0 },
    hard: { name: "Hard", pairs: 10, cols: 5, attackTime: 120, bonus: 0 },
  };

  const EMOJIS = [
    "🍎", "🚀", "🌟", "🐱", "🎲", "🌈", "🍕", "⚽", "🐸", "🍩",
    "🎸", "🐙", "🦊", "🍉", "🚁", "🎈", "🧩", "🦄", "🍄", "⚡",
  ];

  const ACHIEVEMENTS = [
    { id: "first", icon: "🃏", name: "First Pair", desc: "Match your first pair.", stat: "pairs", goal: 1 },
    { id: "board1", icon: "🎉", name: "Clean Sweep", desc: "Clear a board.", stat: "boards", goal: 1 },
    { id: "board10", icon: "🔟", name: "Ten Boards", desc: "Clear 10 boards.", stat: "boards", goal: 10 },
    { id: "board50", icon: "🏅", name: "Memory Veteran", desc: "Clear 50 boards.", stat: "boards", goal: 50 },
    { id: "perfect", icon: "🎯", name: "Flawless", desc: "Clear a board with zero wrong pairs.", stat: "perfect", goal: 1 },
    { id: "perfect10", icon: "💎", name: "Diamond Mind", desc: "Clear 10 flawless boards.", stat: "perfect", goal: 10 },
    { id: "speed", icon: "⚡", name: "Speedrun", desc: "Clear an Easy board in under 20 seconds.", stat: "speed", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Mode", desc: "Clear a Hard board.", stat: "hardWins", goal: 1 },
    { id: "attack", icon: "⏱️", name: "Beat the Clock", desc: "Clear a Time Attack board.", stat: "attackWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily board.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "noHint", icon: "🛡️", name: "Pure Skill", desc: "Clear a board without peeking.", stat: "noHintWins", goal: 1 },
    { id: "hint", icon: "👀", name: "Helping Hand", desc: "Use a peek.", stat: "hintsUsed", goal: 1 },
    { id: "zen", icon: "🌿", name: "Zen Master", desc: "Clear a Zen board.", stat: "zenWins", goal: 1 },
    { id: "streak3", icon: "🔥", name: "On a Roll", desc: "Clear 3 boards in a row without a loss.", stat: "bestStreak", goal: 3 },
    { id: "moves", icon: "🧠", name: "Efficient", desc: "Clear a Normal board in 12 moves or fewer.", stat: "bestMovesNormal", goal: 12, invert: true },
    { id: "pairs100", icon: "💯", name: "Century", desc: "Match 100 pairs in total.", stat: "pairs", goal: 100 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Clear a board between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "noMiss", icon: "✨", name: "Photographic", desc: "Clear a Hard board with no more than 2 misses.", stat: "hardClean", goal: 1 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Clear a board after 20 misses.", stat: "comeback", goal: 1 },
    { id: "timeLeft", icon: "⏳", name: "Time to Spare", desc: "Finish a Time Attack board with 30s left.", stat: "timeLeft", goal: 1 },
    { id: "score500", icon: "🌟", name: "High Roller", desc: "Score 500+ on one board.", stat: "bestScore", goal: 500 },
    { id: "score900", icon: "👑", name: "Memory Royalty", desc: "Score 900+ on one board.", stat: "bestScore", goal: 900 },
  ];

  const DEFAULT_STATS = {
    boards: 0,
    pairs: 0,
    bestScore: 0,
    perfect: 0,
    speed: 0,
    hardWins: 0,
    attackWins: 0,
    dailySolves: 0,
    noHintWins: 0,
    hintsUsed: 0,
    zenWins: 0,
    bestStreak: 0,
    streak: 0,
    bestMovesNormal: Infinity,
    nightWins: 0,
    hardClean: 0,
    comeback: 0,
    timeLeft: 0,
    playTime: 0,
    totalMoves: 0,
  };

  const K = makeKeys("memory");

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
  // Infinity doesn't survive JSON — restore it.
  if (stats.bestMovesNormal === null) stats.bestMovesNormal = Infinity;

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
    deck: [],
    flipped: [],
    matched: new Set(),
    moves: 0,
    misses: 0,
    streak: 0,
    score: 0,
    hintsLeft: 3,
    hintsUsed: 0,
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    lock: false,
    perfect: true,
  };

  let cardEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let hideTimer = 0;
  let peekTimer = 0;
  let peekActive = false;

  // ---------- Achievements ----------
  function statValue(key) {
    if (key === "dailyStreak") return daily.streak;
    if (key === "bestMovesNormal") {
      // Lower is better: report "goal - (moves - goal)" so the bar fills up.
      if (!Number.isFinite(stats.bestMovesNormal)) return 0;
      return Math.max(0, 13 - stats.bestMovesNormal);
    }
    return stats[key] || 0;
  }

  function saveStats() {
    store.jsonSet(K.stats, stats, (k, v) => (v === Infinity ? "__INF__" : v));
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
        ["Boards", stats.boards],
        ["Pairs", stats.pairs],
        ["Daily streak", daily.streak + "d"],
        ["Flawless", stats.perfect],
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

  // ---------- Helpers ----------
  function cardCount() {
    return DIFFS[state.diff].pairs * 2;
  }

  function pairsTotal() {
    return DIFFS[state.diff].pairs;
  }

  function canEdit() {
    return state.started && !state.paused && !state.over && achvModal.hidden && !state.lock;
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.s) return "—";
    return String(rec.s);
  }

  /** Live score shown during play: matched pairs (+ remaining time in timed modes). */
  function computeScore() {
    if (!state.started) return 0;
    const pairPts = state.matched.size * 10;
    const timeBonus =
      MODES[state.mode].timed && state.started
        ? Math.max(0, Math.round(state.remaining / 1000)) * 2
        : 0;
    return pairPts + timeBonus;
  }

  /** Final score at round end: adds the efficiency bonus for unused moves. */
  function computeFinalScore() {
    const pairs = pairsTotal();
    const moveBonus = Math.max(0, (pairs * 2 - state.moves) * 5);
    return computeScore() + moveBonus;
  }

  // ---------- Rendering ----------
  function buildDeck(rand) {
    const pairs = pairsTotal();
    const pool = util.shuffle(rand, EMOJIS).slice(0, pairs);
    const cards = [];
    for (const emoji of pool) {
      cards.push({ emoji, id: cards.length });
      cards.push({ emoji, id: cards.length });
    }
    return util.shuffle(rand, cards);
  }

  function buildBoard() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    const cols = DIFFS[state.diff].cols;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.dataset.cols = String(cols);
    cardEls = [];

    state.deck.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mem-card";
      btn.dataset.idx = String(i);
      btn.dataset.emoji = card.emoji;
      btn.setAttribute("aria-label", `Card ${i + 1}, face down`);
      btn.innerHTML =
        `<span class="mem-card__inner">` +
        `<span class="mem-card__face mem-card__face--back" aria-hidden="true">?</span>` +
        `<span class="mem-card__face mem-card__face--front" aria-hidden="true"></span>` +
        `</span>`;
      btn.querySelector(".mem-card__face--front").textContent = card.emoji;
      btn.addEventListener("click", () => onCardClick(i));
      boardEl.appendChild(btn);
      cardEls.push(btn);
    });
  }

  function isFlipped(i) {
    return state.flipped.includes(i) || state.matched.has(i);
  }

  function renderCards() {
    for (let i = 0; i < cardEls.length; i++) {
      const el = cardEls[i];
      const up = isFlipped(i) || peekActive;
      const matched = state.matched.has(i);
      el.classList.toggle("is-flipped", up);
      el.classList.toggle("is-matched", matched);
      el.setAttribute("aria-label", matched
        ? `Card ${i + 1}, ${state.deck[i].emoji}, matched`
        : up
          ? `Card ${i + 1}, ${state.deck[i].emoji}`
          : `Card ${i + 1}, face down`);
    }
  }

  function updateHUD() {
    timeEl.textContent = MODES[state.mode].timed
      ? formatTime(state.remaining)
      : formatTime(state.elapsed);
    movesEl.textContent = String(state.moves);
    pairsEl.textContent = `${state.matched.size / 2}/${pairsTotal()}`;
    scoreEl.textContent = String(computeScore());
    hintsEl.textContent = state.mode === "zen" ? "∞" : String(state.hintsLeft);
    bestEl.textContent = bestLabel();

    hintBtn.disabled = state.mode !== "zen" && state.hintsLeft <= 0;
    hintBtn.textContent = state.mode === "zen" ? "👀 Peek ∞" : `👀 Peek (${state.hintsLeft})`;
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
    const mode = MODES[state.mode];
    const d = DIFFS[state.diff];
    let text;
    if (state.mode === "attack") text = `Time Attack · ${d.name} · ${d.attackTime}s`;
    else if (state.mode === "daily") text = `Daily · ${d.name} · streak ${daily.streak}d`;
    else if (state.mode === "zen") text = `Zen · ${d.name} · unlimited peeks`;
    else text = `Classic · ${d.name} · no clock`;
    hintEl.textContent =
      text +
      " · Flip two cards to find a matching pair · Fewer moves and a faster time score more · H to peek, P to pause";
    if (mode.timed) hintEl.textContent = text + " · Race the clock · H to peek, P to pause";
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

  // ---------- Game flow ----------
  function newPuzzle() {
    hideOverlay();
    window.clearTimeout(hideTimer);
    window.clearTimeout(peekTimer);
    peekActive = false;

    const seed = state.mode === "daily" ? `${util.dateStr()}-${state.diff}` : null;
    const rand = seed ? mulberry32(hashSeed(seed)) : Math.random;

    state.deck = buildDeck(rand);
    state.flipped = [];
    state.matched = new Set();
    state.moves = 0;
    state.misses = 0;
    state.score = 0;
    state.hintsLeft = MODES[state.mode].hints;
    state.hintsUsed = 0;
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed
      ? DIFFS[state.diff].attackTime * 1000
      : 0;
    state.countdown = 1200;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.lock = false;
    state.perfect = true;

    lastTimeText = "";
    pauseBtn.textContent = "Pause";

    buildBoard();
    renderCards();
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
  function onCardClick(i) {
    if (!canEdit()) return;
    if (state.matched.has(i)) return;
    if (state.flipped.includes(i)) {
      // Clicking the same card again flips it back.
      state.flipped = state.flipped.filter((x) => x !== i);
      renderCards();
      sfx("click");
      return;
    }

    state.flipped.push(i);
    sfx("flip");
    renderCards();

    if (state.flipped.length < 2) {
      sfx("select");
      return;
    }

    const [a, b] = state.flipped;
    state.moves++;
    const isMatch = state.deck[a].emoji === state.deck[b].emoji;

    if (isMatch) {
      state.matched.add(a);
      state.matched.add(b);
      state.flipped = [];
      state.score = computeScore();
      sfx("match");
      renderCards();
      updateHUD();

      // Live stats so badges unlock during play, not just at round end.
      stats.pairs++;
      stats.bestScore = Math.max(stats.bestScore, state.score);
      saveStats();

      checkAchievements();
      dom.announce(liveEl, `Match! ${state.matched.size / 2} of ${pairsTotal()} pairs.`);

      if (state.matched.size >= cardCount()) {
        endRound("clear");
      }
      return;
    }

    // Wrong pair.
    state.misses++;
    state.perfect = false;
    sfx("error");
    const [first, second] = state.flipped;
    state.lock = true;
    hideTimer = window.setTimeout(() => {
      state.flipped = [];
      state.lock = false;
      renderCards();
      updateHUD();
    }, 780);
    dom.announce(liveEl, "Not a match.");
  }

  function usePeek() {
    if (!canEdit()) return;
    if (state.mode !== "zen" && state.hintsLeft <= 0) {
      showToast("No peeks left", "You've used all your peeks for this board.", "👀");
      sfx("error");
      return;
    }
    const remaining = cardCount() - state.matched.size;
    if (remaining <= 0) {
      endRound("clear");
      return;
    }

    peekActive = true;
    renderCards();
    state.hintsUsed++;
    stats.hintsUsed++;
    if (state.mode !== "zen") state.hintsLeft--;
    sfx("hint");
    updateHUD();
    checkAchievements();
    saveStats();
    dom.announce(liveEl, "Peeking at all cards.");

    window.clearTimeout(peekTimer);
    peekTimer = window.setTimeout(() => {
      peekActive = false;
      renderCards();
    }, 1100);
  }

  // ---------- End / scoring ----------
  function endRound(reason) {
    if (state.over) return;
    state.over = true;
    state.paused = false;
    state.lock = false;

    const pairs = pairsTotal();
    const perfect = state.perfect && state.misses === 0;
    const finalScore = Math.max(computeFinalScore(), state.matched.size * 10);

    stats.boards++;
    stats.bestScore = Math.max(stats.bestScore, finalScore);
    stats.totalMoves += state.moves;
    stats.playTime += Math.round(state.elapsed);
    if (perfect) stats.perfect++;
    if (state.mode === "attack") stats.attackWins++;
    if (state.diff === "hard") {
      stats.hardWins++;
      if (state.misses <= 2) stats.hardClean++;
    }
    if (state.hintsUsed === 0) stats.noHintWins++;
    if (state.mode === "zen") stats.zenWins++;
    if (state.mode === "daily") recordDailyWin();
    if (new Date().getHours() < 5) stats.nightWins++;
    if (state.misses >= 20) stats.comeback = 1;
    if (MODES[state.mode].timed && state.remaining >= 30000) stats.timeLeft = 1;
    if (state.diff === "easy" && state.mode === "classic" && state.elapsed < 20000) {
      stats.speed = 1;
    }
    if (state.diff === "normal" && state.moves <= 12) {
      stats.bestMovesNormal = Math.min(stats.bestMovesNormal, state.moves);
    }

    state.streak++;
    stats.streak = state.streak;
    stats.bestStreak = Math.max(stats.bestStreak, state.streak);

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevScore = prev && Number.isFinite(prev.s) ? prev.s : 0;
    const isRecord = finalScore > prevScore || !prev;
    if (isRecord) {
      store.jsonSet(K.best(state.mode, state.diff), {
        s: Math.max(prevScore, finalScore),
        m: state.moves,
      });
    }

    saveStats();
    checkAchievements();
    renderCards();
    updateHUD();

    const won = reason === "clear";
    sfx(won ? "win" : "over");
    if (won && (isRecord || perfect)) confetti(perfect ? 110 : 70);

    const timeText = MODES[state.mode].timed
      ? formatTime(state.elapsed)
      : MODES[state.mode].timed === false && state.elapsed
        ? formatTime(state.elapsed)
        : "—";
    const title = won
      ? perfect
        ? "Flawless! ✨"
        : "Board Cleared! 🎉"
      : reason === "time"
        ? "Time's up! ⏰"
        : "Round Complete";
    const msg =
      `${DIFFS[state.diff].name} · ${state.matched.size / 2}/${pairs} pairs · ` +
      `${state.moves} moves · ${formatTime(state.elapsed)} · Score ${finalScore}` +
      (perfect ? " · No misses" : "") +
      (isRecord ? " · New Best!" : "");

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
    daily.history[today] = { s: computeFinalScore(), m: state.moves, d: state.diff };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
    saveStats();
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
  function onKeyDown(e) {
    const k = e.key;
    const lower = k.toLowerCase();

    if (!achvModal.hidden) {
      if (k === "Escape") {
        closeAchv();
        e.preventDefault();
      }
      return;
    }

    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (tag === "button" && (k === " " || k === "Enter")) return;

    if (k === "Escape") {
      if (state.paused) {
        setPaused(false, true);
        e.preventDefault();
      }
      return;
    }

    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state.over) {
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        newPuzzle();
      }
      return;
    }

    if (state.paused) return;

    if (lower === "h") {
      usePeek();
      return;
    }

    if (lower === "n" && state.mode !== "daily") {
      newPuzzle();
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

    hintBtn.addEventListener("click", usePeek);
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

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    updateBadgeCount();
    bindEvents();
    newPuzzle();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__MEM = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    EMOJIS,
    computeScore,
    computeFinalScore,
    buildDeck,
    newPuzzle,
    setMode,
    setDiff,
    startPlay,
    onCardClick,
    usePeek,
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
      deck: state.deck.map((c) => c.emoji),
      flipped: state.flipped.slice(),
      matched: Array.from(state.matched),
      moves: state.moves,
      misses: state.misses,
      score: computeScore(),
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      over: state.over,
      lock: state.lock,
      perfect: state.perfect,
      cellEls: cardEls.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
  };

  init();
})();