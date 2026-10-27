# Quay footage (`capture` trong short.json)

`capture.mjs` mở trang trong Chrome headless và chụp **từng frame theo đồng hồ ảo**:
`performance.now` và `requestAnimationFrame` chỉ chạy khi script bước 1/30 s, nên video mượt đúng
30 fps dù mỗi ảnh chụp mất bao lâu. `Date.now` vẫn là giờ thật (để timestamp của server khớp).
CSS animation được chỉnh tốc độ theo thời gian thật mỗi frame cho khớp.

Mã chèn vào trang: `scripts/director.js` (`window.__cap`).

## Gốc

| Trường | Mặc định | Ý nghĩa |
|---|---|---|
| `url` | ✅ | trang mở lúc đầu |
| `viewport` | `[540, 960, 2]` | `[rộng, cao, dpr]` CSS. 540×960 @2 = đúng 1080×1920 |
| `loadWait` | 4 | giây chờ sau khi mở trang |
| `setup` | | JS (async) chạy một lần sau khi tải, trước khi bật đồng hồ ảo. Có `__cap.lang` |
| `shotSetup` | | `(shot) => css` chạy trước mỗi shot, trả về CSS thêm cho shot đó |
| `css` | | CSS cho mọi shot |
| `shots` | ✅ | danh sách shot, **quay theo đúng thứ tự** (trạng thái trang nối tiếp nhau) |

## Shot

| Trường | Ý nghĩa |
|---|---|
| `name`, `seconds` | tên file `footage/<name>.mp4`, độ dài |
| `keys` | camera 3D `[{ t: 0..1, pos: [x,y,z], target: [x,y,z], fov? }]` (app R3F, cần `__cap.initR3F()` trong setup) **hoặc** cuộn trang `[{ t, scroll: px \| "selector" \| "selector+120" }]` |
| `ease` | `inOut` (mặc định) \| `linear` \| `out` \| `in` |
| `preroll` | giây chạy trước khi ghi (mặc định 0,5), camera đứng ở key đầu |
| `actions` | `[{ at: giây, js }]`; `at < 0` chạy trước preroll. JS chạy async: chờ được (`new Promise(r => setTimeout(r, 3000))` để server kịp làm việc) |
| `type` | `{ at, selector, text, cps?, submit? }` gõ từng chữ vào ô input, `submit` giây sau thì `form.requestSubmit()`. `text` song ngữ được |
| `viewport`, `url`, `css` | ghi đè cho riêng shot |
| tuỳ ý | mọi trường khác (`hud`, `bubbles`…) được truyền cho `shotSetup` |

Key nội suy Catmull-Rom (đường cong mượt qua mọi key) với một đường ease chung.

## Mẹo

- **Luôn `--preview` trước**: 8 khung mỗi shot trong vài giây. Quay thật mới tốn 10–35 s mỗi shot.
- Camera 3D: đứng cách vật 6–12 đơn vị cho cận, 25–60 cho toàn cảnh; `fov` 40–46 cho khung dọc.
  Người/vật chuyển động (tiếp viên, cột buồm) có thể che. Xem preview, đổi phía camera.
- Quay HUD/desktop: `viewport: [1280, 800, 2]`, rồi dùng cảnh `layout: "card"` + `keys` để zoom vào
  phần cần đọc. Ô input hẹp → `css` nới rộng nó cho dễ thấy chữ gõ.
- Trang blog: cuộn ≤ 300 px/giây cho dễ đọc; header dính của blog không thành vấn đề khi dùng `card`.
- Quay bản tiếng Anh: `capture.mjs <slug> --lang=en` → `footage-en/`. `setup` đọc `__cap.lang`
  để đổi ngôn ngữ app, `actions` dùng `__cap.lang === 'en' ? … : …`.
