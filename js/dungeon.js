// Today's dungeon, the same for everyone: which questions wait behind which doors, who guards them,
// and which relics lie in the nook. Questions and relics come from the schedule; monsters, door
// order and the Toadstool's letter come from a seed, so they never change for a day.
import { SCHEDULE } from "./data/schedule.js";
import { RULES } from "./config.js";
import { BESTIARY, ROLE_LOOKS } from "./rules.js";
import { room } from "./content.js";
import { hashString, seededRandom } from "./util.js";

/** Which creature plays a monster at this door. A hash of its own, so it never moves the day's seed. */
export function lookFor(day, floor, door, monster, forks = 0) {
  // The illustrated fork: its left path (the tree hollow) is the goblin's and its right (the
  // mushroom house) the wisp's, whatever rule the path plays by. More painted creatures come later.
  if (floor >= 1 && floor <= forks && monster !== "dragon") return door === 0 ? "goblin" : "wisp";
  const looks = ROLE_LOOKS[monster];
  return looks?.length ? looks[hashString(`look:${day}:${floor}:${door}`) % looks.length] : monster;
}

export const scheduleLength = () => SCHEDULE.length;

/** The schedule line for a day. Days past the end of the schedule wrap around. */
export function dayEntry(day) {
  const line = SCHEDULE[(((day - 1) % SCHEDULE.length) + SCHEDULE.length) % SCHEDULE.length];
  const [first, f2, f3, f4, boss, relics] = line.split(";");
  return { first, pairs: [f2.split(","), f3.split(","), f4.split(",")], boss, relics: relics.split(",") };
}

const pool = (name) => Object.keys(BESTIARY).filter((k) => BESTIARY[k].pool === name);

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The first letter of an answer, the way the Letter lock reads it ("The Tempest" → T). */
export const initialOf = (name) =>
  name
    .replace(/^the\s+/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .charAt(0)
    .toUpperCase();

/** A fair letter for the Toadstool: at least four answers, and some of them not the obvious ones. */
function pickLetter(pid, rand) {
  const counts = new Map();
  for (const a of room(pid).answers) {
    const l = initialOf(a.name);
    if (!/[A-Z]/.test(l)) continue;
    const c = counts.get(l) || { n: 0, rare: 0 };
    c.n++;
    if (a.tier !== "c") c.rare++;
    counts.set(l, c);
  }
  const good = [...counts].filter(([, c]) => c.n >= 4 && c.rare >= 3).map(([l]) => l).sort();
  const ok = good.length ? good : [...counts].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([l]) => l);
  return ok[Math.floor(rand() * ok.length)];
}

const cache = new Map();

/**
 * The day's dungeon with this many glades (floors). The first glades are the schedule's line for
 * the day; any extra forks borrow pairs from other days' lines (deterministically, never repeating
 * a room that day), so a 5-glade day stays exactly as it always was.
 */
export function dungeonForDay(day, floors = RULES.FLOORS) {
  const key = `${day}:${floors}`;
  if (cache.has(key)) return cache.get(key);
  const e = dayEntry(day);
  const rand = seededRandom(hashString(`pocket-quest:${day}`));
  const firsts = shuffle(pool("first"), rand);
  const plains = shuffle(pool("plain"), rand);
  const elites = shuffle(pool("elite"), rand);

  const make = (pid, monster, armor, mult, elite) => {
    const door = { pid, monster, quirk: BESTIARY[monster].quirk, armor, mult, elite };
    if (door.quirk === "thick") door.armor = "g";
    if (door.quirk === "letter") door.letter = pickLetter(pid, rand);
    return door;
  };

  const levels = [{ doors: [make(e.first, firsts[0], "none", 1, false)] }];
  const forks = Math.max(0, floors - 2);
  const addPair = ([plainPid, elitePid], i, r) => {
    const floor = i + 1;
    const plain = make(plainPid, plains[i % plains.length], floor === 1 ? "none" : "s", 1, false);
    const elite = make(elitePid, elites[i % elites.length], floor === 1 ? "s" : "g", RULES.ELITE_MULT, true);
    levels.push({ doors: r() < 0.5 ? [plain, elite] : [elite, plain] });
  };
  e.pairs.slice(0, forks).forEach((p, i) => addPair(p, i, rand));
  if (forks > e.pairs.length) {
    // Extra forks: pairs from other days' lines, with their own seed so the rest of the day never shifts.
    const used = new Set([e.first, e.boss, ...e.pairs.flat()]);
    const extra = seededRandom(hashString(`pocket-quest:${day}:extra`));
    for (let i = e.pairs.length; i < forks; i++) {
      let pair = null;
      for (let k = 1; k < SCHEDULE.length && !pair; k++) {
        const other = dayEntry(day + k * 37 + i);
        const p = other.pairs[(i + k) % other.pairs.length];
        if (!used.has(p[0]) && !used.has(p[1])) pair = p;
      }
      pair ||= e.pairs[i % e.pairs.length];
      pair.forEach((pid) => used.add(pid));
      addPair(pair, i, extra);
    }
  }
  levels.push({ doors: [{ ...make(e.boss, "dragon", "g", 1, false), boss: true }] });

  levels.forEach((l, f) => l.doors.forEach((door, i) => (door.look = lookFor(day, f, i, door.monster, levels.length - 2))));

  const d = { day, floors: levels, relics: e.relics };
  cache.set(key, d);
  return d;
}
