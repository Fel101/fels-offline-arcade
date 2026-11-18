// Multi-width headless check for a game.
// Usage: node check-tia.js [game ...]  (defaults to every game in games/)
//
// Headless Chrome clamps its window to ~500px wide, so widths below that are
// tested inside an iframe of the exact requested width. Each game page carries
// a diag script that records console errors and the widest element edge.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const env = require("./_env");

const root = env.GAMES + path.sep;
const tmp = os.tmpdir();
const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const games = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(env.GAMES).filter((d) => fs.statSync(path.join(env.GAMES, d)).isDirectory()).sort();
const widths = [360, 500, 900, 1200];

const diag = `
<script>
window.__errors = [];
window.addEventListener("error", function (e) { window.__errors.push(String(e.message || e)); });
(function () {
  var ce = console.error.bind(console);
  console.error = function () {
    window.__errors.push(Array.prototype.map.call(arguments, function (a) { return String(a); }).join(" "));
    ce.apply(null, arguments);
  };
})();
setTimeout(function () {
  var out = {
    errors: window.__errors,
    scroll: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    inner: window.innerWidth
  };
  out.overflow = Math.max(out.scroll, out.bodyScroll) > out.inner + 1;
  var pre = document.createElement("pre");
  pre.id = "diag";
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
}, 1800);
</script>`;

function wrapper(url, w) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#fff}
iframe{display:block;width:${w}px;height:1400px;border:0}
</style></head><body>
<iframe id="f" src="${url}"></iframe>
<script>
var f = document.getElementById("f");
f.addEventListener("load", function () {
  setTimeout(function () {
    var out = { found: false };
    try {
      var pre = f.contentDocument.getElementById("diag");
      if (pre) out = JSON.parse(pre.textContent);
      out.found = !!pre;
    } catch (err) { out.error = String(err && err.message || err); }
    var host = document.createElement("pre");
    host.id = "result";
    host.textContent = JSON.stringify(out);
    document.body.appendChild(host);
  }, 2600);
});
</script></body></html>`;
}

let bad = 0;
for (const game of games) {
  const dir = path.join(root, game);
  let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  html = html.replace(
    "<head>",
    `<head>\n<script>window.matchMedia = function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; };</script>`
  );
  html = html.replace("</body>", diag + "</body>");
  const gameFile = path.join(dir, "_diag.html");
  fs.writeFileSync(gameFile, html);
  const gameUrl = "file:///" + gameFile.replace(/\\/g, "/");

  for (const w of widths) {
    const wrapFile = path.join(tmp, `_wrap-${game}-${w}.html`);
    fs.writeFileSync(wrapFile, wrapper(gameUrl, w));
    let dom = "";
    try {
      dom = execFileSync(
        chrome,
        [
          "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
          "--allow-file-access-from-files",
          `--user-data-dir=${tmp}/chrome-tia-${game}-${w}`,
          "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1400,1500",
          "--virtual-time-budget=6000", "--dump-dom",
          "file:///" + wrapFile.replace(/\\/g, "/"),
        ],
        { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", timeout: 60000 }
      );
    } catch (e) {
      dom = (e.stdout || "").toString();
    }
    fs.rmSync(wrapFile, { force: true });

    const m = dom.match(/<pre id="result">([^<]*)<\/pre>/);
    if (m) {
      const j = JSON.parse(
        m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      );
      if (!j.found) {
        bad++;
        console.log(`${game.padEnd(14)} w=${String(w).padEnd(5)} NO DIAG ${j.error ? "(" + j.error + ")" : ""}`);
        continue;
      }
      const status = j.errors.length === 0 && !j.overflow ? "OK " : "BAD";
      if (status === "BAD") bad++;
      const over = j.overflow ? `${Math.max(j.scroll, j.bodyScroll)}>${j.inner}` : "none";
      console.log(`${game.padEnd(14)} w=${String(w).padEnd(5)} errors=${j.errors.length} overflow=${over} ${status}`);
      if (j.errors.length) j.errors.slice(0, 5).forEach((e) => console.log("    ERR:", e.slice(0, 140)));
    } else {
      bad++;
      console.log(`${game.padEnd(14)} w=${w} NO RESULT`);
    }
  }
  fs.rmSync(gameFile, { force: true });
}
console.log(bad ? `\n${bad} problem(s) found` : "\nALL CLEAN: 0 console errors, no overflow at 360/500/900/1200");
process.exit(bad ? 1 : 0);
