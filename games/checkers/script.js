// Checkers — pure vanilla JS, fully offline. Mandatory captures, multi-jumps, negamax AI.
(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const winsEl = document.getElementById("wins");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const GLYPH = { m: "●", k: "♚" };
  const DEPTH = 3;
  const DRAW_QUIET = 160; // half-moves without capture/promotion -> draw

  let board, turn, selected, targets, gameOver, wins, quiet, chain, overlay;

  wins = store.get("checkers-wins", 0);
  winsEl.textContent = wins;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (c) => (c === "r" ? "b" : "r");
  const isDark = (r, c) => (r + c) % 2 === 1;
  const dirOf = (c) => (c === "r" ? -1 : 1); // Red moves up the board
  const promoRow = (c) => (c === "r" ? 0 : 7);
  const countPieces = (b, color) => {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] && b[r][c].c === color) n++;
    return n;
  };

  function setup() {
    board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) board[r][c] = { t: "m", c: "b" };
    for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if (isDark(r, c)) board[r][c] = { t: "m", c: "r" };
    turn = "r";
    selected = null; targets = []; gameOver = false; quiet = 0; chain = null;
  }

  function cloneBoard(b) { return b.map(row => row.map(p => (p ? { t: p.t, c: p.c } : null))); }

  function dirsFor(p) {
    const rows = p.t === "k" ? [-1, 1] : [dirOf(p.c)];
    const out = [];
    for (const dr of rows) for (const dc of [-1, 1]) out.push([dr, dc]);
    return out;
  }

  function capturesFrom(b, r, c) {
    const p = b[r][c];
    const out = [];
    if (!p) return out;
    for (const [dr, dc] of dirsFor(p)) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!inBounds(tr, tc)) continue;
      const mid = b[mr][mc];
      if (mid && mid.c !== p.c && !b[tr][tc]) out.push({ fr: r, fc: c, tr, tc, capture: true });
    }
    return out;
  }

  // Legal moves for a side. cont = [r,c] forces continuation of a multi-jump.
  function legalMoves(b, color, cont) {
    if (cont) return capturesFrom(b, cont[0], cont[1]);
    let caps = [], quietMoves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.c !== color) continue;
      caps = caps.concat(capturesFrom(b, r, c));
      for (const [dr, dc] of dirsFor(p)) {
        const tr = r + dr, tc = c + dc;
        if (inBounds(tr, tc) && !b[tr][tc]) quietMoves.push({ fr: r, fc: c, tr, tc, capture: false });
      }
    }
    return caps.length ? caps : quietMoves; // captures are mandatory
  }

  // Apply a single-step move; returns true if a promotion happened (ends a chain).
  function applyMove(b, m) {
    const p = b[m.fr][m.fc];
    b[m.tr][m.tc] = p;
    b[m.fr][m.fc] = null;
    if (m.capture) b[(m.fr + m.tr) / 2][(m.fc + m.tc) / 2] = null;
    if (p.t === "m" && m.tr === promoRow(p.c)) { p.t = "k"; return true; }
    return false;
  }

  // ---- AI: negamax + alpha-beta ----
  function evalBoard(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const v = p.t === "k" ? 2 : 1;
      s += p.c === color ? v : -v;
    }
    return s;
  }

  const captureFirst = (a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0);

  function search(b, d, alpha, beta, color, cont) {
    const moves = legalMoves(b, color, cont);
    if (moves.length === 0) return -100000 - d; // side to move loses
    if (d === 0 && !cont) return evalBoard(b, color);
    moves.sort(captureFirst);
    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      const promoted = applyMove(nb, m);
      const more = m.capture && !promoted ? capturesFrom(nb, m.tr, m.tc) : [];
      const score = more.length
        ? search(nb, d, alpha, beta, color, [m.tr, m.tc]) // same side moves again
        : -search(nb, d - 1, -beta, -alpha, opp(color), null);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMoveFor(color, cont) {
    const moves = legalMoves(board, color, cont);
    if (!moves.length) return null;
    moves.sort(captureFirst);
    let best = -Infinity, picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      const promoted = applyMove(nb, m);
      const more = m.capture && !promoted ? capturesFrom(nb, m.tr, m.tc) : [];
      const s = more.length
        ? search(nb, DEPTH - 1, -Infinity, Infinity, color, [m.tr, m.tc])
        : -search(nb, DEPTH - 1, -Infinity, Infinity, opp(color), null);
      if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
    }
    return picks[(Math.random() * picks.length) | 0];
  }

  // ---- Rendering & interaction ----
  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.width = "100%";
      cell.style.aspectRatio = "1";
      cell.style.padding = "0";
      cell.style.fontSize = "2.2rem";
      const dark = isDark(r, c);
      cell.style.background = dark ? "#25284a" : "#4a4e7a";
      if (!dark) { cell.disabled = true; cell.style.cursor = "default"; }
      const p = board[r][c];
      if (p) {
        cell.textContent = GLYPH[p.t];
        cell.style.color = p.c === "r" ? "#ff6b6b" : "#14141f";
        cell.style.textShadow = p.c === "r"
          ? "0 0 3px #3a0d0d, 0 1px 2px #000"
          : "0 0 5px #eef0ff, 0 1px 2px #000";
      }
      if (selected && selected.r === r && selected.c === c) cell.style.boxShadow = "inset 0 0 0 3px var(--accent-2)";
      else if (targets.some(t => t.tr === r && t.tc === c)) cell.style.boxShadow = "inset 0 0 0 3px var(--accent)";
      cell.addEventListener("click", () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }

  function setStatus(t) { statusEl.textContent = t; }

  function onCellClick(r, c) {
    if (gameOver || turn !== "r") return;
    // Mid multi-jump: only the jumping piece may act, only its jumps are legal.
    if (chain) {
      const move = targets.find(t => t.tr === r && t.tc === c);
      if (move) doPlayerMove(move);
      return;
    }
    const p = board[r][c];
    if (selected) {
      const move = targets.find(t => t.tr === r && t.tc === c);
      if (move) { doPlayerMove(move); return; }
    }
    if (p && p.c === "r") {
      selected = { r, c };
      targets = legalMoves(board, "r", null).filter(m => m.fr === r && m.fc === c);
    } else {
      selected = null; targets = [];
    }
    render();
  }

  function doPlayerMove(move) {
    const promoted = applyMove(board, move);
    quiet = move.capture || promoted ? 0 : quiet + 1;
    const more = move.capture && !promoted ? capturesFrom(board, move.tr, move.tc) : [];
    if (more.length) { // forced continuation — keep the turn with the human
      chain = [move.tr, move.tc];
      selected = { r: move.tr, c: move.tc };
      targets = more;
      setStatus("Multi-jump — keep jumping!");
      render();
      return;
    }
    chain = null; selected = null; targets = [];
    turn = "b";
    afterMove();
  }

  function afterMove() {
    render();
    if (quiet >= DRAW_QUIET) return endOfGame(true);
    const bMoves = legalMoves(board, "b", null);
    if (bMoves.length === 0) return endOfGame(false);
    setStatus("Thinking…");
    gameOver = "thinking"; // guard: block input while AI moves
    setTimeout(aiGo, 80);
  }

  function aiGo() {
    gameOver = false;
    let m = bestMoveFor("b", null);
    let promoted = m ? applyMove(board, m) : false;
    if (m) quiet = m.capture || promoted ? 0 : quiet + 1;
    let guard = 0;
    while (m && m.capture && !promoted && guard++ < 16) { // AI completes its chain
      const more = capturesFrom(board, m.tr, m.tc);
      if (!more.length) break;
      m = bestMoveFor("b", [m.tr, m.tc]);
      if (!m) break;
      promoted = applyMove(board, m); // continuation moves are captures by construction
      quiet = 0;
    }
    turn = "r";
    gameOver = false;
    render();
    if (quiet >= DRAW_QUIET) return endOfGame(true);
    const rMoves = legalMoves(board, "r", null);
    if (rMoves.length === 0) return endOfGame(false);
    setStatus("Your move");
  }

  function endOfGame(forceDraw) {
    gameOver = true;
    const redPieces = countPieces(board, "r"), blackPieces = countPieces(board, "b");
    const redMoves = legalMoves(board, "r", null).length, blackMoves = legalMoves(board, "b", null).length;
    let title, msg;
    if (!forceDraw && (blackPieces === 0 || blackMoves === 0)) {
      title = "You win! 🎉"; msg = "The CPU has no moves left.";
      wins++;
      store.set("checkers-wins", wins);
      winsEl.textContent = wins;
    } else if (!forceDraw && (redPieces === 0 || redMoves === 0)) {
      title = "CPU wins 🤖"; msg = "You have no moves left.";
    } else {
      title = "Draw"; msg = "Too many quiet moves — the game is drawn.";
    }
    setStatus(title);
    showOverlay(title, msg);
  }

  function showOverlay(title, msg) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function reset() {
    setup();
    if (overlay) overlay.remove();
    render();
    setStatus("Your move");
  }

  document.getElementById("new-game").addEventListener("click", reset);

  setup();
  render();
  setStatus("Your move");
})();
