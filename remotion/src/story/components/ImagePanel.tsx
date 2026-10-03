import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { STORY } from '../tokens';
import type { Shot } from '../types';

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Panel ảnh: full-bleed ngang, chuyển ảnh bằng cross-dissolve, mỗi ảnh có
// Ken Burns riêng.
//
// Cách chồng lớp: ảnh sau vẽ ĐÈ lên ảnh trước và tự mờ dần hiện ra, ảnh trước
// cứ để nguyên độ đục bên dưới. Kết quả giống hệt crossfade nhưng không bao giờ
// lộ khoảng hở nền ở giữa hai ảnh — lỗi kinh điển khi cho cả hai cùng fade.

const OneShot: React.FC<{ shot: Shot; index: number }> = ({ shot, index }) => {
  const frame = useCurrentFrame();
  const end = shot.fromFrame + shot.durationInFrames;

  // Ảnh phải sống thêm crossfade frame sau khi hết lượt, để ảnh kế tiếp có nền
  // mà chồng lên. Ngoài khoảng đó thì tháo hẳn cho nhẹ.
  if (frame < shot.fromFrame || frame > end + STORY.panel.crossfade) return null;

  const opacity =
    index === 0
      ? 1 // ảnh đầu tiên không fade — video mở ra là thấy ngay
      : interpolate(frame, [shot.fromFrame, shot.fromFrame + STORY.panel.crossfade], [0, 1], CLAMP);

  const zoom = interpolate(frame, [shot.fromFrame, end], [shot.zoomFrom, shot.zoomTo], CLAMP);

  return (
    <Img
      src={staticFile(shot.src)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${zoom})`,
        transformOrigin: `${shot.originX * 100}% ${shot.originY * 100}%`,
        opacity,
      }}
    />
  );
};

export const ImagePanel: React.FC<{ shots: Shot[] }> = ({ shots }) => (
  <div
    style={{
      position: 'absolute',
      top: STORY.panel.top,
      left: 0,
      width: '100%',
      height: STORY.panel.height,
      overflow: 'hidden',
      backgroundColor: STORY.bg,
    }}
  >
    {shots.map((shot, i) => (
      <OneShot key={`${shot.sceneId}-${i}`} shot={shot} index={i} />
    ))}
  </div>
);
