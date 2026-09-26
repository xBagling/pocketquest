// The painted start screen: the round door in the hill under the great tree, at night (TITLE_ART,
// from tools/scenes/build_title.py). Brought to life with the same tricks as the fork: the trees on
// both sides sway, the blue mushrooms glow and fade at their own pace, the stars twinkle, the moon
// breathes, the doorway's light flickers, now and then a star falls, and fireflies drift about.
import { TITLE_ART } from "./title-art.js";

const A = TITLE_ART;
const B = A.base;

/** The scene's HTML. The door is a button (tap it to set off). */
export function titleSceneHtml() {
  const rnd = (i, k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1; // steady per spot
  const shrooms = A.shrooms
    .map(([x, y, r], i) => `<span class="ts-glow cyan" style="left:${x - r * 1.6}px;top:${y - r * 1.6}px;width:${r * 3.2}px;height:${r * 3.2}px;--sp:${(2.6 + rnd(i, 1) * 3).toFixed(2)}s;--d:${(-rnd(i, 2) * 5).toFixed(2)}s"></span>`)
    .join("");
  const stars = A.stars
    .map(([x, y, s], i) => `<span class="ts-star" style="left:${x}px;top:${y}px;--s:${6 + s * 5}px;--sp:${(2 + rnd(i, 3) * 3.5).toFixed(2)}s;--d:${(-rnd(i, 4) * 6).toFixed(2)}s"></span>`)
    .join("");
  const [mx, my, mr] = A.moon;
  const [dx, dy, dr] = A.door;
  // The trees at the sides sway; the sky and the hill in the middle stay put.
  const canopy = (x0, x1, dir) => `<div class="ts-canopy" style="left:${x0}px;width:${x1 - x0}px;height:${Math.round(A.h * 0.58)}px;background-image:url('${A.img}');background-size:${A.w}px ${A.h}px;background-position:${-x0}px 0;--dir:${dir}"></div>`;
  return `<div class="scene art title-art" data-scene="title-art" role="img" aria-label="A round glowing door in a mossy hill beneath a great tree at night, glowing blue mushrooms along the path.">
    <div class="art-world" style="width:${A.w}px;height:${A.h}px">
      <img class="art-bg" src="${A.img}" alt="" draggable="false" />
      ${canopy(0, B.x - 60, 1)}${canopy(B.x + B.w + 60, A.w, -1)}
      <span class="ts-moon" style="left:${mx - mr * 3}px;top:${my - mr * 3}px;width:${mr * 6}px;height:${mr * 6}px"></span>
      ${stars}
      <span class="ts-shoot" style="left:${B.x + B.w * 0.2}px;top:${B.y + 80}px"></span>
      <span class="ts-door" style="left:${dx - dr * 2.4}px;top:${dy - dr * 2}px;width:${dr * 4.8}px;height:${dr * 4.4}px"></span>
      <span class="ts-spill" style="left:${dx - dr * 1.6}px;top:${dy + dr * 0.4}px;width:${dr * 3.2}px;height:${dr * 3.6}px"></span>
      ${shrooms}
      <button class="title-door" type="button" aria-label="The round door: begin the walk" style="left:${dx - dr}px;top:${dy - dr * 1.1}px;width:${dr * 2}px;height:${dr * 2.2}px"></button>
    </div>
    <canvas class="art-particles" aria-hidden="true"></canvas>
  </div>`;
}

/** Sparkles rise from the doorway and from the biggest mushrooms. */
export const titleSources = () => [
  [A.door[0], A.door[1] + 20, "#ffe7a0"],
  ...[...A.shrooms].sort((a, b) => b[2] - a[2]).slice(0, 10).map(([x, y]) => [x, y, "#8ff4ff"]),
];
export const titleArea = { x0: 0, y0: 120, x1: A.w, y1: A.h - 40 };

/**
 * Where the world goes in a window: the painting covers the window, the clean middle of it fills a
 * phone, and the door stays in the middle across (and a little above the middle down).
 */
export function titleView(vw, vh, { clearX = 0 } = {}) {
  const wide = vw > vh * 1.2;
  // Wide screens zoom in a little, so there's room to slide the moon clear of the title.
  const s = Math.max(vw / A.w, vh / A.h, Math.min(vw / B.w, vh / B.h)) * (wide ? 1.14 : 1);
  // On wide screens the door sits a little right of the middle, so the moon clears the title.
  let tx = vw * (wide ? 0.56 : 0.5) - A.door[0] * s;
  // Keep the moon to the right of the title (clearX: where the title ends on screen).
  const [mx, , mr] = A.moon;
  tx = Math.max(tx, clearX - (mx - mr) * s);
  let ty = wide ? vh * 0.58 - A.door[1] * s : vh / 2 - (B.y + B.h / 2) * s;
  tx = Math.min(0, Math.max(vw - A.w * s, tx));
  ty = Math.min(0, Math.max(vh - A.h * s, ty));
  return { s, tx, ty };
}
