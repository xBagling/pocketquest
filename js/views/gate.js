// The title: the round door in the hill under the great tree, painted and alive. One clear button.
import { html, raw, msUntilMidnight } from "../util.js";
import { sfx } from "../sfx.js";
import { burst, centerOf, drift } from "../fx.js";
import { lantern, leaf } from "../forest/ui.js";
import { titleSceneHtml, titleView, titleSources, titleArea } from "../forest/title-scene.js";
import { startArtParticles } from "../forest/particles.js";

/** How wide the title's words are (the heading itself is as wide as the screen). */
function titleTextWidth(el) {
  if (!el) return 0;
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect().width;
}

/** "9 h 12 m" until the next walk. */
export function untilNext() {
  const m = Math.ceil(msUntilMidnight() / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
}

export function renderGate({ view, day, mode, onStart }) {
  const archive = mode === "archive";
  view.innerHTML = html`<section class="title-screen painted">
      ${raw(titleSceneHtml())}
      <div class="tt-top">
        <div class="tt-kicker">A cozy daily wander</div>
        <h1 class="tt-title">Pocket<br />Quest</h1>
        <div class="tt-rule" aria-hidden="true"><i></i>${raw(leaf(12, "#8fd67a"))}<i></i></div>
      </div>
      <div class="tt-bottom">
        <div class="tt-when">Walk No. ${day}${archive ? " · a past walk" : ""}</div>
        <button class="tt-begin" type="button" id="begin"><span class="tt-tap">[Tap]</span> ${archive ? "to begin this walk" : "to Begin Your Daily Walk"}</button>
      </div>
    </section>`;

  // Lay the painting into the window, and wake the wood up.
  const sc = view.querySelector(".scene");
  const world = sc.querySelector(".art-world");
  let tv = { s: 1, tx: 0, ty: 0 };
  const fitTitle = () => {
    const t = view.querySelector(".tt-title");
    tv = titleView(sc.clientWidth, sc.clientHeight, { clearX: sc.clientWidth / 2 + titleTextWidth(t) / 2 + 12 });
    world.style.transform = `translate(${tv.tx}px, ${tv.ty}px) scale(${tv.s})`;
    fx.redraw?.();
  };
  const fx = startArtParticles(sc.querySelector(".art-particles"), { view: () => tv, sources: titleSources(), area: titleArea, flies: 34, petals: 8 });
  fitTitle();
  const onResize = () => requestAnimationFrame(fitTitle);
  window.addEventListener("resize", onResize);

  let started = false;
  // A tap anywhere (or the button, for keyboards) opens the round door: the light always comes from it.
  const begin = () => {
    if (started) return;
    started = true;
    sfx.light();
    const btn = view.querySelector("#begin");
    const [x, y] = centerOf(view.querySelector(".title-door"));
    drift(x, y - 20, { tier: "warm", count: 20, spread: 120 });
    burst(x, y - 10, { tier: "g", kind: "star", count: 8, speed: 160, gravity: 60, life: 0.9 });
    btn.innerHTML = `${lantern(16)}<span>The lantern catches…</span>`;
    view.querySelector(".title-screen").classList.add("going");
    btn.disabled = true;
    setTimeout(onStart, 650);
  };
  view.querySelector(".title-screen").addEventListener("click", begin);

  return () => {
    window.removeEventListener("resize", onResize);
    fx.stop();
  };
}
