// Cryptogram — puzzle-book substitution cipher, fully offline. Pure vanilla JS.
(() => {
  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const winsEl = document.getElementById("wins");
  const timeEl = document.getElementById("time");
  const sourceEl = document.getElementById("source");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const QUOTES = [
    { text: "A FRIEND IN NEED IS A FRIEND INDEED", source: "proverb" },
    { text: "THE EARLY BIRD CATCHES THE WORM", source: "proverb" },
    { text: "EVERY EXPERT WAS ONCE A BEGINNER", source: "proverb" },
    { text: "PRACTICE MAKES PERFECT", source: "proverb" },
    { text: "SLOW AND STEADY WINS THE RACE", source: "Aesop" },
    { text: "HONESTY IS THE BEST POLICY", source: "proverb" },
    { text: "THINK OUTSIDE THE BOX", source: "proverb" },
    { text: "IF AT FIRST YOU DO NOT SUCCEED TRY AGAIN", source: "proverb" },
    { text: "A ROLLING STONE GATHERS NO MOSS", source: "proverb" },
    { text: "ALWAYS LEAVE THEM LAUGHING", source: "proverb" },
    { text: "YOU CANT GO HOME AGAIN", source: "Thomas Wolfe" },
    { text: "FOUR SCORE AND SEVEN YEARS", source: "Lincoln" },
  ];

  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let wins = store.get("cryptogram-wins");
  let quote, cipher, plainOf, mapping, hinted, selected, cells, gameOver, timerId, startTime;
  let lastQuoteIndex = -1;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Random substitution with NO letter mapping to itself (reshuffle until deranged).
  function makeCipher() {
    for (;;) {
      const perm = shuffle(ALPHABET.split(""));
      if (perm.every((ch, i) => ch !== ALPHABET[i])) {
        const cipher = {};   // plain -> cipher
        plainOf = {};        // cipher -> plain
        ALPHABET.split("").forEach((p, i) => { cipher[p] = perm[i]; plainOf[perm[i]] = p; });
        return cipher;
      }
    }
  }

  function startTimer() {
    clearInterval(timerId);
    startTime = Date.now();
    timeEl.textContent = "0";
    timerId = setInterval(() => { timeEl.textContent = Math.floor((Date.now() - startTime) / 1000); }, 500);
  }

  function updateStatus() { winsEl.textContent = wins; }

  // ---- Board construction ----
  function renderBoard() {
    boardEl.innerHTML = "";
    cells = [];
    for (const word of quote.text.split(" ")) {
      const wordEl = document.createElement("div");
      wordEl.className = "crypto-word";
      for (const plain of word) {
        const cipherLetter = quoteToCipher(plain);
        const cell = document.createElement("div");
        cell.className = "crypto-cell";
        const cipherEl = document.createElement("div");
        cipherEl.className = "crypto-cipher";
        cipherEl.textContent = cipherLetter;
        const slot = document.createElement("button");
        slot.className = "crypto-slot";
        slot.type = "button";
        slot.dataset.cipher = cipherLetter;
        slot.addEventListener("click", () => selectCipher(cipherLetter));
        cell.appendChild(cipherEl);
        cell.appendChild(slot);
        wordEl.appendChild(cell);
        cells.push({ cipher: cipherLetter, plain, slot });
      }
      boardEl.appendChild(wordEl);
    }
    refreshSlots();
  }

  function quoteToCipher(plain) { return cipher[plain]; }

  function refreshSlots() {
    for (const { cipher: c, slot } of cells) {
      slot.textContent = mapping[c] || "";
      slot.classList.toggle("selected", c === selected);
      slot.classList.toggle("locked", hinted.has(c));
      slot.disabled = hinted.has(c);
    }
  }

  function selectCipher(c) {
    selected = c;
    refreshSlots();
  }

  function uniqueCipherLetters() {
    return [...new Set(cells.map(cell => cell.cipher))];
  }

  // ---- Input ----
  function typeLetter(ch) {
    if (gameOver || !selected || hinted.has(selected)) return;
    mapping[selected] = ch;
    refreshSlots();
    winCheck();
  }

  function clearSelected() {
    if (gameOver || !selected || hinted.has(selected)) return;
    delete mapping[selected];
    refreshSlots();
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_ROWS.forEach((letters, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      if (i === 2) rowEl.appendChild(makeKey("⌫", "key key--wide", clearSelected));
      for (const ch of letters) rowEl.appendChild(makeKey(ch, "key", () => typeLetter(ch)));
      keyboardEl.appendChild(rowEl);
    });
  }

  function makeKey(label, className, onClick) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  // ---- Win ----
  let overlay;
  function winCheck() {
    if (cells.length === 0) return false;
    for (const { cipher: c, plain } of cells) {
      if (mapping[c] !== plain) return false;
    }
    endGame();
    return true;
  }

  function endGame() {
    gameOver = true;
    clearInterval(timerId);
    wins++;
    store.set("cryptogram-wins", wins);
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Solved! 🎉</h2><p>“${quote.text}”<br><span style="color:var(--muted);font-style:italic;">— ${quote.source}</span></p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  // ---- Buttons ----
  function hint() {
    if (gameOver) return;
    const candidates = uniqueCipherLetters().filter(c => !hinted.has(c) && mapping[c] !== plainOf[c]);
    if (candidates.length === 0) return;
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    mapping[c] = plainOf[c];
    hinted.add(c);
    refreshSlots();
    winCheck();
  }

  function reset() {
    if (overlay) overlay.remove();
    for (const c of uniqueCipherLetters()) {
      if (!hinted.has(c)) delete mapping[c];
    }
    gameOver = false;
    startTimer();
    refreshSlots();
  }

  function newGame() {
    if (overlay) overlay.remove();
    let idx = Math.floor(Math.random() * QUOTES.length);
    if (QUOTES.length > 1 && idx === lastQuoteIndex) idx = (idx + 1) % QUOTES.length; // never the same back-to-back
    lastQuoteIndex = idx;
    quote = QUOTES[idx];
    cipher = makeCipher();
    mapping = {};
    hinted = new Set();
    selected = null;
    gameOver = false;
    sourceEl.textContent = quote.source;
    renderBoard();
    startTimer();
  }

  document.getElementById("hint").addEventListener("click", hint);
  document.getElementById("reset").addEventListener("click", reset);
  document.getElementById("new-puzzle").addEventListener("click", newGame);

  document.addEventListener("keydown", e => {
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
    else if (e.key === "Backspace") { e.preventDefault(); clearSelected(); }
  });

  buildKeyboard();
  updateStatus();
  newGame();
})();
