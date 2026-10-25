import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';
import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { fontFamily, stroke, textShadowAt } from '../tokens';

// Short giới thiệu Lucifer (9:16, 30 fps). Footage quay bằng lucifer-promo/capture.mjs,
// nhạc + SFX tổng hợp bằng lucifer-promo/music.mjs. Mọi mốc cắt rơi đúng phách (100 BPM = 18 frame).

const { fontFamily: serif } = loadCormorant('normal', { weights: ['600', '700'], subsets: ['vietnamese', 'latin'] });

const DIR = '2026-10-25-16-10-lucifer-gioi-thieu';
const file = (p: string) => staticFile(`${DIR}/${p}`);

export const LUCIFER_FPS = 30;
const BEAT = 18;

// Midnight & Champagne, giống HUD của office.
const NAVY = '#07122a';
const GOLD = '#F3D48C';
const GOLD_GRADIENT = 'linear-gradient(100deg, #f6e3ad 0%, #d9b56c 40%, #b48a3f 58%, #f3dc9c 100%)';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

type UiKey = { f: number; cx: number; cy: number; zoom: number };
type Shot = {
  id: string;
  dur: number;
  src: string;
  /** Giây bỏ qua ở đầu footage. */
  skip?: number;
  rate?: number;
  /** Footage ngang của HUD: khung camera ảo đi qua các điểm này (toạ độ CSS của trang 1280x800). */
  ui?: UiKey[];
  lines: string[];
  big?: boolean;
};

const SHOTS: Shot[] = [
  { id: 'hero', dur: BEAT * 6, src: 'hero', lines: ['Tôi xây một công ty', '*100%* nhân viên là *AI 😇*'], big: true },
  { id: 'angels', dur: BEAT * 6, src: 'angels', lines: ['Mỗi nhân viên là một *AI agent*', 'trên *du thuyền 6 sao* ✨'] },
  {
    id: 'assign', dur: BEAT * 6, src: 'ui-assign', skip: 0.3, lines: ['Bạn chỉ cần', '*giao mục tiêu* cho CEO'],
    ui: [
      { f: 0, cx: 640, cy: 400, zoom: 0.78 },
      { f: 20, cx: 615, cy: 595, zoom: 2 },
      { f: 94, cx: 615, cy: 595, zoom: 2 },
      { f: 108, cx: 640, cy: 560, zoom: 1.6 },
    ],
  },
  { id: 'ceo', dur: BEAT * 6, src: 'ceo', lines: ['CEO *Lucifer* tự lên kế hoạch', 'rồi *chia việc* cho cả team'] },
  { id: 'flow', dur: BEAT * 7, src: 'flow', lines: ['Giao xuống *từng phòng ban*', 'đúng *sơ đồ tổ chức*'] },
  {
    id: 'board', dur: BEAT * 7, src: 'ui-board', lines: ['Theo dõi *mọi bước*', 'trên bảng *Kanban* realtime'],
    ui: [
      { f: 0, cx: 640, cy: 620, zoom: 1.45 },
      { f: 50, cx: 1100, cy: 260, zoom: 2.1 },
      { f: 126, cx: 1100, cy: 520, zoom: 2.1 },
    ],
  },
  { id: 'crew', dur: BEAT * 6, src: 'crew', lines: ['Có cả *tiếp viên*', 'mang *cà phê* tận bàn ☕'] },
  { id: 'break', dur: BEAT * 7, src: 'break', skip: 1, lines: ['Bấm *cho nghỉ* một cái…', 'cả team *bay vào bờ* 🏖️'] },
  { id: 'bar', dur: BEAT * 4, src: 'bar', lines: ['chill ở *Heaven’s Brew* 😎'] },
  { id: 'outro', dur: BEAT * 11, src: 'outro', rate: 0.9, lines: [] },
];
const ENDCARD = BEAT * 5;

const starts = SHOTS.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SHOTS[i - 1].dur], []);
const OUTRO_AT = starts[SHOTS.length - 1];
const END_AT = OUTRO_AT + SHOTS[SHOTS.length - 1].dur;
export const LUCIFER_DURATION = END_AT + ENDCARD;

// ---------------------------------------------------------------------------

export const LuciferShort: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily }}>
      {SHOTS.map((shot, i) => (
        <Sequence key={shot.id} from={starts[i]} durationInFrames={shot.dur} name={shot.id}>
          <Whip dur={shot.dur} first={i === 0}>
            {shot.ui ? <UiShot shot={shot} /> : <SceneShot shot={shot} />}
          </Whip>
          <Grade />
          {shot.lines.length > 0 && <Caption lines={shot.lines} dur={shot.dur} big={shot.big} />}
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={OUTRO_AT} name="brand chip">
        <BrandChip />
      </Sequence>
      <Sequence from={OUTRO_AT} durationInFrames={SHOTS[SHOTS.length - 1].dur} name="brand">
        <BrandReveal />
      </Sequence>
      <Sequence from={END_AT} durationInFrames={ENDCARD} name="end card">
        <EndCard />
      </Sequence>

      <Soundtrack />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Footage

/** Cắt kiểu whip-zoom: vào thì phóng to + nhoè rồi nét lại, ra thì đẩy tới + nhoè. */
const Whip: React.FC<{ dur: number; first?: boolean; children: ReactNode }> = ({ dur, first, children }) => {
  const f = useCurrentFrame();
  const enter = first ? 0 : interpolate(f, [0, 8], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const exit = interpolate(f, [dur - 5, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const scale = (1 + 0.1 * enter + 0.07 * exit) * interpolate(f, [0, dur], [1, 1.035]);
  const blur = 12 * enter + 9 * exit;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
  );
};

const SceneShot: React.FC<{ shot: Shot }> = ({ shot }) => (
  <OffthreadVideo
    src={file(`footage/${shot.src}.mp4`)}
    startFrom={Math.round((shot.skip ?? 0) * LUCIFER_FPS)}
    playbackRate={shot.rate ?? 1}
    muted
    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.14) contrast(1.06) brightness(1.02)' }}
  />
);

/** HUD quay ngang 2560x1600: nền là chính nó phóng to + nhoè, phía trước là một "cửa sổ" lia theo các key. */
const UiShot: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const keys = shot.ui!;
  const at = (field: 'cx' | 'cy' | 'zoom') =>
    interpolate(
      f,
      keys.map((k) => k.f),
      keys.map((k) => k[field]),
      { ...clamp, easing: Easing.inOut(Easing.cubic) },
    );
  const cx = at('cx'), cy = at('cy'), zoom = at('zoom');
  const W = 1000, H = 820;
  const s = zoom / 2; // footage có 2 px cho mỗi px CSS
  const src = file(`footage/${shot.src}.mp4`);
  const startFrom = Math.round((shot.skip ?? 0) * LUCIFER_FPS);
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.55) saturate(1.2)', transform: 'scale(1.2)' }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 32%, rgba(243,212,140,0.18), transparent 70%), linear-gradient(180deg, rgba(7,18,42,0.55), rgba(7,18,42,0.25) 50%, rgba(7,18,42,0.7))` }} />
      <div
        style={{
          position: 'absolute', left: (1080 - W) / 2, top: 250, width: W, height: H, overflow: 'hidden', borderRadius: 36,
          border: '2px solid rgba(243,212,140,0.55)', boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 10px rgba(243,212,140,0.06)',
          background: NAVY,
        }}
      >
        <OffthreadVideo
          src={src}
          startFrom={startFrom}
          muted
          style={{
            position: 'absolute', left: 0, top: 0, width: 2560, height: 1600, transformOrigin: '0 0',
            transform: `translate(${W / 2 - cx * 2 * s}px, ${H / 2 - cy * 2 * s}px) scale(${s})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Gradient trên/dưới cho chữ dễ đọc, và vignette nhẹ. */
const Grade: React.FC = () => (
  <AbsoluteFill
    style={{
      background: [
        'radial-gradient(120% 80% at 50% 45%, transparent 55%, rgba(4,10,26,0.55) 100%)',
        'linear-gradient(180deg, rgba(4,10,26,0.5) 0%, transparent 16%, transparent 52%, rgba(4,10,26,0.62) 78%, rgba(4,10,26,0.75) 100%)',
      ].join(', '),
    }}
  />
);

// ---------------------------------------------------------------------------
// Phụ đề

/**
 * "*cụm chữ*" là cụm nhấn, tô vàng champagne. Mỗi cụm nhấn giữ trên một dòng, nên
 * "AI agent" hay "từng phòng ban" không bị bẻ đôi.
 */
const parse = (line: string) => {
  const groups: { words: string[]; hot: boolean }[] = [];
  line.split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part.trim()) return;
    const hot = part.startsWith('*');
    const words = part.replace(/\*/g, '').trim().split(/\s+/);
    if (hot) groups.push({ words, hot });
    else words.forEach((w) => groups.push({ words: [w], hot }));
  });
  return groups;
};

const Caption: React.FC<{ lines: string[]; dur: number; big?: boolean }> = ({ lines, dur, big }) => {
  const f = useCurrentFrame();
  const size = big ? 74 : 66;
  const exit = interpolate(f, [dur - 6, dur - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: big ? 1090 : 1150 }}>
      <div style={{ width: 960, textAlign: 'center', opacity: 1 - exit, transform: `translateY(${-24 * exit}px)` }}>
        {lines.map((line, li) => {
          const lineStart = li === 0 ? 3 : 3 + BEAT + 4;
          return (
            <div key={li} style={{ fontSize: li === 0 && lines.length > 1 && !big ? size * 0.88 : size, lineHeight: 1.24, fontWeight: 800, marginBottom: 6 }}>
              {parse(line).map((g, gi, all) => {
                const before = all.slice(0, gi).reduce((n, x) => n + x.words.length, 0);
                return (
                  <span key={gi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {g.words.map((w, wi) => (
                      <Word key={wi} text={w} hot={g.hot} delay={lineStart + (before + wi) * 2} size={size} />
                    ))}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Word: React.FC<{ text: string; hot: boolean; delay: number; size: number }> = ({ text, hot, delay, size }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 13, mass: 0.6, stiffness: 160 } });
  const style: CSSProperties = {
    display: 'inline-block',
    margin: '0 0.13em',
    color: hot ? GOLD : '#fff',
    opacity: Math.min(1, p * 1.6),
    transform: `translateY(${(1 - p) * 36}px) scale(${0.7 + 0.3 * p})`,
    filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined,
    ...stroke(size, NAVY),
    textShadow: textShadowAt(0.7),
  };
    return <span style={style}>{text}</span>;
};

// ---------------------------------------------------------------------------
// Thương hiệu

const Crest: React.FC<{ size: number }> = ({ size }) => {
  const stars = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [24 + Math.cos(a) * 18.5, 24 + Math.sin(a) * 18.5] as const;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id="crest-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3ad" />
          <stop offset="0.45" stopColor="#d9b56c" />
          <stop offset="0.6" stopColor="#b48a3f" />
          <stop offset="1" stopColor="#ecd08a" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22.5" fill="#0b1a30" stroke="url(#crest-gold)" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="url(#crest-gold)" strokeWidth="0.6" opacity="0.6" />
      {stars.map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 2.2}L${x + 0.7} ${y - 0.7}L${x + 2.2} ${y}L${x + 0.7} ${y + 0.7}L${x} ${y + 2.2}L${x - 0.7} ${y + 0.7}L${x - 2.2} ${y}L${x - 0.7} ${y - 0.7}Z`}
          fill="url(#crest-gold)"
        />
      ))}
      <text x="24" y="30.5" textAnchor="middle" fontFamily={serif} fontWeight="700" fontSize="19" fill="url(#crest-gold)">
        L
      </text>
    </svg>
  );
};

const goldText: CSSProperties = {
  backgroundImage: GOLD_GRADIENT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/** Nhãn nhỏ góc trên suốt video, để ai lướt qua giữa chừng cũng biết đây là gì. */
const BrandChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 6, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: 'absolute', top: 160, left: '50%', transform: `translate(-50%, ${(1 - p) * -30}px)`, opacity: p,
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 30px 12px 14px', borderRadius: 999,
        background: 'rgba(7,18,42,0.62)', border: '1.5px solid rgba(243,212,140,0.5)', backdropFilter: 'blur(10px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      <Crest size={58} />
      <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 40, letterSpacing: '0.2em', ...goldText }}>LUCIFER</span>
      <span style={{ fontSize: 27, fontWeight: 600, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>· Công ty AI mã nguồn mở</span>
    </div>
  );
};

const BrandReveal: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = interpolate(f, [0, 30], [0, 0.62], clamp);
  const crest = spring({ frame: f - 10, fps, config: { damping: 11, mass: 0.8 } });
  const word = 'LUCIFER';
  const sweep = interpolate(f, [34, 70], [-40, 140], clamp);
  const sub = spring({ frame: f - 52, fps, config: { damping: 15 } });
  const chips = ['Claude', 'DeepSeek', 'Gemini', 'Chạy mô phỏng miễn phí'];
  const repo = spring({ frame: f - 112, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(7,18,42,${dim}) 0%, rgba(7,18,42,${dim * 0.75}) 55%, rgba(7,18,42,${dim}) 100%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 430 }}>
        <div style={{ transform: `scale(${0.4 + 0.6 * crest}) rotate(${(1 - crest) * -40}deg)`, opacity: crest, filter: 'drop-shadow(0 0 40px rgba(243,212,140,0.45))' }}>
          <Crest size={230} />
        </div>
        <div style={{ position: 'relative', marginTop: 34, display: 'flex' }}>
          {word.split('').map((ch, i) => {
            const p = spring({ frame: f - 22 - i * 3, fps, config: { damping: 14 } });
            return (
              <span
                key={i}
                style={{
                  fontFamily: serif, fontWeight: 700, fontSize: 170, letterSpacing: '0.16em', lineHeight: 1,
                  display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 50}px)`,
                  ...goldText,
                  backgroundImage: `linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,255,255,0.95) ${sweep}%, transparent ${sweep + 12}%), ${GOLD_GRADIENT}`,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))',
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 26, fontSize: 56, fontWeight: 800, color: '#fff', opacity: sub, transform: `translateY(${(1 - sub) * 24}px)`, textShadow: textShadowAt(0.6) }}>
          Công ty AI <span style={{ color: GOLD }}>mã nguồn mở</span>
        </div>
        <div style={{ marginTop: 42, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, width: 900 }}>
          {chips.map((c, i) => {
            const p = spring({ frame: f - 72 - i * 6, fps, config: { damping: 13 } });
            return (
              <span
                key={c}
                style={{
                  fontSize: 36, fontWeight: 600, color: '#fff', padding: '12px 28px', borderRadius: 999,
                  background: 'rgba(7,18,42,0.7)', border: '1.5px solid rgba(243,212,140,0.55)',
                  opacity: p, transform: `scale(${0.6 + 0.4 * p})`,
                }}
              >
                {c}
              </span>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 54, display: 'flex', alignItems: 'center', gap: 18, padding: '20px 38px', borderRadius: 24,
            background: GOLD_GRADIENT, color: NAVY, fontSize: 42, fontWeight: 800,
            opacity: repo, transform: `translateY(${(1 - repo) * 30}px)`, boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          }}
        >
          <GitHubMark size={48} />
          github.com/siri2moon/lucifer
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const GitHubMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={NAVY}>
    <path d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" />
  </svg>
);

/** Kết: bầu trời đêm của Siri2Moon, Siri bay lên, mời theo dõi. */
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const siri = spring({ frame: f - 4, fps, config: { damping: 12, mass: 0.9 } });
  const t1 = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const t2 = spring({ frame: f - 24, fps, config: { damping: 14 } });
  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: random(`x${i}`) * 1080, y: random(`y${i}`) * 1920, r: 1 + random(`r${i}`) * 2.6, tw: random(`t${i}`) * Math.PI * 2,
  }));
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <AbsoluteFill style={{ background: 'linear-gradient(160deg, #2a2370 0%, #151640 50%, #0a0d24 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(60% 40% at 20% 95%, rgba(56,189,248,0.35), transparent 70%), radial-gradient(50% 35% at 85% 10%, rgba(167,139,250,0.3), transparent 70%)' }} />
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: '#fff',
            opacity: 0.35 + 0.5 * Math.abs(Math.sin(f / 9 + s.tw)),
          }}
        />
      ))}
      <Img
        src={file('siri.png')}
        style={{
          position: 'absolute', left: (1080 - 560) / 2, top: 230 + (1 - siri) * 500 + Math.sin(f / 10) * 10, width: 560,
          transform: `rotate(${(1 - siri) * 12 - 4}deg)`, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.45))',
        }}
      />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1180 }}>
        <div style={{ fontSize: 74, fontWeight: 800, color: '#fff', opacity: t1, transform: `translateY(${(1 - t1) * 30}px)`, textShadow: textShadowAt(0.5) }}>
          Theo dõi <span style={{ color: '#8fe36a' }}>@siri2moon</span>
        </div>
        <div style={{ marginTop: 22, fontSize: 44, fontWeight: 600, color: 'rgba(255,255,255,0.85)', opacity: t2, transform: `translateY(${(1 - t2) * 30}px)`, textAlign: 'center', lineHeight: 1.35 }}>
          để xem mình xây Lucifer từ đầu 🚀
          <br />
          Link GitHub ở bình luận ghim 📌
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Âm thanh

/** Thời điểm (frame) các phím gõ trong cảnh giao việc: khớp với capture (0.6 s, 16 ký tự/giây, bỏ 0.3 s đầu). */
const TYPED = 'Viết kế hoạch ra mắt app ghi chú AI';
const assignAt = starts[SHOTS.findIndex((s) => s.id === 'assign')];
const keyFrames = [...TYPED].map((_, i) => assignAt + Math.round((0.6 - 0.3 + i / 16) * LUCIFER_FPS));
const submitAt = assignAt + Math.round((0.6 - 0.3 + TYPED.length / 16 + 0.5) * LUCIFER_FPS);

const Soundtrack: React.FC = () => {
  const total = LUCIFER_DURATION;
  return (
    <>
      <Audio
        src={file('audio/bgm.wav')}
        volume={(f) => interpolate(f, [0, 4, total - 24, total], [0, 0.9, 0.9, 0], clamp)}
      />
      <Sequence from={0} durationInFrames={90}>
        <Audio src={file('audio/impact.wav')} volume={0.75} />
      </Sequence>
      {starts.slice(1).map((s, i) => (
        <Sequence key={`w${i}`} from={s - 7} durationInFrames={30}>
          <Audio src={file('audio/whoosh.wav')} volume={0.32} />
        </Sequence>
      ))}
      <Sequence from={END_AT - 7} durationInFrames={30}>
        <Audio src={file('audio/whoosh.wav')} volume={0.32} />
      </Sequence>
      {keyFrames.map((k, i) => (
        <Sequence key={`k${i}`} from={k} durationInFrames={4}>
          <Audio src={file('audio/tick.wav')} volume={TYPED[i] === ' ' ? 0.12 : 0.22} />
        </Sequence>
      ))}
      <Sequence from={submitAt} durationInFrames={12}>
        <Audio src={file('audio/pop.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={OUTRO_AT + 20} durationInFrames={96}>
        <Audio src={file('audio/shimmer.wav')} volume={0.55} />
      </Sequence>
      <Sequence from={END_AT + 4} durationInFrames={12}>
        <Audio src={file('audio/pop.wav')} volume={0.35} />
      </Sequence>
    </>
  );
};
