import type { CardContent, CardState, Edge, Work, Mystery } from "./model";
import { cardNumber, initialWork } from "./model";
import { orderedPositions } from "./start-layout";
export const CARD_WIDTH = 300;
export type Layout = {
  title: string[];
  text: string[];
  height: number;
  imageY: number;
  numberLabel: string;
};
export type Bounds = { x: number; y: number; width: number; height: number };
let context: CanvasRenderingContext2D | null;
function measure(text: string, font: string) {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Dein Browser kann die Karten nicht zeichnen.");
  context.font = font;
  return context.measureText(text).width;
}
export function wrap(
  text: string,
  width: number,
  font = "16px Arial",
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (measure(line ? line + " " + word : word, font) <= width) {
        line = line ? line + " " + word : word;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const ch of word) {
        if (measure(line + ch, font) > width && line) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}
export function layoutCard(
  card: CardContent,
  numberLabel = String(card.id),
): Layout {
  const title = wrap(card.title, 264, "bold 18px Arial"),
    text = wrap(card.text, 264);
  const imageY = 24 + title.length * 24 + 12 + text.length * 22 + 12;
  return {
    title,
    text,
    numberLabel,
    imageY,
    height: Math.max(130, imageY + (card.image ? 110 : 0) + 18),
  };
}
export function numberBadge(zoom = 1, label = "") {
  // 16 CSS-px digits in ordinary overviews; cap world size at deep zoom-out.
  const scale = Math.max(1, Math.min(7, 16 / (18 * zoom)));
  const radius = Math.max(15, measure(label, "bold 18px Arial") / 2 + 5);
  return {
    scale,
    radius,
    fontSize: 18,
    offset: -((radius + 1) * scale + 4),
    extent: (2 * radius + 2) * scale + 4,
  };
}
export function boardBounds(
  work: Work,
  layouts: Map<number, Layout>,
  zoom = 1,
): Bounds {
  const extent = (c: CardState) =>
    numberBadge(zoom, layouts.get(c.id)!.numberLabel).extent;
  const labels = work.edges
    .filter((e) => e.label)
    .map((e) => edgeGeometry(e, work.cards, layouts));
  const left = Math.min(
    ...work.cards.map((c) => c.x - extent(c)),
    ...labels.map((g) => g.labelCenter.x - g.labelWidth / 2 - 8),
  );
  const top = Math.min(
    ...work.cards.map((c) => c.y - extent(c)),
    ...labels.map((g) => g.labelCenter.y - g.labelHeight / 2 - 8),
  );
  const right = Math.max(
    ...work.cards.map((c) => c.x + CARD_WIDTH + 24),
    ...labels.map((g) => g.labelCenter.x + g.labelWidth / 2 + 8),
  );
  const bottom = Math.max(
    ...work.cards.map((c) => c.y + layouts.get(c.id)!.height + 24),
    ...labels.map((g) => g.labelCenter.y + g.labelHeight / 2 + 8),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function overview(
  work: Work,
  layouts: Map<number, Layout>,
  width: number,
  height: number,
) {
  // Badge size depends on zoom. Solve the fit with its actual outer bounds.
  let low = 0.001,
    high = 1.2;
  for (let i = 0; i < 32; i++) {
    const z = (low + high) / 2;
    const b = boardBounds(work, layouts, z);
    if (b.width * z <= width - 64 && b.height * z <= height - 64) low = z;
    else high = z;
  }
  const b = boardBounds(work, layouts, low);
  return {
    x: (width - b.width * low) / 2 - b.x * low,
    y: (height - b.height * low) / 2 - b.y * low,
    z: low,
  };
}
export function makeLayouts(m: Mystery) {
  return new Map(
    m.cards.map((c) => [c.id, layoutCard(c, cardNumber(m, c.id))]),
  );
}
export function initialBoardWork(
  m: Mystery,
  viewport: { width: number; height: number },
): Work {
  const work = initialWork(m);
  if (m.startLayout?.mode !== "ordered") return work;
  const layouts = makeLayouts(m);
  // Reserve the largest capped number badge as well as a free connection gap.
  // This protects both multi-digit IDs and configurable prefixes at overview.
  const gap =
    Math.max(
      ...[...layouts.values()].map((l) => numberBadge(0, l.numberLabel).extent),
    ) + 64;
  work.cards = orderedPositions(
    work.cards,
    new Map([...layouts].map(([id, l]) => [id, l.height])),
    viewport,
    gap,
    m.startLayout.columns,
  );
  return work;
}
const labelCache = new Map<
  string,
  { labelLines: string[]; labelWidth: number; labelHeight: number }
>();
function labelLayout(label: string) {
  const cached = labelCache.get(label);
  if (cached) return cached;
  const labelLines = wrap(label, 210, "14px Arial");
  const result = {
    labelLines,
    labelWidth:
      Math.max(...labelLines.map((l) => measure(l, "14px Arial"))) + 16,
    labelHeight: labelLines.length * 18 + 10,
  };
  if (labelCache.size > 600) labelCache.clear();
  labelCache.set(label, result);
  return result;
}
export function edgeGeometry(
  e: Edge,
  cards: CardState[],
  layouts: Map<number, Layout>,
) {
  const a = cards.find((c) => c.id === e.from)!,
    b = cards.find((c) => c.id === e.to)!;
  const ah = layouts.get(a.id)!.height,
    bh = layouts.get(b.id)!.height;
  const ac = { x: a.x + CARD_WIDTH / 2, y: a.y + ah / 2 },
    bc = { x: b.x + CARD_WIDTH / 2, y: b.y + bh / 2 };
  const dx = bc.x - ac.x,
    dy = bc.y - ac.y;
  const exit = (cx: number, cy: number, h: number, sign: number) => {
    const t = Math.min(
      (CARD_WIDTH / 2 + 7) / Math.max(Math.abs(dx), 0.001),
      (h / 2 + 7) / Math.max(Math.abs(dy), 0.001),
    );
    return { x: cx + sign * dx * t, y: cy + sign * dy * t };
  };
  const start = exit(ac.x, ac.y, ah, 1),
    end = exit(bc.x, bc.y, bh, -1);
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    label = labelLayout(e.label);
  // Horizontal captions sit above the line so long text cannot hide the entire connector.
  const labelCenter = {
    x: middle.x,
    y:
      middle.y - (Math.abs(dx) > Math.abs(dy) ? label.labelHeight / 2 + 12 : 0),
  };
  return { start, end, middle, labelCenter, ...label };
}

// Shared contain geometry for SVG cards and Canvas exports, including SVGs
// without a viewBox. Both renderers use the image's intrinsic proportions.
export function fitImage(width: number, height: number, box: Bounds): Bounds {
  if (width <= 0 || height <= 0)
    throw new Error("Ein eingebettetes Bild hat keine gültigen Abmessungen.");
  const scale = Math.min(box.width / width, box.height / height);
  const fittedWidth = width * scale,
    fittedHeight = height * scale;
  return {
    x: box.x + (box.width - fittedWidth) / 2,
    y: box.y + (box.height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}
