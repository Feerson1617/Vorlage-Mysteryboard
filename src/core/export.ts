import QRCode from "qrcode";
import {
  COLORS,
  COLOR_NAMES,
  validateWork,
  teamName,
  type Mystery,
  type Work,
} from "./model";
import {
  boardBounds,
  CARD_WIDTH,
  edgeGeometry,
  makeLayouts,
  fitImage,
  numberBadge,
  wrap,
} from "./layout";
import { packWork, toQr } from "./codec";
import { embedWork } from "./png";
export const EXPORT_MODES = {
  a3: { width: 4961, height: 3508 },
  compact: { width: 2480, height: 1754 },
} as const;
export type ExportMode = keyof typeof EXPORT_MODES;
export type ExportHeaderRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  font: string;
  fontSize: number;
  lineHeight: number;
  align: "left" | "right";
};
// Both columns begin on the same row. Their actual wrapped line counts reserve
// only the necessary header height; the footer/QR area remains unchanged.
export function layoutExportHeader(title: string, team: string, width: number) {
  if (!Number.isFinite(width) || width <= 0)
    throw new Error("Ungültige Breite für die Export-Kopfzeile.");
  const unit = width / 2480,
    margin = width * 0.024,
    contentWidth = width - 2 * margin,
    gap = team ? 32 * unit : 0,
    teamWidth = team ? (contentWidth - gap) * 0.32 : 0,
    titleWidth = contentWidth - gap - teamWidth,
    top = 40 * unit,
    lineHeight = 34 * unit;
  const region = (
    text: string,
    x: number,
    regionWidth: number,
    fontSize: number,
    align: "left" | "right",
  ): ExportHeaderRegion => {
    const font = `${align === "left" ? "bold " : ""}${fontSize}px Arial`,
      visibleText = text.replace(/\s+/g, " ").trim(),
      lines = visibleText ? wrap(visibleText, regionWidth, font) : [];
    return {
      x,
      y: top,
      width: regionWidth,
      height: lines.length * lineHeight,
      lines,
      font,
      fontSize,
      lineHeight,
      align,
    };
  };
  const titleRegion = region(title, margin, titleWidth, 28 * unit, "left"),
    teamRegion = region(
      team,
      width - margin - teamWidth,
      teamWidth,
      26 * unit,
      "right",
    ),
    height = Math.max(titleRegion.height, teamRegion.height);
  return {
    height,
    gap,
    boardTop: Math.max(margin, top + height + (height ? 16 * unit : 0)),
    title: titleRegion,
    team: teamRegion,
  };
}
const image = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () =>
      reject(new Error("Ein eingebettetes Bild konnte nicht geladen werden."));
    i.src = src;
  });
const blob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Das Bild konnte nicht erzeugt werden.")),
      "image/png",
    ),
  );
export async function exportBoard(
  work: Work,
  m: Mystery,
  mode: ExportMode = "a3",
) {
  // Never offer a backup that fails our own state validator.
  work = validateWork(work, m);
  const { width, height } = EXPORT_MODES[mode],
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Zu wenig Platz zum Erzeugen des Bildes.");
    const layouts = makeLayouts(m),
      bounds = boardBounds(work, layouts);
    const qr = toQr(packWork(work));
    const margin = width * 0.024,
      footer = height * 0.26,
      headerBounds = layoutExportHeader(m.title, teamName(work), width),
      boardHeight = height - footer - margin - headerBounds.boardTop;
    const scale = Math.min(
      (width - 2 * margin) / bounds.width,
      boardHeight / bounds.height,
    );
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.fillStyle = "#273c30";
    ctx.textBaseline = "top";
    for (const region of [headerBounds.title, headerBounds.team]) {
      ctx.font = region.font;
      ctx.textAlign = region.align;
      region.lines.forEach((line, row) =>
        ctx.fillText(
          line,
          region.align === "right" ? region.x + region.width : region.x,
          region.y + row * region.lineHeight,
        ),
      );
    }
    ctx.restore();
    ctx.save();
    ctx.translate(
      margin + (width - 2 * margin - bounds.width * scale) / 2,
      headerBounds.boardTop + (boardHeight - bounds.height * scale) / 2,
    );
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);
    const arrow = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    for (const e of work.edges) {
      const { start, end } = edgeGeometry(e, work.cards, layouts);
      ctx.strokeStyle = "#68766e";
      ctx.fillStyle = "#68766e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      if (e.direction === 1) arrow(end.x, end.y, angle);
      if (e.direction === 2) arrow(start.x, start.y, angle + Math.PI);
    }
    // Match the Board: draw all labels above the lines.
    for (const e of work.edges) {
      const {
        labelCenter: middle,
        labelLines,
        labelWidth,
        labelHeight,
      } = edgeGeometry(e, work.cards, layouts);
      if (e.label) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          middle.x - labelWidth / 2,
          middle.y - labelHeight / 2,
          labelWidth,
          labelHeight,
        );
        ctx.fillStyle = "#39463e";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        labelLines.forEach((line, i) =>
          ctx.fillText(
            line,
            middle.x,
            middle.y - labelLines.length * 9 + 14 + i * 18,
          ),
        );
        ctx.textAlign = "left";
      }
    }
    for (const c of work.cards) {
      const content = m.cards.find((x) => x.id === c.id)!,
        l = layouts.get(c.id)!;
      ctx.fillStyle = COLORS[c.color];
      ctx.strokeStyle = "#b9c4bc";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, CARD_WIDTH, l.height, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#253c30";
      ctx.font = "bold 18px Arial";
      l.title.forEach((t, i) => ctx.fillText(t, c.x + 18, c.y + 32 + i * 24));
      ctx.fillStyle = "#343f38";
      ctx.font = "16px Arial";
      l.text.forEach((t, i) =>
        ctx.fillText(t, c.x + 18, c.y + 24 + l.title.length * 24 + 26 + i * 22),
      );
      if (content.image) {
        const loaded = await image(content.image);
        const box = fitImage(loaded.naturalWidth, loaded.naturalHeight, {
          x: c.x + 18,
          y: c.y + l.imageY,
          width: 264,
          height: 98,
        });
        ctx.drawImage(loaded, box.x, box.y, box.width, box.height);
      }
      ctx.fillStyle = "#334f40";
      ctx.beginPath();
      const badge = numberBadge(1, l.numberLabel);
      ctx.arc(
        c.x + badge.offset,
        c.y + badge.offset,
        badge.radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.font = `bold ${badge.fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(l.numberLabel, c.x + badge.offset, c.y + badge.offset);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    const footerY = height - footer,
      unit = width / 2480;
    ctx.fillStyle = "#f4f6f4";
    ctx.fillRect(0, footerY, width, footer);
    ctx.fillStyle = "#273c30";
    ctx.font = `bold ${28 * unit}px Arial`;
    ctx.fillText("MysteryBoard · Sicherungsbild", margin, footerY + 58 * unit);
    ctx.font = `${20 * unit}px Arial`;
    const lines = [
      "Die unveränderte Originaldatei enthält euren vollständigen Arbeitsstand.",
      qr
        ? "Fortsetzen: Originaldatei auswählen oder den Code scannen."
        : "Zum Fortsetzen wird die Originaldatei benötigt. Der Arbeitsstand ist zu groß für einen Code.",
      "Ein Bildschirmfoto oder ein bearbeitetes Bild kann die Sicherungsdaten verlieren.",
    ];
    lines.forEach((t, i) =>
      ctx.fillText(t, margin, footerY + (100 + i * 31) * unit),
    );
    work.categories
      .map((name, color) => ({ name, color }))
      .filter(({ name }) => name)
      .forEach(({ name, color }, row) => {
        const y = footerY + (220 + row * 28) * unit;
        ctx.fillStyle = COLORS[color];
        ctx.strokeStyle = "#68766e";
        ctx.lineWidth = unit;
        ctx.fillRect(margin, y - 15 * unit, 18 * unit, 18 * unit);
        ctx.strokeRect(margin, y - 15 * unit, 18 * unit, 18 * unit);
        ctx.fillStyle = "#273c30";
        ctx.font = `${16 * unit}px Arial`;
        ctx.fillText(`${COLOR_NAMES[color]} – ${name}`, margin + 28 * unit, y);
      });
    let qrBounds: { x: number; y: number; size: number } | null = null;
    if (qr) {
      const modules = QRCode.create(qr, { errorCorrectionLevel: "M" }).modules
        .size;
      const modulePixels = Math.floor((footer - margin * 0.8) / (modules + 8));
      if (modulePixels < 4)
        throw new Error(
          "Der Code kann in dieser Bildgröße nicht sicher dargestellt werden.",
        );
      const size = (modules + 8) * modulePixels;
      const q = await QRCode.toDataURL(qr, {
        errorCorrectionLevel: "M",
        margin: 4,
        scale: modulePixels,
      });
      const qi = await image(q);
      qrBounds = {
        x: Math.round(width - margin - size),
        y: Math.round(footerY + (footer - size) / 2),
        size,
      };
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qi, qrBounds.x, qrBounds.y);
    }
    const raw = new Uint8Array(await (await blob(canvas)).arrayBuffer());
    const bytes = embedWork(raw, work);
    return {
      blob: new Blob([bytes as BlobPart], { type: "image/png" }),
      qr,
      qrBounds,
      headerBounds,
      mode,
      width,
      height,
    };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
