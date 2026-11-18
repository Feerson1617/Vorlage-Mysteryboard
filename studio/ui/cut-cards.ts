import { designOf } from "../../src/core/design";
import type { Task } from "../../src/core/documents";
import { cardNumber } from "../../src/core/model";
export type PaperOptions = {
  paper: "A4" | "A3";
  landscape: boolean;
  cover: boolean;
  monochrome: boolean;
  question: string;
  instructions: string;
};
export type PrintResult = {
  html: string;
  pages: number;
  warnings: string[];
  cards: number;
  pageInfo: { paper: string; landscape: boolean; cards: number[] }[];
};
const mm = 96 / 25.4;
// The same DOM is used by preview and Chromium's vector printToPDF. No screenshot.
export async function cutCards(
  task: Task,
  options: PaperOptions,
  fonts: { regular: string; bold: string; serif?: string; serifBold?: string },
  signal: AbortSignal,
): Promise<PrintResult> {
  const design = designOf(task.content);
  const regular =
      design.font === "serif" ? (fonts.serif ?? fonts.regular) : fonts.regular,
    bold =
      design.font === "serif" ? (fonts.serifBold ?? fonts.bold) : fonts.bold;
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1800px;height:1600px;visibility:hidden";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Druckkarten</title></head><body></body></html>',
    );
    doc.close();
    const images = new Map<number, HTMLImageElement[]>();
    const style = doc.createElement("style");
    style.textContent = `
 @font-face{font-family:StudioPrint;src:url(data:font/ttf;base64,${regular})}@font-face{font-family:StudioPrint;src:url(data:font/ttf;base64,${bold});font-weight:700}
 *{box-sizing:border-box}body{margin:0;background:#e9ede9;color:#17251b;font-family:StudioPrint,Arial,sans-serif;font-size:11pt}h1,h2,p{margin:0}p{white-space:pre-wrap;overflow-wrap:anywhere}img{object-fit:contain;display:block;max-width:100%}.sheet{position:relative;background:white;margin:10px auto;overflow:visible;break-after:page}.sheet:last-child{break-after:auto}.page-header{position:absolute;left:12mm;right:12mm;top:8mm;font-size:9pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.page-footer{position:absolute;left:12mm;right:12mm;bottom:6mm;font-size:8.5pt}.card{position:absolute;padding:4mm;border:.25mm solid #65766a;background:white;overflow:visible;break-inside:avoid;font-size:11pt;line-height:1.32}.card h2{font-size:12pt;line-height:1.2;margin:0 0 2.5mm}.card .card-group{font-size:9.5pt;margin-bottom:2mm}.card .card-source{font-size:9.5pt;margin-top:3mm}.card img{margin:3mm auto}.card table{width:100%;border-collapse:collapse;font-size:10.5pt;margin-top:3mm;table-layout:fixed}.card th,.card td{border:.2mm solid #65766a;text-align:left;padding:1.5mm;vertical-align:top;overflow-wrap:anywhere}.cut-mark{position:absolute;inset:-2mm;pointer-events:none;width:calc(100% + 4mm);height:calc(100% + 4mm);overflow:visible}.cover-content{position:absolute;inset:28mm 20mm 20mm}.cover-content h1{font-size:24pt;margin-bottom:14mm;overflow-wrap:anywhere}.cover-content h2{font-size:14pt;margin:8mm 0 3mm}.cover-content p{font-size:12pt;line-height:1.5}.group-extension{border-color:#826b39}${options.monochrome ? "body{color:black}.card,.card th,.card td{border-color:black}.card img{filter:grayscale(1)}" : ""}
 @page a4portrait{size:A4 portrait;margin:0}@page a4landscape{size:A4 landscape;margin:0}@page a3portrait{size:A3 portrait;margin:0}@page a3landscape{size:A3 landscape;margin:0}
 @media print{body{background:white}.sheet{margin:0;box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 .card{font-size:${Math.max(10.5, 11 + (design.fontSize - 16) * 0.4)}pt;color:${options.monochrome ? "#111111" : design.textColor};background:${options.monochrome ? "#ffffff" : design.cardColor};border-color:${options.monochrome ? "#333333" : design.borderColor};border-radius:${design.radius * 0.12}mm;border-width:${design.borderWidth * 0.18}mm}.card .image-caption{font-size:9.5pt;margin-top:1mm}.card figure{margin:3mm 0}.card h2{color:inherit}
 `;
    doc.head.append(style);
    await Promise.all([
      doc.fonts.load("11pt StudioPrint"),
      doc.fonts.load("700 12pt StudioPrint"),
    ]);
    await doc.fonts.ready;
    signal.throwIfAborted();
    const el = (tag: string, text?: string, cls?: string) => {
      const e = doc.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    };
    type Sheet = {
      node: HTMLElement;
      width: number;
      height: number;
      paper: "A4" | "A3";
      landscape: boolean;
      cols: number;
      x: number;
      y: number;
      row: number;
      cardIds: number[];
    };
    const sheets: Sheet[] = [];
    const warnings: string[] = [];
    const sheet = (paper = options.paper, landscape = options.landscape) => {
      const dims = paper === "A4" ? [210, 297] : [297, 420];
      if (landscape) dims.reverse();
      const node = el("section", undefined, "sheet");
      node.dataset.paper = paper;
      node.style.cssText = `width:${dims[0]}mm;height:${dims[1]}mm;page:${paper.toLowerCase()}${landscape ? "landscape" : "portrait"}`;
      node.append(
        el("header", task.content.title, "page-header"),
        el("footer", "", "page-footer"),
      );
      doc.body.append(node);
      const s = {
        node,
        width: dims[0] - 24,
        height: dims[1] - 36,
        paper,
        landscape,
        cols: dims[0] >= 290 ? 3 : 2,
        x: 0,
        y: 0,
        row: 0,
        cardIds: [] as number[],
      };
      sheets.push(s);
      return s;
    };
    if (options.cover) {
      const s = sheet();
      s.node.dataset.cover = "true";
      const cover = el("div", undefined, "cover-content");
      cover.append(
        el("h1", task.content.title),
        el("h2", "Leitfrage"),
        el("p", options.question || task.content.title),
        el("h2", "Arbeitsauftrag"),
        el(
          "p",
          options.instructions ||
            task.content.subtitle ||
            "Ordnet die Karten, untersucht Zusammenhänge und begründet eure Vermutungen.",
        ),
      );
      s.node.append(cover);
      if (cover.scrollHeight > cover.clientHeight + 1)
        throw Error(
          "Die Titelseite ist zu umfangreich. Bitte den Arbeitsauftrag kürzen oder A3 wählen.",
        );
    }
    let current = sheet();
    for (const card of task.content.cards) {
      if (current.paper !== options.paper && current.cardIds.length)
        current = sheet();
      signal.throwIfAborted();
      const a = el("article", undefined, "card");
      a.dataset.cardId = String(card.id);
      const label = cardNumber(task.content, card.id);
      a.append(el("h2", `Karte ${label}: ${card.title}`));
      const group = card.group
        ? task.content.cardGroups?.[card.group]
        : undefined;
      if (group) {
        a.append(el("p", group.label, "card-group"));
        if (group.prefix) a.classList.add("group-extension");
      }
      const text = el("p", card.text, "card-text");
      if (card.imagePosition !== "before-text") a.append(text);
      const loadedImages: HTMLImageElement[] = [];
      const media = [
        ...(card.image
          ? [
              {
                src: card.image,
                alt: card.imageAlt,
                caption: card.imageCaption,
                source: undefined,
              },
            ]
          : []),
        ...(card.extraImages ?? []),
      ];
      for (const m of media) {
        const figure = el("figure");
        const image = doc.createElement("img");
        image.src = m.src;
        image.alt = m.alt || card.title;
        await image.decode();
        signal.throwIfAborted();
        figure.append(image);
        loadedImages.push(image);
        if (m.caption)
          figure.append(el("figcaption", m.caption, "image-caption"));
        if (m.source)
          figure.append(el("p", "Quelle: " + m.source, "card-source"));
        a.append(figure);
      }
      if (card.imagePosition === "before-text") a.append(text);
      if (card.table) {
        const table = el("table");
        if (card.table.caption) table.append(el("caption", card.table.caption));
        const head = el("thead"),
          row = el("tr");
        card.table.headers.forEach((h) => row.append(el("th", h)));
        head.append(row);
        table.append(head);
        const body = el("tbody");
        card.table.rows.forEach((r) => {
          const tr = el("tr");
          r.forEach((t) => tr.append(el("td", t)));
          body.append(tr);
        });
        table.append(body);
        a.append(table);
      }
      if (card.source)
        a.append(el("p", `Quelle: ${card.source}`, "card-source"));
      const measure = (s: Sheet, full = false) => {
        const w = full ? s.width : (s.width - (s.cols - 1) * 6) / s.cols;
        a.style.width = `${w}mm`;
        a.style.height = "auto";
        for (const image of loadedImages) {
          const maxW = ((w - 8) * mm * (card.imageScale ?? 100)) / 100,
            maxH =
              Math.min(
                85,
                (s.height * 0.35) / Math.max(1, loadedImages.length),
              ) * mm,
            r = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
          image.style.width = `${image.naturalWidth * r}px`;
          image.style.height = `${image.naturalHeight * r}px`;
        }
        s.node.append(a);
        return a.getBoundingClientRect().height / mm;
      };
      let full = false,
        h = measure(current);
      if (h > current.height) {
        full = true;
        h = measure(current, true);
        if (current.cardIds.length) current = sheet();
        h = measure(current, true);
      }
      if (h > current.height && options.paper === "A4") {
        if (!current.cardIds.length) {
          current.node.remove();
          sheets.pop();
        }
        current = sheet("A3", true);
        full = true;
        h = measure(current, true);
        warnings.push(
          `Karte ${label}: eigene A3-Querformat-Seite, damit der Text lesbar bleibt.`,
        );
      }
      if (h > current.height)
        throw Error(
          `Karte ${label} passt auch als ganze Karte nicht lesbar auf die Seite. Bitte den Inhalt auf mehrere Karten verteilen. Es wurde nichts abgeschnitten.`,
        );
      if (full) {
        if (current.cardIds.length) {
          current = sheet();
          h = measure(current, true);
        }
        current.x = 0;
        current.y = 0;
        current.row = h;
      } else {
        if (current.x >= current.cols) {
          current.x = 0;
          current.y += current.row + 6;
          current.row = 0;
        }
        if (current.y + h > current.height) {
          current = sheet();
          h = measure(current);
        }
      }
      const w = full
        ? current.width
        : (current.width - (current.cols - 1) * 6) / current.cols;
      a.style.left = `${12 + (full ? 0 : current.x * (w + 6))}mm`;
      a.style.top = `${20 + current.y}mm`;
      a.style.height = `${h}mm`;
      current.node.append(a);
      current.cardIds.push(card.id);
      if (full) {
        current.y = current.height;
        current.x = current.cols;
      } else {
        current.row = Math.max(current.row, h);
        current.x++;
      }
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "cut-mark");
      svg.setAttribute("viewBox", `0 0 ${(w + 4) * mm} ${(h + 4) * mm}`);
      const W = (w + 4) * mm,
        H = (h + 4) * mm,
        d = 2 * mm;
      const path = doc.createElementNS(svg.namespaceURI, "path");
      path.setAttribute(
        "d",
        `M0 ${d} H${d} V0 M${W - d} 0 V${d} H${W} M0 ${H - d} H${d} V${H} M${W - d} ${H} V${H - d} H${W}`,
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#444");
      path.setAttribute("stroke-width", ".6");
      svg.append(path);
      const contentOverflow = a.scrollHeight > a.clientHeight + 2;
      a.append(svg);
      for (const image of loadedImages) {
        const box = image.getBoundingClientRect(),
          dpi = Math.min(
            image.naturalWidth / (box.width / 96),
            image.naturalHeight / (box.height / 96),
          );
        if (dpi < 180)
          warnings.push(
            `Karte ${label}: Bildauflösung etwa ${Math.round(dpi)} dpi in dieser Druckgröße; für feine Details möglichst ein höher aufgelöstes Original verwenden.`,
          );
      }
      const box = a.getBoundingClientRect(),
        page = current.node.getBoundingClientRect();
      if (
        box.bottom > page.bottom - 12 * mm + 1 ||
        box.right > page.right - 12 * mm + 1 ||
        contentOverflow
      )
        throw Error(
          `Karte ${label} konnte nicht vollständig platziert werden.`,
        );
    }
    sheets.forEach(
      (s, i) =>
        (s.node.querySelector(".page-footer")!.textContent =
          `${i + 1} / ${sheets.length}`),
    );
    return {
      html: "<!doctype html>" + doc.documentElement.outerHTML,
      pages: sheets.length,
      warnings,
      cards: task.content.cards.length,
      pageInfo: sheets.map((s) => ({
        paper: s.paper,
        landscape: s.landscape,
        cards: s.cardIds,
      })),
    };
  } finally {
    frame.remove();
  }
}
