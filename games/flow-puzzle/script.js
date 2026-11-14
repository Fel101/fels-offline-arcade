// Flow — pure vanilla JS, fully offline. Pipe-connection puzzles.
//
// Each level is a FULL SOLUTION GRID of color ids (5 rows × 5 chars,
// every cell colored, '.' would mean "must be filled by pipes" and is
// unused here because all levels ship complete solutions). Endpoints
// (dots) are stored separately per color, so no inference is needed.
// All 8 grids were machine-validated: full 25-cell coverage, one
// simple orthogonal path per color, dots = path endpoints.
(() => {
  const boardEl = document.getElementById("board");
  const levelNumEl = document.getElementById("level-num");
  const winsEl = document.getElementById("wins");
  const levelSelect = document.getElementById("level-select");
  const resetBtn = document.getElementById("reset-level");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const SIZE = 5, CELL_COUNT = SIZE * SIZE;
  const idx = (r, c) => r * SIZE + c;

  const HEX = {
    A: "#ff6b6b", B: "#4dabf7", C: "#51cf66", D: "#ffd43b",
    E: "#b197fc", F: "#ffa94d", G: "#f783ac", H: "#58e0c9",
  };

  const LEVELS = [
    { rows: ["AAABB", "AAACB", "AAACB", "AABBB", "AABBB"],
      dots: { A: [[0, 0], [0, 2]], B: [[0, 3], [3, 3]], C: [[1, 3], [2, 3]] } },
    { rows: ["AAAAA", "BBBBA", "BCCCC", "BDDDC", "BDDDC"],
      dots: { A: [[0, 0], [1, 4]], B: [[1, 3], [4, 0]], C: [[2, 1], [4, 4]], D: [[3, 1], [4, 1]] } },
    { rows: ["AAAAA", "DDDDB", "CEEDB", "CEEEB", "CCCBB"],
      dots: { A: [[0, 0], [0, 4]], B: [[1, 4], [4, 3]], C: [[4, 2], [2, 0]], D: [[1, 0], [2, 3]], E: [[3, 3], [2, 2]] } },
    { rows: ["ACCEF", "ACCEF", "ABDEF", "ABDEF", "BBDDF"],
      dots: { A: [[0, 0], [3, 0]], B: [[4, 0], [2, 1]], C: [[1, 1], [1, 2]], D: [[2, 2], [4, 3]], E: [[3, 3], [0, 3]], F: [[0, 4], [4, 4]] } },
    { rows: ["AAAAA", "DDEEB", "DFFEB", "DFFEB", "CCCCB"],
      dots: { A: [[0, 0], [0, 4]], B: [[1, 4], [4, 4]], C: [[4, 3], [4, 0]], D: [[3, 0], [1, 1]], E: [[1, 2], [3, 3]], F: [[3, 2], [2, 2]] } },
    { rows: ["AAAAB", "DEEEB", "DGGEB", "DFFFB", "DCCCC"],
      dots: { A: [[0, 0], [0, 3]], B: [[0, 4], [3, 4]], C: [[4, 4], [4, 1]], D: [[4, 0], [1, 0]], E: [[1, 1], [2, 3]], F: [[3, 3], [3, 1]], G: [[2, 1], [2, 2]] } },
    { rows: ["AAAAB", "CCBBB", "CCDDD", "EEEED", "FFFGG"],
      dots: { A: [[0, 0], [0, 3]], B: [[0, 4], [1, 2]], C: [[1, 1], [2, 1]], D: [[2, 2], [3, 4]], E: [[3, 3], [3, 0]], F: [[4, 0], [4, 2]], G: [[4, 3], [4, 4]] } },
    { rows: ["ACDFG", "ACDFG", "ACDFG", "BBDEH", "BBEEH"],
      dots: { A: [[0, 0], [2, 0]], B: [[3, 0], [3, 1]], C: [[2, 1], [0, 1]], D: [[0, 2], [3, 2]], E: [[4, 2], [3, 3]], F: [[2, 3], [0, 3]], G: [[0, 4], [2, 4]], H: [[3, 4], [4, 4]] } },
  ];

  // Precompute dot index maps per level.
  const LEVEL_DATA = LEVELS.map(L => {
    const dots = {}, dotOf = {};
    for (const [col, pair] of Object.entries(L.dots)) {
      dots[col] = pair.map(([r, c]) => idx(r, c));
      for (const [r, c] of pair) dotOf[idx(r, c)] = col;
    }
    return { dots, dotOf, colors: Object.keys(L.dots) };
  });

  let levelIdx = 0;
  let pipes = {};     // color -> array of cell indices, starting at a dot
  let completed = {}; // color -> true when connected dot-to-dot
  let active = null;  // color currently being drawn, or null
  let paint = new Array(CELL_COUNT).fill(null); // cell index -> color | null
  let wins = store.get("flow-wins");
  let overlay = null;

  const current = () => LEVEL_DATA[levelIdx];

  function rebuild() {
    paint = new Array(CELL_COUNT).fill(null);
    for (const col of Object.keys(pipes)) {
      for (const i of pipes[col]) paint[i] = col;
    }
    render();
  }

  function adjacent(a, b) {
    const ar = Math.floor(a / SIZE), ac = a % SIZE;
    const br = Math.floor(b / SIZE), bc = b % SIZE;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function render() {
    const L = current();
    boardEl.innerHTML = "";
    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = document.createElement("button");
      cell.className = "flow-cell";
      const painted = paint[i];
      const dotCol = L.dotOf[i];
      const shown = painted || dotCol;
      if (shown) cell.style.setProperty("--c", HEX[shown]);
      if (painted) cell.classList.add("painted");
      if (dotCol) cell.classList.add("dot");
      if (painted && completed[painted]) cell.classList.add("locked");
      cell.setAttribute("aria-label", dotCol ? `Dot ${dotCol}` : painted ? `Pipe ${painted}` : "Empty");
      cell.addEventListener("click", () => handleCellClick(i));
      boardEl.appendChild(cell);
    }
  }

  function handleCellClick(i) {
    const L = current();
    const dotCol = L.dotOf[i];
    if (dotCol) { handleDotClick(i, dotCol); return; }

    if (active) {
      const pipe = pipes[active];
      const tip = pipe[pipe.length - 1];

      if (adjacent(i, tip)) {
        if (paint[i] === active) {
          // Clicking the cell just before the tip pops one cell; any earlier
          // cell of the pipe truncates back to it.
          pipes[active] = pipe.slice(0, pipe.indexOf(i) + 1);
        } else if (paint[i]) {
          return; // painted by another color — cannot draw through it
        } else {
          pipe.push(i);
        }
        rebuild();
        return;
      }

      if (paint[i] === active) { // non-adjacent truncate back to that cell
        pipes[active] = pipe.slice(0, pipe.indexOf(i) + 1);
        rebuild();
      }
      return;
    }

    // No active color: tapping a painted, unlocked pipe cell re-activates that
    // color with the pipe truncated to that cell (Flow Free style).
    const owner = paint[i];
    if (owner && !completed[owner]) {
      active = owner;
      pipes[owner] = pipes[owner].slice(0, pipes[owner].indexOf(i) + 1);
      rebuild();
    }
  }

  function handleDotClick(i, col) {
    const L = current();

    // Clicking an endpoint again clears that color's pipe.
    if (completed[col]) {
      delete pipes[col];
      delete completed[col];
      if (active === col) active = null;
      rebuild();
      return;
    }

    const pipe = pipes[col];
    if (active === col && pipe && pipe.length) {
      const start = pipe[0];
      const other = L.dots[col].find(d => d !== start);
      if (i === start) { // clicking the starting endpoint again clears the pipe
        delete pipes[col];
        active = null;
        rebuild();
        return;
      }
      if (i === other && adjacent(i, pipe[pipe.length - 1])) {
        pipe.push(other);
        completed[col] = true;
        active = null;
        rebuild();
        checkWin();
        return;
      }
      return; // far end-dot not reachable yet — keep drawing
    }

    // Start drawing this color from this dot, discarding any partial pipe.
    pipes[col] = [i];
    active = col;
    rebuild();
  }

  function checkWin() {
    const L = current();
    if (!L.colors.every(c => completed[c])) return;
    let painted = 0;
    for (const col of Object.keys(pipes)) painted += pipes[col].length;
    if (painted !== CELL_COUNT) return;

    wins++;
    store.set("flow-wins", wins);
    winsEl.textContent = wins;

    if (overlay) overlay.remove();
    const isLast = levelIdx === LEVELS.length - 1;
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Level Complete!</h2><p>Level ${levelIdx + 1} solved — every pipe connected.</p>
      <button class="btn" id="ov-next">${isLast ? "Replay from Level 1" : "Next Level →"}</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-next").addEventListener("click", () => {
      loadLevel((levelIdx + 1) % LEVELS.length);
    });
  }

  function loadLevel(i) {
    levelIdx = i;
    pipes = {};
    completed = {};
    active = null;
    if (overlay) overlay.remove();
    levelNumEl.textContent = i + 1;
    levelSelect.value = String(i);
    rebuild();
  }

  LEVELS.forEach((_, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Level ${i + 1} — ${i + 1} / ${LEVELS.length}`;
    levelSelect.appendChild(opt);
  });

  levelSelect.addEventListener("change", () => loadLevel(Number(levelSelect.value)));
  resetBtn.addEventListener("click", () => loadLevel(levelIdx));
  winsEl.textContent = wins;
  loadLevel(0);
})();
