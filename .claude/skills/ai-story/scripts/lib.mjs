// Shared helpers for every stage of the ai-story skill. No external packages.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT =
  process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');

export const contentDir = (dir) => join(ROOT, 'content', dir);

// Every video keeps its renders in its own folder, out/<dir>/, so out/ stays one folder per video.
export const outDir = (dir) => {
  const d = join(ROOT, 'out', dir);
  mkdirSync(d, { recursive: true });
  return d;
};
export const assetsDir = () => join(ROOT, 'content', '_assets');

/** Nơi để venv Python (TTS) — nặng, sinh lại được, nằm ngoài git. */
export const toolDir = () => join(ROOT, '.ai-story');
export const venvPython = () => join(toolDir(), 'venv', 'bin', 'python');

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

export const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

/** ffmpeg ghi log ra stderr, execFileSync chỉ trả stdout — cần cả hai luồng. */
export const shBoth = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
};

export const requireBin = (bin, hint) => {
  try {
    sh('which', [bin]);
  } catch {
    die(`thiếu \`${bin}\`.${hint ? ' ' + hint : ''}`);
  }
};

/** Độ dài file audio/video, tính bằng giây. */
export const durationOf = (file) =>
  Number(
    sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim(),
  );

/**
 * Thư mục đặt tên `<YYYY-MM-DD>-<HH>-<MM>-<slug>`. Bắt gõ đủ tiền tố thời gian
 * thì hành, nên chấp nhận gõ mỗi phần slug: tìm thư mục kết thúc bằng nó.
 * Tiền tố rộng cố định nên sort chữ = sort thời gian, trùng nhiều thì lấy mới nhất.
 */
export const resolveSlug = (arg) => {
  if (existsSync(contentDir(arg))) return arg;

  const root = join(ROOT, 'content');
  if (!existsSync(root)) die('chưa có thư mục content/');

  const hits = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((n) => n.endsWith(`-${arg}`))
    .sort();

  if (hits.length === 0) die(`không có thư mục content/ nào khớp "${arg}"`);

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

/** Đọc story.json của một thư mục, chết hẳn nếu thiếu. */
export const loadStory = (dir) => {
  const p = join(contentDir(dir), 'story.json');
  if (!existsSync(p)) die(`thiếu ${p}. Chạy skill ai-story để viết kịch bản trước.`);
  return readJson(p);
};

/** Mọi dòng thoại theo đúng thứ tự đọc, kèm scene chứa nó. */
export const flatLines = (story) =>
  story.scenes.flatMap((sc, si) =>
    sc.lines.map((text, li) => ({ text, sceneId: sc.id, sceneIndex: si, lineIndex: li })),
  );
