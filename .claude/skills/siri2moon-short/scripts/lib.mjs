// Tiện ích dùng chung cho skill siri2moon-short. Không phụ thuộc package ngoài.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');
export const SKILL = resolve(fileURLToPath(import.meta.url), '../..');

export const contentDir = (dir) => join(ROOT, 'content', dir);

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

/** Gõ mỗi phần slug là đủ: tìm thư mục content/ kết thúc bằng nó, trùng nhiều thì lấy mới nhất. */
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
  return readJson(p);
};

/** Chữ song ngữ: một chuỗi, hoặc { vi, en }. Thiếu bản dịch thì rơi về tiếng Việt. */
export const tr = (value, lang) => {
  if (value == null) return value;
  if (typeof value === 'string' || Array.isArray(value)) return value;
  return value[lang] ?? value.vi;
};

export const FPS = 30;

/** Tổng số phách (chuẩn 100 BPM) của video: cảnh + outro + màn kết. */
export const totalBeats = (short) =>
  short.scenes.reduce((n, sc) => n + (sc.beats ?? 6), 0) + (short.outro ? short.outro.beats ?? 11 : 0) + (short.endcard?.beats ?? 5);

/**
 * `beats` trong short.json tính theo phách chuẩn 0,6 s (100 BPM), để độ dài cảnh không phụ thuộc
 * bài nhạc. Với bài khác BPM: quy ra số phách CHẴN gần nhất của bài đó (giữ nhịp đôi), nên cảnh
 * dài gần như cũ mà mốc cắt vẫn rơi đúng phách.
 */
export const toTrackBeats = (beats, timing) => (timing.bpm === 100 ? beats : Math.max(2, 2 * Math.round((beats * 0.6) / timing.beatS / 2)));

/** Đường dẫn trong content/ của file nhạc: "_assets/music/x.mp3" hoặc "x.mp3" trong thư mục video. */
export const musicPath = (dir, file) => (file.includes('/') ? file : `${dir}/${file}`);

/**
 * Nhịp của video. Nhạc tổng hợp: 100 BPM (một phách 0,6 s = 18 frame). Có `music.file`: BPM, phách
 * mạnh và đoạn bắt đầu dò từ chính bài đó (beat.mjs), cache ở audio/beat.json. Mọi mốc cắt rơi
 * đúng phách của bài.
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
  // Cắt sẵn đoạn dùng và chuẩn hoá về -14 LUFS (nhạc là thứ duy nhất có tiếng, cần đủ to).
  const out = join(contentDir(dir), 'audio', 'track.wav');
  mkdirSync(dirname(out), { recursive: true });
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', String(r.start), ...(r.loops ? [] : ['-t', String(seconds + 1)]), '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '2', out]);
  const timing = { bpm: r.bpm, beatS: 60 / r.bpm, beatFrames: (FPS * 60) / r.bpm, track: { src: `${dir}/audio/track.wav`, from: rel, start: r.start, lufs: r.lufs, loops: r.loops } };
  writeJson(cacheFile, { key, timing });
  info(`nhạc ${rel}: ${r.bpm} BPM, dùng từ ${r.start}s (đầu ô nhịp, đoạn sôi động nhất), ${r.lufs} → -14 LUFS`);
  if (r.loops) warn('bài nhạc ngắn hơn video tính từ đoạn bắt đầu: nhạc sẽ lặp');
  return timing;
}
