// Echo — repeat the growing sequence. Pure vanilla JS, fully offline.
// Modes: Classic (3 lives), Sprint (2 min), Daily (seeded), Zen (no lives).
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
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
  const padsEl = dom.byId("pads");
  const boardWrap = dom.byId("board-wrap");
  const countdownEl = dom.byId("countdown");
  const countdownNumEl = dom.byId("countdown-num");
  const levelEl = dom.byId("level");
  const timeEl = dom.byId("time");
  const livesEl = dom.byId("lives");
  const bestEl = dom.byId("best");
  const statusEl = dom.byId("status");
  const liveEl = dom.byId("live");

  const startBtn = dom.byId("start");
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
    classic: { name: "Classic", timed: false, lives: 3 },
    sprint: { name: "Sprint", timed: true, baseTime: 120, lives: 3 },
    daily: { name: "Daily", timed: false, lives: 3 },
    zen: { name: "Zen", timed: false, lives: Infinity },
  };

  // Pad layouts. Each entry gets a distinct pitch so the sequence is audible.
  const DIFFS = {
    easy: {
      name: "Easy",
      cols: 2,
      pads: [
        { key: "green", freq: 330 },
        { key: "red", freq: 262 },
        { key: "yellow", freq: 196 },
        { key: "blue", freq: 147 },
      ],
    },
    normal: {
      name: "Normal",
      cols: 3,
      pads: [
        { key: "green", freq: 392 },
        { key: "red", freq: 330 },
        { key: "yellow", freq: 294 },
        { key: "blue", freq: 262 },
        { key: "purple", freq: 220 },
        { key: "orange", freq: 175 },
      ],
    },
    hard: {
      name: "Hard",
      cols: 3,
      pads: [
        { key: "green", freq: 440 },
        { key: "red", freq: 392 },
        { key: "yellow", freq: 349 },
        { key: "blue", freq: 330 },
        { key: "purple", freq: 294 },
        { key: "orange", freq: 262 },
        { key: "pink", freq: 233 },
        { key: "cyan", freq: 208 },
        { key: "lime", freq: 175 },
      ],
    },
  };

  const ACHIEVEMENTS = [
    { id: "level5", icon: "🎵", name: "Finding the Rhythm", desc: "Reach level 5.", stat: "maxLevel", goal: 5 },
    { id: "level10", icon: "🎶", name: "In the Groove", desc: "Reach level 10.", stat: "maxLevel", goal: 10 },
    { id: "level15", icon: "🎼", name: "Maestro", desc: "Reach level 15.", stat: "maxLevel", goal: 15 },
    { id: "level20", icon: "🏆", name: "Perfect Pitch", desc: "Reach level 20.", stat: "maxLevel", goal: 20 },
    { id: "perfect", icon: "🎯", name: "Flawless Run", desc: "Reach level 5 without a single mistake.", stat: "perfectRuns", goal: 1 },
    { id: "hard", icon: "🔥", name: "Hard Mode", desc: "Reach level 8 on Hard.", stat: "hardLevel", goal: 8 },
    { id: "normal", icon: "🎹", name: "Six Pads", desc: "Reach level 8 on Normal.", stat: "normalLevel", goal: 8 },
    { id: "sprint", icon: "⚡", name: "Sprint Finish", desc: "Reach level 10 in Sprint.", stat: "sprintLevel", goal: 10 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Finish the Daily sequence.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen", icon: "🌿", name: "Zen Master", desc: "Reach level 10 in Zen.", stat: "zenLevel", goal: 10 },
    { id: "lives", icon: "❤️", name: "Nine Lives", desc: "Reach level 8 having lost all 3 lives.", stat: "clutchLevel", goal: 8 },
    { id: "noMiss", icon: "🛡️", name: "Steady Hands", desc: "Clear 10 levels in one run.", stat: "bestStreak", goal: 10 },
    { id: "rounds", icon: "🔢", name: "Persistent", desc: "Play 20 rounds.", stat: "rounds", goal: 20 },
    { id: "longSeq", icon: "📜", name: "Long Memory", desc: "Repeat a 16-step sequence.", stat: "maxLevel", goal: 16 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Reach level 5 between midnight and 5 AM.", stat: "nightLevel", goal: 5 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Reach level 8 after losing 2 lives.", stat: "comebackLevel", goal: 8 },
    { id: "totalLevels", icon: "🎧", name: "Dedicated Listener", desc: "Clear 100 levels in total.", stat: "levelsCleared", goal: 100 },
    { id: "score", icon: "🌟", name: "High Scorer", desc: "Score 1000+ in one run.", stat: "bestScore", goal: 1000 },
    { id: "quick", icon: "💨", name: "Quick Recall", desc: "Finish a level in under 2 seconds.", stat: "quickLevels", goal: 1 },
    { id: "allPads", icon: "🌈", name: "Full Spectrum", desc: "Use every pad in one sequence.", stat: "fullSpectrum", goal: 1 },
    { id: "perfect10", icon: "💎", name: "Flawless Ten", desc: "Reach level 10 without a mistake.", stat: "perfectRuns", goal: 10 },
    { id: "marathon", icon: "🏃", name: "Marathon", desc: "Reach level 25.", stat: "maxLevel", goal: 25 },
  ];

  const DEFAULT_STATS = {
    rounds: 0,
    maxLevel: 0,
    bestScore: 0,
    levelsCleared: 0,
    perfectRuns: 0,
    hardLevel: 0,
    normalLevel: 0,
    sprintLevel: 0,
    zenLevel: 0,
    dailySolves: 0,
    clutchLevel: 0,
    bestStreak: 0,
    nightLevel: 0,
    comebackLevel: 0,
    quickLevels: 0,
    fullSpectrum: 0,
    playTime: 0,
  };

  const K = makeKeys("simon");

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
    pads: [],        // pad definitions for the current difficulty
    sequence: [],
    inputIndex: 0,
    level: 1,
    lives: 3,
    score: 0,
    mistakes: 0,
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    phase: "idle",   // idle | showing | input | over
    started: false,
    paused: false,
    over: false,
    roundStartAt: 0,
    maxSeqLen: 0,
  };

  let padEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let timers = [];
  let levelStartElapsed = 0;
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
        ["Best level", stats.maxLevel],
        ["Best score", stats.bestScore],
        ["Rounds", stats.rounds],
        ["Levels cleared", stats.levelsCleared],
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
        clearTimers();
      }
    },
    onClose: () => {
      if (resumeAfterModal) {
        resumeAfterModal = false;
        if (!state.over) {
          state.paused = false;
          pauseBtn.textContent = "Pause";
          if (state.phase === "showing") playSequence();
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
  function padConfig() {
    return DIFFS[state.diff];
  }

  /** One flash gets shorter as the level climbs, with a floor. */
  function flashSpeed(level) {
    const base = state.diff === "hard" ? 620 : state.diff === "normal" ? 680 : 750;
    const step = state.diff === "hard" ? 34 : 30;
    return Math.max(220, base - step * (level - 1));
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers = [];
  }

  function later(fn, ms) {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.diff), null);
    if (!rec || !rec.l) return "—";
    return String(rec.l);
  }

  function currentPadCount() {
    return padConfig().pads.length;
  }

  // ---------- Rendering ----------
  function buildPads() {
    while (padsEl.firstChild) padsEl.removeChild(padsEl.firstChild);
    padsEl.style.gridTemplateColumns = `repeat(${padConfig().cols}, 1fr)`;
    padsEl.dataset.pads = String(currentPadCount());
    padEls = [];

    padConfig().pads.forEach((pad, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `simon-pad simon-pad--${pad.key}`;
      btn.dataset.idx = String(i);
      btn.setAttribute("aria-label", `${pad.key} pad`);
      btn.innerHTML = `<span class="simon-pad__glow" aria-hidden="true"></span>`;
      btn.addEventListener("click", () => onPadPress(i));
      padsEl.appendChild(btn);
      padEls.push(btn);
    });
  }

  function flashPad(i, durationMs) {
    const el = padEls[i];
    if (!el) return;
    el.classList.add("is-active");
    const pad = padConfig().pads[i];
    if (pad) audio.tone(pad.freq, durationMs, "sine", 0.28);
    later(() => {
      if (el.classList) el.classList.remove("is-active");
    }, durationMs);
  }

  function renderHud() {
    levelEl.textContent = String(state.level);
    livesEl.textContent = state.lives === Infinity ? "∞" : String(state.lives);
    bestEl.textContent = bestLabel();
    startBtn.disabled = state.started && !state.over;
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
    if (state.started || state.countdown <= 0 || state.over) {
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
    const d = padConfig();
    const m = MODES[state.mode];
    let text;
    if (state.mode === "sprint") text = `Sprint · ${d.name} · ${m.baseTime}s`;
    else if (state.mode === "daily") text = `Daily · ${d.name} · streak ${daily.streak}d`;
    else if (state.mode === "zen") text = `Zen · ${d.name} · no lives lost`;
    else text = `Classic · ${d.name} · ${m.lives} lives`;
    const base =
      text +
      " · Watch the sequence, then repeat it · Each level adds one step · P pauses";
    if (statusEl) statusEl.textContent = base;
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.diff === state.diff ? "true" : "false")
    );
    renderHud();
    updateTimeDisplay();
  }

  // ---------- Round flow ----------
  function resetRound() {
    hideOverlay();
    clearTimers();
    padEls.forEach((el) => el.classList && el.classList.remove("is-active"));

    state.sequence = [];
    state.inputIndex = 0;
    state.level = 1;
    state.pads = padConfig().pads;
    state.lives = MODES[state.mode].lives;
    state.score = 0;
    state.mistakes = 0;
    state.elapsed = 0;
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed ? MODES[state.mode].baseTime * 1000 : 0;
    state.countdown = 1200;
    state.phase = "idle";
    state.started = false;
    state.paused = false;
    state.over = false;
    state.maxSeqLen = 0;
    levelStartElapsed = 0;

    roundRand = state.mode === "daily"
      ? mulberry32(hashSeed(`${util.dateStr()}-${state.diff}`))
      : Math.random;

    lastTimeText = "";
    pauseBtn.textContent = "Pause";
    buildPads();
    updateModeUI();
    updateCountdown();
    updateHint();
    renderHud();
  }

  function startGame() {
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

  function beginLevel() {
    state.phase = "showing";
    state.inputIndex = 0;
    levelStartElapsed = state.elapsed;
    setStatus(`Level ${state.level} — watch closely…`);
    playSequence();
  }

  function playSequence() {
    clearTimers();
    state.phase = "showing";
    setStatus(`Level ${state.level} — watch closely…`);
    const speed = flashSpeed(state.level);
    const toneDur = Math.min(420, Math.round(speed * 0.62));

    state.sequence.forEach((padIdx, i) => {
      later(() => flashPad(padIdx, toneDur), 380 + i * speed);
    });
    later(
      () => {
        if (state.over) return;
        state.phase = "input";
        state.inputIndex = 0;
        setStatus("Your turn — repeat the sequence!");
        dom.announce(liveEl, "Your turn.");
      },
      380 + state.sequence.length * speed
    );
  }

  function nextLevel() {
    state.level++;
    state.maxSeqLen = Math.max(state.maxSeqLen, state.sequence.length);

    stats.maxLevel = Math.max(stats.maxLevel, state.level);
    stats.levelsCleared++;
    if (state.diff === "hard") stats.hardLevel = Math.max(stats.hardLevel, state.level);
    if (state.diff === "normal") stats.normalLevel = Math.max(stats.normalLevel, state.level);
    if (state.mode === "sprint") stats.sprintLevel = Math.max(stats.sprintLevel, state.level);
    if (state.mode === "zen") stats.zenLevel = Math.max(stats.zenLevel, state.level);
    if (state.lives <= 0) stats.clutchLevel = Math.max(stats.clutchLevel, state.level);
    if (state.mistakes >= 2) stats.comebackLevel = Math.max(stats.comebackLevel, state.level);
    if (new Date().getHours() < 5) stats.nightLevel = Math.max(stats.nightLevel, state.level);

    // Full-spectrum: did the sequence we just cleared use every pad?
    const used = new Set(state.sequence);
    if (used.size === currentPadCount()) stats.fullSpectrum = 1;

    saveStats();

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevLevel = prev && prev.l ? prev.l : 0;
    if (state.level > prevLevel) {
      store.jsonSet(K.best(state.mode, state.diff), { l: state.level, s: state.score });
    }

    checkAchievements();
    renderHud();

    // Score for clearing a level: 10 per step in the sequence.
    state.score += state.sequence.length * 10 + state.level * 5;

    const grew = state.sequence.length;
    state.sequence.push(Math.floor(roundRand() * currentPadCount()));

    if (grew >= 4) {
      const mult = Math.min(5, 1 + Math.floor(grew / 4));
      showToast(`Level ${state.level - 1} cleared`, `Sequence of ${grew} · +${grew * 10 + (state.level - 1) * 5} points`, "🎵");
      if (mult > 1) sfx("combo");
    }

    state.phase = "showing";
    setStatus("Nice! Get ready…");
    later(() => {
      if (!state.over) beginLevel();
    }, 800);
  }

  function onPadPress(i) {
    if (state.phase !== "input" || state.paused || state.over) return;
    if (!canEdit()) return;

    flashPad(i, 240);

    if (i === state.sequence[state.inputIndex]) {
      state.inputIndex++;
      if (state.inputIndex === state.sequence.length) {
        // Level cleared.
        state.phase = "showing";
        sfx("word");
        later(() => {
          if (!state.over) nextLevel();
        }, 420);
      }
      return;
    }

    // Wrong pad.
    state.mistakes++;
    state.lives = state.lives === Infinity ? Infinity : state.lives - 1;
    sfx("error");

    if (state.lives <= 0) {
      endRun();
      return;
    }

    // Replay the same sequence from the start.
    state.phase = "showing";
    state.inputIndex = 0;
    setStatus(`Not quite — ${state.lives} ${state.lives === 1 ? "life" : "lives"} left. Watch again…`);
    showToast("Wrong pad", `${state.lives} ${state.lives === 1 ? "life" : "lives"} left`, "💥");
    renderHud();
    checkAchievements();
    later(() => {
      if (!state.over) playSequence();
    }, 900);
  }

  function canEdit() {
    return state.started && !state.paused && !state.over && achvModal.hidden;
  }

  // ---------- End ----------
  function endRun() {
    if (state.over) return;
    state.over = true;
    state.started = false;
    state.phase = "over";
    clearTimers();
    padEls.forEach((el) => el.classList && el.classList.remove("is-active"));
    sfx("over");

    stats.rounds++;
    stats.playTime += Math.round(state.elapsed);
    if (state.mistakes === 0 && state.level > 1) stats.perfectRuns++;
    stats.bestStreak = Math.max(stats.bestStreak, state.level - 1);
    stats.maxLevel = Math.max(stats.maxLevel, state.level);
    stats.bestScore = Math.max(stats.bestScore, state.score);
    if (state.level > 1 && state.mode === "daily") {
      recordDailyWin();
    }
    saveStats();
    checkAchievements();

    const prev = store.json(K.best(state.mode, state.diff), null);
    const prevLevel = prev && prev.l ? prev.l : 0;
    const isRecord = state.level > prevLevel || !prev;
    if (isRecord) {
      store.jsonSet(K.best(state.mode, state.diff), { l: state.level, s: state.score });
    }

    renderHud();
    updateTimeDisplay();

    const title = state.mistakes === 0 && state.level > 1 ? "Flawless! 🎯" : "Game Over 💥";
    const msg =
      `Level ${state.level} · ${state.score} points · ` +
      `${Math.max(0, state.level - 1)} levels cleared` +
      (isRecord ? " · New Best!" : "");

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); startGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
    setStatus("Press Start to try again.");
  }

  function recordDailyWin() {
    if (state.mode !== "daily") return;
    const today = util.dateStr();
    if (daily.lastDate === today) return;
    daily.streak = daily.lastDate === util.yesterdayStr() ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = { l: state.level, s: state.score, d: state.diff };
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
    if (p) {
      clearTimers();
      padEls.forEach((el) => el.classList && el.classList.remove("is-active"));
      if (!silent) {
        showOverlay("Paused", "Take a breath — press P or hit Resume.", [
          { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
          { label: "Restart", ghost: true, onClick: () => { hideOverlay(); startGame(); } },
        ]);
      }
    } else {
      hideOverlay();
      // Picking up mid-sequence: replay it so the player isn't stuck.
      if (state.phase === "showing" || state.phase === "input") {
        state.inputIndex = 0;
        playSequence();
      }
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
          startBtn.disabled = true;
          beginLevel();
        }
        updateCountdown();
      }
    }

    if (state.started && !state.over && !state.paused && achvModal.hidden) {
      state.elapsed += dt;
      if (MODES[state.mode].timed) {
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          endRun();
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

    if (lower === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state.over) {
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        startGame();
      }
      return;
    }

    if (state.paused) return;

    // Number keys hit pads directly.
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= currentPadCount()) {
      e.preventDefault();
      onPadPress(n - 1);
      return;
    }

    if (lower === "n" && state.mode !== "daily") startGame();
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
      audio.unlock();
      sfx("click");
      startGame();
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
    resetRound();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__SIMON = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    flashSpeed,
    playSequence,
    onPadPress,
    nextLevel,
    startGame,
    resetRound,
    setMode,
    setDiff,
    endRun,
    checkAchievements,
    saveStats,
    loop,
    setPaused,
    togglePause,
    beginLevel,
    unlocked: () => achv.list(),
    snap: () => ({
      mode: state.mode,
      diff: state.diff,
      pads: currentPadCount(),
      sequence: state.sequence.slice(),
      inputIndex: state.inputIndex,
      level: state.level,
      lives: state.lives,
      pads: currentPadCount(),
      score: state.score,
      mistakes: state.mistakes,
      elapsed: state.elapsed,
      remaining: state.remaining,
      phase: state.phase,
      started: state.started,
      paused: state.paused,
      over: state.over,
      cellEls: padEls.length,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
  };

  init();
})();