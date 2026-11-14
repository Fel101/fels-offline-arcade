// Battleship — pure vanilla JS, offline, hunt/target AI.
(() => {
  const yourBoardEl = document.getElementById("your-board");
  const enemyBoardEl = document.getElementById("enemy-board");
  const randomizeBtn = document.getElementById("randomize");
  const startBtn = document.getElementById("start-battle");
  const winsEl = document.getElementById("wins");
  const yourShipsEl = document.getElementById("your-ships");
  const enemyShipsEl = document.getElementById("enemy-ships");
  const turnLabel = document.getElementById("turn-label");

  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const SIZE = 10;
  const SHIP_DEFS = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 },
  ];

  let wins = store.get("battleship-wins");
  let playerFleet = [], aiFleet = [];
  let playerShots = new Set(), aiShots = new Set();
  let aiTargets = [], pendingHits = [];
  let phase = "setup"; // setup | battle | over
  let busy = false;
  let overlay;
  const yourCells = [], enemyCells = [];

  const key = (r, c) => r + "," + c;
  const parseKey = k => k.split(",").map(Number);
  function neighborsOf(k) {
    const [r, c] = parseKey(k);
    const out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(key(nr, nc));
    }
    return out;
  }

  function randomFleet() {
    const used = new Set();
    const fleet = [];
    for (const def of SHIP_DEFS) {
      while (true) {
        const horiz = Math.random() < 0.5;
        const maxR = horiz ? SIZE : SIZE - def.size + 1;
        const maxC = horiz ? SIZE - def.size + 1 : SIZE;
        const r0 = Math.floor(Math.random() * maxR);
        const c0 = Math.floor(Math.random() * maxC);
        const cells = [];
        for (let i = 0; i < def.size; i++) {
          cells.push(key(r0 + (horiz ? 0 : i), c0 + (horiz ? i : 0)));
        }
        if (cells.some(c => used.has(c))) continue;
        cells.forEach(c => used.add(c));
        fleet.push({ name: def.name, size: def.size, cells, sunk: false });
        break;
      }
    }
    return fleet;
  }

  function buildGrids() {
    yourBoardEl.innerHTML = "";
    enemyBoardEl.innerHTML = "";
    yourCells.length = 0;
    enemyCells.length = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const yb = document.createElement("button");
        yb.className = "bcell";
        yb.disabled = true;
        yourBoardEl.appendChild(yb);
        yourCells.push(yb);
        const eb = document.createElement("button");
        eb.className = "bcell";
        eb.addEventListener("click", () => playerFire(r, c));
        enemyBoardEl.appendChild(eb);
        enemyCells.push(eb);
      }
    }
  }

  const cellIndex = (r, c) => r * SIZE + c;

  function render() {
    const yourShipCells = new Set(playerFleet.flatMap(s => s.cells));
    for (let i = 0; i < SIZE * SIZE; i++) {
      const yb = yourCells[i];
      const r = Math.floor(i / SIZE), c = i % SIZE;
      const k = key(r, c);
      yb.className = "bcell";
      yb.textContent = "";
      if (aiShots.has(k)) {
        const hit = yourShipCells.has(k);
        yb.classList.add(hit ? "hit" : "miss");
        yb.innerHTML = hit ? "🔥" : "·";
      } else if (yourShipCells.has(k)) {
        yb.classList.add("ship");
      }
      const eb = enemyCells[i];
      eb.className = "bcell";
      eb.textContent = "";
      if (playerShots.has(k)) {
        const hit = aiFleet.some(s => s.cells.includes(k));
        eb.classList.add(hit ? "hit" : "miss");
        eb.innerHTML = hit ? "🔥" : "·";
        eb.disabled = true;
      } else {
        eb.disabled = phase !== "battle" || busy;
      }
    }
    yourShipsEl.textContent = playerFleet.filter(s => !s.sunk).length;
    enemyShipsEl.textContent = aiFleet.filter(s => !s.sunk).length;
    winsEl.textContent = wins;
    startBtn.disabled = phase !== "setup";
    randomizeBtn.disabled = phase === "battle";
  }

  function floatText(boardEl, r, c, text) {
    const span = document.createElement("span");
    span.className = "float-text";
    span.textContent = text;
    span.style.left = (6 + c * 24 + 11) + "px";
    span.style.top = (6 + r * 24) + "px";
    boardEl.appendChild(span);
    setTimeout(() => span.remove(), 1150);
  }

  function fireAt(fleet, shots, boardEl, r, c) {
    const k = key(r, c);
    shots.add(k);
    const ship = fleet.find(s => s.cells.includes(k));
    if (!ship) {
      floatText(boardEl, r, c, "Miss!");
      return "miss";
    }
    if (ship.cells.every(cell => shots.has(cell))) {
      ship.sunk = true;
      floatText(boardEl, r, c, "Sunk!");
      return "sunk";
    }
    floatText(boardEl, r, c, "Hit!");
    return "hit";
  }

  function playerFire(r, c) {
    if (phase !== "battle" || busy) return;
    const k = key(r, c);
    if (playerShots.has(k)) return;
    fireAt(aiFleet, playerShots, enemyBoardEl, r, c);
    if (aiFleet.every(s => s.sunk)) return endGame(true);
    busy = true;
    turnLabel.textContent = "CPU is aiming…";
    render();
    setTimeout(aiFire, 650);
  }

  function rebuildAiTargets() {
    aiTargets = [];
    for (const h of pendingHits) {
      for (const n of neighborsOf(h)) {
        if (!aiShots.has(n) && !aiTargets.includes(n)) aiTargets.push(n);
      }
    }
  }

  function aiFire() {
    if (phase !== "battle") return;
    let target = null;
    while (aiTargets.length) {
      const t = aiTargets.pop();
      if (!aiShots.has(t)) { target = t; break; }
    }
    if (target === null) {
      const remaining = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const k = key(r, c);
        if (!aiShots.has(k)) remaining.push(k);
      }
      target = remaining[Math.floor(Math.random() * remaining.length)];
    }
    const [r, c] = parseKey(target);
    const result = fireAt(playerFleet, aiShots, yourBoardEl, r, c);
    if (result === "hit") {
      pendingHits.push(target);
      for (const n of neighborsOf(target)) {
        if (!aiShots.has(n) && !aiTargets.includes(n)) aiTargets.push(n);
      }
    } else if (result === "sunk") {
      const sunkShip = playerFleet.find(s => s.cells.includes(target));
      pendingHits = pendingHits.filter(h => !sunkShip.cells.includes(h));
      rebuildAiTargets();
    }
    if (playerFleet.every(s => s.sunk)) return endGame(false);
    busy = false;
    turnLabel.textContent = "Your shot — fire away!";
    render();
  }

  function startBattle() {
    if (phase !== "setup") return;
    phase = "battle";
    busy = false;
    turnLabel.textContent = "Your shot — fire away!";
    render();
  }

  function endGame(playerWon) {
    phase = "over";
    busy = false;
    if (playerWon) {
      wins++;
      store.set("battleship-wins", wins);
    }
    render();
    turnLabel.textContent = playerWon ? "Enemy fleet destroyed!" : "Your fleet was sunk…";
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    const title = playerWon ? "You win! 🎉" : "CPU wins 🤖";
    const msg = playerWon ? "You sank the whole enemy fleet!" : "The CPU sank your whole fleet.";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function reset() {
    phase = "setup";
    busy = false;
    playerShots = new Set();
    aiShots = new Set();
    aiTargets = [];
    pendingHits = [];
    playerFleet = randomFleet();
    aiFleet = randomFleet();
    if (overlay) overlay.remove();
    turnLabel.textContent = "Place your fleet!";
    render();
  }

  randomizeBtn.addEventListener("click", () => { if (phase !== "battle") reset(); });
  startBtn.addEventListener("click", startBattle);

  buildGrids();
  reset();
})();
