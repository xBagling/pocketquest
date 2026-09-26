// Pretend players, for balancing: they play real dungeons with the real rules. Each kind of bot
// knows a different depth of answers. Used by tools/simulate.mjs and the admin balance panel.
import { newRun, apply, currentRoom, floorReached, passesLetter } from "./engine.js";
import { room } from "./content.js";
import { rankFor, RANKS } from "./rules.js";
import { seededRandom } from "./util.js";

export const BOTS = {
  casual: { share: 0.5, tiers: { c: 0.5, f: 0.12, s: 0.28, g: 0.08, e: 0.02, j: 0 }, miss: 0.2, freeze: 0.06, elite: 0.25, bossTries: 5 },
  keen: { share: 0.35, tiers: { c: 0.28, f: 0.1, s: 0.35, g: 0.19, e: 0.07, j: 0.01 }, miss: 0.12, freeze: 0.03, elite: 0.5, bossTries: 6 },
  expert: { share: 0.15, tiers: { c: 0.14, f: 0.05, s: 0.3, g: 0.3, e: 0.16, j: 0.05 }, miss: 0.07, freeze: 0.01, elite: 0.8, bossTries: 8 },
};

function pickTier(weights, rand) {
  let x = rand();
  for (const [t, w] of Object.entries(weights)) if ((x -= w) <= 0) return t;
  return "c";
}

/** One bot plays one day. Returns the finished state. */
export function botRun(day, kind, rand) {
  const bot = BOTS[kind];
  const s = newRun(day);
  let guard = 0;
  while (s.phase !== "done" && guard++ < 200) {
    if (s.phase === "door") {
      const doors = s.dungeon.floors[s.floor].doors;
      const eliteIdx = doors.findIndex((d) => d.elite);
      const i = doors.length > 1 && eliteIdx >= 0 ? (rand() < bot.elite ? eliteIdx : 1 - eliteIdx) : 0;
      apply(s, { t: "door", i });
      continue;
    }
    if (s.phase === "nook") {
      apply(s, { t: "relic", i: Math.floor(rand() * 3) });
      continue;
    }
    const rm = currentRoom(s);
    const r = room(rm.pid);
    const tries = rm.answers.length;
    if ((rm.boss && tries >= bot.bossTries) || (!rm.boss && tries >= 4) || rand() < bot.freeze) {
      apply(s, { t: "timeout" });
      continue;
    }
    if (rand() < bot.miss) {
      apply(s, { t: "answer", text: "no idea at all" });
      continue;
    }
    const used = new Set(rm.answers.map((a) => a.idx));
    // A Letter lock narrows what anyone can say; the bots only know answers that fit.
    const avail = r.answers.filter((a, i) => !used.has(i) && !(rm.boss && r.sealed.includes(a.name)) && passesLetter(rm, a.name, a.name));
    const tier = pickTier(bot.tiers, rand);
    const pool = avail.filter((a) => a.tier === tier);
    // Nothing left of that tier (the dragon ate it, or it was said already)? People reach for the
    // next most common answer they know, not a random rare one.
    const pick = pool.length ? pool[Math.floor(rand() * pool.length)] : avail[Math.floor(rand() * Math.min(3, avail.length))];
    if (!pick) {
      apply(s, { t: "timeout" });
      continue;
    }
    apply(s, { t: "answer", text: pick.name });
  }
  return s;
}

/** Many runs over many days, a realistic mix of bots. */
export function simulate(days, runsPerDay = 400, seed = 7) {
  const rand = seededRandom(seed);
  const out = { runs: 0, reach: [0, 0, 0, 0, 0], vault: 0, escaped: 0, fell: 0, golds: [], ranks: Object.fromEntries(RANKS.map((r) => [r.name, 0])), byBot: {} };
  for (const day of days) {
    for (let i = 0; i < runsPerDay; i++) {
      const x = rand();
      const kind = x < BOTS.casual.share ? "casual" : x < BOTS.casual.share + BOTS.keen.share ? "keen" : "expert";
      const s = botRun(day, kind, rand);
      out.runs++;
      for (let f = 0; f < floorReached(s); f++) out.reach[f]++;
      out[s.ending]++;
      out.golds.push(s.gold);
      out.ranks[rankFor(s.gold).name]++;
      const b = (out.byBot[kind] ||= { runs: 0, vault: 0, gold: 0 });
      b.runs++;
      b.gold += s.gold;
      if (s.ending === "vault") b.vault++;
    }
  }
  out.golds.sort((a, b) => a - b);
  out.median = out.golds[Math.floor(out.golds.length / 2)];
  out.mean = Math.round(out.golds.reduce((a, b) => a + b, 0) / out.golds.length);
  return out;
}

export function report(o) {
  const p = (n) => `${((n / o.runs) * 100).toFixed(1)}%`;
  const lines = [
    `${o.runs} runs`,
    `Reached floor: ${o.reach.map((n, i) => `${i + 1}: ${p(n)}`).join("  ")}`,
    `Endings: vault ${p(o.vault)} · escaped ${p(o.escaped)} · fell ${p(o.fell)}`,
    `Gold: median ${o.median}, mean ${o.mean}, top 10% ≥ ${o.golds[Math.floor(o.golds.length * 0.9)]}`,
    `Ranks: ${Object.entries(o.ranks).map(([k, n]) => `${k} ${p(n)}`).join(" · ")}`,
    `By bot: ${Object.entries(o.byBot).map(([k, b]) => `${k} vault ${((b.vault / b.runs) * 100).toFixed(1)}% avg ${Math.round(b.gold / b.runs)}`).join(" · ")}`,
  ];
  return lines.join("\n");
}
