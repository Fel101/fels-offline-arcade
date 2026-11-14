// Lights Out — pure vanilla JS, fully offline. 5×5, turn all lights off.
(() => {
  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");
  const winsEl = document.getElementById("wins");

  const SIZE = 5;

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let grid, moves, gameOver, overlay;
  let best = store.get("lights-out-best"); // 0 means "no solve yet"
  let wins = store.get("lights-out-wins");

  function neighbors(i) {
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const res = [i];
    if (r > 0) res.push(i - SIZE);
    if (r < SIZE - 1) res.push(i + SIZE);
    if (c > 0) res.push(i - 1);
    if (c < SIZE - 1) res.push(i + 1);
    return res;
  }

  function toggle(i) {
    for (const j of neighbors(i)) grid[j] = !grid[j];
  }

  function render() {
    boardEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("button");
      cell.className = "lights-cell" + (grid[i] ? " lit" : "");
      cell.setAttribute("aria-label", grid[i] ? "Light on" : "Light off");
      cell.addEventListener("click", () => handleClick(i));
      boardEl.appendChild(cell);
    }
  }

  function updateStatus() {
    movesEl.textContent = moves;
    bestEl.textContent = best > 0 ? best : "—";
    winsEl.textContent = wins;
  }

  function handleClick(i) {
    if (gameOver) return;
    toggle(i);
    moves++;
    updateStatus();
    render();
    if (grid.every(v => !v)) onSolved();
  }

  function onSolved() {
    gameOver = true;
    wins++;
    store.set("lights-out-wins", wins);
    if (!best || moves < best) {
      best = moves;
      store.set("lights-out-best", best);
    }
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Solved in ${moves} moves!</h2><p>All the lights are off. Nicely done!</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function newGame() {
    // Start from all-off and apply 12 random presses so the board is
    // guaranteed solvable (just reverse those presses).
    grid = new Array(SIZE * SIZE).fill(false);
    const picks = new Set();
    while (picks.size < 12) picks.add(Math.floor(Math.random() * SIZE * SIZE));
    for (const i of picks) toggle(i);
    // Guarantee at least one light is on.
    if (grid.every(v => !v)) toggle(Math.floor(Math.random() * SIZE * SIZE));
    moves = 0;
    gameOver = false;
    if (overlay) overlay.remove();
    render();
    updateStatus();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
