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

**Thiếu file không chặn pipeline** — video vẫn render, chỉ là không có nhạc/hiệu ứng.
`build-props.mjs` sẽ liệt kê chính xác file nào còn thiếu.

BGM nên dài hơn video hoặc chấp nhận lặp (composition bật `loop`).

Thư mục `_assets` bắt đầu bằng `_` nên không bao giờ đụng slug video —
slug chỉ nhận `[a-z0-9-]`.
