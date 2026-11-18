// Tower of Hanoi — pure vanilla JS, fully offline. DOM-based pegs & discs.
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
  const movesEl = dom.byId("moves");
  const minEl = dom.byId("min-moves");
  const bestEl = dom.byId("best");
  const solvedEl = dom.byId("solved");
  const boardEl = dom.byId("board");
  const pegEls = dom.all(".peg", boardEl).map((el) => ({
    el,
    p: Number(el.dataset.peg),
  }));
  const ringSel = dom.byId("ring-select");
  const undoBtn = dom.byId("undo-btn");
  const solveBtn = dom.byId("solve-btn");
  const cancelBtn = dom.byId("cancel-btn");
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
  const HINT_DEFAULT =
    "Click a peg to lift its top disc, then click another peg to drop it. Move every ring to the Goal peg.";
  const DISC_COLORS = [
    ["#ffe98a", "#f2c037"], // 1 — smallest
    ["#ffd0a0", "#ff8c1a"],
    ["#ff9ecd", "#ff5ea8"],
    ["#ff9d8a", "#ef4d38"],
    ["#d6a6ff", "#8b3df0"],
    ["#a8e6ff", "#38a6ef"],
    ["#8affd2", "#10b981"], // 7 — largest
  ];

  const K = makeKeys("hanoi");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0, // towers solved
    perfect: 0, // solved in exactly the minimum number of moves
    perfect5: 0, // perfect solve with 5+ rings
    solved3: 0,
    solved4: 0,
    solved5: 0,
    solved6: 0,
    solved7: 0,
    totalMoves: 0,
    records: 0, // personal bests set
    undone: 0,
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
   * Carry the pre-core counters (hanoi-wins, hanoi-best-<n> numbers) into
   * the standard stats blob / best-record keys, then drop the legacy keys
   * so both formats never diverge.
   */
  function migrateLegacy() {
    const rawWins = store.get("hanoi-wins", null);
    if (rawWins !== null && rawWins !== undefined) {
      const n = Number(rawWins);
      if (Number.isFinite(n) && n > stats.games) stats.games = n;
      store.remove("hanoi-wins");
    }
    for (let n = 3; n <= 7; n++) {
      const legacyKey = "hanoi-best-" + n;
      const raw = store.get(legacyKey, null);
      if (raw === null || raw === undefined) continue;
      const b = Number(raw);
      if (Number.isFinite(b) && b > 0) {
        const key = K.best("rings", n);
        const cur = store.json(key, null);
        const curS = cur && Number.isFinite(cur.s) ? cur.s : 0;
        if (b > curS) store.jsonSet(key, { s: b });
      }
      store.remove(legacyKey);
    }
    saveStats();
  }

  // ---------- Best records (per ring count) ----------
  function getBest(n) {
    const rec = store.json(K.best("rings", n), null);
    return rec && Number.isFinite(rec.s) ? rec.s : 0; // 0 = no record yet
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🧗", name: "First Steps", desc: "Solve your first tower.", stat: "games", goal: 1 },
    { id: "perfect", icon: "🎯", name: "Optimal", desc: "Solve a tower in exactly the minimum moves.", stat: "perfect", goal: 1 },
    { id: "perfect5", icon: "✨", name: "Flawless Five", desc: "Solve a 5+ ring tower optimally.", stat: "perfect5", goal: 1 },
    { id: "rings3", icon: "🔵", name: "Warm-Up", desc: "Solve a 3-ring tower.", stat: "solved3", goal: 1 },
    { id: "rings5", icon: "🟣", name: "Getting Tall", desc: "Solve a 5-ring tower.", stat: "solved5", goal: 1 },
    { id: "rings7", icon: "🟢", name: "Seven Rings", desc: "Solve a 7-ring tower.", stat: "solved7", goal: 1 },
    {
      id: "allRings",
      icon: "🌈",
      name: "Every Size",
      desc: "Solve towers of every ring size (3 to 7).",
      stat: "games",
      goal: 1,
      satisfied: () => [3, 4, 5, 6, 7].every((n) => stats["solved" + n] >= 1),
      progress: () => {
        const got = [3, 4, 5, 6, 7].filter((n) => stats["solved" + n] >= 1).length;
        return {
          pct: (got / 5) * 100,
          now: got,
          text: got === 5 ? "Unlocked" : got + " / 5 sizes",
        };
      },
    },
    { id: "games5", icon: "🧩", name: "Puzzle Fan", desc: "Solve 5 towers.", stat: "games", goal: 5 },
    { id: "games10", icon: "🗼", name: "Tower Builder", desc: "Solve 10 towers.", stat: "games", goal: 10 },
    { id: "games25", icon: "👑", name: "Hanoi Master", desc: "Solve 25 towers.", stat: "games", goal: 25 },
    { id: "moves100", icon: "🚶", name: "Moving Day", desc: "Make 100 moves in total.", stat: "totalMoves", goal: 100 },
    { id: "moves1000", icon: "🏃", name: "Marathon", desc: "Make 1000 moves in total.", stat: "totalMoves", goal: 1000 },
    { id: "records5", icon: "📈", name: "Record Setter", desc: "Set 5 personal bests.", stat: "records", goal: 5 },
    { id: "undo10", icon: "↩️", name: "Second Thoughts", desc: "Use undo 10 times.", stat: "undone", goal: 10 },
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
        ["Solved", stats.games],
        ["Optimal solves", stats.perfect],
        ["Total moves", stats.totalMoves],
        ["Bests set", stats.records],
        ["Undos", stats.undone],
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
  let ringCount = 4;
  let pegs = [[], [], []]; // each peg: bottom → top disc numbers
  let moves = 0;
  let history = [];
  let held = null;
  let gameOver = false;
  let paused = false;
  let autoPlaying = false;
  let autoTimer = null;
  let autoPlan = [];
  let autoIndex = 0;
  let dropFx = null; // { p, d } — one-shot landing animation after a move

  const minMoves = (n) => Math.pow(2, n) - 1;

  function discWidth(d) {
    const w = window.innerWidth || 800;
    const avail = Math.max(88, Math.min(146, Math.floor((w - 140) / 3) - 16));
    return Math.round(46 + (avail - 46) * (d - 1) / Math.max(1, ringCount - 1));
  }

  const heldDisc = () => (held === null ? null : pegs[held][pegs[held].length - 1]);
  const canDrop = (p, d) => pegs[p].length === 0 || pegs[p][pegs[p].length - 1] > d;

  // ---------- Rendering ----------
  function render() {
    for (const { el, p } of pegEls) {
      const stack = el.querySelector(".peg__stack");
      stack.innerHTML = "";
      const list = pegs[p];
      // The flex column paints its FIRST child at the top, while a peg is
      // stored bottom → top. Append in reverse so large rings sit at the
      // bottom and the smallest ring is visibly on top.
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        const disc = document.createElement("div");
        disc.className = "disc";
        disc.style.width = discWidth(d) + "px";
        const [c1, c2] = DISC_COLORS[d - 1];
        disc.style.background = `linear-gradient(180deg, ${c1} 0%, ${c2} 78%)`;
        if (held === p && d === list[list.length - 1]) disc.classList.add("disc--held");
        if (dropFx && dropFx.p === p && dropFx.d === d) disc.classList.add("disc--drop");
        stack.appendChild(disc);
      }
      el.classList.toggle("peg--source", held === p);
      el.classList.toggle("peg--drop", !!dropFx && dropFx.p === p);
      const droppable = held !== null && p !== held && canDrop(p, heldDisc());
      el.classList.toggle("peg--ok", droppable);
    }
    dropFx = null;
    updateHud();
  }

  function updateHud() {
    movesEl.textContent = moves;
    minEl.textContent = minMoves(ringCount);
    const best = getBest(ringCount);
    bestEl.textContent = best > 0 ? String(best) : "—";
    solvedEl.textContent = stats.games;

    const canAct = !gameOver && !paused && !autoPlaying;
    undoBtn.disabled = !canAct || history.length === 0;
    ringSel.disabled = !canAct;
    solveBtn.disabled = !canAct;
    newGameBtn.disabled = autoPlaying;
    cancelBtn.hidden = !autoPlaying;
    solveBtn.hidden = autoPlaying;
  }

  // ---------- Game flow ----------
  function doMove(from, to) {
    const d = pegs[from].pop();
    pegs[to].push(d);
    moves++;
    history.push([from, to]);
    stats.totalMoves++;
    if (held !== null && pegs[held].length === 0) held = null; // safety
    dropFx = { p: to, d };
    render();
    if (pegs[2].length === ringCount) onWin();
  }

  function onPegClick(p) {
    if (autoPlaying || gameOver || paused) return;
    if (held === null) {
      if (pegs[p].length > 0) {
        held = p;
        sfx("select");
        hintEl.textContent = "Disc lifted — click a highlighted peg to drop it, or the same peg to set it back.";
        render();
      }
      return;
    }
    if (held === p) {
      held = null;
      hintEl.textContent = HINT_DEFAULT;
      render();
      return;
    }
    const d = heldDisc();
    if (canDrop(p, d)) {
      const from = held;
      held = null;
      sfx("place");
      doMove(from, p);
      if (!gameOver) hintEl.textContent = HINT_DEFAULT;
    } else {
      sfx("error");
      const pegEl = pegEls[p].el;
      pegEl.classList.remove("peg--shake");
      void pegEl.offsetWidth; // restart animation
      pegEl.classList.add("peg--shake");
      hintEl.textContent = "A larger disc can't sit on a smaller one!";
    }
  }

  function onWin() {
    gameOver = true;
    paused = false;
    stopAuto();

    const min = minMoves(ringCount);
    const prev = getBest(ringCount);
    const isRecord = prev === 0 || moves < prev;
    if (isRecord) {
      store.jsonSet(K.best("rings", ringCount), { s: moves });
      stats.records++;
    }
    stats.games++;
    stats["solved" + ringCount]++;
    const perfectNow = moves === min;
    if (perfectNow) {
      stats.perfect++;
      if (ringCount >= 5) stats.perfect5++;
    }
    saveStats();
    checkAchievements();
    render();

    const perfectMsg = perfectNow ? " A perfect, optimal solution! 🏆" : "";
    const recordMsg = isRecord ? ` New best for ${ringCount} rings!` : "";
    sfx("win");
    confetti(90);
    showOverlay(
      "Tower Solved! 🎉",
      `Solved in ${moves} moves (minimum ${min}).${perfectMsg}${recordMsg}`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function newGame() {
    stopAuto();
    paused = false;
    ringCount = parseInt(ringSel.value, 10) || 4;
    pegs = [[], [], []];
    for (let d = ringCount; d >= 1; d--) pegs[0].push(d); // largest at the bottom
    moves = 0;
    history = [];
    held = null;
    gameOver = false;
    hideOverlay();
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function setRings(n) {
    const v = Math.max(3, Math.min(7, n));
    ringSel.value = String(v);
    newGame();
  }

  function undo() {
    if (autoPlaying || gameOver || paused || history.length === 0) return;
    const [from, to] = history.pop();
    const d = pegs[to].pop();
    pegs[from].push(d);
    moves = Math.max(0, moves - 1);
    held = null;
    dropFx = { p: from, d };
    stats.undone++;
    saveStats();
    checkAchievements();
    sfx("flip");
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  // ---------- Auto-solve (optimal plan from a fresh tower) ----------
  function pegOfDisc(state, d) {
    for (let p = 0; p < 3; p++) if (state[p].includes(d)) return p;
    return -1;
  }
  // Classic: move the k discs stacked on `from` onto `to`.
  function planStack(k, from, to, out) {
    if (k === 0) return;
    const aux = 3 - from - to;
    planStack(k - 1, from, aux, out);
    out.push([from, to]);
    planStack(k - 1, aux, to, out);
  }
  // Gather discs 1..k (in arbitrary legal spots in `state`) onto `target`.
  function planGather(k, target, state, out) {
    if (k === 0) return;
    const p = pegOfDisc(state, k);
    if (p === target) {
      planGather(k - 1, target, state, out);
      return;
    }
    const q = 3 - p - target;
    planGather(k - 1, q, state, out);
    out.push([p, target]);
    state[target].push(state[p].pop());
    planStack(k - 1, q, target, out);
  }

  function autoSolve() {
    if (autoPlaying || gameOver || paused) return;
    // Start from a fresh tower so the recursive optimal plan is guaranteed valid.
    newGame();
    const state = pegs.map((a) => a.slice());
    autoPlan = [];
    planGather(ringCount, 2, state, autoPlan);
    autoIndex = 0;
    autoPlaying = true;
    held = null;
    sfx("click");
    render();
    autoTimer = window.setInterval(() => autoStep(), 450);
  }

  function autoStep() {
    if (!autoPlaying) return;
    if (autoIndex >= autoPlan.length || gameOver) {
      stopAuto();
      return;
    }
    const [from, to] = autoPlan[autoIndex++];
    sfx("tick");
    doMove(from, to);
  }

  function stopAuto() {
    if (autoTimer) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
    autoPlaying = false;
    render();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      stopAuto();
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

    const lower = String(e.key || "").toLowerCase();
    if (lower === "p") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;

    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 3) {
      if (e.preventDefault) e.preventDefault();
      onPegClick(n - 1);
    }
  }

  function bindEvents() {
    pegEls.forEach(({ el, p }) => {
      el.addEventListener("click", () => {
        audio.unlock();
        onPegClick(p);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          audio.unlock();
          onPegClick(p);
        }
      });
    });

    undoBtn.addEventListener("click", () => { sfx("click"); undo(); });
    solveBtn.addEventListener("click", autoSolve);
    cancelBtn.addEventListener("click", stopAuto);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    ringSel.addEventListener("change", () => { sfx("click"); newGame(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", render);
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
  window.__HANOI = {
    pegs: () => pegs.map((a) => a.slice()),
    pegOf: (d) => pegs.findIndex((p) => p.includes(d)),
    get ringCount() { return ringCount; },
    get moves() { return moves; },
    get held() { return held; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get autoPlaying() { return autoPlaying; },
    get history() { return history.slice(); },
    stats,
    ACHIEVEMENTS,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    hint: () => hintEl.textContent,
    bestFor: getBest,
    click: onPegClick,
    undo,
    solve: autoSolve,
    step: autoStep,
    stopAuto,
    newGame,
    setRings,
    setPaused,
    togglePause,
    checkAchievements,
    saveStats,
    openAchv,
    closeAchv,
    minMoves,
    overlay,
  };

  init();
})();
