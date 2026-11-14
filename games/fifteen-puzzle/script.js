// 15 Puzzle — pure vanilla JS, fully offline. 4×4 sliding tiles.
(() => {
  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");
  const winsEl = document.getElementById("wins");

  const SIZE = 4, TILE_COUNT = 15;

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let tiles, moves, gameOver, overlay;
  let best = store.get("15puzzle-best"); // 0 means "no solve yet"
  let wins = store.get("15puzzle-wins");

  function blankIndex() { return tiles.indexOf(0); }

  function isSolved() {
    for (let i = 0; i < TILE_COUNT; i++) if (tiles[i] !== i + 1) return false;
    return tiles[TILE_COUNT] === 0;
  }

  // Solvability: count inversions of the tile sequence (ignoring the blank).
  // On a 4×4 grid it is solvable iff (inversions + blank row from bottom) is ODD.
  function isSolvable() {
    const seq = tiles.filter(v => v !== 0);
    let inversions = 0;
    for (let i = 0; i < seq.length; i++)
      for (let j = i + 1; j < seq.length; j++)
        if (seq[i] > seq[j]) inversions++;
    const blankRowFromBottom = SIZE - Math.floor(blankIndex() / SIZE);
    return (inversions + blankRowFromBottom) % 2 === 1;
  }

  function shuffle() {
    do {
      tiles = new Array(SIZE * SIZE);
      for (let i = 0; i < SIZE * SIZE; i++) tiles[i] = i + 1;
      tiles[SIZE * SIZE - 1] = 0;
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tmp;
      }
    } while (!isSolvable() || isSolved());
  }

  function render() {
    boardEl.innerHTML = "";
    for (let i = 0; i < tiles.length; i++) {
      const v = tiles[i];
      if (v === 0) {
        const slot = document.createElement("div");
        slot.className = "puzzle-blank";
        boardEl.appendChild(slot);
        continue;
      }
      const tile = document.createElement("button");
      tile.className = "puzzle-tile";
      tile.textContent = v;
      tile.addEventListener("click", () => trySlide(i));
      boardEl.appendChild(tile);
    }
  }

  function updateStatus() {
    movesEl.textContent = moves;
    bestEl.textContent = best > 0 ? best : "—";
    winsEl.textContent = wins;
  }

  function trySlide(i) {
    if (gameOver) return;
    const b = blankIndex();
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const br = Math.floor(b / SIZE), bc = b % SIZE;
    if (Math.abs(r - br) + Math.abs(c - bc) !== 1) return;
    tiles[b] = tiles[i];
    tiles[i] = 0;
    moves++;
    updateStatus();
    render();
    if (isSolved()) onSolved();
  }

  // Slide the tile adjacent to the blank in the given direction.
  // d = direction the TILE moves (blank moves the opposite way).
  function slideInDirection(dr, dc) {
    if (gameOver) return;
    const b = blankIndex();
    const br = Math.floor(b / SIZE), bc = b % SIZE;
    const tr = br - dr, tc = bc - dc;
    if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) return;
    trySlide(tr * SIZE + tc);
  }

  function onSolved() {
    gameOver = true;
    wins++;
    store.set("15puzzle-wins", wins);
    if (!best || moves < best) {
      best = moves;
      store.set("15puzzle-best", best);
    }
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Solved!</h2><p>Tiles in order in ${moves} moves.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function newGame() {
    shuffle();
    moves = 0;
    gameOver = false;
    if (overlay) overlay.remove();
    render();
    updateStatus();
  }

  const KEYMAP = {
    arrowup: [-1, 0], keyw: [-1, 0],
    arrowdown: [1, 0], keys: [1, 0],
    arrowleft: [0, -1], keya: [0, -1],
    arrowright: [0, 1], keyd: [0, 1],
  };

  document.addEventListener("keydown", e => {
    const dir = KEYMAP[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    slideInDirection(dir[0], dir[1]);
  });

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
