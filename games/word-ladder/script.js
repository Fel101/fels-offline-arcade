// Word Ladder — puzzle-book ladder puzzle. Pure vanilla JS, fully offline.
// Word list: the Word Tile 808-word list plus an addendum of common 5-letter words.
(() => {
  const startWordEl = document.getElementById("start-word");
  const targetWordEl = document.getElementById("target-word");
  const chainEl = document.getElementById("chain");
  const formEl = document.getElementById("rung-form");
  const inputEl = document.getElementById("rung-input");
  const messageEl = document.getElementById("message");
  const winsEl = document.getElementById("wins");
  const stepsEl = document.getElementById("steps");
  const bestStepsEl = document.getElementById("best-steps");
  const hintBtn = document.getElementById("hint-btn");
  const undoBtn = document.getElementById("undo-btn");
  const giveupBtn = document.getElementById("giveup-btn");
  const newPuzzleBtn = document.getElementById("new-puzzle");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

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

  let wins = store.get("wordladder-wins");
  let bestSteps = store.get("wordladder-best-steps"); // 0 = no best yet

  let puzzle = null;      // { start, target, distToTarget, originalPath }
  let chain = [];         // rungs, chain[0] === start
  let roundOver = false;
  let overlay = null;

  // Breadth-first search up to maxDepth levels. Returns distances and BFS parent pointers.
  function bfs(start, maxDepth) {
    const dist = new Map([[start, 0]]);
    const parent = new Map();
    let frontier = [start];
    for (let d = 1; d <= maxDepth && frontier.length; d++) {
      const next = [];
      for (const cur of frontier) {
        for (const nb of ADJ.get(cur)) {
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
    const { dist } = bfs(target, 6);
    const path = [target];
    let cur = target;
    while (cur !== start) {
      cur = parentFromStart.get(cur);
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
    for (const nb of ADJ.get(from)) {
      if (puzzle.distToTarget.get(nb) === d - 1) options.push(nb);
    }
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  function updateStatus() {
    winsEl.textContent = wins;
    stepsEl.textContent = Math.max(0, chain.length - 1);
    bestStepsEl.textContent = bestSteps > 0 ? bestSteps : "—";
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
    setTimeout(() => inputEl.classList.remove("ladder__input--shake"), 500);
  }

  function addRung(raw) {
    if (roundOver) return;
    const word = raw.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(word)) {
      setMessage("Enter a 5-letter word.", "error");
      shakeInput();
      return;
    }
    const prev = chain[chain.length - 1];
    let diff = 0;
    for (let i = 0; i < WORD_LEN; i++) if (word[i] !== prev[i]) diff++;
    if (diff !== 1) {
      setMessage(diff === 0
        ? "That's the same as the current rung."
        : "Change exactly ONE letter — this differs by " + diff + ".", "error");
      shakeInput();
      return;
    }
    if (!WORD_SET.has(word)) {
      setMessage('"' + word + '" is not in the word list.', "error");
      shakeInput();
      return;
    }
    chain.push(word);
    inputEl.value = "";
    renderChain();
    updateStatus();
    if (word === puzzle.target) return endGame();
    setMessage("", null);
  }

  function undo() {
    if (roundOver || chain.length <= 1) return;
    chain.pop();
    renderChain();
    updateStatus();
    setMessage("", null);
    inputEl.focus();
  }

  function useHint() {
    if (roundOver) return;
    const from = chain[chain.length - 1];
    const next = optimalNext(from);
    if (!next) {
      setMessage("No link from here to the target. Try Undo, or give up.", "error");
      inputEl.focus();
      return;
    }
    inputEl.value = next;
    setMessage("Hint: " + next + " — now press Add Step.", "hint");
    inputEl.focus();
  }

  function giveUp() {
    if (roundOver) return;
    roundOver = true;
    inputEl.disabled = true;
    // Walk the optimal path from the current rung; if we're stuck on a dead
    // branch, fall back to the solution from the start.
    const path = [];
    let cur = chain[chain.length - 1];
    while (cur !== puzzle.target && path.length < 60) {
      const nxt = optimalNext(cur);
      if (!nxt) break;
      path.push(nxt);
      cur = nxt;
    }
    const remaining = path.length && path[path.length - 1] === puzzle.target
      ? path
      : puzzle.originalPath.slice(1);
    const fromLabel = path.length ? "From your current rung" : "One possible solution";
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Solution 🏳</h2>
      <p>${fromLabel}:</p>
      <div class="ladder__solution">${remaining.map(w => w).join("<br>")}</div>
      <p>No win credited.</p>
      <button class="btn" id="ov-restart">New puzzle</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newPuzzle);
  }

  function endGame() {
    roundOver = true;
    inputEl.disabled = true;
    const steps = chain.length - 1;
    wins++;
    let newBest = false;
    if (bestSteps === 0 || steps < bestSteps) {
      bestSteps = steps;
      newBest = true;
    }
    store.set("wordladder-wins", wins);
    store.set("wordladder-best-steps", bestSteps);
    renderChain();
    updateStatus();
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>You made it! 🎉</h2>
      <p>${puzzle.start} → ${puzzle.target} in ${steps} ${steps === 1 ? "step" : "steps"}${newBest ? " — a new best!" : "."}</p>
      <p>Wins: ${wins} · Best ever: ${bestSteps} ${bestSteps === 1 ? "step" : "steps"}</p>
      <button class="btn" id="ov-restart">New puzzle</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newPuzzle);
  }

  function newPuzzle() {
    if (overlay) overlay.remove();
    puzzle = generatePuzzle();
    chain = [puzzle.start];
    roundOver = false;
    inputEl.disabled = false;
    inputEl.value = "";
    setMessage("", null);
    renderEnds();
    renderChain();
    updateStatus();
    inputEl.focus();
  }

  inputEl.addEventListener("input", () => {
    inputEl.value = inputEl.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, WORD_LEN);
  });
  formEl.addEventListener("submit", e => {
    e.preventDefault();
    addRung(inputEl.value);
  });

  hintBtn.addEventListener("click", useHint);
  undoBtn.addEventListener("click", undo);
  giveupBtn.addEventListener("click", giveUp);
  newPuzzleBtn.addEventListener("click", newPuzzle);

  newPuzzle();
})();
