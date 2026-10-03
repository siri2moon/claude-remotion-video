#!/usr/bin/env node
// Sinh script.md (bảng kịch bản) và shoot.md (hướng dẫn quay) từ script.json.
// Dùng: node .claude/skills/tiktok-script/scripts/build-docs.mjs content/<dir>/script.json
// Chạy SAU validate-script.mjs. Hai file .md là dẫn xuất — đừng sửa tay, sửa script.json rồi chạy lại.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Thiếu tham số. Dùng: build-docs.mjs <đường-dẫn>/script.json');
  process.exit(1);
}

const jsonPath = resolve(file);
const dir = dirname(jsonPath);
let doc;
try {
  doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error(`Không đọc/parse được ${file}: ${e.message}`);
  process.exit(1);
}

// ---------- helpers ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim();
const words = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;

function boldHighlights(text, highlights = []) {
  let out = String(text ?? '');
  const marks = [];
  [...highlights]
    .filter((h) => typeof h === 'string' && h.length > 0)
    .sort((a, b) => b.length - a.length)
    .forEach((h) => {
      const idx = out.indexOf(h);
      if (idx === -1) return;
      out = `${out.slice(0, idx)}\u0000${marks.length}\u0000${out.slice(idx + h.length)}`;
      marks.push(`**${h}**`);
    });
  marks.forEach((m, i) => { out = out.replace(`\u0000${i}\u0000`, m); });
  return out;
}

// Nhãn khối: nhiều scene "story" thì cái đầu là Tâm sự, các cái sau là Cao trào
const labels = (() => {
  let storySeen = 0;
  return doc.scenes.map((s) => {
    if (s.role === 'hook') return 'Hook';
    if (s.role === 'punchline') return 'Đúc kết';
    if (s.role === 'cta') return 'CTA';
    storySeen += 1;
    return storySeen === 1 ? 'Tâm sự' : 'Cao trào';
  });
})();

// Nhãn khối do generator thêm. Nếu script.json lỡ ghi sẵn "(Hook) ..." thì bỏ đi cho khỏi lặp.
const stripLabel = (t) => String(t ?? '').replace(/^\s*\([^)]{1,20}\)\s*/, '');

const captionCell = (s) => {
  const t = boldHighlights(s.caption.text, s.caption.highlight);
  return esc(s.caption.emoji ? `${t} ${s.caption.emoji}` : t);
};

// ---------- script.md ----------
const sfxNotes = doc.scenes.filter((s) => s.sfx?.length).map((s) => `\`${s.id}\` ${s.sfx.join(' + ')}`);
const bRollNotes = doc.scenes.filter((s) => s.bRoll).map((s) => `\`${s.id}\` ${s.bRoll}`);

const scriptMd = `# ${doc.title}

> **Châm ngôn:** "${doc.quote}"

<!-- File này sinh tự động từ script.json — đừng sửa tay. Sửa script.json rồi chạy lại build-docs.mjs -->

| | |
|---|---|
| **Thời lượng** | ${doc.durationSec}s |
| **Định dạng** | 9:16 — ${doc.width}×${doc.height} @ ${doc.fps}fps |
| **Bối cảnh** | ${doc.context} |
| **Góc nhìn** | ${doc.angle} |
| **Tông** | ${doc.tone} |
| **BGM** | ${doc.audio.bgm} — ${Math.round(doc.audio.bgmVolume * 100)}% |

## Bảng kịch bản

| Thời gian | Hành động & Thị giác | Giọng nói / Kịch bản | Chữ trên màn hình |
|---|---|---|---|
${doc.scenes
  .map((s, i) => `| ${fmtTime(s.startSec)} – ${fmtTime(s.endSec)} | (${labels[i]}) ${esc(stripLabel(s.visual))} | "${esc(s.voiceover)}" | ${captionCell(s)} |`)
  .join('\n')}

## Caption đăng bài

${doc.postCaption}

## Hashtags

${doc.hashtags.join(' ')}

## Ghi chú hậu kỳ

- **Jump-cut** cắt sạch khoảng lặng và từ ậm ừ.
- Phụ đề động theo nhịp nói, highlight từ khoá màu vàng.
${sfxNotes.length ? `- SFX: ${sfxNotes.join(' · ')}\n` : ''}${bRollNotes.length ? `- B-roll: ${bRollNotes.join(' · ')}\n` : ''}`;

// ---------- shoot.md ----------
// Thứ tự quay: mọi scene trước, hook quay CUỐI (lúc đó đã nóng máy, vào đề tự nhiên nhất)
const order = [...doc.scenes.keys()].filter((i) => doc.scenes[i].role !== 'hook');
const hookIdx = doc.scenes.findIndex((s) => s.role === 'hook');
if (hookIdx !== -1) order.push(hookIdx);

const sceneBlock = (i, n) => {
  const s = doc.scenes[i];
  const dur = s.endSec - s.startSec;
  const wps = (words(s.voiceover) / dur).toFixed(1);
  const pace = wps >= 6 ? 'nói nhanh, đừng ngắt nhiều' : wps <= 4 ? 'nói thong thả, có chỗ để thở' : 'nhịp vừa, ngắt tự nhiên';
  return `### ${n}. \`${s.id}\` · ${labels[i]} — ${dur}s &nbsp;&nbsp; ☐ take 1 ☐ take 2 ☐ take 3

**Máy & diễn:** ${stripLabel(s.visual)}

**Cue card** — viết ra giấy, dán ngay cạnh ống kính:
> ${s.cueWords.join('  →  ')}

**Lời (nắm ý, đừng học thuộc):**
"${s.voiceover}"

**Nhịp:** ${words(s.voiceover)} từ / ${dur}s ≈ ${wps} từ/giây — ${pace}.
${s.bRoll ? `**Quay thêm b-roll:** ${s.bRoll}\n` : ''}**Lưu file:** \`raw/${s.id}.mov\` (hoặc .mp4)
`;
};

const shootMd = `# 🎬 Hướng dẫn quay — ${doc.title}

> "${doc.quote}"
> ${doc.scenes.length} scene · ${doc.durationSec}s · quay dọc 9:16 · bối cảnh: ${doc.context}

<!-- File này sinh tự động từ script.json — đừng sửa tay. -->

## ⚙️ Setup — 5 phút, làm một lần

**Máy**
- ☐ Điện thoại dựng **dọc**, cố định (tripod/kẹp/chồng sách). Cầm tay sẽ rung thấy rõ.
- ☐ Ống kính **ngang tầm mắt hoặc cao hơn mắt 5–10cm**, chếch xuống nhẹ. Đặt thấp hơn cằm là góc xấu nhất.
- ☐ Cách mặt **50–70cm**. Đầu chiếm khoảng 1/3 khung, chừa khoảng trống phía trên đầu.
- ☐ Quay **4K nếu máy cho** — dựng sẽ crop/zoom nhẹ để giả đổi góc máy, cần dư pixel.
- ☐ **Tắt beauty filter.** Raw content phải trông thật.
- ☐ Khoá AE/AF (chạm giữ vào mặt) để máy không tự đổi sáng giữa câu.

**Sáng**
- ☐ Nguồn sáng **trước mặt**, không sau lưng. Cửa sổ ban ngày là tốt nhất và miễn phí.
- ☐ Ngồi quay mặt về phía cửa sổ, cách 1–1.5m. Không ngồi lưng quay ra cửa sổ.
- ☐ Không để đèn trần chiếu thẳng đỉnh đầu — tạo bóng đen hốc mắt.

**Tiếng** (quan trọng hơn hình — người xem tha hình xấu, không tha tiếng tệ)
- ☐ Micro cài áo, kẹp **dưới xương quai xanh, cách miệng 15–20cm**, giấu dây trong áo.
- ☐ Phòng kín, tắt quạt/điều hoà/máy giặt. Phòng nhiều đồ vải vang ít hơn phòng trống.
- ☐ **Bật chế độ máy bay**, tắt hết thông báo.

**Kiểm tra trước khi quay thật**
- ☐ Quay thử **5 giây** → xem lại → nghe có tiếng không, sáng có ổn không. Đừng quay hết ${doc.scenes.length} scene rồi mới phát hiện mic chưa kết nối.
- ☐ Đọc to toàn bộ lời thoại **1 lần** trước khi bấm máy — câu nào líu lưỡi thì sửa luôn cho hợp mồm mình.

## 📋 Cách quay

**Quay từng scene thành file riêng.** Không quay một mạch từ đầu đến cuối. Ba lý do:
1. Sai chỗ nào quay lại đúng chỗ đó, không phải làm lại cả bài.
2. Mỗi file khớp 1–1 với một scene → khâu dựng ghép tự động, không phải cắt tay.
3. Ranh giới file thành jump-cut tự nhiên — đúng phong cách TikTok.

**Thứ tự quay:** ${order.map((i) => `\`${doc.scenes[i].id}\``).join(' → ')}
Hook (\`${doc.scenes[hookIdx]?.id}\`) quay **cuối cùng** — lúc đó bạn đã nóng máy, đã kể xong câu chuyện, cách vào đề sẽ tự nhiên và có lửa hơn hẳn take đầu tiên.

**Mỗi scene:**
- Bấm quay → **im 1 giây** → nói → nói xong **im 1 giây** → bấm dừng. Một giây câm hai đầu là chỗ để dựng cắt gọn.
- Nhìn **thẳng ống kính**, không nhìn màn hình. Dán mẩu giấy có mũi tên cạnh ống kính nếu hay quên.
- Nói **to hơn bình thường ~20%**. Lên video lúc nào cũng nghe trầm và thiếu năng lượng hơn lúc quay.
- **Đừng học thuộc lòng.** Đọc lời 2–3 lần nắm ý, rồi nói bằng lời của mình. Vấp nhẹ thì giữ — đó là cái làm nó thật.
- Quay **2–3 take**. Take 1 gần như luôn tệ nhất, cứ coi nó là take khởi động.
- Đổi góc máy giữa các scene: đổi khoảng cách tay + xoay người ~15°, không cần dời tripod.

## 🎥 Từng scene

${order.map((i, k) => sceneBlock(i, k + 1)).join('\n')}
## ✅ Xong buổi quay

Chọn take tốt nhất mỗi scene, đổi tên và bỏ vào \`content/${doc.id}/raw/\`:

${doc.scenes.map((s) => `- ☐ \`raw/${s.id}.mov\``).join('\n')}

Take dư giữ lại ở \`raw/takes/\` phòng khi cần đổi.
${bRollNotes.length ? `\nB-roll cần quay thêm:\n${doc.scenes.filter((s) => s.bRoll).map((s) => `- ☐ \`raw/${s.id}-broll.mov\` — ${s.bRoll}`).join('\n')}\n` : ''}
Đủ file rồi thì chuyển sang khâu dựng.
`;

writeFileSync(join(dir, 'script.md'), scriptMd);
writeFileSync(join(dir, 'shoot.md'), shootMd);
console.log(`OK     đã sinh script.md + shoot.md trong ${dir}`);
