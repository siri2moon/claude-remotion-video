import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import type { Clip } from '../types';

export const SceneClip: React.FC<{ clip: Clip }> = ({ clip }) => {
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
          transform: `scale(${clip.zoom})`,
        }}
      />
    </AbsoluteFill>
  );
};
