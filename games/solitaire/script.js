// Solitaire (Klondike) — pure vanilla JS, fully offline. Click to move.
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
  const stockEl = dom.byId("stock");
  const wasteEl = dom.byId("waste");
  const foundationsEl = dom.byId("foundations");
  const tableauEl = dom.byId("tableau");
  const movesEl = dom.byId("moves");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");
  const drawModeBtn = dom.byId("draw-mode");
  const recycleBtn = dom.byId("recycle");
  const stockCountEl = dom.byId("stock-count");

  toast.bind(dom.byId("toasts"));

  const SUITS = [
    { s: "spades", e: "♠", color: "black" },
    { s: "hearts", e: "♥", color: "red" },
    { s: "diamonds", e: "♦", color: "red" },
    { s: "clubs", e: "♣", color: "black" },
  ];
  const RANKS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const rankLabel = (r) => RANKS[r] || String(r);

  const K = makeKeys("solitaire");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    wins: 0,
    games: 0,
    moves: 0,
    streak: 0,
    bestStreak: 0,
    bestMoves: 0, // fewest moves in a win (0 = no win yet)
    recycles: 0,
    draws: 0,
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

  // Carry the pre-core win counter across.
  function migrateLegacy() {
    const raw = store.get("sol-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("sol-wins");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Clear", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏆", name: "Card Sharp", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Grandmaster", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "moves500", icon: "👣", name: "Busy Hands", desc: "Make 500 moves in total.", stat: "moves", goal: 500 },
    { id: "moves2000", icon: "🥾", name: "Marathon", desc: "Make 2,000 moves in total.", stat: "moves", goal: 2000 },
    { id: "games10", icon: "🎲", name: "Deal Me In", desc: "Deal 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗓️", name: "Old Hand", desc: "Deal 25 games.", stat: "games", goal: 25 },
    { id: "recycle10", icon: "🔄", name: "Going Around", desc: "Recycle the stock 10 times.", stat: "recycles", goal: 10 },
    { id: "draws500", icon: "🃏", name: "Card Counter", desc: "Draw 500 cards.", stat: "draws", goal: 500 },
    {
      id: "quick150",
      icon: "🧠",
      name: "Efficient",
      desc: "Win a game in 150 moves or fewer.",
      satisfied: () => stats.bestMoves > 0 && stats.bestMoves <= 150,
      progress: () => {
        if (!stats.bestMoves) return { pct: 0, now: 0, text: "Win a game first" };
        return {
          pct: stats.bestMoves <= 150 ? 100 : (150 / stats.bestMoves) * 100,
          now: stats.bestMoves,
          text: "Best: " + stats.bestMoves + " moves",
        };
      },
    },
    {
      id: "quick100",
      icon: "⚡",
      name: "Speed Run",
      desc: "Win a game in 100 moves or fewer.",
      satisfied: () => stats.bestMoves > 0 && stats.bestMoves <= 100,
      progress: () => {
        if (!stats.bestMoves) return { pct: 0, now: 0, text: "Win a game first" };
        return {
          pct: stats.bestMoves <= 100 ? 100 : (100 / stats.bestMoves) * 100,
          now: stats.bestMoves,
          text: "Best: " + stats.bestMoves + " moves",
        };
      },
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
        ["Wins", stats.wins],
        ["Games", stats.games],
        ["Best streak", stats.bestStreak],
        ["Best moves", stats.bestMoves || "—"],
        ["Recycles", stats.recycles],
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

  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });

  // ---------- Game state ----------
  // Klondike deals either 1 or 3 cards at a time. Persisted between visits.
  let drawCount = Number(store.get(K.mode, 1));
  if (drawCount !== 3) drawCount = 1;

  let state;
  let sel;
  let moves;
  let gameOver;
  let paused = false;

  function saveDrawMode() {
    store.set(K.mode, String(drawCount));
  }

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS)
      for (let r = 1; r <= 13; r++)
        deck.push({ suit: suit.s, rank: r, color: suit.color, faceUp: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function newGame() {
    // Abandoning a game in progress breaks the win streak.
    if (!gameOver && moves > 0) stats.streak = 0;

    const deck = makeDeck();
    state = { stock: [], waste: [], foundation: {}, tableau: [] };
    for (const suit of SUITS) state.foundation[suit.s] = [];
    for (let c = 0; c < 7; c++) state.tableau.push([]);
    for (let c = 0; c < 7; c++) {
      for (let n = 0; n <= c; n++) {
        const card = deck.pop();
        card.faceUp = n === c;
        state.tableau[c].push(card);
      }
    }
    while (deck.length) {
      const c = deck.pop();
      c.faceUp = false;
      state.stock.push(c);
    }
    sel = null;
    moves = 0;
    gameOver = false;
    paused = false;
    stats.games++;
    saveStats();
    checkAchievements();
    updateStatus();
    hideOverlay();
    render();
  }

  function updateStatus() {
    movesEl.textContent = moves;
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    if (stockCountEl) stockCountEl.textContent = state.stock.length;
    if (drawModeBtn) drawModeBtn.textContent = `Deal: ${drawCount} card${drawCount === 1 ? "" : "s"}`;
    if (recycleBtn) recycleBtn.disabled = state.waste.length === 0;
  }

  // ---- Accessors ----
  const wasteTop = () => state.waste[state.waste.length - 1] || null;
  const fundTop = (suit) => {
    const f = state.foundation[suit];
    return f[f.length - 1] || null;
  };
  const colTop = (col) => {
    const a = state.tableau[col];
    return a[a.length - 1] || null;
  };
  const colLen = (col) => state.tableau[col].length;

  function canToFoundation(card) {
    const f = state.foundation[card.suit];
    return f.length === 0 ? card.rank === 1 : fundTop(card.suit).rank === card.rank - 1;
  }

  // Can `first` (bottom of a moving stack) land on tableau column `col`?
  function canTableau(first, col) {
    if (col === (sel && sel.kind === "tableau" ? sel.col : -2)) return false;
    const top = colTop(col);
    if (!top) return first.rank === 13 && first.faceUp; // only Kings on empty
    return top.color !== first.color && top.rank === first.rank + 1;
  }

  function cardsInSource(src) {
    if (src.kind === "waste") return [wasteTop()];
    if (src.kind === "foundation") return [fundTop(SUITS[src.idx].s)];
    return state.tableau[src.col].slice(src.idx);
  }

  function isMovable(src) {
    const cards = cardsInSource(src);
    return cards.length && cards[0] && cards[0].faceUp;
  }

  // ---- Destination resolution from a click (kind, col, idx) ----
  function destFromClick(kind, col, idx) {
    if (kind === "foundation") return { kind: "foundation", suit: SUITS[col].s };
    if (kind === "tableau") {
      if (col !== undefined && (idx === undefined || idx === colLen(col) - 1))
        return { kind: "tableau", col };
    }
    return null;
  }

  function isValidMove(src, dest, cards) {
    const first = cards[0];
    if (!dest) return false;
    if (dest.kind === "foundation") {
      return cards.length === 1 && first.suit === dest.suit && canToFoundation(first);
    }
    if (dest.kind === "tableau") {
      if (dest.col === src.col) return false;
      return canTableau(first, dest.col);
    }
    return false;
  }

  function doMove(src, dest) {
    const cards = cardsInSource(src);
    if (!cards.length || !cards[0]) return false;
    // Remove from source.
    if (src.kind === "waste") {
      state.waste.pop();
      // In 3-card deal the uncovered card is the next one you may play.
      const next = wasteTop();
      if (next) next.faceUp = true;
    } else if (src.kind === "foundation") state.foundation[SUITS[src.idx].s].pop();
    else {
      const col = src.col;
      const start = src.idx;
      state.tableau[col].splice(start);
      const exposed = colTop(col);
      if (exposed && !exposed.faceUp) exposed.faceUp = true;
    }
    // Add to destination.
    if (dest.kind === "foundation") {
      state.foundation[dest.suit].push(...cards);
      sfx("match");
    } else {
      state.tableau[dest.col].push(...cards);
      sfx("place");
    }

    sel = null;
    moves++;
    stats.moves++;
    saveStats();
    checkAchievements();
    updateStatus();
    render();
    checkWin();
    return true;
  }

  // ---- Interaction ----
  function handle(kind, col, idx) {
    if (gameOver || paused) return;
    if (kind === "stock") {
      drawStock();
      return;
    }

    const src =
      kind === "waste"
        ? { kind: "waste" }
        : kind === "foundation"
        ? { kind: "foundation", idx: col, col }
        : { kind: "tableau", col, idx };

    // 1) If something is selected, see if this click is a valid destination.
    if (sel) {
      const dest = destFromClick(kind, col, idx);
      const cards = cardsInSource(sel);
      if (dest && isValidMove(sel, dest, cards)) {
        doMove(sel, dest);
        return;
      }
    }

    // 2) Otherwise treat as a source selection.
    if (!isMovable(src)) {
      sel = null;
      render();
      return;
    }
    const cards = cardsInSource(src);
    const foundSuit = cards.length === 1 && canToFoundation(cards[0]) ? cards[0].suit : null;
    const tableauDests = [];
    for (let c = 0; c < 7; c++) if (canTableau(cards[0], c)) tableauDests.push(c);

    // Convenience: a lone card with nowhere but home → send it.
    if (foundSuit && tableauDests.length === 0) {
      doMove(src, { kind: "foundation", suit: foundSuit });
      return;
    }
    sel = src;
    sfx("select");
    render();
  }

  function doubleClick(kind, col, idx) {
    if (gameOver || paused) return;
    if (kind !== "waste" && kind !== "tableau") return;
    const src = kind === "waste" ? { kind: "waste" } : { kind: "tableau", col, idx };
    if (!isMovable(src)) return;
    const cards = cardsInSource(src);
    if (cards.length === 1 && canToFoundation(cards[0]))
      doMove(src, { kind: "foundation", suit: cards[0].suit });
    else {
      sel = src;
      sfx("select");
      render();
    }
  }

  // Turn the whole discard pile face-down back into the stock. The pile order
  // is preserved (reversed once), exactly like a physical deck being restacked.
  function recycleStock(announce) {
    if (!state.waste.length) return false;
    while (state.waste.length) {
      const c = state.waste.pop();
      c.faceUp = false;
      state.stock.push(c);
    }
    stats.recycles++;
    sfx("click");
    if (announce)
      toast.show("Deck restarted", "The discarded cards are back in the stock — keep playing!", "🔄");
    return true;
  }

  function drawStock() {
    if (gameOver || paused) return;
    sel = null;
    if (state.stock.length) {
      // A fresh deal buries whatever was previously on top of the waste.
      for (const c of state.waste) c.faceUp = false;
      const n = Math.min(drawCount, state.stock.length);
      for (let i = 0; i < n; i++) {
        const c = state.stock.pop();
        c.faceUp = i === n - 1; // only the last (third) card is visible/playable
        state.waste.push(c);
        stats.draws++;
      }
      sfx("flip");
    } else if (state.waste.length) {
      recycleStock(true);
    }
    saveStats();
    checkAchievements();
    updateStatus();
    render();
  }

  function setDrawMode(n) {
    const next = Number(n) === 3 ? 3 : 1;
    if (next === drawCount) return;
    drawCount = next;
    saveDrawMode();
    updateStatus();
    toast.show(
      `Dealing ${drawCount} card${drawCount === 1 ? "" : "s"}`,
      drawCount === 1 ? "One card at a time — every card is playable." : "Three at a time — only the third card can be played.",
      "🃏"
    );
  }

  function checkWin() {
    const total = Object.values(state.foundation).reduce((a, f) => a + f.length, 0);
    if (total !== 52) return;
    gameOver = true;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (!stats.bestMoves || moves < stats.bestMoves) stats.bestMoves = moves;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(120);
    showOverlay(
      "You cleared it! 🎉",
      `Solved in ${moves} move${moves === 1 ? "" : "s"}. Best: ${stats.bestMoves}. ` +
        `Streak ${stats.streak}.`,
      [
        {
          label: "New Game",
          onClick: () => {
            hideOverlay();
            newGame();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---- Rendering ----
  function cardEl(card, kind, col, idx) {
    const el = document.createElement("div");
    if (!card || !card.faceUp) {
      el.className = "card card--down";
      el.setAttribute("aria-label", "Face-down card");
      return el;
    }
    el.className = `card card--${card.color}`;
    if (sel && sel.kind === kind && sel.col === col && sel.idx === idx) el.classList.add("sel");
    const glyph = SUITS.find((s) => s.s === card.suit).e;
    el.innerHTML =
      `<span class="rank">${rankLabel(card.rank)}</span>` +
      `<span class="suit-big">${glyph}</span>` +
      `<span class="suit-small">${glyph}</span>`;
    el.setAttribute("aria-label", rankLabel(card.rank) + " of " + card.suit);
    el.addEventListener("click", () => handle(kind, col, idx));
    el.addEventListener("dblclick", () => doubleClick(kind, col, idx));
    return el;
  }

  function render() {
    // Stock
    stockEl.innerHTML = state.stock.length ? "" : '<span class="slot__label">✓</span>';
    if (state.stock.length) {
      const c = document.createElement("div");
      c.className = "card card--down";
      c.addEventListener("click", () => handle("stock"));
      stockEl.appendChild(c);
    }
    // Waste
    wasteEl.innerHTML = "";
    wasteEl.style.display = "inline-flex";
    const w = wasteTop();
    if (w) wasteEl.appendChild(cardEl(w, "waste"));
    else {
      wasteEl.innerHTML = '<span class="slot__label">·</span>';
      wasteEl.style.display = "";
    }
    if (state.waste.length > 1) wasteEl.setAttribute("data-count", String(state.waste.length));
    else wasteEl.removeAttribute("data-count");

    // Foundations
    foundationsEl.innerHTML = "";
    SUITS.forEach((suit, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      const top = fundTop(suit.s);
      if (top) slot.appendChild(cardEl(top, "foundation", i, 0));
      else slot.innerHTML = `<span class="slot__label" style="opacity:.4">${suit.e}</span>`;
      slot.addEventListener("click", () => handle("foundation", i));
      foundationsEl.appendChild(slot);
    });

    // Tableau
    tableauEl.innerHTML = "";
    for (let c = 0; c < 7; c++) {
      const col = document.createElement("div");
      col.className = "sol-col";
      if (!colLen(c)) {
        col.innerHTML = '<span class="slot__label" style="opacity:.25">K</span>';
        col.style.minHeight = "94px";
      }
      for (let n = 0; n < colLen(c); n++) col.appendChild(cardEl(state.tableau[c][n], "tableau", c, n));
      if (!colLen(c)) col.addEventListener("click", () => handle("tableau", c));
      tableauEl.appendChild(col);
    }

    // Highlight legal destinations when something is selected.
    if (sel) {
      const cards = cardsInSource(sel);
      SUITS.forEach((suit, i) => {
        if (cards.length === 1 && canToFoundation(cards[0]) && cards[0].suit === suit.s)
          foundationsEl.children[i].classList.add("hl");
      });
      for (let c = 0; c < 7; c++)
        if (canTableau(cards[0], c)) tableauEl.children[c].classList.add("hl");
    }
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or Esc to resume.", [
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
    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    dom.byId("new-game").addEventListener("click", () => {
      sfx("click");
      newGame();
    });
    if (drawModeBtn)
      drawModeBtn.addEventListener("click", () => {
        audio.unlock();
        sfx("click");
        setDrawMode(drawCount === 1 ? 3 : 1);
      });
    if (recycleBtn)
      recycleBtn.addEventListener("click", () => {
        audio.unlock();
        if (gameOver || paused) return;
        if (recycleStock(true)) {
          updateStatus();
          render();
        } else {
          toast.show("Nothing to restart", "Play a few cards into the discard pile first.", "🃏");
        }
      });
    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    if (badges2) badges2.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Test hook helpers ----------
  function cardOf(rank, suitName, faceUp) {
    const suit = SUITS.find((s) => s.s === suitName) || SUITS[0];
    return { suit: suit.s, rank, color: suit.color, faceUp: faceUp !== false };
  }

  // Accepts a card object, a [rank, suit] pair, or a bare rank when the pile
  // already implies the suit (foundations).
  function readCard(x, faceUp, suitName) {
    if (Array.isArray(x)) return cardOf(x[0], x[1], x[2] === undefined ? faceUp : x[2]);
    if (typeof x === "number" && suitName) return cardOf(x, suitName, faceUp);
    return cardOf(x.rank, x.suit, x.faceUp === undefined ? faceUp : x.faceUp);
  }

  function loadState(cfg) {
    state = { stock: [], waste: [], foundation: {}, tableau: [] };
    for (const suit of SUITS) state.foundation[suit.s] = [];
    for (let c = 0; c < 7; c++) state.tableau.push([]);
    if (cfg.foundation) {
      for (const suit of SUITS) {
        const pile = cfg.foundation[suit.s] || [];
        pile.forEach((x) => state.foundation[suit.s].push(readCard(x, true, suit.s)));
      }
    }
    for (let c = 0; c < 7; c++) {
      const pile = (cfg.tableau && cfg.tableau[c]) || [];
      pile.forEach((x) => state.tableau[c].push(readCard(x, true)));
    }
    (cfg.waste || []).forEach((x) => state.waste.push(readCard(x, true)));
    (cfg.stock || []).forEach((x) => state.stock.push(readCard(x, false)));
    state.stock.forEach((c) => (c.faceUp = false));
    sel = null;
    moves = cfg.moves || 0;
    gameOver = !!cfg.gameOver;
    paused = false;
    hideOverlay();
    updateStatus();
    render();
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
  window.__SOLITAIRE = {
    SUITS,
    get state() {
      return {
        stock: state.stock.map((c) => ({ ...c })),
        waste: state.waste.map((c) => ({ ...c })),
        foundation: Object.fromEntries(
          SUITS.map((s) => [s.s, state.foundation[s.s].map((c) => ({ ...c }))])
        ),
        tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
      };
    },
    get drawCount() {
      return drawCount;
    },
    get moves() {
      return moves;
    },
    get gameOver() {
      return gameOver;
    },
    get paused() {
      return paused;
    },
    get sel() {
      return sel ? { ...sel } : null;
    },
    stats,
    ACHIEVEMENTS,
    canToFoundation,
    canTableau,
    handle,
    doubleClick,
    drawStock,
    recycleStock,
    setDrawMode,
    doMove,
    newGame,
    loadState,
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

  init();
})();
