# claude-remotion-video

Dựng video dọc 9:16 bằng Claude Code + Remotion. Ba định dạng, ba đường đi riêng.

## Ba pipeline

**A — Selfie quay thật.** Giọng thật, mặt thật, không TTS.

```
châm ngôn ──/tiktok-script──▶ script.json ──▶ bạn quay theo shoot.md ──/tiktok-video──▶ out/<dir>.mp4
                                                  raw/s1.mov …
```

**B — Kể chuyện bằng tranh AI.** Không quay, không thu âm, chạy hết trên máy.

```
câu chuyện ──/ai-story──▶ story.json ──▶ [duyệt] ──▶ giọng + tranh sinh trên máy ──▶ out/<dir>.mp4
```

**C — Kịch bản hài vô tri (deadpan) để tự diễn.** Ra PDF cầm đọc khi quay, kèm chữ cho thumbnail và caption đăng bài.

```
câu nói ──/votri-script──▶ kichban.json ──▶ [duyệt trong chat] ──▶ kichban.pdf ──▶ bạn quay & diễn
```

## Skills

| Skill | Việc |
|---|---|
| `tiktok-script` | Châm ngôn → kịch bản selfie 30–45s + hướng dẫn quay |
| `tiktok-video` | Footage + kịch bản → mp4, jump-cut + phụ đề động theo từng từ |
| `ai-story` | Câu chuyện triết lý → mp4, tranh AI + giọng AI + phụ đề theo cụm |
| `votri-script` | Câu nói / danh ngôn / câu thính / câu chuyện → kịch bản hài vô tri deadpan 45–120s → PDF để diễn, kèm title, subtitle, dòng chữ gây sốc, caption |

## Setup

```bash
brew install ffmpeg uv
cd remotion && pnpm install
```

Riêng cho `ai-story` (chỉ lần đầu):

```bash
node .claude/skills/ai-story/scripts/setup.mjs
```

Riêng cho `votri-script`: cần **Google Chrome** (để in PDF) và `poppler` nếu muốn xem trước PDF
dưới dạng ảnh (`brew install poppler`).

Dùng **pnpm**, không dùng npm.

---

# Pipeline A — selfie quay thật

## 1. Viết kịch bản

```
/tiktok-script "Có công mài sắt, có ngày chai tay"
```

Sinh 3 file trong `content/<YYYY-MM-DD>-<HH>-<MM>-<slug>/`, vd
`content/2026-08-18-09-23-co-cong-mai-sat/`:

| File | Việc |
|---|---|
| `script.json` | nguồn chân lý, skill 2 đọc file này |
| `script.md` | bảng kịch bản để đọc |
| `shoot.md` | **mở file này khi cầm máy quay** — setup, thứ tự, cue card từng scene |

Hai file `.md` sinh tự động từ `script.json`, đừng sửa tay.

## 2. Quay

`shoot.md` quy định: **mỗi scene một file riêng**, đặt vào `content/<dir>/raw/s1.mov`, `s2.mov`…
Đây là hợp đồng để skill 2 ghép tự động.

## 3. Dựng

```
/tiktok-video <slug>
```

Chạy 6 stage: preflight → tách tiếng → whisper word-timing → jump-cut → build props → render.
Ra `out/<dir>.mp4`.

Gõ mỗi phần slug là đủ — mọi script tự tìm thư mục kết thúc bằng chuỗi đó,
trùng nhiều thì lấy cái mới nhất:

```
/tiktok-video co-cong-mai-sat        # không cần gõ 2026-08-18-09-23-
```

## Chạy thử khi chưa quay

```bash
S=.claude/skills/tiktok-video/scripts
node $S/make-test-footage.mjs <slug>        # clip màu trơn, GHI ĐÈ raw/
node $S/make-test-footage.mjs <slug> --busy # nền sặc sỡ, để soi chữ có đọc được không
node $S/preflight.mjs     <slug>
node $S/extract-audio.mjs <slug>
node $S/transcribe.mjs    <slug> --fallback # bỏ qua whisper
node $S/detect-cuts.mjs   <slug>
node $S/build-props.mjs   <slug>
node $S/render.mjs        <slug>
```

---

# Pipeline B — kể chuyện bằng tranh AI

```
/ai-story "Có một ông lão trồng cây bên đường mà biết mình không sống tới ngày có bóng mát…"
```

Skill viết kịch bản, **dừng lại đưa bạn duyệt**, rồi mới sinh giọng và tranh.
Bước duyệt không bỏ được — sinh tranh mất khoảng 3,5 phút một cảnh.

| Giai đoạn | Ra | Mất bao lâu |
|---|---|---|
| Viết kịch bản | `story.json`, `story.md` | vài giây |
| **Bạn duyệt** | | |
| Giọng đọc | `audio/`, `timing.json` | ~30s cho video 3 phút |
| Tranh | `images/s01.png`… | ~3,5 phút một cảnh |
| Dựng + render | `out/<dir>.mp4` | vài phút |

Chạy hoàn toàn trên máy: [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) đọc,
[mflux](https://github.com/filipstrand/mflux) + Z-Image Turbo vẽ.
**Không API key, không mất tiền mỗi video.**

Sinh tranh **chạy lại được** — ảnh nào có rồi thì bỏ qua, nên đứt giữa chừng không mất gì:

```bash
S=.claude/skills/ai-story/scripts
node $S/images.mjs <slug> --only=s07   # vẽ lại đúng một cảnh
node $S/images.mjs <slug> --dry        # xem prompt mà không vẽ
```

## Chạy thử không cần chờ vẽ

```bash
S=.claude/skills/ai-story/scripts
node $S/make-test-images.mjs <slug>    # ảnh giả mỗi cảnh một màu, GHI ĐÈ images/
node $S/build-props.mjs      <slug>
node $S/render.mjs           <slug> --frame=120   # soi bố cục, vài giây
```

---

# Pipeline C — kịch bản hài vô tri (deadpan) → PDF

Format: một mình ngồi trước camera, uống nước / ăn vặt, nhìn thẳng ống kính, mặt lạnh tanh,
giảng một câu nói tầm phào bằng giọng chuyên gia kinh tế, bác sĩ, thẩm phán. Nội dung càng vô lý,
thái độ càng nghiêm trang.

## 1. Đưa input

```
/votri-script "Tốt nhất chưa chắc đã phù hợp. Phù hợp nhất mới là sự tốt nhất…"
```

Input nhận 5 loại, skill tự nhận diện và chọn hướng khai thác:

| Loại | Ví dụ | Skill xử lý thế nào |
|---|---|---|
| Danh ngôn, tục ngữ | `"Nhân chi sơ, tính bản thiện"` | Đọc nửa đầu trang trọng rồi bẻ vế sau |
| Câu thính | `"Anh tặng em cây son, mỗi ngày trả lại anh một ít nhé"` | Giảng như một chiến lược kinh tế vĩ mô |
| Câu nói, quan điểm sống | `"Tốt nhất chưa chắc đã phù hợp…"` | Biến thành định luật / nguyên lý khoa học |
| Cụm từ, chủ đề | `"deadline"`, `"cuối tháng"` | Tự đặt một câu chốt rồi xử lý như danh ngôn |
| Tóm tắt câu chuyện | `"Nửa đêm úp mì, tâm sự với con kiến rồi…"` | Độc thoại có nhân vật, có cú lật mặt |

Có thể nói kèm yêu cầu bằng lời thường, không cần cú pháp:

```
/votri-script "Ngứa mồm" — khoảng 90 giây, bối cảnh quán trà đá vỉa hè
/votri-script phần 2 của video cây son: không ai comment bị trả son
```

Mặc định: 50–70 giây (cho phép 45–120), ngồi một mình ở bàn có ly nước hoặc đồ ăn vặt.

## 2. Duyệt kịch bản trong chat

Skill ghi `content/<YYYY-MM-DD>-<HH>-<MM>-<slug>/kichban.json` rồi **dừng lại** in ra chat:

- **Thumbnail:** Title · Subtitle · Dòng chữ gây sốc
- **Bảng kịch bản 5 phần:** Hook → Dẫn dắt → Twist → Giải thích nghiêm túc (nhưng vô tri) → Outro.
  Mỗi cảnh có thời gian, khung hình & diễn xuất, âm thanh/SFX, thoại nguyên văn, text trên màn hình
- **Caption + hashtag**
- **2 hướng khác** để đổi nếu không ưng

Trả lời bằng lời thường:

| Bạn nói | Skill làm |
|---|---|
| `"cảnh 3 đổi câu twist cho sốc hơn"`, `"rút còn 50 giây"`, `"đổi đạo cụ thành trà sữa"` | Sửa đúng chỗ đó, in lại phần đổi, hỏi chốt lại |
| `"lấy hướng 1"` | Viết lại toàn bộ theo hướng đó, cùng thư mục |
| `"duyệt"`, `"chốt"`, `"ok xuất pdf"` | Sang bước 3 |

Chưa chốt thì **không** có PDF — tránh in ra bản nháp.

## 3. Nhận PDF

`content/<dir>/kichban.pdf`, khổ A4:

| Phần | Nội dung |
|---|---|
| Đầu trang 1 | Title, subtitle, thời lượng, vai diễn, bối cảnh, **đạo cụ cần chuẩn bị**, thanh timeline 5 phần |
| Từng cảnh | Khung hình · Diễn xuất · Âm thanh, **thoại chữ lớn** để liếc đọc khi diễn, text màn hình |
| Cuối | Mẹo quay & diễn deadpan |
| Trang cuối | **Thông tin đăng video** (title, subtitle, dòng chữ gây sốc, caption, hashtag) + **prompt tạo thumbnail** 9:16 đã điền sẵn chữ — copy dán thẳng vào công cụ tạo ảnh |

Trong chat skill cũng in lại prompt thumbnail và caption trong code block để copy.

## 4. Quay

- Đặt máy ngang tầm mắt, nhìn vào **ống kính**, không nhìn màn hình preview.
- Không cười. Bật cười thì cắt, quay lại take đó.
- Twist cần **im lặng đủ 1.5–2 giây** — đếm thầm. Snap zoom có thể làm ở hậu kỳ.
- Tiếng đặt ly "cộp", tiếng húp, tiếng gõ bàn là SFX thật — đặt mic gần bàn.

## Chạy tay các script

Sửa `kichban.json` bằng tay rồi in lại PDF:

```bash
S=.claude/skills/votri-script/scripts
node $S/validate.mjs  content/<dir>/kichban.json   # kiểm tra schema, nhịp thoại, thứ tự 5 phần
node $S/build-pdf.mjs content/<dir>/kichban.json   # → kichban.html + kichban.pdf
```

`kichban.json` là nguồn chân lý — đừng sửa `kichban.html` / `kichban.pdf`.
Không tìm thấy Chrome thì chỉ định đường dẫn:

```bash
CHROME_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium" node $S/build-pdf.mjs content/<dir>/kichban.json
```

Muốn chỉnh "giọng hài" của skill (kho hook, kỹ thuật twist, công thức giải thích vô tri, luật đặt
title/caption): sửa `.claude/skills/votri-script/references/craft.md`.

---

## Cấu trúc

```
.claude/skills/tiktok-script/   viết kịch bản selfie + hướng dẫn quay
.claude/skills/tiktok-video/    pipeline dựng video từ footage
.claude/skills/ai-story/        pipeline kể chuyện bằng tranh AI
.claude/skills/votri-script/    kịch bản hài vô tri deadpan → PDF để diễn
remotion/src/                   composition "TikTokVideo"
remotion/src/story/             composition "StoryVideo"
content/<dir>/                  mỗi video một thư mục
content/_assets/{bgm,sfx}/      nhạc nền và hiệu ứng tiếng
out/                            thành phẩm
docs/refer/                     video tham khảo + mẫu giọng
docs/                           hồ sơ thiết kế
sample/                         PDF kịch bản vô tri làm tay trước đây (tham khảo)
```

## Kiểm tra nhanh

```bash
node .claude/skills/tiktok-script/scripts/validate-script.mjs content/<dir>/script.json
node .claude/skills/tiktok-video/scripts/align.mjs --test
node .claude/skills/votri-script/scripts/validate.mjs .claude/skills/votri-script/assets/example/kichban.json
```

