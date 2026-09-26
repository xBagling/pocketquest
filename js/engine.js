// The rules of a run, as a pure reducer. A run is its list of actions; the state is rebuilt by
// replaying them. That makes resuming after a reload exact, and lets the server re-play a result
// instead of trusting the gold a browser claims.
//
// Actions: { t: "door", i } · { t: "peek", i } · { t: "answer", text } · { t: "hint" } ·
//          { t: "timeout" } · { t: "relic", i }
import { RULES } from "./config.js";
import { TIERS, HEROES, beatsArmor } from "./rules.js";
import { room as roomData, lookup } from "./content.js";
import { dungeonForDay, initialOf } from "./dungeon.js";

export const HAGGLER_BONUS = 1.5;
export const HUNGRY_MULT = 3;
export const HUNGRY_BITE = 20;
export const SLEEPER_BONUS = 10;
export const LAMPLIGHTER_BONUS = 10;

// Rules version. Runs replay under the version they were played in.
//   1: a right answer too common for the armour cost a heart.
//   2: it bounces off instead (no gold, no heart) and you try again.
//   3: wrong answers are free too. Only a burnt-out candle costs a heart. The Puddle Slime
//      bounces Copper, the Sleepy Bat's candle costs 2 hearts, and the Clover turns Copper to Silver.
//   4: no more Fool's Gold. Those answers count as plain Copper, and the Lucky Coin turns your next
//      Copper answer into Gold instead.
//   5: a walk has RULES.FLOORS glades (stored with the run), and you walk as a character with an
//      ability (see HEROES). Before 5 every walk had 5 glades and the plain Wanderer.
//   6: only the Fox Scout can listen in at a fork, once a walk. Before 6 anyone could, once, and
//      the Fox at every fork.
export const RULES_VERSION = 6;

/** Whether you can listen in at this fork. Rules 6: the Fox Scout, once a walk. Before that anyone
 *  once a walk, and the Fox at every fork. */
export function canPeek(s) {
  if (s.rules >= 6) return s.hero === "fox" && !s.peeked;
  return !s.peeked || (s.hero === "fox" && s.peeked.floor !== s.floor);
}

/** A right answer that counts: found, and not bounced off armour. */
export const counts = (a) => a.idx >= 0 && !a.armored;

export function newRun(day, { hard = false, rules = RULES_VERSION, floors = RULES.FLOORS, hero = "wanderer" } = {}) {
  if (rules < 5) {
    floors = 5;
    hero = "wanderer";
  }
  if (!HEROES[hero]) hero = "wanderer";
  const strikes = (rules >= 2 ? RULES.BOSS_STRIKES : 2) - (hero === "knight" ? 1 : 0);
  return {
    day,
    hard,
    rules,
    hero,
    floors,
    dungeon: dungeonForDay(day, floors),
    floor: 0, // 0..floors-1
    phase: "door", // door → room → (nook after floor 2) → … → done
    hearts: RULES.HEARTS + (hero === "witch" ? 1 : 0),
    gold: 0,
    relic: null,
    helm: false,
    coin: false,
    rod: false,
    peeked: null, // the last listen at a fork, { floor, i } (see canPeek)
    strikesNeeded: Math.max(1, strikes), // rules 1: two strikes
    rooms: [],
    ending: null, // "vault" | "escaped" | "fell"
  };
}

export const currentRoom = (s) => (s.phase === "room" ? s.rooms.at(-1) : null);

/** How many right answers a room wants before it lets you pass. */
export const needed = (rm) => (rm.quirk === "collector" ? 2 : 1);

/** The letter a Letter lock answer must start with, and whether an answer passes it. */
export function passesLetter(rm, name, typed) {
  if (rm.quirk !== "letter") return true;
  return initialOf(name) === rm.letter || initialOf(typed) === rm.letter;
}

/** The Wisp's hint: the first letter of the most common rare answer you haven't said. */
export function wispHint(rm) {
  const r = roomData(rm.pid);
  const said = new Set(rm.answers.map((a) => a.idx));
  const pick = r.answers.find((a, i) => (a.tier === "e" || a.tier === "g") && !said.has(i)) || r.answers.find((a, i) => !said.has(i));
  return pick ? initialOf(pick.name) : "?";
}

function takeHit(s, rm, ev, cause, times = 1) {
  if (s.helm) {
    s.helm = false;
    rm.blocked++;
    ev.push({ type: "blocked", cause });
    return;
  }
  s.hearts = Math.max(0, s.hearts - times);
  rm.hits += times;
  ev.push({ type: "hit", cause, hearts: s.hearts, times });
  if (s.hearts <= 0) {
    s.ending = "fell";
    s.phase = "done";
    rm.result ||= "fell";
    ev.push({ type: "fell" });
  }
}

function advance(s, ev) {
  s.floor++;
  s.phase = s.floor === 2 && !s.relic ? "nook" : "door";
  ev.push({ type: "advance", floor: s.floor, phase: s.phase });
}

function openVault(s, ev) {
  const bonus = RULES.VAULT_BONUS + s.hearts * RULES.HEART_BONUS;
  s.gold += bonus;
  s.ending = "vault";
  s.phase = "done";
  ev.push({ type: "vault", bonus });
}

/** Gold for one answer in one room, with the monster's quirk. */
function goldFor(s, rm, tier) {
  let g = tier === "c" && s.hero === "magpie" ? 2 * TIERS.c.gold : TIERS[tier].gold;
  let mult = rm.mult;
  if (rm.quirk === "haggler") mult *= tier === "c" ? 0 : tier === "s" || tier === "g" ? HAGGLER_BONUS : 1;
  if (rm.quirk === "hungry" && (tier === "e" || tier === "j")) mult = HUNGRY_MULT;
  if (rm.hinted) mult /= 2;
  return Math.round(g * mult);
}

/**
 * Applies one action to the state (mutating it) and returns what happened, for the UI to show.
 * Returns null when the action isn't possible right now.
 */
export function apply(s, a) {
  const ev = [];
  if (!a || s.phase === "done") return null;

  if (a.t === "peek") {
    if (s.phase !== "door" || !canPeek(s)) return null;
    if (!s.dungeon.floors[s.floor]?.doors[a.i]) return null;
    s.peeked = { floor: s.floor, i: a.i };
    ev.push({ type: "peek", floor: s.floor, i: a.i });
    return ev;
  }

  if (a.t === "door") {
    if (s.phase !== "door") return null;
    const door = s.dungeon.floors[s.floor]?.doors[a.i];
    if (!door) return null;
    s.rooms.push({
      floor: s.floor,
      door: a.i,
      pid: door.pid,
      monster: door.monster,
      look: door.look || door.monster,
      quirk: door.quirk,
      letter: door.letter || null,
      armor: door.armor,
      mult: door.mult,
      elite: door.elite,
      boss: Boolean(door.boss),
      answers: [],
      hits: 0,
      blocked: 0,
      strikes: 0,
      forgiven: false,
      bounced: false,
      hinted: false,
      hintLetter: null,
      healed: 0,
      eaten: 0,
      rod: s.rod || s.hero === "dowser",
      result: null,
    });
    s.rod = false;
    s.phase = "room";
    ev.push({ type: "enter", door });
    return ev;
  }

  if (a.t === "relic") {
    if (s.phase !== "nook") return null;
    const id = s.dungeon.relics[a.i];
    if (!id) return null;
    s.relic = id;
    if (id === "draught") s.hearts = Math.min(RULES.MAX_HEARTS, s.hearts + 1);
    if (id === "helm") s.helm = true;
    if (id === "coin") s.coin = true;
    if (id === "rod") s.rod = true;
    if (id === "tooth") s.strikesNeeded -= 1;
    s.phase = "door";
    ev.push({ type: "relic", id });
    return ev;
  }

  const rm = currentRoom(s);
  if (!rm) return null;

  if (a.t === "hint") {
    if (rm.quirk !== "bargain" || rm.hinted) return null;
    rm.hinted = true;
    rm.hintLetter = wispHint(rm);
    ev.push({ type: "hint", letter: rm.hintLetter });
    return ev;
  }

  if (a.t === "timeout") {
    if (rm.boss) {
      rm.result = "escaped";
      s.ending = "escaped";
      s.phase = "done";
      ev.push({ type: "escaped" });
      return ev;
    }
    rm.result = rm.answers.some(counts) ? "partial" : "timeout";
    ev.push({ type: "timeout" });
    takeHit(s, rm, ev, "timeout", s.rules >= 3 && rm.quirk === "sleeper" ? 2 : 1);
    if (s.phase !== "done") advance(s, ev);
    return ev;
  }

  if (a.t === "answer") {
    const text = String(a.text ?? "").trim().slice(0, 80);
    if (!text) return null;
    const r = roomData(rm.pid);
    let idx = lookup(r, text);
    let reason = null;
    if (idx >= 0 && !passesLetter(rm, r.answers[idx].name, text)) {
      reason = "letter";
      idx = -1;
    }

    if (idx < 0) {
      rm.answers.push({ text, idx: -1, reason });
      ev.push({ type: "miss", text, reason });
      // Guessing is free: only the candle costs hearts.
      if (s.rules >= 3) return ev;
      if (rm.quirk === "bouncy" && !rm.bounced) {
        rm.bounced = true;
        ev.push({ type: "bounced" });
      } else if (s.relic === "clover" && !rm.forgiven) {
        rm.forgiven = true;
        ev.push({ type: "forgiven" });
      } else takeHit(s, rm, ev, "miss", rm.quirk === "sleeper" ? 2 : 1);
      return ev;
    }

    const ans = r.answers[idx];
    if (rm.answers.some((x) => x.idx === idx)) {
      ev.push({ type: "dupe", name: ans.name });
      return ev;
    }
    if (rm.boss && r.sealed.includes(ans.name)) {
      ev.push({ type: "sealed", name: ans.name });
      return ev;
    }

    // Rules 4: Fool's Gold is gone; those answers are ordinary Copper.
    const base = s.rules >= 4 && ans.tier === "f" ? "c" : ans.tier;
    let tier = base;
    let lucky = false;
    if (tier === (s.rules >= 4 ? "c" : "f") && s.coin) {
      tier = "g";
      s.coin = false;
      lucky = true;
    }
    // The Four-leaf Clover: the first Copper answer in each room turns to Silver.
    let clover = false;
    if (tier === "c" && s.relic === "clover" && s.rules >= 3 && !rm.forgiven) {
      tier = "s";
      rm.forgiven = true;
      clover = true;
    }
    // The Puddle Slime is bouncy: Copper bounces off it like armour.
    const through = beatsArmor(tier, rm.armor) && !(s.rules >= 3 && rm.quirk === "bouncy" && tier === "c");
    // Too common for the armour: it bounces off. No gold and no heart lost; try a rarer one.
    const armored = !through && s.rules >= 2;
    const gold = armored ? 0 : goldFor(s, rm, tier);
    s.gold += gold;
    rm.answers.push({ text, idx, tier, gold, through, lucky, ...(armored && { armored }), ...(clover && { clover }) });
    ev.push({ type: "loot", name: ans.name, tier, trueTier: base, gold, through, lucky, armored, clover });

    // The Mimic takes a bite of your hoard for a Copper answer.
    if (rm.quirk === "hungry" && tier === "c") {
      const bite = Math.min(HUNGRY_BITE, s.gold);
      s.gold -= bite;
      rm.eaten += bite;
      ev.push({ type: "eaten", gold: bite });
    }
    // A rare enough answer knocks the Stone Troll out cold, and you catch your breath.
    if (rm.quirk === "thick" && (tier === "e" || tier === "j") && s.hearts < RULES.MAX_HEARTS) {
      s.hearts++;
      rm.healed++;
      ev.push({ type: "healed", hearts: s.hearts });
    }

    if (rm.boss) {
      if (through) {
        rm.strikes++;
        ev.push({ type: "strike", strikes: rm.strikes, needed: s.strikesNeeded });
        if (rm.strikes >= s.strikesNeeded) {
          rm.result = "slain";
          openVault(s, ev);
        }
      } else if (!armored) takeHit(s, rm, ev, "armor");
      return ev;
    }

    if (armored) return ev;
    if (!through) takeHit(s, rm, ev, "armor");
    if (s.phase === "done") return ev;
    const got = rm.answers.filter(counts);
    if (got.length < needed(rm)) {
      ev.push({ type: "collect", have: got.length, need: needed(rm) });
      return ev;
    }
    rm.result = got.every((x) => x.through) ? "kill" : "scrappy";
    advance(s, ev);
    return ev;
  }

  return null;
}

/** Rebuilds a run from its actions. With strict, any impossible action makes the whole run invalid. */
export function replay(day, actions, { hard = false, strict = false, rules = RULES_VERSION, floors, hero } = {}) {
  const s = newRun(day, { hard, rules, floors, hero });
  for (const a of actions || []) {
    const ev = apply(s, a);
    if (!ev && strict) return null;
  }
  return s;
}

/** How deep the run got: 1 to the number of glades. */
export const floorReached = (s) => (s.rooms.length ? s.rooms.at(-1).floor + 1 : 1);

/** Seconds on the candle for the current room, with the Spare Candle and the Light sleeper. */
export function candleSeconds(s, rm = currentRoom(s)) {
  const base = rm?.boss ? (s.hard ? RULES.BOSS_CANDLE_HARD : RULES.BOSS_CANDLE) : s.hard ? RULES.CANDLE_HARD : RULES.CANDLE;
  return base + (s.relic === "candle" ? RULES.SPARE_CANDLE : 0) + (rm?.quirk === "sleeper" ? SLEEPER_BONUS : 0) + (s.hero === "lamplighter" ? LAMPLIGHTER_BONUS : 0);
}
