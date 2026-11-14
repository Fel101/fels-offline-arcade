// Chess — pure vanilla JS, fully offline. Full rules + alpha-beta AI.
(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const winsEl = document.getElementById("wins");
  const levelSel = document.getElementById("level");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const GLYPH = { w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
                  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" } };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const KNIGHTS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

  let board, state, turn, selected, targets, gameOver, wins, bestLevel, depth;

  wins = store.get("chess-wins", 0);
  bestLevel = store.get("chess-bestlevel", 3);
  winsEl.textContent = wins;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (color) => color === "w" ? "b" : "w";

  function cloneBoard(b) { return b.map(row => row.slice()); }
  function cloneState(s) { return { wK: s.wK, wQ: s.wQ, bK: s.bK, bQ: s.bQ, ep: s.ep }; }

  function setup() {
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      board[7][c] = { t: back[c], c: "w" };
      board[6][c] = { t: "p", c: "w" };
      board[0][c] = { t: back[c], c: "b" };
      board[1][c] = { t: "p", c: "b" };
    }
    state = { wK: true, wQ: true, bK: true, bQ: true, ep: null };
    turn = "w";
    selected = null; targets = []; gameOver = false; depth = Number(levelSel.value) || 3;
  }

  // ---- Attack detection ----
  function isAttacked(b, r, c, by) {
    // Pawn attacks
    const pDir = by === "w" ? 1 : -1; // white pawns come from row+1
    for (const dc of [-1, 1]) {
      const pr = r + pDir, pc = c + dc;
      if (inBounds(pr, pc) && b[pr][pc] && b[pr][pc].t === "p" && b[pr][pc].c === by) return true;
    }
    // Knight
    for (const [dr, dc] of KNIGHTS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].t === "n" && b[nr][nc].c === by) return true;
    }
    // King
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].t === "k" && b[nr][nc].c === by) return true;
    }
    // Sliding: diagonals (bishop/queen)
    for (const [dr, dc] of DIRS) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = b[nr][nc];
        if (p) {
          if ((p.t === "b" || p.t === "q") && p.c === by) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    // Sliding: orthogonals (rook/queen)
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = b[nr][nc];
        if (p) {
          if ((p.t === "r" || p.t === "q") && p.c === by) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    return false;
  }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (b[r][c] && b[r][c].t === "k" && b[r][c].c === color) return [r, c];
    return null;
  }
  function inCheck(b, color) {
    const k = findKing(b, color);
    return k && isAttacked(b, k[0], k[1], opp(color));
  }

  // ---- Move generation ----
  function genPseudo(b, color, st) {
    const moves = [];
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || p.c !== color) continue;

        if (p.t === "p") {
          const oneR = r + dir;
          if (inBounds(oneR, c) && !b[oneR][c]) {
            if (oneR === promoRow) moves.push({ fr: r, fc: c, tr: oneR, tc: c, type: "promo", promo: "q" });
            else moves.push({ fr: r, fc: c, tr: oneR, tc: c, type: "normal" });
            const twoR = r + dir * 2;
            if (r === startRow && !b[twoR][c]) moves.push({ fr: r, fc: c, tr: twoR, tc: c, type: "double" });
          }
          for (const dc of [-1, 1]) {
            const nr = r + dir, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            const isEp = st.ep && st.ep[0] === nr && st.ep[1] === nc;
            if (t && t.c !== color) {
              if (nr === promoRow) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "promo", promo: "q" });
              else moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "capture" });
            } else if (isEp) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "ep" });
            }
          }
        } else if (p.t === "n") {
          for (const [dr, dc] of KNIGHTS) {
            const nr = r + dr, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.c !== color) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: t ? "capture" : "normal" });
          }
        } else if (p.t === "k") {
          for (const [dr, dc] of DIRS) {
            const nr = r + dr, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.c !== color) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: t ? "capture" : "normal" });
          }
          // Castling
          const row = color === "w" ? 7 : 0;
          if (r === row && c === 4 && !inCheck(b, color)) {
            if (st[color + "K"] && b[row][5] === null && b[row][6] === null && b[row][7] && b[row][7].t === "r" && b[row][7].c === color) {
              if (!isAttacked(b, row, 5, opp(color)) && !isAttacked(b, row, 6, opp(color)))
                moves.push({ fr: r, fc: c, tr: row, tc: 6, type: "castleK" });
            }
            if (st[color + "Q"] && b[row][1] === null && b[row][2] === null && b[row][3] === null && b[row][0] && b[row][0].t === "r" && b[row][0].c === color) {
              if (!isAttacked(b, row, 3, opp(color)) && !isAttacked(b, row, 2, opp(color)))
                moves.push({ fr: r, fc: c, tr: row, tc: 2, type: "castleQ" });
            }
          }
        } else {
          const steps = p.t === "b" ? DIRS : p.t === "r" ? [[-1,0],[1,0],[0,-1],[0,1]] : DIRS.concat([[-1,0],[1,0],[0,-1],[0,1]]);
          for (const [dr, dc] of steps) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              const t = b[nr][nc];
              if (!t) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "normal" });
              else { if (t.c !== color) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "capture" }); break; }
              nr += dr; nc += dc;
            }
          }
        }
      }
    }
    return moves;
  }

  function applyFull(b, st, m) {
    const p = b[m.fr][m.fc];
    // New en-passant target after a two-step pawn move.
    st.ep = (p.t === "p" && Math.abs(m.tr - m.fr) === 2) ? [(m.fr + m.tr) / 2, m.fc] : null;

    if (m.type === "double") {
      b[m.tr][m.tc] = p; b[m.fr][m.fc] = null;
    } else if (m.type === "ep") {
      b[m.tr][m.tc] = p; b[m.fr][m.fc] = null; b[m.fr][m.tc] = null;
    } else if (m.type === "castleK") {
      b[m.tr][m.tc] = p; b[m.fr][m.fc] = null; b[m.tr][5] = b[m.fr][7]; b[m.fr][7] = null;
    } else if (m.type === "castleQ") {
      b[m.tr][m.tc] = p; b[m.fr][m.fc] = null; b[m.tr][3] = b[m.fr][0]; b[m.fr][0] = null;
    } else if (m.type === "promo") {
      b[m.tr][m.tc] = { t: m.promo || "q", c: p.c }; b[m.fr][m.fc] = null;
    } else {
      b[m.tr][m.tc] = p; b[m.fr][m.fc] = null;
    }

    // Update castling rights when king or a corner rook moves / is captured.
    if (p.t === "k") {
      if (p.c === "w") { st.wK = st.wQ = false; } else { st.bK = st.bQ = false; }
    }
    const rookSq = { "7,0": "wQ", "7,7": "wK", "0,0": "bQ", "0,7": "bK" };
    if (rookSq[m.fr + "," + m.fc]) st[rookSq[m.fr + "," + m.fc]] = false;
    if (rookSq[m.tr + "," + m.tc]) st[rookSq[m.tr + "," + m.tc]] = false;
  }

  function legalMoves(b, color, st) {
    const out = [];
    for (const m of genPseudo(b, color, st)) {
      const nb = cloneBoard(b);
      const ns = cloneState(st);
      applyFull(nb, ns, m);
      if (!inCheck(nb, color)) out.push(m);
    }
    return out;
  }

  // ---- AI: negamax + alpha-beta ----
  function evalColor(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        s += VAL[p.t] * (p.c === color ? 1 : -1);
      }
    return s;
  }

  function negamax(b, st, d, alpha, beta, color) {
    const moves = legalMoves(b, color, st);
    if (moves.length === 0) return inCheck(b, color) ? -(99000 - (depth - d)) : 0;
    if (d === 0) return evalColor(b, color);

    // Order captures first for better pruning.
    moves.sort((a, cc) => (a.type === "capture" || a.type === "promo" ? 1 : 0) - (cc.type === "capture" || cc.type === "promo" ? 1 : 0));

    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      const ns = cloneState(st);
      applyFull(nb, ns, m);
      const score = negamax(nb, ns, d - 1, -beta, -alpha, opp(color));
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function getBestMove() {
    const moves = legalMoves(board, "b", state);
    if (!moves.length) return null;
    moves.sort((a, c) => (a.type === "capture" || a.type === "promo" ? 1 : 0) - (c.type === "capture" || c.type === "promo" ? 1 : 0));
    let best = -Infinity, picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      const ns = cloneState(state);
      applyFull(nb, ns, m);
      const s = negamax(nb, ns, depth - 1, -Infinity, Infinity, "w");
      if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
    }
    return picks[Math.floor(Math.random() * picks.length)];
  }

  // ---- Rendering & interaction ----
  function render() {
    boardEl.innerHTML = "";
    const kingInCheck = inCheck(board, turn) ? findKing(board, turn) : null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("button");
        cell.className = "cell chess-cell";
        cell.style.width = "100%";
        cell.style.aspectRatio = "1";
        cell.style.fontSize = "2.4rem";
        cell.style.background = (r + c) % 2 === 0 ? "#3a3e63" : "#262a4d";
        const p = board[r][c];
        if (p) {
          cell.textContent = GLYPH[p.c][p.t];
          cell.style.color = p.c === "w" ? "#ffffff" : "#b6bade";
          cell.style.textShadow = p.c === "w" ? "0 0 3px #12132a, 0 1px 2px #000" : "0 0 2px #0a0b18";
        }
        if (selected && selected.r === r && selected.c === c) cell.style.boxShadow = "inset 0 0 0 3px var(--accent-2)";
        const isTarget = targets.some(t => t.r === r && t.c === c);
        if (isTarget) cell.style.boxShadow = "inset 0 0 0 3px var(--accent)";
        if (kingInCheck && kingInCheck[0] === r && kingInCheck[1] === c) cell.style.background = "#ff6b6b";
        cell.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function setStatus(t) { statusEl.textContent = t; }

  function onCellClick(r, c) {
    if (gameOver || turn !== "w") return;
    const p = board[r][c];
    if (selected) {
      const target = targets.find(t => t.r === r && t.c === c);
      if (target) { doPlayerMove(selected, target); return; }
    }
    if (p && p.c === "w") {
      selected = { r, c };
      targets = legalMoves(board, "w", state).filter(m => m.tr === r && m.tc === c);
    } else {
      selected = null; targets = [];
    }
    render();
  }

  function doPlayerMove(from, to) {
    const fromM = legalMoves(board, "w", state).find(m => m.tr === to.r && m.tc === to.c && m.fr === from.r && m.fc === from.c);
    if (!fromM) { selected = null; targets = []; render(); return; }
    applyFull(board, state, fromM);
    selected = null; targets = [];
    turn = "b";
    afterMove();
  }

  function afterMove() {
    render();
    const blackMoves = legalMoves(board, "b", state);
    if (blackMoves.length === 0) return endOfGame();
    setStatus("Thinking…");
    gameOver = "thinking"; // guard: block input while AI moves
    setTimeout(aiGo, 50);
  }

  function aiGo() {
    const m = getBestMove();
    if (m) applyFull(board, state, m);
    turn = "w";
    gameOver = false;
    render();
    const whiteMoves = legalMoves(board, "w", state);
    if (whiteMoves.length === 0) return endOfGame();
    setStatus(inCheck(board, "w") ? "Check! Your move" : "Your move");
  }

  function endOfGame() {
    gameOver = true;
    const whiteInCheck = inCheck(board, "w");
    if (whiteInCheck) {
      setStatus("You lose ♚ Checkmate");
    } else {
      setStatus("Stalemate — draw");
    }
  }

  document.getElementById("new-game").addEventListener("click", () => { setup(); winsEl.textContent = wins; render(); setStatus("Your move"); });
  levelSel.addEventListener("change", () => { depth = Number(levelSel.value) || 3; if (!gameOver) { /* difficulty only applies next full game */ } });

  setup();
  depth = Number(levelSel.value) || 3;
  render();
  setStatus("Your move");
})();
