// Hangman — pure vanilla JS, fully offline. Canvas gallows, 3 categories.
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
  const canvas = dom.byId("gallows");
  const categoryEl = dom.byId("category");
  const wordEl = dom.byId("word");
  const keyboardEl = dom.byId("keyboard");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const livesEl = dom.byId("lives");
  const newWordBtn = dom.byId("new-word");
  const hintEl = dom.byId("hint");
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  const GALLOWS_W = 300, GALLOWS_H = 240;
  window.Arcade.util.hidpiCanvas(canvas, ctx, GALLOWS_W, GALLOWS_H);

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
  const CATEGORY_STAT = { Animals: "animalWins", Food: "foodWins", Space: "spaceWins" };
  const HINT_DEFAULT = "Guess the word one letter at a time — six wrong guesses and it's game over. Esc pauses.";

  const K = makeKeys("hangman");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    perfectWins: 0, // wins with no wrong guesses
    lastLifeWins: 0, // wins with five wrong guesses
    wrongGuesses: 0, // wrong letters chosen, career
    animalWins: 0,
    foodWins: 0,
    spaceWins: 0,
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

  // Carry the pre-core counters (hangman-wins / hangman-streak) over.
  function migrateLegacy() {
    const legacy = [
      ["hangman-wins", "wins"],
      ["hangman-streak", "streak"],
    ];
    for (const [oldKey, statKey] of legacy) {
      const raw = store.get(oldKey, null);
      if (raw !== null && raw !== undefined) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > stats[statKey]) stats[statKey] = n;
        store.remove(oldKey);
      }
    }
    saveStats();
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Win", desc: "Solve your first word.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Solve 5 words.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Solve 10 words.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Solve 2 words in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Solve 3 words in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Solve 5 words in a row.", stat: "bestStreak", goal: 5 },
    { id: "perfect", icon: "💎", name: "Flawless", desc: "Solve a word with no wrong guesses.", stat: "perfectWins", goal: 1 },
    { id: "lastLife", icon: "😅", name: "Last Gasp", desc: "Win with only one life left.", stat: "lastLifeWins", goal: 1 },
    { id: "animal", icon: "🦁", name: "Zoologist", desc: "Solve an Animals word.", stat: "animalWins", goal: 1 },
    { id: "food", icon: "🍕", name: "Foodie", desc: "Solve a Food word.", stat: "foodWins", goal: 1 },
    { id: "space", icon: "🚀", name: "Astronomer", desc: "Solve a Space word.", stat: "spaceWins", goal: 1 },
    { id: "wrong100", icon: "🔤", name: "Brave Guesser", desc: "Make 100 wrong guesses in total.", stat: "wrongGuesses", goal: 100 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 games.", stat: "games", goal: 20 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Lose 10 games — keep trying!", stat: "losses", goal: 10 },
  ];

  // ---------- Badges UI ----------
  function updateBadgeCount() {
    badgeCountEl.textContent = achv.count();
    badgesBtn.setAttribute(
      "aria-label",
      `Badges and achievements: ${achv.count()} of ${achv.total()} unlocked`
    );
  }

  const achv = badgesApi.create(ACHIEVEMENTS, {
    storageKey: K.achv,
    getStat: (key) => (typeof stats[key] === "number" ? stats[key] : 0),
    onUnlock: () => {
      updateBadgeCount();
      saveStats();
    },
    onRender: () => {
      if (!achvModal.hidden) renderAchvGrid();
    },
  });

  function checkAchievements() {
    achv.check();
  }

  function renderAchvGrid() {
    achv.render(achvGrid, {
      countEl: achvCountEl,
      recordsEl: achvRecordsEl,
      records: () => [
        ["Wins", stats.wins],
        ["Losses", stats.losses],
        ["Best streak", stats.bestStreak],
        ["Wrong guesses", stats.wrongGuesses],
        ["Flawless wins", stats.perfectWins],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
    },
    onClose: () => {
      const target = overlay.isOpen() ? document.querySelector(".overlay .btn") : badgesBtn;
      if (target && target.focus) target.focus();
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

  // ---------- State ----------
  let currentWord, currentCategory, guessed, wrong, gameOver;
  let paused = false;
  let keyEls = {};

  // Faint ground line shown before the first wrong guess.
  function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, GALLOWS_W, GALLOWS_H);
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
    if (!ctx) return;
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
    keyEls = {};
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      for (const letter of row) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.textContent = letter;
        btn.dataset.letter = letter;
        btn.addEventListener("click", () => {
          audio.unlock();
          guess(letter);
        });
        keyEls[letter] = btn;
        rowEl.appendChild(btn);
      }
      keyboardEl.appendChild(rowEl);
    }
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    livesEl.textContent = MAX_WRONG - wrong;
  }

  function disableKeyboard() {
    for (const letter of Object.keys(keyEls)) keyEls[letter].disabled = true;
  }

  function guess(letter) {
    if (gameOver || paused || guessed.has(letter)) return;
    guessed.add(letter);
    const btn = keyEls[letter];
    if (currentWord.includes(letter)) {
      if (btn) { btn.classList.add("key--good"); btn.disabled = true; }
      sfx("match");
      renderWord(false);
      const complete = [...currentWord].every((ch) => guessed.has(ch));
      if (complete) endGame(true);
    } else {
      wrong++;
      stats.wrongGuesses++;
      saveStats();
      if (btn) { btn.classList.add("key--bad"); btn.disabled = true; }
      sfx("error");
      drawStage(wrong);
      updateStatus();
      if (wrong >= MAX_WRONG) endGame(false);
    }
  }

  function endGame(won) {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    disableKeyboard();
    stats.games++;
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (wrong === 0) stats.perfectWins++;
      if (wrong === MAX_WRONG - 1) stats.lastLifeWins++;
      const statKey = CATEGORY_STAT[currentCategory];
      if (statKey) stats[statKey]++;
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    checkAchievements();
    updateStatus();
    renderWord(!won);

    const buttons = [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ];
    if (won) {
      sfx("win");
      confetti(90);
      showOverlay(
        "You got it! 🎉",
        `The word was ${currentWord}. Nice detective work! Streak ${stats.streak}.`,
        buttons
      );
    } else {
      sfx("over");
      showOverlay("Out of lives! 😵", `The word was ${currentWord}. Better luck next time!`, buttons);
    }
  }

  function newGame() {
    hideOverlay();
    const categories = Object.keys(CATEGORIES);
    currentCategory = categories[(Math.random() * categories.length) | 0];
    const list = CATEGORIES[currentCategory];
    currentWord = list[(Math.random() * list.length) | 0];
    resetRound();
  }

  function resetRound() {
    paused = false;
    categoryEl.textContent = currentCategory;
    guessed = new Set();
    wrong = 0;
    gameOver = false;
    clearCanvas();
    buildKeyboard();
    renderWord(false);
    updateStatus();
    hintEl.textContent = HINT_DEFAULT;
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (gameOver || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press Esc or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New word", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newGame(); } },
      ]);
    } else {
      hideOverlay();
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

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (gameOver) {
      if (e.key === "Enter") newGame();
      return;
    }
    if (paused) return;

    const letter = String(e.key || "").toUpperCase();
    if (/^[A-Z]$/.test(letter)) guess(letter);
  }

  function bindEvents() {
    newWordBtn.addEventListener("click", () => { sfx("click"); newGame(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!gameOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !gameOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__HANGMAN = {
    MAX_WRONG,
    CATEGORIES,
    KEY_ROWS,
    get word() { return currentWord; },
    get category() { return currentCategory; },
    get guessed() { return Array.from(guessed); },
    get wrong() { return wrong; },
    get lives() { return MAX_WRONG - wrong; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    stats,
    ACHIEVEMENTS,
    guess,
    newGame,
    // Test-only: install a word/category and reset the round.
    setWord: (word, category) => {
      currentWord = String(word).toUpperCase();
      currentCategory = category || "Animals";
      resetRound();
    },
    clearCanvas,
    drawStage,
    setPaused,
    togglePause,
    checkAchievements,
    saveStats,
    openAchv,
    closeAchv,
    unlocked: () => achv.list(),
    overlayTitle: () => overlay.info().title,
    overlayMsg: () => overlay.info().msg,
    overlay,
  };

  init();
})();
