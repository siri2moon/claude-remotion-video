---
name: tiktok-video
description: Dựng video ngắn TikTok 9:16 từ kịch bản content/<dir>/script.json và footage selfie tự quay trong content/<dir>/raw/. Chạy pipeline 6 stage — preflight, tách tiếng, whisper word-timing, jump-cut khoảng lặng, build props, render Remotion — ra out/<dir>.mp4 có phụ đề động và highlight từ khoá. Dùng khi user nói "dựng video", "render video", "ghép footage", "làm video từ kịch bản", hoặc đã quay xong và muốn ra thành phẩm.
---

# TikTok Video Builder (Remotion)

Nhận kịch bản + footage selfie user tự quay → xuất `out/<dir>.mp4`, 1080×1920 @ 30fps.
Giọng thật từ clip, **không dùng TTS**.

Skill này là **orchestrator**. Nó không chứa kiến thức Remotion — phần đó ủy quyền cho
skill chính thức của Remotion (mục "Khi cần sửa giao diện" bên dưới).

---

## Hợp đồng đầu vào

```
content/2026-08-18-09-23-nhan-chi-so-tinh-ban-thien/
├── script.json          ← từ skill tiktok-script, đã validate
├── shoot.md             ← hướng dẫn quay (skill kia sinh)
└── raw/
    ├── s1.mov           ← BẮT BUỘC, mỗi scene một file, .mov hoặc .mp4
    ├── s2.mov
    └── …
```

Quy ước "một scene = một file" là thứ làm pipeline này khả thi. Thiếu file nào, stage 1 báo tên chính xác.

---

## Quy trình

### Bước 0 — Setup (chỉ lần đầu)

```bash
cd remotion && pnpm install
```

Kiểm tra `ffmpeg`: `which ffmpeg` — chưa có thì `brew install ffmpeg`.

**Dùng `pnpm`, không dùng `npm`/`npx`.**

### Bước 1 — Chốt slug

Thư mục kịch bản tên `<YYYY-MM-DD>-<HH>-<MM>-<slug>`, vd
`2026-08-18-09-23-nhan-chi-so-tinh-ban-thien`.

**Không cần gõ đủ cả tiền tố.** Mọi stage chấp nhận mỗi phần slug — chúng tự tìm thư mục
kết thúc bằng chuỗi đó, trùng nhiều thì lấy cái mới nhất và in ra tên đã chọn.

Lấy từ prompt user, hoặc `ls content/` rồi hỏi nếu có nhiều thư mục.
Nếu chỉ có đúng 1 thư mục thì tự chọn, đừng hỏi.

### Bước 2 — Chạy pipeline

Chạy tuần tự, dừng ngay khi có ERROR:

```bash
S=.claude/skills/tiktok-video/scripts
node $S/preflight.mjs      <slug>
node $S/extract-audio.mjs  <slug>
node $S/transcribe.mjs     <slug>
node $S/detect-cuts.mjs    <slug>
node $S/build-props.mjs    <slug>
node $S/render.mjs         <slug>
```

Mỗi stage ghi ra một file trung gian, chạy lại độc lập được. Chi tiết cờ và cách chỉnh:
`references/pipeline.md`.

| Stage | Ra | Việc |
|---|---|---|
| `preflight` | `media.json` | Kiểm đủ file, đúng định dạng, **có tiếng không** |
| `extract-audio` | `audio/sN.wav` | 16kHz mono cho whisper + chuẩn hoá -14 LUFS |
| `transcribe` | `timing.json` | Whisper lấy thời điểm, **chữ lấy từ `voiceover` gốc** |
| `detect-cuts` | `cuts.json` | Tìm khoảng lặng → danh sách đoạn giữ lại |
| `build-props` | `props.json` | Re-time toàn bộ theo footage thật |
| `render` | `out/<dir>.mp4` | Remotion render |

### Bước 3 — Đọc kỹ WARN

Pipeline chạy xong không có nghĩa là video ổn. Ba WARN phải báo lại user:

- `khớp XX%` **dưới 70%** ở stage transcribe → user nói lệch kịch bản nhiều, phụ đề có thể sai nhịp.
- `cắt mất XX%` **trên 50%** ở stage detect-cuts → mic quá nhỏ, thử `--silence-db=-40`.
- `rơi về fallback` → phụ đề đúng chữ nhưng **không khớp nhịp nói**. Nói rõ cho user biết.

### Bước 4 — Báo cáo

1. Đường dẫn `out/<dir>.mp4`, thời lượng thành phẩm.
2. Nếu thành phẩm lệch nhiều so với `durationSec` trong kịch bản → nói rõ (bình thường, timeline lấy theo footage thật).
3. Mọi WARN ở bước 3.
4. Thiếu BGM/SFX thì nhắc user bỏ file vào `content/_assets/`.

---

## Chạy thử khi chưa quay

Verify pipeline không cần cầm máy:

```bash
node .claude/skills/tiktok-video/scripts/make-test-footage.mjs <slug>   # sinh clip giả, GHI ĐÈ raw/
node .claude/skills/tiktok-video/scripts/transcribe.mjs <slug> --fallback  # bỏ qua whisper
```

`--fallback` chia đều thời lượng cho số từ — chữ đúng, nhịp sai, nhưng đủ để kiểm tra pipeline
thông suốt trước khi tải model whisper 1.5GB.

⚠️ `make-test-footage.mjs` **ghi đè** `raw/`. Đừng chạy khi đã có footage thật.

---

## Xem trước

```bash
node .claude/skills/tiktok-video/scripts/render.mjs <slug> --studio
```

Mở Remotion Studio, tua timeline, sửa component rồi thấy đổi ngay.

---

## Khi cần sửa giao diện

Skill này **không** chứa kiến thức Remotion. Trước khi sửa file trong `remotion/src/`:

| Việc | Đọc skill |
|---|---|
| Sửa animation, layout, typography, audio | `/remotion-markup` |
| Sửa logic phụ đề | `/remotion-captions` |
| Tra API, tên prop | `/remotion-docs` |
| Lệnh render | `/remotion-render` |

Màu sắc, font, safe area, preset caption: `references/design-system.md`.

---

## Luật cứng

- **Không sửa `script.json`.** Nó là output của skill `tiktok-script`. Kịch bản sai thì chạy lại skill kia.
- **Không sửa file `.md` trong `content/`.** Chúng sinh tự động từ `script.json`.
- `startSec`/`endSec` trong `script.json` là **chỉ tiêu khi quay**, không phải sự thật.
  Timeline thật luôn tính từ footage. Đừng cố ép thành phẩm khớp `durationSec`.
- **Chữ trên màn hình luôn lấy từ `voiceover`**, không bao giờ lấy từ output whisper.
  Whisper tiếng Việt sai dấu — đây là lý do tồn tại của `scripts/align.mjs`.
- Thiếu BGM/SFX **không chặn** pipeline. Video vẫn render, chỉ là không có nhạc.

## Cấu trúc

```
.claude/skills/tiktok-video/
├── SKILL.md
├── references/
│   ├── pipeline.md          ← chi tiết từng stage, mọi cờ, file trung gian
│   ├── design-system.md     ← màu, font, safe area, preset
│   └── troubleshooting.md   ← lỗi hay gặp
└── scripts/
    ├── lib.mjs              tiện ích chung
    ├── align.mjs            ghép timing whisper vào chữ gốc  (self-test: --test)
    ├── preflight.mjs        stage 1
    ├── extract-audio.mjs    stage 2
    ├── transcribe.mjs       stage 3
    ├── detect-cuts.mjs      stage 4
    ├── build-props.mjs      stage 5
    ├── render.mjs           stage 6
    └── make-test-footage.mjs  footage giả để chạy thử

remotion/                    ← Remotion project, composition "TikTokVideo"
content/_assets/{bgm,sfx}/   ← nhạc nền và hiệu ứng tiếng, user tự bỏ vào
```
