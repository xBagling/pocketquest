// Home: the finished walk on the map, what it added up to, and the ledger below it (every glade
// with its full loot table, and, with the stats server, how everyone else did).
import { html, raw, esc, toast, pct, todayDay } from "../util.js";
import { replay, floorReached, counts } from "../engine.js";
import { room } from "../content.js";
import { TIERS, shownTier, RELICS, CATEGORIES, rankFor, QUIRKS, beast } from "../rules.js";
import { RULES } from "../config.js";
import { store, personalStats } from "../store.js";
import { shareText } from "../share.js";
import { fetchStats, richerThan, sampleCrowd } from "../stats.js";
import { sfx } from "../sfx.js";
import { burst } from "../fx.js";
import { sceneHtml, SCENES } from "../forest/scene.js";
import { coin, heart, lantern, leaf, dia, divider, ico } from "../forest/ui.js";
import { untilNext } from "./gate.js";
import { showSettings } from "./modals.js";

/** Practice and test walks aren't saved, so they hand their state over in memory. */
let lastPractice = null;
export function rememberPractice(day, rec) {
  lastPractice = { day, rec };
}

export function renderLedgerFor(ctx, day, mode, { fresh = false, sample = false } = {}) {
  let rec = mode === "today" || mode === "archive" ? store.run(day) : lastPractice?.day === day ? lastPractice.rec : null;
  if (!rec || !rec.done) {
    // Nothing to show (e.g. a reload after a practice walk): back to the start.
    if (mode === "test") return (location.hash = "#/admin");
    return (location.hash = mode === "archive" ? `#/day/${day}` : "#/");
  }
  const s = replay(day, rec.actions, { hard: rec.hard, rules: rec.rules || 1, floors: rec.floors, hero: rec.hero });
  return renderLedger({ ...ctx, day, mode, rec, s, fresh, sample });
}

/** The best token a glade earned, or a burnt-out lantern. */
function bestTier(rm) {
  if (rm.boss) {
    const strikes = rm.answers.filter((a) => a.idx >= 0 && a.through && counts(a));
    return strikes.length ? shownTier(strikes.sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0].tier) : "x";
  }
  const got = rm.answers.filter(counts).sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0];
  return got ? shownTier(got.tier) : "x";
}

/** The day's map with every glade marked. */
function mapHtml(s, { dim = false } = {}) {
  const id = `map-day-${s.floors}`;
  const sc = SCENES[id];
  const last = s.floors - 1;
  const stops = sc.spots.stops;
  const pos = ([x, y]) => `left:${((x / sc.w) * 100).toFixed(2)}%;top:${((y / sc.h) * 100).toFixed(2)}%`;
  const marks = [...Array(s.floors).keys()]
    .map((f) => {
      const rm = s.rooms.find((r) => r.floor === f);
      const fell = s.ending === "fell" && rm === s.rooms.at(-1);
      const who = f === last ? "dragon" : rm ? rm.look : null;
      const cls = [f === last ? "boss" : "", !rm ? "done" : "", fell ? "fell" : "", rm && bestTier(rm) === "x" && !fell ? "done" : ""].join(" ");
      const badge = rm ? `<span class="badge">${bestTier(rm) === "x" ? `<span style="opacity:.8">${lantern(14, { out: true })}</span>` : coin(bestTier(rm), 14)}</span>` : "";
      return `<div class="marker" style="${pos(stops[f + 1])}">${dia(who, cls)}${badge}</div>`;
    })
    .join("");
  return sceneHtml(id, { over: marks, label: "The finished map: every glade of today's walk, marked with what you found there.", cls: dim ? "dim" : "" });
}

function renderLedger({ view, setCleanup, day, mode, rec, s, fresh, sample }) {
  const rank = rankFor(s.gold);
  const me = personalStats();
  const isToday = mode === "today" && day === todayDay();
  const streak = mode === "today" ? me.current : 0;
  const text = shareText(s, { mode, streak });
  const vault = s.ending === "vault";
  const hoard = vault ? RULES.VAULT_BONUS : 0;
  const heartsGold = vault ? s.hearts * RULES.HEART_BONUS : 0;
  const answers = s.gold - hoard - heartsGold;
  const label = mode === "replay" ? "practice" : mode === "archive" ? "a past walk" : mode === "test" ? "test walk" : "complete";
  const endingWord = vault ? "The hoard is yours" : s.ending === "escaped" ? "Home at nightfall" : `Lost in glade ${floorReached(s)}`;

  view.innerHTML = html`<section class="home">
    <div class="home-hero">
      ${raw(mapHtml(s))}
      <div class="fade"></div>
      <div class="walk-top-left"><a class="round-btn" href="#/archive" aria-label="Past walks" title="Past walks">${raw(ico("book", 20))}</a><button class="round-btn" type="button" id="settings" aria-label="Settings" title="Settings">${raw(ico("gear", 20))}</button></div>
    </div>
    <div class="box home-card">
      <div class="row"><span class="cap">Walk No. ${day} · ${label}</span>${streak > 0 ? raw(html`<span class="chip gold" style="margin-left:auto">${streak}-day streak</span>`) : ""}</div>
      <div class="ttl" style="font-size:18px;margin-top:8px">${endingWord}</div>
      <div class="breakdown" style="margin-top:8px">
        <div class="r"><span>Answers</span><span class="num">${answers}</span></div>
        ${vault ? raw(html`<div class="r"><span>The hoard</span><span class="num">${hoard}</span></div><div class="r"><span class="row" style="gap:6px">Hearts left ${raw(Array.from({ length: s.hearts }, () => heart(true, 13)).join(""))}</span><span class="num">${heartsGold}</span></div>`) : ""}
        <div class="r total"><span class="ttl" style="font-size:14px">Total</span><span class="num glowtxt" id="gold-n">${fresh ? 0 : s.gold}</span></div>
      </div>
      <div class="it beat"><b style="color:#fff;font-style:normal">${rank.name}</b> · ${rank.line}</div>
      <div class="it beat" id="beat"></div>
      ${mode === "today" ? raw(html`<div class="purse-line"><span>${raw(coin("g", 14))} +${s.gold} to your purse · <b>${store.purse}</b> saved</span><a class="link-btn" href="#/camp">Visit the camp</a></div>`) : ""}
    </div>
    <div class="home-actions">
      <button class="btn" type="button" id="share">${raw(ico("share", 18))} Share</button>
      <a class="btn ghost" href="#ledger" id="to-ledger">Ledger</a>
    </div>
    <p class="next-walk it">${isToday ? raw(html`A new walk opens in <b id="countdown">${untilNext()}</b>`) : mode === "archive" ? "Past walks don’t count toward your streak." : mode === "replay" ? "Practice walks are never saved." : ""}</p>

    <div class="section" id="ledger">
      <div class="section-head"><h2>The ledger</h2></div>
      ${raw(gladeCards(s))}
    </div>
    <div id="crowd"></div>
    ${mode === "today" || mode === "archive"
      ? raw(html`<div class="section"><div class="section-head"><h2>Your hoard</h2></div>
        <div class="me-stats">
          <div class="me-stat box"><b>${me.current}</b><span>Day streak</span></div>
          <div class="me-stat box"><b>${me.played}</b><span>Walks</span></div>
          <div class="me-stat box"><b>${me.best}</b><span>Best gold</span></div>
          <div class="me-stat box"><b>${me.vaults}</b><span>Hoards</span></div>
        </div></div>`)
      : ""}
    <div class="section">
      <div class="ledger-actions">
        ${mode !== "test" ? raw(html`<a class="btn ghost" href="#/replay/${day}">${raw(ico("refresh", 18))} Walk it again</a>`) : raw(html`<a class="btn ghost" href="#/admin/${day}">Back to admin</a>`)}
        <a class="btn ghost" href="#/archive">${raw(ico("book", 18))} Past walks</a>
      </div>
      ${mode !== "test" ? raw(`<p class="small-note center" style="margin-top:10px">Walking it again is practice: only your first walk counts.</p>`) : ""}
    </div>
  </section>`;

  view.querySelector("#settings").addEventListener("click", () => showSettings());
  view.querySelector("#to-ledger").addEventListener("click", (e) => {
    e.preventDefault();
    view.querySelector("#ledger").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  view.querySelector("#share").addEventListener("click", () => {
    sfx.tap();
    shareCard(s, text, streak);
  });

  // Count the gold up, with a little shower.
  const timers = [];
  if (fresh && s.gold > 0) {
    const el = view.querySelector("#gold-n");
    const t0 = performance.now();
    const dur = Math.min(1600, 500 + s.gold * 1.4);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(s.gold * (1 - Math.pow(1 - k, 3)));
      if (k < 1) timers.push(requestAnimationFrame(step));
      else {
        const r = el.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top, { tier: "g", count: 14, speed: 240 });
        sfx.loot(s.gold >= 450 ? "g" : "s");
      }
    };
    timers.push(requestAnimationFrame(step));
  }

  const countdown = setInterval(() => {
    const el = view.querySelector("#countdown");
    if (el) el.textContent = untilNext();
  }, 15000);

  // Crowd stats: from the server, or a sample crowd for admins.
  let alive = true;
  const showCrowd = (stats) => {
    if (!alive || !stats || !stats.total) return;
    const beat = richerThan(stats, s.gold);
    if (beat !== null && mode !== "replay" && stats.total >= 3) view.querySelector("#beat").textContent = `Better than ${beat}% of walkers today.`;
    view.querySelector("#crowd").innerHTML = crowdHtml(stats, s);
    // Per-answer "n% said this" in the loot tables.
    for (const el of view.querySelectorAll("[data-say]")) {
      const r = stats.rooms?.[el.dataset.pid];
      if (r?.entered) el.insertAdjacentHTML("beforeend", ` <span class="pct">${pct(r.answers?.[el.dataset.say] || 0, r.entered)}%</span>`);
    }
  };
  if (sample) showCrowd(sampleCrowd(day));
  else fetchStats(day).then(showCrowd);

  setCleanup(() => {
    alive = false;
    clearInterval(countdown);
    timers.forEach(cancelAnimationFrame);
  });
}

/** The share card: the tokens, the score and the text, over the dimmed map. */
function shareCard(s, text, streak) {
  const root = document.querySelector("#modal-root");
  const toks = [...Array(s.floors).keys()]
    .map((f) => {
      const rm = s.rooms.find((r) => r.floor === f);
      if (!rm) return `<span style="opacity:.3">${coin("?", 26)}</span>`;
      const t = bestTier(rm);
      return t === "x" ? lantern(26, { out: true }) : coin(t, 26);
    })
    .join("");
  const hearts = Array.from({ length: Math.max(RULES.HEARTS, s.hearts) }, (_, i) => heart(i < s.hearts, 14)).join("");
  const line = [s.ending === "vault" ? "Hoard taken" : s.ending === "escaped" ? "Slipped home at nightfall" : `Lost in glade ${floorReached(s)}`, streak > 1 ? `${streak}-day streak` : ""].filter(Boolean).join(" · ");
  root.innerHTML = html`<div class="share-back" role="dialog" aria-modal="true" aria-label="Share your walk">
    <div class="box share-card">
      <div class="cap">Pocket Quest</div>
      <div class="ttl">Walk No. ${s.day}</div>
      <div style="margin-top:10px">${raw(divider(40))}</div>
      <div class="toks">${raw(toks)}</div>
      <div class="score"><span class="num">${s.gold}</span><span class="it">gold</span><span style="margin:0 6px;color:#6a7a74">·</span>${raw(hearts)}</div>
      <div class="it" style="font-size:14px;margin-top:10px">${line}</div>
      <pre class="share-text">${text}</pre>
    </div>
    <button class="btn" type="button" id="copy">Copy result</button>
    <div class="hint-row" id="copied" aria-live="polite"></div>
    <button class="link-btn" type="button" id="close-share" style="width:auto;align-self:center">Close</button>
  </div>`;
  const back = root.firstElementChild;
  const close = () => (root.innerHTML = "");
  back.addEventListener("click", (e) => e.target === back && close());
  back.querySelector("#close-share").addEventListener("click", close);
  const copied = () => (back.querySelector("#copied").innerHTML = `${leaf(13, "#8fffd0")} Copied. See you tomorrow.`);
  back.querySelector("#copy").addEventListener("click", async () => {
    sfx.tap();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return copied();
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      copied();
    } catch {
      toast("Couldn't copy. Select the text above instead.");
    }
  });
  back.querySelector("#copy").focus({ preventScroll: true });
}

function gladeCards(s) {
  const cards = s.rooms.map((rm) => gladeCard(s, rm));
  // Glades never reached, as quiet cards.
  const reached = s.rooms.length ? s.rooms.at(-1).floor : -1;
  const last = s.floors - 1;
  for (let f = reached + 1; f < s.floors; f++) {
    cards.push(html`<article class="box glade-card quiet">
      ${raw(dia(f === last ? "dragon" : null, f === last ? "boss" : ""))}
      <div><div class="cap">Glade ${f + 1}</div><div class="gq">${f === last ? "Old Ember's hollow" : "A glade you never reached"}</div><p class="note">${f === last ? "The hoard waits for another day." : "Two paths stayed quiet."}</p></div>
    </article>`);
  }
  if (s.relic) {
    const idx = Math.min(2, s.rooms.length);
    cards.splice(idx, 0, html`<article class="box glade-card"><span class="dia" style="background:#1a3a34"><img class="pixel" src="art/r-${s.relic}.png" alt="" style="width:60%;height:auto" /></span><div><div class="cap">The Wishing Stones</div><div class="gq">${RELICS[s.relic].name}</div><p class="note">${RELICS[s.relic].text}</p></div></article>`);
  }
  return cards.join("");
}

function gladeCard(s, rm) {
  const r = room(rm.pid);
  const m = beast(rm);
  const pills = rm.answers
    .map((a) =>
      a.idx < 0
        ? html`<span class="miss">${a.text}</span>`
        : a.armored
          ? html`<span class="miss" title="Bounced off the armour">${raw(coin(shownTier(a.tier), 13))}${r.answers[a.idx].name}</span>`
          : html`<span>${raw(coin(shownTier(a.tier), 13))}${r.answers[a.idx].name} <em>+${a.gold}</em></span>`,
    )
    .join("");
  const quirkNotes = [
    rm.eaten ? `The ${m.name} ate ${rm.eaten} gold.` : "",
    rm.healed ? `The ${m.name}'s delight healed a heart.` : "",
    rm.bounced ? "One wrong answer bounced off." : "",
    rm.hinted ? `You took the ${m.name}'s hint (“${rm.hintLetter}”) for half the gold.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const note =
    rm.result === "partial"
      ? "The lantern went out before the second answer."
      : rm.result === "timeout"
        ? "The lantern went out."
        : rm.result === "escaped"
          ? "The lantern went out before the last strike."
          : rm.result === "fell"
            ? `${m.the.charAt(0).toUpperCase() + m.the.slice(1)} won this time.`
            : rm.result === "scrappy"
              ? "A scrappy win: it bit back."
              : rm.result === "slain"
                ? "Old Ember rolled off the hoard."
                : m.win;
  const yours = new Set(rm.answers.filter((a) => a.idx >= 0).map((a) => r.answers[a.idx].name));
  return html`<article class="box glade-card">
    ${raw(dia(rm.look, rm.boss ? "boss" : ""))}
    <div>
      <div class="cap">Glade ${rm.floor + 1} · ${m.name}${rm.letter ? ` · “${rm.letter}”` : ` · ${QUIRKS[rm.quirk]?.name || ""}`}${rm.elite ? " · ×2" : ""}</div>
      <div class="gq">${r.q}</div>
      <div class="said">${raw(pills || `<span class="miss">nothing said</span>`)}</div>
      <p class="note">${note}${rm.blocked ? " Your Iron Helm took a hit." : ""}${quirkNotes ? ` ${quirkNotes}` : ""}</p>
      <details class="loot"><summary>The loot table · ${r.answers.length} answers</summary>${raw(lootTable(r, yours))}</details>
    </div>
  </article>`;
}

function lootTable(r, yours) {
  const by = {};
  for (const a of r.answers) (by[shownTier(a.tier)] ||= []).push(a.name);
  const rows = ["j", "e", "g", "s", "c"]
    .filter((t) => by[t])
    .map((t) => {
      const names = by[t];
      const limit = t === "c" || t === "j" ? names.length : 8;
      const shown = names.slice(0, limit);
      // Your own answers always show, even deep in a long tier.
      for (const n of names.slice(limit)) if (yours.has(n)) shown.push(n);
      const more = names.length - shown.length;
      const list = shown.map((n) => html`<span class="${yours.has(n) ? "you" : ""}" data-say="${n}" data-pid="${r.id}">${n}</span>`).join(", ");
      const hidden = more > 0 ? html` <button class="link-btn more" type="button" data-more="${t}">+${more} more</button><span class="rest" hidden>, ${names.filter((n) => !shown.includes(n)).join(", ")}</span>` : "";
      return `<div class="loot-row">${coin(t, 14)}<div class="names"><b>${TIERS[t].name}</b>${list}${hidden}</div></div>`;
    })
    .join("");
  const note = r.jewel && r.jewelNote ? html`<p class="wiki-note">${r.jewel.name}: ${r.jewelNote}. (Wikipedia)</p>` : "";
  return `<div class="loot-table">${rows}${note}</div>`;
}

// "+N more" in the loot tables
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-more]");
  if (!b) return;
  b.nextElementSibling.hidden = false;
  b.remove();
});

function crowdHtml(stats, s) {
  const head = html`<div class="section"><div class="section-head"><h2>Everyone's walk</h2></div>`;
  if (stats.total < 3 && !stats.sample)
    return head + html`<div class="box crowd"><p class="big-stat">You're one of the first walkers today.</p><p class="small-note">Come back later to see how everyone else did: who took the hoard, which paths they chose, and how many said what you said.</p></div></div>`;
  const maxBucket = Math.max(1, ...stats.gold);
  const mine = Math.min(Math.floor(s.gold / 25), stats.gold.length - 1);
  const lastUsed = Math.max(mine, stats.gold.findLastIndex ? stats.gold.findLastIndex((n) => n > 0) : stats.gold.length - 1);
  const bars = stats.gold
    .slice(0, lastUsed + 2)
    .map((n, i) => `<span class="${i === mine ? "me" : ""}" style="height:${Math.max(2, Math.round((n / maxBucket) * 100))}%" title="${i * 25}–${i * 25 + 24} gold: ${n}"></span>`)
    .join("");
  const f = stats.floors || [];
  const funnel = [...Array(s.floors).keys()].map((i) => html`<div class="funnel-row"><span>Glade ${i + 1}</span><span class="bar"><i style="width:${pct(f[i] || 0, stats.total)}%"></i></span><span class="n">${pct(f[i] || 0, stats.total)}%</span></div>`).join("");
  const vault = html`<div class="funnel-row vault"><span>The hoard</span><span class="bar"><i style="width:${pct(stats.endings?.vault || 0, stats.total)}%"></i></span><span class="n">${pct(stats.endings?.vault || 0, stats.total)}%</span></div>`;
  const d = s.dungeon;
  const paths = [...Array(Math.max(0, s.floors - 2)).keys()].map((i) => i + 1)
    .map((fl) => {
      const n = stats.doors?.[fl];
      if (!n) return "";
      const total = n.reduce((a, b) => a + b, 0) || 1;
      return `Glade ${fl + 1}: ` + d.floors[fl].doors.map((door, i) => `${beast(door).name} (${CATEGORIES[room(door.pid).cat].name}) ${pct(n[i] || 0, total)}%`).join(" · ");
    })
    .filter(Boolean);
  return (
    head +
    html`<div class="box crowd">
      ${stats.sample ? raw(`<p class="sample-note">Sample crowd (admin preview)</p>`) : ""}
      <p class="big-stat"><b>${stats.total.toLocaleString()}</b> walkers today</p>
      <div><div class="histo">${raw(bars)}</div><div class="histo-axis"><span>0 gold</span><span>${(lastUsed + 1) * 25}+</span></div></div>
      <div class="funnel">${raw(funnel)}${raw(vault)}</div>
      ${paths.length ? raw(html`<p class="small-note" style="margin-top:14px"><b style="font-style:normal;color:#fff">Paths taken</b><br />${raw(paths.map((x) => esc(x)).join("<br />"))}</p>`) : ""}
    </div></div>`
  );
}
