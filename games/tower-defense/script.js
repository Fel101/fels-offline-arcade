// Tower Defense — build towers, stop waves, protect the base.
// Pure vanilla JS, fully offline. Shared plumbing (storage, audio, toasts,
// overlay, confetti, badges, modal, loop) comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    audio,
    toast,
    overlay,
    confetti,
    badges: badgesApi,
    modal: modalApi,
    loop: loopApi,
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const canvas = dom.byId("game");
  const ctx = canvas.getContext("2d");
  const goldEl = dom.byId("gold");
  const livesEl = dom.byId("lives");
  const waveEl = dom.byId("wave");
  const speedEl = dom.byId("speed");
  const paletteEl = dom.byId("palette");
  const startWaveBtn = dom.byId("start-wave");
  const speedBtn = dom.byId("speed-btn");
  const upgradeBtn = dom.byId("upgrade");
  const sellBtn = dom.byId("sell");
  const restartBtn = dom.byId("restart");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  // ---------- Constants ----------
  const COLS = 12;
  const ROWS = 8;
  const CELL = 48;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const START_GOLD = 130;
  const START_LIVES = 20;
  const MAX_LEVEL = 3;

  // Waypoints in grid coordinates; the path is expanded into cells.
  const WAYPOINTS = [
    [-1, 1],
    [3, 1],
    [3, 4],
    [7, 4],
    [7, 1],
    [11, 1],
    [11, 6],
  ];

  function expandPath() {
    const cells = [];
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      let c = WAYPOINTS[i][0];
      let r = WAYPOINTS[i][1];
      const c1 = WAYPOINTS[i + 1][0];
      const r1 = WAYPOINTS[i + 1][1];
      cells.push({ c, r });
      while (c !== c1 || r !== r1) {
        if (c !== c1) c += Math.sign(c1 - c);
        else r += Math.sign(r1 - r);
        cells.push({ c, r });
      }
    }
    return cells;
  }

  const PATH = expandPath();
  const PATH_SET = new Set(PATH.map((p) => p.c + "," + p.r));
  const BASE = PATH[PATH.length - 1];

  const TOWER_TYPES = {
    arrow: { name: "Arrow", cost: 20, range: 2.2, damage: 8, rate: 0.45, pspeed: 340, color: "#5ad1b8" },
    cannon: { name: "Cannon", cost: 45, range: 2.0, damage: 22, rate: 1.1, pspeed: 260, splash: 0.9, color: "#ff9f5a" },
    frost: { name: "Frost", cost: 35, range: 2.0, damage: 4, rate: 0.7, pspeed: 300, slow: 0.5, slowDur: 1.5, color: "#5ad1e6" },
  };

  const ENEMY_TYPES = {
    grunt: { hp: 30, speed: 1.6, reward: 6, radius: 11, color: "#ffd94d" },
    runner: { hp: 18, speed: 2.9, reward: 5, radius: 9, color: "#5ad1b8" },
    tank: { hp: 130, speed: 1.0, reward: 16, radius: 14, color: "#ff5b5b" },
  };

  const WAVES = [
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt"],
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt"],
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "runner", "runner", "runner", "runner"],
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt"],
    ["runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "tank", "tank"],
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "runner", "runner", "runner", "runner", "runner", "runner"],
    ["tank", "tank", "tank", "tank", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner"],
    ["grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "runner", "runner", "runner", "runner", "runner", "runner"],
    ["tank", "tank", "tank", "tank", "tank", "tank", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner"],
    ["tank", "tank", "tank", "tank", "tank", "tank", "tank", "tank", "tank", "tank", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "runner", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt", "grunt"],
  ];

  const K = makeKeys("tower-defense");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    bestWave: 0,
    kills: 0,
    towersBuilt: 0,
    totalGold: 0,
    flawlessWins: 0,
    bestGold: 0,
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

  function migrateLegacy() {
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎮", name: "First Defense", desc: "Play your first game.", stat: "games", goal: 1 },
    { id: "games10", icon: "🕹️", name: "Regular", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "win1", icon: "🏆", name: "First Victory", desc: "Survive all 10 waves.", stat: "wins", goal: 1 },
    { id: "win5", icon: "👑", name: "Commander", desc: "Survive all 10 waves 5 times.", stat: "wins", goal: 5 },
    { id: "wave5", icon: "🌊", name: "Making Waves", desc: "Reach wave 5.", stat: "bestWave", goal: 5 },
    { id: "wave10", icon: "🌪️", name: "Eye of the Storm", desc: "Reach wave 10.", stat: "bestWave", goal: 10 },
    { id: "kills50", icon: "💥", name: "Exterminator", desc: "Destroy 50 enemies.", stat: "kills", goal: 50 },
    { id: "kills200", icon: "☄️", name: "Annihilator", desc: "Destroy 200 enemies.", stat: "kills", goal: 200 },
    { id: "towers10", icon: "🏗️", name: "Architect", desc: "Build 10 towers.", stat: "towersBuilt", goal: 10 },
    { id: "towers30", icon: "🏰", name: "Fortress", desc: "Build 30 towers.", stat: "towersBuilt", goal: 30 },
    { id: "gold500", icon: "💰", name: "War Chest", desc: "Earn 500 gold in total.", stat: "totalGold", goal: 500 },
    { id: "flawless", icon: "🛡️", name: "Flawless", desc: "Win without losing a life.", stat: "flawlessWins", goal: 1 },
    { id: "rich", icon: "💎", name: "Nest Egg", desc: "Finish a game with 300 gold.", stat: "bestGold", goal: 300 },
    { id: "veteran", icon: "🎖️", name: "Veteran", desc: "Survive all 10 waves 10 times.", stat: "wins", goal: 10 },
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
        ["Games", stats.games],
        ["Wins", stats.wins],
        ["Best wave", stats.bestWave],
        ["Kills", stats.kills],
        ["Towers built", stats.towersBuilt],
        ["Gold earned", stats.totalGold],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
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
  audio.define("build", [[440, 0, 0.06, "triangle", 0.04], [620, 0.06, 0.08, "triangle", 0.04]]);
  audio.define("upgrade", [[520, 0, 0.06, "triangle", 0.04], [700, 0.06, 0.06, "triangle", 0.04], [920, 0.12, 0.1, "triangle", 0.04]]);

  // ---------- State ----------
  let towers = [];
  let enemies = [];
  let projectiles = [];
  let spawnQueue = [];
  let gold = START_GOLD;
  let lives = START_LIVES;
  let wave = 0;
  let speed = 1;
  let gameState = "build"; // build | wave | over | win
  let paused = false;
  let time = 0;
  let waveTime = 0;
  let buildType = "arrow";
  let selectedTower = null;
  let hover = null;

  // ---------- Helpers ----------
  function cellCenter(c, r) {
    return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
  }
  function inBounds(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }
  function isBuildable(c, r) {
    return inBounds(c, r) && !PATH_SET.has(c + "," + r);
  }
  function towerAt(c, r) {
    return towers.find((t) => t.c === c && t.r === r) || null;
  }
  function towerIndexAt(c, r) {
    return towers.findIndex((t) => t.c === c && t.r === r);
  }
  function selected() {
    return selectedTower !== null && towers[selectedTower] ? towers[selectedTower] : null;
  }

  function applyTowerStats(t) {
    const base = TOWER_TYPES[t.type];
    const lvl = t.level;
    t.damage = base.damage * (1 + (lvl - 1) * 0.6);
    t.range = base.range + (lvl - 1) * 0.3;
    t.rate = base.rate / (1 + (lvl - 1) * 0.15);
    t.splash = base.splash || 0;
    t.slow = base.slow || 0;
    t.slowDur = base.slowDur || 0;
    t.pspeed = base.pspeed;
    t.color = base.color;
  }

  function upgradeCost(t) {
    return Math.round(TOWER_TYPES[t.type].cost * 0.8 * t.level);
  }

  // ---------- Flow ----------
  function newGame() {
    towers = [];
    enemies = [];
    projectiles = [];
    spawnQueue = [];
    gold = START_GOLD;
    lives = START_LIVES;
    wave = 0;
    speed = 1;
    gameState = "build";
    paused = false;
    time = 0;
    waveTime = 0;
    buildType = "arrow";
    selectedTower = null;
    hover = null;
    hideOverlay();
    updateStatus();
    updatePalette();
    updateActions();
    draw();
  }

  function startWave() {
    if (paused || gameState !== "build") return;
    if (wave >= WAVES.length) return;
    wave++;
    const types = WAVES[wave - 1];
    spawnQueue = types.map((t, i) => ({ type: t, at: i * 0.75 }));
    waveTime = 0;
    gameState = "wave";
    sfx("long");
    toast.show("Wave " + wave, types.length + " enemies incoming", "🌊");
    updateStatus();
    updateActions();
  }

  function spawnEnemy(type) {
    const base = ENEMY_TYPES[type];
    const hp = Math.round(base.hp * (1 + (wave - 1) * 0.16));
    const p = cellCenter(PATH[0].c, PATH[0].r);
    enemies.push({
      type,
      x: p.x,
      y: p.y,
      seg: 0,
      hp,
      maxHp: hp,
      speed: base.speed,
      reward: base.reward,
      radius: base.radius,
      color: base.color,
      slowUntil: 0,
      slowFactor: 1,
      dead: false,
    });
  }

  function moveEnemy(e, dt) {
    let remaining = e.speed * CELL * dt * (e.slowUntil > time ? e.slowFactor : 1);
    while (remaining > 0 && e.seg < PATH.length - 1) {
      const t = cellCenter(PATH[e.seg + 1].c, PATH[e.seg + 1].r);
      const dx = t.x - e.x;
      const dy = t.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= remaining) {
        e.x = t.x;
        e.y = t.y;
        e.seg++;
        remaining -= d;
      } else {
        e.x += (dx / d) * remaining;
        e.y += (dy / d) * remaining;
        remaining = 0;
      }
    }
    if (e.seg >= PATH.length - 1 && !e.dead) reachBase(e);
  }

  function reachBase(e) {
    e.dead = true;
    lives--;
    sfx("error");
    updateStatus();
    if (lives <= 0) {
      lives = 0;
      endGame(false);
    }
  }

  function findTarget(t) {
    const c = cellCenter(t.c, t.r);
    const range = t.range * CELL;
    let best = null;
    let bestSeg = -1;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - c.x;
      const dy = e.y - c.y;
      if (dx * dx + dy * dy <= range * range && e.seg > bestSeg) {
        best = e;
        bestSeg = e.seg;
      }
    }
    return best;
  }

  function fire(t, target) {
    const c = cellCenter(t.c, t.r);
    projectiles.push({
      x: c.x,
      y: c.y,
      tx: target.x,
      ty: target.y,
      target,
      speed: t.pspeed,
      damage: t.damage,
      splash: t.splash,
      slow: t.slow,
      slowDur: t.slowDur,
      color: t.color,
      dead: false,
    });
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      if (p.dead) continue;
      if (p.target && !p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step || d < 1) {
        p.x = p.tx;
        p.y = p.ty;
        hitProjectile(p);
        p.dead = true;
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  function hitProjectile(p) {
    if (p.splash > 0) {
      const rad = p.splash * CELL;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= rad * rad) damageEnemy(e, p.damage, p);
      }
    } else if (p.target && !p.target.dead) {
      damageEnemy(p.target, p.damage, p);
    }
  }

  function damageEnemy(e, amount, p) {
    if (e.dead) return;
    e.hp -= amount;
    if (p && p.slow > 0) {
      e.slowUntil = time + p.slowDur;
      e.slowFactor = p.slow;
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    gold += e.reward;
    stats.kills++;
    stats.totalGold += e.reward;
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function completeWave() {
    if (wave >= WAVES.length) {
      endGame(true);
      return;
    }
    gameState = "build";
    const bonus = 20 + wave * 5;
    gold += bonus;
    stats.totalGold += bonus;
    sfx("match");
    toast.show("Wave " + wave + " cleared", "+" + bonus + " gold", "✅");
    saveStats();
    checkAchievements();
    updateStatus();
    updateActions();
  }

  function endGame(won) {
    if (gameState === "over" || gameState === "win") return;
    gameState = won ? "win" : "over";

    stats.games++;
    stats.bestWave = Math.max(stats.bestWave, wave);
    stats.bestGold = Math.max(stats.bestGold, gold);
    if (won) {
      stats.wins++;
      if (lives === START_LIVES) stats.flawlessWins++;
    }
    saveStats();
    checkAchievements();
    updateStatus();
    updateActions();

    if (won) {
      sfx("win");
      confetti(120);
    } else {
      sfx("over");
    }

    showOverlay(
      won ? "Base defended! 🎉" : "The base has fallen",
      `${won ? "All " + WAVES.length + " waves survived" : "Reached wave " + wave} · ${stats.kills} lifetime kills · ${gold} gold left.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Build / select ----------
  function placeTower(c, r, type) {
    if (gameState === "over" || gameState === "win" || paused) return false;
    if (!isBuildable(c, r) || towerAt(c, r)) return false;
    const base = TOWER_TYPES[type];
    if (gold < base.cost) {
      sfx("error");
      toast.show("Not enough gold", base.name + " costs " + base.cost + " gold.", "💰");
      return false;
    }
    gold -= base.cost;
    const t = { c, r, type, level: 1, cooldown: 0, spent: base.cost };
    applyTowerStats(t);
    towers.push(t);
    stats.towersBuilt++;
    sfx("build");
    saveStats();
    checkAchievements();
    updateStatus();
    updateActions();
    return true;
  }

  function upgradeSelected() {
    const t = selected();
    if (!t || gameState === "over" || gameState === "win") return;
    if (t.level >= MAX_LEVEL) {
      toast.show("Max level", "This tower is fully upgraded.", "⬆️");
      return;
    }
    const cost = upgradeCost(t);
    if (gold < cost) {
      sfx("error");
      toast.show("Not enough gold", "Upgrade costs " + cost + " gold.", "💰");
      return;
    }
    gold -= cost;
    t.spent += cost;
    t.level++;
    applyTowerStats(t);
    sfx("upgrade");
    saveStats();
    updateStatus();
    updateActions();
    draw();
  }

  function sellSelected() {
    const t = selected();
    if (!t) return;
    const refund = Math.round(t.spent * 0.6);
    gold += refund;
    towers.splice(selectedTower, 1);
    selectedTower = null;
    sfx("click");
    toast.show("Tower sold", "+" + refund + " gold", "💥");
    updateStatus();
    updateActions();
    draw();
  }

  // ---------- UI ----------
  function updateStatus() {
    goldEl.textContent = gold;
    livesEl.textContent = lives;
    waveEl.textContent = wave + "/" + WAVES.length;
    speedEl.textContent = speed + "×";
  }

  function updatePalette() {
    const buttons = paletteEl.querySelectorAll(".td-tower");
    buttons.forEach((b) => {
      b.classList.toggle("td-tower--active", b.getAttribute("data-type") === buildType);
    });
  }

  function updateActions() {
    const t = selected();
    upgradeBtn.disabled = !t || t.level >= MAX_LEVEL || gameState === "over" || gameState === "win";
    sellBtn.disabled = !t || gameState === "over" || gameState === "win";
    startWaveBtn.disabled = gameState !== "build" || paused || wave >= WAVES.length;
    if (t) {
      upgradeBtn.textContent = t.level >= MAX_LEVEL ? "⬆ Max level" : "⬆ Upgrade (" + upgradeCost(t) + ")";
    } else {
      upgradeBtn.textContent = "⬆ Upgrade";
    }
    speedBtn.textContent = speed + "× Speed";
  }

  function buildPalette() {
    paletteEl.innerHTML = "";
    for (const key of Object.keys(TOWER_TYPES)) {
      const base = TOWER_TYPES[key];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "td-tower" + (key === buildType ? " td-tower--active" : "");
      b.setAttribute("data-type", key);
      const name = document.createElement("span");
      name.className = "td-tower__name";
      const swatch = document.createElement("span");
      swatch.className = "td-swatch";
      swatch.style.background = base.color;
      name.appendChild(swatch);
      name.appendChild(document.createTextNode(base.name));
      const cost = document.createElement("span");
      cost.className = "td-tower__cost";
      cost.textContent = base.cost + " gold · " + base.damage + " dmg";
      b.appendChild(name);
      b.appendChild(cost);
      b.addEventListener("click", () => {
        audio.unlock();
        sfx("click");
        buildType = key;
        selectedTower = null;
        updatePalette();
        updateActions();
      });
      paletteEl.appendChild(b);
    }
  }

  // ---------- Rendering ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = "#0b1a12";
    ctx.fillRect(0, 0, W, H);

    // Buildable grass tiles.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isBuildable(c, r)) continue;
        ctx.fillStyle = (r + c) % 2 === 0 ? "#10261a" : "#0e2117";
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    // Path tiles.
    for (const p of PATH) {
      if (!inBounds(p.c, p.r)) continue;
      ctx.fillStyle = "#4a3a28";
      ctx.fillRect(p.c * CELL + 2, p.r * CELL + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(p.c * CELL + 2, p.r * CELL + 2, CELL - 4, 4);
    }

    // Base.
    const b = cellCenter(BASE.c, BASE.r);
    ctx.fillStyle = "#5ad1b8";
    ctx.fillRect(b.x - 16, b.y - 4, 32, 22);
    ctx.beginPath();
    ctx.moveTo(b.x - 21, b.y - 4);
    ctx.lineTo(b.x, b.y - 22);
    ctx.lineTo(b.x + 21, b.y - 4);
    ctx.closePath();
    ctx.fill();

    // Placement preview.
    if (hover && buildType && isBuildable(hover.c, hover.r) && !towerAt(hover.c, hover.r)) {
      const base = TOWER_TYPES[buildType];
      const c = cellCenter(hover.c, hover.r);
      ctx.fillStyle = "rgba(90,209,184,0.14)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, base.range * CELL, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,209,184,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = gold >= base.cost ? "rgba(90,209,184,0.35)" : "rgba(255,91,91,0.35)";
      ctx.fillRect(hover.c * CELL + 2, hover.r * CELL + 2, CELL - 4, CELL - 4);
    }

    // Selected tower range.
    const sel = selected();
    if (sel) {
      const c = cellCenter(sel.c, sel.r);
      ctx.strokeStyle = "rgba(90,209,184,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, sel.range * CELL, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Towers.
    for (const t of towers) {
      const c = cellCenter(t.c, t.r);
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (t.level > 1) {
        ctx.fillStyle = "#fff";
        for (let i = 0; i < t.level - 1; i++) {
          ctx.beginPath();
          ctx.arc(c.x - 6 + i * 6, c.y - 18, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (sel === t) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 19, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Enemies.
    for (const e of enemies) {
      if (e.dead) continue;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const w = e.radius * 2;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w, 4);
      ctx.fillStyle = ratio > 0.5 ? "#5ad1b8" : ratio > 0.25 ? "#ffd94d" : "#ff5b5b";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w * ratio, 4);
    }

    // Projectiles.
    for (const p of projectiles) {
      if (p.dead) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- Input ----------
  function eventCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) };
  }

  function onClick(e) {
    if (e.preventDefault) e.preventDefault();
    audio.unlock();
    if (gameState === "over" || gameState === "win" || paused) return;
    const { c, r } = eventCell(e);
    const existing = towerIndexAt(c, r);
    if (existing >= 0) {
      selectedTower = selectedTower === existing ? null : existing;
      sfx("select");
      updateActions();
      draw();
      return;
    }
    if (buildType) {
      if (placeTower(c, r, buildType)) {
        draw();
      }
    } else {
      selectedTower = null;
      updateActions();
      draw();
    }
  }

  function onPointerMove(e) {
    const { c, r } = eventCell(e);
    if (!hover || hover.c !== c || hover.r !== r) {
      hover = { c, r };
      if (!paused && gameState !== "over" && gameState !== "win") draw();
    }
  }

  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }
    if (overlay.isOpen() || paused || gameState === "over" || gameState === "win") return;
    if (key === " " || key === "Enter") {
      if (e.preventDefault) e.preventDefault();
      startWave();
    }
  }

  function bindEvents() {
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointermove", onPointerMove);
    document.addEventListener("keydown", onKeyDown);

    startWaveBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); startWave(); });
    speedBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      speed = speed === 1 ? 2 : 1;
      updateStatus();
      updateActions();
    });
    upgradeBtn.addEventListener("click", () => { audio.unlock(); upgradeSelected(); });
    sellBtn.addEventListener("click", () => { audio.unlock(); sellSelected(); });
    restartBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); newGame(); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    window.addEventListener("blur", () => {
      if (!paused && !overlay.isOpen() && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !paused && !overlay.isOpen() && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
    updateActions();
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- Update ----------
  function update(dtMs) {
    if (paused) return;
    if (gameState === "over" || gameState === "win") return;
    const dt = (Math.min(dtMs, 100) / 1000) * speed;
    time += dt;

    if (gameState === "wave") {
      waveTime += dt;
      while (spawnQueue.length && spawnQueue[0].at <= waveTime) {
        spawnEnemy(spawnQueue.shift().type);
      }
    }

    for (const e of enemies) if (!e.dead) moveEnemy(e, dt);
    if (lives <= 0) {
      endGame(false);
      return;
    }

    for (const t of towers) {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const target = findTarget(t);
        if (target) {
          fire(t, target);
          t.cooldown = t.rate;
        }
      }
    }

    updateProjectiles(dt);

    enemies = enemies.filter((e) => !e.dead);
    projectiles = projectiles.filter((p) => !p.dead);

    if (gameState === "wave" && spawnQueue.length === 0 && enemies.length === 0) {
      completeWave();
    }
  }

  // ---------- Loop ----------
  const gameLoop = loopApi.create((dt) => {
    update(dt);
    draw();
  });

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    buildPalette();
    bindEvents();
    newGame();
    renderAchvGrid();
    showStartOverlay();
    gameLoop.start();
  }

  function showStartOverlay() {
    showOverlay(
      "Tower Defense",
      "Build towers on the grass, then start each wave. Stop every enemy before it reaches the base!",
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // Test hook — harmless in normal play.
  window.__TOWER_DEFENSE = {
    COLS,
    ROWS,
    CELL,
    W,
    H,
    START_GOLD,
    START_LIVES,
    MAX_LEVEL,
    PATH,
    TOWER_TYPES,
    ENEMY_TYPES,
    WAVES,
    stats,
    ACHIEVEMENTS,
    get towers() {
      return towers.map((t) => ({
        c: t.c, r: t.r, type: t.type, level: t.level, spent: t.spent,
        damage: t.damage, range: t.range, cooldown: t.cooldown,
      }));
    },
    get enemies() {
      return enemies.map((e) => ({
        type: e.type, x: e.x, y: e.y, seg: e.seg, hp: e.hp, maxHp: e.maxHp, dead: e.dead,
      }));
    },
    get projectiles() { return projectiles.length; },
    get gold() { return gold; },
    get lives() { return lives; },
    get wave() { return wave; },
    get speed() { return speed; },
    get gameState() { return gameState; },
    get paused() { return paused; },
    get buildType() { return buildType; },
    get selectedTower() { return selectedTower; },
    isBuildable,
    towerAt,
    placeTower,
    upgradeSelected,
    sellSelected,
    startWave,
    spawnEnemy,
    update,
    draw,
    damageEnemy,
    killEnemy,
    endGame,
    newGame,
    setPaused,
    togglePause,
    setGold: (n) => { gold = n; updateStatus(); updateActions(); },
    setLives: (n) => { lives = n; updateStatus(); },
    setWave: (n) => { wave = n; updateStatus(); updateActions(); },
    setSpeed: (n) => { speed = n; updateStatus(); updateActions(); },
    setBuildType: (t) => { buildType = t; updatePalette(); updateActions(); },
    setSelected: (i) => { selectedTower = i; updateActions(); draw(); },
    saveStats,
    checkAchievements,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();