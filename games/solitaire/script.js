// Solitaire (Klondike) — pure vanilla JS, fully offline. Click to move.
(() => {
  const stockEl = document.getElementById("stock");
  const wasteEl = document.getElementById("waste");
  const foundationsEl = document.getElementById("foundations");
  const tableauEl = document.getElementById("tableau");
  const movesEl = document.getElementById("moves");
  const winsEl = document.getElementById("wins");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const SUITS = [
    { s: "spades",     e: "♠", color: "black" },
    { s: "hearts",     e: "♥", color: "red" },
    { s: "diamonds",   e: "♦", color: "red" },
    { s: "clubs",      e: "♣", color: "black" },
  ];
  const RANKS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const rankLabel = (r) => RANKS[r] || String(r);

  let state, sel, moves, wins, gameOver, overlay;
  wins = store.get("sol-wins", 0);
  winsEl.textContent = wins;

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
    const deck = makeDeck();
    state = { stock: [], waste: [], foundation: {}, tableau: [] };
    for (const suit of SUITS) state.foundation[suit.s] = [];
    for (let c = 0; c < 7; c++) state.tableau.push([]);
    // Deal the tableau.
    for (let c = 0; c < 7; c++) {
      for (let n = 0; n <= c; n++) {
        const card = deck.pop();
        card.faceUp = n === c;
        state.tableau[c].push(card);
      }
    }
    // Rest to stock.
    while (deck.length) { const c = deck.pop(); c.faceUp = false; state.stock.push(c); }
    sel = null; moves = 0; gameOver = false;
    updateMoves();
    render();
  }

  function updateMoves() { movesEl.textContent = moves; }

  // ---- Accessors ----
  const wasteTop = () => state.waste[state.waste.length - 1] || null;
  const fundTop = (suit) => { const f = state.foundation[suit]; return f[f.length - 1] || null; };
  const colTop = (col) => { const a = state.tableau[col]; return a[a.length - 1] || null; };
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
      // Valid destination only if clicking the top card or an empty column.
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
    // Remove from source.
    if (src.kind === "waste") state.waste.pop();
    else if (src.kind === "foundation") state.foundation[SUITS[src.idx].s].pop();
    else {
      const col = src.col, start = src.idx;
      state.tableau[col].splice(start);
      const exposed = colTop(col);
      if (exposed && !exposed.faceUp) exposed.faceUp = true;
    }
    // Add to destination.
    if (dest.kind === "foundation") state.foundation[dest.suit].push(...cards);
    else state.tableau[dest.col].push(...cards);

    sel = null;
    moves++;
    updateMoves();
    render();
    checkWin();
  }

  // ---- Interaction ----
  function handle(kind, col, idx) {
    if (gameOver) return;
    if (kind === "stock") { drawStock(); return; }

    const src = kind === "waste" ? { kind: "waste" }
              : kind === "foundation" ? { kind: "foundation", idx: col }
              : { kind: "tableau", col, idx };

    // 1) If something is selected, see if this click is a valid destination.
    if (sel) {
      const dest = destFromClick(kind, col, idx);
      const cards = cardsInSource(sel);
      if (dest && isValidMove(sel, dest, cards)) { doMove(sel, dest); return; }
    }

    // 2) Otherwise treat as a source selection.
    if (!isMovable(src)) { sel = null; render(); return; }
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
    render();
  }

  function doubleClick(kind, col, idx) {
    if (gameOver) return;
    const src = kind === "waste" ? { kind: "waste" } : { kind: "tableau", col, idx };
    if (!isMovable(src)) return;
    const cards = cardsInSource(src);
    if (cards.length === 1 && canToFoundation(cards[0])) doMove(src, { kind: "foundation", suit: cards[0].suit });
    else { sel = src; render(); }
  }

  function drawStock() {
    sel = null;
    if (state.stock.length) {
      const c = state.stock.pop();
      c.faceUp = true;
      state.waste.push(c);
    } else if (state.waste.length) {
      while (state.waste.length) { const c = state.waste.pop(); c.faceUp = false; state.stock.push(c); }
    }
    updateMoves();
    render();
  }

  function checkWin() {
    const total = Object.values(state.foundation).reduce((a, f) => a + f.length, 0);
    if (total === 52) {
      gameOver = true;
      wins++; store.set("sol-wins", wins); winsEl.textContent = wins;
      overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `<div class="overlay__box"><h2>You cleared it! 🎉</h2>
        <p>Solved in ${moves} moves.</p><button class="btn" id="ov-restart">Play again</button></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("#ov-restart").addEventListener("click", () => { overlay.remove(); newGame(); });
    }
  }

  // ---- Rendering ----
  function cardEl(card, kind, col, idx) {
    const el = document.createElement("div");
    if (!card || !card.faceUp) { el.className = "card card--down"; return el; }
    el.className = `card card--${card.color}`;
    if (sel && sel.kind === kind && sel.col === col && sel.idx === idx) el.classList.add("sel");
    el.innerHTML = `<span class="rank">${rankLabel(card.rank)}</span>
      <span class="suit-big">${SUITS.find(s => s.s === card.suit).e}</span>
      <span class="suit-small">${SUITS.find(s => s.s === card.suit).e}</span>`;
    el.addEventListener("click", () => handle(kind, col, idx));
    el.addEventListener("dblclick", () => doubleClick(kind, col, idx));
    return el;
  }

  function render() {
    if (overlay) overlay.remove();
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
    else { wasteEl.innerHTML = '<span class="slot__label">·</span>'; wasteEl.style.display = ""; }

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
      // Clicking an empty column places a selected King here.
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
      for (let c = 0; c < 7; c++) if (canTableau(cards[0], c)) tableauEl.children[c].classList.add("hl");
    }
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
