// Blackjack — pure vanilla JS, fully offline.
(() => {
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RED = new Set(["♥", "♦"]);

  const bankEl = document.getElementById("bank");
  const betEl = document.getElementById("bet");
  const playerHandEl = document.getElementById("player-hand");
  const dealerHandEl = document.getElementById("dealer-hand");
  const playerScoreEl = document.getElementById("player-score");
  const dealerScoreEl = document.getElementById("dealer-score");
  const resultEl = document.getElementById("result");
  const betControls = document.getElementById("bet-controls");
  const playControls = document.getElementById("play-controls");
  const dealBtn = document.getElementById("deal");

  let deck, player, dealer, bet, bank, phase;

  function buildDeck() {
    deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function handValue(hand) {
    let total = 0, aces = 0;
    for (const card of hand) {
      if (card.r === "A") { aces++; total += 11; }
      else if (["K", "Q", "J"].includes(card.r)) total += 10;
      else total += parseInt(card.r);
    }
    while (total > 21 && aces) { total -= 11; aces--; }
    return total;
  }

  function isRed(card) { return RED.has(card.s); }

  function renderCard(card, hidden) {
    const el = document.createElement("div");
    if (hidden) {
      el.className = "bj-card bj-card--back";
      el.setAttribute("aria-label", "Hidden card");
      return el;
    }
    el.className = "bj-card" + (isRed(card) ? " bj-card--red" : "");
    el.innerHTML = `<span class="bj-corner bj-corner--tl">${card.r}<br><span class="bj-suit">${card.s}</span></span>`
      + `<span class="bj-big">${card.s}</span>`
      + `<span class="bj-corner bj-corner--br">${card.r}<br><span class="bj-suit">${card.s}</span></span>`;
    return el;
  }

  function render(revealDealer) {
    playerHandEl.innerHTML = "";
    dealerHandEl.innerHTML = "";
    player.forEach(c => playerHandEl.appendChild(renderCard(c)));
    dealer.forEach((c, i) => {
      const hidden = revealDealer === false && i === 1;
      dealerHandEl.appendChild(renderCard(c, hidden));
    });
    playerScoreEl.textContent = handValue(player);
    if (revealDealer === false) {
      dealerScoreEl.textContent = `${handValue([dealer[0]])}`;
    } else {
      const dVal = handValue(dealer);
      dealerScoreEl.textContent = dVal + (dVal === 21 && dealer.length === 2 ? " (Blackjack)" : "");
    }
  }

  function updateStats() {
    bankEl.textContent = bank;
    betEl.textContent = bet;
  }

  function startRound() {
    if (bank <= 0) return bankrupt();
    if (phase !== "betting") return;
    buildDeck();
    player = [deck.pop(), deck.pop()];
    dealer = [deck.pop(), deck.pop()];
    phase = "player";
    resultEl.textContent = "";
    render(false);
    updateStats();
    betControls.style.display = "none";
    playControls.style.display = "flex";

    if (handValue(player) === 21) { stand(); return; } // natural blackjack auto-stands
  }

  function hit() {
    if (phase !== "player") return;
    player.push(deck.pop());
    render(false);
    if (handValue(player) > 21) endRound("bust");
  }

  function stand() {
    if (phase !== "player") return;
    phase = "dealer";
    playControls.style.display = "none";
    render(true); // reveal dealer hole card
    dealerTurn();
  }

  function dealerTurn() {
    const tick = () => {
      const dVal = handValue(dealer);
      if (dVal < 17) {
        dealer.push(deck.pop());
        render(true);
        setTimeout(tick, 500);
      } else {
        resolve();
      }
    };
    setTimeout(tick, 400);
  }

  function resolve() {
    const pVal = handValue(player), dVal = handValue(dealer);
    const dealerBlackjack = dVal === 21 && dealer.length === 2;
    const playerBlackjack = pVal === 21 && player.length === 2;

    if (dealerBlackjack && !playerBlackjack) return endRound("lose");
    if (playerBlackjack && !dealerBlackjack) return endRound("blackjack");
    if (pVal > 21) return endRound("bust");
    if (dVal > 21) return endRound("win");
    if (pVal > dVal) return endRound("win");
    if (pVal < dVal) return endRound("lose");
    return endRound("push");
  }

  function endRound(outcome) {
    phase = "over";
    render(true);
    let msg, delta;
    switch (outcome) {
      case "bust": msg = `Bust! ${handValue(player)} — you lose ${bet}.`; delta = -bet; break;
      case "lose": msg = `Dealer has ${handValue(dealer)}. You lose ${bet}.`; delta = -bet; break;
      case "push": msg = "Push — bet returned."; delta = 0; break;
      case "win": msg = `You win ${(bet * 2).toFixed(0)} (net +${bet}). Dealer had ${handValue(dealer)}.`; delta = bet; break;
      case "blackjack": { const prize = Math.floor(bet * 1.5); msg = `Blackjack! You profit +${prize} (3:2).`; delta = prize; break; }
    }
    bank += delta;
    if (bank < 0) bank = 0;
    updateStats();
    resultEl.textContent = msg;

    const againBtn = document.createElement("button");
    againBtn.className = "btn";
    againBtn.textContent = bank <= 0 ? "Restart" : "New Round";
    againBtn.addEventListener("click", () => {
      if (bank <= 0) return bankrupt();
      bet = 0;
      playControls.style.display = "none";
      betControls.style.display = "flex";
      phase = "betting";
      updateStats();
    });
    resultEl.appendChild(document.createElement("br"));
    resultEl.appendChild(againBtn);
  }

  function bankrupt() {
    bank = 100;
    bet = 0;
    resultEl.textContent = "Out of chips! Here are 100 fresh ones. Good luck.";
    updateStats();
    betControls.style.display = "flex";
    playControls.style.display = "none";
    phase = "betting";
    playerHandEl.innerHTML = ""; dealerHandEl.innerHTML = "";
    playerScoreEl.textContent = ""; dealerScoreEl.textContent = "";
  }

  // ---- Betting ----
  function addBet(amt) {
    if (phase !== "betting") return;
    if (bet + amt > bank) amt = bank - bet;
    if (amt <= 0) return;
    bet += amt;
    updateStats();
  }

  document.querySelectorAll(".bet-btn").forEach(b =>
    b.addEventListener("click", () => addBet(+b.dataset.amt)));
  dealBtn.addEventListener("click", startRound);
  document.getElementById("hit").addEventListener("click", hit);
  document.getElementById("stand").addEventListener("click", stand);

  // Keyboard: h = hit, s = stand
  document.addEventListener("keydown", e => {
    if (phase === "player") {
      if (e.key.toLowerCase() === "h") hit();
      if (e.key.toLowerCase() === "s") stand();
    }
  });

  bank = 100;
  phase = "betting";
  player = []; dealer = []; bet = 0;
  updateStats();
})();
