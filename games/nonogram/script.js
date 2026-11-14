// Nonogram (5x5 Picross) — pure vanilla JS, fully offline, handcrafted puzzles.
(() => {
  const gridEl = document.getElementById("ngrid");
  const puzzleNumEl = document.getElementById("puzzle-num");
  const movesEl = document.getElementById("moves");
  const winsEl = document.getElementById("wins");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Handcrafted 5x5 solution patterns (1 = filled, 0 = empty).
  const PUZZLES = [
    { name: "Heart",    rows: ["01010", "11111", "11111", "01110", "00100"] },
    { name: "Sailboat", rows: ["00100", "01100", "11100", "11111", "01110"] },
    { name: "Tree",     rows: ["00100", "01110", "11111", "00100", "00100"] },
    { name: "Mushroom", rows: ["01110", "11111", "01110", "00100", "00100"] },
    { name: "Diamond",  rows: ["00100", "01110", "11111", "01110", "00100"] },
    { name: "Invader",  rows: ["00100", "10101", "11111", "01010", "10001"] },
    { name: "Cross",    rows: ["10001", "01010", "00100", "01010", "10001"] },
    { name: "Smiley",   rows: ["01110", "10001", "10101", "11011", "01110"] },
    { name: "Cat",      rows: ["10001", "11011", "11111", "10101", "11111"] },
    { name: "Key",      rows: ["01100", "10010", "01100", "00100", "00110"] },
    { name: "Crown",    rows: ["10101", "11111", "01110", "01110", "11111"] },
    { name: "Flower",   rows: ["01010", "11111", "01110", "00100", "01110"] },
  ];
  const SIZE = 5;
  const EMPTY = 0, FILLED = 1, MARKED = 2;

  let puzzleIndex, solution, grid, moves, won;
  let wins = store.get("nonogram-wins");

  // Runs of filled cells in a line, e.g. [3,1]. Empty line → [0].
  function runs(line) {
    const out = [];
    let count = 0;
    for (const v of line) {
      if (v) { count++; } else if (count) { out.push(count); count = 0; }
    }
    if (count) out.push(count);
    return out.length ? out : [0];
  }

  function rowClue(r) { return runs(solution[r]); }
  function colClue(c) { return runs(solution.map(row => row[c])); }

  function updateStatus() {
    puzzleNumEl.textContent = puzzleIndex + 1;
    movesEl.textContent = moves;
    winsEl.textContent = wins;
  }

  function render() {
    gridEl.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "ngrid__corner";
    gridEl.appendChild(corner);

    for (let c = 0; c < SIZE; c++) {
      const clue = document.createElement("div");
      clue.className = "clue clue--col";
      for (const n of colClue(c)) {
        const s = document.createElement("span");
        s.textContent = n;
        clue.appendChild(s);
      }
      gridEl.appendChild(clue);
    }

    for (let r = 0; r < SIZE; r++) {
      const clue = document.createElement("div");
      clue.className = "clue clue--row";
      for (const n of rowClue(r)) {
        const s = document.createElement("span");
        s.textContent = n;
        clue.appendChild(s);
      }
      gridEl.appendChild(clue);

      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.className = "ncell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        paintCell(cell, grid[r][c]);
        cell.addEventListener("click", () => onLeft(r, c));
        cell.addEventListener("contextmenu", e => { e.preventDefault(); onRight(r, c); });
        gridEl.appendChild(cell);
      }
    }
  }

  function paintCell(cell, state) {
    cell.classList.toggle("filled", state === FILLED);
    cell.classList.toggle("marked", state === MARKED);
    cell.textContent = state === MARKED ? "✕" : "";
  }

  function cellAt(r, c) {
    // Children: corner + 5 col clues = 6, then each row adds 1 row clue + 5 cells.
    return gridEl.children[6 + r * (SIZE + 1) + 1 + c];
  }

  function onLeft(r, c) {
    if (won) return;
    grid[r][c] = grid[r][c] === FILLED ? EMPTY : FILLED;
    moves++;
    refreshCell(r, c);
    updateStatus();
    checkWin();
  }

  function onRight(r, c) {
    if (won) return;
    grid[r][c] = grid[r][c] === MARKED ? EMPTY : MARKED;
    moves++;
    refreshCell(r, c);
    updateStatus();
  }

  function refreshCell(r, c) {
    const cell = cellAt(r, c);
    if (cell) paintCell(cell, grid[r][c]);
  }

  function checkWin() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if ((grid[r][c] === FILLED) !== (solution[r][c] === 1)) return;
    won = true;
    wins++;
    store.set("nonogram-wins", wins);
    updateStatus();
    showResult();
  }

  function solutionMini() {
    let html = '<div class="solution-mini">';
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        html += `<div class="${solution[r][c] === 1 ? "on" : ""}"></div>`;
    return html + "</div>";
  }

  let overlay;
  function showResult() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Solved! 🎉</h2>
      <p>${PUZZLES[puzzleIndex].name} — completed in ${moves} moves.</p>
      ${solutionMini()}
      <button class="btn" id="ov-restart" style="margin-top:12px;">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newPuzzle);
  }

  function loadPuzzle(index) {
    puzzleIndex = index;
    solution = PUZZLES[index].rows.map(row => row.split("").map(Number));
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
    moves = 0;
    won = false;
    render();
    updateStatus();
  }

  function resetPuzzle() {
    if (overlay) overlay.remove();
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
    moves = 0;
    won = false;
    render();
    updateStatus();
  }

  function newPuzzle() {
    if (overlay) overlay.remove();
    let next = puzzleIndex;
    while (PUZZLES.length > 1 && next === puzzleIndex)
      next = Math.floor(Math.random() * PUZZLES.length);
    loadPuzzle(next);
  }

  document.getElementById("new-puzzle").addEventListener("click", newPuzzle);
  document.getElementById("reset").addEventListener("click", resetPuzzle);

  loadPuzzle(Math.floor(Math.random() * PUZZLES.length));
})();
