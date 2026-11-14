// Memory — pure vanilla JS, fully offline.
(() => {
  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const pairsEl = document.getElementById("pairs");

  const EMOJIS = ["🍎", "🚀", "🌟", "🐱", "🎲", "🌈", "🍕", "⚽"];
  let first, second, lock, matched, moves;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reset() {
    first = second = null; lock = false; matched = 0; moves = 0;
    const deck = shuffle([...EMOJIS, ...EMOJIS]);
    boardEl.innerHTML = "";
    deck.forEach(emoji => {
      const card = document.createElement("button");
      card.className = "cell card";
      card.dataset.emoji = emoji;
      card.textContent = "?";
      card.style.width = "76px";
      card.style.height = "76px";
      card.style.fontSize = "2rem";
      card.addEventListener("click", () => flip(card));
      boardEl.appendChild(card);
    });
    updateStats();
  }

  function flip(card) {
    if (lock || card === first || card.classList.contains("matched")) return;
    card.textContent = card.dataset.emoji;
    card.classList.add("flipped");
    card.style.background = "#fff";
    card.style.color = "#06231f";

    if (!first) { first = card; return; }
    second = card;
    moves++;
    updateStats();
    lock = true;

    if (first.dataset.emoji === second.dataset.emoji) {
      first.classList.add("matched");
      second.classList.add("matched");
      first.disabled = second.disabled = true;
      matched++;
      updateStats();
      if (matched === EMOJIS.length) { win(); }
      first = second = null;
      lock = false;
    } else {
      const a = first, b = second;
      setTimeout(() => {
        a.textContent = "?"; b.textContent = "?";
        a.classList.remove("flipped"); b.classList.remove("flipped");
        a.style.background = ""; a.style.color = "";
        b.style.background = ""; b.style.color = "";
        first = second = null; lock = false;
      }, 750);
    }
  }

  function updateStats() {
    movesEl.textContent = moves;
    pairsEl.textContent = `${matched}/${EMOJIS.length}`;
  }

  let overlay;
  function win() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>All matched! 🎉</h2>
      <p>Solved in ${moves} moves.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.getElementById("ov-restart").addEventListener("click", reset);
  }

  document.getElementById("new-game").addEventListener("click", reset);
  reset();
})();
