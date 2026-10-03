import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { ImagePanel } from './components/ImagePanel';
import { StoryCaptions } from './components/StoryCaptions';
import { TitleBar } from './components/TitleBar';
import { bodyFont, STORY } from './tokens';
import type { StoryProps } from './types';

// Định dạng kể chuyện bằng tranh AI: nền phẳng, tiêu đề đứng yên trên cùng,
// panel ảnh ở giữa, phụ đề dưới. Dựng theo docs/refer/muonkiepnhansinh.MP4.

export const StoryVideo: React.FC<StoryProps> = (props) => {
  if (props.shots.length === 0) return <EmptyState id={props.id} />;

  return (
    <AbsoluteFill style={{ backgroundColor: STORY.bg }}>
      <ImagePanel shots={props.shots} />
      <TitleBar title={props.title} />
      <StoryCaptions captions={props.captions} />

      {props.voice ? <Audio src={staticFile(props.voice.src)} /> : null}
      {props.bgm ? <Audio src={staticFile(props.bgm.src)} volume={props.bgm.volume} loop /> : null}
    </AbsoluteFill>
  );
};

const EmptyState: React.FC<{ id: string }> = ({ id }) => (
  <AbsoluteFill
    style={{
      backgroundColor: STORY.bg,
      color: '#FFFFFF',
      fontFamily: bodyFont,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: 80,
      gap: 24,
    }}
  >
    <div style={{ fontSize: 60, fontWeight: 700 }}>Chưa có props</div>
    <div style={{ fontSize: 34, opacity: 0.8, lineHeight: 1.4 }}>
      Chạy pipeline để sinh <code>content/{id || '<dir>'}/props.json</code>, rồi render với{' '}
      <code>--props</code>.
    </div>
    <div style={{ fontSize: 30, opacity: 0.5, marginTop: 20 }}>Kiểm tra dấu: ắ ầ ẫ ễ ộ ữ ỹ ặ ọ Đ đ</div>
  </AbsoluteFill>
);
