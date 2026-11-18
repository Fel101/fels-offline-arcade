// Headless-Chrome smoke check for the offline arcade launcher.
// Usage: node tests/browser-smoke.js
//
// Drives the real file:// pages over the Chrome DevTools Protocol: launcher
// navigation, theme persistence, keyboard Badges behaviour, and Backgammon.
// Page web requests are blocked. No web server or npm dependencies are needed.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const env = require("./_env");

if (typeof WebSocket !== "function") {
  console.error("The Chrome smoke test needs a Node.js version with built-in WebSocket support, such as Node.js 24.");
  process.exit(1);
}

const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launcher = pathToFileURL(path.join(env.ROOT, "index.html")).href;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "arcade-smoke-"));

const child = spawn(
  chrome,
  [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--window-size=1100,900", "about:blank",
  ],
  { stdio: "ignore", windowsHide: true }
);
let launchError;
let browserClosed = false;
child.on("error", (err) => { launchError = err; });
const browserExit = new Promise((resolve) => {
  child.once("close", () => { browserClosed = true; resolve(); });
});

let pass = 0;
let fail = 0;
function ok(cond, msg, extra) {
  if (cond) pass++;
  else {
    fail++;
    console.error("FAIL:", msg, extra === undefined ? "" : JSON.stringify(extra));
  }
}
function eq(a, b, msg) { ok(a === b, msg, { actual: a, expected: b }); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    if (launchError) throw launchError;
    if (browserClosed) throw new Error(`Chrome closed while waiting for ${label}`);
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) {
      lastError = err;
    }
    await sleep(120);
  }
  throw new Error(`timed out: ${label}`, { cause: lastError });
}

let ws;
let seq = 0;
const pending = new Map();
const pageErrors = [];
function send(method, params = {}, timeout = 5000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    if (ws?.readyState !== WebSocket.OPEN) return reject(new Error("Chrome DevTools disconnected"));
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools timed out on ${method}`));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err);
    }
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}
async function key(name, modifiers = 0) {
  const codes = { Tab: 9, Escape: 27, Enter: 13, ArrowLeft: 37, p: 80 };
  const code = codes[name] || 0;
  const physicalKey = name === "p" ? "KeyP" : name;
  const text = name === "Enter" ? "\r" : "";
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", key: name, code: physicalKey, windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code, modifiers, text,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", key: name, code: physicalKey, windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code, modifiers,
  });
}
async function activate(selector) {
  await evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) throw new Error("Missing control " + ${JSON.stringify(selector)});
    target.focus();
    if (document.activeElement !== target) throw new Error("Cannot focus " + ${JSON.stringify(selector)});
  })()`);
  await key("Enter");
}
function waitForPage(url, marker) {
  return waitFor(() => evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === "complete" && !!(${marker})`), url);
}
function focusInfo() {
  return evaluate(`(function () {
    var a = document.activeElement;
    if (!a) return null;
    return {
      id: a.id || "", tag: a.tagName, close: a.hasAttribute && a.hasAttribute("data-close"),
      cls: String(a.className || ""), label: String(a.getAttribute("aria-label") || "")
    };
  })()`);
}

(async () => {
  const list = await waitFor(async () => {
    const port = parseInt(fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8"), 10);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
    return response.json();
  }, "Chrome DevTools");
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      pageErrors.push(msg.params.args.map((arg) => arg.description || String(arg.value)).join(" "));
    }
  });
  ws.addEventListener("close", () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error("Chrome DevTools disconnected"));
    }
    pending.clear();
  });
  await waitFor(() => ws.readyState === WebSocket.OPEN, "Chrome DevTools WebSocket");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });

  const gameCards = 'document.querySelector("a.game-card")';
  await send("Page.navigate", { url: launcher });
  await waitForPage(launcher, gameCards);
  eq(await evaluate(`document.querySelectorAll("a.game-card").length`), 64, "launcher lists 64 game cards");

  // The theme goes through the actual menu, then persists across file URLs.
  await activate("#theme-toggle");
  await activate('[data-theme-choice="light"]');
  eq(await evaluate(`JSON.parse(localStorage.getItem("offline-arcade:theme:v1"))`), "light", "theme choice persisted");
  eq(await evaluate(`document.documentElement.dataset.theme`), "light", "launcher applies the theme");
  await activate('a.game-card[data-url="games/maze-chase/index.html"]');
  await waitForPage(new URL("games/maze-chase/index.html", launcher).href, "window.__MAZE_CHASE");
  eq(await evaluate(`document.documentElement.dataset.theme`), "light", "theme persists into the game");

  // Verify keyboard navigation and freeze/resume from live play.
  await activate(".overlay .btn");
  await evaluate(`__MAZE_CHASE.setGhostCooldown(99999); __MAZE_CHASE.setPowerTimer(480);`);
  await activate("#badges-btn");
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), false, "Badges dialog opens");
  let f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "the Close button takes focus", f);
  const heldPower = await evaluate("__MAZE_CHASE.powerTimer");

  await key("Tab", 8); // Shift+Tab
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "Shift+Tab stays on Close", f);
  await key("Tab");
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "Tab stays on Close", f);
  await key("ArrowLeft");
  await sleep(120);
  eq(await evaluate("__MAZE_CHASE.powerTimer"), heldPower, "Maze Chase simulation freezes with Badges open");
  eq(await evaluate("__MAZE_CHASE.player.nextDir.join(',')"), "0,0", "Badges blocks movement keys");

  await key("Escape");
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), true, "Escape closes Badges");
  f = await focusInfo();
  eq(f.id, "badges-btn", "Escape restores focus to the header button");
  await waitFor(() => evaluate(`__MAZE_CHASE.powerTimer < ${heldPower}`), "Maze Chase simulation resumes");

  // From the pause overlay, Badges keeps the pause and restores the opener.
  await key("p");
  eq(await evaluate(`window.__MAZE_CHASE.paused`), true, "P pauses the game");
  await activate(".overlay .btn--ghost");
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), false, "overlay Badges opens the dialog");
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "overlay Badges focuses Close", f);
  await key("Escape");
  eq(await evaluate(`window.__MAZE_CHASE.paused`), true, "the pause survives closing Badges");
  eq(await evaluate(`String(document.querySelector(".overlay").dataset.title)`), "Paused", "pause overlay stays open");
  f = await focusInfo();
  ok(f.cls.indexOf("btn--ghost") !== -1, "focus returns to the overlay Badges action", f);

  // Backgammon has a legacy onClose that focuses the header, plus a board
  // fixture that verifies turn legality through the real point buttons.
  await activate(".overlay .btn");
  await activate(".back-btn");
  await waitForPage(launcher, gameCards);
  await activate('a.game-card[data-url="games/backgammon/index.html"]');
  await waitForPage(new URL("games/backgammon/index.html", launcher).href, "window.__BACKGAMMON");
  await activate(".overlay .btn--ghost");
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "Backgammon uses the shared Close focus", f);
  await key("Escape");
  f = await focusInfo();
  ok(f.cls.indexOf("btn--ghost") !== -1, "Backgammon restores the opener despite its onClose fallback", f);
  await activate(".overlay .btn");
  await evaluate(`
    __BACKGAMMON.setMode("2p");
    __BACKGAMMON.setPoints([[8, 1, 0], [5, 0, 2], [1, 0, 13]]);
    __BACKGAMMON.setOff(14, 0);
    __BACKGAMMON.setDice([1, 2]);
  `);
  const point = (n) => `[data-point="${n}"]`;
  await activate(point(8));
  eq(await evaluate("document.activeElement.getAttribute('data-point')"), "8", "keyboard focus survives a board redraw");
  eq(await evaluate(`document.querySelector('${point(6)}').classList.contains('bg-point--target')`), true, "the higher-die destination is highlighted");
  eq(await evaluate(`document.querySelector('${point(7)}').classList.contains('bg-point--target')`), false, "the lower-die destination is skipped");
  await activate(point(7));
  eq(await evaluate("__BACKGAMMON.getP(8, __BACKGAMMON.WHITE)"), 1, "the UI rejects the lower die");
  await activate(point(8));
  await activate(point(6));
  eq(await evaluate("__BACKGAMMON.getP(6, __BACKGAMMON.WHITE)"), 1, "the UI accepts the higher die");

  await evaluate(`
    __BACKGAMMON.setTurn(__BACKGAMMON.WHITE);
    __BACKGAMMON.setPoints([[2, 1, 0], [1, 0, 15]]);
    __BACKGAMMON.setDice([2]);
  `);
  await activate(point(2));
  await activate("#tray-w-box");
  eq(await evaluate("__BACKGAMMON.off[__BACKGAMMON.WHITE]"), 15, "the keyboard can bear off the last checker");
  ok(pageErrors.length === 0, "browser pages report no JavaScript errors", pageErrors);

  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail ? "BROWSER SMOKE FAILED" : "BROWSER SMOKE CLEAN");
})()
  .catch((err) => {
    fail++;
    console.error("SMOKE ERROR:", err && err.stack ? err.stack : err);
  })
  .finally(async () => {
    if (ws?.readyState === WebSocket.OPEN) {
      try { await send("Browser.close", {}, 1500); } catch { /* Chrome can close before replying. */ }
      ws.close();
    }
    if (!browserClosed) await Promise.race([browserExit, sleep(1000)]);
    if (!browserClosed) {
      child.kill();
      await Promise.race([browserExit, sleep(1000)]);
    }
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
    } catch (err) {
      console.error("PROFILE CLEANUP:", err.message);
      fail++;
    }
    process.exitCode = fail ? 1 : 0;
  });
