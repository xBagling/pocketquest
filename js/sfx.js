// Small synthesized sounds (no audio files). Toggled with the speaker button.
import { store } from "./store.js";

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

let master = null;
function out() {
  const c = audio();
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.9;
    // Only catches peaks; everything below is left untouched.
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    master.connect(limiter).connect(c.destination);
  }
  return master;
}

function tone(freq, { type = "sine", start = 0, dur = 0.2, gain = 0.18, to = null, attack = 0.01 } = {}) {
  const c = audio();
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out());
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A soft wooden pluck, like a music box or a marimba bar. */
function pluck(freq, { start = 0, gain = 0.2, dur = 0.5 } = {}) {
  tone(freq, { start, dur, gain });
  tone(freq * 3, { start, dur: dur * 0.3, gain: gain * 0.2 });
}

/** A little bell: a coin or a chime. */
function bell(freq, { start = 0, gain = 0.12, dur = 0.8 } = {}) {
  tone(freq, { start, dur, gain, type: "sine" });
  tone(freq * 2.76, { start, dur: dur * 0.5, gain: gain * 0.35 });
  tone(freq * 5.4, { start, dur: dur * 0.25, gain: gain * 0.15 });
}

let noise = null;
function noiseBuffer(c) {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

function hiss({ start = 0, dur = 0.3, gain = 0.1, freq = 1200, q = 0.8, type = "bandpass", sweep = null, attack = 0.01 } = {}) {
  const c = audio();
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out());
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function pad(freq, { start = 0, dur = 1.4, gain = 0.06 } = {}) {
  const c = audio();
  const t = c.currentTime + start;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out());
  for (const detune of [-7, 6]) {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const play = (fn) => {
  if (store.sfxMuted) return;
  try {
    fn();
  } catch {}
};

// C major pentatonic, two octaves: every coin lands on a friendly note.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760];

export const sfx = {
  get muted() {
    return store.sfxMuted;
  },
  toggle() {
    store.sfxMuted = !store.sfxMuted;
    return store.sfxMuted;
  },
  /** Unlocks audio on the first tap (browsers need a gesture). */
  unlock() {
    if (store.sfxMuted) return;
    try {
      audio();
    } catch {}
  },
  tap: () => play(() => tone(880, { type: "triangle", dur: 0.06, gain: 0.05 })),
  type: () => play(() => tone(1400 + Math.random() * 300, { type: "triangle", dur: 0.025, gain: 0.02 })),
  /** Striking a match and a flame catching. */
  light: () =>
    play(() => {
      hiss({ dur: 0.18, gain: 0.12, freq: 3000, q: 0.6, type: "highpass" });
      hiss({ start: 0.12, dur: 0.9, gain: 0.08, freq: 500, sweep: 1400, q: 0.7, attack: 0.15 });
      pluck(392, { start: 0.3, gain: 0.08, dur: 0.8 });
      pluck(587.33, { start: 0.42, gain: 0.07, dur: 0.9 });
    }),
  /** An old wooden door. */
  door: () =>
    play(() => {
      hiss({ dur: 0.7, gain: 0.07, freq: 320, sweep: 180, q: 6 });
      tone(140, { type: "sawtooth", dur: 0.6, gain: 0.025, to: 95, attack: 0.1 });
      tone(90, { start: 0.62, dur: 0.18, gain: 0.12, to: 60 });
    }),
  /** Coins by tier: more coins and higher notes for rarer answers. */
  loot: (tier) =>
    play(() => {
      if (tier === "f") {
        tone(520, { type: "sine", dur: 0.45, gain: 0.12, to: 180 });
        tone(260, { type: "triangle", start: 0.05, dur: 0.4, gain: 0.05, to: 120 });
        return;
      }
      const n = { c: 1, s: 2, g: 3, e: 5, j: 7 }[tier] || 1;
      const base = { c: 0, s: 2, g: 3, e: 4, j: 5 }[tier] || 0;
      for (let i = 0; i < n; i++) bell(SCALE[Math.min(SCALE.length - 1, base + i)], { start: i * 0.07, gain: 0.1, dur: 0.6 + i * 0.05 });
      if (tier === "j") {
        [523.25, 659.25, 783.99].forEach((f) => pad(f, { start: 0.35, dur: 1.8, gain: 0.04 }));
        hiss({ start: 0.3, dur: 1.2, gain: 0.03, freq: 6000, q: 0.5, type: "highpass", attack: 0.3 });
      }
    }),
  /** A wrong answer: two soft falling notes. */
  miss: () =>
    play(() => {
      pluck(330, { gain: 0.16 });
      pluck(247, { start: 0.13, gain: 0.16, dur: 0.6 });
    }),
  /** You took a hit: a soft thump. */
  hit: () =>
    play(() => {
      tone(140, { dur: 0.35, gain: 0.3, to: 55 });
      hiss({ dur: 0.18, gain: 0.08, freq: 400, q: 0.7 });
    }),
  /** The helm or the clover saved you: a bright clang. */
  blocked: () =>
    play(() => {
      bell(1320, { gain: 0.08, dur: 0.6 });
      bell(1760, { start: 0.02, gain: 0.06, dur: 0.5 });
      tone(220, { dur: 0.12, gain: 0.08, to: 180 });
    }),
  /** Already said, or already eaten: a small blip, no harm done. */
  blip: () => play(() => tone(660, { type: "triangle", dur: 0.08, gain: 0.05, to: 520 })),
  /** A strike against the dragon. */
  strike: () =>
    play(() => {
      hiss({ dur: 0.25, gain: 0.1, freq: 1500, sweep: 5000, q: 0.8 });
      bell(988, { start: 0.12, gain: 0.1, dur: 0.6 });
    }),
  /** Old Ember wakes: a smoky rumble. */
  roar: () =>
    play(() => {
      hiss({ dur: 1.4, gain: 0.12, freq: 200, sweep: 90, q: 1.2, type: "lowpass", attack: 0.2 });
      tone(90, { type: "sawtooth", dur: 1.1, gain: 0.03, to: 60, attack: 0.25 });
    }),
  /** Last seconds of the lantern: a quiet heartbeat. */
  tick: () =>
    play(() => {
      tone(70, { dur: 0.12, gain: 0.14, to: 50 });
      tone(66, { start: 0.18, dur: 0.12, gain: 0.1, to: 48 });
    }),
  /** Choosing a relic. */
  relic: () => play(() => [0, 2, 4, 5, 7].forEach((i, k) => bell(SCALE[i], { start: k * 0.06, gain: 0.07, dur: 0.7 }))),
  /** The lantern goes out. */
  // A body hitting the floor, then little dizzy birdy chirps.
  ko: () =>
    play(() => {
      tone(150, { type: "sine", dur: 0.22, gain: 0.2, to: 60 });
      hiss({ dur: 0.18, gain: 0.05, freq: 400, q: 0.5 });
      [0, 1, 2].forEach((k) => tone(2100 + k * 90, { type: "sine", start: 0.35 + k * 0.16, dur: 0.07, gain: 0.03, to: 2600 }));
    }),
  snuff: () => play(() => hiss({ dur: 0.6, gain: 0.08, freq: 900, sweep: 300, q: 0.6, attack: 0.02 })),
  /** The vault opens: a fanfare, a warm chord and a round of applause. */
  vault: (power = 1) =>
    play(() => {
      [[392, 0], [523.25, 0.14], [659.25, 0.28], [783.99, 0.42]].forEach(([f, s]) => pluck(f, { start: s, gain: 0.16, dur: 0.5 }));
      [261.63, 329.63, 392, 523.25].forEach((f) => pad(f, { start: 0.55, dur: 2 + power, gain: 0.05 }));
      for (let i = 0; i < 12; i++) bell(SCALE[(i * 3) % SCALE.length], { start: 0.6 + i * 0.09, gain: 0.05, dur: 0.6 });
      const claps = Math.round(20 + power * 30);
      for (let i = 0; i < claps; i++) hiss({ start: 0.6 + Math.pow(Math.random(), 1.6) * (1.4 + power), dur: 0.05, gain: 0.08 + Math.random() * 0.08, freq: 900 + Math.random() * 1800, q: 1.2, attack: 0.002 });
    }),
  /** Escaped with the gold: relief, not triumph. */
  phew: () =>
    play(() => {
      pluck(659.25, { gain: 0.15, dur: 0.5 });
      pluck(783.99, { start: 0.16, gain: 0.15, dur: 0.9 });
      pad(392, { start: 0.16, dur: 1.2, gain: 0.035 });
    }),
  /** The run ends in a fall: gentle, never mocking. */
  fell: () =>
    play(() => {
      [[587.33, 0.1], [523.25, 0.4], [440, 0.7], [392, 1.0]].forEach(([f, s]) => pluck(f, { start: s, gain: 0.12, dur: 0.8 }));
      pad(196, { start: 1.0, dur: 1.8, gain: 0.04 });
    }),
  /** Leaves parting as you step onto a path. */
  rustle: () =>
    play(() => {
      for (let i = 0; i < 5; i++) hiss({ start: i * 0.07 + Math.random() * 0.03, dur: 0.14, gain: 0.05, freq: 2400 + Math.random() * 1600, q: 0.9, attack: 0.01 });
      pluck(523.25, { start: 0.28, gain: 0.05, dur: 0.5 });
    }),
  /** BLOOM: the glade bursts into flower, a shimmer of little bells. */
  bloom: () =>
    play(() => {
      [0, 2, 4, 5, 7, 9].forEach((i, k) => bell(SCALE[i], { start: k * 0.05, gain: 0.06, dur: 0.9 }));
      pad(523.25, { start: 0.1, dur: 1.4, gain: 0.03 });
      hiss({ start: 0.05, dur: 0.9, gain: 0.03, freq: 5000, q: 0.5, type: "highpass", attack: 0.2 });
    }),
  /** A creature is won over: a happy little trill. */
  happy: () =>
    play(() => {
      [0, 2, 4, 7].forEach((i, k) => pluck(SCALE[i + 1], { start: k * 0.07, gain: 0.09, dur: 0.45 }));
      bell(SCALE[8], { start: 0.3, gain: 0.05, dur: 0.6 });
    }),
  /** A moss spirit says hello. */
  spirit: () =>
    play(() => {
      bell(1567.98, { gain: 0.06, dur: 0.5 });
      bell(2093, { start: 0.09, gain: 0.05, dur: 0.6 });
    }),
  /** Pip burps a coin. */
  pip: () =>
    play(() => {
      tone(300, { type: "triangle", dur: 0.12, gain: 0.08, to: 520 });
      bell(1318.5, { start: 0.1, gain: 0.07, dur: 0.4 });
    }),
};
