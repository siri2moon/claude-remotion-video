#!/usr/bin/env node
// Stage: story.json + timing.json + images/ → props.json
//
// Dùng: node build-props.mjs <slug> [--fps=30] [--bgm=ten-file.mp3] [--no-bgm]
//
// Không có bước đoán nhịp ở đây. timing.json đã nắm thời điểm chính xác của từng
// dòng vì mỗi dòng là một file wav đo được. Việc còn lại chỉ là đổi giây ra frame.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  assetsDir, contentDir, die, flagValue, hasFlag, info, loadStory, ok, readJson, slugArg, warn, writeJson,
} from './lib.mjs';

const dir = slugArg();
const story = loadStory(dir);
const base = contentDir(dir);

const timingPath = join(base, 'timing.json');
if (!existsSync(timingPath)) die(`thiếu timing.json. Chạy tts.mjs ${dir} trước.`);
const timing = readJson(timingPath);

const fps = Number(flagValue('fps', 30));
const sec = (s) => Math.round(s * fps);

// --- Phụ đề: một dòng thoại = một dòng phụ đề ------------------------------

// Giữ chữ nán lại sau khi dứt tiếng cho người đọc kịp hết câu, nhưng không được
// đè lên dòng sau — nên trần là mốc bắt đầu của dòng kế tiếp.
const HOLD = 0.28;

const captions = timing.lines.map((ln, i) => {
  const next = timing.lines[i + 1];
  const end = next ? Math.min(ln.endSec + HOLD, next.startSec) : ln.endSec + HOLD;
  return {
    text: ln.text,
    fromFrame: sec(ln.startSec),
    durationInFrames: Math.max(1, sec(end) - sec(ln.startSec)),
  };
});

// --- Panel ảnh: một cảnh = một ảnh ------------------------------------------

const imgDir = join(base, 'images');
const missing = story.scenes.filter((s) => !existsSync(join(imgDir, `${s.id}.png`)));
if (missing.length)
  die(`thiếu ${missing.length} ảnh: ${missing.map((s) => s.id).join(', ')}. Chạy images.mjs ${dir}`);

// Mốc bắt đầu mỗi cảnh = mốc bắt đầu dòng đầu tiên của cảnh đó.
const sceneStart = new Map();
timing.lines.forEach((ln) => {
  if (!sceneStart.has(ln.sceneId)) sceneStart.set(ln.sceneId, ln.startSec);
});

const totalFrames = Math.ceil(timing.totalSec * fps);

// Ken Burns so le: cảnh chẵn phóng vào, cảnh lẻ lùi ra, tâm phóng đảo qua lại.
// Cùng một kiểu chuyển động lặp suốt 3 phút thì người xem thấy ngay là máy làm.
const ORIGINS = [
  [0.5, 0.45],
  [0.38, 0.55],
  [0.62, 0.42],
  [0.5, 0.6],
];
const ZOOM_LO = 1.02; // không bao giờ để 1.0 — hụt một pixel là lộ nền sau ảnh
const ZOOM_HI = 1.11;

const shots = story.scenes.map((scn, i) => {
  const start = sceneStart.get(scn.id);
  if (start === undefined) die(`cảnh ${scn.id} không có dòng thoại nào — timing.json không nhắc tới nó`);

  const nextStart = story.scenes[i + 1] ? sceneStart.get(story.scenes[i + 1].id) : null;
  const from = sec(start);
  // Ảnh chạy liền tới lúc ảnh sau vào, không chừa khe hở.
  const until = nextStart === null ? totalFrames : sec(nextStart);
  const zoomIn = i % 2 === 0;
  const [ox, oy] = ORIGINS[i % ORIGINS.length];

  return {
    src: `${dir}/images/${scn.id}.png`,
    fromFrame: from,
    durationInFrames: Math.max(1, until - from),
    zoomFrom: zoomIn ? ZOOM_LO : ZOOM_HI,
    zoomTo: zoomIn ? ZOOM_HI : ZOOM_LO,
    originX: ox,
    originY: oy,
    sceneId: scn.id,
  };
});

// --- Nhạc nền ---------------------------------------------------------------

let bgm = null;
if (!hasFlag('no-bgm')) {
  const bgmDir = join(assetsDir(), 'bgm');
  const want = flagValue('bgm', story.bgm ?? null);
  if (existsSync(bgmDir)) {
    const files = readdirSync(bgmDir).filter((f) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(f)).sort();
    const hit = want ? files.find((f) => f === want || f.startsWith(want)) : files[0];
    if (want && !hit) warn(`không thấy nhạc nền "${want}" trong content/_assets/bgm/`);
    // Video mẫu để nhạc rất nhỏ dưới giọng đọc — nghe thấy nhưng không tranh chỗ.
    if (hit) bgm = { src: `_assets/bgm/${hit}`, volume: 0.1 };
  }
  if (!bgm) info('chưa có nhạc nền — bỏ file vào content/_assets/bgm/ nếu muốn');
}

// --- Ghi ra ------------------------------------------------------------------

const voiceFile = join(base, 'audio', 'voice.wav');
if (!existsSync(voiceFile)) die('thiếu audio/voice.wav — chạy lại tts.mjs');

writeJson(join(base, 'props.json'), {
  id: story.id,
  fps,
  durationInFrames: totalFrames,
  title: story.title,
  shots,
  captions,
  voice: { src: `${dir}/audio/voice.wav` },
  bgm,
});

ok(`props.json — ${shots.length} ảnh, ${captions.length} dòng phụ đề, ${(totalFrames / fps).toFixed(1)}s`);

// --- Cảnh báo đáng đọc -------------------------------------------------------

const secPerShot = shots.map((s) => s.durationInFrames / fps);
const avg = secPerShot.reduce((a, b) => a + b, 0) / secPerShot.length;
info(`mỗi ảnh trung bình ${avg.toFixed(1)}s (video tham khảo: 2,3s)`);

const slow = shots.filter((s) => s.durationInFrames / fps > 8);
if (slow.length)
  warn(`${slow.length} cảnh đứng quá 8s (${slow.map((s) => s.sceneId).join(', ')}) — tách bớt lời thoại ra cảnh mới cho đỡ ì`);

const overlap = captions.filter((c, i) => {
  const n = captions[i + 1];
  return n && c.fromFrame + c.durationInFrames > n.fromFrame;
});
if (overlap.length) warn(`${overlap.length} dòng phụ đề chồng nhau — báo lỗi logic, cần xem lại`);
