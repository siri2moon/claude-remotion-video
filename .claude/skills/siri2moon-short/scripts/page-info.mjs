#!/usr/bin/env node
// Đọc một trang (thường là bài blog) ở khung điện thoại, để lên kịch bản và đặt key cuộn.
//   node page-info.mjs <url> [--out=content/<dir>/page.json] [--shot=content/<dir>/page.jpg]
//
// In ra: tiêu đề, mô tả, chiều cao trang, và vị trí (px từ đỉnh trang) của từng heading,
// khối code, ảnh, sơ đồ — đúng thứ cần để viết key { scroll } trong short.json.
// Kèm toàn văn bài (cắt 12k ký tự) để rút ý viết phụ đề, và các link /posts/ trên trang
// (mở trang /posts là ra danh sách bài để chọn).
// --shot chụp cả trang thu nhỏ (rộng 270 px) để nhìn bố cục một lượt.

import { writeFileSync } from 'node:fs';
import { launch } from './cdp.mjs';
import { die, flagValue, ok } from './lib.mjs';

const url = process.argv[2];
if (!url || url.startsWith('--')) die('thiếu <url>. Dùng: node page-info.mjs https://siri2moon.com/posts/<slug>');

const page = await launch({ width: 540, height: 960, port: 9334 });
await page.send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 2, mobile: true });
await page.send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 5000));

const info = await page.evaluate(`(() => {
  const top = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
  const root = document.querySelector('article') ?? document.querySelector('main') ?? document.body;
  return {
    url: location.href,
    title: document.querySelector('h1')?.innerText ?? document.title,
    description: document.querySelector('meta[name=description]')?.content ?? '',
    cover: document.querySelector('meta[property="og:image"]')?.content ?? null,
    pageHeight: document.documentElement.scrollHeight,
    viewport: [innerWidth, innerHeight],
    headings: [...root.querySelectorAll('h1, h2, h3')].map((h) => ({ tag: h.tagName.toLowerCase(), text: h.innerText.trim(), top: top(h), id: h.id || null })),
    code: [...root.querySelectorAll('pre')].map((p) => ({
      top: top(p), height: Math.round(p.getBoundingClientRect().height),
      lang: p.querySelector('code')?.className.match(/language-(\\w+)/)?.[1] ?? null,
      head: p.innerText.split('\\n').slice(0, 6).join('\\n'),
    })),
    images: [...root.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 200).map((i) => ({ top: top(i), height: Math.round(i.getBoundingClientRect().height), alt: i.alt, src: i.currentSrc || i.src })),
    diagrams: [...root.querySelectorAll('.mermaid, svg[id^=mermaid], figure svg')].map((d) => ({ top: top(d), height: Math.round(d.getBoundingClientRect().height) })),
    posts: [...new Map([...document.querySelectorAll('a[href*="/posts/"]')].map((a) => [a.pathname, (a.innerText.trim().split('\\n').find((l) => l.length > 25) ?? a.innerText.trim()).slice(0, 120)])).entries()]
      .filter(([p, t]) => t && p !== location.pathname).map(([path, title]) => ({ path, title })),
    text: root.innerText.replace(/\\n{3,}/g, '\\n\\n').slice(0, 60000),
  };
})()`);

const shot = flagValue('shot');
if (shot) {
  const h = Math.min(info.pageHeight, 16000);
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 70, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 540, height: h, scale: 0.25 },
  });
  writeFileSync(shot, Buffer.from(data, 'base64'));
  ok(`ảnh toàn trang: ${shot} (1 px ảnh = 2 px trang)`);
}
await page.close();

const out = flagValue('out');
if (out) {
  writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
  ok(`ghi ${out}`);
}
const { text, ...summary } = info;
console.log(JSON.stringify(summary, null, 1));
console.log(`\n--- text (${text.length} ký tự) ---\n${text.slice(0, out ? 1500 : 12000)}${out ? '\n… (đầy đủ trong ' + out + ')' : ''}`);
