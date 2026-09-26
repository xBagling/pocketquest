// Coins, sparkles and embers on one canvas over the page. Cheap, and skipped when the player
// prefers reduced motion.
import { reducedMotion } from "./util.js";

let canvas = null;
let ctx = null;
let parts = [];
let raf = 0;
let last = 0;

const COLORS = {
  c: ["#d98a5b", "#f0b48a"],
  f: ["#c6b44e", "#e3d68a"],
  s: ["#d4dde9", "#ffffff"],
  g: ["#ffcf4d", "#fff3c4"],
  e: ["#ff6f91", "#ffd1dc"],
  j: ["#9ff0e0", "#c3a6ff", "#ffcf4d", "#ff9eb4"],
  warm: ["#ffd27a", "#ffb347", "#fff6d5"],
  night: ["#c3a6ff", "#7ee8d6", "#fff6d5"],
  dust: ["#cbb8a0", "#9d8a78", "#e9dccb"],
  bloom: ["#f4a8c0", "#ffe0ea", "#ffc0d4", "#fff6f8", "#8fffd0"],
};

function ensure() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  ctx = canvas.getContext("2d");
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener("resize", size);
}


function drawPart(p) {
  const a = p.home ? 1 : Math.min(1, p.life / p.fade);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  if (p.kind === "coin") {
    const squash = Math.abs(Math.cos(p.rot * 2));
    ctx.scale(0.35 + squash * 0.65, 1);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = "#1a1408";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "petal") {
    // A blossom petal, tumbling: squashed as it turns.
    ctx.scale(1, 0.35 + Math.abs(Math.sin(p.rot * 1.5)) * 0.65);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "star") {
    ctx.fillStyle = p.color;
    const s = p.size;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.3 : s;
      const ang = (i / 8) * Math.PI * 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function loop(t) {
  const dt = Math.min(0.05, (t - (last || t)) / 1000);
  last = t;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => (p.life -= dt) > 0 && !p.done);
  // Each homing target is measured once per frame, not once per coin.
  const rects = new Map();
  for (const p of parts) {
    if (p.home) {
      // Burst out, then fly home to the target, faster and faster.
      p.age += dt;
      if (p.age > p.hold) {
        let r = rects.get(p.home);
        if (!r) rects.set(p.home, (r = p.home.getBoundingClientRect()));
        const tx = r.left + r.width * 0.3;
        const ty = r.top + r.height / 2;
        p.k = Math.min(1, p.k + dt * 3.2);
        const pull = Math.min(1, dt * (4 + p.k * 16));
        p.x += (tx - p.x) * pull;
        p.y += (ty - p.y) * pull;
        p.size = Math.max(3.5, p.size - dt * 3);
        if (Math.hypot(tx - p.x, ty - p.y) < 10) {
          p.done = true;
          p.onArrive?.();
        }
        p.rot += p.spin * dt;
        drawPart(p);
        continue;
      }
    }
    p.vy += p.g * dt;
    p.vx *= 1 - p.drag * dt;
    p.vy *= 1 - p.drag * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    drawPart(p);
  }
  if (parts.length) raf = requestAnimationFrame(loop);
  else {
    raf = 0;
    last = 0;
  }
}

function add(list) {
  if (reducedMotion()) return;
  ensure();
  parts.push(...list);
  if (parts.length > 500) parts.splice(0, parts.length - 500);
  if (!raf) raf = requestAnimationFrame(loop);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** A burst from a point: coins for loot, stars for magic. */
export function burst(x, y, { tier = "g", count = 16, speed = 260, kind = "mix", gravity = 520, life = 1.4 } = {}) {
  const colors = COLORS[tier] || COLORS.warm;
  add(
    Array.from({ length: count }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const v = speed * (0.45 + Math.random() * 0.75);
      const k = kind === "mix" ? (Math.random() < 0.55 ? "coin" : "star") : kind;
      return { kind: k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, drag: 0.8, size: k === "coin" ? 5 + Math.random() * 3 : 3 + Math.random() * 5, color: pick(colors), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, life: life * (0.7 + Math.random() * 0.5), fade: 0.5 };
    }),
  );
}

/** Coins (or petals) raining from the top of the screen, for the hoard. */
export function rain({ tier = "g", count = 90, seconds = 2.4, kind = "mix" } = {}) {
  const colors = COLORS[tier] || COLORS.warm;
  add(
    Array.from({ length: count }, () => ({
      kind: kind === "mix" ? (Math.random() < 0.7 ? "coin" : "star") : kind,
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 60,
      vy: 120 + Math.random() * 160,
      g: 260,
      drag: 0.2,
      size: 5 + Math.random() * 4,
      color: pick(colors),
      rot: Math.random() * 6,
      spin: (Math.random() - 0.5) * 10,
      life: seconds + Math.random() * 1.5,
      fade: 0.8,
    })),
  );
}

/** A soft drift of motes rising from a point: a charm, a jewel, the lantern going out. */
export function drift(x, y, { tier = "night", count = 14, spread = 60 } = {}) {
  const colors = COLORS[tier] || COLORS.night;
  add(
    Array.from({ length: count }, () => ({
      kind: Math.random() < 0.5 ? "star" : "dot",
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread * 0.4,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 60,
      g: -10,
      drag: 0.4,
      size: 1.5 + Math.random() * 3,
      color: pick(colors),
      rot: 0,
      spin: (Math.random() - 0.5) * 3,
      life: 1.4 + Math.random() * 1.2,
      fade: 0.8,
    })),
  );
}

/** Centre of an element on screen. */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

export function clearFx() {
  parts = [];
}

/**
 * Coins that burst out of a point and then fly home into an element (the gold counter).
 * onArrive runs once per coin as it lands, so the counter can tick up in step.
 */
export function flyTo(x, y, target, { tier = "g", count = 8, onArrive, onDone } = {}) {
  if (reducedMotion() || !target) {
    onDone?.();
    return;
  }
  const colors = COLORS[tier] || COLORS.warm;
  let left = count;
  add(
    Array.from({ length: count }, (_, i) => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const v = 160 + Math.random() * 160;
      return {
        kind: "coin", home: target, age: 0, hold: 0.28 + i * 0.035 + Math.random() * 0.08, k: 0,
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 380, drag: 2.2,
        size: 6 + Math.random() * 2.5, color: colors[i % colors.length], rot: Math.random() * 6, spin: 9 + Math.random() * 6,
        life: 3, fade: 0.3,
        onArrive: () => {
          onArrive?.(i);
          if (--left === 0) onDone?.();
        },
      };
    }),
  );
}
