// Sea Battle — pure vanilla JS, offline, hunt/target AI.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    audio,
    overlay,
    confetti,
    badges: badgesApi,
    modal: modalApi,
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const yourBoardEl = dom.byId("your-board");
  const enemyBoardEl = dom.byId("enemy-board");
  const randomizeBtn = dom.byId("randomize");
  const startBtn = dom.byId("start-battle");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const yourShipsEl = dom.byId("your-ships");
  const enemyShipsEl = dom.byId("enemy-ships");
  const turnLabel = dom.byId("turn-label");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  const K = makeKeys("battleship");

  // ---------- Board constants ----------
  const SIZE = 10;
  const SHIP_DEFS = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 },
  ];

  const AI_DELAY = 550;

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    shots: 0,
    hits: 0,
    sunk: 0,
    bestShots: 0,
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // The pre-core build only kept a win count.
  function migrateLegacy() {
    const raw = store.get("battleship-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("battleship-wins");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  // "Lower is better" shot badges: bestShots is the fewest shots in a win.
  function precisionBadge(id, icon, name, desc, limit) {
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestShots",
      goal: limit,
      satisfied: () => (stats.bestShots || 0) > 0 && stats.bestShots <= limit,
      progress: () => {
        const best = stats.bestShots || 0;
        if (!best) return { pct: 0, text: "No win yet" };
        if (best <= limit) return { pct: 100, text: "Unlocked" };
        return {
          pct: Math.min(100, (limit / best) * 100),
          text: `Best ${best} shots`,
        };
      },
    };
  }

  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Victory", desc: "Win your first battle.", stat: "wins", goal: 1 },
    { id: "win5", icon: "⚓", name: "Task Force", desc: "Win 5 battles.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏅", name: "Fleet Commander", desc: "Win 10 battles.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Admiral", desc: "Win 25 battles.", stat: "wins", goal: 25 },
    { id: "games10", icon: "🎮", name: "Ten Battles", desc: "Fight 10 battles.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗺️", name: "Veteran", desc: "Fight 25 battles.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "On a Roll", desc: "Win 2 battles in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🚀", name: "Hot Streak", desc: "Win 3 battles in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🌟", name: "Unstoppable", desc: "Win 5 battles in a row.", stat: "bestStreak", goal: 5 },
    { id: "hits50", icon: "🎯", name: "Marksman", desc: "Land 50 hits on enemy ships.", stat: "hits", goal: 50 },
    { id: "hits150", icon: "🔭", name: "Deadeye", desc: "Land 150 hits on enemy ships.", stat: "hits", goal: 150 },
    { id: "sunk25", icon: "💥", name: "Shipbreaker", desc: "Sink 25 enemy ships.", stat: "sunk", goal: 25 },
    precisionBadge("precise30", "🎖️", "Sharpshooter", "Win a battle in 30 shots or fewer.", 30),
    precisionBadge("precise22", "🗡️", "Surgical Strike", "Win a battle in 22 shots or fewer.", 22),
  ];

  // ---------- Badges UI ----------
  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => (Number.isFinite(stats[key]) ? stats[key] : 0),
    onUnlock: () => {
      updateBadgeCount();
      saveStats();
    },
    onRender: () => {
      if (!achvModal.hidden) renderAchvGrid();
    },
  });

  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  function checkAchievements() {
    achv.check();
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Battles", stats.games],
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Streak", stats.streak],
        ["Best streak", stats.bestStreak],
        ["Best win", stats.bestShots ? `${stats.bestShots} shots` : "—"],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (phase !== "over" && !paused) setPaused(true);
    },
    onClose: () => {
      if (badgesBtn.focus) badgesBtn.focus();
    },
  });

  function openAchv() {
    achvModalCtl.open();
  }

  function closeAchv() {
    achvModalCtl.close();
  }

  // ---------- Audio ----------
  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });
  audio.define("fire", [[240, 0, 0.06, "square", 0.035]]);
  audio.define("hit", [[520, 0, 0.05, "square", 0.05], [300, 0.05, 0.12, "sawtooth", 0.05]]);
  audio.define("sink", [
    [320, 0, 0.1, "sawtooth", 0.05],
    [220, 0.09, 0.16, "sawtooth", 0.05],
    [130, 0.24, 0.28, "sine", 0.05],
  ]);
  audio.define("splash", [[190, 0, 0.09, "sine", 0.02]]);

  // ---------- State ----------
  let playerFleet = [];
  let aiFleet = [];
  let playerShots = new Set();
  let aiShots = new Set();
  let aiTargets = [];
  let pendingHits = [];
  let phase = "setup"; // setup | battle | over
  let busy = false;
  let paused = false;
  let shotsThisGame = 0;
  let cpuEnabled = true;
  let aiPending = false;
  let aiTimer = 0;
  // The most recent shot, so only that cell plays the impact animation.
  let lastShotBoard = null;
  let lastShotKey = null;
  let lastShotKind = null;

  const yourCells = [];
  const enemyCells = [];

  const key = (r, c) => r + "," + c;
  const parseKey = (k) => k.split(",").map(Number);
  const cellIndex = (r, c) => r * SIZE + c;

  function neighborsOf(k) {
    const [r, c] = parseKey(k);
    const out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(key(nr, nc));
    }
    return out;
  }

  // Every legal placement for a ship of `size`.
  function allPlacements(size) {
    const out = [];
    for (const horiz of [true, false]) {
      const maxR = horiz ? SIZE : SIZE - size + 1;
      const maxC = horiz ? SIZE - size + 1 : SIZE;
      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) {
          const cells = [];
          for (let i = 0; i < size; i++) {
            cells.push(key(r + (horiz ? 0 : i), c + (horiz ? i : 0)));
          }
          out.push(cells);
        }
      }
    }
    return out;
  }

  // Shuffle every placement, then take the first legal one. Unlike a
  // retry-until-free loop this always terminates, even with a constant RNG
  // (which the test harnesses use).
  function randomFleet(rand) {
    const rng = typeof rand === "function" ? rand : Math.random;
    const used = new Set();
    const fleet = [];
    for (const def of SHIP_DEFS) {
      const options = allPlacements(def.size);
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = options[i];
        options[i] = options[j];
        options[j] = tmp;
      }
      let chosen = null;
      for (const cells of options) {
        if (cells.some((cell) => used.has(cell))) continue;
        chosen = cells;
        break;
      }
      if (!chosen) {
        // Practically unreachable, but scan in a fixed order as a fallback.
        for (const cells of allPlacements(def.size)) {
          if (cells.some((cell) => used.has(cell))) continue;
          chosen = cells;
          break;
        }
      }
      if (!chosen) continue;
      chosen.forEach((cell) => used.add(cell));
      fleet.push({ name: def.name, size: def.size, cells: chosen.slice(), sunk: false });
    }
    return fleet;
  }

  function cloneFleet(fleet) {
    return fleet.map((ship) => ({
      name: ship.name,
      size: ship.size,
      cells: ship.cells.slice(),
      sunk: ship.sunk,
    }));
  }

  function normalizeFleet(specs) {
    return specs.map((spec, i) => {
      const cells = (spec.cells || []).map((cell) =>
        Array.isArray(cell) ? key(cell[0], cell[1]) : String(cell)
      );
      const def = SHIP_DEFS[i] || { name: `Ship ${i + 1}`, size: cells.length };
      return {
        name: spec.name || def.name,
        size: cells.length || spec.size || def.size,
        cells,
        sunk: false,
      };
    });
  }

  // ---------- Board rendering ----------
  function buildGrids() {
    yourBoardEl.innerHTML = "";
    enemyBoardEl.innerHTML = "";
    yourCells.length = 0;
    enemyCells.length = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const yb = document.createElement("button");
        yb.className = "bcell";
        yb.type = "button";
        yb.disabled = true;
        yourBoardEl.appendChild(yb);
        yourCells.push(yb);

        const eb = document.createElement("button");
        eb.className = "bcell";
        eb.type = "button";
        eb.addEventListener("click", () => playerFire(r, c));
        enemyBoardEl.appendChild(eb);
        enemyCells.push(eb);
      }
    }
  }

  function render() {
    const yourShipCells = new Set(playerFleet.flatMap((s) => s.cells));
    const yourSunkCells = new Set(
      playerFleet.filter((s) => s.sunk).flatMap((s) => s.cells)
    );
    const enemySunkCells = new Set(
      aiFleet.filter((s) => s.sunk).flatMap((s) => s.cells)
    );
    for (let i = 0; i < SIZE * SIZE; i++) {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      const k = key(r, c);

      const yb = yourCells[i];
      yb.className = "bcell";
      yb.textContent = "";
      let yourState = "empty";
      if (aiShots.has(k)) {
        const hit = yourShipCells.has(k);
        yb.classList.add(hit ? "hit" : "miss");
        if (hit && yourSunkCells.has(k)) yb.classList.add("sunk");
        yb.textContent = hit ? "🔥" : "·";
        yourState = hit ? "hit" : "miss";
        if (yourBoardEl === lastShotBoard && k === lastShotKey) {
          yb.classList.add(lastShotKind === "miss" ? "just-miss" : "just-hit");
        }
      } else if (yourShipCells.has(k)) {
        yb.classList.add("ship");
        yourState = "ship";
      }
      yb.setAttribute("aria-label", `Your waters, row ${r + 1}, column ${c + 1}, ${yourState}`);

      const eb = enemyCells[i];
      eb.className = "bcell";
      eb.textContent = "";
      let enemyState = "unknown";
      if (playerShots.has(k)) {
        const hit = aiFleet.some((s) => s.cells.includes(k));
        eb.classList.add(hit ? "hit" : "miss");
        if (hit && enemySunkCells.has(k)) eb.classList.add("sunk");
        eb.textContent = hit ? "🔥" : "·";
        eb.disabled = true;
        enemyState = hit ? "hit" : "miss";
        if (enemyBoardEl === lastShotBoard && k === lastShotKey) {
          eb.classList.add(lastShotKind === "miss" ? "just-miss" : "just-hit");
        }
      } else {
        eb.disabled = phase !== "battle" || busy || paused;
      }
      eb.setAttribute("aria-label", `Enemy waters, row ${r + 1}, column ${c + 1}, ${enemyState}`);
    }
    turnLabel.classList.toggle("turn-label--live", phase === "battle" && !busy && !paused);
    yourShipsEl.textContent = playerFleet.filter((s) => !s.sunk).length;
    enemyShipsEl.textContent = aiFleet.filter((s) => !s.sunk).length;
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    startBtn.disabled = phase !== "setup" || paused;
    randomizeBtn.disabled = phase === "battle" || phase === "over" || paused;
  }

  function floatText(boardEl, r, c, text) {
    const span = document.createElement("span");
    span.className = "float-text";
    span.textContent = text;
    const cell = boardEl.children[r * SIZE + c];
    if (cell && typeof cell.offsetLeft === "number") {
      span.style.left = cell.offsetLeft + cell.offsetWidth / 2 + "px";
      span.style.top = cell.offsetTop - 4 + "px";
    } else {
      // Fallback for headless/test DOMs without layout metrics.
      span.style.left = 6 + c * 24 + 11 + "px";
      span.style.top = 6 + r * 24 + "px";
    }
    boardEl.appendChild(span);
    setTimeout(() => span.remove(), 1150);
  }

  // Returns "miss" | "hit" | "sunk".
  function fireAt(fleet, shots, boardEl, r, c) {
    const k = key(r, c);
    shots.add(k);
    const ship = fleet.find((s) => s.cells.includes(k));
    let result;
    if (!ship) {
      result = "miss";
      floatText(boardEl, r, c, "Miss!");
      sfx("splash");
    } else if (ship.cells.every((cell) => shots.has(cell))) {
      ship.sunk = true;
      result = "sunk";
      floatText(boardEl, r, c, "Sunk!");
      sfx("sink");
    } else {
      result = "hit";
      floatText(boardEl, r, c, "Hit!");
      sfx("hit");
    }
    lastShotBoard = boardEl;
    lastShotKey = k;
    lastShotKind = result;
    return result;
  }

  // ---------- Turn flow ----------
  function clearAiTimer() {
    if (aiTimer) {
      try {
        clearTimeout(aiTimer);
      } catch {
        /* ignore */
      }
      aiTimer = 0;
    }
  }

  function armAiTimer() {
    clearAiTimer();
    aiTimer = setTimeout(runAiTurn, AI_DELAY);
  }

  function playerFire(r, c) {
    if (phase !== "battle" || busy || paused) return false;
    const k = key(r, c);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (playerShots.has(k)) return false;

    const result = fireAt(aiFleet, playerShots, enemyBoardEl, r, c);
    shotsThisGame++;
    stats.shots++;
    if (result === "hit" || result === "sunk") stats.hits++;
    if (result === "sunk") stats.sunk++;
    saveStats();

    if (aiFleet.every((s) => s.sunk)) {
      endGame(true);
      return true;
    }

    if (!cpuEnabled) {
      turnLabel.textContent = "Your shot — fire away!";
      render();
      return true;
    }

    busy = true;
    aiPending = true;
    turnLabel.textContent = "CPU is aiming…";
    render();
    armAiTimer();
    return true;
  }

  function rebuildAiTargets() {
    aiTargets = [];
    for (const h of pendingHits) {
      for (const n of neighborsOf(h)) {
        if (!aiShots.has(n) && !aiTargets.includes(n)) aiTargets.push(n);
      }
    }
  }

  function aiFireAt(k) {
    if (phase !== "battle") return null;
    if (aiShots.has(k)) return null;
    const [r, c] = parseKey(k);
    const result = fireAt(playerFleet, aiShots, yourBoardEl, r, c);
    if (result === "hit") {
      pendingHits.push(k);
      for (const n of neighborsOf(k)) {
        if (!aiShots.has(n) && !aiTargets.includes(n)) aiTargets.push(n);
      }
    } else if (result === "sunk") {
      const sunkShip = playerFleet.find((s) => s.cells.includes(k));
      if (sunkShip) {
        pendingHits = pendingHits.filter((h) => !sunkShip.cells.includes(h));
        rebuildAiTargets();
      }
    }
    if (playerFleet.every((s) => s.sunk)) {
      endGame(false);
      return result;
    }
    busy = false;
    turnLabel.textContent = "Your shot — fire away!";
    render();
    return result;
  }

  function runAiTurn() {
    aiTimer = 0;
    if (phase !== "battle") return null;
    // Stay pending while paused; resuming re-arms the timer.
    if (paused) return null;
    aiPending = false;

    let target = null;
    while (aiTargets.length) {
      const t = aiTargets.pop();
      if (!aiShots.has(t)) {
        target = t;
        break;
      }
    }
    if (target === null) {
      const remaining = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const k = key(r, c);
          if (!aiShots.has(k)) remaining.push(k);
        }
      }
      if (!remaining.length) return null;
      target = remaining[Math.floor(Math.random() * remaining.length)];
    }
    return aiFireAt(target);
  }

  function startBattle() {
    if (phase !== "setup" || paused) return false;
    phase = "battle";
    busy = false;
    aiPending = false;
    clearAiTimer();
    shotsThisGame = 0;
    aiTargets = [];
    pendingHits = [];
    stats.games++;
    saveStats();
    checkAchievements();
    turnLabel.textContent = "Your shot — fire away!";
    render();
    return true;
  }

  function endGame(playerWon) {
    if (phase === "over") return false;
    phase = "over";
    busy = false;
    aiPending = false;
    clearAiTimer();

    let isRecord = false;
    if (playerWon) {
      stats.wins++;
      stats.streak++;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (!stats.bestShots || shotsThisGame < stats.bestShots) {
        stats.bestShots = shotsThisGame;
        isRecord = true;
      }
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();

    if (playerWon) {
      turnLabel.textContent = "Enemy fleet destroyed!";
      sfx("win");
      confetti(isRecord ? 90 : 60);
      showOverlay(
        "Victory! 🎉",
        `You sank the whole enemy fleet in ${shotsThisGame} shot${shotsThisGame === 1 ? "" : "s"}.` +
          (isRecord ? " New best!" : ""),
        [
          {
            label: "Play again",
            onClick: () => {
              hideOverlay();
              reset();
            },
          },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else {
      turnLabel.textContent = "Your fleet was sunk…";
      sfx("over");
      showOverlay(
        "Defeated 🤖",
        "The CPU sank your whole fleet. Rearrange and try again!",
        [
          {
            label: "Play again",
            onClick: () => {
              hideOverlay();
              reset();
            },
          },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    }
    return true;
  }

  function reset() {
    if (paused || phase === "battle") return false;
    phase = "setup";
    busy = false;
    aiPending = false;
    clearAiTimer();
    playerShots = new Set();
    aiShots = new Set();
    aiTargets = [];
    pendingHits = [];
    playerFleet = randomFleet();
    aiFleet = randomFleet();
    shotsThisGame = 0;
    lastShotBoard = null;
    lastShotKey = null;
    lastShotKind = null;
    hideOverlay();
    turnLabel.textContent = "Place your fleet!";
    render();
    return true;
  }

  // ---------- Pause ----------
  function canPause() {
    return phase !== "over";
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return false;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "The battle is on hold — press Esc or P to resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
      render();
    } else {
      hideOverlay();
      if (phase === "battle" && aiPending) armAiTimer();
      render();
    }
    return true;
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Input ----------
  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    randomizeBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset();
    });
    startBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      startBattle();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2)
      badges2.addEventListener("click", () => {
        sfx("click");
        openAchv();
      });

    window.addEventListener("blur", () => {
      if (canPause() && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && canPause() && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    buildGrids();
    bindEvents();
    reset();
    checkAchievements();
    updateBadgeCount();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__BATTLESHIP = {
    SIZE,
    SHIP_DEFS,
    ACHIEVEMENTS,
    stats,
    key,
    parseKey,
    neighborsOf,
    allPlacements,
    randomFleet,
    cloneFleet,
    get phase() {
      return phase;
    },
    get busy() {
      return busy;
    },
    get paused() {
      return paused;
    },
    get playerFleet() {
      return cloneFleet(playerFleet);
    },
    get aiFleet() {
      return cloneFleet(aiFleet);
    },
    get playerShots() {
      return Array.from(playerShots);
    },
    get aiShots() {
      return Array.from(aiShots);
    },
    get shotsThisGame() {
      return shotsThisGame;
    },
    get turnLabel() {
      return turnLabel.textContent;
    },
    setCpuEnabled(v) {
      cpuEnabled = !!v;
    },
    setFleets(playerSpecs, aiSpecs) {
      if (Array.isArray(playerSpecs) && playerSpecs.length) {
        playerFleet = normalizeFleet(playerSpecs);
      }
      if (Array.isArray(aiSpecs) && aiSpecs.length) {
        aiFleet = normalizeFleet(aiSpecs);
      }
      phase = "setup";
      busy = false;
      paused = false;
      aiPending = false;
      clearAiTimer();
      playerShots = new Set();
      aiShots = new Set();
      aiTargets = [];
      pendingHits = [];
      shotsThisGame = 0;
      lastShotBoard = null;
      lastShotKey = null;
      lastShotKind = null;
      hideOverlay();
      render();
      return { player: cloneFleet(playerFleet), ai: cloneFleet(aiFleet) };
    },
    snap: () => ({
      phase,
      busy,
      paused,
      playerFleet: cloneFleet(playerFleet),
      aiFleet: cloneFleet(aiFleet),
      playerShots: Array.from(playerShots),
      aiShots: Array.from(aiShots),
      shotsThisGame,
      turnLabel: turnLabel.textContent,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    fire: playerFire,
    cpuMove: runAiTurn,
    cpuShot: (r, c) => aiFireAt(key(r, c)),
    startBattle,
    reset,
    endGame,
    fireAt,
    setPaused,
    togglePause,
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
  };

  init();
})();
