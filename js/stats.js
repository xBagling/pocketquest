// Global daily stats: send your run, see how everyone else did. The server re-plays your actions,
// so the gold it records is the gold the rules give, not whatever a browser claims.
import { CONFIG } from "./config.js";
import { store } from "./store.js";
import { room } from "./content.js";
import { dungeonForDay } from "./dungeon.js";
import { seededRandom, hashString } from "./util.js";

const enabled = () => Boolean(CONFIG.STATS_API);

export async function submitRun(rec) {
  if (!enabled() || !rec.live || rec.submitted || !rec.done) return false;
  try {
    const res = await fetch(`${CONFIG.STATS_API}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: rec.day, player: store.player, hard: rec.hard, rules: rec.rules || 1, floors: rec.floors || 5, hero: rec.hero || "wanderer", actions: rec.actions }),
    });
    // 409 = already counted, 400 = can never be counted. Either way, stop retrying.
    if (!res.ok && res.status !== 409 && res.status !== 400) return false;
    rec.submitted = true;
    store.saveRun(rec);
    return true;
  } catch {
    return false;
  }
}

/** Retry any finished live runs that never reached the server (e.g. played offline). */
export function flushPending() {
  for (const rec of Object.values(store.allRuns())) if (rec.live && rec.done && !rec.submitted) submitRun(rec);
}

export async function fetchStats(day) {
  if (!enabled()) return null;
  try {
    const res = await fetch(`${CONFIG.STATS_API}/stats?day=${day}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Share of delvers you out-hoarded, counting ties as half. Excludes yourself. */
export function richerThan(stats, gold) {
  const b = Math.min(Math.floor(gold / 25), stats.gold.length - 1);
  let below = 0;
  let same = 0;
  stats.gold.forEach((n, i) => {
    if (i < b) below += n;
    else if (i === b) same += n;
  });
  const total = stats.total - 1;
  if (total <= 0) return null;
  return Math.round(((below + Math.max(0, same - 1) / 2) / total) * 100);
}

/** Believable fake stats so admins can preview the ledger with a crowd. */
export function sampleCrowd(day) {
  const rand = seededRandom(hashString(`crowd-${day}`));
  const total = 600 + Math.floor(rand() * 5000);
  const gold = Array.from({ length: 45 }, (_, i) => Math.round(total * Math.exp(-((i - 11) ** 2) / 60) * (0.5 + rand()) * 0.05));
  const endings = { fell: Math.round(total * 0.62), escaped: Math.round(total * 0.3), vault: Math.round(total * 0.08) };
  const floors = [total, Math.round(total * 0.93), Math.round(total * 0.71), Math.round(total * 0.52), Math.round(total * 0.38)];
  const d = dungeonForDay(day);
  const doors = d.floors.map((f) => f.doors.map(() => 0.2 + rand()));
  const rooms = {};
  for (const f of d.floors)
    for (const door of f.doors) {
      const r = room(door.pid);
      const entered = Math.round(total * (0.2 + rand() * 0.4));
      const answers = {};
      r.answers.forEach((a, i) => {
        const w = Math.exp(-i / 4) * (a.tier === "f" ? 3 : 1);
        const n = Math.round(entered * w * 0.25 * rand());
        if (n) answers[a.name] = n;
      });
      rooms[door.pid] = { entered, answers };
    }
  return { day, total, gold: gold.map((n) => Math.max(0, n)), endings, floors, doors: doors.map((f) => f.map((w) => Math.round(w * 100))), rooms, sample: true };
}
