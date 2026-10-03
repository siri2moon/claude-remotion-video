#!/usr/bin/env node
// Stage 3 — lấy word-level timing bằng whisper.cpp, rồi ghép vào CHỮ GỐC.
// Dùng: node transcribe.mjs <slug> [--model=medium] [--fallback] [--force]
//   --fallback  bỏ qua whisper hoàn toàn, chia đều thời lượng cho số từ.
//               Dùng khi chưa tải model, hoặc để dựng nháp cho nhanh.
// Ra:   content/<dir>/timing.json

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { alignWords, evenDistribution } from './align.mjs';
import { ROOT, contentDir, flagValue, hasFlag, info, isFresh, ok, readJson, slugArg, warn, writeJson } from './lib.mjs';

const slug = slugArg();
const fallback = hasFlag('fallback');
const force = hasFlag('force');
const model = flagValue('model', process.env.WHISPER_MODEL ?? 'medium');
const dir = contentDir(slug);

const script = readJson(join(dir, 'script.json'));
const media = readJson(join(dir, 'media.json'));
const outPath = join(dir, 'timing.json');

// Model *.en KHÔNG dùng được cho tiếng Việt. Bắt sớm, đừng để tải 1.5GB rồi mới biết.
if (!fallback && model.endsWith('.en')) {
  console.error(`ERROR  model "${model}" chỉ hỗ trợ tiếng Anh. Dùng: medium, large-v3-turbo.`);
  process.exit(1);
}

const voiceoverOf = (sceneId) => script.scenes.find((s) => s.id === sceneId)?.voiceover ?? '';

const buildFallback = () => {
  const scenes = {};
  for (const m of media.scenes) {
    const r = evenDistribution(voiceoverOf(m.sceneId), m.durationSec * 1000);
    scenes[m.sceneId] = { mode: r.mode, matchRatio: 0, words: r.words };
  }
  return { slug, model: null, scenes };
};

if (fallback) {
  writeJson(outPath, buildFallback());
  ok(`timing chia đều cho ${media.scenes.length} scene → content/${slug}/timing.json`);
  warn('đây là chế độ --fallback: chữ đúng nhưng KHÔNG khớp nhịp nói. Bỏ cờ này để dùng whisper thật.');
  process.exit(0);
}

if (!force && media.scenes.every((m) => isFresh(outPath, join(dir, 'audio', `${m.sceneId}.wav`)))) {
  ok(`timing.json còn mới, dùng lại cache (thêm --force để làm lại)`);
  process.exit(0);
}

// @remotion/install-whisper-cpp nằm trong remotion/node_modules — resolve từ đó.
const require = createRequire(join(ROOT, 'remotion', 'package.json'));
let whisper;
try {
  whisper = await import(pathToFileURL(require.resolve('@remotion/install-whisper-cpp')).href);
} catch (e) {
  console.error('ERROR  không nạp được @remotion/install-whisper-cpp.');
  console.error('       chạy: cd remotion && pnpm install');
  console.error(`       (${e.message})`);
  process.exit(1);
}
const { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } = whisper.default ?? whisper;

const whisperPath = join(ROOT, '.whisper');
const version = '1.5.5';

info(`chuẩn bị whisper.cpp ${version} + model ${model} (lần đầu tải ~1.5GB, sau đó dùng cache)`);
await installWhisperCpp({ to: whisperPath, version });
await downloadWhisperModel({ model, folder: whisperPath });

const scenes = {};
for (const m of media.scenes) {
  const wav = join(dir, 'audio', `${m.sceneId}.wav`);
  if (!existsSync(wav)) {
    console.error(`ERROR  thiếu ${wav} — chạy extract-audio.mjs trước`);
    process.exit(1);
  }

  const raw = await transcribe({
    model,
    whisperPath,
    whisperCppVersion: version,
    inputPath: wav,
    tokenLevelTimestamps: true,
    language: 'vi',
    printOutput: false,
  });

  const { captions } = toCaptions({ whisperCppOutput: raw });
  const heard = captions
    .map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs }))
    .filter((c) => c.text.trim().length > 0);

  // Đây là chỗ quan trọng: CHỮ lấy từ voiceover, THỜI ĐIỂM lấy từ whisper.
  const aligned = alignWords(voiceoverOf(m.sceneId), heard, m.durationSec * 1000);
  scenes[m.sceneId] = { mode: aligned.mode, matchRatio: Number(aligned.matchRatio.toFixed(3)), words: aligned.words };

  const pct = Math.round(aligned.matchRatio * 100);
  if (aligned.mode === 'aligned') {
    info(`${m.sceneId}: khớp ${pct}% (${aligned.words.length} từ)`);
    if (pct < 70) warn(`${m.sceneId}: khớp thấp — nghe lại xem có nói lệch kịch bản nhiều không`);
  } else {
    warn(`${m.sceneId}: rơi về ${aligned.mode} — chữ vẫn đúng nhưng nhịp sẽ không khớp lời nói`);
  }
}

writeJson(outPath, { slug, model, scenes });
ok(`timing xong → content/${slug}/timing.json`);
