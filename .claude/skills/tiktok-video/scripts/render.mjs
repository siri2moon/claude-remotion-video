#!/usr/bin/env node
// Stage 6 — render ra mp4.
// Dùng: node render.mjs <slug> [--studio]
//   --studio  mở Remotion Studio để xem trước thay vì render
// Ra:   out/<dir>.mp4

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, contentDir, die, hasFlag, info, ok, slugArg } from './lib.mjs';

const slug = slugArg();
const dir = contentDir(slug);
const remotionDir = join(ROOT, 'remotion');

if (!existsSync(join(remotionDir, 'node_modules'))) {
  die('chưa cài package. Chạy: cd remotion && pnpm install');
}

const propsPath = join(dir, 'props.json');
if (!existsSync(propsPath)) die(`thiếu content/${slug}/props.json — chạy build-props.mjs trước`);

// publicDir = content/ nên staticFile('<slug>/raw/s1.mov') và
// staticFile('_assets/bgm/lofi.mp3') đều trỏ đúng.
const publicDir = join(ROOT, 'content');

const common = ['--public-dir', publicDir, `--props=${propsPath}`];

if (hasFlag('studio')) {
  info('mở Remotion Studio — Ctrl+C để thoát');
  spawnSync('pnpm', ['exec', 'remotion', 'studio', ...common], { cwd: remotionDir, stdio: 'inherit' });
  process.exit(0);
}

mkdirSync(join(ROOT, 'out'), { recursive: true });
const outFile = join(ROOT, 'out', `${slug}.mp4`);

const r = spawnSync(
  'pnpm',
  ['exec', 'remotion', 'render', 'TikTokVideo', outFile, ...common],
  { cwd: remotionDir, stdio: 'inherit' },
);

if (r.status !== 0) process.exit(r.status ?? 1);
ok(`out/${slug}.mp4`);
