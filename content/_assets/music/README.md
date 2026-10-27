# Nhạc thật cho short (skill siri2moon-short)

Bỏ file nhạc (`.mp3`, `.m4a`, `.wav`) vào đây rồi ghi trong `short.json`:

```json
"music": { "file": "_assets/music/<tên-file>.mp3" }
```

Skill tự dò BPM và phách mạnh, chọn đoạn sôi động nhất (drop) làm điểm mở màn, cắt cảnh đúng phách
của bài, chuẩn hoá về -14 LUFS. Muốn tự chọn đoạn: `"start": <giây>`. Dò sai tempo (hiếm): `"bpm": <số>`.

File nhạc **không đưa lên git** (.gitignore): nhạc có bản quyền theo giấy phép của từng nơi.

## Lấy nhạc ở đâu (đúng bản quyền)

| Nguồn | Giá | Ghi chú |
|---|---|---|
| Epidemic Sound, Artlist, Soundstripe | trả phí theo tháng | Có sẵn dòng nhạc "kiểu trend" (phonk, hyperpop, lofi house, future bass); giấy phép phủ YouTube, TikTok, Facebook. Đáng tiền nhất nếu ra video mỗi ngày |
| Uppbeat | miễn phí (có giới hạn) / trả phí | Bản miễn phí cần ghi credit + mã license trong mô tả |
| YouTube Audio Library (studio.youtube.com → Audio library) | miễn phí | Một số bài bắt ghi tên tác giả; đọc giấy phép từng bài |
| Pixabay Music | miễn phí | Không cần ghi tên; thỉnh thoảng vẫn bị Content ID nhận nhầm |

**Không** tải nhạc trending từ TikTok/YouTube về ghép vào: video sẽ bị tắt tiếng, chặn hoặc nhận gậy bản quyền.

## Nhạc trending thật: gắn trong app

Thuật toán đẩy video dùng âm thanh đang trend, và chỉ app mới có quyền dùng chúng:

1. `render.mjs <slug> --no-music` → `out/<dir>-khong-nhac.mp4` (chỉ còn hiệu ứng tiếng).
2. Đăng bằng app: TikTok / Reels / Shorts → *Thêm âm thanh* → chọn bài đang trend.
3. Giữ âm gốc khoảng 30–50% để còn tiếng gõ phím, whoosh.

Lưu ý: tài khoản **Business** TikTok chỉ dùng được Commercial Music Library; trang Facebook doanh
nghiệp cũng bị giới hạn kho nhạc. Tài khoản cá nhân/creator thì dùng được nhạc trending.
