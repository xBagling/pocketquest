// Everything a player keeps lives in localStorage. No accounts, no email.
import { todayDay } from "./util.js";
import { RULES_VERSION } from "./engine.js";
import { RULES } from "./config.js";

const KEY = "pocketquest:v1";

function blank() {
  return {
    player: globalThis.crypto?.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    seenHelp: false,
    sfxMuted: false,
    hardMode: false,
    runs: {},
    spent: 0, // gold spent at the camp
    owned: ["wanderer"],
    hero: "wanderer",
  };
}

let state = load();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (parsed && parsed.player && parsed.runs) return parsed;
  } catch {}
  return blank();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export const store = {
  get player() {
    return state.player;
  },
  get seenHelp() {
    return state.seenHelp;
  },
  set seenHelp(v) {
    state.seenHelp = Boolean(v);
    persist();
  },
  /** Hard mode: a 15-second lantern, and answers count exactly as typed. */
  get hardMode() {
    return Boolean(state.hardMode);
  },
  set hardMode(v) {
    state.hardMode = Boolean(v);
    persist();
  },
  get sfxMuted() {
    return Boolean(state.sfxMuted);
  },
  set sfxMuted(v) {
    state.sfxMuted = Boolean(v);
    persist();
  },
  /** The character you walk as next. */
  get hero() {
    return state.hero && (state.owned || []).includes(state.hero) ? state.hero : "wanderer";
  },
  set hero(id) {
    if ((state.owned || ["wanderer"]).includes(id)) state.hero = id;
    persist();
  },
  owns(id) {
    return id === "wanderer" || (state.owned || []).includes(id);
  },
  /** Gold in your purse: everything found on walks taken on their own day, less what you've spent. */
  get purse() {
    return Math.max(0, personalStats().total - (state.spent || 0));
  },
  /** Buy a character. Returns false if you can't afford it (or already have it). */
  buy(id, cost) {
    if (this.owns(id) || this.purse < cost) return false;
    state.owned = [...(state.owned || ["wanderer"]), id];
    state.spent = (state.spent || 0) + cost;
    state.hero = id;
    persist();
    return true;
  },
  run(day) {
    return state.runs[day] || null;
  },
  saveRun(run) {
    state.runs[run.day] = run;
    persist();
  },
  deleteRun(day) {
    delete state.runs[day];
    persist();
  },
  allRuns() {
    return state.runs;
  },
  exportJson() {
    return JSON.stringify(state, null, 2);
  },
  reset() {
    state = blank();
    persist();
  },
};

/** A saved run: its actions are the source of truth; the rest is a summary for lists and stats. */
export function newRunRecord(day, live) {
  return { day, live, hard: store.hardMode, rules: RULES_VERSION, floors: RULES.FLOORS, hero: store.hero, actions: [], deadline: null, startedAt: Date.now(), finishedAt: null, done: false, submitted: false, gold: 0, ending: null, floor: 1 };
}

/** Personal stats only count runs played on their own day ("live" runs). */
export function personalStats() {
  const runs = Object.values(state.runs);
  const live = runs.filter((r) => r.live && r.done);
  const vaults = live.filter((r) => r.ending === "vault");
  const floors = [0, 0, 0, 0, 0, 0]; // [vault, fell on 1..4 / escaped counts as 5]
  for (const r of live) {
    const k = r.ending === "vault" ? 0 : r.floor;
    floors[k] = (floors[k] || 0) + 1;
  }

  const days = new Set(live.map((r) => r.day));
  const today = todayDay();
  let current = 0;
  for (let d = days.has(today) ? today : today - 1; days.has(d); d--) current++;
  let max = 0;
  let run = 0;
  const sorted = [...days].sort((a, b) => a - b);
  sorted.forEach((d, i) => {
    run = i > 0 && sorted[i - 1] === d - 1 ? run + 1 : 1;
    max = Math.max(max, run);
  });

  const golds = live.map((r) => r.gold);
  return {
    played: live.length,
    vaults: vaults.length,
    best: golds.length ? Math.max(...golds) : 0,
    average: golds.length ? Math.round(golds.reduce((a, b) => a + b, 0) / golds.length) : 0,
    total: golds.reduce((a, b) => a + b, 0),
    current,
    max,
    floors,
    archivePlayed: runs.filter((r) => !r.live && r.done).length,
  };
}
