// Tron — pure vanilla JS, fully offline. Light-cycle duel vs the computer.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const CELL = 12;
  const SIZE = 40;                 // 40 x 40 grid -> 480 x 480 canvas
  const W = SIZE * CELL, H = SIZE * CELL;
  canvas.width = W; canvas.height = H;

  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const ORDERS = ["up", "down", "left", "right"];

  let grid, player, enemy, running, gameOver, wins, best, overlay, acc, lastTs;

  best = store.get("tron-best", 0);
  wins = 0;

  const idx = (x, y) => y * SIZE + x;

  function newGrid() { return new Array(SIZE * SIZE).fill(0); } // 0 empty, 1 player, 2 enemy

  function updateStats() { scoreEl.textContent = wins; bestEl.textContent = best; }

  function reset() {
    grid = newGrid();
    gameOver = false;
    running = true;
    acc = 0; lastTs = 0;
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);
    player = { x: 3 * CELL, y: Math.floor(SIZE / 2) * CELL, dir: "right", dead: false };
    enemy = { x: (SIZE - 4) * CELL, y: Math.floor(SIZE / 2) * CELL, dir: "left", dead: false };
    drawCell(player.x, player.y, 1);
    drawCell(enemy.x, enemy.y, 2);
    updateStats();
    if (overlay) overlay.remove();
  }

  function drawCell(x, y, owner) {
    grid[idx(Math.floor(x / CELL), Math.floor(y / CELL))] = owner;
    ctx.fillStyle = owner === 1 ? "#58e0c9" : "#ff6b6b";
    ctx.fillRect(x, y, CELL, CELL);
  }

  // ---- Input ----
  const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  document.addEventListener("keydown", e => {
    const d = keyMap[e.key];
    if (d && d !== OPPOSITE[player.dir]) { player.dir = d; e.preventDefault(); }
  });
  document.getElementById("restart").addEventListener("click", reset);

  // ---- AI: greedy — pick the direction that opens up the most space ----
  function isBlocked(x, y, d) {
    const nx = x + DIRS[d].x, ny = y + DIRS[d].y;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return true;   // wall
    if (grid[idx(nx, ny)] !== 0) return true;                        // any trail
    return false;
  }

  function openArea(x, y) {
    const start = idx(x, y);
    const seen = new Set([start]);
    let count = 0;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      count++;
      for (const d of ORDERS) {
        const ex = cx + DIRS[d].x, ey = cy + DIRS[d].y;
        if (ex < 0 || ey < 0 || ex >= SIZE || ey >= SIZE) continue;
        const k = idx(ex, ey);
        if (grid[k] !== 0 || seen.has(k)) continue;
        seen.add(k);
        stack.push([ex, ey]);
      }
    }
    return count;
  }

  function enemyMove() {
    const gx = Math.floor(enemy.x / CELL), gy = Math.floor(enemy.y / CELL);
    let bestDir = null, bestScore = -Infinity;
    for (const d of ORDERS) {
      if (isBlocked(gx, gy, d)) continue;
      const score = openArea(gx + DIRS[d].x, gy + DIRS[d].y) + Math.random() * 1.5;
      if (score > bestScore) { bestScore = score; bestDir = d; }
    }
    if (bestDir) enemy.dir = bestDir;
  }

  // ---- Simulation step ----
  function tryMove(c, owner) {
    const gx = Math.floor(c.x / CELL), gy = Math.floor(c.y / CELL);
    c.x += DIRS[c.dir].x * CELL;
    c.y += DIRS[c.dir].y * CELL;
    if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) { c.dead = true; return; }
    const k = idx(Math.floor(c.x / CELL), Math.floor(c.y / CELL));
    if (grid[k] !== 0) c.dead = true;
  }

  function step() {
    if (gameOver) return;
    tryMove(player, 1);
    if (player.dead) return endGame(false);
    enemyMove();
    tryMove(enemy, 2);
    if (enemy.dead) return endGame(true);
    drawCell(player.x, player.y, 1);
    drawCell(enemy.x, enemy.y, 2);
  }

  // ---- Rendering ----
  function render(ts) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs; lastTs = ts;
    if (running && !gameOver) {
      acc += dt;
      while (acc >= 95) { acc -= 95; step(); }
    }
    requestAnimationFrame(render);
  }

  function endGame(won) {
    gameOver = true; running = false;
    if (won) { wins++; if (wins > best) { best = wins; store.set("tron-best", best); } }
    updateStats();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${won ? "You outlasted it! 🎉" : "Crashed! 🚨"}</h2>
      <p>${won ? "Clean run. Again?" : "Your cycle is scrap."}<br>Wins this session: ${wins}.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", () => { overlay.remove(); reset(); });
  }

  reset();
  requestAnimationFrame(render);
})();
