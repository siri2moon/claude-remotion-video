# Kể chuyện trong 30–45 giây

Mục tiêu của mỗi video: người lướt qua **dừng lại trong 2 giây đầu**, hiểu **một điều đáng giá**,
và biết **đi đâu tiếp** (bài blog, GitHub, follow @siri2moondev).

## Khung

| Phần | Phách | Giây | Việc |
|---|---|---|---|
| Hook (`big: true`) | 6 | 3,6 | Một nỗi đau, một câu hỏi, hoặc kết quả gây sốc. Hình phải khớp chữ ngay frame đầu |
| Thân: 4–7 cảnh | 6–8 mỗi cảnh | 3,6–4,8 | Mỗi cảnh **một ý**. Kết quả trước, cách làm sau |
| Outro thương hiệu | 11 | 6,6 | Logo, tên, 1 câu định vị, 3–4 chip, link |
| Màn kết | 5 | 3 | Siri + "Theo dõi @siri2moondev" + 2 dòng |

Tổng 30–45 s (validator cảnh báo ngoài 20–60 s). Cảnh > 8 phách là ì.

## Hook: chọn một trong các kiểu

1. **Nỗi đau quen**: "3 tab SSH y hệt nhau… / tab nào là *PROD*? 😱"
2. **Khẳng định to**: "Tôi xây một công ty / *100%* nhân viên là *AI 😇*"
3. **Trước/sau**: cảnh xấu ở hook, cảnh đẹp ở cảnh 2–3.
4. **Con số**: "*1 script* thay *7 bước* cài đặt"
5. **Câu hỏi thách**: "Bạn còn gõ lại / lệnh này *mỗi ngày*?"

Không mở bằng lời chào, tên kênh hay "Hôm nay mình sẽ…". Nhãn thương hiệu phía trên đã nói ai làm.

## Luật phụ đề

- Tối đa **2 dòng** mỗi cảnh. Dòng 2 hiện sau dòng 1 một phách.
- Độ dài (validator đo): hook ≤ 23 ký tự/dòng; dòng 1 của cảnh 2 dòng ≤ 30; còn lại ≤ 27.
  Emoji tính 2.
- `*cụm nhấn*`: 1–2 cụm mỗi dòng, là **danh từ/động từ mang ý** ("*giao mục tiêu*", "*4 cái bẫy*"),
  không nhấn hư từ. Cụm nhấn không bao giờ bị bẻ dòng.
- Tối đa 1 emoji mỗi dòng, đặt cuối dòng.
- Văn nói tự nhiên, câu ngắn. Đọc to lên phải trôi.
- **Tiếng Anh viết lại cho người Anh đọc**, không dịch từng chữ, cùng luật độ dài.
- Không lặp lại đúng chữ đang hiện trên hình (UI, terminal). Phụ đề nói *ý nghĩa*, hình cho *bằng chứng*.

## Làm cho đặc sắc và dễ hiểu (bắt buộc từ Tập 3 series Xưởng video AI)

User chê video toàn terminal/trang chữ là "chưa thu hút, chưa đặc sắc". Mỗi video:

1. **Hook bằng bằng chứng nhìn thấy được**: trước/sau (`split`), kết quả thật đang chạy, con số gây sốc. Không mở bằng terminal.
2. **Mỗi ý kỹ thuật một hình ẩn dụ**: cắt khoảng lặng → sóng âm khép lại; nhận giọng → chữ sáng theo tiếng;
   pipeline → các bước bật sáng. Hỏi: "người không biết code nhìn hình này có hiểu không?"
3. **Có tiếng người thật** ít nhất một cảnh (`voice`): giọng nói giữ chân hơn nhạc.
4. **Terminal tối đa 1 cảnh**, chữ ≥ 27 px; trang blog chỉ ở outro hoặc 1 cảnh.
5. Dữ liệu trong hình phải **thật** (cuts.json, timing.json, output thật); thứ dựng minh hoạ thì nói rõ khi báo cáo.

## Bài blog → video

1. Đọc `text` trong page.json, tìm **cái aha**: thứ người đọc mang về được.
2. Có lệnh/output/banner → dựng cảnh **terminal** tái hiện nó (trước/sau, lệnh chạy, kết quả).
   Terminal tối đa ~60 ký tự ngang ở `fontSize` 23, ~50 ở 27, ~40 ở 30.
3. 1–2 cảnh **trang blog thật** (layout `card`, cuộn qua heading/khối code đáng giá) để chứng minh
   có bài viết đầy đủ.
4. Outro: `title: "SIRI2MOON"`, subtitle hướng về bài ("Full script + giải thích trên *siri2moon.com*"),
   chip là công nghệ trong bài, `link: "siri2moon.com"`, nền là shot đầu trang bài, `dim: 0.85`.
5. Chip trên: `{ "title": "SIRI2MOON", "subtitle": "<chủ đề: DevOps | AI | Terminal | Python…>" }`.

## Dự án → video

1. Hook bằng khẳng định to + cảnh đẹp nhất của app.
2. Cảnh thân đi theo **hành trình người dùng**: giao việc → hệ thống làm → thấy kết quả → điểm "wow" riêng.
3. Một cảnh vui/người thật (tiếp viên mang cà phê, break time…) giữ người xem tới cuối.
4. Outro: tên dự án, định vị, chip (công nghệ / model / "miễn phí"), link GitHub.

## Nhạc

- Nhạc tổng hợp (mặc định) là lót nền an toàn, không bản quyền, nhưng **không tạo trend**.
- Nhạc tổng hợp **mở bằng build-up dưới cảnh hook** (drone dập 1/16, cụm nốt nghịch rung, nhịp tim,
  riser, snare dồn 8 → 16 → 32), **nín thở 1/16 phách** rồi **drop đúng cú cắt sang cảnh 2** (crash + kick + bass +
  pad cùng vào). Hook càng dài, build-up càng dài: giữ hook 6–7 phách để có độ căng; dưới 2 phách thì không build-up.
  Vì nhạc dồn lên điểm drop, cảnh 2 nên là **lời giải / cảnh đẹp nhất** của video, không phải cảnh lặng.
- Tăng reach: giao kèm bản `--no-music`, user gắn âm thanh đang trend trong TikTok/Reels/Shorts
  (giữ âm gốc 30–50% cho SFX). Đây là cách duy nhất dùng nhạc trending hợp pháp.
- Bản có nhạc sẵn (YouTube, nơi gắn nhạc trong app hạn chế hơn): dùng file từ thư viện có giấy phép,
  ưu tiên dòng năng lượng cao 120–140 BPM (phonk, future bass, house). Bài nhanh thì cắt cảnh
  vẫn giữ độ dài, chỉ khớp phách chẵn.

## Màn kết

`follow`: "Theo dõi @siri2moondev". `lines`: 1 dòng lý do follow ("mẹo DevOps & AI mỗi ngày 🚀",
"để xem mình xây Lucifer từ đầu 🚀") + 1 dòng chỉ link ("Link bài viết ở bình luận ghim 📌").

## publish.md (mẫu)

Viết **bằng tiếng Anh** (tiêu đề mục, ghi chú, YouTube, Facebook). Chỉ caption TikTok giữ tiếng Việt vì
TikTok đăng bản tiếng Việt.

````markdown
# <Video title>: publishing

| Platform | Video | Language |
|---|---|---|
| YouTube Shorts | `out/<dir>/<dir>-en.mp4` | 🇬🇧 English |
| Facebook Reels | `out/<dir>/<dir>-en.mp4` | 🇬🇧 English |
| TikTok | `out/<dir>/<dir>.mp4` (for a trending sound: `…-khong-nhac.mp4`) | 🇻🇳 Vietnamese |

1080×1920, 30 fps, <x> s, <lufs> LUFS · ElevenLabs narration (only when used)
Music: <track> (⚠️ commercial track: possible Content ID claim; post the `-khong-nhac` cut to be safe)
Thumbnail: frame at <t> s, with big text **<2–3 WORDS>**
Playlist: "<English name>" on YouTube/Facebook · "<Vietnamese name>" on TikTok (series only)

## YouTube Shorts
**Title** (≤ 70 chars, keywords first): ```<hook> | <keywords> #shorts```
**Description:** 2–3 sentences, then the links:
```
📝 Full post: https://siri2moon.com/posts/<slug>?utm_source=youtube&utm_medium=shorts&utm_campaign=<english-campaign>
😇 Lucifer on GitHub: https://github.com/siri2moon/lucifer   (only when relevant)
#Siri2Moon #<topic> #<topic> #Coding
```
**Pinned comment:** post link (utm_source=youtube&utm_medium=comment) + one question inviting replies.

## Facebook Reels
**Caption:** hook, 2 sentences of value, post link (utm_source=facebook), 3–4 hashtags.

## TikTok
**Caption** (Vietnamese, ≤ 150 chars before the hashtags): hook + benefit + "link ở bio 👆" + 3–5 hashtags.
Notes: add to the playlist; for a trending sound use `-khong-nhac` with the original audio at 30–50%;
turn on the "AI-generated content" label when the video has an AI voice.
````

Hashtag 3–5 mỗi bài: 1 thương hiệu (`#Siri2Moon`), 1–2 chủ đề, 1–2 rộng. Bảng theo trụ nội dung:
`~/www/siri2moon/siri2moon-channel-kit/README.md` → Hashtags.
