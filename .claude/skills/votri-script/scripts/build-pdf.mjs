#!/usr/bin/env node
// kichban.json → kichban.html → kichban.pdf (A4, in bằng Chrome headless).
// Dùng: node .claude/skills/votri-script/scripts/build-pdf.mjs content/<dir>/kichban.json
//
// Chỉ chạy sau khi validate.mjs sạch ERROR — script này tin dữ liệu đầu vào đúng schema.
// Chrome tìm theo thứ tự: $CHROME_PATH → Chrome/Chromium/Edge cài sẵn → chrome-headless-shell
// mà Remotion đã tải về trong remotion/node_modules.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.env.PROJECT_ROOT ?? resolve(fileURLToPath(import.meta.url), '../../../../..');

const file = process.argv[2];
if (!file) {
  console.error('Thiếu tham số. Dùng: build-pdf.mjs content/<dir>/kichban.json');
  process.exit(1);
}
const jsonPath = resolve(file);
const doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDir = dirname(jsonPath);
const htmlPath = join(outDir, 'kichban.html');
const pdfPath = join(outDir, 'kichban.pdf');

const PARTS = {
  hook: { name: 'HOOK', color: '#e85d04' },
  lead: { name: 'DẪN DẮT', color: '#2b6cb0' },
  twist: { name: 'TWIST', color: '#c53030' },
  explain: { name: 'GIẢI THÍCH', color: '#2c7a7b' },
  outro: { name: 'OUTRO', color: '#6b46c1' },
};

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const br = (s) => esc(s).replace(/\n/g, '<br>');
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

const scenes = doc.scenes;
const total = doc.durationSec;

// ---------- các khối HTML ----------
const timeline = scenes
  .map((s) => {
    const p = PARTS[s.part];
    const w = ((s.end - s.start) / total) * 100;
    return `<div class="seg" style="width:${w}%;background:${p.color}">
      <b>${p.name}</b><span>${mmss(s.start)}</span></div>`;
  })
  .join('');

const sceneCards = scenes
  .map((s, i) => {
    const p = PARTS[s.part];
    const row = (k, v) => `<div class="k">${k}</div><div class="v">${br(v)}</div>`;
    return `
<section class="scene" style="--c:${p.color}">
  <header><span>CẢNH ${i + 1} · ${p.name}</span><em>${esc(s.label)}</em><time>${mmss(s.start)} – ${mmss(s.end)}</time></header>
  <div class="grid">
    ${row('KHUNG HÌNH', s.camera)}
    ${row('DIỄN XUẤT', s.action)}
    ${row('ÂM THANH', s.audio)}
  </div>
  <div class="line">
    <div class="lbl">THOẠI${s.voice ? ` · <i>${esc(s.voice)}</i>` : ''}</div>
    <p>${br(s.line)}</p>
    ${s.note ? `<div class="note">💡 ${br(s.note)}</div>` : ''}
  </div>
  <div class="screen"><div class="lbl">TEXT TRÊN MÀN HÌNH</div><p>${br(s.onScreen)}</p></div>
</section>`;
  })
  .join('');

const thumbPrompt = `Hãy tạo thumbnail video cho tôi, định dạng 9:16.
Tiêu đề chính (phía trên cùng): "${doc.title}" — font thư pháp cách điệu, mạnh mẽ (Modern Calligraphy), màu vàng kim có viền phát sáng (outer glow) và bóng đổ tối (drop shadow) để nổi bật trên nền ảnh.
Thẻ phụ (dưới tiêu đề): dải băng hình cuộn giấy cổ màu nâu, ghi "${doc.subtitle}".
Dòng chữ gây sốc: chữ nhỏ hơn, màu vàng tươi, nằm dưới dải băng, có biểu tượng nổ: "${doc.shockLine}".
IMPORTANT: Định dạng 9:16.`;

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>${esc(doc.title)} – Kịch bản</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,600;0,800;1,400&display=block" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 13mm 16mm;
  @bottom-left { content: "${esc(doc.title)} – Kịch bản quay"; font: 8pt 'Be Vietnam Pro', sans-serif; color: #999; }
  @bottom-right { content: "Trang " counter(page) "/" counter(pages); font: 8pt 'Be Vietnam Pro', sans-serif; color: #999; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #1f1f1f; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 26pt; font-weight: 800; margin: 0; letter-spacing: -.5px; line-height: 1.15; }
.sub { font-size: 12.5pt; color: #8a5a00; margin: 2px 0 6px; font-weight: 600; }
.meta { color: #666; font-size: 8.5pt; }
.rhythm { color: #444; font-size: 8.5pt; margin-top: 2px; font-style: italic; }
.prep { display: grid; grid-template-columns: 70px 1fr; gap: 3px 10px; background: #faf6ee; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 9pt; }
.prep .k, .grid .k { font-size: 7.5pt; font-weight: 800; color: #888; letter-spacing: .4px; padding-top: 2px; }
.timeline { display: flex; gap: 2px; margin: 10px 0 14px; }
.seg { color: #fff; border-radius: 4px; padding: 4px 6px; font-size: 7pt; min-width: 0; overflow: hidden; white-space: nowrap; }
.seg b { display: block; font-size: 7.5pt; } .seg span { opacity: .85; }
.scene { border: 1px solid #e3e3e3; border-radius: 8px; margin-bottom: 12px; overflow: hidden; break-inside: avoid; }
.scene header { display: flex; align-items: baseline; gap: 10px; background: #222; color: #fff; padding: 7px 12px; border-left: 6px solid var(--c); }
.scene header span { font-weight: 800; font-size: 10pt; white-space: nowrap; }
.scene header em { font-style: normal; color: #ddd; flex: 1; font-size: 9pt; }
.scene header time { font-weight: 800; font-size: 10pt; white-space: nowrap; }
.grid { display: grid; grid-template-columns: 78px 1fr; gap: 4px 10px; padding: 8px 12px 6px; }
.lbl { font-size: 7.5pt; font-weight: 800; color: var(--c); letter-spacing: .4px; }
.lbl i { font-weight: 400; color: #666; }
.line { background: #fff5e8; border-top: 1px solid #f3e2c8; border-bottom: 1px solid #f3e2c8; padding: 8px 14px 10px; }
.line p { font-size: 16pt; font-weight: 800; line-height: 1.42; margin: 3px 0 0; color: #111; }
.note { font-style: italic; color: #6a4b00; margin-top: 6px; font-size: 9pt; }
.screen { padding: 6px 12px 9px; }
.screen p { margin: 2px 0 0; color: #1d4ed8; font-weight: 800; font-size: 11pt; }
.box { border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; break-inside: avoid; }
.box h2 { font-size: 10pt; margin: 0 0 8px; letter-spacing: .5px; color: #555; }
.tips { background: #f2f7f4; } .tips li { margin-bottom: 3px; }
.post { background: #f4f1ea; }
.post .k { font-size: 7.5pt; font-weight: 800; color: #888; margin-top: 8px; letter-spacing: .4px; }
.post .title { font-size: 20pt; font-weight: 800; color: #b7791f; }
.post .subt { font-size: 12pt; font-weight: 600; }
.post .shock { font-size: 12pt; font-weight: 800; color: #c53030; }
.post .tags { color: #2b6cb0; margin-top: 4px; }
.prompt { background: #1f1f1f; color: #eee; font-size: 8.5pt; white-space: pre-wrap; }
.prompt h2 { color: #aaa; }
</style></head>
<body>
<h1>${esc(doc.title)}</h1>
<div class="sub">${esc(doc.subtitle)}</div>
<div class="meta">Thời lượng ${mmss(total)} · ${scenes.length} cảnh · ${esc(doc.concept)} · Vai: ${esc(doc.persona)}</div>
${doc.rhythm ? `<div class="rhythm">Nhịp: ${esc(doc.rhythm)}</div>` : ''}
<div class="prep">
  <div class="k">BỐI CẢNH</div><div>${esc(doc.setting)}</div>
  <div class="k">ĐẠO CỤ</div><div>${doc.props.map(esc).join(' · ')}</div>
  <div class="k">GỐC</div><div><i>${esc(doc.input)}</i></div>
</div>
<div class="timeline">${timeline}</div>
${sceneCards}
<div class="box tips"><h2>MẸO QUAY & DIỄN (DEADPAN)</h2><ul>${doc.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
<div class="box post">
  <h2>THÔNG TIN ĐĂNG VIDEO</h2>
  <div class="k">TITLE (thumbnail – chữ lớn)</div><div class="title">${esc(doc.title)}</div>
  <div class="k">SUBTITLE (dải cuộn giấy)</div><div class="subt">${esc(doc.subtitle)}</div>
  <div class="k">DÒNG CHỮ GÂY SỐC 💥</div><div class="shock">${esc(doc.shockLine)}</div>
  <div class="k">CAPTION</div><div>${esc(doc.caption)}</div>
  <div class="tags">${doc.hashtags.map(esc).join(' ')}</div>
</div>
<div class="box prompt"><h2>PROMPT TẠO THUMBNAIL</h2>${esc(thumbPrompt)}</div>
</body></html>`;

writeFileSync(htmlPath, html);

// ---------- tìm Chrome ----------
function findRemotionShell() {
  const base = join(ROOT, 'remotion', 'node_modules', '.remotion');
  if (!existsSync(base)) return null;
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (name === 'chrome-headless-shell') return p;
    }
  }
  return null;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? findRemotionShell();
}

const chrome = findChrome();
if (!chrome) {
  console.error(`ERROR  Không tìm thấy Chrome để in PDF. Đã ghi ${htmlPath}.
       Cài Google Chrome, hoặc chỉ định: CHROME_PATH=/đường/dẫn/chrome node build-pdf.mjs ${file}`);
  process.exit(1);
}

// Chrome headless trên macOS hay ghi PDF xong rồi treo không thoát, nên không chờ exit:
// thấy file PDF đứng yên kích thước qua hai lần dò liên tiếp là coi như xong và kill.
function printPdf(args) {
  return new Promise((done, fail) => {
    rmSync(pdfPath, { force: true });
    const child = spawn(chrome, args, { stdio: 'ignore' });
    let lastSize = -1;
    let exited = false;
    const finish = (ok, msg) => {
      clearInterval(poll);
      clearTimeout(timer);
      if (!exited) child.kill('SIGKILL');
      ok ? done() : fail(new Error(msg));
    };
    const poll = setInterval(() => {
      const size = existsSync(pdfPath) ? statSync(pdfPath).size : 0;
      if (size > 0 && size === lastSize) finish(true);
      lastSize = size;
    }, 700);
    const timer = setTimeout(() => finish(false, 'Chrome quá 90 giây chưa in xong PDF'), 90000);
    child.on('error', (e) => finish(false, e.message));
    child.on('exit', () => {
      exited = true;
      const ok = existsSync(pdfPath) && statSync(pdfPath).size > 0;
      finish(ok, 'Chrome thoát mà không ghi ra PDF');
    });
  });
}

// Profile tạm: tránh đụng profile Chrome user đang mở.
const profile = mkdtempSync(join(tmpdir(), 'votri-pdf-'));
try {
  await printPdf([
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--no-pdf-header-footer',
    // Chờ Google Fonts tải xong. Mất mạng thì rơi về font hệ thống, vẫn có dấu tiếng Việt.
    '--virtual-time-budget=8000',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ]);
} catch (e) {
  console.error(`ERROR  ${e.message}. HTML vẫn ở ${htmlPath} — mở bằng trình duyệt rồi Cmd+P để in tay.`);
  process.exitCode = 1;
} finally {
  rmSync(profile, { recursive: true, force: true });
}

if (!process.exitCode) console.log(`✓ ${pdfPath}`);
