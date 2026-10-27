#!/usr/bin/env node
// short.json → props.json cho composition BrandShort.
//   node build-props.mjs <slug> [--lang=vi|en]
// Đổi phách ra frame, đo kích thước footage, rải SFX (impact, whoosh mỗi cú cắt, tiếng gõ phím
// khớp với `type` lúc quay, shimmer ở màn thương hiệu). Không render gì.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, ROOT, toTrackBeats, die, flagValue, FPS, hasFlag, loadShort, readJson, musicTiming, ok, sh, slugArg, tr, warn, writeJson } from './lib.mjs';

const dir = slugArg();
const lang = flagValue('lang', 'vi');
const short = loadShort(dir);
const timing = await musicTiming(dir, short);
const BEAT_FRAMES = timing.beatFrames;
// Cộng dồn phách rồi mới làm tròn, để mốc cắt không trôi khỏi nhịp khi một phách lẻ frame.
let beatClock = 0;
const span = (beats) => {
  const from = Math.round(beatClock * BEAT_FRAMES);
  beatClock += toTrackBeats(beats, timing);
  return Math.round(beatClock * BEAT_FRAMES) - from;
};
const shots = Object.fromEntries((short.capture?.shots ?? []).map((s) => [s.name, s]));
const defaultViewport = short.capture?.viewport ?? [540, 960, 2];

const probe = (file) => {
  const out = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).trim();
  const [w, h] = out.split(',').map(Number);
  return [w, h];
};

/** Cảnh terminal: tính frame bắt đầu của từng dòng, và tiếng gõ phím cho từng ký tự lệnh. */
const plain = (s) => s.replace(/\{[a-z]+\}|\{\/\}/g, '');
function terminal(sc, from) {
  const t = sc.terminal;
  const cps = t.cps ?? 18;
  let at = Math.round((t.start ?? 0.3) * FPS);
  const items = [];
  const ticks = [];
  for (const it of t.items) {
    if (it.wait !== undefined) {
      at += Math.round(it.wait * FPS);
    } else if (it.cmd !== undefined) {
      const text = tr(it.cmd, lang);
      items.push({ kind: 'cmd', text, from: at, perFrame: cps / FPS, prompt: it.prompt ?? t.prompt ?? '{green}$ {/}' });
      [...plain(text)].forEach((ch, k) => ch !== ' ' && ticks.push(from + at + Math.floor((k * FPS) / cps)));
      at += Math.ceil((plain(text).length * FPS) / cps) + Math.round((it.enter ?? 0.25) * FPS);
    } else {
      const text = tr(it.out, lang);
      items.push({ kind: 'out', text, from: at, perFrame: 0, prompt: '' });
      at += text.split('\n').length + Math.round((it.after ?? 0.1) * FPS);
    }
  }
  return { spec: { title: t.title ?? 'bash', fontSize: t.fontSize ?? 28, items }, end: at, ticks };
}
const terminalTicks = [];

const need = (rel) => {
  const file = join(ROOT, 'content', rel);
  if (!existsSync(file)) die(`thiếu content/${rel}`);
  return file;
};
const readJsonAt = (rel) => readJson(need(rel));

/** Biên độ (0–1) của `bars` cột trên đoạn [from, to] giây của một file âm thanh. */
function peaks(rel, from, to, bars) {
  const SR = 8000;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-t', String(to - from), '-i', need(rel), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
  const per = Math.floor(x.length / bars);
  const out = Array.from({ length: bars }, (_, b) => {
    let e = 0;
    for (let i = b * per; i < (b + 1) * per; i++) e += x[i] * x[i];
    return Math.sqrt(e / per);
  });
  const max = Math.max(...out) || 1;
  return out.map((v) => Math.round(Math.sqrt(v / max) * 1000) / 1000);
}

/** Cảnh đồ hoạ: đổi giây/phách ra frame, đọc dữ liệu thật (cuts.json, timing.json, sóng âm). */
function motion(sc, dur) {
  const m = sc.motion;
  if (m.type === 'split') return { type: 'split', before: m.before, after: m.after, labels: tr(m.labels, lang) ?? ['TRƯỚC', 'SAU'] };
  if (m.type === 'wave') {
    const [from, to] = [m.from ?? 0, m.to];
    let keep = m.keep;
    if (!keep) {
      const [file, id] = m.cuts.split('#');
      keep = readJsonAt(file).scenes[id].keep;
    }
    // Giữ phần nằm trong cửa sổ, đổi ra phần (0–1) của cửa sổ.
    const win = keep.map(([a, b]) => [Math.max(a, from), Math.min(b, to)]).filter(([a, b]) => b > a);
    const keptSeconds = win.reduce((n, [a, b]) => n + b - a, 0);
    const removed = to - from - keptSeconds;
    const fmt = (v) => (lang === 'en' ? v.toFixed(1) : v.toFixed(1).replace('.', ','));
    return {
      type: 'wave', file: m.label ?? m.audio.split('/').pop(), peaks: peaks(m.audio, from, to, m.bars ?? 90),
      keep: win.map(([a, b]) => [(a - from) / (to - from), (b - from) / (to - from)]),
      seconds: to - from, keptSeconds, cutAt: Math.round((m.cutAt ?? 0.55) * dur),
      labels: { silence: tr(m.silenceLabel, lang) ?? (lang === 'en' ? 'silence' : 'im lặng'), cut: `−${fmt(removed)}s ${tr(m.cutLabel, lang) ?? ''}`.trim() },
    };
  }
  if (m.type === 'words') {
    const [file, id] = m.timing.split('#');
    const from = (m.from ?? 0) * 1000;
    const words = readJsonAt(file).scenes[id].words
      .filter((w) => w.startMs >= from && (w.startMs - from) / 1000 < dur / FPS - 0.15)
      .map((w) => ({ text: w.text, from: Math.round(((w.startMs - from) / 1000) * FPS), to: Math.round(((w.endMs - from) / 1000) * FPS) }));
    return { type: 'words', words, tag: tr(m.tag, lang) ?? 'Whisper' };
  }
  if (m.type === 'pipeline') {
    const start = Math.round((m.start ?? 0.25) * FPS);
    const every = (dur - start - Math.round(0.9 * FPS)) / Math.max(1, m.steps.length - 1);
    return { type: 'pipeline', steps: m.steps.map((st, i) => ({ icon: st.icon, title: tr(st.title, lang), sub: tr(st.sub, lang) ?? '', at: Math.round(start + i * every) })) };
  }
  if (m.type === 'prompt') {
    need(m.image);
    const text = tr(m.text, lang);
    const typeEnd = Math.min(Math.round(dur * 0.5), 4 + Math.ceil((text.length / (m.cps ?? 70)) * FPS));
    return { type: 'prompt', label: tr(m.label, lang) ?? 'prompt', text, image: m.image, typeEnd, reveal: typeEnd + 8 };
  }
  if (m.type === 'gallery') {
    m.images.forEach(need);
    const every = Math.max(2, Math.floor((dur - 40) / m.images.length));
    return { type: 'gallery', images: m.images, every, badge: tr(m.badge, lang) ?? '' };
  }
  if (m.type === 'speak') {
    const seconds = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', need(m.audio)]).trim());
    if (seconds > dur / FPS - 0.3) warn(`cảnh "${sc.id}": câu nói ${seconds.toFixed(2)}s gần bằng/dài hơn cảnh`);
    return { type: 'speak', label: tr(m.label, lang) ?? '', text: tr(m.text, lang), peaks: peaks(m.audio, 0, seconds, m.bars ?? 70), seconds: Math.round(seconds * 100) / 100, tag: tr(m.tag, lang) ?? '' };
  }
  if (m.type === 'pages') {
    m.pages.forEach(need);
    const every = m.every ?? 4;
    return { type: 'pages', pages: m.pages, every, badge: tr(m.badge, lang) ?? '', badgeAt: m.pages.length * every + 22 };
  }
  if (m.type === 'acts') {
    // Đọc thẳng kichban.json: gộp các cảnh liền nhau cùng hồi / cùng nhạc thành từng khúc trên thanh.
    const k = readJsonAt(m.kichban);
    const total = k.scenes[k.scenes.length - 1].end;
    const runs = (key) => k.scenes.reduce((out, sc) => {
      const last = out[out.length - 1];
      if (last && last.key === sc[key]) last.to = sc.end;
      else out.push({ key: sc[key], from: sc.start, to: sc.end });
      return out;
    }, []);
    const COLOR = { hook: '#7dd3fc', lead: '#a5b4fc', twist: '#ff6b6b', explain: '#fcd34d', outro: '#86efac' };
    const acts = runs('part').map((r) => {
      const meta = m.acts?.[r.key] ?? {};
      return { name: tr(meta.name, lang) ?? r.key.toUpperCase(), from: r.from / total, to: r.to / total, icon: meta.icon ?? '🎬', job: tr(meta.job, lang) ?? '', color: COLOR[r.key] ?? '#cbd5e1' };
    });
    const music = runs('music').map((r) => ({ name: tr(m.music?.[r.key], lang) ?? r.key, from: r.from / total, to: r.to / total, silent: r.key === 'silent' }));
    return { type: 'acts', label: tr(m.label, lang) ?? 'kichban.json', seconds: total, sweep: [Math.round(0.4 * FPS), dur - Math.round(0.7 * FPS)], acts, music };
  }
  if (m.type === 'calc') {
    // "43.200 phút" → số đếm lên được; dấu nhóm/thập phân theo ngôn ngữ.
    const [group, dec] = lang === 'en' ? [',', '.'] : ['.', ','];
    const stampAt = Math.round(dur * 0.66);
    const every = (stampAt - 8) / m.rows.length;
    const rows = m.rows.map((r, i) => {
      const text = tr(r.value, lang);
      const hit = text.match(/^(.*?)(\d[\d.,]*\d|\d)(.*)$/);
      if (!hit) die(`cảnh "${sc.id}": "${text}" không có số`);
      const [, prefix, num, suffix] = hit;
      const decimals = num.includes(dec) ? num.split(dec)[1].length : 0;
      const value = Number(num.split(group).join('').replace(dec, '.'));
      return { label: tr(r.label, lang), at: Math.round(8 + i * every), prefix, value, decimals, dec, group, suffix };
    });
    return { type: 'calc', label: tr(m.label, lang) ?? '', rows, stamp: tr(m.stamp, lang), stampAt };
  }
  die(`cảnh "${sc.id}": motion.type "${m.type}" không có`);
}

/** Tiếng thật của cảnh (giọng, tiếng clip). */
const voiceOf = (sc) => (sc.voice ? { src: (need(sc.voice.src), sc.voice.src), startFrom: Math.round((sc.voice.skip ?? 0) * FPS), volume: sc.voice.volume ?? 1 } : null);

function scene(sc, from) {
  const dur = sc.dur ?? span(sc.beats ?? 6);
  if (sc.motion) {
    return {
      id: sc.id, from, dur, src: '', kind: 'motion', motion: motion(sc, dur), voice: voiceOf(sc), startFrom: 0, rate: 1,
      layout: 'full', keys: [], size: [1080, 1920], dpr: 1, lines: tr(sc.lines, lang) ?? [], big: !!sc.big,
    };
  }
  if (sc.terminal) {
    const { spec, end, ticks } = terminal(sc, from);
    if (end > dur) warn(`cảnh "${sc.id}": terminal chạy hết ${(end / FPS).toFixed(1)}s, dài hơn cảnh ${(dur / FPS).toFixed(1)}s (tăng beats hoặc cps)`);
    terminalTicks.push(...ticks.filter((f) => f < from + dur));
    return {
      id: sc.id, from, dur, src: '', kind: 'terminal', terminal: spec, startFrom: 0, rate: 1,
      layout: 'full', keys: [], size: [1080, 1920], dpr: 1, lines: tr(sc.lines, lang) ?? [], big: !!sc.big,
    };
  }
  let rel, kind = 'video', size, dpr;
  if (sc.src) {
    rel = sc.src.includes('/') ? sc.src : `${dir}/${sc.src}`;
    kind = /\.(png|jpe?g|webp)$/i.test(rel) ? 'image' : 'video';
    dpr = sc.dpr ?? 1;
  } else {
    const shot = shots[sc.shot ?? sc.id];
    if (!shot) die(`cảnh "${sc.id}": không có shot "${sc.shot ?? sc.id}" trong capture.shots`);
    // Bản ngôn ngữ khác dùng footage quay lại bằng giao diện ngôn ngữ đó nếu có (capture --lang).
    const localized = `${dir}/footage-${lang}/${shot.name}.mp4`;
    rel = lang !== 'vi' && existsSync(join(ROOT, 'content', localized)) ? localized : `${dir}/footage/${shot.name}.mp4`;
    dpr = (shot.viewport ?? defaultViewport)[2];
  }
  const file = join(ROOT, 'content', rel);
  if (!existsSync(file)) die(`thiếu content/${rel}. Chạy capture.mjs ${dir} trước.`);
  size = probe(file);
  const keys = (sc.keys ?? []).map((k) => ({ f: k.f ?? Math.round((k.beat ?? 0) * BEAT_FRAMES), cx: k.cx, cy: k.cy, zoom: k.zoom }));
  const rate = sc.rate ?? 1;
  const startFrom = Math.round((sc.skip ?? 0) * FPS);
  if (kind === 'video') {
    const seconds = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
    const need = (startFrom + dur * rate) / FPS;
    if (need > seconds + 0.05) warn(`cảnh "${sc.id}" cần ${need.toFixed(2)}s footage, chỉ có ${seconds.toFixed(2)}s: cảnh sẽ đứng hình ở cuối (quay dài hơn hoặc giảm beats / tăng rate)`);
  }
  const callouts = (sc.callouts ?? []).map((c) => ({ from: Math.round((c.at ?? 0) * FPS), y: c.y, side: c.side ?? 'left', text: tr(c.text, lang) }));
  return {
    id: sc.id, from, dur, src: rel, kind, startFrom, rate, voice: voiceOf(sc), callouts,
    layout: sc.layout ?? 'full', keys, size, dpr,
    lines: tr(sc.lines, lang) ?? [], big: !!sc.big,
  };
}

let t = 0;
const scenes = short.scenes.map((sc) => {
  const s = scene(sc, t);
  t += s.dur;
  return s;
});

let outro = null;
if (short.outro) {
  const o = short.outro;
  const dur = span(o.beats ?? 11);
  outro = {
    from: t, dur,
    scene: o.shot || o.src ? { ...scene({ ...o, id: 'outro', lines: [], dur }, 0), from: 0, dur } : null,
    title: tr(o.title, lang),
    subtitle: tr(o.subtitle, lang) ?? '',
    chips: tr(o.chips, lang) ?? [],
    link: o.link ?? null,
    linkIcon: o.linkIcon ?? (o.link?.includes('github.com') ? 'github' : 'web'),
    dim: o.dim ?? 0.62,
  };
  t += dur;
}

const e = short.endcard ?? {};
const endcard = {
  from: t,
  dur: span(e.beats ?? 5),
  follow: tr(e.follow, lang) ?? (lang === 'en' ? 'Follow @siri2moondev' : 'Theo dõi @siri2moondev'),
  lines: tr(e.lines, lang) ?? [],
  next: tr(short.series?.next, lang) ?? null,
};
t += endcard.dur;

// SFX dùng chung nằm ở content/_assets/short (music.mjs sinh). Nhạc nền mỗi video một bài.
const S = (name) => `_assets/short/${name}.wav`;
const sfx = [{ src: S('impact'), from: 0, dur: 90, volume: 0.75 }];
for (const s of [...scenes.slice(1), outro, endcard].filter(Boolean)) sfx.push({ src: S('whoosh'), from: Math.max(0, s.from - 7), dur: 30, volume: 0.32 });
short.scenes.forEach((sc, i) => {
  const shot = shots[sc.shot ?? sc.id];
  if (!shot?.type || sc.src) return;
  const { at, cps = 14, submit } = shot.type;
  const text = tr(shot.type.text, lang);
  const base = scenes[i].from - (sc.skip ?? 0) * FPS;
  [...text].forEach((ch, k) => {
    const f = Math.round(base + (at + k / cps) * FPS);
    if (f >= scenes[i].from && f < scenes[i].from + scenes[i].dur) sfx.push({ src: S('tick'), from: f, dur: 4, volume: ch === ' ' ? 0.12 : 0.22 });
  });
  if (submit) {
    const f = Math.round(base + (at + text.length / cps + submit) * FPS);
    if (f < scenes[i].from + scenes[i].dur) sfx.push({ src: S('pop'), from: f, dur: 12, volume: 0.45 });
  }
});
// Cảnh đồ hoạ: tiếng "xoẹt" khi khép khoảng lặng, tiếng pop mỗi bước pipeline / mỗi chữ hiện ra.
for (const sc of scenes.filter((x) => x.kind === 'motion')) {
  const m = sc.motion;
  if (m.type === 'wave') sfx.push({ src: S('whoosh'), from: sc.from + m.cutAt, dur: 30, volume: 0.5 }, { src: S('pop'), from: sc.from + m.cutAt + 14, dur: 12, volume: 0.45 });
  if (m.type === 'pipeline') for (const st of m.steps) sfx.push({ src: S('pop'), from: sc.from + st.at, dur: 12, volume: 0.32 });
  if (m.type === 'pages') {
    m.pages.forEach((_, i) => sfx.push({ src: S('tick'), from: sc.from + 2 + i * m.every + 6, dur: 4, volume: 0.3 }));
    sfx.push({ src: S('pop'), from: sc.from + m.badgeAt, dur: 12, volume: 0.45 });
  }
  if (m.type === 'acts') {
    // Đầu đọc đi theo easing inOut(sin): đổi vị trí khúc ra frame để pop đúng lúc bước vào hồi mới.
    const [a, b] = m.sweep;
    for (const act of m.acts.slice(1)) sfx.push({ src: S('pop'), from: sc.from + Math.round(a + ((b - a) * Math.acos(1 - 2 * act.from)) / Math.PI), dur: 12, volume: 0.32 });
  }
  if (m.type === 'calc') {
    for (const r of m.rows) sfx.push({ src: S('pop'), from: sc.from + r.at, dur: 12, volume: 0.35 });
    sfx.push({ src: S('impact'), from: sc.from + m.stampAt, dur: 90, volume: 0.6 });
  }
}
for (const f of terminalTicks) sfx.push({ src: S('tick'), from: f, dur: 4, volume: 0.2 });
if (outro) sfx.push({ src: S('shimmer'), from: outro.from + 20, dur: 96, volume: 0.55 });
sfx.push({ src: S('pop'), from: endcard.from + 4, dur: 12, volume: 0.35 });

const props = {
  id: short.id ?? dir,
  theme: short.theme ?? 'siri2moon',
  lang,
  fps: FPS,
  durationInFrames: t,
  chip: short.chip ? { title: tr(short.chip.title, lang), subtitle: tr(short.chip.subtitle, lang) ?? '' } : null,
  // Video thuộc một series nhiều tập: nhãn "TẬP 1/5" dưới chip suốt video.
  series: short.series
    ? { label: `${lang === 'en' ? 'EP' : 'TẬP'} ${short.series.ep}/${short.series.of}`, name: tr(short.series.name, lang) ?? '' }
    : null,
  scenes,
  outro,
  endcard,
  // --no-music: chỉ còn SFX, để thêm nhạc trending ngay trong app lúc đăng.
  bgm: hasFlag('no-music')
    ? null
    : timing.track
      ? { src: timing.track.src, volume: short.music?.volume ?? 1, trimBefore: 0, loop: timing.track.loops }
      : { src: `${dir}/audio/bgm.wav`, volume: short.music?.volume ?? 0.9, trimBefore: 0, loop: false },
  bpm: timing.bpm,
  sfx,
};
const suffix = [lang !== 'vi' && lang, hasFlag('no-music') && 'khong-nhac'].filter(Boolean).join('-');
const file = join(contentDir(dir), suffix ? `props-${suffix}.json` : 'props.json');
writeJson(file, props);
ok(`${file.replace(contentDir(dir) + '/', '')}: ${timing.bpm} BPM, ${scenes.length} cảnh${outro ? ' + thương hiệu' : ''} + màn kết, ${(t / FPS).toFixed(1)}s (${t} frame)`);
