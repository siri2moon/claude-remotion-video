#!/usr/bin/env node
// Quay footage cho một short, từng frame theo đồng hồ ảo, theo phần `capture` của short.json.
//   node capture.mjs <slug> [--only=a,b] [--preview]
//
// --preview  chụp 8 frame mỗi shot, xuất footage/preview/<shot>.jpg (dải ảnh) + preview/all.jpg để soi
//            góc máy trong vài giây. Bản thật thì bỏ cờ này.
// --lang=en  quay bản giao diện tiếng Anh vào footage-en/ (setup đọc __cap.lang). Bản vi vào footage/.
// --only     chỉ quay lại vài shot. Shot bị bỏ qua vẫn chạy `actions` của nó để trạng thái trang
//            (task đang chạy, cho nghỉ…) giống lúc quay cả bộ.
//
// Mỗi shot ra footage/<name>.mp4, 30 fps, đúng kích thước viewport × dpr.
// Đặc tả: references/capture.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch } from './cdp.mjs';
import { contentDir, die, FPS, flagValue, hasFlag, info, loadShort, ok, slugArg, tr } from './lib.mjs';

const dir = slugArg();
const short = loadShort(dir);
const cap = short.capture ?? die('short.json thiếu phần "capture"');
const only = flagValue('only')?.split(',');
const preview = hasFlag('preview');
const DT = 1000 / FPS;
const lang = flagValue('lang', 'vi');
const outDir = join(contentDir(dir), lang === 'vi' ? 'footage' : `footage-${lang}`);
mkdirSync(outDir, { recursive: true });

const defaultViewport = cap.viewport ?? [540, 960, 2];
const page = await launch({ width: defaultViewport[0], height: defaultViewport[1] });
let viewport = null;
const setViewport = async ([w, h, dpr]) => {
  if (viewport && viewport.join() === [w, h, dpr].join()) return;
  viewport = [w, h, dpr];
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 700 });
};
await setViewport(defaultViewport);
await page.send('Animation.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./director.js', import.meta.url), 'utf8') });

const asyncJs = (body) => `(async () => { ${body}; return true })()`;
const open = async (url) => {
  await page.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, (cap.loadWait ?? 4) * 1000));
  await page.evaluate(`(() => { if (!document.getElementById('cap-style')) { const s = document.createElement('style'); s.id = 'cap-style'; document.head.appendChild(s); } return true })()`);
};

try {
  await open(cap.url);
  await page.evaluate(`__cap.lang = ${JSON.stringify(lang)}`);
  if (cap.setup) await page.evaluate(asyncJs(cap.setup));
  await page.evaluate(`__cap.start()`);
} catch (e) {
  await page.close();
  die(`không mở được ${cap.url}: ${e.message}. Dự án đã chạy chưa? (references/projects.md)`);
}

const ease = {
  linear: (x) => x,
  inOut: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
  out: (x) => 1 - (1 - x) ** 3,
  in: (x) => x ** 3,
};

/** Catmull-Rom qua các key, thời gian giữa các key được ease chung. */
function sample(keys, field, t) {
  if (keys.length === 1) return keys[0][field];
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k.t && t <= keys[j + 1].t);
  if (i < 0) i = t < keys[0].t ? 0 : keys.length - 2;
  const a = keys[i], b = keys[i + 1];
  const u = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const p0 = (keys[i - 1] ?? a)[field], p1 = a[field], p2 = b[field], p3 = (keys[i + 2] ?? b)[field];
  const cr = (x0, x1, x2, x3) => 0.5 * (2 * x1 + (-x0 + x2) * u + (2 * x0 - 5 * x1 + 4 * x2 - x3) * u * u + (-x0 + 3 * x1 - 3 * x2 + x3) * u * u * u);
  return Array.isArray(p1) ? p1.map((_, k) => cr(p0[k], p1[k], p2[k], p3[k])) : cr(p0, p1, p2, p3);
}

/** Key cuộn trang: số px, hoặc "selector" / "selector+120" (đỉnh phần tử, cộng lệch). */
async function resolveScroll(keys) {
  const out = [];
  for (const k of keys) {
    if (typeof k.scroll !== 'string') {
      out.push(k);
      continue;
    }
    const m = k.scroll.match(/^(.*?)([+-]\d+)?$/);
    const top = await page.evaluate(`__cap.top(${JSON.stringify(m[1].trim())})`);
    if (top == null) die(`scroll: không tìm thấy "${m[1]}" trên trang`);
    out.push({ ...k, scroll: top + Number(m[2] ?? 0) });
  }
  return out;
}

const stateAt = (shot, keys, t) => {
  const e = (ease[shot.ease ?? 'inOut'])(t);
  if (keys[0].pos) {
    const withFov = keys.map((k) => ({ ...k, fov: k.fov ?? keys[0].fov ?? 45 }));
    return { pose: { pos: sample(keys, 'pos', e), target: sample(keys, 'target', e), fov: sample(withFov, 'fov', e) } };
  }
  if (keys[0].scroll !== undefined) return { scroll: sample(keys, 'scroll', e) };
  return {};
};
const applyState = (s) =>
  page.evaluate(`(() => { __cap.pose = ${JSON.stringify(s.pose ?? null)}; __cap.scroll = ${s.scroll ?? null}; return true })()`);

// CSS animation chạy theo giờ thật, còn trang thì theo đồng hồ ảo: chỉnh tốc độ timeline
// theo thời gian thật trung bình mỗi frame để hai bên khớp nhau.
let realPerFrame = DT;
const step = async () => {
  const t0 = Date.now();
  await page.evaluate(`__cap.step(${DT})`);
  return t0;
};

const run = (a) => {
  if (a.insert !== undefined) return page.send('Input.insertText', { text: a.insert });
  if (a.key) return page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: a.key }).then(() => page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: a.key }));
  return page.evaluate(asyncJs(a.js));
};

const sheets = [];
for (const shot of cap.shots) {
  if (only && !only.includes(shot.name)) {
    for (const a of shot.actions ?? []) if (a.js) await page.evaluate(asyncJs(a.js));
    continue;
  }
  const started = Date.now();
  await setViewport(shot.viewport ?? defaultViewport);
  if (shot.url) await open(shot.url);
  const extraCss = cap.shotSetup ? await page.evaluate(`(async () => (${cap.shotSetup})(${JSON.stringify(shot)}))()`) : '';
  await page.evaluate(`(() => { document.getElementById('cap-style').textContent = ${JSON.stringify(`${cap.css ?? ''} ${extraCss ?? ''} ${shot.css ?? ''}`)}; return true })()`);

  const actions = [...(shot.actions ?? [])];
  if (shot.type) {
    const { at, selector, cps = 14, submit } = shot.type;
    const text = tr(shot.type.text, lang);
    actions.push({ at: at - 0.01, js: `document.querySelector(${JSON.stringify(selector)}).focus()` });
    [...text].forEach((ch, i) => actions.push({ at: at + i / cps, insert: ch }));
    if (submit) actions.push({ at: at + text.length / cps + submit, js: `document.querySelector(${JSON.stringify(selector)}).form.requestSubmit()` });
  }
  actions.sort((a, b) => a.at - b.at);
  for (const a of actions.filter((a) => a.at < 0)) await run(a);
  const pending = actions.filter((a) => a.at >= 0);

  const keys = shot.keys?.length ? await resolveScroll(shot.keys) : [{ t: 0 }];
  await applyState(stateAt(shot, keys, 0));
  // Trang vừa tải có thể còn tự cuộn về đầu (hydrate, scroll restoration): cho nó chạy xong.
  await step();
  await new Promise((r) => setTimeout(r, 400));
  const preroll = Math.round((shot.preroll ?? 0.5) * FPS);
  for (let i = 0; i < preroll; i++) await step();

  const frames = Math.round(shot.seconds * FPS);
  const every = preview ? Math.max(1, Math.ceil(frames / 8)) : 1;
  const tmp = join(outDir, `.${shot.name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  let written = 0;
  for (let f = 0; f < frames; f++) {
    while (pending.length && pending[0].at * FPS <= f) await run(pending.shift());
    await applyState(stateAt(shot, keys, frames > 1 ? f / (frames - 1) : 0));
    const t0 = await step();
    if (f % every === 0) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
      writeFileSync(join(tmp, `${String(written++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    }
    realPerFrame = realPerFrame * 0.9 + (Date.now() - t0) * 0.1;
    if (f % 15 === 0) await page.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, DT / Math.max(realPerFrame, 1)) });
  }
  await page.send('Animation.setPlaybackRate', { playbackRate: 1 });

  if (preview) {
    mkdirSync(join(outDir, 'preview'), { recursive: true });
    const sheet = join(outDir, 'preview', `${shot.name}.jpg`);
    const n = readdirSync(tmp).length;
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(tmp, '%05d.jpg'), '-vf', `scale=240:-2,tile=${Math.min(n, 8)}x1`, '-frames:v', '1', sheet]);
    sheets.push(sheet);
  } else {
    const mp4 = join(outDir, `${shot.name}.mp4`);
    const enc = spawnSync('ffmpeg', [
      '-v', 'error', '-y', '-framerate', String(FPS), '-i', join(tmp, '%05d.jpg'),
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-movflags', '+faststart', mp4,
    ]);
    if (enc.status !== 0) die(enc.stderr.toString());
  }
  rmSync(tmp, { recursive: true, force: true });
  ok(`${shot.name}: ${frames} frame trong ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
await page.close();

if (preview && sheets.length) {
  // Dải ảnh các shot chồng lên nhau, rộng theo dải dài nhất.
  const all = join(outDir, 'preview', 'all.jpg');
  const args = sheets.flatMap((s) => ['-i', s]);
  const pads = sheets.map((_, i) => `[${i}]pad=1920:ih:0:0:black[p${i}]`).join(';');
  const stack = sheets.map((_, i) => `[p${i}]`).join('') + `vstack=${sheets.length}`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', sheets.length > 1 ? `${pads};${stack}` : `[0]pad=1920:ih:0:0:black`, all]);
  info(`xem nháp: ${all}`);
}
if (!existsSync(outDir)) die('không ra footage nào');
