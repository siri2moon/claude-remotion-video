// Music and sound effects for the Lucifer short, synthesized in code (no samples, no licensing).
//   node lucifer-promo/music.mjs <out dir>
// Writes bgm.wav (a 100 BPM deep-house groove: lush 7th-chord pads, a plucked arpeggio, sidechained
// sub bass) and the SFX: whoosh, impact, shimmer, tick, pop.
//
// Timing: 100 BPM, so a beat is 0.6 s and a bar 2.4 s. The video cuts on beats.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const TAU = Math.PI * 2;
const BEAT = 0.6;
const BAR = BEAT * 4;
const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });

const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
};
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const stereo = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];

function biquad(type, freq, q = 0.707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f) => {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (type === 'lowpass') { b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + cs) / 2 / a0; b1 = -(1 + cs) / a0; b2 = b0; }
    else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
    a1 = (-2 * cs) / a0; a2 = (1 - al) / a0;
  };
  set(freq);
  const f = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  f.set = set;
  return f;
}

/** Schroeder reverb: parallel combs into series allpasses, one per channel with different lengths. */
function reverb([L, R], { mix = 0.25, size = 1, damp = 0.4 } = {}) {
  const run = (input, offset) => {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((n) => ({ buf: new Float32Array(Math.round((n + offset) * size)), i: 0, lp: 0 }));
    const aps = [556, 441, 341, 225].map((n) => ({ buf: new Float32Array(n + offset), i: 0 }));
    const wet = new Float32Array(input.length);
    for (let s = 0; s < input.length; s++) {
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.lp = y * (1 - damp) + c.lp * damp;
        c.buf[c.i] = input[s] * 0.015 + c.lp * 0.84;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        const y = -acc + b;
        a.buf[a.i] = acc + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        acc = y;
      }
      wet[s] = acc;
    }
    return wet;
  };
  const wl = run(L, 0), wr = run(R, 23);
  for (let s = 0; s < L.length; s++) {
    L[s] = L[s] * (1 - mix) + wl[s] * mix * 3;
    R[s] = R[s] * (1 - mix) + wr[s] * mix * 3;
  }
}

function writeWav(path, [L, R]) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
}

// ---------------------------------------------------------------------------
// The track
// ---------------------------------------------------------------------------

const BARS = 18;
const LENGTH = BARS * BAR + 2;
/** Drums play from bar 1 to the end card (bar 16.5 = 39.6 s). */
const DRUMS_FROM = BAR * 1, DRUMS_TO = 39.6;
// Fmaj7 · G6 · Am9 · Em7: bright, open, a little wistful.
const CHORDS = [
  { bass: 41, pad: [57, 60, 64, 65, 72] },
  { bass: 43, pad: [59, 62, 64, 67, 71] },
  { bass: 45, pad: [60, 64, 67, 71, 74] },
  { bass: 40, pad: [59, 62, 64, 67, 71] },
];

const pads = stereo(LENGTH), plucks = stereo(LENGTH), bass = stereo(LENGTH), drums = stereo(LENGTH);
const noise = rng(7);

// Pads: three detuned saws per note, slow attack, lowpass opening over the intro.
for (let bar = 0; bar < BARS; bar++) {
  const chord = CHORDS[bar % 4];
  const t0 = bar * BAR, dur = BAR + 0.25;
  for (const [k, note] of chord.pad.entries()) {
    for (const [v, det] of [-0.11, 0, 0.12].entries()) {
      const f = hz(note) * 2 ** (det / 12);
      const lp = biquad('lowpass', 1200);
      let ph = (k * 0.37 + v * 0.21) % 1;
      const pan = (v - 1) * 0.6;
      const start = Math.round(t0 * SR), n = Math.round(dur * SR);
      for (let i = 0; i < n; i++) {
        const t = i / SR, abs = t0 + t;
        if (i % 64 === 0) lp.set(abs < BAR * 2 ? 500 + (abs / (BAR * 2)) * 1300 : 1800 + 400 * Math.sin(abs * 0.4));
        ph += f / SR; ph -= Math.floor(ph);
        const env = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.3);
        const y = lp(2 * ph - 1) * env * 0.05;
        pads[0][start + i] += y * (1 - pan * 0.5);
        pads[1][start + i] += y * (1 + pan * 0.5);
      }
    }
  }
}

// Plucked arpeggio (Karplus-Strong), eighth notes, ping-ponged left and right.
const ARP = [0, 1, 2, 3, 4, 3, 2, 1];
for (let bar = 0; bar < BARS - 1; bar++) {
  const chord = CHORDS[bar % 4];
  for (let e = 0; e < 8; e++) {
    const t0 = bar * BAR + e * (BEAT / 2);
    if (t0 > 41) break;
    const note = chord.pad[ARP[e]] + 12;
    const period = Math.round(SR / hz(note));
    const line = new Float32Array(period).map(() => noise() * 0.5);
    const n = Math.round(1.1 * SR), start = Math.round(t0 * SR);
    const vel = (e % 2 === 0 ? 0.11 : 0.08) * (bar === 0 ? 0.7 : 1);
    const pan = e % 2 === 0 ? -0.35 : 0.35;
    let prev = 0;
    for (let i = 0; i < n && start + i < pads[0].length; i++) {
      const j = i % period;
      const y = line[j];
      line[j] = (y + prev) * 0.5 * 0.996;
      prev = y;
      plucks[0][start + i] += y * vel * (1 - pan);
      plucks[1][start + i] += y * vel * (1 + pan);
    }
  }
}

// Kick envelope, for drums and for sidechain pumping.
const kickTimes = [];
for (let t = DRUMS_FROM; t < DRUMS_TO - 0.01; t += BEAT) kickTimes.push(t);
kickTimes.unshift(0); // one soft hit under the opening impact
const duck = new Float32Array(pads[0].length).fill(1);
for (const t of kickTimes) {
  const s = Math.round(t * SR);
  for (let i = 0; i < 0.3 * SR && s + i < duck.length; i++) duck[s + i] = Math.min(duck[s + i], 0.35 + 0.65 * Math.min(1, i / SR / 0.28));
}

// Sub bass: root on the off-beat eighths, sine plus a little second harmonic.
for (let bar = 1; bar < BARS; bar++) {
  const f = hz(CHORDS[bar % 4].bass);
  for (let b = 0; b < 4; b++) {
    const t0 = bar * BAR + b * BEAT + BEAT / 2;
    if (t0 > DRUMS_TO) break;
    const s = Math.round(t0 * SR), n = Math.round(0.28 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 5);
      const y = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)) * env * 0.32;
      bass[0][s + i] += y;
      bass[1][s + i] += y;
    }
  }
}

// Drums.
for (const [k, t0] of kickTimes.entries()) {
  const s = Math.round(t0 * SR);
  for (let i = 0; i < 0.45 * SR; i++) {
    const t = i / SR;
    const f = 45 + 110 * Math.exp(-t * 28);
    const y = Math.sin(TAU * (45 * t + (110 / 28) * (1 - Math.exp(-t * 28)))) * Math.exp(-t * 7) * 0.55 * (k === 0 ? 0.8 : 1) + (i < 60 ? noise() * 0.1 : 0);
    void f;
    drums[0][s + i] += y;
    drums[1][s + i] += y;
  }
}
const hat = biquad('highpass', 7500);
for (let t = DRUMS_FROM + BEAT / 2; t < DRUMS_TO; t += BEAT) {
  const s = Math.round(t * SR);
  for (let i = 0; i < 0.07 * SR; i++) {
    const y = hat(noise()) * Math.exp(-(i / SR) * 60) * 0.16;
    drums[0][s + i] += y * 0.8;
    drums[1][s + i] += y;
  }
}
// Sixteenth shaker, very quiet, from bar 3 for motion.
const shaker = biquad('bandpass', 9000, 1.2);
for (let t = BAR * 3; t < DRUMS_TO; t += BEAT / 4) {
  const s = Math.round(t * SR);
  for (let i = 0; i < 0.04 * SR; i++) {
    const y = shaker(noise()) * Math.exp(-(i / SR) * 90) * 0.06;
    drums[0][s + i] += y;
    drums[1][s + i] += y * 0.7;
  }
}
const clap = biquad('bandpass', 1600, 0.9);
for (let t = BAR * 2 + BEAT; t < DRUMS_TO; t += BEAT * 2) {
  const s = Math.round(t * SR);
  for (const d of [0, 0.011, 0.023]) {
    const o = Math.round(d * SR);
    for (let i = 0; i < 0.16 * SR; i++) {
      const y = clap(noise()) * Math.exp(-(i / SR) * (d === 0.023 ? 18 : 60)) * 0.22;
      drums[0][s + o + i] += y;
      drums[1][s + o + i] += y;
    }
  }
}

reverb(pads, { mix: 0.3, size: 1.2, damp: 0.5 });
reverb(plucks, { mix: 0.32, size: 1.1, damp: 0.35 });
reverb(drums, { mix: 0.08, size: 0.7, damp: 0.5 });

const mixL = new Float32Array(pads[0].length), mixR = new Float32Array(pads[0].length);
for (let i = 0; i < mixL.length; i++) {
  const d = duck[i];
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (LENGTH - t) / 3));
  mixL[i] = (pads[0][i] * d + plucks[0][i] * (0.6 + 0.4 * d) + bass[0][i] * d + drums[0][i]) * fade;
  mixR[i] = (pads[1][i] * d + plucks[1][i] * (0.6 + 0.4 * d) + bass[1][i] * d + drums[1][i]) * fade;
}
writeWav(join(out, 'bgm.wav'), [mixL, mixR]);

// ---------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------

function sfx(name, sec, fn, verb) {
  const st = stereo(sec);
  fn(st);
  if (verb) reverb(st, verb);
  writeWav(join(out, `${name}.wav`), st);
}

sfx('whoosh', 1.0, ([L, R]) => {
  const bp = biquad('bandpass', 400, 1.4), n = rng(3);
  for (let i = 0; i < L.length; i++) {
    const t = i / SR, u = t / 0.7;
    if (i % 32 === 0) bp.set(300 + 3200 * Math.sin(Math.PI * Math.min(1, u)) ** 2);
    const env = u < 1 ? Math.sin(Math.PI * u) ** 1.5 : 0;
    const y = bp(n()) * env * 0.9;
    L[i] = y * (1 - u * 0.6);
    R[i] = y * (0.4 + u * 0.6);
  }
}, { mix: 0.2 });

sfx('impact', 3.0, ([L, R]) => {
  const n = rng(5), lp = biquad('lowpass', 900);
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const boom = Math.sin(TAU * (38 * t + (90 / 9) * (1 - Math.exp(-t * 9)))) * Math.exp(-t * 2.2);
    const hit = lp(n()) * Math.exp(-t * 14);
    const y = boom * 0.8 + hit * 0.7;
    L[i] = y; R[i] = y;
  }
}, { mix: 0.3, size: 1.4, damp: 0.3 });

sfx('shimmer', 3.2, ([L, R]) => {
  // A rising run of bell tones over a Cmaj9-ish cluster: the logo sting.
  const notes = [72, 76, 79, 83, 86, 88, 91];
  notes.forEach((note, k) => {
    const t0 = k * 0.07, s = Math.round(t0 * SR), f = hz(note), pan = (k / (notes.length - 1)) * 1.2 - 0.6;
    for (let i = 0; i < 2.4 * SR && s + i < L.length; i++) {
      const t = i / SR;
      const y = (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 6)) * Math.exp(-t * 2.4) * 0.12;
      L[s + i] += y * (1 - pan);
      R[s + i] += y * (1 + pan);
    }
  });
}, { mix: 0.45, size: 1.3, damp: 0.25 });

sfx('tick', 0.08, ([L, R]) => {
  const n = rng(11), hp = biquad('highpass', 2500);
  for (let i = 0; i < L.length; i++) {
    const y = hp(n()) * Math.exp(-(i / SR) * 120) * 0.6;
    L[i] = y; R[i] = y;
  }
});

sfx('pop', 0.4, ([L, R]) => {
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const y = Math.sin(TAU * (520 * t + 600 * t * t)) * Math.exp(-t * 22) * 0.7;
    L[i] = y; R[i] = y;
  }
}, { mix: 0.15 });

console.log(`wrote bgm.wav (${LENGTH.toFixed(1)} s) and 5 SFX to ${out}`);
