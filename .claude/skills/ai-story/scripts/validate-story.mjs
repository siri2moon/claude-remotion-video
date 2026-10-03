#!/usr/bin/env node
// Kiểm story.json trước khi tiêu hàng tiếng đồng hồ sinh ảnh.
// Dùng: node validate-story.mjs content/<dir>/story.json
// Không phụ thuộc package nào.

import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'styles.json'), 'utf8'));

// Đo từ VieNeu-TTS trên 4 câu mẫu: 18,5 ký tự mỗi giây, sai số dưới 5%.
const CHARS_PER_SEC = 18.5;

const file = process.argv[2];
if (!file) {
  console.error('ERROR  dùng: node validate-story.mjs content/<dir>/story.json');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`ERROR  không thấy ${file}`);
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`ERROR  JSON hỏng: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const hasViet = (s) => /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(s);

// --- id phải trùng tên thư mục ----------------------------------------------

const DIR_RE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
if (!isStr(doc.id)) err('id: thiếu hoặc rỗng');
else if (!DIR_RE.test(doc.id))
  err(`id "${doc.id}" phải theo dạng <YYYY-MM-DD>-<HH>-<MM>-<slug>, vd 2026-08-18-09-23-nguoi-lai-do`);

const ownDir = basename(dirname(resolve(file)));
const parentDir = basename(dirname(dirname(resolve(file))));
if (parentDir === 'content' && isStr(doc.id) && doc.id !== ownDir)
  err(`id "${doc.id}" khác tên thư mục "${ownDir}" — hai thứ này phải trùng nhau`);

// --- Tiêu đề 2 dòng ----------------------------------------------------------

const t = doc.title;
if (!t || typeof t !== 'object') err('title: thiếu, cần { line1, line2 }');
else {
  for (const k of ['line1', 'line2']) {
    if (!isStr(t[k])) {
      err(`title.${k}: thiếu hoặc rỗng`);
      continue;
    }
    const v = t[k].trim();
    if (v !== v.toUpperCase()) err(`title.${k} phải VIẾT HOA toàn bộ: "${v}"`);
    // Anton hẹp, trần 150px, bề ngang cho phép 972px → quá ~20 ký tự là chữ tự
    // co lại. Trên 30 thì nhỏ tới mức mất tác dụng mồi.
    if (v.length > 30) err(`title.${k} dài ${v.length} ký tự — trên 30 thì chữ co lại quá nhỏ`);
    else if (v.length > 20) warn(`title.${k} dài ${v.length} ký tự, chữ sẽ co lại. Dưới 20 là đẹp nhất.`);
  }
}

// --- Giọng và phong cách -----------------------------------------------------

const VOICES = [
  'Minh Đức', 'Phạm Tuyên', 'Thái Sơn', 'Xuân Vĩnh', 'Thanh Bình', 'Trúc Ly', 'Ngọc Linh',
  'Đoan Trang', 'Mai Anh', 'Thục Đoan', 'Minh Triết', 'Thùy Dung', 'Quang Sơn', 'Ngọc Trân',
];
if (doc.voice !== undefined && !VOICES.includes(doc.voice))
  err(`voice "${doc.voice}" không có. Chọn: ${VOICES.join(', ')}`);

const style = doc.style ?? 'doodle';
if (!STYLES[style]) err(`style "${style}" không có. Có: ${Object.keys(STYLES).join(', ')}`);

// --- Dàn nhân vật ------------------------------------------------------------

const cast = doc.cast ?? [];
if (!Array.isArray(cast)) err('cast: phải là mảng');
const castIds = new Set();
cast.forEach((c, i) => {
  if (!isStr(c?.id)) err(`cast[${i}].id: thiếu`);
  else if (castIds.has(c.id)) err(`cast[${i}].id "${c.id}" bị trùng`);
  else castIds.add(c.id);

  if (!isStr(c?.look)) err(`cast[${i}].look: thiếu — phải tả ngoại hình bằng TIẾNG ANH`);
  else {
    if (hasViet(c.look)) err(`cast[${i}].look viết bằng tiếng Việt — model vẽ chỉ hiểu tiếng Anh`);
    if (c.look.trim().length < 40)
      warn(`cast[${i}].look chỉ ${c.look.trim().length} ký tự — tả sơ sài thì nhân vật mỗi cảnh một khác`);
  }
});

// --- Cảnh --------------------------------------------------------------------

const scenes = doc.scenes;
if (!Array.isArray(scenes) || scenes.length === 0) err('scenes: thiếu hoặc rỗng');

let totalChars = 0;
const sceneIds = new Set();
const sceneSecs = [];

(scenes ?? []).forEach((s, i) => {
  const at = `scenes[${i}]`;

  if (!isStr(s?.id)) err(`${at}.id: thiếu`);
  else if (!/^s\d{2,3}$/.test(s.id)) err(`${at}.id "${s.id}" phải dạng s01, s02…`);
  else if (sceneIds.has(s.id)) err(`${at}.id "${s.id}" bị trùng`);
  else sceneIds.add(s.id);

  if (!Array.isArray(s?.lines) || s.lines.length === 0) err(`${at}.lines: thiếu hoặc rỗng`);
  else {
    let chars = 0;
    s.lines.forEach((ln, j) => {
      if (!isStr(ln)) {
        err(`${at}.lines[${j}]: rỗng`);
        return;
      }
      chars += ln.trim().length;
      if (!hasViet(ln) && ln.trim().length > 25)
        warn(`${at}.lines[${j}] không thấy dấu tiếng Việt — lời bình phải là tiếng Việt có dấu`);
      // Một dòng phụ đề chỉ gói gọn 2 dòng chữ trên màn hình.
      if (ln.trim().length > 110)
        err(`${at}.lines[${j}] dài ${ln.trim().length} ký tự — cắt thành nhiều dòng, trên 110 là tràn phụ đề`);
      else if (ln.trim().length > 85)
        warn(`${at}.lines[${j}] dài ${ln.trim().length} ký tự — sát trần phụ đề 2 dòng`);
    });
    totalChars += chars;
    sceneSecs.push(chars / CHARS_PER_SEC);
  }

  if (!isStr(s?.image)) err(`${at}.image: thiếu — mô tả cảnh vẽ bằng TIẾNG ANH`);
  else if (hasViet(s.image)) err(`${at}.image viết bằng tiếng Việt — model vẽ chỉ hiểu tiếng Anh`);
  else if (s.image.trim().length < 30) warn(`${at}.image quá ngắn, ảnh sẽ nhạt và chung chung`);

  (s?.cast ?? []).forEach((id) => {
    if (!castIds.has(id)) err(`${at}.cast nhắc tới "${id}" nhưng cast không khai báo`);
  });
});

// --- Nhịp phim ---------------------------------------------------------------

const estSec = totalChars / CHARS_PER_SEC + (scenes?.length ?? 0) * 0.4;
sceneSecs.forEach((sec, i) => {
  if (sec > 8) warn(`scenes[${i}] (${scenes[i]?.id}) đứng ~${sec.toFixed(1)}s — tách bớt lời cho đỡ ì`);
  if (sec < 1.2 && sec > 0) warn(`scenes[${i}] (${scenes[i]?.id}) chỉ ~${sec.toFixed(1)}s — ảnh chưa kịp nhìn đã đổi`);
});

// --- Báo cáo -----------------------------------------------------------------

errors.forEach((m) => console.error(`ERROR  ${m}`));
warns.forEach((m) => console.log(`WARN   ${m}`));

if (scenes?.length) {
  const avg = estSec / scenes.length;
  console.log(
    `       ${scenes.length} cảnh · ~${Math.round(estSec)}s (${Math.floor(estSec / 60)}p${String(Math.round(estSec % 60)).padStart(2, '0')}) · mỗi ảnh ~${avg.toFixed(1)}s`,
  );
  // 200s/ảnh — đo thật trên M3 Pro 18GB ở 1216×784, 8 bước, bản 4-bit.
  console.log(`       sinh ảnh sẽ mất khoảng ${Math.ceil((scenes.length * 200) / 60)} phút`);
}

if (errors.length) {
  console.error(`ERROR  ${errors.length} lỗi — sửa rồi chạy lại`);
  process.exit(1);
}
console.log(`OK     story.json hợp lệ${warns.length ? ` (${warns.length} cảnh báo)` : ''}`);
