// Tic-Tac-Toe — pure vanilla JS, fully offline, perfect-play AI.
(() => {
  const boardEl = document.getElementById("board");
  const youEl = document.getElementById("you");
  const cpuEl = document.getElementById("cpu");
  const drawsEl = document.getElementById("draws");
  const firstSel = document.getElementById("first");

  const HUMAN = "X", AI = "O";

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let board, gameOver, scores;
  scores = { you: store.get("ttt-you"), cpu: store.get("ttt-cpu"), draws: store.get("ttt-draws") };

  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function updateScore() {
    youEl.textContent = scores.you; cpuEl.textContent = scores.cpu; drawsEl.textContent = scores.draws;
  }

  function checkWin(b, p) {
    return LINES.some(([a, c, d]) => b[a] === p && b[c] === p && b[d] === p);
  }

  // Minimax — returns the optimal score for the player to move.
  function maximizer(b) {
    const winner = winnerOf(b);
    if (winner === AI) return 10;
    if (winner === HUMAN) return -10;
    if (b.every(x => x)) return 0;
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== "") continue;
      b[i] = AI;
      best = Math.max(best, maximizer(b));
      b[i] = "";
    }
    return best;
  }
  function minimizer(b) {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== "") continue;
      b[i] = HUMAN;
      best = Math.min(best, maximizer(b));
      b[i] = "";
    }
    return best;
  }
  function winnerOf(b) {
    if (checkWin(b, AI)) return AI;
    if (checkWin(b, HUMAN)) return HUMAN;
    return null;
  }

  function aiMove() {
    let bestScore = -Infinity, move = -1;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== "") continue;
      board[i] = AI;
      const s = minimizer(board);
      board[i] = "";
      if (s > bestScore) { bestScore = s; move = i; }
    }
    if (move !== -1) place(move, AI);
  }

  function place(idx, p) {
    board[idx] = p;
    renderCell(idx);
    const w = winnerOf(board);
    if (w) return endGame(w);
    if (board.every(x => x)) return endGame("draw");
    if (p === HUMAN) { currentTurn = AI; setTimeout(aiMove, 300); }
    else currentTurn = HUMAN;
  }

  let currentTurn;
  function renderCell(idx) {
    const cell = boardEl.children[idx];
    cell.textContent = board[idx];
    cell.classList.add("played");
    cell.disabled = true;
  }

  function render() {
    boardEl.style.gridTemplateColumns = "repeat(3, 1fr)";
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.width = "96px";
      cell.style.height = "96px";
      cell.style.fontSize = "2.8rem";
      cell.addEventListener("click", () => humanMove(i));
      boardEl.appendChild(cell);
    }
    board.forEach((v, i) => { if (v) renderCell(i); });
  }

  function humanMove(i) {
    if (gameOver || currentTurn !== HUMAN || board[i] !== "") return;
    place(i, HUMAN);
  }

  let overlay;
  function endGame(result) {
    gameOver = true;
    let title, msg;
    if (result === "draw") { title = "Draw!"; scores.draws++; }
    else if (result === HUMAN) { title = "You win! 🎉"; scores.you++; }
    else { title = "CPU wins 🤖"; scores.cpu++; }
    store.set("ttt-you", scores.you);
    store.set("ttt-cpu", scores.cpu);
    store.set("ttt-draws", scores.draws);
    updateScore();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg || ""}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function reset() {
    board = new Array(9).fill("");
    gameOver = false;
    render();
    if (firstSel.value === "cpu") { currentTurn = AI; setTimeout(aiMove, 300); }
    else currentTurn = HUMAN;
    if (overlay) overlay.remove();
  }

  document.getElementById("new-game").addEventListener("click", reset);
  firstSel.addEventListener("change", reset);
  updateScore();
  reset();
})();
