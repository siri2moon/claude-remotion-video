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
import { Callouts, MotionScene, Phone, PHONE } from './Motion';
import { Terminal } from './Terminal';
import type { ShortProps, ShortScene, ThemeName } from './types';

// Short quảng bá thương hiệu Siri2Moon (9:16, 30 fps): footage quay thật + phụ đề từng chữ,
// cắt whip-zoom đúng phách, màn thương hiệu và màn kết Siri. Props từ skill siri2moon-short.

const { fontFamily: serif } = loadCormorant('normal', { weights: ['600', '700'], subsets: ['vietnamese', 'latin'] });

const BEAT = 18;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const BRAND = '_assets/brand';
/** Handle của kênh trên YouTube, TikTok, Facebook. @siri2moon là tài khoản cá nhân, không dùng. */
const HANDLE = '@siri2moondev';

type Theme = {
  bg: string;
  /** Viền chữ phụ đề, nền thẻ. */
  ink: string;
  /** Màu chữ nhấn trong phụ đề. */
  accent: string;
  gradient: string;
  titleFont: string;
  titleWeight: number;
  titleSpacing: string;
  line: string;
  glow: string;
  /** Lớp tối phủ footage cho chữ dễ đọc (r,g,b). */
  shade: string;
  buttonText: string;
};

const THEMES: Record<ThemeName, Theme> = {
  // Midnight & Champagne, giống HUD của Lucifer office.
  lucifer: {
    bg: '#07122a',
    ink: '#07122a',
    accent: '#F3D48C',
    gradient: 'linear-gradient(100deg, #f6e3ad 0%, #d9b56c 40%, #b48a3f 58%, #f3dc9c 100%)',
    titleFont: serif,
    titleWeight: 700,
    titleSpacing: '0.16em',
    line: 'rgba(243,212,140,0.55)',
    glow: 'rgba(243,212,140,0.18)',
    shade: '4,10,26',
    buttonText: '#07122a',
  },
  // Bầu trời đêm của blog siri2moon.com: chàm, aurora xanh trời → tím → hồng.
  siri2moon: {
    bg: '#0a0d24',
    ink: '#0a0d24',
    accent: '#7EE0FF',
    gradient: 'linear-gradient(100deg, #7dd3fc 0%, #a5b4fc 50%, #f0abfc 100%)',
    titleFont: fontFamily,
    titleWeight: 800,
    titleSpacing: '0.02em',
    line: 'rgba(165,180,252,0.6)',
    glow: 'rgba(129,140,248,0.25)',
    shade: '8,10,30',
    buttonText: '#0a0d24',
  },
};

export const BrandShort: React.FC<ShortProps> = (props) => {
  const theme = THEMES[props.theme] ?? THEMES.siri2moon;
  if (props.scenes.length === 0) {
    return <AbsoluteFill style={{ background: theme.bg, color: '#fff', fontFamily, fontSize: 40, alignItems: 'center', justifyContent: 'center' }}>Chưa có props: chạy skill siri2moon-short</AbsoluteFill>;
  }
  const first = props.scenes[0];
  // Cảnh có giọng thật: nhạc nền hạ xuống 25% để nghe rõ lời, vào/ra mượt trong 6 frame.
  const voiced = props.scenes.filter((sc) => sc.voice);
  const duck = (f: number) =>
    voiced.reduce((v, sc) => Math.min(v, interpolate(f, [sc.from - 6, sc.from, sc.from + sc.dur - 4, sc.from + sc.dur + 4], [1, 0.25, 0.25, 1], clamp)), 1);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily }}>
      {props.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.dur} name={scene.id}>
          <Whip dur={scene.dur} first={scene === first}>
            <Footage scene={scene} theme={theme} />
          </Whip>
          <Grade theme={theme} />
          {scene.callouts && scene.callouts.length > 0 && <Callouts callouts={scene.callouts} size={scene.size} theme={theme} />}
          {scene.voice && <Audio src={staticFile(scene.voice.src)} startFrom={scene.voice.startFrom} volume={scene.voice.volume} />}
          {scene.lines.length > 0 && <Caption lines={scene.lines} dur={scene.dur} big={scene.big} theme={theme} />}
        </Sequence>
      ))}

      {props.chip && (
        <Sequence from={0} durationInFrames={props.outro?.from ?? props.endcard.from} name="chip">
          <BrandChip chip={props.chip} series={props.series} theme={theme} themeName={props.theme} />
        </Sequence>
      )}
      {props.outro && (
        <Sequence from={props.outro.from} durationInFrames={props.outro.dur} name="outro">
          {props.outro.scene ? (
            <Whip dur={props.outro.dur}>
              <Footage scene={props.outro.scene} theme={theme} />
            </Whip>
          ) : (
            <NightSky />
          )}
          <BrandReveal outro={props.outro} theme={theme} themeName={props.theme} />
        </Sequence>
      )}
      <Sequence from={props.endcard.from} durationInFrames={props.endcard.dur} name="end card">
        <EndCard endcard={props.endcard} />
      </Sequence>

      {props.bgm && (
        <Audio
          src={staticFile(props.bgm.src)}
          trimBefore={props.bgm.trimBefore}
          loop={props.bgm.loop}
          volume={(f) => interpolate(f, [0, 4, props.durationInFrames - 24, props.durationInFrames], [0, props.bgm!.volume, props.bgm!.volume, 0], clamp) * duck(f)}
        />
      )}
      {props.sfx.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur} name="sfx">
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
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
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};

const Media: React.FC<{ scene: ShortScene; style: CSSProperties }> = ({ scene, style }) =>
  scene.kind === 'image' ? (
    <Img src={staticFile(scene.src)} style={style} />
  ) : (
    <OffthreadVideo src={staticFile(scene.src)} startFrom={scene.startFrom} playbackRate={scene.rate} muted style={style} />
  );

const keyAt = (scene: ShortScene, f: number, field: 'cx' | 'cy' | 'zoom') =>
  scene.keys.length === 1
    ? scene.keys[0][field]
    : interpolate(f, scene.keys.map((k) => k.f), scene.keys.map((k) => k[field]), { ...clamp, easing: Easing.inOut(Easing.cubic) });

const Footage: React.FC<{ scene: ShortScene; theme: Theme }> = ({ scene, theme }) => {
  const f = useCurrentFrame();
  if (scene.kind === 'terminal' && scene.terminal) {
    return (
      <AbsoluteFill>
        {theme.bg === THEMES.siri2moon.bg ? <NightSky /> : <AbsoluteFill style={{ background: `radial-gradient(80% 50% at 50% 40%, ${theme.glow}, transparent 70%), ${theme.bg}` }} />}
        <Terminal spec={scene.terminal} line={theme.line} bg="rgba(8,11,24,0.94)" glow={theme.glow} />
      </AbsoluteFill>
    );
  }
  if (scene.kind === 'motion' && scene.motion) {
    return (
      <AbsoluteFill>
        <NightSky />
        <MotionScene scene={scene} spec={scene.motion} theme={theme} />
      </AbsoluteFill>
    );
  }
  if (scene.layout === 'phone') {
    return (
      <AbsoluteFill>
        <NightSky />
        <Phone src={scene.src} startFrom={scene.startFrom} rate={scene.rate} x={(1080 - PHONE.w) / 2} y={PHONE.y} w={PHONE.w} theme={theme} />
      </AbsoluteFill>
    );
  }
  const grade = 'saturate(1.12) contrast(1.05) brightness(1.02)';
  if (scene.layout === 'full' && scene.keys.length === 0) {
    return <Media scene={scene} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: grade }} />;
  }
  const [vw, vh] = scene.size;
  if (scene.layout === 'full') {
    // Phủ kín khung, lia/zoom theo key (toạ độ CSS của trang).
    const cx = keyAt(scene, f, 'cx'), cy = keyAt(scene, f, 'cy'), zoom = keyAt(scene, f, 'zoom');
    const s = zoom / scene.dpr;
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Media
          scene={scene}
          style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh, transformOrigin: '0 0', filter: grade, transform: `translate(${540 - cx * scene.dpr * s}px, ${960 - cy * scene.dpr * s}px) scale(${s})` }}
        />
      </AbsoluteFill>
    );
  }
  // Card: cửa sổ bo góc lia theo key, nền là chính footage phóng to + nhoè.
  const W = 1000, H = 820;
  const cx = keyAt(scene, f, 'cx'), cy = keyAt(scene, f, 'cy'), zoom = keyAt(scene, f, 'zoom');
  const s = zoom / scene.dpr;
  return (
    <AbsoluteFill>
      <Media scene={scene} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.55) saturate(1.2)', transform: 'scale(1.2)' }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 32%, ${theme.glow}, transparent 70%), linear-gradient(180deg, rgba(${theme.shade},0.55), rgba(${theme.shade},0.25) 50%, rgba(${theme.shade},0.7))` }} />
      <div
        style={{
          position: 'absolute', left: (1080 - W) / 2, top: 250, width: W, height: H, overflow: 'hidden', borderRadius: 36,
          border: `2px solid ${theme.line}`, boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 0 10px ${theme.glow}`, background: theme.bg,
        }}
      >
        <Media
          scene={scene}
          style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh, transformOrigin: '0 0', transform: `translate(${W / 2 - cx * scene.dpr * s}px, ${H / 2 - cy * scene.dpr * s}px) scale(${s})` }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Gradient trên/dưới cho chữ dễ đọc, và vignette nhẹ. */
const Grade: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill
    style={{
      background: [
        `radial-gradient(120% 80% at 50% 45%, transparent 55%, rgba(${theme.shade},0.55) 100%)`,
        `linear-gradient(180deg, rgba(${theme.shade},0.5) 0%, transparent 16%, transparent 52%, rgba(${theme.shade},0.62) 78%, rgba(${theme.shade},0.75) 100%)`,
      ].join(', '),
    }}
  />
);

// ---------------------------------------------------------------------------
// Phụ đề

/**
 * "*cụm chữ*" là cụm nhấn. Mỗi cụm nhấn giữ trên một dòng, nên "AI agent" không bị bẻ đôi.
 * Dấu câu đứng sau cụm nhấn ("*PROD*?") dính liền vào cụm, không bị tách ra.
 */
type Group = { words: string[]; hot: boolean; tail: string };
const parse = (line: string) => {
  const groups: Group[] = [];
  line.split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part) return;
    const hot = part.startsWith('*');
    const lead = !hot && !/^\s/.test(part) ? part.match(/^[.,!?…:;)\]]+/)?.[0] : undefined;
    if (lead && groups.length) {
      groups[groups.length - 1].tail += lead;
      part = part.slice(lead.length);
    }
    const words = part.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean);
    if (hot) groups.push({ words, hot, tail: '' });
    else words.forEach((w) => groups.push({ words: [w], hot, tail: '' }));
  });
  return groups;
};

const Caption: React.FC<{ lines: string[]; dur: number; big?: boolean; theme: Theme }> = ({ lines, dur, big, theme }) => {
  const f = useCurrentFrame();
  const size = big ? 74 : 66;
  const exit = interpolate(f, [dur - 6, dur - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: big ? 1090 : 1150 }}>
      <div style={{ width: 960, textAlign: 'center', opacity: 1 - exit, transform: `translateY(${-24 * exit}px)` }}>
        {lines.map((line, li) => {
          const lineStart = li === 0 ? 3 : 3 + BEAT * li + 4;
          return (
            <div key={li} style={{ fontSize: li === 0 && lines.length > 1 && !big ? size * 0.88 : size, lineHeight: 1.24, fontWeight: 800, marginBottom: 6 }}>
              {parse(line).map((g, gi, all) => {
                const before = all.slice(0, gi).reduce((n, x) => n + x.words.length, 0);
                return (
                  <span key={gi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {g.words.map((w, wi) => (
                      <Word key={wi} text={w} hot={g.hot} delay={lineStart + (before + wi) * 2} size={size} theme={theme} />
                    ))}
                    {g.tail && <Word text={g.tail} hot={false} tight delay={lineStart + (before + g.words.length - 1) * 2} size={size} theme={theme} />}
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

const Word: React.FC<{ text: string; hot: boolean; tight?: boolean; delay: number; size: number; theme: Theme }> = ({ text, hot, tight, delay, size, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 13, mass: 0.6, stiffness: 160 } });
  const style: CSSProperties = {
    display: 'inline-block',
    margin: tight ? '0 0.13em 0 -0.13em' : '0 0.13em',
    color: hot ? theme.accent : '#fff',
    opacity: Math.min(1, p * 1.6),
    transform: `translateY(${(1 - p) * 36}px) scale(${0.7 + 0.3 * p})`,
    filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined,
    ...stroke(size, theme.ink),
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
        <path key={i} d={`M${x} ${y - 2.2}L${x + 0.7} ${y - 0.7}L${x + 2.2} ${y}L${x + 0.7} ${y + 0.7}L${x} ${y + 2.2}L${x - 0.7} ${y + 0.7}L${x - 2.2} ${y}L${x - 0.7} ${y - 0.7}Z`} fill="url(#crest-gold)" />
      ))}
      <text x="24" y="30.5" textAnchor="middle" fontFamily={serif} fontWeight="700" fontSize="19" fill="url(#crest-gold)">
        L
      </text>
    </svg>
  );
};

const Logo: React.FC<{ themeName: ThemeName; size: number }> = ({ themeName, size }) =>
  themeName === 'lucifer' ? <Crest size={size} /> : <Img src={staticFile(`${BRAND}/siri-head.svg`)} style={{ width: size, height: size }} />;

const gradientText = (theme: Theme): CSSProperties => ({ backgroundImage: theme.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });

/** Nhãn nhỏ phía trên suốt video, để ai lướt qua giữa chừng cũng biết đây là gì. */
const BrandChip: React.FC<{ chip: NonNullable<ShortProps['chip']>; series: ShortProps['series']; theme: Theme; themeName: ThemeName }> = ({ chip, series, theme, themeName }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 6, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: 'absolute', top: 160, left: '50%', transform: `translate(-50%, ${(1 - p) * -30}px)`, opacity: p,
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 30px 12px 14px', borderRadius: 999, whiteSpace: 'nowrap',
        background: `rgba(${theme.shade},0.62)`, border: `1.5px solid ${theme.line}`, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      <Logo themeName={themeName} size={58} />
      <span style={{ fontFamily: theme.titleFont, fontWeight: theme.titleWeight, fontSize: themeName === 'lucifer' ? 40 : 34, letterSpacing: themeName === 'lucifer' ? '0.2em' : '0.06em', ...gradientText(theme) }}>
        {chip.title}
      </span>
      {/* Series: tên series thay chủ đề, kèm nhãn "TẬP 1/5" để người lướt qua biết còn tập khác. */}
      {(series?.name || chip.subtitle) && <span style={{ fontSize: 27, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>· {series?.name || chip.subtitle}</span>}
      {series && (
        <span style={{ marginRight: -14, padding: '6px 18px', borderRadius: 999, fontSize: 27, fontWeight: 800, letterSpacing: '0.04em', background: theme.gradient, color: theme.buttonText }}>{series.label}</span>
      )}
    </div>
  );
};

const BrandReveal: React.FC<{ outro: NonNullable<ShortProps['outro']>; theme: Theme; themeName: ThemeName }> = ({ outro, theme, themeName }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = interpolate(f, [0, 30], [0, outro.scene ? outro.dim : 0.2], clamp);
  const logo = spring({ frame: f - 10, fps, config: { damping: 11, mass: 0.8 } });
  const sweep = interpolate(f, [34, 70], [-40, 140], clamp);
  const sub = spring({ frame: f - 52, fps, config: { damping: 15 } });
  const link = spring({ frame: f - 112, fps, config: { damping: 14 } });
  const chars = outro.title.split('');
  const titleSize = Math.min(170, 960 / (chars.length * (themeName === 'lucifer' ? 0.86 : 0.72)));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(${theme.shade},${dim}) 0%, rgba(${theme.shade},${dim * 0.75}) 55%, rgba(${theme.shade},${dim}) 100%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 430 }}>
        <div style={{ transform: `scale(${0.4 + 0.6 * logo}) rotate(${(1 - logo) * -40}deg)`, opacity: logo, filter: `drop-shadow(0 0 40px ${theme.glow})` }}>
          <Logo themeName={themeName} size={230} />
        </div>
        <div style={{ position: 'relative', marginTop: 34, display: 'flex' }}>
          {chars.map((ch, i) => {
            const p = spring({ frame: f - 22 - i * 3, fps, config: { damping: 14 } });
            return (
              <span
                key={i}
                style={{
                  fontFamily: theme.titleFont, fontWeight: theme.titleWeight, fontSize: titleSize, letterSpacing: theme.titleSpacing, lineHeight: 1.05,
                  display: 'inline-block', whiteSpace: 'pre', opacity: p, transform: `translateY(${(1 - p) * 50}px)`,
                  ...gradientText(theme),
                  backgroundImage: `linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,255,255,0.95) ${sweep}%, transparent ${sweep + 12}%), ${theme.gradient}`,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))',
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        {outro.subtitle && (
          <div style={{ marginTop: 26, width: 960, textAlign: 'center', fontSize: 54, fontWeight: 800, color: '#fff', opacity: sub, transform: `translateY(${(1 - sub) * 24}px)`, textShadow: textShadowAt(0.6) }}>
            {parse(outro.subtitle).map((g, i) => (
              <span key={i} style={{ display: 'inline-block', margin: '0 0.13em', color: g.hot ? theme.accent : '#fff', whiteSpace: 'nowrap' }}>
                {g.words.join(' ')}
                <span style={{ color: '#fff' }}>{g.tail}</span>
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 42, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, width: 920 }}>
          {outro.chips.map((c, i) => {
            const p = spring({ frame: f - 72 - i * 6, fps, config: { damping: 13 } });
            return (
              <span key={c} style={{ fontSize: 36, fontWeight: 600, color: '#fff', padding: '12px 28px', borderRadius: 999, background: `rgba(${theme.shade},0.7)`, border: `1.5px solid ${theme.line}`, opacity: p, transform: `scale(${0.6 + 0.4 * p})` }}>
                {c}
              </span>
            );
          })}
        </div>
        {outro.link && (
          <div
            style={{
              marginTop: 54, display: 'flex', alignItems: 'center', gap: 18, padding: '20px 38px', borderRadius: 24,
              background: theme.gradient, color: theme.buttonText, fontSize: 42, fontWeight: 800,
              opacity: link, transform: `translateY(${(1 - link) * 30}px)`, boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            {outro.linkIcon === 'github' ? <GitHubMark size={48} color={theme.buttonText} /> : <span style={{ fontSize: 44 }}>🔗</span>}
            {outro.link}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const GitHubMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color}>
    <path d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" />
  </svg>
);

/** Bầu trời đêm của Siri2Moon: nền cho màn kết và cho outro không có footage. */
const NightSky: React.FC = () => {
  const f = useCurrentFrame();
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: random(`x${i}`) * 1080, y: random(`y${i}`) * 1920, r: 1 + random(`r${i}`) * 2.6, tw: random(`t${i}`) * Math.PI * 2 }));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(160deg, #2a2370 0%, #151640 50%, #0a0d24 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(60% 40% at 20% 95%, rgba(56,189,248,0.35), transparent 70%), radial-gradient(50% 35% at 85% 10%, rgba(167,139,250,0.3), transparent 70%)' }} />
      {stars.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: '#fff', opacity: 0.35 + 0.5 * Math.abs(Math.sin(f / 9 + s.tw)) }} />
      ))}
    </AbsoluteFill>
  );
};

/** Kết: Siri bay lên, mời theo dõi @siri2moondev. Giống nhau ở mọi video để khán giả nhận ra kênh. */
const EndCard: React.FC<{ endcard: ShortProps['endcard'] }> = ({ endcard }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const siri = spring({ frame: f - 4, fps, config: { damping: 12, mass: 0.9 } });
  const t1 = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const t2 = spring({ frame: f - 24, fps, config: { damping: 14 } });
  const t3 = spring({ frame: f - 34, fps, config: { damping: 14 } });
  const [before, after] = endcard.follow.split(HANDLE);
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <NightSky />
      <Img
        src={staticFile(`${BRAND}/siri.png`)}
        style={{ position: 'absolute', left: (1080 - 560) / 2, top: 230 + (1 - siri) * 500 + Math.sin(f / 10) * 10, width: 560, transform: `rotate(${(1 - siri) * 12 - 4}deg)`, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.45))' }}
      />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1180 }}>
        <div style={{ fontSize: 74, fontWeight: 800, color: '#fff', opacity: t1, transform: `translateY(${(1 - t1) * 30}px)`, textShadow: textShadowAt(0.5) }}>
          {before}
          {after !== undefined && <span style={{ color: '#8fe36a' }}>{HANDLE}</span>}
          {after}
        </div>
        <div style={{ marginTop: 22, fontSize: 44, fontWeight: 600, color: 'rgba(255,255,255,0.85)', opacity: t2, transform: `translateY(${(1 - t2) * 30}px)`, textAlign: 'center', lineHeight: 1.35 }}>
          {endcard.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {endcard.next && (
          <div
            style={{
              marginTop: 40, padding: '16px 34px', borderRadius: 999, fontSize: 40, fontWeight: 700, color: '#0a0d24', opacity: t3,
              transform: `translateY(${(1 - t3) * 30}px)`, background: 'linear-gradient(100deg, #7dd3fc 0%, #a5b4fc 50%, #f0abfc 100%)', whiteSpace: 'nowrap',
            }}
          >
            ▶ {endcard.next}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
