// Props của composition BrandShort. Sinh bởi .claude/skills/siri2moon-short/scripts/build-props.mjs
// từ content/<dir>/short.json — đừng viết tay.

export type ThemeName = 'lucifer' | 'siri2moon';

/** Khung camera ảo trên footage, toạ độ px CSS của trang lúc quay (đã chia dpr). */
export type FrameKey = { f: number; cx: number; cy: number; zoom: number };

/** Một dòng trong cảnh terminal. Chữ có thể tô màu bằng {green}…{/}, xem Terminal.tsx. */
export type TerminalItem = {
  kind: 'cmd' | 'out';
  text: string;
  /** Frame (trong cảnh) bắt đầu gõ lệnh / in dòng. */
  from: number;
  /** Lệnh: số ký tự gõ mỗi frame. */
  perFrame: number;
  prompt: string;
};

export type TerminalSpec = { title: string; fontSize: number; items: TerminalItem[] };

/** Cảnh đồ hoạ chuyển động (Motion.tsx), dữ liệu đã tính sẵn ra frame. */
export type MotionSpec =
  | { type: 'split'; before: string; after: string; labels: [string, string] }
  | {
      type: 'wave';
      /** Tên file hiện trên đầu khung. */
      file: string;
      /** Biên độ 0–1 của từng cột, phủ cả cửa sổ âm thanh. */
      peaks: number[];
      /** Đoạn giữ lại, tính theo phần (0–1) của cửa sổ. */
      keep: [number, number][];
      seconds: number;
      keptSeconds: number;
      /** Frame (trong cảnh) bắt đầu khép các khoảng lặng lại. */
      cutAt: number;
      labels: { silence: string; cut: string };
    }
  | { type: 'words'; words: { text: string; from: number; to: number }[]; tag: string }
  | { type: 'pipeline'; steps: { icon: string; title: string; sub: string; at: number }[] }
  /** Gõ câu mô tả (prompt) rồi tranh hiện ra bên dưới. */
  | { type: 'prompt'; label: string; text: string; image: string; typeEnd: number; reveal: number }
  /** Lưới tranh hiện lần lượt, cuối cảnh hiện nhãn tổng kết. */
  | { type: 'gallery'; images: string[]; every: number; badge: string }
  /** Một câu thoại thành sóng âm khi giọng đọc phát, kèm độ dài đo được. */
  | { type: 'speak'; label: string; text: string; peaks: number[]; seconds: number; tag: string }
  /** Các trang tài liệu (PDF đã render ra ảnh) bay lên rồi xoè ra như quạt, trang đầu ở trước. */
  | { type: 'pages'; pages: string[]; every: number; badge: string; badgeAt: number }
  /** Thanh thời gian các hồi của kịch bản + làn nhạc, đầu đọc quét qua; thẻ dưới nói hồi đang chạy. */
  | {
      type: 'acts';
      label: string;
      seconds: number;
      /** Frame đầu đọc bắt đầu / tới cuối thanh. */
      sweep: [number, number];
      /** from/to theo phần (0–1) của cả kịch bản. */
      acts: { name: string; from: number; to: number; icon: string; job: string; color: string }[];
      music: { name: string; from: number; to: number; silent: boolean }[];
    }
  /** Phép tính nghiêm túc: từng dòng hiện ra, số đếm lên, cuối cùng đóng dấu kết luận. */
  | {
      type: 'calc';
      label: string;
      rows: { label: string; at: number; prefix: string; value: number; decimals: number; dec: string; group: string; suffix: string }[];
      stamp: string;
      stampAt: number;
    };

/** Nhãn chỉ vào một chỗ trên video ở layout phone: y theo px của video gốc. */
export type Callout = { from: number; y: number; side: 'left' | 'right'; text: string };

export type ShortScene = {
  id: string;
  from: number;
  dur: number;
  /** Đường dẫn trong content/, vd "<dir>/footage/hero.mp4" hoặc ảnh .png/.jpg. */
  src: string;
  kind: 'video' | 'image' | 'terminal' | 'motion';
  terminal?: TerminalSpec;
  motion?: MotionSpec;
  callouts?: Callout[];
  /** Tiếng của cảnh (giọng thật, tiếng clip): nhạc nền tự hạ xuống khi có. */
  voice?: { src: string; startFrom: number; volume: number } | null;
  /** Frame bỏ qua ở đầu footage. */
  startFrom: number;
  rate: number;
  /** full = phủ kín khung dọc; card = cửa sổ bo góc lia theo `keys`, nền là chính footage nhoè;
   *  phone = video dọc trong khung điện thoại, chừa chỗ cho phụ đề và nhãn hai bên. */
  layout: 'full' | 'card' | 'phone';
  keys: FrameKey[];
  /** Kích thước footage (px) và dpr lúc quay, để đổi key sang px video. */
  size: [number, number];
  dpr: number;
  lines: string[];
  big: boolean;
};

export type ShortSfx = { src: string; from: number; dur: number; volume: number };

export type ShortProps = {
  id: string;
  theme: ThemeName;
  lang: string;
  fps: number;
  durationInFrames: number;
  chip: { title: string; subtitle: string } | null;
  /** Series nhiều tập: label "TẬP 1/5", name tên series. */
  series: { label: string; name: string } | null;
  scenes: ShortScene[];
  outro: {
    from: number;
    dur: number;
    scene: ShortScene | null;
    title: string;
    subtitle: string;
    chips: string[];
    link: string | null;
    linkIcon: 'github' | 'web';
    /** Độ tối phủ lên footage nền khi hiện logo (0–1). */
    dim: number;
  } | null;
  endcard: { from: number; dur: number; follow: string; lines: string[]; /** Series: giới thiệu tập sau. */ next: string | null };
  /** Nhạc nền: bài tổng hợp, hoặc file nhạc cắt từ đầu ô nhịp `trimBefore` (frame). */
  bgm: { src: string; volume: number; trimBefore: number; loop: boolean } | null;
  bpm: number;
  sfx: ShortSfx[];
};
