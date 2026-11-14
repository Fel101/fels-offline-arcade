// Word Tile — offline Wordle-style word game. Pure vanilla JS, word list inline.
(() => {
  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const winsEl = document.getElementById("wins");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best");
  const toastEl = document.getElementById("toast");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

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

  let answer, row, col, current, gameOver;
  let grid = [];          // 6 x 5 letters
  let tileEls = [];       // 6 x 5 tile elements
  let keyEls = {};        // letter -> key button
  let keyState = {};      // letter -> "green" | "yellow" | "gray"
  let toastTimer;

  let wins = store.get("wordle-wins");
  let streak = store.get("wordle-streak");
  let bestStreak = store.get("wordle-best-streak");

  function updateStatus() {
    winsEl.textContent = wins;
    streakEl.textContent = streak;
    bestEl.textContent = bestStreak;
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
    btn.addEventListener("click", onClick);
    if (label.length === 1) keyEls[label] = btn;
    return btn;
  }

  // ---- Input ----
  function addLetter(ch) {
    if (gameOver || col >= WORD_LEN) return;
    grid[row][col] = ch;
    const tile = tileEls[row][col];
    tile.textContent = ch;
    tile.classList.add("filled");
    col++;
    current = grid[row].join("");
  }

  function removeLetter() {
    if (gameOver || col <= 0) return;
    col--;
    grid[row][col] = "";
    const tile = tileEls[row][col];
    tile.textContent = "";
    tile.classList.remove("filled");
    current = grid[row].join("");
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
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
    if (gameOver || col < WORD_LEN) return;
    const guess = grid[row].join("");
    if (!WORDS_SET.has(guess)) { showToast("Not in word list"); return; }

    const result = scoreGuess(guess, answer);
    for (let i = 0; i < WORD_LEN; i++) tileEls[row][i].classList.add(result[i]);
    for (let i = 0; i < WORD_LEN; i++) updateKey(guess[i], result[i]);

    if (guess === answer) return endGame(true);
    row++;
    col = 0;
    if (row >= MAX_ROWS) endGame(false);
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
  let overlay;
  function endGame(won) {
    gameOver = true;
    if (won) {
      wins++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    store.set("wordle-wins", wins);
    store.set("wordle-streak", streak);
    store.set("wordle-best-streak", bestStreak);
    updateStatus();

    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    const title = won ? "You got it! 🎉" : "Out of tries 😔";
    const msg = won
      ? `The word was ${answer}. Solved in ${row + 1} ${row === 0 ? "guess" : "guesses"}.`
      : `The word was ${answer}. Better luck next time!`;
    overlay.innerHTML = `<div class="overlay__box"><h2>${title}</h2><p>${msg}</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", reset);
  }

  function reset() {
    if (overlay) overlay.remove();
    answer = WORDS[Math.floor(Math.random() * WORDS.length)];
    row = 0; col = 0; current = "";
    gameOver = false;
    keyState = {};
    buildBoard();
    buildKeyboard();
    updateStatus();
  }

  document.addEventListener("keydown", e => {
    if (gameOver) {
      if (e.key === "Enter") reset();
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) addLetter(e.key.toUpperCase());
    else if (e.key === "Enter") submitGuess();
    else if (e.key === "Backspace") removeLetter();
  });

  document.getElementById("new-game").addEventListener("click", reset);
  reset();
})();
