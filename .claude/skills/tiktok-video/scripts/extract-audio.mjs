#!/usr/bin/env node
// Stage 2 — tách tiếng ra WAV 16kHz mono cho whisper, đồng thời chuẩn hoá âm lượng.
// Dùng: node extract-audio.mjs <slug> [--force]
// Ra:   content/<dir>/audio/sN.wav

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, hasFlag, info, isFresh, ok, readJson, requireBin, sh, slugArg } from './lib.mjs';

requireBin('ffmpeg');
const slug = slugArg();
const force = hasFlag('force');
const dir = contentDir(slug);
const media = readJson(join(dir, 'media.json'));

mkdirSync(join(dir, 'audio'), { recursive: true });

let made = 0;
let cached = 0;

for (const scene of media.scenes) {
  const out = join(dir, 'audio', `${scene.sceneId}.wav`);
  if (!force && isFresh(out, scene.path)) {
    cached++;
    continue;
  }

  sh('ffmpeg', [
    '-y', '-i', scene.path,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    // loudnorm quan trọng hơn vẻ ngoài: 5 scene quay rời nhau, khoảng cách miệng–mic
    // lệch vài cm là âm lượng đã khác thấy rõ ở chỗ nối. -14 LUFS là mức chuẩn social.
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    out,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  made++;
}

ok(`tách tiếng xong — ${made} file mới, ${cached} file dùng lại cache`);
if (cached && !force) info('muốn làm lại hết thì thêm --force');
