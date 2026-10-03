#!/usr/bin/env node
// Sinh thư mục cho một kịch bản mới: content/<YYYY-MM-DD>-<HH>-<MM>-<slug>
// Dùng: node .claude/skills/votri-script/scripts/new-dir.mjs <slug-không-dấu>
// In ra: TÊN THƯ MỤC, đúng một dòng, không kèm "content/".
//        Dùng luôn chuỗi đó làm `id` trong kichban.json — hai thứ phải trùng nhau.
//
// Bắt buộc chạy script này thay vì tự gõ ngày giờ: model chỉ biết ngày, không
// biết giờ trên máy, đoán bừa thì tên thư mục sai lệch với lúc thật sự tạo.

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');

const slug = process.argv[2];
if (!slug) {
  console.error('ERROR  thiếu <slug>. Dùng: node new-dir.mjs chien-luoc-tan-gai-vi-mo');
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`ERROR  slug "${slug}" phải là kebab-case không dấu, vd chien-luoc-tan-gai-vi-mo`);
  process.exit(1);
}
if (/^\d{4}-\d{2}-\d{2}/.test(slug)) {
  console.error(`ERROR  slug "${slug}" đã có sẵn tiền tố ngày — truyền phần slug thôi, script tự gắn ngày giờ`);
  process.exit(1);
}

const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;

// Hai kịch bản viết trong cùng một phút vẫn phải ra hai thư mục.
let name = `${stamp}-${slug}`;
for (let v = 2; existsSync(join(ROOT, 'content', name)); v++) name = `${stamp}-${slug}-v${v}`;

mkdirSync(join(ROOT, 'content', name), { recursive: true });
console.log(name);
