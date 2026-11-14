// 2048 — pure vanilla JS, fully offline.
(() => {
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");

  const SIZE = 4;
  const COLORS = {
    0: "#303456", 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563",
    32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72", 256: "#edcc61",
    512: "#edc850", 1024: "#edc53f", 2048: "#edc22e"
  };

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let grid, score, best, won, overlay;

  best = store.get("2048-best");

  function reset() {
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
    score = 0; won = false;
    addRandom(); addRandom();
    render(); updateScore();
    if (overlay) overlay.remove();
  }

  function addRandom() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function compress(line) {
    let arr = line.filter(v => v);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return arr;
  }

  const ORDERS = {
    left:  Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => [r, c])),
    right: Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => [r, SIZE - 1 - c])),
    up:    Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => [r, c])),
    down:  Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => [SIZE - 1 - r, c])),
  };

  function move(dir) {
    const before = JSON.stringify(grid);
    ORDERS[dir].forEach(row => {
      const vals = row.map(([r, c]) => grid[r][c]);
      const nv = compress(vals);
      row.forEach(([r, c], i) => grid[r][c] = nv[i]);
    });
    if (JSON.stringify(grid) !== before) {
      addRandom();
      render();
      updateScore();
      checkState();
    }
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    return false;
  }

  function checkState() {
    if (!won && hasValue(2048)) {
      won = true;
      showOverlay("You win! 🎉", "You reached 2048. Keep going or start a new game.");
    } else if (!canMove()) {
      showOverlay("Game Over", `Score: ${score}. No moves left.`);
    }
  }

  function hasValue(v) {
    return grid.some(row => row.includes(v));
  }

  // ---- Rendering ----
  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.style.width = "76px";
        tile.style.height = "76px";
        tile.style.fontSize = v >= 1024 ? "1.5rem" : "2rem";
        tile.style.background = COLORS[v] || "#3b3b3b";
        if (v) tile.textContent = v;
        boardEl.appendChild(tile);
      }
    }
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; store.set("2048-best", best); }
    bestEl.textContent = best;
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

  // ---- Input ----
  const KEYMAP = {
    arrowleft: "left", keya: "left",
    arrowright: "right", keyd: "right",
    arrowup: "up", keyw: "up",
    arrowdown: "down", keys: "down",
  };

  document.addEventListener("keydown", e => {
    const dir = KEYMAP[e.key.toLowerCase()];
    if (dir) { e.preventDefault(); move(dir); }
  });

  // Touch swipe
  let touchStart = null;
  boardEl.addEventListener("touchstart", e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  boardEl.addEventListener("touchend", e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
    touchStart = null;
  });

  document.getElementById("new-game").addEventListener("click", reset);
  bestEl.textContent = best;
  reset();
})();
