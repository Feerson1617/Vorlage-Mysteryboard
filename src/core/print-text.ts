/** Preserve offsets in the source string. Nonbreaking spaces stay inside words. */
export function printTextBreaks(text: string) {
  const words: number[] = [];
  const paragraphs: number[] = [];
  for (const match of text.matchAll(/[ \t\r\n\f\v\u2028\u2029]+/g)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start === 0 || end === text.length) continue;
    words.push(end);
    if (/(?:\r?\n)[\t ]*(?:\r?\n)|\u2029/.test(match[0])) paragraphs.push(end);
  }
  words.push(text.length);
  return { words, paragraphs };
}

export function graphemeBreaks(text: string, from: number, to: number) {
  const segmenter = new Intl.Segmenter("de", { granularity: "grapheme" });
  return [...segmenter.segment(text.slice(from, to))].map(
    ({ index, segment }) => from + index + segment.length,
  );
}
