// Snake — pure vanilla JS, fully offline.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");

  const GRID = 21;            // cells per side
  const CELL = canvas.width / GRID;
  const STEP_MS = 110;

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let snake, dir, nextDir, food, score, best, lastTick, running, gameOver;

  best = store.get("snake-best");
  bestEl.textContent = best;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    gameOver = false;
    running = true;
    placeFood();
    updateScore();
    lastTick = performance.now();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; bestEl.textContent = best; store.set("snake-best", best); }
  }

  function setDir(nx, ny) {
    // Prevent reversing directly into yourself.
    if (nx === -dir.x && ny === -dir.y) return;
    nextDir = { x: nx, y: ny };
  }

  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") setDir(0, -1);
    else if (k === "arrowdown" || k === "s") setDir(0, 1);
    else if (k === "arrowleft" || k === "a") setDir(-1, 0);
    else if (k === "arrowright" || k === "d") setDir(1, 0);
    else return;
    e.preventDefault();
  });

  document.querySelectorAll(".dpad button").forEach(b =>
    b.addEventListener("click", () => {
      const d = b.dataset.dir;
      if (d === "up") setDir(0, -1);
      if (d === "down") setDir(0, 1);
      if (d === "left") setDir(-1, 0);
      if (d === "right") setDir(1, 0);
    }));

  document.getElementById("restart").addEventListener("click", reset);

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      updateScore();
      placeFood();
    } else {
      snake.pop();
    }
  }

  function endGame() {
    running = false;
    gameOver = true;
    draw();
    showOverlay("Game Over", `You scored ${score}. Click Restart or press Space.`);
  }

  // ---- Rendering ----
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // food
    ctx.fillStyle = "#ffcc4d";
    roundRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4, 5);

    // snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#58e0c9" : "#3fbfa6";
      roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 4);
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ---- Overlay ----
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

  // ---- Main loop ----
  function loop(now) {
    if (running && now - lastTick >= STEP_MS) { tick(); lastTick = now; draw(); }
    requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", e => {
    if (e.key === " " && gameOver) { if (overlay) overlay.remove(); reset(); e.preventDefault(); }
  });

  reset();
  draw();
  requestAnimationFrame(loop);
})();
