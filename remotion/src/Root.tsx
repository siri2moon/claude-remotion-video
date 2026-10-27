import { Composition } from 'remotion';
import { TikTokVideo } from './TikTokVideo';
import { StoryVideo } from './story/StoryVideo';
import type { VideoProps } from './types';
import type { StoryProps } from './story/types';
import { BrandShort } from './short/BrandShort';
import type { ShortProps } from './short/types';

// Props rỗng để Studio mở được khi chưa chạy pipeline.
// Render thật luôn truyền --props=content/<dir>/props.json đè lên.
const placeholder: VideoProps = {
  slug: '',
  quote: '',
  fps: 30,
  durationInFrames: 90,
  bgm: null,
  clips: [],
  titles: [],
  captions: [],
  sfx: [],
};

const storyPlaceholder: StoryProps = {
  id: '',
  fps: 30,
  durationInFrames: 90,
  title: { line1: '', line2: '' },
  shots: [],
  captions: [],
  voice: null,
  bgm: null,
};

const shortPlaceholder: ShortProps = {
  id: '',
  theme: 'siri2moon',
  lang: 'vi',
  fps: 30,
  durationInFrames: 90,
  chip: null,
  series: null,
  scenes: [],
  outro: null,
  endcard: { from: 0, dur: 90, follow: 'Theo dõi @siri2moondev', lines: [], next: null },
  bgm: null,
  bpm: 100,
  sfx: [],
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* Bản selfie quay thật — skill tiktok-script + tiktok-video */}
    <Composition
      id="TikTokVideo"
      component={TikTokVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={placeholder.durationInFrames}
      defaultProps={placeholder}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
      })}
    />

    {/* Bản kể chuyện bằng tranh AI — skill ai-story */}
    <Composition
      id="StoryVideo"
      component={StoryVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={storyPlaceholder.durationInFrames}
      defaultProps={storyPlaceholder}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
      })}
    />

    {/* Short quảng bá thương hiệu Siri2Moon — skill siri2moon-short */}
    <Composition
      id="BrandShort"
      component={BrandShort}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={shortPlaceholder.durationInFrames}
      defaultProps={shortPlaceholder}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
      })}
    />
  </>
);
