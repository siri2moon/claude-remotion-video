#!/usr/bin/env node
// Stage: story.json → images/<sceneId>.png, mỗi cảnh một ảnh.
//
// Dùng: node images.mjs <slug> [--only=s03,s07] [--force] [--seed=123] [--dry]
//
// Đây là stage chậm nhất — vài chục giây một ảnh. Nên nó CHẠY LẠI ĐƯỢC: ảnh nào
// đã có thì bỏ qua. Vẽ hỏng đúng một cảnh thì sửa `image` trong story.json rồi
// `--only=s07`, không phải sinh lại cả bộ.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentDir, die, flagValue, hasFlag, info, loadStory, ok, requireBin, slugArg, warn,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'styles.json'), 'utf8'));

// Panel ảnh trên khung 1080×1920 là 1080×696 → tỉ lệ 1.552.
// Sinh to hơn panel để Ken Burns còn chỗ phóng mà không vỡ.
const WIDTH = 1216;
const HEIGHT = 784;

// Bản Z-Image Turbo đã lượng tử sẵn, do chính tác giả mflux đóng gói.
//
// Vì sao KHÔNG dùng tên model dựng sẵn "z-image-turbo": bản gốc trên Hugging Face
// lưu trọng số fp32, phải tải 33GB rồi mới lượng tử tại máy. Bản 4-bit này chỉ
// 5,5GB và cho ra ảnh tương đương ở phong cách tranh phẳng.
// Muốn nét hơn thì đổi sang bản 8-bit (11GB): carsenk/z-image-turbo-mflux-8bit
const MODEL = 'filipstrand/Z-Image-Turbo-mflux-4bit';

const NUM = [null, 'one', 'two', 'three', 'four', 'five', 'six'];

const dir = slugArg();
const story = loadStory(dir);
const outDir = join(contentDir(dir), 'images');

const style = STYLES[story.style ?? 'doodle'];
if (!style) die(`phong cách "${story.style}" không có. Có: ${Object.keys(STYLES).join(', ')}`);

requireBin('mflux-generate-z-image-turbo', `Cài bằng: uv tool install --upgrade mflux`);

const only = flagValue('only', null);
const pick = only ? new Set(only.split(',').map((s) => s.trim())) : null;
const baseSeed = Number(flagValue('seed', story.seed ?? 20260818));
const model = flagValue('model', story.model ?? MODEL);
const force = hasFlag('force');
const dry = hasFlag('dry');

// Ngoại hình nhân vật khai báo một chỗ, nhét vào MỌI cảnh có mặt họ.
// Đây là toàn bộ bí quyết giữ nhân vật xuyên suốt: model không nhớ cảnh trước,
// nên mỗi lần đều phải tả lại y nguyên từng chữ.
const look = new Map((story.cast ?? []).map((c) => [c.id, c.look]));

mkdirSync(outDir, { recursive: true });

const todo = story.scenes.filter((sc) => {
  if (pick && !pick.has(sc.id)) return false;
  if (!force && existsSync(join(outDir, `${sc.id}.png`))) return false;
  return true;
});

if (pick) {
  const unknown = [...pick].filter((id) => !story.scenes.some((s) => s.id === id));
  if (unknown.length) die(`--only nhắc tới cảnh không có: ${unknown.join(', ')}`);
}

const skipped = story.scenes.length - todo.length - (pick ? story.scenes.length - pick.size : 0);
if (skipped > 0) info(`bỏ qua ${skipped} ảnh đã có (thêm --force để vẽ lại)`);
if (todo.length === 0) {
  ok('đủ ảnh, không phải vẽ gì');
  process.exit(0);
}

info(`vẽ ${todo.length} ảnh, phong cách "${story.style ?? 'doodle'}" — ${style.label}`);
info(`model: ${model}`);

const t0 = Date.now();
let done = 0;
const failed = [];

for (const [i, sc] of todo.entries()) {
  const missing = (sc.cast ?? []).filter((id) => !look.has(id));
  if (missing.length) die(`cảnh ${sc.id} nhắc tới nhân vật chưa khai báo trong cast: ${missing.join(', ')}`);

  const cast = sc.cast ?? [];
  const who = cast.map((id) => look.get(id)).join(' ');
  // Chốt số người trong khung. Không có câu này thì model hay đẻ thêm một bóng
  // trắng trống trơn đứng lẫn vào — nó đọc phần tả phong cách thành lời tả một
  // nhân vật rồi vẽ luôn ra. Ghi bằng CHỮ, model bám chữ tốt hơn bám số.
  const count = cast.length
    ? `Exactly ${NUM[cast.length] ?? cast.length} character${cast.length > 1 ? 's' : ''} in the frame, no one else.`
    : '';
  // Thứ tự: phong cách → hành động → số người → ngoại hình. Để ngoại hình sau
  // cùng thì nó bám vào nhân vật vừa dựng, không trôi thành cảnh riêng.
  const prompt = [style.prompt, `Scene: ${sc.image}`, count, who].filter(Boolean).join(' ');
  const out = join(outDir, `${sc.id}.png`);
  const seed = baseSeed + (story.seedMode === 'vary' ? story.scenes.indexOf(sc) : 0);

  if (dry) {
    console.log(`\n--- ${sc.id} (seed ${seed}) ---\n${prompt}`);
    continue;
  }

  const at = Date.now();
  const r = spawnSync(
    'mflux-generate-z-image-turbo',
    [
      // Không truyền --quantize: trọng số đã lượng tử sẵn trong model.
      '--model', model,
      '--prompt', prompt,
      '--negative-prompt', style.negative,
      '--width', String(WIDTH),
      '--height', String(HEIGHT),
      '--steps', String(style.steps),
      // KHÔNG truyền --guidance. Z-Image Turbo là model chưng cất, chạy không CFG,
      // nên mflux nhận cờ này rồi bỏ qua. Đã đo: cùng seed, guidance 1.8 và 3.0 cho
      // ra ảnh giống nhau từng điểm ảnh (PSNR = inf) — chỉ khác metadata trong PNG.
      // Để cờ đó lại là bày ra một cái nút không nối với gì.
      '--seed', String(seed),
      '--output', out,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );

  if (r.status !== 0 || !existsSync(out)) {
    failed.push(sc.id);
    warn(`${sc.id} vẽ hỏng: ${(r.stderr ?? '').trim().split('\n').slice(-2).join(' ')}`);
    continue;
  }

  done++;
  const sec = (Date.now() - at) / 1000;
  const left = ((todo.length - i - 1) * ((Date.now() - t0) / 1000 / (i + 1))) / 60;
  info(`${sc.id}  ${sec.toFixed(0)}s  (${i + 1}/${todo.length}, còn ~${left.toFixed(0)} phút)`);
}

if (dry) process.exit(0);

const mins = (Date.now() - t0) / 60000;
ok(`${done} ảnh trong ${mins.toFixed(1)} phút → content/${dir}/images/`);
if (failed.length) {
  warn(`${failed.length} ảnh hỏng: ${failed.join(', ')} — chạy lại: --only=${failed.join(',')}`);
  process.exitCode = 1;
}
