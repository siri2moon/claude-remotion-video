#!/usr/bin/env node
// Audition ElevenLabs voices on one line so you can pick before committing to a video.
//   node voice-try.mjs --vi="<câu tiếng Việt>" [--en="<English line>"] [--voices=id:name,id:name,…] [--model=eleven_v3]
// Writes content/_assets/voice-try/<lang>-<name>.mp3 for each voice, plus <lang>-montage.mp3:
// every take back to back with a 0.7s gap, so one file lets you compare them all.
// Default voices = a shortlist of the built-in premade voices (the only ones a Free plan can use via the API).
// Library voices (e.g. the Vietnamese ones) need a paid plan; pass their ids with --voices once you are on one.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, durationOf, info, loadEnv, ok, sh } from './lib.mjs';

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

// Premade voices that suit short, punchy narration. Free plan can use all of these.
const DEFAULT = [
  'JBFqnCBsd6RMkjVDRZzb:George-storyteller',
  'nPczCjzI2devNBz1zQrb:Brian-deep',
  'TX3LPaxmHKxFdv7VOQHJ:Liam-energetic',
  'iP95p4xoKVk53GoZ742B:Chris-charming',
  'cgSgspJ2msm6clMCkdW9:Jessica-playful',
  'FGY2WhTYpPnrIDTdsKH5:Laura-quirky',
];

const vi = arg('vi');
const en = arg('en');
if (!vi && !en) die('cần --vi="…" và/hoặc --en="…" (câu để đọc thử)');
const model = arg('model') ?? 'eleven_v3';
const voices = (arg('voices') ?? DEFAULT.join(',')).split(',').map((s) => {
  const [id, name] = s.split(':');
  return { id, name: name ?? id.slice(0, 8) };
});

const env = loadEnv();
if (!env.ELEVENLABS_API_KEY) die('thiếu ELEVENLABS_API_KEY trong .env');
const out = join(contentDir('_assets'), 'voice-try');
mkdirSync(out, { recursive: true });

const say = async (voice, text, file) => {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!r.ok) die(`ElevenLabs ${r.status} cho ${voice.name}: ${(await r.text()).slice(0, 200)}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return durationOf(file);
};

for (const [lang, text] of [['vi', vi], ['en', en]]) {
  if (!text) continue;
  const files = [];
  for (const v of voices) {
    const file = join(out, `${lang}-${v.name}.mp3`);
    const s = await say(v, text, file);
    info(`${lang}-${v.name}.mp3 · ${s.toFixed(2)}s`);
    files.push(file);
  }
  // 0.7s silence between takes, so the montage is easy to scrub.
  const gap = join(out, 'gap.mp3');
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.7', gap]);
  const list = join(out, `${lang}-list.txt`);
  writeFileSync(list, files.flatMap((f) => [`file '${f}'`, `file '${gap}'`]).join('\n') + '\n');
  const montage = join(out, `${lang}-montage.mp3`);
  // Re-encode instead of copy: the takes are VBR mp3s with different headers, and a stream copy glitches at the joins.
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ar', '44100', '-b:a', '128k', montage]);
  ok(`${lang}: ${voices.length} giọng → _assets/voice-try/${lang}-montage.mp3 (thứ tự: ${voices.map((v) => v.name).join(' · ')})`);
}
