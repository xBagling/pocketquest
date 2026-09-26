export const CONFIG = {
  // The game's name, in one place, in case it changes before launch.
  NAME: "Pocket Quest",
  SITE_URL: "https://xbagling.github.io/pocketquest/",

  // Quest #1 is played on this local date. Set it to your launch day before going live.
  LAUNCH_DATE: "2026-09-01",

  // Where the global stats API lives. "/api" works when served by server.js.
  // Use a full URL if the API is hosted elsewhere, or "" to turn global stats off.
  STATS_API: "",

  // SHA-256 of the admin passcode (default: "hoardkeeper"). Generate a new one with:
  //   bun -e 'const h=new Bun.CryptoHasher("sha256");h.update("your-pass");console.log(h.digest("hex"))'
  ADMIN_PASSCODE_SHA256: "bb9da2d7719c4529ecf24eda149ce02c12505c301722023abe614d3ceade336e",
};

// The numbers that make the dungeon hard. tools/simulate.mjs plays thousands of runs against them.
export const RULES = {
  HEARTS: 3,
  MAX_HEARTS: 4,
  CANDLE: 25, // seconds per room
  CANDLE_HARD: 15,
  BOSS_CANDLE: 40,
  BOSS_CANDLE_HARD: 25,
  SPARE_CANDLE: 10, // the Spare Candle relic adds this to every remaining room
  DOOR_GRACE_MS: 1400, // the candle starts after the door has swung open
  BOSS_STRIKES: 3,
  SEALED: 5, // the dragon has eaten this many of the most common answers
  VAULT_BONUS: 100,
  HEART_BONUS: 25,
  ELITE_MULT: 2,
  // How many glades a walk has: the first, the forks in between, and Old Ember's at the end.
  // Change it here, then run \`bun tools/build-forest.mjs\` so the map gets that many clearings.
  // Walks keep the number they started with, so old walks still replay.
  FLOORS: 6,
};
