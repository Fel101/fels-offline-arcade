// Word Square â€” puzzle-book word squares, fully offline. Pure vanilla JS.
(() => {
  const boardEl = document.getElementById("board");
  const winsEl = document.getElementById("wins");
  const timeEl = document.getElementById("time");
  const puzzleEl = document.getElementById("puzzle");

  // Safe storage wrapper â€” file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

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
  let puzzleIndex = -1;
  let solution = [];        // 5x5 letters from the stored solution
  let grid = [];            // 5x5 current letters ("" when empty)
  let locked = [];          // 5x5 booleans (hint-revealed cells)
  let cellEls = [];         // 5x5 button elements
  let selected = { r: 0, c: 0 };
  let gameOver = false;
  let wins = store.get("wordsquare-wins");
  let timerId, startTime;

  function startTimer() {
    clearInterval(timerId);
    startTime = Date.now();
    timeEl.textContent = "0";
    timerId = setInterval(() => { timeEl.textContent = Math.floor((Date.now() - startTime) / 1000); }, 500);
  }

  function updateStatus() { winsEl.textContent = wins; }

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

  function refresh() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = cellEls[r][c];
        cell.textContent = grid[r][c];
        cell.classList.toggle("selected", r === selected.r && c === selected.c);
        cell.classList.toggle("locked", locked[r][c]);
      }
    }
    checkLines();
  }

  function selectCell(r, c) {
    selected = { r, c };
    refresh();
  }

  function lineWords() {
    const lines = [];
    for (let r = 0; r < SIZE; r++) lines.push({ cells: [[r,0],[r,1],[r,2],[r,3],[r,4]], word: grid[r].join("") });
    for (let c = 0; c < SIZE; c++) {
      let word = "";
      for (let r = 0; r < SIZE; r++) word += grid[r][c];
      lines.push({ cells: [[0,c],[1,c],[2,c],[3,c],[4,c]], word });
    }
    return lines;
  }

  // Highlight every row/column that currently spells a dictionary word. Returns count of valid lines.
  function checkLines() {
    const lines = lineWords();
    const validSet = new Set();
    let validCount = 0;
    for (const line of lines) {
      // grid cells are single chars or ""; a short word means an empty cell somewhere.
      if (line.word.length === SIZE && WORDS_SET.has(line.word)) {
        validCount++;
        for (const [r, c] of line.cells) validSet.add(r * SIZE + c);
      }
    }
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        cellEls[r][c].classList.toggle("valid", validSet.has(r * SIZE + c));
    return validCount;
  }

  // ---- Input ----
  function typeLetter(ch) {
    if (gameOver) return;
    const { r, c } = selected;
    if (locked[r][c]) { advance(1); return; }
    grid[r][c] = ch;
    refresh();
    winCheck();
    if (!gameOver) advance(1);
  }

  function erase() {
    if (gameOver) return;
    let { r, c } = selected;
    if (!locked[r][c] && grid[r][c]) {
      grid[r][c] = "";
      refresh();
      return;
    }
    // Step back to the previous non-locked cell and clear it.
    let idx = r * SIZE + c - 1;
    while (idx >= 0) {
      const pr = Math.floor(idx / SIZE), pc = idx % SIZE;
      if (!locked[pr][pc]) {
        selected = { r: pr, c: pc };
        if (grid[pr][pc]) grid[pr][pc] = "";
        refresh();
        return;
      }
      idx--;
    }
    refresh();
  }

  function advance(delta) {
    let idx = selected.r * SIZE + selected.c;
    for (let i = 0; i < SIZE * SIZE; i++) {
      idx = (idx + delta + SIZE * SIZE) % (SIZE * SIZE);
      const r = Math.floor(idx / SIZE), c = idx % SIZE;
      if (!locked[r][c]) { selected = { r, c }; break; }
    }
    refresh();
  }

  function moveSelection(dr, dc) {
    const r = Math.min(SIZE - 1, Math.max(0, selected.r + dr));
    const c = Math.min(SIZE - 1, Math.max(0, selected.c + dc));
    selected = { r, c };
    refresh();
  }

  // ---- Win ----
  let overlay;
  function winCheck() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) return false;
    if (checkLines() < SIZE * 2) return false;
    endGame();
    return true;
  }

  function endGame() {
    gameOver = true;
    clearInterval(timerId);
    wins++;
    store.set("wordsquare-wins", wins);
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Square Complete! ðŸŽ‰</h2><p>All 5 rows and all 5 columns are words. Nicely done!</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  // ---- Buttons ----
  function hint() {
    if (gameOver) return;
    const candidates = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!locked[r][c] && grid[r][c] !== solution[r][c]) candidates.push([r, c]);
    if (candidates.length === 0) return;
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    grid[r][c] = solution[r][c];
    locked[r][c] = true;
    refresh();
    winCheck();
  }

  function reset() {
    if (overlay) overlay.remove();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!locked[r][c]) grid[r][c] = "";
    gameOver = false;
    startTimer();
    refresh();
  }

  function newGame() {
    if (overlay) overlay.remove();
    let idx = Math.floor(Math.random() * PUZZLES.length);
    if (PUZZLES.length > 1 && idx === puzzleIndex) idx = (idx + 1) % PUZZLES.length; // never the same back-to-back
    puzzleIndex = idx;
    solution = PUZZLES[puzzleIndex].map(word => word.split(""));
    grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(""));
    locked = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    selected = { r: 0, c: 0 };
    gameOver = false;
    puzzleEl.textContent = `${puzzleIndex + 1} / ${PUZZLES.length}`;
    buildBoard();
    startTimer();
  }

  document.getElementById("hint").addEventListener("click", hint);
  document.getElementById("reset").addEventListener("click", reset);
  document.getElementById("new-puzzle").addEventListener("click", newGame);

  document.addEventListener("keydown", e => {
    if (gameOver) return;
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
    else if (e.key === "Backspace") { e.preventDefault(); erase(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1, 0); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(0, -1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(0, 1); }
  });

  updateStatus();
  newGame();
})();
