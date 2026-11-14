// Tower of Hanoi — pure vanilla JS, fully offline. DOM-based pegs & discs.
(() => {
  const movesEl = document.getElementById("moves");
  const minEl = document.getElementById("min-moves");
  const bestEl = document.getElementById("best");
  const boardEl = document.getElementById("board");
  const ringSel = document.getElementById("ring-select");
  const undoBtn = document.getElementById("undo-btn");
  const solveBtn = document.getElementById("solve-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const newGameBtn = document.getElementById("new-game");
  const hintEl = document.getElementById("hint");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const HINT_DEFAULT = "Click a peg to lift its top disc, then click another peg to drop it. Move every ring to the right peg.";
  const DISC_COLORS = [
    ["#ffe98a", "#f2c037"], // 1 — smallest
    ["#ffd0a0", "#ff8c1a"],
    ["#ff9ecd", "#ff5ea8"],
    ["#ff9d8a", "#ef4d38"],
    ["#d6a6ff", "#8b3df0"],
    ["#a8e6ff", "#38a6ef"],
    ["#8affd2", "#10b981"], // 7 — largest
  ];

  let ringCount = 4;
  let pegs = [[], [], []]; // each peg: bottom → top disc numbers
  let moves = 0, history = [], held = null, gameOver = false;
  let autoPlaying = false, autoTimer = null, overlay = null;

  const minMoves = (n) => Math.pow(2, n) - 1;
  const bestKey = (n) => "hanoi-best-" + n;
  const getBest = (n) => store.get(bestKey(n), 0); // 0 = no record yet

  function discWidth(d) {
    const avail = Math.max(88, Math.min(146, Math.floor((window.innerWidth - 140) / 3) - 16));
    return Math.round(46 + (avail - 46) * (d - 1) / (ringCount - 1));
  }

  const heldDisc = () => (held === null ? null : pegs[held][pegs[held].length - 1]);
  const canDrop = (p, d) => pegs[p].length === 0 || pegs[p][pegs[p].length - 1] > d;

  function render() {
    boardEl.querySelectorAll(".peg").forEach((pegEl, p) => {
      const stack = pegEl.querySelector(".peg__stack");
      stack.innerHTML = "";
      for (const d of pegs[p]) {
        const disc = document.createElement("div");
        disc.className = "disc";
        disc.style.width = discWidth(d) + "px";
        const [c1, c2] = DISC_COLORS[d - 1];
        disc.style.background = `linear-gradient(180deg, ${c1} 0%, ${c2} 78%)`;
        if (held === p && d === pegs[p][pegs[p].length - 1]) disc.classList.add("disc--held");
        stack.appendChild(disc);
      }
      pegEl.classList.toggle("peg--source", held === p);
      const droppable = held !== null && p !== held && canDrop(p, heldDisc());
      pegEl.classList.toggle("peg--ok", droppable);
    });
    movesEl.textContent = moves;
    minEl.textContent = minMoves(ringCount);
    const best = getBest(ringCount);
    bestEl.textContent = best > 0 ? best : "—";
    undoBtn.disabled = autoPlaying || gameOver || history.length === 0;
  }

  function setControlsEnabled(on) {
    ringSel.disabled = !on;
    solveBtn.disabled = !on;
    newGameBtn.disabled = !on;
    undoBtn.disabled = !on || gameOver || history.length === 0;
  }

  function doMove(from, to) {
    const d = pegs[from].pop();
    pegs[to].push(d);
    moves++;
    history.push([from, to]);
    if (held !== null && pegs[held].length === 0) held = null; // safety
    render();
    if (pegs[2].length === ringCount) onWin();
  }

  function onPegClick(p) {
    if (autoPlaying || gameOver) return;
    if (held === null) {
      if (pegs[p].length > 0) {
        held = p;
        hintEl.textContent = "Disc lifted — click a highlighted peg to drop it, or the same peg to set it back.";
        render();
      }
      return;
    }
    if (held === p) {
      held = null;
      hintEl.textContent = HINT_DEFAULT;
      render();
      return;
    }
    const d = heldDisc();
    if (canDrop(p, d)) {
      const from = held;
      held = null;
      doMove(from, p);
      if (!gameOver) hintEl.textContent = HINT_DEFAULT;
    } else {
      const pegEl = boardEl.querySelectorAll(".peg")[p];
      pegEl.classList.remove("peg--shake");
      void pegEl.offsetWidth; // restart animation
      pegEl.classList.add("peg--shake");
      hintEl.textContent = "A larger disc can't sit on a smaller one!";
    }
  }

  function onWin() {
    gameOver = true;
    const min = minMoves(ringCount);
    let best = getBest(ringCount);
    const isRecord = best === 0 || moves < best;
    if (isRecord) {
      best = moves;
      store.set(bestKey(ringCount), best);
    }
    const wins = store.get("hanoi-wins") + 1;
    store.set("hanoi-wins", wins);
    render();
    const perfect = moves === min ? " A perfect, optimal solution! 🏆" : "";
    const record = isRecord ? ` New best for ${ringCount} rings!` : "";
    showOverlay("Tower Solved! 🎉",
      `<p>Solved in ${moves} moves (minimum ${min}).${perfect}<br>Total wins: ${wins}.${record}</p>`);
  }

  function showOverlay(title, bodyHtml) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2>${bodyHtml}
      <button class="btn" id="ov-restart">Play Again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    autoPlaying = false;
    cancelBtn.hidden = true;
    solveBtn.hidden = false;
    setControlsEnabled(true);
    render();
  }

  function newGame() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    autoPlaying = false;
    cancelBtn.hidden = true;
    solveBtn.hidden = false;
    setControlsEnabled(true);
    ringCount = parseInt(ringSel.value, 10) || 4;
    pegs = [[], [], []];
    for (let d = ringCount; d >= 1; d--) pegs[0].push(d); // largest at the bottom
    moves = 0;
    history = [];
    held = null;
    gameOver = false;
    if (overlay) { overlay.remove(); overlay = null; }
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  function undo() {
    if (autoPlaying || gameOver || history.length === 0) return;
    const [from, to] = history.pop();
    const d = pegs[to].pop();
    pegs[from].push(d);
    moves = Math.max(0, moves - 1);
    held = null;
    hintEl.textContent = HINT_DEFAULT;
    render();
  }

  // --- Optimal auto-solver (recursive), plans from the current position ---
  function pegOfDisc(state, d) {
    for (let p = 0; p < 3; p++) if (state[p].includes(d)) return p;
    return -1;
  }
  // Classic: move the k discs stacked on `from` onto `to`.
  function planStack(k, from, to, out) {
    if (k === 0) return;
    const aux = 3 - from - to;
    planStack(k - 1, from, aux, out);
    out.push([from, to]);
    planStack(k - 1, aux, to, out);
  }
  // Gather discs 1..k (in arbitrary legal spots in `state`) onto `target`.
  function planGather(k, target, state, out) {
    if (k === 0) return;
    const p = pegOfDisc(state, k);
    if (p === target) {
      planGather(k - 1, target, state, out);
      return;
    }
    const q = 3 - p - target;
    planGather(k - 1, q, state, out);
    out.push([p, target]);
    state[target].push(state[p].pop());
    planStack(k - 1, q, target, out);
  }

  function autoSolve() {
    if (autoPlaying) return;
    // Start from a fresh tower so the recursive optimal plan is guaranteed valid.
    newGame();
    const state = pegs.map((a) => a.slice());
    const plan = [];
    planGather(ringCount, 2, state, plan);
    autoPlaying = true;
    held = null;
    solveBtn.hidden = true;
    cancelBtn.hidden = false;
    setControlsEnabled(false);
    render();
    let i = 0;
    autoTimer = setInterval(() => {
      if (i >= plan.length || gameOver) { stopAuto(); return; }
      const [from, to] = plan[i++];
      doMove(from, to);
    }, 450);
  }

  boardEl.querySelectorAll(".peg").forEach((pegEl) => {
    const p = Number(pegEl.dataset.peg);
    pegEl.addEventListener("click", () => onPegClick(p));
    pegEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPegClick(p);
      }
    });
  });
  window.addEventListener("resize", render);

  undoBtn.addEventListener("click", undo);
  solveBtn.addEventListener("click", autoSolve);
  cancelBtn.addEventListener("click", stopAuto);
  newGameBtn.addEventListener("click", newGame);
  ringSel.addEventListener("change", newGame);

  newGame();
})();
