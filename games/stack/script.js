// Stack — pure vanilla JS, fully offline.
// Timing tower-stacking: drop the sliding block, overhang gets sliced off.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const restartBtn = document.getElementById("restart");

  const W = canvas.width, H = canvas.height;
  const BLOCK_H = 24;
  const ANCHOR_Y = 150;          // screen y of the newest (top) block's top edge
  const MOVE_Y = ANCHOR_Y - BLOCK_H; // the sliding block hovers in the slot above
  const MIN_SLICE = 1;           // overhangs thinner than this are discarded, never placed

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let blocks, moving, slices, floaters, camEase, score, best, gameOver, overlay;

  best = store.get("stack-best");
  bestEl.textContent = best;

  function blockColor(level) {
    // Hue cycles per level — a slow gradient up the tower.
    return `hsl(${(190 + level * 14) % 360} 65% 58%)`;
  }

  function reset() {
    blocks = [];                 // level = index; level 0 was placed first
    moving = newMovingBlock(180);
    slices = [];                 // overhang pieces falling away
    floaters = [];               // "PERFECT!" pop-ups
    camEase = 0;                 // eases from -BLOCK_H back to 0 after each drop
    score = 0;
    gameOver = false;
    if (overlay) overlay.remove();
    updateScore();
  }

  function newMovingBlock(width) {
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? 0 : W - width,
      w: width,
      dir: fromLeft ? 1 : -1,
      speed: blockSpeed(),
    };
  }

  function blockSpeed() {
    // Speeds up a little every 8 blocks placed.
    return Math.min(9, 2.4 + Math.floor(blocks.length / 8) * 0.55);
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; bestEl.textContent = best; store.set("stack-best", best); }
  }

  function drop() {
    if (gameOver) return;
    const top = blocks.length ? blocks[blocks.length - 1] : null;
    const mx = moving.x, mw = moving.w;

    if (!top) {
      // First block: lands anywhere, full width kept.
      placeBlock({ x: mx, w: mw });
      return;
    }

    const overlapLeft = Math.max(mx, top.x);
    const overlapRight = Math.min(mx + mw, top.x + top.w);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 0) {
      // Missed completely — the whole block tumbles away.
      slices.push({ x: mx, w: mw, y: MOVE_Y, vy: 0, color: blockColor(blocks.length) });
      endGame();
      return;
    }

    const perfect = overlap >= 0.95 * mw;
    if (perfect) {
      // Keep the moving block full-width, no slice, small bonus (+1).
      blocks.push({ x: mx, w: mw, color: blockColor(blocks.length) });
      score += 2; // 1 for the block + 1 perfect bonus
      camEase -= BLOCK_H;
      floaters.push({ text: "PERFECT!", y: ANCHOR_Y - 10, alpha: 1 });
      updateScore();
      moving = newMovingBlock(mw);
      return;
    }

    placeBlock({ x: overlapLeft, w: overlap });

    // Overhanging slice(s) fall away.
    if (mx < top.x && top.x - mx >= MIN_SLICE) {
      slices.push({ x: mx, w: top.x - mx, y: MOVE_Y, vy: 0, color: blockColor(blocks.length - 1) });
    }
    const rightEnd = mx + mw, topRight = top.x + top.w;
    if (rightEnd > topRight && rightEnd - topRight >= MIN_SLICE) {
      slices.push({ x: topRight, w: rightEnd - topRight, y: MOVE_Y, vy: 0, color: blockColor(blocks.length - 1) });
    }
  }

  function placeBlock(block) {
    const level = blocks.length;
    blocks.push({ x: block.x, w: block.w, color: blockColor(level) });
    score += 1;
    camEase -= BLOCK_H;          // whole tower appears one block high, then slides down
    updateScore();
    moving = newMovingBlock(block.w);
  }

  function endGame() {
    gameOver = true;
    showOverlay();
  }

  // ---- Input ----
  document.addEventListener("keydown", e => {
    if (e.key === " ") {
      e.preventDefault();
      if (gameOver) { if (overlay) overlay.remove(); reset(); return; }
      drop();
    }
  });
  canvas.addEventListener("pointerdown", e => { e.preventDefault(); drop(); });
  restartBtn.addEventListener("click", reset);

  // ---- Update ----
  function update() {
    if (!gameOver) {
      moving.x += moving.dir * moving.speed;
      if (moving.x <= 0) { moving.x = 0; moving.dir = 1; }
      else if (moving.x + moving.w >= W) { moving.x = W - moving.w; moving.dir = -1; }
    }
    camEase += (0 - camEase) * 0.18;
    if (Math.abs(camEase) < 0.3) camEase = 0;

    for (const s of slices) { s.vy += 0.5; s.y += s.vy; }
    slices = slices.filter(s => s.y < H + BLOCK_H * 2);

    for (const f of floaters) { f.y -= 0.8; f.alpha -= 0.02; }
    floaters = floaters.filter(f => f.alpha > 0);
  }

  // ---- Rendering ----
  function blockY(level) {
    // Newest block sits at ANCHOR_Y; older blocks extend downward.
    return ANCHOR_Y + (blocks.length - 1 - level) * BLOCK_H + camEase;
  }

  function draw() {
    // Background — simple vertical gradient with a few static stars.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#12142e");
    g.addColorStop(1, "#1e2044");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (const [sx, sy, sr] of [[52, 60, 1.4], [330, 42, 1.2], [210, 88, 1.6], [120, 132, 1.1], [288, 118, 1.3], [370, 160, 1.5]]) {
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Tower blocks (cull anything off the bottom).
    for (let i = 0; i < blocks.length; i++) {
      const y = blockY(i);
      if (y > H + BLOCK_H) continue;
      drawBlock(blocks[i].x, y, blocks[i].w, blocks[i].color);
    }

    // Falling overhang slices.
    for (const s of slices) drawBlock(s.x, s.y, s.w, s.color);

    // Sliding block.
    if (!gameOver) {
      ctx.save();
      ctx.shadowColor = "rgba(88,224,201,0.6)";
      ctx.shadowBlur = 12;
      drawBlock(moving.x, MOVE_Y, moving.w, blockColor(blocks.length));
      ctx.restore();
    }

    // Floating PERFECT! texts.
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.fillStyle = "#ffcc4d";
      ctx.font = "bold 20px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, W / 2, f.y);
      ctx.globalAlpha = 1;
    }

    // Drop hint while playing.
    if (!gameOver && blocks.length === 0) {
      ctx.fillStyle = "rgba(238,240,255,0.75)";
      ctx.font = "14px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Space / click to drop", W / 2, H - 40);
    }
  }

  function drawBlock(x, y, w, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, BLOCK_H);
    ctx.fillStyle = "rgba(255,255,255,0.22)";   // top highlight
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "rgba(0,0,0,0.28)";          // bottom shade
    ctx.fillRect(x, y + BLOCK_H - 4, w, 4);
  }

  // ---- Overlay ----
  function showOverlay() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Game Over</h2>
      <p>Score: ${score} &nbsp;·&nbsp; Best: ${best}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", () => { overlay.remove(); reset(); });
  }

  // ---- Main loop (single loop for the page lifetime) ----
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
