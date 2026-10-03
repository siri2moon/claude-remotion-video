// Tiện ích dùng chung cho các stage. Không phụ thuộc package ngoài.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT =
  process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');

export const contentDir = (slug) => join(ROOT, 'content', slug);
export const assetsDir = () => join(ROOT, 'content', '_assets');

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const writeJson = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
};

export const ok = (m) => console.log(`OK     ${m}`);
export const info = (m) => console.log(`       ${m}`);
export const warn = (m) => console.log(`WARN   ${m}`);
export const fail = (m) => {
  console.error(`ERROR  ${m}`);
  process.exitCode = 1;
};
export const die = (m) => {
  console.error(`ERROR  ${m}`);
  process.exit(1);
};

export const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

/**
 * ffmpeg ghi log (kể cả output của silencedetect) ra STDERR chứ không phải stdout.
 * execFileSync chỉ trả stdout nên phải dùng spawnSync để lấy được cả hai luồng.
 */
export const shBoth = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
};

export const requireBin = (bin) => {
  try {
    sh('which', [bin]);
  } catch {
    die(`thiếu \`${bin}\`. Cài bằng: brew install ffmpeg`);
  }
};

export const ffprobe = (file) =>
  JSON.parse(sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));

/** Đích mới hơn nguồn → bỏ qua, khỏi làm lại */
export const isFresh = (out, src) => {
  if (!existsSync(out) || !existsSync(src)) return false;
  return statSync(out).mtimeMs >= statSync(src).mtimeMs;
};

/** Bỏ dấu tiếng Việt + hạ hoa thường + bỏ ký tự không phải chữ số. Dùng để so khớp, KHÔNG để hiển thị. */
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Tách lời thoại thành từ, giữ nguyên bản gốc để hiển thị */
export const tokenize = (text) =>
  String(text ?? '')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => norm(w).length > 0);

/**
 * Thư mục kịch bản đặt tên `<YYYY-MM-DD>-<HH>-<MM>-<slug>`. Bắt user gõ đủ cả
 * tiền tố thời gian thì hành, nên chấp nhận gõ mỗi phần slug: tìm thư mục nào
 * kết thúc bằng nó. Tiền tố có độ rộng cố định nên sort chữ = sort thời gian,
 * trùng nhiều thì lấy cái mới nhất.
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
