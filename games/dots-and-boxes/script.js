// Dots & Boxes — pure vanilla JS, offline, greedy-with-avoidance AI.
(() => {
  const boardEl = document.getElementById("board");
  const youScoreEl = document.getElementById("you-score");
  const cpuScoreEl = document.getElementById("cpu-score");
  const winsEl = document.getElementById("wins");
  const turnLabel = document.getElementById("turn-label");

  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const DOTS = 5, BOXES = 4, TOTAL_BOXES = BOXES * BOXES;
  let wins = store.get("dots-wins");

  // hLines[r][c]: horizontal segment in dot-row r (0-4), between dots c and c+1 (0-3)
  // vLines[r][c]: vertical segment in dot-col c (0-4), between dots r and r+1 (0-3)
  let hLines, vLines, boxes;
  let scores, turn, gameOver, busy, overlay;
  const hBtns = [], vBtns = [], boxEls = [];

  // Build the 9x9 grid explicitly: dot/line/dot pattern.
  function buildGrid9x9() {
    boardEl.innerHTML = "";
    hBtns.length = 0; vBtns.length = 0; boxEls.length = 0;
    for (let gr = 0; gr < 9; gr++) {
      if (gr % 2 === 0) hBtns.push(new Array(BOXES).fill(null));
      else vBtns.push(new Array(DOTS).fill(null));
      if (gr % 2 === 1) boxEls.push(new Array(BOXES).fill(null));
      const dotRow = gr / 2;
      const boxRow = (gr - 1) / 2;
      for (let gc = 0; gc < 9; gc++) {
        const dotCol = gc / 2;
        const boxCol = (gc - 1) / 2;
        if (gr % 2 === 0 && gc % 2 === 0) {
          const dot = document.createElement("div");
          dot.className = "dot";
          boardEl.appendChild(dot);
        } else if (gr % 2 === 0 && gc % 2 === 1) {
          const line = document.createElement("button");
          line.className = "line line--h";
          line.setAttribute("aria-label", `Horizontal line row ${dotRow + 1}, segment ${boxCol + 1}`);
          line.innerHTML = '<div class="line__bar"></div>';
          line.addEventListener("click", () => humanClaim("h", dotRow, boxCol));
          boardEl.appendChild(line);
          hBtns[dotRow][boxCol] = line;
        } else if (gr % 2 === 1 && gc % 2 === 0) {
          const line = document.createElement("button");
          line.className = "line line--v";
          line.setAttribute("aria-label", `Vertical line col ${dotCol + 1}, segment ${boxRow + 1}`);
          line.innerHTML = '<div class="line__bar"></div>';
          line.addEventListener("click", () => humanClaim("v", boxRow, dotCol));
          boardEl.appendChild(line);
          vBtns[boxRow][dotCol] = line;
        } else {
          const box = document.createElement("div");
          box.className = "box";
          box.textContent = "·";
          boardEl.appendChild(box);
          boxEls[boxRow][boxCol] = box;
        }
      }
    }
  }

  function boxSides(br, bc) {
    let n = 0;
    if (hLines[br][bc]) n++;     // top
    if (hLines[br + 1][bc]) n++; // bottom
    if (vLines[br][bc]) n++;     // left
    if (vLines[br][bc + 1]) n++; // right
    return n;
  }

  function renderLine(type, r, c) {
    const btn = type === "h" ? hBtns[r][c] : vBtns[r][c];
    const owner = type === "h" ? hLines[r][c] : vLines[r][c];
    btn.classList.toggle("claimed-you", owner === "you");
    btn.classList.toggle("claimed-cpu", owner === "cpu");
    btn.disabled = !!owner;
  }

  function renderBox(br, bc) {
    const el = boxEls[br][bc];
    const owner = boxes[br][bc];
    el.classList.toggle("filled-you", owner === "you");
    el.classList.toggle("filled-cpu", owner === "cpu");
    el.textContent = owner === "you" ? "Y" : owner === "cpu" ? "C" : "·";
  }

  function render() {
    for (let r = 0; r < DOTS; r++) for (let c = 0; c < BOXES; c++) renderLine("h", r, c);
    for (let r = 0; r < BOXES; r++) for (let c = 0; c < DOTS; c++) renderLine("v", r, c);
    for (let r = 0; r < BOXES; r++) for (let c = 0; c < BOXES; c++) renderBox(r, c);
    youScoreEl.textContent = scores.you;
    cpuScoreEl.textContent = scores.cpu;
    winsEl.textContent = wins;
  }

  function allBoxesFilled() {
    for (let r = 0; r < BOXES; r++) for (let c = 0; c < BOXES; c++) if (!boxes[r][c]) return false;
    return true;
  }

  // Adjacent boxes for a candidate line: [boxR, boxC] pairs (existing boxes only).
  function affectedBoxes(type, r, c) {
    const list = [];
    if (type === "h") {
      if (r > 0) list.push([r - 1, c]);
      if (r < BOXES) list.push([r, c]);
    } else {
      if (c > 0) list.push([r, c - 1]);
      if (c < BOXES) list.push([r, c]);
    }
    return list;
  }

  function claimLine(type, r, c, who) {
    if (type === "h") hLines[r][c] = who; else vLines[r][c] = who;
    // Claim any boxes completed by this line.
    let completed = 0;
    for (const [br, bc] of affectedBoxes(type, r, c)) {
      if (!boxes[br][bc] && boxSides(br, bc) === 4) {
        boxes[br][bc] = who;
        scores[who]++;
        completed++;
      }
    }
    render();
    if (allBoxesFilled()) return endGame();
    if (completed === 0) turn = turn === "you" ? "cpu" : "you"; // no box → turn passes
    // else same player goes again
    turnLabel.textContent = turn === "you" ? "Your line — draw any segment" : "CPU is thinking…";
    if (turn === "cpu" && !gameOver) {
      busy = true;
      setTimeout(aiMove, 600);
    } else {
      busy = false;
    }
    return completed;
  }

  function humanClaim(type, r, c) {
    if (gameOver || busy || turn !== "you") return;
    if (type === "h" ? hLines[r][c] : vLines[r][c]) return;
    claimLine(type, r, c, "you");
  }

  // AI: 1) take any line completing a box (greedy);
  //     2) else avoid lines that would give the opponent a third side;
  //     3) else random.
  function aiChoose() {
    const candidates = [];
    for (let r = 0; r < DOTS; r++) for (let c = 0; c < BOXES; c++) {
      if (!hLines[r][c]) candidates.push(analyse("h", r, c));
    }
    for (let r = 0; r < BOXES; r++) for (let c = 0; c < DOTS; c++) {
      if (!vLines[r][c]) candidates.push(analyse("v", r, c));
    }
    const completing = candidates.filter(x => x.completes > 0);
    if (completing.length) {
      completing.sort((a, b) => b.completes - a.completes);
      return completing[0];
    }
    const safe = candidates.filter(x => x.makesThird === 0);
    const pool = safe.length ? safe : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function analyse(type, r, c) {
    let completes = 0, makesThird = 0;
    for (const [br, bc] of affectedBoxes(type, r, c)) {
      const sides = boxSides(br, bc);
      if (sides === 3) completes++;
      else if (sides === 2) makesThird++;
    }
    return { type, r, c, completes, makesThird };
  }

  function aiMove() {
    if (gameOver || turn !== "cpu") return;
    busy = false;
    const choice = aiChoose();
    if (choice) claimLine(choice.type, choice.r, choice.c, "cpu");
  }

  function endGame() {
    gameOver = true;
    busy = false;
    let title, msg;
    if (scores.you > scores.cpu) { title = "You win! 🎉"; wins++; store.set("dots-wins", wins); }
    else if (scores.cpu > scores.you) title = "CPU wins 🤖";
    else title = "Draw!";
    msg = `Final score — You ${scores.you}, CPU ${scores.cpu}.`;
    render();
    turnLabel.textContent = title.replace(" 🎉", "").replace(" 🤖", "");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function reset() {
    hLines = Array.from({ length: DOTS }, () => new Array(BOXES).fill(null));
    vLines = Array.from({ length: BOXES }, () => new Array(DOTS).fill(null));
    boxes = Array.from({ length: BOXES }, () => new Array(BOXES).fill(null));
    scores = { you: 0, cpu: 0 };
    turn = "you";
    gameOver = false;
    busy = false;
    if (overlay) overlay.remove();
    turnLabel.textContent = "Your line — draw any segment";
    render();
  }

  document.getElementById("new-game").addEventListener("click", reset);

  buildGrid9x9();
  reset();
})();
