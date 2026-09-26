// The answer lists and each room's loot table, decoded on first use. Pure (no DOM), so the server
// uses the same code to check results.
import { LISTS } from "./data/lists.js";
import { PROMPTS } from "./data/prompts.js";
import { decode } from "./codec.js";
import { keyOf, keyVariants, distance, typoBudget } from "./match.js";

const decoded = new Map();

/** A list's items: { name, aliases } with the list's filler words. */
export function listItems(li) {
  if (!decoded.has(li)) {
    const list = LISTS[li];
    const items = decode(list.items)
      .split("\n")
      .map((line) => {
        const [name, ...aliases] = line.split("|");
        return { name, aliases };
      });
    decoded.set(li, items);
  }
  return decoded.get(li);
}

export const promptIds = () => Object.keys(PROMPTS);
export const hasPrompt = (pid) => Object.hasOwn(PROMPTS, pid);

const rooms = new Map();

/**
 * Everything about one prompt: its question, its answers (most common first) with their tiers,
 * and a key → answer index for matching.
 */
export function room(pid) {
  if (rooms.has(pid)) return rooms.get(pid);
  const p = PROMPTS[pid];
  if (!p) throw new Error(`Unknown prompt ${pid}`);
  const list = LISTS[p.list];
  const items = listItems(p.list);
  const answers = p.a.split(" ").map((tok, rank) => {
    const idx = Number(tok.slice(0, -1));
    return { name: items[idx].name, aliases: items[idx].aliases, tier: tok.slice(-1), rank };
  });
  const byKey = new Map();
  answers.forEach((a, i) => {
    for (const s of [a.name, ...a.aliases]) {
      const k = keyOf(s, list.drop);
      if (k && !byKey.has(k)) byKey.set(k, i);
    }
  });
  const r = {
    id: pid,
    q: p.q,
    cat: p.cat,
    diff: p.diff,
    miss: p.miss || "",
    noun: list.noun,
    listKey: list.key,
    drop: list.drop,
    jewelNote: p.jd || "",
    answers,
    byKey,
    jewel: answers.find((a) => a.tier === "j") || null,
    // The dragon's five: the most common answers that aren't a trap or the jewel.
    sealed: answers.filter((a) => a.tier === "c" || a.tier === "s").slice(0, 5).map((a) => a.name),
  };
  rooms.set(pid, r);
  return r;
}

/** Exact match (after folding, aliases and plurals). Returns the answer index or -1. */
export function lookup(r, text) {
  const k = keyOf(text, r.drop);
  if (!k) return -1;
  if (r.byKey.has(k)) return r.byKey.get(k);
  for (const v of keyVariants(k)) if (r.byKey.has(v)) return r.byKey.get(v);
  return -1;
}

/**
 * Typo help for the answer box: the answers within the typo budget, closest first. Only offered
 * in normal mode; the engine itself only ever accepts exact matches.
 */
export function suggest(r, text, limit = 3) {
  const k = keyOf(text, r.drop);
  if (k.length < 3) return [];
  const budget = typoBudget(k.length);
  if (!budget) return [];
  const best = new Map();
  for (const [key, i] of r.byKey) {
    const d = distance(k, key, budget);
    if (d <= budget && (!best.has(i) || d < best.get(i))) best.set(i, d);
  }
  return [...best]
    .sort((a, b) => a[1] - b[1] || r.answers[a[0]].rank - r.answers[b[0]].rank)
    .slice(0, limit)
    .map(([i, d]) => ({ index: i, name: r.answers[i].name, d }));
}

let lexicon = null;
/**
 * Every answer the game knows, from every list, for warm misses: "Brazil is a country, just not
 * in Africa." Returns { name, noun, listKey } or null.
 */
export function recognise(text, preferList = null) {
  warmLexicon();
  const k = keyOf(text);
  const found = lexicon.get(k) || keyVariants(k).map((v) => lexicon.get(v)).find(Boolean);
  if (!found) return null;
  // The room's own list first ("Brazil is a country, but not in Africa"), then the broadest list
  // (a country before a World Cup host).
  return found.find((e) => e.listKey === preferList) || [...found].sort((a, b) => b.size - a.size)[0];
}

/**
 * Builds the every-answer lexicon (it decodes every list: a noticeable pause on a phone). The
 * game calls this in idle time, so the first wrong answer doesn't stutter.
 */
export function warmLexicon() {
  if (!lexicon) {
    lexicon = new Map();
    LISTS.forEach((list, li) => {
      const items = listItems(li);
      for (const it of items) {
        for (const s of [it.name, ...it.aliases]) {
          const k = keyOf(s, list.drop);
          if (k.length < 2) continue;
          const all = lexicon.get(k) || [];
          if (!all.some((e) => e.listKey === list.key)) all.push({ name: it.name, noun: list.noun, listKey: list.key, size: items.length });
          lexicon.set(k, all);
        }
      }
    });
  }
}

export const allLists = () => LISTS;
