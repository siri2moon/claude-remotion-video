import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TerminalSpec } from './types';

// Cảnh terminal dựng bằng code: gõ lệnh từng chữ, in output có màu, tự cuộn khi đầy.
// Màu trong chữ: {green}ec2-user{/}@{cyan}nebula-dev{/} — tên màu theo bảng ANSI bên dưới.

const { fontFamily: mono } = loadMono('normal', { weights: ['400', '700'], subsets: ['latin', 'latin-ext'] });

const ANSI: Record<string, string> = {
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#e879f9',
  cyan: '#22d3ee',
  white: '#f8fafc',
  dim: '#64748b',
  gray: '#94a3b8',
  orange: '#fb923c',
  bold: '#ffffff',
};
const TEXT = '#d4dbe8';

type Run = { text: string; color: string; bold: boolean };

/** "{green}abc{/}def" → các đoạn có màu. */
const runs = (s: string): Run[] => {
  const out: Run[] = [];
  let color = TEXT, bold = false;
  for (const part of s.split(/(\{[a-z]+\}|\{\/\})/)) {
    const tag = part.match(/^\{([a-z]+|\/)\}$/);
    if (tag) {
      if (tag[1] === '/') (color = TEXT), (bold = false);
      else if (ANSI[tag[1]]) (color = ANSI[tag[1]]), (bold = tag[1] === 'bold' || bold);
      continue;
    }
    if (part) out.push({ text: part, color, bold });
  }
  return out;
};

/** Cắt các đoạn màu còn đúng n ký tự đầu (cho hiệu ứng gõ). */
const take = (rs: Run[], n: number): Run[] => {
  const out: Run[] = [];
  for (const r of rs) {
    if (n <= 0) break;
    out.push({ ...r, text: r.text.slice(0, n) });
    n -= r.text.length;
  }
  return out;
};
const plainLength = (s: string) => runs(s).reduce((n, r) => n + r.text.length, 0);

export const Terminal: React.FC<{ spec: TerminalSpec; line: string; bg: string; glow: string }> = ({ spec, line, bg, glow }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = spec.fontSize;
  const lh = Math.round(size * 1.38);
  // Cửa sổ cao vừa đủ nội dung cuối cùng (tối đa 840), căn giữa khoảng trống giữa nhãn trên và phụ đề.
  const totalRows = spec.items.reduce((n, i) => n + (i.kind === 'cmd' ? 1 : i.text.split('\n').length), 0) + 1;
  const W = 1000, BAR = 64, PAD = 30;
  const H = Math.min(840, BAR + PAD * 2 + totalRows * lh);
  const top = Math.max(250, 680 - H / 2);
  const enter = spring({ frame: f, fps, config: { damping: 15, mass: 0.7 } });

  // Dòng hiển thị tới frame hiện tại; lệnh đang gõ thì kèm con trỏ.
  const rows: { runs: Run[]; cursor: boolean }[] = [];
  let typing = false;
  const blink = Math.floor(f / 15) % 2 === 0;
  const shown = spec.items.filter((i) => i.from <= f);
  for (const item of shown) {
    if (item.kind === 'cmd') {
      const full = runs(item.text);
      const n = Math.floor((f - item.from) * item.perFrame);
      const done = n >= plainLength(item.text);
      // Lệnh cuối đã gõ xong (hoặc lệnh rỗng = chỉ hiện prompt) thì con trỏ nhấp nháy.
      rows.push({ runs: [...runs(item.prompt), ...take(full, n)], cursor: !done || (item === shown.at(-1) && blink) });
      typing = !done;
    } else {
      item.text.split('\n').forEach((t, i) => {
        if (f >= item.from + i) rows.push({ runs: runs(t), cursor: false });
      });
    }
  }
  const idle = !typing && shown.at(-1)?.kind === 'out';
  const viewRows = Math.floor((H - BAR - PAD * 2) / lh);
  const overflow = Math.max(0, rows.length + (idle ? 1 : 0) - viewRows);
  const scroll = overflow * lh;

  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute', top, width: W, height: H, borderRadius: 26, overflow: 'hidden', background: bg,
          border: `2px solid ${line}`, boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 0 10px ${glow}`,
          transform: `scale(${0.92 + 0.08 * enter}) translateY(${(1 - enter) * 40}px)`, opacity: enter,
        }}
      >
        <div style={{ height: BAR, display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 20, height: 20, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ flex: 1, textAlign: 'center', marginRight: 90, fontFamily: mono, fontSize: 24, color: '#94a3b8' }}>{spec.title}</span>
        </div>
        <div style={{ position: 'relative', height: H - BAR, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: PAD, right: PAD, top: PAD, transform: `translateY(${-scroll}px)`, fontFamily: mono, fontSize: size, lineHeight: `${lh}px`, whiteSpace: 'pre', color: TEXT }}>
            {rows.map((r, i) => (
              <div key={i} style={{ height: lh }}>
                {r.runs.map((x, j) => (
                  <span key={j} style={{ color: x.color, fontWeight: x.bold ? 700 : 400 }}>
                    {x.text}
                  </span>
                ))}
                {r.cursor && <Cursor size={size} />}
              </div>
            ))}
            {idle && blink && (
              <div style={{ height: lh }}>
                <Cursor size={size} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cursor: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ display: 'inline-block', width: size * 0.6, height: size * 1.1, marginBottom: -size * 0.2, background: '#e2e8f0', opacity: 0.85 }} />
);
