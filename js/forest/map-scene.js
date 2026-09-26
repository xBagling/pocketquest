// The painted map: the whole walk seen along the path, from the first clearing at the bottom to Old
// Ember's glowing cave at the top (MAP_ART, from tools/scenes/build_map.py). It has five clearings
// and the cave, so it's used when a walk has six glades; other walks keep the drawn map.
// Alive like the other painted screens: the trees at the sides sway, the blue mushrooms and the
// lanterns glow and fade, the cave's light breathes, and the glades you've cleared keep a lantern lit.
import { MAP_ART } from "./map-art.js";

const A = MAP_ART;
export const MAP = A;

/** Whether this walk fits the painted map (one stop per glade). */
export const paintedMapFits = (floors) => floors === A.stops.length;

/**
 * The scene. done: which glades are cleared (they keep a lantern lit). night: the walk to Old Ember.
 * The markers, the traveller and the "You are here" tag go in the overlay, pinned by fitMap().
 */
export function mapSceneHtml({ done = [], night = false }) {
  const rnd = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  const shrooms = A.shrooms
    .map(([x, y, r], i) => `<span class="ts-glow cyan" style="left:${x - r * 1.6}px;top:${y - r * 1.6}px;width:${r * 3.2}px;height:${r * 3.2}px;--sp:${(2.6 + rnd(i, 1) * 3).toFixed(2)}s;--d:${(-rnd(i, 2) * 5).toFixed(2)}s"></span>`)
    .join("");
  const lamps = A.lamps.map(([x, y], i) => `<span class="art-glow" style="left:${x - 50}px;top:${y - 50}px;width:100px;height:100px;--c:#ffcf7a;--sp:${2.4 + i * 0.7}s"></span>`).join("");
  const cleared = done
    .map((f) => {
      const [x, y, w, h] = A.stops[f];
      return `<span class="mp-cleared" style="left:${x - w * 0.7}px;top:${y - h * 1.2}px;width:${w * 1.4}px;height:${h * 2.4}px;--d:${(-f * 0.6).toFixed(1)}s"></span>`;
    })
    .join("");
  const [cx, cy] = A.cave;
  const edge = 700; // the trees on each side, which sway
  const canopy = (x0, x1, dir) => `<div class="ts-canopy" style="left:${x0}px;width:${x1 - x0}px;height:${Math.round(A.h * 0.62)}px;background-image:url('${A.img}');background-size:${A.w}px ${A.h}px;background-position:${-x0}px 0;--dir:${dir}"></div>`;
  return `<div class="scene art map-art${night ? " night" : ""}" data-scene="map-art" role="img" aria-label="The walk ahead: a path winding through five clearings, past a pond and a stream, to a cave glowing gold at the top.">
    <div class="art-world" style="width:${A.w}px;height:${A.h}px">
      <img class="art-bg" src="${A.img}" alt="" draggable="false" />
      ${canopy(0, edge, 1)}${canopy(A.w - edge, A.w, -1)}
      <span class="mp-night"></span>
      <span class="mp-cave" style="left:${cx - 170}px;top:${cy - 150}px;width:340px;height:300px"></span>
      ${lamps}${cleared}${shrooms}
    </div>
    <div class="art-ui"><canvas class="art-particles" aria-hidden="true"></canvas></div>
  </div>`;
}

/** Sparkles rise from the cave and the lanterns. */
export const mapSources = () => [[A.cave[0], A.cave[1], "#ffd890"], ...A.lamps.map(([x, y]) => [x, y, "#ffcf7a"])];
export const mapArea = { x0: 700, y0: 200, x1: A.w - 700, y1: A.h - 40 };

/**
 * Where the world goes: the painting covers the window, and the whole walk (the clearings and the
 * cave) fits in the room above the panel (roomH) and below the top (top), centred across.
 */
export function mapView(vw, vh, { roomH = vh, top = 0, free = vw } = {}) {
  const xs = A.stops.map((s) => s[0]);
  const ys = A.stops.map((s) => s[1]);
  const f = { x0: Math.min(...xs) - 240, x1: Math.max(...xs) + 240, y0: Math.min(...ys) - 150, y1: Math.max(...ys) + 110 };
  // It covers the room above the panel; below that the panel's own backdrop takes over.
  const s = Math.max(vw / A.w, roomH / A.h, Math.min(free / (f.x1 - f.x0), (roomH - top) / (f.y1 - f.y0)));
  let tx = free / 2 - ((f.x0 + f.x1) / 2) * s;
  let ty = top + (roomH - top) / 2 - ((f.y0 + f.y1) / 2) * s;
  tx = Math.min(0, Math.max(vw - A.w * s, tx));
  ty = Math.min(0, Math.max(roomH - A.h * s, ty));
  return { s, tx, ty };
}
