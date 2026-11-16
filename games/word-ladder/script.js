// Word Ladder — puzzle-book ladder puzzle. Pure vanilla JS, fully offline.
// Word list: the Word Tile 808-word list plus an addendum of common 5-letter words.
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
  const startWordEl = dom.byId("start-word");
  const targetWordEl = dom.byId("target-word");
  const chainEl = dom.byId("chain");
  const formEl = dom.byId("rung-form");
  const inputEl = dom.byId("rung-input");
  const messageEl = dom.byId("message");
  const winsEl = dom.byId("wins");
  const streakEl = dom.byId("streak");
  const stepsEl = dom.byId("steps");
  const bestStepsEl = dom.byId("best-steps");
  const hintBtn = dom.byId("hint-btn");
  const undoBtn = dom.byId("undo-btn");
  const giveupBtn = dom.byId("giveup-btn");
  const newPuzzleBtn = dom.byId("new-puzzle");
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

  // ---- Word Tile's 808 words (same list, same words) ----
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

  // ---- Addendum: very common 5-letter words (all uppercase, deduped vs WORDS) ----
  const EXTRA_WORDS = [
    "ACORN","ALLEY","APRIL","ARGON","ATARI","ATOLL","BAGEL","BANJO","BEIGE","BELLS",
    "BELTS","BIRCH","BISON","BOISE","BOOTS","BRACE","BRASH","BROTH","BUGLE","BYTES",
    "CACHE","CAIRO","CAMEL","CAVES","CELLO","CHEER","CHILE","CHILI","CHIME","CHINA",
    "CLAMS","CLOAK","COBRA","CODES","COLON","CRATE","CREPE","CRUST","CURRY","DEBUG",
    "DELHI","DENIM","DONUT","DRUMS","DUNES","EGRET","EGYPT","ELAND","EMACS","FAXES",
    "FERRY","FINCH","FOGGY","FROTH","FRYER","FUDGE","GAMER","GATOR","GECKO","GEODE",
    "GLUON","GOOSE","GORGE","GOWNS","GRAVY","GUAVA","GUPPY","HANOI","HAVEN","HERON",
    "HILLS","HIPPO","HORNS","HYENA","INBOX","INDIA","ITALY","JAPAN","JEANS","JELLY",
    "JOIST","KEFIR","KHAKI","KITTY","KNEES","KOALA","KOREA","KRILL","LADLE","LEMMA",
    "LEMUR","LLAMA","LOCKS","LOGIN","LOLLY","LOUSE","LUNGS","MACAW","MAMBA","MARSH",
    "MELON","MIAMI","MINTS","MISTY","MIXER","MODEM","MOOSE","MOTEL","MOTHS","MUSIC",
    "NADIR","NAVEL","NEWTS","NOKIA","NOTES","NYLON","OASIS","OVARY","OWLET","PANDA",
    "PANTS","PARIS","PATIO","PEACH","PECAN","PERCH","PERKY","PINES","PINOT","PIZZA",
    "PLAID","PRAWN","PROBE","PROSE","PROXY","PRUNE","PUPPY","QUAIL","QUARK","QUEUE",
    "RADON","RAVEN","RHINO","ROBES","ROBOT","ROCKS","RUGBY","SALSA","SATIN","SCALP",
    "SEOUL","SHAFT","SHOAL","SHOES","SHOPS","SHRUB","SILLY","SITAR","SKATE","SLEET",
    "SLOTH","SNAIL","SNOWY","SOCKS","SPAIN","SPICY","SQUAD","SQUID","STACK","STENO",
    "STEPS","STORK","SUEDE","SUSHI","SWELL","SYNTH","SYRAH","SYRUP","TABLA","TAMPA",
    "TANGY","TAURI","TAXIS","TEARS","TEDDY","TENTS","TESLA","THIGH","TIMID","TOKYO",
    "TONGS","TOPAZ","TOURS","TREKS","TROUT","TULLE","TULSA","TWICE","VEINS","VENOM",
    "VESTS","VIOLA","VIPER","WHISK","WITTY","WOODS","XENON","ZESTY"
  ];

  const WORD_LEN = 5;
  const WORD_LIST = [...new Set([...WORDS, ...EXTRA_WORDS])];
  const WORD_SET = new Set(WORD_LIST);

  // Precompute the neighbor graph once (each node checks 5 x 25 letter swaps).
  const ADJ = new Map();
  for (const w of WORD_LIST) ADJ.set(w, []);
  for (const w of WORD_LIST) {
    const letters = w.split("");
    for (let i = 0; i < WORD_LEN; i++) {
      const orig = letters[i];
      for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        if (ch === orig) continue;
        letters[i] = ch;
        const cand = letters.join("");
        if (WORD_SET.has(cand)) ADJ.get(w).push(cand);
      }
      letters[i] = orig;
    }
  }

  const FAST_STEPS = 4; // a win this short counts as a "shortcut"
  const HINT_DEFAULT = "Change one letter per step to climb from the start word to the target word. Esc pauses.";

  const K = makeKeys("word-ladder");

  // ---------- Persistent stats ----------
  const DEFAULT_STATS = {
    games: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    optimalWins: 0, // wins at the shortest possible step count
    noHintWins: 0, // wins without using Hint
    fastWins: 0, // wins in FAST_STEPS or fewer
    steps: 0, // accepted rungs, career
    hints: 0,
    undos: 0,
    bestSteps: 0, // 0 = no best yet
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

  // Carry the pre-core counters (wordladder-wins / wordladder-best-steps) over.
  function migrateLegacy() {
    const legacy = [
      ["wordladder-wins", "wins"],
      ["wordladder-best-steps", "bestSteps"],
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
    { id: "first", icon: "🎯", name: "First Win", desc: "Finish your first ladder.", stat: "wins", goal: 1 },
    { id: "win5", icon: "🔁", name: "Regular", desc: "Finish 5 ladders.", stat: "wins", goal: 5 },
    { id: "win10", icon: "👑", name: "Champion", desc: "Finish 10 ladders.", stat: "wins", goal: 10 },
    { id: "streak2", icon: "🔥", name: "Two in a Row", desc: "Finish 2 ladders in a row.", stat: "bestStreak", goal: 2 },
    { id: "streak3", icon: "🎩", name: "Hat Trick", desc: "Finish 3 ladders in a row.", stat: "bestStreak", goal: 3 },
    { id: "optimal1", icon: "📏", name: "Tight Ladder", desc: "Finish a ladder in the fewest possible steps.", stat: "optimalWins", goal: 1 },
    { id: "optimal5", icon: "🧭", name: "Pathfinder", desc: "Finish 5 ladders with the shortest path.", stat: "optimalWins", goal: 5 },
    { id: "noHint5", icon: "🙈", name: "Unassisted", desc: "Finish 5 ladders without a hint.", stat: "noHintWins", goal: 5 },
    { id: "fastWin", icon: "💨", name: "Shortcut", desc: `Finish a ladder in ${FAST_STEPS} steps or fewer.`, stat: "fastWins", goal: 1 },
    { id: "steps50", icon: "🪜", name: "Steady Climber", desc: "Add 50 rungs in total.", stat: "steps", goal: 50 },
    { id: "hints25", icon: "💡", name: "Helping Hand", desc: "Use 25 hints in total.", stat: "hints", goal: 25 },
    { id: "undo10", icon: "↩️", name: "Second Thoughts", desc: "Undo 10 rungs in total.", stat: "undos", goal: 10 },
    { id: "games20", icon: "🎮", name: "Dedicated", desc: "Play 20 puzzles.", stat: "games", goal: 20 },
    { id: "losses10", icon: "🧠", name: "Persistence", desc: "Give up 10 times — keep trying!", stat: "losses", goal: 10 },
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
        ["Finished", stats.wins],
        ["Give-ups", stats.losses],
        ["Best ladder", stats.bestSteps > 0 ? stats.bestSteps + " steps" : "—"],
        ["Rungs added", stats.steps],
        ["Hints used", stats.hints],
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
  let puzzle = null; // { start, target, distToTarget, originalPath }
  let chain = []; // rungs, chain[0] === start
  let roundOver = false;
  let paused = false;
  let hintUsedThisGame = false;

  // Breadth-first search up to maxDepth levels. Returns distances and BFS parent pointers.
  function bfs(start, maxDepth) {
    const dist = new Map([[start, 0]]);
    const parent = new Map();
    let frontier = [start];
    for (let d = 1; d <= maxDepth && frontier.length; d++) {
      const next = [];
      for (const cur of frontier) {
        for (const nb of ADJ.get(cur) || []) {
          if (!dist.has(nb)) {
            dist.set(nb, d);
            parent.set(nb, cur);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
    return { dist, parent };
  }

  // Known-verified 4-step pair, used only if generation somehow fails entirely.
  const FALLBACK = { start: "BRICK", target: "THANK" }; // BRICK TRICK THICK THINK THANK

  function makePuzzle(start, target, parentFromStart) {
    // BFS from the target gives per-node distances for hints and give-up paths.
    const { dist } = bfs(target, 12);
    const path = [target];
    let cur = target;
    while (cur !== start) {
      cur = parentFromStart.get(cur);
      if (cur === undefined) {
        // Unreachable pair — fall back to the start alone.
        path.length = 0;
        path.push(start);
        break;
      }
      path.unshift(cur);
    }
    return { start, target, distToTarget: dist, originalPath: path };
  }

  function generatePuzzle() {
    // Main attempt: random starts, targets that are 4–6 steps away.
    for (let attempt = 0; attempt < 200; attempt++) {
      const start = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      const { dist, parent } = bfs(start, 6);
      const candidates = [];
      for (const [w, d] of dist) if (d >= 4 && d <= 6) candidates.push(w);
      if (candidates.length) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        return makePuzzle(start, target, parent);
      }
    }
    // Fallback: lower the cap to 3.
    for (let attempt = 0; attempt < 200; attempt++) {
      const start = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      const { dist, parent } = bfs(start, 3);
      const candidates = [];
      for (const [w, d] of dist) if (d === 3) candidates.push(w);
      if (candidates.length) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        return makePuzzle(start, target, parent);
      }
    }
    // Last resort (essentially never happens): a verified 4-step pair.
    const { parent } = bfs(FALLBACK.start, 6);
    return makePuzzle(FALLBACK.start, FALLBACK.target, parent);
  }

  function optimalNext(from) {
    const d = puzzle.distToTarget.get(from);
    if (d === undefined || d === 0) return null;
    const options = [];
    for (const nb of ADJ.get(from) || []) {
      if (puzzle.distToTarget.get(nb) === d - 1) options.push(nb);
    }
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  function optimalLen() {
    if (!puzzle) return 0;
    const d = puzzle.distToTarget.get(puzzle.start);
    return d === undefined ? 0 : d;
  }

  function updateStatus() {
    winsEl.textContent = stats.wins;
    streakEl.textContent = stats.streak;
    stepsEl.textContent = Math.max(0, chain.length - 1);
    bestStepsEl.textContent = stats.bestSteps > 0 ? stats.bestSteps : "—";
  }

  function makeTiles(word, tileClass) {
    const frag = document.createDocumentFragment();
    for (const ch of word) {
      const t = document.createElement("div");
      t.className = tileClass;
      t.textContent = ch;
      frag.appendChild(t);
    }
    return frag;
  }

  function renderEnds() {
    startWordEl.innerHTML = "";
    targetWordEl.innerHTML = "";
    if (!puzzle) return;
    startWordEl.appendChild(makeTiles(puzzle.start, "ladder__tile ladder__tile--start"));
    targetWordEl.appendChild(makeTiles(puzzle.target, "ladder__tile ladder__tile--target"));
  }

  function renderChain() {
    chainEl.innerHTML = "";
    chain.forEach((word, i) => {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "rung__arrow";
        arrow.textContent = "↓";
        chainEl.appendChild(arrow);
      }
      const row = document.createElement("div");
      row.className = "rung";
      if (i === 0) row.classList.add("rung--start");
      else if (word === puzzle.target) row.classList.add("rung--target");
      else if (i === chain.length - 1) row.classList.add("rung--current");
      const num = document.createElement("span");
      num.className = "rung__num";
      num.textContent = i === 0 ? "START" : "STEP " + i;
      const tiles = document.createElement("div");
      tiles.className = "rung__tiles";
      tiles.appendChild(makeTiles(word, "rung__tile"));
      row.appendChild(num);
      row.appendChild(tiles);
      chainEl.appendChild(row);
    });
  }

  function setMessage(text, kind) {
    messageEl.textContent = text || "";
    messageEl.classList.toggle("ladder__message--error", kind === "error");
    messageEl.classList.toggle("ladder__message--hint", kind === "hint");
  }

  function shakeInput() {
    inputEl.classList.remove("ladder__input--shake");
    void inputEl.offsetWidth; // restart the animation
    inputEl.classList.add("ladder__input--shake");
    window.setTimeout(() => inputEl.classList.remove("ladder__input--shake"), 500);
  }

  function addRung(raw) {
    if (roundOver || paused) return;
    const word = String(raw == null ? "" : raw).trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(word)) {
      sfx("error");
      setMessage("Enter a 5-letter word.", "error");
      shakeInput();
      return;
    }
    const prev = chain[chain.length - 1];
    let diff = 0;
    for (let i = 0; i < WORD_LEN; i++) if (word[i] !== prev[i]) diff++;
    if (diff !== 1) {
      sfx("error");
      setMessage(
        diff === 0
          ? "That's the same as the current rung."
          : "Change exactly ONE letter — this differs by " + diff + ".",
        "error"
      );
      shakeInput();
      return;
    }
    if (!WORD_SET.has(word)) {
      sfx("error");
      setMessage('"' + word + '" is not in the word list.', "error");
      shakeInput();
      return;
    }
    chain.push(word);
    stats.steps++;
    saveStats();
    checkAchievements();
    inputEl.value = "";
    sfx("place");
    renderChain();
    updateStatus();
    if (word === puzzle.target) return endGame();
    setMessage("", null);
  }

  function undo() {
    if (roundOver || paused || chain.length <= 1) return;
    chain.pop();
    stats.undos++;
    saveStats();
    checkAchievements();
    sfx("flip");
    renderChain();
    updateStatus();
    setMessage("", null);
    inputEl.focus();
  }

  function useHint() {
    if (roundOver || paused) return;
    const from = chain[chain.length - 1];
    const next = optimalNext(from);
    if (!next) {
      sfx("error");
      setMessage("No link from here to the target. Try Undo, or give up.", "error");
      inputEl.focus();
      return;
    }
    stats.hints++;
    hintUsedThisGame = true;
    saveStats();
    checkAchievements();
    inputEl.value = next;
    sfx("hint");
    setMessage("Hint: " + next + " — now press Add Step.", "hint");
    inputEl.focus();
  }

  function buildSolutionText() {
    const path = [];
    let cur = chain[chain.length - 1];
    while (cur !== puzzle.target && path.length < 60) {
      const nxt = optimalNext(cur);
      if (!nxt) break;
      path.push(nxt);
      cur = nxt;
    }
    const remaining =
      path.length && path[path.length - 1] === puzzle.target
        ? path
        : puzzle.originalPath.slice(1);
    return remaining.length ? remaining.join(" → ") : puzzle.target;
  }

  function giveUp() {
    if (roundOver || paused) return;
    roundOver = true;
    hintUsedThisGame = false;
    inputEl.disabled = true;
    stats.games++;
    stats.losses++;
    stats.streak = 0;
    saveStats();
    checkAchievements();
    updateStatus();
    sfx("over");
    showOverlay(
      "Solution 🏳",
      `From your current rung: ${buildSolutionText()}. No win credited.`,
      [
        { label: "New puzzle", onClick: () => { hideOverlay(); newPuzzle(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function endGame() {
    if (roundOver) return;
    roundOver = true;
    inputEl.disabled = true;
    const steps = chain.length - 1;
    const best = optimalLen();
    stats.games++;
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (best > 0 && steps === best) stats.optimalWins++;
    if (!hintUsedThisGame) stats.noHintWins++;
    if (steps <= FAST_STEPS) stats.fastWins++;
    const newBest = stats.bestSteps === 0 || steps < stats.bestSteps;
    if (newBest) stats.bestSteps = steps;
    saveStats();
    checkAchievements();
    renderChain();
    updateStatus();

    sfx("win");
    confetti(90);
    const stepsLabel = steps === 1 ? "step" : "steps";
    showOverlay(
      "You made it! 🎉",
      `${puzzle.start} → ${puzzle.target} in ${steps} ${stepsLabel}${newBest ? " — a new best!" : "."} ` +
        `Wins: ${stats.wins} · Best ever: ${stats.bestSteps} ${stats.bestSteps === 1 ? "step" : "steps"}.`,
      [
        { label: "New puzzle", onClick: () => { hideOverlay(); newPuzzle(); } },
        { label: "Badges", ghost: true, onClick: () => openAchv() },
      ]
    );
  }

  function resetRound() {
    chain = [puzzle.start];
    roundOver = false;
    paused = false;
    hintUsedThisGame = false;
    inputEl.disabled = false;
    inputEl.value = "";
    setMessage("", null);
    renderEnds();
    renderChain();
    updateStatus();
    hintEl.textContent = HINT_DEFAULT;
    inputEl.focus();
  }

  function newPuzzle() {
    hideOverlay();
    puzzle = generatePuzzle();
    resetRound();
  }

  // ---------- Pause ----------
  function setPaused(p) {
    if (roundOver || paused === p) return;
    paused = p;
    inputEl.disabled = p;
    if (p) {
      showOverlay("Paused", "Take a breath — press Esc or hit Resume.", [
        { label: "Resume", onClick: () => { hideOverlay(); setPaused(false); } },
        { label: "New puzzle", ghost: true, onClick: () => { hideOverlay(); setPaused(false); newPuzzle(); } },
      ]);
    } else {
      hideOverlay();
      inputEl.focus();
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

    // Escape works even from the text input — P does not, because P is a letter.
    if (e.key === "Escape") {
      if (e.preventDefault) e.preventDefault();
      togglePause();
      return;
    }

    const tag = String((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
  }

  function bindEvents() {
    inputEl.addEventListener("input", () => {
      inputEl.value = inputEl.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, WORD_LEN);
    });
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      audio.unlock();
      addRung(inputEl.value);
    });

    hintBtn.addEventListener("click", () => { sfx("click"); useHint(); });
    undoBtn.addEventListener("click", () => { sfx("click"); undo(); });
    giveupBtn.addEventListener("click", () => { sfx("click"); giveUp(); });
    newPuzzleBtn.addEventListener("click", () => { sfx("click"); newPuzzle(); });

    const badges2 = dom.byId("badges2");
    badgesBtn.addEventListener("click", () => { sfx("click"); openAchv(); });
    if (badges2) badges2.addEventListener("click", () => { sfx("click"); openAchv(); });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", () => {
      if (!roundOver && !paused && achvModal.hidden) setPaused(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !roundOver && !paused && achvModal.hidden) setPaused(true);
    });

    audio.bindUnlock();
  }

  // ---------- Init ----------
  function init() {
    migrateLegacy();
    updateBadgeCount();
    bindEvents();
    newPuzzle();
    renderAchvGrid();
  }

  // Test hook — harmless in normal play.
  window.__WORDLADDER = {
    WORD_LEN,
    FAST_STEPS,
    WORD_LIST,
    WORD_SET,
    ADJ,
    get puzzle() { return puzzle ? { start: puzzle.start, target: puzzle.target } : null; },
    get chain() { return chain.slice(); },
    get steps() { return Math.max(0, chain.length - 1); },
    get optimalLen() { return optimalLen(); },
    get roundOver() { return roundOver; },
    get paused() { return paused; },
    get hintUsed() { return hintUsedThisGame; },
    stats,
    ACHIEVEMENTS,
    bfs,
    makePuzzle,
    generatePuzzle,
    optimalNext,
    addRung,
    undo,
    useHint,
    giveUp,
    endGame,
    newPuzzle,
    // Test-only: install a puzzle directly.
    setPuzzle: (start, target) => {
      const s = String(start).toUpperCase();
      const t = String(target).toUpperCase();
      hideOverlay();
      const { parent } = bfs(s, 12);
      puzzle = makePuzzle(s, t, parent);
      resetRound();
    },
    // Test-only: install a chain without validating every rung.
    setChain: (words) => {
      chain = words.map((w) => String(w).toUpperCase());
      roundOver = false;
      paused = false;
      inputEl.disabled = false;
      renderChain();
      updateStatus();
    },
    solution: () => (puzzle ? puzzle.originalPath.slice(1) : []),
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
