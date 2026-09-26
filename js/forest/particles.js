// A living layer over a scene: fireflies (or sun-motes) wandering, sparkles rising from glowing
// things, petals and leaves drifting down, glints running along water, and a burst of sparkles on
// demand. Drawn on one canvas the size of the world, in the scene's own grid pixels, so it moves and
// zooms with the picture. Everything is slow and soft: this is the wood breathing, not fireworks.
import { SCENES } from "./art-data.js";

const TAU = Math.PI * 2;

/**
 * Start particles in a scene. world: the .sc-world element. opts: { night, sources: [[x, y, colour]]
 * sparkle sources in grid pixels, stream: [[x, y]] points along water }. Returns { burst, stop }.
 */
export function startParticles(world, { night = false, sources = [], stream = [] } = {}) {
  const id = world.closest(".scene")?.dataset.scene;
  const info = SCENES[id];
  if (!info) return { burst() {}, stop() {} };
  const canvas = document.createElement("canvas");
  canvas.className = "sc-fx";
  canvas.setAttribute("aria-hidden", "true");
  // Above the light, under whatever is on top of the scene (badges, cards, the pointing hand).
  const motes = world.querySelector(".sc-motes");
  if (motes) motes.after(canvas);
  else world.append(canvas);
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let u = 1; // CSS pixels per grid pixel
  const resize = () => {
    const w = world.clientWidth;
    const h = world.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    u = w / info.w;
  };
  resize();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(world);

  const rand = (a, b) => a + Math.random() * (b - a);
  const W = info.w;
  const H = info.h;
  // Fireflies by night, drifting motes of sunlight by day.
  const flies = Array.from({ length: night ? 30 : 20 }, () => ({
    x: rand(0, W), y: rand(18, H - 10), a: rand(0, TAU), v: rand(1.5, 3.5), ph: rand(0, TAU), f: rand(0.6, 1.4),
    c: night ? (Math.random() < 0.75 ? "228,255,138" : "143,255,208") : Math.random() < 0.6 ? "255,246,216" : "255,226,150",
  }));
  const PETALS = ["244,168,192", "255,224,234", "255,176,90", "143,214,122", "250,210,120"];
  const newPetal = (top) => ({ x: rand(0, W), y: top ? rand(-20, -2) : rand(0, H), v: rand(2.5, 5), sw: rand(2, 5), ph: rand(0, TAU), r: rand(0, TAU), vr: rand(-1.2, 1.2), c: PETALS[Math.floor(Math.random() * PETALS.length)] });
  const petals = Array.from({ length: 9 }, () => newPetal(false));
  const sparks = [];
  const glints = [];
  let spawn = 0;
  let glintT = 0;

  const star = (x, y, size, alpha, rgb) => {
    // A pixel sparkle: a bright core, and arms when it's at its brightest.
    const px = Math.round(x) * u;
    const py = Math.round(y) * u;
    ctx.fillStyle = `rgba(${rgb},${(alpha * 0.22).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px + u / 2, py + u / 2, u * (1.6 + size), 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fillRect(px, py, u, u);
    if (size > 0.6 && alpha > 0.5) {
      ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.8).toFixed(3)})`;
      ctx.fillRect(px - u, py, u, u);
      ctx.fillRect(px + u, py, u, u);
      ctx.fillRect(px, py - u, u, u);
      ctx.fillRect(px, py + u, u, u);
    }
  };
  const hex = (c) => {
    const n = parseInt(c.replace("#", ""), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };

  function step(dt, t) {
    for (const f of flies) {
      f.a += (Math.sin(t * 0.4 + f.ph) * 0.9 + (Math.random() - 0.5) * 0.6) * dt;
      f.x += Math.cos(f.a) * f.v * dt;
      f.y += Math.sin(f.a) * f.v * 0.6 * dt;
      if (f.x < -4) f.x = W + 3;
      if (f.x > W + 4) f.x = -3;
      if (f.y < 16) f.a = Math.abs(f.a);
      if (f.y > H - 8) f.a = -Math.abs(f.a);
    }
    for (const p of petals) {
      p.y += p.v * dt;
      p.r += p.vr * dt;
      if (p.y > H + 4) Object.assign(p, newPetal(true));
    }
    spawn += dt * sources.length * 1.4;
    while (spawn > 1 && sources.length) {
      spawn -= 1;
      const [sx, sy, col] = sources[Math.floor(Math.random() * sources.length)];
      sparks.push({ x: sx + rand(-4, 4), y: sy + rand(-3, 2), vy: -rand(3, 7), vx: rand(-1, 1), life: 0, max: rand(1.6, 3), c: hex(col), s: rand(0, 1) });
    }
    glintT += dt;
    if (stream.length && glintT > 0.18) {
      glintT = 0;
      const i = Math.floor(Math.random() * (stream.length - 1));
      const [ax, ay] = stream[i];
      const [bx, by] = stream[i + 1];
      const k = Math.random();
      glints.push({ x: ax + (bx - ax) * k, y: ay + (by - ay) * k + rand(-2, 2), life: 0, max: rand(0.6, 1.1) });
    }
    for (const list of [sparks, glints])
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.vy) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin((p.life + p.s) * 3) * 0.8) * dt;
          p.vy *= 1 - 0.4 * dt;
        }
        if (p.life > p.max) list.splice(i, 1);
      }
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const f of flies) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * f.f + f.ph)) ** 2;
      star(f.x, f.y, night ? 0.9 : 0.4, a * (night ? 1 : 0.7), f.c);
    }
    for (const p of petals) {
      const x = (p.x + Math.sin(t * 0.8 + p.ph) * p.sw) * u;
      const y = p.y * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.r);
      ctx.fillStyle = `rgba(${p.c},0.85)`;
      ctx.fillRect(-u, -u / 2, u * 2, u);
      ctx.restore();
    }
    for (const p of sparks) {
      const k = p.life / p.max;
      star(p.x, p.y, p.s, Math.sin(Math.PI * k) * 0.95, p.c);
    }
    for (const g of glints) star(g.x, g.y, 1, Math.sin((Math.PI * g.life) / g.max) * 0.9, "226,246,255");
  }

  let raf = 0;
  let last = 0;
  let stopped = false;
  const loop = (now) => {
    if (stopped || !canvas.isConnected) return stop();
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    step(dt, t);
    draw(t);
    raf = requestAnimationFrame(loop);
  };
  if (still) draw(0);
  else raf = requestAnimationFrame(loop);

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    canvas.remove();
  }
  return {
    /** A soft burst of sparkles at a spot, in grid pixels. */
    burst(x, y, color = "#ffe7a0") {
      if (still) return;
      for (let i = 0; i < 22; i++) {
        const a = rand(0, TAU);
        const v = rand(3, 10);
        sparks.push({ x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 0, max: rand(0.7, 1.4), c: hex(color), s: rand(0.4, 1) });
      }
    },
    stop,
  };
}

/**
 * Particles for a painted scene (the illustrated fork). Everything is in the painting's own pixels
 * (the world); view() says where the world is on screen: { s: scale, tx, ty }. The canvas covers
 * the scene window at screen resolution, so it stays sharp and cheap however big the painting is.
 * sparks: { img, list: [[x, y, w, h, sheetX, sheetY]] } — the scene's own sparkles, cut from the
 * painting: they twinkle and drift in small loops where the artist put them.
 */
export function startArtParticles(canvas, { view, sparks = null, stream = [], sources = [], night = true, area = { x0: 520, y0: 60, x1: 1540, y1: 1500 }, flies: nFlies = 26, petals: nPetals = 10 } = {}) {
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const P = 4; // one pixel of the painting's pixel art is about 4 of its image pixels
  const rand = (a, b) => a + Math.random() * (b - a);
  let W = 0;
  let H = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * d);
    canvas.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  resize();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  const sheet = sparks ? Object.assign(new Image(), { src: sparks.img }) : null;
  const twinkles = (sparks?.list || []).map(([x, y, w, h, sx, sy]) => ({ x, y, w, h, sx, sy, ph: rand(0, TAU), f: rand(0.5, 1.4), r: rand(3, 9) }));
  // The world's box, for wandering things.
  const box = () => area;
  const b0 = box();
  const flies = Array.from({ length: nFlies }, () => ({ x: rand(b0.x0, b0.x1), y: rand(b0.y0, b0.y1), a: rand(0, TAU), v: rand(10, 22), ph: rand(0, TAU), f: rand(0.6, 1.4), c: Math.random() < 0.7 ? "228,255,138" : "143,255,208" }));
  const PETALS = ["244,168,192", "255,224,234", "255,176,90", "143,214,122", "196,160,255"];
  const newPetal = (top) => ({ x: rand(b0.x0, b0.x1), y: top ? rand(b0.y0 - 80, b0.y0) : rand(b0.y0, b0.y1), v: rand(14, 26), sw: rand(8, 20), ph: rand(0, TAU), r: rand(0, TAU), vr: rand(-1.2, 1.2), c: PETALS[Math.floor(Math.random() * PETALS.length)] });
  const petals = Array.from({ length: nPetals }, () => newPetal(false));
  const rise = [];
  const glints = [];
  let spawn = 0;
  let glintT = 0;
  const pt = (x, y, v) => [x * v.s + v.tx, y * v.s + v.ty];

  function dot(v, x, y, size, alpha, rgb) {
    const [sx, sy] = pt(x, y, v);
    const u = Math.max(1.5, P * v.s * size);
    ctx.fillStyle = `rgba(${rgb},${(alpha * 0.25).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, u * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fillRect(Math.round(sx - u / 2), Math.round(sy - u / 2), Math.ceil(u), Math.ceil(u));
    if (size >= 1 && alpha > 0.55) {
      ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.7).toFixed(3)})`;
      ctx.fillRect(Math.round(sx - u * 1.5), Math.round(sy - u / 2), Math.ceil(u), Math.ceil(u));
      ctx.fillRect(Math.round(sx + u / 2), Math.round(sy - u / 2), Math.ceil(u), Math.ceil(u));
      ctx.fillRect(Math.round(sx - u / 2), Math.round(sy - u * 1.5), Math.ceil(u), Math.ceil(u));
      ctx.fillRect(Math.round(sx - u / 2), Math.round(sy + u / 2), Math.ceil(u), Math.ceil(u));
    }
  }
  const hex = (c) => {
    const n = parseInt(c.replace("#", ""), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };

  function step(dt, t) {
    const b = box();
    for (const f of flies) {
      f.a += (Math.sin(t * 0.4 + f.ph) * 0.9 + (Math.random() - 0.5) * 0.6) * dt;
      f.x += Math.cos(f.a) * f.v * dt;
      f.y += Math.sin(f.a) * f.v * 0.6 * dt;
      if (f.x < b.x0) f.a = 0;
      if (f.x > b.x1) f.a = Math.PI;
      if (f.y < b.y0) f.a = Math.abs(f.a);
      if (f.y > b.y1) f.a = -Math.abs(f.a);
    }
    for (const p of petals) {
      p.y += p.v * dt;
      p.r += p.vr * dt;
      if (p.y > b.y1) Object.assign(p, newPetal(true));
    }
    spawn += dt * sources.length * 1.2;
    while (spawn > 1 && sources.length) {
      spawn -= 1;
      const [sx, sy, col] = sources[Math.floor(Math.random() * sources.length)];
      rise.push({ x: sx + rand(-18, 18), y: sy + rand(-10, 8), vy: -rand(14, 30), vx: rand(-4, 4), life: 0, max: rand(1.6, 3), c: hex(col), s: rand(0.5, 1.1) });
    }
    glintT += dt;
    if (stream.length > 1 && glintT > 0.15) {
      glintT = 0;
      const i = Math.floor(Math.random() * (stream.length - 1));
      const [ax, ay] = stream[i];
      const [bx, by] = stream[i + 1];
      const k = Math.random();
      glints.push({ x: ax + (bx - ax) * k + rand(-8, 8), y: ay + (by - ay) * k + rand(-6, 6), life: 0, max: rand(0.6, 1.1) });
    }
    for (const list of [rise, glints])
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.vy) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin((p.life + p.s) * 3) * 3) * dt;
          p.vy *= 1 - 0.35 * dt;
        }
        if (p.life > p.max) list.splice(i, 1);
      }
  }

  function draw(t) {
    const v = view();
    ctx.clearRect(0, 0, W, H);
    if (sheet?.complete)
      for (const s of twinkles) {
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * s.f + s.ph)) ** 2;
        const [x, y] = pt(s.x + Math.sin(t * 0.5 + s.ph) * s.r * 0.4, s.y + Math.cos(t * 0.4 + s.ph) * s.r * 0.3, v);
        ctx.globalAlpha = a;
        ctx.drawImage(sheet, s.sx, s.sy, s.w, s.h, Math.round(x), Math.round(y), s.w * v.s, s.h * v.s);
      }
    ctx.globalAlpha = 1;
    for (const f of flies) {
      const a = 0.3 + 0.7 * Math.max(0, Math.sin(t * f.f + f.ph)) ** 2;
      dot(v, f.x, f.y, 0.9, a, f.c);
    }
    for (const p of petals) {
      const [x, y] = pt(p.x + Math.sin(t * 0.8 + p.ph) * p.sw, p.y, v);
      const u = Math.max(1.5, P * v.s);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.r);
      ctx.fillStyle = `rgba(${p.c},0.85)`;
      ctx.fillRect(-u, -u / 2, u * 2, u);
      ctx.restore();
    }
    for (const p of rise) dot(v, p.x, p.y, p.s, Math.sin((Math.PI * p.life) / p.max) * 0.95, p.c);
    for (const g of glints) dot(v, g.x, g.y, 1, Math.sin((Math.PI * g.life) / g.max) * 0.85, "226,246,255");
  }

  let raf = 0;
  let last = 0;
  let stopped = false;
  const loop = (now) => {
    if (stopped || !canvas.isConnected) return stop();
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    step(dt, t);
    draw(t);
    raf = requestAnimationFrame(loop);
  };
  if (still) sheet?.addEventListener("load", () => draw(0));
  else raf = requestAnimationFrame(loop);
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
  }
  return {
    burst(x, y, color = "#ffe7a0") {
      if (still) return;
      for (let i = 0; i < 24; i++) {
        const a = rand(0, TAU);
        const sp = rand(20, 60);
        rise.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0, max: rand(0.7, 1.4), c: hex(color), s: rand(0.6, 1.1) });
      }
    },
    redraw: () => still && draw(0),
    stop,
  };
}
