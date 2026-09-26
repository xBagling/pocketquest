import { ico } from "./forest/ui.js";
import { sfx } from "./sfx.js";
import { flushPending } from "./stats.js";
import { store } from "./store.js";
import { renderGate } from "./views/gate.js";
import { renderDelve } from "./views/delve.js";
import { renderLedgerFor } from "./views/ledger.js";
import { renderArchive } from "./views/archive.js";
import { renderCamp } from "./views/camp.js";
import { renderAdmin, admin } from "./views/admin.js";
import { showHelp, closeModal } from "./views/modals.js";
import { $, todayDay } from "./util.js";
import { scheduleLength } from "./dungeon.js";

const view = $("#view");
let cleanup = null;

// The visible height, so the room fits above a phone keyboard.
function syncViewport() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--vvh", `${Math.round(h)}px`);
  // A short screen (a phone with its keyboard up, or a small phone): the room and panel tighten up.
  document.documentElement.classList.toggle("short", h < 600);
  // Wide screens get the full-window forest with the UI beside it.
  document.documentElement.classList.toggle("wide", window.innerWidth >= 900 && window.innerWidth >= window.innerHeight * 1.2);
  syncTyping();
  // iOS scrolls the page to show a focused input. In a run the page already fits, so pin it.
  if (document.body?.dataset.view === "walk" && window.scrollY) window.scrollTo(0, 0);
}
// The keyboard is up when a text box has focus and the visible height has dropped well below
// its full height for this width. Then the room shrinks to sit above the keyboard.
let fullH = 0;
let fullW = 0;
function syncTyping() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (window.innerWidth !== fullW) {
    fullW = window.innerWidth;
    fullH = 0;
  }
  const focused = document.activeElement?.matches?.("input[type=text]");
  fullH = Math.max(fullH, h);
  const typing = focused && h < fullH * 0.8;
  document.documentElement.classList.toggle("typing", Boolean(typing));
  document.documentElement.classList.toggle("tiny", Boolean(typing) && h < 400);
}
document.addEventListener("focusin", syncTyping);
document.addEventListener("focusout", () => setTimeout(syncTyping, 50));
syncViewport();
window.visualViewport?.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("scroll", () => document.body.dataset.view === "walk" && window.scrollY && window.scrollTo(0, 0));
window.addEventListener("resize", syncViewport);

// Routes:
//   #/                today's walk (title → the walk → home)
//   #/day/N           a past walk (it doesn't count toward streaks)
//   #/replay/N        walk a finished day again for practice (never saved)
//   #/archive         every walk so far, and your hoard
//   #/camp            your purse, and the characters to walk as
//   #/admin[/N]       admin (passcode), optionally with day N picked
//   #/admin/play/N    test-play any day, even future ones
//   #/admin/ledger/N  preview a ledger with a sample crowd
function route() {
  closeModal();
  cleanup?.();
  cleanup = null;
  window.scrollTo(0, 0);
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const today = todayDay();
  const num = (s) => (/^\d+$/.test(s || "") ? Number(s) : NaN);
  const ctx = { view, setCleanup: (fn) => (cleanup = fn) };
  document.body.dataset.view = "page";

  if (today < 1) {
    view.innerHTML = `<div class="page"><div class="page-head"><h1>Pocket Quest</h1><p class="muted">The first walk opens on launch day. Come back soon.</p></div></div>`;
    return;
  }

  switch (parts[0]) {
    case undefined:
      return play(ctx, today, "today");
    case "day": {
      const day = num(parts[1]);
      if (!(day >= 1)) return (location.hash = "#/archive");
      if (day >= today) return (location.hash = "#/");
      return play(ctx, day, "archive");
    }
    case "replay": {
      const day = num(parts[1]);
      if (!(day >= 1) || day > today) return (location.hash = "#/");
      return play(ctx, day, "replay");
    }
    case "archive":
      document.body.dataset.view = "page";
      return renderArchive(ctx);
    case "camp":
      document.body.dataset.view = "page";
      return renderCamp(ctx);
    case "admin":
      document.body.dataset.view = "page";
      if (parts[1] === "play" || parts[1] === "ledger") {
        const day = num(parts[2]);
        if (!admin.unlocked || !(day >= 1) || day > scheduleLength()) return (location.hash = "#/admin");
        if (parts[1] === "ledger") return renderLedgerFor(ctx, day, "test", { sample: true });
        return play(ctx, day, "test");
      }
      return renderAdmin({ ...ctx, day: num(parts[1]) });
    default:
      location.hash = "#/";
  }
}

/** A day's walk: the title, the walk itself, or home (the ledger) once it's done. */
function play(ctx, day, mode) {
  const rec = mode === "today" || mode === "archive" ? store.run(day) : null;
  if (rec?.done) {
    document.body.dataset.view = "home";
    return renderLedgerFor(ctx, day, mode);
  }
  const start = () => {
    document.body.dataset.view = "walk";
    ctx.setCleanup(
      renderDelve({
        ...ctx,
        day,
        mode,
        onDone: () => {
          ctx.setCleanup(null);
          document.body.dataset.view = "home";
          window.scrollTo(0, 0);
          renderLedgerFor(ctx, day, mode, { fresh: true });
        },
      }),
    );
  };
  // Practice and test runs skip the title; so does a walk already underway.
  if (mode === "replay" || mode === "test" || (rec && rec.actions.length)) return start();
  document.body.dataset.view = "title";
  ctx.setCleanup(renderGate({ ...ctx, day, mode, onStart: start }));
}

function paintSfx() {
  for (const b of document.querySelectorAll('[data-action="sfx"]')) {
    b.innerHTML = ico(sfx.muted ? "mute" : "sound", 20);
    b.setAttribute("aria-label", sfx.muted ? "Sound effects off" : "Sound effects on");
    b.title = sfx.muted ? "Sound is off" : "Sound is on";
  }
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "help") showHelp();
  if (action === "sfx") {
    sfx.toggle();
    paintSfx();
    sfx.tap();
  }
});
// Browsers only allow sound after a tap: wake the audio on the first one.
document.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
window.addEventListener("pq:paint-sfx", paintSfx);
window.addEventListener("hashchange", route);

for (const a of document.querySelectorAll('[data-nav="home"]')) a.innerHTML = ico("back", 20);
paintSfx();
flushPending();
route();
