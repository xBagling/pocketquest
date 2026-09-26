// Past walks, and your hoard: every walk so far as a little trail of what you found in each glade,
// grouped by week. Past walks don't count toward streaks.
import { html, raw, todayDay, dateFromDay, formatDay } from "../util.js";
import { store, personalStats } from "../store.js";
import { replay, floorReached, counts } from "../engine.js";
import { TIERS, shownTier } from "../rules.js";
import { RULES } from "../config.js";
import { coin, lantern, ico, divider } from "../forest/ui.js";

let filter = "all";

export function renderArchive({ view }) {
  const today = todayDay();
  const days = Array.from({ length: today }, (_, i) => today - i);
  const info = days.map((d) => describe(d, today));
  const me = personalStats();

  // Group by week, Monday first.
  const weeks = [];
  for (const x of info) {
    const date = dateFromDay(x.day);
    const monday = x.day - ((date.getDay() + 6) % 7);
    let w = weeks.find((w) => w.monday === monday);
    if (!w) weeks.push((w = { monday, items: [] }));
    w.items.push(x);
  }
  const thisMonday = today - ((dateFromDay(today).getDay() + 6) % 7);
  const weekName = (w) => (w.monday === thisMonday ? "This week" : w.monday === thisMonday - 7 ? "Last week" : `${formatDay(Math.max(1, w.monday), { month: "short", day: "numeric" })} – ${formatDay(w.monday + 6, { month: "short", day: "numeric" })}`);

  const paint = () => {
    const shown = (x) => filter === "all" || (filter === "open" && !x.rec?.done) || (filter === "hoard" && x.rec?.ending === "vault");
    view.querySelector("#weeks").innerHTML =
      weeks
        .map((w) => {
          const items = w.items.filter(shown);
          if (!items.length) return "";
          const found = w.items.filter((x) => x.rec?.done).length;
          return html`<section class="week"><div class="week-head">${weekName(w)}<span>${found} of ${w.items.length} walked</span></div>
          <div class="days">${raw(items.map(card).join(""))}</div></section>`;
        })
        .join("") || `<p class="muted center">Nothing here yet.</p>`;
  };

  view.innerHTML = html`<section class="page archive">
    <header class="page-head">
      <div class="cap">The ledger</div>
      <h1>Past walks</h1>
      ${raw(divider(40))}
      <p>You've walked <b>${info.filter((x) => x.rec?.done).length}</b> of ${days.length} days${me.vaults ? raw(html` and taken Old Ember's hoard <b>${me.vaults}</b> ${me.vaults === 1 ? "time" : "times"}`) : ""}.</p>
    </header>
    <div class="me-stats">
      <div class="me-stat box"><b>${me.current}</b><span>Day streak</span></div>
      <div class="me-stat box"><b>${me.max}</b><span>Longest</span></div>
      <div class="me-stat box"><b>${me.best}</b><span>Best gold</span></div>
      <div class="me-stat box"><b>${me.vaults}</b><span>Hoards</span></div>
    </div>
    <p class="small-note center">${me.played ? `${me.total} gold found in all, ${me.average} a walk. ` : ""}Only walks taken on their own day count here.</p>
    <div class="page-head" style="padding-top:4px">
      <button class="btn small" type="button" id="surprise">${raw(ico("dice", 18))} Surprise me with a walk I've missed</button>
      <div class="filters" role="group" aria-label="Show">
        <button type="button" data-f="all">All</button><button type="button" data-f="open">Not walked</button><button type="button" data-f="hoard">Hoards</button>
      </div>
    </div>
    <div id="weeks"></div>
  </section>`;

  const setFilter = (f) => {
    filter = f;
    for (const b of view.querySelectorAll("[data-f]")) b.setAttribute("aria-pressed", String(b.dataset.f === f));
    paint();
  };
  for (const b of view.querySelectorAll("[data-f]")) b.addEventListener("click", () => setFilter(b.dataset.f));
  setFilter(filter);

  const surprise = view.querySelector("#surprise");
  const open = info.filter((x) => !x.rec?.done && x.day !== today);
  if (!open.length) surprise.hidden = true;
  surprise.addEventListener("click", () => {
    const pick = open[Math.floor(Math.random() * open.length)];
    location.hash = `#/day/${pick.day}`;
  });
}

/** What happened on a day, as a trail of stones (one per glade): a token where you found something, a lantern where it went out. */
function describe(day, today) {
  const rec = store.run(day);
  const stones = Array(rec?.floors || (rec ? 5 : RULES.FLOORS)).fill(null);
  let sub = day === today ? "Today" : "Not walked yet";
  if (rec?.actions?.length) {
    const s = replay(day, rec.actions, { hard: rec.hard, rules: rec.rules || 1, floors: rec.floors, hero: rec.hero });
    for (const rm of s.rooms) {
      const got = rm.answers.filter((a) => counts(a) && (!rm.boss || a.through)).sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0];
      if (rm.boss && s.phase === "room") continue;
      if (s.phase === "room" && rm === s.rooms.at(-1)) continue;
      stones[rm.floor] = got ? shownTier(got.tier) : "x";
    }
    if (rec.done) sub = `${rec.gold} gold · ${rec.ending === "vault" ? "the hoard!" : rec.ending === "escaped" ? "home at nightfall" : `lost in glade ${floorReached(s)}`}`;
    else sub = "Still walking";
  }
  return { day, rec, stones, sub, today: day === today };
}

function card(x) {
  const href = x.today ? "#/" : `#/day/${x.day}`;
  const cls = ["box", "walk-card", x.rec?.ending === "vault" ? "hoard" : "", x.today ? "today" : ""].join(" ");
  const trail = x.stones.map((t) => (t === "x" ? lantern(13, { out: true }) : t ? coin(t, 13) : `<span class="stone"></span>`)).join("");
  return html`<a class="${cls}" href="${href}" aria-label="Walk ${x.day}, ${formatDay(x.day)}: ${x.sub}"><span class="trail">${raw(trail)}</span><div class="no">No. ${x.day}</div><div class="sub">${formatDay(x.day, { weekday: "short", month: "short", day: "numeric" })}<br />${x.sub}</div></a>`;
}
