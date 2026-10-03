#!/usr/bin/env node
// Cài đặt một lần: venv Python cho TTS + mflux cho sinh ảnh.
// Dùng: node setup.mjs [--check]
//
// Cả hai đều chạy hoàn toàn trên máy, không cần API key, không tốn tiền.
// Đổi lại là một lần tải nặng: model sinh ảnh khoảng 10GB.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, die, hasFlag, info, ok, toolDir, venvPython, warn } from './lib.mjs';

const check = hasFlag('check');
const has = (bin) => spawnSync('which', [bin], { encoding: 'utf8' }).status === 0;

const run = (cmd, args, label) => {
  info(`${label}…`);
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) die(`${label} thất bại`);
};

// --- Kiểm tra thứ phải có sẵn ------------------------------------------------

if (!has('ffmpeg')) die('thiếu ffmpeg. Cài bằng: brew install ffmpeg');
if (!has('uv')) die('thiếu uv. Cài bằng: brew install uv');

const py = venvPython();
const mflux = has('mflux-generate-z-image-turbo');
const venvOk = existsSync(py);

if (check) {
  console.log(`ffmpeg          ${has('ffmpeg') ? 'có' : 'THIẾU'}`);
  console.log(`uv              ${has('uv') ? 'có' : 'THIẾU'}`);
  console.log(`venv TTS        ${venvOk ? py : 'THIẾU — chạy setup.mjs'}`);
  console.log(`mflux           ${mflux ? 'có' : 'THIẾU — chạy setup.mjs'}`);
  if (venvOk) {
    const r = spawnSync(py, ['-c', 'import vieneu;print("vieneu ok")'], { encoding: 'utf8' });
    console.log(`vieneu          ${r.status === 0 ? 'nạp được' : 'LỖI: ' + (r.stderr ?? '').trim().split('\n').pop()}`);
  }
  process.exit(venvOk && mflux ? 0 : 1);
}

// --- 1. venv cho TTS ---------------------------------------------------------

mkdirSync(toolDir(), { recursive: true });

if (venvOk) {
  info('venv TTS đã có, bỏ qua');
} else {
  run('uv', ['venv', join(toolDir(), 'venv'), '--python', '3.11'], 'tạo venv Python 3.11');
}
run('uv', ['pip', 'install', '--python', py, '--upgrade', 'vieneu'], 'cài VieNeu-TTS');

// torch KHÔNG cần cho giọng dựng sẵn — đường ONNX chạy không có nó. Nhưng nhân
// bản giọng thì bắt buộc: bộ mã hoá giọng tham chiếu và bộ khử nhiễu đều là
// model torch. Đã thử denoise=False, vẫn cần. Nặng thêm khoảng 1GB.
if (hasFlag('no-clone')) {
  info('bỏ qua torch (--no-clone) — sẽ chỉ dùng được 14 giọng dựng sẵn');
} else {
  run('uv', ['pip', 'install', '--python', py, 'torch', 'torchaudio'], 'cài torch (cho nhân bản giọng)');
}

// --- 2. mflux cho sinh ảnh ---------------------------------------------------

if (mflux) info('mflux đã có, chỉ cập nhật');
run('uv', ['tool', 'install', '--upgrade', 'mflux'], 'cài mflux');

if (!has('mflux-generate-z-image-turbo')) {
  warn('mflux cài xong nhưng lệnh chưa nằm trong PATH.');
  warn('Thêm vào ~/.zshrc:  export PATH="$HOME/.local/bin:$PATH"');
}

ok('cài xong');
info('Model tải về lần đầu chạy thật: VieNeu-TTS ~300MB, Z-Image Turbo ~10GB.');
info(`Nhớ thêm .ai-story/ vào .gitignore (đã có sẵn nếu dùng repo này).`);
