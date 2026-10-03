// Shape của props.json cho composition "StoryVideo" — do skill ai-story sinh ra.
// Mọi *Frame là TUYỆT ĐỐI trong timeline tổng.
//
// Khác biệt cốt lõi so với TikTokVideo: ở đây thời lượng đến từ giọng đọc TTS —
// mỗi dòng phụ đề là một file wav riêng nên biết chính xác nó dài bao nhiêu.
// Không có whisper, không có bước căn chỉnh, không có chuyện lệch nhịp.

/** Tiêu đề 2 dòng, đứng yên suốt video. Đây là thứ giữ người xem ở lại. */
export type StoryTitle = {
  line1: string;
  line2: string;
};

/** Một ảnh minh hoạ và khoảng thời gian nó chiếm màn hình. */
export type Shot = {
  /** Đường dẫn tương đối so với publicDir (= thư mục content/) */
  src: string;
  fromFrame: number;
  durationInFrames: number;
  /** Ken Burns: tỉ lệ phóng đầu → cuối. 1.0 = nguyên bản. */
  zoomFrom: number;
  zoomTo: number;
  /** Tâm phóng, 0–1 theo chiều ngang/dọc của ảnh. 0.5/0.5 = giữa. */
  originX: number;
  originY: number;
  sceneId: string;
};

/** Một dòng phụ đề = một câu TTS = một file wav. */
export type StoryCaption = {
  text: string;
  fromFrame: number;
  durationInFrames: number;
};

export type StoryProps = {
  id: string;
  fps: number;
  durationInFrames: number;
  title: StoryTitle;
  shots: Shot[];
  captions: StoryCaption[];
  /** Giọng đọc đã ghép sẵn thành một file duy nhất. */
  voice: { src: string } | null;
  bgm: { src: string; volume: number } | null;
};
