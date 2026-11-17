// Yahtzee — pure vanilla JS, fully offline. Single player, 13 turns, beat your best.
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
  const turnEl = dom.byId("turn");
  const bestEl = dom.byId("best");
  const gamesEl = dom.byId("games");
  const diceRowEl = dom.byId("dice-row");
  const rollBtn = dom.byId("roll");
  const newGameBtn = dom.byId("new-game");
  const sheetBody = dom.byId("sheet-body");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  toast.bind(dom.byId("toasts"));

  const GLYPHS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const TOTAL_TURNS = 13;
  const UPPER_BONUS = 35;
  const UPPER_TARGET = 63;

  const K = makeKeys("yahtzee");

  // ---------- Scoring helpers ----------
  const sum = (dice) => dice.reduce((a, b) => a + b, 0);
  const countOf = (dice, face) => dice.filter((d) => d === face).length;
  const maxCount = (dice) => Math.max(...[1, 2, 3, 4, 5, 6].map((f) => countOf(dice, f)));
  const upperSum = (dice, face) => dice.filter((d) => d === face).reduce((a, b) => a + b, 0);
  const hasRun = (dice, length) => {
    const uniq = new Set(dice);
    for (let start = 1; start <= 7 - length; start++) {
      let run = true;
      for (let f = start; f < start + length; f++) {
        if (!uniq.has(f)) {
          run = false;
          break;
        }
      }
      if (run) return true;
    }
    return false;
  };

  // Category definitions: order here is the order on the sheet.
  const CATEGORIES = [
    { key: "aces", label: "Aces", section: "upper", score: (d) => upperSum(d, 1) },
    { key: "twos", label: "Twos", section: "upper", score: (d) => upperSum(d, 2) },
    { key: "threes", label: "Threes", section: "upper", score: (d) => upperSum(d, 3) },
    { key: "fours", label: "Fours", section: "upper", score: (d) => upperSum(d, 4) },
    { key: "fives", label: "Fives", section: "upper", score: (d) => upperSum(d, 5) },
    { key: "sixes", label: "Sixes", section: "upper", score: (d) => upperSum(d, 6) },
    {
      key: "threeKind",
      label: "3 of a Kind",
      section: "lower",
      score: (d) => (maxCount(d) >= 3 ? sum(d) : 0),
    },
    {
      key: "fourKind",
      label: "4 of a Kind",
      section: "lower",
      score: (d) => (maxCount(d) >= 4 ? sum(d) : 0),
    },
    {
      key: "fullHouse",
      label: "Full House",
      section: "lower",
      score: (d) => {
        const c = [1, 2, 3, 4, 5, 6].map((f) => countOf(d, f));
        return c.includes(3) && c.includes(2) ? 25 : 0;
      },
    },
    {
      key: "smallStraight",
      label: "Small Straight",
      section: "lower",
      score: (d) => (hasRun(d, 4) ? 30 : 0),
    },
    {
      key: "largeStraight",
      label: "Large Straight",
      section: "lower",
      score: (d) => (hasRun(d, 5) ? 40 : 0),
    },
    {
      key: "yahtzee",
      label: "Yahtzee",
      section: "lower",
      score: (d) => (maxCount(d) === 5 ? 50 : 0),
    },
    { key: "chance", label: "Chance", section: "lower", score: (d) => sum(d) },
  ];

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    best: 0,
    total: 0,
    yahtzees: 0,
    upperBonuses: 0,
    fullHouses: 0,
    largeStraights: 0,
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

  // Carry the pre-core best score across.
  function migrateLegacy() {
    const raw = store.get("yahtzee-best", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.best) stats.best = n;
      store.remove("yahtzee-best");
      saveStats();
    }
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎲", name: "First Game", desc: "Finish a full score sheet.", stat: "games", goal: 1 },
    { id: "games5", icon: "🎯", name: "Regular", desc: "Finish 5 games.", stat: "games", goal: 5 },
    { id: "games10", icon: "👑", name: "Devoted", desc: "Finish 10 games.", stat: "games", goal: 10 },
    { id: "best150", icon: "📈", name: "Breaking Even", desc: "Score 150 in a game.", stat: "best", goal: 150 },
    { id: "best200", icon: "🏆", name: "High Scorer", desc: "Score 200 in a game.", stat: "best", goal: 200 },
    { id: "best250", icon: "🚀", name: "Sky High", desc: "Score 250 in a game.", stat: "best", goal: 250 },
    { id: "highroll", icon: "🌟", name: "High Roller", desc: "Score 300 in a game.", stat: "best", goal: 300 },
    { id: "yahtzee1", icon: "🎉", name: "Yahtzee!", desc: "Score a Yahtzee.", stat: "yahtzees", goal: 1 },
    { id: "yahtzee3", icon: "✨", name: "Lightning in a Bottle", desc: "Score 3 Yahtzees in total.", stat: "yahtzees", goal: 3 },
    { id: "bonus1", icon: "🎁", name: "Top Half", desc: "Earn the upper-section bonus.", stat: "upperBonuses", goal: 1 },
    { id: "bonus3", icon: "🎩", name: "Upper Class", desc: "Earn the upper bonus 3 times.", stat: "upperBonuses", goal: 3 },
    { id: "fullhouse", icon: "🏠", name: "Full House", desc: "Score a Full House.", stat: "fullHouses", goal: 1 },
    { id: "straight", icon: "🏁", name: "Straight Shooter", desc: "Score a Large Straight.", stat: "largeStraights", goal: 1 },
    { id: "career1000", icon: "💯", name: "Thousand Club", desc: "Score 1,000 points in total.", stat: "total", goal: 1000 },
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
        ["Best", stats.best],
        ["Total points", stats.total],
        ["Yahtzees", stats.yahtzees],
        ["Upper bonuses", stats.upperBonuses],
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

  audio.bindButton({ btn: soundBtn, icon: soundIconEl, soundKey: K.sound });

  // ---------- State ----------
  let dice;
  let held;
  let rollsLeft;
  let turn;
  let scores;
  let finished;
  let paused = false;

  let dieEls = [];
  let holdTagEls = [];
  const scoreBtns = {};
  let bonusRowValue;
  let totalRowValue;
  let upperProgressValue;

  // ---------- Build DOM (dice + score sheet) ----------
  function buildDice() {
    diceRowEl.innerHTML = "";
    dieEls = [];
    holdTagEls = [];
    for (let i = 0; i < 5; i++) {
      const col = document.createElement("div");
      col.className = "die-col";

      const die = document.createElement("button");
      die.className = "die die--empty";
      die.textContent = "–";
      die.setAttribute("aria-label", "Die " + (i + 1));
      die.addEventListener("click", () => toggleHold(i));

      const tag = document.createElement("div");
      tag.className = "hold-tag";
      tag.textContent = "";

      col.appendChild(die);
      col.appendChild(tag);
      diceRowEl.appendChild(col);
      dieEls.push(die);
      holdTagEls.push(tag);
    }
  }

  function sheetRow() {
    const tr = document.createElement("tr");
    const left = document.createElement("td");
    const right = document.createElement("td");
    right.style.textAlign = "right";
    tr.appendChild(left);
    tr.appendChild(right);
    return { tr, left, right };
  }

  function buildSheet() {
    sheetBody.innerHTML = "";
    for (const key of Object.keys(scoreBtns)) delete scoreBtns[key];
    let currentSection = null;
    for (const cat of CATEGORIES) {
      if (cat.section !== currentSection) {
        currentSection = cat.section;
        const { tr, left } = sheetRow();
        tr.className = "sheet-section";
        left.setAttribute("colspan", "2");
        left.textContent = currentSection === "upper" ? "Upper Section" : "Lower Section";
        sheetBody.appendChild(tr);
      }

      const { tr, left, right } = sheetRow();
      left.textContent = cat.label;

      const btn = document.createElement("button");
      btn.className = "score-btn";
      btn.textContent = "–";
      btn.disabled = true;
      btn.addEventListener("click", () => scoreCategory(cat.key));
      right.appendChild(btn);
      sheetBody.appendChild(tr);
      scoreBtns[cat.key] = btn;

      // Upper bonus progress row right after the Sixes row.
      if (cat.key === "sixes") {
        const bonusRow = sheetRow();
        bonusRow.left.textContent = `Upper bonus (${UPPER_TARGET}+ → ${UPPER_BONUS})`;
        upperProgressValue = document.createElement("span");
        upperProgressValue.textContent = `0/${UPPER_TARGET}`;
        bonusRowValue = document.createElement("span");
        bonusRowValue.style.marginLeft = "8px";
        bonusRow.right.appendChild(upperProgressValue);
        bonusRow.right.appendChild(bonusRowValue);
        sheetBody.appendChild(bonusRow.tr);
      }
    }

    const totalRow = sheetRow();
    totalRow.tr.className = "sheet-total";
    totalRow.left.textContent = "Total";
    totalRowValue = document.createElement("span");
    totalRowValue.className = "sheet-total__value";
    totalRowValue.textContent = "0";
    totalRow.right.appendChild(totalRowValue);
    sheetBody.appendChild(totalRow.tr);
  }

  // ---------- Render / update ----------
  const hasRolled = () => dice[0] !== 0;
  const randFace = () => 1 + Math.floor(Math.random() * 6);

  function renderDice() {
    for (let i = 0; i < 5; i++) {
      const die = dieEls[i];
      if (dice[i] === 0) {
        die.textContent = "–";
        die.classList.add("die--empty");
        die.disabled = true;
        die.classList.remove("held");
        holdTagEls[i].textContent = "";
      } else {
        die.textContent = GLYPHS[dice[i]];
        die.classList.remove("die--empty");
        die.disabled = false;
        die.classList.toggle("held", held[i]);
        holdTagEls[i].textContent = held[i] ? "Hold" : "";
      }
    }
  }

  function upperSectionTotal() {
    return CATEGORIES.filter((c) => c.section === "upper").reduce(
      (acc, c) => acc + (scores[c.key] ?? 0),
      0
    );
  }

  function currentTotal() {
    const catSum = Object.values(scores).reduce((a, v) => a + (v ?? 0), 0);
    return catSum + (upperSectionTotal() >= UPPER_TARGET ? UPPER_BONUS : 0);
  }

  function updateSheet() {
    const rolled = hasRolled();
    for (const cat of CATEGORIES) {
      const btn = scoreBtns[cat.key];
      if (scores[cat.key] !== null && scores[cat.key] !== undefined) {
        btn.textContent = scores[cat.key];
        btn.disabled = true;
        btn.classList.add("scored");
      } else {
        btn.textContent = rolled ? cat.score(dice) : "–";
        btn.disabled = !rolled || finished || paused;
        btn.classList.remove("scored");
      }
    }
    const upper = upperSectionTotal();
    upperProgressValue.textContent = `${upper}/${UPPER_TARGET}`;
    if (upper >= UPPER_TARGET) {
      bonusRowValue.textContent = `+${UPPER_BONUS}`;
      bonusRowValue.className = "bonus-earned";
    } else {
      bonusRowValue.textContent = "";
      bonusRowValue.className = "";
    }
    totalRowValue.textContent = currentTotal();
  }

  function updateControls() {
    turnEl.textContent = Math.min(turn, TOTAL_TURNS);
    if (finished) {
      rollBtn.textContent = "Game over";
      rollBtn.disabled = true;
    } else if (paused) {
      rollBtn.textContent = "Paused";
      rollBtn.disabled = true;
    } else if (rollsLeft <= 0) {
      rollBtn.textContent = "No rolls left";
      rollBtn.disabled = true;
    } else {
      rollBtn.textContent = `Roll (${rollsLeft} left)`;
      rollBtn.disabled = false;
    }
    bestEl.textContent = stats.best;
    gamesEl.textContent = stats.games;
  }

  // ---------- Game flow ----------
  function toggleHold(i) {
    if (finished || paused || !hasRolled()) return;
    held[i] = !held[i];
    sfx("select");
    renderDice();
  }

  function roll() {
    if (finished || paused || rollsLeft <= 0) return;
    for (let i = 0; i < 5; i++) {
      if (!held[i]) dice[i] = randFace();
    }
    rollsLeft--;
    sfx("flip");
    renderDice();
    updateSheet();
    updateControls();
  }

  function scoreCategory(key) {
    if (finished || paused || !hasRolled()) return;
    if (scores[key] !== null && scores[key] !== undefined) return;
    const cat = CATEGORIES.find((c) => c.key === key);
    const points = cat.score(dice);
    scores[key] = points;

    if (key === "yahtzee" && points === 50) stats.yahtzees++;
    if (key === "fullHouse" && points === 25) stats.fullHouses++;
    if (key === "largeStraight" && points === 40) stats.largeStraights++;
    saveStats();
    checkAchievements();

    if (points >= 40) sfx("combo");
    else sfx("place");

    if (turn >= TOTAL_TURNS) {
      finishGame();
    } else {
      turn++;
      resetTurn();
    }
  }

  function resetTurn() {
    dice = [0, 0, 0, 0, 0];
    held = [false, false, false, false, false];
    rollsLeft = 3;
    renderDice();
    updateSheet();
    updateControls();
  }

  function finishGame() {
    finished = true;
    const bonus = upperSectionTotal() >= UPPER_TARGET;
    const total = currentTotal();
    const isNewBest = total > stats.best;

    stats.games++;
    stats.total += total;
    if (bonus) stats.upperBonuses++;
    if (isNewBest) stats.best = total;
    saveStats();
    checkAchievements();
    updateSheet();
    updateControls();

    if (isNewBest) {
      sfx("win");
      confetti(110);
    } else {
      sfx("over");
    }

    showOverlay(
      isNewBest ? "New Best! 🎉" : "Game over",
      `Total: ${total}${bonus ? ` (includes ${UPPER_BONUS} upper bonus)` : ""}. Best: ${stats.best}.`,
      [
        {
          label: "Play Again",
          onClick: () => {
            hideOverlay();
            newGame();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function newGame() {
    hideOverlay();
    paused = false;
    turn = 1;
    scores = {};
    for (const cat of CATEGORIES) scores[cat.key] = null;
    finished = false;
    resetTurn();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (finished || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press P or Esc to resume.", [
        {
          label: "Resume",
          onClick: () => {
            hideOverlay();
            setPaused(false);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]);
      updateControls();
      updateSheet();
    } else {
      hideOverlay();
      updateControls();
      updateSheet();
    }
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
    const key = String(e.key || "");
    if (key === "p" || key === "P" || key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
    }
  }

  function bindEvents() {
    rollBtn.addEventListener("click", () => {
      audio.unlock();
      roll();
    });
    newGameBtn.addEventListener("click", () => {
      sfx("click");
      newGame();
    });

    badgesBtn.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });
    const badges2 = dom.byId("badges2");
    if (badges2) badges2.addEventListener("click", () => {
      sfx("click");
      openAchv();
    });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!finished && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !finished && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    buildDice();
    buildSheet();
    newGame();
    bindEvents();
    renderAchvGrid();
    checkAchievements();
    updateBadgeCount();
  }

  // Test hook — harmless in normal play.
  window.__YAHTZEE = {
    CATEGORIES,
    TOTAL_TURNS,
    UPPER_TARGET,
    UPPER_BONUS,
    get dice() {
      return dice.slice();
    },
    get held() {
      return held.slice();
    },
    get rollsLeft() {
      return rollsLeft;
    },
    get turn() {
      return turn;
    },
    get scores() {
      return Object.assign({}, scores);
    },
    get finished() {
      return finished;
    },
    get paused() {
      return paused;
    },
    stats,
    ACHIEVEMENTS,
    scoreBtns,
    roll,
    toggleHold,
    scoreCategory,
    setDice: (faces) => {
      dice = faces.slice(0, 5);
      while (dice.length < 5) dice.push(0);
      held = [false, false, false, false, false];
      renderDice();
      updateSheet();
      updateControls();
    },
    newGame,
    setPaused,
    togglePause,
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
