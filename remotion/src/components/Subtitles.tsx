import { AbsoluteFill, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionPage, CaptionStyle, CaptionToken } from '../types';
import { CAPTION_STYLE, COLORS, SAFE, stroke, textShadowAt } from '../tokens';

type Preset = (typeof CAPTION_STYLE)[CaptionStyle];

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Phụ đề động kiểu TikTok: mỗi page là một cụm 2–3 từ, từ đang được nói thì
 * chạy một khối nền bo tròn ra sau lưng nó. Chữ LUÔN lấy từ voiceover gốc trong
 * script.json (xem scripts/align.mjs) — whisper chỉ đóng góp thời điểm.
 *
 * Đặt ở ~74% chiều cao: dưới mặt người nói, trên vùng UI TikTok che
 * (caption + nút của TikTok ăn khoảng 20% dưới cùng).
 */
export const Subtitles: React.FC<{ page: CaptionPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = CAPTION_STYLE[page.style];

  // Page vào bằng trồi + phóng nhẹ, CỐ Ý không fade: các page nối đuôi nhau sát
  // rịt, fade sẽ để lộ vài frame chữ nửa mờ ở chỗ giao nhau, nhìn ra ngay là chớp.
  const pageIn = spring({ frame, fps, config: { damping: 200, mass: 0.35, stiffness: 200 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: SAFE.bottom + 280,
        paddingLeft: 50,
        paddingRight: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px 4px',
          fontSize: preset.fontSize,
          fontWeight: 800,
          lineHeight: 1.3,
          textAlign: 'center',
          transform: `translateY(${interpolate(pageIn, [0, 1], [18, 0])}px) scale(${interpolate(
            pageIn,
            [0, 1],
            [0.93, 1],
          )})`,
        }}
      >
        {page.tokens.map((token, i) => (
          <Word key={i} token={token} preset={preset} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Word: React.FC<{ token: CaptionToken; preset: Preset }> = ({ token, preset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Khối nền lên/xuống bằng hai đoạn dốc riêng rồi lấy min. Làm một mạch
  // interpolate 4 điểm sẽ vỡ khi từ quá ngắn (build-props chỉ đảm bảo toFrame ≥
  // fromFrame + 2) vì inputRange phải tăng nghiêm ngặt.
  const rise = interpolate(frame, [token.fromFrame - 2, token.fromFrame + 2], [0, 1], CLAMP);
  const fall = interpolate(frame, [token.toFrame - 1, token.toFrame + 4], [1, 0], CLAMP);
  const box = Math.min(rise, fall);

  // Nảy có đà: spring vọt quá 1 rồi lắng lại. Nhân với box để lúc từ tắt cũng
  // co về mượt, không rơi phịch như bản cũ (transform bật/tắt, không easing).
  const pop = spring({ frame: frame - token.fromFrame, fps, config: { damping: 10, mass: 0.5, stiffness: 210 } });
  const scale = 1 + 0.13 * box * pop;

  // Từ chưa tới thì mờ để mắt đọc trước được, nhưng mờ dần chứ không nhảy nấc.
  // Không mờ hơn 0.72: opacity kéo cả viền đen mờ theo, mà mất viền thì trên nền
  // quay thật chữ chìm luôn — kiểm bằng footage --busy thấy rõ.
  const opacity = interpolate(frame, [token.fromFrame - 5, token.fromFrame], [0.72, 1], CLAMP);

  const idle = token.highlight ? preset.highlight : COLORS.white;
  const color = interpolateColors(box, [0, 1], [idle, COLORS.ink]);
  // Viền tan vào màu khối nền khi khối hiện ra, nếu không chữ đen viền đen trên
  // nền vàng sẽ phình thành cục.
  const strokeColor = interpolateColors(box, [0, 1], [COLORS.ink, preset.active]);

  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        padding: '2px 14px',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          backgroundColor: preset.active,
          opacity: box,
          transform: `scale(${0.86 + 0.14 * box})`,
        }}
      />
      <span
        style={{
          position: 'relative',
          color,
          textShadow: textShadowAt(0.85 * (1 - box)),
          ...stroke(preset.fontSize, strokeColor),
        }}
      >
        {token.text}
      </span>
    </span>
  );
};
