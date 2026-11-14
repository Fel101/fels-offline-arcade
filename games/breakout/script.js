// Breakout — pure vanilla JS, fully offline.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const launchBtn = document.getElementById("launch");

  const W = canvas.width, H = canvas.height;
  const COLS = 8, ROWS = 5, PAD = 8, TOP = 60;
  const BRICK_W = (W - PAD * (COLS + 1)) / COLS;
  const BRICK_H = 22;
  const ROW_COLORS = ["#ff6b6b", "#ff9f43", "#ffcc4d", "#6bd66b", "#58e0c9"];

  let score, lives, bricks, ball, paddle, launched, overlay;

  function newBricks() {
    const arr = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        arr.push({ x: PAD + c * (BRICK_W + PAD), y: TOP + r * (BRICK_H + PAD),
                   w: BRICK_W, h: BRICK_H, color: ROW_COLORS[r], alive: true });
      }
    }
    return arr;
  }

  function reset() {
    score = 0; lives = 3;
    bricks = newBricks();
    paddle = { w: 90, h: 12, x: W / 2 - 45 };
    launchBall();
    updateStats();
    if (overlay) overlay.remove();
  }

  function launchBall() {
    launched = false;
    ball = { x: paddle.x + paddle.w / 2, y: H - 30, size: 8, vx: 0, vy: 0 };
  }

  function go() {
    if (launched) return;
    const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2; // up-ish spread
    const speed = 6;
    ball.vx = speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    launched = true;
  }

  function updateStats() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
  }

  // ---- Input ----
  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.height);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mx - paddle.w / 2));
  });
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") paddle.x = Math.max(0, paddle.x - 35);
    if (e.key === "ArrowRight") paddle.x = Math.min(W - paddle.w, paddle.x + 35);
    if (e.key === " ") { go(); e.preventDefault(); }
  });
  launchBtn.addEventListener("click", go);

  // ---- Physics ----
  function update() {
    if (!launched) { ball.x = paddle.x + paddle.w / 2; return; }
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x < ball.size || ball.x > W - ball.size) ball.vx *= -1;
    if (ball.y < ball.size) ball.vy *= -1;

    // Paddle
    if (ball.vy > 0 && ball.y + ball.size >= H - 24 - paddle.h &&
        ball.y + ball.size <= H - 24 + 8 &&
        ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
      const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = rel * (Math.PI / 3);
      const speed = Math.min(9, Math.hypot(ball.vx, ball.vy) + 0.15);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -Math.abs(speed * Math.cos(angle));
    }

    // Ball lost
    if (ball.y > H) {
      lives--;
      updateStats();
      if (lives <= 0) return endGame(false);
      launchBall();
    }

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.size > b.x && ball.x - ball.size < b.x + b.w &&
          ball.y + ball.size > b.y && ball.y - ball.size < b.y + b.h) {
        b.alive = false;
        score += 10;
        updateStats();
        // Reflect based on overlap depth
        const overlapX = Math.min(ball.x + ball.size - b.x, b.x + b.w - (ball.x - ball.size));
        const overlapY = Math.min(ball.y + ball.size - b.y, b.y + b.h - (ball.y - ball.size));
        if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
        break;
      }
    }

    if (bricks.every(b => !b.alive)) endGame(true);
  }

  // ---- Rendering ----
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);
    bricks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });
    ctx.fillStyle = "#58e0c9";
    ctx.fillRect(paddle.x, H - 24 - paddle.h, paddle.w, paddle.h);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function endGame(won) {
    launched = false;
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${won ? "You clear it! 🎉" : "Game Over"}</h2>
      <p>Score: ${score}.</p><button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", () => { overlay.remove(); reset(); });
  }

  function loop() { update(); draw(); requestAnimationFrame(loop); }
  reset();
  loop();
})();
