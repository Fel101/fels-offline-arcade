// Yahtzee — pure vanilla JS, fully offline. Single player, 13 turns, beat your best.
(() => {
  const turnEl = document.getElementById("turn");
  const bestEl = document.getElementById("best");
  const diceRowEl = document.getElementById("dice-row");
  const rollBtn = document.getElementById("roll");
  const newGameBtn = document.getElementById("new-game");
  const sheetBody = document.getElementById("sheet-body");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const GLYPHS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const TOTAL_TURNS = 13;
  const UPPER_BONUS = 35;
  const UPPER_TARGET = 63;

  // ---------- Scoring helpers ----------
  const sum = dice => dice.reduce((a, b) => a + b, 0);
  const countOf = (dice, face) => dice.filter(d => d === face).length;
  const maxCount = dice => Math.max(...[1, 2, 3, 4, 5, 6].map(f => countOf(dice, f)));
  const upperSum = (dice, face) => dice.filter(d => d === face).reduce((a, b) => a + b, 0);
  const hasRun = (dice, length) => {
    const uniq = new Set(dice);
    for (let start = 1; start <= 7 - length; start++) {
      let run = true;
      for (let f = start; f < start + length; f++) if (!uniq.has(f)) { run = false; break; }
      if (run) return true;
    }
    return false;
  };

  // Category definitions: order here is the order on the sheet.
  const CATEGORIES = [
    { key: "aces",   label: "Aces",   section: "upper", score: d => upperSum(d, 1) },
    { key: "twos",   label: "Twos",   section: "upper", score: d => upperSum(d, 2) },
    { key: "threes", label: "Threes", section: "upper", score: d => upperSum(d, 3) },
    { key: "fours",  label: "Fours",  section: "upper", score: d => upperSum(d, 4) },
    { key: "fives",  label: "Fives",  section: "upper", score: d => upperSum(d, 5) },
    { key: "sixes",  label: "Sixes",  section: "upper", score: d => upperSum(d, 6) },
    { key: "threeKind",    label: "3 of a Kind", section: "lower", score: d => maxCount(d) >= 3 ? sum(d) : 0 },
    { key: "fourKind",     label: "4 of a Kind", section: "lower", score: d => maxCount(d) >= 4 ? sum(d) : 0 },
    { key: "fullHouse",    label: "Full House",  section: "lower", score: d => { const c = [1,2,3,4,5,6].map(f => countOf(d, f)); return c.includes(3) && c.includes(2) ? 25 : 0; } },
    { key: "smallStraight", label: "Small Straight", section: "lower", score: d => hasRun(d, 4) ? 30 : 0 },
    { key: "largeStraight", label: "Large Straight", section: "lower", score: d => hasRun(d, 5) ? 40 : 0 },
    { key: "yahtzee",      label: "Yahtzee",     section: "lower", score: d => maxCount(d) === 5 ? 50 : 0 },
    { key: "chance",       label: "Chance",      section: "lower", score: d => sum(d) },
  ];

  // ---------- State ----------
  let dice, held, rollsLeft, turn, scores, best, finished;
  let dieEls = [], holdTagEls = [], scoreBtns = {};
  let bonusRowValue, totalRowValue, upperProgressValue;
  let overlay;

  best = store.get("yahtzee-best");
  bestEl.textContent = best;

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

  function buildSheet() {
    sheetBody.innerHTML = "";
    scoreBtns = {};
    let currentSection = null;
    for (const cat of CATEGORIES) {
      if (cat.section !== currentSection) {
        currentSection = cat.section;
        const tr = document.createElement("tr");
        tr.className = "sheet-section";
        tr.innerHTML = `<td colspan="2">${currentSection === "upper" ? "Upper Section" : "Lower Section"}</td>`;
        sheetBody.appendChild(tr);
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${cat.label}</td><td style="text-align:right;"></td>`;
      const btn = document.createElement("button");
      btn.className = "score-btn";
      btn.textContent = "–";
      btn.disabled = true;
      btn.addEventListener("click", () => scoreCategory(cat.key));
      tr.children[1].appendChild(btn);
      sheetBody.appendChild(tr);
      scoreBtns[cat.key] = btn;

      // Upper bonus progress row right after the Sixes row.
      if (cat.key === "sixes") {
        const bonusTr = document.createElement("tr");
        bonusTr.innerHTML = `<td>Upper bonus <span style="color:var(--muted)">(${UPPER_TARGET}+ → ${UPPER_BONUS})</span></td><td style="text-align:right;"></td>`;
        upperProgressValue = document.createElement("span");
        upperProgressValue.textContent = `0/${UPPER_TARGET}`;
        bonusRowValue = document.createElement("span");
        bonusRowValue.style.marginLeft = "8px";
        bonusTr.children[1].appendChild(upperProgressValue);
        bonusTr.children[1].appendChild(bonusRowValue);
        sheetBody.appendChild(bonusTr);
      }
    }
    const totalTr = document.createElement("tr");
    totalTr.className = "sheet-total";
    totalTr.innerHTML = `<td>Total</td><td style="text-align:right;"></td>`;
    totalRowValue = document.createElement("span");
    totalRowValue.className = "sheet-total__value";
    totalRowValue.textContent = "0";
    totalTr.children[1].appendChild(totalRowValue);
    sheetBody.appendChild(totalTr);
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
    return CATEGORIES.filter(c => c.section === "upper")
      .reduce((acc, c) => acc + (scores[c.key] ?? 0), 0);
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
        btn.disabled = !rolled || finished;
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
    } else if (rollsLeft <= 0) {
      rollBtn.textContent = "No rolls left";
      rollBtn.disabled = true;
    } else {
      rollBtn.textContent = `Roll (${rollsLeft} left)`;
      rollBtn.disabled = false;
    }
    bestEl.textContent = best;
  }

  // ---------- Game flow ----------
  function toggleHold(i) {
    if (finished || !hasRolled()) return;
    held[i] = !held[i];
    renderDice();
  }

  function roll() {
    if (finished || rollsLeft <= 0) return;
    for (let i = 0; i < 5; i++) {
      if (!held[i]) dice[i] = randFace();
    }
    rollsLeft--;
    renderDice();
    updateSheet();
    updateControls();
  }

  function scoreCategory(key) {
    if (finished || !hasRolled()) return;
    if (scores[key] !== null && scores[key] !== undefined) return;
    const cat = CATEGORIES.find(c => c.key === key);
    scores[key] = cat.score(dice);
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
    const bonus = upperSectionTotal() >= UPPER_TARGET ? UPPER_BONUS : 0;
    const total = currentTotal();
    const isNewBest = total > best;
    if (isNewBest) { best = total; store.set("yahtzee-best", best); }
    updateSheet();
    updateControls();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${isNewBest ? "New Best! 🎉" : "Game over"}</h2>
      <p>Total: ${total}${bonus ? ` (includes ${UPPER_BONUS} upper bonus)` : ""}. Best: ${best}.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function newGame() {
    if (overlay) overlay.remove();
    turn = 1;
    scores = {};
    for (const cat of CATEGORIES) scores[cat.key] = null;
    finished = false;
    resetTurn();
  }

  rollBtn.addEventListener("click", roll);
  newGameBtn.addEventListener("click", newGame);

  buildDice();
  buildSheet();
  newGame();
})();
