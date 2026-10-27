#!/usr/bin/env node
// Dựng short: build-props → nhạc → Remotion render.
//   node render.mjs <slug>                 out/<dir>.mp4
//   node render.mjs <slug> --lang=en       out/<dir>-en.mp4 (phụ đề tiếng Anh, cùng hình và nhạc)
//   node render.mjs <slug> --no-music      out/<dir>-khong-nhac.mp4: chỉ SFX, để gắn nhạc trending trong app
//   node render.mjs <slug> --stills        chỉ chụp một khung giữa mỗi cảnh → out/<dir>-stills.jpg để duyệt
//   node render.mjs <slug> --studio        mở Remotion Studio để tua timeline

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { contentDir, die, flagValue, hasFlag, info, ok, readJson, ROOT, SKILL, slugArg } from './lib.mjs';

const dir = slugArg();
const lang = flagValue('lang', 'vi');
const node = (script, ...args) => {
  const r = spawnSync('node', [join(SKILL, 'scripts', script), dir, ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Nhạc tính theo độ dài bản tiếng Việt; bản tiếng Anh dùng chung nên build bản vi trước.
node('build-props.mjs', '--lang=vi');
// Nhạc sinh lại mỗi lần (vài giây) để luôn khớp độ dài; cùng id thì ra cùng một bài.
node('music.mjs');
const noMusic = hasFlag('no-music');
if (lang !== 'vi' || noMusic) node('build-props.mjs', `--lang=${lang}`, ...(noMusic ? ['--no-music'] : []));

const suffix = [lang !== 'vi' && lang, noMusic && 'khong-nhac'].filter(Boolean).join('-');
const propsFile = join(contentDir(dir), suffix ? `props-${suffix}.json` : 'props.json');
const props = readJson(propsFile);
const remotion = join(ROOT, 'remotion');
const npx = (args) => {
  const r = spawnSync('npx', ['remotion', ...args, '--public-dir=../content', `--props=${propsFile}`], { cwd: remotion, stdio: 'inherit' });
  if (r.status !== 0) die('remotion lỗi, xem log phía trên');
};
const out = join(ROOT, 'out');
mkdirSync(out, { recursive: true });
const name = suffix ? `${dir}-${suffix}` : dir;

if (hasFlag('studio')) {
  npx(['studio', 'src/index.ts']);
} else if (hasFlag('stills')) {
  const frames = [
    ...props.scenes.map((s) => s.from + Math.round(s.dur * 0.72)),
    ...(props.outro ? [props.outro.from + Math.min(props.outro.dur - 2, 130)] : []),
    props.endcard.from + props.endcard.dur - 10,
  ];
  const tmp = join(out, `.${name}-stills`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  frames.forEach((f, i) => {
    const r = spawnSync('npx', ['remotion', 'still', 'BrandShort', join(tmp, `${String(i).padStart(2, '0')}.jpg`), `--frame=${f}`, '--image-format=jpeg', '--log=error', '--public-dir=../content', `--props=${propsFile}`], { cwd: remotion, stdio: 'ignore' });
    if (r.status !== 0) die(`không chụp được frame ${f}`);
  });
  const sheet = join(out, `${name}-stills.jpg`);
  const cols = Math.min(frames.length, 6);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(tmp, '%02d.jpg'), '-vf', `scale=360:-2,tile=${cols}x${Math.ceil(frames.length / cols)}`, '-frames:v', '1', sheet]);
  rmSync(tmp, { recursive: true, force: true });
  ok(`khung duyệt: ${sheet}`);
} else {
  const mp4 = join(out, `${name}.mp4`);
  npx(['render', 'BrandShort', mp4, '--codec=h264', '--crf=16', '--audio-codec=aac', '--audio-bitrate=256k', '--log=error']);
  const r = spawnSync('ffmpeg', ['-nostats', '-i', mp4, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = r.stderr.match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/)?.[1];
  ok(`${mp4} · ${(props.durationInFrames / props.fps).toFixed(1)}s · ${lufs ?? '?'} LUFS`);
  info('Âm lượng hợp nền tảng: -16 đến -12 LUFS.');
}
