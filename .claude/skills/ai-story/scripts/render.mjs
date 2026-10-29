#!/usr/bin/env node
// Final stage: render the mp4.
// Usage: node render.mjs <slug> [--studio] [--frame=N]
//   --studio   open Remotion Studio to preview instead of rendering
//   --frame=N  render a single frame to out/<dir>/<dir>-fN.png: the fastest way to check a layout
// Output:   out/<dir>/<dir>.mp4

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, contentDir, die, flagValue, hasFlag, info, ok, outDir, slugArg } from './lib.mjs';

const slug = slugArg();
const dir = contentDir(slug);
const remotionDir = join(ROOT, 'remotion');

if (!existsSync(join(remotionDir, 'node_modules'))) {
  die('chưa cài package. Chạy: cd remotion && pnpm install');
}

const propsPath = join(dir, 'props.json');
if (!existsSync(propsPath)) die(`thiếu content/${slug}/props.json — chạy build-props.mjs trước`);

// publicDir = content/, so staticFile('<dir>/images/s01.png') and
// staticFile('_assets/bgm/lofi.mp3') both resolve.
const common = ['--public-dir', join(ROOT, 'content'), `--props=${propsPath}`];

if (hasFlag('studio')) {
  info('mở Remotion Studio — Ctrl+C để thoát');
  spawnSync('pnpm', ['exec', 'remotion', 'studio', ...common], { cwd: remotionDir, stdio: 'inherit' });
  process.exit(0);
}

const out = outDir(slug);

const frame = flagValue('frame', null);
if (frame !== null) {
  const png = join(out, `${slug}-f${frame}.png`);
  const s = spawnSync(
    'pnpm',
    ['exec', 'remotion', 'still', 'StoryVideo', png, `--frame=${frame}`, ...common],
    { cwd: remotionDir, stdio: 'inherit' },
  );
  if (s.status !== 0) process.exit(s.status ?? 1);
  ok(`out/${slug}/${slug}-f${frame}.png`);
  process.exit(0);
}

const outFile = join(out, `${slug}.mp4`);
const r = spawnSync('pnpm', ['exec', 'remotion', 'render', 'StoryVideo', outFile, ...common], {
  cwd: remotionDir,
  stdio: 'inherit',
});

if (r.status !== 0) process.exit(r.status ?? 1);
ok(`out/${slug}/${slug}.mp4`);
