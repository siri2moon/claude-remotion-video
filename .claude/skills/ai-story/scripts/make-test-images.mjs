#!/usr/bin/env node
// Ảnh giả để kiểm pipeline mà không phải chờ hàng tiếng sinh ảnh thật.
// Dùng: node make-test-images.mjs <slug> [--force]
//
// Mỗi cảnh ra một ảnh màu khác nhau, kèm dãy ô vuông trắng đếm được ở góc trên
// (cảnh s03 có 3 ô) và một khối lệch tâm để nhìn ra Ken Burns đang phóng về đâu.
// KHÔNG dùng drawtext — nhiều bản ffmpeg của Homebrew biên dịch thiếu freetype.
//
// ⚠️ Ghi đè images/. Đừng chạy khi đã sinh ảnh thật.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, hasFlag, info, loadStory, ok, requireBin, slugArg, warn } from './lib.mjs';

const WIDTH = 1216;
const HEIGHT = 784;

// Màu đủ khác nhau để nhìn phát biết đã sang ảnh mới, nhưng vẫn trầm cho hợp nền.
const COLORS = [
  '0x8C6B4F', '0x5E7A52', '0x7A5E6B', '0x4F6B8C', '0x8C7A4F', '0x5E526B',
  '0x6B8C5E', '0x8C4F5E', '0x4F8C7A', '0x6B5E52', '0x52708C', '0x8C5E4F',
];

const dir = slugArg();
const story = loadStory(dir);
const outDir = join(contentDir(dir), 'images');

requireBin('ffmpeg', 'Cài bằng: brew install ffmpeg');

const real = story.scenes.filter((s) => existsSync(join(outDir, `${s.id}.png`)));
if (real.length && !hasFlag('force'))
  die(`đã có ${real.length} ảnh trong images/. Thêm --force nếu chắc chắn muốn ghi đè.`);
if (real.length) warn(`ghi đè ${real.length} ảnh đang có`);

mkdirSync(outDir, { recursive: true });

story.scenes.forEach((scn, i) => {
  const boxes = [];
  // Dãy ô đếm số cảnh, góc trên trái.
  for (let k = 0; k <= i; k++) {
    boxes.push(`drawbox=x=${40 + k * 54}:y=40:w=40:h=40:color=white@0.9:t=fill`);
  }
  // Khối lệch tâm: nếu Ken Burns chạy đúng thì khối này trôi trong khung.
  boxes.push(`drawbox=x=${WIDTH * 0.62}:y=${HEIGHT * 0.58}:w=180:h=180:color=black@0.45:t=fill`);
  // Viền để thấy ngay khi ảnh bị phóng quá và mất mép.
  boxes.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.4:t=10`);

  const r = spawnSync(
    'ffmpeg',
    [
      '-v', 'error',
      '-f', 'lavfi',
      '-i', `color=c=${COLORS[i % COLORS.length]}:s=${WIDTH}x${HEIGHT}`,
      '-vf', boxes.join(','),
      '-frames:v', '1',
      join(outDir, `${scn.id}.png`),
      '-y',
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) die(`ffmpeg lỗi ở ${scn.id}: ${(r.stderr ?? '').trim()}`);
});

ok(`${story.scenes.length} ảnh giả → content/${dir}/images/`);
info('Sinh ảnh thật bằng: node images.mjs ' + dir + ' --force');
