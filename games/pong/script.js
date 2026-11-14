// Pong — pure vanilla JS, fully offline.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const playerEl = document.getElementById("player");
  const cpuEl = document.getElementById("cpu");
  const startBtn = document.getElementById("start");
  const diffSel = document.getElementById("difficulty");

  const W = canvas.width, H = canvas.height;
  const PADDLE_H = 80, PADDLE_W = 12, WIN_SCORE = 5;

  let playerScore, cpuScore, running, aiSpeed, mouseY, keys, ball, overlay;

  function resetBall(dir) {
    ball = {
      x: W / 2, y: H / 2, size: 10,
      vx: 5 * (dir || (Math.random() < 0.5 ? 1 : -1)),
      vy: (Math.random() * 4 - 2),
    };
  }

  function resetGame() {
    playerScore = 0; cpuScore = 0;
    aiSpeed = +diffSel.value;
    updateScores();
    paddleL.y = H / 2 - PADDLE_H / 2;
    paddleR.y = H / 2 - PADDLE_H / 2;
    resetBall();
    running = false;
  }

  const paddleL = { x: 20, y: H / 2 - PADDLE_H / 2, w: PADDLE_W };
  const paddleR = { x: W - 20 - PADDLE_W, y: H / 2 - PADDLE_H / 2, w: PADDLE_W };

  function updateScores() {
    playerEl.textContent = playerScore;
    cpuEl.textContent = cpuScore;
  }

  // ---- Input ----
  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouseY = (e.clientY - rect.top) * (H / rect.height);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") keys.up = true;
    if (e.key === "ArrowDown") keys.down = true;
  });
  document.addEventListener("keyup", e => {
    if (e.key === "ArrowUp") keys.up = false;
    if (e.key === "ArrowDown") keys.down = false;
  });

  startBtn.addEventListener("click", () => {
    if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) resetGame();
    running = true;
  });

  // ---- Physics ----
  function movePaddles() {
    const speed = 8;
    if (keys.up) paddleL.y -= speed;
    if (keys.down) paddleL.y += speed;
    if (mouseY !== null) {
      const target = mouseY - PADDLE_H / 2;
      paddleL.y += (target - paddleL.y) * 0.4;
    }
    paddleL.y = Math.max(0, Math.min(H - PADDLE_H, paddleL.y));

    // AI follows the ball with limited speed.
    const target = ball.y - PADDLE_H / 2;
    paddleR.y += Math.max(-aiSpeed * 12, Math.min(aiSpeed * 12, target - paddleR.y));
    paddleR.y = Math.max(0, Math.min(H - PADDLE_H, paddleR.y));
  }

  function bounce(paddle) {
    const rel = ball.y - (paddle.y + PADDLE_H / 2);
    const norm = rel / (PADDLE_H / 2);
    const angle = norm * (Math.PI / 3); // up to 60°
    const speed = Math.min(11, Math.hypot(ball.vx, ball.vy) + 0.3);
    const dir = paddle === paddleL ? 1 : -1;
    ball.vx = dir * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
  }

  function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y < ball.size) { ball.y = ball.size; ball.vy *= -1; }
    if (ball.y > H - ball.size) { ball.y = H - ball.size; ball.vy *= -1; }

    // Left paddle
    if (ball.vx < 0 && ball.x - ball.size < paddleL.x + paddleL.w &&
        ball.x > paddleL.x && ball.y > paddleL.y && ball.y < paddleL.y + PADDLE_H) {
      bounce(paddleL);
    }
    // Right paddle
    if (ball.vx > 0 && ball.x + ball.size > paddleR.x &&
        ball.x < paddleR.x + paddleR.w && ball.y > paddleR.y && ball.y < paddleR.y + PADDLE_H) {
      bounce(paddleR);
    }

    // Scoring
    if (ball.x < 0) { cpuScore++; scored(); }
    else if (ball.x > W) { playerScore++; scored(); }
  }

  function scored() {
    updateScores();
    if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) return endGame();
    resetBall(playerScore > cpuScore ? -1 : 1);
  }

  // ---- Rendering ----
  function draw() {
    ctx.fillStyle = "#0a0b18";
    ctx.fillRect(0, 0, W, H);
    // center dashed line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#58e0c9";
    ctx.fillRect(paddleL.x, paddleL.y, paddleL.w, PADDLE_H);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(paddleR.x, paddleR.y, paddleR.w, PADDLE_H);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function endGame() {
    running = false;
    const youWon = playerScore >= WIN_SCORE;
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${youWon ? "You win! 🎉" : "CPU wins 🤖"}</h2>
      <p>Final score ${playerScore} – ${cpuScore}.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.getElementById("ov-restart").addEventListener("click", () => { overlay.remove(); resetGame(); });
  }

  function loop() {
    movePaddles();
    if (running) updateBall();
    draw();
    requestAnimationFrame(loop);
  }

  keys = { up: false, down: false };
  mouseY = null;
  resetGame();
  loop();
})();
