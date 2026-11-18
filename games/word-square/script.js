// Word Square — puzzle-book word squares, fully offline. Pure vanilla JS.
// Shared plumbing (storage, audio, toasts, overlay, confetti, badges, modal)
// comes from ../../js/arcade-core.js.
(() => {
  "use strict";

  const {
    store,
    keys: makeKeys,
    util,
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
  const formatTime = util.formatTime;

  // ---------- DOM ----------
  const boardEl = dom.byId("board");
  const winsEl = dom.byId("wins");
  const timeEl = dom.byId("time");
  const bestEl = dom.byId("best");
  const puzzleEl = dom.byId("puzzle");
  const wordsEl = dom.byId("words");

  const hintBtn = dom.byId("hint");
  const starterBtn = dom.byId("starter");
  const revealWordBtn = dom.byId("reveal-word");
  const resetBtn = dom.byId("reset");
  const newPuzzleBtn = dom.byId("new-puzzle");

  const badgesBtn = dom.byId("badges-btn");
  const badgeCountEl = dom.byId("badge-count");
  const soundBtn = dom.byId("sound-btn");
  const soundIconEl = dom.byId("sound-icon");

  const achvModal = dom.byId("achv-modal");
  const achvGrid = dom.byId("achv-grid");
  const achvCountEl = dom.byId("achv-count");
  const achvRecordsEl = dom.byId("achv-records");

  const K = makeKeys("word-square");

  // 13 puzzles; the solution grid is the five words stacked.
  const PUZZLES = [
    ["BEACH", "EXTRA", "ATLAS", "CRAFT", "HASTE"],
    ["BEAST", "EARTH", "ARMOR", "STONE", "THREE"],
    ["BLAST", "LUNAR", "ANKLE", "SALON", "TREND"],
    ["BLEND", "LEVER", "EVERY", "NERVE", "DRYER"],
    ["CAUSE", "ALPHA", "UPPER", "SHEET", "EARTH"],
    ["CHAOS", "HAUNT", "AUDIO", "ONION", "STONE"],
    ["DELTA", "EMAIL", "LARGE", "TIGER", "ALERT"],
    ["FORGE", "OPERA", "REFER", "GREAT", "EARTH"],
    ["FROST", "RULER", "OLIVE", "SEVEN", "TREND"],
    ["GRASS", "RURAL", "ARGUE", "SAUCE", "SLEEP"],
    ["NOBLE", "OCEAN", "BEAST", "LASER", "ENTRY"],
    ["PASTA", "ACTOR", "STAKE", "TOKEN", "ARENA"],
    ["PIANO", "INPUT", "APART", "NURSE", "OTTER"],
  ];

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

  const SIZE = 5;
  const LINE_COUNT = SIZE * 2;

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    hints: 0,
    flawless: 0,
    bestTime: 0,
    solved: [],
  };

  const storedStats = store.json(K.stats, null);
  const stats = Object.assign(
    {},
    DEFAULT_STATS,
    storedStats && typeof storedStats === "object" && !Array.isArray(storedStats) ? storedStats : {}
  );
  for (const key of Object.keys(DEFAULT_STATS)) {
    if (key === "solved") continue;
    if (!Number.isFinite(stats[key])) stats[key] = DEFAULT_STATS[key];
  }
  if (!Array.isArray(stats.solved)) stats.solved = [];

  function saveStats() {
    store.jsonSet(K.stats, stats);
  }

  // The pre-core build only kept a win count.
  function migrateLegacy() {
    const raw = store.get("wordsquare-wins", null);
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > stats.wins) stats.wins = n;
      store.remove("wordsquare-wins");
      saveStats();
    }
  }

  // "Lower is better" time badges: goal is in seconds, the stat in ms.
  function timeBadge(id, icon, name, desc, seconds) {
    const limit = seconds * 1000;
    return {
      id,
      icon,
      name,
      desc,
      stat: "bestTime",
      goal: seconds,
      satisfied: () => (stats.bestTime || 0) > 0 && stats.bestTime <= limit,
      progress: () => {
        const ms = stats.bestTime || 0;
        if (!ms) return { pct: 0, text: "No square yet" };
        if (ms <= limit) return { pct: 100, text: "Unlocked" };
        return { pct: Math.min(100, (limit / ms) * 100), text: `Best ${formatTime(ms)}` };
      },
    };
  }

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎉", name: "First Square", desc: "Complete your first word square.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔲", name: "Square Deal", desc: "Complete 5 word squares.", stat: "wins", goal: 5 },
    { id: "win10", icon: "🏅", name: "Grid Smith", desc: "Complete 10 word squares.", stat: "wins", goal: 10 },
    { id: "win25", icon: "👑", name: "Square Master", desc: "Complete 25 word squares.", stat: "wins", goal: 25 },
    { id: "games10", icon: "🎮", name: "Ten Grids", desc: "Start 10 word squares.", stat: "games", goal: 10 },
    { id: "games25", icon: "🗂️", name: "Puzzle Shelf", desc: "Start 25 word squares.", stat: "games", goal: 25 },
    { id: "hint10", icon: "💡", name: "Nudge", desc: "Use 10 hints.", stat: "hints", goal: 10 },
    { id: "hint50", icon: "🔦", name: "Hint Happy", desc: "Use 50 hints.", stat: "hints", goal: 50 },
    timeBadge("quick300", "⏱️", "Under Five", "Finish a square in under 5:00.", 300),
    timeBadge("quick180", "⚡", "Under Three", "Finish a square in under 3:00.", 180),
    timeBadge("quick120", "🚀", "Under Two", "Finish a square in under 2:00.", 120),
    { id: "flawless1", icon: "✨", name: "Clean Square", desc: "Finish without using a hint.", stat: "flawless", goal: 1 },
    { id: "flawless5", icon: "🧼", name: "Spotless", desc: "Finish 5 squares without hints.", stat: "flawless", goal: 5 },
    {
      id: "allSquares",
      icon: "🗺️",
      name: "Every Square",
      desc: "Finish every puzzle in the set.",
      stat: "wins",
      goal: PUZZLES.length,
      satisfied: () => stats.solved.length >= PUZZLES.length,
      progress: () => ({
        pct: Math.min(100, (stats.solved.length / PUZZLES.length) * 100),
        text: `${stats.solved.length} / ${PUZZLES.length} squares`,
      }),
    },
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
        ["Puzzles", stats.games],
        ["Solved", stats.wins],
        ["Hints", stats.hints],
        ["Best time", stats.bestTime ? formatTime(stats.bestTime) : "—"],
        ["Squares", `${stats.solved.length}/${PUZZLES.length}`],
      ],
    });
  }

  const achvModalCtl = modalApi.create(achvModal, {
    onOpen: () => {
      renderAchvGrid();
      if (!gameOver && !paused) setPaused(true);
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
  let puzzleIndex = -1;
  let solution = [];        // 5x5 letters from the chosen puzzle
  let grid = [];            // 5x5 current letters ("" when empty)
  let locked = [];          // 5x5 booleans (hint-revealed cells)
  let cellEls = [];         // 5x5 button elements
  let selected = { r: 0, c: 0 };
  let gameOver = false;
  let paused = false;
  let hintsThisPuzzle = 0;

  // Timer: elapsedMs holds finished segments, runningSince the live one.
  let elapsedMs = 0;
  let runningSince = 0;
  let timerOn = false;
  let timerId = 0;
  let solveMs = 0;

  function clockMs() {
    return elapsedMs + (runningSince ? Date.now() - runningSince : 0);
  }

  function tickClock() {
    timeEl.textContent = formatTime(clockMs());
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    elapsedMs = 0;
    runningSince = Date.now();
    timerOn = true;
    solveMs = 0;
    tickClock();
    timerId = setInterval(tickClock, 250);
  }

  function stopTimer() {
    if (runningSince) {
      elapsedMs += Date.now() - runningSince;
      runningSince = 0;
    }
    timerOn = false;
    if (timerId) clearInterval(timerId);
    timerId = 0;
    tickClock();
  }

  function pauseTimer() {
    if (timerOn && runningSince) {
      elapsedMs += Date.now() - runningSince;
      runningSince = 0;
    }
  }

  function resumeTimer() {
    if (timerOn && !runningSince) runningSince = Date.now();
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
    bestEl.textContent = stats.bestTime ? formatTime(stats.bestTime) : "—";
    tickClock();
  }

  // ---- Board ----
  function buildBoard() {
    boardEl.innerHTML = "";
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      cellEls.push([]);
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.className = "ws-cell";
        cell.type = "button";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(cell);
        cellEls[r].push(cell);
      }
    }
    refresh();
  }

  function cellLabel(r, c) {
    const letter = grid[r][c];
    return (
      `Row ${r + 1}, column ${c + 1}${letter ? ", " + letter : ", empty"}` +
      (locked[r][c] ? ", locked" : "")
    );
  }

  function refresh() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = cellEls[r][c];
        if (!cell) continue;
        cell.textContent = grid[r][c];
        cell.classList.toggle("selected", r === selected.r && c === selected.c);
        cell.classList.toggle("locked", locked[r][c]);
        cell.setAttribute("aria-label", cellLabel(r, c));
      }
    }
    const valid = checkLines();
    if (wordsEl) wordsEl.textContent = valid + "/" + LINE_COUNT;
  }

  function selectCell(r, c) {
    if (gameOver || paused) return false;
    if (r === selected.r && c === selected.c) return false;
    selected = { r, c };
    refresh();
    sfx("select");
    return true;
  }

  function lineWords() {
    const lines = [];
    for (let r = 0; r < SIZE; r++) {
      lines.push({
        cells: [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]],
        word: grid[r].join(""),
        across: true,
      });
    }
    for (let c = 0; c < SIZE; c++) {
      let word = "";
      for (let r = 0; r < SIZE; r++) word += grid[r][c];
      lines.push({
        cells: [[0, c], [1, c], [2, c], [3, c], [4, c]],
        word,
        across: false,
      });
    }
    return lines;
  }

  // Highlight every row/column that currently spells a dictionary word.
  function checkLines() {
    const lines = lineWords();
    const validSet = new Set();
    let validCount = 0;
    for (const line of lines) {
      // An empty cell makes the word shorter than SIZE.
      if (line.word.length === SIZE && WORDS_SET.has(line.word)) {
        validCount++;
        for (const [r, c] of line.cells) validSet.add(r * SIZE + c);
      }
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = cellEls[r] && cellEls[r][c];
        if (cell) cell.classList.toggle("valid", validSet.has(r * SIZE + c));
      }
    }
    return validCount;
  }

  // ---- Input ----
  function typeLetter(ch) {
    if (gameOver || paused) return false;
    const { r, c } = selected;
    if (locked[r][c]) {
      advance(1);
      return false;
    }
    grid[r][c] = ch;
    refresh();
    sfx("letter");
    if (winCheck()) return true;
    advance(1);
    return true;
  }

  function erase() {
    if (gameOver || paused) return false;
    const { r, c } = selected;
    if (!locked[r][c] && grid[r][c]) {
      grid[r][c] = "";
      refresh();
      sfx("erase");
      return true;
    }
    // Step back to the previous non-locked cell and clear it.
    let idx = r * SIZE + c - 1;
    while (idx >= 0) {
      const pr = Math.floor(idx / SIZE);
      const pc = idx % SIZE;
      if (!locked[pr][pc]) {
        selected = { r: pr, c: pc };
        if (grid[pr][pc]) {
          grid[pr][pc] = "";
          refresh();
          sfx("erase");
          return true;
        }
        refresh();
        return false;
      }
      idx--;
    }
    refresh();
    return false;
  }

  function advance(delta) {
    let idx = selected.r * SIZE + selected.c;
    for (let i = 0; i < SIZE * SIZE; i++) {
      idx = (idx + delta + SIZE * SIZE) % (SIZE * SIZE);
      const r = Math.floor(idx / SIZE);
      const c = idx % SIZE;
      if (!locked[r][c]) {
        selected = { r, c };
        break;
      }
    }
    refresh();
  }

  function moveSelection(dr, dc) {
    if (gameOver || paused) return false;
    const r = Math.min(SIZE - 1, Math.max(0, selected.r + dr));
    const c = Math.min(SIZE - 1, Math.max(0, selected.c + dc));
    if (r === selected.r && c === selected.c) return false;
    selected = { r, c };
    refresh();
    sfx("select");
    return true;
  }

  // ---- Win ----
  function winCheck() {
    if (gameOver) return true;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) return false;
    if (checkLines() < LINE_COUNT) return false;
    endGame();
    return true;
  }

  function endGame() {
    if (gameOver) return false;
    gameOver = true;
    paused = false;
    stopTimer();
    solveMs = clockMs();

    stats.wins++;
    if (hintsThisPuzzle === 0) stats.flawless++;
    if (puzzleIndex >= 0 && stats.solved.indexOf(puzzleIndex) === -1) {
      stats.solved.push(puzzleIndex);
    }
    const isRecord = solveMs > 0 && (!stats.bestTime || solveMs < stats.bestTime);
    if (isRecord) stats.bestTime = solveMs;
    saveStats();
    checkAchievements();
    updateStatus();

    sfx("win");
    confetti(isRecord ? 90 : 60);

    showOverlay(
      "Square Complete! 🎉",
      `All five rows and all five columns are words. Solved in ${formatTime(solveMs)}.` +
        (isRecord ? " New best time!" : ""),
      [
        {
          label: "Play again",
          onClick: () => {
            hideOverlay();
            newGame();
          },
        },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
    return true;
  }

  // ---- Hint / reset ----
  function hint() {
    if (gameOver || paused) return false;
    const candidates = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!locked[r][c] && grid[r][c] !== solution[r][c]) candidates.push([r, c]);
    if (candidates.length === 0) {
      sfx("error");
      return false;
    }
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    grid[r][c] = solution[r][c];
    locked[r][c] = true;
    hintsThisPuzzle++;
    stats.hints++;
    saveStats();
    refresh();
    sfx("hint");
    checkAchievements();
    winCheck();
    return true;
  }

  // Reveal solution letters, lock them, and charge one hint per letter
  // (the same accounting as the single-cell Hint).
  function revealCells(cells) {
    let changed = 0;
    for (const [r, c] of cells) {
      if (locked[r][c]) continue;
      grid[r][c] = solution[r][c];
      locked[r][c] = true;
      changed++;
    }
    if (!changed) return 0;
    hintsThisPuzzle += changed;
    stats.hints += changed;
    saveStats();
    refresh();
    sfx("hint");
    checkAchievements();
    winCheck();
    return changed;
  }

  function startingLetters() {
    if (gameOver || paused) return 0;
    // In a symmetric word square, the diagonal is the first letter of
    // each of the five words.
    const cells = [];
    for (let i = 0; i < SIZE; i++) if (!locked[i][i]) cells.push([i, i]);
    if (!cells.length) {
      sfx("error");
      return 0;
    }
    return revealCells(cells);
  }

  function revealWord() {
    if (gameOver || paused) return 0;
    // Offer a row that is not already fully revealed.
    const rows = [];
    for (let r = 0; r < SIZE; r++) {
      let complete = true;
      for (let c = 0; c < SIZE; c++) {
        if (!locked[r][c]) {
          complete = false;
          break;
        }
      }
      if (!complete) rows.push(r);
    }
    if (!rows.length) {
      sfx("error");
      return 0;
    }
    const r = rows[Math.floor(Math.random() * rows.length)];
    const cells = [];
    for (let c = 0; c < SIZE; c++) cells.push([r, c]);
    return revealCells(cells);
  }

  function reset() {
    if (gameOver || paused) return false;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!locked[r][c]) grid[r][c] = "";
    startTimer();
    refresh();
    sfx("erase");
    return true;
  }

  // ---- Puzzles ----
  function setPuzzle(index) {
    const n = Number(index);
    const idx = Math.max(
      0,
      Math.min(PUZZLES.length - 1, Number.isFinite(n) ? Math.floor(n) : 0)
    );
    puzzleIndex = idx;
    solution = PUZZLES[idx].map((word) => word.split(""));
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(""));
    locked = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    selected = { r: 0, c: 0 };
    gameOver = false;
    paused = false;
    hintsThisPuzzle = 0;
    solveMs = 0;
    puzzleEl.textContent = `${idx + 1} / ${PUZZLES.length}`;
    hideOverlay();
    buildBoard();
    startTimer();
    updateStatus();
    return PUZZLES[idx].slice();
  }

  function newGame() {
    let idx = Math.floor(Math.random() * PUZZLES.length);
    if (PUZZLES.length > 1 && idx === puzzleIndex) idx = (idx + 1) % PUZZLES.length;
    stats.games++;
    saveStats();
    setPuzzle(idx);
    checkAchievements();
    updateStatus();
    return PUZZLES[idx].slice();
  }

  // ---- Pause ----
  function canPause() {
    return !gameOver;
  }

  function setPaused(p) {
    if (!canPause() || paused === p) return;
    paused = p;
    if (p) {
      pauseTimer();
      showOverlay("Paused", "The clock is stopped — press Esc to resume.", [
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
      resumeTimer();
      hideOverlay();
    }
  }

  function togglePause() {
    setPaused(!paused);
  }

  // ---- Input ----
  function onKeyDown(e) {
    if (!achvModal.hidden) {
      if (e.key === "Escape") {
        if (e.preventDefault) e.preventDefault();
        closeAchv();
      }
      return;
    }

    // Every letter is gameplay input here, so pause lives on Escape.
    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    if (paused || gameOver) return;

    const key = String(e.key || "");
    if (/^[a-zA-Z]$/.test(key)) {
      if (e.preventDefault) e.preventDefault();
      typeLetter(key.toUpperCase());
    } else if (key === "Backspace" || key === "Delete") {
      if (e.preventDefault) e.preventDefault();
      erase();
    } else if (key === "ArrowUp") {
      if (e.preventDefault) e.preventDefault();
      moveSelection(-1, 0);
    } else if (key === "ArrowDown") {
      if (e.preventDefault) e.preventDefault();
      moveSelection(1, 0);
    } else if (key === "ArrowLeft") {
      if (e.preventDefault) e.preventDefault();
      moveSelection(0, -1);
    } else if (key === "ArrowRight") {
      if (e.preventDefault) e.preventDefault();
      moveSelection(0, 1);
    }
  }

  function bindEvents() {
    document.addEventListener("keydown", onKeyDown);

    hintBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      hint();
    });
    if (starterBtn)
      starterBtn.addEventListener("click", () => {
        audio.unlock();
        sfx("click");
        startingLetters();
      });
    if (revealWordBtn)
      revealWordBtn.addEventListener("click", () => {
        audio.unlock();
        sfx("click");
        revealWord();
      });
    resetBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      reset();
    });
    newPuzzleBtn.addEventListener("click", () => {
      audio.unlock();
      sfx("click");
      newGame();
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

  // ---- Init ----
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newGame();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__WORDSQUARE = {
    PUZZLES,
    WORDS,
    WORDS_SET,
    SIZE,
    LINE_COUNT,
    ACHIEVEMENTS,
    stats,
    get puzzleIndex() {
      return puzzleIndex;
    },
    get solution() {
      return solution.map((row) => row.slice());
    },
    get grid() {
      return grid.map((row) => row.slice());
    },
    get locked() {
      return locked.map((row) => row.slice());
    },
    get selected() {
      return { r: selected.r, c: selected.c };
    },
    get gameOver() {
      return gameOver;
    },
    get paused() {
      return paused;
    },
    get hintsThisPuzzle() {
      return hintsThisPuzzle;
    },
    get solveMs() {
      return solveMs;
    },
    elapsed: clockMs,
    cell: (r, c) => (grid[r] ? grid[r][c] : undefined),
    snap: () => ({
      puzzleIndex,
      size: SIZE,
      solution: solution.map((row) => row.slice()),
      grid: grid.map((row) => row.slice()),
      locked: locked.map((row) => row.slice()),
      selected: { r: selected.r, c: selected.c },
      gameOver,
      paused,
      elapsed: clockMs(),
      solveMs,
      hintsThisPuzzle,
      stats: Object.assign({}, stats, { solved: stats.solved.slice() }),
      unlocked: achv.list(),
      overlayTitle: overlay.info().title,
      overlayMsg: overlay.info().msg,
    }),
    lineWords,
    checkLines,
    select: selectCell,
    type: typeLetter,
    erase,
    move: moveSelection,
    advance,
    hint,
    startingLetters,
    revealWord,
    reset,
    setPuzzle,
    newGame,
    solve: () => {
      if (gameOver) return false;
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) grid[r][c] = solution[r][c];
      refresh();
      return winCheck();
    },
    setElapsed: (ms) => {
      // Test hook: pin the clock so assertions are deterministic.
      elapsedMs = Math.max(0, Number(ms) || 0);
      runningSince = 0;
      tickClock();
    },
    winCheck,
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
