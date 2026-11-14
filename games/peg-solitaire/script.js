// Peg Solitaire — classic English board (cross-shaped, 33 holes). Fully offline.
(() => {
  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const pegsLeftEl = document.getElementById("pegs-left");
  const winsEl = document.getElementById("wins");
  const undoBtn = document.getElementById("undo");
  const newGameBtn = document.getElementById("new-game");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // 7×7 validity mask — the cross: arms of rows 0,1,5,6 only span cols 2..4.
  const isValid = (r, c) =>
    (r >= 0 && r < 7 && c >= 0 && c < 7) &&
    ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const EMPTY = 0, PEG = 1, VOID = -1;
  const HISTORY_CAP = 200;

  let board, selected, moves, history, gameOver;
  let wins = store.get("pegsol-wins");

  function pegCount() {
    let n = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (board[r][c] === PEG) n++;
    return n;
  }

  function movesFrom(r, c) {
    if (!isValid(r, c) || board[r][c] !== PEG) return [];
    const out = [];
    for (const [dr, dc] of DIRS) {
      const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!isValid(tr, tc)) continue;
      if (board[mr][mc] === PEG && board[tr][tc] === EMPTY) out.push({ over: [mr, mc], to: [tr, tc] });
    }
    return out;
  }

  function anyMovesLeft() {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++)
        if (board[r][c] === PEG && movesFrom(r, c).length) return true;
    return false;
  }

  function updateStatus() {
    movesEl.textContent = moves;
    pegsLeftEl.textContent = pegCount();
    winsEl.textContent = wins;
  }

  function render() {
    boardEl.innerHTML = "";
    const targets = selected ? movesFrom(selected[0], selected[1]).map(m => m.to.join(",")) : [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (!isValid(r, c)) {
          const spacer = document.createElement("div");
          spacer.className = "peg-invalid";
          boardEl.appendChild(spacer);
          continue;
        }
        const cell = document.createElement("button");
        cell.className = "peg-cell";
        cell.setAttribute("aria-label", board[r][c] === PEG ? "Peg" : "Empty hole");
        if (board[r][c] === PEG) {
          const peg = document.createElement("span");
          peg.className = "peg";
          cell.appendChild(peg);
          if (selected && selected[0] === r && selected[1] === c) cell.classList.add("peg-cell--selected");
        } else if (targets.includes(r + "," + c)) {
          cell.classList.add("peg-cell--target");
        }
        cell.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function pushHistory() {
    history.push({ board: board.map(row => row.slice()), moves });
    if (history.length > HISTORY_CAP) history.shift();
  }

  function onCellClick(r, c) {
    if (gameOver) return;
    if (board[r][c] === PEG) {
      // Clicking another peg re-selects; clicking the selected peg deselects.
      selected = (selected && selected[0] === r && selected[1] === c) ? null : [r, c];
      render();
      return;
    }
    if (selected) {
      const move = movesFrom(selected[0], selected[1]).find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        pushHistory();
        board[selected[0]][selected[1]] = EMPTY;
        board[move.over[0]][move.over[1]] = EMPTY;
        board[r][c] = PEG;
        moves++;
        selected = null;
        render();
        updateStatus();
        checkEnd();
        return;
      }
      // Invalid destination — deselect.
      selected = null;
      render();
    }
  }

  function undo() {
    if (!history.length) return;
    const snap = history.pop();
    board = snap.board.map(row => row.slice());
    moves = snap.moves;
    selected = null;
    gameOver = false;
    if (overlay) overlay.remove();
    render();
    updateStatus();
  }

  let overlay;
  function showOverlay(title, msg) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function checkEnd() {
    if (anyMovesLeft()) return;
    gameOver = true;
    const n = pegCount();
    if (n === 1) {
      wins++;
      store.set("pegsol-wins", wins);
      updateStatus();
      showOverlay("Perfect solve! 🏆", `One peg left in ${moves} moves. Beautifully played!`);
    } else {
      showOverlay(`Game over — ${n} pegs left`, "No jumps remain. Better luck next board!");
    }
  }

  function reset() {
    board = [];
    for (let r = 0; r < 7; r++) {
      const row = [];
      for (let c = 0; c < 7; c++) row.push(isValid(r, c) ? PEG : VOID);
      board.push(row);
    }
    board[3][3] = EMPTY; // standard: center hole starts empty
    moves = 0;
    history = [];
    selected = null;
    gameOver = false;
    if (overlay) overlay.remove();
    render();
    updateStatus();
  }

  undoBtn.addEventListener("click", undo);
  newGameBtn.addEventListener("click", reset);

  reset();
})();
