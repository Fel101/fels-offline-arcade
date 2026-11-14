// Othello — pure vanilla JS, fully offline. Standard Reversi rules, negamax AI with positional weights.
(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const winsEl = document.getElementById("wins");
  const countsEl = document.getElementById("counts");
  const levelSel = document.getElementById("level");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Weighted position matrix: corners are gold, X/C-squares near corners are poison.
  const WEIGHTS = [
    100, -25,  10,   5,   5,  10, -25, 100,
    -25, -40,  -5,  -5,  -5,  -5, -40, -25,
     10,  -5,   8,   2,   2,   8,  -5,  10,
      5,  -5,   2,   1,   1,   2,  -5,   5,
      5,  -5,   2,   1,   1,   2,  -5,   5,
     10,  -5,   8,   2,   2,   8,  -5,  10,
    -25, -40,  -5,  -5,  -5,  -5, -40, -25,
    100, -25,  10,   5,   5,  10, -25, 100,
  ];
  const DIFF_FACTOR = 2; // disc-differential weight in the static eval
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const HUMAN = "b", AI = "w";

  let board, turn, gameOver, wins, overlay;

  wins = store.get("othello-wins", 0);
  winsEl.textContent = wins;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (c) => (c === "b" ? "w" : "b");
  const depth = () => Number(levelSel.value) || 3;
  const cloneBoard = (b) => b.map(row => row.slice());
  const countDiscs = (b, color) => {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === color) n++;
    return n;
  };

  function setup() {
    board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    board[3][3] = "w"; board[3][4] = "b";
    board[4][3] = "b"; board[4][4] = "w";
    turn = HUMAN;
    gameOver = false;
  }

  // For an empty cell, list flanked discs in every direction. Returns move list.
  function legalMoves(b, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (b[r][c]) continue;
      const flips = [];
      for (const [dr, dc] of DIRS) {
        const line = [];
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc) && b[nr][nc] === opp(color)) {
          line.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (line.length && inBounds(nr, nc) && b[nr][nc] === color) flips.push(...line);
      }
      if (flips.length) moves.push({ r, c, flips });
    }
    return moves;
  }

  function applyDisc(b, m, color) {
    b[m.r][m.c] = color;
    for (const [r, c] of m.flips) b[r][c] = color;
  }

  // ---- AI: negamax + alpha-beta, positional weights + disc differential ----
  function evalBoard(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      s += p === color ? WEIGHTS[r * 8 + c] : -WEIGHTS[r * 8 + c];
    }
    return s + (countDiscs(b, color) - countDiscs(b, opp(color))) * DIFF_FACTOR;
  }

  const byWeight = (a, b) => WEIGHTS[b.r * 8 + b.c] - WEIGHTS[a.r * 8 + a.c];

  function search(b, d, alpha, beta, color) {
    const moves = legalMoves(b, color);
    if (moves.length === 0) {
      if (legalMoves(b, opp(color)).length === 0) {
        const diff = countDiscs(b, color) - countDiscs(b, opp(color));
        return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0;
      }
      return -search(b, d - 1, -beta, -alpha, opp(color)); // pass: opponent moves again
    }
    if (d === 0) return evalBoard(b, color);
    moves.sort(byWeight);
    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      applyDisc(nb, m, color);
      const score = -search(nb, d - 1, -beta, -alpha, opp(color));
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMoveFor(color, d) {
    const moves = legalMoves(board, color);
    if (!moves.length) return null;
    moves.sort(byWeight);
    let best = -Infinity, picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      applyDisc(nb, m, color);
      const s = -search(nb, d - 1, -Infinity, Infinity, opp(color));
      if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
    }
    return picks[(Math.random() * picks.length) | 0];
  }

  // ---- Rendering & interaction ----
  function render() {
    boardEl.innerHTML = "";
    const legal = gameOver || turn !== HUMAN
      ? []
      : legalMoves(board, HUMAN).map(m => m.r * 8 + m.c);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.width = "100%";
      cell.style.aspectRatio = "1";
      cell.style.padding = "0";
      cell.style.fontSize = "2.4rem";
      cell.style.background = (r + c) % 2 === 0 ? "#1c7a48" : "#176b3e";
      const p = board[r][c];
      if (p) {
        cell.textContent = "●";
        if (p === "b") {
          cell.style.color = "#14141f";
          cell.style.textShadow = "0 0 3px rgba(255,255,255,.35), 0 2px 2px #000";
        } else {
          cell.style.color = "#f2f2fa";
          cell.style.textShadow = "0 2px 2px #000, 0 0 3px #000";
        }
      } else if (legal.includes(r * 8 + c)) {
        cell.textContent = "•";
        cell.style.color = "var(--accent)";
      }
      cell.addEventListener("click", () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }

  function setStatus(t) { statusEl.textContent = t; }

  function updateCounts() {
    countsEl.textContent = `You ${countDiscs(board, "b")} · AI ${countDiscs(board, "w")}`;
  }

  // After a move (or pass), hand the turn over and handle passes / game over.
  function advance() {
    turn = opp(turn);
    let passMsg = null;
    if (legalMoves(board, turn).length === 0) {
      if (legalMoves(board, opp(turn)).length === 0) return endOfGame();
      passMsg = turn === HUMAN ? "You have no legal moves — turn passes" : "AI has no legal moves — turn passes";
      turn = opp(turn); // automatic pass
    }
    render();
    updateCounts();
    if (turn === AI) {
      setStatus(passMsg ? passMsg + " · AI thinking…" : "AI thinking…");
      gameOver = "thinking"; // guard: block input while AI moves
      setTimeout(aiGo, 120);
    } else {
      setStatus(passMsg ? passMsg + " · Your move" : "Your move");
    }
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== HUMAN) return;
    const move = legalMoves(board, HUMAN).find(m => m.r === r && m.c === c);
    if (!move) return;
    applyDisc(board, move, HUMAN);
    advance();
  }

  function aiGo() {
    const m = bestMoveFor(AI, depth());
    if (m) applyDisc(board, m, AI);
    gameOver = false;
    advance();
  }

  function endOfGame() {
    gameOver = true;
    const b = countDiscs(board, "b"), w = countDiscs(board, "w");
    let title;
    if (b > w) {
      title = "You win! 🎉";
      wins++;
      store.set("othello-wins", wins);
      winsEl.textContent = wins;
    } else if (w > b) {
      title = "CPU wins 🤖";
    } else {
      title = "Draw";
    }
    setStatus(title);
    render();
    updateCounts();
    showOverlay(title, `Final: You ${b} · AI ${w}`);
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
    updateCounts();
    setStatus("Your move");
  }

  document.getElementById("new-game").addEventListener("click", reset);

  setup();
  render();
  updateCounts();
  setStatus("Your move");
})();
