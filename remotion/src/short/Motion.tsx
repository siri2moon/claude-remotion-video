import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { stroke, textShadowAt } from '../tokens';
import type { Callout, MotionSpec, ShortScene, StatusSpan } from './types';

// Motion graphics scenes of BrandShort: explain with pictures instead of small terminal text.
// split = before/after on two phones · wave = a waveform with its silences cut · words = words lighting up
// as they are spoken · pipeline = steps running in turn · prompt/gallery/speak = AI pictures and voice ·
// pages = PDF pages fanning out · acts = script acts + music lane · calc = a stamped calculation ·
// statusline = Claude Code's real status line (quota changing color, or explaining each part).
// Data (frames, amplitudes…) is computed by build-props.

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const mono = '"JetBrains Mono", "SF Mono", Menlo, monospace';

export type MotionTheme = { accent: string; gradient: string; line: string; glow: string; shade: string; ink: string; buttonText: string };

const panel = (theme: MotionTheme): CSSProperties => ({
  background: 'rgba(10,13,32,0.88)',
  border: `2px solid ${theme.line}`,
  borderRadius: 40,
  boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 10px ${theme.glow}`,
});

/** Vertical video in a rounded phone frame. */
export const Phone: React.FC<{ src: string; startFrom?: number; rate?: number; x: number; y: number; w: number; theme: MotionTheme; style?: CSSProperties }> = ({ src, startFrom = 0, rate = 1, x, y, w, theme, style }) => (
  <div
    style={{
      position: 'absolute', left: x, top: y, width: w, height: (w * 16) / 9, borderRadius: 46, overflow: 'hidden',
      border: `3px solid ${theme.line}`, boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 0 9px ${theme.glow}`, background: '#000', ...style,
    }}
  >
    <OffthreadVideo src={staticFile(src)} startFrom={startFrom} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
);

export const PHONE = { w: 440, y: 262 };

/** Labels pointing into the video in the phone frame, growing out to both sides. */
export const Callouts: React.FC<{ callouts: Callout[]; size: [number, number]; theme: MotionTheme }> = ({ callouts, size, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const h = (PHONE.w * 16) / 9;
  const left = (1080 - PHONE.w) / 2;
  return (
    <AbsoluteFill>
      {callouts.map((c, i) => {
        const p = spring({ frame: f - c.from, fps, config: { damping: 14, mass: 0.7 } });
        if (p <= 0.001) return null;
        const y = PHONE.y + (c.y / size[1]) * h;
        const isLeft = c.side === 'left';
        const edge = isLeft ? left + 40 : left + PHONE.w - 40;
        const pillW = left - 30;
        return (
          <div key={i} style={{ position: 'absolute', top: y, left: 0, width: 1080, opacity: Math.min(1, p * 1.5) }}>
            {/* leader line from the label to the dot on the video */}
            <div style={{ position: 'absolute', top: -2, height: 4, borderRadius: 2, left: isLeft ? left - 14 : edge, width: 54 * p, background: theme.accent, boxShadow: `0 0 12px ${theme.accent}` }} />
            <div style={{ position: 'absolute', top: -11, left: edge - 11, width: 22, height: 22, borderRadius: 11, background: theme.accent, transform: `scale(${p})`, boxShadow: `0 0 18px ${theme.accent}` }} />
            <div
              style={{
                position: 'absolute', top: 0, transform: `translate(${(1 - p) * (isLeft ? -40 : 40)}px, -50%)`,
                [isLeft ? 'right' : 'left']: isLeft ? 1080 - left + 14 : left + PHONE.w + 14, width: pillW - 14,
                padding: '14px 18px', borderRadius: 22, background: 'rgba(10,13,32,0.9)', border: `2px solid ${theme.accent}`,
                fontSize: 34, fontWeight: 800, lineHeight: 1.2, color: '#fff', textAlign: isLeft ? 'right' : 'left',
              } as CSSProperties}
            >
              {c.text}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const MotionScene: React.FC<{ scene: ShortScene; spec: MotionSpec; theme: MotionTheme }> = ({ scene, spec, theme }) => {
  if (spec.type === 'split') return <Split spec={spec} theme={theme} />;
  if (spec.type === 'wave') return <Wave spec={spec} theme={theme} dur={scene.dur} />;
  if (spec.type === 'words') return <Words spec={spec} theme={theme} />;
  if (spec.type === 'prompt') return <Prompt spec={spec} theme={theme} />;
  if (spec.type === 'gallery') return <Gallery spec={spec} theme={theme} dur={scene.dur} />;
  if (spec.type === 'speak') return <Speak spec={spec} theme={theme} />;
  if (spec.type === 'pages') return <Pages spec={spec} theme={theme} />;
  if (spec.type === 'acts') return <Acts spec={spec} theme={theme} />;
  if (spec.type === 'calc') return <Calc spec={spec} theme={theme} />;
  if (spec.type === 'statusline') return <StatusLine spec={spec} theme={theme} />;
  return <Pipeline spec={spec} theme={theme} />;
};

// ---------------------------------------------------------------------------

const Split: React.FC<{ spec: Extract<MotionSpec, { type: 'split' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = 440, y = 262;
  const a = spring({ frame: f, fps, config: { damping: 15 } });
  const b = spring({ frame: f - 5, fps, config: { damping: 15 } });
  const arrow = spring({ frame: f - 12, fps, config: { damping: 11 } });
  const label = (text: string, hot: boolean, p: number): CSSProperties => ({
    position: 'absolute', top: (w * 16) / 9 - 80, left: '50%', transform: `translateX(-50%) scale(${p})`, padding: '8px 26px', borderRadius: 999,
    fontSize: 34, fontWeight: 900, letterSpacing: '0.06em', whiteSpace: 'nowrap',
    background: hot ? theme.gradient : 'rgba(20,20,28,0.85)', color: hot ? theme.buttonText : 'rgba(255,255,255,0.85)',
    border: hot ? 'none' : '2px solid rgba(255,255,255,0.35)', zIndex: 2,
  });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${(1 - a) * -500}px) rotate(${(1 - a) * -6}deg)` }}>
        <Phone src={spec.before} x={70} y={y} w={w} theme={{ ...theme, glow: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.35)' }} style={{ filter: 'saturate(0.75) brightness(0.92)' }} />
        <div style={{ position: 'absolute', left: 70, top: y, width: w }}>
          <div style={label(spec.labels[0], false, a)}>{spec.labels[0]}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${(1 - b) * 500}px) rotate(${(1 - b) * 6}deg)` }}>
        <Phone src={spec.after} x={1080 - 70 - w} y={y} w={w} theme={theme} />
        <div style={{ position: 'absolute', left: 1080 - 70 - w, top: y, width: w }}>
          <div style={label(spec.labels[1], true, b)}>{spec.labels[1]}</div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute', left: 540 - 50, top: y + (w * 16) / 18 - 50, width: 100, height: 100, borderRadius: 50,
          background: theme.gradient, color: theme.buttonText, fontSize: 58, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${arrow}) translateX(${Math.sin(f / 5) * 4}px)`, boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 0 10px ${theme.glow}`,
        }}
      >
        →
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Wave: React.FC<{ spec: Extract<MotionSpec, { type: 'wave' }>; theme: MotionTheme; dur: number }> = ({ spec, theme, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 940, H = 330, left = 70, top = 420;
  const n = spec.peaks.length;
  const slot = W / n;
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  // The playhead sweeps across; silences turn red as it reaches them, then close up.
  const head = interpolate(f, [4, spec.cutAt - 4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const cut = interpolate(f, [spec.cutAt, spec.cutAt + 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const kept = (x: number) => spec.keep.some(([s, e]) => x >= s && x < e);
  const widths = spec.peaks.map((_, i) => (kept((i + 0.5) / n) ? slot : slot * (1 - cut)));
  const total = widths.reduce((s, v) => s + v, 0);
  let x = left + (W - total) / 2;
  const secs = interpolate(cut, [0, 1], [spec.seconds, spec.keptSeconds]);
  const fmt = (v: number) => v.toFixed(1).replace('.', ',') + 's';
  const done = spring({ frame: f - spec.cutAt - 14, fps, config: { damping: 11 } });
  // Silent regions (as fractions of the window), for the red background + labels.
  const gaps: [number, number][] = [];
  let prev = 0;
  for (const [s, e] of spec.keep) {
    if (s - prev > 0.005) gaps.push([prev, s]);
    prev = e;
  }
  if (1 - prev > 0.005) gaps.push([prev, 1]);
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 40, top: 300, width: 1000, height: 640, ...panel(theme) }} />
      <div style={{ position: 'absolute', left: 80, top: 330, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: mono, fontSize: 30, color: 'rgba(255,255,255,0.6)' }}>🎙 {spec.file}</span>
        <span style={{ fontFamily: mono, fontSize: 64, fontWeight: 800, color: cut > 0.98 ? theme.accent : '#fff' }}>{fmt(secs)}</span>
      </div>
      {/* red background of the silences, fading as they close */}
      {gaps.map(([s, e], i) => {
        const lit = head >= s;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', top: top - 10, height: H + 20, left: left + s * W, width: (e - s) * W, borderRadius: 14,
              background: 'rgba(255,82,82,0.28)', border: '2px dashed rgba(255,110,110,0.9)', opacity: (lit ? 1 : 0.25) * (1 - cut),
            }}
          />
        );
      })}
      {spec.peaks.map((p, i) => {
        const w = widths[i];
        const k = kept((i + 0.5) / n);
        const bx = x;
        x += w;
        const played = (i + 0.5) / n <= head;
        const h = Math.max(6, p * H);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: bx + w * 0.18, width: Math.max(0, w * 0.64), top: top + (H - h) / 2, height: h, borderRadius: 4,
              background: k ? (played || cut > 0 ? theme.accent : 'rgba(255,255,255,0.55)') : '#ff6b6b',
              opacity: k ? 1 : 1 - cut,
            }}
          />
        );
      })}
      {/* playhead */}
      {cut === 0 && <div style={{ position: 'absolute', left: left + head * W - 2, top: top - 30, width: 4, height: H + 60, background: '#fff', boxShadow: '0 0 16px #fff', opacity: head > 0 && head < 1 ? 1 : 0 }} />}
      {gaps.map(([s, e], i) => (
        <div
          key={`l${i}`}
          style={{
            position: 'absolute', top: top + H + 34, left: left + ((s + e) / 2) * W, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 28, fontWeight: 800, color: '#ff8a8a', opacity: (head >= s ? 1 : 0) * (1 - cut),
          }}
        >
          {spec.labels.silence}
        </div>
      ))}
      <div
        style={{
          position: 'absolute', top: top + H + 50, left: 540, transform: `translate(-50%, -50%) scale(${done})`, padding: '12px 30px', borderRadius: 999,
          background: theme.gradient, color: theme.buttonText, fontSize: 40, fontWeight: 900, whiteSpace: 'nowrap',
        }}
      >
        ✂️ {spec.labels.cut}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Words: React.FC<{ spec: Extract<MotionSpec, { type: 'words' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 40, top: 300, width: 1000, height: 540, ...panel(theme) }} />
      <div
        style={{
          position: 'absolute', top: 330, left: 80, display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 800,
          color: 'rgba(255,255,255,0.75)',
        }}
      >
        <span style={{ display: 'flex', gap: 5, alignItems: 'center', height: 34 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ width: 6, borderRadius: 3, background: theme.accent, height: 10 + 22 * Math.abs(Math.sin(f / 3 + i * 1.3)) }} />
          ))}
        </span>
        {spec.tag}
      </div>
      <div style={{ position: 'absolute', top: 410, left: 80, width: 920, display: 'flex', flexWrap: 'wrap', gap: '26px 18px', alignContent: 'flex-start' }}>
        {spec.words.map((w, i) => {
          const p = spring({ frame: f - w.from, fps, config: { damping: 12, mass: 0.6, stiffness: 170 } });
          if (f < w.from) return <span key={i} style={{ visibility: 'hidden', fontSize: 70, fontWeight: 900 }}>{w.text}</span>;
          const now = f >= w.from && f < Math.max(w.to, w.from + 6);
          return (
            <span key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - p) * 30}px) scale(${0.75 + 0.25 * p})`, opacity: Math.min(1, p * 1.5) }}>
              <span
                style={{
                  fontSize: 70, fontWeight: 900, lineHeight: 1.1, padding: '2px 14px', borderRadius: 16,
                  background: now ? theme.gradient : 'transparent', color: now ? theme.buttonText : '#fff',
                  ...(now ? {} : stroke(70, theme.ink)),
                }}
              >
                {w.text}
              </span>
              <span style={{ fontFamily: mono, fontSize: 22, marginTop: 4, color: now ? theme.accent : 'rgba(255,255,255,0.45)' }}>{(w.from / fps).toFixed(2).replace('.', ',')}s</span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Pipeline: React.FC<{ spec: Extract<MotionSpec, { type: 'pipeline' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const top = 300, row = 128, cx = 150;
  const last = spec.steps[spec.steps.length - 1];
  const fill = interpolate(f, [spec.steps[0].at, last.at], [0, (spec.steps.length - 1) * row], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: cx - 4, top: top + 50, width: 8, height: (spec.steps.length - 1) * row, borderRadius: 4, background: 'rgba(255,255,255,0.14)' }} />
      <div style={{ position: 'absolute', left: cx - 4, top: top + 50, width: 8, height: fill, borderRadius: 4, background: theme.gradient, boxShadow: `0 0 20px ${theme.accent}` }} />
      {spec.steps.map((s, i) => {
        const p = spring({ frame: f - s.at, fps, config: { damping: 12, mass: 0.7 } });
        const appear = spring({ frame: f - i * 2, fps, config: { damping: 16 } });
        const next = spec.steps[i + 1];
        const doneP = next ? spring({ frame: f - next.at, fps, config: { damping: 14 } }) : spring({ frame: f - s.at - 14, fps, config: { damping: 14 } });
        return (
          <div key={i} style={{ position: 'absolute', top: top + i * row, left: 0, width: 1080, height: 100, opacity: appear, transform: `translateX(${(1 - appear) * 60}px)` }}>
            <div
              style={{
                position: 'absolute', left: cx - 50, top: 0, width: 100, height: 100, borderRadius: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 46, background: p > 0.05 ? theme.gradient : 'rgba(20,24,52,0.95)', border: `3px solid ${p > 0.05 ? 'transparent' : 'rgba(255,255,255,0.25)'}`,
                transform: `scale(${1 + 0.18 * p * (1 - doneP)})`, boxShadow: p > 0.05 ? `0 0 ${30 * (1 - doneP) + 10}px ${theme.accent}` : undefined,
              }}
            >
              {doneP > 0.5 ? <span style={{ color: theme.buttonText, fontWeight: 900 }}>✓</span> : s.icon}
            </div>
            <div style={{ position: 'absolute', left: cx + 84, top: 6, opacity: 0.45 + 0.55 * p }}>
              <div style={{ fontSize: 50, fontWeight: 900, color: '#fff', textShadow: textShadowAt(0.5) }}>{s.title}</div>
              <div style={{ fontFamily: mono, fontSize: 26, color: p > 0.05 ? theme.accent : 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.sub}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Prompt: React.FC<{ spec: Extract<MotionSpec, { type: 'prompt' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  const shown = Math.floor(interpolate(f, [4, spec.typeEnd], [0, spec.text.length], clamp));
  const arrow = spring({ frame: f - spec.typeEnd + 4, fps, config: { damping: 12 } });
  const dev = interpolate(f, [spec.reveal, spec.reveal + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const W = 740, H = Math.round(W / 1.551);
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 60, top: 290, width: 960, height: 262, padding: '20px 30px', boxSizing: 'border-box', ...panel(theme) }}>
        <div style={{ fontFamily: mono, fontSize: 24, color: theme.accent, marginBottom: 12 }}>{spec.label}</div>
        <div style={{ fontFamily: mono, fontSize: 26, lineHeight: 1.38, color: 'rgba(255,255,255,0.92)' }}>
          {spec.text.slice(0, shown)}
          {shown < spec.text.length && <span style={{ background: theme.accent, color: theme.accent }}>▌</span>}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 540 - 32, top: 562, width: 52, height: 52, borderRadius: 26, background: theme.gradient, color: theme.buttonText, fontSize: 40, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${arrow})` }}>↓</div>
      <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 624, width: W, height: H, borderRadius: 34, overflow: 'hidden', border: `3px solid ${theme.line}`, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 10px ${theme.glow}`, background: 'rgba(10,13,32,0.9)' }}>
        <Img src={staticFile(spec.image)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: dev, filter: `blur(${(1 - dev) * 24}px) saturate(${0.3 + 0.7 * dev})`, transform: `scale(${1.08 - 0.08 * dev + 0.03 * interpolate(f, [spec.reveal, spec.reveal + 120], [0, 1], clamp)})` }} />
        {dev > 0 && dev < 1 && <div style={{ position: 'absolute', left: 0, right: 0, top: `${dev * 100}%`, height: 6, background: theme.accent, boxShadow: `0 0 30px ${theme.accent}` }} />}
        {dev === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>…</div>}
      </div>
    </AbsoluteFill>
  );
};

const Gallery: React.FC<{ spec: Extract<MotionSpec, { type: 'gallery' }>; theme: MotionTheme; dur: number }> = ({ spec, theme, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = 3, w = 290, h = Math.round(w / 1.551), gap = 16;
  const left = (1080 - (cols * w + (cols - 1) * gap)) / 2;
  const badge = spring({ frame: f - (dur - 34), fps, config: { damping: 11 } });
  return (
    <AbsoluteFill>
      {spec.images.map((src, i) => {
        const p = spring({ frame: f - 3 - i * spec.every, fps, config: { damping: 13, mass: 0.6 } });
        const r = Math.floor(i / cols), c = i % cols;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: left + c * (w + gap), top: 290 + r * (h + gap), width: w, height: h, borderRadius: 20, overflow: 'hidden',
              border: `2px solid ${theme.line}`, opacity: Math.min(1, p * 1.4), transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * (c - 1) * 8}deg)`,
              boxShadow: '0 14px 30px rgba(0,0,0,0.45)', background: '#111',
            }}
          >
            <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute', left: 540, top: 290 + 2 * (h + gap) - 10, transform: `translate(-50%, -50%) scale(${badge})`, padding: '18px 40px', borderRadius: 999,
          background: theme.gradient, color: theme.buttonText, fontSize: 50, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 12px ${theme.glow}`,
        }}
      >
        {spec.badge}
      </div>
    </AbsoluteFill>
  );
};

const Speak: React.FC<{ spec: Extract<MotionSpec, { type: 'speak' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  const total = spec.seconds * fps;
  const head = interpolate(f, [0, total], [0, 1], clamp);
  const n = spec.peaks.length, W = 900, H = 230, left = 90, top = 640;
  const done = spring({ frame: f - total, fps, config: { damping: 11 } });
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 40, top: 290, width: 1000, height: 770, ...panel(theme) }} />
      <div style={{ position: 'absolute', left: 90, top: 320, fontFamily: mono, fontSize: 26, color: theme.accent }}>{spec.label}</div>
      <div style={{ position: 'absolute', left: 90, top: 380, width: 900, fontSize: 52, fontWeight: 800, lineHeight: 1.3, color: '#fff' }}>{spec.text}</div>
      {spec.peaks.map((p, i) => {
        const x = (i + 0.5) / n;
        const h = Math.max(6, p * H);
        const on = x <= head;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: left + (i / n) * W + 1.5, width: W / n - 3, top: top + (H - h * (on ? 1 : 0.15)) / 2, height: h * (on ? 1 : 0.15),
              borderRadius: 3, background: on ? theme.accent : 'rgba(255,255,255,0.25)',
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', left: 90, top: top + H + 40, fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>{spec.tag}</div>
      <div
        style={{
          position: 'absolute', right: 90, top: top + H + 26, transform: `scale(${done})`, padding: '10px 26px', borderRadius: 999, fontFamily: mono,
          fontSize: 36, fontWeight: 800, background: theme.gradient, color: theme.buttonText,
        }}
      >
        ⏱ {spec.seconds.toFixed(2).replace('.', ',')}s
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Pages: React.FC<{ spec: Extract<MotionSpec, { type: 'pages' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = spec.pages.length;
  const w = 470, h = Math.round(w * 1.414), top = 318;
  // The last page lands first and the first page lands last, so it sits on top; then the following pages fan out to both sides.
  const fan = spring({ frame: f - n * spec.every - 6, fps, config: { damping: 14, mass: 0.8 } });
  const badge = spring({ frame: f - spec.badgeAt, fps, config: { damping: 11 } });
  const order = spec.pages.map((_, i) => n - 1 - i);
  return (
    <AbsoluteFill>
      {order.map((i) => {
        const p = spring({ frame: f - 2 - (n - 1 - i) * spec.every, fps, config: { damping: 15, mass: 0.7 } });
        const j = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        const drift = i === 0 ? 0.03 * interpolate(f, [n * spec.every, n * spec.every + 120], [0, 1], clamp) : 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: 540 - w / 2, top, width: w, height: h, borderRadius: 10, overflow: 'hidden', background: '#fff',
              transformOrigin: '50% 100%', opacity: Math.min(1, p * 1.6),
              transform: `translate(${j * 92 * fan}px, ${(1 - p) * 900 + Math.abs(j) * 18 * fan}px) rotate(${j * 8 * fan + (1 - p) * (i % 2 ? 10 : -10)}deg) scale(${(i === 0 ? 1.04 : 0.97) + drift})`,
              boxShadow: i === 0 ? `0 30px 80px rgba(0,0,0,0.6), 0 0 0 8px ${theme.glow}` : '0 18px 40px rgba(0,0,0,0.5)',
              filter: i === 0 ? undefined : `brightness(${1 - 0.18 * fan})`,
            }}
          >
            <Img src={staticFile(spec.pages[i])} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute', left: 540, top: top + h + 6, transform: `translate(-50%, -50%) scale(${badge})`, padding: '16px 38px', borderRadius: 999,
          background: theme.gradient, color: theme.buttonText, fontSize: 44, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 12px ${theme.glow}`,
        }}
      >
        {spec.badge}
      </div>
    </AbsoluteFill>
  );
};

const Acts: React.FC<{ spec: Extract<MotionSpec, { type: 'acts' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = 80, W = 920, barTop = 400, barH = 96, laneTop = 580, laneH = 110;
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  const headAt = (x: number) => interpolate(x, spec.sweep, [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const head = headAt(f);
  const idx = (x: number) => Math.max(0, spec.acts.findIndex((a) => x < a.to || a === spec.acts[spec.acts.length - 1]));
  const cur = f < spec.sweep[0] ? -1 : idx(head);
  // Frame where the playhead enters the current act, so the card below pops up right then.
  let entered = spec.sweep[0];
  for (let x = f; x >= spec.sweep[0]; x--) if (idx(headAt(x)) !== cur) { entered = x + 1; break; }
  const card = spring({ frame: f - entered, fps, config: { damping: 12, mass: 0.6 } });
  const a = cur >= 0 ? spec.acts[cur] : null;
  const secs = Math.round(head * spec.seconds);
  const bars = 64;
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 40, top: 290, width: 1000, height: 770, ...panel(theme) }} />
      <div style={{ position: 'absolute', left: 80, top: 318, right: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: mono, fontSize: 28, color: theme.accent }}>{spec.label}</span>
        <span style={{ fontFamily: mono, fontSize: 46, fontWeight: 800, color: '#fff' }}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</span>
      </div>
      {spec.acts.map((x, i) => {
        const g = spring({ frame: f - 3 - i * 3, fps, config: { damping: 14 } });
        const on = i === cur;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: left + x.from * W + 3, top: barTop, width: (x.to - x.from) * W - 6, height: barH, borderRadius: 18, background: x.color,
              opacity: (cur < 0 || i <= cur ? 1 : 0.35) * g, transform: `scaleY(${g * (on ? 1.12 : 1)})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#0b0d20', boxShadow: on ? `0 0 30px ${x.color}` : undefined, whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            {x.name}
          </div>
        );
      })}
      {spec.music.map((m, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', top: laneTop - 46, left: left + ((m.from + m.to) / 2) * W, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 28, fontWeight: 800, color: m.silent ? '#ff8a8a' : 'rgba(255,255,255,0.75)',
          }}
        >
          {m.silent ? '🔇 ' : '🎵 '}
          {m.name}
        </div>
      ))}
      {Array.from({ length: bars }, (_, k) => {
        const x = (k + 0.5) / bars;
        const m = spec.music.find((s) => x >= s.from && x < s.to) ?? spec.music[spec.music.length - 1];
        const played = x <= head;
        const amp = m.silent ? 0.05 : played ? 0.3 + 0.7 * Math.abs(Math.sin(f / 3.2 + k * 0.85)) * (0.6 + 0.4 * Math.sin(k * 2.3)) : 0.22;
        const hh = Math.max(6, amp * laneH);
        return (
          <div
            key={k}
            style={{
              position: 'absolute', left: left + (k / bars) * W + 2, width: W / bars - 4, top: laneTop + (laneH - hh) / 2, height: hh, borderRadius: 3,
              background: m.silent ? 'rgba(255,107,107,0.85)' : played ? theme.accent : 'rgba(255,255,255,0.25)',
            }}
          />
        );
      })}
      {cur >= 0 && <div style={{ position: 'absolute', left: left + head * W - 2, top: barTop - 22, width: 4, height: laneTop + laneH - barTop + 40, background: '#fff', boxShadow: '0 0 16px #fff' }} />}
      {a && (
        <div
          style={{
            position: 'absolute', left: 80, top: 760, width: 920, height: 260, boxSizing: 'border-box', padding: '26px 34px', borderRadius: 30,
            background: 'rgba(255,255,255,0.06)', border: `3px solid ${a.color}`, display: 'flex', gap: 28, alignItems: 'center',
            transform: `translateY(${(1 - card) * 40}px) scale(${0.92 + 0.08 * card})`, opacity: Math.min(1, card * 1.5),
          }}
        >
          <div style={{ fontSize: 96 }}>{a.icon}</div>
          <div>
            <div style={{ fontSize: 56, fontWeight: 900, color: a.color, lineHeight: 1.1 }}>{a.name}</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginTop: 8 }}>{a.job}</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Calc: React.FC<{ spec: Extract<MotionSpec, { type: 'calc' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  const fmt = (v: number, r: (typeof spec.rows)[number]) => {
    const [i, d] = v.toFixed(r.decimals).split('.');
    const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, r.group);
    return `${r.prefix}${d ? g + r.dec + d : g}${r.suffix}`;
  };
  const stamp = spring({ frame: f - spec.stampAt, fps, config: { damping: 9, mass: 0.8, stiffness: 200 } });
  const rowTop = 400, row = 140;
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: 'absolute', left: 40, top: 290, width: 1000, height: 770, ...panel(theme) }} />
      <div style={{ position: 'absolute', left: 90, top: 322, fontFamily: mono, fontSize: 28, color: theme.accent }}>{spec.label}</div>
      {spec.rows.map((r, i) => {
        const p = spring({ frame: f - r.at, fps, config: { damping: 14 } });
        const v = interpolate(f, [r.at, r.at + 20], [0, r.value], { ...clamp, easing: Easing.out(Easing.cubic) });
        const last = i === spec.rows.length - 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: 90, right: 90, top: rowTop + i * row, height: 110, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -50}px)`, borderBottom: last ? 'none' : '2px dashed rgba(255,255,255,0.14)',
            }}
          >
            <span style={{ fontSize: 42, fontWeight: 700, color: 'rgba(255,255,255,0.82)' }}>{r.label}</span>
            <span style={{ fontFamily: mono, fontSize: last ? 88 : 72, fontWeight: 800, color: last ? theme.accent : '#fff' }}>{fmt(v, r)}</span>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute', left: 540, top: 925, transform: `translate(-50%, -50%) rotate(-6deg) scale(${1 + 1.4 * (1 - stamp)})`, opacity: Math.min(1, stamp * 2),
          padding: '14px 44px', borderRadius: 18, border: '7px solid #ff5d5d', color: '#ff6b6b', background: 'rgba(255,93,93,0.1)',
          fontSize: 66, fontWeight: 900, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: '0 0 40px rgba(255,93,93,0.35)',
        }}
      >
        {spec.stamp}
      </div>
    </AbsoluteFill>
  );
};

/** One status line, wrapping by group (a narrow terminal also breaks right at the │ separators). */
const StatusRow: React.FC<{ groups: StatusSpan[][]; size: number; focus?: number; dimOthers?: number }> = ({ groups, size, focus = -1, dimOthers = 0 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.6, rowGap: size * 0.35, fontFamily: mono, fontSize: size, lineHeight: 1.25 }}>
    {groups.map((g, i) => (
      <span
        key={i}
        style={{
          whiteSpace: 'pre', borderRadius: 10, padding: '2px 8px', margin: '0 -8px', opacity: focus >= 0 && i !== focus ? 1 - dimOthers : 1,
          background: i === focus ? 'rgba(255,255,255,0.12)' : undefined, boxShadow: i === focus ? '0 0 0 2px rgba(255,255,255,0.35)' : undefined,
        }}
      >
        {g.map((sp, k) => (
          <span key={k} style={{ color: sp.c }}>{sp.t}</span>
        ))}
        {i < groups.length - 1 && <span style={{ color: '#5c6178' }}>{'  │'}</span>}
      </span>
    ))}
  </div>
);

const StatusLine: React.FC<{ spec: Extract<MotionSpec, { type: 'statusline' }>; theme: MotionTheme }> = ({ spec, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16 } });
  let si = 0;
  spec.states.forEach((s, i) => { if (f >= s.at) si = i; });
  const st = spec.states[si];
  const prev = spec.states[Math.max(0, si - 1)];
  const hit = spring({ frame: f - st.at, fps, config: { damping: 10, mass: 0.7 } });
  const cursor = Math.floor(f / 15) % 2 === 0;

  const claudeWindow = (top: number, size: number, focus = -1, input = true) => (
    <>
      <div style={{ position: 'absolute', left: 40, top: 290, width: 1000, height: 770, ...panel(theme) }} />
      <div style={{ position: 'absolute', left: 80, top: 318, right: 80, display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 28 }}>
        <span style={{ color: '#f0a07a', fontWeight: 800 }}>✻ Claude Code</span>
        <span style={{ color: theme.accent }}>{spec.label}</span>
      </div>
      {input && <div style={{ position: 'absolute', left: 80, right: 80, top: top - 96, height: 72, borderRadius: 14, border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', padding: '0 22px', fontFamily: mono, fontSize: 32, color: '#fff' }}>
        {'> '}
        <span style={{ display: 'inline-block', width: 18, height: 34, marginLeft: 6, background: cursor ? '#fff' : 'transparent' }} />
      </div>}
      <div style={{ position: 'absolute', left: 92, right: 80, top }}>
        <StatusRow groups={st.groups} size={size} focus={focus} dimOthers={focus >= 0 ? 0.7 : 0} />
      </div>
    </>
  );

  if (spec.mode === 'quota') {
    const q = st.quota;
    const from = prev.quota?.left ?? q?.left ?? 0;
    const left = q ? interpolate(f, [st.at, st.at + 12], [si === 0 ? q.left : from, q.left], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
    const danger = q ? q.left <= 10 : false;
    const shake = danger ? Math.sin(f * 2.1) * 9 * Math.max(0, 1 - (f - st.at) / 24) : 0;
    return (
      <AbsoluteFill style={{ opacity: enter }}>
        {claudeWindow(500, 30)}
        {q && (
          <div style={{ position: 'absolute', left: 80, right: 80, top: 720, transform: `translateX(${shake}px)` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
              <span style={{ fontFamily: mono, fontSize: 44, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>⚡ 5h</span>
              <span style={{ fontFamily: mono, fontSize: 150, fontWeight: 900, color: q.color, lineHeight: 1, textShadow: `0 0 ${20 + 30 * hit}px ${q.color}`, transform: `scale(${1 + 0.12 * (1 - hit)})`, display: 'inline-block' }}>
                {Math.round(left)}%
              </span>
              <span style={{ fontFamily: mono, fontSize: 40, color: 'rgba(255,255,255,0.7)' }}>left</span>
            </div>
            <div style={{ marginTop: 26, height: 30, borderRadius: 15, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ width: `${left}%`, height: '100%', borderRadius: 15, background: q.color, boxShadow: `0 0 24px ${q.color}` }} />
            </div>
            <div style={{ marginTop: 20, fontFamily: mono, fontSize: 36, color: '#67e8f9' }}>↻ {q.reset}</div>
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // explain: the group being explained is lit, the others dim.
  let focus = -1;
  spec.rows.forEach((r, i) => { if (f >= r.at) focus = i; });
  const rowTop = 610, rowH = 72;
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      {claudeWindow(392, 27, focus, false)}
      {spec.rows.map((r, i) => {
        const p = spring({ frame: f - r.at, fps, config: { damping: 14 } });
        const g = st.groups[i] ?? [];
        const icon = g[0]?.t.trim().split(' ')[0] ?? '•';
        const color = g.find((sp) => sp.t.trim())?.c ?? '#fff';
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: 80, right: 80, top: rowTop + i * rowH, height: rowH - 10, display: 'flex', alignItems: 'center', gap: 22,
              opacity: Math.min(1, p * 1.5) * (i === focus ? 1 : 0.55), transform: `translateX(${(1 - p) * -50}px)`,
            }}
          >
            <span style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.08)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 36, color }}>{icon}</span>
            <span style={{ fontSize: 42, fontWeight: 800, color: '#fff' }}>{r.label}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
