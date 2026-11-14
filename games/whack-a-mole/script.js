// Whack-a-Mole — pure vanilla JS, fully offline.
(() => {
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const startBtn = document.getElementById("start");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const HOLES = 9, ROUND_SECONDS = 30;
  let holes, moles, score, timeLeft, playing, countdownId, spawnId, best;

  best = store.get("wam-best");
  bestEl.textContent = best;

  function build() {
    boardEl.style.gridTemplateColumns = "repeat(3, 1fr)";
    boardEl.innerHTML = "";
    holes = [];
    for (let i = 0; i < HOLES; i++) {
      const hole = document.createElement("button");
      hole.className = "cell hole";
      hole.style.width = "96px";
      hole.style.height = "96px";
      hole.style.fontSize = "2.6rem";
      hole.textContent = "";
      hole.addEventListener("click", () => whack(i));
      boardEl.appendChild(hole);
      holes.push(hole);
    }
  }

  function randomMoleDelay() { return Math.random() * 600 + 350; }
  function holdTime() { return Math.random() * 500 + 500; }

  function showMole() {
    if (!playing) return;
    const empty = holes.map((h, i) => i).filter(i => !holes[i].dataset.mole);
    if (!empty.length) { scheduleSpawn(); return; }
    const idx = empty[Math.floor(Math.random() * empty.length)];
    holes[idx].textContent = "🐹";
    holes[idx].dataset.mole = "1";
    setTimeout(() => {
      if (holes[idx].dataset.mole) {
        holes[idx].textContent = "";
        delete holes[idx].dataset.mole;
      }
      scheduleSpawn();
    }, holdTime());
  }

  function scheduleSpawn() {
    if (!playing) return;
    spawnId = setTimeout(showMole, randomMoleDelay());
  }

  function whack(i) {
    if (!playing || !holes[i].dataset.mole) return;
    score++;
    scoreEl.textContent = score;
    holes[i].textContent = "💥";
    delete holes[i].dataset.mole;
    setTimeout(() => { if (!holes[i].dataset.mole) holes[i].textContent = ""; }, 250);
  }

  function endGame() {
    playing = false;
    clearTimeout(spawnId);
    clearInterval(countdownId);
    holes.forEach(h => { h.textContent = ""; delete h.dataset.mole; });
    if (score > best) { best = score; store.set("wam-best", best); bestEl.textContent = best; }
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Time! ⏱️</h2>
      <p>You whacked ${score} moles. Best: ${best}.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.getElementById("ov-restart").addEventListener("click", reset);
  }

  let overlay;
  function start() {
    if (playing) return;
    score = 0; timeLeft = ROUND_SECONDS;
    scoreEl.textContent = "0"; timeEl.textContent = ROUND_SECONDS;
    build();
    playing = true;
    startBtn.disabled = true;
    countdownId = setInterval(() => {
      timeLeft--;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) endGame();
    }, 1000);
    scheduleSpawn();
  }

  function reset() {
    if (overlay) overlay.remove();
    startBtn.disabled = false;
    start();
  }

  startBtn.addEventListener("click", start);
  build();
})();
