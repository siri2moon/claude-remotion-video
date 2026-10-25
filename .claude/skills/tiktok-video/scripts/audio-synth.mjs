#!/usr/bin/env node
// Tổng hợp nhạc nền + SFX bằng code, không cần tải gì, không vướng bản quyền.
// Ghi vào content/_assets/{bgm,sfx}/<tên>.mp3. File user tự bỏ vào luôn được ưu tiên:
// ensureMusic/ensureSfx chỉ sinh khi file CHƯA có.
//
// Dùng tay:
//   node audio-synth.mjs --list                 liệt kê tên hợp lệ
//   node audio-synth.mjs --all [--force]        sinh tất cả (--force: ghi đè cả file đã có)
//   node audio-synth.mjs lofi record-scratch    sinh từng cái
//
// Không có thư viện DSP nào ở đây — chỉ sin, nhiễu, bộ lọc biquad và Karplus-Strong.
// Nhạc nghe "đủ dùng" chứ không mượt như nhạc thật; với hài vô tri thì hơi quê lại hợp.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assetsDir, sh } from './lib.mjs';

const SR = 44100;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Tiện ích DSP
// ---------------------------------------------------------------------------

/** PRNG có seed — cùng tên thì sinh ra cùng một file, chạy lại không đổi tiếng. */
const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

/** Cộng `src` vào `dst` tại thời điểm `atSec`, nhân `gain`. */
const mix = (dst, src, atSec, gain = 1) => {
  const off = Math.round(atSec * SR);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
};

/** Biquad RBJ. type: lowpass | highpass | bandpass. Trả về hàm xử lý từng mẫu. */
const biquad = (type, freq, q = 0.707) => {
  let b0, b1, b2, a1, a2;
  const set = (f) => {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    if (type === 'lowpass') {
      b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0;
    } else if (type === 'highpass') {
      b0 = (1 + cs) / 2 / a0; b1 = -(1 + cs) / a0; b2 = b0;
    } else {
      b0 = al / a0; b1 = 0; b2 = -al / a0;
    }
    a1 = (-2 * cs) / a0;
    a2 = (1 - al) / a0;
  };
  set(freq);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const run = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  run.set = set;
  return run;
};

const filterBuf = (b, type, freq, q) => {
  const f = biquad(type, freq, q);
  for (let i = 0; i < b.length; i++) b[i] = f(b[i]);
  return b;
};

/** Đưa đỉnh về `peak` (mặc định -1 dBFS). */
const normalizePeak = (b, peak = 0.89) => {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
  return b;
};

/** Đưa RMS về `db` rồi nén mềm bằng tanh để không vỡ tiếng. */
const normalizeRms = (b, db = -18) => {
  let s = 0;
  for (const v of b) s += v * v;
  const rms = Math.sqrt(s / b.length) || 1;
  const g = 10 ** (db / 20) / rms;
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * g * 1.2) / 1.2;
  return b;
};

/** Phần đuôi vượt quá `loopSec` (tiếng vang, nốt ngân) gập về đầu để lặp không bị hụt. */
const foldLoop = (b, loopSec) => {
  const n = Math.round(loopSec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < b.length; i++) out[i % n] += b[i];
  return out;
};

// ---------------------------------------------------------------------------
// Nhạc cụ
// ---------------------------------------------------------------------------

/** Electric piano kiểu Rhodes: FM tỉ lệ 1:1, độ sáng tắt dần + tiếng "tine" cao. */
const rhodes = (freq, dur, vel = 0.5, detune = 0) => {
  const f = freq * (1 + detune);
  const b = buf(dur + 0.6);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 1.6) * (t > dur ? Math.exp(-(t - dur) * 9) : 1);
    const idx = 0.25 + 1.4 * Math.exp(-t * 6);
    const tine = 0.12 * Math.sin(TAU * f * 7 * t) * Math.exp(-t * 18);
    const trem = 1 + 0.08 * Math.sin(TAU * 4.5 * t);
    b[i] = (Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) + tine) * env * vel * trem;
  }
  return b;
};

/** Dây gảy Karplus-Strong — guitar, pizzicato. `bright` 0..1. */
const pluck = (freq, dur, vel = 0.5, bright = 0.5, seed = 1) => {
  const r = rng(seed);
  const n = Math.max(2, Math.round(SR / freq));
  const ring = new Float32Array(n);
  for (let i = 0; i < n; i++) ring[i] = r();
  const b = buf(dur + 0.3);
  const damp = 0.5 - 0.004 * (1 - bright);
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const nxt = (p + 1) % n;
    const v = ring[p];
    ring[p] = (v + ring[nxt]) * damp * 0.998;
    p = nxt;
    b[i] = v * vel * (t > dur ? Math.exp(-(t - dur) * 12) : 1);
  }
  return filterBuf(b, 'lowpass', 1200 + 5000 * bright);
};

/** Organ / pad: vài hoạ âm sin, attack chậm. Dùng cho waltz. */
const organ = (freq, dur, vel = 0.3) => {
  const b = buf(dur + 0.25);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.03) * (t > dur ? Math.exp(-(t - dur) * 14) : 1);
    const vib = 1 + 0.003 * Math.sin(TAU * 5.5 * t);
    const x = TAU * freq * vib * t;
    b[i] = (Math.sin(x) + 0.45 * Math.sin(2 * x) + 0.2 * Math.sin(3 * x) + 0.1 * Math.sin(4 * x)) * env * vel;
  }
  return b;
};

/** Chuông FM (tỉ lệ không nguyên → tiếng kim loại). */
const bell = (freq, dur, vel = 0.4, ratio = 3.5) => {
  const b = buf(dur);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.002) * Math.exp(-t * (3 / dur));
    const idx = 2.2 * Math.exp(-t * 3);
    b[i] = Math.sin(TAU * freq * t + idx * Math.sin(TAU * freq * ratio * t)) * env * vel;
  }
  return b;
};

/** Bass synth: răng cưa qua lowpass cộng hưởng có envelope — tiếng bass funky "nảy". */
const synthBass = (freq, dur, vel = 0.6) => {
  const b = buf(dur + 0.05);
  const lp = biquad('lowpass', 800, 4);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph = (ph + freq / SR) % 1;
    const saw = 2 * ph - 1;
    const sq = ph < 0.5 ? 1 : -1;
    lp.set(180 + 2200 * Math.exp(-t * 22));
    const env = Math.min(1, t / 0.003) * (t < dur ? Math.exp(-t * 3) : Math.exp(-dur * 3) * Math.exp(-(t - dur) * 60));
    b[i] = Math.tanh(lp(0.6 * saw + 0.4 * sq) * 1.5) * env * vel;
  }
  return b;
};

/** Clav: xung hẹp tắt nhanh, cắt trầm — tiếng "chặt" của funk. */
const clav = (freq, vel = 0.25) => {
  const b = buf(0.18);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph = (ph + freq / SR) % 1;
    b[i] = (ph < 0.18 ? 1 : -0.22) * Math.exp(-t * 26) * vel;
  }
  return filterBuf(filterBuf(b, 'highpass', 500), 'lowpass', 4500);
};

const sineBass = (freq, dur, vel = 0.5) => {
  const b = buf(dur + 0.05);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.01) * (t < dur ? Math.exp(-t * 1.2) : Math.exp(-(t - dur) * 30));
    b[i] = (Math.sin(TAU * freq * t) + 0.15 * Math.sin(TAU * 2 * freq * t)) * env * vel;
  }
  return b;
};

const kick = (vel = 0.9, len = 0.4, f0 = 120, f1 = 45) => {
  const b = buf(len);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t * 30);
    ph += (TAU * f) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * (3 / len)) * vel + (t < 0.003 ? 0.3 * vel : 0);
  }
  return b;
};

const snare = (vel = 0.5, seed = 3) => {
  const r = rng(seed);
  const b = buf(0.25);
  const bp = biquad('bandpass', 1900, 0.8);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = (bp(r()) * 1.6 * Math.exp(-t * 18) + Math.sin(TAU * 185 * t) * 0.5 * Math.exp(-t * 35)) * vel;
  }
  return b;
};

const hat = (vel = 0.18, decay = 45, seed = 5) => {
  const r = rng(seed);
  const b = buf(0.12);
  const hp = biquad('highpass', 7000, 0.9);
  for (let i = 0; i < b.length; i++) b[i] = hp(r()) * Math.exp(-(i / SR) * decay) * vel;
  return b;
};

/** Tiếng rè đĩa than: nhiễu nền mỏng + những tiếng "lách tách" ngẫu nhiên. */
const vinyl = (sec, seed = 9) => {
  const r = rng(seed);
  const b = buf(sec);
  const lp = biquad('lowpass', 3000);
  for (let i = 0; i < b.length; i++) {
    // ~1.5 tiếng lách tách mỗi giây, đi qua lowpass cùng nhiễu nền để không chói.
    let v = r() * 0.012;
    if (Math.abs(r()) > 0.99997) v += r() * 0.5;
    b[i] = lp(v);
  }
  return b;
};

// ---------------------------------------------------------------------------
// Nhạc nền — mỗi bài là một vòng lặp liền mạch
// ---------------------------------------------------------------------------

const chordNotes = (root, intervals) => intervals.map((i) => root + i);

const MUSIC = {
  /** Lo-fi suy tư: 76 BPM, ii-V-I-vi, Rhodes + boom-bap swing + rè đĩa than. */
  lofi: () => {
    const bpm = 76;
    const beat = 60 / bpm;
    const bars = 16;
    const loop = bars * 4 * beat;
    const out = buf(loop + 2);
    const prog = [
      [50, 53, 57, 60, 64], // Dm9
      [43, 53, 59, 64], // G13
      [48, 52, 55, 59, 62], // Cmaj9
      [45, 55, 60, 64, 71], // Am9
    ];
    const r = rng(11);
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      const ch = prog[bar % 4];
      // Rải hợp âm chậm một chút như tay người, mỗi nốt lệch cao độ rất nhẹ (wow của băng cối).
      ch.slice(1).forEach((n, k) => mix(out, rhodes(midi(n), beat * 2.6, 0.26, r() * 0.003), t0 + k * 0.018));
      if (bar % 2 === 1) ch.slice(2).forEach((n, k) => mix(out, rhodes(midi(n), beat * 0.9, 0.16, r() * 0.003), t0 + beat * 2.5 + k * 0.015));
      mix(out, sineBass(midi(ch[0] - 12 < 28 ? ch[0] : ch[0] - 12), beat * 3.2, 0.42), t0);
      // Trống: kick 1 và 3&, snare 2 và 4, hat móc lửng (swing 0.6).
      mix(out, kick(0.6), t0);
      mix(out, kick(0.45), t0 + beat * 2.5);
      if (bar % 4 === 3) mix(out, kick(0.4), t0 + beat * 3.5);
      mix(out, snare(0.28), t0 + beat);
      mix(out, snare(0.28), t0 + beat * 3);
      for (let k = 0; k < 8; k++) {
        const sw = k % 2 ? beat * 0.6 : 0;
        mix(out, hat(k % 2 ? 0.07 : 0.11, 55, 20 + k), t0 + Math.floor(k / 2) * beat + sw);
      }
    }
    let mixd = foldLoop(out, loop);
    mixd = filterBuf(mixd, 'lowpass', 3400, 0.6);
    mix(mixd, vinyl(loop), 0, 1);
    return normalizeRms(mixd, -19);
  },

  /** Funky vô tri: 100 BPM, bass synth nảy, clav chặt nhịp lẻ, hat móc đôi. */
  funky: () => {
    const bpm = 100;
    const beat = 60 / bpm;
    const s16 = beat / 4;
    const bars = 16;
    const loop = bars * 4 * beat;
    const out = buf(loop + 1);
    // Bassline 1 ô nhịp = 16 nốt móc kép. null = nghỉ. Hai ô xen kẽ.
    const lines = [
      [40, null, 40, null, null, 43, null, 45, 40, null, null, 40, 47, null, 45, 43],
      [40, null, 40, 52, null, 43, null, 45, 47, null, 45, null, 43, 42, 40, null],
    ];
    const chords = [
      [56, 62, 66], // E9 không gốc
      [57, 62, 66], // A7sus-ish
    ];
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      const line = lines[bar % 2];
      line.forEach((n, k) => {
        if (n !== null) mix(out, synthBass(midi(n), s16 * 0.8, 0.75), t0 + k * s16);
      });
      const ch = chords[Math.floor(bar / 2) % 2];
      [2, 6, 7, 10, 14].forEach((k) => ch.forEach((n) => mix(out, clav(midi(n), 0.1), t0 + k * s16)));
      mix(out, kick(0.85, 0.3), t0);
      mix(out, kick(0.6, 0.3), t0 + 6 * s16);
      mix(out, kick(0.7, 0.3), t0 + 10 * s16);
      mix(out, snare(0.45), t0 + beat);
      mix(out, snare(0.45), t0 + beat * 3);
      if (bar % 4 === 3) mix(out, snare(0.18), t0 + 15 * s16);
      for (let k = 0; k < 16; k++) mix(out, hat(k % 4 === 2 ? 0.14 : 0.07, k % 4 === 2 ? 25 : 60, 40 + k), t0 + k * s16);
    }
    return normalizeRms(foldLoop(out, loop), -18);
  },

  /** Waltz trang trọng như phim tài liệu: 3/4, bùm-chát-chát, chuông giai điệu. */
  waltz: () => {
    const bpm = 156;
    const beat = 60 / bpm;
    const prog = [
      [48, [64, 67, 72]], // C
      [43, [65, 67, 71]], // G7
      [43, [65, 67, 71]],
      [48, [64, 67, 72]],
      [41, [65, 69, 72]], // F
      [48, [64, 67, 72]], // C
      [43, [65, 67, 71]], // G7
      [48, [64, 67, 72]], // C
    ];
    const melody = [76, 79, 77, 74, 77, 76, 74, 72];
    const bars = 16;
    const loop = bars * 3 * beat;
    const out = buf(loop + 2);
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 3 * beat;
      const [root, ch] = prog[bar % 8];
      mix(out, pluck(midi(root - 12), beat * 0.9, 0.6, 0.35, bar), t0);
      for (const k of [1, 2]) ch.forEach((n) => mix(out, organ(midi(n - 12), beat * 0.55, 0.07), t0 + k * beat));
      mix(out, bell(midi(melody[bar % 8]), beat * 3.2, 0.13), t0);
      if (bar % 2 === 1) mix(out, bell(midi(melody[(bar + 1) % 8] + 12), beat * 1.2, 0.05), t0 + beat * 2);
    }
    return normalizeRms(filterBuf(foldLoop(out, loop), 'lowpass', 6000), -19);
  },

  /** Lãng mạn ấm áp: 70 BPM, guitar rải hợp âm + pad mỏng. */
  romantic: () => {
    const bpm = 70;
    const beat = 60 / bpm;
    const prog = [
      [48, 55, 60, 64, 67], // C
      [45, 52, 57, 60, 64], // Am
      [41, 48, 53, 57, 60], // F
      [43, 50, 55, 59, 62], // G
    ];
    const pattern = [0, 2, 3, 4, 3, 2, 1, 2];
    const bars = 8;
    const loop = bars * 4 * beat;
    const out = buf(loop + 2);
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      const ch = prog[bar % 4];
      pattern.forEach((idx, k) =>
        mix(out, pluck(midi(ch[idx]), beat * 1.6, k === 0 ? 0.5 : 0.32, 0.55, bar * 8 + k), t0 + (k * beat) / 2),
      );
      ch.slice(2).forEach((n) => mix(out, organ(midi(n), beat * 3.8, 0.025), t0));
    }
    return normalizeRms(filterBuf(foldLoop(out, loop), 'lowpass', 5000), -20);
  },
};

// ---------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------

const SFX = {
  /** Đĩa than bị quẹt: băng thông lọc lia tới lia lui rồi dừng cụt. */
  'record-scratch': () => {
    const r = rng(101);
    const dur = 0.55;
    const b = buf(dur);
    const bp = biquad('bandpass', 800, 3);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      // ba lần đẩy-kéo, mỗi lần nhanh hơn
      const sweep = Math.abs(Math.sin(TAU * (t < 0.3 ? 3.3 : 6) * t));
      const f = 150 + 1900 * sweep;
      bp.set(f);
      ph += (TAU * f * 0.5) / SR;
      const saw = ((ph / TAU) % 1) * 2 - 1;
      b[i] = (bp(r()) * 2.2 + saw * 0.35) * sweep * (t > dur - 0.02 ? (dur - t) / 0.02 : 1);
    }
    return normalizePeak(b);
  },

  /** Dế kêu trong im lặng — hai con, lệch nhịp nhau. */
  crickets: () => {
    const dur = 3.2;
    const b = buf(dur);
    const chirp = (f) => {
      const c = buf(0.12);
      for (let i = 0; i < c.length; i++) {
        const t = i / SR;
        const pulse = Math.max(0, Math.sin(TAU * 32 * t)) ** 2;
        c[i] = Math.sin(TAU * f * t) * pulse * Math.sin((Math.PI * t) / 0.12);
      }
      return c;
    };
    for (let t = 0.05; t < dur - 0.2; t += 0.62) mix(b, chirp(4400), t, 0.5);
    for (let t = 0.33; t < dur - 0.2; t += 0.81) mix(b, chirp(4950), t, 0.32);
    return normalizePeak(b, 0.6);
  },

  /** "Cộp" — đặt ly, gõ bàn: thân trầm + tiếng gỗ. */
  thud: () => {
    const r = rng(7);
    const b = buf(0.3);
    const bp = biquad('bandpass', 900, 1.5);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = Math.sin(TAU * (70 + 60 * Math.exp(-t * 40)) * t) * Math.exp(-t * 22) + bp(r()) * 1.4 * Math.exp(-t * 70);
    }
    return normalizePeak(b);
  },

  /** Tích tắc đồng hồ, 4 giây. */
  'tick-tock': () => {
    const b = buf(4);
    const click = (f, seed) => {
      const r = rng(seed);
      const c = buf(0.05);
      const bp = biquad('bandpass', f, 6);
      for (let i = 0; i < c.length; i++) c[i] = bp(r()) * Math.exp(-(i / SR) * 120);
      return c;
    };
    for (let k = 0; k < 8; k++) mix(b, click(k % 2 ? 2200 : 3200, k + 1), k * 0.5);
    return normalizePeak(b, 0.7);
  },

  /** Tim đập thình thịch, 3 nhịp. */
  heartbeat: () => {
    const b = buf(2.8);
    const thump = (vel) => {
      const c = buf(0.25);
      for (let i = 0; i < c.length; i++) {
        const t = i / SR;
        c[i] = Math.sin(TAU * (55 + 25 * Math.exp(-t * 30)) * t) * Math.exp(-t * 16) * vel;
      }
      return c;
    };
    for (let k = 0; k < 3; k++) {
      mix(b, thump(1), k * 0.85);
      mix(b, thump(0.7), k * 0.85 + 0.24);
    }
    return normalizePeak(b);
  },

  /** "Tưng" — lò xo nảy, nhấn từng vế thoại vô tri. */
  boing: () => {
    const b = buf(0.6);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const f = 190 + 140 * (1 - Math.exp(-t * 8)) + 45 * Math.sin(TAU * 13 * t) * Math.exp(-t * 4);
      ph += (TAU * f) / SR;
      b[i] = (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * Math.min(1, t / 0.004) * Math.exp(-t * 6);
    }
    return normalizePeak(b, 0.8);
  },

  ding: () => normalizePeak(bell(1320, 1.6, 1, 3.5), 0.75),

  notification: () => {
    const b = buf(0.9);
    mix(b, bell(988, 0.5, 1, 2), 0);
    mix(b, bell(1319, 0.7, 1, 2), 0.13);
    return normalizePeak(b, 0.7);
  },

  pop: () => {
    const b = buf(0.12);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (350 + 900 * (t / 0.06))) / SR;
      b[i] = Math.sin(ph) * Math.exp(-t * 45);
    }
    return normalizePeak(b, 0.8);
  },

  swoosh: () => {
    const r = rng(33);
    const dur = 0.5;
    const b = buf(dur);
    const bp = biquad('bandpass', 500, 1.2);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const x = t / dur;
      bp.set(400 + 3600 * Math.sin(Math.PI * x));
      b[i] = bp(r()) * Math.sin(Math.PI * x) ** 2;
    }
    return normalizePeak(b, 0.8);
  },

  riser: () => {
    const r = rng(44);
    const dur = 2;
    const b = buf(dur);
    const hp = biquad('highpass', 300);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const x = t / dur;
      hp.set(300 + 5000 * x * x);
      ph += (TAU * (200 + 1000 * x * x)) / SR;
      b[i] = (hp(r()) * 0.6 + Math.sin(ph) * 0.3) * x * x;
    }
    return normalizePeak(b, 0.8);
  },

  boom: () => {
    const r = rng(55);
    const b = kick(1, 1.4, 70, 28);
    const lp = biquad('lowpass', 400);
    for (let i = 0; i < b.length; i++) b[i] += lp(r()) * 0.6 * Math.exp(-(i / SR) * 3);
    return normalizePeak(b);
  },

  /** Thở dài: nhiễu qua formant trượt xuống. */
  sigh: () => {
    const r = rng(66);
    const dur = 1.3;
    const b = buf(dur);
    const bp = biquad('bandpass', 1000, 2.5);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      bp.set(1300 - 600 * (t / dur));
      b[i] = bp(r()) * Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.25) * 2.4);
    }
    return normalizePeak(b, 0.6);
  },

  typing: () => {
    const r = rng(77);
    const b = buf(1.6);
    let t = 0.02;
    let k = 0;
    while (t < 1.5) {
      const c = buf(0.03);
      const bp = biquad('bandpass', 2500 + 1500 * Math.abs(r()), 4);
      for (let i = 0; i < c.length; i++) c[i] = bp(r()) * Math.exp(-(i / SR) * 200);
      mix(b, c, t, 0.6 + 0.4 * Math.abs(r()));
      t += 0.07 + 0.09 * Math.abs(r());
      k++;
    }
    return normalizePeak(b, 0.6);
  },
};

export const MUSIC_NAMES = Object.keys(MUSIC);
export const SFX_NAMES = Object.keys(SFX);

// ---------------------------------------------------------------------------
// Ghi file
// ---------------------------------------------------------------------------

const writeWav = (path, samples) => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
};

const render = (kind, name, force) => {
  const table = kind === 'bgm' ? MUSIC : SFX;
  if (!table[name]) return null;
  const outDir = join(assetsDir(), kind);
  const out = join(outDir, `${name}.mp3`);
  if (existsSync(out) && !force) return out;
  mkdirSync(outDir, { recursive: true });
  const wav = join(tmpdir(), `synth-${kind}-${name}-${process.pid}.wav`);
  writeWav(wav, table[name]());
  sh('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ac', '2', '-b:a', '192k', out]);
  rmSync(wav, { force: true });
  return out;
};

/** Trả về đường dẫn mp3, sinh nếu chưa có. null nếu tên không tổng hợp được (và user cũng chưa bỏ file). */
export const ensureMusic = (name, force = false) => {
  const p = join(assetsDir(), 'bgm', `${name}.mp3`);
  if (existsSync(p) && !force) return p;
  return render('bgm', name, force);
};
export const ensureSfx = (name, force = false) => {
  const p = join(assetsDir(), 'sfx', `${name}.mp3`);
  if (existsSync(p) && !force) return p;
  return render('sfx', name, force);
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  if (args.includes('--list') || args.length === 0) {
    console.log(`nhạc nền: ${MUSIC_NAMES.join(', ')}`);
    console.log(`sfx:      ${SFX_NAMES.join(', ')}`);
    process.exit(0);
  }
  const names = args.includes('--all') ? [...MUSIC_NAMES, ...SFX_NAMES] : args.filter((a) => !a.startsWith('--'));
  for (const n of names) {
    const t = Date.now();
    const p = MUSIC[n] ? ensureMusic(n, force) : SFX[n] ? ensureSfx(n, force) : null;
    if (!p) {
      console.error(`ERROR  "${n}" không có trong danh sách. Xem --list.`);
      process.exitCode = 1;
      continue;
    }
    console.log(`OK     ${n} → ${p.replace(assetsDir(), 'content/_assets')} (${Date.now() - t}ms)`);
  }
}
