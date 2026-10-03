#!/usr/bin/env node
// Rút một mẫu giọng sạch từ video/audio bất kỳ để đem đi nhân bản.
//
// Dùng: node voice-sample.mjs <file> [--out=tên.wav] [--at=137.5] [--dur=8] [--raw] [--scan]
//   --out   tên file đích trong content/_assets/voice/  (mặc định: theo tên nguồn)
//   --at    mốc giây lấy mẫu. Không có thì tự quét tìm đoạn giọng sạch nhất.
//   --dur   độ dài mẫu, mặc định 8 giây (VieNeu cần tối thiểu 3–5s)
//   --raw   không lọc, để nguyên. Mặc định có lọc — đo được là lọc khớp cao độ tốt hơn.
//   --scan  chỉ in bảng xếp hạng các đoạn rồi thoát, không ghi file.
//
// Vì sao phải lọc: nguồn hay có nhạc nền. Nhân bản từ giọng lẫn nhạc thì model
// học luôn cả nhạc vào timbre. Nhạc chủ yếu nằm ở dải trầm nên cắt dưới 95Hz là
// gỡ được phần lớn mà không đụng tới formant giọng nói.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { assetsDir, die, flagValue, hasFlag, info, ok, requireBin, warn } from './lib.mjs';

const SR = 16000;
const WIN_MS = 100;

const src = process.argv[2];
if (!src || src.startsWith('--')) die('thiếu <file>. Dùng: node voice-sample.mjs docs/refer/video.mp4');
const file = resolve(src);
if (!existsSync(file)) die(`không thấy ${file}`);

requireBin('ffmpeg', 'Cài bằng: brew install ffmpeg');

const dur = Number(flagValue('dur', 8));
const raw = hasFlag('raw');

/** Đường bao năng lượng của một dải tần, mỗi phần tử = 100ms. */
const envelope = (af) => {
  const pcm = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-af', af, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'],
    { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 },
  );
  const W = (SR * WIN_MS) / 1000;
  const n = Math.floor(pcm.length / 2);
  const out = [];
  for (let i = 0; i + W <= n; i += W) {
    let acc = 0;
    for (let k = 0; k < W; k++) {
      const v = pcm.readInt16LE((i + k) * 2);
      acc += v * v;
    }
    out.push(Math.sqrt(acc / W) + 1e-9);
  }
  return out;
};

info('đang quét…');
const speech = envelope('highpass=f=300,lowpass=f=3400'); // dải thoại
const bass = envelope('lowpass=f=200'); // nhạc nền chủ yếu ở đây
const n = Math.min(speech.length, bass.length);
if (n === 0) die('không đọc được audio từ file này');

const db = (v) => 20 * Math.log10(v);
const WIN = Math.round((dur * 1000) / WIN_MS);
const peak = Math.max(...speech);

/** Điểm một cửa sổ: giọng càng to hơn nhạc càng tốt, càng ít khoảng im càng tốt. */
const score = (s) => {
  let sumS = 0, sumB = 0, quiet = 0;
  for (let i = s; i < s + WIN; i++) {
    sumS += speech[i];
    sumB += bass[i];
    if (speech[i] < peak * 0.05) quiet++;
  }
  const ratio = db(sumS / WIN) - db(sumB / WIN);
  return { ratio, quiet: quiet / WIN, value: ratio - (quiet / WIN) * 25, at: (s * WIN_MS) / 1000 };
};

const all = [];
for (let s = 0; s + WIN < n; s += 5) all.push(score(s));
if (all.length === 0) die(`file chỉ dài ${(n * WIN_MS) / 1000}s, ngắn hơn --dur=${dur}`);
all.sort((a, b) => b.value - a.value);

if (hasFlag('scan')) {
  console.log('  giọng/nhạc   %im    bắt đầu');
  all.slice(0, 12).forEach((r) =>
    console.log(`   ${r.ratio >= 0 ? '+' : ''}${r.ratio.toFixed(1)}dB     ${(r.quiet * 100).toFixed(0).padStart(3)}%   ${r.at.toFixed(1)}s`),
  );
  process.exit(0);
}

const atFlag = flagValue('at', null);
const at = atFlag === null ? all[0].at : Number(atFlag);
const chosen = atFlag === null ? all[0] : all.find((r) => Math.abs(r.at - at) < 0.3) ?? null;

if (atFlag === null) info(`chọn đoạn ${at.toFixed(1)}s — giọng cao hơn nhạc ${chosen.ratio.toFixed(1)}dB`);

const outDir = join(assetsDir(), 'voice');
mkdirSync(outDir, { recursive: true });
const name = flagValue('out', `${basename(file, extname(file))}.wav`);
const out = join(outDir, name.endsWith('.wav') ? name : `${name}.wav`);

// afftdn khử nhiễu phổ nhẹ, loudnorm đưa về mức chuẩn để bộ mã hoá giọng
// không phải đoán biên độ. Không đụng tới dải 300–3400Hz vốn mang formant.
const filters = raw
  ? null
  : 'highpass=f=95,afftdn=nr=12:nf=-28,loudnorm=I=-18:TP=-2';

execFileSync('ffmpeg', [
  '-v', 'error',
  '-ss', String(at),
  '-t', String(dur),
  '-i', file,
  ...(filters ? ['-af', filters] : []),
  '-ac', '1',
  '-ar', '24000',
  out,
  '-y',
]);

ok(`content/_assets/voice/${basename(out)}  (${dur}s, ${raw ? 'không lọc' : 'đã lọc'})`);

if (chosen && chosen.ratio < 6)
  warn(`giọng chỉ to hơn nhạc ${chosen.ratio.toFixed(1)}dB — nguồn có nhạc nền khá to, giọng nhân bản sẽ kém giống. Nguồn không nhạc luôn cho kết quả tốt hơn hẳn.`);
if (dur < 3) warn('mẫu dưới 3 giây, VieNeu-TTS cần ít nhất 3–5 giây');

info('Dùng mẫu này:');
info(`  node tts.mjs <slug> --ref=${out}`);
info('hoặc ghi vào story.json:  "voiceRef": "../_assets/voice/' + basename(out) + '"');
