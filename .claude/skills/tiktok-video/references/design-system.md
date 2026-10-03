# Design system

Mọi giá trị nằm trong `remotion/src/tokens.ts`. Sửa ở đó, đừng rải hằng số vào component.

---

## Font

```ts
loadFont('normal', { weights: ['600', '800'], subsets: ['vietnamese', 'latin'] });
```

**`subsets` bắt buộc có `'vietnamese'`.** Thiếu nó thì ắ ầ ễ ộ ữ ỹ sẽ vỡ hoặc rơi về font hệ thống.

Font: **Be Vietnam Pro** — thiết kế riêng cho tiếng Việt nên dấu cân đối ở mọi weight.
Inter/Poppins/Montserrat thiếu dấu ở một số weight, đừng đổi sang chúng nếu chưa test.

Kiểm tra nhanh: composition có màn hình "Chưa có props" in sẵn chuỗi `ắ ầ ẫ ễ ộ ữ ỹ ặ ọ Đ đ`.
Mở Studio khi chưa có props.json là thấy ngay.

---

## Màu

| Token | Mã | Dùng ở |
|---|---|---|
| `white` | `#FFFFFF` | chữ chính |
| `yellow` | `#FFE14D` | highlight từ khoá, thanh tiến trình |
| `green` | `#4ADE80` | CTA |
| `ink` | `#0B0B0F` | nền |

---

## Chữ phải đọc được trên nền quay thật

Ba lớp, cả ba đều cần:

1. **Viền đen** — `stroke(fontSize)`, dày `fontSize × 0.09`.
2. **`paint-order: stroke fill`** — bắt vẽ viền trước rồi ruột chữ đè lên. Thiếu nó,
   `-webkit-text-stroke` vẽ đè lên chính nét chữ và dấu tiếng Việt (ế ộ ữ ỹ) bít thành cục đen.
3. **Bóng đổ** `textShadowAt(alpha)` — tách chữ khỏi nền. `alpha` giảm về 0 khi chữ nằm
   trên khối nền sáng, nếu không quầng đen trên nền vàng trông bẩn.

Tỉ lệ viền `0.09` là ngưỡng thử ra: dày hơn thì ở weight 800 dấu dính vào thân chữ.

**Nền màu trơn không chứng minh được gì** về việc chữ có đọc được không. Test bằng:

```bash
node .claude/skills/tiktok-video/scripts/make-test-footage.mjs <slug> --busy
```

`--busy` dùng hoa văn `testsrc2` sặc sỡ, tương phản cao, động — nền tệ nhất có thể.

---

## Bố cục dọc 1080×1920

```
   0 ─────────────────────  thanh tiến trình (8px)
 150 ─────────────────────  SAFE.top   ← UI TikTok che phía trên
 ~420 ══════════════════   chữ to tiêu đề khối (22–24% chiều cao)
      
      ░░░ vùng mặt người nói — GIỮ TRỐNG ░░░
      
1420 ══════════════════   phụ đề động (~74% chiều cao)
1700 ─────────────────────  SAFE.bottom ← caption + nút của TikTok
1920 ─────────────────────
```

Hai luật:
- **Không đặt chữ vào giữa khung** — đó là chỗ mặt người nói.
- Chừa 150px trên và 220px dưới. TikTok phủ UI lên đó.

---

## Preset chữ to tiêu đề

`TITLE_STYLE` trong `tokens.ts`, chọn theo `scene.caption.style` của `script.json`.
**Mỗi vai một kiểu chuyển động riêng, không dùng lại** — khán giả không nhớ màu, họ nhớ
chuyển động; bốn khối vào giống nhau thì đến scene thứ ba là đoán được.

| style | Scene | Cỡ | Màu | `motion` | Vào / ra |
|---|---|---|---|---|---|
| `hook` | hook | 92 | trắng, hl vàng | `slideX` | trượt từ trái vào → trượt tiếp sang phải |
| `normal` | story | 68 | trắng, hl vàng | `riseY` | trồi từ dưới lên → trồi tiếp lên trên |
| `punch` | punchline | 96 | **vàng**, hl trắng | `assemble` | từng chữ đập vào → cả khối phóng ra |
| `cta` | cta | 74 | xanh lá, hl trắng | `liftUp` | nâng lên + phóng → rơi xuống |

Đảo màu ở `punch` (vàng làm nền chữ chính thay vì highlight) là có chủ đích — khối đúc kết
phải trông khác hẳn các khối còn lại.

`assemble` là kiểu duy nhất bật `perWord`:

- chữ thường nảy lên từ `scale 0.7`, cụm highlight **đập từ `scale 1.5` xuống** — hai cảm giác khác nhau
- chèn `BEAT = 9` frame khựng ngay **trước** cụm highlight, đúng chỗ lấy hơi của câu chốt
- chữ cuối đáp xong thì cả khối rung một cái rồi tắt
- tổng độ trễ bị nén nếu ăn quá 45% thời lượng tiêu đề (tiêu đề chỉ sống ~2.6s)

`cta` đẩy `caption.emoji` xuống mũi tên nhún bên dưới thay vì in inline — nếu không màn hình
có hai cái 👇.

---

## Preset phụ đề động

`CAPTION_STYLE` trong `tokens.ts`, cũng theo `scene.caption.style` (build-props ghi nó vào
mỗi caption page). Cỡ chữ leo thang theo vai để có nhịp cảm xúc, thay vì một cỡ cứng suốt 38 giây:

| style | Cỡ | Màu khối nền |
|---|---|---|
| `normal` | 58 | vàng |
| `cta` | 64 | **xanh lá** |
| `hook` | 66 | vàng |
| `punch` | 76 | vàng |

`punch` to nhất vì đó là câu quote. `normal` nhỏ nhất để nhường chỗ cho mặt người nói.

Từ đang được nói có **khối nền bo tròn chạy ra sau lưng** — đây là thứ khiến người ta nhìn
phát biết ngay là video TikTok, và nó giải quyết luôn chuyện đọc được trên nền bận.

Ba trạng thái của một từ:

| | opacity | màu chữ | khối nền |
|---|---|---|---|
| chưa nói tới | 0.72 | trắng (hoặc màu highlight) | không |
| đang nói | 1 | `ink` | có, đầy |
| đã nói | 1 | trắng (hoặc màu highlight) | không |

**Đừng hạ 0.72 xuống thấp hơn.** `opacity` kéo cả viền đen mờ theo; mất viền thì trên footage
thật chữ chìm luôn. Bản đầu để 0.45 và chỉ lộ ra khi test với `--busy`.

Mọi chuyển tiếp đều có easing. Bản đầu dùng `active ? scale(1.12) : scale(1)` — không
interpolate, không spring — và trên màn hình nó không đọc ra là "nảy", nó đọc ra là **giật**.

Page vào bằng trồi + phóng nhẹ nhưng **cố ý không fade**: các page nối đuôi nhau sát rịt,
fade sẽ để lộ vài frame chữ nửa mờ ở chỗ giao nhau.

---

## Hai lớp chữ

Đừng nhầm hai thứ này:

| | Chữ to tiêu đề (`TitleCard`) | Phụ đề động (`Subtitles`) |
|---|---|---|
| Nguồn | `scene.caption.text` trong script.json | `timing.json` (whisper + align) |
| Là gì | Tiêu đề của cả khối | Lời nói, từng cụm 2–3 từ |
| Vị trí | 22–24% chiều cao | ~74% chiều cao |
| Thời gian | 2.6s đầu mỗi scene | suốt scene, chạy theo nhịp nói |
| Vì sao | Người xem tắt tiếng vẫn hiểu | Giữ chân, người xem đọc theo |

---

## Punch-in zoom

`build-props.mjs` gán `zoom` so le `1.0` / `1.06` cho các đoạn liền nhau.
Đây là mẹo làm jump-cut trông như đổi góc máy dù quay một chỗ — và là lý do
`shoot.md` bảo user quay 4K để dư pixel mà crop.

Thấy giật quá thì hạ `ZOOM` xuống `1.03`. Thấy nhạt quá thì lên `1.10`.

---

## Sửa component

Trước khi sửa file trong `remotion/src/`, đọc `/remotion-markup` (animation, layout, typography)
hoặc `/remotion-captions` (phụ đề). Skill này cố tình không chép lại kiến thức Remotion.

| File | Việc |
|---|---|
| `tokens.ts` | màu, font, preset, safe area |
| `components/SceneClip.tsx` | footage + zoom |
| `components/TitleCard.tsx` | chữ to tiêu đề khối |
| `components/Subtitles.tsx` | phụ đề động |
| `components/ProgressBar.tsx` | thanh tiến trình |
| `TikTokVideo.tsx` | thứ tự lớp, audio |
| `highlight.ts` | tách cụm từ khoá để tô màu |
