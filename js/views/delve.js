// The walk: the map → a fork → a glade → the Wishing Stones → … → Old Ember → home.
// The engine decides what happens; this file only shows it. Every creature asks its question out
// loud, watches you type, reacts to what you say, and plays by its own quirk.
import { html, raw, esc, toast, reducedMotion, pct } from "../util.js";
import { apply, replay, currentRoom, candleSeconds, floorReached, needed, counts, canPeek } from "../engine.js";
import { room, lookup, suggest, recognise, warmLexicon } from "../content.js";
import { TIERS, HEROES, shownTier, ARMOR, RELICS, CATEGORIES, QUIRKS, beast } from "../rules.js";
import { RULES } from "../config.js";
import { store, newRunRecord, personalStats } from "../store.js";
import { submitRun, fetchStats } from "../stats.js";
import { quipFor } from "../quips.js";
import { sfx } from "../sfx.js";
import { burst, rain, drift, centerOf, flyTo } from "../fx.js";
import { rememberPractice } from "./ledger.js";
import { showCamp, purseChip, heroPortrait } from "./camp.js";
import { showHelp, showSettings } from "./modals.js";
import { untilNext } from "./gate.js";
import { sceneHtml, actorHtml, emberHtml, relicHtml, youHtml, happyActor, portraitSrc, place, SCENES, SPRITES, PORTALS, HERO_ART } from "../forest/scene.js";
import { coin, heart, lantern, leaf, dia, hand, lanternMeter, ico } from "../forest/ui.js";
import { startArtParticles } from "../forest/particles.js";
import { FORK, forkSceneHtml, forkView, forkSources, badgeHtml } from "../forest/fork-scene.js";
import { MAP, paintedMapFits, mapSceneHtml, mapView, mapSources, mapArea } from "../forest/map-scene.js";

// Which place each glade is in, and the fork before it: the day goes from morning to night.
// The places a walk passes through, morning to night. The first glade is the meadow and the last is
// Old Ember's hollow; the glades between are spread over the rest, however many glades a walk has.
const MIDDLE_GLADES = ["pond", "bridge", "stones", "ring"];
function gladeScene(floor, floors) {
  if (floor === 0) return "meadow";
  if (floor === floors - 1) return "hollow";
  const m = floors - 2;
  const i = m <= MIDDLE_GLADES.length ? Math.round(((floor - 1) * (MIDDLE_GLADES.length - 1)) / Math.max(1, m - 1)) : (floor - 1) % MIDDLE_GLADES.length;
  return MIDDLE_GLADES[m === 1 ? 1 : i];
}
const TIME_OF_DAY = ["Misty morning", "Sunny noon", "Golden afternoon", "Dusk", "Night"];
export const RELIC_COLOR = { draught: "#ff9a8a", helm: "#c8d4e8", candle: "#ffe7a0", map: "#e9dcc0", rod: "#c89a6a", coin: "#ffd76a", tooth: "#fff3c4", clover: "#8fffa0" };

// What a creature blurts out when you answer. Each tier gets its own reaction.
const REACT = {
  c: ["Oh, that one! Everyone says that.", "Yes! That's right!", "A classic. Go on through!"],
  f: ["Oh, that one! Everyone says that.", "Yes! That's right!"],
  s: ["Ooh, lovely!", "Oh, nice one!", "How nice! Off you go."],
  g: ["Oh, what a find!", "Wonderful! Hardly anyone says that!", "You know your stuff!"],
  e: ["Wow! Where did you learn that?!", "Oh my! Nobody knows that one!", "Goodness, how lovely!"],
  j: ["My Crown Jewel! You found it!", "The jewel! I'm so happy!", "How did you know?! Hooray!"],
  miss: ["Never heard of it!", "Nope!", "Is that even a thing?"],
  letter: ["Wrong letter!", "That's not my letter!", "Read my cap!"],
  sealed: ["Already ate that one.", "Mm, tasted that earlier."],
  dupe: ["You said that already!", "Again? Really?"],
  armored: ["Right, but too common for me!", "Hmm, everyone says that one. Something rarer?", "Close! Try a rarer one."],
};
const WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const HIT_MOOD = { c: "hop", f: "hop", s: "hop", g: "hop", e: "hop", j: "hop" };
const RARE = (t) => t === "g" || t === "e" || t === "j";
// Short words for a tier, for when there's no crowd to count.
const TIER_SHORT = { c: "what most people say", f: "the trap everyone reaches for", s: "a good find", g: "genuinely uncommon", e: "true obscurity", j: "the glade's hidden treasure" };
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** A smooth, organic wobble for the lantern: layered sines with random phases. */
function makeNoise() {
  const ph = Array.from({ length: 4 }, () => Math.random() * 1000);
  return (t) => (Math.sin(t * 7.3 + ph[0]) * 0.5 + Math.sin(t * 13.1 + ph[1]) * 0.3 + Math.sin(t * 23.7 + ph[2]) * 0.15 + Math.sin(t * 2.1 + ph[3]) * 0.4) / 1.35;
}

export function renderDelve({ view, day, mode, onDone }) {
  const persistent = mode === "today" || mode === "archive";
  let rec = persistent ? store.run(day) : null;
  if (!rec) {
    rec = newRunRecord(day, mode === "today");
    if (persistent) store.saveRun(rec);
  }
  const s = replay(day, rec.actions, { hard: rec.hard, rules: rec.rules || 1, floors: rec.floors, hero: rec.hero });
  let alive = true;
  let busy = false;
  let tick = null;
  let lastSecond = null;
  let crowd = null;
  let focus = null; // the part of the scene that must stay visible: [top, bottom] as fractions
  const timers = new Set();

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (alive) fn();
    }, ms);
    timers.add(t);
    return t;
  };
  const save = () => persistent && store.saveRun(rec);
  // Build the wrong-answer lexicon while nothing is happening, not on the first miss.
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(() => warmLexicon(), { timeout: 4000 });
  // How many people said what (only with the stats server, and only once enough have walked).
  fetchStats(day).then((st) => {
    if (st && st.total >= 10) crowd = st;
  });
  function dispatch(action) {
    const ev = apply(s, action);
    if (!ev) return null;
    rec.actions.push(action);
    save();
    return ev;
  }

  view.innerHTML = `<div class="walk" id="walk">
    <div class="walk-scene" id="wscene"></div>
    <div class="walk-ui">
      <div class="glade-row" id="glades" aria-label="Today's glades"></div>
      <div class="stack" id="stack"></div>
      <div class="status bar" id="status"></div>
    </div>
  </div>`;
  const walk = view.querySelector("#walk");
  const wscene = view.querySelector("#wscene");
  const stack = view.querySelector("#stack");
  const status = view.querySelector("#status");

  // ---------- Scene, and keeping the important part of it in view ----------

  let lights = [];
  const last = s.floors - 1; // Old Ember's glade
  function setScene(id, { inner = "", over = "", label = "", enter = false, keep = [0.15, 0.6], you = true } = {}) {
    wscene.innerHTML = sceneHtml(id, { inner: inner + (you ? youHtml(id, s.hero) : ""), over, label }) + `<div class="fade"></div>`;
    walk.style.setProperty("--bg", `url("${new URL(SCENES[id].img, location.href).href}")`);
    lights = [...wscene.querySelectorAll(".sc-glow, .sc-dark")];
    focus = keep;
    wscene.classList.remove("enter");
    if (enter && !reducedMotion()) {
      void wscene.offsetWidth;
      wscene.classList.add("enter");
      // Off again once it's played, or a later screen-shake would restart it.
      later(() => {
        wscene.classList.remove("enter");
        requestAnimationFrame(fit);
      }, 950);
    }
    requestAnimationFrame(fit);
  }
  // The light lives on its two layers only, so a flicker doesn't restyle the whole scene.
  function setLight(prop, value) {
    for (const el of lights) el.style.setProperty(prop, value);
  }
  /**
   * Keep the part of the scene that matters (focus: top and bottom, as fractions) in view above the
   * panel: slide the scene up, and if that isn't enough, zoom out a little (a soft blurred copy of
   * the scene fills the sides).
   */
  const wide = () => document.documentElement.classList.contains("wide");
  /** Wide screens: the world covers the window; slide it so the scene sits left of the panel. */
  function fitWide(sc) {
    sc.style.height = "";
    sc.style.aspectRatio = "";
    walk.classList.remove("zoomed");
    wscene.style.setProperty("--scene-y", "0px");
    const info = SCENES[sc.dataset.scene];
    const vw = sc.offsetWidth;
    const vh = sc.offsetHeight;
    const WH = Math.max(vh, (vw * info.h) / info.w);
    const WW = (WH * info.w) / info.h;
    const u = WH / info.h;
    // Centre the middle of the scene in the free space left of the panel.
    const free = Math.max(vw * 0.4, stack.getBoundingClientRect().left - sc.getBoundingClientRect().left);
    const maxShift = (WW - vw) / 2;
    const wx = Math.max(-maxShift, Math.min(maxShift, free / 2 - vw / 2));
    // Keep the important part of the scene in view vertically.
    const top = focus[0] * WH;
    const bottom = focus[1] * WH;
    let wy = Math.min(0, vh * 0.96 - bottom);
    wy = Math.max(wy, Math.min(0, 24 - top), vh - WH);
    sc.style.setProperty("--wh", `${Math.round(WH)}px`);
    sc.style.setProperty("--wx", `${Math.round(wx)}px`);
    sc.style.setProperty("--wy", `${Math.round(wy)}px`);
    void u;
  }
  function fit() {
    const sc = wscene.querySelector(".scene");
    if (!sc || !focus) return;
    if (sc.dataset.scene === "map-art") return fitMap(sc);
    if (sc.classList.contains("art")) return fitArt(sc);
    if (wide()) {
      fitWide(sc);
      wscene.querySelectorAll(".path-card").forEach(keepInView);
      return;
    }
    for (const v of ["--wh", "--wx", "--wy"]) sc.style.removeProperty(v);
    const W = sc.offsetWidth;
    const info = SCENES[sc.dataset.scene];
    const H = (W * info.h) / (info.core || info.w); // the scene's height at its normal size
    const room = stack.getBoundingClientRect().top - walk.getBoundingClientRect().top - 8;
    const topRoom = 40; // the glade row
    const top = focus[0] * H;
    const bottom = focus[1] * H;
    // Zooming out makes the scene shorter and shows more of the forest at the sides (the art is
    // drawn wider than a phone shows), so nothing is ever empty.
    // Some screens (the fork, with little in the panel) may zoom in past normal to fill the room.
    const scale = Math.max(0.62, Math.min(focus[2] || 1, (room - topRoom) / Math.max(1, bottom - top)));
    let y = Math.min(0, room - bottom * scale);
    y = Math.max(y, topRoom - top * scale);
    sc.style.height = `${Math.round(H * scale)}px`;
    sc.style.aspectRatio = "auto";
    wscene.style.setProperty("--scene-y", `${Math.round(Math.min(0, y))}px`);
    walk.classList.toggle("zoomed", scale < 0.995);
    wscene.querySelectorAll(".path-card").forEach(keepInView);
  }
  const onResize = () => requestAnimationFrame(fit);
  // The walk never scrolls (older browsers without overflow: clip can still scroll it by focus).
  walk.addEventListener("scroll", () => walk.scrollTop && (walk.scrollTop = 0));
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);

  /** New panel content rises in. */
  function setStack(markup) {
    stack.innerHTML = markup;
    stack.classList.remove("panel-in");
    void stack.offsetWidth;
    stack.classList.add("panel-in");
    requestAnimationFrame(fit);
  }

  // ---------- The glade row and the status bar ----------

  function paintGlades(opts = {}) {
    const row = view.querySelector("#glades");
    if (opts.hide) {
      row.innerHTML = "";
      return;
    }
    const cur = Math.min(last, s.floor);
    const cells = [...Array(s.floors).keys()].map((f) => {
      const rm = s.rooms.find((r) => r.floor === f);
      const inRoom = s.phase === "room" && f === s.floor;
      const fell = s.ending === "fell" && rm && rm === s.rooms.at(-1);
      if (f === last) return dia("dragon", `boss${f === cur && s.phase !== "done" ? " now" : ""}`, "Old Ember");
      if (rm && !inRoom) return dia(rm.look, fell ? "fell" : "done", beast(rm).name);
      if (inRoom) return dia(rm.look, "now", beast(rm).name);
      return dia(null, f === cur && s.phase !== "done" ? "now" : "");
    });
    row.innerHTML = `<span class="cap">Glade <span class="num">${cur + 1}</span>/${s.floors}</span>${cells.join("")}`;
  }

  function paintStatus() {
    const max = Math.max(RULES.HEARTS, s.hearts);
    let hearts = "";
    for (let i = 0; i < max; i++) hearts += heart(i < s.hearts, 15);
    const spent = relicSpent();
    const secs = s.phase === "room" && rec.deadline ? Math.max(0, Math.ceil((rec.deadline - Date.now()) / 1000)) : "";
    status.innerHTML = `<button class="me-btn" type="button" aria-label="${HEROES[s.hero].name}: open the camp" title="The camp">${dia(`hero-${s.hero}`)}</button>
      <span class="hearts" aria-label="${s.hearts} ${s.hearts === 1 ? "heart" : "hearts"}${s.helm ? ", and a helm" : ""}">${hearts}${s.helm ? `<span class="helm" title="Iron Helm: blocks the next hit">+helm</span>` : ""}</span>
      ${s.relic ? `<button class="relic${spent ? " used" : ""}" type="button" aria-label="Your charm: ${esc(RELICS[s.relic].name)}"><span class="dia" style="background:${RELIC_COLOR[s.relic]}33"><span style="transform:rotate(-45deg)"><img class="pixel" src="art/r-${s.relic}.png" alt="" style="width:14px;height:auto" /></span></span></button>` : ""}
      <span class="gold" aria-label="${s.gold} gold">${coin("g", 15)}<span class="num">${shownGold}</span></span>
      <span class="meter" aria-hidden="true">${lantern(16)}<span class="meter-bar"><span class="meter-fill"></span></span><span class="secs">${secs}</span></span>`;
    status.querySelector(".me-btn").addEventListener("click", () => {
      sfx.tap();
      showCamp({ walking: s.hero });
    });
    status.querySelector(".relic")?.addEventListener("click", () => toast(`${RELICS[s.relic].name}: ${RELICS[s.relic].text}${spent ? " (used)" : ""}`));
    paintMeter();
  }
  const relicSpent = () => (s.relic === "helm" && !s.helm) || (s.relic === "coin" && !s.coin) || (s.relic === "rod" && !s.rod && s.rooms.some((r) => r.rod));
  function paintMeter(frac) {
    const fill = status.querySelector(".meter-fill");
    if (!fill) return;
    if (frac == null) frac = s.phase === "room" && rec.deadline ? Math.max(0, Math.min(1, (rec.deadline - Date.now()) / (candleSeconds(s) * 1000))) : s.phase === "done" ? 0 : 1;
    fill.style.transform = `scaleX(${frac.toFixed(3)})`;
  }

  // The gold counter rolls towards the real total instead of jumping.
  let shownGold = s.gold;
  let rollRaf = 0;
  function setGold(bump = true) {
    const goldEl = status.querySelector(".gold");
    const span = goldEl?.querySelector(".num");
    if (!span) return;
    const from = shownGold;
    const to = s.gold;
    cancelAnimationFrame(rollRaf);
    if (bump) {
      goldEl.classList.remove("bump");
      void goldEl.offsetWidth;
      goldEl.classList.add("bump");
    }
    if (from === to || reducedMotion()) {
      shownGold = to;
      span.textContent = to;
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(900, 260 + Math.abs(to - from) * 4);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      shownGold = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      span.textContent = shownGold;
      if (k < 1) rollRaf = requestAnimationFrame(step);
    };
    rollRaf = requestAnimationFrame(step);
  }

  function veil(fn, ms = 420) {
    if (reducedMotion()) return fn();
    const v = document.createElement("div");
    v.className = "veil";
    document.body.append(v);
    setTimeout(() => v.remove(), 950);
    later(fn, ms);
  }

  // ---------- The map: before glade 1, and before Old Ember ----------

  function renderMap() {
    stopLantern();
    const boss = s.floor === last;
    const id = `${boss ? "map-night" : "map-day"}-${s.floors}`;
    const sc = SCENES[id];
    const stops = sc.spots.stops;
    const here = stops[Math.min(stops.length - 1, s.floor + 1)];
    const pos = ([x, y]) => `left:${((x / sc.w) * 100).toFixed(2)}%;top:${((y / sc.h) * 100).toFixed(2)}%`;
    const markers = [...Array(s.floors).keys()]
      .map((f) => {
        const rm = s.rooms.find((r) => r.floor === f);
        const cls = f === last ? `boss${boss ? " now" : ""}` : rm ? "done" : f === s.floor ? "now" : "";
        const who = f === last ? "dragon" : rm ? rm.look : null;
        return `<div class="marker" style="${pos(stops[f + 1])}">${dia(who, cls)}${rm ? `<span class="badge">${badgeFor(rm)}</span>` : ""}</div>`;
      })
      .join("");
    const lamps = boss ? sc.spots.lamps.map((p) => `<span class="map-lamp" style="${pos(p)}"></span>`).join("") : "";
    const tag = boss
      ? `<div class="map-tag box" style="left:${(((stops[stops.length - 1][0] + 9) / sc.w) * 100).toFixed(1)}%;top:${(((stops[stops.length - 1][1] - 5) / sc.h) * 100).toFixed(1)}%"><span class="cap">Old Ember</span></div>`
      : `<div class="map-tag box" style="left:${(((here[0] + 10) / sc.w) * 100).toFixed(1)}%;top:${(((here[1] - 4) / sc.h) * 100).toFixed(1)}%"><span class="cap">You are here</span></div>`;
    // You, standing by the glade you're about to walk into.
    const hero = HERO_ART[s.hero] || HERO_ART.wanderer;
    const me = `<img class="map-me pixel" src="${hero.img}" alt="" style="left:${(((here[0] - 16) / sc.w) * 100).toFixed(2)}%;top:${(((here[1] - 12) / sc.h) * 100).toFixed(2)}%;width:${((hero.w / sc.w) * 100 * 0.7).toFixed(2)}%" />`;
    if (paintedMapFits(s.floors)) paintMap(boss);
    else setScene(id, { over: lamps + markers + tag + (boss ? "" : me), label: boss ? "The wood at night, seen from above: lanterns glow at the glades you've cleared. The great tree waits at the top." : `The wood as a miniature from above: a path from the round door through ${s.floors} clearings to a great tree.`, keep: mapFocus(stops), you: false });
    paintGlades({ hide: true });
    const first = s.dungeon.floors[0].doors[0];
    const streak = personalStats().current;
    if (boss) {
      setStack(html`<div class="box map-panel">
        <div class="cap">Glade ${s.floors} · the end of the path</div>
        <div class="ttl">Old Ember, keeper of the hoard</div>
        <div class="it">She ate the five most common answers. ${s.strikesNeeded < RULES.BOSS_STRIKES ? `With your tooth, ${s.strikesNeeded} strikes of Gold or better will do.` : `${s.strikesNeeded} strikes of Gold or better will do.`}</div>
        <button class="btn" type="button" id="go">Wake her gently</button>
      </div>`);
    } else {
      setStack(html`<div class="box map-panel">
        <div class="row"><span class="cap">The Whispering Wood</span><span class="num" style="margin-left:auto;font-size:15px;color:#fff">No. ${day}</span></div>
        <div class="ttl">${WORDS[s.floors - 2] || s.floors - 1} glades, then Old Ember</div>
        <div class="it">First, a ${beast(first).name} waits in the meadow.</div>
        <div class="chips"><span class="chip">${raw(leaf(12, "#8fffd0"))} Misty morning</span>${streak > 0 && mode === "today" ? raw(`<span class="chip gold">${streak}-day streak</span>`) : ""}${s.hard ? raw(`<span class="chip bad">Hard mode</span>`) : ""}${mode === "replay" ? raw(`<span class="chip">Practice</span>`) : mode === "test" ? raw(`<span class="chip bad">Test walk</span>`) : ""}</div>
        <button class="btn" type="button" id="go">Set off</button>
      </div>
      <div class="map-menu">
        <div class="tt-icons">
          <a class="ico" href="#/archive"><span class="c">${raw(ico("book"))}</span><span class="cap">Ledger</span></a>
          <button class="ico" type="button" id="m-camp"><span class="c"><img class="pixel hero-ico" src="${heroPortrait(store.hero)}" alt="" /></span><span class="cap">Camp</span></button>
          <button class="ico" type="button" id="m-help"><span class="c">${raw(ico("how"))}</span><span class="cap">How to play</span></button>
          <button class="ico" type="button" id="m-settings"><span class="c">${raw(ico("gear"))}</span><span class="cap">Settings</span></button>
        </div>
        <p class="map-foot">${raw(purseChip())}${mode === "today" ? raw(html` · A new walk opens in <b id="map-count">${untilNext()}</b>`) : ""}</p>
      </div>`);
      stack.querySelector("#m-camp").addEventListener("click", () => showCamp({ walking: s.hero }));
      stack.querySelector("#m-help").addEventListener("click", () => showHelp());
      stack.querySelector("#m-settings").addEventListener("click", () => showSettings());
      // First visit: explain the walk once, here on the map (not over the start screen).
      if (!store.seenHelp) later(() => !store.seenHelp && s.phase === "door" && s.floor === 0 && showHelp(), 700);
    }
    paintStatus();
    const go = stack.querySelector("#go");
    go.addEventListener("click", () => enterPath(0));
    later(() => go.focus({ preventScroll: true }), 300);
  }

  /** On the map: where you are now, and the next two glades ahead (they're further up the map). */
  function mapFocus(stops) {
    const here = stops[Math.min(stops.length - 1, s.floor + 1)];
    const ahead = stops[Math.min(stops.length - 1, s.floor + 3)];
    const h = SCENES[`map-day-${s.floors}`].h;
    return [Math.max(0, ahead[1] - 16) / h, Math.min(h, here[1] + 12) / h];
  }

  /** The little token beside a cleared glade: the best loot there, or a burnt-out lantern. */
  function badgeFor(rm) {
    const got = rm.answers.filter(counts).sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0];
    return got ? coin(shownTier(got.tier), 14) : `<span style="opacity:.8">${lantern(14, { out: true })}</span>`;
  }

  // ---------- The fork: tap the path you like the look of ----------

  let chosen = -1;
  let fx = null; // the fork's particles
  let paths = ["arch", "hollow"];
  const pathName = (i) => PORTALS[paths[i]].name;
  let artView = { s: 1, tx: 0, ty: 0 }; // where the painted fork sits on screen (see fitArt)
  function renderFork() {
    stopLantern();
    chosen = -1;
    const doors = s.dungeon.floors[s.floor].doors;
    // The painted fork: over the bridge to the tree hollow on the left, the mushroom house on the right.
    paths = ["hollow", "mushrooms"];
    wscene.innerHTML = forkSceneHtml({ doors, hero: s.hero, labels: doors.map((d, i) => esc(pathLabel(d, i))) }) + `<div class="fade"></div>`;
    walk.style.setProperty("--bg", `url("${new URL(FORK.art.img, location.href).href}")`);
    lights = [];
    focus = [0, 1];
    // Over each path: a badge with its guardian's portrait, bobbing, and under it a card with what
    // the path holds. A letter lock shows its letter on a little tag by the guardian.
    const ui = wscene.querySelector(".art-ui");
    ui.insertAdjacentHTML(
      "beforeend",
      doors
        .map(
          (d, i) =>
            badgeHtml(i, portraitSrc(d.look), (-i * 1.3).toFixed(1)) +
            `<button class="path-card box art" type="button" data-pick="${i}" aria-label="${esc(pathLabel(d, i))}" style="--d:${(-i * 2.1).toFixed(1)}s"></button>` +
            (d.quirk === "letter" ? `<span class="art-tag" data-tag="${i}">${esc(d.letter)}</span>` : ""),
        )
        .join(""),
    );
    wscene.classList.remove("enter");
    if (!reducedMotion()) {
      void wscene.offsetWidth;
      wscene.classList.add("enter");
      later(() => {
        wscene.classList.remove("enter");
        requestAnimationFrame(fit);
      }, 950);
    }
    fx?.stop();
    fx = startArtParticles(wscene.querySelector(".art-particles"), { view: () => artView, sparks: FORK.art.fx.sparks, stream: FORK.stream, sources: forkSources() });
    paintGlades();
    paintStatus();
    paintForkStack();
    requestAnimationFrame(fit);
    // Keyboard and mouse users start on the first card; on a phone nothing looks picked until you tap.
    if (matchMedia("(pointer: fine)").matches) later(() => wscene.querySelector(".path-card")?.focus({ preventScroll: true }), 350);
  }
  /** The painted map: the walk from the first clearing to the cave, with markers pinned to the clearings. */
  function paintMap(boss) {
    const done = s.rooms.map((r) => r.floor);
    wscene.innerHTML = mapSceneHtml({ done, night: boss }) + `<div class="fade"></div>`;
    walk.style.setProperty("--bg", `url("${new URL(MAP.img, location.href).href}")`);
    lights = [];
    focus = [0, 1];
    const pin = (x, y, extra = "") => `data-wx="${x}" data-wy="${y}" ${extra}`;
    const markers = [...Array(s.floors).keys()]
      .map((f) => {
        const rm = s.rooms.find((r) => r.floor === f);
        const cls = f === last ? `boss${boss ? " now" : ""}` : rm ? "done" : f === s.floor ? "now" : "";
        const who = f === last ? "dragon" : rm ? rm.look : null;
        const [x, y] = MAP.stops[f];
        return `<div class="marker art" ${pin(x, y)}>${dia(who, cls)}${rm ? `<span class="badge">${badgeFor(rm)}</span>` : ""}</div>`;
      })
      .join("");
    const [hx, hy, hw] = MAP.stops[Math.min(last, s.floor)];
    const hero = HERO_ART[s.hero] || HERO_ART.wanderer;
    const me = boss ? "" : `<img class="map-me art pixel" src="${hero.img}" alt="" ${pin(hx - hw / 2 - 20, hy + 10)} data-wh="112" />`;
    const [tx, ty] = boss ? MAP.cave : [hx + hw / 2 + 10, hy];
    const tag = `<div class="map-tag box art" ${pin(tx, ty)}><span class="cap">${boss ? "Old Ember" : "You are here"}</span></div>`;
    wscene.querySelector(".art-ui").insertAdjacentHTML("beforeend", markers + me + tag);
    wscene.classList.remove("enter");
    if (!reducedMotion()) {
      void wscene.offsetWidth;
      wscene.classList.add("enter");
      later(() => {
        wscene.classList.remove("enter");
        requestAnimationFrame(fit);
      }, 950);
    }
    fx?.stop();
    fx = startArtParticles(wscene.querySelector(".art-particles"), { view: () => artView, stream: MAP.water, sources: mapSources(), area: mapArea, flies: 22, petals: 6 });
    requestAnimationFrame(fit);
  }
  function fitMap(sc) {
    wscene.style.setProperty("--scene-y", "0px");
    walk.classList.remove("zoomed");
    const isWide = wide();
    const vw = walk.clientWidth;
    const vh = walk.clientHeight;
    sc.style.height = `${vh}px`;
    const roomH = isWide ? vh : Math.round(stack.getBoundingClientRect().top - walk.getBoundingClientRect().top);
    const free = isWide ? Math.max(vw * 0.45, stack.getBoundingClientRect().left - sc.getBoundingClientRect().left) : vw;
    artView = mapView(vw, vh, { roomH, top: 20, free });
    const { s: k, tx, ty } = artView;
    sc.querySelector(".art-world").style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    for (const el of sc.querySelectorAll("[data-wx]")) {
      el.style.left = `${Math.round(el.dataset.wx * k + tx)}px`;
      el.style.top = `${Math.round(el.dataset.wy * k + ty)}px`;
      if (el.dataset.wh) el.style.height = `${Math.round(el.dataset.wh * k)}px`;
    }
    fx?.redraw?.();
  }

  /** Lay the painted fork into its window, and pin the badges, cards and tags to their spots. */
  function fitArt(sc) {
    wscene.style.setProperty("--scene-y", "0px");
    walk.classList.remove("zoomed");
    const isWide = wide();
    const vw = walk.clientWidth;
    const room = isWide ? walk.clientHeight : Math.round(stack.getBoundingClientRect().top - walk.getBoundingClientRect().top + 30);
    sc.style.height = `${room}px`;
    const free = isWide ? Math.max(vw * 0.45, stack.getBoundingClientRect().left - sc.getBoundingClientRect().left) : vw;
    const row = view.querySelector("#glades")?.getBoundingClientRect();
    artView = forkView(vw, room, { free, top: row ? row.bottom - sc.getBoundingClientRect().top : 50, room: isWide ? 0.9 : 1 });
    const { s: k, tx, ty } = artView;
    sc.querySelector(".art-world").style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    const put = (el, [x, y]) => el && (el.style.left = `${Math.round(x * k + tx)}px`) && (el.style.top = `${Math.round(y * k + ty)}px`);
    // The medals keep the painting's size (a little larger on small screens, so they stay tappable).
    const mk = Math.max(k, 0.62);
    FORK.badges.forEach((b, i) => {
      const pin = sc.querySelector(`.path-pin[data-pick="${i}"]`);
      if (pin) Object.assign(pin.style, { width: `${Math.round(FORK.art.badge.w * mk)}px`, height: `${Math.round(FORK.art.badge.h * mk)}px` });
      put(pin, b);
      put(sc.querySelector(`.path-card[data-pick="${i}"]`), [b[0], b[1] + 30 / k]);
      put(sc.querySelector(`.art-tag[data-tag="${i}"]`), FORK.tags[i]);
    });
    sc.querySelectorAll(".path-card").forEach(keepInView);
    fx?.redraw?.();
  }

  const doorQuestion = (d) => {
    const r = room(d.pid);
    return d.quirk === "letter" ? `${r.q.replace(/\.$/, "")}, starting with “${d.letter}”.` : r.q;
  };
  const quirkLine = (d) => (d.quirk === "letter" ? `Must start with “${d.letter}”` : QUIRKS[d.quirk].short.replace(/\.$/, ""));
  function pathLabel(d, i) {
    const r = room(d.pid);
    return `${cap1(pathName(i))}: ${CATEGORIES[r.cat].name}, guarded by the ${beast(d).name}. ${quirkLine(d)}.${d.elite ? " Double gold." : ""}`;
  }
  function paintForkStack() {
    const doors = s.dungeon.floors[s.floor].doors;
    const heard = (i) => s.relic === "map" || (s.peeked && s.peeked.floor === s.floor && s.peeked.i === i);
    doors.forEach((d, i) => {
      const r = room(d.pid);
      const card = wscene.querySelector(`.path-card[data-pick="${i}"]`);
      const pin = wscene.querySelector(`.path-pin[data-pick="${i}"]`);
      if (!card) return;
      card.classList.toggle("on", chosen === i);
      card.classList.toggle("off", chosen >= 0 && chosen !== i);
      card.setAttribute("aria-pressed", String(chosen === i));
      pin?.classList.toggle("on", chosen === i);
      const needs = [d.quirk === "letter" ? `starts with ${d.letter}` : d.armor !== "none" ? ARMOR[d.armor].short : "", d.elite ? "Gold ×2" : ""].filter(Boolean).join(" · ");
      card.innerHTML = html`<span class="cap">${CATEGORIES[r.cat].name} · ${beast(d).name}</span>
        <span class="ttl">${QUIRKS[d.quirk].path}</span>
        <span class="does">${quirkLine(d)}.</span>
        ${needs ? raw(html`<span class="req">(${needs})</span>`) : ""}
        ${heard(i) ? raw(html`<span class="heard">“${doorQuestion(d)}”</span>`) : ""}`;
    });
    const canListen = canPeek(s) && s.relic !== "map";
    const action =
      chosen < 0
        ? html`<div class="hint-row">${raw(leaf(13, "#8fffd0"))} Tap a path${s.relic ? raw(html` · <span>Charm: ${RELICS[s.relic].name}</span>`) : ""}</div>`
        : html`<div class="hint-row">${canListen ? raw(html`<button class="chip" type="button" id="listen">Listen in (Fox Scout · once a walk)</button>`) : ""}</div><button class="btn" type="button" id="take">Walk ${pathName(chosen).replace(/^the /, "through the ")}</button>`;
    setStack(action);
    for (const b of wscene.querySelectorAll(".path-card, .path-pin, .art-hit")) b.onclick = () => pick(Number(b.dataset.pick));
    stack.querySelector("#take")?.addEventListener("click", () => enterPath(chosen));
    stack.querySelector("#listen")?.addEventListener("click", () => listen(chosen));
    requestAnimationFrame(() => wscene.querySelectorAll(".path-card").forEach(keepInView));
  }
  function pick(i) {
    if (busy || s.phase !== "door") return;
    if (chosen === i) return enterPath(i);
    chosen = i;
    sfx.tap();
    for (const b of wscene.querySelectorAll(".art-hit")) b.classList.toggle("on", Number(b.dataset.pick) === i);
    mood(wscene.querySelector(`[data-path="${i}"]`), "hop", 520);
    // A little burst of sparkles over the chosen guardian.
    const [x, y] = FORK.spots[i];
    fx?.burst(x, y - 60, i ? "#9ff4ff" : "#ffd890");
    paintForkStack();
    stack.querySelector("#take")?.focus({ preventScroll: true });
  }
  function listen(i) {
    if (busy) return;
    const ev = dispatch({ t: "peek", i });
    if (!ev) return;
    sfx.rustle();
    paintForkStack();
  }

  /** Step onto a path (or set off from the map): into the glade. */
  function enterPath(i) {
    if (busy || s.phase !== "door") return;
    busy = true;
    sfx.rustle();
    for (const b of stack.querySelectorAll("button")) b.disabled = true;
    wscene.querySelector(`.art-hit[data-pick="${i}"]`)?.classList.add("on");
    veil(() => {
      const ev = dispatch({ t: "door", i });
      busy = false;
      if (!ev) return renderPhase();
      rec.deadline = Date.now() + candleSeconds(s) * 1000 + RULES.DOOR_GRACE_MS;
      save();
      renderRoom(true);
    });
  }

  // ---------- A glade: the creature, its question, and your answer ----------

  const questionFor = (rm, r) => (rm.quirk === "letter" ? `${r.q.replace(/\.$/, "")}, starting with “${rm.letter}”.` : r.q);
  let actorBox = null; // the creature's box in scene grid pixels: { x, top, bottom }

  function renderRoom(entering = false) {
    const rm = currentRoom(s);
    const r = room(rm.pid);
    const m = beast(rm);
    if (!rec.deadline) {
      rec.deadline = Date.now() + candleSeconds(s) * 1000;
      save();
    }
    const id = gladeScene(rm.floor, s.floors);
    const sc = SCENES[id];
    let inner;
    if (rm.boss) {
      inner = emberHtml(false);
      const off = (sc.w - (sc.core || sc.w)) / 2;
      actorBox = { x: 62 + off, top: 70, bottom: 108 };
    } else {
      const spot = sc.spots.monster;
      const sp = SPRITES[rm.look];
      inner = actorHtml(id, rm.look, spot);
      const top = spot[1] - sp.float - sp.h * sp.room;
      actorBox = { x: spot[0], top, bottom: spot[1] - sp.float, right: spot[0] + (sp.w * sp.room) / 2 };
    }
    const plateTop = ((actorBox.top - 3) / sc.h) * 100;
    const x = ((actorBox.x / sc.w) * 100).toFixed(2);
    const badge = rm.boss
      ? `<div class="strike-pips"><span class="cap" style="font-size:9.5px">Strikes</span>${strikePips(rm)}</div>`
      : rm.quirk === "letter"
        ? `<span class="letter-badge"><b>${esc(rm.letter)}</b></span>`
        : `<span class="chip">${QUIRKS[rm.quirk].name}</span>`;
    const plate = `<div class="plate" style="left:${x}%;top:${plateTop.toFixed(2)}%">${badge}<div class="ttl">${esc(m.name)}</div></div>`;
    setScene(id, { inner, over: plate + saysHtml(), label: `${m.name} in the glade.`, enter: entering, keep: [Math.max(0, actorBox.top - 22) / sc.h, (Math.max(actorBox.bottom + 4, sc.spots.you[1] + 2)) / sc.h] });
    if (entering && rm.boss) later(() => sfx.roar(), 500);

    const armor = ARMOR[rm.armor];
    const chipRight = rm.boss
      ? `<span class="chip gold">Gold or better</span>`
      : rm.quirk === "letter"
        ? `<span class="chip">Starts with ${esc(rm.letter)}</span>`
        : rm.armor !== "none"
          ? `<span class="chip">${armor.short}</span>`
          : rm.elite
            ? `<span class="chip gold">Gold ×2</span>`
            : "";
    const catLine = `${CATEGORIES[r.cat].name}${rm.boss ? " · the hoard" : rm.elite && rm.armor !== "none" ? " · Gold ×2" : ""}${s.hard ? " · hard" : ""}`;
    setStack(html`<div class="box qbox" id="qbox">
        <div class="row"><span class="cap">${catLine}</span>${raw(chipRight)}</div>
        <div class="q" id="q" role="heading" aria-level="2">${questionFor(rm, r)}</div>
        ${rm.boss ? raw(html`<div class="sealed" aria-label="Already eaten">${raw(r.sealed.map((n) => html`<s>${n}</s>`).join(""))}</div>`) : raw(html`<div class="it quirk">“${QUIRKS[rm.quirk].say}”</div>`)}
      </div>
      <div class="toast-line" id="hint" aria-live="polite"></div>
      <div class="suggest" id="suggest"></div>
      <form class="bar answer" id="answer-form" autocomplete="off">
        ${raw(hand())}
        <input id="answer" type="text" inputmode="text" enterkeyhint="go" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" maxlength="60" placeholder="${rm.boss ? "Strike with a rare one…" : rm.quirk === "letter" ? `A “${rm.letter}” word…` : "Your answer…"}" aria-labelledby="q" />
        <span class="ans-lamp" aria-hidden="true">${raw(lantern(14))}<b class="ans-secs"></b></span>
        <span class="ans-line" aria-hidden="true"><i></i></span>
        <button class="enter cap" type="submit" aria-label="Say it">Enter</button>
      </form>
      <div class="tiers-key" id="meta">${raw(metaLine(rm, r))}</div>`);

    const form = stack.querySelector("form");
    const input = stack.querySelector("#answer");
    const actor = wscene.querySelector(".actor");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit(input.value);
    });
    let leanTimer = null;
    input.addEventListener("input", () => {
      sfx.type();
      stack.querySelector("#suggest").innerHTML = "";
      // The creature leans in and watches you type.
      actor?.classList.add("lean");
      clearTimeout(leanTimer);
      leanTimer = setTimeout(() => actor?.classList.remove("lean"), 260);
    });
    bindMeta(rm);
    // The creature speaks: the question writes itself out.
    const qEl = stack.querySelector("#q");
    if (entering && qEl && !reducedMotion()) {
      const full = qEl.textContent;
      qEl.setAttribute("aria-label", full);
      qEl.textContent = "";
      qEl.classList.add("typing");
      let n = 0;
      const typeOn = () => {
        n = Math.min(full.length, n + (full.length > 50 ? 3 : 2));
        qEl.textContent = full.slice(0, n);
        if (n < full.length) later(typeOn, 22);
        else qEl.classList.remove("typing");
      };
      later(typeOn, 560);
      later(() => say("m", m.hello, 2600), 400);
    }
    // Typing is the game, so the answer box takes focus as soon as the glade appears.
    later(() => input.focus({ preventScroll: true }), entering ? 500 : 50);
    paintGlades();
    paintStatus();
    startLantern();
  }

  const strikePips = (rm) => Array.from({ length: s.strikesNeeded }, (_, i) => `<span class="pip${i < rm.strikes ? " on" : ""}"></span>`).join("");

  /** The line under the answer bar: the tier key, or what this glade needs. */
  function metaLine(rm, r) {
    if (rm.boss) {
      const strikes = rm.answers.filter((a) => a.idx >= 0 && a.through && counts(a));
      if (!strikes.length) return html`<span>${raw(leaf(12, "#8fffd0"))} Gold, Gem or Crown Jewel answers strike</span>`;
      return `<span class="strikes">${strikes.map((a, i) => html`Strike ${["one", "two", "three"][i] || i + 1}: “${r.answers[a.idx].name}”${raw(coin(shownTier(a.tier), 13))}`).join(" · ")}</span>`;
    }
    if (rm.quirk === "collector") return html`<span>The ${beast(rm).name} wants two different answers: <b class="collect num" style="color:#fff">${rm.answers.filter(counts).length} / ${needed(rm)}</b></span>`;
    if (rm.quirk === "bargain") return html`<button class="chip" type="button" id="wisp" ${rm.hinted ? "disabled" : ""}>${raw(lantern(12))} ${rm.hinted ? `The ${beast(rm).name} whispered “${rm.hintLetter}”` : `Ask the ${beast(rm).name} for a hint · half gold`}</button>`;
    if (rm.rod && r.jewel) return html`<span>${raw(leaf(12, "#8fffd0"))} Dowsing Rod: ${r.answers.length} answers · the Crown Jewel starts with “${r.jewel.name.replace(/^the\s+/i, "")[0]}”</span>`;
    return `<span>${coin("c")} common</span><span>${coin("s")} rarer</span><span>${coin("g")} rarest</span>`;
  }
  function bindMeta(rm) {
    stack.querySelector("#wisp")?.addEventListener("click", askWisp);
    if (rm.quirk === "collector") stack.querySelector(".collect")?.setAttribute("aria-live", "polite");
  }
  function repaintMeta(rm) {
    const el = stack.querySelector("#meta");
    if (!el) return;
    el.innerHTML = metaLine(rm, room(rm.pid));
    bindMeta(rm);
  }

  function hint(text, cls = "") {
    const el = stack.querySelector("#hint");
    if (!el) return;
    el.className = `toast-line ${cls}`;
    el.innerHTML = text;
    requestAnimationFrame(fit);
  }

  // ---------- Speech and moods ----------

  function saysHtml() {
    return `<div class="say" data-say="m"></div><div class="say" data-say="left"></div><div class="say" data-say="right"></div>`;
  }
  /** The glade's creature says something for a moment. */
  function say(who, text, ms = 1600) {
    const el = wscene.querySelector(`.say[data-say="${who}"]`);
    if (!el || !text) return;
    const id = wscene.querySelector(".scene")?.dataset.scene;
    const sc = SCENES[id];
    if (who === "m" && actorBox) {
      el.style.left = `${((actorBox.x / sc.w) * 100).toFixed(2)}%`;
      el.style.top = `calc(${(((actorBox.top - 3) / sc.h) * 100).toFixed(2)}% - 46px)`;
    }
    el.textContent = text;
    el.classList.remove("show");
    keepInView(el);
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  }
  /** Nudge a speech bubble so it stays on screen and below the glade row. */
  function keepInView(el) {
    el.style.setProperty("--dx", "0px");
    el.style.setProperty("--dy", "0px");
    const r = el.getBoundingClientRect();
    const win = wscene.querySelector(".scene")?.getBoundingClientRect();
    if (!win) return;
    const pad = 10;
    // On wide screens the panel sits over the right of the forest.
    const panel = document.documentElement.classList.contains("wide") && !el.classList.contains("path-card") ? stack.getBoundingClientRect().left : innerWidth;
    let right = Math.min(win.right, innerWidth, panel) - pad;
    let leftB = Math.max(win.left, 0) + pad;
    // The fork's two cards each keep to their own half, so they never overlap.
    const midX = (leftB + right) / 2;
    if (el.classList.contains("left")) right = Math.min(right, midX - 4);
    if (el.classList.contains("right")) leftB = Math.max(leftB, midX + 4);
    const row = view.querySelector("#glades");
    const top = Math.max(win.top, 0, row && row.offsetParent ? row.getBoundingClientRect().bottom : 0) + pad;
    const dx = r.left < leftB ? leftB - r.left : r.right > right ? right - r.right : 0;
    const dy = r.top - 6 < top ? top - (r.top - 6) : 0;
    el.style.setProperty("--dx", `${Math.round(dx)}px`);
    el.style.setProperty("--dy", `${Math.round(dy)}px`);
  }
  function mood(el, name, ms = 600) {
    if (!el || el.classList.contains("ko")) return;
    el.classList.remove("hit", "flinch", "hop", "lunge");
    void el.offsetWidth;
    el.classList.add(name);
    later(() => el.classList.remove(name), ms);
  }
  function shake(big = false) {
    walk.classList.remove("shake", "shake-big");
    void walk.offsetWidth;
    walk.classList.add(big ? "shake-big" : "shake");
    later(() => walk.classList.remove("shake", "shake-big"), 500);
  }
  function flash(kind) {
    const sc = wscene.querySelector(".scene");
    if (!sc || reducedMotion()) return;
    const f = document.createElement("div");
    f.className = `flash ${kind}`;
    sc.append(f);
    later(() => f.remove(), 700);
  }

  // ---------- Answering ----------

  function askWisp() {
    if (busy || s.phase !== "room") return;
    const ev = dispatch({ t: "hint" });
    if (!ev) return;
    const e = ev.find((x) => x.type === "hint");
    sfx.relic();
    say("m", `Psst… “${e.letter}”…`, 2400);
    hint(html`The ${beast(currentRoom(s)).name} whispers: try something rare starting with <b>“${e.letter}”</b>. This glade now pays half.`, "good");
    repaintMeta(currentRoom(s));
    const [x, y] = centerOf(wscene.querySelector(".actor") || wscene);
    drift(x, y, { tier: "night", count: 14, spread: 50 });
    stack.querySelector("#answer")?.focus({ preventScroll: true });
  }

  function submit(value) {
    if (busy || s.phase !== "room") return;
    const rm = currentRoom(s);
    const r = room(rm.pid);
    const text = String(value || "").trim();
    if (!text) return;
    const input = stack.querySelector("#answer");
    let final = text;
    if (lookup(r, text) < 0 && !s.hard) {
      const sg = suggest(r, text);
      if (sg.length === 1 || (sg.length > 1 && sg[0].d < sg[1].d)) final = sg[0].name;
      else if (sg.length > 1) {
        const box = stack.querySelector("#suggest");
        box.innerHTML = `<span class="it">Did you mean</span>` + sg.map((x) => html`<button class="chip gold" type="button" data-s="${x.name}">${x.name}</button>`).join("");
        for (const b of box.querySelectorAll("button")) b.addEventListener("click", () => submit(b.dataset.s));
        requestAnimationFrame(fit);
        return;
      }
    }
    stack.querySelector("#suggest").innerHTML = "";
    const ev = dispatch({ t: "answer", text: final });
    if (!ev) return;
    if (input) input.value = "";
    play(ev, rm, { typed: text, final });
  }

  function missLine(typed, r, m, rm, reason) {
    if (reason === "letter") return html`That doesn't start with <b>“${rm.letter}”</b>. Guesses are free.`;
    const known = recognise(typed, r.listKey);
    if (known && known.listKey === r.listKey) return html`<b>${known.name}</b> is a ${r.noun}, but ${r.miss || "not one that belongs here"}. Guesses are free.`;
    if (known) return html`<b>${known.name}</b> is a real ${known.noun}, but not what ${m.the} asked for.`;
    const q = quipFor(typed);
    if (q) return esc(q);
    return html`“${typed}” isn’t on the list. Guesses are free.`;
  }

  /** Shows what just happened: reactions, loot, hits, strikes, then a result or an ending. */
  function play(ev, rm, { typed, final }) {
    const r = room(rm.pid);
    const m = beast(rm);
    const actor = wscene.querySelector(".actor");
    const form = stack.querySelector("#answer-form");
    let resolved = false;
    let ending = null;
    for (const e of ev) {
      if (e.type === "miss") {
        form?.classList.remove("shake");
        void form?.offsetWidth;
        form?.classList.add("shake");
        sfx.miss();
        say("m", pickOne(e.reason === "letter" ? REACT.letter : REACT.miss));
        mood(actor, "hop", 520);
        hint(missLine(typed, r, m, rm, e.reason), "bad");
      }
      if (e.type === "bounced") {
        hint(`${missLine(typed, r, m, rm, rm.answers.at(-1)?.reason)} It bounced off the ${m.name}. No harm done, once.`, "bad");
        say("m", "Boing! That one bounced.");
        sfx.blocked();
      }
      if (e.type === "forgiven") {
        hint(`${missLine(typed, r, m, rm, rm.answers.at(-1)?.reason)} Your Four-leaf Clover forgives it.`, "bad");
        sfx.blocked();
      }
      if (e.type === "hit") later(() => takeHitFx(e.times), e.cause === "armor" ? 650 : 120);
      if (e.type === "blocked")
        later(() => {
          sfx.blocked();
          toast("Your Iron Helm takes the hit!");
          paintStatus();
        }, 650);
      if (e.type === "dupe") {
        sfx.blip();
        say("m", pickOne(REACT.dupe));
        hint(html`You already said <b>${e.name}</b>.`);
      }
      if (e.type === "sealed") {
        sfx.blip();
        say("m", pickOne(REACT.sealed));
        hint(html`Old Ember already ate <b>${e.name}</b>. Find a rarer one!`, "bad");
      }
      if (e.type === "loot" && e.armored) {
        // A right answer, but too common for the armour: it bounces off. Nothing lost; try again.
        scorePop(`${coin(shownTier(e.tier), 26)}`, "zero");
        sfx.blocked();
        mood(actor, "hop", 520);
        say("m", pickOne(REACT.armored));
        const what = `only ${TIERS[shownTier(e.tier)].name}`;
        hint(html`<b>${e.name}</b> is right, but ${what}. It bounced off: no heart lost. Try a rarer one!`, "bad");
        continue;
      }
      if (e.type === "loot") {
        lootFx(e, actor);
        const t = e.lucky ? "g" : e.trueTier === "f" ? "f" : e.tier;
        say("m", pickOne(REACT[t]));
        mood(actor, HIT_MOOD[e.lucky ? "g" : e.tier], 650);
        if (final !== typed && !e.lucky) hint(html`Read as <b>${e.name}</b>.`, "good");
        if (rm.quirk === "haggler" && e.tier === "c") hint(html`<b>${e.name}</b> is Copper, and the ${m.name} doesn't buy copper. No gold.`, "bad");
        if (rm.boss && e.through) hint(html`<b>${e.name}</b>: a ${TIERS[shownTier(e.tier)].name} strike!`, "good");
        if (rm.boss && !e.through) hint(html`<b>${e.name}</b> is only ${TIERS[shownTier(e.tier)].name}. Old Ember shrugs it off.`, "bad");
      }
      if (e.type === "eaten")
        later(() => {
          say("m", "Crunch! Copper makes me peckish.");
          toast(`The ${m.name} ate ${e.gold} of your gold!`);
          setGold(true);
          sfx.hit();
        }, 900);
      if (e.type === "healed")
        later(() => {
          sfx.relic();
          toast(`The ${m.name} is delighted and gives you a big hug: +1 heart!`);
          paintStatus();
          status.querySelectorAll(".hearts .hrt")[s.hearts - 1]?.classList.add("pop");
        }, 800);
      if (e.type === "collect") {
        repaintMeta(rm);
        hint(html`<b>${e.have} of ${e.need}.</b> The ${m.name} wants one more, a different one.`, "good");
        later(() => say("m", "Lovely! One more!"), 1500);
      }
      if (e.type === "strike") {
        later(() => sfx.strike(), 200);
        const pips = wscene.querySelector(".strike-pips");
        if (pips) {
          pips.innerHTML = `<span class="cap" style="font-size:9.5px">Strikes</span>${strikePips(rm)}`;
          pips.querySelectorAll(".pip.on")[rm.strikes - 1]?.classList.add("fresh");
        }
        repaintMeta(rm);
      }
      if (e.type === "advance") resolved = true;
      if (e.type === "vault" || e.type === "fell" || e.type === "escaped") ending = e;
    }
    paintStatus();
    if (ending) return finish(ending);
    if (resolved) {
      stopLantern();
      busy = true;
      const input = stack.querySelector("#answer");
      if (input) {
        input.disabled = true;
        input.blur();
      }
      const got = rm.answers.filter(counts);
      // Won over: the creature is delighted and lets you through.
      later(() => {
        happyActor(actor, { aside: false });
        sfx.happy();
        say("m", pickOne(["Off you go, then!", "You may pass!", "Thank you! This way!", "Lovely. Through you go!"]), 1800);
      }, 800);
      later(() => showResult(rm), 1500);
    }
  }

  function takeHitFx(times = 1) {
    sfx.hit();
    if (times > 1) later(() => sfx.hit(), 220);
    // The hearts about to go crack in two and fall away.
    const before = [...status.querySelectorAll(".hearts .hrt.on")];
    for (let k = 0; k < times; k++) {
      const h = before[s.hearts + k];
      if (!h || reducedMotion()) continue;
      const r = h.getBoundingClientRect();
      for (const side of ["l", "r"]) {
        const shard = document.createElement("div");
        shard.className = `heart-shard ${side}`;
        shard.innerHTML = heart(true, r.width);
        Object.assign(shard.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, animationDelay: `${k * 0.12}s` });
        document.body.append(shard);
        setTimeout(() => shard.remove(), 1200);
      }
    }
    shake(times > 1);
    flash("red");
    mood(wscene.querySelector(".actor"), "hop", 500);
    paintStatus();
    if (navigator.vibrate) navigator.vibrate(times > 1 ? [60, 60, 60] : 60);
  }

  /** "+30" floating up beside the creature. */
  function scorePop(text, cls = "", stay = false) {
    const sc = wscene.querySelector(".scene");
    const box = SCENES[sc?.dataset.scene];
    if (!sc || !box || !actorBox) return null;
    const el = document.createElement("div");
    el.className = `score-pop ${cls}${stay ? " stay" : ""}`;
    const off = (box.w - (box.core || box.w)) / 2;
    const right = Math.min(off + (box.core || box.w) - 24, (actorBox.right ?? actorBox.x + 10) + 2);
    el.style.left = `${((right / box.w) * 100).toFixed(1)}%`;
    el.style.top = `${(((actorBox.top + 2) / box.h) * 100).toFixed(1)}%`;
    el.innerHTML = text;
    sc.querySelector(".sc-world").append(el);
    if (!stay) later(() => el.remove(), 1700);
    return el;
  }

  /** BLOOM: a Gold-or-better answer makes the glade burst into flower. */
  function bloom(stay = false) {
    const sc = wscene.querySelector(".scene");
    if (!sc) return;
    sfx.bloom();
    sc.insertAdjacentHTML("beforeend", `<div class="bloom-glow${stay ? " stay" : ""}"></div><div class="bloom-word${stay ? " stay" : ""}" aria-hidden="true">BLOOM</div>`);
    if (!stay)
      later(() => {
        sc.querySelector(".bloom-word:not(.stay)")?.remove();
        sc.querySelector(".bloom-glow:not(.stay)")?.remove();
      }, 2300);
    const [x, y] = centerOf(sc.querySelector(".actor") || sc);
    burst(x, y - 20, { tier: "bloom", kind: "petal", count: stay ? 44 : 26, speed: 300, gravity: 140, life: 1.7 });
  }

  function lootFx(e, actor) {
    const tier = e.lucky ? "g" : e.tier;
    if (tier === "j") flash("gold");
    if (RARE(tier)) {
      shake(tier !== "g");
      bloom();
    }
    scorePop(e.gold ? `+${e.gold}` : "0", e.gold ? "" : "zero");
    sfx.loot(e.trueTier === "f" && !e.lucky ? "f" : tier);
    const [x, y] = actor ? centerOf(actor) : centerOf(wscene);
    if (!e.gold) return;
    // Sparkle at the hit, then the coins fly home to the purse and it rolls up.
    burst(x, y - 20, { tier, kind: "star", count: { c: 4, f: 3, s: 8, g: 12, e: 18, j: 30 }[tier], speed: tier === "j" ? 360 : 240, gravity: 200, life: 0.9 });
    const coins = { c: 3, f: 3, s: 5, g: 8, e: 11, j: 16 }[tier] || 5;
    let landed = 0;
    const goldEl = status.querySelector(".gold");
    flyTo(x, y - 10, goldEl, {
      tier,
      count: coins,
      onArrive: () => {
        if (landed++ % 2 === 0) sfx.tap();
      },
      onDone: () => setGold(true),
    });
    if (reducedMotion()) setGold(true);
  }

  // ---------- The lantern ----------

  let flickerRaf = 0;
  function startLantern() {
    stopLantern();
    lastSecond = null;
    const total = candleSeconds(s) * 1000;
    const update = () => {
      if (!alive || s.phase !== "room") return stopLantern();
      const left = rec.deadline - Date.now();
      const frac = Math.max(0, Math.min(1, left / total));
      setLight("--light", (0.2 + frac * 0.8).toFixed(3));
      paintMeter(frac);
      const secs = Math.max(0, Math.ceil(left / 1000));
      const meter = status.querySelector(".meter");
      // A copy of the lantern rides in the answer bar, so it shows above a phone keyboard too.
      const bar = stack.querySelector(".answer");
      const line = bar?.querySelector(".ans-line i");
      if (line) line.style.transform = `scaleX(${frac.toFixed(3)})`;
      if (secs !== lastSecond) {
        const el = status.querySelector(".secs");
        if (el) el.textContent = secs;
        const a = bar?.querySelector(".ans-secs");
        if (a) a.textContent = secs;
      }
      meter?.classList.toggle("low", left <= 5000);
      bar?.classList.toggle("low", left <= 5000);
      // The creature gets fidgety as the light goes.
      if (left <= 5000 && left > 0 && secs !== lastSecond) {
        sfx.tick();
        mood(wscene.querySelector(".actor:not(.ember)"), "hop", 400);
      }
      lastSecond = secs;
      if (left <= 0) {
        stopLantern();
        timeout();
      }
    };
    update();
    tick = setInterval(update, 100);
    // The flame flickers on its own clock, and the glade's light breathes with it.
    const noise = makeNoise();
    const flicker = (t) => {
      if (!tick) return;
      const left = rec.deadline - Date.now();
      const nervous = left < 5000 ? 2.4 : 1;
      setLight("--flick", (1 + noise(t / 1000) * 0.05 * nervous).toFixed(3));
      flickerRaf = requestAnimationFrame(flicker);
    };
    if (!reducedMotion()) flickerRaf = requestAnimationFrame(flicker);
  }
  function stopLantern() {
    cancelAnimationFrame(flickerRaf);
    if (tick) clearInterval(tick);
    tick = null;
  }

  function timeout() {
    if (busy || s.phase !== "room") return;
    const rm = currentRoom(s);
    sfx.snuff();
    const ev = dispatch({ t: "timeout" });
    if (!ev) return;
    const input = stack.querySelector("#answer");
    if (input) {
      input.disabled = true;
      input.blur();
    }
    setLight("--light", 0.05);
    paintMeter(0);
    say("m", "Lights out!", 1300);
    const ending = ev.find((e) => e.type === "escaped" || e.type === "fell");
    if (ending) return finish(ending);
    busy = true;
    const hits = ev.find((e) => e.type === "hit");
    if (hits) later(() => takeHitFx(hits.times), 350);
    if (ev.some((e) => e.type === "blocked")) later(() => (sfx.blocked(), toast("Your Iron Helm takes the hit!"), paintStatus()), 350);
    later(() => (rm.answers.some(counts) ? showResult(rm) : showGutter(rm)), 1200);
  }

  // ---------- After a glade ----------

  const nextLabel = () => (s.phase === "nook" ? "To the Wishing Stones" : s.floor === last ? "Onward, to the great tree" : "Onward");
  function onward(btn) {
    btn.addEventListener("click", () => {
      sfx.tap();
      rec.deadline = null;
      save();
      veil(renderPhase, 380);
    });
    // A short pause so a second Enter press can't skip the result unread.
    btn.disabled = true;
    later(() => {
      btn.disabled = false;
      btn.focus({ preventScroll: true });
    }, 700);
  }

  /** How often people said an answer, when the crowd is known. */
  function said(r, name) {
    const rr = crowd?.rooms?.[r.id];
    if (!rr?.entered) return null;
    return pct(rr.answers?.[name] || 0, rr.entered);
  }

  /** The ladder: where your answer sits among the real ones, from Copper up to the hidden jewel. */
  function ladder(r, rm, mine) {
    const letterOk = (a) => rm.quirk !== "letter" || (a.name.replace(/^the\s+/i, "")[0] || "").toUpperCase() === rm.letter;
    const pool = r.answers.filter((a) => letterOk(a) && !(rm.boss && r.sealed.includes(a.name)));
    const rows = [];
    const add = (a, me = false) => a && !rows.some((x) => x.a === a) && rows.push({ a, me });
    const firstOf = (t, skip = 0) => pool.filter((a) => shownTier(a.tier) === t)[skip];
    add(firstOf("c"));
    add(firstOf("c", 1));
    for (const idx of mine) add(r.answers[idx], true);
    for (const t of ["s", "g", "e"]) if (!rows.some((x) => shownTier(x.a.tier) === t)) add(firstOf(t));
    const order = { c: 0, f: 1, s: 2, g: 3, e: 4, j: 5 };
    rows.sort((x, y) => order[shownTier(x.a.tier)] - order[shownTier(y.a.tier)]);
    const cells = rows
      .slice(0, 6)
      .map(({ a, me }) => {
        const p = said(r, a.name);
        return html`<div class="r${me ? " me" : ""}">${raw(coin(shownTier(a.tier)))}<span>${a.name}</span><span class="pct">${p == null ? TIERS[shownTier(a.tier)].name : `${p}%`}</span></div>`;
      })
      .join("");
    const jewelFound = mine.some((i) => r.answers[i].tier === "j");
    const jewel = r.jewel && !jewelFound ? html`<div class="r hidden">${raw(coin("?"))}<span>The Crown Jewel</span><span class="pct">at home</span></div>` : "";
    return `<div class="ladder">${cells}${jewel}</div>`;
  }

  function showResult(rm) {
    busy = false;
    const r = room(rm.pid);
    const m = beast(rm);
    const got = rm.answers.filter(counts);
    const best = [...got].sort((a, b) => TIERS[shownTier(b.tier)].rank - TIERS[shownTier(a.tier)].rank)[0];
    const earned = got.reduce((t, a) => t + a.gold, 0) - rm.eaten;
    const t = TIERS[shownTier(best.tier)];
    const name = r.answers[best.idx].name;
    const p = said(r, name);
    const sub = p == null ? `${t.name} · ${TIER_SHORT[best.tier]}` : best.tier === "c" ? `${t.name} · ${p}% said it too` : `${t.name} · ${p}% found it`;
    scorePop(`${earned >= 0 ? "+" : ""}${earned}`, earned ? "" : "zero", true);
    const lines = [];
    if (rm.result === "partial") lines.push(`<span class="hurt">The lantern went out before the second answer. −1 heart</span>`);
    else if (!got.every((a) => a.through)) {
      const why = "Too common to get through its armour.";
      lines.push(`${why} ${esc(m.hit)} ${rm.blocked ? `<span class="good">Your Iron Helm took the hit.</span>` : `<span class="hurt">−1 heart</span>`}`);
    }
    if (best.lucky) lines.push(`<span class="good">Your Lucky Coin turned it into Gold!</span>`);
    if (got.some((a) => a.clover)) lines.push(`<span class="good">Your Four-leaf Clover turned Copper into Silver!</span>`);
    if (rm.quirk === "haggler" && got.some((a) => a.tier === "c")) lines.push(`The ${m.name} paid nothing for Copper.`);
    if (rm.quirk === "haggler" && got.some((a) => a.tier === "s" || a.tier === "g")) lines.push(`<span class="good">The ${m.name} paid ×1.5 for your find.</span>`);
    if (rm.eaten) lines.push(`<span class="hurt">The ${m.name} ate ${rm.eaten} of your gold.</span>`);
    if (rm.quirk === "hungry" && got.some((a) => a.tier === "e" || a.tier === "j")) lines.push(`<span class="good">The ${m.name} paid triple for something rare!</span>`);
    if (rm.healed) lines.push(`<span class="good">The ${m.name} was so delighted it healed a heart.</span>`);
    if (rm.bounced) lines.push(`<span class="good">One wrong answer bounced off the ${m.name}.</span>`);
    if (rm.hinted) lines.push(`You took the ${m.name}'s hint, so this glade paid half.`);
    if (rm.elite && earned > 0) lines.push(`<span class="good">The ×2 path doubled it.</span>`);
    if (got.some((a) => a.tier === "j")) lines.push(html`<span class="good">You found the Crown Jewel!${r.jewelNote ? ` ${r.jewelNote}.` : ""}</span>`);
    const said2 = got.length > 1 ? html` and “${r.answers[got.find((a) => a !== best).idx].name}”` : "";
    setStack(html`<div class="box result">
        <div class="row" style="gap:10px">${raw(coin(shownTier(best.tier), 26))}<div><div class="ttl${name.length + (said2 ? 12 : 0) > 22 ? " long" : ""}">“${name}”${raw(said2)}</div><div class="cap" style="margin-top:2px">${sub}</div></div></div>
        ${lines.length ? raw(`<div class="lines">${lines.map((l) => `<div>${l}</div>`).join("")}</div>`) : ""}
        <div class="rule"></div>
        ${raw(ladder(r, rm, got.map((a) => a.idx)))}
      </div>
      <button class="btn" type="button" id="next">${nextLabel()}</button>`);
    paintGlades();
    paintStatus();
    onward(stack.querySelector("#next"));
  }

  /** The lantern burnt out with nothing said: what would have worked. */
  function showGutter(rm) {
    busy = false;
    const r = room(rm.pid);
    const m = beast(rm);
    const lost = rm.blocked ? 0 : rm.hits;
    const sc = wscene.querySelector(".scene");
    sc?.insertAdjacentHTML(
      "beforeend",
      html`<div class="gutter-dark"></div><div class="gutter-out">
        ${raw(lantern(40, { cls: "dim" }))}
        <div class="ttl">The lantern gutters out</div>
        <div class="lost">${raw(lost ? Array.from({ length: lost }, () => heart(false, 22)).join("") + `<span class="num">−${lost}</span>` : `<span class="it">Your Iron Helm took the hit.</span>`)}</div>
        <div class="it">${m.hit}</div>
      </div>`,
    );
    const letterOk = (a) => rm.quirk !== "letter" || (a.name.replace(/^the\s+/i, "")[0] || "").toUpperCase() === rm.letter;
    const pool = r.answers.filter(letterOk);
    const picks = ["c", "s", "g", "e"].map((t) => pool.find((a) => shownTier(a.tier) === t)).filter(Boolean);
    setStack(html`<div class="box result">
        <div class="cap">These would have worked</div>
        <div class="would">${raw(picks.map((a) => html`<span>${raw(coin(shownTier(a.tier)))}${a.name}</span>`).join(""))}</div>
      </div>
      <button class="btn ghost" type="button" id="next">Walk on</button>`);
    paintGlades();
    paintStatus();
    onward(stack.querySelector("#next"));
  }

  // ---------- The Wishing Stones ----------

  let charm = -1;
  function renderNook() {
    stopLantern();
    charm = -1;
    const id = "nook";
    const sc = SCENES[id];
    const relics = s.dungeon.relics;
    const art = relics.map((rid, i) => relicHtml(id, rid, sc.spots[`relic${i}`], i, RELIC_COLOR[rid])).join("");
    const hits = relics.map((rid, i) => `<button class="relic-hit" type="button" data-charm="${i}" aria-label="${esc(RELICS[rid].name)}" style="${place(id, [sc.spots[`relic${i}`][0], sc.spots[`relic${i}`][1] + 1], 22, 22)}"></button>`).join("");
    const title = `<div class="scene-title"><div class="cap">Afternoon · between glades 2 and 3</div><div class="ttl glowtxt">The Wishing Stones</div></div>`;
    setScene(id, { inner: art, over: hits + title, label: "An old tree with a rope and paper tags; three mossy stones before it, each with a glowing charm.", enter: true, keep: [0.1, (SCENES[id].spots.you[1] + 2) / SCENES[id].h] });
    paintGlades({ hide: true });
    paintStatus();
    paintNookStack();
  }
  function paintNookStack() {
    const relics = s.dungeon.relics;
    const cards = relics
      .map((rid, i) => html`<button class="box relic-card${charm === i ? " on" : ""}" type="button" data-charm="${i}" aria-pressed="${charm === i}"><div class="gem" style="--c:${RELIC_COLOR[rid]}"></div><div class="ttl">${RELICS[rid].name}</div><div class="it">${RELICS[rid].text}</div></button>`)
      .join("");
    setStack(html`<div class="choices">${raw(cards)}</div>
      <button class="btn" type="button" id="take" ${charm < 0 ? "disabled" : ""}>${charm < 0 ? "Choose one charm" : `Take the ${RELICS[relics[charm]].name}`}</button>`);
    for (const b of view.querySelectorAll("[data-charm]")) b.addEventListener("click", () => chooseCharm(Number(b.dataset.charm)));
    stack.querySelector("#take").addEventListener("click", () => takeRelic(charm));
  }
  function chooseCharm(i) {
    if (busy || s.phase !== "nook") return;
    if (charm === i) return takeRelic(i);
    charm = i;
    sfx.tap();
    for (const b of wscene.querySelectorAll(".relic-hit")) b.classList.toggle("on", Number(b.dataset.charm) === i);
    paintNookStack();
    stack.querySelector("#take").focus({ preventScroll: true });
  }
  function takeRelic(i) {
    if (busy || s.phase !== "nook" || i < 0) return;
    busy = true;
    const id = s.dungeon.relics[i];
    sfx.relic();
    const art = wscene.querySelector(`.relic-art[data-i="${i}"]`);
    if (art) {
      const [x, y] = centerOf(art);
      drift(x, y - 10, { tier: "night", count: 18, spread: 50 });
      burst(x, y, { tier: "g", kind: "star", count: 10, speed: 160, gravity: 60, life: 0.8 });
    }
    later(() => {
      dispatch({ t: "relic", i });
      busy = false;
      toast(`You take the ${RELICS[id].name}.`);
      veil(renderPhase, 380);
    }, 650);
  }

  // ---------- Endings ----------

  function finish(e) {
    stopLantern();
    busy = true;
    const input = stack.querySelector("#answer");
    if (input) {
      input.disabled = true;
      input.blur();
    }
    rec.done = true;
    rec.finishedAt = Date.now();
    rec.gold = s.gold;
    rec.ending = s.ending;
    rec.floor = floorReached(s);
    rec.deadline = null;
    save();
    if (persistent && rec.live) submitRun(rec);
    if (!persistent) rememberPractice(day, rec);

    const rm = s.rooms.at(-1);
    const r = room(rm.pid);
    const m = beast(rm);
    const actor = wscene.querySelector(".actor");
    if (e.type === "vault") {
      const flawless = s.hearts >= RULES.HEARTS;
      const last = rm.answers.filter(counts).at(-1);
      say("m", "Oh, well done! The hoard is yours!", 2400);
      later(() => {
        happyActor(actor, { aside: false });
        sfx.happy();
      }, 600);
      later(() => {
        sfx.vault(flawless ? 1 : 0.6);
        bloom(true);
        rain({ tier: "g", count: flawless ? 150 : 90 });
        if (flawless) later(() => rain({ tier: "bloom", kind: "petal", count: 70 }), 700);
        setGold(true);
        petals();
      }, 900);
      later(() => {
        setStack(html`<div class="box result">
            <div class="row" style="gap:10px">${raw(coin(shownTier(last.tier), 26))}<div><div class="ttl${r.answers[last.idx].name.length > 22 ? " long" : ""}">“${r.answers[last.idx].name}”</div><div class="cap" style="margin-top:2px">${TIERS[shownTier(last.tier)].name} · the final strike</div></div></div>
            <div class="it" style="margin-top:10px;font-size:14.5px">“${m.win}”</div>
            <div class="rule"></div>
            <div class="breakdown">
              <div class="r"><span>${TIERS[shownTier(last.tier)].name}</span><span class="num">+${last.gold}</span></div>
              <div class="r"><span>The hoard</span><span class="num" style="color:#ffe08a">+${RULES.VAULT_BONUS}</span></div>
              ${s.hearts ? raw(html`<div class="r"><span class="row" style="gap:6px">Hearts left ${raw(heart(true, 13))} × ${s.hearts}</span><span class="num">+${s.hearts * RULES.HEART_BONUS}</span></div>`) : ""}
            </div>
          </div>
          <button class="btn" type="button" id="home">Walk home</button>`);
        stack.querySelector("#home").addEventListener("click", done);
        later(() => stack.querySelector("#home")?.focus({ preventScroll: true }), 500);
        paintGlades();
      }, 1700);
    } else if (e.type === "escaped") {
      later(() => sfx.phew(), 500);
      say("m", "Mmm… come back tomorrow…", 2400);
      later(() => {
        wscene.querySelector(".scene")?.insertAdjacentHTML(
          "beforeend",
          html`<div class="gutter-dark"></div><div class="gutter-out">${raw(lantern(40, { cls: "dim" }))}<div class="ttl">The lantern gutters out</div><div class="it">Old Ember yawns, and you tiptoe home with your gold. The hoard stays hers, for today.</div></div>`,
        );
        setStack(html`<div class="box result">
            <div class="cap">You slipped home at nightfall</div>
            <div class="breakdown" style="margin-top:8px"><div class="r"><span>Gold in your pocket</span><span class="num">${s.gold}</span></div></div>
            <div class="it" style="margin-top:6px;font-size:14px">${rm.strikes ? `${rm.strikes} of ${s.strikesNeeded} strikes landed.` : "Not a single strike landed. Next time, dig deeper."}</div>
          </div>
          <button class="btn" type="button" id="home">Walk home</button>`);
        stack.querySelector("#home").addEventListener("click", done);
        const [x, y] = centerOf(wscene);
        burst(x, y, { tier: "g", count: 14, speed: 200 });
        paintGlades();
      }, 1300);
    } else {
      setLight("--light", 0.06);
      paintMeter(0);
      say("m", "Night night!", 1600);
      later(() => sfx.fell(), 700);
      later(() => {
        wscene.querySelector(".scene")?.insertAdjacentHTML(
          "beforeend",
          html`<div class="gutter-dark"></div><div class="gutter-out">${raw(heart(false, 40))}<div class="ttl">Out of hearts</div><div class="it">Lost in glade ${rm.floor + 1}. ${cap1(m.the)} tucks you in with a leaf. You keep every coin you found.</div></div>`,
        );
        setStack(html`<div class="box result">
            <div class="cap">The walk ends here</div>
            <div class="breakdown" style="margin-top:8px"><div class="r"><span>Gold in your pocket</span><span class="num">${s.gold}</span></div></div>
            <div class="it" style="margin-top:6px;font-size:14px">${rm.floor >= 3 ? "So close to the hoard." : "The wood will be here tomorrow."}</div>
          </div>
          <button class="btn" type="button" id="home">Walk home</button>`);
        stack.querySelector("#home").addEventListener("click", done);
        later(() => stack.querySelector("#home")?.focus({ preventScroll: true }), 500);
        paintGlades();
      }, 1500);
    }
  }

  /** Petals drifting down through the whole glade. */
  function petals() {
    const sc = wscene.querySelector(".scene");
    if (!sc || reducedMotion()) return;
    const bits = Array.from({ length: 26 }, (_, k) => `<i class="petal" style="--x:${(k * 37) % 100}%;--d:${(4 + (k % 5)).toFixed(1)}s;--delay:${(-(k % 7) * 0.7).toFixed(1)}s;--dx:${(k % 2 ? 1 : -1) * (20 + (k % 4) * 15)}px"></i>`).join("");
    sc.insertAdjacentHTML("beforeend", `<div class="petals">${bits}</div>`);
  }

  let finished = false;
  function done() {
    if (finished || !alive) return;
    finished = true;
    onDone?.();
  }

  // ---------- Which screen now ----------

  function renderPhase() {
    if (s.phase === "done") return done();
    if (s.phase === "door") return s.floor === 0 || s.floor === last ? renderMap() : renderFork();
    if (s.phase === "nook") return renderNook();
    if (s.phase === "room") return renderRoom(false);
  }

  renderPhase();

  return () => {
    alive = false;
    stopLantern();
    cancelAnimationFrame(rollRaf);
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    for (const t of timers) clearTimeout(t);
    timers.clear();
  };
}
