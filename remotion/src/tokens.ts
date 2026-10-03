import { loadFont } from '@remotion/google-fonts/BeVietnamPro';
import type { CaptionStyle } from './types';

// subsets PHẢI có 'vietnamese', nếu không dấu tiếng Việt sẽ vỡ (ắ ầ ễ ộ ữ ỹ).
// Be Vietnam Pro là font thiết kế riêng cho tiếng Việt nên dấu cân đối ở mọi weight.
export const { fontFamily } = loadFont('normal', {
  weights: ['600', '800'],
  subsets: ['vietnamese', 'latin'],
});

export const COLORS = {
  white: '#FFFFFF',
  yellow: '#FFE14D',
  green: '#4ADE80',
  ink: '#0B0B0F',
  shadow: 'rgba(0,0,0,0.85)',
};

/** Vùng UI TikTok che mất — không đặt chữ vào đây */
export const SAFE = { top: 150, bottom: 220 };

/**
 * Viền quanh chữ. `paint-order: stroke fill` bắt trình duyệt vẽ viền TRƯỚC rồi
 * mới vẽ ruột chữ đè lên. Không có nó, -webkit-text-stroke vẽ đè lên chính nét
 * chữ, ăn mất một nửa độ dày — và dấu tiếng Việt (ế ộ ữ ỹ) bị bít thành cục đen.
 *
 * Tỉ lệ 0.09 là ngưỡng thử ra: dày hơn thì ở weight 800 dấu bắt đầu dính vào
 * thân chữ, mỏng hơn thì không tách được khỏi nền quay thật.
 */
export const stroke = (fontSize: number, color: string = COLORS.ink) => ({
  WebkitTextStroke: `${Math.round(fontSize * 0.09)}px ${color}`,
  paintOrder: 'stroke fill' as const,
});

/** Bóng đổ nhiều lớp. alpha giảm dần khi chữ nằm trên khối nền sáng, nếu không quầng đen trông bẩn. */
export const textShadowAt = (alpha: number) =>
  [`0 4px 18px rgba(0,0,0,${alpha})`, `0 2px 4px rgba(0,0,0,${alpha})`, `0 0 2px rgba(0,0,0,${alpha})`].join(', ');

export const TEXT_SHADOW = textShadowAt(0.85);

/** Kiểu chuyển động lúc chữ to vào khung — mỗi vai một kiểu, không dùng lại */
export type TitleMotion = 'slideX' | 'riseY' | 'assemble' | 'liftUp';

export const TITLE_STYLE: Record<
  CaptionStyle,
  {
    fontSize: number;
    color: string;
    highlight: string;
    top: string;
    motion: TitleMotion;
    /** hiện từng chữ một thay vì cả khối */
    perWord: boolean;
  }
> = {
  hook: { fontSize: 92, color: COLORS.white, highlight: COLORS.yellow, top: '22%', motion: 'slideX', perWord: false },
  normal: { fontSize: 68, color: COLORS.white, highlight: COLORS.yellow, top: '24%', motion: 'riseY', perWord: false },
  punch: { fontSize: 96, color: COLORS.yellow, highlight: COLORS.white, top: '22%', motion: 'assemble', perWord: true },
  cta: { fontSize: 74, color: COLORS.green, highlight: COLORS.white, top: '24%', motion: 'liftUp', perWord: false },
};

/**
 * Phụ đề leo thang theo vai của scene: khối đúc kết to nhất vì đó là câu quote,
 * khối tâm sự nhỏ nhất để nhường chỗ cho mặt người nói.
 * `active` là màu khối nền chạy sau từ đang được nói.
 */
export const CAPTION_STYLE: Record<CaptionStyle, { fontSize: number; active: string; highlight: string }> = {
  hook: { fontSize: 66, active: COLORS.yellow, highlight: COLORS.yellow },
  normal: { fontSize: 58, active: COLORS.yellow, highlight: COLORS.yellow },
  punch: { fontSize: 76, active: COLORS.yellow, highlight: COLORS.yellow },
  cta: { fontSize: 64, active: COLORS.green, highlight: COLORS.green },
};
