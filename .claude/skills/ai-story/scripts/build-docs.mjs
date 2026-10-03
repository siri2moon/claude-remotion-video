#!/usr/bin/env node
// story.json → story.md (bảng kịch bản để người đọc và duyệt trước khi tốn máy).
// Dùng: node build-docs.mjs content/<dir>/story.json
//
// story.md sinh tự động, ĐỪNG SỬA TAY. Sửa story.json rồi chạy lại.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const CHARS_PER_SEC = 18.5; // đo từ VieNeu-TTS

const file = process.argv[2];
if (!file) {
  console.error('ERROR  dùng: node build-docs.mjs content/<dir>/story.json');
  process.exit(1);
}

const doc = JSON.parse(readFileSync(file, 'utf8'));
const out = join(dirname(resolve(file)), 'story.md');

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let clock = 0.35; // lead-in trong tts.mjs
const rows = [];
for (const sc of doc.scenes) {
  const chars = sc.lines.reduce((n, l) => n + l.trim().length, 0);
  const sec = chars / CHARS_PER_SEC;
  rows.push({
    id: sc.id,
    at: mmss(clock),
    sec,
    lines: sc.lines,
    image: sc.image,
    cast: sc.cast ?? [],
  });
  clock += sec + 0.38;
}

const md = `# ${doc.title.line1} / ${doc.title.line2}

> Sinh tự động từ \`story.json\`. **Đừng sửa file này** — sửa \`story.json\` rồi chạy lại \`build-docs.mjs\`.

| | |
|---|---|
| Thư mục | \`content/${doc.id}/\` |
| Chủ đề | ${esc(doc.topic ?? '—')} |
| Giọng đọc | ${esc(doc.voice ?? 'Thanh Bình')}${doc.voiceRef ? ` (nhân bản từ \`${doc.voiceRef}\`)` : ''} |
| Phong cách tranh | ${esc(doc.style ?? 'doodle')} |
| Số cảnh | ${doc.scenes.length} |
| Dài ước tính | ${mmss(clock)} |

## Tiêu đề trên màn hình

Đứng yên suốt video, hai dòng:

1. **${doc.title.line1}** — vàng chanh, viền đen
2. **${doc.title.line2}** — đỏ, viền trắng

## Dàn nhân vật

${
  (doc.cast ?? []).length === 0
    ? '_Không khai báo nhân vật cố định._'
    : `| id | Ngoại hình (nhét vào mọi cảnh có mặt) |
|---|---|
${doc.cast.map((c) => `| \`${c.id}\` | ${esc(c.look)} |`).join('\n')}`
}

## Kịch bản

| # | Vào lúc | Dài | Lời bình | Cảnh vẽ |
|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.at} | ${r.sec.toFixed(1)}s | ${r.lines.map(esc).join('<br>')} | ${esc(r.image)}${r.cast.length ? `<br>_(${r.cast.join(', ')})_` : ''} |`,
  )
  .join('\n')}

## Chạy tiếp

\`\`\`bash
S=.claude/skills/ai-story/scripts
node $S/tts.mjs          ${doc.id}
node $S/images.mjs       ${doc.id}
node $S/build-props.mjs  ${doc.id}
node $S/render.mjs       ${doc.id}
\`\`\`
`;

writeFileSync(out, md);
console.log(`OK     ${out.replace(process.cwd() + '/', '')}`);
