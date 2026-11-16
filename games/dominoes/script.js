// Dominoes — draw, block, or play All Fives against the computer.
// Pure vanilla JS, fully offline.
// Modes: Classic (draw, first to 100), All Fives (multiples of 5 score),
// Block (no drawing), Daily (one seeded match a day).
// Features: 3 AI levels, 24 badges, persistent best scores, daily streaks,
// animated chain, particles, sound, keyboard shortcuts, themes.
(() => {
  "use strict";

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const aiScoreEl = document.getElementById("ai-score");
  const bestEl = document.getElementById("best");
  const roundEl = document.getElementById("round");
  const targetEl = document.getElementById("target");
  const boneyardEl = document.getElementById("boneyard");
  const turnEl = document.getElementById("turn");
  const endsEl = document.getElementById("ends");
  const hintEl = document.getElementById("hint");
  const handEl = document.getElementById("hand");
  const oppHandEl = document.getElementById("opp-hand");
  const oppCountEl = document.getElementById("opp-count");
  const oppNameEl = document.getElementById("opp-name");
  const endChoiceEl = document.getElementById("end-choice");
  const pauseBtn = document.getElementById("pause");
  const badgesBtn = document.getElementById("badges-btn");
  const badgeCountEl = document.getElementById("badge-count");
  const soundBtn = document.getElementById("sound-btn");
  const soundIconEl = document.getElementById("sound-icon");
  const toastsEl = document.getElementById("toasts");
  const achvModal = document.getElementById("achv-modal");
  const achvGrid = document.getElementById("achv-grid");
  const achvCountEl = document.getElementById("achv-count");
  const achvRecordsEl = document.getElementById("achv-records");

  // ---------- Geometry ----------
  const CW = 760;
  const CH = 420;
  const PAD = 18;
  const TILE_L = 64;
  const TILE_T = 32;
  const GAP = 6;
  const ROW_H = TILE_L + GAP;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  canvas.width = Math.round(CW * DPR);
  canvas.height = Math.round(CH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // ---------- Rules configuration ----------
  const MODES = {
    classic: {
      name: "Classic",
      draw: true,
      allFives: false,
      target: 100,
      hint: "Draw dominoes · first to 100 · match either open end",
    },
    allfives: {
      name: "All Fives",
      draw: true,
      allFives: true,
      target: 150,
      hint: "All Fives · score when the open ends total a multiple of 5",
    },
    block: {
      name: "Block",
      draw: false,
      allFives: false,
      target: 100,
      hint: "Block dominoes · no drawing · pass if you cannot play",
    },
    daily: {
      name: "Daily",
      draw: true,
      allFives: false,
      target: 100,
      hint: "One seeded match a day · first to 100",
    },
  };

  const DIFFS = {
    chill: { name: "Chill", blurb: "relaxed" },
    cunning: { name: "Cunning", blurb: "tactical" },
    ruthless: { name: "Ruthless", blurb: "ruthless" },
  };

  // ---------- Tiles ----------
  const PIPS = {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
  };

  const ALL_TILES = (() => {
    const out = [];
    for (let a = 0; a <= 6; a++) {
      for (let b = a; b <= 6; b++) out.push({ a, b });
    }
    return out;
  })();

  function tileKey(t) {
    return t.a <= t.b ? `${t.a}-${t.b}` : `${t.b}-${t.a}`;
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first_round", icon: "🎯", name: "First Round", desc: "Win your first round.", stat: "roundsWon", goal: 1 },
    { id: "round10", icon: "🔥", name: "On a Roll", desc: "Win 10 rounds.", stat: "roundsWon", goal: 10 },
    { id: "round50", icon: "🏆", name: "Domino Legend", desc: "Win 50 rounds.", stat: "roundsWon", goal: 50 },
    { id: "first_game", icon: "🥇", name: "Match Winner", desc: "Win a full match.", stat: "gamesWon", goal: 1 },
    { id: "game5", icon: "🎖️", name: "Regular Winner", desc: "Win 5 matches.", stat: "gamesWon", goal: 5 },
    { id: "game20", icon: "👑", name: "Dynasty", desc: "Win 20 matches.", stat: "gamesWon", goal: 20 },
    { id: "score100", icon: "💯", name: "Century", desc: "Score 100 in a single match.", stat: "bestScore", goal: 100 },
    { id: "score300", icon: "🚀", name: "High Flyer", desc: "Score 300 in a single match.", stat: "bestScore", goal: 300 },
    { id: "score500", icon: "🌟", name: "Five Hundred", desc: "Score 500 in a single match.", stat: "bestScore", goal: 500 },
    { id: "domino", icon: "🏁", name: "Domino!", desc: "Win a round by playing your last tile.", stat: "dominoWins", goal: 1 },
    { id: "blocked", icon: "🧱", name: "Roadblock", desc: "Win a blocked round.", stat: "blockedWins", goal: 1 },
    { id: "double", icon: "🎯", name: "Double Down", desc: "Play a double.", stat: "doublesPlayed", goal: 1 },
    { id: "double6", icon: "6️⃣", name: "Six Shooter", desc: "Play the double-six.", stat: "doubleSix", goal: 1 },
    { id: "allfives", icon: "5️⃣", name: "High Five", desc: "Score points in All Fives.", stat: "allFivesPoints", goal: 1 },
    { id: "allfives100", icon: "💫", name: "Five Alive", desc: "Score 100 in All Fives in one match.", stat: "bestAllFives", goal: 100 },
    { id: "shutout", icon: "🧊", name: "Shutout", desc: "Win a round while your opponent holds 20+ pips.", stat: "maxShutout", goal: 20 },
    { id: "nodraw", icon: "🚫", name: "Self-Reliant", desc: "Win a round without drawing.", stat: "noDrawWins", goal: 1 },
    { id: "nopass", icon: "⏭️", name: "No Pass", desc: "Win a round without passing.", stat: "noPassWins", goal: 1 },
    { id: "comeback", icon: "🪄", name: "Comeback", desc: "Win a match after trailing by 50+.", stat: "comebacks", goal: 1 },
    { id: "daily", icon: "📅", name: "Daily Habit", desc: "Finish a Daily match.", stat: "dailyWins", goal: 1 },
    { id: "daily3", icon: "🗓️", name: "Three in a Row", desc: "Reach a 3-day daily streak.", stat: "dailyStreak", goal: 3 },
    { id: "daily7", icon: "📆", name: "Week Warrior", desc: "Reach a 7-day daily streak.", stat: "dailyStreak", goal: 7 },
    { id: "hard", icon: "🧠", name: "Ruthless", desc: "Win a match on Ruthless difficulty.", stat: "hardWins", goal: 1 },
    { id: "veteran", icon: "🎮", name: "Veteran", desc: "Play 10 matches.", stat: "gamesPlayed", goal: 10 },
  ];

  const DEFAULT_STATS = {
    roundsPlayed: 0,
    roundsWon: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    bestScore: 0,
    bestRoundScore: 0,
    maxShutout: 0,
    noDrawWins: 0,
    noPassWins: 0,
    dominoWins: 0,
    blockedWins: 0,
    doublesPlayed: 0,
    doubleSix: 0,
    allFivesPoints: 0,
    bestAllFives: 0,
    dailyWins: 0,
    hardWins: 0,
    draws: 0,
    comebacks: 0,
  };

  // ---------- Storage ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage blocked */
      }
    },
    num(key, fallback = 0) {
      const n = Number(this.get(key, fallback));
      return Number.isFinite(n) ? n : fallback;
    },
    json(key, fallback) {
      try {
        const raw = this.get(key, null);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    jsonSet(key, value) {
      this.set(key, JSON.stringify(value));
    },
  };

  const K = {
    best: (mode) => `dominoes-best-v1-${mode}`,
    stats: "dominoes-stats-v1",
    achv: "dominoes-achv-v1",
    sound: "dominoes-sound",
    mode: "dominoes-mode",
    diff: "dominoes-diff",
    daily: "dominoes-daily-v1",
  };

  const storedStats = store.json(K.stats, {});
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }

  const storedAchv = store.json(K.achv, []);
  let unlocked = new Set(Array.isArray(storedAchv) ? storedAchv : []);
  unlocked = new Set(Array.from(unlocked).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)));

  let daily = store.json(K.daily, null);
  if (!daily || typeof daily !== "object" || Array.isArray(daily)) daily = { streak: 0, lastDate: "", history: {} };
  if (!daily.history || typeof daily.history !== "object") daily.history = {};
  if (!Number.isFinite(daily.streak)) daily.streak = 0;

  // ---------- Palette ----------
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      accent: get("--accent", "#5ad1b8"),
      accent2: get("--accent-2", "#ffd94d"),
      accent3: get("--accent-3", "#ff5ea8"),
      danger: get("--danger", "#ff5b5b"),
      text: get("--text", "#f2f3f7"),
      muted: get("--muted", "#9a9aa8"),
    };
  }
  let PAL = readPalette();

  // ---------- Audio ----------
  let soundOn = store.get(K.sound, "on") !== "off";
  let actx = null;
  let audioUnlocked = false;

  function ensureAudio() {
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === "suspended") actx.resume();
    } catch {
      actx = null;
    }
  }

  function unlockAudio() {
    audioUnlocked = true;
    ensureAudio();
  }

  function sfx(name) {
    if (!soundOn || !audioUnlocked) return;
    ensureAudio();
    if (!actx) return;
    try {
      const t = actx.currentTime;
      const note = (freq, start, dur, type = "sine", vol = 0.05, endFreq = null) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t + start);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + start + dur);
        g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(vol, t + start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(g).connect(actx.destination);
        o.start(t + start);
        o.stop(t + start + dur + 0.03);
      };
      switch (name) {
        case "place":
          note(520, 0, 0.05, "triangle", 0.04, 300);
          note(170, 0.008, 0.07, "square", 0.022, 110);
          break;
        case "draw":
          note(300, 0, 0.09, "sine", 0.03, 430);
          break;
        case "pass":
          note(230, 0, 0.12, "sine", 0.028, 160);
          break;
        case "bump":
          note(160, 0, 0.08, "square", 0.025, 130);
          break;
        case "score":
          note(660, 0, 0.08, "triangle", 0.042);
          note(880, 0.07, 0.12, "triangle", 0.042);
          break;
        case "win":
          note(523, 0, 0.12, "sine", 0.05);
          note(659, 0.1, 0.12, "sine", 0.05);
          note(784, 0.2, 0.16, "sine", 0.05);
          note(1047, 0.32, 0.3, "sine", 0.045);
          break;
        case "lose":
          note(392, 0, 0.16, "triangle", 0.045);
          note(330, 0.14, 0.18, "triangle", 0.045);
          note(262, 0.3, 0.28, "triangle", 0.04);
          break;
        case "over":
          note(300, 0, 0.5, "sawtooth", 0.05, 70);
          break;
        case "achv":
          note(587, 0, 0.1, "triangle", 0.04);
          note(740, 0.09, 0.1, "triangle", 0.04);
          note(880, 0.18, 0.16, "triangle", 0.04);
          break;
        case "click":
          note(600, 0, 0.035, "sine", 0.02);
          break;
        default:
          break;
      }
    } catch {
      /* audio is a nice-to-have */
    }
  }

  function updateSoundBtn() {
    soundIconEl.textContent = soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    const label = soundOn ? "Mute sound" : "Enable sound";
    soundBtn.setAttribute("aria-label", label);
    soundBtn.title = label;
  }

  function updateBadgeCount() {
    badgeCountEl.textContent = unlocked.size;
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${unlocked.size} of ${ACHIEVEMENTS.length} unlocked`
    );
  }

  // ---------- Small helpers ----------
  function dateStr(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function roundTo5(n) {
    return Math.round(n / 5) * 5;
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ---------- State ----------
  const state = {
    mode: "classic",
    diff: "cunning",
    target: 100,
    score: { you: 0, ai: 0 },
    round: 1,
    chain: [],
    hands: { you: [], ai: [] },
    boneyard: [],
    turn: "you",
    status: "playing", // playing | roundOver | matchOver
    paused: false,
    over: false,
    selected: null,
    starter: "you",
    rng: Math.random,
    aiTimer: null,
    humanPassTimer: null,
    consecutivePasses: 0,
    humanDraws: 0,
    humanPasses: 0,
    roundMoves: 0,
    maxDeficit: 0,
    lastPlaced: null,
  };

  let best = 0;
  let particles = [];
  let floaters = [];
  let nowMs = performance.now();
  let lastTs = 0;
  let overlayEl = null;
  let resumeAfterModal = false;

  // ---------- Tile helpers ----------
  function endsOf(chain) {
    if (!chain.length) return { left: null, right: null };
    return { left: chain[0].a, right: chain[chain.length - 1].b };
  }

  function handPips(hand) {
    let sum = 0;
    for (const t of hand) sum += t.a + t.b;
    return sum;
  }

  function orientFor(tile, side, chain) {
    const ends = endsOf(chain);
    if (side === "start") return chain.length ? null : { a: tile.a, b: tile.b };
    if (!chain.length) return { a: tile.a, b: tile.b };
    if (side === "left") {
      if (tile.b === ends.left) return { a: tile.a, b: tile.b };
      if (tile.a === ends.left) return { a: tile.b, b: tile.a };
    }
    if (side === "right") {
      if (tile.a === ends.right) return { a: tile.a, b: tile.b };
      if (tile.b === ends.right) return { a: tile.b, b: tile.a };
    }
    return null;
  }

  function legalMoves(player) {
    const hand = state.hands[player];
    const moves = [];
    if (!state.chain.length) {
      for (const tile of hand) moves.push({ tile, side: "start" });
      return moves;
    }
    const ends = endsOf(state.chain);
    for (const tile of hand) {
      if (tile.a === ends.left || tile.b === ends.left) moves.push({ tile, side: "left" });
      if (tile.a === ends.right || tile.b === ends.right) moves.push({ tile, side: "right" });
    }
    return moves;
  }

  function findStarter() {
    const all = state.hands.you.concat(state.hands.ai);
    let bestDouble = null;
    for (const t of all) {
      if (t.a !== t.b) continue;
      if (!bestDouble || t.a > bestDouble.a) bestDouble = t;
    }
    if (bestDouble) return state.hands.you.includes(bestDouble) ? "you" : "ai";

    let bestTile = null;
    for (const t of all) {
      const pips = t.a + t.b;
      if (!bestTile || pips > bestTile.a + bestTile.b) bestTile = t;
    }
    return bestTile && state.hands.you.includes(bestTile) ? "you" : "ai";
  }

  function chooseAiMove(moves) {
    if (!moves.length) return null;
    if (state.diff === "chill") return moves[Math.floor(state.rng() * moves.length)];

    const hand = state.hands.ai;
    const oppSize = state.hands.you.length;
    const chainKeys = new Set(state.chain.map(tileKey));
    const unseen = ALL_TILES.filter((t) => !hand.includes(t) && !chainKeys.has(tileKey(t)));

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
      const oriented = orientFor(move.tile, move.side, state.chain);
      if (!oriented) continue;

      let afterLeft;
      let afterRight;
      if (move.side === "start" || !state.chain.length) {
        afterLeft = oriented.a;
        afterRight = oriented.b;
      } else if (move.side === "left") {
        afterLeft = oriented.a;
        afterRight = state.chain[state.chain.length - 1].b;
      } else {
        afterLeft = state.chain[0].a;
        afterRight = oriented.b;
      }

      let score = move.tile.a + move.tile.b;
      if (move.tile.a === move.tile.b) score += 4;

      let matches = 0;
      for (const t of hand) {
        if (t === move.tile) continue;
        if (t.a === afterLeft || t.b === afterLeft) matches++;
        if (t.a === afterRight || t.b === afterRight) matches++;
      }
      score += Math.min(matches, 6) * 0.9;

      if (MODES[state.mode].allFives) {
        const sum = afterLeft + afterRight;
        if (sum > 0 && sum % 5 === 0) score += (sum / 5) * 4;
      }

      if (state.diff === "ruthless") {
        let oppOuts = 0;
        for (const t of unseen) {
          if (t.a === afterLeft || t.b === afterLeft) oppOuts++;
          if (t.a === afterRight || t.b === afterRight) oppOuts++;
        }
        score -= oppOuts * 0.55;
        if (oppSize <= 3) score -= oppOuts * 1.4;
      }

      score += state.rng() * (state.diff === "ruthless" ? 1.2 : 2.2);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // ---------- Effects ----------
  function burst(px, py, color, count) {
    const n = REDUCE ? Math.min(count, 8) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 170;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floater(px, py, text, color) {
    floaters.push({ x: px, y: py, text, color, life: 1.1, max: 1.1 });
  }

  function confetti() {
    if (REDUCE) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = [PAL.accent, PAL.accent2, PAL.accent3, PAL.danger, PAL.text];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
      s.style.animationDelay = Math.random() * 0.5 + "s";
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    window.setTimeout(() => wrap.remove(), 4200);
  }

  function updateEffects(dt) {
    const dts = Math.min(dt, 50) / 1000;
    for (const p of particles) {
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 260 * dts;
      p.life -= dts;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floaters) {
      f.life -= dts;
      f.y -= 30 * dts;
    }
    floaters = floaters.filter((f) => f.life > 0);
  }

  // ---------- Toasts & achievements ----------
  function showToast(title, desc, icon) {
    const el = document.createElement("div");
    el.className = "snake-toast";
    el.innerHTML =
      `<span class="snake-toast__icon" aria-hidden="true"></span>` +
      `<div class="snake-toast__body"><strong></strong><span></span></div>`;
    el.querySelector(".snake-toast__icon").textContent = icon || "💬";
    el.querySelector("strong").textContent = title;
    el.querySelector("span").textContent = desc || "";
    toastsEl.appendChild(el);
    window.setTimeout(() => el.classList.add("is-out"), 3000);
    window.setTimeout(() => el.remove(), 3450);
  }

  function pushToast(a) {
    showToast(a.name, a.desc, a.icon);
  }

  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      let done = false;
      if (a.stat === "dailyStreak") {
        done = daily.streak >= a.goal;
      } else {
        done = (stats[a.stat] || 0) >= a.goal;
      }
      if (done) {
        unlocked.add(a.id);
        changed = true;
        pushToast(a);
      }
    }
    if (changed) {
      sfx("achv");
      store.jsonSet(K.achv, Array.from(unlocked));
      updateBadgeCount();
      if (!achvModal.hidden) renderAchvGrid();
    }
  }

  function achvCard(a, done, pct, progressText) {
    return (
      `<div class="achv ${done ? "achv--done" : "achv--locked"}">` +
      `<div class="achv__icon" aria-hidden="true">${a.icon}</div>` +
      `<div class="achv__body">` +
      `<div class="achv__name"><span>${a.name}</span>${done ? '<span class="achv__tick" aria-label="Unlocked">✔</span>' : ""}</div>` +
      `<div class="achv__desc">${a.desc}</div>` +
      `<div class="achv__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct}%"></span></div>` +
      `<div class="achv__progress">${progressText}</div>` +
      `</div></div>`
    );
  }

  function renderAchvGrid() {
    achvGrid.innerHTML = ACHIEVEMENTS.map((a) => {
      const done = unlocked.has(a.id);
      if (a.stat === "dailyStreak") {
        const pct = done ? 100 : Math.min(100, (daily.streak / a.goal) * 100);
        return achvCard(a, done, pct, done ? "Unlocked" : `${daily.streak} / ${a.goal} days`);
      }
      const raw = stats[a.stat] || 0;
      const pct = done ? 100 : Math.max(0, Math.min(100, (raw / a.goal) * 100));
      return achvCard(a, done, pct, done ? "Unlocked" : `${Math.min(Math.floor(raw), a.goal)} / ${a.goal}`);
    }).join("");

    const records = [
      ["Best match", best],
      ["Best round", stats.bestRoundScore],
      ["Rounds won", stats.roundsWon],
      ["Matches won", stats.gamesWon],
      ["Daily streak", daily.streak + "d"],
      ["Shutout", stats.maxShutout],
    ];
    achvRecordsEl.innerHTML = records
      .map(([label, val]) => `<span>${label} <b>${val}</b></span>`)
      .join("");

    achvCountEl.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length}`;
  }

  function openAchv() {
    renderAchvGrid();
    achvModal.hidden = false;
    document.body.classList.add("modal-open");
    if (state.status === "playing" && !state.paused) {
      state.paused = true;
      resumeAfterModal = true;
      clearTimers();
      pauseBtn.textContent = "▶ Resume";
    }
    const closeBtn = achvModal.querySelector(".snake-modal__head [data-close]");
    if (closeBtn) closeBtn.focus();
  }

  function closeAchv() {
    if (achvModal.hidden) return;
    achvModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (resumeAfterModal) {
      resumeAfterModal = false;
      if (!state.over && state.status === "playing") {
        state.paused = false;
        pauseBtn.textContent = "Pause";
        resumeFlow();
      }
    }
    const focusTarget = overlayEl ? overlayEl.querySelector(".btn") : badgesBtn;
    if (focusTarget) focusTarget.focus();
  }

  // ---------- Overlay ----------
  function hideOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  function showOverlay(title, msg, actions) {
    hideOverlay();
    overlayEl = document.createElement("div");
    overlayEl.className = "overlay";
    overlayEl.dataset.title = title;
    overlayEl.dataset.msg = msg;
    const box = document.createElement("div");
    box.className = "overlay__box";
    box.innerHTML = `<h2></h2><p></p><div class="overlay__actions"></div>`;
    box.querySelector("h2").textContent = title;
    box.querySelector("p").textContent = msg;
    const actionsEl = box.querySelector(".overlay__actions");
    for (const action of actions || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = action.ghost ? "btn btn--ghost" : "btn";
      b.textContent = action.label;
      b.addEventListener("click", action.onClick);
      actionsEl.appendChild(b);
    }
    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);
    const first = overlayEl.querySelector(".btn");
    if (first) first.focus();
  }

  function focusModeBar() {
    const chip = document.querySelector(".mode-chip");
    if (chip) chip.focus();
  }

  // ---------- Timers ----------
  function clearAiTimer() {
    if (state.aiTimer) {
      clearTimeout(state.aiTimer);
      state.aiTimer = null;
    }
  }

  function clearHumanPassTimer() {
    if (state.humanPassTimer) {
      clearTimeout(state.humanPassTimer);
      state.humanPassTimer = null;
    }
  }

  function clearTimers() {
    clearAiTimer();
    clearHumanPassTimer();
  }

  function scheduleAI() {
    clearAiTimer();
    if (state.status !== "playing" || state.paused || state.turn !== "ai") return;
    state.aiTimer = setTimeout(aiTakeTurn, 680 + Math.floor(state.rng() * 260));
  }

  function scheduleHumanPass() {
    clearHumanPassTimer();
    if (state.status !== "playing" || state.paused || state.turn !== "you") return;
    state.humanPassTimer = setTimeout(() => {
      state.humanPassTimer = null;
      if (
        state.status === "playing" &&
        !state.paused &&
        state.turn === "you" &&
        !legalMoves("you").length
      ) {
        passTurn("you");
      }
    }, 900);
  }

  // ---------- Best / stats ----------
  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  function loadBest() {
    best = store.num(K.best(state.mode), 0);
    bestEl.textContent = best;
  }

  function saveBest() {
    if (state.score.you > best) {
      best = state.score.you;
      bestEl.textContent = best;
      store.set(K.best(state.mode), String(best));
    }
  }

  function updateDeficit() {
    state.maxDeficit = Math.max(state.maxDeficit, state.score.ai - state.score.you);
  }

  // ---------- Round / match flow ----------
  function reset() {
    clearTimers();
    hideOverlay();
    hideEndChoice();
    state.score = { you: 0, ai: 0 };
    state.round = 1;
    state.target = MODES[state.mode].target;
    state.maxDeficit = 0;
    state.over = false;
    state.paused = false;
    state.selected = null;
    state.rng =
      state.mode === "daily" ? mulberry32(hashSeed("dominoes-" + dateStr())) : Math.random;
    state.status = "playing";
    pauseBtn.textContent = "Pause";
    loadBest();
    startRound();
  }

  function startRound() {
    clearTimers();
    hideOverlay();
    hideEndChoice();

    const deck = shuffle(ALL_TILES.slice(), state.rng);
    state.hands = { you: deck.slice(0, 7), ai: deck.slice(7, 14) };
    state.boneyard = deck.slice(14);
    state.chain = [];
    state.selected = null;
    state.consecutivePasses = 0;
    state.humanDraws = 0;
    state.humanPasses = 0;
    state.roundMoves = 0;
    state.lastPlaced = null;
    state.starter = findStarter();
    state.turn = state.starter;
    state.status = "playing";
    state.paused = false;
    state.over = false;
    pauseBtn.textContent = "Pause";

    renderAll();

    if (state.starter === "ai") scheduleAI();
    else beginHumanTurn();
  }

  function nextRound() {
    if (state.status === "matchOver") {
      reset();
      return;
    }
    state.round++;
    startRound();
  }

  function drawUntilPlayable(player) {
    if (!MODES[state.mode].draw) return 0;
    let n = 0;
    while (state.boneyard.length && !legalMoves(player).length) {
      const tile = state.boneyard.pop();
      state.hands[player].push(tile);
      n++;
      if (n > 24) break;
    }
    return n;
  }

  function beginHumanTurn() {
    state.turn = "you";
    state.selected = null;
    hideEndChoice();
    if (state.status !== "playing") return;

    if (!legalMoves("you").length) {
      if (MODES[state.mode].draw && state.boneyard.length) {
        const drawn = drawUntilPlayable("you");
        if (drawn > 0) {
          state.humanDraws += drawn;
          stats.draws += drawn;
          saveStats();
          checkAchievements();
          showToast(
            `Drew ${drawn} tile${drawn === 1 ? "" : "s"}`,
            "No playable tile — drew from the boneyard.",
            "🁫"
          );
        }
      }
      if (!legalMoves("you").length) scheduleHumanPass();
    }

    renderAll();
  }

  function playTile(player, tile, side) {
    if (state.status !== "playing") return false;
    const oriented = orientFor(tile, side, state.chain);
    if (!oriented) return false;

    const hand = state.hands[player];
    const idx = hand.indexOf(tile);
    if (idx === -1) return false;
    hand.splice(idx, 1);

    if (side === "left") state.chain.unshift(oriented);
    else state.chain.push(oriented);

    state.consecutivePasses = 0;
    state.roundMoves++;
    state.selected = null;
    hideEndChoice();
    state.lastPlaced = {
      index: side === "left" ? 0 : state.chain.length - 1,
      time: nowMs,
    };

    sfx("place");
    if (tile.a === tile.b) {
      stats.doublesPlayed++;
      if (tile.a === 6) stats.doubleSix = 1;
    }

    if (MODES[state.mode].allFives) {
      const ends = endsOf(state.chain);
      const sum = ends.left + ends.right;
      if (sum > 0 && sum % 5 === 0) {
        if (player === "you") {
          state.score.you += sum;
          stats.allFivesPoints += sum;
          stats.bestAllFives = Math.max(stats.bestAllFives, state.score.you);
          stats.bestScore = Math.max(stats.bestScore, state.score.you);
          saveBest();
        } else {
          state.score.ai += sum;
        }
        updateDeficit();
        const pos = lastPlacedCenter();
        floater(pos.x, pos.y, `+${sum}`, PAL.accent2);
        burst(pos.x, pos.y, PAL.accent2, 14);
        sfx("score");
        saveStats();
        checkAchievements();
        if (checkMatchOver()) return true;
      }
    }

    saveStats();
    checkAchievements();

    if (!hand.length) {
      endRound(player, "domino");
      return true;
    }

    state.turn = player === "you" ? "ai" : "you";
    renderAll();

    if (state.turn === "ai") scheduleAI();
    else beginHumanTurn();
    return true;
  }

  function passTurn(player) {
    if (state.status !== "playing") return;
    state.roundMoves++;
    state.consecutivePasses++;
    if (player === "you") state.humanPasses++;
    state.selected = null;
    hideEndChoice();
    sfx("pass");
    showToast(
      player === "you" ? "You pass" : "Computer passes",
      player === "you" ? "No playable tile." : "The computer cannot play.",
      "⏭️"
    );

    if (state.consecutivePasses >= 2) {
      endRound(null, "blocked");
      return;
    }

    state.turn = player === "you" ? "ai" : "you";
    renderAll();
    if (state.turn === "ai") scheduleAI();
    else beginHumanTurn();
  }

  function checkMatchOver() {
    if (state.score.you >= state.target || state.score.ai >= state.target) {
      finishMatch(state.score.you >= state.target ? "you" : "ai");
      return true;
    }
    return false;
  }

  function finishMatch(winner) {
    if (state.status === "matchOver") return;
    state.status = "matchOver";
    state.over = true;
    clearTimers();
    hideEndChoice();
    state.selected = null;

    stats.bestScore = Math.max(stats.bestScore, state.score.you);
    if (MODES[state.mode].allFives) {
      stats.bestAllFives = Math.max(stats.bestAllFives, state.score.you);
    }

    stats.gamesPlayed++;
    if (winner === "you") {
      stats.gamesWon++;
      if (state.diff === "ruthless") stats.hardWins++;
      if (state.maxDeficit >= 50) stats.comebacks++;
      stats.bestScore = Math.max(stats.bestScore, state.score.you);
      if (state.mode === "daily") recordDailyResult(true);
      sfx("win");
      confetti();
      saveStats();
      checkAchievements();
      renderAll();
      showOverlay(
        "You win the match! 🎉",
        `Final score ${state.score.you} – ${state.score.ai}. ${MODES[state.mode].name} · ${state.round} round${state.round === 1 ? "" : "s"}.`,
        [
          { label: "Play again", onClick: () => { hideOverlay(); reset(); } },
          { label: "Change mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
        ]
      );
    } else {
      if (state.mode === "daily") recordDailyResult(false);
      sfx("over");
      saveStats();
      checkAchievements();
      renderAll();
      showOverlay(
        "Computer wins the match",
        `Final score ${state.score.you} – ${state.score.ai}. Try a different strategy.`,
        [
          { label: "Try again", onClick: () => { hideOverlay(); reset(); } },
          { label: "Change mode", ghost: true, onClick: () => { hideOverlay(); focusModeBar(); } },
        ]
      );
    }
  }

  function endRound(winner, reason) {
    if (state.status !== "playing") return;
    state.status = "roundOver";
    clearTimers();
    state.selected = null;
    hideEndChoice();

    const youPips = handPips(state.hands.you);
    const aiPips = handPips(state.hands.ai);
    let roundWinner = winner;
    let loserPips = 0;

    if (reason === "blocked") {
      if (youPips < aiPips) roundWinner = "you";
      else if (aiPips < youPips) roundWinner = "ai";
      else roundWinner = "tie";
      if (roundWinner === "you") loserPips = aiPips;
      else if (roundWinner === "ai") loserPips = youPips;
    } else {
      roundWinner = winner;
      loserPips = winner === "you" ? aiPips : youPips;
    }

    const points =
      roundWinner === "tie"
        ? 0
        : MODES[state.mode].allFives
          ? roundTo5(loserPips)
          : loserPips;

    stats.roundsPlayed++;
    if (roundWinner === "you") {
      state.score.you += points;
      stats.roundsWon++;
      stats.bestRoundScore = Math.max(stats.bestRoundScore, points);
      if (reason === "domino") stats.dominoWins++;
      if (reason === "blocked") stats.blockedWins++;
      if (state.humanDraws === 0) stats.noDrawWins++;
      if (state.humanPasses === 0) stats.noPassWins++;
      if (loserPips >= 20) stats.maxShutout = Math.max(stats.maxShutout, loserPips);
      sfx("win");
    } else if (roundWinner === "ai") {
      state.score.ai += points;
      sfx("lose");
    } else {
      sfx("pass");
    }

    updateDeficit();
    stats.bestScore = Math.max(stats.bestScore, state.score.you);
    if (MODES[state.mode].allFives) {
      stats.bestAllFives = Math.max(stats.bestAllFives, state.score.you);
    }
    saveBest();
    saveStats();
    checkAchievements();

    if (checkMatchOver()) return;

    const title =
      reason === "blocked"
        ? "Blocked!"
        : roundWinner === "you"
          ? "Domino! 🎉"
          : "Computer goes out";
    const msg =
      roundWinner === "tie"
        ? `Both players hold ${youPips} pips — no points.`
        : `${roundWinner === "you" ? "You score" : "Computer scores"} ${points}. Match: ${state.score.you} – ${state.score.ai}.`;

    showOverlay(title, msg, [
      { label: "Next round", onClick: () => { hideOverlay(); nextRound(); } },
      { label: "Restart match", ghost: true, onClick: () => { hideOverlay(); reset(); } },
    ]);
    renderAll();
  }

  function recordDailyResult() {
    if (state.mode !== "daily") return;
    stats.dailyWins++;
    const today = dateStr();
    if (daily.lastDate !== today) {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = dateStr(yesterdayDate);
      daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
      daily.lastDate = today;
    }
    store.jsonSet(K.daily, daily);
    saveStats();
    checkAchievements();
  }

  // ---------- AI turn ----------
  function aiTakeTurn() {
    state.aiTimer = null;
    if (state.status !== "playing" || state.paused || state.turn !== "ai") return;

    let moves = legalMoves("ai");
    if (!moves.length) {
      if (MODES[state.mode].draw && state.boneyard.length) {
        const drawn = drawUntilPlayable("ai");
        if (drawn > 0) {
          showToast(
            "Computer draws",
            `${drawn} tile${drawn === 1 ? "" : "s"} from the boneyard.`,
            "🁫"
          );
          sfx("draw");
        }
      }
      moves = legalMoves("ai");
    }

    if (!moves.length) {
      passTurn("ai");
      return;
    }

    const move = chooseAiMove(moves);
    if (move) playTile("ai", move.tile, move.side);
    else passTurn("ai");
  }

  // ---------- HUD ----------
  function turnText() {
    if (state.status === "matchOver") return "Match over";
    if (state.status === "roundOver") return "Round over";
    if (state.paused) return "Paused";
    if (state.turn === "you") return "Your turn";
    return "Computer…";
  }

  function updateHUD() {
    scoreEl.textContent = state.score.you;
    aiScoreEl.textContent = state.score.ai;
    bestEl.textContent = best;
    roundEl.textContent = state.round;
    targetEl.textContent = state.target;
    boneyardEl.textContent = MODES[state.mode].draw ? state.boneyard.length : "—";
    turnEl.textContent = turnText();
    const ends = endsOf(state.chain);
    endsEl.textContent = state.chain.length ? `${ends.left} · ${ends.right}` : "—";
    hintEl.textContent = `${MODES[state.mode].hint} · Click a tile to play · P to pause`;
  }

  // ---------- Rendering ----------
  function renderHand() {
    handEl.innerHTML = "";
    const yourTurn = state.turn === "you" && state.status === "playing" && !state.paused;
    const playable = new Set();
    if (yourTurn) {
      for (const m of legalMoves("you")) playable.add(tileKey(m.tile));
    }

    if (!state.hands.you.length) {
      const empty = document.createElement("span");
      empty.className = "domino-hand__empty";
      empty.textContent = "No tiles left!";
      handEl.appendChild(empty);
      return;
    }

    state.hands.you.forEach((tile, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "domino-hand__tile";
      btn.dataset.index = String(i);
      btn.dataset.tile = tileKey(tile);
      btn.innerHTML = tileSVG(tile.a, tile.b);
      const key = tileKey(tile);
      if (yourTurn && playable.has(key)) btn.classList.add("is-playable");
      if (yourTurn && !playable.has(key)) btn.classList.add("is-dim");
      if (state.selected === tile) btn.classList.add("is-selected");
      const label = `Tile ${tile.a}–${tile.b}${yourTurn && playable.has(key) ? ", playable" : ""}`;
      btn.setAttribute("aria-label", label);
      btn.title = label;
      handEl.appendChild(btn);
    });
  }

  function renderOpponent() {
    oppHandEl.innerHTML = "";
    const count = state.hands.ai.length;
    for (let i = 0; i < count; i++) {
      const back = document.createElement("div");
      back.className = "domino-back";
      oppHandEl.appendChild(back);
    }
    oppCountEl.textContent = `${count} tile${count === 1 ? "" : "s"}`;
    oppNameEl.textContent = `Computer · ${DIFFS[state.diff].name}`;
  }

  function showEndChoice(tile, sides) {
    const ends = endsOf(state.chain);
    endChoiceEl.innerHTML = "";
    const label = document.createElement("span");
    label.className = "end-choice__label";
    label.textContent = `Play ${tile.a}–${tile.b} on:`;
    endChoiceEl.appendChild(label);
    for (const side of sides) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent =
        side === "left" ? `Left end (${ends.left})` : `Right end (${ends.right})`;
      b.addEventListener("click", () => {
        hideEndChoice();
        playTile("you", tile, side);
      });
      endChoiceEl.appendChild(b);
    }
    endChoiceEl.hidden = false;
  }

  function hideEndChoice() {
    endChoiceEl.hidden = true;
    endChoiceEl.innerHTML = "";
  }

  function renderAll() {
    renderHand();
    renderOpponent();
    updateHUD();
    draw(nowMs);
  }

  // ---------- SVG hand tiles ----------
  function tileSVG(a, b) {
    const half = (hx, value) => {
      const size = 40;
      const ox = hx + (46 - size) / 2;
      const oy = 2 + (51 - size) / 2;
      let out = "";
      for (const [px, py] of PIPS[value]) {
        out += `<circle cx="${(ox + px * size).toFixed(1)}" cy="${(oy + py * size).toFixed(1)}" r="3.1" fill="var(--domino-pip, #1b1b22)"/>`;
      }
      return out;
    };
    return (
      `<svg viewBox="0 0 100 55" role="img" aria-hidden="true" focusable="false">` +
      `<rect x="1.5" y="1.5" width="97" height="52" rx="8" fill="var(--domino-face, #f6f2e6)" stroke="var(--domino-edge, #cfc8b4)" stroke-width="1.5"/>` +
      `<line x1="50" y1="5" x2="50" y2="50" stroke="var(--domino-line, rgba(40,35,25,0.45))" stroke-width="1.5"/>` +
      half(4, a) +
      half(54, b) +
      `</svg>`
    );
  }

  // ---------- Canvas ----------
  function layoutChain() {
    const items = [];
    if (!state.chain.length) return items;

    let x = PAD;
    let y = PAD;
    let dir = 1;
    const maxRight = CW - PAD;

    for (let i = 0; i < state.chain.length; i++) {
      const tile = state.chain[i];
      const isDouble = tile.a === tile.b;
      const w = isDouble ? TILE_T : TILE_L;
      const h = isDouble ? TILE_L : TILE_T;

      // Wrap to the next row if the tile would leave the table. The wrap
      // flips direction, and the tile is then placed according to the new
      // direction (not the old one).
      if (dir === 1) {
        if (x + w > maxRight) {
          y += ROW_H;
          dir = -1;
          x = maxRight;
        }
      } else if (x - w < PAD) {
        y += ROW_H;
        dir = 1;
        x = PAD;
      }

      let left;
      if (dir === 1) {
        left = x;
        x += w + GAP;
      } else {
        left = x - w;
        x -= w + GAP;
      }
      items.push({ x: left, top: y + (ROW_H - h) / 2, w, h, tile, index: i, isDouble });
    }
    return items;
  }

  function drawPips(hx, hy, hw, hh, value) {
    const size = Math.min(hw, hh);
    const ox = hx + (hw - size) / 2;
    const oy = hy + (hh - size) / 2;
    const r = Math.max(1.6, size * 0.085);
    ctx.beginPath();
    for (const [px, py] of PIPS[value]) {
      ctx.moveTo(ox + px * size + r, oy + py * size);
      ctx.arc(ox + px * size, oy + py * size, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawDomino(item) {
    const { x, top, w, h, tile } = item;
    const isDouble = tile.a === tile.b;
    let scale = 1;
    if (state.lastPlaced && state.lastPlaced.index === item.index) {
      const age = nowMs - state.lastPlaced.time;
      if (age >= 0 && age < 260) scale = 1 + 0.12 * (1 - age / 260);
    }

    ctx.save();
    if (scale !== 1) {
      ctx.translate(x + w / 2, top + h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x + w / 2), -(top + h / 2));
    }

    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    roundRect(x, top, w, h, Math.min(9, h * 0.3));
    ctx.fillStyle = "#f6f2e6";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(60,50,30,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    roundRect(x + 1.5, top + 1.5, w - 3, h - 3, Math.min(7, h * 0.26));
    ctx.stroke();

    ctx.strokeStyle = "rgba(40,35,25,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (w > h) {
      ctx.moveTo(x + w / 2, top + 4);
      ctx.lineTo(x + w / 2, top + h - 4);
    } else {
      ctx.moveTo(x + 4, top + h / 2);
      ctx.lineTo(x + w - 4, top + h / 2);
    }
    ctx.stroke();

    ctx.fillStyle = "#1b1b22";
    if (w > h) {
      drawPips(x + 3, top + 3, w / 2 - 6, h - 6, tile.a);
      drawPips(x + w / 2 + 3, top + 3, w / 2 - 6, h - 6, tile.b);
    } else {
      drawPips(x + 3, top + 3, w - 6, h / 2 - 6, tile.a);
      drawPips(x + 3, top + h / 2 + 3, w - 6, h / 2 - 6, tile.b);
    }

    ctx.restore();

    // A small "double" tick so doubles read at a glance.
    if (isDouble) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PAL.accent2;
      ctx.beginPath();
      ctx.arc(x + w / 2, top + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEndGlow(item, color) {
    const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.005);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35 + pulse * 0.45;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    roundRect(item.x - 2, item.top - 2, item.w + 4, item.h + 4, 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawTable() {
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#1e4c3b");
    g.addColorStop(0.55, "#123127");
    g.addColorStop(1, "#0a1b14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let yy = 14; yy < CH; yy += 28) {
      for (let xx = 14; xx < CW; xx += 28) {
        ctx.beginPath();
        ctx.arc(xx, yy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const rg = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.18, CW / 2, CH / 2, CH * 0.85);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, CW, CH);
  }

  function drawEmptyState() {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    roundRect(CW / 2 - 64, CH / 2 - 32, 128, 64, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "700 16px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Play a tile to start", CW / 2, CH / 2 + 1);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.font = "900 22px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function lastPlacedCenter() {
    const items = layoutChain();
    const item = state.lastPlaced ? items[state.lastPlaced.index] : null;
    return item
      ? { x: item.x + item.w / 2, y: item.top + item.h / 2 }
      : { x: CW / 2, y: CH / 2 };
  }

  function draw(ts) {
    if (ts) nowMs = ts;
    ctx.save();
    ctx.clearRect(0, 0, CW, CH);
    drawTable();

    if (state.chain.length) {
      const items = layoutChain();
      for (const item of items) drawDomino(item);
      drawEndGlow(items[0], PAL.accent2);
      drawEndGlow(items[items.length - 1], PAL.accent3);
    } else {
      drawEmptyState();
    }

    drawParticles();
    drawFloaters();
    ctx.restore();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100;
    nowMs = ts;
    updateEffects(dt);
    draw(ts);
  }

  // ---------- Input ----------
  function onTileClick(tile) {
    if (state.status !== "playing" || state.paused || state.turn !== "you") return;
    const moves = legalMoves("you").filter((m) => m.tile === tile);
    if (!moves.length) {
      sfx("bump");
      showToast("That tile doesn't fit", "Try a tile that matches an open end.", "🚫");
      return;
    }

    sfx("click");
    if (!state.chain.length) {
      playTile("you", tile, "start");
      return;
    }

    const sides = moves.map((m) => m.side);
    if (sides.length === 1) {
      playTile("you", tile, sides[0]);
      return;
    }

    const left = state.chain[0].a;
    const right = state.chain[state.chain.length - 1].b;
    if (left === right) {
      playTile("you", tile, "left");
      return;
    }

    state.selected = tile;
    showEndChoice(tile, sides);
    renderHand();
  }

  function setMode(m, force) {
    if (!MODES[m]) return;
    const changed = m !== state.mode;
    state.mode = m;
    store.set(K.mode, m);
    document.querySelectorAll(".mode-chip").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false");
    });
    hintEl.textContent = `${MODES[m].hint} · Click a tile to play · P to pause`;
    loadBest();
    if (changed || force) reset();
  }

  function setDiff(d) {
    if (!DIFFS[d]) return;
    state.diff = d;
    store.set(K.diff, d);
    document.querySelectorAll(".diff-chip").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.diff === d ? "true" : "false");
    });
    renderOpponent();
  }

  function resumeFlow() {
    if (state.status !== "playing" || state.paused) return;
    if (state.turn === "ai") {
      scheduleAI();
    } else if (!legalMoves("you").length) {
      if (MODES[state.mode].draw && state.boneyard.length) {
        beginHumanTurn();
      } else {
        scheduleHumanPass();
      }
    }
  }

  function setPaused(p, silent) {
    if (state.status !== "playing" || state.over) return;
    state.paused = p;
    if (p) {
      clearTimers();
      pauseBtn.textContent = "▶ Resume";
      if (!silent) {
        showOverlay("Paused", "Take a breath — press P or hit Resume.", [
          { label: "Resume", onClick: () => { hideOverlay(); setPaused(false, true); } },
          { label: "Restart", ghost: true, onClick: () => { hideOverlay(); reset(); } },
        ]);
      }
    } else {
      pauseBtn.textContent = "Pause";
      hideOverlay();
      resumeFlow();
    }
    renderAll();
  }

  function togglePause() {
    if (state.status !== "playing" || state.over) return;
    setPaused(!state.paused, false);
  }

  function bindEvents() {
    document.querySelectorAll(".mode-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.dataset.mode;
        if (!MODES[m] || m === state.mode) return;
        sfx("click");
        setMode(m);
      });
    });

    document.querySelectorAll(".diff-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.diff;
        if (!DIFFS[d] || d === state.diff) return;
        sfx("click");
        setDiff(d);
      });
    });

    document.getElementById("restart").addEventListener("click", () => {
      sfx("click");
      reset();
    });

    pauseBtn.addEventListener("click", () => {
      sfx("click");
      togglePause();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    document.getElementById("badges2").addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    achvModal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeAchv);
    });

    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      store.set(K.sound, soundOn ? "on" : "off");
      updateSoundBtn();
      if (soundOn) {
        unlockAudio();
        sfx("click");
      }
    });

    handEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".domino-hand__tile");
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      const tile = state.hands.you[idx];
      if (tile) onTileClick(tile);
    });

    document.addEventListener("keydown", (e) => {
      const k = e.key;
      const lower = k.toLowerCase();
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();

      if (!achvModal.hidden) {
        if (k === "Escape") {
          closeAchv();
          e.preventDefault();
        } else if (k === "Tab") {
          const focusable = achvModal.querySelector(".snake-modal__head [data-close]");
          if (focusable) {
            focusable.focus();
            e.preventDefault();
          }
        }
        return;
      }

      if (tag === "button" && (k === " " || k === "Enter")) return;

      if (lower === "p") {
        togglePause();
        e.preventDefault();
      } else if (k === "Escape") {
        if (state.selected) {
          state.selected = null;
          hideEndChoice();
          renderHand();
          e.preventDefault();
        } else if (state.paused) {
          setPaused(false, true);
          e.preventDefault();
        }
      } else if (k === " " || k === "Enter") {
        if (state.status === "roundOver") {
          hideOverlay();
          nextRound();
          e.preventDefault();
        } else if (state.status === "matchOver") {
          hideOverlay();
          reset();
          e.preventDefault();
        } else if (state.paused) {
          setPaused(false, true);
          e.preventDefault();
        }
      } else if (k >= "1" && k <= "9") {
        const idx = Number(k) - 1;
        const tile = state.hands.you[idx];
        if (tile) onTileClick(tile);
        e.preventDefault();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.status === "playing" && !state.paused) {
        setPaused(true, false);
      }
    });

    window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
    window.addEventListener("keydown", unlockAudio, { once: true, capture: true });
  }

  // ---------- Init ----------
  function init() {
    PAL = readPalette();
    soundOn = store.get(K.sound, "on") !== "off";
    updateSoundBtn();
    updateBadgeCount();
    bindEvents();

    const savedDiff = store.get(K.diff, "cunning");
    setDiff(DIFFS[savedDiff] ? savedDiff : "cunning");

    const savedMode = store.get(K.mode, "classic");
    setMode(MODES[savedMode] ? savedMode : "classic", true);

    renderAchvGrid();
    requestAnimationFrame(loop);
  }

  // Test hook — harmless in normal play.
  window.__D = {
    state,
    stats,
    daily,
    MODES,
    DIFFS,
    ACHIEVEMENTS,
    ALL_TILES,
    PIPS,
    CW,
    CH,
    PAD,
    TILE_L,
    TILE_T,
    GAP,
    ROW_H,
    unlocked: () => Array.from(unlocked),
    getBest: () => best,
    setBest: (b) => {
      best = b;
      bestEl.textContent = b;
    },
    endsOf,
    orientFor,
    legalMoves,
    chooseAiMove,
    drawUntilPlayable,
    layoutChain,
    tileSVG,
    roundTo5,
    handPips,
    findStarter,
    startRound,
    reset,
    setMode,
    setDiff,
    playTile,
    passTurn,
    endRound,
    finishMatch,
    checkMatchOver,
    beginHumanTurn,
    aiTakeTurn,
    renderAll,
    updateHUD,
    checkAchievements,
    saveStats,
    saveBest,
    loadBest,
    clearTimers,
    scheduleAI,
    scheduleHumanPass,
    draw,
    loop,
    updateEffects,
    burst,
    floater,
    snap: () => ({
      mode: state.mode,
      diff: state.diff,
      target: state.target,
      score: Object.assign({}, state.score),
      round: state.round,
      chain: state.chain.map((t) => ({ a: t.a, b: t.b })),
      hand: state.hands.you.map((t) => ({ a: t.a, b: t.b })),
      aiHand: state.hands.ai.map((t) => ({ a: t.a, b: t.b })),
      boneyard: state.boneyard.map((t) => ({ a: t.a, b: t.b })),
      turn: state.turn,
      status: state.status,
      paused: state.paused,
      over: state.over,
      humanDraws: state.humanDraws,
      humanPasses: state.humanPasses,
      consecutivePasses: state.consecutivePasses,
      maxDeficit: state.maxDeficit,
      best: best,
      stats: Object.assign({}, stats),
      daily: Object.assign({}, daily),
      unlocked: Array.from(unlocked),
      overlayTitle: overlayEl ? overlayEl.dataset.title : null,
      overlayMsg: overlayEl ? overlayEl.dataset.msg : null,
      handTiles: handEl.children ? handEl.children.length : 0,
    }),
  };

  init();
})();