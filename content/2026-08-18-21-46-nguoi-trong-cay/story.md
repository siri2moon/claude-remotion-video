# NGƯỜI TRỒNG CÂY / KHÔNG NGỒI DƯỚI BÓNG

> Sinh tự động từ `story.json`. **Đừng sửa file này** — sửa `story.json` rồi chạy lại `build-docs.mjs`.

| | |
|---|---|
| Thư mục | `content/2026-08-18-21-46-nguoi-trong-cay/` |
| Chủ đề | Gieo mầm cho đời sau — cho đi mà không chờ nhận lại |
| Giọng đọc | Thanh Bình |
| Phong cách tranh | doodle |
| Số cảnh | 11 |
| Dài ước tính | 0:47 |

## Tiêu đề trên màn hình

Đứng yên suốt video, hai dòng:

1. **NGƯỜI TRỒNG CÂY** — vàng chanh, viền đen
2. **KHÔNG NGỒI DƯỚI BÓNG** — đỏ, viền trắng

## Dàn nhân vật

| id | Ngoại hình (nhét vào mọi cảnh có mặt) |
|---|---|
| `lao` | An old white stick-figure man with a smooth bald oval head, a short white beard, two tiny black dot eyes and a calm patient expression, wearing a simple brown vest over a white shirt and loose grey trousers rolled up to the knee, thin black stick arms and legs. |
| `trai` | A young white stick-figure man with a plain oval head, short tidy black hair, two tiny black dot eyes and a faint confident smirk, wearing a light blue short-sleeved shirt and dark trousers, thin black stick arms and legs. |
| `giagia` | The same man now old: a white stick-figure man with a bald oval head, a short grey beard, slightly stooped shoulders, wearing a faded blue shirt and dark trousers, leaning on a simple wooden walking cane. |
| `be` | A small white stick-figure child with a round head, two short black pigtails, two tiny black dot eyes and a curious open smile, wearing a plain yellow shirt and short trousers. |

## Kịch bản

| # | Vào lúc | Dài | Lời bình | Cảnh vẽ |
|---|---|---|---|---|
| `s01` | 0:00 | 3.5s | Có một ông lão đào hố bên vệ đường đất, dưới cái nắng tháng sáu. | He is digging a small hole with a worn shovel beside a dusty dirt road under a harsh summer sun, dry yellow fields stretching to the horizon, heat haze in the distance.<br>_(lao)_ |
| `s02` | 0:04 | 4.6s | Ông trồng cây con, một hàng dài ven đường.<br>Cây nào cũng cách nhau đúng mười bước chân. | He is planting a row of thin young saplings evenly spaced along the edge of the long dirt road, each one a fragile stick with a few leaves, the row disappearing into the distance.<br>_(lao)_ |
| `s03` | 0:09 | 3.1s | Một chàng trai đi ngang qua, dừng lại nhìn, rồi bật cười. | A young man walking along the road has stopped and is laughing openly, pointing at the old man kneeling in the dirt beside a tiny sapling.<br>_(lao, trai)_ |
| `s04` | 0:12 | 5.2s | "Cụ ơi, cụ bảy mươi rồi. Cây này ba chục năm nữa mới có bóng mát."<br>"Cụ có ngồi dưới nó được đâu." | Close view of the young man talking down at the kneeling old man, a speech bubble above him showing a small sapling with a red cross beside a stick figure sitting in shade.<br>_(lao, trai)_ |
| `s05` | 0:18 | 3.8s | Ông lão không đáp.<br>Ông cúi xuống, lấp đất quanh gốc cây, rồi tưới nước. | The old man, saying nothing, is gently patting soil around the base of a sapling and pouring water from a battered tin watering can, his face calm and unbothered.<br>_(lao)_ |
| `s06` | 0:22 | 2.8s | Chàng trai lắc đầu bỏ đi. Anh nghĩ ông lão lẩm cẩm. | The young man walks away down the road with his back to the viewer, shaking his head, while the small kneeling figure of the old man grows distant behind him.<br>_(lao, trai)_ |
| `s07` | 0:25 | 3.0s | Bốn mươi năm sau.<br>Con đường đất ngày ấy giờ rợp bóng cây. | The same road forty years later, now a wide green tunnel of tall leafy trees arching overhead, dappled sunlight falling on the path, cool and shaded, no people in sight. |
| `s08` | 0:28 | 5.8s | Chàng trai năm xưa, giờ cũng đã thành một ông lão, đi qua con đường đó.<br>Ông ngồi xuống nghỉ dưới một tán cây. | An old man with a walking cane is sitting down to rest on a smooth stone under the shade of one of the big trees, wiping his forehead, looking up at the leaves above him.<br>_(giagia)_ |
| `s09` | 0:35 | 3.4s | Một đứa bé chạy tới hỏi: "Ông ơi, ai trồng những cây này vậy?" | A small child has run up to the seated old man and is looking up at him, pointing at the tall trees, with a question mark in a small speech bubble above the child's head.<br>_(giagia, be)_ |
| `s10` | 0:38 | 5.1s | Ông định trả lời, rồi chợt khựng lại.<br>Suốt bốn mươi năm, ông chưa từng hỏi tên người trồng cây. | Close view of the seated old man with his mouth half open, frozen mid-answer, a faded grey memory bubble above him showing the young kneeling figure he once laughed at.<br>_(giagia)_ |
| `s11` | 0:44 | 2.6s | Ông lặng lẽ đứng dậy.<br>Rồi ông đi tìm một cái xẻng. | The old man has stood up and is walking away from the shaded road toward an empty sunlit stretch of ground, carrying a shovel over his shoulder, his cane left leaning against the tree behind him.<br>_(giagia)_ |

## Chạy tiếp

```bash
S=.claude/skills/ai-story/scripts
node $S/tts.mjs          2026-08-18-21-46-nguoi-trong-cay
node $S/images.mjs       2026-08-18-21-46-nguoi-trong-cay
node $S/build-props.mjs  2026-08-18-21-46-nguoi-trong-cay
node $S/render.mjs       2026-08-18-21-46-nguoi-trong-cay
```
