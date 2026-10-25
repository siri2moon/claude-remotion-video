#!/usr/bin/env node
// Stage 5 — gộp script + media + timing + cuts, tính lại toàn bộ timeline theo footage THẬT.
// Dùng: node build-props.mjs <slug>
// Ra:   content/<dir>/props.json  ← input duy nhất của Remotion composition

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, info, norm, ok, readJson, slugArg, tokenize, warn, writeJson } from './lib.mjs';
import { loadScript } from './kichban.mjs';
import { ensureMusic, ensureSfx } from './audio-synth.mjs';

const ZOOM = 1.06;
const MAX_WORDS_PER_PAGE = 3;
const MAX_GAP_SEC = 0.35;
const MAX_PAGE_SEC = 1.6;
const PAGE_HOLD_SEC = 0.4;
const TITLE_DELAY_SEC = 0.15;
const TITLE_SHOW_SEC = 2.6;
const SFX_VOLUME = 0.55;
const MUSIC_FADE_SEC = 0.25;

const slug = slugArg();
const dir = contentDir(slug);

const need = (name) => {
  const p = join(dir, name);
  if (!existsSync(p)) die(`thiếu content/${slug}/${name} — chạy stage sinh ra nó trước`);
  return readJson(p);
};

const script = loadScript(dir);
const media = need('media.json');
const timingDoc = need('timing.json');
const cuts = need('cuts.json');

const fps = script.fps;
const sec = (s) => Math.round(s * fps);

const clips = [];
const titles = [];
const captions = [];
const sfx = [];
const missingSfx = new Set();
const missingMusic = new Set();
const sceneSpans = []; // { music, from, to } để dựng các đoạn nhạc nền sau vòng lặp

let cursor = 0;
let clipIndex = 0;
let droppedPages = 0;

for (const m of media.scenes) {
  const scene = script.scenes.find((s) => s.id === m.sceneId);
  const cut = cuts.scenes[m.sceneId];
  const timing = timingDoc.scenes[m.sceneId];
  if (!scene || !cut || !timing) die(`dữ liệu không khớp cho scene ${m.sceneId} — chạy lại pipeline từ preflight`);

  const sceneStart = cursor;
  const firstClip = clips.length;

  // --- footage: mỗi đoạn giữ lại là một clip ---
  const segments = [];
  for (const [a, b] of cut.keep) {
    const trimBefore = sec(a);
    const trimAfter = sec(b);
    const durationInFrames = trimAfter - trimBefore;
    if (durationInFrames <= 0) continue;
    clips.push({
      src: m.src,
      fromFrame: cursor,
      durationInFrames,
      trimBefore,
      trimAfter,
      // so le zoom giữa các đoạn liền nhau → jump-cut trông như đổi góc máy
      zoom: clipIndex % 2 === 0 ? 1 : ZOOM,
      sceneId: m.sceneId,
    });
    segments.push({ srcStart: a, srcEnd: b, frames: durationInFrames });
    cursor += durationInFrames;
    clipIndex++;
  }
  const sceneEnd = cursor;
  const sceneFrames = sceneEnd - sceneStart;
  if (sceneFrames <= 0) {
    warn(`${m.sceneId}: không còn frame nào sau khi cắt — bỏ qua scene này`);
    continue;
  }
  sceneSpans.push({ music: scene.music ?? null, from: sceneStart, to: sceneEnd });

  // --- hiệu ứng zoom cả scene (votri-script): snap = giật vào mắt, push = đẩy chậm ---
  if (scene.zoom === 'snap' || scene.zoom === 'push') {
    for (const c of clips.slice(firstClip)) {
      c.zoom = 1;
      c.fx = { kind: scene.zoom, sceneOffset: c.fromFrame - sceneStart, sceneFrames };
    }
  }

  // --- ánh xạ thời gian trong file gốc → frame trên timeline tổng ---
  // Đây là chỗ dễ off-by-one nhất của cả pipeline: phần đã cắt phải bị trừ đi.
  const toTimeline = (srcSec) => {
    let acc = 0;
    for (const s of segments) {
      if (srcSec < s.srcStart) return sceneStart + acc;
      if (srcSec <= s.srcEnd) return sceneStart + acc + Math.round((srcSec - s.srcStart) * fps);
      acc += s.frames;
    }
    return sceneStart + acc;
  };
  const clamp = (f) => Math.max(sceneStart, Math.min(sceneEnd, f));

  // --- từ + thời điểm ---
  const hlSet = new Set((scene.caption.highlight ?? []).flatMap((h) => tokenize(h).map(norm)));
  const words = timing.words
    .map((w) => {
      const from = clamp(toTimeline(w.startMs / 1000));
      const to = clamp(toTimeline(w.endMs / 1000));
      return { text: w.text, fromFrame: from, toFrame: Math.max(from + 2, to), highlight: hlSet.has(norm(w.text)) };
    })
    .filter((w) => w.fromFrame < sceneEnd);

  // --- gom thành page 2–3 từ kiểu TikTok ---
  const pages = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    pages.push(buf);
    buf = [];
  };
  for (const w of words) {
    const gap = buf.length ? w.fromFrame - buf[buf.length - 1].toFrame : 0;
    const span = buf.length ? w.toFrame - buf[0].fromFrame : 0;
    if (buf.length >= MAX_WORDS_PER_PAGE || gap > sec(MAX_GAP_SEC) || span > sec(MAX_PAGE_SEC)) flush();
    buf.push(w);
  }
  flush();

  pages.forEach((page, i) => {
    const from = page[0].fromFrame;
    const lastEnd = page[page.length - 1].toFrame;
    // Giữ phụ đề trên màn hình tới khi page kế tiếp thay thế, tối đa +0.4s.
    const nextStart = i + 1 < pages.length ? pages[i + 1][0].fromFrame : sceneEnd;
    const durationInFrames = Math.min(nextStart - from, lastEnd - from + sec(PAGE_HOLD_SEC));
    // KHÔNG có sàn tối thiểu ở đây. Khi jump-cut cắt bạo tay, nhiều từ bị clamp
    // về cùng một frame và page co lại còn 0 — ép nó lên 4 frame thì page này
    // tràn sang page sau, hai cụm chữ chồng lên nhau giữa màn hình.
    if (durationInFrames < 2) {
      droppedPages++;
      return;
    }
    captions.push({
      fromFrame: from,
      durationInFrames,
      // vai của scene → cỡ chữ + màu khối nền của phụ đề (xem remotion/src/tokens.ts)
      style: scene.caption.style,
      tokens: page.map((w) => ({
        text: w.text,
        fromFrame: w.fromFrame - from,
        toFrame: w.toFrame - from,
        highlight: w.highlight,
      })),
    });
  });

  // --- chữ to tiêu đề khối ---
  const titleFrom = sceneStart + sec(TITLE_DELAY_SEC);
  const titleDur = Math.min(sec(TITLE_SHOW_SEC), sceneEnd - titleFrom);
  if (titleDur > sec(0.4)) {
    titles.push({
      fromFrame: titleFrom,
      durationInFrames: titleDur,
      text: scene.caption.text,
      highlight: scene.caption.highlight ?? [],
      style: scene.caption.style,
      emoji: scene.caption.emoji ?? null,
    });
  }

  // --- sfx: tự sinh nếu chưa có file; tên lạ mà user chưa bỏ file thì bỏ qua, không chặn ---
  // Mỗi mục là "tên" (đặt ở đầu scene) hoặc { name, at: start|end|pause, word, volume }.
  for (const item of scene.sfx ?? []) {
    const spec = typeof item === 'string' ? { name: item } : item;
    if (!ensureSfx(spec.name)) {
      missingSfx.add(spec.name);
      continue;
    }
    sfx.push({ src: `_assets/sfx/${spec.name}.mp3`, atFrame: sfxFrame(spec), volume: spec.volume ?? SFX_VOLUME });
  }

  /** Mốc thời gian của một SFX trên timeline tổng. */
  function sfxFrame(spec) {
    if (spec.word) {
      // Neo vào từ ĐẦU TIÊN của cụm (phụ đề tách theo từng từ một).
      const key = norm(tokenize(spec.word)[0]);
      const hit = words.find((w) => norm(w.text) === key);
      if (hit) return hit.fromFrame;
      warn(`${m.sceneId}: SFX "${spec.name}" neo vào từ "${spec.word}" nhưng không thấy từ đó trong thoại — đặt ở đầu scene`);
      return sceneStart;
    }
    if (spec.at === 'end') return Math.max(sceneStart, sceneEnd - sec(0.6));
    if (spec.at === 'pause') {
      // Khoảng lặng dài nhất trong scene, tính cả đoạn trước từ đầu tiên — chỗ người diễn
      // "im 2 giây". SFX vào ngay sau khi câu trước dứt.
      let best = { at: sceneStart, len: words.length ? words[0].fromFrame - sceneStart : 0 };
      for (let i = 1; i < words.length; i++) {
        const len = words[i].fromFrame - words[i - 1].toFrame;
        if (len > best.len) best = { at: words[i - 1].toFrame, len };
      }
      return best.at + sec(0.1);
    }
    return sceneStart;
  }
}

// --- nhạc nền ---
// Kịch bản có `music` theo scene (votri-script) → nhiều đoạn nhạc, đổi bài theo phần,
// 'silent' là tắt hẳn. Không có → một bài chạy suốt video như bản selfie cũ.
const perScene = sceneSpans.some((x) => x.music);
let bgm = null;
const music = [];
if (perScene) {
  for (const span of sceneSpans) {
    const name = span.music ?? 'silent';
    const last = music[music.length - 1];
    if (last && last.name === name && last.to === span.from) last.to = span.to;
    else music.push({ name, from: span.from, to: span.to });
  }
} else if (ensureMusic(script.audio.bgm)) {
  bgm = { src: `_assets/bgm/${script.audio.bgm}.mp3`, volume: script.audio.bgmVolume };
} else {
  missingMusic.add(script.audio.bgm);
}
const musicSegments = music
  .filter((x) => x.name !== 'silent')
  .filter((x) => (ensureMusic(x.name) ? true : (missingMusic.add(x.name), false)))
  .map((x) => ({
    src: `_assets/bgm/${x.name}.mp3`,
    fromFrame: x.from,
    durationInFrames: x.to - x.from,
    volume: script.audio.bgmVolume,
    fadeFrames: sec(MUSIC_FADE_SEC),
  }));

const props = {
  slug,
  quote: script.quote,
  fps,
  durationInFrames: cursor,
  bgm,
  music: musicSegments,
  clips,
  titles,
  captions,
  sfx,
};

if (cursor <= 0) die('timeline rỗng — kiểm tra lại cuts.json');

writeJson(join(dir, 'props.json'), props);

const secs = (cursor / fps).toFixed(1);
ok(`${clips.length} clip · ${captions.length} page phụ đề · ${titles.length} tiêu đề · ${secs}s → content/${slug}/props.json`);

const planned = script.durationSec;
const drift = Math.abs(cursor / fps - planned) / planned;
if (drift > 0.25) {
  info(`thành phẩm ${secs}s so với kịch bản dự kiến ${planned}s — timeline lấy theo footage thật, đây là bình thường`);
}
if (droppedPages) {
  warn(
    `bỏ ${droppedPages} page phụ đề vì không còn chỗ trên timeline — jump-cut đã cắt quá tay. ` +
      `Chạy lại detect-cuts với --silence-db=-40 hoặc --no-cut.`,
  );
}
if (perScene) info(`nhạc nền: ${music.map((x) => `${x.name} ${(x.from / fps).toFixed(1)}–${(x.to / fps).toFixed(1)}s`).join(' → ')}`);
if (missingMusic.size) info(`không có nhạc: ${[...missingMusic].map((n) => `content/_assets/bgm/${n}.mp3`).join(', ')} — tên này không tự sinh được, bỏ file vào đó`);
if (missingSfx.size) info(`không có SFX: ${[...missingSfx].map((n) => `content/_assets/sfx/${n}.mp3`).join(', ')} — tên này không tự sinh được, bỏ file vào đó`);
