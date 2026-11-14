// Word Search — pure vanilla JS, fully offline. 12x12 grid, 6 themes.
(() => {
  const boardEl = document.getElementById("board");
  const listEl = document.getElementById("word-list");
  const themeSel = document.getElementById("theme");
  const diffSel = document.getElementById("difficulty");
  const foundEl = document.getElementById("found");
  const timeEl = document.getElementById("time");
  const winsEl = document.getElementById("wins");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const GRID = 12;
  const THEMES = {
    Animals: ["LION","TIGER","ELEPHANT","GIRAFFE","ZEBRA","MONKEY","PANDA","KOALA","DOLPHIN","CHEETAH","GORILLA","LEOPARD","HAMSTER","PENGUIN"],
    Space: ["COMET","ORBIT","GALAXY","SATURN","ROCKET","PLANET","NEBULA","COSMOS","MOON","STAR","VENUS","PLUTO","METEOR","ASTEROID"],
    Ocean: ["WHALE","SHARK","CORAL","REEF","TURTLE","OCTOPUS","SEAL","CRAB","JELLYFISH","SEAHORSE","PELICAN","CLAM","LOBSTER","OYSTER"],
    Food: ["PIZZA","APPLE","BANANA","CARROT","BREAD","CHEESE","COOKIE","PASTA","TACO","MELON","BERRY","GRAPE","MUFFIN","WAFFLE"],
    Sports: ["SOCCER","TENNIS","HOCKEY","BOXING","RUGBY","CRICKET","KARATE","JUDO","GOLF","BASEBALL","SWIMMING","RUNNING","VOLLEYBALL","CYCLING"],
    Dinosaurs: ["DINOSAUR","RAPTOR","FOSSIL","JURASSIC","TRICERATOPS","STEGOSAURUS","PTERODACTYL","ANKYLOSAURUS","VOLCANO","EXTINCT","FOOTPRINT","SCALES","SKULL","BONES"],
  };

  // 8 directions: horizontal, vertical, diagonals — forwards and backwards.
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
  const randomLetter = () => String.fromCharCode(65 + ((Math.random() * 26) | 0));
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let grid, cells, words, remaining, foundCount, selStart, gameOver, overlay, timerId, elapsed;
  let wins = store.get("wordsearch-wins");

  function tryPlaceWord(g, word) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const [dr, dc] = DIRS[(Math.random() * DIRS.length) | 0];
      const r = (Math.random() * GRID) | 0;
      const c = (Math.random() * GRID) | 0;
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);
      if (endR < 0 || endR >= GRID || endC < 0 || endC >= GRID) continue;
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const cell = g[r + dr * i][c + dc * i];
        // Overlapping same-letter placements are allowed.
        if (cell !== "" && cell !== word[i]) { fits = false; break; }
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) g[r + dr * i][c + dc * i] = word[i];
      return true;
    }
    return false;
  }

  function buildGrid(wordList) {
    // Place longer words first — much higher success rate.
    const ordered = [...wordList].sort((a, b) => b.length - a.length);
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = Array.from({ length: GRID }, () => Array(GRID).fill(""));
      const placed = [];
      let ok = true;
      for (const word of ordered) {
        if (tryPlaceWord(g, word)) placed.push(word);
        else { ok = false; break; }
      }
      if (!ok) continue;
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (!g[r][c]) g[r][c] = randomLetter();
        }
      }
      return { grid: g, placed };
    }
    // Practically unreachable on a 12x12 board — fall back to whatever fit.
    const g = Array.from({ length: GRID }, () => Array(GRID).fill(""));
    const placed = [];
    for (const word of ordered) if (tryPlaceWord(g, word)) placed.push(word);
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (!g[r][c]) g[r][c] = randomLetter();
    return { grid: g, placed };
  }

  function cellAt(r, c) { return cells[r][c]; }

  function renderBoard() {
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < GRID; r++) {
      const row = [];
      for (let c = 0; c < GRID; c++) {
        const btn = document.createElement("button");
        btn.className = "cell ws-cell";
        btn.textContent = grid[r][c];
        btn.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}, letter ${grid[r][c]}`);
        btn.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(btn);
        row.push(btn);
      }
      cells.push(row);
    }
  }

  function renderChips() {
    listEl.innerHTML = "";
    for (const word of [...words].sort()) {
      const chip = document.createElement("span");
      chip.className = "ws-chip";
      chip.textContent = word;
      chip.dataset.word = word;
      listEl.appendChild(chip);
    }
  }

  function strikeChip(word) {
    const chip = listEl.querySelector(`[data-word="${word}"]`);
    if (chip) chip.classList.add("ws-chip--found");
  }

  function updateStatus() {
    foundEl.textContent = `${foundCount}/${words.length}`;
    winsEl.textContent = wins;
  }

  function clearSelection() {
    if (!cells) return;
    for (const row of cells) for (const btn of row) btn.classList.remove("sel");
    selStart = null;
  }

  function flashBad(line) {
    for (const { r, c } of line) cellAt(r, c).classList.add("bad");
    setTimeout(() => {
      for (const { r, c } of line) {
        const btn = cellAt(r, c);
        if (btn) btn.classList.remove("bad");
      }
    }, 600);
  }

  function onCellClick(r, c) {
    if (gameOver) return;
    if (!selStart) {
      selStart = { r, c };
      cellAt(r, c).classList.add("sel");
      return;
    }
    const s = selStart;
    if (s.r === r && s.c === c) { clearSelection(); return; }

    const dr = r - s.r, dc = c - s.c;
    const straight = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
    if (!straight) {
      flashBad([{ r: s.r, c: s.c }, { r, c }]);
      clearSelection();
      return;
    }

    const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
    const stepR = Math.sign(dr), stepC = Math.sign(dc);
    const line = [];
    let str = "";
    for (let i = 0; i < len; i++) {
      const rr = s.r + stepR * i, cc = s.c + stepC * i;
      line.push({ r: rr, c: cc });
      if (grid[rr][cc]) str += grid[rr][cc]; // empty cells (never happens) ignored
    }
    const reversed = [...str].reverse().join("");
    const hit = remaining.find((w) => w === str || w === reversed);

    if (hit) {
      remaining = remaining.filter((w) => w !== hit);
      for (const { r: rr, c: cc } of line) {
        cellAt(rr, cc).classList.remove("sel");
        cellAt(rr, cc).classList.add("found");
      }
      foundCount++;
      strikeChip(hit);
      updateStatus();
      selStart = null;
      if (remaining.length === 0) endGame();
    } else {
      flashBad(line);
      clearSelection();
    }
  }

  function endGame() {
    gameOver = true;
    clearInterval(timerId);
    wins++;
    store.set("wordsearch-wins", wins);
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>You found them all! 🎉</h2><p>Finished the ${themeSel.value} puzzle in ${elapsed} seconds.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function newGame() {
    if (overlay) overlay.remove();
    clearInterval(timerId);
    const theme = themeSel.value;
    const count = diffSel.value === "easy" ? 5 : diffSel.value === "hard" ? 9 : 7;
    const picked = shuffle(THEMES[theme]).slice(0, count);
    const built = buildGrid(picked);
    grid = built.grid;
    words = built.placed;
    remaining = [...words];
    foundCount = 0;
    selStart = null;
    gameOver = false;
    elapsed = 0;
    renderBoard();
    renderChips();
    updateStatus();
    timeEl.textContent = "0";
    timerId = setInterval(() => {
      elapsed++;
      timeEl.textContent = String(elapsed);
    }, 1000);
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  themeSel.addEventListener("change", newGame);
  diffSel.addEventListener("change", newGame);
  winsEl.textContent = wins;
  newGame();
})();
