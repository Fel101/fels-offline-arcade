// Minesweeper — pure vanilla JS, fully offline.
(() => {
  const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 },
  };

  const boardEl = document.getElementById("board");
  const mineCountEl = document.getElementById("mine-count");
  const timeEl = document.getElementById("time");
  const difficultySel = document.getElementById("difficulty");

  const NUM_COLORS = { 1: "#5a9cff", 2: "#6bd66b", 3: "#ff6b6b", 4: "#c67bff",
                       5: "#ff9f43", 6: "#58e0c9", 7: "#eee", 8: "#9aa0c8" };

  let cfg, cells, revealedCount, flagsPlaced, startTime, timerId, running, gameOver;

  function reset() {
    cfg = DIFFICULTIES[difficultySel.value];
    cells = [];
    revealedCount = 0;
    flagsPlaced = 0;
    gameOver = false;
    running = false;
    clearInterval(timerId);
    timeEl.textContent = "0";
    mineCountEl.textContent = cfg.mines;
    if (overlay) overlay.remove();
    buildBoard();
  }

  function buildBoard() {
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    boardEl.innerHTML = "";
    for (let r = 0; r < cfg.rows; r++) {
      cells[r] = [];
      for (let c = 0; c < cfg.cols; c++) {
        const btn = document.createElement("button");
        btn.className = "cell";
        btn.style.width = "34px";
        btn.style.height = "34px";
        btn.style.fontSize = "1.1rem";
        btn.dataset.r = r;
        btn.dataset.c = c;
        btn.addEventListener("click", () => reveal(r, c));
        btn.addEventListener("contextmenu", e => { e.preventDefault(); toggleFlag(r, c); });
        boardEl.appendChild(btn);
        cells[r][c] = { btn, mine: false, revealed: false, flagged: false, adj: 0 };
      }
    }
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < cfg.mines) {
      const r = Math.floor(Math.random() * cfg.rows);
      const c = Math.floor(Math.random() * cfg.cols);
      if (cells[r][c].mine) continue;
      // Keep the first-clicked cell and its neighbours safe.
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      cells[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++)
        cells[r][c].adj = neighbours(r, c).filter(([nr, nc]) => cells[nr][nc].mine).length;
  }

  function neighbours(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols) out.push([nr, nc]);
      }
    return out;
  }

  function startTimer() {
    startTime = Date.now();
    timerId = setInterval(() => {
      timeEl.textContent = Math.floor((Date.now() - startTime) / 1000);
    }, 500);
  }

  function reveal(r, c) {
    if (gameOver || cells[r][c].revealed || cells[r][c].flagged) return;
    if (!running) { placeMines(r, c); running = true; startTimer(); }
    const cell = cells[r][c];

    if (cell.mine) return lose(r, c);

    floodReveal(r, c);
    checkWin();
  }

  function floodReveal(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [nr, nc] = stack.pop();
      const cell = cells[nr][nc];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      revealedCount++;
      renderCell(nr, nc);
      if (cell.adj === 0)
        for (const [br, bc] of neighbours(nr, nc))
          if (!cells[br][bc].revealed) stack.push([br, bc]);
    }
  }

  function toggleFlag(r, c) {
    const cell = cells[r][c];
    if (gameOver || cell.revealed) return;
    if (!running) { placeMines(r, c); running = true; startTimer(); }
    cell.flagged = !cell.flagged;
    cell.btn.textContent = cell.flagged ? "🚩" : "";
    flagsPlaced += cell.flagged ? 1 : -1;
    mineCountEl.textContent = cfg.mines - flagsPlaced;
  }

  function renderCell(r, c) {
    const cell = cells[r][c];
    cell.btn.disabled = true;
    if (cell.adj > 0) {
      cell.btn.textContent = cell.adj;
      cell.btn.style.color = NUM_COLORS[cell.adj];
    }
  }

  function lose(r, c) {
    gameOver = true; running = false; clearInterval(timerId);
    cells[r][c].btn.textContent = "💣";
    cells[r][c].btn.style.background = "#ff6b6b";
    for (let i = 0; i < cfg.rows; i++)
      for (let j = 0; j < cfg.cols; j++) {
        const cell = cells[i][j];
        if (cell.mine && !cell.flagged) { cell.btn.textContent = "💣"; cell.btn.disabled = true; }
        else if (!cell.mine && cell.flagged) { cell.btn.textContent = "❌"; }
      }
    showResult("Boom! 💣", "You hit a mine.");
  }

  function checkWin() {
    if (revealedCount === cfg.rows * cfg.cols - cfg.mines) {
      gameOver = true; running = false; clearInterval(timerId);
      showResult("You Win! 🎉", `Cleared in ${timeEl.textContent}s.`);
    }
  }

  let overlay;
  function showResult(title, msg) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  difficultySel.addEventListener("change", reset);
  document.getElementById("new-game").addEventListener("click", reset);

  reset();
})();
