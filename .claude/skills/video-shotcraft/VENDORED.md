# video-shotcraft (bản chép vào dự án)

Nguồn: https://github.com/Vincentwei1021/video-shotcraft, commit `43bd349` (2026-10-17), giấy phép Apache-2.0 (`LICENSE`).
Tác giả: Wei Yihao (@VincentWei93). Tài liệu gốc viết bằng tiếng Trung.

## Đã chép

- `SKILL.md`: đã sửa phần mô tả ở đầu file, phần còn lại giữ nguyên.
- `references/`: bộ quy tắc thẩm mỹ (`aesthetic-rules.md`), âm thanh (`sound-design.md`), canh nhịp nhạc (`music-beat-sync.md`), kiểm tra trước khi giao (`final-review.md`) và 124 thẻ kỹ thuật dựng cảnh (`shots/`).
- `demos/`: code TSX mẫu của từng thẻ. Đã bỏ `_legacy`.
- `assets/lib/`: các component dùng chung (PageCam, DigitRoll, FlashCut, Caption…).
- `assets/audio/sfx`: 149 hiệu ứng âm thanh Mixkit, kèm `ATTRIBUTION.md`.

## Không chép

`gallery/`, `workbench/`, `template/`, `jianying-export/`, `publish/`, `shot-polish/`, `videos/` và `assets/audio/bgm`. Nhạc nền trong bản gốc không truy được nguồn, nên không dùng cho video thương mại.

Vì các phần này đã bị bỏ, những đoạn trong `SKILL.md` nói tới workbench, Ink Press template, xuất sang CapCut/剪映 hay đăng bài qua Upload-Post đều không áp dụng.

## Cách dùng trong dự án

Video Siri2Moon vẫn làm bằng skill `siri2moon-short`. Skill này chỉ là thư viện tham khảo:
- quy tắc thẩm mỹ để tự kiểm tra video;
- thẻ dựng cảnh, đọc khi cần thêm kiểu cảnh động mới;
- hiệu ứng âm thanh.

Demo gốc dựng cho khung 16:9 (1920×1080), nên phải đổi bố cục khi đưa vào video dọc 9:16.

Chỉ dùng hiệu ứng âm thanh có URL Mixkit trong `assets/audio/ATTRIBUTION.md`. Các file ghi "无法反查" (không truy được nguồn) hoặc "来源待考" (chưa rõ nguồn) thì không dùng.
