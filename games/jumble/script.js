// Jumble — puzzle-book style word unscrambling. Pure vanilla JS, fully offline.
(() => {
  const scrambleEl = document.getElementById("scramble");
  const clueEl = document.getElementById("clue");
  const answerEl = document.getElementById("answer");
  const attemptsEl = document.getElementById("attempts");
  const keyboardEl = document.getElementById("keyboard");
  const winsEl = document.getElementById("wins");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best-streak");
  const hintBtn = document.getElementById("hint-btn");
  const clearBtn = document.getElementById("clear-btn");
  const newWordBtn = document.getElementById("new-word");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Kid-friendly 5–7 letter words with short clues.
  const WORDS = [
    { w: "TIGER", clue: "Orange cat with black stripes" },
    { w: "OCEAN", clue: "The giant salty sea" },
    { w: "PIANO", clue: "Black and white keys that play music" },
    { w: "ROBOT", clue: "A machine helper that does tricks" },
    { w: "CLOUD", clue: "A fluffy white shape in the sky" },
    { w: "APPLE", clue: "A crunchy red or green fruit" },
    { w: "MOUSE", clue: "A small squeaky rodent" },
    { w: "COMET", clue: "Icy space rock with a glowing tail" },
    { w: "RIVER", clue: "A long ribbon of flowing water" },
    { w: "BEACH", clue: "Sandy shore where you swim" },
    { w: "CHAIR", clue: "Something you sit on" },
    { w: "HORSE", clue: "A big friendly riding animal" },
    { w: "ZEBRA", clue: "Black and white striped horse" },
    { w: "LEMON", clue: "Sour yellow fruit" },
    { w: "MANGO", clue: "Sweet juicy tropical fruit" },
    { w: "PIZZA", clue: "Cheesy flat bread from Italy" },
    { w: "CANDY", clue: "A sweet treat kids love" },
    { w: "DREAM", clue: "A story in your sleep" },
    { w: "GHOST", clue: "A spooky see-through spirit" },
    { w: "MAGIC", clue: "Hocus pocus and abracadabra" },
    { w: "FROST", clue: "White ice that sparkles on cold mornings" },
    { w: "SPARK", clue: "A tiny flash flying from a fire" },
    { w: "BREAD", clue: "Slices for toast and sandwiches" },
    { w: "HONEY", clue: "Sweet sticky stuff bees make" },
    { w: "TULIP", clue: "Spring flower with a cup-shaped bloom" },
    { w: "CROWN", clue: "Worn on the head of a king or queen" },
    { w: "MONKEY", clue: "Cheeky climber who loves bananas" },
    { w: "CASTLE", clue: "A big stone home for kings" },
    { w: "DRAGON", clue: "Fire-breathing flying reptile" },
    { w: "TURTLE", clue: "Slow reptile with a hard shell" },
    { w: "ROCKET", clue: "It blasts off into space" },
    { w: "PLANET", clue: "It orbits the Sun" },
    { w: "GARDEN", clue: "Where flowers and veggies grow" },
    { w: "PENCIL", clue: "You write with this and can erase it" },
    { w: "BANANA", clue: "Long yellow fruit monkeys love" },
    { w: "FALCON", clue: "A very fast soaring bird" },
    { w: "ISLAND", clue: "Land surrounded by water" },
    { w: "FOREST", clue: "A place with lots of trees" },
    { w: "FRIEND", clue: "Someone you like to play with" },
    { w: "GUITAR", clue: "A stringed instrument you strum" },
    { w: "PILLOW", clue: "Soft thing you rest your head on" },
    { w: "COOKIE", clue: "A sweet baked treat with chocolate chips" },
    { w: "TURKEY", clue: "Big bird eaten at Thanksgiving" },
    { w: "SUMMER", clue: "The hot sunny season" },
    { w: "WINTER", clue: "The cold snowy season" },
    { w: "SPIDER", clue: "Eight-legged web maker" },
    { w: "ORANGE", clue: "Fruit named for a color" },
    { w: "PURPLE", clue: "Color of grapes and royal robes" },
    { w: "SILVER", clue: "Shiny gray precious metal" },
    { w: "PIRATE", clue: "Sea robber with an eye patch" },
    { w: "TABLET", clue: "Handheld computer with a touch screen" },
    { w: "SCHOOL", clue: "Where you go to learn" },
    { w: "ANIMAL", clue: "A living creature like a dog or cat" },
    { w: "NATURE", clue: "Trees, rivers, and wildlife" },
    { w: "PUFFIN", clue: "Seabird with a colorful beak" },
    { w: "HARBOR", clue: "Safe place where ships park" },
    { w: "KNIGHT", clue: "A warrior in shining armor" },
    { w: "RAINBOW", clue: "Colorful arc in the sky after rain" },
    { w: "WEEKEND", clue: "Saturday and Sunday" },
    { w: "MORNING", clue: "When the sun comes up" },
    { w: "PENGUIN", clue: "Black and white bird that cannot fly" },
    { w: "DOLPHIN", clue: "Smart sea mammal that flips and clicks" },
    { w: "GIRAFFE", clue: "Tallest animal with a very long neck" },
    { w: "GORILLA", clue: "Huge gentle great ape" },
    { w: "BUFFALO", clue: "Big horned animal of the plains" },
    { w: "VOLCANO", clue: "Mountain that spits fire and ash" },
    { w: "THUNDER", clue: "Loud boom that follows lightning" },
    { w: "WEATHER", clue: "Rain, sun, wind and clouds" },
    { w: "SANDALS", clue: "Open summer shoes for the beach" },
    { w: "PANCAKE", clue: "Flat cake eaten with syrup" },
    { w: "PUMPKIN", clue: "Big orange Halloween squash" },
    { w: "BLANKET", clue: "Warm cover for sleeping" },
    { w: "DIAMOND", clue: "Sparkly gem from deep underground" },
    { w: "BICYCLE", clue: "Two wheels and pedals" },
    { w: "HOLIDAY", clue: "A special day off to celebrate" },
    { w: "EVENING", clue: "When the sun goes down" },
    { w: "SPARROW", clue: "Small brown bird" },
    { w: "BALLOON", clue: "Bouncy inflated decoration" },
    { w: "CHEETAH", clue: "Fastest land animal" },
    { w: "HAMSTER", clue: "Pocket-sized pet with cheek pouches" },
    { w: "CANARY", clue: "Little yellow singing bird" },
    { w: "TRAPEZE", clue: "Circus bar that swings high" },
  ];

  let wins = store.get("jumble-wins");
  let streak = store.get("jumble-streak");
  let bestStreak = store.get("jumble-best-streak");

  let current = null;
  let scrambled = "";
  let answer = [];
  let locked = [];
  let selected = null;
  let attempts = 0;
  let roundOver = false;
  let overlay = null;

  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  function shuffleWord(word) {
    const arr = word.split("");
    for (let t = 0; t < 60; t++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      if (arr.join("") !== word) return arr.join("");
    }
    // Fallback: rotate by one letter (never needed in practice).
    return arr.slice(1).join("") + arr[0];
  }

  function pickWord(exclude) {
    let next;
    do {
      next = WORDS[Math.floor(Math.random() * WORDS.length)];
    } while (exclude && next.w === exclude);
    return next;
  }

  function updateStatus() {
    winsEl.textContent = wins;
    streakEl.textContent = streak;
    bestEl.textContent = bestStreak;
  }

  function renderScramble() {
    scrambleEl.innerHTML = "";
    for (let i = 0; i < scrambled.length; i++) {
      const tile = document.createElement("div");
      tile.className = "scramble__tile";
      tile.style.animationDelay = (i * 60) + "ms";
      tile.textContent = scrambled[i];
      scrambleEl.appendChild(tile);
    }
  }

  function renderAnswer() {
    answerEl.innerHTML = "";
    for (let i = 0; i < answer.length; i++) {
      const box = document.createElement("button");
      box.className = "answer-box";
      if (answer[i]) box.classList.add("filled");
      if (locked[i]) box.classList.add("answer-box--locked");
      if (selected === i && !locked[i]) box.classList.add("answer-box--selected");
      box.textContent = answer[i];
      if (roundOver) box.disabled = true;
      box.addEventListener("click", () => selectBox(i));
      answerEl.appendChild(box);
    }
    attemptsEl.textContent = "Attempts: " + attempts;
  }

  function renderClue() {
    clueEl.textContent = "Clue: " + current.clue;
  }

  function firstEmptyUnlocked() {
    for (let i = 0; i < answer.length; i++) {
      if (!locked[i] && answer[i] === "") return i;
    }
    return -1;
  }

  function insertLetter(ch) {
    if (roundOver) return;
    let idx = -1;
    if (selected !== null && !locked[selected]) idx = selected;
    else idx = firstEmptyUnlocked();
    if (idx === -1) return;
    answer[idx] = ch;
    selected = firstEmptyUnlocked();
    if (selected === -1) selected = null;
    renderAnswer();
    checkComplete();
  }

  function removeLetter() {
    if (roundOver) return;
    let idx = -1;
    if (selected !== null && !locked[selected] && answer[selected]) idx = selected;
    else {
      for (let i = answer.length - 1; i >= 0; i--) {
        if (!locked[i] && answer[i]) { idx = i; break; }
      }
    }
    if (idx === -1) return;
    answer[idx] = "";
    selected = idx;
    renderAnswer();
  }

  function selectBox(i) {
    if (roundOver || locked[i]) return;
    selected = (selected === i) ? null : i;
    renderAnswer();
  }

  function clearAnswer() {
    if (roundOver) return;
    for (let i = 0; i < answer.length; i++) {
      if (!locked[i]) answer[i] = "";
    }
    selected = null;
    renderAnswer();
  }

  function useHint() {
    if (roundOver) return;
    const w = current.w;
    let idx = -1;
    for (let i = 0; i < w.length; i++) {
      if (answer[i] !== w[i]) { idx = i; break; }
    }
    if (idx === -1) return;
    answer[idx] = w[idx];
    locked[idx] = true;
    streak = 0;
    store.set("jumble-streak", 0);
    updateStatus();
    selected = firstEmptyUnlocked();
    if (selected === -1) selected = null;
    renderAnswer();
    checkComplete();
  }

  function checkComplete() {
    if (answer.some(l => l === "")) return;
    attempts++;
    const guess = answer.join("");
    if (guess === current.w) {
      roundOver = true;
      wins++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      store.set("jumble-wins", wins);
      store.set("jumble-streak", streak);
      store.set("jumble-best-streak", bestStreak);
      updateStatus();
      const boxes = answerEl.querySelectorAll(".answer-box");
      boxes.forEach(b => b.classList.add("answer-box--correct"));
      showOverlay();
    } else {
      streak = 0;
      store.set("jumble-streak", 0);
      updateStatus();
      answerEl.classList.add("answer-row--wrong");
      setTimeout(() => answerEl.classList.remove("answer-row--wrong"), 500);
      renderAnswer();
    }
  }

  function showOverlay() {
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>You got it! 🎉</h2><p>The word was ${current.w}.</p><p>Solved with ${attempts} ${attempts === 1 ? "attempt" : "attempts"}. Current streak: ${streak}.</p>
      <button class="btn" id="ov-restart">Next word</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", () => newWord(current.w));
  }

  function newWord(exclude) {
    if (overlay) overlay.remove();
    current = pickWord(exclude);
    scrambled = shuffleWord(current.w);
    answer = new Array(current.w.length).fill("");
    locked = new Array(current.w.length).fill(false);
    selected = null;
    attempts = 0;
    roundOver = false;
    renderScramble();
    renderClue();
    renderAnswer();
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_ROWS.forEach((letters, r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      for (const ch of letters) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.textContent = ch;
        btn.addEventListener("click", () => insertLetter(ch));
        rowEl.appendChild(btn);
      }
      if (r === 2) {
        const back = document.createElement("button");
        back.className = "key key--wide";
        back.textContent = "⌫";
        back.setAttribute("aria-label", "Backspace");
        back.addEventListener("click", removeLetter);
        rowEl.appendChild(back);
      }
      keyboardEl.appendChild(rowEl);
    });
  }

  document.addEventListener("keydown", e => {
    if (roundOver) {
      if (e.key === "Enter" && overlay) {
        e.preventDefault();
        newWord(current.w);
      }
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      insertLetter(e.key.toUpperCase());
    } else if (e.key === "Backspace") {
      e.preventDefault();
      removeLetter();
    }
  });

  hintBtn.addEventListener("click", useHint);
  clearBtn.addEventListener("click", clearAnswer);
  newWordBtn.addEventListener("click", () => newWord(current && current.w));

  buildKeyboard();
  updateStatus();
  newWord(null);
})();
