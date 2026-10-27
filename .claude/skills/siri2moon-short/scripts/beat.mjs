#!/usr/bin/env node
// Phân tích một bài nhạc để cắt video đúng phách của nó.
//   node beat.mjs <file nhạc> [--seconds=<độ dài video>] [--start=<giây>] [--bpm=<số>]
// In JSON: bpm, firstBeat (giây của phách đầu), start (giây bắt đầu dùng trong video, luôn rơi
// đúng đầu ô nhịp), gain (nhân âm lượng để đoạn dùng đạt ~ -14 LUFS), duration.
//
// Cách làm (không thư viện): ffmpeg giải mã mono 22 kHz → đường bao onset (độ tăng năng lượng
// dải thấp + dải cao, mỗi bước 512 mẫu) → tự tương quan trong khoảng 80–170 BPM (ưu tiên quanh
// 120) → dò pha bằng tổng onset trên lưới phách → chấm điểm từng ô nhịp: năng lượng 8 ô sau
// + độ nhảy so với 4 ô trước (bắt "drop"), để video mở màn bằng đoạn sôi động nhất.

import { spawnSync } from 'node:child_process';
import { die, flagValue } from './lib.mjs';

export function analyze(file, { seconds = 40, start, bpm: forcedBpm } = {}) {
  const SR = 22050, HOP = 512;
  const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (dec.status !== 0) die(`không giải mã được ${file}: ${dec.stderr}`);
  const buf = dec.stdout;
  const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const duration = x.length / SR;
  const n = Math.floor(x.length / HOP);
  const hopS = HOP / SR;

  // Năng lượng dải thấp (kick, bass) và dải cao (hi-hat, snare) bằng lọc một cực đơn giản.
  const low = new Float32Array(n), high = new Float32Array(n), rms = new Float32Array(n);
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    let el = 0, eh = 0, e = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) {
      const v = x[j];
      lp += 0.035 * (v - lp);
      const hp = v - prev;
      prev = v;
      el += lp * lp;
      eh += hp * hp;
      e += v * v;
    }
    low[i] = Math.log1p(1000 * el);
    high[i] = Math.log1p(1000 * eh);
    rms[i] = Math.sqrt(e / HOP);
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, low[i] - low[i - 1]) * 1.5 + Math.max(0, high[i] - high[i - 1]);
  // Bỏ thành phần chậm để chỉ còn các cú đánh.
  const env = new Float32Array(n);
  let avg = 0;
  for (let i = 0; i < n; i++) {
    avg += 0.02 * (onset[i] - avg);
    env[i] = Math.max(0, onset[i] - avg);
  }

  // Tempo: tự tương quan, ưu tiên nhẹ quanh 120 BPM.
  let bpm = forcedBpm;
  if (!bpm) {
    let best = -1;
    for (let b = 80; b <= 170; b += 0.25) {
      const lag = 60 / b / hopS;
      let s = 0;
      for (let i = 0; i + 2 * lag < n; i += 1) {
        const a = env[i];
        if (a === 0) continue;
        s += a * (interp(env, i + lag) + 0.5 * interp(env, i + 2 * lag));
      }
      s *= Math.exp(-0.5 * (Math.log2(b / 120) / 0.6) ** 2);
      if (s > best) (best = s), (bpm = b);
    }
  }
  // Tinh chỉnh tempo và pha cùng lúc: lưới phách nào trúng nhiều cú đánh nhất trên cả bài.
  // Lệch 0,5 BPM là lệch 0,2 s sau 40 s, đủ để thấy cắt hụt nhịp. Phách chính được cộng,
  // nửa phách (hi-hat, bass nảy) bị trừ nhẹ để lưới không trượt sang phách nghịch.
  const comb = (b, p) => {
    const per = 60 / b / hopS;
    let s = 0;
    for (let t = p; t < n; t += per) s += interp(env, t) - 0.35 * interp(env, t + per / 2);
    return s;
  };
  let phase = 0, bestP = -Infinity;
  const coarse = bpm;
  for (let b = forcedBpm ?? coarse - 1.5; b <= (forcedBpm ?? coarse + 1.5); b += 0.02) {
    const per = 60 / b / hopS;
    for (let p = 0; p < per; p += 0.25) {
      const s = comb(b, p);
      if (s > bestP) (bestP = s), (phase = p), (bpm = b);
    }
  }
  const beatS = 60 / bpm;
  const barS = 4 * beatS;

  // Phách mạnh (nhịp 1): đoạn mới, drop, đổi hợp âm thường vào đúng nhịp 1, nên chọn vị trí
  // trong 4 phách có tổng "năng lượng tăng vọt" + cú đánh dải trầm lớn nhất.
  const beatAt = (k) => phase * hopS + k * beatS;
  const nBeats = Math.floor((duration - phase * hopS) / beatS);
  const beatEnergy = [], beatLow = [];
  for (let k = 0; k < nBeats; k++) {
    let e = 0, c = 0;
    for (let i = Math.floor(beatAt(k) / hopS); i < Math.floor(beatAt(k + 1) / hopS) && i < n; i++) (e += rms[i]), c++;
    beatEnergy.push(c ? e / c : 0);
    const i0 = Math.round(beatAt(k) / hopS);
    beatLow.push(Math.max(0, (low[i0 + 1] ?? 0) - (low[i0 - 2] ?? 0)));
  }
  const meanE = mean(beatEnergy) || 1, meanL = mean(beatLow) || 1;
  let down = 0, bestD = -Infinity;
  for (let o = 0; o < 4; o++) {
    let sc = 0;
    for (let k = o; k < nBeats; k += 4) sc += Math.max(0, beatEnergy[k] - (beatEnergy[k - 1] ?? beatEnergy[k])) / meanE + 0.5 * beatLow[k] / meanL;
    if (sc > bestD) (bestD = sc), (down = o);
  }
  const firstBeat = beatAt(down);

  // Chọn ô nhịp bắt đầu: năng lượng 8 ô sau + cú nhảy so với 4 ô trước, đủ chỗ cho cả video.
  const barEnergy = [];
  for (let t = firstBeat; t + barS <= duration; t += barS) {
    let s = 0, c = 0;
    for (let i = Math.floor(t / hopS); i < Math.floor((t + barS) / hopS); i++) (s += rms[i]), c++;
    barEnergy.push(s / c);
  }
  const fit = Math.floor((duration - seconds - firstBeat) / barS);
  let startBar = 0;
  if (start === undefined) {
    let bestS = -Infinity;
    for (let b = 0; b <= Math.max(0, fit); b++) {
      const next = mean(barEnergy.slice(b, b + 8));
      const before = b >= 2 ? mean(barEnergy.slice(Math.max(0, b - 4), b)) : next * 0.6;
      const s = next + 0.8 * Math.max(0, next - before);
      if (s > bestS) (bestS = s), (startBar = b);
    }
  } else {
    startBar = Math.max(0, Math.round((start - firstBeat) / barS));
  }
  const startS = firstBeat + startBar * barS;

  // Độ to đoạn được dùng → hệ số để đạt khoảng -14 LUFS (nhạc là thứ duy nhất có tiếng).
  const seg = spawnSync('ffmpeg', ['-nostats', '-ss', String(startS), '-t', String(Math.min(seconds, duration - startS)), '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = Number(seg.stderr.match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/)?.[1] ?? -14);
  const gain = Math.min(2, Math.max(0.2, 10 ** ((-14.5 - lufs) / 20)));

  return {
    file, bpm: Math.round(bpm * 100) / 100, firstBeat: round3(firstBeat), start: round3(startS),
    gain: round3(gain), lufs, duration: round3(duration), loops: startS + seconds > duration,
  };
}

const interp = (a, t) => {
  const i = Math.floor(t), f = t - i;
  return i + 1 < a.length ? a[i] * (1 - f) + a[i + 1] * f : 0;
};
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const round3 = (v) => Math.round(v * 1000) / 1000;

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) die('thiếu <file nhạc>. Dùng: node beat.mjs content/_assets/music/<bài>.mp3 --seconds=40');
  const num = (k) => (flagValue(k) !== undefined ? Number(flagValue(k)) : undefined);
  console.log(JSON.stringify(analyze(file, { seconds: num('seconds') ?? 40, start: num('start'), bpm: num('bpm') }), null, 2));
}
