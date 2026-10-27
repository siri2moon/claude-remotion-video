#!/usr/bin/env node
// Kiểm short.json trước khi quay và dựng.
//   node validate.mjs <slug>
// ERROR chặn (sửa rồi chạy lại), WARN là chỗ nên xem lại, INFO để biết.

import { die, info, loadShort, musicTiming, ok, slugArg, toTrackBeats, warn } from './lib.mjs';

const dir = slugArg();
const s = loadShort(dir);
const errors = [];
// Độ dài phách theo bài nhạc (100 BPM nếu tổng hợp): footage phải đủ cho cảnh tính theo nhịp đó.
const timing = await musicTiming(dir, s);
const { bpm } = timing;
const secs = (beats) => toTrackBeats(beats, timing) * timing.beatS;
const err = (m) => errors.push(m);

// Phụ đề 66 px trên khung 960 px: khoảng 27 ký tự một dòng (dòng hook 74 px: 23). Emoji tính 2.
const width = (line) => [...line.replace(/\*/g, '').replace(/\p{Extended_Pictographic}️?/gu, 'MM')].length;
const langs = (v) => (v == null ? {} : Array.isArray(v) || typeof v === 'string' ? { vi: v } : v);

// Handle kênh là @siri2moondev; @siri2moon là tài khoản cá nhân của user.
const raw = JSON.stringify(s);
if (/@siri2moon(?![\w.])/.test(raw)) err('có "@siri2moon" trong short.json: handle kênh là @siri2moondev');
if (s.id !== dir) err(`id "${s.id}" phải đúng tên thư mục "${dir}"`);
if (!['lucifer', 'siri2moon'].includes(s.theme)) err(`theme "${s.theme}" phải là lucifer | siri2moon`);
if (!['project', 'post'].includes(s.kind)) err(`kind "${s.kind}" phải là project | post`);
if (!s.scenes?.length) err('scenes trống');

const shots = new Map((s.capture?.shots ?? []).map((x) => [x.name, x]));
if (shots.size !== (s.capture?.shots ?? []).length) err('capture.shots có name trùng nhau');
for (const shot of shots.values()) {
  if (!shot.seconds) err(`shot "${shot.name}" thiếu seconds`);
  const k = shot.keys?.[0];
  if (k && !k.pos && k.scroll === undefined) err(`shot "${shot.name}": key phải có pos+target (3D) hoặc scroll (trang)`);
  if (k?.pos && shot.keys.some((x) => !x.pos || !x.target)) err(`shot "${shot.name}": mọi key 3D cần cả pos và target`);
}

let total = 0;
const used = new Set();
const check = (sc, label) => {
  const shotName = sc.shot ?? sc.id;
  if (sc.motion) {
    const t = sc.motion.type;
    if (!['split', 'wave', 'words', 'pipeline', 'prompt', 'gallery', 'speak', 'pages', 'acts', 'calc'].includes(t)) err(`${label}: motion.type "${t}" không có (split | wave | words | pipeline | prompt | gallery | speak | pages | acts | calc)`);
    if (t === 'pages' && !(sc.motion.pages?.length >= 1 && sc.motion.pages.length <= 8)) err(`${label}: pages cần 1–8 ảnh trang`);
    if (t === 'acts' && !sc.motion.kichban) err(`${label}: acts cần kichban ("<dir>/kichban.json")`);
    if (t === 'calc' && !(sc.motion.rows?.length >= 1 && sc.motion.rows.length <= 3 && sc.motion.stamp)) err(`${label}: calc cần 1–3 rows và stamp`);
    if (t === 'prompt' && !(sc.motion.text && sc.motion.image)) err(`${label}: prompt cần text và image`);
    if (t === 'gallery' && !(sc.motion.images?.length >= 2 && sc.motion.images.length <= 12)) err(`${label}: gallery cần 2–12 images`);
    if (t === 'speak' && !(sc.motion.audio && sc.motion.text)) err(`${label}: speak cần audio và text`);
    if (t === 'speak' && !sc.voice) warn(`${label}: speak không có voice: sóng âm chạy mà không nghe tiếng`);
    if (t === 'split' && !(sc.motion.before && sc.motion.after)) err(`${label}: split cần before và after`);
    if (t === 'wave' && !(sc.motion.audio && sc.motion.to && (sc.motion.cuts || sc.motion.keep))) err(`${label}: wave cần audio, to, và cuts hoặc keep`);
    if (t === 'words' && !sc.motion.timing) err(`${label}: words cần timing ("<file>#<scene>")`);
    if (t === 'words' && !sc.voice) warn(`${label}: words không có voice: chữ sáng lên mà không nghe tiếng`);
    if (t === 'pipeline' && !(sc.motion.steps?.length >= 2 && sc.motion.steps.length <= 7)) err(`${label}: pipeline cần 2–7 steps`);
  } else if (sc.terminal) {
    if (!sc.terminal.items?.length) err(`${label}: terminal.items trống`);
  } else if (!sc.src) {
    const shot = shots.get(shotName);
    if (!shot) return err(`${label}: không có shot "${shotName}" trong capture.shots (hoặc đặt src cho ảnh/video sẵn có)`);
    used.add(shotName);
    const need = (sc.skip ?? 0) + secs(sc.beats ?? 6) * (sc.rate ?? 1);
    if (need > shot.seconds + 0.01) err(`${label}: cần ${need.toFixed(2)}s footage nhưng shot "${shotName}" chỉ quay ${shot.seconds}s`);
  }
  if (sc.layout === 'card' && !sc.keys?.length) err(`${label}: layout card cần keys { f, cx, cy, zoom }`);
};

s.scenes?.forEach((sc, i) => {
  const label = `cảnh "${sc.id}"`;
  check(sc, label);
  total += secs(sc.beats ?? 6);
  const byLang = langs(sc.lines);
  if (!byLang.vi?.length) err(`${label}: thiếu lines tiếng Việt`);
  if (byLang.vi?.length > 2) warn(`${label}: ${byLang.vi.length} dòng phụ đề, tối đa 2 cho dễ đọc`);
  for (const [lang, lines] of Object.entries(byLang)) {
    // Dòng đầu của cụm hai dòng nhỏ hơn 12%, nên chứa được nhiều chữ hơn.
    const maxAt = (j) => (sc.big ? 23 : j === 0 && lines.length > 1 ? 30 : 27);
    for (const [j, l] of lines.entries()) if (width(l) > maxAt(j)) warn(`${label} [${lang}]: "${l.replace(/\*/g, '')}" dài ${width(l)} ký tự (> ${maxAt(j)}), sẽ xuống dòng`);
    for (const l of lines) if ((l.match(/\*/g) ?? []).length % 2) err(`${label} [${lang}]: dấu * lẻ trong "${l}"`);
  }
  if (!byLang.en) info(`${label}: chưa có lines.en (bản tiếng Anh sẽ dùng tiếng Việt)`);
  if (i === 0 && !sc.big) warn('cảnh đầu nên có "big": true: đó là câu hook');
  if (i === 0 && (sc.beats ?? 6) > 6) warn(`cảnh hook dài ${sc.beats} phách (> 6 = 3,6s): người xem lướt qua trước khi hiểu`);
  if ((sc.beats ?? 6) > 8) warn(`${label}: ${sc.beats} phách (${secs(sc.beats).toFixed(1)}s), cảnh đứng lâu dễ mất người xem`);
});
if (s.outro) {
  if (s.outro.shot || !s.outro.src) s.outro.shot && check({ ...s.outro, id: 'outro' }, 'outro');
  if (!s.outro.title) err('outro thiếu title');
  total += secs(s.outro.beats ?? 11);
}
total += secs(s.endcard?.beats ?? 5);
for (const name of shots.keys()) if (!used.has(name)) info(`shot "${name}" được quay nhưng không dùng`);

const seconds = total;
if (seconds < 20 || seconds > 60) warn(`tổng ${seconds.toFixed(1)}s, nên trong 20–60s cho Shorts/Reels`);

if (errors.length) {
  errors.forEach((e) => console.error(`ERROR  ${e}`));
  die(`${errors.length} lỗi`);
}
ok(`short.json hợp lệ: ${s.scenes.length} cảnh, ${seconds.toFixed(1)}s ở ${bpm} BPM`);
