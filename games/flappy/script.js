// Flappy — pure vanilla JS, fully offline.
// One-button flappy-bird-style flyer: gravity, flap, pipes, crash.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const restartBtn = document.getElementById("restart");

  const W = canvas.width, H = canvas.height;
  const GRAVITY = 0.35;
  const FLAP = -6.5;
  const PIPE_SPEED = 2.4;
  const PIPE_W = 64;
  const GAP = 150;
  const GROUND_H = 40;
  const BIRD_R = 13;
  const BIRD_X = 90;

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let bird, pipes, score, best, state, frame, spawnIn, overlay, bob;

  best = store.get("flappy-best");
  bestEl.textContent = best;

  function reset(toReady) {
    bird = { y: H / 2 - 40, vy: 0 };
    pipes = [];
    score = 0;
    frame = 0;
    spawnIn = 60;              // first pipe arrives a bit sooner
    bob = 0;
    state = toReady ? "ready" : "playing";
    if (overlay) overlay.remove();
    updateScore();
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; bestEl.textContent = best; store.set("flappy-best", best); }
  }

  function spawnInterval() {
    // Pipes get very slightly denser as the score climbs (every ~90 frames, scaled).
    return Math.max(72, 90 - Math.floor(score / 4) * 2);
  }

  function spawnPipe() {
    const margin = 70;
    const gapCenter = margin + GAP / 2 + Math.random() * (H - GROUND_H - margin * 2 - GAP);
    pipes.push({ x: W + 10, gapTop: gapCenter - GAP / 2, passed: false });
  }

  function flap() {
    if (state === "ready") {
      if (overlay) overlay.remove();
      state = "playing";
      bird.vy = FLAP;
      return;
    }
    if (state !== "playing") return;
    bird.vy = FLAP;
  }

  function crash() {
    state = "over";
    showOverlay();
  }

  // ---- Input ----
  document.addEventListener("keydown", e => {
    if (e.key === " ") {
      e.preventDefault();
      if (state === "over") { if (overlay) overlay.remove(); reset(false); return; }
      flap();
    }
  });
  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (state === "over") return; // use the Play again button
    flap();
  });
  restartBtn.addEventListener("click", () => { reset(true); showStartOverlay(); });

  // ---- Update ----
  function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function update() {
    bob += 0.05;
    if (state !== "playing") return;

    frame++;
    spawnIn--;
    if (spawnIn <= 0) { spawnPipe(); spawnIn = spawnInterval(); }

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    for (const p of pipes) p.x -= PIPE_SPEED;
    pipes = pipes.filter(p => p.x + PIPE_W > -4);

    // Scoring — pipe fully behind the bird.
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X) { p.passed = true; score++; updateScore(); }
    }

    // Ceiling / ground.
    if (bird.y - BIRD_R <= 0 || bird.y + BIRD_R >= H - GROUND_H) return crash();

    // Pipes.
    const gapBottom = p => p.gapTop + GAP;
    for (const p of pipes) {
      if (BIRD_X + BIRD_R < p.x || BIRD_X - BIRD_R > p.x + PIPE_W) continue;
      if (circleHitsRect(BIRD_X, bird.y, BIRD_R, p.x, 0, PIPE_W, p.gapTop)) return crash();
      if (circleHitsRect(BIRD_X, bird.y, BIRD_R, p.x, gapBottom(p), PIPE_W, H - GROUND_H - gapBottom(p))) return crash();
    }
  }

  // ---- Rendering ----
  function draw() {
    // Sky.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4a90d9");
    g.addColorStop(1, "#a8d8f0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sun + clouds (simple flat art).
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath(); ctx.arc(330, 70, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const [cx, cy, s] of [[70, 90, 1], [190, 150, 0.8], [300, 220, 0.9]]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 26 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 18 * s, cy + 4 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 18 * s, cy + 4 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pipes.
    for (const p of pipes) {
      const gapBottom = p.gapTop + GAP;
      drawPipe(p.x, 0, p.gapTop, true);
      drawPipe(p.x, gapBottom, H - GROUND_H - gapBottom, false);
    }

    // Ground strip.
    ctx.fillStyle = "#d8b25a";
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "#8a6d3b";
    ctx.fillRect(0, H - GROUND_H, W, 6);

    // Bird.
    const by = state === "ready" ? bird.y + Math.sin(bob) * 8 : bird.y;
    ctx.fillStyle = "#ffcc4d";
    ctx.beginPath(); ctx.arc(BIRD_X, by, BIRD_R, 0, Math.PI * 2); ctx.fill();
    // wing
    ctx.fillStyle = "#f0a63a";
    ctx.beginPath(); ctx.ellipse(BIRD_X - 4, by + 2, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    // beak
    ctx.fillStyle = "#ff6b3d";
    ctx.beginPath();
    ctx.moveTo(BIRD_X + BIRD_R - 2, by - 1);
    ctx.lineTo(BIRD_X + BIRD_R + 9, by + 3);
    ctx.lineTo(BIRD_X + BIRD_R - 2, by + 6);
    ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(BIRD_X + 5, by - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(BIRD_X + 6.5, by - 4, 2.4, 0, Math.PI * 2); ctx.fill();

    // "Get ready" hint on the start screen.
    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 22px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get Ready!", W / 2, 110);
    }
  }

  function drawPipe(x, y, h, isTop) {
    if (h <= 0) return;
    ctx.fillStyle = "#58c24a";
    ctx.fillRect(x, y, PIPE_W, h);
    ctx.fillStyle = "#3f9c34";
    ctx.fillRect(x, y, 8, h);              // left shade
    ctx.fillRect(x + PIPE_W - 8, y, 8, h); // right shade
    // Cap at the gap edge.
    const capH = 22;
    const capY = isTop ? y + h - capH : y;
    ctx.fillStyle = "#6fdd5e";
    ctx.fillRect(x - 4, capY, PIPE_W + 8, capH);
    ctx.fillStyle = "#3f9c34";
    ctx.fillRect(x - 4, capY + (isTop ? 0 : capH - 4), PIPE_W + 8, 4);
  }

  // ---- Overlays ----
  function showStartOverlay() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Flappy</h2>
      <p>Click / Space to flap. Thread the pipes to score!</p>
      <button class="btn" id="start-btn">Start</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#start-btn").addEventListener("click", () => {
      if (overlay) overlay.remove();
      state = "playing";
    });
  }

  function showOverlay() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Game Over</h2>
      <p>Score: ${score} &nbsp;·&nbsp; Best: ${best}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", () => { overlay.remove(); reset(false); });
  }

  // ---- Main loop (single loop for the page lifetime) ----
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  reset(true);
  showStartOverlay();
  requestAnimationFrame(loop);
})();
