import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import type { VideoProps } from './types';
import { SceneClip } from './components/SceneClip';
import { TitleCard } from './components/TitleCard';
import { Subtitles } from './components/Subtitles';
import { ProgressBar } from './components/ProgressBar';
import { COLORS, fontFamily } from './tokens';

export const TikTokVideo: React.FC<VideoProps> = (props) => {
  if (props.clips.length === 0) {
    return <EmptyState slug={props.slug} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, fontFamily }}>
      {/* Lớp 1 — footage, mỗi đoạn giữ lại sau jump-cut là một Sequence */}
      {props.clips.map((clip, i) => (
        <Sequence key={`clip-${i}`} from={clip.fromFrame} durationInFrames={clip.durationInFrames} name={`clip ${clip.sceneId}`}>
          <SceneClip clip={clip} />
        </Sequence>
      ))}

      {/* Lớp 2 — phụ đề động theo nhịp nói */}
      {props.captions.map((page, i) => (
        <Sequence key={`cap-${i}`} from={page.fromFrame} durationInFrames={page.durationInFrames} name="phụ đề">
          <Subtitles page={page} />
        </Sequence>
      ))}

      {/* Lớp 3 — chữ to tiêu đề khối, nằm trên phụ đề */}
      {props.titles.map((title, i) => (
        <Sequence key={`title-${i}`} from={title.fromFrame} durationInFrames={title.durationInFrames} name={`title ${title.style}`}>
          <TitleCard title={title} />
        </Sequence>
      ))}

      <ProgressBar />

      {/* Tiếng nói đi kèm footage (OffthreadVideo tự phát). Đây là nhạc nền + SFX. */}
      {props.bgm ? <Audio src={staticFile(props.bgm.src)} volume={props.bgm.volume} loop /> : null}
      {props.sfx.map((s, i) => (
        <Sequence key={`sfx-${i}`} from={s.atFrame} name="sfx">
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const EmptyState: React.FC<{ slug: string }> = ({ slug }) => (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.ink,
      color: COLORS.white,
      fontFamily,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: 80,
      gap: 24,
    }}
  >
    <div style={{ fontSize: 64, fontWeight: 800 }}>Chưa có props</div>
    <div style={{ fontSize: 36, fontWeight: 600, opacity: 0.75, lineHeight: 1.4 }}>
      Chạy pipeline để sinh <code>content/{slug || '&lt;slug&gt;'}/props.json</code>, rồi render với{' '}
      <code>--props</code>.
    </div>
    <div style={{ fontSize: 30, opacity: 0.5, marginTop: 20 }}>Kiểm tra dấu: ắ ầ ẫ ễ ộ ữ ỹ ặ ọ Đ đ</div>
  </AbsoluteFill>
);
