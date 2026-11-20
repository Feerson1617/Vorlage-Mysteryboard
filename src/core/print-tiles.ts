import type { Bounds } from "./layout";

type CardBox = Bounds & { id: number };
type Tile = Bounds & { row: number; column: number; cards: number[] };

/** Occupied windows only. Each assigned card fits entirely inside its window. */
export function overviewTiles(
  cards: CardBox[],
  board: Bounds,
  width: number,
  height: number,
) {
  const widest = Math.max(...cards.map((card) => card.width));
  const tallest = Math.max(...cards.map((card) => card.height));
  width = Math.max(width, widest + 40);
  height = Math.max(height, tallest + 40);
  const stepX = width - widest;
  const stepY = height - tallest;
  const tiles = new Map<string, Tile>();
  for (const card of cards) {
    const column = Math.floor(Math.max(0, card.x - board.x) / stepX);
    const row = Math.floor(Math.max(0, card.y - board.y) / stepY);
    const key = `${row}:${column}`;
    const existing = tiles.get(key);
    if (existing) existing.cards.push(card.id);
    else
      tiles.set(key, {
        row,
        column,
        cards: [card.id],
        x: board.x + column * stepX,
        y: board.y + row * stepY,
        width,
        height,
      });
  }
  return [...tiles.values()].sort(
    (a, b) => a.row - b.row || a.column - b.column,
  );
}
