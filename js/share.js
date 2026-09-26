// The spoiler-free share text: a token for every glade, Old Ember's strikes, and how the walk ended.
// Only emoji that Windows 10 can draw (nothing newer than Emoji 11).
import { CONFIG } from "./config.js";
import { TIERS, shownTier } from "./rules.js";
import { counts } from "./engine.js";

const OUT = "🕯️"; // the lantern burnt out in that glade

/** One token per glade, and every strike in Old Ember's hollow. */
export function roomSymbols(s) {
  const main = [];
  let boss = null;
  for (const rm of s.rooms) {
    if (rm.boss) {
      boss = rm.answers.filter((a) => a.idx >= 0 && a.through && counts(a)).map((a) => TIERS[shownTier(a.tier)].share);
      continue;
    }
    // Rattlebones takes two answers: the glade shows the better one.
    const got = rm.answers.filter(counts).sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0];
    main.push(got ? TIERS[shownTier(got.tier)].share : OUT);
  }
  return { main, boss };
}

export function endingLine(s) {
  if (s.ending === "vault") return `Took the hoard · ${s.gold} gold · ${s.hearts} ❤️ left`;
  if (s.ending === "escaped") return `Slipped home at nightfall · ${s.gold} gold`;
  const rm = s.rooms.at(-1);
  return `Lost in glade ${rm ? rm.floor + 1 : 1} · ${s.gold} gold`;
}

export function shareText(s, { mode = "today", streak = 0 } = {}) {
  const { main, boss } = roomSymbols(s);
  const tags = [s.hard ? "hard" : "", mode === "replay" ? "practice" : mode === "archive" ? "past walk" : ""].filter(Boolean);
  const dragon = boss ? ` ➜ ${boss.join("")}${s.ending === "vault" ? "🐉✔️" : "🐉💤"}` : "";
  const tail = streak > 1 && mode === "today" ? ` · 🔥${streak}` : "";
  return [`${CONFIG.NAME} · Walk No. ${s.day} 🌿${tags.length ? ` (${tags.join(", ")})` : ""}`, main.join("") + dragon, endingLine(s) + tail, CONFIG.SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")].join("\n");
}
