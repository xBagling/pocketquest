// The camp: your purse, and the characters you can walk as. Gold from walks taken on their own day
// goes into the purse; spend it on a new character with an ability of their own.
import { html, raw, toast } from "../util.js";
import { HEROES } from "../rules.js";
import { store, personalStats } from "../store.js";
import { sfx } from "../sfx.js";
import { burst, centerOf } from "../fx.js";
import { heroPortrait, HERO_ART } from "../forest/scene.js";
import { coin, divider } from "../forest/ui.js";
import { openModal } from "./modals.js";

export function renderCamp({ view }) {
  campInto(view, { page: true });
}

/** The camp as a sheet over whatever you're doing (from your portrait, or the title). */
export function showCamp({ walking = null, onClose } = {}) {
  openModal(`<div id="camp-sheet"></div>`, { label: "The camp", onClose, cls: "camp-sheet" });
  campInto(document.querySelector("#camp-sheet"), { walking });
}

/** Paint the camp into an element. walking: the character on today's walk, if one is underway. */
function campInto(view, { page = false, walking = null } = {}) {
  const paint = () => {
    const purse = store.purse;
    const now = store.hero;
    const cards = Object.entries(HEROES)
      .map(([id, h]) => {
        const owned = store.owns(id);
        const walking = id === now;
        const short = h.cost - purse;
        const action = walking
          ? html`<span class="chip gold">Walking as</span>`
          : owned
            ? html`<button class="btn small ghost" type="button" data-pick="${id}">Walk as</button>`
            : html`<button class="btn small" type="button" data-buy="${id}" ${short > 0 ? "disabled" : ""}>${raw(coin("g", 14))} ${h.cost}</button>${short > 0 ? raw(html`<div class="it need">${short} more to go</div>`) : ""}`;
        return html`<article class="box hero-card${walking ? " on" : ""}">
          <div class="hero-art"><img class="pixel" src="${HERO_ART[id].img}" alt="" /></div>
          <div class="hero-text">
            <div class="ttl">${h.name}</div>
            <div class="it">${h.ability}</div>
            <div class="hero-act">${raw(action)}</div>
          </div>
        </article>`;
      })
      .join("");
    const me = personalStats();
    view.innerHTML = html`<section class="${page ? "page " : ""}camp">
      <header class="page-head">
        <div class="cap">The camp</div>
        <h1>Your purse</h1>
        ${raw(divider(40))}
        <div class="purse">${raw(coin("g", 28))}<span class="num">${purse}</span><span class="it">gold</span></div>
        <p>Gold from each day's first walk goes into your purse${me.played ? ` (${me.total} found so far)` : ""}. Spend it on someone new to walk as, each with a knack of their own.</p>
      </header>
      <div class="hero-list">${raw(cards)}</div>
      <p class="small-note center" style="margin-top:14px">${walking ? `You're walking today as ${HEROES[walking].name}; a new choice joins you from your next walk.` : "Your character joins you from your next walk."} Practice walks and past days don't fill the purse.</p>
      ${page ? raw(`<div class="ledger-actions"><a class="btn ghost" href="#/">Back to the round door</a></div>`) : raw(`<button class="btn" type="button" data-close>Done</button>`)}
    </section>`;
    for (const b of view.querySelectorAll("[data-pick]"))
      b.addEventListener("click", () => {
        store.hero = b.dataset.pick;
        sfx.tap();
        toast(`You'll walk as ${HEROES[b.dataset.pick].name}.`);
        paint();
      });
    for (const b of view.querySelectorAll("[data-buy]"))
      b.addEventListener("click", () => {
        const id = b.dataset.buy;
        const [x, y] = centerOf(b);
        if (!store.buy(id, HEROES[id].cost)) return toast("Not quite enough gold yet.");
        sfx.relic();
        burst(x, y, { tier: "g", count: 18, speed: 240 });
        toast(`${HEROES[id].name} joins you! You'll walk together from your next walk.`);
        paint();
      });
  };
  paint();
}

/** The little purse line used on the title and at home. */
export const purseChip = () => `<a class="chip gold purse-chip" href="#/camp" title="Your purse: spend it at the camp">${coin("g", 12)} ${store.purse}</a>`;
export { heroPortrait };
