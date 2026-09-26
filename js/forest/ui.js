// Small pieces of the forest UI, as HTML strings: loot coins, hearts, the lantern, diamonds, the
// pointing hand. Each loot tier has its own shape as well as its own colour.
import { portraitSrc } from "./scene.js";

const COIN = {
  c: ["#e0925a", "#8a4a22"],
  f: ["#e8d27a", "#8c7a2a"],
  s: ["#e6ebf2", "#7d8799"],
  g: ["#ffd76a", "#a8761c"],
};

/** A loot token for a tier: c f s g e j, or x for nothing (a burnt-out lantern). */
export function coin(tier, size = 14, cls = "") {
  const a = `class="tok ${cls}" width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true" focusable="false"`;
  if (tier === "e")
    return `<svg ${a}><path d="M3 5 L5 2 H9 L11 5 L7 12 Z" fill="#7ae4ff" stroke="#2e8ab8" stroke-width="1"/><path d="M3 5 H11 M5 2 L7 5 L9 2 M7 5 V12" stroke="#2e8ab8" stroke-width=".7" fill="none"/></svg>`;
  if (tier === "j")
    return `<svg ${a}><path d="M2 11 L2 4 L5 7 L7 2.5 L9 7 L12 4 L12 11 Z" fill="#ffd76a" stroke="#a8761c" stroke-width="1"/><circle cx="7" cy="9" r="1.2" fill="#f4a8c0"/></svg>`;
  if (tier === "x") return lantern(size, { out: true, cls });
  if (tier === "?") return `<svg ${a}><circle cx="7" cy="7" r="5.6" fill="none" stroke="#6a8a82" stroke-width="1" stroke-dasharray="2 1.6"/><text x="7" y="10" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600" font-size="8" fill="#8fa8a0">?</text></svg>`;
  const [face, rim] = COIN[tier] || COIN.c;
  let mark = "";
  // Copper: a plain dot. Silver: a ring. Gold: a star. Fool's Gold: a crack and a grin.
  if (tier === "c") mark = `<circle cx="7" cy="6.4" r="1.3" fill="${rim}" opacity=".6"/>`;
  if (tier === "s") mark = `<circle cx="7" cy="6.4" r="3.1" fill="none" stroke="${rim}" stroke-width="1" opacity=".6"/>`;
  if (tier === "g") mark = `<path d="M7 3.4l.9 2 2.1.2-1.6 1.4.5 2.1L7 8l-1.9 1.1.5-2.1L4 5.6l2.1-.2z" fill="${rim}" opacity=".7"/>`;
  if (tier === "f") mark = `<path d="M8.6 1.6 7.2 4.4 8.4 5.6 6.6 8.4" fill="none" stroke="${rim}" stroke-width=".9"/><path d="M4.4 7.6q2.6 2 5.2 0" fill="none" stroke="${rim}" stroke-width="1"/><circle cx="5.2" cy="5.4" r=".7" fill="${rim}"/><circle cx="8.8" cy="5.4" r=".7" fill="${rim}"/>`;
  return `<svg ${a}><circle cx="7" cy="7" r="6" fill="${rim}"/><circle cx="7" cy="6.4" r="5.2" fill="${face}"/>${mark}</svg>`;
}

export function heart(on = true, size = 15, cls = "") {
  return `<svg class="hrt ${on ? "on" : "off"} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="${on ? "#ff7a6b" : "#1e3434"}" stroke="${on ? "#ffd0c4" : "#4a6a64"}" stroke-width="1.6"/></svg>`;
}

export function lantern(size = 16, { out = false, cls = "" } = {}) {
  const glass = out ? "#3a4a48" : "#ffd66b";
  const core = out ? "#4a5a58" : "#fff3c4";
  return `<svg class="lant ${out ? "out" : ""} ${cls}" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 1h4v2H6z" fill="#3a2a1a"/><path d="M4 4h8l-1 9H5z" fill="#3a2a1a"/><path d="M5.5 5h5l-.8 7H6.3z" fill="${glass}"/><path d="M7 7h2v4H7z" fill="${core}"/><path d="M4 13h8v2H4z" fill="#3a2a1a"/></svg>`;
}

export function leaf(size = 14, col = "#9fe0a8") {
  return `<svg class="leaf" width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 12 C2 5 6 2 12 2 C12 8 9 12 2 12 Z" fill="${col}" opacity=".9"/><path d="M2 12 L9 5" stroke="#06121a" stroke-width="1"/></svg>`;
}

/** A shield with a number, or with the tier it needs. */
export function shield(label, size = 22) {
  return `<svg class="shield" width="${size}" height="${size}" viewBox="0 0 30 30" aria-hidden="true" focusable="false"><path d="M15 2 L26 6 V14 C26 21 21 26 15 28 C9 26 4 21 4 14 V6 Z" fill="#1c4a3e" stroke="#e8e0c4" stroke-width="1.6"/><path d="M15 5 L23 8 V14 C23 19 19.5 23 15 25 Z" fill="#2a6a52"/><text x="15" y="20" text-anchor="middle" font-family="Fraunces, serif" font-weight="700" font-size="13" fill="#fff">${label}</text></svg>`;
}

const ICONS = {
  book: `<path d="M3 5c3-1 6-1 8 1v12c-2-2-5-2-8-1z"/><path d="M19 5c-3-1-6-1-8 1v12c2-2 5-2 8-1z"/>`,
  how: `<circle cx="11" cy="11" r="8"/><path d="M8.6 8.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6"/><circle cx="11" cy="15.6" r=".6" fill="currentColor"/>`,
  gear: `<circle cx="11" cy="11" r="3"/><path d="M11 2.5v3M11 16.5v3M2.5 11h3M16.5 11h3M5 5l2.1 2.1M14.9 14.9 17 17M5 17l2.1-2.1M14.9 7.1 17 5"/>`,
  back: `<path d="M13.5 5 7.5 11l6 6"/>`,
  close: `<path d="M6 6l10 10M16 6 6 16"/>`,
  share: `<path d="M11 3v11M7 7l4-4 4 4"/><path d="M5 11v7h12v-7"/>`,
  copy: `<rect x="7" y="7" width="10" height="11" rx="1"/><path d="M5 14V4h9"/>`,
  map: `<path d="M3 6l5-2 6 2 5-2v12l-5 2-6-2-5 2z"/><path d="M8 4v12M14 6v12"/>`,
  sound: `<path d="M4 9h3l4-3v10l-4-3H4z"/><path d="M14 8.5a3.5 3.5 0 0 1 0 5M16.5 6.5a6.5 6.5 0 0 1 0 9"/>`,
  mute: `<path d="M4 9h3l4-3v10l-4-3H4z"/><path d="M14.5 8.5l4 5M18.5 8.5l-4 5"/>`,
  ear: `<path d="M7 9a4 4 0 1 1 8 0c0 3-3 3.5-3 6.5a2.5 2.5 0 0 1-5 0"/><path d="M9.5 9.5a1.5 1.5 0 1 1 3 0c0 1-1 1.5-1 2.5"/>`,
  dice: `<rect x="4" y="4" width="14" height="14" rx="2.5"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="14" cy="14" r=".9" fill="currentColor"/><circle cx="11" cy="11" r=".9" fill="currentColor"/>`,
  refresh: `<path d="M17 6v4h-4"/><path d="M16.5 10A6 6 0 1 0 17 13"/>`,
  arrow: `<path d="M5 11h12M12 6l5 5-5 5"/>`,
  sparkle: `<path d="M11 3v5M11 14v5M3 11h5M14 11h5"/><path d="M11 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor"/>`,
};
/** A thin line icon (in the cream of the UI). */
export function ico(name, size = 22, cls = "") {
  return `<svg class="ico-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
}

/** A rotated-square portrait: a monster, you, or a question mark. */
export function dia(who, cls = "", title = "") {
  return `<span class="dia ${cls}"${title ? ` title="${title}"` : ""}>${who ? `<img class="pixel" src="${portraitSrc(who)}" alt="" draggable="false" />` : "<span>?</span>"}</span>`;
}

export const hand = (cls = "") => `<img class="hand pixel ${cls}" src="art/hand.png" alt="" draggable="false" />`;

export const divider = (w = 56) => `<div class="divider" style="--w:${w}px"><span></span>${leaf(12)}<span></span></div>`;

/** The meter under the lantern: how much light is left. */
export const lanternMeter = (frac = 1) => `<span class="meter">${lantern(16)}<span class="meter-bar"><span class="meter-fill" style="transform:scaleX(${frac})"></span></span></span>`;
