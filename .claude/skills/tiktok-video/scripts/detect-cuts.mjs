#!/usr/bin/env node
// Stage 4 — jump-cut: tìm khoảng lặng, sinh danh sách đoạn GIỮ LẠI.
// Dùng: node detect-cuts.mjs <slug> [--no-cut] [--silence-db=-32] [--min-silence=0.35] [--pad=0.08]
//
// Hai chế độ theo kịch bản (video vô tri từ votri-script mới có):
//   scene.keepPauses = true  → KHÔNG cắt khoảng lặng bên trong. Chỉ tỉa đầu/cuối, chừa lại
//                              tối đa MAX_LEAD_PAUSE trước câu đầu — vì cú twist deadpan
//                              thường là "im 2 giây rồi mới nói", cắt đi là mất miếng hài.
//   script.edit.leaveGapSec  → cắt khoảng lặng nhưng chừa lại một nhịp ngắn thay vì cắt sạch.
// Ra:   content/<dir>/cuts.json  ← sửa tay được, máy cắt sai thì sửa một dòng

import { join } from 'node:path';
import { contentDir, flagValue, hasFlag, info, ok, readJson, requireBin, shBoth, slugArg, warn, writeJson } from './lib.mjs';
import { loadScript } from './kichban.mjs';

const MAX_LEAD_PAUSE = 2.5;
const MAX_TAIL_PAUSE = 1.0;

requireBin('ffmpeg');
const slug = slugArg();
const dir = contentDir(slug);
const media = readJson(join(dir, 'media.json'));
const script = loadScript(dir);
const leaveGap = Number(script.edit?.leaveGapSec ?? 0);

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

  const scene = script.scenes.find((s) => s.id === m.sceneId);
  if (scene?.keepPauses) {
    // Tiếng nói bắt đầu khi khoảng lặng đầu tiên (nếu nằm sát 0) kết thúc, và dừng khi
    // khoảng lặng cuối (nếu chạm đuôi) bắt đầu. Mọi khoảng lặng ở giữa giữ nguyên.
    const lead = silences.find(([s]) => s <= 0.05);
    const tail = silences.find(([, e]) => e >= dur - 0.05 && !(lead && e === lead[1]));
    const speechStart = lead ? lead[1] : 0;
    const speechEnd = tail ? tail[0] : dur;
    const a = Math.max(0, speechStart - MAX_LEAD_PAUSE);
    const b = Math.min(dur, speechEnd + MAX_TAIL_PAUSE);
    scenes[m.sceneId] = {
      durationSec: Number(dur.toFixed(3)),
      keep: [[Number(a.toFixed(3)), Number(b.toFixed(3))]],
      removedSec: Number((dur - (b - a)).toFixed(3)),
      keepPauses: true,
    };
    totalRemoved += dur - (b - a);
    info(`${m.sceneId}: giữ khoảng lặng (keepPauses), chỉ tỉa đầu/cuối — bỏ ${(dur - (b - a)).toFixed(1)}s`);
    continue;
  }

  // Giữ lại = phần bù của khoảng lặng, cộng thêm pad hai đầu để không nghe cụt.
  const keep = [];
  let cursor = 0;
  for (const [s, e] of silences) {
    // Khoảng lặng giữa câu chừa lại `leaveGap` (chia đôi hai bên); ở đầu/cuối clip thì cắt sạch.
    const inner = s > 0.05 && e < dur - 0.05;
    // Lặng ngắn hơn phần phải chừa lại thì để nguyên, cắt vào chỉ đẻ ra hai đoạn chồng nhau.
    if (inner && e - s <= leaveGap + 2 * pad) continue;
    const half = inner ? leaveGap / 2 : 0;
    const segEnd = Math.min(dur, s + pad + half);
    if (segEnd - cursor > 0.12) keep.push([cursor, segEnd]);
    cursor = Math.max(0, Math.min(dur, e - pad - half));
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
