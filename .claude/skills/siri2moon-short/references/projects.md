# Các dự án trong ecosystem Siri2Moon

Mỗi mục: chạy thế nào, quay thế nào, giao diện nào. Thêm dự án mới theo mẫu ở cuối.

---

## Lucifer: công ty AI mã nguồn mở trên du thuyền

- Repo: `~/www/siri2moon/lucifer` · GitHub `github.com/siri2moon/lucifer` · `theme: "lucifer"`
- Ví dụ đầy đủ: `assets/example/project.json`

### Chạy (chế độ mô phỏng, không tốn token)

Hai lệnh chạy nền (`run_in_background`), dữ liệu để trong scratchpad để không đụng dữ liệu thật:

```bash
cd ~/www/siri2moon/lucifer/lucifer-engine && LUCIFER_BRAIN=sim LUCIFER_DATA_DIR=<scratch>/data LUCIFER_WORKSPACE_DIR=<scratch>/ws uv run lucifer-engine serve
cd ~/www/siri2moon/lucifer/lucifer-office && pnpm dev     # http://localhost:5173
```

Xoá `<scratch>/data` trước khi quay để bảng việc sạch. **Tắt cả hai khi xong** (cổng 4666, 5173).

### capture

```json
"url": "http://localhost:5173/", "loadWait": 6,
"setup": "await __cap.initR3F(); __cap.office = (await import('/src/state/office.ts')).useOffice; __cap.engine = (await import('/src/state/engine.ts')).engineApi; const s = __cap.office.getState(); s.setLang(__cap.lang); s.closeGuide(); if (s.followWork) s.toggleFollow();",
"shotSetup": "(shot) => { const s = __cap.office.getState(); if (!!shot.hud !== s.panelsVisible) s.togglePanels(); return (shot.hud ? '' : '.hud { display: none !important; }') + (shot.labels === false ? ' .labels { display: none !important; }' : '') + (shot.bubbles ? '' : ' .bubble { display: none !important; }'); }"
```

Trường riêng của shot: `hud` (hiện HUD), `labels: false` (ẩn tên), `bubbles` (hiện bong bóng chữ;
mô phỏng nói tiếng Anh nên thường ẩn).

API trong `actions`:
- `__cap.engine.createTask({ title, description, priority: 'high' })` giao việc (chờ vài giây sau đó để các thiên thần bắt đầu làm)
- `__cap.engine.stop()` cho nghỉ: thiên thần bay vào bờ · `__cap.engine.start()` gọi về
- `__cap.office.getState()` store zustand (`selectAgent(id)`, `setLang`…)

### Toạ độ (đơn vị thế giới)

| Chỗ | Toạ độ |
|---|---|
| Du thuyền | trục x từ −22 (đuôi) tới 25 (mũi), tâm z = −4. Mặt nước z < 22, bãi biển z > 22 |
| CEO Lucifer (sky deck) | (2.6, 8.2, −4) |
| Kỹ thuật (Michael, Gabriel, Raphael, Uriel) | x −10 … −3, y 5.75, z −4 |
| Azrael (CPO) | (13.5, 3.15, −4) · Marketing Samael/Belial x −19 … −16, y 3.15 |
| Lilith (thiết kế, trên bãi) | (17, 0.6, 29) |
| Quầy Heaven's Brew | (−20, 0, 32), quay mặt +z |

Góc đã dùng tốt (pos → target):
- flycam mở màn: (72, 4, 8) → (8, 5.5, −4) bay tới (30, 12.5, 20) → (0, 6, −4), fov 40→46
- thiên thần làm việc, lia ngang: (−11.5, 8.3, 3.4) → (−10.5, 6.2, −4) tới (−1.5, 8.3, 3.4) → (−2.5, 6.2, −4)
- CEO chính diện (tiếp viên không che): (4.4, 10.2, 3.2) → (2.6, 8.9, −4)
- dòng việc toàn cảnh: (−28, 21, 24) → (−3, 5, −4) tới (14, 23, 28)
- tiếp viên phục vụ: (−10.5, 6.4, 5.5) → (−17, 3.8, −4)
- bay vào bờ (sau `stop()`): (−27, 4.2, 47) → (−14, 5.5, 8); quầy bar: (−16.5, 3.2, 41) → (−20, 1.6, 32.5), preroll 4
- cẩu lên kết: (13, 13, 8) → (2.6, 8.5, −4) tới (34, 42, 62) → (0, 3, −4)
- HUD 1280×800: ô giao việc `.assign__title` (CSS: ẩn `.assign__desc, .assign select`, title `flex: 1`),
  bảng việc phải x ≈ 950–1270, nhiệm vụ đang chạy y ≈ 500–620

---

## Blog siri2moon.com

- Repo: `~/www/siri2moon/blog-siri2moon` · `theme: "siri2moon"` · ví dụ `assets/example/post.json`
- Danh sách bài: `node $S/page-info.mjs https://siri2moon.com/posts` (trường `posts`)
- Một bài: `page-info.mjs https://siri2moon.com/posts/<slug> --out=… --shot=…`
- Khung điện thoại 540×960: header dính cao ~60 px, nút lên đầu trang góc phải dưới.
- Ảnh bìa bài: `cover` trong page.json (og:image), dùng làm `src` của một cảnh được.

---

## Mẫu cho dự án mới

```markdown
## <Tên>: <một câu định vị>

- Repo · link công khai · theme (`siri2moon` nếu không có bộ nhận diện riêng)
### Chạy
### capture (url, setup, shotSetup, API hữu ích trong actions)
### Góc/khung đã dùng tốt
```
