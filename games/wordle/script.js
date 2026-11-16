// Word Tile — offline Wordle-style word game. Pure vanilla JS, word list inline.
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
  const boardEl = dom.byId("board");
  const keyboardEl = dom.byId("keyboard");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const bestEl = dom.byId("best");
  const newGameBtn = dom.byId("new-game");
  const hintEl = dom.byId("hint");

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
  const WORDS = [
    "ABOUT","ABOVE","ABUSE","ACTOR","ACUTE","ADMIT","ADOPT","ADORE","ADULT","AFTER",
    "AGAIN","AGENT","AGREE","AHEAD","ALARM","ALBUM","ALERT","ALIKE","ALIVE","ALLOW",
    "ALONE","ALONG","ALOUD","ALPHA","ALTAR","AMBER","AMEND","AMPLE","AMUSE","ANGEL",
    "ANGER","ANGLE","ANGRY","ANKLE","APART","APPLE","APPLY","ARENA","ARGUE","ARISE",
    "ARMOR","AROMA","ARRAY","ARROW","ASIDE","ASSET","ATLAS","ATTIC","AUDIO","AUDIT",
    "AVOID","AWAKE","AWARD","AWARE","AWFUL","AXIOM","BACON","BADGE","BADLY","BAKER",
    "BALER","BATON","BEACH","BEARD","BEAST","BEGAN","BEGIN","BEING","BELLY","BENCH",
    "BERRY","BIRTH","BLACK","BLADE","BLAME","BLANK","BLAST","BLAZE","BLEND","BLESS",
    "BLIND","BLINK","BLISS","BLOCK","BLOOM","BLUNT","BOARD","BOAST","BONUS","BOOST",
    "BOOTH","BOUND","BRAIN","BRAND","BRAVE","BREAD","BREAK","BREED","BRICK","BRIDE",
    "BRIEF","BRINE","BRING","BRINK","BRISK","BROAD","BROOK","BROWN","BRUSH","BUDDY",
    "BUILD","BUNCH","BURST","BUYER","CABIN","CABLE","CANDY","CANOE","CARGO","CARRY",
    "CARVE","CATCH","CAUSE","CEASE","CEDAR","CHAIN","CHAIR","CHALK","CHANT","CHAOS",
    "CHARM","CHART","CHASE","CHEEK","CHESS","CHEST","CHIEF","CHILD","CHILL","CHOIR",
    "CHOSE","CHUNK","CIDER","CIVIC","CIVIL","CLAIM","CLASS","CLEAN","CLEAR","CLERK",
    "CLICK","CLIFF","CLIMB","CLOCK","CLOSE","CLOTH","CLOUD","COACH","COAST","COCOA",
    "COLOR","COMET","CORAL","COUCH","COUGH","COUNT","COURT","COVER","CRACK","CRAFT",
    "CRANE","CRASH","CRAWL","CRAZE","CRAZY","CREAM","CREEK","CREST","CRIME","CRISP",
    "CROSS","CROWD","CROWN","CRUDE","CRUEL","CRUSH","CURVE","CYCLE","DAISY","DAILY",
    "DAIRY","DANCE","DEBUT","DECAY","DECOR","DELAY","DELTA","DENSE","DEPOT","DEPTH",
    "DIARY","DINER","DITCH","DODGE","DONOR","DOUBT","DOUGH","DOZEN","DRAFT","DRAIN",
    "DRAKE","DRAMA","DRANK","DREAM","DRESS","DRIED","DRIFT","DRILL","DRINK","DRIVE",
    "DROVE","DRYER","DUSTY","DWARF","DWELL","DWELT","EAGER","EAGLE","EARLY","EARTH",
    "EIGHT","ELBOW","ELDER","ELECT","ELITE","ELUDE","EMAIL","EMBED","EMERY","EMPTY",
    "ENEMY","ENJOY","ENTER","ENTRY","EQUAL","EQUIP","ERROR","ESSAY","ETHIC","EVADE",
    "EVENT","EVERY","EXACT","EXIST","EXTRA","FABLE","FACET","FAINT","FAIRY","FAITH",
    "FALSE","FANCY","FAULT","FAVOR","FEAST","FENCE","FEVER","FIBER","FIELD","FIERY",
    "FIFTY","FIGHT","FILLY","FINAL","FIRST","FIXED","FLAME","FLASH","FLEET","FLESH",
    "FLING","FLOAT","FLOCK","FLOOD","FLOOR","FLOUR","FLUTE","FLYER","FOCAL","FOCUS",
    "FORCE","FORGE","FORTH","FORTY","FORUM","FOUND","FRAME","FRESH","FRIED","FRONT",
    "FROST","FROWN","FRUIT","FUNNY","GHOST","GIANT","GLAND","GLASS","GLEAM","GLIDE",
    "GLOBE","GLOOM","GLORY","GLOVE","GRACE","GRADE","GRAIN","GRAND","GRANT","GRAPE",
    "GRAPH","GRASP","GRASS","GREAT","GREED","GREEN","GREET","GRIEF","GRILL","GRIND",
    "GROOM","GROSS","GROUP","GROVE","GROWN","GUARD","GUESS","GUEST","GUIDE","GUILD",
    "HABIT","HAPPY","HARSH","HASTE","HASTY","HATCH","HAUNT","HEARD","HEART","HEAVY",
    "HEDGE","HENCE","HOBBY","HONEY","HONOR","HORSE","HOTEL","HOUND","HOUSE","HOVER",
    "HUMAN","HUMOR","HURRY","IDEAL","IMAGE","IMPLY","INDEX","INFER","INNER","INPUT",
    "IRONY","ISSUE","IVORY","JEWEL","JOINT","JOKER","JOLLY","JUDGE","JUICE","KARMA",
    "KAYAK","KEBAB","KNIFE","KNOCK","KNOWN","LABEL","LABOR","LANCE","LARGE","LASER",
    "LATCH","LATER","LAUGH","LAYER","LEARN","LEASE","LEAST","LEAVE","LEDGE","LEGAL",
    "LEMON","LEVEL","LEVER","LIGHT","LILAC","LIMIT","LINEN","LIVER","LOBBY","LOCAL",
    "LODGE","LOGIC","LOOSE","LUCKY","LUNAR","LUNCH","MAGIC","MAJOR","MAKER","MANGO",
    "MAPLE","MARCH","MATCH","MAYBE","MAYOR","MEDAL","MERCY","MERRY","METAL","METER",
    "MIGHT","MINOR","MINUS","MIXED","MODEL","MOIST","MONEY","MONTH","MORAL","MOTOR",
    "MOUNT","MOUSE","MOUTH","MOVIE","NAIVE","NERVE","NEVER","NEWLY","NIGHT","NOBLE",
    "NOISE","NORTH","NOVEL","NURSE","OCEAN","OFFER","OFTEN","OLIVE","ONION","OPERA",
    "ORBIT","ORDER","OTHER","OTTER","OUNCE","PAINT","PANEL","PANIC","PAPER","PARTY",
    "PASTA","PATCH","PEACE","PEARL","PENNY","PHASE","PHONE","PHOTO","PIANO","PIECE",
    "PILOT","PINCH","PITCH","PIVOT","PIXEL","PLACE","PLAIN","PLANE","PLANK","PLANT",
    "PLATE","PLAZA","POINT","POLAR","PORCH","POUND","POWER","PRESS","PRICE","PRIDE",
    "PRIME","PRINT","PRIOR","PRIZE","PROOF","PROUD","QUEEN","QUEST","QUICK","QUIET",
    "QUILT","QUITE","RADAR","RADIO","RAISE","RALLY","RANCH","RANGE","RAPID","RATIO",
    "REACH","REACT","READY","REALM","REBEL","REFER","REIGN","RELAX","RELAY","RENEW",
    "REPLY","RHYME","RIDER","RIDGE","RIGHT","RINSE","RISKY","RIVER","ROAST","ROBIN",
    "ROCKY","ROUGH","ROUND","ROUTE","ROYAL","RULER","RUMOR","RURAL","SADLY","SALAD",
    "SALON","SANDY","SAUCE","SCALE","SCARE","SCARF","SCENE","SCENT","SCOOP","SCORE",
    "SCOUT","SCRAP","SCREW","SENSE","SERVE","SEVEN","SHADE","SHAKE","SHALL","SHAME",
    "SHAPE","SHARE","SHARK","SHARP","SHEEP","SHEER","SHEET","SHELF","SHELL","SHIFT",
    "SHINE","SHINY","SHIRT","SHOCK","SHORE","SHORT","SHOUT","SHOWN","SIGHT","SINCE",
    "SIXTH","SKILL","SKIRT","SLATE","SLEEP","SLICE","SLIDE","SLOPE","SMALL","SMART",
    "SMILE","SMOKE","SNACK","SNAKE","SNEAK","SOLAR","SOLID","SOLVE","SORRY","SOUND",
    "SOUTH","SPACE","SPARE","SPARK","SPEAK","SPEED","SPELL","SPEND","SPICE","SPILL",
    "SPINE","SPLIT","SPOKE","SPOON","SPORT","SPRAY","STAFF","STAGE","STAIR","STAKE",
    "STALE","STAMP","STAND","STARE","START","STATE","STEAK","STEAL","STEAM","STEEL",
    "STEEP","STEER","STICK","STILL","STOCK","STONE","STOOD","STORE","STORM","STORY",
    "STOVE","STRAP","STRAW","STRIP","STUCK","STUDY","STUFF","STYLE","SUGAR","SUITE",
    "SUNNY","SUPER","SURGE","SWAMP","SWEAR","SWEAT","SWEEP","SWEET","SWIFT","SWING",
    "SWORD","TABLE","TAKEN","TASTE","TEACH","TEETH","TEMPO","TENSE","THANK","THEFT",
    "THEIR","THERE","THESE","THICK","THIEF","THING","THINK","THIRD","THORN","THOSE",
    "THREE","THREW","THROW","THUMB","TIGER","TIGHT","TIMER","TIRED","TITLE","TOAST",
    "TODAY","TOKEN","TOOTH","TOPIC","TORCH","TOTAL","TOUCH","TOUGH","TOWEL","TOWER",
    "TOXIC","TRACE","TRACK","TRADE","TRAIL","TRAIN","TRAIT","TREAD","TREAT","TREND",
    "TRIAL","TRIBE","TRICK","TROOP","TRUCK","TRULY","TRUNK","TRUST","TULIP","ULTRA",
    "UNCLE","UNION","UNITY","UNTIL","UPPER","UPSET","URBAN","USAGE","USUAL","UTTER",
    "VAGUE","VALID","VALUE","VALVE","VAPOR","VAULT","VENUE","VERSE","VIGOR","VILLA",
    "VINYL","VIRUS","VISIT","VISTA","VITAL","VIVID","VOCAL","VOICE","VOTER","WAFER",
    "WAGON","WAIST","WAIVE","WALTZ","WASTE","WATCH","WATER","WEARY","WEDGE","WEIGH",
    "WEIRD","WHALE","WHEAT","WHEEL","WHERE","WHICH","WHILE","WHINE","WHIRL","WHITE",
    "WHOLE","WHOOP","WIDEN","WIDOW","WIDTH","WINDY","WIPER","WIRED","WOMAN","WORLD",
    "WORRY","WORSE","WORST","WORTH","WOULD","WOUND","WOVEN","WRIST","WRITE","WRONG",
    "WROTE","YACHT","YEAST","YIELD","YOUNG","YOURS","YOUTH","ZEBRA",
  ];

  const WORDS_SET = new Set(WORDS);
  const MAX_ROWS = 6, WORD_LEN = 5;
  const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const RANK = { gray: 1, yellow: 2, green: 3 };
  const FAST_GUESSES = 4; // a win in <= 4 guesses counts as a "fast" win
  const HINT_DEFAULT = "Guess the 5-letter word in 6 tries. Green = right spot, yellow = wrong spot, gray = not in word. Esc pauses.";

  const K = makeKeys("wordle");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    winsIn2: 0,
    winsIn3: 0,
    winsOnSix: 0,
    fastWins: 0,
    comebackWins: 0,
    totalGuesses: 0,
    prevOutcome: "",
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (typeof DEFAULT_STATS[key] === "number" && !Number.isFinite(stats[key])) {
      stats[key] = DEFAULT_STATS[key];
    }
  }
  if (stats.prevOutcome !== "win" && stats.prevOutcome !== "loss") stats.prevOutcome = "";

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // Carry the pre-core counters (wordle-wins / -streak / -best-streak) over.
  function migrateLegacy() {
    const legacy = [
      ["wordle-wins", "wins"],
      ["wordle-streak", "streak"],
      ["wordle-best-streak", "bestStreak"],
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
    { id: "winIn3", icon: "🎯", name: "Sharp", desc: "Solve a word in 3 guesses or fewer.", stat: "winsIn3", goal: 1 },
    { id: "winIn2", icon: "🍀", name: "Two-Shot", desc: "Solve a word in 2 guesses.", stat: "winsIn2", goal: 1 },
    { id: "winIn6", icon: "😅", name: "Clutch", desc: "Solve a word on the sixth and final guess.", stat: "winsOnSix", goal: 1 },
    { id: "fast5", icon: "💨", name: "Lightning", desc: `Solve 5 words within ${FAST_GUESSES} guesses.`, stat: "fastWins", goal: 5 },
    { id: "comeback", icon: "💪", name: "Comeback", desc: "Win the game right after a loss.", stat: "comebackWins", goal: 1 },
    { id: "guesses100", icon: "🔤", name: "Wordsmith", desc: "Make 100 guesses in total.", stat: "totalGuesses", goal: 100 },
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
        ["Solved", stats.wins],
        ["Losses", stats.losses],
        ["Best streak", stats.bestStreak],
        ["Guesses made", stats.totalGuesses],
        ["Solved in 3", stats.winsIn3],
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
  let answer, row, col, current, gameOver;
  let paused = false;
  let grid = [];          // 6 x 5 letters
  let tileEls = [];       // 6 x 5 tile elements
  let keyEls = {};        // letter -> key button
  let keyState = {};      // letter -> "green" | "yellow" | "gray"

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    bestEl.textContent = stats.bestStreak;
  }

  // ---- Board / keyboard construction ----
  function buildBoard() {
    boardEl.innerHTML = "";
    tileEls = [];
    grid = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      grid.push(new Array(WORD_LEN).fill(""));
      tileEls.push([]);
      const rowEl = document.createElement("div");
      rowEl.className = "wrow";
      for (let c = 0; c < WORD_LEN; c++) {
        const tile = document.createElement("div");
        tile.className = "wtile";
        rowEl.appendChild(tile);
        tileEls[r].push(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    keyEls = {};
    KEY_ROWS.forEach((letters, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard__row";
      if (i === 2) rowEl.appendChild(makeKey("Enter", "key key--wide", submitGuess));
      for (const ch of letters) rowEl.appendChild(makeKey(ch, "key", () => addLetter(ch)));
      if (i === 2) rowEl.appendChild(makeKey("⌫", "key key--wide", removeLetter));
      keyboardEl.appendChild(rowEl);
    });
  }

  function makeKey(label, className, onClick) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      audio.unlock();
      onClick();
    });
    if (label.length === 1) keyEls[label] = btn;
    return btn;
  }

  // ---- Input ----
  function addLetter(ch) {
    if (gameOver || paused || col >= WORD_LEN) return;
    grid[row][col] = ch;
    const tile = tileEls[row][col];
    tile.textContent = ch;
    tile.classList.add("filled");
    col++;
    current = grid[row].join("");
    sfx("tick");
  }

  function removeLetter() {
    if (gameOver || paused || col <= 0) return;
    col--;
    grid[row][col] = "";
    const tile = tileEls[row][col];
    tile.textContent = "";
    tile.classList.remove("filled");
    current = grid[row].join("");
    sfx("tick");
  }

  // Standard coloring: greens first, then yellows from the remaining unmatched letters.
  function scoreGuess(guess, target) {
    const result = new Array(WORD_LEN).fill("gray");
    const remaining = {};
    for (let i = 0; i < WORD_LEN; i++) {
      if (guess[i] === target[i]) result[i] = "green";
      else remaining[target[i]] = (remaining[target[i]] || 0) + 1;
    }
    for (let i = 0; i < WORD_LEN; i++) {
      if (result[i] === "green") continue;
      const ch = guess[i];
      if (remaining[ch] > 0) { result[i] = "yellow"; remaining[ch]--; }
    }
    return result;
  }

  function submitGuess() {
    if (gameOver || paused || col < WORD_LEN) return;
    const guess = grid[row].join("");
    if (!WORDS_SET.has(guess)) {
      sfx("error");
      toast.show("Not in word list", "Try a different five-letter word.", "⚠️");
      return;
    }

    const guessNo = row + 1;
    stats.totalGuesses++;
    const result = scoreGuess(guess, answer);
    for (let i = 0; i < WORD_LEN; i++) tileEls[row][i].classList.add(result[i]);
    for (let i = 0; i < WORD_LEN; i++) updateKey(guess[i], result[i]);

    if (guess === answer) return endGame(true, guessNo);
    row++;
    col = 0;
    if (row >= MAX_ROWS) return endGame(false, guessNo);
    sfx("place");
    saveStats();
    checkAchievements();
  }

  function updateKey(ch, state) {
    const prev = keyState[ch];
    if (prev && RANK[prev] >= RANK[state]) return;
    keyState[ch] = state;
    const btn = keyEls[ch];
    if (!btn) return;
    btn.classList.remove("green", "yellow", "gray");
    btn.classList.add(state);
  }

  // ---- Game flow ----
  function endGame(won, guesses) {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    stats.games++;
    const used = guesses || (won ? row + 1 : MAX_ROWS);
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (used <= 2) stats.winsIn2++;
      if (used <= 3) stats.winsIn3++;
      if (used === MAX_ROWS) stats.winsOnSix++;
      if (used <= FAST_GUESSES) stats.fastWins++;
      if (stats.prevOutcome === "loss") stats.comebackWins++;
      stats.prevOutcome = "win";
    } else {
      stats.losses++;
      stats.streak = 0;
      stats.prevOutcome = "loss";
    }
    saveStats();
    checkAchievements();
    updateStatus();

    const buttons = [
      { label: "Play again", onClick: () => { hideOverlay(); newGame(); } },
      { label: "Badges", ghost: true, onClick: () => openAchv() },
    ];
    if (won) {
      sfx("win");
      confetti(90);
      showOverlay(
        "You got it! 🎉",
        `The word was ${answer}. Solved in ${used} guess${used === 1 ? "" : "es"}. Streak ${stats.streak}.`,
        buttons
      );
    } else {
      sfx("over");
      showOverlay("Out of tries 😔", `The word was ${answer}. Better luck next time!`, buttons);
    }
  }

  function newGame() {
    hideOverlay();
    answer = WORDS[Math.floor(Math.random() * WORDS.length)];
    row = 0; col = 0; current = "";
    gameOver = false;
    paused = false;
    keyState = {};
    hintEl.textContent = HINT_DEFAULT;
    buildBoard();
    buildKeyboard();
    updateStatus();
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

    const key = String(e.key || "");
    // P is a guess letter here (APPLE, PAPER…), so pause lives on Escape.
    if (key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (paused && !gameOver) return;

    if (gameOver) {
      if (key === "Enter") newGame();
      return;
    }
    if (/^[a-zA-Z]$/.test(key)) addLetter(key.toUpperCase());
    else if (key === "Enter") submitGuess();
    else if (key === "Backspace") removeLetter();
  }

  function bindEvents() {
    newGameBtn.addEventListener("click", () => { sfx("click"); newGame(); });

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
  window.__WORDLE = {
    WORDS,
    WORDS_SET,
    MAX_ROWS,
    WORD_LEN,
    KEY_ROWS,
    RANK,
    FAST_GUESSES,
    get answer() { return answer; },
    get row() { return row; },
    get col() { return col; },
    get current() { return current; },
    get gameOver() { return gameOver; },
    get paused() { return paused; },
    get grid() { return grid.map((r) => r.slice()); },
    get keyState() { return Object.assign({}, keyState); },
    stats,
    ACHIEVEMENTS,
    scoreGuess,
    addLetter,
    removeLetter,
    submitGuess,
    newGame,
    // Test-only: pin the target word.
    setAnswer: (word) => { answer = String(word).toUpperCase(); },
    typeWord: (word) => {
      for (const ch of String(word).toUpperCase()) addLetter(ch);
    },
    guess: (word) => {
      for (const ch of String(word).toUpperCase()) addLetter(ch);
      submitGuess();
    },
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
