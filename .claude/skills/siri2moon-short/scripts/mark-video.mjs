#!/usr/bin/env node
// Records which blog posts already have a video, in the post_videos table of the siri2moon-blog D1
// (blog-siri2moon/db/migrations/0005_post_videos.sql). The blog admin reads this table: the Video column
// and the "No video yet" filter on /admin/posts, and the "Short videos" panel when editing a post.
//
// Usage:
//   node mark-video.mjs <dir>                     records video content/<dir> against the post in short.json → source.url
//   node mark-video.mjs <dir> --post=<slug>       project video (no source.url): name the post explicitly
//   node mark-video.mjs <id> --post=<slug> --title=<title> [--made=YYYY-MM-DDTHH:MM]
//                                                 video made outside content/ (no short.json)
//   node mark-video.mjs <dir> --youtube=<url> --facebook=<url> --tiktok=<url>
//                                                 add links after posting (safe to rerun; existing links are kept)
//   node mark-video.mjs --todo                    published posts WITHOUT a video, newest first
//   node mark-video.mjs --list                    videos recorded so far
// Writes to production D1 by default (--remote). Use --local to try it on the local copy.
// Blog folder: BLOG_DIR, defaults to ../blog-siri2moon next to this repo.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, contentDir, readJson, ok, info, die, sh } from './lib.mjs';

const BLOG_DIR = process.env.BLOG_DIR ?? resolve(ROOT, '../blog-siri2moon');
const DB = 'siri2moon-blog';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const has = (name) => args.includes(`--${name}`);
const target = has('local') ? '--local' : '--remote';

if (!existsSync(join(BLOG_DIR, 'wrangler.jsonc'))) die(`không thấy blog ở ${BLOG_DIR} (đặt BLOG_DIR)`);

// wrangler d1 execute takes no bind parameters, so every value goes through lit().
const lit = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

function query(sql) {
  const out = sh('npx', ['wrangler', 'd1', 'execute', DB, target, '--json', '--command', sql], {
    cwd: BLOG_DIR,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out)[0].results;
}

if (has('todo')) {
  const rows = query(
    `SELECT p.slug, substr(p.date, 1, 10) AS date, c.name AS category, p.title
       FROM posts p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published'
        AND NOT EXISTS (SELECT 1 FROM post_videos v WHERE v.post_slug = p.slug)
      ORDER BY p.date DESC`,
  );
  for (const r of rows) console.log(`${r.date}  ${(r.category ?? '-').padEnd(22)}  ${r.slug}\n            ${r.title}`);
  info(`${rows.length} bài chưa có video`);
  process.exit(0);
}

if (has('list')) {
  const rows = query(
    `SELECT v.video_id, v.post_slug, v.title, v.youtube_url, v.facebook_url, v.tiktok_url
       FROM post_videos v ORDER BY v.made_at DESC`,
  );
  for (const r of rows) {
    const posted = [r.youtube_url && 'YT', r.facebook_url && 'FB', r.tiktok_url && 'TT'].filter(Boolean);
    console.log(`${r.video_id}  →  ${r.post_slug}  [${posted.join(' ') || 'chưa đăng'}]\n    ${r.title}`);
  }
  info(`${rows.length} video`);
  process.exit(0);
}

const dir = args.find((a) => !a.startsWith('--'));
if (!dir) die('thiếu <dir>. Dùng: node mark-video.mjs 2026-10-27-22-20-xuong-video-ai-tap-5');
const shortPath = join(contentDir(dir), 'short.json');
// Video made outside content/ (e.g. a hand-built project demo): no short.json, so the post and title are passed in.
const short = existsSync(shortPath) ? readJson(shortPath) : null;
if (!short && !(flag('post') && flag('title'))) die(`không có ${shortPath}; video ngoài content/ thì truyền --post=<slug> --title=<tên>`);

const fromUrl = short?.source?.url?.match(/siri2moon\.com\/posts\/([^/?#]+)/)?.[1] ?? null;
const slug = flag('post') ?? fromUrl;
if (!slug) die('short.json không có source.url trỏ tới bài siri2moon.com, truyền --post=<slug>');

const strip = (s) => s.replace(/\*/g, '').trim();
const title =
  flag('title') ??
  (short.series
    ? `${short.series.name.vi ?? short.series.name} · Tập ${short.series.ep}/${short.series.of}`
    : strip((short.scenes[0].lines.vi ?? short.scenes[0].lines).join(' ')));
// Folder names start with their creation date and time (new-dir.mjs): 2026-10-27-22-20-…
const m = dir.match(/^(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/);
const madeAt = flag('made') ?? (m ? `${m[1]}T${m[2]}:${m[3]}:00` : new Date().toISOString().slice(0, 19));

const [post] = query(`SELECT slug, title FROM posts WHERE slug = ${lit(slug)}`);
if (!post) die(`không có bài "${slug}" trong D1 (${target.slice(2)})`);

const urls = { youtube_url: flag('youtube'), facebook_url: flag('facebook'), tiktok_url: flag('tiktok') };
const cols = Object.keys(urls);
// Rerun to add links: links not passed keep their stored value.
query(
  `INSERT INTO post_videos (post_slug, video_id, title, made_at, ${cols.join(', ')})
   VALUES (${[slug, dir, title, madeAt, ...Object.values(urls)].map(lit).join(', ')})
   ON CONFLICT(video_id) DO UPDATE SET
     post_slug = excluded.post_slug, title = excluded.title,
     ${cols.map((c) => `${c} = COALESCE(excluded.${c}, post_videos.${c})`).join(', ')}`,
);
ok(`${dir} → ${slug} (${target.slice(2)})`);
info(`"${title}" · bài: ${post.title}`);
