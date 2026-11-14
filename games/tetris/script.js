// Tetris — pure vanilla JS, fully offline.
(() => {
  const board = document.getElementById("board");
  const bctx = board.getContext("2d");
  const next = document.getElementById("next");
  const nctx = next.getContext("2d");

  const COLS = 10, ROWS = 20, CELL = 28;

  // Standard tetrominoes. Each cell: 1 = filled.
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
  };
  const COLORS = { I: "#58e0c9", O: "#ffcc4d", T: "#c67bff", S: "#6bd66b",
                   Z: "#ff6b6b", J: "#5a9cff", L: "#ff9f43" };

  let grid, current, nextPiece, score, lines, level, dropInterval, lastDrop, running, paused, gameOver;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function randomPiece() {
    const key = Object.keys(SHAPES)[Math.floor(Math.random() * Object.keys(SHAPES).length)];
    const shape = SHAPES[key].map(r => [...r]);
    return { key, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
  }

  function rotate(matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    const res = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        res[c][rows - 1 - r] = matrix[r][c];
    return res;
  }

  function collides(piece, grid) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const nx = piece.x + c, ny = piece.y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge(piece, grid) {
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) {
        const ny = piece.y + r;
        if (ny >= 0) grid[ny][piece.x + c] = piece.key;
      }
    }));
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(cell => cell)) {
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(null));
        cleared++;
        r++; // recheck same row index
      }
    }
    if (cleared) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(80, 800 - (level - 1) * 70);
    }
  }

  function spawn() {
    current = nextPiece;
    nextPiece = randomPiece();
    if (collides(current, grid)) endGame();
    drawNext();
  }

  function tryMove(dx, dy) {
    const moved = { ...current, x: current.x + dx, y: current.y + dy, shape: current.shape };
    if (!collides(moved, grid)) { current = moved; return true; }
    return false;
  }

  function tryRotate() {
    const rotated = rotate(current.shape);
    const test = { ...current, shape: rotated };
    // Wall-kick: shift horizontally if rotation collides.
    for (const off of [0, -1, 1, -2, 2]) {
      test.x = current.x + off;
      if (!collides(test, grid)) { current = test; return; }
    }
  }

  function drop() {
    if (!tryMove(0, 1)) {
      merge(current, grid);
      clearLines();
      spawn();
    }
    lastDrop = performance.now();
  }

  function hardDrop() {
    while (tryMove(0, 1)) score += 2;
    drop();
  }

  // ---- Rendering ----
  function drawCell(ctx, x, y, color, cell) {
    ctx.fillStyle = color;
    ctx.fillRect(x * cell, y * cell, cell, cell);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(x * cell, y * cell, cell, cell);
  }

  function drawBoard() {
    bctx.fillStyle = "#0a0b18";
    bctx.fillRect(0, 0, board.width, board.height);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) drawCell(bctx, c, r, COLORS[grid[r][c]], CELL);

    // ghost piece
    if (current) {
      let ghost = { ...current, shape: current.shape };
      while (!collides({ ...ghost, y: ghost.y + 1, shape: ghost.shape }, grid)) ghost.y++;
      bctx.globalAlpha = 0.2;
      ghost.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v && ghost.y + r >= 0) drawCell(bctx, ghost.x + c, ghost.y + r, COLORS[current.key], CELL);
      }));
      bctx.globalAlpha = 1;

      current.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v && current.y + r >= 0) drawCell(bctx, current.x + c, current.y + r, COLORS[current.key], CELL);
      }));
    }
  }

  function drawNext() {
    nctx.fillStyle = "#0a0b18";
    nctx.fillRect(0, 0, next.width, next.height);
    const cell = 24;
    const shape = nextPiece.shape;
    const ox = (next.width - shape[0].length * cell) / 2;
    const oy = (next.height - shape.length * cell) / 2;
    shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      nctx.fillStyle = COLORS[nextPiece.key];
      nctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      nctx.strokeStyle = "rgba(0,0,0,0.35)";
      nctx.strokeRect(ox + c * cell, oy + r * cell, cell, cell);
    }));
  }

  function updateStats() {
    document.getElementById("score").textContent = score;
    document.getElementById("lines").textContent = lines;
    document.getElementById("level").textContent = level;
  }

  let overlay;
  function showOverlay(title, msg) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.getElementById("ov-restart").addEventListener("click", () => { overlay.remove(); reset(); });
  }

  function endGame() {
    gameOver = true; running = false; drawBoard();
    showOverlay("Game Over", `Score: ${score}. Press Restart to play again.`);
  }

  // ---- Input ----
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "p") { togglePause(); return; }
    if (!running || paused || gameOver) return;
    if (k === "arrowleft") tryMove(-1, 0);
    else if (k === "arrowright") tryMove(1, 0);
    else if (k === "arrowdown") drop();
    else if (k === "arrowup" || k === "x") tryRotate();
    else if (k === " ") { hardDrop(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    drawBoard(); updateStats();
  });

  function togglePause() {
    if (gameOver) return;
    paused = !paused; running = !paused;
    document.getElementById("pause").textContent = paused ? "Resume" : "Pause";
    if (paused) showOverlay("Paused", "Press P or click Resume to continue.");
    else if (overlay) overlay.remove();
  }

  function reset() {
    grid = emptyGrid();
    score = 0; lines = 0; level = 1;
    dropInterval = 800; running = true; paused = false; gameOver = false;
    nextPiece = randomPiece();
    spawn();
    document.getElementById("pause").textContent = "Pause";
    lastDrop = performance.now();
    updateStats(); drawBoard();
  }

  document.getElementById("restart").addEventListener("click", reset);
  document.getElementById("pause").addEventListener("click", togglePause);

  function loop(now) {
    if (running && !paused && now - lastDrop >= dropInterval) { drop(); drawBoard(); updateStats(); }
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
