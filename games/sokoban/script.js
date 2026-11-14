// Sokoban — box-pushing puzzle. Fully offline, vanilla JS.
(() => {
  // Levels verified solvable by an A* push-space search (see repo history).
  const LEVELS = [
    { name: "First Push", map: [
      "#######",
      "#     #",
      "# @$. #",
      "#     #",
      "#######",
    ] },
    { name: "Double Shift", map: [
      "########",
      "#      #",
      "# @ $ .#",
      "#      #",
      "########",
    ] },
    { name: "Walk Around", map: [
      "########",
      "#.     #",
      "#$     #",
      "#      #",
      "#  @   #",
      "########",
    ] },
    { name: "Detour", map: [
      "########",
      "#.     #",
      "#      #",
      "# $    #",
      "# # @  #",
      "#      #",
      "########",
    ] },
    { name: "Twin Boxes", map: [
      "########",
      "#  . . #",
      "#  $ $ #",
      "#   @  #",
      "#      #",
      "########",
    ] },
    { name: "Split Halls", map: [
      "#########",
      "#   #   #",
      "# . # . #",
      "# $   $ #",
      "#   @   #",
      "#       #",
      "#########",
    ] },
    { name: "Triple Threat", map: [
      "#########",
      "#   #   #",
      "# . . . #",
      "# $ $ $ #",
      "#   @   #",
      "#       #",
      "#########",
    ] },
    { name: "Inset Targets", map: [
      "#########",
      "#       #",
      "# $ $ $ #",
      "# .#.#. #",
      "#       #",
      "#   @   #",
      "#########",
    ] },
    { name: "Four Corners", map: [
      "##########",
      "#        #",
      "# $ $ $ $#",
      "# . . . .#",
      "#   @    #",
      "#        #",
      "##########",
    ] },
    { name: "Twin Vaults", map: [
      "############",
      "#          #",
      "# .      . #",
      "# $  ##  $ #",
      "#    ##    #",
      "# $  @  $  #",
      "# .  #   . #",
      "############",
    ] },
    { name: "Master's Hall", map: [
      "############",
      "#  . . .   #",
      "#  $ $ $   #",
      "# #  @  #  #",
      "#  $ $ $   #",
      "#  . . .   #",
      "############",
    ] },
    { name: "Cross Push", map: [
      "###########",
      "#    .    #",
      "#    $    #",
      "# . $ $ . #",
      "# #  @  # #",
      "# . $ $ . #",
      "#    $    #",
      "#    .    #",
      "###########",
    ] },
  ];

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const levelEl = document.getElementById("level");
  const solvedEl = document.getElementById("solved");
  const levelLabelEl = document.getElementById("level-label");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const TOTAL = LEVELS.length;
  const HISTORY_CAP = 500;

  const idx = (r, c) => r * cols + c;

  let levelIndex, grid, targets, boxes, player, rows, cols, moves, history, gameOver;
  let solvedMask = store.get("sokoban-done");

  function popcount(n) {
    n = n | 0;
    let c = 0;
    while (n) { n &= n - 1; c++; }
    return c;
  }

  function firstUnsolved() {
    for (let i = 0; i < TOTAL; i++) if (!((solvedMask >> i) & 1)) return i;
    return 0;
  }

  function loadLevel(i) {
    levelIndex = ((i % TOTAL) + TOTAL) % TOTAL;
    const map = LEVELS[levelIndex].map;
    rows = map.length;
    cols = map[0].length;
    grid = [];
    targets = new Set();
    boxes = new Set();
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c];
        row.push(ch === "#" ? 1 : 0);
        if (ch === "." || ch === "*" || ch === "+") targets.add(idx(r, c));
        if (ch === "$" || ch === "*") boxes.add(idx(r, c));
        if (ch === "@" || ch === "+") player = { r, c };
      }
      grid.push(row);
    }
    moves = 0;
    history = [];
    gameOver = false;
    if (overlay) overlay.remove();
    levelLabelEl.textContent = `Level ${levelIndex + 1}: ${LEVELS[levelIndex].name}`;
    render();
    updateStatus();
  }

  function updateStatus() {
    movesEl.textContent = moves;
    levelEl.textContent = `${levelIndex + 1}/${TOTAL}`;
    solvedEl.textContent = `${popcount(solvedMask)}/${TOTAL}`;
  }

  function cellSize() {
    if (cols >= 11) return 40;
    if (cols >= 9) return 46;
    return 54;
  }

  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    boardEl.innerHTML = "";
    const size = cellSize();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(r, c);
        const wall = grid[r][c] === 1;
        const target = targets.has(i);
        const box = boxes.has(i);
        let cls = "sk-cell";
        if (wall) cls += " sk-wall";
        else {
          cls += " sk-floor";
          if (target && !box) cls += " sk-target"; // crate covers the dot; solved crates glow instead
        }
        const div = document.createElement("div");
        div.className = cls;
        div.style.width = size + "px";
        div.style.height = size + "px";
        if (box) {
          const b = document.createElement("div");
          b.className = "sk-box" + (target ? " sk-box--done" : "");
          b.style.width = "88%";
          b.style.height = "88%";
          div.appendChild(b);
        }
        if (player.r === r && player.c === c) {
          const p = document.createElement("div");
          p.className = "sk-player";
          p.style.width = "72%";
          p.style.height = "72%";
          div.appendChild(p);
        }
        boardEl.appendChild(div);
      }
    }
  }

  function pushHistory() {
    history.push({ player: { ...player }, boxes: [...boxes], moves });
    if (history.length > HISTORY_CAP) history.shift();
  }

  function tryMove(dr, dc) {
    if (gameOver) return;
    const nr = player.r + dr, nc = player.c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    if (grid[nr][nc] === 1) return;
    const nIdx = idx(nr, nc);
    if (boxes.has(nIdx)) {
      const br = nr + dr, bc = nc + dc;
      if (br < 0 || bc < 0 || br >= rows || bc >= cols) return;
      if (grid[br][bc] === 1) return;
      const bIdx = idx(br, bc);
      if (boxes.has(bIdx)) return; // can't push two boxes
      pushHistory();
      boxes.delete(nIdx);
      boxes.add(bIdx);
      player = { r: nr, c: nc };
      moves++;
      render();
      updateStatus();
      checkSolved();
    } else {
      pushHistory();
      player = { r: nr, c: nc };
      moves++;
      render();
      updateStatus();
    }
  }

  function undo() {
    if (!history.length) return;
    const snap = history.pop();
    player = { ...snap.player };
    boxes = new Set(snap.boxes);
    moves = snap.moves;
    gameOver = false;
    if (overlay) overlay.remove();
    render();
    updateStatus();
  }

  function checkSolved() {
    for (const b of boxes) if (!targets.has(b)) return;
    gameOver = true;
    solvedMask |= (1 << levelIndex);
    store.set("sokoban-done", solvedMask);
    updateStatus();
    if (popcount(solvedMask) === TOTAL) {
      showOverlay("You are a Sokoban master! 🏆",
        "All 12 warehouses cleared. Legendary box-pushing!", "Replay from Level 1", () => loadLevel(0));
    } else {
      const last = levelIndex === TOTAL - 1;
      showOverlay("Level complete!",
        `Solved in ${moves} moves.`, last ? "Back to Level 1" : "Next Level", () => loadLevel(levelIndex + 1));
    }
  }

  let overlay;
  function showOverlay(title, msg, btnLabel, onNext) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">${btnLabel}</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", onNext);
  }

  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  };

  document.addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (dir) { e.preventDefault(); tryMove(DIRS[dir][0], DIRS[dir][1]); return; }
    if (e.key === "u" || e.key === "U") undo();
  });

  document.querySelectorAll(".dpad button[data-dir]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [dr, dc] = DIRS[btn.dataset.dir];
      tryMove(dr, dc);
    });
  });

  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("reset-level").addEventListener("click", () => loadLevel(levelIndex));
  document.getElementById("level-prev").addEventListener("click", () => loadLevel(levelIndex - 1));
  document.getElementById("level-next").addEventListener("click", () => loadLevel(levelIndex + 1));

  loadLevel(firstUnsolved());
})();
