# Đặc tả `kichban.json`

```
content/2026-10-03-21-40-chien-luoc-tan-gai-vi-mo/
├── kichban.json   ← BẠN VIẾT, nguồn chân lý duy nhất
├── kichban.html   ← sinh bởi build-pdf.mjs
└── kichban.pdf    ← sinh bởi build-pdf.mjs, chỉ sau khi user chốt
```

Không sửa tay `kichban.html` / `kichban.pdf`. Muốn đổi nội dung thì sửa JSON rồi chạy lại.
`scripts/validate.mjs` là nguồn chân lý cho schema. Mẫu đầy đủ: `assets/example/kichban.json`.

## Top-level

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `version` | number | ✅ | Luôn `1` |
| `id` | string | ✅ | Trùng đúng tên thư mục do `new-dir.mjs` in ra |
| `input` | string | ✅ | Nguyên văn input của user |
| `inputType` | enum | ✅ | `quote` · `pickup-line` · `saying` · `topic` · `story` |
| `title` | string | ✅ | Thumbnail — tiêu đề lớn, ≤ 28 ký tự (WARN), trần 40 |
| `subtitle` | string | ✅ | Thumbnail — dải cuộn giấy, ≤ 50 ký tự (WARN) |
| `shockLine` | string | ✅ | Thumbnail — dòng chữ gây sốc, ≤ 40 ký tự (WARN) |
| `concept` | string | ✅ | 1 dòng, vd `"Độc thoại nửa đêm / Deadpan dark comedy"` |
| `persona` | string | ✅ | Vai chuyên gia người diễn nhập, vd `"giảng viên kinh tế vĩ mô"` |
| `setting` | string | ✅ | Bối cảnh quay |
| `props` | string[] | ✅ | Đạo cụ cần chuẩn bị, ≥ 1 |
| `rhythm` | string | ❌ | Ghi chú nhịp tổng thể, in dưới tiêu đề PDF |
| `durationSec` | number | ✅ | 45–120. **Phải bằng `end` của cảnh cuối** |
| `scenes` | Scene[] | ✅ | 5–8 cảnh |
| `tips` | string[] | ✅ | Mẹo quay & diễn deadpan, 3–6 ý |
| `caption` | string | ✅ | Caption đăng bài, ≤ 220 ký tự (WARN) |
| `hashtags` | string[] | ✅ | 5–8 tag, mỗi tag `#` + chữ thường không dấu/số |

## Scene

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `part` | enum | ✅ | `hook` · `lead` · `twist` · `explain` · `outro` |
| `label` | string | ✅ | Tên cảnh ngắn, vd `"Cú lật mặt lạnh tanh"` |
| `start` | number | ✅ | Giây. Cảnh đầu = 0, cảnh sau = `end` cảnh trước |
| `end` | number | ✅ | > `start` |
| `camera` | string | ✅ | Khung hình / góc máy |
| `action` | string | ✅ | Hành động diễn xuất cụ thể |
| `audio` | string | ✅ | Nhạc nền + SFX |
| `voice` | string | ❌ | Chỉ dẫn giọng, in cạnh nhãn THOẠI, vd `"hạ giọng, thì thầm"` |
| `line` | string | ✅ | Thoại. Xuống dòng bằng `\n`. `…` = chỗ ngừng |
| `onScreen` | string | ✅ | Text hiển thị trên màn hình. Xuống dòng bằng `\n` |
| `note` | string | ❌ | Gợi ý diễn riêng cho cảnh này, in nghiêng dưới thoại |

## Ràng buộc thứ tự `part`

- Cảnh đầu `hook`, cảnh cuối `outro`.
- `part` đi theo thứ tự hook → lead → twist → explain → outro, không quay lui.
- Mỗi part có 1–2 cảnh, đủ cả 5 part.
