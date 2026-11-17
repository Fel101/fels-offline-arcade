// FreeCell — the classic open solitaire. Pure vanilla JS, fully offline.
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
  const freeCellsEl = dom.byId("free-cells");
  const foundationsEl = dom.byId("foundations");
  const columnsEl = dom.byId("columns");
  const movesEl = dom.byId("moves");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const newGameBtn = dom.byId("new-game");
  const undoBtn = dom.byId("undo");
  const giveUpBtn = dom.byId("give-up");
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
  const COLS = 8;
  const SUITS = ["♠", "♥", "♦", "♣"];
  const HINT_DEFAULT =
    "Select a card, then click a destination. Build down in alternating colors; foundations build up by suit from Ace. P pauses.";

  const K = makeKeys("freecell");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    totalMoves: 0, // career moves
    bestMoves: 0, // fewest moves in a winning game
    fastWins: 0, // wins in <= 120 moves
    speedWins: 0, // wins in <= 80 moves
    freeCellsUsed: 0, // cards placed in a free cell
    noUndoWins: 0, // wins without using undo
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
    { id: "first", icon: "🎯", name: "First Win", desc: "Clear your first deal.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Clear 5 deals.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Clear 10 deals.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Dedicated", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🏆", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Clear 2 deals in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Clear 3 deals in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Clear 5 deals in a row.", stat: "bestStreak", goal: 5 },
    { id: "moves100", icon: "👣", name: "Wanderer", desc: "Make 100 moves.", stat: "totalMoves", goal: 100 },
    { id: "fast120", icon: "💨", name: "Quick Thinker", desc: "Clear a deal in 120 moves or fewer.", stat: "fastWins", goal: 1 },
    { id: "fast80", icon: "🚀", name: "Speedrun", desc: "Clear a deal in 80 moves or fewer.", stat: "speedWins", goal: 1 },
    { id: "free25", icon: "🧊", name: "Cellar", desc: "Use a free cell 25 times.", stat: "freeCellsUsed", goal: 25 },
    { id: "noUndo", icon: "🧠", name: "No Safety Net", desc: "Clear a deal without using undo.", stat: "noUndoWins", goal: 1 },
    { id: "losses10", icon: "💤", name: "Persistence", desc: "Give up 10 games — keep trying!", stat: "losses", goal: 10 },
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
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Moves", stats.totalMoves],
        ["Best moves", stats.bestMoves],
        ["Best streak", stats.bestStreak],
        ["Free-cell uses", stats.freeCellsUsed],
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
  let columns = [];
  let free = [null, null, null, null];
  let found = [0, 0, 0, 0]; // top rank per suit (0 = empty)
  let selected = null; // {type:"column", col, index} | {type:"free", index}
  let moves = 0;
  let undoCount = 0;
  let history = [];
  let gameOver = false;
  let paused = false;
  let rng = Math.random;

  // ---------- Cards ----------
  function freshDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = d[i];
      d[i] = d[j];
      d[j] = tmp;
    }
    return d;
  }

  function isRed(card) {
    return card.s === 1 || card.s === 2;
  }

  function cardText(card) {
    const label = card.r === 1 ? "A" : card.r === 11 ? "J" : card.r === 12 ? "Q" : card.r === 13 ? "K" : String(card.r);
    return label + SUITS[card.s];
  }

  // ---------- Rules ----------
  function isSequence(cards) {
    for (let i = 0; i < cards.length - 1; i++) {
      if (cards[i].r !== cards[i + 1].r + 1) return false;
      if (isRed(cards[i]) === isRed(cards[i + 1])) return false;
    }
    return true;
  }

  function getSelectedCards() {
    if (!selected) return null;
    if (selected.type === "free") return free[selected.index] ? [free[selected.index]] : null;
    return columns[selected.col].slice(selected.index);
  }

  function maxMovable(targetEmpty) {
    let emptyCols = 0;
    for (const c of columns) if (c.length === 0) emptyCols++;
    if (targetEmpty) emptyCols = Math.max(0, emptyCols - 1);
    const freeCount = free.filter((x) => x === null).length;
    return (freeCount + 1) * Math.pow(2, emptyCols);
  }

  function canMoveToColumn(cards, col) {
    if (!cards || cards.length === 0) return false;
    if (selected && selected.type === "column" && selected.col === col) return false;
    const target = columns[col];
    const top = target.length ? target[target.length - 1] : null;
    if (top) {
      if (!(top.r === cards[0].r + 1 && isRed(top) !== isRed(cards[0]))) return false;
    }
    return cards.length <= maxMovable(target.length === 0);
  }

  // ---------- History ----------
  function snapshot() {
    return {
      columns: columns.map((c) => c.slice()),
      free: free.slice(),
      found: found.slice(),
      moves,
      undoCount,
    };
  }

  function pushHistory() {
    history.push(snapshot());
    if (history.length > 300) history.shift();
  }

  function restore(s) {
    columns = s.columns.map((c) => c.slice());
    free = s.free.slice();
    found = s.found.slice();
    moves = s.moves;
    undoCount = s.undoCount;
  }

  function undo() {
    if (gameOver || paused || history.length === 0) return;
    const s = history.pop();
    restore(s);
    undoCount++;
    selected = null;
    sfx("click");
    render();
  }

  // ---------- Moves ----------
  function selectFromColumn(col, index) {
    if (index < 0 || index >= columns[col].length) return false;
    const cards = columns[col].slice(index);
    if (!isSequence(cards)) return false;
    selected = { type: "column", col, index };
    sfx("click");
    render();
    return true;
  }

  function selectFree(i) {
    if (!free[i]) return false;
    selected = { type: "free", index: i };
    sfx("click");
    render();
    return true;
  }

  function tryMoveToColumn(col) {
    const cards = getSelectedCards();
    if (!canMoveToColumn(cards, col)) return false;
    pushHistory();
    if (selected.type === "column") {
      columns[selected.col].splice(selected.index);
    } else {
      free[selected.index] = null;
    }
    for (const c of cards) columns[col].push(c);
    moves++;
    stats.totalMoves++;
    selected = null;
    sfx("place");
    saveStats();
    checkAchievements();
    checkWin();
    render();
    return true;
  }

  function tryMoveToFree(i) {
    if (!selected || free[i] !== null) return false;
    const cards = getSelectedCards();
    if (!cards || cards.length !== 1) return false;
    if (selected.type !== "column") return false;
    const src = columns[selected.col];
    if (selected.index !== src.length - 1) return false; // only a column's top card
    pushHistory();
    free[i] = src.pop();
    moves++;
    stats.totalMoves++;
    stats.freeCellsUsed++;
    selected = null;
    sfx("place");
    saveStats();
    checkAchievements();
    render();
    return true;
  }

  function tryMoveToFoundation(s) {
    if (!selected) return false;
    const cards = getSelectedCards();
    if (!cards || cards.length !== 1) return false;
    const card = cards[0];
    if (card.s !== s) return false;
    if (card.r !== found[s] + 1) return false;
    pushHistory();
    if (selected.type === "column") {
      columns[selected.col].pop();
    } else {
      free[selected.index] = null;
    }
    found[s]++;
    moves++;
    stats.totalMoves++;
    selected = null;
    sfx("match");
    saveStats();
    checkAchievements();
    checkWin();
    render();
    return true;
  }

  function checkWin() {
    if (found[0] === 13 && found[1] === 13 && found[2] === 13 && found[3] === 13) win();
  }

  // ---------- End states ----------
  function win() {
    if (gameOver) return;
    gameOver = true;
    stats.games++;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (moves <= 120) stats.fastWins++;
    if (moves <= 80) stats.speedWins++;
    if (undoCount === 0) stats.noUndoWins++;
    if (stats.bestMoves === 0 || moves < stats.bestMoves) stats.bestMoves = moves;
    saveStats();
    checkAchievements();
    render();
    sfx("win");
    confetti(90);
    showOverlay("You win! 🎉", `Cleared in ${moves} move${moves === 1 ? "" : "s"}.`, [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  function giveUp() {
    if (gameOver) return;
    if (moves === 0) { newGame(); return; }
    gameOver = true;
    stats.games++;
    stats.losses++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    render();
    sfx("over");
    showOverlay("Deal abandoned", `You gave up after ${moves} move${moves === 1 ? "" : "s"}.`, [
      { label: "New deal", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ]);
  }

  // ---------- Rendering ----------
  function isSelected(col, index) {
    return !!selected && selected.type === "column" && selected.col === col && index >= selected.index;
  }

  function renderFreeCells() {
    freeCellsEl.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement("button");
      slot.type = "button";
      let cls = "slot slot--free";
      let text = "";
      if (free[i]) {
        cls += " fcard";
        if (isRed(free[i])) cls += " fcard--red";
        if (selected && selected.type === "free" && selected.index === i) cls += " fcard--sel";
        text = cardText(free[i]);
      }
      slot.className = cls;
      slot.textContent = text;
      slot.setAttribute("data-free", String(i));
      slot.setAttribute("aria-label", free[i] ? `Free cell ${i + 1}: ${cardText(free[i])}` : `Empty free cell ${i + 1}`);
      freeCellsEl.appendChild(slot);
    }
  }

  function renderFoundations() {
    foundationsEl.innerHTML = "";
    for (let s = 0; s < 4; s++) {
      const slot = document.createElement("button");
      slot.type = "button";
      let cls = "slot slot--found";
      let text = "";
      if (found[s] > 0) {
        cls += " fcard";
        const top = { r: found[s], s };
        if (isRed(top)) cls += " fcard--red";
        text = cardText(top);
      }
      slot.className = cls;
      slot.textContent = text;
      slot.setAttribute("data-found", String(s));
      slot.setAttribute("aria-label", found[s] > 0 ? `${SUITS[s]} foundation, up to ${cardText({ r: found[s], s })}` : `${SUITS[s]} foundation, empty`);
      foundationsEl.appendChild(slot);
    }
  }

  function renderColumns() {
    columnsEl.innerHTML = "";
    for (let col = 0; col < COLS; col++) {
      const colEl = document.createElement("div");
      colEl.className = "column";
      colEl.setAttribute("data-col", String(col));
      const cards = columns[col];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const btn = document.createElement("button");
        btn.type = "button";
        let cls = "fcard";
        if (isRed(card)) cls += " fcard--red";
        if (isSelected(col, i)) cls += " fcard--sel";
        btn.className = cls;
        btn.textContent = cardText(card);
        btn.setAttribute("data-col", String(col));
        btn.setAttribute("data-index", String(i));
        btn.setAttribute("aria-label", `${cardText(card)}${isSelected(col, i) ? ", selected" : ""}`);
        colEl.appendChild(btn);
      }
      columnsEl.appendChild(colEl);
    }
  }

  function updateHud() {
    movesEl.textContent = moves;
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  function render() {
    renderFreeCells();
    renderFoundations();
    renderColumns();
    updateHud();
  }

  // ---------- Flow ----------
  function newGame() {
    columns = Array.from({ length: COLS }, () => []);
    free = [null, null, null, null];
    found = [0, 0, 0, 0];
    selected = null;
    moves = 0;
    undoCount = 0;
    history = [];
    gameOver = false;
    paused = false;
    hideOverlay();
    const deck = freshDeck();
    for (let i = 0; i < 52; i++) columns[i % COLS].push(deck[i]);
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
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

    const key = String(e.key || "").toLowerCase();
    if (key === "p") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    } else if (key === "z" && (e.ctrlKey || e.metaKey)) {
      if (e.preventDefault) e.preventDefault();
      undo();
    }
  }

  function onFreeCellsClick(e) {
    const slot = e.target && e.target.closest ? e.target.closest(".slot--free") : null;
    if (!slot) return;
    audio.unlock();
    const i = parseInt(slot.getAttribute("data-free"), 10);
    if (!Number.isFinite(i)) return;
    if (selected) {
      if (tryMoveToFree(i)) return;
      if (free[i]) selectFree(i);
      return;
    }
    if (free[i]) selectFree(i);
  }

  function onFoundationsClick(e) {
    const slot = e.target && e.target.closest ? e.target.closest(".slot--found") : null;
    if (!slot) return;
    audio.unlock();
    const s = parseInt(slot.getAttribute("data-found"), 10);
    if (!Number.isFinite(s)) return;
    if (selected) tryMoveToFoundation(s);
  }

  function onColumnsClick(e) {
    const card = e.target && e.target.closest ? e.target.closest(".fcard") : null;
    if (card) {
      if (e.stopPropagation) e.stopPropagation();
      audio.unlock();
      const col = parseInt(card.getAttribute("data-col"), 10);
      const index = parseInt(card.getAttribute("data-index"), 10);
      if (!Number.isFinite(col) || !Number.isFinite(index)) return;
      if (selected) {
        if (selected.type === "column" && selected.col === col) {
          selectFromColumn(col, index);
          return;
        }
        if (tryMoveToColumn(col)) return;
        selectFromColumn(col, index);
        return;
      }
      selectFromColumn(col, index);
      return;
    }
    const colEl = e.target && e.target.closest ? e.target.closest(".column") : null;
    if (colEl) {
      audio.unlock();
      const col = parseInt(colEl.getAttribute("data-col"), 10);
      if (Number.isFinite(col) && selected) tryMoveToColumn(col);
    }
  }

  function bindEvents() {
    freeCellsEl.addEventListener("click", onFreeCellsClick);
    foundationsEl.addEventListener("click", onFoundationsClick);
    columnsEl.addEventListener("click", onColumnsClick);
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });
    undoBtn.addEventListener("click", () => { sfx("click"); undo(); });
    giveUpBtn.addEventListener("click", () => { sfx("click"); giveUp(); });

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
  window.__FREECELL = {
    COLS,
    get columns() { return columns.map((c) => c.map((x) => ({ r: x.r, s: x.s }))); },
    get free() { return free.map((x) => (x ? { r: x.r, s: x.s } : null)); },
    get found() { return found.slice(); },
    get selected() { return selected ? Object.assign({}, selected) : null; },
    get moves() { return moves; },
    get undoCount() { return undoCount; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get historyLength() { return history.length; },
    stats,
    ACHIEVEMENTS,
    freshDeck,
    isRed,
    cardText,
    isSequence,
    getSelectedCards,
    maxMovable,
    canMoveToColumn,
    selectFromColumn,
    selectFree,
    tryMoveToColumn,
    tryMoveToFree,
    tryMoveToFoundation,
    undo,
    giveUp,
    win,
    checkWin,
    newGame,
    // Test-only: deterministic RNG.
    setRng: (fn) => { rng = typeof fn === "function" ? fn : Math.random; },
    // Test-only: install a position.
    setState: (s) => {
      s = s || {};
      if (s.columns) columns = s.columns.map((c) => c.map((x) => (x ? { r: x.r, s: x.s } : x)));
      if (s.free) free = s.free.map((x) => (x ? { r: x.r, s: x.s } : null));
      if (s.found) found = s.found.slice();
      if (Number.isFinite(s.moves)) moves = s.moves;
      if (s.selected !== undefined) selected = s.selected;
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