# Đặc tả output

```
content/2026-08-18-09-23-nhan-chi-so-tinh-ban-thien/
├── script.json    ← BẠN VIẾT. Hợp đồng dữ liệu, skill dựng video đọc file này
├── script.md      ← sinh tự động. Bảng kịch bản
└── shoot.md       ← sinh tự động. Hướng dẫn quay: setup, thứ tự, cue card
```

Tên thư mục là `<YYYY-MM-DD>-<HH>-<MM>-<slug>`, do `scripts/new-dir.mjs` sinh ra.
Tiền tố thời gian có độ rộng cố định nên `ls content/` tự sắp theo thứ tự viết.

`script.json` là nguồn chân lý duy nhất. Hai file `.md` sinh ra từ nó bằng
`scripts/build-docs.mjs` — **không gõ tay, không sửa tay**. Sửa nội dung thì sửa JSON rồi chạy lại.

Ví dụ hoàn chỉnh cả 3 file: `assets/example/`.

---

## 1. `script.json`

Đây là **hợp đồng** giữa skill viết kịch bản và skill dựng video. Sai schema → khâu render gãy.
`scripts/validate-script.mjs` là nguồn chân lý duy nhất cho schema này.

### Top-level

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `version` | number | ✅ | Luôn là `1` |
| `id` | string | ✅ | **Trùng đúng tên thư mục**, `^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-<slug>$`. Lấy từ `new-dir.mjs` |
| `quote` | string | ✅ | Nguyên văn câu châm ngôn |
| `title` | string | ✅ | Tiêu đề nội bộ, ngắn gọn |
| `topic` | string | ✅ | Chủ đề 1 cụm từ, vd `"thói quen cà khịa nơi công sở"` |
| `angle` | string | ✅ | Góc nhìn người kể, vd `"dân IT trải đời"` |
| `context` | string | ✅ | Bối cảnh quay, vd `"Góc làm việc, bàn máy tính"` |
| `durationSec` | number | ✅ | 20–60. Ngọt nhất 30–45 |
| `fps` | number | ✅ | `30` hoặc `60` |
| `width` | number | ✅ | `1080` |
| `height` | number | ✅ | `1920` |
| `tone` | string | ✅ | Mô tả tông giọng cho khâu TTS/diễn xuất |
| `audio` | object | ✅ | `{ bgm, bgmVolume }` |
| `voice` | object | ✅ | `{ lang, gender, style }` |
| `scenes` | array | ✅ | 4–6 phần tử |
| `hashtags` | string[] | ✅ | 5–8 phần tử, mỗi cái bắt đầu bằng `#` |
| `postCaption` | string | ✅ | Caption đăng bài TikTok, ≤ 150 ký tự |

`audio`:

| Field | Kiểu | Giá trị |
|---|---|---|
| `bgm` | string | `lofi` \| `chill` \| `comedy` \| `emotional` \| `upbeat` |
| `bgmVolume` | number | `0.10`–`0.15` |

`voice`:

| Field | Kiểu | Giá trị |
|---|---|---|
| `lang` | string | `vi-VN` |
| `gender` | string | `male` \| `female` |
| `style` | string | Mô tả tự do, vd `"tâm sự, hóm hỉnh, tốc độ nhanh"` |

### `scenes[]`

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ | `s1`, `s2`, ... đúng thứ tự |
| `role` | string | ✅ | `hook` \| `story` \| `punchline` \| `cta` |
| `startSec` | number | ✅ | Scene đầu = `0`; mỗi scene sau = `endSec` của scene trước (khít, không hở) |
| `endSec` | number | ✅ | Scene cuối = `durationSec` |
| `visual` | string | ✅ | Hành động, góc máy, biểu cảm. **Không** mở đầu bằng `(Hook)`/`(CTA)` — generator tự thêm nhãn |
| `voiceover` | string | ✅ | Lời thoại **chính xác** sẽ nói |
| `cueWords` | string[] | ✅ | 2–6 cụm mồi nhớ dán cạnh ống kính khi quay. Xem `SKILL.md` bước 4b |
| `caption` | object | ✅ | Xem dưới |
| `sfx` | string[] | ✅ | Có thể rỗng `[]`. Giá trị hợp lệ xem `framework.md` mục H |
| `bRoll` | string \| null | ✅ | Gợi ý cảnh chèn, hoặc `null` |

`caption`:

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `text` | string | ✅ | ≤ 90 ký tự (ngọt ≤ 60) |
| `highlight` | string[] | ✅ | 0–3 substring **xuất hiện nguyên văn** trong `text` |
| `style` | string | ✅ | `hook` \| `normal` \| `punch` \| `cta` |
| `emoji` | string \| null | ✅ | Tối đa 1 emoji, hoặc `null` |

### Field do skill khác ghi — ĐỪNG tự thêm

Sau khi quay, user bỏ footage vào `content/<dir>/raw/s1.mov`…, rồi khâu dựng sinh tiếp
`timing.json` (word-level timing từ Whisper), `cuts.json` (jump-cut) và `props.json`.
Skill này **không** động vào những thứ đó, và **không** ghi timing chi tiết vào `script.json`.

Lưu ý: `startSec`/`endSec` trong `script.json` là **chỉ tiêu khi quay**, không phải sự thật.
Độ dài thật đến từ file footage — khâu dựng sẽ re-time lại toàn bộ.

---

## 2. `script.md` và `shoot.md` — sinh tự động

```bash
node .claude/skills/tiktok-script/scripts/build-docs.mjs content/<dir>/script.json
```

Đọc `script.json`, ghi đè cả hai file `.md` cạnh nó. Toàn bộ format nằm trong `build-docs.mjs` —
đây là nơi duy nhất định nghĩa layout, đừng mô tả lại ở chỗ khác.

Những thứ generator tự suy ra, **không** cần bạn ghi vào JSON:

| Thứ | Suy ra từ |
|---|---|
| Nhãn khối `(Hook)` `(Tâm sự)` `(Cao trào)` `(Đúc kết)` `(CTA)` | `scene.role` — nhiều `story` thì cái đầu là Tâm sự, sau đó Cao trào |
| Bold từ khoá trong cột caption | `caption.highlight` |
| Mốc thời gian `m:ss – m:ss` | `startSec` / `endSec` |
| Nhịp nói (từ/giây) trong `shoot.md` | đếm từ `voiceover` chia độ dài scene |
| Thứ tự quay (hook quay cuối) | `scene.role` |
| Checklist file `raw/sN.mov` | `scene.id` |

Xem output thật ở `assets/example/script.md` và `assets/example/shoot.md`.
