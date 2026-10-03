# Plan — Skill 2: `tiktok-video` (dựng video từ footage tự quay)

> Trạng thái: **ĐÃ BUILD XONG**, verify end-to-end bằng footage giả (render ra mp4 thật).
> Chế độ: **Mode B — Hybrid**. User tự quay selfie, giọng thật. **Không dùng TTS.**
>
> Tài liệu đang dùng là `.claude/skills/tiktok-video/SKILL.md` + `references/`.
> File này giữ lại làm hồ sơ thiết kế và ghi những chỗ đã làm khác plan.

## Đã làm khác plan

| Plan nói | Thực tế | Vì sao |
|---|---|---|
| Dùng `createTikTokStyleCaptions` của `@remotion/captions` | Tự viết trong `build-props.mjs` | Cần ràng buộc **số từ tối đa mỗi cụm**, hàm kia chỉ gom theo ngưỡng thời gian. Tự viết cũng bỏ được một cross-package import |
| Component riêng `QuoteCard` + `CtaOverlay` | Gộp vào `TitleCard`, chọn theo `caption.style` | Bốn preset chỉ khác màu/cỡ/hiệu ứng — tách file chỉ làm loãng |
| — | Thêm `make-test-footage.mjs` | Verify pipeline không cần cầm máy. Đúng tinh thần M0 |
| `npm` / `npx` | `pnpm` / `pnpm exec` | User yêu cầu |
| B-roll chèn ở M4 | **Chưa làm.** Preflight báo có file nhưng v1 không chèn | Để lại v2 |
| Thư mục đặt tên bằng slug trần | `content/<YYYY-MM-DD>-<HH>-<MM>-<slug>/` | User yêu cầu. Hết cảnh trùng slug phải đặt `-v2`, và `ls content/` tự sắp theo thứ tự viết. Mọi stage nhận slug gõ tắt, tự tìm thư mục |

---

## 1. Mục tiêu

Nhận `content/<dir>/script.json` + footage `content/<dir>/raw/s1.mov …` do user quay
→ xuất `out/<dir>.mp4`, 1080×1920, 30fps: jump-cut sạch khoảng lặng, phụ đề động theo nhịp nói,
highlight từ khoá, BGM + SFX.

**Không mục tiêu (v1):** upload TikTok, thumbnail, render Lambda, tách nền, đa ngôn ngữ.

---

## 2. Hợp đồng đầu vào

Skill 1 đã sinh `shoot.md` quy định user phải nộp đúng bộ file này:

```
content/<dir>/
├── script.json          ← skill 1, đã validate
├── shoot.md             ← skill 1, hướng dẫn quay
└── raw/
    ├── s1.mov           ← BẮT BUỘC, một file cho mỗi scene
    ├── s2.mov
    ├── …
    ├── s3-broll.mov     ← tuỳ chọn, nếu scene có bRoll
    └── takes/           ← take dư, skill bỏ qua
```

Quy ước "một scene = một file" là thứ làm cho toàn bộ pipeline này khả thi. Nó cho ta:
độ dài thật từng khối, ranh giới jump-cut có sẵn, và quay lại lẻ một scene không phải làm lại cả bài.

---

## 3. Pipeline

```
script.json + raw/*.mov
        │
  [1] Preflight     kiểm đủ file, ffprobe → duration/fps/resolution/có audio không
        │
  [2] Extract audio raw/sN.mov → audio/sN.wav (16kHz mono 16-bit — whisper.cpp bắt buộc)
        │           + loudnorm EBU R128 về -14 LUFS cho đều tiếng giữa các scene
        │
  [3] Timing        whisper.cpp từng scene → align về voiceover gốc → timing.json
        │
  [4] Jump-cut      ffmpeg silencedetect → cuts.json (danh sách đoạn giữ lại)
        │
  [5] Build props   gộp 1–4, re-time toàn bộ → props.json
        │
  [6] Render        npx remotion render → out/<dir>.mp4
```

Mỗi stage là một script chạy độc lập được, ghi ra file trung gian → debug từng khâu
không phải chạy lại cả pipeline, và sửa tay `cuts.json` được nếu máy cắt sai.

### Stage 1 — Preflight

Fail sớm, báo rõ, đừng để phát hiện lúc render:
- Thiếu file scene nào → liệt kê chính xác cái nào thiếu.
- Clip nào không có audio track → gần như chắc chắn mic chưa kết nối, bảo user quay lại.
- Clip ngang (width > height) → cảnh báo, video sẽ bị letterbox.
- Độ dài thật lệch > 50% so với `endSec - startSec` → cảnh báo user nói quá nhanh/chậm so với kịch bản.
- Thiếu `ffmpeg`/`ffprobe` → hướng dẫn cài.

### Stage 2 — Extract audio

```bash
ffmpeg -i raw/s1.mov -vn -ac 1 -ar 16000 -c:a pcm_s16le -af loudnorm=I=-14:TP=-1.5:LRA=11 audio/s1.wav -y
```

`loudnorm` quan trọng hơn vẻ ngoài của nó: quay 5 scene rời nhau, khoảng cách miệng–mic
lệch vài cm là âm lượng đã khác thấy rõ ở chỗ nối. Chuẩn hoá về -14 LUFS (mức social) làm nó liền mạch.

### Stage 3 — Word-level timing

```js
await installWhisperCpp({ to: whisperPath, version: '1.5.5' });
await downloadWhisperModel({ model: 'medium', folder: whisperPath });  // KHÔNG dùng *.en
const out = await transcribe({
  model: 'medium', whisperPath, whisperCppVersion: '1.5.5',
  inputPath: 'audio/s1.wav', tokenLevelTimestamps: true,
});
const { captions } = toCaptions({ whisperCppOutput: out });
```

⚠️ **Điểm dễ hỏng nhất của cả dự án.** Whisper tiếng Việt sai dấu thường xuyên
("ngứa mồm" → "ngưa mồm"). Chữ sai đập thẳng vào mặt người xem.

Cách xử: ta **đã biết text chính xác** — nó nằm trong `scene.voiceover`. Whisper chỉ dùng để lấy
**timing**, không lấy chữ. Sau khi transcribe thì align token whisper về text gốc
(so khớp không dấu, chuẩn hoá hoa thường) và **luôn hiển thị chữ từ `voiceover`**.

Nhưng user được dặn "đừng học thuộc lòng, nói bằng lời của mình" → lời nói thật sẽ lệch kịch bản.
Nên align phải chịu được sai khác: dùng khoảng cách Levenshtein trên chuỗi không dấu,
từ nào khớp thì lấy chữ gốc, từ nào user nói thêm thì giữ chữ whisper.

Fallback nếu align quá nhiễu: chia đều thời lượng scene cho số từ trong `voiceover`.
Kém tự nhiên hơn nhưng **không bao giờ hiện sai chữ** — đánh đổi đúng hướng.

Model: `medium` là mức tối thiểu cho tiếng Việt, `large-v3-turbo` tốt hơn nếu máy chịu được.
Model `tiny`/`base`/`small` sai quá nhiều, đừng phí thời gian thử.

### Stage 4 — Jump-cut

```bash
ffmpeg -i audio/s1.wav -af silencedetect=noise=-32dB:d=0.35 -f null - 2>&1
```

Parse output → sinh `cuts.json`: các đoạn **giữ lại** của từng scene.

- Cắt khoảng lặng > 350ms, chừa lại ~80ms hai đầu mỗi đoạn để không nghe cụt.
- Cắt 1 giây câm đầu/cuối mỗi clip (đã dặn user chừa trong `shoot.md`).
- **Không** cắt trong lúc đang nói, kể cả khi user ậm ừ — cắt giữa từ nghe rất tệ.
- `cuts.json` sửa tay được. Máy cắt sai một chỗ thì sửa một dòng, không phải chạy lại cả stage.

### Stage 5 — Build props

Gộp mọi thứ, tính lại timeline thật:
- Độ dài scene = tổng các đoạn giữ lại trong `cuts.json`.
- `scene.startSec` thật = tổng dồn các scene trước.
- Dịch `timing.json` theo offset mới (word timing phải trừ đi phần đã cắt — dễ sai off-by-one, cần test kỹ).
- `createTikTokStyleCaptions({ combineTokensWithinMilliseconds: 400 })` → cụm 2–3 từ.
- Đánh dấu token nằm trong `caption.highlight` để tô vàng.
- `durationInFrames = Math.ceil(totalSec * fps)`.

`props.json` là **input duy nhất** của Remotion composition — component không đọc `script.json` trực tiếp.

### Stage 6 — Render

```bash
npx remotion render TikTokVideo out/<dir>.mp4 --props=content/<dir>/props.json
```

Preview khi làm: `npx remotion studio --no-open`.

---

## 4. Cấu trúc Remotion project

```
remotion/
├── package.json
├── remotion.config.ts
├── tsconfig.json
└── src/
    ├── index.ts               registerRoot
    ├── Root.tsx               <Composition id="TikTokVideo" 1080×1920 @30fps>
    │                          calculateMetadata → durationInFrames từ props
    ├── schema.ts              zod, mirror validate-script.mjs
    ├── TikTokVideo.tsx        ghép scene
    └── components/
        ├── SceneClip.tsx      <OffthreadVideo> + trim theo cuts.json + punch-in zoom
        ├── CaptionPage.tsx    phụ đề động, 4 preset: hook | normal | punch | cta
        ├── QuoteCard.tsx      thẻ châm ngôn ở khối punchline
        ├── ProgressBar.tsx    thanh tiến trình mảnh trên cùng
        ├── CtaOverlay.tsx     mũi tên 👇 + emoji
        └── tokens.ts          màu, font, easing
```

Điểm cần lưu ý:

- **Trim clip:** mỗi đoạn trong `cuts.json` là một `<Sequence>` bọc `<OffthreadVideo>` với prop
  trim (`trimBefore`/`trimAfter`, tên cũ là `startFrom`/`endAt` — **tra `/remotion-docs` xác nhận
  theo version đang cài**). Cắt trong Remotion chứ không pre-encode bằng ffmpeg → không mất chất
  lượng vì encode hai lần, và chỉnh lại là render lại ngay.
- **Punch-in zoom:** so le `scale: 1.0` / `1.06` giữa các đoạn liền nhau. Đây là mẹo làm jump-cut
  trông như đổi góc máy dù quay một chỗ — lý do `shoot.md` bảo user quay 4K để dư pixel mà crop.
- **Font phải có dấu tiếng Việt.** `@remotion/google-fonts` với `Be Vietnam Pro` (thiết kế riêng
  cho tiếng Việt) hoặc `Montserrat` + subset `vietnamese`. Inter/Poppins thiếu dấu ở vài weight → chữ vỡ.
  Test ngay ở M0 bằng chuỗi `ắ ầ ễ ộ ữ ỹ ặ ọ`.
- **Safe area:** chừa 220px dưới và 150px trên cho UI TikTok. Caption đặt ở ~62–70% chiều cao,
  không đặt giữa khung — giữa khung là chỗ mặt người nói.
- **Audio:** giọng thật từ clip + `<Audio src={bgm} volume={0.12} loop />`. Duck BGM xuống ~0.06
  khi đang nói nếu thấy át tiếng.

Phần markup/animation cụ thể: **dùng skill chính thức của Remotion**, đừng tự nghĩ (mục 5).

---

## 5. Tận dụng Remotion Agent Skills

Remotion có bộ skill chính thức cho Claude Code — cài trước khi build skill 2:

| Skill | Dùng lúc nào |
|---|---|
| `/remotion-create` | Khởi tạo (`npx create-video@latest --yes --blank --no-tailwind`) |
| `/remotion-markup` | Viết component, animation, typography, audio |
| `/remotion-captions` | Toàn bộ phần phụ đề |
| `/remotion-render` | Lệnh render |
| `/remotion-studio` | Bật preview |
| `/remotion-docs` | Tra API — đặc biệt tên prop trim của OffthreadVideo |

→ `SKILL.md` của skill 2 **không chép lại** kiến thức Remotion. Nó chỉ định nghĩa pipeline,
gọi script stage 1–6, và ở bước viết component thì bảo Claude đọc `/remotion-markup` +
`/remotion-captions`. Giữ skill mỏng, không lệch version khi Remotion update.

---

## 6. Hình hài skill 2

```
.claude/skills/tiktok-video/
├── SKILL.md                   ← orchestrator: chạy 6 stage, verify, báo cáo
├── references/
│   ├── pipeline.md            ← chi tiết từng stage, cờ ffmpeg, biến môi trường
│   ├── design-system.md       ← màu, font, animation preset, safe area
│   └── troubleshooting.md     ← ffmpeg, whisper, font vỡ dấu, chrome headless, clip thiếu audio
└── scripts/
    ├── preflight.mjs          stage 1
    ├── extract-audio.mjs      stage 2
    ├── transcribe.mjs         stage 3
    ├── detect-cuts.mjs        stage 4
    ├── build-props.mjs        stage 5
    └── render.mjs             stage 6
```

---

## 7. Milestone

| M | Nội dung | Verify bằng |
|---|---|---|
| **M0** | Remotion project + ghép `raw/*.mov` theo scene | ✅ render ra mp4 xem được |
| **M1** | Stage 1–2 preflight + extract + loudnorm | ✅ |
| **M2** | Stage 3 whisper + align về `voiceover` | ✅ code xong + 17 assertion self-test. **Chưa chạy whisper thật** — cần giọng người thật |
| **M3** | Stage 4 jump-cut tự động | ✅ 38s → 28.7s trên footage test |
| **M4** | Punch-in zoom, BGM, SFX, progress bar, CTA | ✅ trừ b-roll |
| **M5** | Đóng gói `SKILL.md` + references | ✅ |

**Chỗ duy nhất chưa verify bằng dữ liệu thật: whisper tiếng Việt trên giọng người.**
Bộ align đã test kỹ bằng input giả lập (gồm ca whisper trả về chữ mất dấu), nhưng chất lượng
transcribe thật thì phải có footage thật mới biết. Đây là rủi ro số 1 còn lại.

---

## 8. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| **Whisper sai dấu tiếng Việt** → chữ hiển thị sai | Align timing về `voiceover` gốc, luôn hiển thị chữ gốc. Fallback chia đều. Đây là rủi ro số 1 |
| User nói lệch kịch bản (đã được dặn không học thuộc) | Align phải chịu sai khác — Levenshtein trên chuỗi không dấu, không so khớp cứng |
| Ánh sáng/khung hình lệch giữa các scene → nối thấy rõ | `shoot.md` dặn quay hết một buổi, một chỗ, khoá AE/AF. Không sửa được ở khâu dựng |
| Clip thiếu audio track (quên bật mic) | Preflight bắt ngay stage 1, không để phát hiện lúc render |
| Off-by-one khi dịch word timing qua các đoạn đã cắt | Viết test riêng cho hàm này. Sai một frame là chữ lệch nhịp thấy rõ |
| Model whisper ~1.5GB, transcribe chậm trên máy yếu | Cache `timing.json` theo hash file. Nêu trong `troubleshooting.md` |
| Font vỡ dấu | Chốt `Be Vietnam Pro`, test `ắ ầ ễ ộ ữ ỹ` ngay ở M0 |

---

## 9. Điều kiện tiên quyết

- `ffmpeg` + `ffprobe` (`brew install ffmpeg`)
- Node 22 ✅ (đã có)
- ~2GB đĩa cho whisper.cpp + model `medium`
- Một bộ footage thật để test — dù chỉ quay nháp 5 giây mỗi scene
