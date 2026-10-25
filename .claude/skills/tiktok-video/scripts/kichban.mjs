// Cầu nối votri-script → pipeline dựng video.
//
// Thư mục của skill votri-script có kichban.json chứ không có script.json. loadScript()
// là cửa vào DUY NHẤT để các stage đọc kịch bản: nếu thấy kichban.json thì dịch nó sang
// đúng shape script.json mà pipeline vốn hiểu, ghi ra content/<dir>/script.json (có cờ
// `derivedFrom`) rồi trả về. Thư mục của tiktok-script thì đọc thẳng script.json như cũ.
//
// script.json sinh ra ở đây là file phái sinh — sửa kichban.json, đừng sửa nó.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from './lib.mjs';

const ROLE = { hook: 'hook', lead: 'story', twist: 'punchline', explain: 'story', outro: 'cta' };
const STYLE = { hook: 'hook', lead: 'normal', twist: 'punch', explain: 'normal', outro: 'cta' };

// Nhạc nền nhỏ hơn bản selfie thường: video deadpan sống nhờ khoảng lặng và từng chữ nói chậm.
const BGM_VOLUME = 0.13;
// Video vô tri vẫn jump-cut, nhưng chừa lại một nhịp ngắn ở mỗi chỗ ngừng — cắt sạch
// như bản selfie thì giọng nghiêm trang biến thành giọng vội.
const LEAVE_GAP_SEC = 0.3;

const EMOJI_RE = /\p{Extended_Pictographic}️?/gu;

/** Cụm VIẾT HOA trong text màn hình chính là chỗ người viết muốn nhấn → highlight. */
// Xét theo TỪ, không theo ký tự: "Mì" mở đầu bằng chữ hoa nhưng không phải từ viết hoa.
// Từ không có chữ cái (số, "=", "—") được nối vào giữa một cụm nhưng không đứng ở hai đầu.
const capsRuns = (text) => {
  const runs = [];
  let cur = [];
  const flush = () => {
    while (cur.length && !cur[cur.length - 1].caps) cur.pop();
    while (cur.length && !cur[0].caps) cur.shift();
    const run = cur.map((t) => t.w).join(' ');
    if ([...run.replace(/[^\p{L}]/gu, '')].length >= 2) runs.push(run);
    cur = [];
  };
  for (const w of text.split(/\s+/)) {
    const letters = w.replace(/[^\p{L}]/gu, '');
    if (!letters) cur.push({ w, caps: false });
    else if (letters === letters.toUpperCase()) cur.push({ w, caps: true });
    else flush();
  }
  flush();
  return runs;
};

export const convertKichban = (k) => ({
  version: 1,
  id: k.id,
  derivedFrom: 'kichban.json',
  quote: k.input,
  title: k.title,
  durationSec: k.durationSec,
  fps: 30,
  width: 1080,
  height: 1920,
  audio: { bgm: k.scenes.find((s) => s.music && s.music !== 'silent')?.music ?? 'lofi', bgmVolume: BGM_VOLUME },
  edit: { leaveGapSec: LEAVE_GAP_SEC },
  scenes: k.scenes.map((s, i) => {
    const emoji = s.onScreen.match(EMOJI_RE)?.[0] ?? null;
    const text = s.onScreen.replace(EMOJI_RE, '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return {
      // Tên file footage lấy từ field `file` của cảnh — không suy ra từ thứ tự, để chèn hay
      // đổi chỗ cảnh không làm footage đã quay bị ghép nhầm.
      id: s.file,
      role: ROLE[s.part],
      part: s.part,
      label: s.label,
      startSec: s.start,
      endSec: s.end,
      voiceover: s.line.replace(/\s*\n\s*/g, ' '),
      caption: { text, highlight: capsRuns(text), style: STYLE[s.part], emoji },
      sfx: s.sfx ?? [],
      music: s.music ?? null,
      keepPauses: s.keepPauses ?? false,
      zoom: s.zoom ?? 'none',
      bRoll: null,
    };
  }),
});

/** Đọc kịch bản của một thư mục content/<dir>/, dịch từ kichban.json nếu cần. */
export const loadScript = (dir) => {
  const kPath = join(dir, 'kichban.json');
  const sPath = join(dir, 'script.json');
  if (!existsSync(kPath)) {
    if (!existsSync(sPath)) throw new Error(`không có script.json hay kichban.json trong ${dir}`);
    return readJson(sPath);
  }
  // Có kichban.json → script.json luôn là bản dịch. Sinh lại khi kichban mới hơn.
  if (existsSync(sPath) && statSync(sPath).mtimeMs >= statSync(kPath).mtimeMs) {
    const s = readJson(sPath);
    if (s.derivedFrom === 'kichban.json') return s;
  }
  const script = convertKichban(readJson(kPath));
  writeJson(sPath, script);
  return script;
};
