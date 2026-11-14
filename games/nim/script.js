// Nim — pure vanilla JS, offline, perfect-play CPU via recursive win/loss search.
(() => {
  const pileEl = document.getElementById("pile");
  const pileCountEl = document.getElementById("pile-count");
  const turnLabel = document.getElementById("turn-label");
  const winsEl = document.getElementById("wins");
  const lossesEl = document.getElementById("losses");
  const takeBtns = [document.getElementById("take-1"), document.getElementById("take-2"), document.getElementById("take-3")];
  const modeNormalBtn = document.getElementById("mode-normal");
  const modeMisereBtn = document.getElementById("mode-misere");

  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const START = 15;
  let wins = store.get("nim-wins"), losses = store.get("nim-losses");
  let mode = "normal"; // normal | misere
  let pile = START, turn = "you", gameOver = false, busy = false;
  let overlay;

  // Perfect play: is the position (n counters, side to move) winning?
  // Brute-force search over 1-3 removals + recursion, cached per mode.
  const cache = { normal: new Map(), misere: new Map() };
  function winPos(n, m) {
    if (cache[m].has(n)) return cache[m].get(n);
    let result = false;
    if (n > 0) {
      for (const take of [1, 2, 3]) {
        if (take > n) continue;
        const rest = n - take;
        if (rest === 0) {
          if (m === "normal") { result = true; break; } // taking last wins in normal
          continue; // taking last loses in misère — not a winning move
        }
        if (!winPos(rest, m)) { result = true; break; } // leave opponent a losing position
      }
    }
    cache[m].set(n, result);
    return result;
  }

  function cpuChooseMove() {
    const legal = [1, 2, 3].filter(t => t <= pile);
    for (const take of legal) {
      const rest = pile - take;
      const winning = rest === 0 ? mode === "normal" : !winPos(rest, mode);
      if (winning) return take;
    }
    // No winning move — pick randomly among losing options.
    return legal[Math.floor(Math.random() * legal.length)];
  }

  function renderPile() {
    pileEl.innerHTML = "";
    for (let i = 0; i < START; i++) {
      const span = document.createElement("span");
      span.className = "token" + (i < START - pile ? " taken" : "");
      span.textContent = "🪙";
      pileEl.appendChild(span);
    }
    pileCountEl.textContent = pile;
  }

  function updateControls() {
    const canAct = !gameOver && !busy && turn === "you";
    takeBtns.forEach((btn, i) => { btn.disabled = !canAct || i + 1 > pile; });
  }

  function updateScore() {
    winsEl.textContent = wins;
    lossesEl.textContent = losses;
  }

  function applyTake(n, who) {
    pile -= n;
    renderPile();
    if (pile === 0) return endGame(who);
    turn = who === "you" ? "cpu" : "you";
    if (turn === "cpu") {
      busy = true;
      turnLabel.textContent = "CPU is thinking…";
    } else {
      turnLabel.textContent = "Your move — take 1 to 3";
    }
    updateControls();
    if (turn === "cpu") setTimeout(cpuMove, 750);
  }

  function cpuMove() {
    if (gameOver) return;
    const take = cpuChooseMove();
    busy = false;
    applyTake(take, "cpu");
  }

  function endGame(lastTaker) {
    gameOver = true;
    busy = false;
    const youTookLast = lastTaker === "you";
    const youWin = mode === "normal" ? youTookLast : !youTookLast;
    if (youWin) { wins++; store.set("nim-wins", wins); }
    else { losses++; store.set("nim-losses", losses); }
    turnLabel.textContent = youWin ? "You win!" : "CPU wins!";
    updateScore();
    updateControls();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    const title = youWin ? "You win! 🎉" : "CPU wins 🤖";
    const modeName = mode === "normal" ? "Normal" : "Misère";
    const detail = youTookLast
      ? "You took the last counter."
      : "The CPU took the last counter.";
    const msg = `${modeName} mode — ${detail} ${mode === "normal" ? "Taking the last counter wins." : "Taking the last counter loses."}`;
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    modeNormalBtn.classList.toggle("active", m === "normal");
    modeMisereBtn.classList.toggle("active", m === "misere");
    modeNormalBtn.classList.toggle("btn--ghost", m !== "normal");
    modeMisereBtn.classList.toggle("btn--ghost", m !== "misere");
    reset();
  }

  function reset() {
    pile = START;
    turn = "you";
    gameOver = false;
    busy = false;
    if (overlay) overlay.remove();
    turnLabel.textContent = "Your move — take 1 to 3";
    renderPile();
    updateControls();
  }

  takeBtns.forEach((btn, i) => btn.addEventListener("click", () => {
    if (gameOver || busy || turn !== "you") return;
    const take = i + 1;
    if (take > pile) return;
    applyTake(take, "you");
  }));
  modeNormalBtn.addEventListener("click", () => setMode("normal"));
  modeMisereBtn.addEventListener("click", () => setMode("misere"));
  document.getElementById("new-game").addEventListener("click", reset);

  updateScore();
  reset();
})();
