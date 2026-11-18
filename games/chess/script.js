// Chess — pure vanilla JS, fully offline. Full rules + alpha-beta AI.
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
  const boardEl = dom.byId("board");
  const statusEl = dom.byId("status");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const levelSel = dom.byId("level");
  const newGameBtn = dom.byId("new-game");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  const K = makeKeys("chess");

  // ---------- Constants ----------
  const GLYPH = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const KNIGHTS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  const AI_DELAY = 60;

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    moves: 0,
    captures: 0,
    promotions: 0,
    bestMoves: 0,
    easyWins: 0,
    normalWins: 0,
    hardWins: 0,
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
    const raw = store.get("chess-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("chess-wins");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  // "Lower is better" win badges: counted in player moves.
  function quickBadge(id, icon, name, desc, limit) {
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestMoves",
      goal: limit,
      satisfied: () => (stats.bestMoves || 0) > 0 && stats.bestMoves <= limit,
      progress: () => {
        const best = stats.bestMoves || 0;
        if (!best) return { pct: 0, text: "No win yet" };
        if (best <= limit) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (limit / best) * 100), text: `Best ${best} moves` };
      },
    };
  }

  const ACHIEVEMENTS = [
    { id: "first", icon: "♟️", name: "First Mate", desc: "Win your first game.", stat: "wins", goal: 1 },
    { id: "win3", icon: "♞", name: "Club Player", desc: "Win 3 games.", stat: "wins", goal: 3 },
    { id: "win5", icon: "♝", name: "Tactician", desc: "Win 5 games.", stat: "wins", goal: 5 },
    { id: "win10", icon: "♛", name: "Chess Master", desc: "Win 10 games.", stat: "wins", goal: 10 },
    { id: "games10", icon: "🎮", name: "Ten Boards", desc: "Play 10 games.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Veteran", desc: "Play 25 games.", stat: "games", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Winning Run", desc: "Win 2 games in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🚀", name: "Hat Trick", desc: "Win 3 games in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🌟", name: "Unbeaten", desc: "Win 5 games in a row.", stat: "bestStreak", goal: 5 },
    { id: "moves50", icon: "🕰️", name: "Long Game", desc: "Make 50 moves.", stat: "moves", goal: 50 },
    { id: "captures25", icon: "⚔️", name: "Predator", desc: "Capture 25 enemy pieces.", stat: "captures", goal: 25 },
    { id: "promote1", icon: "👑", name: "Coronation", desc: "Promote a pawn.", stat: "promotions", goal: 1 },
    quickBadge("quick40", "🎖️", "Swift Mate", "Win in 40 moves or fewer.", 40),
    quickBadge("quick25", "⚡", "Blitz Finish", "Win in 25 moves or fewer.", 25),
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
        ["Losses", stats.losses],
        ["Draws", stats.draws],
        ["Best streak", stats.bestStreak],
        ["Moves", stats.moves],
        ["Captures", stats.captures],
        ["Best win", stats.bestMoves ? `${stats.bestMoves} moves` : "—"],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) setPaused(true);
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
  audio.define("move", [[360, 0, 0.05, "triangle", 0.03]]);
  audio.define("capture", [[300, 0, 0.05, "square", 0.04], [200, 0.05, 0.09, "square", 0.04]]);
  audio.define("check", [[640, 0, 0.08, "triangle", 0.045], [520, 0.08, 0.1, "triangle", 0.04]]);
  audio.define("castle", [[300, 0, 0.06, "triangle", 0.03], [380, 0.06, 0.08, "triangle", 0.03]]);

  // ---------- Game state ----------
  let board;
  let state;
  let turn;
  let selected;
  let targets;
  let gameOver;
  let thinking;
  let paused;
  let depth;
  let gameLevel;
  let movesThisGame;
  let aiTimer = 0;

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const opp = (color) => (color === "w" ? "b" : "w");

  function cloneBoard(b) {
    return b.map((row) => row.slice());
  }
  function cloneState(s) {
    return { wK: s.wK, wQ: s.wQ, bK: s.bK, bQ: s.bQ, ep: s.ep };
  }
  function emptyBoard() {
    return Array.from({ length: 8 }, () => new Array(8).fill(null));
  }

  function initialState() {
    return { wK: true, wQ: true, bK: true, bQ: true, ep: null };
  }

  function setupPieces() {
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    board = emptyBoard();
    for (let c = 0; c < 8; c++) {
      board[7][c] = { t: back[c], c: "w" };
      board[6][c] = { t: "p", c: "w" };
      board[0][c] = { t: back[c], c: "b" };
      board[1][c] = { t: "p", c: "b" };
    }
  }

  // ---- Attack detection ----
  function isAttacked(b, r, c, by) {
    const pDir = by === "w" ? 1 : -1; // white pawns come from row+1
    for (const dc of [-1, 1]) {
      const pr = r + pDir;
      const pc = c + dc;
      if (inBounds(pr, pc) && b[pr][pc] && b[pr][pc].t === "p" && b[pr][pc].c === by) return true;
    }
    for (const [dr, dc] of KNIGHTS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].t === "n" && b[nr][nc].c === by) return true;
    }
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].t === "k" && b[nr][nc].c === by) return true;
    }
    for (const [dr, dc] of DIRS) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = b[nr][nc];
        if (p) {
          if ((p.t === "b" || p.t === "q") && p.c === by) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = b[nr][nc];
        if (p) {
          if ((p.t === "r" || p.t === "q") && p.c === by) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return false;
  }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c] && b[r][c].t === "k" && b[r][c].c === color) return [r, c];
      }
    }
    return null;
  }

  function inCheck(b, color) {
    const k = findKing(b, color);
    return !!(k && isAttacked(b, k[0], k[1], opp(color)));
  }

  // ---- Move generation ----
  function genPseudo(b, color, st) {
    const moves = [];
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || p.c !== color) continue;

        if (p.t === "p") {
          const oneR = r + dir;
          if (inBounds(oneR, c) && !b[oneR][c]) {
            if (oneR === promoRow) {
              moves.push({ fr: r, fc: c, tr: oneR, tc: c, type: "promo", promo: "q" });
            } else {
              moves.push({ fr: r, fc: c, tr: oneR, tc: c, type: "normal" });
            }
            const twoR = r + dir * 2;
            if (r === startRow && !b[twoR][c]) {
              moves.push({ fr: r, fc: c, tr: twoR, tc: c, type: "double" });
            }
          }
          for (const dc of [-1, 1]) {
            const nr = r + dir;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            const isEp = st.ep && st.ep[0] === nr && st.ep[1] === nc;
            if (t && t.c !== color) {
              if (nr === promoRow) {
                moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "promo", promo: "q" });
              } else {
                moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "capture" });
              }
            } else if (isEp) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "ep" });
            }
          }
        } else if (p.t === "n") {
          for (const [dr, dc] of KNIGHTS) {
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.c !== color) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: t ? "capture" : "normal" });
            }
          }
        } else if (p.t === "k") {
          for (const [dr, dc] of DIRS) {
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.c !== color) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: t ? "capture" : "normal" });
            }
          }
          const row = color === "w" ? 7 : 0;
          if (r === row && c === 4 && !inCheck(b, color)) {
            if (
              st[color + "K"] &&
              b[row][5] === null &&
              b[row][6] === null &&
              b[row][7] &&
              b[row][7].t === "r" &&
              b[row][7].c === color
            ) {
              if (!isAttacked(b, row, 5, opp(color)) && !isAttacked(b, row, 6, opp(color))) {
                moves.push({ fr: r, fc: c, tr: row, tc: 6, type: "castleK" });
              }
            }
            if (
              st[color + "Q"] &&
              b[row][1] === null &&
              b[row][2] === null &&
              b[row][3] === null &&
              b[row][0] &&
              b[row][0].t === "r" &&
              b[row][0].c === color
            ) {
              if (!isAttacked(b, row, 3, opp(color)) && !isAttacked(b, row, 2, opp(color))) {
                moves.push({ fr: r, fc: c, tr: row, tc: 2, type: "castleQ" });
              }
            }
          }
        } else {
          const steps =
            p.t === "b"
              ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
              : p.t === "r"
                ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
                : DIRS;
          for (const [dr, dc] of steps) {
            let nr = r + dr;
            let nc = c + dc;
            while (inBounds(nr, nc)) {
              const t = b[nr][nc];
              if (!t) {
                moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "normal" });
              } else {
                if (t.c !== color) {
                  moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: "capture" });
                }
                break;
              }
              nr += dr;
              nc += dc;
            }
          }
        }
      }
    }
    return moves;
  }

  function applyFull(b, st, m) {
    const p = b[m.fr][m.fc];
    st.ep = p.t === "p" && Math.abs(m.tr - m.fr) === 2 ? [(m.fr + m.tr) / 2, m.fc] : null;

    if (m.type === "double") {
      b[m.tr][m.tc] = p;
      b[m.fr][m.fc] = null;
    } else if (m.type === "ep") {
      b[m.tr][m.tc] = p;
      b[m.fr][m.fc] = null;
      b[m.fr][m.tc] = null;
    } else if (m.type === "castleK") {
      b[m.tr][m.tc] = p;
      b[m.fr][m.fc] = null;
      b[m.tr][5] = b[m.fr][7];
      b[m.fr][7] = null;
    } else if (m.type === "castleQ") {
      b[m.tr][m.tc] = p;
      b[m.fr][m.fc] = null;
      b[m.tr][3] = b[m.fr][0];
      b[m.fr][0] = null;
    } else if (m.type === "promo") {
      b[m.tr][m.tc] = { t: m.promo || "q", c: p.c };
      b[m.fr][m.fc] = null;
    } else {
      b[m.tr][m.tc] = p;
      b[m.fr][m.fc] = null;
    }

    if (p.t === "k") {
      if (p.c === "w") {
        st.wK = st.wQ = false;
      } else {
        st.bK = st.bQ = false;
      }
    }
    const rookSq = { "7,0": "wQ", "7,7": "wK", "0,0": "bQ", "0,7": "bK" };
    if (rookSq[m.fr + "," + m.fc]) st[rookSq[m.fr + "," + m.fc]] = false;
    if (rookSq[m.tr + "," + m.tc]) st[rookSq[m.tr + "," + m.tc]] = false;
  }

  function legalMoves(b, color, st) {
    const out = [];
    for (const m of genPseudo(b, color, st)) {
      const nb = cloneBoard(b);
      const ns = cloneState(st);
      applyFull(nb, ns, m);
      if (!inCheck(nb, color)) out.push(m);
    }
    return out;
  }

  // ---- AI: negamax + alpha-beta ----
  function evalColor(b, color) {
    let s = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        s += VAL[p.t] * (p.c === color ? 1 : -1);
      }
    }
    return s;
  }

  function negamax(b, st, d, alpha, beta, color) {
    const moves = legalMoves(b, color, st);
    if (moves.length === 0) return inCheck(b, color) ? -(99000 - (depth - d)) : 0;
    if (d === 0) return evalColor(b, color);

    moves.sort(
      (a, cc) =>
        (a.type === "capture" || a.type === "promo" ? 1 : 0) -
        (cc.type === "capture" || cc.type === "promo" ? 1 : 0)
    );

    let best = -Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      const ns = cloneState(st);
      applyFull(nb, ns, m);
      const score = negamax(nb, ns, d - 1, -beta, -alpha, opp(color));
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function getBestMove() {
    const moves = legalMoves(board, "b", state);
    if (!moves.length) return null;
    moves.sort(
      (a, c) =>
        (a.type === "capture" || a.type === "promo" ? 1 : 0) -
        (c.type === "capture" || c.type === "promo" ? 1 : 0)
    );
    let best = -Infinity;
    let picks = [];
    for (const m of moves) {
      const nb = cloneBoard(board);
      const ns = cloneState(state);
      applyFull(nb, ns, m);
      const s = negamax(nb, ns, depth - 1, -Infinity, Infinity, "w");
      if (s > best) {
        best = s;
        picks = [m];
      } else if (s === best) {
        picks.push(m);
      }
    }
    return picks[Math.floor(Math.random() * picks.length)];
  }

  // ---- Rendering ----
  function render() {
    boardEl.innerHTML = "";
    const kingInCheck = inCheck(board, turn) ? findKing(board, turn) : null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("button");
        const dark = (r + c) % 2 === 1;
        cell.className = "cell chess-cell " + (dark ? "chess-cell--dark" : "chess-cell--light");
        cell.type = "button";
        cell.style.width = "100%";
        cell.style.aspectRatio = "1";

        const p = board[r][c];
        if (p) {
          cell.classList.add("chess-cell--piece", "chess-cell--" + p.c);
          if (p.t === "k" || p.t === "q") cell.classList.add("chess-cell--royal");
          cell.textContent = GLYPH[p.c][p.t];
        }

        let shadow = "";
        if (selected && selected.r === r && selected.c === c) {
          shadow = "inset 0 0 0 3px var(--accent-2), inset 0 0 18px rgba(255, 217, 77, 0.45)";
        }
        const isTarget = targets.some((t) => t.tr === r && t.tc === c);
        if (isTarget) {
          cell.classList.add("chess-cell--target");
          if (p) cell.classList.add("chess-cell--capture");
          shadow += (shadow ? ", " : "") + "inset 0 0 0 3px var(--accent)";
        }
        if (kingInCheck && kingInCheck[0] === r && kingInCheck[1] === c) {
          cell.classList.add("chess-cell--check");
          shadow += (shadow ? ", " : "") + "inset 0 0 0 3px #ff5a5a, inset 0 0 22px rgba(255, 70, 70, 0.8)";
        }
        if (shadow) cell.style.boxShadow = shadow;

        const label = `Row ${r + 1}, column ${c + 1}, ${p ? (p.c === "w" ? "white " : "black ") + p.t : "empty"}`;
        cell.setAttribute("aria-label", label);
        cell.addEventListener("click", () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function setStatus(t) {
    statusEl.textContent = t;
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  // ---- Interaction ----
  function onCellClick(r, c) {
    if (gameOver || thinking || paused || turn !== "w") return false;
    const p = board[r][c];
    if (selected) {
      const move = targets.find((t) => t.tr === r && t.tc === c);
      if (move) {
        doPlayerMove(move);
        return true;
      }
    }
    if (p && p.c === "w") {
      selected = { r, c };
      targets = legalMoves(board, "w", state).filter((m) => m.fr === r && m.fc === c);
    } else {
      selected = null;
      targets = [];
    }
    render();
    sfx("select");
    return true;
  }

  function doPlayerMove(move) {
    const captured = !!board[move.tr][move.tc] || move.type === "ep";
    applyFull(board, state, move);
    selected = null;
    targets = [];
    movesThisGame++;
    stats.moves++;
    if (captured) stats.captures++;
    if (move.type === "promo") stats.promotions++;
    saveStats();
    checkAchievements();
    if (move.type === "promo") sfx("castle");
    else if (captured) sfx("capture");
    else sfx("move");
    turn = "b";
    afterMove();
    return true;
  }

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
    aiTimer = setTimeout(aiGo, AI_DELAY);
  }

  // Conservative dead-position detection (FIDE 5.2.2). Only material that can
  // never produce mate is covered: K vs K, K+B/N vs K, and bishop-only
  // positions where every bishop sits on one square colour. Pawns, rooks,
  // queens and mixed minor pieces always keep the game alive.
  function isDeadPosition(b) {
    let kings = 0;
    const minors = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r] && b[r][c];
        if (!p) continue;
        if (p.t === "k") {
          kings++;
          continue;
        }
        if (p.t === "p" || p.t === "r" || p.t === "q") return false;
        minors.push({ t: p.t, square: (r + c) % 2 });
      }
    }
    if (kings !== 2) return false;
    if (minors.length === 0) return true; // king versus king
    if (minors.length === 1) return true; // one bishop or knight is not enough
    if (minors.every((m) => m.t === "b")) {
      // Same-coloured bishops cannot mate; differing colours leave a mate
      // sequence theoretically possible, so those stay active.
      return minors.every((m) => m.square === minors[0].square);
    }
    return false;
  }

  function afterMove() {
    render();
    if (paused) return;
    if (isDeadPosition(board)) return endOfGame("b", "dead");
    const blackMoves = legalMoves(board, "b", state);
    if (blackMoves.length === 0) {
      endOfGame("b");
      return;
    }
    thinking = true;
    setStatus("Thinking…");
    armAiTimer();
  }

  function aiGo() {
    aiTimer = 0;
    if (gameOver || paused) return false;
    thinking = true;
    const m = getBestMove();
    if (m) {
      const captured = !!board[m.tr][m.tc] || m.type === "ep";
      applyFull(board, state, m);
      if (captured) sfx("capture");
      else sfx("move");
    }
    turn = "w";
    thinking = false;
    render();
    if (isDeadPosition(board)) return endOfGame("w", "dead");
    const whiteMoves = legalMoves(board, "w", state);
    if (whiteMoves.length === 0) return endOfGame("w");
    if (inCheck(board, "w")) {
      setStatus("Check! Your move");
      sfx("check");
    } else {
      setStatus("Your move");
    }
    return true;
  }

  function endOfGame(loserColor, reason) {
    if (gameOver) return false;
    gameOver = true;
    thinking = false;
    clearAiTimer();
    selected = null;
    targets = [];

    const mate = reason !== "dead" && inCheck(board, loserColor);
    let result = "draw";
    let isRecord = false;

    if (mate && loserColor === "b") {
      result = "win";
      stats.wins++;
      stats.streak++;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (gameLevel === 2) stats.easyWins++;
      else if (gameLevel === 4) stats.hardWins++;
      else stats.normalWins++;
      if (movesThisGame > 0 && (!stats.bestMoves || movesThisGame < stats.bestMoves)) {
        stats.bestMoves = movesThisGame;
        isRecord = true;
      }
    } else if (mate) {
      result = "loss";
      stats.losses++;
      stats.streak = 0;
    } else {
      result = "draw";
      stats.draws++;
      stats.streak = 0;
    }

    saveStats();
    checkAchievements();
    updateStatus();
    render();

    if (result === "win") {
      setStatus("Checkmate — you win! 🎉");
      sfx("win");
      confetti(isRecord ? 90 : 60);
      showOverlay(
        "Checkmate! 🎉",
        `You beat the ${levelName(gameLevel)} computer in ${movesThisGame} move${movesThisGame === 1 ? "" : "s"}.` +
          (isRecord ? " New best!" : ""),
        [
          { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else if (result === "loss") {
      setStatus("Checkmate — you lose");
      sfx("over");
      showOverlay(
        "Checkmate 🤖",
        "The computer got you this time. Try a lower level or take another run.",
        [
          { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
          { label: "Badges", ghost: true, onClick: () => openAchv() },
        ]
      );
    } else if (reason === "dead") {
      setStatus("Dead position — draw");
      sfx("tick");
      showOverlay("Dead position 🤝", "Neither side has enough material to checkmate — the game is a draw.", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      setStatus("Stalemate — draw");
      sfx("tick");
      showOverlay("Stalemate 🤝", "No legal moves left — the game is a draw.", [
        { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    }
    return result;
  }

  function levelName(n) {
    return n === 2 ? "Easy" : n === 4 ? "Hard" : "Normal";
  }

  // ---- Pause ----
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return false;
    paused = p;
    if (p) {
      clearAiTimer();
      showOverlay("Paused", "The board is on hold — press Esc or P to resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
    } else {
      hideOverlay();
      if (thinking && !gameOver) armAiTimer();
    }
    render();
    return true;
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---- Game lifecycle ----
  function newGame() {
    clearAiTimer();
    setupPieces();
    state = initialState();
    turn = "w";
    selected = null;
    targets = [];
    gameOver = false;
    thinking = false;
    paused = false;
    movesThisGame = 0;
    gameLevel = depth;
    stats.games++;
    saveStats();
    checkAchievements();
    hideOverlay();
    render();
    updateStatus();
    setStatus("Your move");
    return true;
  }

  // ---- Input ----
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

    newGameBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newGame();
    });
    if (levelSel)
      levelSel.addEventListener("change", () => {
        depth = Number(levelSel.value) || 3;
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

  // ---- Init ----
  function init() {
    depth = Number(levelSel && levelSel.value) || 3;
    gameLevel = depth;
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  function parsePiece(code) {
    const s = String(code || "");
    const color = s[0] === "w" ? "w" : "b";
    const t = (s[1] || "p").toLowerCase();
    return { t, c: color };
  }

  window.__CHESS = {
    ACHIEVEMENTS,
    stats,
    GLYPH,
    VAL,
    get board() {
      return cloneBoard(board);
    },
    get state() {
      return cloneState(state);
    },
    get turn() {
      return turn;
    },
    get selected() {
      return selected ? { r: selected.r, c: selected.c } : null;
    },
    get targets() {
      return targets.map((t) => ({ fr: t.fr, fc: t.fc, tr: t.tr, tc: t.tc, type: t.type }));
    },
    get gameOver() {
      return gameOver;
    },
    get thinking() {
      return thinking;
    },
    get paused() {
      return paused;
    },
    get level() {
      return depth;
    },
    get gameLevel() {
      return gameLevel;
    },
    get movesThisGame() {
      return movesThisGame;
    },
    pieceAt: (r, c) => (board[r] && board[r][c] ? { t: board[r][c].t, c: board[r][c].c } : null),
    snap: () => ({
      board: cloneBoard(board),
      state: cloneState(state),
      turn,
      selected: selected ? { r: selected.r, c: selected.c } : null,
      targets: targets.map((t) => ({ fr: t.fr, fc: t.fc, tr: t.tr, tc: t.tc, type: t.type })),
      gameOver,
      thinking,
      paused,
      level: depth,
      gameLevel,
      movesThisGame,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      status: statusEl.textContent,
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    click: onCellClick,
    select: onCellClick,
    legalMoves: (color) => legalMoves(board, color || turn, state),
    isDeadPosition: (b) => isDeadPosition(b || board),
    inCheck: (color) => inCheck(board, color || turn),
    aiMove: aiGo,
    newGame,
    reset: newGame,
    setLevel(n) {
      depth = Number(n) || 3;
      if (levelSel) levelSel.value = String(depth);
      return depth;
    },
    setPosition(spec) {
      const s = spec || {};
      clearAiTimer();
      board = emptyBoard();
      const pieces = s.pieces || {};
      for (const k of Object.keys(pieces)) {
        const p = k.split(",").map(Number);
        if (inBounds(p[0], p[1])) board[p[0]][p[1]] = parsePiece(pieces[k]);
      }
      state = Object.assign(initialState(), s.state || {});
      turn = s.turn === "b" ? "b" : "w";
      selected = null;
      targets = [];
      gameOver = false;
      thinking = false;
      paused = false;
      movesThisGame = 0;
      gameLevel = Number(s.level) || depth;
      stats.games++;
      saveStats();
      checkAchievements();
      hideOverlay();
      render();
      updateStatus();
      setStatus(turn === "w" ? "Your move" : "Thinking…");
      return true;
    },
    endOfGame,
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
