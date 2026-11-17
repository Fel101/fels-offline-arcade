// Jumble — puzzle-book style word unscrambling. Pure vanilla JS, fully offline.
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
  const scrambleEl = dom.byId("scramble");
  const clueEl = dom.byId("clue");
  const answerEl = dom.byId("answer");
  const attemptsEl = dom.byId("attempts");
  const keyboardEl = dom.byId("keyboard");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const bestEl = dom.byId("best-streak");

  const hintBtn = dom.byId("hint-btn");
  const clearBtn = dom.byId("clear-btn");
  const newWordBtn = dom.byId("new-word");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  // ---------- Constants ----------
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

  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  const K = makeKeys("jumble");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    hints: 0,
    letters: 0,
    flawless: 0,
    wrongGuesses: 0,
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

  // The pre-core build kept three loose counters.
  function migrateLegacy() {
    const legacy = [
      ["jumble-wins", "wins"],
      ["jumble-streak", "streak"],
      ["jumble-best-streak", "bestStreak"],
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
    { id: "first", icon: "🎉", name: "First Solve", desc: "Unscramble your first word.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔤", name: "Word Finder", desc: "Solve 5 words.", stat: "wins", goal: 5 },
    { id: "win10", icon: "📚", name: "Wordsmith", desc: "Solve 10 words.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Jumble Master", desc: "Solve 25 words.", stat: "wins", goal: 25 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Solve 2 words in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Solve 3 words in a row.", stat: "bestStreak", goal: 3 },
    { id: "streak5", icon: "🚀", name: "Unstoppable", desc: "Solve 5 words in a row.", stat: "bestStreak", goal: 5 },
    { id: "games10", icon: "🎮", name: "Ten Words", desc: "Start 10 words.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Word Shelf", desc: "Start 25 words.", stat: "games", goal: 25 },
    { id: "hint10", icon: "💡", name: "Nudge", desc: "Use 10 hints.", stat: "hints", goal: 10 },
    { id: "hint50", icon: "🔦", name: "Hint Happy", desc: "Use 50 hints.", stat: "hints", goal: 50 },
    { id: "letters100", icon: "⌨️", name: "Letter Drop", desc: "Type 100 letters.", stat: "letters", goal: 100 },
    { id: "letters500", icon: "🖋️", name: "Typist", desc: "Type 500 letters.", stat: "letters", goal: 500 },
    { id: "flawless5", icon: "✨", name: "Spotless", desc: "Solve 5 words without hints.", stat: "flawless", goal: 5 },
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
        ["Words", stats.games],
        ["Solved", stats.wins],
        ["Best streak", stats.bestStreak],
        ["Hints", stats.hints],
        ["Clean solves", stats.flawless],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!roundOver && !paused) setPaused(true);
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
  audio.define("letter", [[620, 0, 0.03, "triangle", 0.02]]);
  audio.define("erase", [[300, 0, 0.05, "sine", 0.025]]);
  audio.define("hint", [[440, 0, 0.08, "sine", 0.035], [660, 0.07, 0.1, "sine", 0.035]]);

  // ---------- State ----------
  let current = null;
  let scrambled = "";
  let answer = [];
  let locked = [];
  let selected = null;
  let attempts = 0;
  let roundOver = false;
  let paused = false;
  let hintsThisWord = 0;

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    bestEl.textContent = stats.bestStreak;
  }

  // ---------- Scramble ----------
  function shuffleWord(word) {
    const arr = word.split("");
    for (let t = 0; t < 60; t++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      if (arr.join("") !== word) return arr.join("");
    }
    // Fallback: rotate by one letter (never needed in practice).
    return arr.slice(1).join("") + arr[0];
  }

  // Bounded so a stubborn random stream can never hang the page.
  function pickWord(exclude) {
    const start = Math.floor(Math.random() * WORDS.length);
    for (let i = 0; i < WORDS.length; i++) {
      const cand = WORDS[(start + i) % WORDS.length];
      if (!exclude || cand.w !== exclude) return cand;
    }
    return WORDS[start];
  }

  // ---------- Rendering ----------
  function renderScramble() {
    scrambleEl.innerHTML = "";
    for (let i = 0; i < scrambled.length; i++) {
      const tile = document.createElement("div");
      tile.className = "scramble__tile";
      tile.style.animationDelay = i * 60 + "ms";
      tile.textContent = scrambled[i];
      scrambleEl.appendChild(tile);
    }
  }

  function renderAnswer() {
    answerEl.innerHTML = "";
    for (let i = 0; i < answer.length; i++) {
      const box = document.createElement("button");
      box.type = "button";
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

  // ---------- Play ----------
  function firstEmptyUnlocked() {
    for (let i = 0; i < answer.length; i++) {
      if (!locked[i] && answer[i] === "") return i;
    }
    return -1;
  }

  function insertLetter(ch) {
    if (roundOver || paused) return false;
    let idx = -1;
    if (selected !== null && !locked[selected]) idx = selected;
    else idx = firstEmptyUnlocked();
    if (idx === -1) return false;
    answer[idx] = ch;
    stats.letters++;
    saveStats();
    selected = firstEmptyUnlocked();
    if (selected === -1) selected = null;
    renderAnswer();
    sfx("letter");
    checkAchievements();
    checkComplete();
    return true;
  }

  function removeLetter() {
    if (roundOver || paused) return false;
    let idx = -1;
    if (selected !== null && !locked[selected] && answer[selected]) idx = selected;
    else {
      for (let i = answer.length - 1; i >= 0; i--) {
        if (!locked[i] && answer[i]) {
          idx = i;
          break;
        }
      }
    }
    if (idx === -1) return false;
    answer[idx] = "";
    selected = idx;
    renderAnswer();
    sfx("erase");
    return true;
  }

  function selectBox(i) {
    if (roundOver || paused || locked[i]) return false;
    selected = selected === i ? null : i;
    renderAnswer();
    return true;
  }

  function clearAnswer() {
    if (roundOver || paused) return false;
    for (let i = 0; i < answer.length; i++) {
      if (!locked[i]) answer[i] = "";
    }
    selected = null;
    renderAnswer();
    sfx("erase");
    return true;
  }

  function useHint() {
    if (roundOver || paused) return false;
    const w = current.w;
    let idx = -1;
    for (let i = 0; i < w.length; i++) {
      if (answer[i] !== w[i]) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      sfx("error");
      return false;
    }
    answer[idx] = w[idx];
    locked[idx] = true;
    hintsThisWord++;
    stats.hints++;
    stats.streak = 0;
    saveStats();
    updateStatus();
    selected = firstEmptyUnlocked();
    if (selected === -1) selected = null;
    renderAnswer();
    sfx("hint");
    checkAchievements();
    checkComplete();
    return true;
  }

  function checkComplete() {
    if (answer.some((l) => l === "")) return false;
    attempts++;
    const guess = answer.join("");
    if (guess === current.w) {
      endGame();
      return true;
    }
    stats.wrongGuesses++;
    stats.streak = 0;
    saveStats();
    updateStatus();
    checkAchievements();
    sfx("error");
    answerEl.classList.add("answer-row--wrong");
    setTimeout(() => answerEl.classList.remove("answer-row--wrong"), 500);
    renderAnswer();
    return false;
  }

  // ---------- Win ----------
  function endGame() {
    if (roundOver) return false;
    roundOver = true;
    paused = false;
    // The last letter was rendered before checkComplete ran, so refresh the
    // attempt label and mark the winning boxes here.
    const boxes = answerEl.children || [];
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i] && boxes[i].classList) boxes[i].classList.add("answer-box--correct");
    }
    attemptsEl.textContent = "Attempts: " + attempts;
    const prevBest = stats.bestStreak;
    stats.wins++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    if (hintsThisWord === 0) stats.flawless++;
    saveStats();
    checkAchievements();
    updateStatus();
    hideOverlay();

    const isRecord = stats.bestStreak > prevBest;
    sfx("win");
    confetti(isRecord ? 90 : 60);

    showOverlay(
      "You got it! 🎉",
      `The word was ${current.w}. Solved with ${attempts} ${attempts === 1 ? "attempt" : "attempts"}. Streak ${stats.streak}.` +
        (isRecord ? " New best streak!" : ""),
      [
        {
          label: "Next word",
          onClick: () => {
            hideOverlay();
            newWord(current.w);
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
    return true;
  }

  // ---------- New word ----------
  function loadWord(word, clue) {
    current = { w: String(word).toUpperCase(), clue: clue || "test" };
    scrambled = shuffleWord(current.w);
    answer = new Array(current.w.length).fill("");
    locked = new Array(current.w.length).fill(false);
    selected = null;
    attempts = 0;
    roundOver = false;
    paused = false;
    hintsThisWord = 0;
    hideOverlay();
    renderScramble();
    renderClue();
    renderAnswer();
    updateStatus();
  }

  function newWord(exclude) {
    const picked = pickWord(exclude);
    loadWord(picked.w, picked.clue);
    stats.games++;
    saveStats();
    checkAchievements();
    updateStatus();
    return picked;
  }

  // ---------- Keyboard ----------
  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_ROWS.forEach((letters, r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      for (const ch of letters) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key";
        btn.textContent = ch;
        btn.addEventListener("click", () => {
          audio.unlock();
          insertLetter(ch);
        });
        rowEl.appendChild(btn);
      }
      if (r === 2) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "key key--wide";
        back.textContent = "⌫";
        back.setAttribute("aria-label", "Backspace");
        back.addEventListener("click", () => {
          audio.unlock();
          removeLetter();
        });
        rowEl.appendChild(back);
      }
      keyboardEl.appendChild(rowEl);
    });
  }

  // ---------- Pause ----------
  function canPause() {
    return !roundOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press Esc to resume.", [
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

    // P is a word letter here, so pause lives on Escape.
    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (paused) return;

    if (roundOver) {
      if (e.key === "Enter") {
        if (e.preventDefault) e.preventDefault();
        newWord(current && current.w);
      }
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key || "")) {
      if (e.preventDefault) e.preventDefault();
      insertLetter(e.key.toUpperCase());
    } else if (e.key === "Backspace") {
      if (e.preventDefault) e.preventDefault();
      removeLetter();
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    hintBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      useHint();
    });
    clearBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      clearAnswer();
    });
    newWordBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newWord(current && current.w);
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

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    buildKeyboard();
    newWord(null);
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__JUMBLE = {
    WORDS,
    KEY_ROWS,
    ACHIEVEMENTS,
    stats,
    get current() {
      return current ? { w: current.w, clue: current.clue } : null;
    },
    get scrambled() {
      return scrambled;
    },
    get answer() {
      return answer.slice();
    },
    get locked() {
      return locked.slice();
    },
    get selected() {
      return selected;
    },
    get attempts() {
      return attempts;
    },
    get roundOver() {
      return roundOver;
    },
    get paused() {
      return paused;
    },
    get hintsThisWord() {
      return hintsThisWord;
    },
    snap: () => ({
      word: current ? current.w : null,
      clue: current ? current.clue : null,
      scrambled,
      answer: answer.slice(),
      locked: locked.slice(),
      selected,
      attempts,
      roundOver,
      paused,
      hintsThisWord,
      stats: Object.assign({}, stats),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    shuffleWord,
    pickWord,
    insert: insertLetter,
    remove: removeLetter,
    select: selectBox,
    clear: clearAnswer,
    hint: useHint,
    checkComplete,
    solve: () => {
      for (let i = 0; i < answer.length; i++) answer[i] = current.w[i];
      renderAnswer();
      return checkComplete();
    },
    typeWord: (word) => {
      for (const ch of String(word).toUpperCase()) insertLetter(ch);
    },
    loadWord,
    newWord,
    endGame,
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
