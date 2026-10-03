#!/usr/bin/env node
// Stage cuối — render ra mp4.
// Dùng: node render.mjs <slug> [--studio] [--frame=N]
//   --studio   mở Remotion Studio để xem trước thay vì render
//   --frame=N  render đúng một frame ra out/<dir>-fN.png — soi bố cục cực nhanh
// Ra:   out/<dir>.mp4

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, contentDir, die, flagValue, hasFlag, info, ok, slugArg } from './lib.mjs';

const slug = slugArg();
const dir = contentDir(slug);
const remotionDir = join(ROOT, 'remotion');

if (!existsSync(join(remotionDir, 'node_modules'))) {
  die('chưa cài package. Chạy: cd remotion && pnpm install');
}

const propsPath = join(dir, 'props.json');
if (!existsSync(propsPath)) die(`thiếu content/${slug}/props.json — chạy build-props.mjs trước`);

// publicDir = content/ nên staticFile('<dir>/images/s01.png') và
// staticFile('_assets/bgm/lofi.mp3') đều trỏ đúng.
const common = ['--public-dir', join(ROOT, 'content'), `--props=${propsPath}`];

if (hasFlag('studio')) {
  info('mở Remotion Studio — Ctrl+C để thoát');
  spawnSync('pnpm', ['exec', 'remotion', 'studio', ...common], { cwd: remotionDir, stdio: 'inherit' });
  process.exit(0);
}

mkdirSync(join(ROOT, 'out'), { recursive: true });

const frame = flagValue('frame', null);
if (frame !== null) {
  const png = join(ROOT, 'out', `${slug}-f${frame}.png`);
  const s = spawnSync(
    'pnpm',
    ['exec', 'remotion', 'still', 'StoryVideo', png, `--frame=${frame}`, ...common],
    { cwd: remotionDir, stdio: 'inherit' },
  );
  if (s.status !== 0) process.exit(s.status ?? 1);
  ok(`out/${slug}-f${frame}.png`);
  process.exit(0);
}

const outFile = join(ROOT, 'out', `${slug}.mp4`);
const r = spawnSync('pnpm', ['exec', 'remotion', 'render', 'StoryVideo', outFile, ...common], {
  cwd: remotionDir,
  stdio: 'inherit',
});

if (r.status !== 0) process.exit(r.status ?? 1);
ok(`out/${slug}.mp4`);
