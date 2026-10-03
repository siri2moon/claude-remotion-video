# Design system — định dạng kể chuyện bằng tranh

Mọi con số dưới đây **đo trực tiếp** từ `docs/refer/muonkiepnhansinh.MP4` (576×1024)
rồi quy về khung dựng 1080×1920 (nhân 1,875). Không có con số nào bịa ra.

Code: `remotion/src/story/tokens.ts`.

## Bố cục dọc

| Vùng | % chiều cao | px (1920) | Nội dung |
|---|---|---|---|
| Nền | toàn khung | | `#495B66` xám xanh đặc |
| Tiêu đề | 14,7 → 29,2% | 283 → 561 | 2 dòng chữ hoa, **đứng yên suốt video** |
| Panel ảnh | 31,8 → 68,0% | 611 → 1307 | full-bleed ngang, cao 696px |
| Phụ đề | 69,7 → 76,9% | 1339 → 1476 | tối đa 2 dòng, nghiêng |
| Trống | 77 → 100% | | chừa chỗ cho nút UI của TikTok |

Vùng trống dưới cùng không phải lãng phí — TikTok, Reels và Shorts đều phủ nút
lên đó. Đẩy phụ đề xuống là bị che.

## Tiêu đề

Font **Anton** — grotesque hẹp, rất đậm. Chọn nó vì hai lý do: giống hệt kiểu chữ
video mẫu, và là một trong số rất ít font kiểu này **có subset `vietnamese`**.
BebasNeue và ArchivoBlack trông tương tự nhưng không có dấu tiếng Việt — dùng vào
là ra ô vuông.

| | Dòng 1 | Dòng 2 |
|---|---|---|
| Màu chữ | `#E8F500` vàng chanh | `#E01A1A` đỏ |
| Màu viền | `#000000` đen | `#FFFFFF` trắng |
| Bóng | không | `0 6px 16px rgba(0,0,0,.45)` |

**Cỡ chữ 120px, DÙNG CHUNG cho cả hai dòng.** Đây là chi tiết dễ làm sai nhất.
Đo chữ N trần (không dấu) của video mẫu: dòng 1 cao 99px, dòng 2 cao 96px — tức
cùng một cỡ. Dòng 1 trông rộng hơn chỉ vì nhiều chữ hơn, **không phải** vì mỗi
dòng tự co giãn cho đầy bề ngang. Cho từng dòng fit riêng sẽ ra hai cỡ chữ lệch
nhau, nhìn rất nghiệp dư.

Suy ngược ra cỡ chữ: Anton có cap-height 0,727em; cộng nửa bề viền mỗi bên
(0,088em) → chiều cao chữ N đo được ≈ 0,815 × cỡ chữ. Vậy 99 / 0,815 ≈ 121.

Dòng nào vượt quá 90% bề ngang khung thì **cả hai cùng co lại**, giữ bằng nhau.

### `line-height: 1.4`, không phải 1.3

Đo thô từ video mẫu ra 1,30 (đỉnh N dòng 1 tới đỉnh N dòng 2 là 156px với cỡ chữ
120). Nhưng render ra bằng Anton thì **dấu mũ của dòng dưới đâm vào chân dòng
trên** — thấy tận mắt ở tiêu đề "NGƯỜI TRỒNG CÂY / KHÔNG NGỒI DƯỚI BÓNG".

Nguyên nhân: dấu tiếng Việt xếp chồng (Ô Ồ Ứ Ữ) vươn cao hơn hẳn chữ latin, mà
Anton lại đặt mực lệch lên trong hộp dòng. 1,4 là ngưỡng hết chạm.

Kéo theo: hộp chữ đặt ở `top: 14,5%` chứ không phải 14,7% — vì mực bắt đầu thấp
hơn mép hộp khoảng 0,24 × cỡ chữ, đặt 14,5% thì khối mực rơi đúng tâm vùng tiêu
đề của video mẫu.

### `paint-order: stroke fill` — bắt buộc

Thiếu nó thì viền vẽ đè lên chính glyph, và các dấu chồng của tiếng Việt (ế ộ ữ ỹ)
vón thành cục đen. Đây là lỗi đã gặp và đã sửa ở bản selfie, đừng gặp lại.

## Panel ảnh

- Full-bleed ngang: rộng đúng 1080, không lề.
- Cao 696px → **tỉ lệ 1,552**. Sinh ảnh ở 1216×784 (cùng tỉ lệ, dư độ phân giải
  cho Ken Burns phóng vào mà không vỡ).
- `objectFit: cover`.

### Chuyển ảnh

Cross-dissolve 12 frame (0,4s). Cách chồng lớp: **ảnh sau vẽ đè lên ảnh trước và
tự mờ dần hiện ra, ảnh trước để nguyên độ đục bên dưới.** Cho cả hai cùng fade là
lỗi kinh điển — giữa hai ảnh sẽ lộ một khoảnh khắc thấy nền xám xuyên qua.

Kiểm chứng: chạy scene-detect ngưỡng 0,25 trên video mẫu ra **0 lần**. Chuyển cảnh
mượt tới mức phải hạ xuống 0,02 mới bắt được. Thành phẩm của skill này cũng đạt 0.

### Ken Burns

Cảnh chẵn phóng vào (1,02 → 1,11), cảnh lẻ lùi ra (1,11 → 1,02), tâm phóng đảo
qua lại giữa 4 vị trí. Cùng một kiểu chuyển động lặp suốt 3 phút thì người xem
nhận ra ngay là máy làm.

**Không bao giờ để zoom = 1,0.** Hụt một pixel do làm tròn là lộ nền sau ảnh.

## Phụ đề

Font **Nunito italic 600**, cỡ 56px, trắng, `text-wrap: balance`.

Khác căn bản so với bản selfie: **phụ đề ở đây theo CỤM, không theo từng từ.**
Không có highlight, không có khối nền vàng, không có hiệu ứng nảy chữ. Video mẫu
làm vậy vì nội dung là kể chuyện — chữ nhảy múa sẽ tranh mất sự chú ý khỏi tranh.

Nền phía sau phụ đề là màu phẳng nên không cần viền dày như bản selfie, chỉ cần
bóng `0 3px 12px rgba(0,0,0,.55)` là tách đủ.

Mỗi dòng phụ đề = **đúng một câu đã đưa qua TTS thành một file wav riêng**. Xem
`pipeline` trong SKILL.md — đây là thứ làm phụ đề khớp giọng chính xác mà không
cần whisper.

## Âm thanh

Video mẫu **không có một khoảng lặng nào ở ngưỡng −24dB suốt 206 giây** → nhạc nền
chạy liên tục dưới giọng đọc. Nhạc để rất nhỏ (`volume: 0.1`): nghe thấy nhưng
không tranh chỗ với lời kể.

Giọng đọc chuẩn hoá về `-16 LUFS` (loudnorm), hợp chuẩn phát của nền tảng dọc.
