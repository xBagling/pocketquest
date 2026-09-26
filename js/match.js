// Turning what people type into answer keys. Shared by the game, the build tools and the server,
// so an answer counts the same everywhere. Pure functions, no DOM.

const FOLD = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ð: "d", þ: "th", ł: "l", đ: "d", ı: "i" };

// Numbers are folded to roman numerals so "Toy Story 2", "Toy Story II" and "Toy Story two" match.
const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  first: 1, second: 2, third: 3,
};
const TOKEN = { st: "saint", mt: "mount", ft: "fort", mr: "mister", mrs: "missus", dr: "doctor", vs: "versus", n: "and" };

/**
 * The words of an answer, lower-cased and folded: accents, punctuation, "&", numbers and the
 * list's filler words ("penguin", "dynasty"…) don't matter.
 */
export function words(text, drop = []) {
  let s = String(text ?? "")
    .toLowerCase()
    .replace(/[ßæœøðþłđı]/g, (c) => FOLD[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[''`ʻʼ‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let t = s ? s.split(" ") : [];
  t = t.map((w) => {
    if (/^\d+$/.test(w)) {
      const n = Number(w);
      return n >= 1 && n <= 20 ? ROMAN[n] : String(n);
    }
    if (WORD_NUM[w]) return ROMAN[WORD_NUM[w]];
    return TOKEN[w] || w;
  });
  // A leading article never matters ("The Tempest" = "Tempest"), as long as something is left.
  if (t.length > 1 && (t[0] === "the" || t[0] === "a" || t[0] === "an")) t = t.slice(1);
  if (drop.length) {
    const kept = t.filter((w) => !drop.includes(w));
    if (kept.length) t = kept;
  }
  return t;
}

/** The comparison key: the folded words run together ("Côte d'Ivoire" → "cotedivoire"). */
export const keyOf = (text, drop = []) => words(text, drop).join("");

/** Plural and singular variants tried when the exact key isn't known ("cherries" → "cherry"). */
export function keyVariants(key) {
  const out = [];
  if (key.endsWith("ies")) out.push(key.slice(0, -3) + "y");
  if (key.endsWith("es")) out.push(key.slice(0, -2));
  if (key.endsWith("s")) out.push(key.slice(0, -1));
  else out.push(key + "s");
  return out.filter((k) => k.length > 2);
}

/** Optimal string alignment distance: typos, missing letters and swapped neighbours cost 1. */
export function distance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** How many typos a key of this length may have and still be recognised. */
export const typoBudget = (len) => (len <= 4 ? 0 : len <= 7 ? 1 : len <= 12 ? 2 : 3);
