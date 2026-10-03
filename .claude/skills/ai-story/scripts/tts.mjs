#!/usr/bin/env node
// Stage: story.json → audio/l###.wav (mỗi dòng một file) + audio/voice.wav + timing.json
//
// Dùng: node tts.mjs <slug> [--voice="Thanh Bình"] [--ref=đường/dẫn/mau.wav] [--force]
//
// timing.json là hợp đồng thời gian của cả video. Mọi thứ phía sau — panel ảnh,
// phụ đề, độ dài composition — đều tính ra từ nó.

import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentDir, die, durationOf, flagValue, flatLines, hasFlag, info, loadStory,
  ok, requireBin, sh, slugArg, venvPython, warn, writeJson,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// Khoảng lặng chèn giữa các dòng. Trong cùng một cảnh thì nhịp liền mạch;
// sang cảnh mới nghỉ dài hơn một chút cho người nghe kịp bắt ý.
const GAP_LINE = 0.16;
const GAP_SCENE = 0.38;
// Đệm đầu/cuối để câu đầu không bị cụt và câu cuối không đứt phựt.
const LEAD_IN = 0.35;
const TAIL = 0.9;

const dir = slugArg();
const story = loadStory(dir);
const base = contentDir(dir);
const audioDir = join(base, 'audio');
const timingPath = join(base, 'timing.json');

requireBin('ffmpeg', 'Cài bằng: brew install ffmpeg');

const py = venvPython();
if (!existsSync(py)) die(`chưa có venv TTS. Chạy: node ${join(HERE, 'setup.mjs')}`);

const lines = flatLines(story);
if (lines.length === 0) die('story.json không có dòng thoại nào');

if (existsSync(timingPath) && !hasFlag('force')) {
  info(`timing.json đã có, bỏ qua. Thêm --force để đọc lại.`);
  process.exit(0);
}

// --- 1. Sinh từng dòng -------------------------------------------------------

const refFlag = flagValue('ref', null);
const refAudio = refFlag ? resolve(refFlag) : story.voiceRef ? join(base, story.voiceRef) : null;
if (refAudio && !existsSync(refAudio)) die(`không thấy file mẫu giọng: ${refAudio}`);

const job = {
  outDir: audioDir,
  refAudio,
  voice: flagValue('voice', story.voice ?? 'Thanh Bình'),
  lines: lines.map((l, i) => ({ id: `l${String(i + 1).padStart(3, '0')}`, text: l.text })),
};

mkdirSync(audioDir, { recursive: true });
info(`đọc ${lines.length} dòng bằng ${refAudio ? 'giọng nhân bản' : `giọng "${job.voice}"`}…`);

const t0 = Date.now();
const r = spawnSync(py, [join(HERE, 'tts_worker.py')], {
  input: JSON.stringify(job),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'inherit'], // log tiến độ chảy thẳng ra terminal
});
// Đừng chỉ tin mã thoát. Worker nạp cả ONNX Runtime lẫn torch, và lúc giải phóng
// bộ nhớ thỉnh thoảng chết dù đã đọc xong sạch sẽ và in JSON đầy đủ. Worker đã
// dùng os._exit(0) để né, đây là lớp phòng vệ thứ hai: có kết quả đủ dùng thì đi tiếp.
let res = null;
try {
  res = JSON.parse(r.stdout);
} catch {
  /* để res = null, xử lý ngay dưới */
}

if (!res || !Array.isArray(res.lines) || res.lines.length !== job.lines.length) {
  die(`TTS thất bại (mã thoát ${r.status}) — xem log phía trên`);
}
if (r.status !== 0) warn(`worker thoát với mã ${r.status} nhưng đã đọc đủ ${res.lines.length} dòng — đi tiếp`);

const elapsed = (Date.now() - t0) / 1000;

// --- 2. Cắt lặng hai đầu từng dòng ------------------------------------------

// VieNeu-TTS chèn khoảng lặng đầu/cuối mỗi file, dài ngắn thất thường — đo được
// tới 500ms. Cứ thế đem xếp thì phụ đề bật lên trước cả tiếng nói đúng chừng ấy.
//
// KHÔNG dùng silenceremove với ngưỡng dB cố định. Đã thử -50dB và trượt: có dòng
// mở đầu bằng 470ms tiếng thở nằm lọt giữa -54dB và -40dB, ngưỡng nào cũng hoặc
// bỏ sót nó hoặc xén mất phụ âm nhẹ của dòng khác. Thay bằng ngưỡng TƯƠNG ĐỐI
// theo đỉnh của chính file đó — tự thích ứng, không phải chỉnh tay.
const PAD = 0.04; // chừa lại để không xén phụ âm bật đầu câu
const REL = 0.06; // 6% biên độ đỉnh = ranh giới giữa tiếng thở và tiếng nói

/** Mốc đầu và cuối của tiếng nói thật trong một file, tính bằng giây. */
const speechBounds = (file) => {
  const pcm = sh('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], {
    encoding: 'buffer',
  });
  const n = Math.floor(pcm.length / 2);
  const W = 80; // cửa sổ 10ms ở 8kHz
  const env = [];
  for (let i = 0; i + W <= n; i += W) {
    let acc = 0;
    for (let k = 0; k < W; k++) {
      const v = pcm.readInt16LE((i + k) * 2);
      acc += v * v;
    }
    env.push(Math.sqrt(acc / W));
  }
  const peak = Math.max(...env, 1);
  const thr = peak * REL;
  let a = env.findIndex((e) => e >= thr);
  let b = env.length - 1;
  while (b > a && env[b] < thr) b--;
  if (a < 0) return null; // cả file im lặng — để nguyên, đừng cắt mù
  return { start: Math.max(0, (a * W) / 8000 - PAD), end: ((b + 1) * W) / 8000 + PAD };
};

const trimmed = res.lines.map((line) => {
  const src = join(audioDir, line.file);
  const b = speechBounds(src);
  if (!b) {
    warn(`${line.id} không thấy tiếng nói nào — giữ nguyên file`);
    return { ...line, sec: durationOf(src) };
  }
  const tmp = join(audioDir, `.trim-${line.file}`);
  const t = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', src, '-ss', b.start.toFixed(3), '-to', b.end.toFixed(3),
     '-ar', '48000', '-ac', '1', tmp, '-y'],
    { encoding: 'utf8' },
  );
  if (t.status !== 0) die(`cắt lặng lỗi ở ${line.id}:\n${(t.stderr ?? '').slice(-600)}`);
  renameSync(tmp, src);
  return { ...line, sec: durationOf(src) };
});

const cutTotal = res.lines.reduce((s, l) => s + l.sec, 0) - trimmed.reduce((s, l) => s + l.sec, 0);
if (cutTotal > 0.05) info(`cắt bỏ ${cutTotal.toFixed(1)}s lặng thừa ở đầu/cuối các dòng`);

// --- 3. Ghép thành một file, chèn khoảng lặng --------------------------------

const items = [];
let cursor = LEAD_IN;
trimmed.forEach((line, i) => {
  const meta = lines[i];
  items.push({
    id: line.id,
    text: meta.text,
    sceneId: meta.sceneId,
    sceneIndex: meta.sceneIndex,
    startSec: Number(cursor.toFixed(4)),
    endSec: Number((cursor + line.sec).toFixed(4)),
  });
  const next = lines[i + 1];
  const gap = !next ? 0 : next.sceneIndex !== meta.sceneIndex ? GAP_SCENE : GAP_LINE;
  cursor += line.sec + gap;
});
const totalSec = Number((cursor + TAIL).toFixed(4));

// Ghép bằng adelay + amix: mỗi dòng đặt đúng vị trí mili giây đã tính ở trên,
// thay vì nối đuôi rồi hy vọng khoảng lặng khớp.
const inputs = trimmed.flatMap((l) => ['-i', join(audioDir, l.file)]);
const delays = items
  .map((it, i) => `[${i}:a]adelay=${Math.round(it.startSec * 1000)}:all=1[a${i}]`)
  .join(';');
const mix = items.map((_, i) => `[a${i}]`).join('');
const filter =
  `${delays};${mix}amix=inputs=${items.length}:normalize=0:dropout_transition=0[m];` +
  `[m]apad=whole_dur=${totalSec},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;

const voicePath = join(audioDir, 'voice.wav');
const mixLog = spawnSync(
  'ffmpeg',
  [...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '1', voicePath, '-y'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (mixLog.status !== 0) die(`ffmpeg ghép tiếng lỗi:\n${mixLog.stderr?.slice(-1500)}`);

const realSec = durationOf(voicePath);

// --- 3. Ghi timing.json ------------------------------------------------------

writeJson(timingPath, {
  voice: res.voice,
  cloned: Boolean(refAudio),
  sampleRate: res.sampleRate,
  voiceFile: 'audio/voice.wav',
  totalSec: Number(realSec.toFixed(4)),
  gaps: { line: GAP_LINE, scene: GAP_SCENE, leadIn: LEAD_IN, tail: TAIL },
  lines: items,
});

const spoken = items.reduce((s, it) => s + (it.endSec - it.startSec), 0);
ok(`${items.length} dòng → audio/voice.wav  ${realSec.toFixed(1)}s`);
// Tách riêng thời gian nạp model: nó là phí cố định mỗi lần chạy, gộp vào thì
// video càng ngắn trông càng chậm, không phản ánh đúng tốc độ đọc.
info(
  `nạp model ${res.loadSec}s + đọc ${res.synthSec}s (nhanh gấp ${(spoken / res.synthSec).toFixed(1)}× thời gian thực), tổng ${elapsed.toFixed(1)}s`,
);

if (Math.abs(realSec - totalSec) > 0.35)
  warn(`độ dài file thật ${realSec.toFixed(2)}s lệch so với tính toán ${totalSec.toFixed(2)}s`);

const longest = items.reduce((a, b) => (b.endSec - b.startSec > a.endSec - a.startSec ? b : a));
const longSec = longest.endSec - longest.startSec;
if (longSec > 7)
  warn(`dòng "${longest.text.slice(0, 40)}…" dài ${longSec.toFixed(1)}s — cắt ngắn cho dễ đọc phụ đề`);
