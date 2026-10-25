---
name: votri-script
description: Viết kịch bản video ngắn 9:16 hài vô tri, mặt lạnh (deadpan) — ngồi trước camera chiêm nghiệm nhân sinh cực nghiêm túc về một câu nói tầm phào — từ một câu nói, cụm từ, danh ngôn, câu thính hoặc tóm tắt câu chuyện. Viết kịch bản 5 phần (Hook → Dẫn dắt → Twist → Giải thích nghiêm túc mà vô tri → Outro) kèm title, subtitle, dòng chữ gây sốc cho thumbnail và caption + hashtag để đăng. Cho user duyệt trong chat, user chốt xong mới xuất PDF để cầm đọc và diễn. Dùng khi user nói "kịch bản vô tri", "kịch bản deadpan", "kịch bản thính", "làm video chiêm nghiệm câu này", "viết kịch bản để tôi quay", hoặc dán một câu nói/danh ngôn/câu thính/câu chuyện và muốn quay video hài.
---

# Kịch bản hài vô tri (deadpan)

Biến một câu nói tầm phào thành một bài giảng nhân sinh **cực kỳ nghiêm túc**. Người diễn ngồi
một mình trước camera, uống nước hoặc ăn vặt, nhìn thẳng ống kính, mặt không biến sắc, rồi giảng
chuyện vớ vẩn bằng giọng của chuyên gia kinh tế, giáo sư y khoa hoặc thẩm phán. Cái buồn cười
nằm ở chỗ **nội dung càng vô lý thì thái độ càng nghiêm trang**.

Mỗi kịch bản là một thư mục `content/<YYYY-MM-DD>-<HH>-<MM>-<slug>/`:

| File | Ai ghi | Khi nào |
|---|---|---|
| `kichban.json` | **Bạn viết** | Bước 4 — nguồn chân lý duy nhất |
| `kichban.html` | sinh tự động | Bước 7, trang trung gian để in |
| `kichban.pdf` | sinh tự động | Bước 7 — **chỉ sau khi user chốt** |
| `raw/s1.mov`… | user quay | Sau khi in PDF |
| `script.json` | sinh tự động | Khi chạy `/tiktok-video` — bản dịch của `kichban.json` cho pipeline dựng |

Quay xong → `/tiktok-video <slug>` dựng ra `out/<dir>.mp4`: jump-cut nhẹ tay, giữ khoảng lặng ở
cảnh twist, nhạc nền + SFX **tự tổng hợp bằng code** theo `music`/`sfx` của từng cảnh, snap zoom,
chữ màn hình và phụ đề.

---

## Quy trình

### Bước 1 — Nhận diện input

Input của user rơi vào một trong năm loại, mỗi loại có một hướng khai thác riêng (chi tiết ở
`references/craft.md` mục B):

| Loại | Ví dụ | Hướng mặc định |
|---|---|---|
| Danh ngôn, tục ngữ | "Nhân chi sơ, tính bản thiện" | Đọc nửa đầu trang trọng rồi bẻ vế sau |
| Câu thính | "Anh tặng em cây son, mỗi ngày trả anh một ít" | Giảng như một chiến lược kinh tế vĩ mô |
| Câu nói, quan điểm sống | "Ngứa mồm" | Biến nó thành một định luật khoa học |
| Cụm từ, chủ đề | "deadline", "2 giờ sáng" | Tự đặt một câu chốt rồi xử lý như danh ngôn |
| Tóm tắt câu chuyện | "Nửa đêm úp mì, tâm sự với con kiến…" | Độc thoại có nhân vật, có cú lật mặt |

Các field user có thể nói kèm, không nói thì dùng mặc định:

| Field | Mặc định |
|---|---|
| Thời lượng | 50–70 giây; chuyện nhiều chi tiết thì kéo tới 120 (trần 45–120) |
| Bối cảnh | Ngồi một mình ở bàn, có ly nước hoặc đồ ăn vặt |
| Phần tiếp theo của video cũ | Không. Nếu user nói "phần 2", hook phải gọi lại video trước |

Đừng hỏi vặt. Input mơ hồ thì tự chọn hướng hài nhất và nói rõ lựa chọn đó ở bước 5.

### Bước 2 — Đọc craft

**Bắt buộc** đọc `references/craft.md` trước khi viết chữ đầu tiên. Đó là phần "chất": cách giữ
mặt lạnh, kho giọng chuyên gia, kỹ thuật twist, công thức giải thích vô tri, outro, title,
caption và danh sách anti-pattern.

### Bước 3 — Brainstorm nội bộ (không in ra chat)

1. **3 concept** theo 3 "vai chuyên gia" khác nhau (vd giảng viên kinh tế / bác sĩ / thẩm phán)
   → chọn cái lệch pha nhất giữa giọng điệu và nội dung. Giữ 2 cái còn lại làm phương án dự phòng.
2. **Câu twist** — đúng một câu, ≤ 20 từ, đọc to lên phải buồn cười dù không có ngữ cảnh.
3. **Lập luận vô tri** — ít nhất 1 con số được tính toán nghiêm túc (vd "son hao mòn 6 tháng =
   hợp đồng 180 ngày") và ít nhất 3 thuật ngữ trang trọng dùng sai chỗ.
4. **Rủi ro cho outro** — kịch bản thất bại cụ thể, hình ảnh rõ, để kêu người xem quay lại comment.

### Bước 4 — Tạo thư mục và ghi `kichban.json`

Nghĩ slug: bỏ dấu, kebab-case, ≤ 6 từ, lấy từ title. Rồi chạy:

```bash
node .claude/skills/votri-script/scripts/new-dir.mjs <slug>
```

Script in ra tên thư mục đầy đủ có ngày giờ và tạo thư mục. **Bắt buộc chạy, không tự gõ giờ.**

Ghi `content/<dir>/kichban.json`, với `id` = đúng tên thư mục. Đặc tả: `references/format.md`.
Mỗi cảnh có `file` (`s1`, `s2`… — tên footage người diễn sẽ lưu). Mỗi cảnh **bắt buộc** có `music` và `sfx` — đó là lệnh cho máy tự sinh nhạc/SFX khi dựng, vì
user chỉ quay hình. Cảnh twist bật `keepPauses: true`, cảnh im lặng của twist thêm `zoom: "snap"`.
Cách chọn: `references/craft.md` mục E2.
Mẫu hoàn chỉnh: `assets/example/kichban.json` (chỉ là mẫu format, **không** dùng lại nội dung).

Rồi validate:

```bash
node .claude/skills/votri-script/scripts/validate.mjs content/<dir>/kichban.json
```

Có `ERROR` thì sửa tới khi sạch. Có `WARN` thì cân nhắc; giữ lại thì nói lý do ở bước 5.

### Bước 5 — Trình bày để user duyệt (DỪNG Ở ĐÂY)

In ra chat theo thứ tự:

1. **Thumbnail:** Title / Subtitle / Dòng chữ gây sốc, mỗi cái 1 dòng.
2. **Bảng kịch bản:** `| Thời gian | Phần | Khung hình & diễn xuất | Âm thanh | Thoại | Text màn hình |`.
   Thoại in nguyên văn, không tóm tắt — user cần đọc để quyết định.
3. **Caption + hashtag.**
4. **2 hướng khác** (mỗi hướng 1 dòng) lấy từ bước 3, để user đổi nếu muốn.
5. Câu hỏi chốt, kiểu: *"Chốt kịch bản này để xuất PDF, hay sửa chỗ nào?"*

**Không xuất PDF ở bước này.** Không dán JSON vào chat.

### Bước 6 — Sửa theo phản hồi

User góp ý → sửa `kichban.json` (giữ nguyên `file` của cảnh cũ, cảnh chèn mới lấy số kế tiếp —
xem `references/format.md` mục `file`) → validate lại → in lại **chỉ phần thay đổi** (hoặc cả bảng nếu
đổi nhiều) → hỏi chốt lại. Lặp tới khi user đồng ý ("ok", "chốt", "được", "xuất đi"...).

User chọn một trong 2 hướng khác → viết lại kịch bản trong **cùng thư mục**, quay lại bước 5.

### Bước 7 — Xuất PDF (chỉ sau khi user chốt)

```bash
node .claude/skills/votri-script/scripts/validate.mjs content/<dir>/kichban.json && \
node .claude/skills/votri-script/scripts/build-pdf.mjs content/<dir>/kichban.json
```

Script dựng `kichban.html` rồi in ra `kichban.pdf` bằng Chrome headless. Không tìm thấy Chrome thì
script báo lỗi kèm cách đặt `CHROME_PATH` — chuyển nguyên thông báo đó cho user.

Sau khi in xong, xem lại trang 1 của PDF (render ra PNG bằng `pdftoppm -r 60 -png -f 1 -l 1`
vào thư mục scratchpad rồi Read) để chắc chắn chữ tiếng Việt hiển thị đúng và không có ô trống.

### Bước 8 — Trả lời user

- Đường dẫn `kichban.pdf`.
- Nhắc cách quay để máy tự dựng: mỗi cảnh một file `s1.mov`… vào `content/<dir>/raw/`, quay xong
  gõ `/tiktok-video <slug>` (trang cuối PDF cũng ghi).
- Nhắc lại Title / Subtitle / Dòng chữ gây sốc, kèm một prompt thumbnail đã điền sẵn (prompt này
  cũng có ở trang cuối PDF).
- Caption + hashtag trong code block để copy.

---

## Luật cứng

- **Deadpan là luật số 1.** Người diễn không bao giờ cười, kể cả ở outro. Mọi chỉ dẫn diễn xuất
  phải giữ được mặt lạnh. Nếu một cảnh cần nhân vật "cười", đó là cười nhạt hoặc nhếch mép đúng
  một lần, được ghi rõ.
- Tiếng Việt đời thường, xưng "tôi", gọi người xem là "anh em" / "các bạn" / "các ông".
- Tự trào và cà khịa *tình huống*. Không xúc phạm ngoại hình, vùng miền, giới tính, nghề nghiệp.
- Ẩn ý tán tỉnh thì được, nói thẳng chuyện tình dục thì không. Giữ ở mức "người lớn hiểu, trẻ con
  không hiểu" như mẫu cây son.
- Không bịa trích dẫn người thật, không bịa nghiên cứu khoa học có tên tuổi. Số liệu vô tri là
  được, miễn là rõ ràng vô tri (tự tính từ chính câu chuyện).
- Không dạy hành vi nguy hiểm thật (bạo lực với người, chất cấm, lái xe khi say...).

## Cấu trúc skill

```
.claude/skills/votri-script/
├── SKILL.md
├── references/
│   ├── craft.md          ← chất hài: cấu trúc 5 phần, twist, giải thích vô tri, title, caption
│   └── format.md         ← đặc tả kichban.json
├── scripts/
│   ├── new-dir.mjs       ← tạo content/<date>-<time>-<slug>/
│   ├── validate.mjs      ← kiểm tra kichban.json, không phụ thuộc package nào
│   └── build-pdf.mjs     ← kichban.json → kichban.html → kichban.pdf (Chrome headless)
└── assets/example/
    └── kichban.json      ← mẫu format hoàn chỉnh
```
