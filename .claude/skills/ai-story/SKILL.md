---
name: ai-story
description: Biến một câu chuyện triết lý sống thành video dọc 9:16 hoàn toàn bằng AI — lời bình do máy đọc, tranh minh hoạ do máy vẽ, không cần quay, không cần thu âm. Hợp chủ đề muôn kiếp nhân sinh, nhân quả, tiền kiếp, sống tỉnh thức, đối nhân xử thế. Xuất ra content/<date>-<time>-<slug>/story.json rồi dựng thành out/<dir>.mp4 có tiêu đề đứng yên, tranh chuyển mượt và phụ đề khớp từng câu. Dùng khi user dán một câu chuyện, một bài học cuộc sống, hoặc nói "làm video kể chuyện", "video AI", "video triết lý", "kiểu muôn kiếp nhân sinh".
---

# AI Story Video

Nhận **một câu chuyện** → xuất `out/<dir>.mp4`, 1080×1920 @ 30fps.
Giọng đọc và tranh đều sinh trên máy, **không API key, không mất tiền**.

Định dạng dựng theo `docs/refer/muonkiepnhansinh.MP4`. Đặc tả bố cục và mọi con số đo
được: `references/design-system.md`.

---

## Bộ máy

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Giọng đọc | [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) | Apache 2.0, chạy CPU, 14 giọng Bắc/Trung/Nam, nhân bản được giọng bạn |
| Tranh | [mflux](https://github.com/filipstrand/mflux) + Z-Image Turbo | MIT, chạy trên GPU máy Mac |
| Dựng | Remotion, composition `StoryVideo` | |

Cả hai đều tải model về máy lần đầu. Xem `references/setup.md`.

---

## Quy trình

### Bước 0 — Cài (chỉ lần đầu)

```bash
node .claude/skills/ai-story/scripts/setup.mjs
node .claude/skills/ai-story/scripts/setup.mjs --check   # kiểm lại bất cứ lúc nào
```

Thiếu `ffmpeg` hay `uv` thì script nói rõ phải cài gì.

### Bước 1 — Chốt input

Rút từ prompt của user:

| Field | Bắt buộc | Mặc định |
|---|---|---|
| Câu chuyện hoặc chủ đề | ✅ | — |
| `voice` | ❌ | `"Thanh Bình"` (nam, Bắc, kể chuyện) |
| `voiceRef` | ❌ | mẫu giọng để nhân bản; có nó thì `voice` bị bỏ qua |
| `style` | ❌ | `"doodle"` |
| Độ dài | ❌ | do câu chuyện quyết |

Xử lý input mơ hồ:

- User đưa **chủ đề trần** ("làm video về lòng biết ơn") → tự nghĩ một câu chuyện cụ thể
  có nhân vật, có tình huống, có cú lật. **Nói rõ trong phần trả lời** là bạn tự nghĩ.
- User dán **một câu chuyện dài** → giữ nguyên cốt, cắt gọn cho vừa nhịp nói.
- User dán **nhiều mẩu** → chọn mẩu sắc nhất. Không gộp.

Đừng hỏi vặt. Danh sách giọng và phong cách: `references/setup.md`.

### Bước 2 — Đọc framework

**Bắt buộc** đọc `references/storytelling.md` trước khi viết chữ đầu tiên — cấu trúc kể,
cách đặt tiêu đề 2 dòng, cách cắt cảnh, và danh sách anti-pattern.

### Bước 3 — Brainstorm nội bộ (KHÔNG in ra chat)

1. **3 cách đặt tiêu đề 2 dòng** theo 3 kiểu khác nhau → chọn cái sắc nhất.
2. **Cú lật của câu chuyện** — điều người xem tưởng vậy mà hoá ra không phải vậy.
3. **Bài học** — rút ra được trong một câu, không giảng đạo.

### Bước 4 — Tạo thư mục

Nghĩ phần slug: bỏ dấu, kebab-case, tối đa 6 từ. Rồi chạy:

```bash
node .claude/skills/ai-story/scripts/new-dir.mjs <slug>
```

Script in ra tên thư mục đầy đủ kèm ngày giờ và tạo luôn thư mục.

**Bắt buộc chạy script, không tự gõ ngày giờ** — bạn chỉ biết ngày, không biết giờ trên máy.

### Bước 5 — Ghi `story.json`

- `id` = **đúng tên thư mục** bước 4 in ra. Validator chặn nếu lệch.
- Đặc tả field: `references/output-format.md`. Ví dụ đầy đủ: `assets/example/story.json`.

Hai luật dễ quên nhất:

- **Lời bình (`lines`) viết tiếng Việt. Mô tả tranh (`image`, `cast[].look`) viết TIẾNG ANH.**
  Model vẽ không hiểu tiếng Việt. Validator bắt lỗi này.
- **Mọi nhân vật xuất hiện lại phải khai trong `cast`.** Model vẽ không nhớ cảnh trước —
  mỗi cảnh đều phải tả lại nguyên văn ngoại hình thì nhân vật mới không mỗi cảnh một kiểu.

### Bước 6 — Validate rồi sinh bảng kịch bản

```bash
S=.claude/skills/ai-story/scripts
node $S/validate-story.mjs content/<dir>/story.json && node $S/build-docs.mjs content/<dir>/story.json
```

Còn `ERROR` thì sửa rồi chạy lại. Không đi tiếp khi còn ERROR.

### Bước 7 — DỪNG LẠI, đưa user duyệt

**Đây là bước tốn tiền nhất nếu bỏ qua.** Sinh ảnh mất khoảng **3,5 phút một cảnh** —
câu chuyện 30 cảnh là **gần 2 tiếng máy chạy**. Sửa kịch bản sau khi vẽ xong là vứt cả 2 tiếng đó.

In ra chat:
1. Tiêu đề 2 dòng.
2. Bảng kịch bản (Vào lúc | Dài | Lời bình | Cảnh vẽ) — lấy từ `story.md`.
3. Tổng thời lượng ước tính và số phút sinh ảnh.
4. Hỏi user duyệt hay sửa.

**Chỉ chạy bước 8 khi user đã đồng ý.**

### Bước 8 — Chạy pipeline

```bash
S=.claude/skills/ai-story/scripts
node $S/tts.mjs          <slug>    # giọng đọc, ~25s cho video 3 phút
node $S/images.mjs       <slug>    # tranh, ~3,5 phút một cảnh — LÂU NHẤT, chạy nền
node $S/build-props.mjs  <slug>
node $S/render.mjs       <slug>
```

Gõ mỗi phần slug là đủ, mọi script tự tìm thư mục kết thúc bằng chuỗi đó.

| Stage | Ra | Việc |
|---|---|---|
| `tts` | `audio/l###.wav`, `audio/voice.wav`, `timing.json` | Mỗi dòng một file → biết chính xác nó dài bao nhiêu |
| `images` | `images/s##.png` | Mỗi cảnh một ảnh. **Chạy lại được**, ảnh nào có rồi thì bỏ qua |
| `build-props` | `props.json` | Đổi giây ra frame, rải Ken Burns |
| `render` | `out/<dir>.mp4` | Remotion |

`images.mjs` lâu nên chạy nền được. Vẽ hỏng một cảnh thì sửa `image` trong `story.json`
rồi `node $S/images.mjs <slug> --only=s07`, không phải làm lại cả bộ.

### Bước 9 — Đọc WARN rồi báo cáo

Ba WARN phải nói lại cho user:

- `cảnh đứng quá 8s` → cảnh đó ì, tách bớt lời thoại sang cảnh mới.
- `ảnh vẽ hỏng` → chạy lại đúng cảnh đó bằng `--only=`.
- `dòng dài quá 7s` → phụ đề trôi quá lâu, cắt câu ngắn lại.

Báo cáo: đường dẫn mp4, thời lượng thật, số cảnh, mọi WARN, và nhắc bỏ nhạc nền vào
`content/_assets/bgm/` nếu chưa có.

---

## Xem trước không cần render cả video

```bash
S=.claude/skills/ai-story/scripts
node $S/render.mjs <slug> --frame=240   # ra out/<dir>-f240.png, vài giây
node $S/render.mjs <slug> --studio      # mở Remotion Studio, tua timeline
```

Soi bố cục thì dùng `--frame`, nhanh hơn render cả video rất nhiều.

---

## Khi cần sửa giao diện

Skill này **không** chứa kiến thức Remotion. Trước khi sửa `remotion/src/story/`:

| Việc | Đọc skill |
|---|---|
| Animation, layout, typography, audio | `/remotion-markup` |
| Tra API, tên prop | `/remotion-docs` |
| Lệnh render | `/remotion-render` |

Màu, font, toạ độ, mọi con số đo từ video mẫu: `references/design-system.md`.

---

## Luật cứng

- **Lời bình tiếng Việt, mô tả tranh tiếng Anh.** Không có ngoại lệ.
- **Không sửa `story.md`** — sinh tự động từ `story.json`.
- **Không bỏ bước duyệt ở bước 7.** Vẽ trước hỏi sau là đốt hàng tiếng đồng hồ của user.
- Tiêu đề 2 dòng phải **VIẾT HOA** và **dưới 20 ký tự mỗi dòng** — dài hơn thì chữ tự co
  lại và mất tác dụng giữ chân người lướt.
- **Không bịa số liệu, nghiên cứu, hay trích dẫn người có thật.** Chuyện ngụ ngôn thì kể
  như ngụ ngôn, đừng gán cho một nhân vật lịch sử có thật câu nói mà họ không nói.
- Không giảng đạo. Kể chuyện rồi để bài học tự lộ ra.
- **Không copy ví dụ trong `assets/example/`** — đó là mẫu format, không phải kho nội dung.

## Cấu trúc

```
.claude/skills/ai-story/
├── SKILL.md                    ← file này
├── references/
│   ├── storytelling.md         ← cấu trúc kể, tiêu đề, cắt cảnh, anti-pattern
│   ├── output-format.md        ← đặc tả story.json
│   ├── design-system.md        ← số đo lấy từ video mẫu
│   └── setup.md                ← cài đặt, danh sách giọng, phong cách, sự cố
├── scripts/
│   ├── setup.mjs               cài venv TTS + mflux            (--check)
│   ├── new-dir.mjs             sinh content/<date>-<time>-<slug>/
│   ├── validate-story.mjs      kiểm story.json
│   ├── build-docs.mjs          story.json → story.md
│   ├── tts.mjs                 giọng đọc + timing.json          (--voice= --ref= --force)
│   ├── tts_worker.py           cầu nối sang VieNeu-TTS
│   ├── voice-sample.mjs        rút mẫu giọng sạch từ video      (--scan --at= --dur= --raw)
│   ├── make-test-images.mjs    ảnh giả để chạy thử
│   ├── images.mjs              tranh minh hoạ                  (--only= --force --dry)
│   ├── build-props.mjs         → props.json
│   ├── render.mjs              → out/<dir>.mp4                 (--studio --frame=)
│   └── lib.mjs                 tiện ích chung
└── assets/
    ├── styles.json             preset phong cách tranh
    └── example/story.json      ví dụ đầy đủ

remotion/src/story/             composition "StoryVideo"
content/_assets/bgm/            nhạc nền, user tự bỏ vào
```
