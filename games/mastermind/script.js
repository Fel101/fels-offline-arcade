// Mastermind — pure vanilla JS, fully offline. Classic code-breaking.
(() => {
  const winsEl = document.getElementById("wins");
  const streakEl = document.getElementById("streak");
  const boardEl = document.getElementById("board");
  const paletteEl = document.getElementById("palette");
  const guessBtn = document.getElementById("guess-btn");
  const newCodeBtn = document.getElementById("new-code");
  const diffSel = document.getElementById("difficulty");
  const hintEl = document.getElementById("hint");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const MAX_ROWS = 10;
  const COLORS = [
    { name: "red",    bg: "radial-gradient(circle at 34% 34%, #ff9d8a, #ef4d38 58%, #b0271a)" },
    { name: "yellow", bg: "radial-gradient(circle at 34% 34%, #fff3a0, #ffd94d 58%, #d9a613)" },
    { name: "green",  bg: "radial-gradient(circle at 34% 34%, #a4ffc9, #2fd071 58%, #0f8f43)" },
    { name: "blue",   bg: "radial-gradient(circle at 34% 34%, #a8e6ff, #38b6ef 58%, #0f6f9f)" },
    { name: "purple", bg: "radial-gradient(circle at 34% 34%, #e0b3ff, #a55ef0 58%, #6a1fb0)" },
    { name: "orange", bg: "radial-gradient(circle at 34% 34%, #ffd0a0, #ff8c1a 58%, #b3550a)" },
  ];
  const DIFFS = {
    easy:   { pegs: 4, colors: 4 },
    normal: { pegs: 4, colors: 6 },
    hard:   { pegs: 5, colors: 6 },
  };
  const HINT_DEFAULT = "Black = right color, right spot · White = right color, wrong spot. Click a filled peg to undo.";

  let pegCount = 4, colorCount = 6;
  let secret = [], currentGuess = [], rows = [], gameOver = false;
  let overlay = null;
  const stats = { wins: store.get("mastermind-wins"), streak: store.get("mastermind-streak") };

  const colorBg = (i) => COLORS[i].bg;

  function updateStats() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
  }

  // Standard two-pass scoring: exact matches → black pegs; for the rest,
  // each guess peg matching a remaining code peg → white peg.
  function scoreGuess(sec, guess) {
    let black = 0;
    const sLeft = [], gLeft = [];
    for (let i = 0; i < sec.length; i++) {
      if (sec[i] === guess[i]) black++;
      else { sLeft.push(sec[i]); gLeft.push(guess[i]); }
    }
    const counts = {};
    for (const c of sLeft) counts[c] = (counts[c] || 0) + 1;
    let white = 0;
    for (const c of gLeft) {
      if (counts[c] > 0) { white++; counts[c]--; }
    }
    return { black, white };
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < MAX_ROWS; r++) {
      const isCurrent = !gameOver && r === rows.length;
      const row = document.createElement("div");
      row.className = "mm-row" + (isCurrent ? " mm-row--current" : "");

      const num = document.createElement("span");
      num.className = "mm-row__num";
      num.textContent = String(r + 1).padStart(2, "0");
      row.appendChild(num);

      const pegs = document.createElement("div");
      pegs.className = "mm-pegs";
      for (let i = 0; i < pegCount; i++) {
        const peg = document.createElement("div");
        let filled = -1;
        if (r < rows.length) filled = rows[r].guess[i];
        else if (isCurrent && i < currentGuess.length) filled = currentGuess[i];
        if (filled >= 0) {
          peg.className = "mm-peg mm-peg--filled";
          peg.style.background = colorBg(filled);
          if (isCurrent) {
            peg.title = "Undo last peg";
            peg.addEventListener("click", undoLastPeg);
          }
        } else {
          peg.className = "mm-peg mm-peg--empty";
        }
        pegs.appendChild(peg);
      }
      row.appendChild(pegs);

      // Feedback: small black/white pegs, two rows (2×2 for 4-peg games,
      // three columns × two rows for Hard's 5 pegs).
      const fb = document.createElement("div");
      fb.className = "mm-feedback";
      fb.style.gridTemplateColumns = "repeat(" + Math.ceil(pegCount / 2) + ", 13px)";
      const scored = r < rows.length ? rows[r] : null;
      for (let i = 0; i < pegCount; i++) {
        const cell = document.createElement("div");
        cell.className = "mm-fb";
        if (scored) {
          if (i < scored.black) cell.classList.add("mm-fb--black");
          else if (i < scored.black + scored.white) cell.classList.add("mm-fb--white");
        }
        fb.appendChild(cell);
      }
      row.appendChild(fb);
      boardEl.appendChild(row);
    }
    guessBtn.disabled = gameOver || currentGuess.length !== pegCount;
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    for (let i = 0; i < colorCount; i++) {
      const btn = document.createElement("button");
      btn.className = "mm-color";
      btn.style.background = colorBg(i);
      btn.title = COLORS[i].name;
      btn.setAttribute("aria-label", "Add " + COLORS[i].name);
      btn.addEventListener("click", () => addColor(i));
      paletteEl.appendChild(btn);
    }
  }

  function addColor(i) {
    if (gameOver || currentGuess.length >= pegCount) return;
    currentGuess.push(i);
    renderBoard();
  }

  function undoLastPeg() {
    if (gameOver || currentGuess.length === 0) return;
    currentGuess.pop();
    renderBoard();
  }

  function newGame() {
    const diff = DIFFS[diffSel.value] || DIFFS.normal;
    pegCount = diff.pegs;
    colorCount = diff.colors;
    secret = [];
    for (let i = 0; i < pegCount; i++) secret.push(Math.floor(Math.random() * colorCount));
    rows = [];
    currentGuess = [];
    gameOver = false;
    if (overlay) { overlay.remove(); overlay = null; }
    hintEl.textContent = HINT_DEFAULT;
    renderPalette();
    renderBoard();
  }

  function makeOverlay(title, bodyHtml) {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2>${bodyHtml}
      <button class="btn" id="ov-restart">Play Again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function doGuess() {
    if (gameOver || currentGuess.length !== pegCount) return;
    const res = scoreGuess(secret, currentGuess);
    rows.push({ guess: currentGuess.slice(), black: res.black, white: res.white });
    currentGuess = [];

    if (res.black === pegCount) {
      gameOver = true;
      stats.wins++;
      stats.streak++;
      store.set("mastermind-wins", stats.wins);
      store.set("mastermind-streak", stats.streak);
      updateStats();
      renderBoard();
      makeOverlay("Code Cracked! 🎉",
        `<p>Solved in ${rows.length} ${rows.length === 1 ? "guess" : "guesses"} · Streak ${stats.streak}</p>`);
      return;
    }
    if (rows.length >= MAX_ROWS) {
      gameOver = true;
      stats.streak = 0;
      store.set("mastermind-streak", stats.streak);
      updateStats();
      renderBoard();
      const reveal = secret.map((c) => `<div class="mm-peg" style="background:${colorBg(c)}"></div>`).join("");
      makeOverlay("Out of Guesses 💀",
        `<p>The code was:</p><div class="mm-reveal">${reveal}</div><p>Better luck next time!</p>`);
      return;
    }
    renderBoard();
  }

  guessBtn.addEventListener("click", doGuess);
  newCodeBtn.addEventListener("click", newGame);
  diffSel.addEventListener("change", newGame);

  updateStats();
  newGame();
})();
