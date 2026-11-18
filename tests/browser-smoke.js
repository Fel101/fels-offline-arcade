// Headless-Chrome smoke check for the offline arcade launcher.
// Usage: node tests/browser-smoke.js
//
// Drives the real file:// pages over the Chrome DevTools Protocol: launcher
// navigation, theme persistence into a game, and keyboard Badges behaviour.
// No server, network access or npm dependencies are involved.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const env = require("./_env");

const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launcher = "file:///" + path.join(env.ROOT, "index.html").replace(/\\/g, "/");
const port = 9400 + (process.pid % 400);
const profile = path.join(os.tmpdir(), `arcade-smoke-${process.pid}`);
fs.rmSync(profile, { recursive: true, force: true });

const child = spawn(
  chrome,
  [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--allow-file-access-from-files", `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`, "--remote-allow-origins=*",
    "--window-size=1100,900", "about:blank",
  ],
  { stdio: "ignore" }
);

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
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* keep trying while the page boots */ }
    await sleep(120);
  }
  throw new Error("timed out: " + label);
}

let ws;
let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "evaluate failed");
  return r.result ? r.result.value : undefined;
}
async function key(name, modifiers = 0) {
  const codes = { Tab: 9, Escape: 27, p: 80, P: 80 };
  const code = codes[name] || 0;
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code, modifiers,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code, modifiers,
  });
  await sleep(90);
}
async function navigate(url, marker) {
  await send("Page.navigate", { url });
  await waitFor(() => evaluate(`document.readyState === "complete"`), "load " + marker);
  await waitFor(() => evaluate(`!!(${marker})`), "marker " + marker);
  await sleep(250);
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
  const list = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()), "devtools");
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");

  // 1. Launcher navigation.
  await navigate(launcher, `document.querySelector("a.game-card")`);
  eq(await evaluate(`document.querySelectorAll("a.game-card").length`), 64, "launcher lists 64 game cards");
  ok(await evaluate(`!!document.querySelector('a.game-card[data-url*="maze-chase"]')`), "Maze Chase card exists");

  // 2. Theme is stored and carried into a game page.
  await evaluate(`(function () {
    var b = document.querySelector('[data-theme-choice="dark"]');
    b.focus(); b.click(); return true;
  })()`);
  eq(await evaluate(`JSON.parse(localStorage.getItem("offline-arcade:theme:v1"))`), "dark", "theme choice persisted");
  eq(await evaluate(`document.documentElement.dataset.theme`), "dark", "launcher applies the theme");
  await evaluate(`(function () {
    var a = document.querySelector('a.game-card[data-url*="maze-chase"]');
    a.focus(); a.click(); return true;
  })()`);
  await waitFor(() => evaluate(`location.href.indexOf("maze-chase") !== -1`), "navigation into Maze Chase");
  await sleep(500);
  ok(await evaluate(`location.href.indexOf("maze-chase") !== -1`), "game card navigates into Maze Chase");
  eq(await evaluate(`document.documentElement.dataset.theme`), "dark", "theme persists into the game");
  ok(await evaluate(`!!window.__MAZE_CHASE`), "Maze Chase booted");

  // 3. Keyboard Badges behaviour from the header button.
  await evaluate(`(function () {
    var b = document.getElementById("badges-btn"); b.focus(); b.click(); return true;
  })()`);
  await sleep(150);
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), false, "Badges dialog opens");
  let f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "the Close button takes focus", f);

  await key("Tab", 8); // Shift+Tab
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "Shift+Tab stays on Close", f);
  await key("Tab");
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "Tab stays on Close", f);

  await key("Escape");
  await sleep(150);
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), true, "Escape closes Badges");
  f = await focusInfo();
  eq(f.id, "badges-btn", "Escape restores focus to the header button");

  // 4. From the pause overlay, Badges keeps the pause and restores the opener.
  await evaluate(`(function () {
    var start = document.querySelector(".overlay .btn");
    if (start) start.click();
    return true;
  })()`);
  await sleep(150);
  await key("p");
  await sleep(150);
  eq(await evaluate(`window.__MAZE_CHASE.paused`), true, "P pauses the game");
  await evaluate(`(function () {
    var b = document.querySelector(".overlay .btn--ghost");
    b.focus(); b.click(); return true;
  })()`);
  await sleep(150);
  eq(await evaluate(`document.getElementById("achv-modal").hidden`), false, "overlay Badges opens the dialog");
  f = await focusInfo();
  ok(f.close && f.tag === "BUTTON", "overlay Badges focuses Close", f);
  await key("Escape");
  await sleep(150);
  eq(await evaluate(`window.__MAZE_CHASE.paused`), true, "the pause survives closing Badges");
  eq(await evaluate(`String(document.querySelector(".overlay").dataset.title)`), "Paused", "pause overlay stays open");
  f = await focusInfo();
  ok(f.cls.indexOf("btn--ghost") !== -1, "focus returns to the overlay Badges action", f);

  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail ? "BROWSER SMOKE FAILED" : "BROWSER SMOKE CLEAN");
})()
  .catch((err) => {
    fail++;
    console.error("SMOKE ERROR:", err && err.stack ? err.stack : err);
  })
  .finally(async () => {
    if (ws) ws.close();
    child.kill();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
    process.exit(fail ? 1 : 0);
  });
