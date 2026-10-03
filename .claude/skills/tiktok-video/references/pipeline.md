# Chi tiết pipeline

Mọi script nhận `<slug>` làm tham số đầu tiên và đọc/ghi trong `content/<dir>/`.
Mỗi stage chạy lại độc lập được — sửa một khâu không phải chạy lại cả pipeline.

```
script.json + raw/*.mov
   │
   ├─[1] preflight      → media.json
   ├─[2] extract-audio  → audio/sN.wav
   ├─[3] transcribe     → timing.json
   ├─[4] detect-cuts    → cuts.json      ← SỬA TAY ĐƯỢC
   ├─[5] build-props    → props.json
   └─[6] render         → out/<dir>.mp4
```

---

## Stage 1 — `preflight.mjs <slug>`

Fail sớm, báo rõ. Không để phát hiện hỏng lúc đang render.

**ERROR (dừng pipeline)**
- Thiếu file scene → liệt kê chính xác cái nào thiếu.
- Clip không có luồng audio → gần như chắc chắn mic chưa kết nối lúc quay, phải quay lại.
- Không đọc được thời lượng.

**WARN (chạy tiếp)**
- Clip quay ngang → sẽ crop mạnh.
- Chiều cao < 1920 → mờ khi lên khung.
- Thời lượng lệch > 50% so với kịch bản → chỉ là thông báo, timeline lấy theo file thật.

Nhận đuôi: `.mov .MOV .mp4 .MP4 .m4v`.

> B-roll: nếu có `raw/sN-broll.mov` thì preflight báo có, nhưng **v1 chưa chèn b-roll vào video**.

---

## Stage 2 — `extract-audio.mjs <slug> [--force]`

```bash
ffmpeg -y -i <raw> -vn -ac 1 -ar 16000 -c:a pcm_s16le \
       -af loudnorm=I=-14:TP=-1.5:LRA=11 <out.wav>
```

- 16kHz mono 16-bit là **format bắt buộc** của whisper.cpp.
- `loudnorm` về -14 LUFS (mức chuẩn social): 5 scene quay rời nhau, khoảng cách miệng–mic
  lệch vài cm là âm lượng đã khác thấy rõ ở chỗ nối.
- Có cache theo mtime. `--force` để làm lại hết.

---

## Stage 3 — `transcribe.mjs <slug> [--model=medium] [--fallback] [--force]`

**Đây là stage rủi ro nhất.** Whisper tiếng Việt sai dấu thường xuyên
("ngứa mồm" → "ngưa mom"), mà chữ sai đập thẳng vào mặt người xem.

Cách xử: ta **đã biết chữ đúng** — nó nằm trong `scene.voiceover`.
Whisper chỉ đóng góp **thời điểm**, không đóng góp **chữ**. `align.mjs` ghép hai thứ lại
bằng Needleman-Wunsch trên chuỗi đã bỏ dấu, nên chịu được cả sai dấu lẫn user nói lệch kịch bản
(shoot.md có dặn "đừng học thuộc lòng").

| Cờ | Việc |
|---|---|
| `--model=medium` | mặc định. `large-v3-turbo` chính xác hơn nếu máy chịu được |
| `--fallback` | bỏ qua whisper, chia đều thời lượng cho số từ |
| `--force` | bỏ cache |

**Model `*.en` không dùng được cho tiếng Việt** — script chặn ngay, không để tải 1.5GB rồi mới biết.

Whisper.cpp cài vào `<root>/.whisper/` (dùng lại cho mọi video).

### Các mode trong `timing.json`

| mode | Nghĩa |
|---|---|
| `aligned` | Bình thường. Kèm `matchRatio` — dưới 0.7 thì user nói lệch kịch bản nhiều |
| `fallback-low-match` | Khớp < 40%. Sai file? Sai ngôn ngữ? Ồn quá? |
| `fallback-no-audio` | Whisper không nghe ra từ nào |
| `fallback-even` | Chia đều — chữ đúng, **nhịp sai** |

Mọi mode `fallback-*` đều hiển thị **đúng chữ**. Đánh đổi có chủ đích: thà lệch nhịp còn hơn sai chính tả.

### Self-test bộ align

```bash
node .claude/skills/tiktok-video/scripts/align.mjs --test
```

17 assertion, gồm ca quan trọng nhất: whisper trả về chữ mất dấu → output vẫn đủ dấu.
**Sửa `align.mjs` thì phải chạy lại test này.**

---

## Stage 4 — `detect-cuts.mjs <slug> [--no-cut] [--silence-db=-32] [--min-silence=0.35] [--pad=0.08]`

`ffmpeg silencedetect` → danh sách đoạn **giữ lại** trong `cuts.json`.

| Cờ | Mặc định | Chỉnh khi nào |
|---|---|---|
| `--silence-db` | `-32` | Cắt hụt → giảm về `-40`. Cắt lẹm vào lời → tăng lên `-26` |
| `--min-silence` | `0.35` | Cắt vụn quá → tăng lên `0.5` |
| `--pad` | `0.08` | Nghe cụt đầu/cuối câu → tăng lên `0.15` |
| `--no-cut` | — | Giữ nguyên clip, không jump-cut |

**`cuts.json` sửa tay được.** Máy cắt sai một chỗ thì sửa một dòng rồi chạy lại từ stage 5 —
không cần transcribe lại.

```json
{ "scenes": { "s1": { "durationSec": 3.0, "keep": [[0.92, 2.08]], "removedSec": 1.84 } } }
```

WARN nếu cắt mất > 50% clip (thường là mic quá nhỏ).
Nếu không phát hiện tiếng nói nào → giữ nguyên cả clip, còn hơn cắt sạch.

---

## Stage 5 — `build-props.mjs <slug>`

Gộp `script.json` + `media.json` + `timing.json` + `cuts.json` → `props.json`.

Việc chính là **re-time**: `startSec`/`endSec` trong kịch bản chỉ là chỉ tiêu khi quay.
Timeline thật = tổng các đoạn giữ lại.

Chỗ dễ sai nhất là ánh xạ thời gian trong file gốc → frame trên timeline tổng, vì phần
đã cắt phải bị trừ đi. Xem hàm `toTimeline()`.

**Hằng số chỉnh được** (đầu file):

| Hằng | Mặc định | Việc |
|---|---|---|
| `ZOOM` | `1.06` | Punch-in so le giữa các đoạn — jump-cut trông như đổi góc máy |
| `MAX_WORDS_PER_PAGE` | `3` | Số từ tối đa mỗi cụm phụ đề |
| `MAX_GAP_SEC` | `0.35` | Cách nhau hơn ngần này thì sang cụm mới |
| `MAX_PAGE_SEC` | `1.6` | Cụm không được dài hơn ngần này |
| `PAGE_HOLD_SEC` | `0.4` | Phụ đề nán lại sau khi nói xong |
| `TITLE_SHOW_SEC` | `2.6` | Chữ to tiêu đề khối hiện bao lâu |

> Gom cụm phụ đề viết tay trong `build-props.mjs` chứ không dùng
> `createTikTokStyleCaptions` của `@remotion/captions` — vì cần thêm ràng buộc
> **số từ tối đa mỗi cụm**, thứ hàm kia không có (nó chỉ gom theo ngưỡng thời gian).

### BGM và SFX

Đọc từ `content/_assets/`:

```
content/_assets/bgm/lofi.mp3      ← tên khớp script.json → audio.bgm
content/_assets/sfx/pop.mp3       ← tên khớp scene.sfx[]
```

**Thiếu file không chặn pipeline** — video vẫn render, chỉ báo info.

---

## Stage 6 — `render.mjs <slug> [--studio]`

```bash
pnpm exec remotion render TikTokVideo out/<dir>.mp4 \
  --public-dir <root>/content --props=content/<dir>/props.json
```

`--public-dir` trỏ vào `content/` nên `staticFile('<slug>/raw/s1.mov')` và
`staticFile('_assets/bgm/lofi.mp3')` đều đúng.

`--studio` mở Remotion Studio để xem trước và sửa live.

---

## File trung gian

| File | Sinh bởi | Sửa tay? |
|---|---|---|
| `media.json` | stage 1 | không |
| `audio/sN.wav` | stage 2 | không |
| `timing.json` | stage 3 | được, nếu muốn ép lại thời điểm |
| `cuts.json` | stage 4 | **được, đây là chỗ chỉnh jump-cut** |
| `props.json` | stage 5 | không — sẽ bị ghi đè |

Xoá hết file trung gian để làm lại từ đầu:

```bash
rm -rf content/<dir>/{media,timing,cuts,props}.json content/<dir>/audio
```
