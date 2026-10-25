import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import type { Clip } from '../types';

// Snap zoom: giật vào trong 4 frame rồi đứng im. Gốc phóng đặt ở tầm mắt (38% từ
// trên xuống) vì người diễn ngồi giữa khung — đó là chỗ cú twist deadpan ăn tiền.
const SNAP_FRAMES = 4;
const SNAP_SCALE = 1.4;
const PUSH_SCALE = 1.14;
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const fxScale = (fx: NonNullable<Clip['fx']>, frame: number) => {
  const f = frame + fx.sceneOffset;
  if (fx.kind === 'snap') {
    return interpolate(f, [0, SNAP_FRAMES], [1, SNAP_SCALE], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  }
  return interpolate(f, [0, fx.sceneFrames], [1, PUSH_SCALE], CLAMP);
};

export const SceneClip: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const scale = clip.fx ? fxScale(clip.fx, frame) : clip.zoom;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(clip.src)}
        trimBefore={clip.trimBefore}
        trimAfter={clip.trimAfter}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // Punch-in zoom: so le giữa các đoạn liền nhau để jump-cut trông như
          // đổi góc máy dù quay một chỗ. Đây là lý do shoot.md bảo quay 4K.
          transform: `scale(${scale})`,
          transformOrigin: clip.fx ? '50% 38%' : '50% 50%',
        }}
      />
    </AbsoluteFill>
  );
};
