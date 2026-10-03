/**
 * Tách text thành các đoạn, đánh dấu đoạn nào nằm trong danh sách highlight.
 * Ưu tiên cụm dài trước để "code anh" không bị "code" ăn mất.
 */
export const splitHighlights = (
  text: string,
  highlights: string[],
): Array<{ text: string; hl: boolean }> => {
  const marks = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  let parts: Array<{ text: string; hl: boolean }> = [{ text, hl: false }];

  for (const mark of marks) {
    const next: Array<{ text: string; hl: boolean }> = [];
    for (const part of parts) {
      if (part.hl) {
        next.push(part);
        continue;
      }
      let rest = part.text;
      let idx = rest.indexOf(mark);
      while (idx !== -1) {
        if (idx > 0) next.push({ text: rest.slice(0, idx), hl: false });
        next.push({ text: mark, hl: true });
        rest = rest.slice(idx + mark.length);
        idx = rest.indexOf(mark);
      }
      if (rest) next.push({ text: rest, hl: false });
    }
    parts = next;
  }

  return parts.filter((p) => p.text.length > 0);
};

export type WordUnit = { pieces: Array<{ text: string; hl: boolean }> };

/**
 * Như splitHighlights nhưng gom thêm theo từ, để hiện chữ lần lượt.
 *
 * Chỉ tách ở khoảng trắng, KHÔNG tách ở ranh giới highlight — nếu không thì
 * "ngứa mồm!" với highlight ["ngứa mồm"] sẽ đẩy dấu "!" thành một "từ" riêng và
 * nó bay vào màn hình muộn hơn phần còn lại, cách ra một khoảng trắng ma.
 */
export const splitWords = (text: string, highlights: string[]): WordUnit[] => {
  const units: WordUnit[] = [];
  let cur: WordUnit['pieces'] = [];
  const flush = () => {
    if (cur.length) units.push({ pieces: cur });
    cur = [];
  };

  for (const part of splitHighlights(text, highlights)) {
    for (const chunk of part.text.split(/(\s+)/)) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) flush();
      else cur.push({ text: chunk, hl: part.hl });
    }
  }
  flush();

  return units;
};
