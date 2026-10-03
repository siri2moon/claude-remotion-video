# Lỗi hay gặp

## Setup

**`thiếu ffmpeg`**
```bash
brew install ffmpeg
```
Cần cả `ffmpeg` lẫn `ffprobe` (cùng một gói).

**`chưa cài package` / `không nạp được @remotion/install-whisper-cpp`**
```bash
cd remotion && pnpm install
```
Dùng `pnpm`, không dùng `npm`. Nếu lỡ chạy `npm install` rồi:
```bash
cd remotion && rm -rf node_modules package-lock.json && pnpm install
```

---

## Stage 1 — preflight

**`file KHÔNG CÓ TIẾNG`**
Mic chưa kết nối lúc quay. Không cứu được ở khâu dựng — phải quay lại scene đó.
Lần sau quay thử 5 giây rồi nghe lại trước khi quay thật (`shoot.md` có dặn).

**`thiếu footage cho scene: s3`**
Đặt tên file đúng `content/<dir>/raw/s3.mov`. Nhận `.mov .MOV .mp4 .MP4 .m4v`.
Take dư để ở `raw/takes/` thì pipeline bỏ qua.

**`quay NGANG`**
Điện thoại để ngang. Quay lại dọc — crop từ ngang sang 9:16 mất gần hết khung hình.

---

## Stage 3 — transcribe

**Tải model lâu / máy yếu**
Model `medium` ~1.5GB, tải một lần vào `<root>/.whisper/`, sau đó dùng lại cho mọi video.
Đang gấp thì dựng nháp trước:
```bash
node .claude/skills/tiktok-video/scripts/transcribe.mjs <slug> --fallback
```

**`model "medium.en" chỉ hỗ trợ tiếng Anh`**
Bỏ đuôi `.en`. Tiếng Việt cần `medium` hoặc `large-v3-turbo`.
Model `tiny`/`base`/`small` sai quá nhiều, đừng phí thời gian.

**Chữ trên video sai chính tả**
Không nên xảy ra — chữ luôn lấy từ `voiceover` trong `script.json`, không lấy từ whisper.
Nếu vẫn sai thì `script.json` viết sai. Sửa bằng skill `tiktok-script`, đừng sửa tay
(còn `script.md`/`shoot.md` sinh từ nó).

**`khớp 45%` — matchRatio thấp**
User nói lệch kịch bản nhiều. Video vẫn dựng được, chữ vẫn đúng, chỉ là nhịp phụ đề
có chỗ trôi. Muốn khớp hơn thì bám kịch bản sát hơn khi quay, hoặc sửa `voiceover`
trong `script.json` cho khớp lời đã nói rồi chạy lại stage 3.

**`rơi về fallback-low-match`**
Kiểm tra: đúng file audio chưa, có nói tiếng Việt không, phòng có ồn không.
Nghe thử `content/<dir>/audio/sN.wav`.

---

## Stage 4 — detect-cuts

**Cắt mất > 50% clip**
Mic quá nhỏ nên ffmpeg tưởng đang lặng:
```bash
node .claude/skills/tiktok-video/scripts/detect-cuts.mjs <slug> --silence-db=-40
```

**Nghe cụt đầu/cuối câu**
Tăng đệm hai đầu:
```bash
node .claude/skills/tiktok-video/scripts/detect-cuts.mjs <slug> --pad=0.15
```

**Cắt vụn, video giật**
```bash
node .claude/skills/tiktok-video/scripts/detect-cuts.mjs <slug> --min-silence=0.5
```

**Chỉ sai đúng một chỗ**
Sửa tay `content/<dir>/cuts.json` rồi chạy lại từ stage 5. Không cần transcribe lại.

**Không muốn cắt gì cả**
`--no-cut`.

---

## Stage 5 — build-props

**`dữ liệu không khớp cho scene sX`**
Các file trung gian sinh ra từ các lần chạy khác nhau. Xoá hết rồi làm lại:
```bash
rm -rf content/<dir>/{media,timing,cuts,props}.json content/<dir>/audio
```

**`chưa có nhạc nền` / `chưa có SFX`**
Không phải lỗi, video vẫn render. Muốn có thì bỏ file vào:
```
content/_assets/bgm/<tên trong script.json → audio.bgm>.mp3
content/_assets/sfx/<tên trong scene.sfx[]>.mp3
```

---

## Stage 6 — render

**Chữ vỡ dấu, mất dấu, hiện ô vuông**
`subsets` của `loadFont` thiếu `'vietnamese'`. Xem `references/design-system.md`.

**Render chậm**
Bundle phải copy cả `content/` (chứa footage) vào bundle. Video 38s thì vài giây,
chấp nhận được. Nếu `content/` phình to vì nhiều video cũ, chuyển bớt sang thư mục khác.

**Không thấy hình, chỉ có nền đen**
`props.json` có `clips` rỗng. Kiểm tra `cuts.json` — có thể đã cắt sạch vì mic quá nhỏ.

**Muốn xem trước từng frame**
```bash
node .claude/skills/tiktok-video/scripts/render.mjs <slug> --studio
```

---

## Kiểm tra pipeline không cần quay

```bash
node .claude/skills/tiktok-video/scripts/make-test-footage.mjs <slug>    # GHI ĐÈ raw/
node .claude/skills/tiktok-video/scripts/align.mjs --test                # 17 assertion
```

`make-test-footage.mjs` sinh clip màu trơn có tiếng sine — đủ để verify pipeline chạy thông,
**không dùng cho video thật** và **ghi đè** thư mục `raw/`.
