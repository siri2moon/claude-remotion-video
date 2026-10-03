# Đặc tả `story.json`

Nguồn chân lý duy nhất. `story.md` sinh ra từ nó. Mọi stage đọc nó.
Ví dụ đầy đủ: `assets/example/story.json`.

```json
{
  "id": "2026-08-18-09-23-nguoi-trong-cay",
  "topic": "Gieo mầm cho đời sau — cho đi mà không chờ nhận lại",
  "title": { "line1": "NGƯỜI TRỒNG CÂY", "line2": "KHÔNG NGỒI DƯỚI BÓNG" },
  "voice": "Thanh Bình",
  "style": "doodle",
  "seed": 20260818,
  "cast": [ { "id": "lao", "look": "An old white stick-figure man with …" } ],
  "scenes": [
    {
      "id": "s01",
      "lines": ["Có một ông lão đào hố bên vệ đường đất."],
      "image": "He is digging a small hole with a worn shovel beside a dusty road…",
      "cast": ["lao"]
    }
  ]
}
```

## Field cấp gốc

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ | **Đúng tên thư mục**, cả tiền tố ngày giờ. Validator chặn nếu lệch. |
| `title.line1` | string | ✅ | CHỮ HOA. Dưới 20 ký tự là đẹp, trên 30 là lỗi. |
| `title.line2` | string | ✅ | như trên |
| `topic` | string | ❌ | Một câu, để người đọc `story.md` nắm ý. Không lên màn hình. |
| `voice` | string | ❌ | Một trong 14 giọng. Mặc định `"Thanh Bình"`. Xem `setup.md`. |
| `voiceRef` | string | ❌ | Đường dẫn mẫu giọng để nhân bản, tính từ `content/<dir>/`. Có nó thì `voice` bị bỏ qua. |
| `style` | string | ❌ | Khoá trong `assets/styles.json`. Mặc định `"doodle"`. |
| `seed` | number | ❌ | Ghim để vẽ lại ra y hệt. Mặc định `20260818`. |
| `seedMode` | `"fixed"` \| `"vary"` | ❌ | `fixed` (mặc định) dùng chung một seed cho mọi cảnh — nhân vật đồng nhất hơn. `vary` cho bố cục đa dạng hơn nhưng nhân vật dễ trôi. |
| `bgm` | string | ❌ | Tên file trong `content/_assets/bgm/`. Không có thì lấy file đầu tiên. |
| `cast` | array | ❌ | Nhân vật xuất hiện nhiều lần |
| `scenes` | array | ✅ | ≥ 1 |

## `cast[]`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | Duy nhất. Cảnh tham chiếu bằng id này. |
| `look` | string | **TIẾNG ANH.** Ngoại hình đầy đủ. |

Đây là toàn bộ bí quyết giữ nhân vật xuyên suốt. Model vẽ **không nhớ cảnh trước** —
mỗi lần gọi nó chỉ có đúng đoạn chữ bạn đưa. `images.mjs` tự nhét `look` của mọi
nhân vật có mặt vào prompt của cảnh đó.

Tả đủ 5 thứ: **dáng người, đầu tóc, mắt/kính, áo, quần**. Thêm một phụ kiện đặc
trưng thì càng chắc (gậy, giỏ, khăn). Validator cảnh báo nếu `look` ngắn dưới 40 ký tự.

Nhân vật cùng một người ở hai giai đoạn đời khác nhau thì khai **hai entry riêng**
(`trai` và `giagia`), đừng cố nhét cả hai vào một mô tả.

## `scenes[]`

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ | Dạng `s01`, `s02`… Duy nhất. Cũng là tên file ảnh. |
| `lines` | string[] | ✅ | **TIẾNG VIỆT có dấu.** Mỗi phần tử = một dòng phụ đề = một file wav. |
| `image` | string | ✅ | **TIẾNG ANH.** Chỉ tả *cảnh này*, không tả phong cách (preset lo) và không tả lại ngoại hình nhân vật (`cast` lo). |
| `cast` | string[] | ❌ | id nhân vật có mặt. Sai id là lỗi. |

### Luật viết `lines`

- Mỗi phần tử **dưới 85 ký tự**. Trên 110 là lỗi — tràn khỏi 2 dòng phụ đề.
- Một câu trọn vẹn mỗi phần tử. Đừng cắt giữa mệnh đề, vì mỗi phần tử được đọc
  thành một file riêng và có khoảng nghỉ sau nó.
- Câu thoại nhân vật để trong ngoặc kép — TTS đọc có ngữ điệu khác.
- Một cảnh nên có **1–3 dòng**, tổng 2,5–6 giây. Xem bảng nhịp bên dưới.

### Luật viết `image`

- Tiếng Anh. Validator **chặn** nếu thấy dấu tiếng Việt.
- Bắt đầu bằng chủ thể đang làm gì, rồi tới bối cảnh, rồi tới ánh sáng/không khí.
- Đừng viết `"stick figure style, minimalist…"` — preset đã có sẵn, lặp lại chỉ
  làm loãng prompt.
- Đừng đòi model viết chữ trong ảnh. Nó viết sai chính tả tiếng Việt, và
  `negative` của preset đã cấm chữ. Cần chú thích thì dùng biểu tượng: bong bóng
  thoại có hình, mũi tên, dấu hỏi.

## Nhịp

Đo từ VieNeu-TTS: **18,5 ký tự mỗi giây**, sai số dưới 5%.

| | Video mẫu | Khuyến nghị |
|---|---|---|
| Mỗi ảnh | 2,3s | 2,5 – 6s |
| Mỗi dòng phụ đề | | 1,5 – 5s |

`validate-story.mjs` in ra thời lượng ước tính, thời lượng từng cảnh, và số phút
sinh ảnh — đọc nó trước khi đưa user duyệt.

## Sinh ra từ file này

| File | Ai ghi |
|---|---|
| `story.md` | `build-docs.mjs` |
| `audio/l###.wav`, `audio/voice.wav`, `timing.json` | `tts.mjs` |
| `images/s##.png` | `images.mjs` |
| `props.json` | `build-props.mjs` |
| `out/<dir>.mp4` | `render.mjs` |
