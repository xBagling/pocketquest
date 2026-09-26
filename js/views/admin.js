// Admin ("the keeper's desk"): look at any day, test-play it, preview every scene and effect,
// inspect loot tables, try the matcher, balance the dungeon. A convenience gate, not security:
// everything here is in the page anyway.
import { html, raw, esc, todayDay, formatDay, sha256Hex, toast, seededRandom } from "../util.js";
import { sceneHtml, actorHtml, emberHtml, relicHtml, portalHtml, happyActor, calmActor, SCENES, PORTALS } from "../forest/scene.js";
import { coin, lantern, ico } from "../forest/ui.js";
import { RELIC_COLOR } from "./delve.js";
import { CONFIG } from "../config.js";
import { dungeonForDay, scheduleLength } from "../dungeon.js";
import { room, promptIds, lookup, suggest, recognise } from "../content.js";
import { TIERS, TIER_ORDER, shownTier, RELICS, ARMOR, CATEGORIES, QUIRKS, CREATURES, beast } from "../rules.js";
import { store } from "../store.js";
import { botRun, simulate, report } from "../bots.js";
import { rememberPractice } from "./ledger.js";
import { sfx } from "../sfx.js";
import { burst, rain, drift } from "../fx.js";

const KEY = "pocketquest:admin";
export const admin = {
  get unlocked() {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },
  async unlock(pass) {
    const ok = (await sha256Hex(pass)) === CONFIG.ADMIN_PASSCODE_SHA256;
    if (ok)
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
    return ok;
  },
};

export function renderAdmin({ view, day, setCleanup }) {
  if (!admin.unlocked) return renderLock(view, day);
  const today = todayDay();
  let pick = Number.isFinite(day) && day >= 1 ? day : today;

  view.innerHTML = html`<section class="page admin">
    <h1>The keeper's desk</h1>
    <div class="admin-box box">
      <h2>Pick a day</h2>
      <div class="admin-row">
        <input type="number" id="day" min="1" max="${scheduleLength()}" value="${pick}" style="width:110px" aria-label="Walk number" />
        <button class="btn small" type="button" id="show">Show</button>
        <button class="btn small" type="button" id="test">${raw(lantern(16))} Test walk</button>
        <button class="btn small ghost" type="button" id="preview">Home with a sample crowd</button>
        <button class="btn small ghost" type="button" id="reset-day">Reset my walk for this day</button>
      </div>
      <div id="dungeon"></div>
    </div>

    <div class="admin-box box">
      <h2>Scene preview</h2>
      <p class="muted">Every place in the wood, with its cast. Tap a creature to win it over (and again to reset it). The forks show every kind of path. The buttons fire the effects and sounds.</p>
      <div class="gallery big" id="gallery">${raw(previewScenes())}</div>
      <div class="admin-row">${raw(TIER_ORDER.map((t) => `<button class="btn small ghost" type="button" data-loot="${t}">${coin(t, 16)} ${esc(TIERS[t].name)}</button>`).join(""))}</div>
      <div class="admin-row">
        <button class="btn small" type="button" data-fx="vault">Hoard (flawless)</button>
        <button class="btn small" type="button" data-fx="vault2">Hoard</button>
        <button class="btn small ghost" type="button" data-fx="bloom">Bloom</button>
        <button class="btn small ghost" type="button" data-fx="escaped">Home at nightfall</button>
        <button class="btn small ghost" type="button" data-fx="fell">Out of hearts</button>
        <button class="btn small ghost" type="button" data-fx="hit">Hit</button>
        <button class="btn small ghost" type="button" data-fx="miss">Miss</button>
        <button class="btn small ghost" type="button" data-fx="rustle">Rustle</button>
        <button class="btn small ghost" type="button" data-fx="roar">Roar</button>
        <button class="btn small ghost" type="button" data-fx="relic">Charm</button>
        <button class="btn small ghost" type="button" data-fx="spirit">Moss spirit</button>
      </div>
    </div>

    <div class="admin-box box">
      <h2>Prompt lab</h2>
      <div class="admin-row">
        <select id="prompt" aria-label="Prompt">${raw(
          Object.keys(CATEGORIES)
            .map((c) => `<optgroup label="${CATEGORIES[c].name}">${promptIds().filter((p) => room(p).cat === c).map((p) => `<option value="${p}">${esc(room(p).q)} (${room(p).answers.length})</option>`).join("")}</optgroup>`)
            .join(""),
        )}</select>
      </div>
      <div class="admin-row"><input type="text" id="try" placeholder="Try an answer (typos welcome)" style="flex:1;min-width:200px" /></div>
      <div id="try-out" class="rc-note"></div>
      <div id="prompt-out"></div>
    </div>

    <div class="admin-box box">
      <h2>Balance</h2>
      <p class="muted">Bots with casual, keen and expert knowledge walk real days with the real rules. Targets: about 5–10% take the hoard; the median lands on Wayfinder.</p>
      <div class="admin-row"><button class="btn small" type="button" id="sim">Run 30 days × 200 bots</button></div>
      <pre id="sim-out" class="share-preview" hidden></pre>
    </div>

    <div class="admin-box box">
      <h2>Schedule</h2>
      <div class="scroll" id="schedule"></div>
    </div>

    <div class="admin-box box">
      <h2>This browser's data</h2>
      <div class="admin-row">
        <button class="btn small ghost" type="button" id="export">Show saved data</button>
        <button class="btn small ghost" type="button" id="wipe">Wipe all local runs</button>
      </div>
      <pre id="export-out" class="share-preview" hidden style="max-height:300px;overflow:auto"></pre>
    </div>
  </section>`;

  const $ = (s) => view.querySelector(s);
  const readDay = () => Math.max(1, Math.min(scheduleLength(), Number($("#day").value) || today));

  function showDay() {
    pick = readDay();
    const d = dungeonForDay(pick);
    $("#dungeon").innerHTML = html`<p class="rc-note"><b>Walk No. ${pick}</b> · ${formatDay(pick, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${pick > today ? " · future" : pick === today ? " · today" : ""}</p>
      <table><thead><tr><th>Glade</th><th>Path</th><th>Question</th><th>Creature · armour</th></tr></thead><tbody>${raw(
        d.floors
          .map((f, fi) =>
            f.doors
              .map((door, di) => {
                const r = room(door.pid);
                return html`<tr><td>${fi + 1}</td><td>${di + 1}${door.elite ? " ×2" : ""}</td><td><b>${r.q}</b><br /><span class="muted">${CATEGORIES[r.cat].name} · ${r.answers.length} answers · jewel: ${r.jewel?.name || "—"}</span></td><td>${beast(door).name} · ${QUIRKS[door.quirk].name}${door.letter ? ` “${door.letter}”` : ""} · ${ARMOR[door.armor].short}</td></tr>`;
              })
              .join(""),
          )
          .join(""),
      )}</tbody></table>
      <p class="rc-note"><b>Relics:</b> ${d.relics.map((id) => RELICS[id].name).join(", ")}</p>`;
  }
  $("#show").addEventListener("click", showDay);
  $("#day").addEventListener("change", showDay);
  $("#test").addEventListener("click", () => (location.hash = `#/admin/play/${readDay()}`));
  $("#preview").addEventListener("click", () => {
    const d = readDay();
    // A keen bot plays the day, so the ledger has something to show.
    const s = botRun(d, "keen", seededRandom(Date.now() & 0xffff));
    rememberPractice(d, { day: d, done: true, hard: false, actions: rebuildActions(d, s), gold: s.gold, ending: s.ending });
    location.hash = `#/admin/ledger/${d}`;
  });
  let armed = false;
  $("#reset-day").addEventListener("click", (e) => {
    if (!armed) {
      armed = true;
      e.currentTarget.textContent = "Tap again to reset";
      return;
    }
    store.deleteRun(readDay());
    armed = false;
    e.currentTarget.textContent = "Reset my run for this day";
    toast(`Your walk for No. ${readDay()} is gone.`);
  });
  showDay();

  // Scene preview
  for (const el of view.querySelectorAll("#gallery .actor")) {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      if (el.classList.contains("happy")) calmActor(el);
      else {
        happyActor(el, { aside: false });
        sfx.happy();
      }
    });
  }
  for (const b of view.querySelectorAll("[data-loot]")) {
    b.addEventListener("click", () => {
      const t = b.dataset.loot;
      sfx.loot(t);
      const r = b.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, { tier: t, count: { c: 6, f: 5, s: 10, g: 16, e: 24, j: 40 }[t] });
    });
  }
  for (const b of view.querySelectorAll("[data-fx]")) {
    b.addEventListener("click", () => {
      const fx = b.dataset.fx;
      if (fx === "vault") (sfx.vault(1), rain({ tier: "g", count: 150 }), setTimeout(() => rain({ tier: "bloom", kind: "petal", count: 70 }), 700));
      if (fx === "vault2") (sfx.vault(0.6), rain({ tier: "g", count: 90 }));
      if (fx === "escaped") (sfx.phew(), burst(innerWidth / 2, innerHeight / 2, { tier: "g", count: 14, speed: 200 }));
      if (fx === "fell") (sfx.fell(), drift(innerWidth / 2, innerHeight / 2, { tier: "night", count: 16 }));
      if (fx === "hit") sfx.hit();
      if (fx === "miss") sfx.miss();
      if (fx === "rustle") sfx.rustle();
      if (fx === "spirit") sfx.spirit();
      if (fx === "bloom") (sfx.bloom(), burst(innerWidth / 2, innerHeight / 2, { tier: "bloom", kind: "petal", count: 40, speed: 300, gravity: 140, life: 1.7 }));
      if (fx === "roar") sfx.roar();
      if (fx === "relic") (sfx.relic(), drift(innerWidth / 2, innerHeight / 2, { tier: "night", count: 18 }));
      if (fx === "fell" || fx === "hit") navigator.vibrate?.(60);
    });
  }

  // Prompt lab
  const showPrompt = () => {
    const r = room($("#prompt").value);
    const by = {};
    for (const a of r.answers) (by[shownTier(a.tier)] ||= []).push(a);
    $("#prompt-out").innerHTML = html`<p class="rc-note"><b>${r.q}</b> · list “${r.listKey}” · difficulty ${r.diff} · ${r.answers.length} answers${r.miss ? ` · a miss is “${r.miss}”` : ""}<br />Sealed by the dragon: ${r.sealed.join(", ")}${r.jewelNote ? raw(html`<br />Jewel note: ${r.jewelNote}`) : ""}</p>
      <div class="loot-table">${raw(
        ["c", "s", "g", "e", "j"]
          .filter((t) => by[t])
          .map((t) => `<div class="loot-row">${coin(t, 14)}<div class="names"><b>${esc(TIERS[t].name)} (${by[t].length})</b>${by[t].map((a) => esc(a.name) + (a.aliases.length ? ` <span class="pct">(${esc(a.aliases.join(", "))})</span>` : "")).join(", ")}</div></div>`)
          .join(""),
      )}</div>`;
    tryIt();
  };
  const tryIt = () => {
    const r = room($("#prompt").value);
    const text = $("#try").value;
    if (!text.trim()) return ($("#try-out").innerHTML = "");
    const i = lookup(r, text);
    if (i >= 0) return ($("#try-out").innerHTML = html`Exact match: <b>${r.answers[i].name}</b> (${TIERS[r.answers[i].tier].name})`);
    const sg = suggest(r, text);
    const known = recognise(text);
    $("#try-out").innerHTML = html`No exact match. ${sg.length ? `Typo help: ${sg.map((x) => `${x.name} (${x.d})`).join(", ")}.` : "No typo help."} ${known ? `Known elsewhere as a ${known.noun}: ${known.name}.` : "Unknown to every list."}`;
  };
  $("#prompt").addEventListener("change", showPrompt);
  $("#try").addEventListener("input", tryIt);
  showPrompt();

  // Balance
  $("#sim").addEventListener("click", (e) => {
    e.currentTarget.disabled = true;
    setTimeout(() => {
      const out = simulate(Array.from({ length: 30 }, (_, i) => pick + i), 200);
      $("#sim-out").hidden = false;
      $("#sim-out").textContent = report(out);
      e.currentTarget.disabled = false;
    }, 30);
  });

  // Schedule (60 days around the picked day)
  const from = Math.max(1, today - 7);
  $("#schedule").innerHTML = html`<table><thead><tr><th>#</th><th>Date</th><th>Glade 1</th><th>Old Ember</th></tr></thead><tbody>${raw(
    Array.from({ length: 60 }, (_, i) => from + i)
      .filter((d) => d <= scheduleLength())
      .map((d) => {
        const dd = dungeonForDay(d);
        return html`<tr${d === today ? raw(' style="background:rgba(255,207,77,.15)"') : ""}><td><a href="#/admin/${d}">${d}</a></td><td>${formatDay(d)}</td><td>${room(dd.floors[0].doors[0].pid).q}</td><td>${room(dd.floors.at(-1).doors[0].pid).q}</td></tr>`;
      })
      .join(""),
  )}</tbody></table>`;

  // Local data
  $("#export").addEventListener("click", () => {
    $("#export-out").hidden = false;
    $("#export-out").textContent = store.exportJson();
  });
  let wipeArmed = false;
  $("#wipe").addEventListener("click", (e) => {
    if (!wipeArmed) {
      wipeArmed = true;
      e.currentTarget.textContent = "Tap again: wipe everything";
      return;
    }
    store.reset();
    toast("All local runs wiped.");
    location.hash = "#/";
  });
  setCleanup?.(null);
}

/** Bots play with the engine directly; this turns their finished state back into actions. */
function rebuildActions(day, s) {
  const actions = [];
  for (const rm of s.rooms) {
    if (rm.floor === 2 && s.relic) actions.push({ t: "relic", i: s.dungeon.relics.indexOf(s.relic) });
    actions.push({ t: "door", i: rm.door });
    for (const a of rm.answers) actions.push({ t: "answer", text: a.idx < 0 ? a.text : room(rm.pid).answers[a.idx].name });
    if (rm.result === "timeout" || rm.result === "escaped" || rm.result === "partial") actions.push({ t: "timeout" });
  }
  return actions;
}

function renderLock(view, day) {
  view.innerHTML = html`<section class="page admin">
    <div class="admin-box box" style="text-align:center">
      <div style="margin:0 auto 8px">${raw(lantern(32))}</div>
      <h2>The keeper's desk</h2>
      <p class="muted">A moss spirit guards this drawer. Passcode, please.</p>
      <form class="admin-row" style="justify-content:center" id="lock"><input type="password" id="pass" autocomplete="current-password" aria-label="Passcode" /><button class="btn small" type="submit">Open</button></form>
    </div>
  </section>`;
  view.querySelector("#lock").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await admin.unlock(view.querySelector("#pass").value)) renderAdmin({ view, day });
    else toast("The moss spirit shakes its sprout. Wrong passcode.");
  });
  view.querySelector("#pass").focus();
}

/** Every scene, with a cast standing in it, for the preview. */
function previewScenes() {
  const cast = Object.keys(CREATURES);
  let k = 0;
  return Object.keys(SCENES)
    .map((id) => {
      const sc = SCENES[id];
      let inner = "";
      if (id === "hollow") inner = emberHtml();
      else if (sc.spots.monster) inner = actorHtml(id, cast[k++ % cast.length], sc.spots.monster);
      else if (sc.spots.left) {
        const kinds = Object.keys(PORTALS);
        const f = ["fork-noon", "fork-gold", "fork-dusk"].indexOf(id);
        inner = portalHtml(id, kinds[f * 2], "left", id === "fork-dusk" ? "dusk" : "day") + portalHtml(id, kinds[f * 2 + 1], "right", id === "fork-dusk" ? "dusk" : "day") + actorHtml(id, cast[k++ % cast.length], sc.spots.left, { far: true }) + actorHtml(id, cast[k++ % cast.length], sc.spots.right, { far: true });
      }
      else if (id === "nook") inner = ["clover", "tooth", "draught"].map((r, i) => relicHtml(id, r, sc.spots[`relic${i}`], i, RELIC_COLOR[r])).join("");
      return `<div class="cell">${sceneHtml(id, { inner })}<div>${esc(id)}</div></div>`;
    })
    .join("");
}
