// Hangman — pure vanilla JS, fully offline. Canvas gallows, 3 categories.
(() => {
  const canvas = document.getElementById("gallows");
  const categoryEl = document.getElementById("category");
  const wordEl = document.getElementById("word");
  const keyboardEl = document.getElementById("keyboard");
  const winsEl = document.getElementById("wins");
  const streakEl = document.getElementById("streak");
  const livesEl = document.getElementById("lives");
  const ctx = canvas.getContext("2d");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const MAX_WRONG = 6;
  const CATEGORIES = {
    Animals: [
      "LION","TIGER","ZEBRA","PANDA","KOALA","LYNX","IBEX","WOLF","DEER","BEAR",
      "MULE","PONY","DUCK","SWAN","CROW","VIPER","COBRA","OTTER","LEMUR","BISON",
      "MOOSE","PUPPY","GOOSE","SHARK","WHALE","EAGLE","FINCH","HERON","CRANE","STORK",
      "RAVEN","TOAD","FROG","NEWT","MOTH","TURTLE","SALMON","FALCON","PARROT","RABBIT",
      "BADGER","BEAVER","KITTEN","JAGUAR","TOUCAN","MACAW","GECKO","IGUANA","PYTHON","MAMBA",
      "ADDER","LLAMA","ALPACA","VICUNA","BASS","TROUT","PERCH","CLAM","GIRAFFE","CHEETAH",
      "GORILLA","DOLPHIN","PEACOCK","PENGUIN","LEOPARD","OSTRICH","HYENA","JERBOA","MARMOT","FERRET",
      "WEASEL","SPARROW","HERRING","ANCHOVY","PIRANHA","CARIBOU","BOBCAT","COYOTE","BEETLE","SPIDER",
      "OCELOT","ELEPHANT","STALLION","SQUIRREL","HEDGEHOG","KANGAROO","ANTELOPE","SCORPION","MACKEREL","HADDOCK",
      "LOBSTER",
    ],
    Food: [
      "PIZZA","APPLE","BANANA","CARROT","BREAD","CHEESE","COOKIE","PASTA","TACO","MELON",
      "BERRY","GRAPE","MUFFIN","WAFFLE","BACON","TOAST","SALAD","SOUP","STEW","CURRY",
      "RICE","BEANS","PEAS","CORN","POTATO","ONION","GARLIC","PEPPER","TOMATO","LETTUCE",
      "SPINACH","BROCCOLI","CABBAGE","CELERY","PUMPKIN","SQUASH","EGGPLANT","AVOCADO","PEACH","PLUM",
      "CHERRY","LEMON","LIME","ORANGE","MANGO","KIWI","PAPAYA","GUAVA","COCONUT","ALMOND",
      "WALNUT","CASHEW","PEANUT","PECAN","TRUFFLE","MUSHROOM","OLIVE","PICKLE","CEREAL","YOGURT",
      "BUTTER","CREAM","MILK","JUICE","COCOA","HONEY","SUGAR","VANILLA","RELISH","SALSA",
      "BURRITO","NACHOS","BAGEL","DONUT","LASAGNA","RAVIOLI","GNOCCHI","RISOTTO","QUINOA","LENTIL",
      "CHICKPEA","TOFU","TEMPEH","STEAK","BURGER","PRETZEL","POPCORN","CRACKER","CUCUMBER",
    ],
    Space: [
      "COMET","ORBIT","GALAXY","SATURN","ROCKET","PLANET","NEBULA","COSMOS","VENUS","PLUTO",
      "MARS","MOON","STAR","SOLAR","LUNAR","METEOR","ASTEROID","MERCURY","JUPITER","URANUS",
      "NEPTUNE","EARTH","ROVER","PROBE","MODULE","CAPSULE","DOCKING","ECLIPSE","CRATER","GRAVITY",
      "SHUTTLE","VOYAGER","APOLLO","GEMINI","LIFTOFF","IGNITION","THRUST","ENGINE","OXYGEN","HELIUM",
      "NITROGEN","ECLIPTIC","ZODIAC","PULSAR","QUASAR","PARSEC","APOGEE","PERIGEE","SOLSTICE","EQUINOX",
      "SPACEMAN","ORION","CYGNUS","LYRA","POLARIS","VEGA","SIRIUS","ALTAIR","ANTARES","RIGEL",
      "DENEB","TITAN","EUROPA","CALLISTO","GANYMEDE","TRITON","CHARON","MIMAS","PALLAS","ZENITH",
      "NADIR","STARDUST","SUNLIGHT","FIREBALL","AURORA","WARP",
    ],
  };

  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  let wins = store.get("hangman-wins");
  let streak = store.get("hangman-streak");

  let currentWord, currentCategory, guessed, wrong, gameOver, overlay;

  // Faint ground line shown before the first wrong guess.
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 222);
    ctx.lineTo(270, 222);
    ctx.stroke();
  }

  // Draw stages 1..stage cumulatively. Stage 1 gallows, 2 head, 3 body,
  // 4 left arm, 5 right arm, 6 legs.
  function drawStage(stage) {
    clearCanvas();
    ctx.strokeStyle = "#eef0ff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stage >= 1) { // gallows: base, post, beam, rope
      ctx.beginPath();
      ctx.moveTo(52, 218); ctx.lineTo(156, 218);   // base
      ctx.moveTo(92, 218); ctx.lineTo(92, 36);     // post
      ctx.moveTo(92, 36); ctx.lineTo(204, 36);     // beam
      ctx.moveTo(92, 62); ctx.lineTo(122, 36);     // diagonal brace
      ctx.moveTo(204, 36); ctx.lineTo(204, 66);    // rope
      ctx.stroke();
    }
    if (stage >= 2) { // head
      ctx.beginPath();
      ctx.arc(204, 84, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stage >= 3) { // body
      ctx.beginPath();
      ctx.moveTo(204, 102); ctx.lineTo(204, 154);
      ctx.stroke();
    }
    if (stage >= 4) { // left arm
      ctx.beginPath();
      ctx.moveTo(204, 114); ctx.lineTo(172, 140);
      ctx.stroke();
    }
    if (stage >= 5) { // right arm
      ctx.beginPath();
      ctx.moveTo(204, 114); ctx.lineTo(236, 140);
      ctx.stroke();
    }
    if (stage >= 6) { // legs
      ctx.beginPath();
      ctx.moveTo(204, 154); ctx.lineTo(178, 202);
      ctx.moveTo(204, 154); ctx.lineTo(230, 202);
      ctx.stroke();
    }
  }

  function renderWord(revealAll) {
    wordEl.innerHTML = "";
    for (const letter of currentWord) {
      const slot = document.createElement("span");
      slot.className = "slot";
      if (guessed.has(letter)) slot.textContent = letter;
      else if (revealAll) {
        slot.textContent = letter;
        slot.classList.add("slot--missed");
      }
      wordEl.appendChild(slot);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      for (const letter of row) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.textContent = letter;
        btn.dataset.letter = letter;
        btn.addEventListener("click", () => guess(letter));
        rowEl.appendChild(btn);
      }
      keyboardEl.appendChild(rowEl);
    }
  }

  function keyButton(letter) {
    return keyboardEl.querySelector(`[data-letter="${letter}"]`);
  }

  function updateStatus() {
    winsEl.textContent = wins;
    streakEl.textContent = streak;
    livesEl.textContent = MAX_WRONG - wrong;
  }

  function disableKeyboard() {
    for (const btn of keyboardEl.querySelectorAll(".key")) btn.disabled = true;
  }

  function guess(letter) {
    if (gameOver || guessed.has(letter)) return;
    guessed.add(letter);
    const btn = keyButton(letter);
    if (currentWord.includes(letter)) {
      if (btn) { btn.classList.add("key--good"); btn.disabled = true; }
      renderWord(false);
      const complete = [...currentWord].every((ch) => guessed.has(ch));
      if (complete) endGame(true);
    } else {
      wrong++;
      if (btn) { btn.classList.add("key--bad"); btn.disabled = true; }
      drawStage(wrong);
      updateStatus();
      if (wrong >= MAX_WRONG) endGame(false);
    }
  }

  function endGame(won) {
    gameOver = true;
    disableKeyboard();
    if (won) {
      wins++;
      streak++;
      store.set("hangman-wins", wins);
      store.set("hangman-streak", streak);
    } else {
      streak = 0;
      store.set("hangman-streak", 0);
    }
    updateStatus();
    renderWord(!won);
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    const title = won ? "You got it! 🎉" : "Out of lives! 😵";
    const msg = won
      ? `The word was <strong>${currentWord}</strong>. Nice detective work!`
      : `The word was <strong>${currentWord}</strong>. Better luck next time!`;
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function newGame() {
    if (overlay) overlay.remove();
    const categories = Object.keys(CATEGORIES);
    currentCategory = categories[(Math.random() * categories.length) | 0];
    const list = CATEGORIES[currentCategory];
    currentWord = list[(Math.random() * list.length) | 0];
    categoryEl.textContent = currentCategory;
    guessed = new Set();
    wrong = 0;
    gameOver = false;
    clearCanvas();
    buildKeyboard();
    renderWord(false);
    updateStatus();
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) guess(letter);
  });

  document.getElementById("new-word").addEventListener("click", newGame);
  winsEl.textContent = wins;
  streakEl.textContent = streak;
  newGame();
})();
