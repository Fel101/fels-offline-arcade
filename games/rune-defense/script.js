// Rune Defense — an advanced tower defense: eight rune towers, status effects,
// fifteen waves and a boss. Pure vanilla JS, fully offline. Shared plumbing
// (storage, audio, toasts, overlay, confetti, badges, modal, loop) comes from
// ../../js/arcade-core.js.
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
  const COLS = 16;
  const ROWS = 10;
  const CELL = 40;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const START_GOLD = 180;
  const START_LIVES = 20;
  const MAX_LEVEL = 3;
  const MAX_WAVE = 15;
  const SPAWN_GAP = 0.65;
  const CHAIN_RANGE = 2.5 * CELL;
  const HEAL_RANGE = 2.2 * CELL;
  const HEAL_RATE = 18;

  // Waypoints in grid coordinates; the path is expanded into cells.
  const WAYPOINTS = [
    [-1, 1],
    [3, 1],
    [3, 6],
    [8, 6],
    [8, 1],
    [12, 1],
    [12, 8],
    [15, 8],
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

  // ---------- Towers ----------
  const TOWER_TYPES = {
    arrow: {
      name: "Arrow", cost: 30, range: 2.4, damage: 7, rate: 0.4, pspeed: 420,
      color: "#7ec950", desc: "Fast single-target shots",
    },
    cannon: {
      name: "Cannon", cost: 70, range: 2.0, damage: 26, rate: 1.6, pspeed: 300,
      splash: 1.1, color: "#c97b3a", desc: "Heavy splash damage",
    },
    frost: {
      name: "Frost", cost: 55, range: 2.2, damage: 4, rate: 0.9, pspeed: 340,
      slow: 0.45, slowDur: 1.6, color: "#4aa8c9", desc: "Slows enemies on hit",
    },
    venom: {
      name: "Venom", cost: 65, range: 2.2, damage: 5, rate: 0.9, pspeed: 330,
      poison: 3, color: "#8bc34a", desc: "Poisons foes over time",
    },
    flame: {
      name: "Flame", cost: 85, range: 1.9, damage: 14, rate: 1.3, pspeed: 300,
      splash: 1.0, burn: 2.2, color: "#e65100", desc: "Burns and splashes",
    },
    lightning: {
      name: "Lightning", cost: 95, range: 2.4, damage: 16, rate: 1.4, pspeed: 700,
      chain: 4, color: "#c9b83a", desc: "Chains to nearby foes",
    },
    ballista: {
      name: "Ballista", cost: 130, range: 3.2, damage: 55, rate: 2.2, pspeed: 520,
      color: "#9575cd", desc: "Long-range heavy bolt",
    },
    titan: {
      name: "Titan", cost: 160, range: 2.6, damage: 40, rate: 0.8, pspeed: 480,
      color: "#4caf50", desc: "Rapid heavy repeater",
    },
  };

  // ---------- Enemies ----------
  const ENEMY_TYPES = {
    goblin: { name: "Goblin", hp: 42, speed: 1.5, reward: 7, radius: 9, color: "#8bc34a", lifeCost: 1 },
    orc: { name: "Orc", hp: 105, speed: 1.0, reward: 12, radius: 11, color: "#7cb342", lifeCost: 1 },
    bat: { name: "Bat", hp: 30, speed: 2.6, reward: 9, radius: 7, color: "#b39ddb", lifeCost: 1 },
    brute: { name: "Brute", hp: 320, speed: 0.7, reward: 28, radius: 14, color: "#c62828", lifeCost: 2 },
    healer: { name: "Healer", hp: 90, speed: 1.1, reward: 20, radius: 10, color: "#26a69a", lifeCost: 1, heals: true },
    berserker: { name: "Berserker", hp: 150, speed: 1.5, reward: 16, radius: 11, color: "#ff5722", lifeCost: 1, enrage: 0.6, enrageSpeed: 1.6 },
    wraith: { name: "Wraith", hp: 130, speed: 1.1, reward: 20, radius: 10, color: "#7e57c2", lifeCost: 1, shield: 60 },
    boss: { name: "Boss", hp: 1500, speed: 0.6, reward: 300, radius: 20, color: "#e91e63", lifeCost: 10 },
  };

  // ---------- Waves ----------
  function buildWave(n) {
    const list = [];
    const add = (type, count) => {
      for (let i = 0; i < count; i++) list.push(type);
    };
    if (n <= 3) {
      add("goblin", 6 + n * 2);
    } else if (n <= 6) {
      add("goblin", 8 + n);
      add("orc", n - 3);
    } else if (n <= 9) {
      add("goblin", 8 + n);
      add("orc", n - 3);
      if (n % 2 === 0) add("bat", 3);
      if (n >= 8) add("healer", 1);
    } else if (n <= 12) {
      add("goblin", 10 + n);
      add("orc", n - 3);
      add("brute", n - 9);
      add("berserker", n - 10);
      if (n % 2 === 0) add("bat", 4);
      add("healer", 1 + (n - 10 > 0 ? 1 : 0));
    } else if (n <= 14) {
      add("goblin", 16);
      add("orc", 8);
      add("brute", n - 11);
      add("wraith", n - 11);
      add("berserker", n - 12);
      add("bat", 4);
      add("healer", 2);
    } else {
      add("goblin", 14);
      add("orc", 8);
      add("brute", 4);
      add("wraith", 3);
      add("berserker", 2);
      add("bat", 4);
      add("healer", 2);
      list.push("boss");
    }
    return list;
  }

  const WAVES = [];
  for (let i = 1; i <= MAX_WAVE; i++) WAVES.push(buildWave(i));

  const K = makeKeys("rune-defense");

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
    bossKills: 0,
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
    { id: "first", icon: "🎮", name: "First Watch", desc: "Play your first game.", stat: "games", goal: 1 },
    { id: "games10", icon: "🕹️", name: "Regular", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "win1", icon: "🏆", name: "First Victory", desc: "Survive all 15 waves.", stat: "wins", goal: 1 },
    { id: "win5", icon: "👑", name: "Warden", desc: "Survive all 15 waves 5 times.", stat: "wins", goal: 5 },
    { id: "wave5", icon: "🌊", name: "Making Waves", desc: "Reach wave 5.", stat: "bestWave", goal: 5 },
    { id: "wave10", icon: "🌪️", name: "Eye of the Storm", desc: "Reach wave 10.", stat: "bestWave", goal: 10 },
    { id: "wave15", icon: "🌀", name: "Ragnarok", desc: "Reach the final wave.", stat: "bestWave", goal: 15 },
    { id: "kills100", icon: "💥", name: "Exterminator", desc: "Destroy 100 enemies.", stat: "kills", goal: 100 },
    { id: "kills500", icon: "☄️", name: "Annihilator", desc: "Destroy 500 enemies.", stat: "kills", goal: 500 },
    { id: "towers15", icon: "🏗️", name: "Runesmith", desc: "Build 15 towers.", stat: "towersBuilt", goal: 15 },
    { id: "gold1000", icon: "💰", name: "War Chest", desc: "Earn 1000 gold in total.", stat: "totalGold", goal: 1000 },
    { id: "flawless", icon: "🛡️", name: "Flawless", desc: "Win without losing a life.", stat: "flawlessWins", goal: 1 },
    { id: "boss1", icon: "🐉", name: "Giant Slayer", desc: "Defeat the boss.", stat: "bossKills", goal: 1 },
    { id: "rich", icon: "💎", name: "Nest Egg", desc: "Finish a game with 500 gold.", stat: "bestGold", goal: 500 },
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
        ["Bosses slain", stats.bossKills],
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
  audio.define("sell", [[500, 0, 0.05, "triangle", 0.03], [340, 0.05, 0.07, "triangle", 0.03]]);
  audio.define("boss", [[110, 0, 0.18, "sawtooth", 0.05], [90, 0.18, 0.24, "sawtooth", 0.05]]);

  // ---------- State ----------
  let towers = [];
  let enemies = [];
  let projectiles = [];
  let beams = [];
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
    t.pspeed = base.pspeed;
    t.color = base.color;
    t.splash = base.splash || 0;
    t.slow = base.slow || 0;
    t.slowDur = base.slowDur || 0;
    t.poison = base.poison || 0;
    t.burn = base.burn || 0;
    t.chain = base.chain || 0;
  }

  function upgradeCost(t) {
    return Math.round(TOWER_TYPES[t.type].cost * 0.8 * t.level);
  }

  // ---------- Flow ----------
  function newGame() {
    towers = [];
    enemies = [];
    projectiles = [];
    beams = [];
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
    if (wave >= MAX_WAVE) return;
    wave++;
    const types = WAVES[wave - 1];
    spawnQueue = types.map((t, i) => ({ type: t, at: i * SPAWN_GAP }));
    waveTime = 0;
    gameState = "wave";
    if (types.indexOf("boss") >= 0) sfx("boss");
    else sfx("long");
    toast.show("Wave " + wave, types.length + " enemies incoming", "🌊");
    updateStatus();
    updateActions();
  }

  function spawnEnemy(type) {
    const base = ENEMY_TYPES[type];
    const hp = Math.round(base.hp * (1 + (wave - 1) * 0.13));
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
      poisonUntil: 0,
      poisonDps: 0,
      burnUntil: 0,
      burnDps: 0,
      shield: base.shield || 0,
      dead: false,
    });
  }

  function moveEnemy(e, dt) {
    const def = ENEMY_TYPES[e.type];
    let mult = e.slowUntil > time ? e.slowFactor : 1;
    if (def.enrage && e.hp / e.maxHp < def.enrage) mult *= def.enrageSpeed;
    let remaining = e.speed * CELL * dt * mult;
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
    const cost = ENEMY_TYPES[e.type].lifeCost || 1;
    lives -= cost;
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
      poison: t.poison,
      burn: t.burn,
      chain: t.chain,
      color: t.color,
      dead: false,
    });
  }

  function addBeam(x1, y1, x2, y2, color) {
    beams.push({ x1, y1, x2, y2, color, life: 0.18, maxLife: 0.18 });
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
    const primary = p.target;
    if (p.splash > 0) {
      const rad = p.splash * CELL;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= rad * rad) damageEnemy(e, p.damage, p);
      }
    } else if (primary && !primary.dead) {
      damageEnemy(primary, p.damage, p);
    }

    if (p.chain > 0) {
      let chained = 0;
      let lastX = primary && !primary.dead ? primary.x : p.x;
      let lastY = primary && !primary.dead ? primary.y : p.y;
      const used = new Set();
      if (primary) used.add(primary);
      while (chained < p.chain) {
        let best = null;
        let bestD = Infinity;
        for (const e of enemies) {
          if (e.dead || used.has(e)) continue;
          const dx = e.x - lastX;
          const dy = e.y - lastY;
          const d = dx * dx + dy * dy;
          if (d <= CHAIN_RANGE * CHAIN_RANGE && d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (!best) break;
        used.add(best);
        addBeam(lastX, lastY, best.x, best.y, p.color);
        damageEnemy(best, p.damage * 0.6, p);
        lastX = best.x;
        lastY = best.y;
        chained++;
      }
    }
  }

  function damageEnemy(e, amount, p) {
    if (e.dead) return;
    let dmg = amount;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
    }
    e.hp -= dmg;
    if (p) {
      if (p.slow > 0) {
        const until = time + p.slowDur;
        if (until > e.slowUntil) e.slowUntil = until;
        e.slowFactor = e.slowUntil > time ? Math.min(e.slowFactor, p.slow) : p.slow;
      }
      if (p.poison > 0) {
        e.poisonUntil = Math.max(e.poisonUntil, time + 4);
        e.poisonDps = Math.max(e.poisonDps, p.poison);
      }
      if (p.burn > 0) {
        e.burnUntil = Math.max(e.burnUntil, time + 3.5);
        e.burnDps = Math.max(e.burnDps, p.burn);
      }
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    gold += e.reward;
    stats.kills++;
    stats.totalGold += e.reward;
    if (e.type === "boss") stats.bossKills++;
    if (e.type === "boss") sfx("boss");
    saveStats();
    checkAchievements();
    updateStatus();
  }

  function applyHealing(dt) {
    for (const h of enemies) {
      if (h.dead || h.type !== "healer") continue;
      for (const e of enemies) {
        if (e.dead || e === h) continue;
        if (e.hp >= e.maxHp) continue;
        const dx = e.x - h.x;
        const dy = e.y - h.y;
        if (dx * dx + dy * dy <= HEAL_RANGE * HEAL_RANGE) {
          e.hp = Math.min(e.maxHp, e.hp + HEAL_RATE * dt);
        }
      }
    }
  }

  function completeWave() {
    if (wave >= MAX_WAVE) {
      endGame(true);
      return;
    }
    gameState = "build";
    const bonus = 30 + wave * 8;
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
      confetti(140);
    } else {
      sfx("over");
    }

    showOverlay(
      won ? "Rune gate held! 🎉" : "The rune gate has fallen",
      `${won ? "All " + MAX_WAVE + " waves survived" : "Reached wave " + wave} · ${stats.kills} lifetime kills · ${gold} gold left.`,
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
      toast.show("Max level", "This rune tower is fully upgraded.", "⬆️");
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
    sfx("sell");
    toast.show("Tower sold", "+" + refund + " gold", "💥");
    updateStatus();
    updateActions();
    draw();
  }

  // ---------- UI ----------
  function updateStatus() {
    goldEl.textContent = gold;
    livesEl.textContent = lives;
    waveEl.textContent = wave + "/" + MAX_WAVE;
    speedEl.textContent = speed + "×";
  }

  function updatePalette() {
    const buttons = paletteEl.querySelectorAll(".rd-tower");
    buttons.forEach((b) => {
      const key = b.getAttribute("data-type");
      b.classList.toggle("rd-tower--active", key === buildType);
      const base = TOWER_TYPES[key];
      b.classList.toggle("rd-tower--poor", !!base && gold < base.cost);
    });
  }

  function updateActions() {
    const t = selected();
    upgradeBtn.disabled = !t || t.level >= MAX_LEVEL || gameState === "over" || gameState === "win";
    sellBtn.disabled = !t || gameState === "over" || gameState === "win";
    startWaveBtn.disabled = gameState !== "build" || paused || wave >= MAX_WAVE;
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
      b.className = "rd-tower" + (key === buildType ? " rd-tower--active" : "");
      b.setAttribute("data-type", key);
      const name = document.createElement("span");
      name.className = "rd-tower__name";
      const swatch = document.createElement("span");
      swatch.className = "rd-swatch";
      swatch.style.background = base.color;
      name.appendChild(swatch);
      name.appendChild(document.createTextNode(base.name));
      const cost = document.createElement("span");
      cost.className = "rd-tower__cost";
      cost.textContent = base.cost + "g · " + base.desc;
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
  function draw() {
    ctx.fillStyle = "#0a1410";
    ctx.fillRect(0, 0, W, H);

    // Buildable grass tiles.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isBuildable(c, r)) continue;
        ctx.fillStyle = (r + c) % 2 === 0 ? "#0f2419" : "#0d2016";
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    // Path tiles.
    for (const p of PATH) {
      if (!inBounds(p.c, p.r)) continue;
      ctx.fillStyle = "#3b3350";
      ctx.fillRect(p.c * CELL + 2, p.r * CELL + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(p.c * CELL + 2, p.r * CELL + 2, CELL - 4, 4);
    }

    // Rune gate (base).
    const b = cellCenter(BASE.c, BASE.r);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = "#5ad1b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(90,209,184,0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,209,184,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 6);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Placement preview.
    if (hover && buildType && isBuildable(hover.c, hover.r) && !towerAt(hover.c, hover.r)) {
      const base = TOWER_TYPES[buildType];
      const c = cellCenter(hover.c, hover.r);
      ctx.fillStyle = "rgba(90,209,184,0.12)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, base.range * CELL, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,209,184,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = gold >= base.cost ? "rgba(90,209,184,0.32)" : "rgba(255,91,91,0.32)";
      ctx.fillRect(hover.c * CELL + 2, hover.r * CELL + 2, CELL - 4, CELL - 4);
    }

    // Selected tower range.
    const sel = selected();
    if (sel) {
      const c = cellCenter(sel.c, sel.r);
      ctx.strokeStyle = "rgba(90,209,184,0.6)";
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
      ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Rune notch so types read apart by shape too.
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (t.level > 1) {
        ctx.fillStyle = "#fff";
        for (let i = 0; i < t.level - 1; i++) {
          ctx.beginPath();
          ctx.arc(c.x - 5 + i * 5, c.y - 17, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (sel === t) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
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

      // Status rings.
      if (e.shield > 0) {
        ctx.strokeStyle = "rgba(200,180,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.slowUntil > time) {
        ctx.strokeStyle = "rgba(120,220,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.poisonUntil > time) {
        ctx.fillStyle = "rgba(139,195,74,0.5)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.burnUntil > time) {
        ctx.fillStyle = "rgba(255,120,40,0.55)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ENEMY_TYPES[e.type].enrage && e.hp / e.maxHp < ENEMY_TYPES[e.type].enrage) {
        ctx.strokeStyle = "rgba(255,80,60,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      const w = e.radius * 2;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w, 4);
      ctx.fillStyle = ratio > 0.5 ? "#5ad1b8" : ratio > 0.25 ? "#ffd94d" : "#ff5b5b";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w * ratio, 4);
    }

    // Beams (chain lightning).
    for (const b2 of beams) {
      const a = Math.max(0, b2.life / b2.maxLife);
      ctx.strokeStyle = b2.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b2.x1, b2.y1);
      ctx.lineTo(b2.x2, b2.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
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

    for (const e of enemies) {
      if (e.dead) continue;
      if (e.poisonUntil > time) {
        e.hp -= e.poisonDps * dt;
        if (e.hp <= 0) { killEnemy(e); continue; }
      }
      if (e.burnUntil > time) {
        e.hp -= e.burnDps * dt;
        if (e.hp <= 0) { killEnemy(e); continue; }
      }
      moveEnemy(e, dt);
    }
    if (lives <= 0) {
      endGame(false);
      return;
    }

    applyHealing(dt);

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

    for (const b of beams) b.life -= dt;
    beams = beams.filter((b) => b.life > 0);

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
      "Rune Defense",
      "Build rune towers on the grass, then start each wave. Frost slows, venom poisons, flame burns, lightning chains. Survive 15 waves and the boss!",
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // Test hook — harmless in normal play.
  window.__RUNE_DEFENSE = {
    COLS,
    ROWS,
    CELL,
    W,
    H,
    START_GOLD,
    START_LIVES,
    MAX_LEVEL,
    MAX_WAVE,
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
        splash: t.splash, slow: t.slow, poison: t.poison, burn: t.burn, chain: t.chain,
      }));
    },
    get enemies() {
      return enemies.map((e) => ({
        type: e.type, x: e.x, y: e.y, seg: e.seg, hp: e.hp, maxHp: e.maxHp,
        shield: e.shield, slowUntil: e.slowUntil, slowFactor: e.slowFactor,
        poisonUntil: e.poisonUntil, poisonDps: e.poisonDps,
        burnUntil: e.burnUntil, burnDps: e.burnDps, dead: e.dead,
      }));
    },
    get projectiles() { return projectiles.length; },
    get beams() { return beams.length; },
    rawEnemies: () => enemies,
    cellCenter,
    setTime: (n) => { time = n; },
    clearEnemies: () => { enemies = []; },
    get gold() { return gold; },
    get lives() { return lives; },
    get wave() { return wave; },
    get speed() { return speed; },
    get gameState() { return gameState; },
    get paused() { return paused; },
    get buildType() { return buildType; },
    get selectedTower() { return selectedTower; },
    get time() { return time; },
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
    reachBase,
    moveEnemy,
    applyHealing,
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