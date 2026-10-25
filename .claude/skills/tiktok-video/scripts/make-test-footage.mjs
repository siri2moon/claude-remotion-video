#!/usr/bin/env node
// Sinh footage GIẢ để chạy thử pipeline khi chưa quay thật.
// Mỗi scene một màu khác nhau, có 1s lặng ở hai đầu để jump-cut có việc mà làm.
// Dùng: node make-test-footage.mjs <slug> [--busy]
// Ra:   content/<dir>/raw/sN.mov  (ghi đè!)
//
// --busy thay nền màu trơn bằng hoa văn testsrc2 sặc sỡ, động, tương phản cao.
// Dùng khi cần kiểm tra chữ có đọc được không: nền trơn thì chữ nào cũng đọc
// được, nên nó KHÔNG chứng minh được gì về phụ đề trên footage quay thật.
//
// KHÔNG dùng cho video thật — đây chỉ là để verify pipeline chạy thông.

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, hasFlag, info, ok, readJson, requireBin, sh, slugArg } from './lib.mjs';
import { loadScript } from './kichban.mjs';

const COLORS = ['0x1B2A4A', '0x4A1B2A', '0x1B4A2A', '0x4A3A1B', '0x3A1B4A', '0x1B4A4A'];

requireBin('ffmpeg');
const busy = hasFlag('busy');
const slug = slugArg();
const dir = contentDir(slug);
const script = loadScript(dir);

const rawDir = join(dir, 'raw');
if (existsSync(rawDir)) {
  info(`content/${slug}/raw/ đã tồn tại — sẽ ghi đè bằng footage giả`);
}
mkdirSync(rawDir, { recursive: true });

script.scenes.forEach((scene, i) => {
  const dur = scene.endSec - scene.startSec;
  const speech = Math.max(1, dur - 2); // 1s lặng đầu + 1s lặng cuối
  const out = join(rawDir, `${scene.id}.mov`);

  const bg = busy
    ? `testsrc2=s=1080x1920:d=${dur}:r=30`
    : `color=c=${COLORS[i % COLORS.length]}:s=1080x1920:d=${dur}:r=30`;

  sh('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', bg,
    '-f', 'lavfi', '-i', `sine=f=${180 + i * 40}:d=${speech}`,
    '-af', `adelay=1000|1000,apad=whole_dur=${dur}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-t', String(dur),
    out,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
});

ok(`sinh ${script.scenes.length} clip giả vào content/${slug}/raw/`);
info('chạy tiếp preflight → extract-audio → transcribe --fallback → detect-cuts → build-props → render');
