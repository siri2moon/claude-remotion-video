# lucifer-promo

Quay và dựng video ngắn giới thiệu Lucifer (composition `LuciferShort`).

```bash
# 1. Chạy Lucifer ở chế độ mô phỏng (không tốn token)
cd ../lucifer/lucifer-engine && LUCIFER_BRAIN=sim uv run lucifer-engine serve
cd ../lucifer/lucifer-office && pnpm dev

# 2. Quay footage theo shots.json (Chrome headless, đồng hồ ảo nên mượt đúng 30 fps)
D=content/2026-10-25-16-10-lucifer-gioi-thieu
node lucifer-promo/capture.mjs $D/shots.json $D/footage            # --every=10 để xem nháp nhanh, --only=ceo,flow để quay lại vài shot

# 3. Nhạc + SFX tổng hợp bằng code
node lucifer-promo/music.mjs $D/audio

# 4. Render
cd remotion && npx remotion render LuciferShort ../out/lucifer-gioi-thieu.mp4 --public-dir=../content --crf=16
```

- `director.js` được chèn vào trang office: thay `performance.now`/`requestAnimationFrame` bằng đồng hồ ảo và giữ camera theo `__cap.pose`.
- Phụ đề, thứ tự shot và nhịp cắt nằm trong `remotion/src/lucifer/LuciferShort.tsx` (cắt theo phách 100 BPM = 18 frame).
