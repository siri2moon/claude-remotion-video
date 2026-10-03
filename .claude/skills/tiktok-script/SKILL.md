---
name: tiktok-script
description: Tạo kịch bản video ngắn TikTok 9:16 phong cách selfie tâm sự (talking head / raw content) từ một câu châm ngôn, ca dao, tục ngữ, quan điểm sống hoặc gợi ý chủ đề. Xuất ra content/<date>-<time>-<slug>/script.json (hợp đồng dữ liệu cho khâu dựng video Remotion) và script.md (bảng kịch bản để quay). Dùng khi user nói "viết kịch bản", "làm video về câu này", "tạo script TikTok", hoặc dán một câu quote/châm ngôn và muốn dựng video ngắn.
---

# TikTok Selfie Storytelling Script Generator

Chuyển một câu châm ngôn / ca dao / tục ngữ / quan điểm sống thành kịch bản video ngắn TikTok
**9:16, 30–45 giây, phong cách selfie tâm sự** (talking head, raw content).

**Role:** Short-form Video Strategist — dân IT/kỹ thuật trải đời, nói chuyện đời thường, hóm hỉnh, cà khịa nhẹ.
**Audience:** Người xem TikTok thích sự chân thực — dân IT, dân văn phòng, giới trẻ quan tâm tư duy sống.

Mỗi lần chạy sinh ra 3 file trong `content/<date>-<time>-<slug>/`, vd
`content/2026-08-18-09-23-nhan-chi-so-tinh-ban-thien/`:

| File | Cho ai đọc | Ai ghi |
|---|---|---|
| `script.json` | Máy — skill dựng video (Remotion) consume file này | **Bạn viết** |
| `script.md` | Người — bảng kịch bản để đọc | sinh tự động |
| `shoot.md` | Người — hướng dẫn quay: setup, thứ tự, cue card từng scene | sinh tự động |

`script.json` là **nguồn chân lý duy nhất**. Hai file `.md` được sinh ra từ nó bằng
`scripts/build-docs.mjs` — không bao giờ gõ tay, không bao giờ sửa tay.

---

## Quy trình

### Bước 1 — Chốt input

Rút từ prompt của user:

| Field | Bắt buộc | Mặc định nếu user không nói |
|---|---|---|
| `quote` — châm ngôn / quan điểm cốt lõi | ✅ | — |
| `context` — bối cảnh quay | ❌ | `"Góc làm việc, bàn máy tính"` |
| `durationSec` | ❌ | `38` |
| `angle` — góc nhìn người kể | ❌ | `"dân IT / văn phòng"` |

Xử lý input mơ hồ:

- User đưa **chủ đề** thay vì câu quote (vd "làm video về deadline") → tự chế 1 câu quote
  ngắn, có nhịp, kiểu nhại ca dao/châm ngôn, rồi **nói rõ trong phần trả lời** là bạn đã tự đặt câu này.
- User đưa **nhiều câu** → chọn câu sắc nhất, làm 1 kịch bản. Không gộp.
- User đưa câu quá dài (> 25 từ) → cắt gọn thành phiên bản đọc được trong 4 giây, giữ nguyên ý.

Đừng hỏi vặt. Chỉ hỏi lại khi câu quote mâu thuẫn với bối cảnh user yêu cầu tới mức không viết nổi.

### Bước 2 — Đọc framework

**Bắt buộc** đọc `references/framework.md` trước khi viết chữ đầu tiên. File đó chứa thư viện hook,
ngân sách thời gian, kỹ thuật bẻ lái châm ngôn, ngân hàng tình huống IT và danh sách anti-pattern.

### Bước 3 — Brainstorm nội bộ (KHÔNG in ra chat)

Trước khi viết bản chính thức, tự nghĩ:

1. **3 hook khác nhau** theo 3 pattern khác nhau → chọn cái sắc nhất, bỏ 2 cái kia.
2. **1 tình huống đời thực CỤ THỂ** — phải có con số/giờ giấc/tên công cụ và ít nhất 1 câu thoại
   trực tiếp của người khác. Một tình huống đào sâu, không phải ba tình huống hời hợt.
3. **1 cú bẻ lái châm ngôn** — góc nhìn mới, không giải nghĩa câu quote như bài văn nghị luận.

### Bước 4 — Viết kịch bản 4 khối

Hook → Story → Punchline & Quote → CTA. Ngân sách thời gian và luật từng khối: xem `references/framework.md`.

Kiểm tra khi viết:
- Voiceover mỗi khối: **4.0–6.5 từ/giây**. Hook 3 giây = tối đa ~20 từ. Đừng nhồi.
- Caption trên màn hình **không phải transcript** — nó là tiêu đề của khối đó, ≤ 60 ký tự.
- Nguyên văn câu quote phải được đọc đủ **1 lần** trong khối Punchline.
- `visual` **không** mở đầu bằng nhãn khối `(Hook)`, `(CTA)`... — generator tự thêm.

### Bước 4b — Viết `cueWords` cho từng scene

Đây là **mồi nhớ dán cạnh ống kính** khi user tự quay. Không phải tóm tắt, không phải phụ đề.

- 3–5 cụm mỗi scene, mỗi cụm 2–5 từ, liếc mắt một cái là nhớ ra cả câu.
- Lấy từ **chính lời thoại**, theo đúng thứ tự nói. Ưu tiên: cái tên riêng, con số, câu thoại trực tiếp.
- Nối bằng dấu `→` khi hiển thị nên mỗi cụm là một chặng: mở → cao trào → chốt.
- ✅ `["code không chịu test", "máy em bình thường mà", "giống Facebook, 2 triệu"]`
- ❌ `["kể chuyện về việc test code", "đưa ra ví dụ thứ hai"]` — mô tả việc phải làm, không phải mồi nhớ.

### Bước 5 — Tạo thư mục

Nghĩ ra phần slug: bỏ dấu tiếng Việt, kebab-case, tối đa 6 từ, lấy từ câu quote. VD
`"Nhân chi sơ, tính bản thiện. Không cà khịa, rất ngứa mồm."` → `nhan-chi-so-tinh-ban-thien`.

Rồi chạy:

```bash
node .claude/skills/tiktok-script/scripts/new-dir.mjs <slug>
```

Script in ra **tên thư mục đầy đủ** kèm ngày giờ, vd `2026-08-18-09-23-nhan-chi-so-tinh-ban-thien`,
và tạo luôn thư mục đó.

**Bắt buộc chạy script, không được tự gõ ngày giờ** — bạn chỉ biết ngày, không biết giờ trên máy.
Cũng không cần lo trùng: script tự thêm `-v2` nếu trong cùng một phút đã có thư mục cùng tên.

### Bước 6 — Ghi `script.json`

- `id` = **đúng tên thư mục** mà bước 5 in ra, cả tiền tố ngày giờ. Validator chặn nếu lệch.
- Đặc tả field: `references/output-format.md`. Ví dụ hoàn chỉnh: `assets/example/script.json`.

**Chỉ ghi `script.json`.** Không tự viết `script.md` hay `shoot.md` — bước 7 sinh ra chúng.

### Bước 7 — Validate rồi sinh docs (BẮT BUỘC, không được bỏ)

`<dir>` là tên thư mục bước 5 in ra.

```bash
node .claude/skills/tiktok-script/scripts/validate-script.mjs content/<dir>/script.json && \
node .claude/skills/tiktok-script/scripts/build-docs.mjs   content/<dir>/script.json
```

- Có `ERROR` → sửa `script.json` rồi chạy lại cho tới khi sạch. Không báo xong khi còn ERROR.
- Có `WARN` → cân nhắc sửa. Nếu cố tình giữ (vd hook dài 4s cho có nhịp), nói rõ lý do với user.
- Validate fail thì `build-docs` không chạy (do `&&`) — đúng ý đồ, docs không bao giờ sinh từ script hỏng.

### Bước 8 — Trả lời user

In ra chat:
1. Bảng kịch bản dạng markdown (cột: Thời gian | Visual | Voiceover | Caption).
2. Đường dẫn 3 file đã ghi, nói rõ `shoot.md` là file cần mở khi cầm máy quay.
3. Kết quả validate (1 dòng).
4. Nếu có tự chế câu quote hoặc cắt gọn câu của user → nói rõ.

**Không** dán nội dung JSON vào chat.

---

## Luật cứng

- Viết bằng **tiếng Việt đời thường**. Xưng "tôi"/"mình", gọi khán giả là "anh em"/"mọi người".
- Cấm giọng giảng đạo: không "hãy...", "chúng ta cần phải...", "bạn có biết rằng...".
- Hài kiểu **tự trào**. Không xúc phạm nghề nghiệp, vùng miền, giới tính, ngoại hình.
- Không bịa số liệu, nghiên cứu, trích dẫn người thật. Chuyện đời thường thì được kể như trải nghiệm cá nhân.
- **Không copy ví dụ trong `assets/example/`** — đó là mẫu format, không phải kho nội dung. Nghĩ mới hoàn toàn.

## Cấu trúc skill

```
.claude/skills/tiktok-script/
├── SKILL.md                      ← file này
├── references/
│   ├── framework.md              ← hook library, ngân sách thời gian, kỹ thuật viết
│   └── output-format.md          ← đặc tả script.json + template script.md
├── scripts/
│   ├── new-dir.mjs               ← sinh content/<date>-<time>-<slug>/ (hỏi giờ hệ thống)
│   ├── validate-script.mjs       ← validator không phụ thuộc package nào
│   └── build-docs.mjs            ← script.json → script.md + shoot.md
└── assets/example/
    ├── script.json               ← ví dụ hoàn chỉnh
    ├── script.md                 ← (sinh tự động)
    └── shoot.md                  ← (sinh tự động)
```
