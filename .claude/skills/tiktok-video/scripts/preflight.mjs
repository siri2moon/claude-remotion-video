#!/usr/bin/env node
// Stage 1 — kiểm tra footage trước khi làm bất cứ việc gì tốn thời gian.
// Dùng: node preflight.mjs <slug>
// Ra:   content/<dir>/media.json

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, fail, ffprobe, info, ok, readJson, requireBin, slugArg, warn, writeJson } from './lib.mjs';

const EXTS = ['mov', 'MOV', 'mp4', 'MP4', 'm4v'];

requireBin('ffprobe');
const slug = slugArg();
const dir = contentDir(slug);
const script = readJson(join(dir, 'script.json'));

const findRaw = (sceneId) => {
  for (const ext of EXTS) {
    const p = join(dir, 'raw', `${sceneId}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
};

const scenes = [];
const missing = [];

for (const scene of script.scenes) {
  const path = findRaw(scene.id);
  if (!path) {
    missing.push(scene.id);
    continue;
  }

  const probe = ffprobe(path);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  const durationSec = Number(probe.format.duration);

  if (!v) {
    fail(`${scene.id}: file không có luồng video — ${path}`);
    continue;
  }
  if (!a) {
    fail(`${scene.id}: file KHÔNG CÓ TIẾNG. Gần như chắc chắn mic chưa kết nối lúc quay — phải quay lại.`);
    continue;
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    fail(`${scene.id}: không đọc được thời lượng`);
    continue;
  }

  const width = Number(v.width);
  const height = Number(v.height);
  const [num, den] = String(v.r_frame_rate ?? '30/1').split('/').map(Number);
  const fps = den ? num / den : 30;

  if (width > height) {
    warn(`${scene.id}: quay NGANG (${width}×${height}). Video 9:16 sẽ bị crop mạnh hoặc viền đen.`);
  }
  if (height < 1920) {
    warn(`${scene.id}: chiều cao ${height}px < 1920 — sẽ bị mờ khi lên khung 1080×1920.`);
  }

  const planned = scene.endSec - scene.startSec;
  const drift = Math.abs(durationSec - planned) / planned;
  if (drift > 0.5) {
    warn(
      `${scene.id}: quay ${durationSec.toFixed(1)}s nhưng kịch bản dự kiến ${planned}s ` +
        `(lệch ${Math.round(drift * 100)}%). Video vẫn dựng được — timeline lấy theo file thật.`,
    );
  }

  scenes.push({
    sceneId: scene.id,
    role: scene.role,
    src: `${slug}/raw/${scene.id}.${path.split('.').pop()}`,
    path,
    durationSec,
    width,
    height,
    fps,
  });
}

if (missing.length) {
  fail(`thiếu footage cho scene: ${missing.join(', ')}`);
  info(`cần các file: ${missing.map((id) => `content/${slug}/raw/${id}.mov`).join('  ')}`);
  info(`xem hướng dẫn quay ở content/${slug}/shoot.md`);
}

if (process.exitCode === 1) {
  console.log('\nSửa xong chạy lại preflight.');
  process.exit(1);
}

const bRollFound = script.scenes.filter((s) => s.bRoll && findRaw(`${s.id}-broll`));
if (bRollFound.length) {
  warn(`tìm thấy ${bRollFound.length} file b-roll nhưng v1 chưa chèn b-roll vào video — tạm bỏ qua.`);
}

writeJson(join(dir, 'media.json'), { slug, scenes });
const total = scenes.reduce((s, x) => s + x.durationSec, 0);
ok(`${scenes.length} scene, tổng ${total.toFixed(1)}s footage → content/${slug}/media.json`);
