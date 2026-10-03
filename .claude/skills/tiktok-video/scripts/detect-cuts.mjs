#!/usr/bin/env node
// Stage 4 — jump-cut: tìm khoảng lặng, sinh danh sách đoạn GIỮ LẠI.
// Dùng: node detect-cuts.mjs <slug> [--no-cut] [--silence-db=-32] [--min-silence=0.35] [--pad=0.08]
// Ra:   content/<dir>/cuts.json  ← sửa tay được, máy cắt sai thì sửa một dòng

import { join } from 'node:path';
import { contentDir, flagValue, hasFlag, info, ok, readJson, requireBin, shBoth, slugArg, warn, writeJson } from './lib.mjs';

requireBin('ffmpeg');
const slug = slugArg();
const dir = contentDir(slug);
const media = readJson(join(dir, 'media.json'));

const noCut = hasFlag('no-cut');
const db = Number(flagValue('silence-db', '-32'));
const minSilence = Number(flagValue('min-silence', '0.35'));
const pad = Number(flagValue('pad', '0.08'));

/** Đọc log silencedetect → danh sách [start,end] của các khoảng LẶNG */
const findSilences = (wav) => {
  const log = shBoth('ffmpeg', [
    '-i', wav,
    '-af', `silencedetect=noise=${db}dB:d=${minSilence}`,
    '-f', 'null', '-',
  ]);
  const silences = [];
  let open = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (e && open !== null) {
      silences.push([open, Number(e[1])]);
      open = null;
    }
  }
  return { silences, trailing: open };
};

const scenes = {};
let totalRemoved = 0;

for (const m of media.scenes) {
  const dur = m.durationSec;

  if (noCut) {
    scenes[m.sceneId] = { durationSec: dur, keep: [[0, dur]], removedSec: 0 };
    continue;
  }

  const { silences, trailing } = findSilences(join(dir, 'audio', `${m.sceneId}.wav`));
  if (trailing !== null) silences.push([trailing, dur]);

  // Giữ lại = phần bù của khoảng lặng, cộng thêm pad hai đầu để không nghe cụt.
  const keep = [];
  let cursor = 0;
  for (const [s, e] of silences) {
    const segEnd = Math.min(dur, s + pad);
    if (segEnd - cursor > 0.12) keep.push([cursor, segEnd]);
    cursor = Math.max(0, Math.min(dur, e - pad));
  }
  if (dur - cursor > 0.12) keep.push([cursor, dur]);

  if (keep.length === 0) {
    // Không phát hiện tiếng nói nào — giữ nguyên còn hơn cắt sạch.
    warn(`${m.sceneId}: không thấy đoạn nào có tiếng, giữ nguyên cả clip. Kiểm tra mic hoặc hạ --silence-db.`);
    scenes[m.sceneId] = { durationSec: dur, keep: [[0, dur]], removedSec: 0 };
    continue;
  }

  const kept = keep.reduce((s, [a, b]) => s + (b - a), 0);
  const removed = dur - kept;
  totalRemoved += removed;
  scenes[m.sceneId] = {
    durationSec: Number(dur.toFixed(3)),
    keep: keep.map(([a, b]) => [Number(a.toFixed(3)), Number(b.toFixed(3))]),
    removedSec: Number(removed.toFixed(3)),
  };

  if (removed / dur > 0.5) {
    warn(`${m.sceneId}: cắt mất ${Math.round((removed / dur) * 100)}% clip — có thể mic quá nhỏ. Thử --silence-db=-40.`);
  }
  info(`${m.sceneId}: ${keep.length} đoạn giữ lại, bỏ ${removed.toFixed(1)}s lặng`);
}

writeJson(join(dir, 'cuts.json'), { slug, silenceDb: db, minSilence, pad, scenes });
ok(noCut ? `không cắt (--no-cut) → content/${slug}/cuts.json` : `jump-cut: bỏ tổng ${totalRemoved.toFixed(1)}s → content/${slug}/cuts.json`);
