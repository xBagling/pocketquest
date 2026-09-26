// The illustrated fork: the painted scene (FORK_ART, cut by tools/scenes/build_fork.py) with its
// layers brought back to life. The glowing things breathe, the canopy sways, the
// slime bobs in its halo, and the creatures of the two paths wait at the tree hollow (left) and the
// mushroom house (right). Positions are in the painting's own pixels (the world).
import { FORK_ART } from "./fork-art.js";
import { SPRITES, HERO_ART } from "./art-data.js";

const B = FORK_ART.base;
const at = (x, y) => [B.x + x, B.y + y]; // a point in the clean scene → the world

export const FORK = {
  art: FORK_ART,
  // Where the two paths' guardians stand (their feet): the goblin's and the wisp's spots.
  spots: [
    [FORK_ART.chars.goblin.x, FORK_ART.chars.goblin.y],
    [FORK_ART.chars.wisp.x, FORK_ART.chars.wisp.y],
  ],
  // The badges hover here, and each path's card hangs just under its badge.
  badges: [at(355, 322), at(663, 694)],
  // A letter lock's tag, on the guardian's side.
  tags: [at(186, 300), at(583, 572)],
  // Tap areas for the two paths: the tree hollow and the bridge; the mushroom house.
  hits: [
    [...at(80, 250), 300, 420],
    [...at(470, 400), 270, 360],
  ],
  // What to keep in view: the whole clean scene across, from the treetops down to the traveller.
  focus: { x0: B.x, x1: B.x + B.w, y0: B.y + 90, y1: FORK_ART.chars.traveller.y + 40 },
  // Warm and magic lights that flicker and breathe: [x, y, radius, colour, speed].
  glows: [
    [...at(250, 470), 60, "#ffcf7a", 2.6],
    [...at(433, 682), 56, "#ffcf7a", 3.1],
    [...at(190, 960), 56, "#ffcf7a", 2.8],
    [...at(492, 960), 56, "#ffcf7a", 3.4],
    [...at(452, 640), 48, "#ff8a4a", 1.9],
    [...at(600, 640), 150, "#ffd890", 4.5],
    [...at(605, 470), 120, "#ff9a6a", 5.2],
    [...at(270, 820), 110, "#6ee8ff", 3.8],
  ],
  // Points along the stream, for its glints.
  stream: [at(640, 355), at(560, 400), at(470, 455), at(390, 510), at(320, 560), at(240, 610), at(160, 645), at(70, 668)],
};

/** Sparkles rise gently from these (the lanterns, the mushroom house, the slime's halo). */
/** The medal over each path: the painted frame, with the guardian's portrait set in it. */
export const badgeHtml = (i, portrait, d) => `<button class="path-pin art" type="button" data-pick="${i}" tabindex="-1" aria-hidden="true" style="--d:${d}s;width:${FORK_ART.badge.w}px;height:${FORK_ART.badge.h}px"><img class="frame" src="${FORK_ART.badge.img}" alt="" /><img class="face pixel" src="${portrait}" alt="" /></button>`;

export const forkSources = () => [
  [...at(605, 520), "#ffd890"],
  [...at(600, 660), "#ffe7a0"],
  [...at(270, 790), "#6ee8ff"],
  [...at(250, 470), "#ffcf7a"],
  [...at(433, 682), "#ffcf7a"],
];

const img = (src, x, y, w, h, cls = "", extra = "") => `<img class="${cls}" src="${src}" alt="" draggable="false" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}" />`;

/** Someone standing at a spot, feet at [x, y]: a painted creature, or a small sprite drawn larger. */
function standing(look, [x, y], { cls = "", attrs = "" } = {}) {
  const c = FORK_ART.chars[look];
  if (c) return `<div class="art-actor ${cls}" data-look="${look}" ${attrs} style="left:${x - c.w / 2}px;top:${y - c.h}px;width:${c.w}px;height:${c.h}px"><span class="a-shadow"></span><img class="a-img" src="${c.img}" alt="" draggable="false" /></div>`;
  const sp = SPRITES[look];
  const k = 88 / sp.h;
  const w = sp.w * k;
  const h = sp.h * k;
  return `<div class="art-actor pixel-actor ${cls}" data-look="${look}" ${attrs} style="left:${x - w / 2}px;top:${y - h - (sp.float || 0) * k}px;width:${w}px;height:${h}px"><span class="a-shadow"></span><img class="a-img" src="${sp.img}" data-happy="${sp.happy}" alt="" draggable="false" /></div>`;
}

/** The traveller: the painted one for the Wanderer, any other character's sprite drawn larger. */
function traveller(hero) {
  const t = FORK_ART.chars.traveller;
  if (hero === "wanderer") return `<div class="art-actor you" style="left:${t.x - t.w / 2}px;top:${t.y - t.h}px;width:${t.w}px;height:${t.h}px"><span class="a-shadow"></span><img class="a-img" src="${t.img}" alt="" draggable="false" /></div>`;
  const h = HERO_ART[hero] || HERO_ART.wanderer;
  const k = t.h / h.h;
  return `<div class="art-actor you pixel-actor" style="left:${t.x - (h.w * k) / 2}px;top:${t.y - h.h * k}px;width:${h.w * k}px;height:${h.h * k}px"><span class="a-shadow"></span><img class="a-img" src="${h.img}" alt="" draggable="false" /></div>`;
}

/** The whole painted scene. doors: the fork's two doors (their looks stand at the paths). */
export function forkSceneHtml({ doors, hero, labels }) {
  const A = FORK_ART;
  const fx = A.fx;
  const glows = FORK.glows.map(([x, y, r, c, sp], i) => `<span class="art-glow" style="left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;--c:${c};--sp:${sp}s;--d:${(-i * 0.7).toFixed(1)}s"></span>`).join("");
  const halo = fx.halo;
  const slime = A.chars.slime;
  const hits = FORK.hits.map(([x, y, w, h], i) => `<button class="art-hit" type="button" data-pick="${i}" aria-label="${labels[i]}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></button>`).join("");
  return `<div class="scene art" data-scene="fork-art" role="img" aria-label="A fork in an enchanted wood: one path over a stone bridge to a hollow tree, the other to a glowing mushroom house.">
    <div class="art-world" style="width:${A.w}px;height:${A.h}px">
      <img class="art-bg" src="${A.img}" alt="" draggable="false" />
      <div class="art-canopy" style="background-image:url('${A.img}');background-size:${A.w}px ${A.h}px;height:${B.y + 520}px"></div>
      ${img(fx.beams.img, fx.beams.x, fx.beams.y, fx.beams.w, fx.beams.h, "art-fx beams")}
      ${glows}
      ${img(fx.gold.img, fx.gold.x, fx.gold.y, fx.gold.w, fx.gold.h, "art-fx gold")}
      ${img(fx.purple.img, fx.purple.x, fx.purple.y, fx.purple.w, fx.purple.h, "art-fx purple")}
      ${img(fx.runes.img, fx.runes.x, fx.runes.y, fx.runes.w, fx.runes.h, "art-fx runes")}
      ${img(A.chars.sack.img, A.chars.sack.x - A.chars.sack.w / 2, A.chars.sack.y - A.chars.sack.h, A.chars.sack.w, A.chars.sack.h, "art-prop")}
      ${doors.map((d, i) => standing(d.look, FORK.spots[i], { cls: "guard", attrs: `data-path="${i}"` })).join("")}
      <div class="art-slime" style="left:${halo.x}px;top:${halo.y}px;width:${halo.w}px;height:${halo.h}px">
        <img class="art-fx halo" src="${halo.img}" alt="" draggable="false" />
        ${img(slime.img, slime.x - slime.w / 2 - halo.x, slime.y - slime.h - halo.y, slime.w, slime.h, "slime-body")}
      </div>
      ${traveller(hero)}
      ${hits}
    </div>
    <div class="art-ui"><canvas class="art-particles" aria-hidden="true"></canvas></div>
  </div>`;
}

/**
 * Where the world goes in a window of this size: the focus fills the width it can, the painting
 * always covers the window, and on wide screens the paths sit in the room left of the panel.
 */
export function forkView(vw, vh, { free = vw, top = 0, room = 1 } = {}) {
  const f = FORK.focus;
  const A = FORK_ART;
  const s = Math.max(vw / A.w, vh / A.h, room * Math.min(free / (f.x1 - f.x0), (vh - top) / (f.y1 - f.y0)));
  const cx = ((f.x0 + f.x1) / 2) * s;
  const cy = ((f.y0 + f.y1) / 2) * s;
  let tx = free / 2 - cx;
  let ty = top + (vh - top) / 2 - cy;
  tx = Math.min(0, Math.max(vw - A.w * s, tx));
  ty = Math.min(0, Math.max(vh - A.h * s, ty));
  return { s, tx, ty };
}
