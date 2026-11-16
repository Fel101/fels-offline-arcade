/* ============================================================
   Offline Arcade — shared game core
   Pure vanilla JS, no dependencies, no build step.
   Works fully offline via file://

   This module holds the plumbing that every arcade game repeats:
   storage, seeded randomness, time formatting, sound effects,
   toasts, overlays, confetti, badge/achievement rendering, and
   the animation-frame loop.

   Usage:  <script src="../../js/arcade-core.js"></script>
           <script src="script.js"></script>

   Then inside your IIFE:

     const { store, keys, util, audio, toast, overlay, badges, confetti, loop } =
       window.Arcade;

   Everything is defensive: if a browser API is missing (localStorage,
   AudioContext, matchMedia) the core degrades quietly instead of throwing.
   ============================================================ */

(function (global) {
  "use strict";

  const win = global;

  /* ---------------------------------------------------------
     Storage — file:// can block localStorage in some browsers.
     The backing store is resolved lazily so the core also works
     in test harnesses that provide a bare global `localStorage`.
     --------------------------------------------------------- */
  function backingStore() {
    try {
      if (win.localStorage) return win.localStorage;
    } catch {
      /* access itself threw */
    }
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch {
      /* ignore */
    }
    return null;
  }

  const store = {
    get(key, fallback) {
      try {
        const ls = backingStore();
        if (!ls) return fallback;
        const v = ls.getItem(key);
        return v === null || v === undefined ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        const ls = backingStore();
        if (ls) ls.setItem(key, String(value));
      } catch {
        /* storage blocked — game still works, just without persistence */
      }
    },
    remove(key) {
      try {
        const ls = backingStore();
        if (ls) ls.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    json(key, fallback) {
      try {
        const raw = this.get(key, null);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    jsonSet(key, value, replacer) {
      try {
        this.set(key, JSON.stringify(value, replacer || null));
      } catch {
        /* circular or blocked — ignore */
      }
    },
  };

  /* ---------------------------------------------------------
     Standard storage key names. One namespace per game, so
     games never collide.

     keys("boggle") -> {
       best:  (mode, size) => "boggle-best-v1-classic-4",
       stats: "boggle-stats-v1",
       achv:  "boggle-achv-v1",
       sound: "boggle-sound",
       mode:  "boggle-mode",
       size:  "boggle-size",
       diff:  "boggle-diff",
       daily: "boggle-daily-v1",
       ...
     }
     --------------------------------------------------------- */
  function keys(game, extra) {
    const base = {
      game,
      best: (mode, size) =>
        size === undefined || size === null
          ? `${game}-best-v1-${mode}`
          : `${game}-best-v1-${mode}-${size}`,
      stats: `${game}-stats-v1`,
      achv: `${game}-achv-v1`,
      sound: `${game}-sound`,
      mode: `${game}-mode`,
      size: `${game}-size`,
      diff: `${game}-diff`,
      daily: `${game}-daily-v1`,
    };
    if (extra && typeof extra === "object") Object.assign(base, extra);
    return base;
  }

  /* ---------------------------------------------------------
     Small utilities.
     --------------------------------------------------------- */
  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /** ms -> "m:ss" */
  function formatTime(ms) {
    const total = Math.max(0, ms) / 1000;
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${pad2(s)}`;
  }

  /** ms -> "m:ss.t" (tenths) — handy for sprint timers */
  function formatTimeTenths(ms) {
    const total = Math.max(0, ms) / 1000;
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const t = Math.floor((total * 10) % 10);
    return `${m}:${pad2(s)}.${t}`;
  }

  /** Local calendar date as "YYYY-MM-DD". */
  function dateStr(d) {
    const date = d || new Date();
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /** Yesterday's date string. */
  function yesterdayStr(d) {
    const date = new Date((d || new Date()).getTime());
    date.setDate(date.getDate() - 1);
    return dateStr(date);
  }

  /** FNV-1a 32-bit string hash. */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Small, fast, deterministic PRNG. Returns a function in [0, 1). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** rand() seeded from a string — the standard "Daily puzzle" recipe. */
  function seeded(str) {
    return mulberry32(hashSeed(String(str)));
  }

  function randInt(rand, n) {
    return Math.floor(rand() * n);
  }

  function choice(rand, arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  /** Fisher–Yates, returns a new array. */
  function shuffle(rand, arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function countBy(arr, fn) {
    const out = new Map();
    for (const item of arr) {
      const k = fn(item);
      out.set(k, (out.get(k) || 0) + 1);
    }
    return out;
  }

  /** True when the OS asks for reduced motion. Safe to call repeatedly. */
  function prefersReducedMotion() {
    try {
      return !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  }

  /** True on touch-first / small screens — used to show on-screen controls. */
  function isCoarsePointer() {
    try {
      return !!(win.matchMedia && win.matchMedia("(pointer: coarse)").matches);
    } catch {
      return false;
    }
  }

  const util = {
    clamp,
    pad2,
    formatTime,
    formatTimeTenths,
    dateStr,
    yesterdayStr,
    hashSeed,
    mulberry32,
    seeded,
    randInt,
    choice,
    shuffle,
    countBy,
    prefersReducedMotion,
    isCoarsePointer,
  };

  /* ---------------------------------------------------------
     Audio — tiny oscillator SFX. No files, no dependencies.
     Sounds stay silent until the first user gesture unlocks
     the AudioContext, which is what browsers require anyway.
     --------------------------------------------------------- */

  // [frequency, startOffset, duration, waveType, volume, endFrequency?]
  const SFX_LIBRARY = {
    click: [[600, 0, 0.035, "sine", 0.02]],
    select: [[640, 0, 0.035, "sine", 0.02]],
    place: [
      [440, 0, 0.05, "triangle", 0.035],
      [660, 0.04, 0.06, "triangle", 0.03],
    ],
    pop: [[500, 0, 0.05, "sine", 0.03]],
    word: [
      [620, 0, 0.07, "triangle", 0.04],
      [880, 0.055, 0.1, "triangle", 0.04],
    ],
    long: [
      [660, 0, 0.08, "triangle", 0.045],
      [880, 0.07, 0.08, "triangle", 0.045],
      [1100, 0.14, 0.14, "triangle", 0.045],
    ],
    combo: [
      [700, 0, 0.06, "triangle", 0.04],
      [1050, 0.05, 0.09, "triangle", 0.04],
    ],
    error: [[190, 0, 0.14, "sawtooth", 0.035, 110]],
    hint: [
      [520, 0, 0.08, "sine", 0.035],
      [780, 0.07, 0.12, "sine", 0.035],
    ],
    flip: [[420, 0, 0.05, "triangle", 0.03]],
    match: [
      [700, 0, 0.07, "triangle", 0.04],
      [1050, 0.06, 0.11, "triangle", 0.04],
    ],
    tick: [[880, 0, 0.03, "sine", 0.02]],
    win: [
      [523, 0, 0.12, "sine", 0.05],
      [659, 0.1, 0.12, "sine", 0.05],
      [784, 0.2, 0.16, "sine", 0.05],
      [1047, 0.32, 0.3, "sine", 0.045],
    ],
    over: [
      [330, 0, 0.18, "sine", 0.045],
      [262, 0.14, 0.22, "sine", 0.045],
      [196, 0.3, 0.4, "sine", 0.04],
    ],
    achv: [
      [587, 0, 0.1, "triangle", 0.04],
      [740, 0.09, 0.1, "triangle", 0.04],
      [880, 0.18, 0.16, "triangle", 0.04],
    ],
  };

  let soundOn = true;
  let actx = null;
  let audioUnlocked = false;
  let customSfx = Object.create(null);

  function ensureAudio() {
    try {
      if (!actx) {
        const AC = win.AudioContext || win.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === "suspended" && actx.resume) actx.resume();
    } catch {
      actx = null;
    }
  }

  function unlockAudio() {
    audioUnlocked = true;
    ensureAudio();
  }

  /** Register game-specific sounds, e.g. audio.define("flip", [[520,0,0.06]]) */
  function defineSfx(name, notes) {
    if (!name || !Array.isArray(notes)) return;
    customSfx[name] = notes;
  }

  function playNotes(notes) {
    try {
      const t = actx.currentTime;
      for (const note of notes) {
        const freq = note[0];
        const start = note[1] || 0;
        const dur = note[2] === undefined ? 0.08 : note[2];
        const type = note[3] || "sine";
        const vol = note[4] === undefined ? 0.04 : note[4];
        const endFreq = note[5];
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t + start);
        if (endFreq) {
          o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + start + dur);
        }
        g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(vol, t + start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(g).connect(actx.destination);
        o.start(t + start);
        o.stop(t + start + dur + 0.03);
      }
    } catch {
      /* audio is a nice-to-have */
    }
  }

  function sfx(name) {
    if (!soundOn || !audioUnlocked) return;
    ensureAudio();
    if (!actx) return;
    const notes = customSfx[name] || SFX_LIBRARY[name];
    if (notes) playNotes(notes);
  }

  /**
   * Play a single tone at an arbitrary pitch — used by Simon-style games.
   * freq in Hz, durationMs in milliseconds.
   */
  function tone(freq, durationMs, type, vol) {
    if (!soundOn || !audioUnlocked) return;
    ensureAudio();
    if (!actx) return;
    const dur = Math.max(0.03, (durationMs || 200) / 1000);
    playNotes([[freq, 0, dur, type || "sine", vol === undefined ? 0.3 : vol]]);
  }

  function setSoundEnabled(on, opts) {
    soundOn = !!on;
    // Only create/resume the AudioContext in response to a real gesture.
    // Creating one at page load makes Chrome log an autoplay warning.
    if (soundOn && (!opts || opts.unlock !== false) && audioUnlocked) unlockAudio();
  }

  function isSoundEnabled() {
    return soundOn;
  }

  /**
   * Wire a sound toggle button. Persists under `soundKey` and keeps the
   * icon / aria state in sync.
   */
  function bindSoundButton(opts) {
    const { btn, icon, soundKey } = opts;
    if (!btn) return;
    let on = store.get(soundKey, "on") !== "off";
    setSoundEnabled(on, { unlock: false });

    function render() {
      if (icon) icon.textContent = on ? "🔊" : "🔇";
      const label = on ? "Mute sound" : "Enable sound";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", label);
      btn.title = label;
    }

    render();

    btn.addEventListener("click", () => {
      on = !on;
      setSoundEnabled(on);
      store.set(soundKey, on ? "on" : "off");
      render();
      if (on) {
        unlockAudio();
        sfx("click");
      }
    });

    return {
      get enabled() {
        return on;
      },
      set(v) {
        on = !!v;
        setSoundEnabled(on);
        store.set(soundKey, on ? "on" : "off");
        render();
      },
      render,
    };
  }

  /** Unlock audio on the first pointer/key gesture. Call once. */
  function bindAudioUnlock() {
    const opts = { once: true, capture: true };
    try {
      win.addEventListener("pointerdown", unlockAudio, opts);
      win.addEventListener("keydown", unlockAudio, opts);
    } catch {
      /* very old browser — audio just stays off */
    }
  }

  const audio = {
    sfx,
    tone,
    unlock: unlockAudio,
    define: defineSfx,
    setEnabled: setSoundEnabled,
    isEnabled: isSoundEnabled,
    bindButton: bindSoundButton,
    bindUnlock: bindAudioUnlock,
    library: SFX_LIBRARY,
  };

  /* ---------------------------------------------------------
     Toasts — corner notifications for badges, hints, errors.
     --------------------------------------------------------- */
  let toastsEl = null;

  function bindToasts(el) {
    toastsEl = el || null;
  }

  function resolveToastsHost() {
    if (toastsEl) return toastsEl;
    if (typeof document !== "undefined" && document.getElementById) {
      return document.getElementById("toasts");
    }
    return null;
  }

  function showToast(title, desc, icon, opts) {
    const host = resolveToastsHost();
    if (!host || !host.appendChild) return;
    const ttl = (opts && opts.ttl) || 2600;

    const el = document.createElement("div");
    el.className = "snake-toast";
    el.innerHTML =
      `<span class="snake-toast__icon" aria-hidden="true"></span>` +
      `<div class="snake-toast__body"><strong></strong><span></span></div>`;
    const iconEl = el.querySelector(".snake-toast__icon");
    const titleEl = el.querySelector("strong");
    const descEl = el.querySelector(".snake-toast__body span");
    if (iconEl) iconEl.textContent = icon || "💬";
    if (titleEl) titleEl.textContent = title || "";
    if (descEl) descEl.textContent = desc || "";
    host.appendChild(el);
    win.setTimeout(() => el.classList.add("is-out"), ttl);
    win.setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, ttl + 450);
  }

  const toast = { bind: bindToasts, show: showToast };

  /* ---------------------------------------------------------
     Overlay — the full-screen "Paused" / "Game Over" dialog.
     --------------------------------------------------------- */
  let overlayEl = null;

  function hideOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  /**
   * showOverlay("Time's up!", "Score 42", [
   *   { label: "Play Again", onClick: fn },
   *   { label: "Badges", ghost: true, onClick: fn },
   * ])
   */
  function showOverlay(title, msg, actions) {
    hideOverlay();
    overlayEl = document.createElement("div");
    overlayEl.className = "overlay";
    if (overlayEl.dataset) {
      overlayEl.dataset.title = title;
      overlayEl.dataset.msg = msg;
    }

    const box = document.createElement("div");
    box.className = "overlay__box";
    box.innerHTML = `<h2></h2><p></p><div class="overlay__actions"></div>`;
    const heading = box.querySelector("h2");
    const para = box.querySelector("p");
    if (heading) heading.textContent = title;
    if (para) para.textContent = msg;

    const actionsEl = box.querySelector(".overlay__actions");
    for (const action of actions || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = action.ghost ? "btn btn--ghost" : "btn";
      b.textContent = action.label;
      b.addEventListener("click", action.onClick);
      actionsEl.appendChild(b);
    }

    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);
    const first = overlayEl.querySelector(".btn");
    if (first) first.focus();
    return overlayEl;
  }

  function isOverlayOpen() {
    return !!overlayEl;
  }

  /** Title / message of the currently shown overlay (used by tests). */
  function overlayInfo() {
    if (!overlayEl) return { title: null, msg: null };
    const data = overlayEl.dataset || {};
    return {
      title: data.title === undefined ? null : data.title,
      msg: data.msg === undefined ? null : data.msg,
    };
  }

  const overlay = {
    show: showOverlay,
    hide: hideOverlay,
    isOpen: isOverlayOpen,
    info: overlayInfo,
  };

  /* ---------------------------------------------------------
     Confetti — pure DOM, skipped entirely under reduced motion.
     --------------------------------------------------------- */
  const CONFETTI_COLORS = ["#5ad1b8", "#ffd94d", "#ff5ea8", "#ff5b5b", "#f2f3f7"];

  function confetti(count, opts) {
    if (prefersReducedMotion()) return;
    const n = count || 80;
    const options = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = options.colors || CONFETTI_COLORS;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
      s.style.animationDelay = Math.random() * 0.5 + "s";
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    win.setTimeout(() => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 4200);
  }

  /* ---------------------------------------------------------
     Badges / achievements.

     defs: [{ id, icon, name, desc, stat, goal }]
           `stat` names a number you expose, or give `value(fn)` instead.

     const badges = Arcade.badges.create(ACHIEVEMENTS, {
       storageKey: K.achv,
       getStat: (key) => (key === "dailyStreak" ? daily.streak : stats[key] || 0),
       onUnlock: () => saveStats(),
       onRender: () => {},
     });

     badges.check();      // unlock anything newly earned, toast + sound
     badges.render(gridEl, { records, countEl });
     --------------------------------------------------------- */
  function createBadges(defs, opts) {
    const options = opts || {};
    const list = Array.isArray(defs) ? defs : [];
    const storageKey = options.storageKey;
    const getStat =
      options.getStat ||
      function (key) {
        const def = list.find((d) => d.id === key);
        return def && typeof def.value === "function" ? def.value() : 0;
      };

    const byId = new Map(list.map((d) => [d.id, d]));

    const stored = storageKey ? store.json(storageKey, []) : [];
    let unlocked = new Set(Array.isArray(stored) ? stored : []);
    // Drop anything that no longer matches a definition.
    unlocked = new Set(Array.from(unlocked).filter((id) => byId.has(id)));

    function has(id) {
      return unlocked.has(id);
    }

    function count() {
      return unlocked.size;
    }

    function total() {
      return list.length;
    }

    function valueOf(def) {
      if (typeof def.value === "function") {
        const v = def.value();
        return Number.isFinite(v) ? v : 0;
      }
      const v = getStat(def.stat);
      return Number.isFinite(v) ? v : 0;
    }

    function isDone(def) {
      return unlocked.has(def.id);
    }

    function progress(def) {
      const raw = valueOf(def);
      const goal = def.goal || 1;
      return {
        raw,
        goal,
        pct: isDone(def) ? 100 : clamp((raw / goal) * 100, 0, 100),
        now: Math.min(Math.floor(raw), goal),
        text: isDone(def) ? "Unlocked" : `${Math.min(Math.floor(raw), goal)} / ${goal}`,
      };
    }

    function card(def, onUnlockSound) {
      const p = progress(def);
      return (
        `<div class="achv ${isDone(def) ? "achv--done" : "achv--locked"}">` +
        `<div class="achv__icon" aria-hidden="true">${def.icon}</div>` +
        `<div class="achv__body">` +
        `<div class="achv__name"><span>${def.name}</span>` +
        `${isDone(def) ? '<span class="achv__tick" aria-label="Unlocked">✔</span>' : ""}` +
        `</div>` +
        `<div class="achv__desc">${def.desc}</div>` +
        `<div class="achv__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.goal}" aria-valuenow="${p.now}">` +
        `<span style="width:${p.pct}%"></span></div>` +
        `<div class="achv__progress">${p.text}</div>` +
        `</div></div>`
      );
    }

    /** Unlock any newly-earned badges. Returns the newly unlocked defs. */
    function check(quiet) {
      const fresh = [];
      for (const def of list) {
        if (unlocked.has(def.id)) continue;
        if (valueOf(def) >= (def.goal || 1)) {
          unlocked.add(def.id);
          fresh.push(def);
          if (!quiet) showToast(def.name, def.desc, def.icon);
        }
      }
      if (fresh.length) {
        if (!quiet) sfx("achv");
        if (storageKey) store.jsonSet(storageKey, Array.from(unlocked));
        if (typeof options.onUnlock === "function") options.onUnlock(fresh);
        if (typeof options.onRender === "function") options.onRender();
      }
      return fresh;
    }

    /** Render the grid. records: [[label, value], ...] */
    function render(gridEl, opts2) {
      if (!gridEl) return;
      const o = opts2 || {};
      gridEl.innerHTML = list.map((d) => card(d)).join("");
      if (o.recordsEl && typeof o.records === "function") {
        o.recordsEl.innerHTML = o.records()
          .map(([label, val]) => `<span>${label} <b>${val}</b></span>`)
          .join("");
      }
      if (o.countEl) o.countEl.textContent = `${unlocked.size} / ${list.length}`;
    }

    return {
      defs: list,
      byId,
      has,
      count,
      total,
      valueOf,
      isDone,
      progress,
      card,
      check,
      render,
      list: () => Array.from(unlocked),
    };
  }

  const badges = { create: createBadges };

  /* ---------------------------------------------------------
     Modal — the shared "Badges" dialog shell: show/hide,
     body scroll lock, Escape to close, backdrop click, focus.
     The game supplies onOpen so it can pause itself.
     --------------------------------------------------------- */
  function createModal(el, opts) {
    const options = opts || {};
    if (!el) {
      return { open() {}, close() {}, isOpen: () => false };
    }

    let open = false;

    function isOpen() {
      return open;
    }

    function show() {
      if (open) return;
      open = true;
      el.hidden = false;
      document.body.classList.add("modal-open");
      if (typeof options.onOpen === "function") options.onOpen();
      const closeBtn = el.querySelector("[data-close]");
      if (closeBtn && closeBtn.focus) closeBtn.focus();
    }

    function hide() {
      if (!open) return;
      open = false;
      el.hidden = true;
      document.body.classList.remove("modal-open");
      if (typeof options.onClose === "function") options.onClose();
      const target = options.returnFocus || null;
      if (target && target.focus) target.focus();
    }

    function toggle() {
      if (open) hide();
      else show();
    }

    el.querySelectorAll("[data-close]").forEach((node) => {
      node.addEventListener("click", hide);
    });

    return { open: show, close: hide, toggle, isOpen };
  }

  const modal = { create: createModal };

  /* ---------------------------------------------------------
     Animation loop — one requestAnimationFrame chain with
     delta clamping, so tab-switches don't teleport the game.
     --------------------------------------------------------- */
  function createLoop(update, opts) {
    const options = opts || {};
    let raf = 0;
    let last = 0;
    let running = false;

    function frame(ts) {
      if (!running) return;
      raf = win.requestAnimationFrame
        ? win.requestAnimationFrame(frame)
        : win.setTimeout(() => frame(Date.now()), 16);
      if (!last) last = ts;
      let dt = ts - last;
      last = ts;
      const max = options.maxDelta === undefined ? 100 : options.maxDelta;
      if (dt > max) dt = max;
      if (dt < 0) dt = 0;
      try {
        update(dt, ts);
      } catch (err) {
        // Never let one bad frame kill the loop.
        if (win.console && win.console.error) win.console.error(err);
      }
    }

    return {
      start() {
        if (running) return;
        running = true;
        last = 0;
        if (win.requestAnimationFrame) raf = win.requestAnimationFrame(frame);
        else raf = win.setTimeout(() => frame(Date.now()), 16);
      },
      stop() {
        running = false;
        if (raf && win.cancelAnimationFrame) win.cancelAnimationFrame(raf);
        else if (raf) win.clearTimeout(raf);
        raf = 0;
      },
      get running() {
        return running;
      },
    };
  }

  const loop = { create: createLoop };

  /* ---------------------------------------------------------
     Assorted DOM helpers.
     --------------------------------------------------------- */
  function byId(id) {
    return typeof document !== "undefined" ? document.getElementById(id) : null;
  }

  function all(selector, root) {
    const scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope || !scope.querySelectorAll) return [];
    return Array.prototype.slice.call(scope.querySelectorAll(selector));
  }

  /** Announce a message to screen readers via an aria-live region. */
  function announce(el, text) {
    if (!el) return;
    el.textContent = "";
    win.setTimeout(() => {
      el.textContent = text;
    }, 30);
  }

  /** Persist and render a "best score" record; returns { best, isRecord }. */
  function recordBest(key, score, extra) {
    const prev = store.json(key, null);
    const prevScore = prev && Number.isFinite(prev.s) ? prev.s : 0;
    const isRecord = score > prevScore || !prev;
    if (isRecord) {
      const payload = Object.assign({ s: Math.max(prevScore, score) }, extra || {});
      store.jsonSet(key, payload);
    }
    return { best: Math.max(prevScore, score), isRecord, prev };
  }

  /**
   * Daily streak bookkeeping.
   * recordDailyWin(dailyObj, today) mutates and returns the object.
   */
  function recordDailyWin(daily, today) {
    const day = today || dateStr();
    if (!daily || daily.lastDate === day) return daily;
    const yesterday = yesterdayStr();
    daily.streak = daily.lastDate === yesterday ? (daily.streak || 0) + 1 : 1;
    daily.lastDate = day;
    if (!daily.history || typeof daily.history !== "object") daily.history = {};
    return daily;
  }

  /* --------------------------------------------------------- */
  const Arcade = {
    store,
    keys,
    util,
    audio,
    toast,
    overlay,
    confetti,
    badges,
    modal,
    loop,
    dom: { byId, all, announce },
    recordBest,
    recordDailyWin,
    version: 1,
  };

  global.Arcade = Arcade;

  // Convenience for the Node test harnesses that eval this file.
  if (typeof module !== "undefined" && module.exports) module.exports = Arcade;
})(typeof window !== "undefined" ? window : globalThis);