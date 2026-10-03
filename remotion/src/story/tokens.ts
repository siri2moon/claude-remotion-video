// Design token cho định dạng kể chuyện bằng tranh.
// Mọi con số ở đây đo trực tiếp từ video tham khảo docs/refer/muonkiepnhansinh.MP4
// (576×1024) rồi quy về khung 1080×1920 — xem references/design-system.md.

import { loadFont as loadTitleFont } from '@remotion/google-fonts/Anton';
import { loadFont as loadBodyFont } from '@remotion/google-fonts/Nunito';

// Anton — grotesque hẹp, rất đậm, chữ hoa. Đúng kiểu tiêu đề của video mẫu,
// và là một trong số ít font kiểu này có subset 'vietnamese'.
// BebasNeue và ArchivoBlack trông tương tự nhưng KHÔNG có dấu tiếng Việt.
export const { fontFamily: titleFont } = loadTitleFont('normal', {
  subsets: ['vietnamese', 'latin'],
});

// Nunito italic — phụ đề video mẫu là kiểu nghiêng bo tròn, dễ đọc.
export const { fontFamily: bodyFont } = loadBodyFont('italic', {
  weights: ['600', '700'],
  subsets: ['vietnamese', 'latin'],
});

export const W = 1080;
export const H = 1920;

export const STORY = {
  /** Nền xám xanh đặc, phủ toàn khung. Đo được #495B66. */
  bg: '#495B66',

  title: {
    /**
     * Mép trên HỘP chữ. Không trùng mép trên của mực: Anton có ascent cao nên
     * mực bắt đầu thấp hơn hộp khoảng 0.24× cỡ chữ. 0.145 đặt khối mực vào
     * đúng tâm vùng tiêu đề của video mẫu (283–561 trên khung 1920).
     */
    top: 0.145,
    /** Chiều rộng tối đa một dòng được phép chiếm. */
    maxWidth: Math.round(W * 0.9),
    /**
     * Cỡ chữ dùng chung cho cả hai dòng. 120 suy ra từ video mẫu: chữ N trần cao
     * 99px trên khung 1920, mà Anton có cap-height 0.727em, cộng nửa viền mỗi
     * bên (0.088em) → 99 / 0.815 ≈ 121.
     * Dòng nào dài quá bề ngang cho phép thì CẢ HAI cùng co lại, giữ bằng nhau.
     */
    maxFontSize: 120,
    /**
     * 1.4 chứ không phải 1.3 như đo thô từ mẫu. Lý do: dấu tiếng Việt xếp chồng
     * (Ô Ồ Ứ Ữ) vươn cao hơn hẳn chữ latin, mà Anton lại đặt mực lệch lên trong
     * hộp dòng. Để 1.3 thì dấu mũ dòng dưới chạm chân dòng trên — đã render ra
     * và thấy tận mắt.
     */
    lineHeight: 1.4,
    /** Độ dày viền = fontSize × hệ số này. */
    strokeRatio: 0.088,
    line1: { color: '#E8F500', stroke: '#000000' },
    line2: { color: '#E01A1A', stroke: '#FFFFFF' },
  },

  panel: {
    /** Panel ảnh full-bleed ngang, chiếm 31.8% → 68% chiều cao. */
    top: Math.round(H * 0.318),
    height: Math.round(H * 0.362),
    /** Số frame chồng nhau khi đổi ảnh. 12 frame = 0.4s, đủ mượt để
     *  scene-detect ngưỡng 0.25 không bắt được — giống hệt video mẫu. */
    crossfade: 12,
  },

  caption: {
    top: Math.round(H * 0.7),
    fontSize: 56,
    lineHeight: 1.28,
    maxWidth: Math.round(W * 0.84),
    color: '#FFFFFF',
    /** Phụ đề nằm trên nền xám phẳng nên không cần viền dày như bản selfie,
     *  chỉ cần bóng đủ tách chữ khỏi nền. */
    shadow: ['0 3px 12px rgba(0,0,0,0.55)', '0 1px 3px rgba(0,0,0,0.7)'].join(', '),
    fadeFrames: 4,
  },
} as const;

/** Viền chữ. paint-order BẮT BUỘC — thiếu nó thì viền đè lên glyph và
 *  các dấu chồng của tiếng Việt (ế ộ ữ ỹ) vón thành cục đen. */
export const stroke = (fontSize: number, color: string) => ({
  WebkitTextStroke: `${Math.round(fontSize * STORY.title.strokeRatio)}px ${color}`,
  paintOrder: 'stroke fill' as const,
});
