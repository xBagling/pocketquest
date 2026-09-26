// Puts a forest scene on the page, HD-2D style: the pixel picture, a blurred copy of it at the top
// and bottom (the tilt-shift that makes it read as a miniature), whoever stands in it, and then
// the light, in three overlays: shade, glow (screen-blended) and the colour grade with a vignette.
import { SCENES, SPRITES, PORTRAITS, RELIC_ART, PORTALS, FORK_SPOTS, HERO_ART } from "./art-data.js";

let uid = 0;
const f = (n) => +n.toFixed(3);

/** The light layers of a scene, in its 390-wide space. */
function lightSvgs(s) {
  const L = s.light;
  const W = s.w * 3;
  const H = s.h * 3;
  const i = ++uid;
  const vb = `viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"`;
  const radial = (p, k) =>
    `<radialGradient id="g${i}_${k}"><stop offset="0" stop-color="${p.color}" stop-opacity="${p.o ?? 0.5}"/><stop offset=".45" stop-color="${p.color}" stop-opacity="${f((p.o ?? 0.5) * 0.45)}"/><stop offset="1" stop-color="${p.color}" stop-opacity="0"/></radialGradient>`;
  const all = [...L.pools, ...L.glows];
  const shade = `<svg class="sc-shade" ${vb}><defs><linearGradient id="c${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030a" stop-opacity="${L.ceiling}"/><stop offset="1" stop-color="#05030a" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${L.ambient.color}" opacity="${L.ambient.o}"/><rect width="${W}" height="${Math.round(H * 0.34)}" fill="url(#c${i})"/></svg>`;
  const glow = `<svg class="sc-glow" ${vb}><defs>${all.map(radial).join("")}<filter id="b${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>${L.pools
    .map((p, k) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="url(#g${i}_${k})"/>`)
    .join("")}${L.rays.map((r) => `<path d="${r.d}" fill="${r.color}" opacity="${r.o ?? 0.18}" filter="url(#b${i})"/>`).join("")}${L.glows
    .map((g, k) => `<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}" fill="url(#g${i}_${L.pools.length + k})"/>`)
    .join("")}${L.dust.map(([x, y, r, o, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`).join("")}</svg>`;
  const grade = `<svg class="sc-grade" ${vb}><defs><radialGradient id="v${i}" cx=".5" cy=".48" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05030a" stop-opacity="${L.vignette}"/></radialGradient></defs>${L.grade ? `<rect width="${W}" height="${H}" fill="${L.grade.color}" opacity="${L.grade.o}"/>` : ""}<rect width="${W}" height="${H}" fill="url(#v${i})"/></svg>`;
  return { shade, glow, grade };
}

/** Where something of this many grid pixels stands, as percentages of the scene. */
export function place(sceneId, [x, y], w, h, lift = 0) {
  const s = SCENES[sceneId];
  return `left:${f(((x - w / 2) / s.w) * 100)}%;top:${f(((y - lift - h) / s.h) * 100)}%;width:${f((w / s.w) * 100)}%;height:${f((h / s.h) * 100)}%`;
}

/** A monster standing at a spot. `far` is the smaller size used at the fork. */
export function actorHtml(sceneId, monster, spot, { far = false, happy = false, cls = "", attrs = "" } = {}) {
  const m = SPRITES[monster];
  const s = far ? m.fork : m.room;
  const w = m.w * s;
  const h = m.h * s;
  return `<div class="actor${far ? " far" : ""}${happy ? " happy" : ""}${m.float ? " floats" : ""} ${cls}" data-m="${monster}" ${attrs} style="${place(sceneId, spot, w, h, far ? Math.round(m.float * 0.6) : m.float)}">
    <span class="a-shadow"></span><img class="a-img" src="${happy ? m.happy : m.img}" data-happy="${m.happy}" data-img="${m.img}" alt="" draggable="false" /></div>`;
}

/** You, walking into the scene as your character, at the scene's "you" spot. */
export function youHtml(sceneId, hero = "wanderer") {
  const h = HERO_ART[hero] || HERO_ART.wanderer;
  const sc = SCENES[sceneId];
  const spot = sc?.spots?.you;
  if (!spot) return "";
  return `<div class="actor you" data-hero="${hero}" style="${place(sceneId, [spot[0] + (h.w / 2 - h.ax), spot[1]], h.w, h.h)}"><span class="a-shadow"></span><img class="a-img" src="${h.img}" alt="" draggable="false" /></div>`;
}

/** A character's portrait, for diamonds and the camp. */
export const heroPortrait = (hero) => (HERO_ART[hero] || HERO_ART.wanderer).portrait;

/** Old Ember is the size of her whole scene. */
export function emberHtml(happy = false) {
  return `<div class="actor ember${happy ? " happy" : ""}" data-m="dragon" style="left:0;top:0;width:100%;height:100%"><img class="a-img" src="art/${happy ? "ember-happy" : "ember"}.png" data-happy="art/ember-happy.png" data-img="art/ember.png" alt="" draggable="false" /></div>`;
}

/** Win a creature over: its eyes close in a smile, it blushes, hops for joy, hearts float up, and it
 *  steps aside to let you through. */
export function happyActor(el, { aside = true } = {}) {
  const img = el?.querySelector(".a-img");
  if (!img || el.classList.contains("happy")) return;
  el.classList.add("happy");
  img.src = img.dataset.happy;
  if (!el.querySelector(".a-hearts")) el.insertAdjacentHTML("beforeend", `<span class="a-hearts" aria-hidden="true"><i></i><i></i><i></i></span>`);
  if (aside && !el.classList.contains("ember")) setTimeout(() => el.isConnected && el.classList.add("aside"), 1100);
}

/** Back to how it was (the admin preview). */
export function calmActor(el) {
  const img = el?.querySelector(".a-img");
  if (!img) return;
  el.classList.remove("happy", "aside");
  img.src = img.dataset.img;
  el.querySelector(".a-hearts")?.remove();
}

/** One of the paths at a fork (see PORTALS), with its warm light. */
export function portalHtml(sceneId, type, side, time) {
  const p = PORTALS[type];
  const [x, y] = FORK_SPOTS[side];
  const s = SCENES[sceneId];
  const g = p.glow;
  const glow = `<span class="portal-glow" style="left:${f((x / s.w) * 100)}%;top:${f(((y + g.dy) / s.h) * 100)}%;width:${f(((g.r * 2) / s.w) * 100)}%;--c:${g.color}"></span>`;
  // The same tilt-shift blur as the scene behind it, so the path sits in the same miniature.
  const [t0, t1, t2, t3] = s.light.tilt.map((t) => `${Math.round(t * 100)}%`);
  const mask = `linear-gradient(180deg,#000 0,#000 ${t0},transparent ${t1},transparent ${t2},#000 ${t3},#000 100%)`;
  const src = `art/p-${type}-${side}-${time}.png`;
  return `<img class="portal" data-portal="${type}" src="${src}" alt="" draggable="false" /><img class="portal tilt" src="${src}" alt="" draggable="false" style="-webkit-mask-image:${mask};mask-image:${mask}" />${glow}`;
}

/** The tap target over a path, in scene percentages. */
export function portalHit(sceneId, type, side) {
  const { hit } = PORTALS[type];
  const [x, y] = FORK_SPOTS[side];
  const s = SCENES[sceneId];
  return `left:${f(((x + hit.x) / s.w) * 100)}%;top:${f(((y + hit.y) / s.h) * 100)}%;width:${f((hit.w / s.w) * 100)}%;height:${f((hit.h / s.h) * 100)}%`;
}

export function relicHtml(sceneId, relic, spot, i, color = "#fff0c0") {
  const r = RELIC_ART[relic] || RELIC_ART.clover;
  return `<span class="relic-art" data-i="${i}" style="${place(sceneId, spot, r.w * 2, r.h * 2)};--c:${color}"><span class="glow"></span><img src="${r.img}" alt="" draggable="false" /></span>`;
}

/**
 * The whole scene. `inner` goes between the picture and the light (actors, relics); `over` goes on
 * top of the light (tap targets, labels).
 */
export function sceneHtml(id, { inner = "", over = "", cls = "", label = "" } = {}) {
  const s = SCENES[id];
  const L = s.light;
  const [a, b, c, d] = L.tilt.map((t) => `${Math.round(t * 100)}%`);
  const mask = `linear-gradient(180deg,#000 0,#000 ${a},transparent ${b},transparent ${c},#000 ${d},#000 100%)`;
  const { shade, glow, grade } = lightSvgs(s);
  const shadows = s.shadows.length
    ? `<svg class="sc-shadows" viewBox="0 0 ${s.w * 3} ${s.h * 3}" preserveAspectRatio="none" aria-hidden="true">${s.shadows.map(([cx, cy, rx, ry, o]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o}"/>`).join("")}</svg>`
    : "";
  // The scene is a window onto a wider world: normally it shows the middle (core) columns, and it
  // shows more of the world when it zooms out or the screen is wide.
  return `<div class="scene ${cls}" data-scene="${id}" style="--sw:${s.core || s.w};--ww:${s.w};--sh:${s.h};--blur:${f((L.blur / 3 / s.h) * 100)}cqh" ${label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`}>
    <div class="sc-world">
    <img class="sc-px" src="${s.img}" alt="" draggable="false" />
    <img class="sc-tilt" src="${s.img}" alt="" draggable="false" style="-webkit-mask-image:${mask};mask-image:${mask}" />
    ${shadows}
    <div class="sc-inner">${inner}</div>
    ${shade}${glow}${grade}
    <div class="sc-dark"></div>
    <div class="sc-motes" aria-hidden="true">${motes(id)}</div>
    ${over}
    </div>
  </div>`;
}

/** A few fireflies or sun-motes that drift, on top of the pre-scattered dust. */
function motes(id) {
  const night = /hollow|ring|dusk|title|night/.test(id);
  const n = night ? 26 : 18;
  let out = "";
  for (let k = 0; k < n; k++) {
    const x = (k * 37 + 11) % 96 + 2;
    const y = 30 + ((k * 53) % 55);
    out += `<i style="--x:${x}%;--y:${y}%;--d:${(5 + (k % 5) * 1.3).toFixed(1)}s;--delay:${(-k * 1.7).toFixed(1)}s;--dx:${(k % 2 ? 1 : -1) * (8 + (k % 4) * 5)}px"${night ? ' class="ff"' : ""}></i>`;
  }
  return out;
}

export const scene = (id) => SCENES[id];
export const portraitSrc = (id) => (id?.startsWith("hero-") ? (HERO_ART[id.slice(5)] || HERO_ART.wanderer).portrait : PORTRAITS[id] || PORTRAITS.spirit);
export { SCENES, SPRITES, PORTRAITS, RELIC_ART, PORTALS, FORK_SPOTS, HERO_ART };
