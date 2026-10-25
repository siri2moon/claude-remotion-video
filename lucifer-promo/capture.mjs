// Record the Lucifer office frame by frame, on a virtual clock, along scripted camera paths.
//   node lucifer-promo/capture.mjs <shots.json> <out dir> [--only=name,name] [--every=N] [--scale=0.5]
//
// The office (localhost:5173) and an engine must be running. Shots run in order in one page,
// so the company's state carries over from shot to shot (tasks keep working, break time lasts).
// Each shot becomes <out dir>/<name>.mp4 at 30 fps, at the viewport's pixel size.
//
// Shot fields:
//   name, seconds          the clip's name and length
//   keys                   camera keyframes [{ t: 0..1, pos, target, fov? }], eased and splined
//   ease                   "inOut" (default) | "linear" | "out"
//   preroll                seconds to run (unrecorded) with the camera at the first key
//   actions                [{ at: seconds, js: "page expression" }]; at < 0 runs before the preroll
//   labels                 show the agents' name tags (default true)
//   hud                    show the office HUD (default false)
//   viewport               [w, h, dpr] for this shot (default 540x960 @2, i.e. 1080x1920)
//   type                   { at, selector, text, cps?, submit?: seconds after typing } types into an input
//   css                    extra CSS for this shot

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch } from './cdp.mjs';

const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const [shotsFile, outDir] = args.filter((a) => !a.startsWith('--'));
const only = flag('only')?.split(',');
const every = Number(flag('every') ?? 1);
const FPS = 30;
const DT = 1000 / FPS;

const shots = JSON.parse(readFileSync(shotsFile, 'utf8'));
mkdirSync(outDir, { recursive: true });

const page = await launch({ width: 540, height: 960 });
let viewport = null;
const setViewport = async ([w, h, dpr]) => {
  if (viewport && viewport.join() === [w, h, dpr].join()) return;
  viewport = [w, h, dpr];
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
};
await setViewport([540, 960, 2]);
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./director.js', import.meta.url), 'utf8') });
await page.send('Page.navigate', { url: 'http://localhost:5173/' });
await new Promise((r) => setTimeout(r, 6000));
await page.evaluate(`__cap.init()`);
await page.evaluate(`(() => {
  const s = __cap.office.getState();
  s.setLang('vi');
  s.closeGuide();
  if (s.followWork) s.toggleFollow();
  const style = document.createElement('style');
  style.id = 'cap-style';
  document.head.appendChild(style);
  return true;
})()`);
await page.evaluate(`__cap.start()`);

const ease = {
  linear: (x) => x,
  inOut: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
  out: (x) => 1 - (1 - x) ** 3,
  in: (x) => x ** 3,
};

/** Catmull-Rom through the keys' values, with the time between keys eased as a whole. */
function sample(keys, field, t) {
  if (keys.length === 1) return keys[0][field];
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k.t && t <= keys[j + 1].t);
  if (i < 0) i = t < keys[0].t ? 0 : keys.length - 2;
  const a = keys[i], b = keys[i + 1];
  const u = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const p0 = (keys[i - 1] ?? a)[field], p1 = a[field], p2 = b[field], p3 = (keys[i + 2] ?? b)[field];
  const cr = (x0, x1, x2, x3) =>
    0.5 * (2 * x1 + (-x0 + x2) * u + (2 * x0 - 5 * x1 + 4 * x2 - x3) * u * u + (-x0 + 3 * x1 - 3 * x2 + x3) * u * u * u);
  return Array.isArray(p1) ? p1.map((_, k) => cr(p0[k], p1[k], p2[k], p3[k])) : cr(p0, p1, p2, p3);
}

const poseAt = (shot, t) => {
  const e = (ease[shot.ease ?? 'inOut'])(t);
  const keys = shot.keys;
  return {
    pos: sample(keys, 'pos', e),
    target: sample(keys, 'target', e),
    fov: keys[0].fov !== undefined ? sample(keys.map((k) => ({ ...k, fov: k.fov ?? keys[0].fov })), 'fov', e) : 45,
  };
};

const step = () => page.evaluate(`__cap.step(${DT})`);

for (const shot of shots) {
  if (only && !only.includes(shot.name)) {
    // Skipped shots still run their actions so the company is in the right state later.
    for (const a of shot.actions ?? []) if (a.js) await page.evaluate(a.js);
    continue;
  }
  const t0 = Date.now();
  await setViewport(shot.viewport ?? [540, 960, 2]);
  await page.evaluate(`(() => {
    document.getElementById('cap-style').textContent = \`${shot.hud ? '' : '.hud { display: none !important; }'} ${shot.labels === false ? '.labels { display: none !important; }' : ''} ${shot.css ?? ''}\`;
    const s = __cap.office.getState();
    if (${!!shot.hud} !== s.panelsVisible) s.togglePanels();
    return true;
  })()`);

  const actions = [...(shot.actions ?? [])];
  // Typing into the office, one character at a time, as a person would.
  if (shot.type) {
    const { at, selector, text, cps = 14, submit } = shot.type;
    actions.push({ at: at - 0.01, js: `document.querySelector(${JSON.stringify(selector)}).focus()` });
    [...text].forEach((ch, i) => actions.push({ at: at + i / cps, insert: ch }));
    if (submit) actions.push({ at: at + text.length / cps + submit, js: `document.querySelector(${JSON.stringify(selector)}).form.requestSubmit()` });
  }
  actions.sort((a, b) => a.at - b.at);
  const run = (a) => (a.insert !== undefined ? page.send('Input.insertText', { text: a.insert }) : page.evaluate(a.js));
  for (const a of actions.filter((a) => a.at < 0)) await run(a);
  const pending = actions.filter((a) => a.at >= 0);

  await page.evaluate(`__cap.pose = ${JSON.stringify(poseAt(shot, 0))}`);
  const preroll = Math.round((shot.preroll ?? 0.5) * FPS);
  for (let i = 0; i < preroll; i++) {
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    await step();
  }

  const frames = Math.round(shot.seconds * FPS);
  const dir = join(outDir, `.${shot.name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let written = 0;
  for (let f = 0; f < frames; f++) {
    while (pending.length && pending[0].at * FPS <= f) await run(pending.shift());
    await page.evaluate(`__cap.pose = ${JSON.stringify(poseAt(shot, frames > 1 ? f / (frames - 1) : 0))}`);
    await step();
    if (f % every !== 0) continue;
    const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
    writeFileSync(join(dir, `${String(written++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
  }
  const mp4 = join(outDir, `${shot.name}.mp4`);
  const enc = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(FPS / every), '-i', join(dir, '%05d.jpg'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-movflags', '+faststart', mp4,
  ]);
  if (enc.status !== 0) throw new Error(enc.stderr.toString());
  rmSync(dir, { recursive: true, force: true });
  console.log(`${shot.name}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

await page.close();
