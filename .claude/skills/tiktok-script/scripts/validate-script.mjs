#!/usr/bin/env node
// Validator cho content/<dir>/script.json — không phụ thuộc package nào.
// Dùng: node .claude/skills/tiktok-script/scripts/validate-script.mjs content/<dir>/script.json
// Exit 0 nếu không có ERROR (WARN vẫn exit 0), exit 1 nếu có ERROR.

import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const ROLES = ['hook', 'story', 'punchline', 'cta'];
const STYLES = ['hook', 'normal', 'punch', 'cta'];
const BGM = ['lofi', 'chill', 'comedy', 'emotional', 'upbeat'];
const SFX = ['swoosh', 'pop', 'ding', 'sigh', 'record-scratch', 'typing', 'notification', 'boom', 'riser'];

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const file = process.argv[2];
if (!file) {
  console.error('Thiếu tham số. Dùng: validate-script.mjs <đường-dẫn>/script.json');
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
const isArr = (v) => Array.isArray(v);

// ---------- top-level ----------
if (doc.version !== 1) err(`version phải là 1, đang là ${JSON.stringify(doc.version)}`);
// id = tên thư mục chứa file này. shoot.md in ra `content/<id>/raw/` và preflight
// dựng đường dẫn footage từ tên thư mục, nên lệch nhau là hỏng cả pipeline.
const DIR_RE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
if (!isStr(doc.id)) err('id: thiếu hoặc rỗng');
else if (!DIR_RE.test(doc.id)) {
  err(`id "${doc.id}" phải theo dạng <YYYY-MM-DD>-<HH>-<MM>-<slug>, vd 2026-08-18-09-23-nhan-chi-so-tinh-ban-thien`);
}

const ownDir = basename(dirname(resolve(file)));
const parentDir = basename(dirname(dirname(resolve(file))));
if (parentDir === 'content' && isStr(doc.id) && doc.id !== ownDir) {
  err(`id "${doc.id}" khác tên thư mục "${ownDir}" — hai thứ này phải trùng nhau`);
}

for (const f of ['quote', 'title', 'topic', 'angle', 'context', 'tone', 'postCaption']) {
  if (!isStr(doc[f])) err(`${f}: thiếu hoặc rỗng`);
}
if (isStr(doc.postCaption) && doc.postCaption.length > 150) {
  warn(`postCaption dài ${doc.postCaption.length} ký tự (nên ≤ 150)`);
}

if (!isNum(doc.durationSec)) err('durationSec: thiếu hoặc không phải số');
else if (doc.durationSec < 20 || doc.durationSec > 60) err(`durationSec = ${doc.durationSec}, phải trong khoảng 20–60`);
else if (doc.durationSec < 30 || doc.durationSec > 45) warn(`durationSec = ${doc.durationSec}, khoảng ngọt là 30–45`);

if (doc.fps !== 30 && doc.fps !== 60) err(`fps phải là 30 hoặc 60, đang là ${JSON.stringify(doc.fps)}`);
if (doc.width !== 1080) err(`width phải là 1080, đang là ${JSON.stringify(doc.width)}`);
if (doc.height !== 1920) err(`height phải là 1920, đang là ${JSON.stringify(doc.height)}`);

// audio
if (!doc.audio || typeof doc.audio !== 'object') err('audio: thiếu');
else {
  if (!BGM.includes(doc.audio.bgm)) err(`audio.bgm "${doc.audio.bgm}" không hợp lệ (${BGM.join(' | ')})`);
  if (!isNum(doc.audio.bgmVolume)) err('audio.bgmVolume: thiếu hoặc không phải số');
  else if (doc.audio.bgmVolume < 0.1 || doc.audio.bgmVolume > 0.15) {
    warn(`audio.bgmVolume = ${doc.audio.bgmVolume}, nên trong khoảng 0.10–0.15`);
  }
}

// voice
if (!doc.voice || typeof doc.voice !== 'object') err('voice: thiếu');
else {
  if (doc.voice.lang !== 'vi-VN') err(`voice.lang phải là "vi-VN", đang là ${JSON.stringify(doc.voice.lang)}`);
  if (!['male', 'female'].includes(doc.voice.gender)) err(`voice.gender phải là male|female, đang là ${JSON.stringify(doc.voice.gender)}`);
  if (!isStr(doc.voice.style)) err('voice.style: thiếu hoặc rỗng');
}

// hashtags
if (!isArr(doc.hashtags)) err('hashtags: thiếu hoặc không phải mảng');
else {
  if (doc.hashtags.length < 5 || doc.hashtags.length > 8) warn(`hashtags có ${doc.hashtags.length} cái, nên 5–8`);
  doc.hashtags.forEach((h, i) => {
    if (!isStr(h) || !h.startsWith('#')) err(`hashtags[${i}] = ${JSON.stringify(h)} phải là chuỗi bắt đầu bằng "#"`);
  });
}

// ---------- scenes ----------
const scenes = doc.scenes;
if (!isArr(scenes) || scenes.length === 0) {
  err('scenes: thiếu hoặc rỗng');
} else {
  if (scenes.length < 4) err(`chỉ có ${scenes.length} scene, tối thiểu 4 (hook/story/punchline/cta)`);
  if (scenes.length > 6) warn(`có ${scenes.length} scene, tối đa nên là 6`);

  const roleCount = { hook: 0, story: 0, punchline: 0, cta: 0 };

  scenes.forEach((s, i) => {
    const tag = `scenes[${i}]`;
    const at = isStr(s?.id) ? `${tag} (${s.id})` : tag;

    if (!s || typeof s !== 'object') { err(`${tag}: không phải object`); return; }

    if (s.id !== `s${i + 1}`) err(`${at}: id phải là "s${i + 1}", đang là ${JSON.stringify(s.id)}`);
    if (!ROLES.includes(s.role)) err(`${at}: role ${JSON.stringify(s.role)} không hợp lệ (${ROLES.join(' | ')})`);
    else roleCount[s.role]++;

    if (!isStr(s.visual)) err(`${at}: visual thiếu hoặc rỗng`);
    if (!isStr(s.voiceover)) err(`${at}: voiceover thiếu hoặc rỗng`);
    if (!('bRoll' in s)) err(`${at}: thiếu field bRoll (dùng null nếu không có)`);
    else if (s.bRoll !== null && !isStr(s.bRoll)) err(`${at}: bRoll phải là chuỗi hoặc null`);

    // sfx
    if (!isArr(s.sfx)) err(`${at}: sfx phải là mảng (dùng [] nếu không có)`);
    else s.sfx.forEach((x) => { if (!SFX.includes(x)) warn(`${at}: sfx "${x}" không nằm trong danh sách chuẩn (${SFX.join(', ')})`); });

    // cueWords — mồi nhớ dán cạnh ống kính khi quay
    if (!isArr(s.cueWords)) {
      err(`${at}: thiếu cueWords (mảng 2–6 cụm mồi nhớ để dán cạnh ống kính)`);
    } else {
      if (s.cueWords.length < 2 || s.cueWords.length > 6) {
        err(`${at}: cueWords có ${s.cueWords.length} cụm, phải từ 2 đến 6`);
      }
      s.cueWords.forEach((w, k) => {
        if (!isStr(w)) err(`${at}: cueWords[${k}] phải là chuỗi không rỗng`);
        else if (w.length > 30) warn(`${at}: cueWords[${k}] dài ${w.length} ký tự — mồi nhớ nên ngắn, liếc là thấy`);
      });
      if (isStr(s.voiceover) && s.cueWords.some(isStr)) {
        const vo = s.voiceover.toLowerCase();
        const anchored = s.cueWords.filter((w) => isStr(w) && vo.includes(w.toLowerCase().split(/\s+/)[0]));
        if (anchored.length === 0) {
          warn(`${at}: không cụm cueWords nào bám vào voiceover — mồi nhớ nên lấy từ chính lời thoại`);
        }
      }
    }

    // timing
    if (!isNum(s.startSec) || !isNum(s.endSec)) {
      err(`${at}: startSec/endSec thiếu hoặc không phải số`);
    } else {
      if (s.endSec <= s.startSec) err(`${at}: endSec (${s.endSec}) phải lớn hơn startSec (${s.startSec})`);
      if (i === 0 && s.startSec !== 0) err(`${at}: scene đầu tiên phải có startSec = 0, đang là ${s.startSec}`);
      if (i > 0) {
        const prev = scenes[i - 1];
        if (isNum(prev?.endSec) && s.startSec !== prev.endSec) {
          err(`${at}: startSec (${s.startSec}) phải khít với endSec của scene trước (${prev.endSec})`);
        }
      }
      if (i === scenes.length - 1 && isNum(doc.durationSec) && s.endSec !== doc.durationSec) {
        err(`${at}: scene cuối phải có endSec = durationSec (${doc.durationSec}), đang là ${s.endSec}`);
      }

      const dur = s.endSec - s.startSec;
      if (s.role === 'hook' && dur > 4) err(`${at}: hook dài ${dur}s, tối đa 4s`);
      if (s.role === 'cta' && (dur < 4 || dur > 10)) warn(`${at}: cta dài ${dur}s, nên trong khoảng 4–10s`);

      // tốc độ nói
      if (isStr(s.voiceover) && dur > 0) {
        const words = s.voiceover.trim().split(/\s+/).length;
        const wps = words / dur;
        if (wps > 7.0) err(`${at}: ${words} từ trong ${dur}s = ${wps.toFixed(1)} từ/giây — quá nhồi, cắt bớt lời hoặc kéo dài scene`);
        else if (wps > 6.5) warn(`${at}: ${wps.toFixed(1)} từ/giây — hơi nhanh (ngọt là 4.0–6.5)`);
        else if (wps < 3.0) warn(`${at}: ${wps.toFixed(1)} từ/giây — quá thưa, dễ bị chết nhịp`);
      }
    }

    // caption
    const c = s.caption;
    if (!c || typeof c !== 'object') { err(`${at}: thiếu caption`); return; }
    if (!isStr(c.text)) err(`${at}: caption.text thiếu hoặc rỗng`);
    else {
      if (c.text.length > 90) err(`${at}: caption.text dài ${c.text.length} ký tự, trần cứng là 90`);
      else if (c.text.length > 60) warn(`${at}: caption.text dài ${c.text.length} ký tự, ngọt nhất là ≤ 60`);
    }
    if (!STYLES.includes(c.style)) err(`${at}: caption.style ${JSON.stringify(c.style)} không hợp lệ (${STYLES.join(' | ')})`);
    else if (ROLES.includes(s.role)) {
      const expected = { hook: 'hook', punchline: 'punch', cta: 'cta', story: 'normal' }[s.role];
      if (c.style !== expected) warn(`${at}: role "${s.role}" thường đi với caption.style "${expected}", đang dùng "${c.style}"`);
    }
    if (!isArr(c.highlight)) err(`${at}: caption.highlight phải là mảng (dùng [] nếu không có)`);
    else {
      if (c.highlight.length > 3) warn(`${at}: highlight ${c.highlight.length} cụm, tối đa nên 3`);
      if (isStr(c.text)) {
        c.highlight.forEach((h) => {
          if (!isStr(h)) err(`${at}: caption.highlight chứa phần tử không phải chuỗi`);
          else if (!c.text.includes(h)) err(`${at}: highlight "${h}" không xuất hiện nguyên văn trong caption.text`);
        });
      }
    }
    if (!('emoji' in c)) err(`${at}: thiếu caption.emoji (dùng null nếu không có)`);
    else if (c.emoji !== null && !isStr(c.emoji)) err(`${at}: caption.emoji phải là chuỗi hoặc null`);
  });

  // cơ cấu khối
  if (scenes[0]?.role !== 'hook') err('scene đầu tiên phải có role = "hook"');
  if (scenes[scenes.length - 1]?.role !== 'cta') err('scene cuối cùng phải có role = "cta"');
  if (roleCount.hook !== 1) err(`phải có đúng 1 scene role "hook", đang có ${roleCount.hook}`);
  if (roleCount.cta !== 1) err(`phải có đúng 1 scene role "cta", đang có ${roleCount.cta}`);
  if (roleCount.punchline !== 1) err(`phải có đúng 1 scene role "punchline", đang có ${roleCount.punchline}`);
  if (roleCount.story < 1) err('phải có ít nhất 1 scene role "story"');

  // quote phải được đọc nguyên văn trong khối punchline
  const punch = scenes.find((s) => s?.role === 'punchline');
  if (punch && isStr(doc.quote) && isStr(punch.voiceover)) {
    const norm = (t) => t.toLowerCase().replace(/[.,!?…"'"'"]/g, '').replace(/\s+/g, ' ').trim();
    if (!norm(punch.voiceover).includes(norm(doc.quote))) {
      warn('voiceover của scene punchline không chứa nguyên văn câu quote — nên đọc đủ 1 lần ở khối này');
    }
  }

  if (scenes.every((s) => !s?.bRoll)) warn('không scene nào có bRoll — cân nhắc thêm 1 cảnh chèn cho đỡ đơn điệu');
  const cta = scenes[scenes.length - 1];
  if (cta?.caption && !cta.caption.emoji) warn('caption của scene CTA nên có 1 emoji chỉ hướng (vd 👇)');
}

// ---------- report ----------
const name = doc.id ? `${doc.id}` : file;
for (const m of errors) console.log(`ERROR  ${m}`);
for (const m of warns) console.log(`WARN   ${m}`);

if (errors.length === 0 && warns.length === 0) {
  console.log(`OK     ${name} — ${doc.scenes?.length} scene, ${doc.durationSec}s. Không có vấn đề.`);
} else {
  console.log(`\n${name}: ${errors.length} error, ${warns.length} warn`);
}

process.exit(errors.length > 0 ? 1 : 0);
