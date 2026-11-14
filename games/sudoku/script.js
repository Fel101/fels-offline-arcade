// Sudoku — generator + solver, pure vanilla JS, fully offline.
(() => {
  const boardEl = document.getElementById("board");
  const timeEl = document.getElementById("time");
  const diffLabel = document.getElementById("diff-label");
  const difficultySel = document.getElementById("difficulty");

  const REMOVES = { easy: 35, medium: 45, hard: 56 };
  const DIFF_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

  let solution, puzzle, given, selected, cells, startTime, timerId;

  // ---- Solver / generator ----
  function emptyGrid() { return Array.from({ length: 9 }, () => new Array(9).fill(0)); }

  function valid(g, r, c, v) {
    for (let i = 0; i < 9; i++)
      if (g[r][i] === v || g[i][c] === v) return false;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        if (g[br + i][bc + j] === v) return false;
    return true;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fill(g) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const v of nums) {
            if (valid(g, r, c, v)) {
              g[r][c] = v;
              if (fill(g)) return true;
              g[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function countSolutions(g, limit = 2) {
    let count = 0;
    let aborted = false;
    const MAX_CALLS = 400000; // bound worst-case time on sparse boards
    let calls = 0;
    function solve() {
      if (count >= limit || aborted) return;
      if (++calls > MAX_CALLS) { aborted = true; return; }
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === 0) {
            for (let v = 1; v <= 9; v++) {
              if (valid(g, r, c, v)) {
                g[r][c] = v;
                solve();
                g[r][c] = 0;
                if (count >= limit || aborted) return;
              }
            }
            return;
          }
        }
      }
      count++;
    }
    solve();
    return aborted ? 2 : count; // couldn't finish → assume ambiguous
  }

  function generatePuzzle(diff) {
    const full = emptyGrid();
    fill(full);
    solution = full.map(r => [...r]);

    const p = full.map(r => [...r]);
    given = Array.from({ length: 9 }, () => new Array(9).fill(true));
    const cellsToRemove = REMOVES[diff];
    const spots = shuffle([...Array(81).keys()]);

    let removed = 0;
    for (const idx of spots) {
      if (removed >= cellsToRemove) break;
      const r = Math.floor(idx / 9), c = idx % 9;
      const save = p[r][c];
      p[r][c] = 0;
      // Keep removal only if the puzzle still has a unique solution.
      if (countSolutions(p) === 1) removed++;
      else p[r][c] = save; // restore
    }

    puzzle = p.map(r => [...r]);
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (puzzle[r][c] === 0) given[r][c] = false;
  }

  // ---- Rendering ----
  function startTimer() {
    clearInterval(timerId);
    startTime = Date.now();
    timerId = setInterval(() => timeEl.textContent = Math.floor((Date.now() - startTime) / 1000), 500);
  }

  function render() {
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < 9; r++) {
      cells[r] = [];
      for (let c = 0; c < 9; c++) {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.dataset.r = r;
        input.dataset.c = c;
        input.style.width = "44px";
        input.style.height = "44px";
        input.style.fontSize = "1.3rem";
        input.style.textAlign = "center";
        input.style.padding = "0";

        // Thicker separators between the nine 3x3 boxes.
        if (c > 0 && c % 3 === 0) input.classList.add("box-right");
        if (r > 0 && r % 3 === 0) input.classList.add("box-bottom");

        if (given[r][c]) {
          input.value = puzzle[r][c];
          input.readOnly = true;
          input.classList.add("given");
        }

        input.addEventListener("input", e => onInput(r, c, e));
        input.addEventListener("keydown", e => moveSelection(r, c, e));
        boardEl.appendChild(input);
        cells[r][c] = input;
      }
    }
  }

  function onInput(r, c, e) {
    const raw = e.target.value;
    e.target.value = raw.replace(/[^1-9]/g, "");
    checkConflicts();
    if (e.target.value && selected) selected.classList.remove("selected");
    winCheck();
  }

  function checkConflicts() {
    // Highlight cells that duplicate another value in their unit.
    [...boardEl.children].forEach(i => i.classList.remove("conflict"));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = cells[r][c].value;
        if (!v) continue;
        const conflict = hasConflict(r, c, v);
        if (conflict) cells[r][c].classList.add("conflict");
      }
    }
  }

  function hasConflict(r, c, v) {
    for (let i = 0; i < 9; i++) {
      if (i !== c && cells[r][i].value === v) return true;
      if (i !== r && cells[i][c].value === v) return true;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const rr = br + i, cc = bc + j;
        if (rr !== r || cc !== c) if (cells[rr][cc].value === v) return true;
      }
    return false;
  }

  function winCheck() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!cells[r][c].value || +cells[r][c].value !== solution[r][c]) return false;
    clearInterval(timerId);
    showResult("Solved! 🎉", `Time: ${timeEl.textContent}s`);
    return true;
  }

  // ---- Selection & input handling ----
  function selectCell(r, c) {
    if (selected) selected.classList.remove("selected");
    selected = cells[r][c];
    selected.classList.add("selected");
  }

  function placeNumber(n) {
    if (!selected || given[+selected.dataset.r][+selected.dataset.c]) return;
    selected.value = n === 0 ? "" : String(n);
    checkConflicts();
    winCheck();
  }

  function moveSelection(r, c, e) {
    const key = e.key;
    let nr = r, nc = c;
    if (key === "ArrowUp") nr = r - 1;
    else if (key === "ArrowDown") nr = r + 1;
    else if (key === "ArrowLeft") nc = c - 1;
    else if (key === "ArrowRight") nc = c + 1;
    else return;
    e.preventDefault();
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) selectCell(nr, nc);
  }

  let overlay;
  function showResult(title, msg) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Another puzzle</button></div>`;
    document.body.appendChild(overlay);
    overlay.getElementById("ov-restart").addEventListener("click", newGame);
  }

  // ---- Wire up ----
  boardEl.addEventListener("click", e => {
    if (e.target.dataset.r !== undefined) selectCell(+e.target.dataset.r, +e.target.dataset.c);
  });
  document.querySelectorAll(".num-btn").forEach(b =>
    b.addEventListener("click", () => placeNumber(+b.dataset.n)));
  difficultySel.addEventListener("change", newGame);
  document.getElementById("new-game").addEventListener("click", newGame);
  document.getElementById("check").addEventListener("click", () => { checkConflicts(); if (!winCheck()) showResult("Not quite", "Keep going — you've got this!"); });

  function newGame() {
    diffLabel.textContent = DIFF_NAMES[difficultySel.value];
    generatePuzzle(difficultySel.value);
    selected = null;
    render();
    startTimer();
  }

  newGame();
})();
