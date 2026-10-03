import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../tokens';

/** Thanh tiến trình mảnh trên cùng — cho người xem biết còn bao lâu, giữ chân tốt hơn */
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = Math.min(1, frame / Math.max(1, durationInFrames - 1));

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start' }}>
      <div style={{ height: 8, width: '100%', backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: COLORS.yellow }} />
      </div>
    </AbsoluteFill>
  );
};
