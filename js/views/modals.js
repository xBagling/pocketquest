// Bottom sheets: how to play, and settings. (No confirm() anywhere: embedded browsers block it.)
import { html, raw, $ } from "../util.js";
import { TIERS, TIER_ORDER, RANKS, BESTIARY, QUIRKS, ROLE_LOOKS, CREATURES } from "../rules.js";
import { RULES } from "../config.js";
import { store } from "../store.js";
import { sfx } from "../sfx.js";
import { coin, lantern, divider, dia, ico, heart } from "../forest/ui.js";

let lastFocus = null;

export function openModal(inner, { label = "Dialog", onClose, cls = "" } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  const root = $("#modal-root");
  root.innerHTML = `<div class="sheet-back" data-close><div class="sheet box ${cls}" tabindex="-1" role="dialog" aria-modal="true" aria-label="${label}"><button class="close" type="button" data-close aria-label="Close">${ico("close", 20)}</button>${inner}</div></div>`;
  const back = root.firstElementChild;
  back.addEventListener("click", (e) => {
    if (e.target === back || e.target.closest("button[data-close]")) {
      closeModal();
      onClose?.();
    }
  });
  root._onClose = onClose;
  back.querySelector(".sheet").focus({ preventScroll: true });
}

export function closeModal() {
  const root = $("#modal-root");
  if (!root || !root.firstChild) return;
  root.innerHTML = "";
  root._onClose = null;
  lastFocus?.focus?.({ preventScroll: true });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#modal-root")?.firstChild) {
    const fn = $("#modal-root")._onClose;
    closeModal();
    fn?.();
  }
});

const CAST = ["bunny", "slime", "goblin", "toad", "bat", "bones", "troll", "wisp", "mimic", "dragon"];

export function showHelp({ onClose } = {}) {
  store.seenHelp = true;
  const tiers = TIER_ORDER.map((t) => html`<div>${raw(coin(t, 18))}<span><b>${TIERS[t].name}</b> · ${TIERS[t].gold} gold. ${TIERS[t].blurb}</span></div>`).join("");
  const names = (k) => (ROLE_LOOKS[k]?.length ? ROLE_LOOKS[k].map((c) => CREATURES[c].name).join(" or ") : BESTIARY[k].name);
  const faces = (k) => (ROLE_LOOKS[k]?.length ? ROLE_LOOKS[k] : [k]).map((c) => dia(c)).join("");
  const cast = CAST.map((k) => html`<div><span class="faces">${raw(faces(k))}</span><span><b>${names(k)}</b>${BESTIARY[k].pool === "elite" ? " (×2 gold)" : ""}: ${QUIRKS[BESTIARY[k].quirk].short}</span></div>`).join("");
  openModal(
    html`<div class="sheet-head"><div class="cap">Before you go</div><h2>How the walk works</h2>${raw(divider(40))}</div>
      <ol class="rules">
        <li><span class="ic">${raw(dia("mossbunny"))}</span><div><h3>Pick a path</h3><p>${RULES.FLOORS} glades a day, the same for everyone. At each fork, tap the path you like the look of.</p></div></li>
        <li><span class="ic"><span class="row" style="gap:2px">${raw(coin("c", 12) + coin("s", 12) + coin("g", 12))}</span></span><div><h3>Name something rare</h3><p>Any right answer wins. The fewer people who thought of it, the more gold it pays.</p></div></li>
        <li><span class="ic">${raw(lantern(24))}</span><div><h3>Mind the lantern</h3><p>Wrong guesses are free. Only a burnt-out lantern costs you a heart.</p></div></li>
      </ol>
      <details class="fine">
        <summary>The finer print</summary>
        <h4 class="cap">Loot</h4>
        <div class="tier-list">${raw(tiers)}</div>
        <p>Some creatures wear armour: only Silver or Gold (or better) gets through. A right answer that's too common just bounces off, at no cost. The path marked <b>×2</b> pays double.</p>
        <h4 class="cap">Who you'll meet</h4>
        <div class="cast-list">${raw(cast)}</div>
        <p>After glade 2 you take one charm from the <b>Wishing Stones</b>.</p>
        <p><b>Old Ember</b> guards the hoard in glade 5. She has eaten the five most common answers. Land ${RULES.BOSS_STRIKES} strikes of Gold or better before the lantern dies and the hoard is yours: +${RULES.VAULT_BONUS} gold, and +${RULES.HEART_BONUS} for each ${raw(heart(true, 12))} left. If it dies first, you slip home with what you found.</p>
        <p><b>Your purse:</b> the gold from each day's first walk is saved. Spend it at the <b>Camp</b> on someone new to walk as: a Fox Scout who can listen in at a fork to hear the question first, a Lamplighter with a bigger lantern, and more.</p>
        <p>You have ${RULES.HEARTS} hearts. Lose them all and the walk ends, but you keep every coin. The lantern burns ${RULES.CANDLE} seconds a glade (${RULES.CANDLE_HARD} in hard mode, which also skips typo help). A walk takes about three minutes.</p>
        <p>Your title for the day: ${RANKS.map((r) => r.name).join(" → ")}.</p>
      </details>
      <button class="btn" type="button" data-close>Got it</button>`,
    { label: "How to play", onClose },
  );
}

export function showSettings({ onClose } = {}) {
  openModal(
    html`<div class="sheet-head"><div class="cap">Your lantern, your way</div><h2>Settings</h2>${raw(divider(40))}</div>
      <label class="setting"><span><b>Sound</b><small>Coins, rustles and a little fanfare.</small></span><span class="switch"><input type="checkbox" id="set-sound" ${sfx.muted ? "" : "checked"} /><i></i></span></label>
      <label class="setting"><span><b>Hard mode</b><small>A ${RULES.CANDLE_HARD}-second lantern and no typo help. Starts with your next walk.</small></span><span class="switch"><input type="checkbox" id="set-hard" ${store.hardMode ? "checked" : ""} /><i></i></span></label>
      <div class="setting"><span><b>How to play</b><small>The rules, the loot and who lives in the wood.</small></span><button class="btn ghost small" type="button" id="set-help">Open</button></div>
      <div class="setting"><span><b>Past walks</b><small>Every walk so far, and your hoard.</small></span><a class="btn ghost small" href="#/archive">Open</a></div>
      <p class="small-note center" style="margin-top:18px">Everything is drawn in code. Your walks are kept only in this browser.</p>
      <button class="btn" type="button" data-close>Done</button>`,
    { label: "Settings", onClose },
  );
  const root = $("#modal-root");
  root.querySelector("#set-sound").addEventListener("change", (e) => {
    if (e.target.checked === sfx.muted) sfx.toggle();
    sfx.tap();
    window.dispatchEvent(new Event("pq:paint-sfx"));
  });
  root.querySelector("#set-hard").addEventListener("change", (e) => {
    store.hardMode = e.target.checked;
    sfx.tap();
  });
  root.querySelector("#set-help").addEventListener("click", () => showHelp({ onClose }));
  root.querySelector('a[href="#/archive"]').addEventListener("click", () => closeModal());
}
