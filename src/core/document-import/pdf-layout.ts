import { isCardHeading, type Block, type Card } from "./model";

export type Rect = { x: number; y: number; width: number; height: number };
export type PdfItem = Rect & { text: string; baseline: number; rotated?: true };
export type PdfGraphic = Rect & { raster: boolean };
export type PdfPage = {
  width: number;
  height: number;
  items: PdfItem[];
  graphics?: PdfGraphic[];
  reviewReasons?: string[];
};
export type PdfRegion = {
  id: number;
  cardId: number;
  page: number;
  bounds: Rect;
  strategy: "frame" | "heading" | "spatial" | "manual";
  graphic?: true;
  // Source rectangles rendered by PDF.js, including clipping, masks and labels.
  mediaBounds?: Rect[];
  wholeCardImage?: true;
};
export type PdfLayout = {
  pages: PdfPage[];
  regions: PdfRegion[];
  sections: Block[];
  uncertainPages: number[];
  unassignedGraphics?: { page: number; bounds: Rect }[];
};
export type Segment = { x1: number; y1: number; x2: number; y2: number };
type Matrix = number[];
const identity = [1, 0, 0, 1, 0, 0];
function multiply(a: Matrix, b: Matrix) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function point(t: Matrix, x: number, y: number) {
  return { x: t[0] * x + t[2] * y + t[4], y: t[1] * x + t[3] * y + t[5] };
}

// PDF.js 6 DrawOPS: only painted paths count, never clipping rectangles.
// Filled thin rectangles are how Word commonly writes shared table borders.
export function paintedSegments(
  ops: { fnArray: number[]; argsArray: any[] },
  view: Matrix,
  graphics: PdfGraphic[] = [],
  reasons: Set<string> = new Set(),
): Segment[] {
  const limit = () =>
    reasons.add(
      "Grafikanalyse begrenzt. Bitte die Seite am Original prüfen und bei Bedarf Bildausschnitte übernehmen.",
    );
  if (ops.fnArray.length > 100_000) {
    limit();
    return [];
  }
  let transform = identity;
  const stack: Matrix[] = [],
    out: Segment[] = [];
  const add = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (out.length >= 6000) {
      limit();
      return;
    }
    if (Math.hypot(a.x - b.x, a.y - b.y) > 2)
      out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  };
  const addGraphic = (points: { x: number; y: number }[], raster: boolean) => {
    if (graphics.length >= 6000) {
      limit();
      return;
    }
    if (points.length < 2) return;
    const xs = points.map(({ x }) => x),
      ys = points.map(({ y }) => y);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    const width = Math.max(...xs) - x,
      height = Math.max(...ys) - y;
    if (
      [x, y, width, height].every(Number.isFinite) &&
      width > 0 &&
      height > 0 &&
      (raster || Math.max(width, height) >= 4)
    )
      graphics.push({ x, y, width, height, raster });
  };
  const addImage = (matrix: Matrix) =>
    addGraphic(
      [
        point(matrix, 0, 0),
        point(matrix, 1, 0),
        point(matrix, 0, 1),
        point(matrix, 1, 1),
      ],
      true,
    );
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    if (fn === 10 || fn === 74 || fn === 76) {
      if (stack.length >= 256) {
        limit();
        return out;
      }
      stack.push(transform);
      if (fn === 74 && args?.[0]) transform = multiply(transform, args[0]);
    } else if (fn === 11 || fn === 75 || fn === 77)
      transform = stack.pop() ?? identity;
    else if (fn === 12) transform = multiply(transform, args);
    else if ([83, 85, 86, 90].includes(fn)) addImage(multiply(view, transform));
    else if (fn === 84 || fn === 87) {
      for (const image of (args[fn === 87 ? 1 : 0] ?? []).slice(0, 6000))
        if (image.transform)
          addImage(multiply(multiply(view, transform), image.transform));
    } else if (fn === 88 || fn === 89) {
      const [sx, b, c, sy, placements] =
        fn === 89 ? args.slice(1) : [args[1], 0, 0, args[2], args[3]];
      if (placements?.length > 12000) limit();
      for (let i = 0; i + 1 < (placements?.length ?? 0) && i < 12000; i += 2)
        addImage(
          multiply(multiply(view, transform), [
            sx,
            b,
            c,
            sy,
            placements[i],
            placements[i + 1],
          ]),
        );
    } else if (fn === 62 || (fn === 76 && args?.[0]?.smask)) {
      reasons.add("Schattierung oder Maske am Original vergleichen.");
    } else if (fn === 91 && args && args[0] >= 20 && args[0] <= 27) {
      const matrix = multiply(view, transform),
        data = args[1]?.[0];
      if (!data || data.length > 100_000) {
        limit();
        continue;
      }
      const points: { x: number; y: number }[] = [];
      let previous: { x: number; y: number } | undefined,
        first: typeof previous;
      const stroke = ![22, 23].includes(args[0]);
      for (let k = 0; k < data.length;) {
        const command = data[k++];
        if (command === 0 || command === 1) {
          const p = point(matrix, data[k++], data[k++]);
          points.push(p);
          if (command === 0) first = p;
          else if (previous && stroke) add(previous, p);
          previous = p;
        } else if (command === 4) {
          if (first && previous && stroke) add(previous, first);
          previous = first;
        } else if (command === 2) {
          for (let j = 0; j < 6; j += 2)
            points.push(point(matrix, data[k + j], data[k + j + 1]));
          k += 6;
          previous = undefined;
        } else if (command === 3) {
          for (let j = 0; j < 4; j += 2)
            points.push(point(matrix, data[k + j], data[k + j + 1]));
          k += 4;
          previous = undefined;
        } else break;
      }
      if (!stroke && points.length === 4) {
        const xs = points.map((p) => p.x),
          ys = points.map((p) => p.y),
          x = Math.min(...xs),
          y = Math.min(...ys),
          w = Math.max(...xs) - x,
          h = Math.max(...ys) - y;
        if (w <= 3 && h > 4)
          add({ x: x + w / 2, y }, { x: x + w / 2, y: y + h });
        else if (h <= 3 && w > 4)
          add({ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 });
      }
      addGraphic(points, false);
    }
  }
  return out;
}
export function coverage(graphic: Rect, region: Rect) {
  const width =
    Math.min(graphic.x + graphic.width, region.x + region.width) -
    Math.max(graphic.x, region.x);
  const height =
    Math.min(graphic.y + graphic.height, region.y + region.height) -
    Math.max(graphic.y, region.y);
  return (
    (Math.max(0, width) * Math.max(0, height)) /
    (graphic.width * graphic.height)
  );
}

function interiorArtwork(page: PdfPage, r: Rect) {
  return (page.graphics ?? []).filter(
    (g) =>
      coverage(g, r) >= 0.96 &&
      (g.raster ||
        (g.x > r.x + 1 &&
          g.y > r.y + 1 &&
          g.x + g.width < r.x + r.width - 1 &&
          g.y + g.height < r.y + r.height - 1)),
  );
}
function containsArtwork(page: PdfPage, r: Rect) {
  return interiorArtwork(page, r).length > 0;
}
function overlaps(a: Rect, b: Rect) {
  return coverage(a, b) > 0;
}
function cardArtwork(page: PdfPage, bounds: Rect, framed: boolean) {
  const items = page.items.filter((t) => inside(t, bounds));
  const artwork = interiorArtwork(page, bounds);
  if (!artwork.length && !items.some((t) => t.rotated)) return {};
  // With axes, overprinted labels, tiles or rotated text, rendering the entire
  // card is the only way to preserve the relationship between text and image.
  // A simple photo can instead accompany the editable caption and source.
  const rasters = artwork.filter((g) => g.raster);
  const separate =
    items.length &&
    rasters.length &&
    rasters.length <= 4 &&
    !items.some((t) => t.rotated) &&
    artwork.every(
      (g) =>
        g.raster ||
        rasters.some(
          (r) =>
            coverage(r, g) >= 0.97 &&
            g.width <= r.width + 10 &&
            g.height <= r.height + 10,
        ),
    ) &&
    rasters.every(
      (g, i) =>
        coverage(g, bounds) >= 0.999 &&
        !items.some((t) => overlaps(g, t)) &&
        !rasters.slice(i + 1).some((other) => overlaps(g, other)),
    );
  if (separate) return { graphic: true as const, mediaBounds: rasters };
  if (framed)
    return {
      graphic: true as const,
      mediaBounds: [bounds],
      wholeCardImage: true as const,
    };
  return {};
}

export function pdfItems(raw: any[], transform: Matrix): PdfItem[] {
  const seen = new Set<string>(),
    items: PdfItem[] = [];
  for (const it of raw) {
    if (typeof it.str !== "string" || !it.str.trim()) continue;
    const t = multiply(transform, it.transform),
      h = Math.max(1, Math.hypot(t[2], t[3])),
      w = Math.max(
        0.1,
        Math.abs(it.width) * Math.hypot(transform[0], transform[1]),
      );
    const norm = Math.hypot(t[0], t[1]) || 1;
    const dx = (w * t[0]) / norm,
      dy = (w * t[1]) / norm;
    const corners = [
      [t[4], t[5]],
      [t[4] + dx, t[5] + dy],
      [t[4] + t[2], t[5] + t[3]],
      [t[4] + dx + t[2], t[5] + dy + t[3]],
    ];
    const xs = corners.map((p) => p[0]),
      ys = corners.map((p) => p[1]);
    const p: PdfItem = {
      text: it.str,
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(0.1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      baseline: t[5],
      ...(Math.abs(t[1]) > norm * 0.05 || t[0] < 0 ? { rotated: true } : {}),
    };
    const key = [p.text, p.x.toFixed(2), p.y.toFixed(2), w.toFixed(2)].join(
      "|",
    );
    if (!seen.has(key)) {
      seen.add(key);
      items.push(p);
    }
  }
  return items;
}
export const isPdfHeading = (text: string) =>
  isCardHeading(text) ||
  /^(?:Karte|Card)\s+[A-Za-z](?:\s*[:.·–-].*|\s*)$/i.test(text.trim());
export function inside(item: PdfItem, r: Rect) {
  const x = item.x + item.width / 2,
    y = item.y + item.height / 2;
  return (
    x >= r.x - 0.25 &&
    x <= r.x + r.width + 0.25 &&
    y >= r.y - 0.25 &&
    y <= r.y + r.height + 0.25
  );
}
const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 12;

// First spatially separate fragments, then join actual words on one baseline.
// A large horizontal gap never joins two neighbouring cards into one line.
export function textLines(items: PdfItem[]): PdfItem[] {
  const bands: {
    items: PdfItem[];
    x: number;
    right: number;
    baseline: number;
    fontHeight: number;
  }[] = [];
  for (const item of [...items].sort(
    (a, b) => a.baseline - b.baseline || a.x - b.x,
  )) {
    const band = bands
      .slice(-16)
      .find(
        (b) =>
          Math.abs(b.baseline - item.baseline) <=
            Math.max(2, Math.max(b.fontHeight, item.height) * 0.75) &&
          Math.max(b.x - item.x - item.width, item.x - b.right) <=
            Math.max(8, item.height * 0.85),
      );
    if (band) {
      band.items.push(item);
      band.x = Math.min(band.x, item.x);
      band.right = Math.max(band.right, item.x + item.width);
      if (item.height > band.fontHeight) {
        band.baseline = item.baseline;
        band.fontHeight = item.height;
      }
    } else
      bands.push({
        items: [item],
        x: item.x,
        right: item.x + item.width,
        baseline: item.baseline,
        fontHeight: item.height,
      });
  }
  return bands
    .map((b) => {
      const tokens = b.items.sort((a, c) => a.x - c.x),
        y = Math.min(...tokens.map((t) => t.y));
      let text = "";
      tokens.forEach((t, i) => {
        const previous = tokens[i - 1];
        text +=
          (previous &&
          t.x - previous.x - previous.width > 1 &&
          !text.endsWith(" ") &&
          !t.text.startsWith(" ")
            ? " "
            : "") + t.text;
      });
      return {
        text,
        x: b.x,
        y,
        width: b.right - b.x,
        height: Math.max(...tokens.map((t) => t.y + t.height)) - y,
        baseline: b.baseline,
      };
    })
    .sort((a, b) => a.baseline - b.baseline || a.x - b.x);
}
export function textBlocks(
  items: PdfItem[],
  page: number,
  firstHeadingOnly = false,
): Block[] {
  const lines = textLines(items),
    blocks: Block[] = [];
  const gaps = lines
      .slice(1)
      .map((l, i) => l.baseline - lines[i].baseline)
      .filter((g) => g > 3 && g < 40),
    step = Math.min(median(gaps), median(lines.map((l) => l.height)) * 1.4);
  let last: PdfItem | undefined,
    lastHeading = false;
  for (const line of lines) {
    const heading =
        isPdfHeading(line.text) && (!firstHeadingOnly || blocks.length === 0),
      source = /^\s*(?:Quelle|Quellen|Source)\s*:/i.test(line.text);
    const separate =
      !last ||
      heading ||
      lastHeading ||
      source ||
      line.baseline - last.baseline >
        Math.max(step * 1.45, line.height * 1.8) ||
      Math.abs(line.baseline - last.baseline) < 2;
    if (separate)
      blocks.push({
        kind: heading ? "heading" : "paragraph",
        text: line.text.trim(),
        page,
        bounds: {
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
        },
      });
    else {
      const b = blocks.at(-1)!;
      b.text += " " + line.text.trim();
      const r = b.bounds!;
      r.width = Math.max(r.width, line.x + line.width - r.x);
      r.height = line.y + line.height - r.y;
    }
    last = line;
    lastHeading = heading;
  }
  return blocks;
}

type AxisLine = { at: number; start: number; end: number };
function axisLines(segments: Segment[], vertical: boolean): AxisLine[] {
  const candidates = segments
    .filter((s) => Math.abs(vertical ? s.x1 - s.x2 : s.y1 - s.y2) < 1.2)
    .map((s) => ({
      at: vertical ? (s.x1 + s.x2) / 2 : (s.y1 + s.y2) / 2,
      start: Math.min(vertical ? s.y1 : s.x1, vertical ? s.y2 : s.x2),
      end: Math.max(vertical ? s.y1 : s.x1, vertical ? s.y2 : s.x2),
    }))
    .sort((a, b) => a.at - b.at || a.start - b.start);
  const out: AxisLine[] = [];
  for (const line of candidates) {
    const old = out.find(
      (l) =>
        Math.abs(l.at - line.at) < 1.5 &&
        line.start <= l.end + 3 &&
        line.end >= l.start - 3,
    );
    if (old) {
      old.start = Math.min(old.start, line.start);
      old.end = Math.max(old.end, line.end);
    } else out.push({ ...line });
  }
  return out;
}
export function framedRegions(segments: Segment[], page: PdfPage): Rect[] {
  const hs = axisLines(segments, false),
    vs = axisLines(segments, true),
    found: Rect[] = [];
  if (hs.length > 500 || vs.length > 500) return [];
  for (const top of hs) {
    const posts = vs
      .filter(
        (v) =>
          v.at >= top.start - 2 &&
          v.at <= top.end + 2 &&
          v.start <= top.at + 3 &&
          v.end >= top.at + 20,
      )
      .sort((a, b) => a.at - b.at);
    for (let i = 0; i < posts.length - 1; i++) {
      const left = posts[i],
        right = posts[i + 1];
      if (right.at - left.at < 36) continue;
      const bottom = hs
        .filter(
          (h) =>
            h.at > top.at + 20 &&
            h.at <= Math.min(left.end, right.end) + 3 &&
            h.start <= left.at + 2 &&
            h.end >= right.at - 2,
        )
        .sort((a, b) => a.at - b.at)[0];
      if (!bottom) continue;
      const r = {
        x: left.at,
        y: top.at,
        width: right.at - left.at,
        height: bottom.at - top.at,
      };
      if (r.width > page.width * 0.98 || r.height > page.height * 0.98)
        continue;
      if (
        !found.some(
          (b) =>
            Math.abs(b.x - r.x) < 2 &&
            Math.abs(b.y - r.y) < 2 &&
            Math.abs(b.width - r.width) < 2 &&
            Math.abs(b.height - r.height) < 2,
        )
      )
        found.push(r);
      if (found.length > 1000) return [];
    }
  }
  // A table inside a framed card belongs to that outer card, not to additional
  // proposals. Empty cells and standalone shallow banners remain outside.
  let outer = found.filter(
    (r) =>
      !found.some(
        (b) =>
          b !== r &&
          b.x <= r.x + 1 &&
          b.y <= r.y + 1 &&
          b.x + b.width >= r.x + r.width - 1 &&
          b.y + b.height >= r.y + r.height - 1 &&
          b.width * b.height > r.width * r.height * 1.1,
      ),
  );
  if (outer.length > 1) outer = outer.filter((r) => r.width / r.height < 8);
  return outer.filter(
    (r) => page.items.some((t) => inside(t, r)) || containsArtwork(page, r),
  );
}
function columnCuts(
  heads: PdfItem[],
  items: PdfItem[],
  width: number,
): number[] {
  const sorted = [...heads].sort((a, b) => a.x - b.x),
    clusters: PdfItem[][] = [];
  for (const h of sorted) {
    const c = clusters.at(-1);
    if (c && h.x - c.at(-1)!.x < width * 0.16) c.push(h);
    else clusters.push([h]);
  }
  if (clusters.length > 6) return [];
  const cuts: number[] = [];
  for (let i = 1; i < clusters.length; i++) {
    const from = Math.max(...clusters[i - 1].map((h) => h.x + h.width)) + 1,
      to = Math.min(...clusters[i].map((h) => h.x)) - 1;
    if (to <= from) continue;
    const scores: { x: number; score: number }[] = [];
    const top = Math.min(...heads.map((h) => h.y));
    for (let x = from; x <= to; x += 1)
      scores.push({
        x,
        score: items.filter((t) => t.x < x && t.x + t.width > x && t.y >= top)
          .length,
      });
    const minimum = Math.min(...scores.map((s) => s.score));
    let run: number[] = [],
      best: number[] = [];
    for (const s of scores) {
      if (s.score === minimum) {
        run.push(s.x);
        if (run.length > best.length) best = [...run];
      } else run = [];
    }
    cuts.push(best.length ? (best[0] + best.at(-1)!) / 2 : (from + to) / 2);
  }
  return cuts;
}
export function headingRegions(page: PdfPage): Rect[] {
  const heads = textLines(page.items).filter((l) => isPdfHeading(l.text));
  if (!heads.length) return [];
  const cuts = [0, ...columnCuts(heads, page.items, page.width), page.width],
    out: Rect[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const left = cuts[i],
      right = cuts[i + 1],
      column = heads
        .filter((h) => h.x + h.width / 2 >= left && h.x + h.width / 2 < right)
        .sort((a, b) => a.y - b.y);
    for (let j = 0; j < column.length; j++)
      out.push({
        x: left + 0.5,
        y: Math.max(0, column[j].y - 2),
        width: right - left - 1,
        height: (column[j + 1]?.y ?? page.height - 10) - column[j].y - 2,
      });
  }
  return out;
}
export function spatialRegions(page: PdfPage): Rect[] {
  const lines = textLines(page.items);
  if (!lines.length) return [];
  // Unlabelled whitespace grouping is deliberately conservative and uncertain.
  const clusters: PdfItem[][] = [];
  for (const l of lines) {
    const c = clusters.find((c) => {
      const previous = c.at(-1)!;
      return (
        l.y - previous.y - previous.height < Math.max(16, l.height * 1.6) &&
        Math.min(l.x + l.width, previous.x + previous.width) >
          Math.max(l.x, previous.x)
      );
    });
    if (c) c.push(l);
    else clusters.push([l]);
  }

  return clusters.map((c) => {
    const x = Math.min(...c.map((i) => i.x)),
      y = Math.min(...c.map((i) => i.y));
    return {
      x: Math.max(0, x - 2),
      y: Math.max(0, y - 2),
      width: Math.max(...c.map((i) => i.x + i.width)) - x + 4,
      height: Math.max(...c.map((i) => i.y + i.height)) - y + 4,
    };
  });
}
export function readingOrder<T extends { bounds: Rect }>(regions: T[]): T[] {
  const rows: T[][] = [];
  for (const r of [...regions].sort(
    (a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x,
  )) {
    const row = rows.at(-1);
    if (
      row &&
      Math.abs(r.bounds.y - row[0].bounds.y) <
        Math.min(12, r.bounds.height * 0.25)
    )
      row.push(r);
    else rows.push([r]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.bounds.x - b.bounds.x));
}
export function regionBlocks(layout: PdfLayout, region: PdfRegion) {
  const page = layout.pages[region.page - 1];
  return textBlocks(
    page.items.filter((item) => inside(item, region.bounds)),
    region.page,
    true,
  );
}
export function regionCard(layout: PdfLayout, cardId: number): Card {
  const regions = layout.regions
      .filter((r) => r.cardId === cardId)
      .sort((a, b) => a.page - b.page),
    blocks = regions.flatMap((r) => regionBlocks(layout, r));
  const card: Card = { id: cardId, title: "", text: "", group: "required" };
  for (const block of blocks) {
    if (block.kind === "heading" && !card.title) {
      card.title = block.text;
      card.group = /^(?:Vertiefungskarte|V\d+)/i.test(block.text)
        ? "extension"
        : "required";
    } else if (/^(?:Quelle|Quellen|Source)\s*:/i.test(block.text))
      card.source = [
        card.source,
        block.text.replace(/^(?:Quelle|Quellen|Source)\s*:\s*/i, ""),
      ]
        .filter(Boolean)
        .join("\n");
    else card.text = [card.text, block.text].filter(Boolean).join("\n\n");
  }
  return card;
}
export function analyzePdf(pages: PdfPage[], segments: Segment[][]) {
  const layout: PdfLayout = {
    pages,
    regions: [],
    sections: [],
    uncertainPages: [],
    unassignedGraphics: [],
  };
  let nextCard = 1,
    nextRegion = 1;
  for (const [index, page] of pages.entries()) {
    let bounds = framedRegions(segments[index] ?? [], page),
      strategy: PdfRegion["strategy"] = "frame";
    if (!bounds.length) {
      bounds = headingRegions(page);
      strategy = "heading";
    }
    if (!bounds.length) {
      bounds = spatialRegions(page);
      strategy = "spatial";
      layout.uncertainPages.push(index + 1);
    }
    if (
      index === 0 &&
      pages.length > 1 &&
      strategy === "spatial" &&
      page.items.length > 0 &&
      page.items.length <= 4 &&
      !page.graphics?.some((g) => g.raster) &&
      pages
        .slice(1)
        .some(
          (p, i) =>
            (segments[i + 1]?.length ?? 0) > 3 ||
            p.items.some((item) => isPdfHeading(item.text)),
        )
    ) {
      bounds = [];
      (page.reviewReasons ??= []).push(
        "Mögliches Titelblatt. Texte stehen unter den separaten Dokumentabschnitten zur Auswahl.",
      );
    }
    if (page.reviewReasons?.length) layout.uncertainPages.push(index + 1);
    const prior = layout.regions.at(-1);
    const priorHasHeading =
      prior &&
      layout.regions.some(
        (r) => r.cardId === prior.cardId && r.strategy === "heading",
      );
    const continuation =
      strategy === "spatial" && bounds.length === 1 && priorHasHeading;
    if (priorHasHeading && strategy === "heading" && bounds.length) {
      const firstHeadingY = Math.min(...bounds.map((r) => r.y));
      const leadingItems = page.items.filter(
        (item) =>
          item.y + item.height < firstHeadingY &&
          !(
            item.y < Math.min(60, page.height * 0.07) &&
            pages.some(
              (other, j) =>
                j !== index &&
                other.items.some(
                  (i) =>
                    i.y < Math.min(60, other.height * 0.07) &&
                    i.text === item.text,
                ),
            )
          ),
      );
      const leading = spatialRegions({ ...page, items: leadingItems });
      if (leading.length === 1) {
        layout.regions.push({
          id: nextRegion++,
          cardId: prior!.cardId,
          page: index + 1,
          bounds: leading[0],
          strategy: "spatial",
        });
        layout.uncertainPages.push(index + 1);
      }
    }
    let ordered = readingOrder(bounds.map((bounds) => ({ bounds })));
    // Preserve the established column flow of explicitly captioned framed
    // teaching sheets. Unlabelled grids and unframed caption layouts use
    // visual row order; original labels themselves are never sorted.
    if (
      strategy === "frame" &&
      ordered
        .filter((r) => page.items.some((t) => inside(t, r.bounds)))
        .every((r) => {
          const first = textBlocks(
            page.items.filter((i) => inside(i, r.bounds)),
            index + 1,
            true,
          )[0];
          return (
            first?.kind === "heading" &&
            /^(?:Karte|Card|Pflichtkarte|Vertiefungskarte|V\d)/i.test(
              first.text,
            )
          );
        })
    )
      ordered.sort((a, b) =>
        Math.abs(a.bounds.x - b.bounds.x) < 5
          ? a.bounds.y - b.bounds.y
          : a.bounds.x - b.bounds.x,
      );
    for (const r of ordered) {
      layout.regions.push({
        id: nextRegion++,
        cardId: continuation ? prior!.cardId : nextCard++,
        page: index + 1,
        bounds: r.bounds,
        strategy,
        ...cardArtwork(page, r.bounds, strategy === "frame"),
      });
    }
    const here = layout.regions.filter((r) => r.page === index + 1);
    for (const g of page.graphics ?? []) {
      // Keep original-page coordinates, clipped to the visible CropBox.
      const x = Math.max(0, g.x),
        y = Math.max(0, g.y);
      const bounds = {
        x,
        y,
        width: Math.min(page.width, g.x + g.width) - x,
        height: Math.min(page.height, g.y + g.height) - y,
      };
      if (bounds.width < 1 || bounds.height < 1) continue;
      if (
        here.some(
          (r) =>
            r.mediaBounds?.some((m) => coverage(bounds, m) >= 0.96) ||
            (!g.raster &&
              Math.abs(g.x - r.bounds.x) < 2 &&
              Math.abs(g.y - r.bounds.y) < 2 &&
              Math.abs(g.width - r.bounds.width) < 3 &&
              Math.abs(g.height - r.bounds.height) < 3),
        )
      )
        continue;
      if (
        g.raster &&
        bounds.width * bounds.height >= page.width * page.height * 0.85
      ) {
        if (page.items.length)
          (page.reviewReasons ??= []).push(
            "Seitenfüllendes Bild mit Textebene. OCR-Text, Zahlen und Quellen mit dem Scan vergleichen.",
          );
        layout.uncertainPages.push(index + 1);
        continue;
      }
      if (
        layout.unassignedGraphics!.length < 100 &&
        !layout.unassignedGraphics!.some(
          (e) => e.page === index + 1 && coverage(bounds, e.bounds) > 0.99,
        )
      )
        layout.unassignedGraphics!.push({ page: index + 1, bounds });
      layout.uncertainPages.push(index + 1);
    }
    if (strategy === "frame" && ordered.length) {
      const left = Math.min(...ordered.map((r) => r.bounds.x)),
        top = Math.min(...ordered.map((r) => r.bounds.y)),
        right = Math.max(...ordered.map((r) => r.bounds.x + r.bounds.width)),
        bottom = Math.max(...ordered.map((r) => r.bounds.y + r.bounds.height));
      if (
        page.items.some(
          (item) =>
            inside(item, {
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            }) && !ordered.some((r) => inside(item, r.bounds)),
        )
      )
        layout.uncertainPages.push(index + 1);
    }
    layout.sections.push(
      ...textBlocks(
        page.items.filter(
          (item) =>
            !layout.regions.some(
              (r) => r.page === index + 1 && inside(item, r.bounds),
            ),
        ),
        index + 1,
      ),
    );
  }
  if (nextCard > 101)
    throw new Error(
      "Mehr als 100 Kartenbereiche erkannt. Bitte das Dokument vorher aufteilen.",
    );
  const cards = [...new Set(layout.regions.map((r) => r.cardId))].map((id) =>
    regionCard(layout, id),
  );
  layout.uncertainPages = [...new Set(layout.uncertainPages)].sort(
    (a, b) => a - b,
  );
  return { layout, cards };
}
export function changeRegions(layout: PdfLayout, regions: PdfRegion[]) {
  for (const r of regions) {
    const p = layout.pages[r.page - 1],
      b = r.bounds;
    if (
      !p ||
      ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
      b.x < 0 ||
      b.y < 0 ||
      b.width < 1 ||
      b.height < 1 ||
      b.x + b.width > p.width + 0.5 ||
      b.y + b.height > p.height + 0.5
    )
      throw new Error(
        "Bitte einen gültigen Bereich innerhalb der PDF-Seite markieren.",
      );
  }
  for (const [index, p] of layout.pages.entries())
    for (const item of p.items) {
      if (
        regions.filter((r) => r.page === index + 1 && inside(item, r.bounds))
          .length > 1
      )
        throw new Error(
          "Die Bereiche überlagern sich und würden Text doppelt übernehmen. Bitte die Grenzen korrigieren.",
        );
    }
  return {
    ...layout,
    regions,
    sections: layout.pages.flatMap((p, index) =>
      textBlocks(
        p.items.filter(
          (item) =>
            !regions.some(
              (r) => r.page === index + 1 && inside(item, r.bounds),
            ),
        ),
        index + 1,
      ),
    ),
  };
}
