# short.json

Nguồn chân lý của một video, ở `content/<dir>/short.json`. `build-props.mjs` đổi nó thành
`props.json` cho composition `BrandShort`. Ví dụ đầy đủ:
- bài blog: `assets/example/post.json` (cảnh terminal, trang blog trong khung)
- dự án: `assets/example/project.json` (Lucifer: camera 3D, quay HUD, gõ phím)

Chữ song ngữ: mọi trường chữ nhận một chuỗi, hoặc `{ "vi": …, "en": … }`. Thiếu `en` thì
bản tiếng Anh dùng tiếng Việt.

## Gốc

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | ✅ | đúng tên thư mục `new-dir.mjs` in ra |
| `kind` | ✅ | `project` \| `post` |
| `theme` | ✅ | `lucifer` \| `siri2moon` |
| `project` / `source.url` | | dự án nào / bài nào (ghi lại để làm lại sau) |
| `chip` | | `{ title, subtitle }` nhãn phía trên suốt video. `title` viết HOA |
| `series` | | Video thuộc series nhiều tập: `{ name, ep, of, next }`. Chip đổi thành `SIRI2MOON · <name> [TẬP ep/of]` (bản en: `EP`), màn kết thêm nút `▶ <next>` ("Tập 2: …"). `name`, `next` song ngữ |
| `music` | | Nhạc tổng hợp: `{ progression: 0–3, volume: 0.9 }` (0 sang · 1 tech · 2 tươi · 3 đêm, mặc định theo id). Luôn mở bằng build-up dưới hook, drop ở cú cắt đầu tiên. Bài thật: `{ file: "_assets/music/x.mp3", start?: giây, bpm?: số, volume?: 1 }` |
| `narration` | | Giọng đọc ElevenLabs, **mặc định tắt**: chỉ thêm khi user yêu cầu hoặc loại video cần lời dẫn (xem "Giọng đọc" bên dưới). `{ voice?: { vi, en }, model?: "eleven_v3", volume?: 1, duck?: 0.45, speed?: 1, stability?: 0.5, style?: 0.3 }` |
| `scenes` | ✅ | danh sách cảnh, theo thứ tự xem |
| `outro` | | màn logo |
| `endcard` | | màn kết Siri |
| `capture` | khi có cảnh quay | xem `capture.md` |

## Cảnh

| Trường | Mặc định | Ý nghĩa |
|---|---|---|
| `id` | ✅ | tên cảnh |
| `beats` | 6 | độ dài theo phách chuẩn 0,6 s. Dùng bài nhạc khác BPM thì tự quy ra số phách chẵn gần nhất của bài, độ dài gần như giữ nguyên |
| `lines` | ✅ | 1–2 dòng phụ đề, `*cụm nhấn*` |
| `big` | false | phụ đề to hơn: chỉ cho cảnh hook |
| `shot` | = `id` | tên shot trong `capture.shots` |
| `src` | | thay cho shot: ảnh/video có sẵn. Không có `/` → trong thư mục video (`cover.jpg`); có `/` → tính từ `content/` (`<dir>/footage/hello.mp4`). Video thành phẩm của skill khác (bằng chứng "kết quả") đặt vào `footage/` của video này |
| `skip` | 0 | giây bỏ ở đầu footage |
| `rate` | 1 | tốc độ phát (0,9 = chậm lại để kéo dài) |
| `layout` | `full` | `full` phủ kín khung · `card` cửa sổ bo góc 1000×820, nền là footage nhoè · `phone` video dọc 9:16 trong khung điện thoại giữa màn hình (chừa hai bên cho `callouts`) |
| `keys` | | lia/zoom trên footage: `[{ f, cx, cy, zoom }]`. `f` frame trong cảnh (hoặc `beat`), `cx, cy` px CSS của trang lúc quay, `zoom` = px khung trên mỗi px CSS |
| `terminal` | | cảnh terminal dựng bằng code (không cần shot), xem dưới |
| `motion` | | cảnh đồ hoạ giải thích bằng hình (không cần shot), xem dưới. **Ưu tiên hơn terminal** khi ý có thể vẽ ra |
| `voice` | | tiếng thật của cảnh: `{ src: "<đường dẫn trong content/>", skip?: giây, volume?: 1 }`. Nhạc nền tự hạ còn 25% trong cảnh đó |
| `say` | | câu giọng đọc ElevenLabs của cảnh, song ngữ. Chỉ có tác dụng khi bật `narration`. Cảnh tự dài ra cho vừa câu dài nhất giữa vi và en |
| `callouts` | | layout `phone`: nhãn chỉ vào video, `[{ at: giây, y: px của video gốc, side: "left"\|"right", text }]` |

`card` + `keys` cho footage HUD ngang (1280×800 CSS): toàn cảnh `zoom 0.78`, đọc được chữ ở
`zoom ≥ 2`. Trang blog dọc 540 CSS: `{ cx: 270, cy: 420…520, zoom: 1.85 }` cho chữ cỡ 26 px.

## Cảnh terminal

(Chú thích `//` chỉ để giải thích, JSON thật không có.)

```json
"terminal": {
  "title": "ssh ec2-user@nebula-dev",
  "fontSize": 27,          // 23 cho ~60 ký tự ngang, 27 ~50, 30 ~40
  "cps": 18,               // ký tự gõ mỗi giây
  "start": 0.3,            // giây trước dòng đầu
  "prompt": "{green}$ {/}", // prompt mặc định cho cmd
  "items": [
    { "out": "dòng 1\ndòng 2", "after": 0.2 },      // in ra, mỗi dòng cách 1 frame
    { "cmd": "bash init.sh", "prompt": "[ec2-user@ip ~]$ ", "enter": 0.3 },  // gõ từng chữ
    { "wait": 0.5 },
    { "cmd": "", "prompt": "…" }                      // chỉ hiện prompt, con trỏ nhấp nháy
  ]
}
```

Màu: `{red} {green} {yellow} {blue} {magenta} {cyan} {white} {dim} {gray} {orange} {bold}` … `{/}`.
Cửa sổ cao vừa nội dung (≤ 840), tự cuộn khi đầy. `build-props` báo WARN nếu chạy quá dài so với cảnh,
và rải tiếng gõ phím theo từng ký tự.

## Cảnh đồ hoạ (`motion`)

Video "dễ hiểu" là video **cho thấy** chứ không chỉ kể: dùng dữ liệu thật của pipeline để vẽ.

| `type` | Hình | Trường |
|---|---|---|
| `split` | Hai điện thoại TRƯỚC / SAU trượt vào, mũi tên giữa. Hook trước/sau rất mạnh | `before`, `after` (video trong content/, song ngữ được: `{ vi: …/footage/x.mp4, en: …/footage-en/x.mp4 }`), `labels` song ngữ. Thêm `voice` = file after để nghe tiếng |
| `wave` | Sóng âm thật, đầu đọc quét, khoảng lặng đỏ lên rồi **khép lại**, đồng hồ giây đếm xuống, nhãn "−1,4s" | `audio`, `from`, `to` (giây), `cuts: "<cuts.json>#<scene>"` (hoặc `keep`), `cutAt` 0–1 phần cảnh, `label`, `silenceLabel`, `cutLabel` |
| `words` | Chữ to sáng lên đúng lúc nói, dưới mỗi chữ là mốc giây | `timing: "<timing.json>#<scene>"`, `from` (giây), `tag`. Luôn kèm `voice` cùng đoạn |
| `prompt` | Gõ câu mô tả (prompt) trong khung code, mũi tên ↓, tranh "hiện hình" (nhoè → nét, vạch quét) | `label`, `text` (song ngữ), `image`, `cps` (70) |
| `gallery` | 2–12 tranh bật lên lần lượt thành lưới 3 cột, cuối cảnh hiện nhãn tổng kết | `images`, `badge` ("11 tranh · 57 phút · 0đ") |
| `speak` | Câu thoại to, sóng âm sáng dần theo giọng đang phát, cuối hiện ⏱ độ dài đo được | `audio`, `text`, `label`, `tag`. Luôn kèm `voice` cùng file |
| `pages` | Các trang tài liệu bay lên chồng nhau rồi xoè quạt, trang đầu ở trước, cuối hiện nhãn | `pages` (1–8 ảnh, render PDF bằng `pdftoppm -r 110 -png`), `badge` |
| `acts` | Thanh các hồi của kịch bản hài + làn nhạc (khúc im lặng đỏ, phẳng), đầu đọc quét qua, thẻ dưới nói hồi đang chạy | `kichban` (`<dir>/kichban.json`, đọc thẳng `part`/`music`/`start`/`end`), `acts.<part>` = `{icon, name, job}`, `music.<tên>` = nhãn |
| `calc` | Phép tính nghiêm túc: từng dòng hiện ra, số đếm lên, cuối đóng dấu đỏ | `rows` (1–3 `{label, value}`, value viết như hiển thị: `"43.200 phút"` / `"43,200 min"`), `stamp`, `label` |
| `statusline` | Cửa sổ Claude Code với dòng trạng thái **thật**: build-props chạy `script` (copy nguyên văn từ bài) với JSON `input`, tách màu ANSI theo nhóm `│`. `quota`: số quota to đổi màu đúng màu script in ra qua từng mức. `explain`: từng nhóm sáng lên kèm dòng giải thích | `mode` (`quota` \| `explain`), `script`, `input` (JSON Claude Code gửi vào stdin), `quota` (mảng % còn lại của 5h), `rows` (explain: đúng số nhóm script in ra), `label`, `resetIn` (giây, 8070) |
| `pipeline` | Các bước dọc, lần lượt bật sáng rồi thành ✓, thanh tiến độ chạy | `steps: [{ icon, title, sub }]` 2–7 bước, rải đều trong cảnh |

Panel nằm trong vùng y 300–1060, phụ đề vẫn ở dưới như mọi cảnh.

## Outro

| Trường | Ý nghĩa |
|---|---|
| `beats` | 11 |
| `shot` / `src` | footage nền (có thể bỏ: nền trời đêm) |
| `rate`, `skip` | như cảnh |
| `dim` | độ tối phủ lên nền, 0,62 cho cảnh 3D, 0,85 cho trang chữ |
| `title` | chữ lớn: tên dự án hoặc `SIRI2MOON` |
| `subtitle` | 1 câu định vị, có thể `*nhấn*` |
| `chips` | 3–4 chip |
| `link` | `github.com/…` (icon GitHub) hoặc `siri2moon.com` (icon link) |

## Endcard

`{ "beats": 5, "follow": "Theo dõi @siri2moondev", "lines": ["…", "…"] }`. `@siri2moondev` tự tô xanh Siri.

## Giọng đọc (ElevenLabs)

Mặc định **tắt**. Bật khi user yêu cầu, hoặc khi loại video cần người dẫn chuyện (giải thích nhiều bước, kể chuyện).
Video khoe giao diện hoặc chạy theo nhạc trend thì để tắt.

```json
"narration": { "voice": { "vi": "<voice id>", "en": "<voice id>" } },
"scenes": [
  { "id": "hook", "say": { "vi": "Đang code ngon thì Claude báo hết quota.", "en": "You're mid-task and Claude hits the limit." }, … }
]
```

- **Key và giọng:** khoá API nằm ở `ELEVENLABS_API_KEY` trong `.env` ở gốc dự án (chép từ `.env.example`). Giọng lấy từ `narration.voice`, nếu không có thì lấy `ELEVENLABS_VOICE_VI` / `ELEVENLABS_VOICE_EN` trong `.env`.
- **Cách sinh:** `render.mjs` tự chạy `narrate.mjs` trước khi build, lưu ra `content/<dir>/voice/<lang>-<cảnh>.mp3`. File được cache theo nội dung câu, nên render lại không tốn credit. Chỉ khi sửa câu, đổi giọng hoặc đổi model thì mới đọc lại.
- **Cách viết câu:** viết cho tai nghe, không chép y phụ đề. Phụ đề là chữ nhấn ngắn, câu đọc là lời nói tự nhiên, khoảng 2,5 chữ mỗi giây với tiếng Việt và 2,8 từ mỗi giây với tiếng Anh.
  - Cảnh hook đọc không quá 3,5 s.
  - Với `eleven_v3` có thể chèn tag cảm xúc như `[excited]`, `[whispers]`.
- **Độ dài cảnh:** câu dài hơn cảnh thì cảnh tự dài ra (`beats` tăng), nên `validate.mjs` có thể báo cảnh dài. Khi đó rút gọn câu đọc chứ đừng để cảnh lê thê.
- **Âm lượng:** nhạc nền chỉ hạ **trong lúc đang đọc** (mặc định còn 45%, đổi bằng `narration.duck`), giữa các câu nhạc trồi lại đầy đủ. Tiếng thật (`voice`) thì hạ còn 25% suốt cảnh. Cảnh có `voice` tiếng thật thì dùng tiếng thật, bỏ câu đọc.
- **Đăng TikTok:** bật nhãn "nội dung do AI tạo" khi video có giọng AI.
