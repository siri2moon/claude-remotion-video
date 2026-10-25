// Shape của props.json — do scripts/build-props.mjs sinh ra.
// Mọi frame ở cấp Clip/Title/CaptionPage/Sfx là TUYỆT ĐỐI trong timeline tổng.
// Riêng CaptionPage.tokens[].fromFrame/toFrame là TƯƠNG ĐỐI so với đầu page
// (vì token được render bên trong <Sequence>, useCurrentFrame() đã là frame tương đối).

export type CaptionStyle = 'hook' | 'normal' | 'punch' | 'cta';

export type Clip = {
  /** Đường dẫn tương đối so với publicDir (= thư mục content/) */
  src: string;
  fromFrame: number;
  durationInFrames: number;
  /** Cắt bỏ bao nhiêu frame ở đầu file gốc */
  trimBefore: number;
  /** Giữ tới frame nào của file gốc */
  trimAfter: number;
  /** 1.0 hoặc 1.06 — so le giữa các đoạn để jump-cut trông như đổi góc máy */
  zoom: number;
  sceneId: string;
  /**
   * Hiệu ứng zoom theo cả scene (video vô tri). snap = giật vào mắt trong vài frame
   * rồi giữ; push = đẩy chậm suốt scene. sceneOffset = clip này bắt đầu ở frame thứ
   * mấy của scene, để các clip con của một scene nối tiếp nhau liền mạch.
   */
  fx?: { kind: 'snap' | 'push'; sceneOffset: number; sceneFrames: number };
};

/** Một đoạn nhạc nền — video vô tri đổi bài theo phần (lo-fi → im bặt → funky). */
export type MusicSegment = {
  src: string;
  fromFrame: number;
  durationInFrames: number;
  volume: number;
  fadeFrames: number;
};

export type Title = {
  fromFrame: number;
  durationInFrames: number;
  text: string;
  highlight: string[];
  style: CaptionStyle;
  emoji: string | null;
};

export type CaptionToken = {
  text: string;
  /** tương đối so với đầu page */
  fromFrame: number;
  toFrame: number;
  highlight: boolean;
};

export type CaptionPage = {
  fromFrame: number;
  durationInFrames: number;
  /** vai của scene chứa page này — quyết định cỡ chữ và màu khối nền */
  style: CaptionStyle;
  tokens: CaptionToken[];
};

export type Sfx = {
  src: string;
  atFrame: number;
  volume: number;
};

export type VideoProps = {
  slug: string;
  quote: string;
  fps: number;
  durationInFrames: number;
  bgm: { src: string; volume: number } | null;
  /** Rỗng với video selfie cũ (dùng `bgm`). */
  music?: MusicSegment[];
  clips: Clip[];
  titles: Title[];
  captions: CaptionPage[];
  sfx: Sfx[];
};
