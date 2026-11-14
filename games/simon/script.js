// Simon — pure vanilla JS + WebAudio API, fully offline.
(() => {
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const startBtn = document.getElementById("start");
  const statusEl = document.getElementById("status");

  // Safe storage wrapper — file:// can block localStorage in some browsers.
  const store = {
    get(k, d = 0) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  // Pad order matters: 0=green (top-left), 1=red (top-right), 2=yellow (bottom-left), 3=blue (bottom-right).
  const PADS = [
    { id: "pad-green",  freq: 330 },
    { id: "pad-red",    freq: 262 },
    { id: "pad-yellow", freq: 196 },
    { id: "pad-blue",   freq: 147 },
  ];
  const padEls = PADS.map(p => document.getElementById(p.id));

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, durationMs, type = "sine") {
    const ctx = ensureAudio();
    if (!ctx) return;
    const dur = durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  // Speed of one flash: 750ms at level 1, -30ms per level, minimum 250ms.
  function flashSpeed(level) { return Math.max(250, 750 - 30 * (level - 1)); }

  let sequence, inputIndex, level, state, best;
  let pending = [];
  let overlay;

  best = store.get("simon-best");
  bestEl.textContent = best;

  function clearPending() {
    pending.forEach(id => clearTimeout(id));
    pending = [];
  }

  function setStatus(msg) { statusEl.textContent = msg; }

  function updateHud() {
    levelEl.textContent = level;
    bestEl.textContent = Math.max(best, level);
  }

  function flashPad(i, durationMs) {
    const pad = padEls[i];
    pad.classList.add("active");
    playTone(PADS[i].freq, durationMs);
    pending.push(setTimeout(() => pad.classList.remove("active"), durationMs));
  }

  function playSequence() {
    state = "showing";
    setStatus("Watch the sequence…");
    const speed = flashSpeed(level);
    const toneDur = Math.min(400, speed * 0.65);
    sequence.forEach((padIdx, i) => {
      pending.push(setTimeout(() => flashPad(padIdx, toneDur), 350 + i * speed));
    });
    pending.push(setTimeout(() => {
      state = "input";
      inputIndex = 0;
      setStatus("Your turn — repeat the sequence!");
    }, 350 + sequence.length * speed));
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * PADS.length));
    updateHud();
    playSequence();
  }

  function newGame() {
    clearPending();
    if (overlay) overlay.remove();
    padEls.forEach(p => p.classList.remove("active"));
    ensureAudio();
    sequence = [];
    level = 1;
    state = "showing";
    startBtn.disabled = true;
    updateHud();
    nextRound();
  }

  function endGame() {
    state = "over";
    clearPending();
    padEls.forEach(p => p.classList.remove("active"));
    playTone(110, 700);
    if (level > best) { best = level; store.set("simon-best", best); }
    bestEl.textContent = best;
    startBtn.disabled = false;
    setStatus("Press Start to try again.");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="overlay__box"><h2>Game over 💥</h2>
      <p>Game over — you reached level ${level}. Best: ${best}.</p>
      <button class="btn" id="ov-restart">Play again</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#ov-restart").addEventListener("click", newGame);
  }

  function playerPress(i) {
    if (state !== "input") return;
    flashPad(i, 250);
    if (i === sequence[inputIndex]) {
      inputIndex++;
      if (inputIndex === sequence.length) {
        level++;
        state = "showing";
        setStatus("Nice! Get ready…");
        updateHud();
        pending.push(setTimeout(nextRound, 800));
      }
    } else {
      endGame();
    }
  }

  padEls.forEach((pad, i) => pad.addEventListener("click", () => playerPress(i)));
  startBtn.addEventListener("click", newGame);
  level = 1;
  state = "idle";
})();
