import QRCode from "qrcode";
import { COLORS, type Mystery, type Work } from "./model";
import { boardBounds, CARD_WIDTH, edgeGeometry, makeLayouts } from "./layout";
import { packWork, toQr } from "./codec";
import { embedWork } from "./png";
export const EXPORT_MODES = {
  a3: { width: 4961, height: 3508 },
  compact: { width: 2480, height: 1754 },
} as const;
export type ExportMode = keyof typeof EXPORT_MODES;
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
      footer = height * 0.26;
    const scale = Math.min(
      (width - 2 * margin) / bounds.width,
      (height - footer - 2 * margin) / bounds.height,
    );
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(
      margin + (width - 2 * margin - bounds.width * scale) / 2,
      margin + (height - footer - 2 * margin - bounds.height * scale) / 2,
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
      const {
        start,
        end,
        labelCenter: middle,
        labelLines,
        labelWidth,
        labelHeight,
      } = edgeGeometry(e, work.cards, layouts);
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
      if (content.image)
        ctx.drawImage(
          await image(content.image),
          c.x + 18,
          c.y + l.imageY,
          264,
          98,
        );
      ctx.fillStyle = "#334f40";
      ctx.beginPath();
      ctx.arc(c.x - 5, c.y - 5, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(c.id), c.x - 5, c.y - 5);
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
    const categoryText = work.categories
      .map((c, i) => (c ? `${i + 1}: ${c}` : ""))
      .filter(Boolean)
      .join(" · ");
    // Categories are fully retained in state; names in footer are clipped to the reserved text area only.
    if (categoryText) {
      ctx.font = `${16 * unit}px Arial`;
      ctx.fillText(categoryText, margin, footerY + 220 * unit, width * 0.7);
    }
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
      mode,
      width,
      height,
    };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
