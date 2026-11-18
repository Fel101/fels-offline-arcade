// Shared path helpers for the offline verification suites.
// All paths are derived from this file's location so `npm test` works
// from any checkout directory (and on any OS).
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GAMES = path.join(ROOT, "games");
const CORE = path.join(ROOT, "js", "arcade-core.js");

module.exports = {
  ROOT,
  GAMES,
  CORE,
  // Trailing-slash string form, used by suites that concatenate paths.
  root: ROOT.replace(/\\/g, "/") + "/",
  gameScript: (name) => path.join(GAMES, name, "script.js"),
  gameDir: (name) => path.join(GAMES, name),
};
