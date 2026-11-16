// Whack-a-Mole — hit the moles before they hide. Pure vanilla JS, fully offline.
// Modes: Classic (30 s), Rush (60 s, accelerating), Daily (seeded), Zen (untimed).
// Combos multiply your score; bombs cost you a life. Shared plumbing comes
// from ../../js/arcade-core.js.
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
  const scoreEl = dom.byId("score");
  const comboEl = dom.byId("combo");
  const hitsEl = dom.byId("hits");
  const missesEl = dom.byId("misses");
  const bestEl = dom.byId("best");
  const comboFillEl = dom.byId("combo-fill");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const startBtn = dom.byId("start");
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
    classic: { name: "Classic", timed: true, baseTime: 30, ramp: false },
    attack: { name: "Rush", timed: true, baseTime: 60, ramp: true },
    daily: { name: "Daily", timed: true, baseTime: 30, ramp: false },
    zen: { name: "Zen", timed: false, baseTime: 0, ramp: false },
  };

  // spawnMin/spawnMax in ms, holdMin/holdMax in ms, bombs on/off
  const DIFFS = {
    easy: { name: "Easy", cols: 3, spawnMin: 420, spawnMax: 900, holdMin: 900, holdMax: 1500, bombChance: 0, maxUp: 2 },
    normal: { name: "Normal", cols: 3, spawnMin: 320, spawnMax: 720, holdMin: 700, holdMax: 1200, bombChance: 0.1, maxUp: 3 },
    hard: { name: "Hard", cols: 4, spawnMin: 240, spawnMax: 560, holdMin: 520, holdMax: 950, bombChance: 0.16, maxUp: 4 },
  };

  const COMBO_WINDOW = 1600; // ms to keep a combo alive

  const ACHIEVEMENTS = [
    { id: "first", icon: "🐹", name: "First Whack", desc: "Whack your first mole.", stat: "hits", goal: 1 },
    { id: "hits25", icon: "🔨", name: "Getting Warm", desc: "Land 25 hits in one round.", stat: "maxRoundHits", goal: 25 },
    { id: "hits50", icon: "💥", name: "Mole Masher", desc: "Land 50 hits in one round.", stat: "maxRoundHits", goal: 50 },
    { id: "hits80", icon: "🌪️", name: "Whirlwind", desc: "Land 80 hits in one round.", stat: "maxRoundHits", goal: 80 },
    { id: "score200", icon: "🎯", name: "Sharpshooter", desc: "Score 200+ in a round.", stat: "bestScore", goal: 200 },
    { id: "score500", icon: "🚀", name: "High Flyer", desc: "Score 500+ in a round.", stat: "bestScore", goal: 500 },
    { id: "score900", icon: "👑", name: "Whack Royalty", desc: "Score 900+ in a round.", stat: "bestScore", goal: 900 },
    { id: "combo5", icon: "5️⃣", name: "Combo x5", desc: "Reach a x5 combo.", stat: "maxCombo", goal: 5 },
    { id: "combo10", icon: "🔟", name: "Unstoppable", desc: "Reach a x10 combo.", stat: "maxCombo", goal: 10 },
    { id: "perfect", icon: "🎯", name: "Flawless", desc: "Finish a round with no misses and no bombs hit.", stat: "perfectRounds", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Mode", desc: "Finish a Hard round.", stat: "hardRounds", goal: 1 },
    { id: "rush", icon: "⚡", name: "Speed Demon", desc: "Finish a Rush round.", stat: "rushRounds", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Finish the Daily round.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen", icon: "🌿", name: "Zen Master", desc: "Finish a Zen round.", stat: "zenRounds", goal: 1 },
    { id: "bomb", icon: "💣", name: "Bomb Squad", desc: "Hit 5 bombs and keep going.", stat: "bombsHit", goal: 5 },
    { id: "quick", icon: "⚡", name: "Quick Hands", desc: "Land 10 hits in the first 5 seconds.", stat: "quickStart", goal: 1 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Finish a round between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "total", icon: "🔢", name: "Mole Exterminator", desc: "Land 500 hits in total.", stat: "hits", goal: 500 },
    { id: "accuracy", icon: "🏹", name: "Dead Eye", desc: "Finish a round at 90%+ accuracy (20+ hits).", stat: "accuracy", goal: 1 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Finish a round after hitting 3 bombs.", stat: "comeback", goal: 1 },
    { id: "streak", icon: "🔥", name: "On Fire", desc: "Reach a x8 combo.", stat: "maxCombo", goal: 8 },
    { id: "noBomb", icon: "🛡️", name: "Bomb Dodger", desc: "Finish a Hard round without hitting a bomb.", stat: "hardClean", goal: 1 },
  ];

  const DEFAULT_STATS = {
    hits: 0,
    bestScore: 0,
    maxRoundHits: 0,
    maxCombo: 0,
    perfectRounds: 0,
    hardRounds: 0,
    rushRounds: 0,
    dailySolves: 0,
    zenRounds: 0,
    bombsHit: 0,
    quickStart: 0,
    nightWins: 0,
    accuracy: 0,
    comeback: 0,
    hardClean: 0,
    rounds: 0,
    playTime: 0,
  };

  const K = makeKeys("whack-a-mole");

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
    cols: 3,
    holes: [],
    score: 0,
    hits: 0,
    misses: 0,
    bombsHit: 0,
    combo: 1,
    maxCombo: 1,
    lastHitAt: -9999,
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    spawnTimer: 0,
    elapsedMs: 0,
  };

  let holeEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let lastComboText = "";
  let nextSpawnAt = 0;
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
        ["Rounds", stats.rounds],
        ["Hits", stats.hits],
        ["Best combo", "x" + stats.maxCombo],
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

  // ---------- Helpers ----------
  function holeCount() {
    return state.cols * state.cols;
  }

  function currentCombo() {
    return state.combo;
  }

  function comboMultiplier() {
    // x1 .. x8, stepping up every 2 hits.
    return Math.min(8, 1 + Math.floor((state.combo - 1) / 2));
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.s) return "—";
    return String(rec.s);
  }

  function difficultyForMode() {
    return DIFFS[state.diff];
  }

  /** Current spawn/hold timings, ramped up in Rush mode. */
  function timing() {
    const d = difficultyForMode();
    let spawnMin = d.spawnMin;
    let spawnMax = d.spawnMax;
    let holdMin = d.holdMin;
    let holdMax = d.holdMax;

    if (MODES[state.mode].ramp) {
      // Over 60 seconds, ramp to ~60% of the starting delay.
      const t = Math.min(1, state.elapsed / 60000);
      const k = 1 - 0.42 * t;
      spawnMin *= k;
      spawnMax *= k;
      holdMin *= k;
      holdMax *= k;
    }
    return { spawnMin, spawnMax, holdMin, holdMax, bombChance: d.bombChance, maxUp: d.maxUp };
  }

  // ---------- Rendering ----------
  function buildBoard() {
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    boardEl.dataset.cols = String(state.cols);
    holeEls = [];

    const total = holeCount();
    for (let i = 0; i < total; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wam-hole";
      btn.dataset.idx = String(i);
      btn.dataset.state = "empty";
      btn.setAttribute("aria-label", `Hole ${i + 1}, empty`);
      btn.innerHTML =
        `<span class="wam-hole__pit" aria-hidden="true"></span>` +
        `<span class="wam-hole__critter" aria-hidden="true"></span>`;
      btn.addEventListener("click", () => onHoleClick(i));
      boardEl.appendChild(btn);
      holeEls.push(btn);
    }
  }

  function setHole(i, kind) {
    const el = holeEls[i];
    if (!el) return;
    state.holes[i] = kind;
    el.dataset.state = kind || "empty";
    const critter = el.querySelector(".wam-hole__critter");
    if (critter) {
      if (kind === "mole") critter.textContent = "🐹";
      else if (kind === "gold") critter.textContent = "🌟";
      else if (kind === "bomb") critter.textContent = "💣";
      else critter.textContent = "";
    }
    const n = i + 1;
    if (!kind) el.setAttribute("aria-label", `Hole ${n}, empty`);
    else if (kind === "bomb") el.setAttribute("aria-label", `Hole ${n}, bomb — do not hit`);
    else el.setAttribute("aria-label", `Hole ${n}, ${kind === "gold" ? "golden mole" : "mole"}`);
  }

  function renderHoles() {
    for (let i = 0; i < holeEls.length; i++) setHole(i, state.holes[i] || null);
  }

  function updateHUD() {
    timeEl.textContent = MODES[state.mode].timed
      ? formatTime(state.remaining)
      : formatTime(state.elapsed);
    scoreEl.textContent = String(state.score);
    comboEl.textContent = "x" + comboMultiplier();
    hitsEl.textContent = String(state.hits);
    missesEl.textContent = String(state.misses + state.bombsHit);
    bestEl.textContent = bestLabel();

    const pct = Math.min(100, ((state.combo - 1) % 16) / 16 * 100);
    if (comboFillEl) comboFillEl.style.width = pct + "%";

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
      MODES[state.mode].timed && state.remaining <= 10000 && state.started && !state.over
    );
  }

  function updateComboDisplay() {
    const text = "x" + comboMultiplier();
    if (text !== lastComboText) {
      lastComboText = text;
      comboEl.textContent = text;
    }
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
    if (state.mode === "attack") text = `Rush · ${d.name} · ${m.baseTime}s · accelerating`;
    else if (state.mode === "daily") text = `Daily · ${d.name} · streak ${daily.streak}d`;
    else if (state.mode === "zen") text = `Zen · ${d.name} · no clock`;
    else text = `Classic · ${d.name} · ${m.baseTime}s`;
    hintEl.textContent =
      text +
      " · Whack moles before they hide · Chain hits for a combo multiplier · Avoid 💣 bombs · P pauses";
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    finishBtn.hidden = state.mode !== "zen";
    updateHint();
    updateHUD();
  }

  // ---------- Round flow ----------
  function resetRound() {
    hideOverlay();
    const d = DIFFS[state.diff];
    state.cols = d.cols;
    state.score = 0;
    state.hits = 0;
    state.misses = 0;
    state.bombsHit = 0;
    state.combo = 1;
    state.maxCombo = 1;
    state.lastHitAt = -9999;
    state.elapsed = 0;
    state.elapsedMs = 0;
    state.remaining = MODES[state.mode].timed ? MODES[state.mode].baseTime * 1000 : 0;
    state.countdown = 1200;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.holes = new Array(d.cols * d.cols).fill(null);
    nextSpawnAt = 0;

    roundRand = state.mode === "daily"
      ? mulberry32(hashSeed(`${util.dateStr()}-${state.diff}`))
      : Math.random;

    lastTimeText = "";
    lastComboText = "";
    pauseBtn.textContent = "Pause";
    startBtn.disabled = false;

    buildBoard();
    renderHoles();
    updateModeUI();
    updateCountdown();
    updateTimeDisplay();
    updateHUD();
  }

  function startRound() {
    if (state.started) return;
    resetRound();
    state.countdown = 1200;
    updateCountdown();
    lastTs = performance.now();
  }

  function setMode(m) {
    if (!MODES[m] || m === state.mode) return;
    state.mode = m;
    store.set(K.mode, m);
    resetRound();
  }

  function setDiff(d) {
    if (!DIFFS[d] || d === state.diff) return;
    state.diff = d;
    store.set(K.diff, d);
    resetRound();
  }

  // ---------- Spawning ----------
  function scheduleNextSpawn() {
    const t = timing();
    const delay = t.spawnMin + roundRand() * (t.spawnMax - t.spawnMin);
    nextSpawnAt = state.elapsed + delay;
  }

  function spawnCritter() {
    const total = holeCount();
    const empty = [];
    for (let i = 0; i < total; i++) if (!state.holes[i]) empty.push(i);
    if (!empty.length) {
      scheduleNextSpawn();
      return;
    }

    const idx = empty[Math.floor(roundRand() * empty.length)];
    const t = timing();
    const roll = roundRand();
    let kind = "mole";
    if (t.bombChance > 0 && roll < t.bombChance) kind = "bomb";
    else if (roll > 0.94) kind = "gold";

    state.holes[idx] = kind;
    setHole(idx, kind);
    sfx("pop");

    // How long the critter stays up.
    const hold = t.holdMin + roundRand() * (t.holdMax - t.holdMin);
    const thisIdx = idx;
    const token = (state.holes[idx] = kind);
    state[`hide_${idx}`] = state.elapsed + hold;
    void token;

    scheduleNextSpawn();
  }

  function updateCritters() {
    const total = holeCount();
    for (let i = 0; i < total; i++) {
      const until = state[`hide_${i}`];
      if (until && state.elapsed >= until) {
        if (state.holes[i]) {
          // A mole that got away breaks the combo.
          if (state.holes[i] === "mole" || state.holes[i] === "gold") {
            state.combo = 1;
            updateComboDisplay();
          }
          state.holes[i] = null;
          setHole(i, null);
        }
        delete state[`hide_${i}`];
      }
    }

    if (state.elapsed >= nextSpawnAt) {
      const up = state.holes.filter(Boolean).length;
      const maxUp = timing().maxUp;
      if (up < maxUp) spawnCritter();
      else scheduleNextSpawn();
    }
  }

  // ---------- Whacking ----------
  function onHoleClick(i) {
    if (!canEdit()) return;
    const kind = state.holes[i];
    if (!kind) {
      // Empty hole: small miss penalty, breaks the combo.
      state.misses++;
      state.combo = 1;
      sfx("error");
      updateHUD();
      updateComboDisplay();
      dom.announce(liveEl, "Miss.");
      return;
    }

    delete state[`hide_${i}`];
    state.holes[i] = null;

    if (kind === "bomb") {
      state.bombsHit++;
      stats.bombsHit++;
      state.combo = 1;
      state.score = Math.max(0, state.score - 25);
      sfx("error");
      setHole(i, null);
      showToast("Bomb! 💣", "−25 points · combo lost", "💣");
      updateHUD();
      updateComboDisplay();
      checkAchievements();
      saveStats();
      dom.announce(liveEl, "Bomb. Minus 25 points.");
      return;
    }

    // A hit.
    state.hits++;
    stats.hits++;
    if (state.elapsed < 5000) stats.quickStart = state.hits >= 10 ? 1 : stats.quickStart;

    const within = state.elapsed - state.lastHitAt <= COMBO_WINDOW;
    state.combo = within ? state.combo + 1 : 1;
    state.lastHitAt = state.elapsed;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    const mult = comboMultiplier();
    const base = kind === "gold" ? 30 : 10;
    const gained = base * mult;
    state.score += gained;

    sfx(kind === "gold" ? "long" : "match");
    setHole(i, null);
    updateHUD();
    updateComboDisplay();

    if (mult >= 4 && state.combo % 4 === 0) {
      showToast(`Combo x${mult}!`, `+${gained} points`, "🔥");
      sfx("combo");
    }
    if (kind === "gold") showToast("Golden mole! 🌟", `+${gained} points`, "🌟");

    checkAchievements();
    saveStats();
    dom.announce(liveEl, `Hit. Score ${state.score}.`);
  }

  // ---------- End ----------
  function endRound(reason) {
    if (state.over) return;
    state.over = true;
    state.started = false;
    state.paused = false;
    state.holes = new Array(holeCount()).fill(null);

    const totalShots = state.hits + state.misses + state.bombsHit;
    const accuracy = totalShots > 0 ? state.hits / totalShots : 0;
    const perfect = state.misses === 0 && state.bombsHit === 0 && state.hits > 0;

    stats.rounds++;
    stats.maxRoundHits = Math.max(stats.maxRoundHits, state.hits);
    stats.maxCombo = Math.max(stats.maxCombo, state.maxCombo);
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.playTime += Math.round(state.elapsedMs);
    if (state.hits >= 20 && accuracy >= 0.9) stats.accuracy = 1;
    if (perfect) stats.perfectRounds++;
    if (state.diff === "hard") {
      stats.hardRounds++;
      if (state.bombsHit === 0) stats.hardClean = 1;
    }
    if (state.mode === "rush") stats.rushRounds++;
    if (state.mode === "zen") stats.zenRounds++;
    if (state.bombsHit >= 3) stats.comeback = 1;
    if (new Date().getHours() < 5) stats.nightWins++;

    if (state.mode === "daily" && state.hits > 0) recordDailyWin();
    saveStats();
    checkAchievements();

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevScore = prev && Number.isFinite(prev.s) ? prev.s : 0;
    const isRecord = state.score > prevScore || !prev;
    if (isRecord) {
      store.jsonSet(K.best(state.mode, state.diff), { s: state.score, h: state.hits });
    }

    sfx(state.hits > 0 ? "win" : "over");
    if (isRecord && state.hits > 0) confetti(perfect ? 110 : 70);

    const title = perfect
      ? "Flawless! 🎯"
      : state.hits > 0
        ? "Time! ⏱️"
        : "No hits… 🐹";
    const msg =
      `${DIFFS[state.diff].name} · ${state.hits} hits · ` +
      `${state.misses} misses · ${state.bombsHit} bombs · ` +
      `best combo x${state.maxCombo} · Score ${state.score}` +
      (isRecord ? " · New Best!" : "");

    renderHoles();
    updateHUD();
    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); startRound(); } },
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
    daily.history[today] = { s: state.score, h: state.hits, d: state.diff };
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
        { label: "Restart", ghost: true, onClick: () => { hideOverlay(); startRound(); } },
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
          nextSpawnAt = 0;
          sfx("click");
          startBtn.disabled = true;
          updateHUD();
        }
        updateCountdown();
      }
    }

    if (state.started && !state.over && !state.paused && achvModal.hidden) {
      state.elapsed += dt;
      state.elapsedMs += dt;

      if (MODES[state.mode].timed) {
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          endRound("time");
          return;
        }
      }

      updateCritters();

      // A combo that hasn't been extended in time resets.
      if (state.combo > 1 && state.elapsed - state.lastHitAt > COMBO_WINDOW) {
        state.combo = 1;
        updateComboDisplay();
        updateHUD();
      }
    }

    updateTimeDisplay();
    updateComboDisplay();
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

    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state.over) {
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        startRound();
      }
      return;
    }

    if (state.paused) return;

    if (lower === "n" && state.mode !== "daily") {
      startRound();
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

    startBtn.addEventListener("click", () => {
      sfx("click");
      startRound();
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
    state.cols = DIFFS[state.diff].cols;

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    updateBadgeCount();
    bindEvents();
    resetRound();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__WAM = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    timing,
    comboMultiplier,
    spawnCritter,
    onHoleClick,
    startRound,
    resetRound,
    setMode,
    setDiff,
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
      cols: state.cols,
      holes: state.holes.slice(),
      score: state.score,
      hits: state.hits,
      misses: state.misses,
      bombsHit: state.bombsHit,
      combo: state.combo,
      maxCombo: state.maxCombo,
      multiplier: comboMultiplier(),
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      over: state.over,
      cellEls: holeEls.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
  };

  init();
})();