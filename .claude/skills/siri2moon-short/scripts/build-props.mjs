#!/usr/bin/env node
// short.json → props.json for the BrandShort composition.
//   node build-props.mjs <slug> [--lang=vi|en]
// Converts beats to frames, measures footage size, and lays out SFX (impact, a whoosh per cut, key clicks
// matching the `type` used while capturing, shimmer on the brand screen). Renders nothing.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, ROOT, toTrackBeats, die, flagValue, FPS, hasFlag, loadShort, readJson, musicTiming, narrationOf, ok, sh, slugArg, tr, VOICE_IN, warn, writeJson } from './lib.mjs';

const dir = slugArg();
const lang = flagValue('lang', 'vi');
const short = loadShort(dir);
const timing = await musicTiming(dir, short);
const BEAT_FRAMES = timing.beatFrames;
// Accumulate beats before rounding, so cuts do not drift off the beat when a beat has a fractional frame count.
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

/** Terminal scene: start frame of each line, and a key click for each typed command character. */
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

/** Amplitude (0–1) of `bars` columns over the [from, to] seconds of an audio file. */
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

/** Motion scene: converts seconds/beats to frames and reads real data (cuts.json, timing.json, waveforms). */
function motion(sc, dur) {
  const m = sc.motion;
  if (m.type === 'split') return { type: 'split', before: tr(m.before, lang), after: tr(m.after, lang), labels: tr(m.labels, lang) ?? ['TRƯỚC', 'SAU'] };
  if (m.type === 'wave') {
    const [from, to] = [m.from ?? 0, m.to];
    let keep = m.keep;
    if (!keep) {
      const [file, id] = m.cuts.split('#');
      keep = readJsonAt(file).scenes[id].keep;
    }
    // Keep what falls inside the window, as fractions (0–1) of the window.
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
    // Read kichban.json directly: merge adjacent scenes sharing an act / a music cue into one segment on the bar.
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
    // "43.200 phút" → a number that can count up; grouping/decimal separators follow the language.
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
  if (m.type === 'statusline') {
    // Run the post's actual statusline script with JSON mimicking Claude Code, once per quota level,
    // then split the ANSI output into groups at │: the colors on screen are what the real script prints.
    const script = need(m.script);
    const resetAt = Math.floor(Date.now() / 1000) + (m.resetIn ?? 8070);
    const levels = m.mode === 'quota' ? m.quota : [m.quota?.[0] ?? 64];
    const start = Math.round(0.3 * FPS);
    const every = (dur - start - Math.round(0.9 * FPS)) / Math.max(1, levels.length - 1);
    const states = levels.map((left, i) => {
      const input = structuredClone(m.input);
      input.rate_limits = { ...input.rate_limits, five_hour: { used_percentage: 100 - left, resets_at: resetAt } };
      const out = spawnSync('bash', [script], { input: JSON.stringify(input), encoding: 'utf8', cwd: ROOT });
      if (out.status !== 0 || !out.stdout) die(`cảnh "${sc.id}": script lỗi: ${out.stderr}`);
      const groups = ansiGroups(out.stdout);
      const qg = groups.find((g) => g.some((sp) => /%left/.test(sp.t)));
      const qs = qg?.find((sp) => /%left/.test(sp.t));
      const quota = qs ? { left, color: qs.c, reset: qg.find((sp) => sp.t.startsWith('↻'))?.t.slice(1) ?? '' } : null;
      return { at: levels.length === 1 ? 0 : Math.round(start + i * every), groups, quota };
    });
    let rows = [];
    if (m.mode === 'explain') {
      const n = states[0].groups.length;
      if (m.rows.length !== n) die(`cảnh "${sc.id}": script in ra ${n} nhóm, rows có ${m.rows.length}`);
      const gap = (dur - start - Math.round(0.8 * FPS)) / n;
      rows = m.rows.map((r, i) => ({ label: tr(r, lang), at: Math.round(start + 6 + i * gap) }));
    }
    return { type: 'statusline', mode: m.mode, label: tr(m.label, lang) ?? '', states, rows };
  }
  die(`cảnh "${sc.id}": motion.type "${m.type}" không có`);
}

/** ANSI output (\e[..m) → groups of spans {t, c}, split at spans containing only "│". */
function ansiGroups(text) {
  const COLOR = { 31: '#f87171', 32: '#4ade80', 33: '#fcd34d', 34: '#60a5fa', 35: '#e879f9', 36: '#67e8f9', 90: '#7c8197', 97: '#ffffff' };
  const spans = [];
  let color = '#e5e7eb';
  for (const part of text.split(/(\x1b\[\d+m)/)) {
    const code = part.match(/^\x1b\[(\d+)m$/);
    if (code) color = COLOR[code[1]] ?? '#e5e7eb';
    else if (part) spans.push({ t: part, c: color });
  }
  const groups = [[]];
  for (const sp of spans) {
    if (sp.t.trim() === '│') groups.push([]);
    else groups[groups.length - 1].push(sp);
  }
  return groups
    .map((g) => g.filter((sp, i) => !(sp.t.trim() === '' && (i === 0 || i === g.length - 1))))
    .map((g) => g.map((sp, i) => ({ ...sp, t: i === 0 ? sp.t.trimStart() : i === g.length - 1 ? sp.t.trimEnd() : sp.t })))
    .filter((g) => g.length);
}

/** Audio of the scene: real sound (`voice`: a real voice or clip audio) wins; otherwise ElevenLabs narration when the video enables `narration`. */
const voiceOf = (sc) => {
  if (sc.voice) return { src: (need(sc.voice.src), sc.voice.src), startFrom: Math.round((sc.voice.skip ?? 0) * FPS), volume: sc.voice.volume ?? 1, delay: 0 };
  const said = narrationOf(dir, short, sc.id, lang);
  // Narration ducks the music only while the line is spoken, and less than a real voice does: an AI read is
  // clean and even, so the music can stay audible under it and come back up between lines.
  return said
    ? { src: said.src, startFrom: 0, volume: short.narration.volume ?? 1, delay: Math.round(VOICE_IN * FPS), dur: Math.round(said.seconds * FPS), duck: short.narration.duck ?? 0.45 }
    : null;
};

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
      id: sc.id, from, dur, src: '', kind: 'terminal', terminal: spec, voice: voiceOf(sc), startFrom: 0, rate: 1,
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
    // Other languages use footage re-captured with that language's UI when it exists (capture --lang).
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

// SFX are real Mixkit recordings in content/_assets/cine, copied from the video-shotcraft skill (each file's source is
// listed in that skill's assets/audio/ATTRIBUTION.md). No synthesized sounds: they read as game audio, rule S1 in
// aesthetic-rules.md. `lead` = frames from the start of the file to its peak, measured with ffmpeg. hit() subtracts lead
// plus 1 frame of AAC delay in the render, so the peak lands on the frame of the on-screen action instead of after it.
const CINE = {
  impact: { lead: 16, dur: 110 }, // cinematic whoosh + deep impact: the stamp, quota turning red
  hit: { lead: 3, dur: 33 }, // short bass hit: the opening
  whoosh: { lead: 21, dur: 52 }, // big whoosh: into the outro and the end card
  swoosh: { lead: 9, dur: 24 }, // small sweep: regular scene cuts
  'click-a': { lead: 0, dur: 20 }, // real switch; two samples alternate so it never sounds like a machine gun (S2)
  'click-b': { lead: 0, dur: 20 },
  'key-a': { lead: 4, dur: 12 }, // typewriter key, two samples alternating
  'key-b': { lead: 5, dur: 14 },
  shimmer: { lead: 29, dur: 90 }, // sparkle: the logo appearing
};
const sfx = [];
const hit = (name, frame, volume) => {
  const c = CINE[name];
  sfx.push({ src: `_assets/cine/${name}.mp3`, from: Math.max(0, Math.round(frame) - c.lead - 1), dur: c.dur, volume });
};
/** A run of clicks: two samples alternate and the volume steps down (S2 in video-shotcraft). */
const clicks = (frames, volume) => frames.forEach((f, i) => hit(i % 2 ? 'click-b' : 'click-a', f, volume * Math.max(0.6, 1 - 0.08 * i)));
/** Typing: at most one click every 3 frames, so fast commands do not turn into a buzz. */
const keys = (frames, volume) => {
  let last = -99, n = 0;
  for (const f of [...frames].sort((x, y) => x - y)) {
    if (f - last < 3) continue;
    hit(n++ % 2 ? 'key-b' : 'key-a', f, volume * (n % 3 === 0 ? 0.8 : 1));
    last = f;
  }
};

hit('hit', 3, 0.7);
for (const s of scenes.slice(1)) hit('swoosh', s.from, 0.42);
for (const s of [outro, endcard].filter(Boolean)) hit('whoosh', s.from, 0.5);
short.scenes.forEach((sc, i) => {
  const shot = shots[sc.shot ?? sc.id];
  if (!shot?.type || sc.src) return;
  const { at, cps = 14, submit } = shot.type;
  const text = tr(shot.type.text, lang);
  const base = scenes[i].from - (sc.skip ?? 0) * FPS;
  const end = scenes[i].from + scenes[i].dur;
  keys([...text].map((ch, k) => (ch === ' ' ? -1 : Math.round(base + (at + k / cps) * FPS))).filter((f) => f >= scenes[i].from && f < end), 0.26);
  if (submit) {
    const f = Math.round(base + (at + text.length / cps + submit) * FPS);
    if (f < end) hit('click-a', f, 0.5);
  }
});
// Motion scenes: a switch click for each element that appears, an impact for each payoff (silence cut, stamp, red quota).
for (const sc of scenes.filter((x) => x.kind === 'motion')) {
  const m = sc.motion;
  if (m.type === 'wave') {
    hit('swoosh', sc.from + m.cutAt, 0.5);
    hit('click-a', sc.from + m.cutAt + 14, 0.45);
  }
  if (m.type === 'pipeline') clicks(m.steps.map((st) => sc.from + st.at), 0.4);
  if (m.type === 'pages') {
    keys(m.pages.map((_, i) => sc.from + 2 + i * m.every + 6), 0.3);
    hit('hit', sc.from + m.badgeAt, 0.5);
  }
  if (m.type === 'acts') {
    // The playhead follows an inOut(sin) easing: convert each segment position to a frame so the click lands as a new act begins.
    const [a, b] = m.sweep;
    clicks(m.acts.slice(1).map((act) => sc.from + Math.round(a + ((b - a) * Math.acos(1 - 2 * act.from)) / Math.PI)), 0.38);
  }
  if (m.type === 'statusline') {
    if (m.mode === 'quota') {
      const states = m.states.slice(1);
      clicks(states.filter((st) => !(st.quota?.left <= 10)).map((st) => sc.from + st.at), 0.45);
      for (const st of states.filter((x) => x.quota?.left <= 10)) hit('impact', sc.from + st.at, 0.6);
    } else clicks(m.rows.map((r) => sc.from + r.at), 0.38);
  }
  if (m.type === 'calc') {
    clicks(m.rows.map((r) => sc.from + r.at), 0.4);
    hit('impact', sc.from + m.stampAt, 0.65);
  }
}
keys(terminalTicks, 0.24);
if (outro) hit('shimmer', outro.from + 34, 0.5);

const props = {
  id: short.id ?? dir,
  theme: short.theme ?? 'siri2moon',
  lang,
  fps: FPS,
  durationInFrames: t,
  chip: short.chip ? { title: tr(short.chip.title, lang), subtitle: tr(short.chip.subtitle, lang) ?? '' } : null,
  // Video belongs to a multi-episode series: an "EP 1/5" label under the chip for the whole video.
  series: short.series
    ? { label: `${lang === 'en' ? 'EP' : 'TẬP'} ${short.series.ep}/${short.series.of}`, name: tr(short.series.name, lang) ?? '' }
    : null,
  scenes,
  outro,
  endcard,
  // --no-music: SFX only, so trending music can be added in the app when posting.
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
