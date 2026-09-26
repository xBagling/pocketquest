import { CONFIG } from "./config.js";

// ---------- DOM (only used in the browser) ----------

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Tagged template that escapes interpolations unless they are wrapped with raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    if (i === 0) return str;
    const v = values[i - 1];
    const s = v && v.__raw ? v.value : Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.value : esc(x))).join("") : esc(v);
    return out + s + str;
  }, "");
}
export const raw = (value) => ({ __raw: true, value: String(value ?? "") });

let toastTimer;
export function toast(message) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Days ----------
// Quest numbers follow the player's local calendar date, like Wordle.

const MS_DAY = 86_400_000;
const [LY, LM, LD] = CONFIG.LAUNCH_DATE.split("-").map(Number);
const LAUNCH_UTC = Date.UTC(LY, LM - 1, LD);

export function dayFromDate(date) {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - LAUNCH_UTC) / MS_DAY) + 1;
}
export const todayDay = () => dayFromDate(new Date());

export function dateFromDay(day) {
  const d = new Date(LAUNCH_UTC + (day - 1) * MS_DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function formatDay(day, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return dateFromDay(day).toLocaleDateString("en-US", opts);
}

export function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// ---------- Randomness ----------

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "a, b and c" */
export function listJoin(items, word = "and") {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`;
}
