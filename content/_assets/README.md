# Assets dùng chung

Nhạc nền và hiệu ứng tiếng cho mọi video. Tên file phải khớp với `script.json`.

```
_assets/
├── bgm/
│   ├── lofi.mp3        ← khớp script.json → audio.bgm
│   ├── chill.mp3
│   ├── comedy.mp3
│   ├── emotional.mp3
│   └── upbeat.mp3
└── sfx/
    ├── swoosh.mp3      ← khớp scene.sfx[]
    ├── pop.mp3
    ├── ding.mp3
    ├── sigh.mp3
    ├── record-scratch.mp3
    ├── typing.mp3
    ├── notification.mp3
    ├── boom.mp3
    └── riser.mp3
```

**File ở đây phần lớn do máy tự tổng hợp** (`.claude/skills/tiktok-video/scripts/audio-synth.mjs`):
nhạc `lofi`, `funky`, `waltz`, `romantic` và 14 SFX — `record-scratch`, `crickets`, `thud`,
`tick-tock`, `heartbeat`, `boing`, `ding`, `notification`, `pop`, `swoosh`, `riser`, `boom`,
`sigh`, `typing`. `build-props.mjs` tự sinh cái nào còn thiếu.

Muốn dùng nhạc/SFX của riêng mình: chép đè file cùng tên vào đây — máy không bao giờ ghi đè file
đã có. Muốn quay về bản tổng hợp: xoá file, hoặc
`node .claude/skills/tiktok-video/scripts/audio-synth.mjs <tên> --force`.

Tên không có trong bộ tổng hợp mà cũng chưa có file → bỏ qua, không chặn pipeline.

BGM nên dài hơn video hoặc chấp nhận lặp (composition bật `loop`).

Thư mục `_assets` bắt đầu bằng `_` nên không bao giờ đụng slug video —
slug chỉ nhận `[a-z0-9-]`.
