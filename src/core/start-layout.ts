import type { CardState } from "./model";

// Pure geometry: no content categories, prefixes, themes or persisted UI state.
export function orderedPositions(
  cards: CardState[],
  heights: Map<number, number>,
  viewport: { width: number; height: number },
  gap: number,
  columns?: number,
): CardState[] {
  const ordered = [...cards].sort((a, b) => a.id - b.id);
  const arrange = (count: number) => {
    let y = 0;
    const result: CardState[] = [];
    for (let i = 0; i < ordered.length; i += count) {
      const row = ordered.slice(i, i + count);
      result.push(
        ...row.map((card, x) => ({ ...card, x: x * (300 + gap), y })),
      );
      y += Math.max(...row.map((c) => heights.get(c.id)!)) + gap;
    }
    return {
      cards: result,
      width: Math.min(count, cards.length) * (300 + gap),
      height: y,
    };
  };
  if (columns) return arrange(columns).cards;
  const aspect = Math.max(
    0.2,
    Math.min(5, viewport.width / Math.max(1, viewport.height)),
  );
  let best = arrange(1),
    error = Infinity;
  for (let n = 1; n <= Math.min(12, cards.length); n++) {
    const candidate = arrange(n);
    const mismatch = Math.abs(
      Math.log(candidate.width / candidate.height / aspect),
    );
    if (mismatch < error) {
      best = candidate;
      error = mismatch;
    }
  }
  return best.cards;
}
