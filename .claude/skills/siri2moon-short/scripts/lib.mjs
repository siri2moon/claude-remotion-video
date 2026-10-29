// Shared helpers for the siri2moon-short skill. No external packages.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');
export const SKILL = resolve(fileURLToPath(import.meta.url), '../..');

export const contentDir = (dir) => join(ROOT, 'content', dir);

// Every video keeps its renders in its own folder, out/<dir>/, so out/ stays one folder per video.
export const outDir = (dir) => {
  const d = join(ROOT, 'out', dir);
  mkdirSync(d, { recursive: true });
  return d;
};

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const writeJson = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
};

export const ok = (m) => console.log(`OK     ${m}`);
export const info = (m) => console.log(`       ${m}`);
export const warn = (m) => console.log(`WARN   ${m}`);
export const die = (m) => {
  console.error(`ERROR  ${m}`);
  process.exit(1);
};

export const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

export const durationOf = (file) =>
  Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());

/** Any trailing part of the slug is enough: finds the content/ folder ending with it, newest first on ties. */
export const resolveSlug = (arg) => {
  if (existsSync(contentDir(arg))) return arg;
  const hits = readdirSync(join(ROOT, 'content'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(ROOT, 'content', d.name, 'short.json')))
    .map((d) => d.name)
    .filter((n) => n.endsWith(`-${arg}`) || n.includes(arg))
    .sort();
  if (hits.length === 0) die(`không có thư mục content/ nào có short.json khớp "${arg}"`);
  const picked = hits[hits.length - 1];
  if (hits.length > 1) info(`"${arg}" khớp ${hits.length} thư mục, lấy cái mới nhất: ${picked}`);
  return picked;
};

export const slugArg = () => {
  const arg = process.argv[2];
  if (!arg || arg.startsWith('--')) die('thiếu <slug>. Dùng: <script>.mjs <slug> [--flags]');
  return resolveSlug(arg);
};

export const hasFlag = (name) => process.argv.includes(`--${name}`);
export const flagValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

export const loadShort = (dir) => {
  const p = join(contentDir(dir), 'short.json');
  if (!existsSync(p)) die(`thiếu ${p}. Viết kịch bản trước (bước 4 của skill).`);
  return fitNarration(dir, readJson(p));
};

/** Variables from the .env file at the project root (KEY=value), overridden by environment variables of the same name. */
export const loadEnv = () => {
  const p = join(ROOT, '.env');
  const env = {};
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  for (const k of Object.keys(process.env)) if (k.startsWith('ELEVENLABS_')) env[k] = process.env[k];
  return env;
};

/** Generated narration (narrate.mjs) for scene `id` in language `lang`, or null. */
export const narrationOf = (dir, short, id, lang) => {
  if (!short.narration) return null;
  const p = join(contentDir(dir), 'voice', 'manifest.json');
  if (!existsSync(p)) return null;
  const e = readJson(p)[`${lang}/${id}`];
  return e && existsSync(join(contentDir(dir), 'voice', e.file)) ? { src: `${dir}/voice/${e.file}`, seconds: e.seconds } : null;
};

/** Narration starts this many seconds into the scene, and this many seconds are left after the line before the cut. */
export const VOICE_IN = 0.15;
export const VOICE_TAIL = 0.5;

/**
 * Narration on: a scene whose line runs longer than the scene gets its `beats` stretched to fit the longest line
 * across languages. Done right when short.json is read, so music, video length, and the vi and en cuts share one timeline.
 */
function fitNarration(dir, short) {
  if (!short.narration) return short;
  for (const sc of short.scenes) {
    if (!sc.say || sc.voice || sc.dur) continue;
    const longest = Math.max(0, ...['vi', 'en'].map((lang) => narrationOf(dir, short, sc.id, lang)?.seconds ?? 0));
    if (longest > 0) sc.beats = Math.max(sc.beats ?? 6, Math.ceil((VOICE_IN + longest + VOICE_TAIL) / 0.6));
  }
  return short;
}

/** Bilingual text: a string, or { vi, en }. A missing translation falls back to Vietnamese. */
export const tr = (value, lang) => {
  if (value == null) return value;
  if (typeof value === 'string' || Array.isArray(value)) return value;
  return value[lang] ?? value.vi;
};

export const FPS = 30;

/** Total beats (at the standard 100 BPM) of the video: scenes + outro + end card. */
export const totalBeats = (short) =>
  short.scenes.reduce((n, sc) => n + (sc.beats ?? 6), 0) + (short.outro ? short.outro.beats ?? 11 : 0) + (short.endcard?.beats ?? 5);

/**
 * `beats` in short.json count standard 0.6 s beats (100 BPM), so scene length does not depend on the
 * track. For a track at another BPM, they are converted to the nearest EVEN number of that track's beats (keeping
 * the two-beat pulse), so scenes keep roughly the same length while cuts still land on the beat.
 */
export const toTrackBeats = (beats, timing) => (timing.bpm === 100 ? beats : Math.max(2, 2 * Math.round((beats * 0.6) / timing.beatS / 2)));

/** Path inside content/ of a music file: "_assets/music/x.mp3", or "x.mp3" in the video folder. */
export const musicPath = (dir, file) => (file.includes('/') ? file : `${dir}/${file}`);

/**
 * Video tempo. Synthesized music: 100 BPM (one 0.6 s beat = 18 frames). With `music.file`: BPM, downbeats
 * and the start section are detected from that track (beat.mjs) and cached in audio/beat.json. Every cut lands
 * on the track's beat.
 */
export async function musicTiming(dir, short) {
  const m = short.music ?? {};
  if (!m.file) return { bpm: 100, beatS: 0.6, beatFrames: 18, track: null };
  const rel = musicPath(dir, m.file);
  const file = join(ROOT, 'content', rel);
  if (!existsSync(file)) die(`không thấy file nhạc content/${rel}`);
  const beats = totalBeats(short);
  const key = JSON.stringify({ v: 2, rel, start: m.start ?? 'auto', bpm: m.bpm ?? 'auto', beats, size: statSync(file).size });
  const cacheFile = join(contentDir(dir), 'audio', 'beat.json');
  if (existsSync(cacheFile)) {
    const cached = readJson(cacheFile);
    if (cached.key === key) return cached.timing;
  }
  const { analyze } = await import('./beat.mjs');
  const first = analyze(file, { seconds: beats * 0.6, bpm: m.bpm });
  const seconds = beats * 0.6 + 2;
  const r = analyze(file, { seconds, bpm: first.bpm, start: typeof m.start === 'number' ? m.start : undefined });
  // Pre-cut the section in use and normalize it to -14 LUFS (music is the only sound, so it needs to be loud enough).
  const out = join(contentDir(dir), 'audio', 'track.wav');
  mkdirSync(dirname(out), { recursive: true });
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', String(r.start), ...(r.loops ? [] : ['-t', String(seconds + 1)]), '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '2', out]);
  const timing = { bpm: r.bpm, beatS: 60 / r.bpm, beatFrames: (FPS * 60) / r.bpm, track: { src: `${dir}/audio/track.wav`, from: rel, start: r.start, lufs: r.lufs, loops: r.loops } };
  writeJson(cacheFile, { key, timing });
  info(`nhạc ${rel}: ${r.bpm} BPM, dùng từ ${r.start}s (đầu ô nhịp, đoạn sôi động nhất), ${r.lufs} → -14 LUFS`);
  if (r.loops) warn('bài nhạc ngắn hơn video tính từ đoạn bắt đầu: nhạc sẽ lặp');
  return timing;
}
