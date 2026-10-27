# claude-remotion-video

Dựng video dọc 9:16 bằng Claude Code + Remotion. Bốn định dạng, bốn đường đi riêng.

## Bốn pipeline

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
câu nói ──/votri-script──▶ kichban.json ──▶ [duyệt] ──▶ kichban.pdf ──▶ bạn quay ──/tiktok-video──▶ out/<dir>.mp4
                                                                      raw/s1.mov …   (nhạc + SFX máy tự sinh)
```

**D — Short quảng bá Siri2Moon.** Giới thiệu một dự án trong ecosystem (quay thật app đang chạy) hoặc
biến một bài trên siri2moon.com thành video: cảnh terminal động, trang blog lia mượt, phụ đề VI/EN,
màn thương hiệu, màn kết Siri. Không quay tay, không thu âm.

```
bài blog / dự án ──/siri2moon-short──▶ short.json ──▶ capture (Chrome headless) ──▶ out/<dir>.mp4 + dang-bai.md
```

## Skills

| Skill | Việc |
|---|---|
| `tiktok-script` | Châm ngôn → kịch bản selfie 30–45s + hướng dẫn quay |
| `tiktok-video` | Footage + kịch bản (`script.json` hoặc `kichban.json`) → mp4, jump-cut + phụ đề động + nhạc/SFX tự tổng hợp |
| `ai-story` | Câu chuyện triết lý → mp4, tranh AI + giọng AI + phụ đề theo cụm |
| `votri-script` | Câu nói / danh ngôn / câu thính / câu chuyện → kịch bản hài vô tri deadpan 45–120s → PDF để diễn, kèm title, subtitle, dòng chữ gây sốc, caption |
| `siri2moon-short` | Dự án hoặc bài blog siri2moon.com → short 30–45s quảng bá thương hiệu, footage quay tự động + phụ đề VI/EN + caption đăng bài |

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
dưới dạng ảnh (`brew install poppler`). Nhạc nền và SFX không cần cài gì — tổng hợp bằng code.

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

Bạn **chỉ cần quay hình người thật** — nhạc, SFX, zoom, chữ, phụ đề máy tự thêm ở bước 5.

- **Mỗi cảnh một file**, tên đúng nhãn trên đầu cảnh trong PDF: `s1.mov`, `s2.mov`…
  Chép vào `content/<dir>/raw/`. Đuôi `.mov` hoặc `.mp4` đều được.
- Quay dọc 9:16, **phải có tiếng** (mic cài áo hoặc đặt gần bàn).
- Thừa vài giây đầu/đuôi không sao, máy tự tỉa. Hỏng câu thì nói lại câu đó trong cùng file
  cũng được — nhưng khớp kịch bản càng sát thì phụ đề càng chuẩn.
- Nhìn vào **ống kính**, không nhìn màn hình preview. Không cười — bật cười thì quay lại take đó.
- Cảnh có ⏸ trong PDF: **im đủ nhịp** như kịch bản, máy không cắt khoảng lặng đó. Snap zoom
  máy tự làm, không cần zoom tay.

## 5. Dựng video

```
/tiktok-video dinh-luat-phu-hop-toi-uu
```

Gõ mỗi phần slug là đủ. Pipeline tự nhận ra đây là thư mục vô tri (có `kichban.json`) và:

| Việc | Cách làm |
|---|---|
| Cắt khoảng lặng | Nhẹ tay: chừa lại 0.3s mỗi chỗ ngừng để giữ giọng chậm rãi. Cảnh twist (⏸) giữ nguyên khoảng lặng |
| Nhạc nền | **Tổng hợp bằng code**, đổi bài theo `music` từng cảnh: lo-fi → tắt phụt ở twist → funky/waltz |
| SFX | **Tổng hợp bằng code**, đặt đúng lúc: record scratch đầu cảnh, dế kêu ở khoảng lặng, "cộp"/"tưng" đúng từ được neo |
| Hình | Snap zoom giật vào mắt ở cảnh twist, chữ màn hình theo kịch bản, phụ đề chạy theo giọng nói |

Ra `out/<dir>.mp4`. Video ~60s render khoảng 2 phút. Lần đầu sẽ tải model whisper (~1.5GB) để
lấy nhịp giọng nói.

Nhạc và SFX do code tạo ra nên **thuộc về bạn 100%**, đăng kiếm tiền không vướng bản quyền. Nghe
"đủ dùng" chứ không mượt như nhạc thật. Muốn dùng nhạc riêng: chép đè file cùng tên vào
`content/_assets/bgm/` (vd `lofi.mp3`) hoặc `content/_assets/sfx/` — máy không bao giờ ghi đè file
đã có.

```bash
node .claude/skills/tiktok-video/scripts/audio-synth.mjs --list           # tên nhạc/SFX có sẵn
node .claude/skills/tiktok-video/scripts/audio-synth.mjs lofi --force     # sinh lại một bài
node .claude/skills/tiktok-video/scripts/render.mjs <slug> --studio       # xem trước, tua timeline
```

Chạy thử trước khi quay thật (footage giả — **ghi đè `raw/`**, đừng chạy khi đã có footage thật):

```bash
S=.claude/skills/tiktok-video/scripts
node $S/make-test-footage.mjs <slug> --busy
node $S/preflight.mjs <slug> && node $S/extract-audio.mjs <slug> && node $S/transcribe.mjs <slug> --fallback
node $S/detect-cuts.mjs <slug> && node $S/build-props.mjs <slug> && node $S/render.mjs <slug>
```

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

# Pipeline D — short quảng bá Siri2Moon

```
/siri2moon-short https://siri2moon.com/posts/beautiful-ec2-login-amazon-linux-2023-script
/siri2moon-short giới thiệu Lucifer
/siri2moon-short làm video hôm nay          # bài blog mới nhất chưa có video
```

Skill tự đọc bài (hoặc chạy dự án), viết `short.json`, quay, tự soi khung hình, dựng
`out/<dir>.mp4` và viết `content/<dir>/dang-bai.md` (tiêu đề, mô tả, hashtag cho YouTube, TikTok,
Facebook). Muốn bản tiếng Anh: "làm thêm bản tiếng Anh" → `out/<dir>-en.mp4`.

Chạy tay:

```bash
S=.claude/skills/siri2moon-short/scripts
node $S/page-info.mjs <url>                # đọc bài: heading, khối code, vị trí cuộn
node $S/validate.mjs <slug>
node $S/capture.mjs  <slug> --preview      # soi góc máy, rồi bỏ --preview để quay thật
node $S/render.mjs   <slug> --stills       # một khung mỗi cảnh để duyệt
node $S/render.mjs   <slug> [--lang=en]
```

Cần **Google Chrome** (quay) và `figlet` nếu muốn banner ASCII thật (`brew install figlet`).
Dự án nào chạy ra sao, quay góc nào đẹp: `.claude/skills/siri2moon-short/references/projects.md`.

---

## Cấu trúc

```
.claude/skills/tiktok-script/   viết kịch bản selfie + hướng dẫn quay
.claude/skills/tiktok-video/    pipeline dựng video từ footage + bộ tổng hợp nhạc/SFX
.claude/skills/ai-story/        pipeline kể chuyện bằng tranh AI
.claude/skills/votri-script/    kịch bản hài vô tri deadpan → PDF để diễn
.claude/skills/siri2moon-short/ short quảng bá thương hiệu: quay tự động, terminal động, dựng
remotion/src/                   composition "TikTokVideo"
remotion/src/story/             composition "StoryVideo"
remotion/src/short/             composition "BrandShort"
content/<dir>/                  mỗi video một thư mục
content/_assets/{bgm,sfx}/      nhạc nền và hiệu ứng tiếng (máy tự sinh, chép đè để dùng file riêng)
content/_assets/{short,brand}/  SFX của short + Siri, logo Siri2Moon
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
node .claude/skills/siri2moon-short/scripts/validate.mjs lucifer-gioi-thieu
```

