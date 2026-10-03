#!/usr/bin/env node
// Validator cho content/<dir>/kichban.json — không phụ thuộc package nào.
// Dùng: node .claude/skills/votri-script/scripts/validate.mjs content/<dir>/kichban.json
// Exit 0 nếu không có ERROR (WARN vẫn exit 0), exit 1 nếu có ERROR.

import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const PARTS = ['hook', 'lead', 'twist', 'explain', 'outro'];
const INPUT_TYPES = ['quote', 'pickup-line', 'saying', 'topic', 'story'];
// Deadpan đọc chậm hơn talking-head thường; quá ngưỡng này thì không còn chỗ cho khoảng lặng.
const MAX_WPS = 5;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const file = process.argv[2];
if (!file) {
  console.error('Thiếu tham số. Dùng: validate.mjs content/<dir>/kichban.json');
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(resolve(file), 'utf8'));
} catch (e) {
  console.error(`ERROR  Không đọc/parse được ${file}: ${e.message}`);
  process.exit(1);
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// ---------- top-level ----------
if (doc.version !== 1) err(`version phải là 1, đang là ${JSON.stringify(doc.version)}`);

const DIR_RE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
if (!isStr(doc.id)) err('id: thiếu hoặc rỗng');
else if (!DIR_RE.test(doc.id)) err(`id "${doc.id}" phải theo dạng <YYYY-MM-DD>-<HH>-<MM>-<slug>`);
const ownDir = basename(dirname(resolve(file)));
if (basename(dirname(dirname(resolve(file)))) === 'content' && isStr(doc.id) && doc.id !== ownDir) {
  err(`id "${doc.id}" khác tên thư mục "${ownDir}" — hai thứ này phải trùng nhau`);
}

for (const f of ['input', 'title', 'subtitle', 'shockLine', 'concept', 'persona', 'setting', 'caption']) {
  if (!isStr(doc[f])) err(`${f}: thiếu hoặc rỗng`);
}
if (!INPUT_TYPES.includes(doc.inputType)) err(`inputType "${doc.inputType}" không hợp lệ (${INPUT_TYPES.join(' | ')})`);

const lenCheck = (f, soft, hard) => {
  if (!isStr(doc[f])) return;
  const n = [...doc[f]].length;
  if (hard && n > hard) err(`${f} dài ${n} ký tự, trần ${hard}`);
  else if (n > soft) warn(`${f} dài ${n} ký tự (nên ≤ ${soft})`);
};
lenCheck('title', 28, 40);
lenCheck('subtitle', 50);
lenCheck('shockLine', 40);
lenCheck('caption', 220);

if (!Array.isArray(doc.props) || doc.props.length === 0 || !doc.props.every(isStr)) err('props: cần mảng ≥ 1 chuỗi');
if (!Array.isArray(doc.tips) || !doc.tips.every(isStr)) err('tips: cần mảng chuỗi');
else if (doc.tips.length < 3 || doc.tips.length > 6) warn(`tips có ${doc.tips.length} ý (nên 3–6)`);

if (!Array.isArray(doc.hashtags)) err('hashtags: cần mảng');
else {
  if (doc.hashtags.length < 5 || doc.hashtags.length > 8) warn(`hashtags có ${doc.hashtags.length} tag (nên 5–8)`);
  for (const h of doc.hashtags) {
    if (!/^#[a-z0-9]+$/.test(h)) err(`hashtag "${h}" phải là # + chữ thường không dấu/số, không khoảng trắng`);
  }
}

if (!isNum(doc.durationSec)) err('durationSec: thiếu hoặc không phải số');
else if (doc.durationSec < 45 || doc.durationSec > 120) err(`durationSec = ${doc.durationSec}, phải trong khoảng 45–120`);

// ---------- scenes ----------
const scenes = Array.isArray(doc.scenes) ? doc.scenes : [];
if (!Array.isArray(doc.scenes)) err('scenes: thiếu');
else if (scenes.length < 5 || scenes.length > 8) err(`scenes có ${scenes.length} cảnh, phải 5–8`);

let prevEnd = 0;
let prevPartIdx = -1;
const partCount = Object.fromEntries(PARTS.map((p) => [p, 0]));

scenes.forEach((s, i) => {
  const at = `scenes[${i}]`;
  const pIdx = PARTS.indexOf(s.part);
  if (pIdx < 0) err(`${at}.part "${s.part}" không hợp lệ (${PARTS.join(' | ')})`);
  else {
    partCount[s.part]++;
    if (pIdx < prevPartIdx) err(`${at}.part "${s.part}" đứng sau "${PARTS[prevPartIdx]}" — thứ tự phải hook → lead → twist → explain → outro`);
    prevPartIdx = Math.max(prevPartIdx, pIdx);
  }
  for (const f of ['label', 'camera', 'action', 'audio', 'line', 'onScreen']) {
    if (!isStr(s[f])) err(`${at}.${f}: thiếu hoặc rỗng`);
  }
  for (const f of ['voice', 'note']) {
    if (s[f] !== undefined && !isStr(s[f])) err(`${at}.${f}: nếu có thì phải là chuỗi không rỗng`);
  }
  if (!isNum(s.start) || !isNum(s.end)) {
    err(`${at}: start/end phải là số`);
    return;
  }
  if (s.start !== prevEnd) err(`${at}.start = ${s.start}, phải bằng end cảnh trước (${prevEnd})`);
  if (s.end <= s.start) err(`${at}: end (${s.end}) phải > start (${s.start})`);
  prevEnd = s.end;

  if (isStr(s.line)) {
    const wps = words(s.line) / (s.end - s.start);
    if (wps > MAX_WPS) warn(`${at} (${s.part}): thoại ${wps.toFixed(1)} từ/giây — quá nhanh cho deadpan (≤ ${MAX_WPS})`);
  }
  if (isStr(s.onScreen) && [...s.onScreen].length > 70) warn(`${at}.onScreen dài ${[...s.onScreen].length} ký tự (nên ≤ 70)`);
  if (/(haha|hihi|lol|\bkk+\b)/i.test(`${s.line ?? ''} ${s.action ?? ''}`)) {
    warn(`${at}: có "haha/lol" trong thoại hoặc diễn xuất — phá deadpan`);
  }
  if (/cười (tươi|lớn|phá lên|toe)|hào hứng|phấn khích/i.test(s.action ?? '')) {
    warn(`${at}.action có chỉ dẫn cười/hào hứng — phá deadpan`);
  }
});

if (scenes.length) {
  if (scenes[0].part !== 'hook') err('cảnh đầu phải là hook');
  if (scenes.at(-1).part !== 'outro') err('cảnh cuối phải là outro');
  for (const p of PARTS) {
    if (partCount[p] === 0) err(`thiếu phần "${p}"`);
    if (partCount[p] > 2) err(`phần "${p}" có ${partCount[p]} cảnh, tối đa 2`);
  }
  if (isNum(doc.durationSec) && prevEnd !== doc.durationSec) {
    err(`durationSec = ${doc.durationSec} nhưng cảnh cuối kết thúc ở ${prevEnd}`);
  }
}

// ---------- report ----------
for (const m of errors) console.log(`ERROR  ${m}`);
for (const m of warns) console.log(`WARN   ${m}`);
console.log(errors.length ? `\n✗ ${errors.length} lỗi, ${warns.length} cảnh báo` : `✓ hợp lệ (${warns.length} cảnh báo)`);
process.exit(errors.length ? 1 : 0);
