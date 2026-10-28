#!/usr/bin/env node
// ElevenLabs narration per scene: `say` in short.json → content/<dir>/voice/<lang>-<scene>.mp3.
//   node narrate.mjs <slug>
// Runs only when short.json has a `narration` block; without it narration is off (the default) and the video keeps music + SFX only.
// Voices every language that has `say`, because scene length follows the longest line across languages (vi and en share one timeline).
// Cached by hash(text, voice, model, settings) in voice/manifest.json, so re-renders spend no credits.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentDir, die, durationOf, info, loadEnv, loadShort, ok, readJson, slugArg, writeJson } from './lib.mjs';

const dir = slugArg();
const short = loadShort(dir);
const n = short.narration;
if (!n) {
  info('giọng đọc: tắt (short.json không có "narration")');
  process.exit(0);
}

const env = loadEnv();
const LANGS = ['vi', 'en'];
const model = n.model ?? env.ELEVENLABS_MODEL ?? 'eleven_v3';
const settings = { stability: n.stability ?? 0.5, similarity_boost: n.similarity ?? 0.75, style: n.style ?? 0.3, use_speaker_boost: true, speed: n.speed ?? 1 };
const voiceFor = (lang) => n.voice?.[lang] ?? (typeof n.voice === 'string' ? n.voice : null) ?? env[`ELEVENLABS_VOICE_${lang.toUpperCase()}`];

// Lines to voice: `say` is a string (Vietnamese only) or { vi, en }.
const jobs = [];
for (const sc of short.scenes) {
  if (!sc.say) continue;
  for (const lang of LANGS) {
    const text = typeof sc.say === 'string' ? (lang === 'vi' ? sc.say : null) : sc.say[lang];
    if (text?.trim()) jobs.push({ id: sc.id, lang, text: text.trim() });
  }
}
if (jobs.length === 0) die('narration bật nhưng không cảnh nào có "say"');

const out = join(contentDir(dir), 'voice');
mkdirSync(out, { recursive: true });
const manifestFile = join(out, 'manifest.json');
const manifest = existsSync(manifestFile) ? readJson(manifestFile) : {};

const key = env.ELEVENLABS_API_KEY;
let made = 0;
for (const job of jobs) {
  const voice = voiceFor(job.lang);
  if (!voice) die(`thiếu giọng cho ${job.lang}: đặt narration.voice.${job.lang} trong short.json hoặc ELEVENLABS_VOICE_${job.lang.toUpperCase()} trong .env`);
  const hash = createHash('sha1').update(JSON.stringify({ text: job.text, voice, model, settings })).digest('hex').slice(0, 16);
  const name = `${job.lang}-${job.id}.mp3`;
  const entry = manifest[`${job.lang}/${job.id}`];
  if (entry?.hash === hash && existsSync(join(out, name))) continue;
  if (!key) die('thiếu ELEVENLABS_API_KEY: thêm vào file .env ở gốc dự án (xem .env.example)');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: job.text, model_id: model, voice_settings: settings, ...(job.lang && model !== 'eleven_v3' ? { language_code: job.lang } : {}) }),
  });
  if (!res.ok) die(`ElevenLabs ${res.status} cho cảnh "${job.id}" (${job.lang}): ${(await res.text()).slice(0, 300)}`);
  writeFileSync(join(out, name), Buffer.from(await res.arrayBuffer()));
  const seconds = durationOf(join(out, name));
  manifest[`${job.lang}/${job.id}`] = { hash, file: name, seconds: Math.round(seconds * 100) / 100 };
  writeJson(manifestFile, manifest);
  made++;
  info(`${name}: ${seconds.toFixed(2)}s · "${job.text.slice(0, 60)}${job.text.length > 60 ? '…' : ''}"`);
}
ok(`giọng đọc: ${jobs.length} câu (${made} mới, ${jobs.length - made} từ cache) · model ${model}`);
