#!/usr/bin/env node
// Renders a short: build-props → music → Remotion render.
//   node render.mjs <slug>                 out/<dir>/<dir>.mp4
//   node render.mjs <slug> --lang=en       out/<dir>/<dir>-en.mp4 (English captions, same picture and music)
//   node render.mjs <slug> --no-music      out/<dir>/<dir>-khong-nhac.mp4: SFX only, to add trending music in the app
//   node render.mjs <slug> --stills        grabs one frame mid-scene → out/<dir>/<dir>-stills.jpg for review
//   node render.mjs <slug> --studio        opens Remotion Studio to scrub the timeline

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { contentDir, die, flagValue, hasFlag, info, ok, outDir, readJson, ROOT, SKILL, slugArg } from './lib.mjs';

const dir = slugArg();
const lang = flagValue('lang', 'vi');
const node = (script, ...args) => {
  const r = spawnSync('node', [join(SKILL, 'scripts', script), dir, ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Music follows the length of the Vietnamese cut; the English cut shares it, so the vi props are built first.
// ElevenLabs narration (only when short.json enables `narration`) must exist first, since it decides scene length.
node('narrate.mjs');
node('build-props.mjs', '--lang=vi');
// Music is regenerated every run (a few seconds) so it always matches the length; the same id yields the same track.
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
const out = outDir(dir);
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
