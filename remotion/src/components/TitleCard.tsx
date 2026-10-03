import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Title } from '../types';
import { splitWords, type WordUnit } from '../highlight';
import { COLORS, stroke, TEXT_SHADOW, TITLE_STYLE, type TitleMotion } from '../tokens';

/**
 * Chữ to "tiêu đề khối" — lấy từ caption.text của script.json.
 * Khác với phụ đề động: cái này là tiêu đề của cả scene, đặt ở nửa trên,
 * chỉ hiện ~2.5s đầu mỗi scene rồi biến đi để không che mặt người nói.
 *
 * Mỗi vai một kiểu vào RIÊNG. Bản trước cả bốn vai đều fade + trồi 22px giống
 * hệt nhau, nên đến scene thứ ba người xem đã đoán được chữ sẽ vào thế nào —
 * khán giả không nhớ màu, họ nhớ chuyển động.
 */
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const EXIT_FRAMES = 9;
const WORD_STEP = 3; // khoảng cách giữa hai chữ khi hiện lần lượt
const BEAT = 9; // nhịp khựng ngay TRƯỚC cụm được highlight — chỗ lấy hơi của câu chốt

const ENTER: Record<TitleMotion, { damping: number; mass: number; stiffness: number }> = {
  slideX: { damping: 14, mass: 0.6, stiffness: 130 },
  riseY: { damping: 18, mass: 0.5, stiffness: 120 },
  assemble: { damping: 200, mass: 0.4, stiffness: 200 },
  liftUp: { damping: 15, mass: 0.55, stiffness: 140 },
};

export const TitleCard: React.FC<{ title: Title }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const preset = TITLE_STYLE[title.style];

  const units = splitWords(title.text, title.highlight);
  const delays = buildDelays(units, preset.perWord, durationInFrames);

  const enter = spring({ frame, fps, config: ENTER[preset.motion] });
  // Vào có chuyển động thì ra cũng phải có. Bản trước chỉ mờ dần rồi đứng im,
  // trông như hết pin.
  const exit = interpolate(frame, [durationInFrames - EXIT_FRAMES, durationInFrames], [0, 1], CLAMP);

  let x = 0;
  let y = 0;
  let scale = 1;
  let rotate = 0;

  switch (preset.motion) {
    case 'slideX':
      x = interpolate(enter, [0, 1], [-110, 0]) + exit * 90;
      break;
    case 'riseY':
      y = interpolate(enter, [0, 1], [46, 0]) - exit * 38;
      break;
    case 'assemble': {
      // Khối đứng yên, từng chữ tự đập vào. Xong chữ cuối thì cả khối rung một
      // cái rồi tắt — đây là cao trào của cả video, nó xứng đáng có cú hích.
      const last = delays[delays.length - 1] ?? 0;
      const t = frame - last - 2;
      if (t >= 0) {
        const decay = Math.max(0, 1 - t / 12);
        x = Math.sin(t / 1.5) * 7 * decay;
        rotate = Math.sin(t / 1.5) * 1.4 * decay;
      }
      scale = 1 + exit * 0.16;
      break;
    }
    case 'liftUp':
      y = interpolate(enter, [0, 1], [70, 0]) + exit * 46;
      scale = interpolate(enter, [0, 1], [0.9, 1]);
      break;
  }

  const opacity =
    (preset.motion === 'assemble' ? 1 : interpolate(enter, [0, 0.55], [0, 1], CLAMP)) * (1 - exit);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: preset.top,
        paddingLeft: 70,
        paddingRight: 70,
        opacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '6px 0.32em',
          transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
          fontSize: preset.fontSize,
          fontWeight: 800,
          lineHeight: 1.18,
          textAlign: 'center',
          color: preset.color,
          textShadow: TEXT_SHADOW,
          letterSpacing: -1,
          ...stroke(preset.fontSize),
        }}
      >
        {units.map((unit, i) => (
          <Unit key={i} unit={unit} delay={delays[i]} animate={preset.perWord} highlight={preset.highlight} />
        ))}
        {/* CTA đẩy emoji xuống mũi tên nhún bên dưới, không thì màn hình có hai cái 👇 */}
        {title.emoji && title.style !== 'cta' ? <span>{title.emoji}</span> : null}
      </div>

      {title.style === 'cta' ? <Arrow emoji={title.emoji ?? '👇'} /> : null}
    </AbsoluteFill>
  );
};

/**
 * Lịch hiện từng chữ. Cụm highlight được chèn thêm một nhịp khựng phía trước.
 * Nếu tổng độ trễ ăn quá 45% thời lượng thì nén lại — tiêu đề chỉ sống ~2.6s,
 * câu dài mà cứ 3 frame một chữ thì chữ cuối vừa hiện xong đã phải thoát.
 */
const buildDelays = (units: WordUnit[], perWord: boolean, durationInFrames: number): number[] => {
  if (!perWord) return units.map(() => 0);

  const firstHl = units.findIndex((u) => u.pieces.some((p) => p.hl));
  const out: number[] = [];
  let t = 0;
  units.forEach((_, i) => {
    if (i === firstHl && i > 0) t += BEAT;
    out.push(t);
    t += WORD_STEP;
  });

  const total = out[out.length - 1] ?? 0;
  const budget = durationInFrames * 0.45;
  return total > budget && total > 0 ? out.map((d) => Math.round((d * budget) / total)) : out;
};

const Unit: React.FC<{ unit: WordUnit; delay: number; animate: boolean; highlight: string }> = ({
  unit,
  delay,
  animate,
  highlight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hl = unit.pieces.some((p) => p.hl);

  const text = unit.pieces.map((p, i) => (
    <span key={i} style={{ color: p.hl ? highlight : undefined }}>
      {p.text}
    </span>
  ));

  if (!animate) return <span style={{ display: 'inline-block' }}>{text}</span>;

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: hl ? 9 : 12, mass: 0.45, stiffness: 200 },
  });

  // Chữ thường nảy lên từ nhỏ; cụm chốt thì đập từ to xuống — hai cảm giác khác
  // nhau, và cái thứ hai mới ra được chữ "đấm vào màn hình".
  const scale = interpolate(enter, [0, 1], [hl ? 1.5 : 0.7, 1]);
  const y = hl ? 0 : interpolate(enter, [0, 1], [22, 0]);

  return (
    <span
      style={{
        display: 'inline-block',
        opacity: interpolate(enter, [0, 0.4], [0, 1], CLAMP),
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      {text}
    </span>
  );
};

const Arrow: React.FC<{ emoji: string }> = ({ emoji }) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 5) * 10;
  return (
    <div
      style={{
        marginTop: 28,
        fontSize: 78,
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 4px 14px ${COLORS.shadow})`,
      }}
    >
      {emoji}
    </div>
  );
};
