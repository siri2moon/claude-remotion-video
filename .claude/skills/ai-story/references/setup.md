# Cài đặt, giọng, phong cách, sự cố

Toàn bộ chạy trên máy. **Không API key, không tốn tiền mỗi video.** Đổi lại là một
lần tải model nặng.

## Cài

```bash
node .claude/skills/ai-story/scripts/setup.mjs
node .claude/skills/ai-story/scripts/setup.mjs --check    # kiểm lại
```

Cần sẵn `ffmpeg` và `uv`:

```bash
brew install ffmpeg uv
```

`setup.mjs` tạo `.ai-story/venv/` (nằm ngoài git) và cài `mflux` như một uv tool.
Nếu lệnh `mflux-*` không tìm thấy, thêm vào `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Model tải lần đầu chạy thật

| Model | Nặng | Khi nào tải |
|---|---|---|
| VieNeu-TTS v3 Turbo | ~300MB | lần đầu chạy `tts.mjs` |
| torch (chỉ để nhân bản giọng) | ~1GB | lúc `setup.mjs` |
| Z-Image Turbo 4-bit | **5,5GB** | lần đầu chạy `images.mjs` |

**Dùng bản đã lượng tử sẵn, đừng dùng tên model dựng sẵn `z-image-turbo`.**
Bản gốc trên Hugging Face lưu trọng số fp32 — phải tải **33GB** rồi mới lượng tử
tại máy. Bản 4-bit do chính tác giả mflux đóng gói chỉ 5,5GB:

| Bản | Nặng | Dùng khi |
|---|---|---|
| `filipstrand/Z-Image-Turbo-mflux-4bit` | 5,5GB | mặc định, đủ cho tranh phẳng |
| `carsenk/z-image-turbo-mflux-8bit` | 11GB | muốn nét hơn |
| `z-image-turbo` (tên dựng sẵn) | 33GB | không nên |

Đổi bản trong `story.json` (`"model": "..."`) hoặc `images.mjs <slug> --model=...`.

Tải trước một lần cho xong, đứt thì chạy lại là nối tiếp:

```bash
mflux-generate-z-image-turbo --model filipstrand/Z-Image-Turbo-mflux-4bit \
  --prompt "a cat" --steps 8 --width 512 --height 512 --output /tmp/warmup.png
```

Đặt `HF_TOKEN` (token đọc miễn phí ở huggingface.co/settings/tokens) sẽ tải nhanh
hơn đáng kể — không có token thì Hugging Face bóp băng thông.

Cần mflux ≥ 0.13 để nạp được model lượng tử sẵn.

## Giọng đọc

14 giọng dựng sẵn của VieNeu-TTS:

| Giọng | Giới | Vùng | Phong cách |
|---|---|---|---|
| Thanh Bình | Nam | Bắc | **kể chuyện** ← mặc định |
| Ngọc Linh | Nữ | Bắc | **kể chuyện** |
| Thái Sơn | Nam | Nam | **kể chuyện** |
| Thục Đoan | Nữ | Nam | **kể chuyện** |
| Phạm Tuyên | Nam | Bắc | tự nhiên |
| Trúc Ly | Nữ | Bắc | tự nhiên |
| Đoan Trang | Nữ | Bắc | tự nhiên |
| Xuân Vĩnh | Nam | Nam | tự nhiên |
| Quang Sơn | Nam | Trung | tự nhiên |
| Ngọc Trân | Nữ | Trung | tự nhiên |
| Minh Đức | Nam | Bắc | tin tức |
| Mai Anh | Nữ | Bắc | tin tức |
| Minh Triết | Nam | Nam | tin tức |
| Thùy Dung | Nữ | Nam | tin tức |

Chủ đề triết lý thì chọn nhóm **kể chuyện**. Nhóm "tin tức" đọc quá dứt khoát,
nghe như bản tin thời sự, phá mất không khí.

### Nhân bản giọng

**Cần `torch`.** Giọng dựng sẵn chạy được trên đường ONNX không cần torch, nhưng
bộ mã hoá giọng tham chiếu là model torch — đã thử `denoise=False`, vẫn cần.
`setup.mjs` cài sẵn (nặng thêm ~1GB). Không cần thì `setup.mjs --no-clone`.

Cách gọn nhất — thu 5–10 giây giọng mình, phòng yên tĩnh, **không nhạc nền**:

```bash
node .claude/skills/ai-story/scripts/tts.mjs <slug> --ref=~/giong-toi.wav
```

Hoặc ghi cố định trong `story.json`:

```json
{ "voiceRef": "../_assets/voice/giong-toi.wav" }
```

(đường dẫn tính từ thư mục `content/<dir>/`)

### Rút mẫu giọng từ một video có sẵn

```bash
S=.claude/skills/ai-story/scripts
node $S/voice-sample.mjs <video> --scan                    # xem các đoạn sạch nhất
node $S/voice-sample.mjs <video> --out=giong-a.wav         # tự chọn đoạn tốt nhất
node $S/voice-sample.mjs <video> --at=137.5 --dur=8        # chỉ định đoạn
```

Script quét cả file, chấm điểm từng cửa sổ theo **năng lượng dải thoại
(300–3400Hz) trừ đi năng lượng dải trầm (dưới 200Hz)** — nhạc nền chủ yếu nằm ở
dải trầm nên hiệu số này xấp xỉ tỉ lệ giọng/nhạc. Đoạn nào điểm cao nhất thì lấy.

Rồi lọc: cắt dưới 95Hz (gỡ nhạc trầm, không đụng formant giọng), khử nhiễu phổ
nhẹ, chuẩn hoá biên độ. Đo trên video tham khảo: **bản lọc khớp cao độ giọng gốc
chính xác 106,7Hz, bản thô lệch 1,4–13,6Hz.** Nên mặc định là có lọc; `--raw` để tắt.

Cảnh báo khi tỉ lệ giọng/nhạc dưới 6dB. **Nguồn có nhạc nền luôn cho kết quả kém
hơn hẳn nguồn thu sạch** — model học cả nhạc vào timbre. Nếu giọng đó quan trọng
với bạn, tìm nguồn không nhạc còn hơn cố lọc.

## Phong cách tranh

Khai trong `story.json` field `style`. Định nghĩa ở `assets/styles.json`.

| Preset | Mô tả | Giữ nhân vật nhất quán |
|---|---|---|
| `doodle` | Người que, viền đen đậm, màu bệt. **Nền cũng vector phẳng cùng nét viền**, không phải nền vẽ tả thực. Giống video mẫu. | **Dễ nhất** |
| `tranh` | Tranh minh hoạ có chiều sâu, ánh sáng kỹ. | Khó |
| `muc` | Thuỷ mặc, nét mực loang trên giấy. | Dễ |

Thêm preset mới thì sửa `assets/styles.json`, không phải sửa code.

## Tốc độ thật (đo trên M3 Pro 18GB)

| Việc | Tốc độ |
|---|---|
| Nạp model TTS | ~6s mỗi lần chạy |
| Đọc | ~6,4× thời gian thực → lời bình 3 phút mất ~28s |
| Vẽ một ảnh | **~200s** (1216×784, 8 bước, bản 4-bit) |

Vẽ là chỗ tốn thời gian, không phải đọc. **Khoảng 3,5 phút một cảnh** — video
1 phút (≈10 cảnh) mất **hơn nửa tiếng**, video 3 phút (≈30 cảnh) mất **gần 2 tiếng**.

Chạy nền được, và `images.mjs` **chạy lại được** — ảnh nào có rồi thì bỏ qua,
nên đứt giữa chừng không mất gì.

### Hai nút đánh đổi nếu cần nhanh (đã đo, không phải đoán)

| Cách | Một ảnh | Được gì / mất gì |
|---|---|---|
| 1216×784, 8 bước | 186–209s | **mặc định** — nét sạch, chi tiết đủ |
| 1216×784, 4 bước | 106s | nhanh gấp đôi, nhưng bàn tay nhoè thành cục, tán cây phẳng, vật cầm tay hỏng |
| 960×620, 8 bước | 127s | nét vẫn sạch, nhưng phải phóng 1,25× lúc Ken Burns và chi tiết mặt hay trôi |

Đổi bước vẽ trong `assets/styles.json` (`steps`), đổi kích thước trong
`scripts/images.mjs` (`WIDTH`/`HEIGHT`).

## Sự cố hay gặp

**`mflux-generate-z-image-turbo: command not found`**
uv cài vào `~/.local/bin` mà thư mục đó chưa nằm trong PATH. Xem phần Cài ở trên.

**Tải model đứng im**
Hugging Face bóp băng thông với request không đăng nhập. Đặt `HF_TOKEN` rồi chạy lại —
phần đã tải được giữ nguyên, không phải tải lại từ đầu.

**Hết RAM khi vẽ**
Thêm `--low-ram` hoặc `--mlx-cache-limit-gb 8` vào lệnh mflux trong `images.mjs`.
Máy dưới 16GB nên hạ ảnh xuống 1024×660.

**Phụ đề hiện trước tiếng nói**
Không nên xảy ra nữa — `tts.mjs` cắt lặng đầu/cuối từng dòng bằng ngưỡng tương đối
theo đỉnh của chính file đó. Nếu vẫn gặp, chạy lại `tts.mjs <slug> --force` và
xem dòng `cắt bỏ ... lặng thừa` có hiện không.

**Ảnh vẽ ra sai nội dung**
Sửa `image` của cảnh đó trong `story.json` rồi `node images.mjs <slug> --only=s07`.
Xem prompt đầy đủ mà không vẽ: `node images.mjs <slug> --dry`.

**Nhân vật mỗi cảnh một kiểu**
`cast[].look` tả quá sơ sài. Model không nhớ cảnh trước — mỗi cảnh nó chỉ có đúng
đoạn chữ bạn đưa. Tả đủ: dáng người, đầu tóc, kính, màu áo, màu quần, phụ kiện.
Validator cảnh báo khi `look` ngắn dưới 40 ký tự.

## Kiểm nhanh không cần chờ vẽ

```bash
S=.claude/skills/ai-story/scripts
node $S/make-test-images.mjs <slug>   # ảnh giả, mỗi cảnh một màu, GHI ĐÈ images/
node $S/build-props.mjs      <slug>
node $S/render.mjs           <slug> --frame=120
```

Đủ để kiểm bố cục, nhịp phụ đề và độ dài trước khi bỏ ra hàng tiếng vẽ thật.
