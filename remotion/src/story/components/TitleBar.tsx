import { fitText } from '@remotion/layout-utils';
import { STORY, stroke, titleFont } from '../tokens';
import type { StoryTitle } from '../types';

// Tiêu đề 2 dòng, ĐỨNG YÊN suốt video — không animation, không fade.
// Trong định dạng này nó là cái mồi: người lướt qua đọc được ngay video nói về
// cái gì mà không cần bật tiếng. Nó nhấp nháy là hỏng việc.
//
// Hai dòng dùng CHUNG một cỡ chữ. Đo từ video mẫu: chiều cao chữ N trần của hai
// dòng là 99px và 96px trên khung 1920 — tức cùng cỡ, không phải mỗi dòng co
// giãn riêng cho đầy bề ngang. Dòng nào nhiều chữ thì rộng hơn, thế thôi.
// Cho mỗi dòng tự fit riêng sẽ ra hai cỡ chữ lệch nhau trông rất nghiệp dư.

const measure = (text: string) =>
  fitText({
    text,
    withinWidth: STORY.title.maxWidth,
    fontFamily: titleFont,
    fontWeight: 400, // Anton chỉ có một weight
  }).fontSize;

const Line: React.FC<{
  text: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  shadow?: string;
}> = ({ text, fontSize, color, strokeColor, shadow }) => (
  <div
    style={{
      fontFamily: titleFont,
      fontSize,
      // 1.30 đo từ video mẫu: đỉnh chữ N dòng 1 tới đỉnh chữ N dòng 2 là 156px
      // với cỡ chữ 120. Chật hơn thì dấu mũ dòng dưới đâm vào chân dòng trên —
      // tiếng Việt xếp dấu cao hơn hẳn latin nên không dùng lineHeight mặc định được.
      lineHeight: STORY.title.lineHeight,
      color,
      whiteSpace: 'nowrap',
      textShadow: shadow,
      ...stroke(fontSize, strokeColor),
    }}
  >
    {text}
  </div>
);

export const TitleBar: React.FC<{ title: StoryTitle }> = ({ title }) => {
  // Cỡ chung = cỡ lớn nhất mà CẢ HAI dòng còn nằm gọn trong bề ngang cho phép.
  const fontSize = Math.min(
    STORY.title.maxFontSize,
    measure(title.line1),
    measure(title.line2),
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: `${STORY.title.top * 100}%`,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Line
        text={title.line1}
        fontSize={fontSize}
        color={STORY.title.line1.color}
        strokeColor={STORY.title.line1.stroke}
      />
      <Line
        text={title.line2}
        fontSize={fontSize}
        color={STORY.title.line2.color}
        strokeColor={STORY.title.line2.stroke}
        shadow="0 6px 16px rgba(0,0,0,0.45)"
      />
    </div>
  );
};
