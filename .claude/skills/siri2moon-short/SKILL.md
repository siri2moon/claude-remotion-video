---
name: siri2moon-short
description: Làm video ngắn dọc 9:16 (YouTube Shorts, TikTok, Facebook Reels) quảng bá thương hiệu Siri2Moon — giới thiệu một dự án trong ecosystem (Lucifer…) bằng footage quay thật từ app đang chạy, hoặc biến một bài viết trên siri2moon.com thành video có cảnh terminal động, trang blog lia mượt, phụ đề tiếng Việt từng chữ, nhạc tổng hợp không bản quyền, màn thương hiệu và màn kết Siri. Xuất out/<dir>.mp4 kèm dang-bai.md (tiêu đề, mô tả, hashtag từng nền tảng); làm được bản tiếng Anh. Dùng khi user nói "làm video cho bài <…>", "video short giới thiệu <dự án>", "video marketing siri2moon", "làm video hôm nay", hoặc dán link bài siri2moon.com.
---

# Siri2Moon Short

Một lệnh → `out/<dir>.mp4` 1080×1920 @ 30 fps, 30–45 s, mọi cú cắt rơi đúng phách nhạc.

| Đầu vào | Hình | Ví dụ |
|---|---|---|
| **Dự án** (`kind: "project"`) | Quay chính app đang chạy, camera theo kịch bản | `content/*-lucifer-gioi-thieu/` |
| **Bài blog** (`kind: "post"`) | Cảnh terminal dựng bằng code + trang bài lia trong khung | `content/*-ec2-login-dep/` |

Phong cách cố định để khán giả nhận ra kênh: phụ đề nhảy từng chữ có cụm nhấn màu, nhãn
thương hiệu phía trên, cắt whip-zoom, màn logo, màn kết Siri + `@siri2moondev`.
Giao diện: `lucifer` (Midnight & Champagne) cho Lucifer, `siri2moon` (trời đêm chàm) cho mọi thứ khác.

**Handle kênh trên YouTube, TikTok, Facebook là `@siri2moondev`**, mọi chỗ trong video và bài
đăng. Không bao giờ viết `@siri2moon`: tên đó thuộc tài khoản cá nhân của user. Domain
`siri2moon.com`, GitHub `github.com/siri2moon` và chữ thương hiệu `SIRI2MOON` thì giữ nguyên.
`validate.mjs` chặn nếu lọt `@siri2moon`.

Scripts: `S=.claude/skills/siri2moon-short/scripts` (chạy từ gốc repo).

---

## Quy trình

### 1. Chốt đầu vào

- Link hoặc slug bài → `kind: "post"`. "Bài mới nhất" → `node $S/page-info.mjs https://siri2moon.com/posts`
  rồi lấy bài đầu trong `posts`.
- Tên dự án → `kind: "project"`, tra `references/projects.md`. Dự án chưa có ở đó → đọc README
  của nó, chạy thử, rồi **thêm mục mới vào projects.md** trước khi làm.
- Chỉ nói "làm video hôm nay" → chọn bài blog mới nhất chưa có thư mục trong `content/`
  (`ls content | grep <slug>`), nói rõ đã chọn bài nào.

Đừng hỏi vặt. Hỏi chỉ khi không đoán được đầu vào.

### 2. Đọc trước khi viết

**Bắt buộc**: `references/storytelling.md` (cấu trúc, hook, luật phụ đề) và
`references/format.md` (đặc tả `short.json`). Dự án: thêm mục của nó trong `references/projects.md`.
Quay: `references/capture.md`.

### 3. Tạo thư mục

```bash
node $S/new-dir.mjs <slug-không-dấu>      # in ra tên thư mục đầy đủ, dùng làm id
```

### 4. Thu thập chất liệu

- **Bài blog**:
  ```bash
  node $S/page-info.mjs <url> --out=content/<dir>/page.json --shot=content/<dir>/page.jpg
  ```
  Đọc `text` để rút ý, xem `page.jpg` (1 px = 2 px trang) để chọn đoạn cuộn, lấy `top` của
  heading/khối code làm key `scroll`. Có lệnh, output, banner trong bài → dựng **cảnh terminal**
  (hình hút mắt hơn trang chữ nhiều). `figlet -f slant` có sẵn để tạo banner thật.
- **Dự án**: khởi động theo `projects.md` (chạy nền bằng `run_in_background`), nhớ tắt khi xong.

### Series nhiều phần (bài blog chia Part 1…n)

Mỗi part một video, cùng `series.name`, `ep`/`of`, `next` là tên tập sau (tập cuối: bỏ `next`).
Thư mục `<slug-series>-tap-<n>`. Mở mỗi tập bằng **kết quả thật** của part đó (render thật code
trong bài, hoặc video/PDF có sẵn trong `out/`, `content/`) rồi mới tới cách làm. `dang-bai.md`
nhắc thêm vào playlist/series cùng tên và ghim link tập trước.

### 5. Viết `short.json`

Brainstorm nội bộ (không in ra): 3 câu hook theo 3 kiểu → chọn câu sắc nhất; cái "aha" của
bài/dự án là gì; khán giả làm được gì sau khi xem. Rồi viết theo `format.md`:
phụ đề `lines.vi` **và** `lines.en`, cảnh, outro, endcard, phần `capture`.

```bash
node $S/validate.mjs <slug>
```

Còn ERROR thì sửa. WARN dòng dài → viết ngắn lại, đừng bỏ qua.

### 6. Quay (bỏ qua nếu chỉ có cảnh terminal / ảnh)

```bash
node $S/capture.mjs <slug> --preview     # 8 khung mỗi shot → content/<dir>/footage/preview/all.jpg
```

**Xem `all.jpg`** (Read). Góc máy sai, vật cản, trang nhảy → sửa key trong `short.json`, chạy lại
`--preview --only=<shot>`. Ổn rồi mới quay thật: `node $S/capture.mjs <slug>`.

### 7. Duyệt khung hình rồi dựng

```bash
node $S/render.mjs <slug> --stills      # một khung mỗi cảnh → out/<dir>-stills.jpg
```

**Xem stills (Read)** và tự soi: chữ tràn/xuống dòng xấu, chữ đè lên chi tiết quan trọng, cảnh
trống, terminal tràn ngang, nhãn che UI. Sửa đến khi sạch, rồi:

```bash
node $S/render.mjs <slug>               # out/<dir>.mp4, in ra thời lượng và LUFS
```

`render.mjs` tự chạy build-props và sinh nhạc (mỗi id một vòng hợp âm, cùng id thì cùng bài).

### 7b. Nhạc

Nhạc tổng hợp (mặc định) chỉ là lót nền, **không bao giờ "hot trend"**. Mỗi video giao thêm:

```bash
node $S/render.mjs <slug> --no-music    # out/<dir>-khong-nhac.mp4: để gắn nhạc trending trong app
```

User có file nhạc bản quyền (`content/_assets/music/`, xem README ở đó) → `"music": { "file": … }`
trong short.json: skill tự dò BPM + phách mạnh, mở màn bằng đoạn drop, cắt đúng phách bài đó,
chuẩn hoá -14 LUFS. Độ dài cảnh giữ nguyên (beats quy đổi sang phách chẵn của bài).
Nếu chưa có file nào, gợi ý user các nguồn trong README đó. **Không tự tải nhạc trên mạng về.**

### 8. Bài đăng

Ghi `content/<dir>/dang-bai.md` theo mẫu trong `references/storytelling.md` (YouTube: tiêu đề,
mô tả, bình luận ghim; TikTok; Facebook; khung ảnh bìa). Link bài blog gắn UTM theo nền tảng.

### 9. Báo cáo

Đường dẫn mp4 (bản có nhạc + bản `-khong-nhac`, với bài blog thêm `-en` + `-en-khong-nhac`), thời lượng, LUFS, bảng phụ đề (cảnh | câu), file stills, `dang-bai.md`, và
những gì chưa kiểm được (không nghe được âm thanh). Tắt mọi server đã bật.

### Ngôn ngữ theo nền tảng (video từ blog siri2moon.com)

Quy định từ 2026-10-27: **YouTube Shorts và Facebook Reels đăng bản tiếng Anh, TikTok đăng bản tiếng Việt.**
Vì vậy video `kind: "post"` luôn xuất đủ 4 bản:

```bash
node $S/render.mjs <slug>                          # TikTok
node $S/render.mjs <slug> --no-music               # TikTok, gắn nhạc trend
node $S/render.mjs <slug> --lang=en                # YouTube Shorts + Facebook Reels
node $S/render.mjs <slug> --lang=en --no-music     # Reels, gắn nhạc trend
node $S/capture.mjs <slug> --lang=en               # chỉ dự án có giao diện đổi ngôn ngữ → footage-en/
```

`dang-bai.md`: phần YouTube và Facebook viết **toàn bộ bằng tiếng Anh**: tiêu đề, mô tả, bình luận ghim, hashtag,
playlist "AI Video Studio", UTM `utm_campaign` tiếng Anh. Chỉ phần TikTok viết tiếng Việt.
`lines.en` phải viết như người bản xứ nói, không dịch từng chữ.

---

## Sửa nhanh

| Muốn | Làm |
|---|---|
| Đổi chữ một cảnh | sửa `lines` → `render.mjs` (không phải quay lại) |
| Cảnh dài/ngắn hơn | `beats` (1 phách = 0,6 s). Footage phải đủ: `skip + beats × 0,6 × rate ≤ seconds` |
| Quay lại một shot | `capture.mjs <slug> --only=<shot>` |
| Đổi nhạc tổng hợp | `music.progression` 0–3 trong short.json |
| Dùng bài nhạc thật | `music.file` (+ `start`, `bpm` nếu cần) · phân tích riêng: `node $S/beat.mjs <file> --seconds=40` |
| Xem timeline | `render.mjs <slug> --studio` |

Composition: `remotion/src/short/BrandShort.tsx` (+ `Terminal.tsx`). Thêm loại cảnh mới thì sửa
ở đó, `types.ts` và `build-props.mjs`, rồi ghi vào `format.md`.
