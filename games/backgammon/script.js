// Backgammon — race home, hit blots, bear off. Pure vanilla JS, fully offline.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
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
    dom,
  } = window.Arcade;

  const sfx = audio.sfx;
  const showOverlay = overlay.show;
  const hideOverlay = overlay.hide;

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const rowTopEl = dom.byId("row-top");
  const rowBottomEl = dom.byId("row-bottom");
  const barEl = dom.byId("bar");
  const diceRowEl = dom.byId("dice-row");
  const diceEl = dom.byId("dice");
  const offWEl = dom.byId("off-w");
  const offBEl = dom.byId("off-b");
  const trayWEl = dom.byId("tray-w");
  const trayBEl = dom.byId("tray-b");
  const trayWBox = dom.byId("tray-w-box");
  const trayBBox = dom.byId("tray-b-box");
  const rollBtn = dom.byId("roll");
  const restartBtn = dom.byId("restart");
  const hintEl = dom.byId("hint");
  const modeCpuBtn = dom.byId("mode-cpu");
  const mode2pBtn = dom.byId("mode-2p");

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
  const WHITE = 1;
  const BLACK = 2;
  const PTS = 24;
  const TOP_POINTS = [];
  for (let p = 13; p <= 24; p++) TOP_POINTS.push(p);
  const BOTTOM_POINTS = [];
  for (let p = 12; p >= 1; p--) BOTTOM_POINTS.push(p);

  const K = makeKeys("backgammon");

  // ---------- Seeded RNG ----------
  let rngState = 0x5b4a2c1d;
  function rand() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function randInt(n) {
    return Math.floor(rand() * n);
  }

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    gammon: 0,
    backgammon: 0,
    moves: 0,
    streak: 0,
    bestStreak: 0,
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
    { id: "first", icon: "🎲", name: "First Game", desc: "Finish your first game.", stat: "games", goal: 1 },
    { id: "games10", icon: "🎮", name: "Regular", desc: "Finish 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🕹️", name: "Arcade Regular", desc: "Finish 25 games.", stat: "games", goal: 25 },
    { id: "win1", icon: "🏁", name: "First Win", desc: "Win a game.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🏆", name: "Winner", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "wins25", icon: "🎖️", name: "Veteran", desc: "Win 25 games.", stat: "wins", goal: 25 },
    { id: "gammon1", icon: "💥", name: "Gammon", desc: "Win by a gammon.", stat: "gammon", goal: 1 },
    { id: "gammon5", icon: "🌟", name: "Gammon Hunter", desc: "Win 5 gammons.", stat: "gammon", goal: 5 },
    { id: "gammon10", icon: "💫", name: "Shutout Artist", desc: "Win 10 gammons.", stat: "gammon", goal: 10 },
    { id: "backgammon1", icon: "🔥", name: "Backgammon!", desc: "Win a backgammon.", stat: "backgammon", goal: 1 },
    { id: "moves100", icon: "🚶", name: "Pathfinder", desc: "Play 100 moves in total.", stat: "moves", goal: 100 },
    { id: "streak3", icon: "📈", name: "On a Roll", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "⚡", name: "Unstoppable", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
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
        ["Gammons", stats.gammon],
        ["Backgammons", stats.backgammon],
        ["Best streak", stats.bestStreak],
        ["Moves", stats.moves],
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
  audio.define("roll", [[320, 0, 0.05, "square", 0.03], [420, 0.05, 0.05, "square", 0.03]]);
  audio.define("hit", [[520, 0, 0.06, "triangle", 0.045], [700, 0.06, 0.08, "triangle", 0.045]]);
  audio.define("off", [[660, 0, 0.07, "triangle", 0.04], [880, 0.07, 0.09, "triangle", 0.04]]);

  // ---------- State ----------
  let points = [];
  let bar = { 1: 0, 2: 0 };
  let off = { 1: 0, 2: 0 };
  let turn = WHITE;
  let phase = "roll"; // roll | move | over
  let dice = [];
  let selected = null; // point number or "bar"
  let gameOver = false;
  let paused = false;
  let mode = "cpu";
  let movesThisGame = 0;
  let cpuTimer = 0;

  // ---------- Helpers ----------
  function getP(p, player) {
    return player === WHITE ? points[p].w : points[p].b;
  }
  function setP(p, player, v) {
    if (player === WHITE) points[p].w = v;
    else points[p].b = v;
  }
  function other(player) {
    return player === WHITE ? BLACK : WHITE;
  }
  function dist(player, p) {
    return player === WHITE ? p : 25 - p;
  }

  // A "view" reads board state either from the live game or from a pure
  // simulation copy. Turn legality explores continuations on a copy so that
  // highlighting and CPU planning never touch live state, stats, sound or DOM.
  function makeView(sim) {
    if (!sim) {
      return {
        get: (p, pl) => getP(p, pl),
        bar: (pl) => bar[pl],
        off: (pl) => off[pl],
      };
    }
    return {
      get: (p, pl) => sim.points[p][pl === WHITE ? "w" : "b"],
      bar: (pl) => sim.bar[pl],
      off: (pl) => sim.off[pl],
    };
  }
  function snapshot() {
    return {
      points: points.map((p) => ({ w: p.w, b: p.b })),
      bar: { 1: bar[1], 2: bar[2] },
      off: { 1: off[1], 2: off[2] },
    };
  }
  function cloneSim(sim) {
    return {
      points: sim.points.map((p) => ({ w: p.w, b: p.b })),
      bar: { 1: sim.bar[1], 2: sim.bar[2] },
      off: { 1: sim.off[1], 2: sim.off[2] },
    };
  }
  function simApply(sim, player, mv) {
    const key = player === WHITE ? "w" : "b";
    const get = (p) => sim.points[p][key];
    const set = (p, v) => { sim.points[p][key] = v; };
    if (mv.from === "bar") sim.bar[player]--;
    else set(mv.from, get(mv.from) - 1);

    if (mv.to === "off") {
      sim.off[player]++;
    } else {
      const oppKey = player === WHITE ? "b" : "w";
      if (mv.hit) {
        sim.points[mv.to][oppKey]--;
        sim.bar[other(player)]++;
      }
      set(mv.to, get(mv.to) + 1);
    }
  }

  function blockedV(view, p, opp) {
    return view.get(p, opp) >= 2;
  }
  function allInHomeV(view, player) {
    if (view.bar(player) > 0) return false;
    if (player === WHITE) {
      for (let p = 7; p <= 24; p++) if (view.get(p, player) > 0) return false;
    } else {
      for (let p = 1; p <= 18; p++) if (view.get(p, player) > 0) return false;
    }
    return true;
  }
  function maxDistV(view, player) {
    let m = 0;
    for (let p = 1; p <= 24; p++) {
      if (view.get(p, player) > 0) m = Math.max(m, dist(player, p));
    }
    return m;
  }
  function canBearOffV(view, player, p, die) {
    const d = dist(player, p);
    if (d === die) return true;
    return die > d && d === maxDistV(view, player);
  }
  function uniqueOf(diceList) {
    return Array.from(new Set(diceList));
  }

  // Single-die movement rules, identical to before but read through a view.
  function legalMovesV(view, player, die) {
    const moves = [];
    const opp = other(player);

    if (view.bar(player) > 0) {
      const entry = player === WHITE ? 25 - die : die;
      if (entry >= 1 && entry <= 24 && !blockedV(view, entry, opp)) {
        moves.push({ from: "bar", to: entry, die, hit: view.get(entry, opp) === 1 });
      }
      return moves;
    }

    const home = allInHomeV(view, player);
    for (let p = 1; p <= 24; p++) {
      if (view.get(p, player) === 0) continue;
      const dest = player === WHITE ? p - die : p + die;
      if (dest >= 1 && dest <= 24) {
        if (!blockedV(view, dest, opp)) {
          moves.push({ from: p, to: dest, die, hit: view.get(dest, opp) === 1 });
        }
      } else if (home && canBearOffV(view, player, p, die)) {
        moves.push({ from: p, to: "off", die, hit: false });
      }
    }
    return moves;
  }

  // ---------- Turn-level legality ----------
  // A first move is only legal if it can be part of a play that uses as many
  // dice as possible (all four for doubles). Explore every continuation on a
  // simulation copy; the live board is never mutated here.
  function maxRemainingPlays(sim, player, remaining) {
    if (!remaining.length) return 0;
    const view = makeView(sim);
    let best = 0;
    for (const die of uniqueOf(remaining)) {
      for (const mv of legalMovesV(view, player, die)) {
        const nextSim = cloneSim(sim);
        simApply(nextSim, player, mv);
        const rest = remaining.slice();
        rest.splice(rest.indexOf(die), 1);
        best = Math.max(best, 1 + maxRemainingPlays(nextSim, player, rest));
        if (best === remaining.length) return best;
      }
    }
    return best;
  }

  function legalTurnMoves(player) {
    if (gameOver || paused || !dice.length) return [];
    const view = makeView(null);
    const candidates = [];
    let bestUsed = 0;

    for (const die of uniqueOf(dice)) {
      for (const mv of legalMovesV(view, player, die)) {
        const sim = snapshot();
        simApply(sim, player, mv);
        const rest = dice.slice();
        rest.splice(rest.indexOf(die), 1);
        const used = 1 + maxRemainingPlays(sim, player, rest);
        candidates.push({ mv, die, used });
        bestUsed = Math.max(bestUsed, used);
      }
    }
    if (!bestUsed) return [];

    let kept = candidates.filter((c) => c.used === bestUsed);
    // When only one of two distinct dice can be played at all, the higher
    // die is the correct one to use (standard backgammon rule).
    if (bestUsed === 1 && uniqueOf(dice).length === 2) {
      const high = Math.max(...dice);
      const highMoves = kept.filter((c) => c.die === high);
      if (highMoves.length) kept = highMoves;
    }
    return kept.map((c) => c.mv);
  }

  // Live-state wrappers kept for the public helpers/test hook.
  function blocked(p, opp) { return blockedV(makeView(null), p, opp); }
  function allInHome(player) { return allInHomeV(makeView(null), player); }
  function maxDist(player) { return maxDistV(makeView(null), player); }
  function canBearOff(player, p, die) { return canBearOffV(makeView(null), player, p, die); }
  function uniqueDice() { return uniqueOf(dice); }
  function legalMoves(player, die) { return legalMovesV(makeView(null), player, die); }

  function isBlotRisky(p, player) {
    const opp = other(player);
    for (let q = 1; q <= 24; q++) {
      if (getP(q, opp) === 0) continue;
      if (opp === WHITE) {
        const d = q - p;
        if (d >= 1 && d <= 6) return true;
      } else {
        const d = p - q;
        if (d >= 1 && d <= 6) return true;
      }
    }
    return false;
  }

  function anyMoveExists(player) {
    return legalTurnMoves(player).length > 0;
  }

  function hasMoveFrom(player, from) {
    return legalTurnMoves(player).some((mv) => String(mv.from) === String(from));
  }

  function findMoveTo(player, from, to) {
    const fromS = String(from);
    const toS = String(to);
    return (
      legalTurnMoves(player).find(
        (mv) => String(mv.from) === fromS && String(mv.to) === toS
      ) || null
    );
  }

  // ---------- Apply ----------
  function applyMove(mv) {
    if (paused || gameOver) return;
    const player = turn;
    const idx = dice.indexOf(mv.die);
    if (idx >= 0) dice.splice(idx, 1);

    if (mv.from === "bar") bar[player]--;
    else setP(mv.from, player, getP(mv.from, player) - 1);

    if (mv.to === "off") {
      off[player]++;
    } else {
      const opp = other(player);
      if (mv.hit) {
        setP(mv.to, opp, getP(mv.to, opp) - 1);
        bar[opp]++;
      }
      setP(mv.to, player, getP(mv.to, player) + 1);
    }

    movesThisGame++;
    selected = null;

    if (mv.hit) sfx("hit");
    else if (mv.to === "off") sfx("off");
    else sfx("place");

    render();
    updateStatus();
    if (off[player] === 15) endGame(player);
  }

  function afterMove() {
    if (gameOver) return;
    if (dice.length === 0 || !anyMoveExists(turn)) endTurn();
  }

  // ---------- Turn flow ----------
  function rollDice() {
    const d1 = 1 + randInt(6);
    const d2 = 1 + randInt(6);
    dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    sfx("roll");
  }

  function roll() {
    if (gameOver || paused || phase !== "roll") return;
    if (mode === "cpu" && turn === BLACK) return;
    rollDice();
    phase = "move";
    if (bar[turn] > 0) selected = "bar";
    render();
    updateStatus();
    if (!anyMoveExists(turn)) {
      toast.show("No moves", (turn === WHITE ? "White" : "Black") + " has no legal play.", "🎲");
      endTurn();
    }
  }

  function endTurn() {
    if (gameOver || paused) return;
    turn = other(turn);
    phase = "roll";
    dice = [];
    selected = null;
    render();
    updateStatus();
    maybeCPU();
  }

  // ---------- CPU ----------
  function scoreMove(player, mv) {
    let s = rand() * 0.4;
    if (mv.hit) s += 9;
    if (mv.to === "off") s += 7;
    if (mv.from === "bar") s += 4;
    if (mv.to !== "off") {
      const own = getP(mv.to, player);
      if (own >= 1) s += 1.5;
      if (own === 0 && isBlotRisky(mv.to, player)) s -= 2.5;
    }
    if (mv.from !== "bar") {
      const left = getP(mv.from, player) - 1;
      if (left === 1 && isBlotRisky(mv.from, player)) s -= 1.5;
    }
    return s;
  }

  function bestMove(player) {
    let best = null;
    let bestS = -Infinity;
    for (const mv of legalTurnMoves(player)) {
      const s = scoreMove(player, mv);
      if (s > bestS) {
        bestS = s;
        best = mv;
      }
    }
    return best;
  }

  function cpuPlayTurn() {
    if (gameOver || mode !== "cpu" || turn !== BLACK) return;
    if (phase === "roll") rollDice();
    let guard = 0;
    while (!gameOver && turn === BLACK && dice.length && guard++ < 16) {
      const mv = bestMove(BLACK);
      if (!mv) break;
      applyMove(mv);
    }
    if (!gameOver && turn === BLACK) endTurn();
  }

  function maybeCPU() {
    if (mode !== "cpu" || turn !== BLACK || gameOver) return;
    clearTimeout(cpuTimer);
    cpuTimer = setTimeout(() => {
      cpuTimer = 0;
      cpuPlayTurn();
    }, 320);
  }

  // ---------- Scoring / end ----------
  function endGame(winner) {
    if (gameOver) return;
    gameOver = true;
    phase = "over";
    clearTimeout(cpuTimer);
    cpuTimer = 0;

    const loser = other(winner);
    let type = 1;
    let label = "Single";
    if (off[loser] === 0) {
      let back = bar[loser] > 0;
      const lo = winner === WHITE ? 1 : 19;
      const hi = winner === WHITE ? 6 : 24;
      for (let p = lo; p <= hi; p++) if (getP(p, loser) > 0) back = true;
      if (back) {
        type = 3;
        label = "Backgammon";
      } else {
        type = 2;
        label = "Gammon";
      }
    }

    stats.games++;
    stats.moves += movesThisGame;
    if (winner === WHITE) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (type === 2) stats.gammon++;
      if (type === 3) stats.backgammon++;
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    render();
    updateStatus();

    if (winner === WHITE) {
      sfx("win");
      confetti(type > 1 ? 130 : 90);
    } else {
      sfx("over");
    }

    const title =
      mode === "cpu"
        ? winner === WHITE
          ? "You win! 🎉"
          : "CPU wins"
        : winner === WHITE
        ? "White wins"
        : "Black wins";

    showOverlay(
      title,
      `${label} · ${type} point${type === 1 ? "" : "s"} · White ${off[WHITE]} off · Black ${off[BLACK]} off.`,
      [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(false); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Rendering ----------
  function computeTargets() {
    const set = new Set();
    if (selected === null || phase !== "move" || gameOver) return set;
    for (const mv of legalTurnMoves(turn)) {
      if (String(mv.from) === String(selected)) set.add(String(mv.to));
    }
    return set;
  }

  function renderRow(container, list, targets) {
    container.innerHTML = "";
    for (const p of list) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "bg-point " + (p % 2 === 0 ? "bg-point--dark" : "bg-point--light");
      cell.setAttribute("data-point", String(p));
      cell.setAttribute("aria-label", `Point ${p}, ${points[p].w} white, ${points[p].b} black`);

      const w = points[p].w;
      const b = points[p].b;
      const total = w + b;
      const color = w > 0 ? WHITE : BLACK;
      const show = Math.min(total, 5);
      for (let i = 0; i < show; i++) {
        const ch = document.createElement("div");
        ch.className = "bg-checker " + (color === WHITE ? "bg-checker--w" : "bg-checker--b");
        cell.appendChild(ch);
      }
      if (total > 5) {
        const badge = document.createElement("span");
        badge.className = "bg-count";
        badge.textContent = String(total);
        cell.appendChild(badge);
      }
      if (selected === p) cell.classList.add("bg-point--sel");
      if (targets.has(String(p))) cell.classList.add("bg-point--target");
      cell.addEventListener("click", () => onPointClick(p));
      container.appendChild(cell);
    }
  }

  function renderBar() {
    barEl.innerHTML = "";
    for (const player of [WHITE, BLACK]) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bg-bar__chip" + (bar[player] > 0 ? " bg-bar__chip--active" : "");
      chip.setAttribute("data-bar-player", String(player));
      chip.textContent = (player === WHITE ? "●" : "○") + " Bar " + bar[player];
      chip.setAttribute("aria-label", (player === WHITE ? "White" : "Black") + " bar: " + bar[player]);
      chip.addEventListener("click", () => onBarClick(player));
      barEl.appendChild(chip);
    }
  }

  function renderDice() {
    diceRowEl.innerHTML = "";
    for (const d of dice) {
      const die = document.createElement("div");
      die.className = "bg-die";
      die.textContent = String(d);
      diceRowEl.appendChild(die);
    }
    if (!dice.length) {
      const empty = document.createElement("span");
      empty.className = "bg-hint";
      empty.style.opacity = "0.5";
      empty.style.fontSize = "0.8rem";
      empty.textContent = phase === "roll" ? "Roll to begin your turn" : "";
      diceRowEl.appendChild(empty);
    }
  }

  function render() {
    const active = document.activeElement;
    const point = active?.getAttribute("data-point");
    const barPlayer = active?.getAttribute("data-bar-player");
    const targets = computeTargets();
    renderRow(rowTopEl, TOP_POINTS, targets);
    renderRow(rowBottomEl, BOTTOM_POINTS, targets);
    renderBar();
    renderDice();

    const bearable =
      selected !== null &&
      phase === "move" &&
      !gameOver &&
      findMoveTo(turn, selected, "off") !== null;
    const whiteCanBearOff = bearable && turn === WHITE;
    const blackCanBearOff = bearable && turn === BLACK;
    trayWBox.classList.toggle("bg-off--active", whiteCanBearOff);
    trayBBox.classList.toggle("bg-off--active", blackCanBearOff);
    trayWBox.disabled = !whiteCanBearOff;
    trayBBox.disabled = !blackCanBearOff;

    if (point) boardEl.querySelector(`[data-point="${point}"]`)?.focus({ preventScroll: true });
    if (barPlayer) barEl.querySelector(`[data-bar-player="${barPlayer}"]`)?.focus({ preventScroll: true });
  }

  function updateStatus() {
    offWEl.textContent = off[WHITE];
    offBEl.textContent = off[BLACK];
    trayWEl.textContent = off[WHITE];
    trayBEl.textContent = off[BLACK];
    trayWBox.setAttribute("aria-label", `Bear off a white checker, ${off[WHITE]} borne off`);
    trayBBox.setAttribute("aria-label", `Bear off a black checker, ${off[BLACK]} borne off`);
    diceEl.textContent = dice.length ? dice.join(" ") : phase === "roll" ? "—" : "";
    rollBtn.disabled = gameOver || phase !== "roll" || (mode === "cpu" && turn === BLACK);
    rollBtn.textContent = phase === "move" ? "🎲 Rolled" : "🎲 Roll";
  }

  // ---------- Input ----------
  function onPointClick(p) {
    if (gameOver || paused || phase !== "move") return;
    if (mode === "cpu" && turn === BLACK) return;
    const player = turn;

    if (selected !== null && String(selected) !== String(p)) {
      const mv = findMoveTo(player, selected, p);
      if (mv) {
        applyMove(mv);
        afterMove();
        return;
      }
    }

    if (getP(p, player) > 0 && hasMoveFrom(player, p)) {
      selected = selected === p ? null : p;
      sfx("select");
      render();
      return;
    }

    selected = null;
    render();
  }

  function onBarClick(player) {
    if (gameOver || paused || phase !== "move") return;
    if (mode === "cpu" && turn === BLACK) return;
    if (player === turn && bar[player] > 0) {
      selected = "bar";
      sfx("select");
      render();
    }
  }

  function onTrayClick(player) {
    if (gameOver || paused || phase !== "move") return;
    if (mode === "cpu" && turn === BLACK) return;
    if (player !== turn || selected === null) return;
    const mv = findMoveTo(player, selected, "off");
    if (mv) {
      applyMove(mv);
      afterMove();
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
    if (overlay.isOpen() || gameOver || paused) return;
    if (key === "Enter" || key === " ") {
      if (tag === "button" || tag === "a") return;
      if (e.preventDefault) e.preventDefault();
      roll();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    rollBtn.addEventListener("click", () => { audio.unlock(); roll(); });
    restartBtn.addEventListener("click", () => { audio.unlock(); sfx("click"); newGame(false); });
    trayWBox.addEventListener("click", () => { audio.unlock(); onTrayClick(WHITE); });
    trayBBox.addEventListener("click", () => { audio.unlock(); onTrayClick(BLACK); });

    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    modeCpuBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      if (mode !== "cpu") {
        mode = "cpu";
        syncModeChips();
        newGame(false);
      }
    });
    mode2pBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      if (mode !== "2p") {
        mode = "2p";
        syncModeChips();
        newGame(false);
      }
    });

    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden && !overlay.isOpen()) setPaused(true);
    });

    audio.bindUnlock();
  }

  function syncModeChips() {
    modeCpuBtn.setAttribute("aria-pressed", String(mode === "cpu"));
    mode2pBtn.setAttribute("aria-pressed", String(mode === "2p"));
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      clearTimeout(cpuTimer);
      cpuTimer = 0;
      showOverlay("Paused", "Take a breath — press P or hit Resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
            maybeCPU();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
    }
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---------- New game ----------
  function newGame(intro) {
    clearTimeout(cpuTimer);
    cpuTimer = 0;
    points = Array.from({ length: 25 }, () => ({ w: 0, b: 0 }));
    points[24].w = 2;
    points[13].w = 5;
    points[8].w = 3;
    points[6].w = 5;
    points[1].b = 2;
    points[12].b = 5;
    points[17].b = 3;
    points[19].b = 5;

    bar = { 1: 0, 2: 0 };
    off = { 1: 0, 2: 0 };
    turn = WHITE;
    phase = "roll";
    dice = [];
    selected = null;
    gameOver = false;
    paused = false;
    movesThisGame = 0;

    hideOverlay();
    hintEl.textContent =
      mode === "cpu"
        ? "You are White ● and move first. Roll, then click a checker and a highlighted destination. Land on a lone enemy checker to hit it. P pauses."
        : "White ● moves first. Roll, then click a checker and a highlighted destination. Two players share this board. P pauses.";
    render();
    updateStatus();
    if (intro) showStartOverlay();
  }

  function showStartOverlay() {
    showOverlay(
      "Backgammon",
      "You are White ● and move first. Race all 15 checkers around the board and bear them off before the CPU.",
      [
        { label: "Play", onClick: () => { hideOverlay(); audio.unlock(); sfx("click"); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame(true);
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__BACKGAMMON = {
    WHITE,
    BLACK,
    stats,
    ACHIEVEMENTS,
    get points() {
      const out = [];
      for (let p = 1; p <= 24; p++) out.push({ p, w: points[p].w, b: points[p].b });
      return out;
    },
    get bar() { return { 1: bar[1], 2: bar[2] }; },
    get off() { return { 1: off[1], 2: off[2] }; },
    get turn() { return turn; },
    get phase() { return phase; },
    get dice() { return dice.slice(); },
    get selected() { return selected; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get mode() { return mode; },
    get movesThisGame() { return movesThisGame; },
    getP,
    setP,
    dist,
    blocked,
    allInHome,
    maxDist,
    canBearOff,
    legalMoves,
    legalTurnMoves,
    anyMoveExists,
    hasMoveFrom,
    findMoveTo,
    uniqueDice,
    applyMove,
    onPointClick,
    onBarClick,
    onTrayClick,
    rollDice,
    roll,
    endTurn,
    cpuPlayTurn,
    bestMove,
    scoreMove,
    endGame,
    newGame,
    setPaused,
    togglePause,
    setMode: (m) => { mode = m === "2p" ? "2p" : "cpu"; syncModeChips(); newGame(false); },
    setTurn: (t) => { turn = t; render(); updateStatus(); },
    setDice: (d) => { dice = d.slice(); phase = "move"; render(); updateStatus(); },
    setPoints: (arr) => {
      points = Array.from({ length: 25 }, () => ({ w: 0, b: 0 }));
      for (const [p, w, b] of arr) { points[p].w = w; points[p].b = b; }
      render();
      updateStatus();
    },
    setBar: (w, b) => { bar = { 1: w, 2: b }; render(); updateStatus(); },
    setOff: (w, b) => { off = { 1: w, 2: b }; updateStatus(); },
    setSeed: (n) => { rngState = n >>> 0; },
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
