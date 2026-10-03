import { interpolate, useCurrentFrame } from 'remotion';
import { bodyFont, STORY } from '../tokens';
import type { StoryCaption } from '../types';

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Phụ đề theo CỤM, không theo từng từ — đây là điểm khác căn bản so với bản selfie.
// Mỗi dòng là đúng một câu đã đưa qua TTS thành một file wav riêng, nên thời điểm
// hiện/tắt là sự thật tuyệt đối, không phải kết quả đoán của whisper.

const One: React.FC<{ caption: StoryCaption }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const end = caption.fromFrame + caption.durationInFrames;
  const f = STORY.caption.fadeFrames;

  if (frame < caption.fromFrame - f || frame > end) return null;

  const opacity = Math.min(
    interpolate(frame, [caption.fromFrame - f, caption.fromFrame], [0, 1], CLAMP),
    interpolate(frame, [end - f, end], [1, 0], CLAMP),
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: STORY.caption.top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: bodyFont,
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: STORY.caption.fontSize,
          lineHeight: STORY.caption.lineHeight,
          color: STORY.caption.color,
          textShadow: STORY.caption.shadow,
          maxWidth: STORY.caption.maxWidth,
          textAlign: 'center',
          // Chia đều chữ giữa các dòng thay vì để dòng cuối trơ một từ.
          textWrap: 'balance',
        }}
      >
        {caption.text}
      </div>
    </div>
  );
};

export const StoryCaptions: React.FC<{ captions: StoryCaption[] }> = ({ captions }) => (
  <>
    {captions.map((c, i) => (
      <One key={`cap-${i}`} caption={c} />
    ))}
  </>
);
