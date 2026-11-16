// Boggle — find as many words as you can in a grid of letter dice.
// Pure vanilla JS, fully offline.
// Modes: Classic (3 min), Sprint (90 s), Daily (seeded), Zen (untimed).
// Features: 4x4 and 5x5 boards, drag/tap word building, a 9k-word dictionary,
// hints, undo path, pause, 24 badges, persistent best scores, daily streaks,
// sound, confetti, and theme-aware styling.
//
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

  const createBadges = badgesApi.create;
  const createModal = modalApi.create;

  const { formatTime, dateStr, hashSeed, mulberry32 } = util;
  const sfx = audio.sfx;
  const showToast = toast.show;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;
  const REDUCE = util.prefersReducedMotion();

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const boardWrap = dom.byId("board-wrap");
  const countdownEl = dom.byId("countdown");
  const countdownNumEl = dom.byId("countdown-num");
  const timeEl = dom.byId("time");
  const scoreEl = dom.byId("score");
  const wordsEl = dom.byId("words");
  const longestEl = dom.byId("longest");
  const hintsEl = dom.byId("hints");
  const bestEl = dom.byId("best");
  const hintEl = dom.byId("hint");
  const liveEl = dom.byId("live");

  const currentWordEl = dom.byId("current-word");
  const submitBtn = dom.byId("submit-word");
  const clearBtn = dom.byId("clear-word");
  const progressTextEl = dom.byId("progress-text");
  const progressFillEl = dom.byId("progress-fill");
  const hintLineEl = dom.byId("hint-line");
  const foundListEl = dom.byId("found-list");
  const missedWrapEl = dom.byId("missed-wrap");
  const missedListEl = dom.byId("missed-list");

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
    classic: {
      name: "Classic",
      timed: true,
      baseTime: 180,
      hints: 3,
      hint: "Classic · 3 minutes · 3 hints",
    },
    sprint: {
      name: "Sprint",
      timed: true,
      baseTime: 90,
      hints: 2,
      hint: "Sprint · 90 seconds · 2 hints",
    },
    daily: {
      name: "Daily",
      timed: true,
      baseTime: 180,
      hints: 3,
      hint: "Daily · one seeded board a day",
    },
    zen: {
      name: "Zen",
      timed: false,
      baseTime: 0,
      hints: Infinity,
      hint: "Zen · no clock · unlimited hints",
    },
  };

  const SIZES = {
    4: { name: "4 × 4", label: "Classic", extraTime: 0, minWords: 22 },
    5: { name: "5 × 5", label: "Big", extraTime: 60, minWords: 45 },
  };

  // Classic Boggle dice. "Q" is always rolled as the face "Qu".
  const DICE4 = [
    "AAEEGN",
    "ABBJOO",
    "ACHOPS",
    "AFFKPS",
    "AOOTTW",
    "CIMOTU",
    "DEILRX",
    "DELRVY",
    "DISTTY",
    "EEGHNW",
    "EEINSU",
    "EHRTVW",
    "EIOSST",
    "ELRTTY",
    "HIMNQU",
    "HLNNRZ",
  ];

  // Weighted letter pool for 5x5 boards.
  const POOL5 =
    "AAAAAAAAABBCCDDDDEEEEEEEEEEEEEFFGGGHHIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSSSTTTTTTTTTUUUUVVWWXYYZ";

  const ACHIEVEMENTS = [
    { id: "first", icon: "🔤", name: "First Word", desc: "Find your first word.", stat: "words", goal: 1 },
    { id: "words10", icon: "📚", name: "Word Collector", desc: "Find 10 words in one round.", stat: "maxRoundWords", goal: 10 },
    { id: "words25", icon: "📖", name: "Word Hunter", desc: "Find 25 words in one round.", stat: "maxRoundWords", goal: 25 },
    { id: "words40", icon: "🧠", name: "Word Machine", desc: "Find 40 words in one round.", stat: "maxRoundWords", goal: 40 },
    { id: "long6", icon: "6️⃣", name: "Six Shooter", desc: "Find a 6-letter word.", stat: "longest", goal: 6 },
    { id: "long7", icon: "7️⃣", name: "Seven Heaven", desc: "Find a 7-letter word.", stat: "longest", goal: 7 },
    { id: "long8", icon: "8️⃣", name: "Long Haul", desc: "Find an 8+ letter word.", stat: "longest", goal: 8 },
    { id: "score50", icon: "🎯", name: "On the Board", desc: "Score 50+ in a round.", stat: "bestScore", goal: 50 },
    { id: "score120", icon: "🚀", name: "High Scorer", desc: "Score 120+ in a round.", stat: "bestScore", goal: 120 },
    { id: "score200", icon: "👑", name: "Word Legend", desc: "Score 200+ in a round.", stat: "bestScore", goal: 200 },
    { id: "perfect", icon: "✨", name: "Clean Sweep", desc: "Find every word on a 4×4 board.", stat: "perfect", goal: 1 },
    { id: "bigBoard", icon: "🔲", name: "Big Board", desc: "Play a 5×5 board.", stat: "bigBoards", goal: 1 },
    { id: "bigWin", icon: "🏆", name: "Big Winner", desc: "Score 150+ on a 5×5 board.", stat: "fiveBest", goal: 150 },
    { id: "classic", icon: "⏱️", name: "Classic Win", desc: "Complete a Classic round.", stat: "classicWins", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Complete a Daily round.", stat: "dailySolves", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "zen20", icon: "🌿", name: "Zen Master", desc: "Find 20 words in a Zen round.", stat: "zenMax", goal: 20 },
    { id: "noHint", icon: "🛡️", name: "Pure Skill", desc: "Finish a round without hints.", stat: "noHintRounds", goal: 1 },
    { id: "hint", icon: "💡", name: "Helping Hand", desc: "Use a hint.", stat: "hintsUsed", goal: 1 },
    { id: "quick", icon: "⚡", name: "Quick Thinker", desc: "Find a word within 5 seconds.", stat: "quickWords", goal: 1 },
    { id: "comeback", icon: "💪", name: "Perseverance", desc: "Find a word after 5 misses.", stat: "comeback", goal: 1 },
    { id: "night", icon: "🦉", name: "Night Owl", desc: "Finish a round between midnight and 5 AM.", stat: "nightWins", goal: 1 },
    { id: "bookworm", icon: "🐛", name: "Bookworm", desc: "Find 100 words in total.", stat: "words", goal: 100 },
  ];

  const DEFAULT_STATS = {
    rounds: 0,
    words: 0,
    totalScore: 0,
    bestScore: 0,
    maxRoundWords: 0,
    longest: 0,
    bestWord: "",
    hintsUsed: 0,
    invalid: 0,
    noHintRounds: 0,
    perfect: 0,
    bigBoards: 0,
    fiveBest: 0,
    classicWins: 0,
    dailySolves: 0,
    zenMax: 0,
    quickWords: 0,
    comeback: 0,
    nightWins: 0,
    playTime: 0,
  };

  const K = makeKeys("boggle");

  // ---------- Persistent state ----------
  const storedStats = store.json(K.stats, {});
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (key === "bestWord") {
      if (typeof stats[key] !== "string") stats[key] = "";
    } else if (!Number.isFinite(stats[key])) {
      stats[key] = DEFAULT_STATS[key];
    }
  }

  let daily = store.json(K.daily, null);
  if (!daily || typeof daily !== "object" || Array.isArray(daily)) {
    daily = { streak: 0, lastDate: "", history: {} };
  }
  if (!daily.history || typeof daily.history !== "object") daily.history = {};
  if (!Number.isFinite(daily.streak)) daily.streak = 0;

  // ---------- Dictionary ----------
  const rawWords = Array.isArray(window.BOGGLE_WORDS) ? window.BOGGLE_WORDS : [];
  const WORD_SET = new Set();
  const TRIE = { next: new Map(), word: false };

  for (const raw of rawWords) {
    const w = String(raw).trim().toUpperCase();
    if (!/^[A-Z]{3,16}$/.test(w)) continue;
    WORD_SET.add(w);
    let node = TRIE;
    for (const ch of w) {
      let next = node.next.get(ch);
      if (!next) {
        next = { next: new Map(), word: false };
        node.next.set(ch, next);
      }
      node = next;
    }
    node.word = true;
  }

  // ---------- Audio ----------
  const soundCtl = audio.bindButton({
    btn: soundBtn,
    icon: soundIconEl,
    soundKey: K.sound,
  });

  // ---------- Helpers ----------
  function wordPoints(len) {
    if (len >= 8) return 11;
    if (len === 7) return 5;
    if (len === 6) return 3;
    if (len === 5) return 2;
    return 1;
  }

  function canEdit() {
    return state.started && !state.paused && !state.over && achvModal.hidden;
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    size: 4,
    faces: [],
    possible: [],
    found: new Map(),
    path: [],
    dragging: false,
    tapMode: false,
    moved: false,
    score: 0,
    hintsLeft: 3,
    hintsUsed: 0,
    invalid: 0,
    longest: 0,
    longestWord: "",
    hintWord: "",
    elapsed: 0,
    remaining: 0,
    countdown: 0,
    started: false,
    paused: false,
    over: false,
    flashWord: "",
    finished: false,
  };

  let cellEls = [];
  let resumeAfterModal = false;
  let lastTs = 0;
  let lastTimeText = "";
  let badTimer = 0;
  let flashTimer = 0;

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
        ["Words found", stats.words],
        ["Longest", stats.longest ? (stats.bestWord ? `${stats.longest} · ${stats.bestWord}` : String(stats.longest)) : "—"],
        ["Daily streak", daily.streak + "d"],
        ["Best 5×5", stats.fiveBest],
      ],
    });
  }

  const achvModalCtl = createModal(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!state.over && !state.paused && state.started) {
        state.paused = true;
        state.dragging = false;
        state.moved = false;
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
      const focusTarget = overlay.isOpen() ? document.querySelector(".overlay .btn") : badgesBtn;
      if (focusTarget && focusTarget.focus) focusTarget.focus();
    },
  });

  function openAchv() {
    achvModalCtl.open();
  }

  function closeAchv() {
    achvModalCtl.close();
  }

  function focusModeBar() {
    const chip = document.querySelector(".mode-chip");
    if (chip) chip.focus();
  }

  function setPaused(p, silent) {
    if (state.over || !state.started) return;
    if (p) {
      state.dragging = false;
      state.moved = false;
    }
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

  // ---------- Board generation ----------
  function facesFromDie(str) {
    const faces = [];
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "Q") {
        faces.push("QU");
        i++;
      } else {
        faces.push(str[i]);
      }
    }
    return faces;
  }

  function roll4(rand) {
    const dice = util.shuffle(rand, DICE4);
    return dice.map((d) => {
      const faces = facesFromDie(d);
      return faces[Math.floor(rand() * faces.length)];
    });
  }

  function roll5(rand) {
    const n = 5;
    const total = n * n;
    const faces = [];
    const counts = new Map();
    for (let i = 0; i < total; i++) {
      let letter = "";
      let guard = 0;
      do {
        letter = POOL5[Math.floor(rand() * POOL5.length)];
        guard++;
      } while (guard < 40 && (counts.get(letter) || 0) >= 2);
      counts.set(letter, (counts.get(letter) || 0) + 1);
      faces.push(letter === "Q" ? "QU" : letter);
    }

    // Guarantee a friendly vowel/consonant balance.
    const vowels = new Set(["A", "E", "I", "O", "U"]);
    const isVowelFace = (f) => f.length === 1 && vowels.has(f);
    let vowelCount = faces.filter(isVowelFace).length;
    let guard = 0;
    while (vowelCount < 8 && guard++ < 80) {
      const idx = Math.floor(rand() * total);
      if (!isVowelFace(faces[idx])) {
        const v = ["A", "E", "I", "O", "U"][Math.floor(rand() * 5)];
        faces[idx] = v;
        vowelCount++;
      }
    }
    while (vowelCount > 11 && guard++ < 120) {
      const idx = Math.floor(rand() * total);
      if (isVowelFace(faces[idx])) {
        faces[idx] = "RSTLN"[Math.floor(rand() * 5)];
        vowelCount--;
      }
    }

    // At most one Qu.
    let qSeen = false;
    for (let i = 0; i < faces.length; i++) {
      if (faces[i] === "QU") {
        if (qSeen) faces[i] = "AEIO"[Math.floor(rand() * 4)];
        qSeen = true;
      }
    }
    return faces;
  }

  // Depth-first search over the board using the prefix trie.
  function solveBoard(faces, n) {
    const found = new Set();
    const total = n * n;
    const visited = new Uint8Array(total);
    const word = [];

    function dfs(idx, node) {
      const face = faces[idx];
      let cur = node;
      for (const ch of face) {
        cur = cur.next.get(ch);
        if (!cur) return;
      }
      word.push(face);
      if (cur.word) {
        const w = word.join("");
        if (w.length >= 3) found.add(w);
      }

      visited[idx] = 1;
      const r = Math.floor(idx / n);
      const c = idx % n;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const ni = nr * n + nc;
          if (visited[ni]) continue;
          dfs(ni, cur);
        }
      }
      visited[idx] = 0;
      word.pop();
    }

    for (let i = 0; i < total; i++) dfs(i, TRIE);
    return Array.from(found);
  }

  function generateBoard(size, rand) {
    const minWords = (SIZES[size] || SIZES[4]).minWords;
    let last = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const faces = size === 5 ? roll5(rand) : roll4(rand);
      const words = solveBoard(faces, size);
      last = { faces, words };
      if (words.length >= minWords) return last;
    }
    return last || { faces: size === 5 ? roll5(rand) : roll4(rand), words: [] };
  }

  // ---------- Rendering ----------
  function buildBoard() {
    const n = state.size;
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    boardEl.style.setProperty("--n", String(n));
    cellEls = [];

    for (let i = 0; i < n * n; i++) {
      const face = state.faces[i] || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bg-cell" + (face === "QU" ? " is-qu" : "");
      btn.dataset.idx = String(i);
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-pressed", "false");
      const r = Math.floor(i / n) + 1;
      const c = (i % n) + 1;
      const spoken = face === "QU" ? "Qu" : face;
      btn.setAttribute("aria-label", `Row ${r}, column ${c}: ${spoken}`);
      btn.innerHTML = `<span class="bg-cell__letter"></span><span class="bg-cell__ord" aria-hidden="true"></span>`;
      btn.querySelector(".bg-cell__letter").textContent = face === "QU" ? "Qu" : face;
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
  }

  function isAdjacent(a, b, n) {
    const ar = Math.floor(a / n);
    const ac = a % n;
    const br = Math.floor(b / n);
    const bc = b % n;
    return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1 && a !== b;
  }

  function renderCells() {
    const selected = new Map();
    state.path.forEach((idx, i) => selected.set(idx, i + 1));
    const head = state.path.length ? state.path[state.path.length - 1] : -1;

    for (let i = 0; i < cellEls.length; i++) {
      const el = cellEls[i];
      const order = selected.get(i);
      el.classList.toggle("is-selected", !!order);
      el.classList.toggle("is-head", i === head);
      el.setAttribute("aria-pressed", order ? "true" : "false");
      const ordEl = el.querySelector(".bg-cell__ord");
      if (ordEl) ordEl.textContent = order ? String(order) : "";
    }
  }

  function currentWord() {
    return state.path.map((i) => state.faces[i] || "").join("");
  }

  function renderTray() {
    const word = currentWord();
    if (word) {
      currentWordEl.textContent = word;
      currentWordEl.classList.remove("is-empty");
      submitBtn.disabled = word.length < 3 || !canEdit();
      clearBtn.disabled = !canEdit();
    } else {
      currentWordEl.textContent = "Drag across letters to build a word";
      currentWordEl.classList.add("is-empty");
      submitBtn.disabled = true;
      clearBtn.disabled = true;
    }
  }

  function renderFound() {
    if (!state.found.size) {
      foundListEl.innerHTML = `<div class="bg-words__empty">No words yet — connect three or more letters.</div>`;
      return;
    }
    const rows = [];
    const entries = Array.from(state.found.entries()).reverse();
    for (const [word, pts] of entries) {
      rows.push(
        `<div class="bg-word${word === state.flashWord ? " is-new" : ""}">` +
          `<span class="bg-word__text">${word}</span>` +
          `<span class="bg-word__pts">${pts}</span>` +
          `</div>`
      );
    }
    foundListEl.innerHTML = rows.join("");
  }

  function renderMissed() {
    if (!state.finished) {
      missedWrapEl.hidden = true;
      missedListEl.innerHTML = "";
      return;
    }
    const missed = state.possible
      .filter((w) => !state.found.has(w))
      .sort((a, b) => b.length - a.length || a.localeCompare(b));
    missedWrapEl.hidden = missed.length === 0;
    missedListEl.innerHTML = missed
      .slice(0, 80)
      .map(
        (w) =>
          `<span class="bg-missed__word">${w} <b>${wordPoints(w.length)}</b></span>`
      )
      .join("");
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    wordsEl.textContent = String(state.found.size);
    longestEl.textContent = state.longestWord || "—";
    hintsEl.textContent = state.mode === "zen" ? "∞" : String(state.hintsLeft);
    bestEl.textContent = bestLabel();

    const total = state.possible.length || 0;
    const pct = total ? Math.min(100, (state.found.size / total) * 100) : 0;
    progressTextEl.textContent = total
      ? `Found ${state.found.size} of ${total}`
      : "Found 0";
    const progressBar = progressFillEl.parentNode;
    if (progressBar) {
      progressBar.setAttribute("aria-valuemax", String(total || 100));
      progressBar.setAttribute("aria-valuenow", String(state.found.size));
    }
    progressFillEl.style.width = `${pct}%`;

    hintBtn.disabled = state.mode !== "zen" && state.hintsLeft <= 0;
    hintBtn.textContent = state.mode === "zen" ? "💡 Hint ∞" : `💡 Hint (${state.hintsLeft})`;
    finishBtn.disabled = !state.started || state.over;
    submitBtn.disabled = currentWord().length < 3 || !canEdit();
    clearBtn.disabled = state.path.length === 0 || !canEdit();
  }

  function updateTimeDisplay() {
    let text;
    if (state.mode === "zen") text = "∞";
    else if (MODES[state.mode].timed) text = formatTime(state.remaining);
    else text = formatTime(state.elapsed);
    if (text !== lastTimeText) {
      lastTimeText = text;
      timeEl.textContent = text;
    }
    timeEl.classList.toggle(
      "is-danger",
      MODES[state.mode].timed && state.remaining <= 30000 && state.started && !state.over
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
    const extra = SIZES[state.size].extraTime;
    let text;
    if (state.mode === "classic") {
      text = `Classic · ${Math.round((MODES.classic.baseTime + extra) / 60)} minutes · 3 hints`;
    } else if (state.mode === "sprint") {
      text = `Sprint · ${MODES.sprint.baseTime + extra} seconds · 2 hints`;
    } else {
      text = MODES[state.mode].hint;
    }
    if (state.mode === "daily") text += ` · Streak ${daily.streak}d`;
    text += ` · ${SIZES[state.size].name}`;
    hintEl.textContent =
      text +
      " · Connect adjacent letters · 3+ letters · Longer words score more (3–4=1, 5=2, 6=3, 7=5, 8+=11) · Backspace undoes";
  }

  function updateModeUI() {
    modeChips.forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false")
    );
    diffChips.forEach((b) =>
      b.setAttribute("aria-pressed", Number(b.dataset.size) === state.size ? "true" : "false")
    );
    newGameBtn.disabled = state.mode === "daily";
    finishBtn.hidden = state.mode !== "zen";
    updateHint();
    updateHUD();
  }

  function bestLabel() {
    const rec = store.json(K.best(state.mode, state.size), null);
    if (!rec || !rec.s) return "—";
    return String(rec.s);
  }

  // ---------- Path actions ----------
  function clearPath() {
    state.path = [];
    renderCells();
    renderTray();
    updateHUD();
  }

  function addCell(idx) {
    if (!canEdit()) return;
    const last = state.path[state.path.length - 1];
    if (last === idx) return;
    if (state.path.length >= 2 && state.path[state.path.length - 2] === idx) {
      state.path.pop();
      renderCells();
      renderTray();
      updateHUD();
      return;
    }
    if (state.path.includes(idx)) {
      state.path = state.path.slice(0, state.path.indexOf(idx) + 1);
      renderCells();
      renderTray();
      updateHUD();
      return;
    }
    if (last === undefined || isAdjacent(last, idx, state.size)) {
      state.path.push(idx);
      renderCells();
      renderTray();
      updateHUD();
    }
  }

  function reject(message) {
    state.invalid++;
    stats.invalid++;
    saveStats();
    sfx("error");
    showToast("Not quite", message, "🚫");
    dom.announce(liveEl, message);
    const path = state.path.slice();
    cellEls.forEach((el, i) => {
      if (path.includes(i)) el.classList.add("is-bad");
    });
    window.clearTimeout(badTimer);
    badTimer = window.setTimeout(() => {
      cellEls.forEach((el) => el.classList.remove("is-bad"));
    }, 420);
    clearPath();
  }

  function submitPath() {
    if (!canEdit()) return;
    const word = currentWord();
    if (word.length < 3) {
      clearPath();
      return;
    }
    if (state.found.has(word)) {
      reject(`You already found ${word}.`);
      return;
    }
    if (!WORD_SET.has(word)) {
      reject(`${word} isn't in the word list.`);
      return;
    }

    const pts = wordPoints(word.length);
    state.found.set(word, pts);
    state.score += pts;
    state.flashWord = word;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      state.flashWord = "";
      renderFound();
    }, 700);

    if (word.length > state.longest) {
      state.longest = word.length;
      state.longestWord = word;
    }

    if (state.invalid >= 5) {
      stats.comeback = 1;
      state.invalid = 0;
    }
    if (state.elapsed < 5000) stats.quickWords++;
    if (state.hintWord === word) {
      state.hintWord = "";
      hintLineEl.textContent = "";
    }

    stats.words++;
    sfx(word.length >= 6 ? "long" : "word");
    dom.announce(liveEl, `Found ${word}, ${pts} point${pts === 1 ? "" : "s"}. Score ${state.score}.`);
    if (word.length >= 6) {
      showToast(`${word} · ${word.length} letters`, `+${pts} points`, "✨");
    }

    clearPath();
    renderFound();
    updateHUD();
    checkAchievements();
    saveStats();

    if (state.possible.length && state.found.size >= state.possible.length) {
      endRound("clear");
    }
  }

  function useHint() {
    if (!canEdit()) return;
    if (state.mode !== "zen" && state.hintsLeft <= 0) {
      showToast("No hints left", "You've used all your hints for this board.", "💡");
      sfx("error");
      return;
    }

    const remaining = state.possible.filter((w) => !state.found.has(w));
    if (!remaining.length) {
      endRound("clear");
      return;
    }

    // Prefer a long word so the hint feels valuable.
    remaining.sort((a, b) => b.length - a.length || a.localeCompare(b));
    const pick = remaining[Math.floor(Math.random() * Math.min(6, remaining.length))];
    state.hintWord = pick;
    hintLineEl.textContent = `Hint: ${pick} · ${pick.length} letters · ${wordPoints(pick.length)} pts`;
    state.hintsUsed++;
    stats.hintsUsed++;
    if (state.mode !== "zen") state.hintsLeft--;
    sfx("hint");
    updateHUD();
    checkAchievements();
    saveStats();
    dom.announce(liveEl, `Hint: ${pick}, ${pick.length} letters.`);
  }

  // ---------- Win / lose ----------
  function endRound(reason) {
    if (state.over) return;
    state.over = true;
    state.finished = true;
    state.paused = false;
    state.dragging = false;
    state.tapMode = false;
    state.path = [];

    const foundCount = state.found.size;
    const possibleCount = state.possible.length;
    const perfect = possibleCount > 0 && foundCount >= possibleCount;

    stats.rounds++;
    stats.totalScore += state.score;
    stats.bestScore = Math.max(stats.bestScore, state.score);
    stats.maxRoundWords = Math.max(stats.maxRoundWords, foundCount);
    if (state.longest > stats.longest) {
      stats.longest = state.longest;
      stats.bestWord = state.longestWord;
    }
    stats.playTime += Math.round(state.elapsed);
    if (state.hintsUsed === 0 && foundCount > 0) stats.noHintRounds++;
    if (state.mode === "classic" && foundCount > 0) stats.classicWins++;
    if (state.size === 5) {
      stats.bigBoards++;
      stats.fiveBest = Math.max(stats.fiveBest, state.score);
    }
    if (state.mode === "zen") stats.zenMax = Math.max(stats.zenMax, foundCount);
    if (perfect && state.size === 4) stats.perfect++;
    if (new Date().getHours() < 5) stats.nightWins++;

    if (state.mode === "daily" && foundCount > 0) recordDailyWin();

    const rec = store.json(K.best(state.mode, state.size), null);
    const prevScore = rec && rec.s ? rec.s : 0;
    const isRecord = state.score > prevScore || !rec;
    if (isRecord) {
      store.jsonSet(K.best(state.mode, state.size), {
        s: Math.max(prevScore, state.score),
        w: Math.max((rec && rec.w) || 0, foundCount),
      });
    }

    saveStats();
    checkAchievements();
    updateHUD();
    renderCells();
    renderTray();
    renderMissed();
    sfx(perfect || reason === "clear" ? "win" : "over");
    if (isRecord || perfect) confetti(80);

    const timeText = state.mode === "zen" ? "Zen" : formatTime(state.elapsed);
    const title =
      reason === "clear" ? "Board Cleared! ✨" : reason === "time" ? "Time's up! ⏰" : "Round Complete";
    const missedCount = possibleCount - foundCount;
    const msg =
      `${SIZES[state.size].name} · ${timeText} · Score ${state.score} · ` +
      `${foundCount}/${possibleCount} words` +
      (missedCount > 0 ? ` · ${missedCount} missed` : "") +
      (state.longestWord ? ` · Best ${state.longestWord} (${state.longest})` : "") +
      (isRecord ? " · New Best!" : "");

    showOverlay(title, msg, [
      { label: "Play Again", onClick: () => { hideOverlay(); newPuzzle(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
      { label: "Change Mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
    ]);
  }

  function recordDailyWin() {
    if (state.mode !== "daily") return;
    const today = dateStr();
    if (daily.lastDate === today) return;
    daily.streak = daily.lastDate === util.yesterdayStr() ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.history[today] = {
      s: state.score,
      w: state.found.size,
      d: state.size,
    };
    const keys = Object.keys(daily.history).sort();
    while (keys.length > 21) delete daily.history[keys.shift()];
    stats.dailySolves++;
    store.jsonSet(K.daily, daily);
    saveStats();
  }

  // ---------- Game flow ----------
  function newPuzzle() {
    hideOverlay();
    state.dragging = false;
    state.tapMode = false;

    const seed = state.mode === "daily" ? `${dateStr()}-${state.size}` : null;
    const rand = seed ? mulberry32(hashSeed(seed)) : Math.random;
    const gen = generateBoard(state.size, rand);

    state.faces = gen.faces;
    state.possible = gen.words;
    state.found = new Map();
    state.path = [];
    state.score = 0;
    state.hintsLeft = MODES[state.mode].hints;
    state.hintsUsed = 0;
    state.invalid = 0;
    state.longest = 0;
    state.longestWord = "";
    state.hintWord = "";
    state.elapsed = 0;
    state.remaining = MODES[state.mode].timed
      ? (MODES[state.mode].baseTime + SIZES[state.size].extraTime) * 1000
      : 0;
    state.countdown = 1200;
    state.started = false;
    state.paused = false;
    state.over = false;
    state.finished = false;
    state.flashWord = "";
    hintLineEl.textContent = "";
    lastTimeText = "";
    pauseBtn.textContent = "Pause";
    missedWrapEl.hidden = true;

    buildBoard();
    renderCells();
    renderTray();
    renderFound();
    renderMissed();
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

  function setSize(s) {
    if (!SIZES[s] || s === state.size) return;
    state.size = s;
    store.set(K.size, String(s));
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

  // ---------- Main loop ----------
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
      if (MODES[state.mode].timed) {
        state.elapsed += dt;
        state.remaining -= dt;
        if (state.remaining <= 0) {
          state.remaining = 0;
          updateTimeDisplay();
          endRound("time");
          return;
        }
      } else {
        state.elapsed += dt;
      }
    }

    updateTimeDisplay();
  }

  // ---------- Input ----------
  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest) return null;
    const cell = el.closest(".bg-cell");
    if (!cell || !boardEl.contains(cell)) return null;
    return cell;
  }

  function cellIndex(cell) {
    return Number(cell.dataset.idx);
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!canEdit()) return;
    const cell = e.target.closest ? e.target.closest(".bg-cell") : null;
    if (!cell) return;
    e.preventDefault();

    const idx = cellIndex(cell);
    const last = state.path[state.path.length - 1];

    if (state.tapMode && state.path.length) {
      if (idx === last) {
        submitPath();
        return;
      }
      if (state.path.length >= 2 && state.path[state.path.length - 2] === idx) {
        state.path.pop();
        renderCells();
        renderTray();
        updateHUD();
        return;
      }
      const pos = state.path.indexOf(idx);
      if (pos >= 0) {
        state.path = state.path.slice(0, pos + 1);
        renderCells();
        renderTray();
        updateHUD();
        return;
      }
      if (isAdjacent(last, idx, state.size)) {
        state.path.push(idx);
        renderCells();
        renderTray();
        updateHUD();
        sfx("select");
        return;
      }
      state.path = [idx];
      state.tapMode = true;
      state.dragging = false;
      renderCells();
      renderTray();
      updateHUD();
      return;
    }

    state.path = [idx];
    state.dragging = true;
    state.tapMode = false;
    state.moved = false;
    renderCells();
    renderTray();
    updateHUD();
  }

  function onPointerMove(e) {
    if (!state.dragging || !canEdit()) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const idx = cellIndex(cell);
    const last = state.path[state.path.length - 1];
    if (idx === last) return;
    state.moved = true;

    if (state.path.length >= 2 && state.path[state.path.length - 2] === idx) {
      state.path.pop();
      renderCells();
      renderTray();
      updateHUD();
      return;
    }
    if (state.path.includes(idx)) {
      state.path = state.path.slice(0, state.path.indexOf(idx) + 1);
      renderCells();
      renderTray();
      updateHUD();
      return;
    }
    if (isAdjacent(last, idx, state.size)) {
      state.path.push(idx);
      renderCells();
      renderTray();
      updateHUD();
      sfx("select");
    }
  }

  function onPointerUp() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.moved) {
      if (state.path.length >= 3) submitPath();
      else clearPath();
      state.tapMode = false;
    } else {
      // A tap starts click-to-build mode.
      state.tapMode = true;
      renderTray();
      updateHUD();
    }
  }

  function onBoardKeyDown(e) {
    const cell = e.target.closest ? e.target.closest(".bg-cell") : null;
    if (!cell) return;
    const idx = cellIndex(cell);
    const n = state.size;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!canEdit()) return;
      const last = state.path[state.path.length - 1];
      if (state.path.length && idx === last) {
        submitPath();
      } else {
        addCell(idx);
      }
      return;
    }

    const moves = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const r = Math.floor(idx / n);
      const c = idx % n;
      const nr = Math.min(n - 1, Math.max(0, r + moves[e.key][0]));
      const nc = Math.min(n - 1, Math.max(0, c + moves[e.key][1]));
      const target = cellEls[nr * n + nc];
      if (target) target.focus();
    }
  }

  function onKeyDown(e) {
    const k = e.key;
    const lower = k.toLowerCase();

    if (!achvModal.hidden) {
      if (k === "Escape") {
        closeAchv();
        e.preventDefault();
      } else if (k === "Tab") {
        const focusable = achvModal.querySelector(".snake-modal__head [data-close]");
        if (focusable) {
          focusable.focus();
          e.preventDefault();
        }
      }
      return;
    }

    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    const onCell = !!(e.target.closest && e.target.closest(".bg-cell"));
    if (onCell && (k === "Enter" || k === " ")) return;
    if (tag === "button" && (k === " " || k === "Enter")) return;

    if (k === "Escape") {
      if (state.path.length) {
        clearPath();
        e.preventDefault();
      } else if (state.paused) {
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

    if (k === "Backspace") {
      e.preventDefault();
      if (state.path.length) {
        state.path.pop();
        renderCells();
        renderTray();
        updateHUD();
      }
      return;
    }

    if (lower === "h") {
      useHint();
      return;
    }

    if (lower === "c") {
      clearPath();
      return;
    }

    if (lower === "n") {
      if (state.mode !== "daily") newPuzzle();
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
        const s = Number(btn.dataset.size);
        if (!SIZES[s] || s === state.size) return;
        sfx("click");
        setSize(s);
      });
    });

    submitBtn.addEventListener("click", submitPath);
    clearBtn.addEventListener("click", clearPath);
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

    boardEl.addEventListener("pointerdown", onPointerDown);
    boardEl.addEventListener("keydown", onBoardKeyDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", () => {
      state.dragging = false;
      if (!state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    document.addEventListener("keydown", onKeyDown);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !state.over && !state.paused && state.started && achvModal.hidden) {
        setPaused(true, false);
      }
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    const savedSize = Number(store.get(K.size, "4"));
    state.size = SIZES[savedSize] ? savedSize : 4;

    const savedMode = store.get(K.mode, "classic");
    state.mode = MODES[savedMode] ? savedMode : "classic";

    updateBadgeCount();
    bindEvents();
    newPuzzle();
    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__BG = {
    state,
    stats,
    daily,
    MODES,
    SIZES,
    ACHIEVEMENTS,
    DICE4,
    WORD_SET,
    wordPoints,
    isAdjacent,
    facesFromDie,
    roll4,
    roll5,
    solveBoard,
    generateBoard,
    buildBoard,
    renderCells,
    renderTray,
    renderFound,
    updateHUD,
    updateTimeDisplay,
    updateCountdown,
    newPuzzle,
    setMode,
    setSize,
    startPlay,
    submitPath,
    clearPath,
    addCell,
    useHint,
    endRound,
    checkAchievements,
    saveStats,
    loop,
    setPaused,
    togglePause,
    unlocked: () => achv.list(),
    snap: () => ({
      mode: state.mode,
      size: state.size,
      faces: state.faces.slice(),
      possible: state.possible.slice(),
      possibleCount: state.possible.length,
      found: Array.from(state.found.entries()),
      path: state.path.slice(),
      dragging: state.dragging,
      tapMode: state.tapMode,
      score: state.score,
      hintsLeft: state.hintsLeft,
      hintsUsed: state.hintsUsed,
      invalid: state.invalid,
      longest: state.longest,
      longestWord: state.longestWord,
      elapsed: state.elapsed,
      remaining: state.remaining,
      started: state.started,
      paused: state.paused,
      over: state.over,
      finished: state.finished,
      hintWord: state.hintWord,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
      cellEls: cellEls.length,
    }),
  };

  init();
})();