// Answers ship lightly scrambled so a peek at the page source doesn't spoil today's rooms.
// This stops casual peeking, not a determined cheat; real hiding needs the server to hand out
// each day's rooms. Letters are rotated by a key that changes along the string, then reversed.

const A = "abcdefghijklmnopqrstuvwxyz";
const KEY = [7, 3, 11, 5, 17, 2, 13];

function shift(text, dir) {
  let out = "";
  let k = 0;
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const i = A.indexOf(lower);
    if (i < 0) {
      out += ch;
      continue;
    }
    const j = (i + dir * KEY[k++ % KEY.length] + 26 * 4) % 26;
    out += ch === lower ? A[j] : A[j].toUpperCase();
  }
  return out;
}

export const encode = (text) => [...shift(text, 1)].reverse().join("");
export const decode = (text) => shift([...text].reverse().join(""), -1);
