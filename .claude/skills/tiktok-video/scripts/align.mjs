// Ghép timing của whisper vào CHỮ GỐC trong script.json.
//
// Vì sao cần: whisper tiếng Việt sai dấu thường xuyên ("ngứa mồm" → "ngưa mom").
// Chữ sai đập thẳng vào mặt người xem. Nhưng ta ĐÃ BIẾT chữ đúng — nó nằm trong
// scene.voiceover. Nên whisper chỉ đóng góp THỜI ĐIỂM, không đóng góp CHỮ.
//
// Cái khó: shoot.md dặn user "đừng học thuộc lòng, nói bằng lời của mình",
// nên lời nói thật sẽ lệch kịch bản. So khớp cứng là hỏng. Dùng Needleman-Wunsch
// trên chuỗi ĐÃ BỎ DẤU để chịu được cả sai dấu lẫn nói thêm/nói thiếu.
//
// Self-test: node align.mjs --test

import { norm, tokenize } from './lib.mjs';

const MATCH = 3;
const NEAR = 1;
const MISMATCH = -2;
const GAP = -1;

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

const similarity = (a, b) => {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
};

const score = (a, b) => {
  if (a === b) return MATCH;
  return similarity(a, b) >= 0.6 ? NEAR : MISMATCH;
};

/**
 * @param {string} voiceover  lời thoại gốc từ script.json (nguồn chân lý cho CHỮ)
 * @param {{text:string,startMs:number,endMs:number}[]} heard  token whisper (nguồn chân lý cho THỜI ĐIỂM)
 * @param {number} durationMs độ dài scene, để nội suy hai đầu
 * @returns {{words:{text:string,startMs:number,endMs:number}[], matchRatio:number, mode:string}}
 */
export const alignWords = (voiceover, heard, durationMs) => {
  const script = tokenize(voiceover);
  if (script.length === 0) return { words: [], matchRatio: 0, mode: 'empty' };
  if (!heard || heard.length === 0) {
    return { ...evenDistribution(voiceover, durationMs), mode: 'fallback-no-audio' };
  }

  const A = script.map(norm);
  const B = heard.map((h) => norm(h.text));

  // --- Needleman-Wunsch ---
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + score(A[i - 1], B[j - 1]),
        dp[i - 1][j] + GAP,
        dp[i][j - 1] + GAP,
      );
    }
  }

  // --- truy vết ---
  const out = [];
  let matches = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + score(A[i - 1], B[j - 1])) {
      const good = score(A[i - 1], B[j - 1]) > MISMATCH;
      if (good) matches++;
      // CHỮ lấy từ script, THỜI ĐIỂM lấy từ whisper
      out.push({
        text: script[i - 1],
        startMs: good ? heard[j - 1].startMs : null,
        endMs: good ? heard[j - 1].endMs : null,
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      // whisper không nghe ra từ này — vẫn hiển thị, nội suy thời điểm sau
      out.push({ text: script[i - 1], startMs: null, endMs: null });
      i--;
    } else {
      // user nói thêm từ ngoài kịch bản — KHÔNG đưa lên phụ đề: chữ whisper tiếng Việt sai dấu
      // ("chưa kịp" → "chức hiệp"), mà luật là chữ trên màn hình chỉ lấy từ voiceover.
      j--;
    }
  }
  out.reverse();

  const matchRatio = matches / script.length;
  if (matchRatio < 0.4) {
    // Nghe ra quá ít — có thể sai file, sai ngôn ngữ, hoặc tiếng ồn quá lớn.
    // Chia đều còn hơn hiện chữ lệch nhịp hoàn toàn.
    return { ...evenDistribution(voiceover, durationMs), matchRatio, mode: 'fallback-low-match' };
  }

  return { words: interpolateGaps(out, durationMs), matchRatio, mode: 'aligned' };
};

/** Điền thời điểm cho các từ whisper không nghe ra, bằng cách chia đều giữa hai mốc đã biết */
const interpolateGaps = (words, durationMs) => {
  const out = words.map((w) => ({ ...w }));

  // hai đầu: neo vào 0 và durationMs
  let firstKnown = out.findIndex((w) => w.startMs !== null);
  if (firstKnown === -1) return evenDistribution(out.map((w) => w.text).join(' '), durationMs).words;
  let lastKnown = out.length - 1;
  while (lastKnown >= 0 && out[lastKnown].endMs === null) lastKnown--;

  for (let k = 0; k < firstKnown; k++) {
    const span = out[firstKnown].startMs / (firstKnown + 1);
    out[k].startMs = Math.round(span * k);
    out[k].endMs = Math.round(span * (k + 1));
  }
  for (let k = lastKnown + 1; k < out.length; k++) {
    const remain = Math.max(durationMs - out[lastKnown].endMs, (out.length - lastKnown) * 120);
    const span = remain / (out.length - lastKnown);
    out[k].startMs = Math.round(out[lastKnown].endMs + span * (k - lastKnown - 1));
    out[k].endMs = Math.round(out[lastKnown].endMs + span * (k - lastKnown));
  }

  // khoảng trống ở giữa
  let k = firstKnown;
  while (k < out.length) {
    if (out[k].startMs !== null) {
      k++;
      continue;
    }
    let end = k;
    while (end < out.length && out[end].startMs === null) end++;
    const from = out[k - 1].endMs;
    const to = end < out.length ? out[end].startMs : durationMs;
    const span = (to - from) / (end - k + 1);
    for (let q = k; q < end; q++) {
      out[q].startMs = Math.round(from + span * (q - k));
      out[q].endMs = Math.round(from + span * (q - k + 1));
    }
    k = end;
  }

  // đảm bảo đơn điệu tăng, không đè nhau
  for (let q = 1; q < out.length; q++) {
    if (out[q].startMs < out[q - 1].endMs) out[q].startMs = out[q - 1].endMs;
    if (out[q].endMs <= out[q].startMs) out[q].endMs = out[q].startMs + 60;
  }

  return out;
};

/**
 * Gộp token whisper thành từ. Với tokenLevelTimestamps, whisper.cpp cắt tiếng Việt thành
 * mảnh BPE: " nh" + "ẹ" + "o", "H" + "ôm". Token không mở đầu bằng khoảng trắng là phần nối
 * của từ trước. Không gộp thì aligner coi mỗi mảnh là một từ nói thêm và matchRatio tụt thảm.
 */
export const mergeSubwordTokens = (tokens) => {
  const words = [];
  for (const t of tokens) {
    const prev = words.at(-1);
    if (prev && !/^\s/.test(t.text)) {
      prev.text += t.text;
      prev.endMs = Math.max(prev.endMs, t.endMs);
    } else {
      words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    }
  }
  return words.filter((w) => norm(w.text).length > 0);
};

/** Phương án chót: chia đều thời lượng cho số từ. Kém tự nhiên nhưng KHÔNG BAO GIỜ sai chữ. */
export const evenDistribution = (voiceover, durationMs) => {
  const words = tokenize(voiceover);
  const span = durationMs / Math.max(1, words.length);
  return {
    words: words.map((text, i) => ({
      text,
      startMs: Math.round(span * i),
      endMs: Math.round(span * (i + 1)),
    })),
    matchRatio: 0,
    mode: 'fallback-even',
  };
};

// ---------------------------------------------------------------- self-test
if (process.argv.includes('--test')) {
  let pass = 0;
  let failed = 0;
  const check = (name, cond, detail = '') => {
    if (cond) {
      pass++;
      console.log(`  ok   ${name}`);
    } else {
      failed++;
      console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };
  const w = (text, startMs, endMs) => ({ text, startMs, endMs });

  console.log('\n1. Khớp hoàn hảo');
  {
    const r = alignWords('Không cà khịa rất ngứa mồm', [
      w('Không', 0, 300), w('cà', 300, 500), w('khịa', 500, 800),
      w('rất', 800, 1000), w('ngứa', 1000, 1300), w('mồm', 1300, 1600),
    ], 1600);
    check('đủ 6 từ', r.words.length === 6, `được ${r.words.length}`);
    check('mode aligned', r.mode === 'aligned', r.mode);
    check('timing giữ nguyên', r.words[4].startMs === 1000);
  }

  console.log('\n2. Whisper mất dấu — CHỮ phải lấy từ script (đây là ca quan trọng nhất)');
  {
    const r = alignWords('Không cà khịa rất ngứa mồm', [
      w('Khong', 0, 300), w('ca', 300, 500), w('khia', 500, 800),
      w('rat', 800, 1000), w('ngua', 1000, 1300), w('mom', 1300, 1600),
    ], 1600);
    const text = r.words.map((x) => x.text).join(' ');
    check('hiển thị đúng dấu', text === 'Không cà khịa rất ngứa mồm', text);
    check('vẫn nhận là aligned', r.mode === 'aligned', r.mode);
    check('matchRatio = 1', r.matchRatio === 1, String(r.matchRatio));
  }

  console.log('\n3. User nói thêm từ ngoài kịch bản');
  {
    const r = alignWords('Code tháng Ba tháng Chín ngồi chê', [
      w('Code', 0, 200), w('tháng', 200, 400), w('Ba', 400, 600),
      w('à', 600, 700),
      w('tháng', 700, 900), w('Chín', 900, 1100), w('ngồi', 1100, 1300), w('chê', 1300, 1500),
    ], 1500);
    const text = r.words.map((x) => x.text).join(' ');
    check('không hiện từ nói thêm (chữ whisper)', !text.split(' ').includes('à'), text);
    check('"tháng" thứ hai lấy timing sau từ nói thêm', r.words[3].startMs === 700, JSON.stringify(r.words[3]));
    check('không mất từ nào của script', ['Code', 'tháng', 'Ba', 'Chín', 'ngồi', 'chê'].every((t) => text.includes(t)), text);
  }

  console.log('\n4. Whisper bỏ sót từ — phải nội suy, không được mất chữ');
  {
    const r = alignWords('Nhân chi sơ tính bản thiện', [
      w('Nhân', 0, 300), w('sơ', 600, 900), w('thiện', 1400, 1800),
    ], 1800);
    check('đủ 6 từ', r.words.length === 6, `được ${r.words.length}`);
    check('không từ nào thiếu timing', r.words.every((x) => Number.isFinite(x.startMs) && Number.isFinite(x.endMs)));
    check('thời điểm tăng dần', r.words.every((x, i, a) => i === 0 || x.startMs >= a[i - 1].startMs));
    check('"chi" nằm giữa Nhân và sơ', r.words[1].startMs >= 300 && r.words[1].endMs <= 600, JSON.stringify(r.words[1]));
  }

  console.log('\n5. Whisper trả rác — phải rơi về fallback chia đều');
  {
    const r = alignWords('Nhân chi sơ tính bản thiện', [
      w('hello', 0, 300), w('world', 300, 600), w('foo', 600, 900),
    ], 1800);
    check('mode fallback', r.mode.startsWith('fallback'), r.mode);
    check('vẫn đủ 6 từ đúng chữ', r.words.map((x) => x.text).join(' ') === 'Nhân chi sơ tính bản thiện');
    check('phủ hết thời lượng', r.words[5].endMs === 1800, String(r.words[5].endMs));
  }

  console.log('\n6. Không có audio');
  {
    const r = alignWords('một hai ba', [], 900);
    check('mode fallback-no-audio', r.mode === 'fallback-no-audio', r.mode);
    check('chia đều 300ms', r.words[1].startMs === 300 && r.words[1].endMs === 600, JSON.stringify(r.words[1]));
  }

  console.log('\n7. Token BPE của whisper — phải gộp thành từ rồi mới align');
  {
    const heard = mergeSubwordTokens([
      w('M', 760, 800), w('à', 800, 900), w(' tôi', 900, 1200),
      w(' nh', 1300, 1400), w('ẹ', 1400, 1500), w('o', 1500, 1600), w(' th', 1700, 1800), w('ật', 1800, 2000),
      w('.', 2000, 2050),
    ]);
    check('gộp thành 4 từ', heard.length === 4, heard.map((x) => x.text).join('|'));
    check('từ gộp giữ start mảnh đầu, end mảnh cuối', heard[2].startMs === 1300 && heard[2].endMs === 1600, JSON.stringify(heard[2]));
    const r = alignWords('Mà tôi nghèo thật.', heard, 2100);
    check('không rơi về fallback', r.mode === 'aligned', r.mode);
    check('chữ đúng kịch bản', r.words.map((x) => x.text).join(' ') === 'Mà tôi nghèo thật.', r.words.map((x) => x.text).join(' '));
  }

  console.log(`\n${pass} pass, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
}
