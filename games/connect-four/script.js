// Connect Four — pure vanilla JS, fully offline, with minimax AI.
(() => {
  const ROWS = 6, COLS = 7;
  const HUMAN = "R", AI = "Y";
  const boardEl = document.getElementById("board");
  const turnEl = document.getElementById("turn");
  const aiDiffSel = document.getElementById("ai-diff");

  let grid, currentTurn, gameOver, aiDepth;

  function newGrid() { return Array.from({ length: ROWS }, () => new Array(COLS).fill("")); }

  function centerFirst() { return [3, 2, 4, 1, 5, 0, 6]; }

  function valid(col) { return grid[0][col] === ""; }
  function full() { return grid[0].every(c => c !== ""); }

  function drop(g, col, p) {
    for (let r = ROWS - 1; r >= 0; r--) if (g[r][col] === "") { g[r][col] = p; return r; }
    return -1;
  }

  function won(g, p) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== p) continue;
        for (const [dr, dc] of dirs) {
          let count = 1;
          for (let k = 1; k < 4; k++) {
            const nr = r + dr * k, nc = c + dc * k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || g[nr][nc] !== p) break;
            count++;
          }
          if (count === 4) return true;
        }
      }
    }
    return false;
  }

  function getWinner(g) {
    if (won(g, AI)) return AI;
    if (won(g, HUMAN)) return HUMAN;
    return null;
  }

  // Heuristic evaluation of non-terminal positions.
  function evaluate(g) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      if (g[r][3] === AI) score += 3;
      else if (g[r][3] === HUMAN) score -= 3;
    }
    const windows = [];
    // horizontal
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r][c + 1], g[r][c + 2], g[r][c + 3]]);
    // vertical
    for (let r = 0; r <= ROWS - 4; r++)
      for (let c = 0; c < COLS; c++)
        windows.push([g[r][c], g[r + 1][c], g[r + 2][c], g[r + 3][c]]);
    // diagonals
    for (let r = 0; r <= ROWS - 4; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r + 1][c + 1], g[r + 2][c + 2], g[r + 3][c + 3]]);
    for (let r = 3; r < ROWS; r++)
      for (let c = 0; c <= COLS - 4; c++)
        windows.push([g[r][c], g[r - 1][c + 1], g[r - 2][c + 2], g[r - 3][c + 3]]);

    for (const w of windows) {
      const ai = w.filter(x => x === AI).length;
      const hu = w.filter(x => x === HUMAN).length;
      if (hu === 0 && ai) score += ai * ai;
      else if (ai === 0 && hu) score -= hu * hu;
    }
    return score;
  }

  function minimax(g, depth, alpha, beta, maximizing) {
    const w = getWinner(g);
    if (w === AI) return 100000 + depth;
    if (w === HUMAN) return -100000 - depth;
    if (full(g)) return 0;
    if (depth === 0) return evaluate(g);

    const order = centerFirst();
    if (maximizing) {
      let best = -Infinity;
      for (const col of order) {
        if (!validCol(g, col)) continue;
        const r = drop(g, col, AI);
        best = Math.max(best, minimax(g, depth - 1, alpha, beta, false));
        g[r][col] = "";
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const col of order) {
        if (!validCol(g, col)) continue;
        const r = drop(g, col, HUMAN);
        best = Math.min(best, minimax(g, depth - 1, alpha, beta, true));
        g[r][col] = "";
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function validCol(g, col) { return g[0][col] === ""; }

  function aiMove() {
    let bestScore = -Infinity, bestCol = -1;
    for (const col of centerFirst()) {
      if (!valid(col)) continue;
      const r = drop(grid, col, AI);
      const score = minimax(grid, aiDepth - 1, -Infinity, Infinity, false);
      grid[r][col] = "";
      if (score > bestScore) { bestScore = score; bestCol = col; }
    }
    if (bestCol === -1) return;
    const r = drop(grid, bestCol, AI);
    render();
    afterMove(AI, bestCol, r);
  }

  // ---- Rendering & flow ----
  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.style.width = "46px";
        cell.style.height = "46px";
        cell.style.fontSize = "1.5rem";
        cell.textContent = grid[r][c] === HUMAN ? "🔴" : grid[r][c] === AI ? "🟡" : "";
        boardEl.appendChild(cell);
      }
    }
  }

  function afterMove(player, col, row) {
    const w = getWinner(grid);
    if (w) return endGame(w);
    if (full(grid)) return endGame("draw");
    currentTurn = player === HUMAN ? AI : HUMAN;
    turnEl.textContent = currentTurn === HUMAN ? "You" : "CPU";
    if (currentTurn === AI) setTimeout(aiMove, 250);
  }

  function playColumn(col) {
    if (gameOver || currentTurn !== HUMAN) return;
    if (!valid(col)) return;
    const r = drop(grid, col, HUMAN);
    render();
    afterMove(HUMAN, col, r);
  }

  let overlay;
  function endGame(result) {
    gameOver = true;
    let title, msg;
    if (result === "draw") { title = "Draw!"; msg = "The board is full."; }
    else if (result === HUMAN) { title = "You win! 🎉"; msg = "Four in a row."; }
    else { title = "CPU wins 🤖"; msg = "Better luck next time."; }
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  boardEl.addEventListener("click", e => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const idx = [...boardEl.children].indexOf(cell);
    playColumn(idx % COLS);
  });

  aiDiffSel.addEventListener("change", () => { aiDepth = +aiDiffSel.value; });

  function reset() {
    grid = newGrid();
    currentTurn = HUMAN;
    gameOver = false;
    aiDepth = +aiDiffSel.value;
    turnEl.textContent = "You";
    if (overlay) overlay.remove();
    render();
  }

  document.getElementById("new-game").addEventListener("click", reset);
  reset();
})();
