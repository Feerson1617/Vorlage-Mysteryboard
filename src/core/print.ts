import {
  cardNumber,
  COLOR_NAMES,
  COLORS,
  teamName,
  validTeamName,
  validateMystery,
  validateWork,
  type CardContent,
  type CardState,
  type Edge,
  type Mystery,
  type Work,
} from "./model";
import {
  boardBounds,
  CARD_WIDTH,
  edgeGeometry,
  fitImage,
  makeLayouts,
  numberBadge,
} from "./layout";

export type PrintPaper = "a4" | "a3";
export const MAX_PRINT_PAGES = 500;
const preparations = new WeakMap<HTMLIFrameElement, number>();
const SVG = "http://www.w3.org/2000/svg";

export function printDirection(edge: Edge, mystery: Mystery): string {
  const from = cardNumber(mystery, edge.from),
    to = cardNumber(mystery, edge.to);
  return edge.direction === 0
    ? `${from} — ${to} (ohne Pfeil)`
    : edge.direction === 1
      ? `${from} → ${to}`
      : `${from} ← ${to}`;
}

function printCss(paper: PrintPaper) {
  const width = paper === "a3" ? 420 : 297,
    height = paper === "a3" ? 297 : 210;
  return `
@page { size: ${paper.toUpperCase()} landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #23332a; background: #e8ece9; }
body { font-size: 11pt; line-height: 1.38; }
.print-page { width: ${width}mm; height: ${height}mm; padding: 10mm; margin: 5mm auto; background: white; display: flex; flex-direction: column; break-after: page; page-break-after: always; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.print-page:last-child { break-after: auto; page-break-after: auto; }
.print-header { display: grid; grid-template-columns: minmax(0,3fr) minmax(0,2fr); gap: 6mm; border-bottom: .25mm solid #a6b3aa; padding-bottom: 2mm; font-size: 10pt; line-height: 1.25; flex: none; overflow-wrap: anywhere; }
.print-title { font-weight: 700; }
.print-team { text-align: right; }
.print-section-title { font-size: 13pt; line-height: 1.2; margin: 3mm 0; flex: none; }
.print-body { flex: 1; min-height: 0; }
.print-columns { display: grid; grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 6mm; }
.print-column { min-width: 0; min-height: 0; height: 100%; display: flow-root; }
.print-item { border: .25mm solid #b2beb6; border-left-width: 1.2mm; padding: 3mm; margin: 0 0 3mm; overflow-wrap: anywhere; }
.print-item h3 { font-size: 12pt; line-height: 1.25; margin: 0 0 2mm; overflow-wrap: anywhere; }
.print-card-meta { font-size: 10pt; line-height: 1.3; margin: 0 0 2mm; }
.print-card-text, .print-edge-label { font-size: 11pt; line-height: 1.38; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
.print-reference-row, .print-empty-label { font-size: 11pt; line-height: 1.38; margin: 2mm 0 0; overflow-wrap: anywhere; }
a { color: #23332a; text-decoration: underline; text-underline-offset: .5mm; }
.page-ref { display: inline-block; min-width: 18mm; white-space: nowrap; font-variant-numeric: tabular-nums; }
.print-footer { display: flex; justify-content: space-between; gap: 6mm; margin-top: 3mm; font-size: 9pt; line-height: 1.2; flex: none; }
.print-page-number { white-space: nowrap; }
.print-overview { display: flex; flex-direction: column; gap: 2mm; }
.print-overview-note { margin: 0; font-size: 10pt; line-height: 1.3; }
.print-categories { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 2mm 4mm; font-size: 10pt; line-height: 1.25; }
.print-category { display: flex; gap: 2mm; min-width: 0; overflow-wrap: anywhere; }
.print-swatch { display: inline-block; width: 4mm; height: 4mm; border: .25mm solid #68766e; flex: none; }
.print-overview-svg { display: block; width: 100%; flex: 1; min-height: 0; border: .25mm solid #c8d0ca; }
.print-overview-svg a { text-decoration: none; }
.print-image-body { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
.print-image-caption { width: 100%; margin: 0; font-size: 11pt; line-height: 1.38; overflow-wrap: anywhere; }
.print-card-image { display: block; object-fit: contain; flex: none; }
@media print { html, body { background: white; } .print-page { margin: 0; } }
`;
}

type Section = "overview" | "cards" | "images" | "relations";
type PrintPage = {
  node: HTMLElement;
  body: HTMLElement;
  columns: HTMLElement[];
};

/** Creates a script-free, same-origin print document; it never opens the print dialog. */
export async function preparePrintFrame(
  frame: HTMLIFrameElement,
  inputWork: Work,
  inputMystery: Mystery,
  paper: PrintPaper,
): Promise<{ pageCount: number }> {
  if (paper !== "a4" && paper !== "a3")
    throw new Error("Wähle A4 oder A3 für die Druckfassung.");
  const mystery = validateMystery(structuredClone(inputMystery)),
    work = validateWork(inputWork, mystery);
  if (!validTeamName(teamName(work)))
    throw new Error(
      "Bitte tragt vor der Druckfassung einen Teamnamen oder Vornamen ein.",
    );
  const generation = (preparations.get(frame) ?? 0) + 1;
  preparations.set(frame, generation);
  const doc = frame.contentDocument;
  if (!doc || !frame.isConnected)
    throw new Error("Die Druckansicht ist nicht geöffnet.");
  const ensureActive = () => {
    if (
      !frame.isConnected ||
      preparations.get(frame) !== generation ||
      frame.contentDocument !== doc
    )
      throw new Error("Die Druckvorbereitung wurde abgebrochen.");
  };
  const pause = async () => {
    ensureActive();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    ensureActive();
  };
  doc.open();
  doc.write(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>MysteryBoard Druckfassung</title><style>${printCss(paper)}</style></head><body></body></html>`,
  );
  doc.close();
  doc.title = `${mystery.title} – Druckfassung`;
  doc.documentElement.dataset.printPaper = paper;
  await doc.fonts.ready;
  ensureActive();
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const pages: PrintPage[] = [];
  const pageTitles: Record<Section, string> = {
    overview: "Gesamtübersicht",
    cards: "Vollständige Karten",
    images: "Bilddetails",
    relations: "Vollständige Beziehungen",
  };
  const createPage = (section: Section): PrintPage => {
    ensureActive();
    if (pages.length >= MAX_PRINT_PAGES)
      throw new Error(
        `Die Druckfassung benötigt mehr als ${MAX_PRINT_PAGES} Seiten. Bitte verwendet A3 oder druckt einen weniger umfangreichen Arbeitsstand. Es wurde keine unvollständige Druckfassung freigegeben.`,
      );
    const node = el("section", "print-page");
    node.dataset.page = String(pages.length + 1);
    node.dataset.section = section;
    const header = el("header", "print-header");
    header.append(
      el("div", "print-title", mystery.title),
      el("div", "print-team", teamName(work)),
    );
    const heading = el("h2", "print-section-title", pageTitles[section]);
    const body = el(
      "div",
      `print-body${section === "cards" || section === "relations" ? " print-columns" : section === "overview" ? " print-overview" : " print-image-body"}`,
    );
    const footer = el("footer", "print-footer");
    footer.append(
      el("span", undefined, "Druckfassung · Bearbeitbarer Stand: Original-PNG"),
      el("span", "print-page-number"),
    );
    node.append(header, heading, body, footer);
    doc.body.append(node);
    const columns =
      section === "cards" || section === "relations"
        ? [el("div", "print-column"), el("div", "print-column")]
        : [];
    body.append(...columns);
    const page = { node, body, columns };
    pages.push(page);
    return page;
  };
  const references: {
    link: HTMLAnchorElement;
    target: string;
    page: HTMLElement;
  }[] = [];
  const reference = (
    type: "card" | "edge" | "image",
    id: number,
    caption: string,
  ) => {
    const link = el("a", `${type}-reference`, caption + " · ");
    link.setAttribute(`data-${type}-reference`, String(id));
    link.href = `#${type}-${id}`;
    const page = el("span", "page-ref", "Seite 000");
    link.append(page);
    references.push({ link, target: `${type}-${id}`, page });
    return link;
  };
  const categories = el("div", "print-categories");
  COLORS.forEach((color, index) => {
    const item = el("div", "print-category");
    item.dataset.colorIndex = String(index);
    const swatch = el("span", "print-swatch");
    swatch.style.backgroundColor = color;
    item.append(
      swatch,
      el(
        "span",
        undefined,
        `${COLOR_NAMES[index]}: ${work.categories[index] || "ohne eigene Bezeichnung"}`,
      ),
    );
    categories.append(item);
  });
  const summary = createPage("overview");
  summary.body.append(
    el(
      "p",
      "print-overview-note",
      `${work.cards.length} Karten · ${work.edges.length} Verbindungen. Gespeicherte Positionen, unabhängig vom Bildschirmzoom.`,
    ),
  );
  summary.body.append(categories);
  summary.body.append(
    el(
      "p",
      "print-overview-note",
      "Die Übersicht dient der Orientierung. Bei dichten Gefügen können Nummern und Linien überlagern. Vollständige Kartentexte, große Bilder und alle Beziehungen folgen mit Seitenverweisen.",
    ),
  );
  const svgNode = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | number> = {},
    text?: string,
  ) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attributes))
      node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  // Existing layout measurement uses only its small text-measuring context.
  // The overview itself is vector SVG, never a large raster canvas.
  const layouts = makeLayouts(mystery),
    bounds = boardBounds(work, layouts);
  const svg = svgNode("svg", {
    class: "print-overview-svg",
    "data-print-overview": "true",
    viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
    role: "img",
    "aria-label": "Gespeicherte Kartenpositionen und Verbindungen",
  });
  const defs = svgNode("defs"),
    marker = svgNode("marker", {
      id: "print-arrow",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 8,
      markerHeight: 8,
      orient: "auto-start-reverse",
    });
  marker.append(svgNode("path", { d: "M0 0 L10 5 L0 10 z", fill: "#526558" }));
  defs.append(marker);
  svg.append(defs);
  for (const edge of work.edges) {
    const g = edgeGeometry(edge, work.cards, layouts),
      group = svgNode("g", { "data-overview-edge-id": edge.id });
    const line = svgNode("line", {
      x1: g.start.x,
      y1: g.start.y,
      x2: g.end.x,
      y2: g.end.y,
      stroke: "#526558",
      "stroke-width": 2,
    });
    if (edge.direction)
      line.setAttribute(
        edge.direction === 1 ? "marker-end" : "marker-start",
        "url(#print-arrow)",
      );
    group.append(
      svgNode("title", {}, `${printDirection(edge, mystery)}: ${edge.label}`),
      line,
    );
    svg.append(group);
  }
  for (const edge of work.edges)
    if (edge.label) {
      const g = edgeGeometry(edge, work.cards, layouts),
        group = svgNode("g");
      group.append(
        svgNode("rect", {
          x: g.labelCenter.x - g.labelWidth / 2,
          y: g.labelCenter.y - g.labelHeight / 2,
          width: g.labelWidth,
          height: g.labelHeight,
          fill: "white",
        }),
      );
      g.labelLines.forEach((line, index) =>
        group.append(
          svgNode(
            "text",
            {
              x: g.labelCenter.x,
              y: g.labelCenter.y - g.labelLines.length * 9 + 14 + index * 18,
              "font-size": 14,
              "text-anchor": "middle",
            },
            line,
          ),
        ),
      );
      svg.append(group);
    }
  for (const state of work.cards) {
    const card = mystery.cards.find((c) => c.id === state.id)!,
      layout = layouts.get(state.id)!,
      badge = numberBadge(1, layout.numberLabel);
    const group = svgNode("a", {
      href: `#card-${state.id}`,
      "data-overview-card-id": state.id,
      "data-x": state.x,
      "data-y": state.y,
    });
    group.append(
      svgNode("rect", {
        x: state.x,
        y: state.y,
        width: CARD_WIDTH,
        height: layout.height,
        rx: 10,
        fill: COLORS[state.color],
        stroke: "#819287",
        "stroke-width": 1.5,
      }),
    );
    layout.title.forEach((line, i) =>
      group.append(
        svgNode(
          "text",
          {
            x: state.x + 18,
            y: state.y + 32 + i * 24,
            "font-size": 18,
            "font-weight": "bold",
          },
          line,
        ),
      ),
    );
    layout.text.forEach((line, i) =>
      group.append(
        svgNode(
          "text",
          {
            x: state.x + 18,
            y: state.y + 24 + layout.title.length * 24 + 26 + i * 22,
            "font-size": 16,
          },
          line,
        ),
      ),
    );
    if (card.image)
      group.append(
        svgNode("image", {
          "data-overview-image": card.id,
          x: state.x + 18,
          y: state.y + layout.imageY,
          width: 264,
          height: 98,
          preserveAspectRatio: "xMidYMid meet",
        }),
      );
    group.append(
      svgNode("circle", {
        cx: state.x + badge.offset,
        cy: state.y + badge.offset,
        r: badge.radius,
        fill: "#334f40",
      }),
    );
    group.append(
      svgNode(
        "text",
        {
          x: state.x + badge.offset,
          y: state.y + badge.offset,
          "font-size": badge.fontSize,
          "font-weight": "bold",
          "text-anchor": "middle",
          "dominant-baseline": "central",
          fill: "white",
        },
        layout.numberLabel,
      ),
    );
    svg.append(group);
  }
  summary.body.append(svg);
  await pause();

  let currentPage: PrintPage = summary,
    column: HTMLElement = summary.body,
    columnIndex = 0,
    section: "cards" | "relations" = "cards";
  const startSection = (next: "cards" | "relations") => {
    section = next;
    currentPage = createPage(next);
    columnIndex = 0;
    column = currentPage.columns[0];
  };
  const advance = async () => {
    await pause();
    if (columnIndex === 0) {
      columnIndex = 1;
      column = currentPage.columns[1];
    } else {
      currentPage = createPage(section);
      columnIndex = 0;
      column = currentPage.columns[0];
    }
  };
  const fits = (node: HTMLElement) =>
    node.getBoundingClientRect().bottom <=
    column.getBoundingClientRect().bottom - 0.5;
  const appendText = async (
    text: string,
    create: (first: boolean) => HTMLElement,
    attribute: string,
    id: number,
  ) => {
    const characters = Array.from(text);
    let offset = 0,
      first = true,
      last: HTMLElement | null = null;
    do {
      ensureActive();
      const article = create(first),
        paragraph = el(
          "p",
          attribute === "cardText" ? "print-card-text" : "print-edge-label",
        );
      paragraph.dataset[attribute] = String(id);
      article.append(paragraph);
      column.append(article);
      const remaining = characters.length - offset;
      paragraph.textContent = characters
        .slice(offset, offset + Math.min(120, remaining))
        .join("");
      if (!fits(article)) {
        article.remove();
        if (!column.children.length)
          throw new Error(
            "Eine Kartenüberschrift passt nicht lesbar auf die gewählte Seite. Bitte verwendet A3.",
          );
        await advance();
        continue;
      }
      let low = Math.min(120, remaining),
        high = remaining;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        paragraph.textContent = characters
          .slice(offset, offset + middle)
          .join("");
        if (fits(article)) low = middle;
        else high = middle - 1;
      }
      paragraph.textContent = characters.slice(offset, offset + low).join("");
      offset += low;
      first = false;
      last = article;
      if (offset < characters.length) await advance();
    } while (offset < characters.length);
    return last!;
  };
  const appendRow = async (
    article: HTMLElement,
    row: HTMLElement,
    continuation: () => HTMLElement,
  ) => {
    article.append(row);
    if (fits(article)) return article;
    row.remove();
    await advance();
    const next = continuation();
    next.append(row);
    column.append(next);
    if (!fits(next))
      throw new Error(
        "Ein Verweis passt nicht lesbar auf die gewählte Seite. Bitte verwendet A3.",
      );
    return next;
  };
  const cardFragment = (
    card: CardContent,
    state: CardState,
    first: boolean,
  ) => {
    const article = el("article", "print-item");
    article.dataset.cardPart = String(card.id);
    article.dataset.colorIndex = String(state.color);
    article.style.borderLeftColor = COLORS[state.color];
    if (first) {
      article.dataset.cardId = String(card.id);
      article.id = `card-${card.id}`;
    }
    const heading = el("h3");
    heading.append(
      el("span", "print-card-number", `Karte ${cardNumber(mystery, card.id)}`),
      doc.createTextNode(`${first ? "" : " (Fortsetzung)"}: ${card.title}`),
    );
    article.append(heading);
    const group = card.group ? mystery.cardGroups?.[card.group] : undefined;
    article.append(
      el(
        "p",
        "print-card-meta",
        `${group ? `${group.label} · ` : ""}Farbe: ${COLOR_NAMES[state.color]} · Kategorie: ${work.categories[state.color] || "ohne eigene Bezeichnung"}`,
      ),
    );
    return article;
  };
  startSection("cards");
  for (const card of mystery.cards) {
    await pause();
    const state = work.cards.find((c) => c.id === card.id)!;
    let article = await appendText(
      card.text,
      (first) => cardFragment(card, state, first),
      "cardText",
      card.id,
    );
    if (card.source)
      article = await appendText(
        `Quelle: ${card.source}`,
        () => cardFragment(card, state, false),
        "cardSource",
        card.id,
      );
    if (card.table)
      article = await appendText(
        `${card.table.caption || "Tabelle"}\n` +
          card.table.rows
            .map(
              (row, i) =>
                `Zeile ${i + 1}: ` +
                row
                  .map((value, j) => `${card.table!.headers[j]}: ${value}`)
                  .join(" | "),
            )
            .join("\n"),
        () => cardFragment(card, state, false),
        "cardTable",
        card.id,
      );
    const related = work.edges.filter(
      (e) => e.from === card.id || e.to === card.id,
    );
    if (!related.length)
      article = await appendRow(
        article,
        el("p", "print-reference-row", "Keine Verbindungen."),
        () => cardFragment(card, state, false),
      );
    for (const edge of related) {
      const row = el("p", "print-reference-row", "Beziehung: ");
      row.append(reference("edge", edge.id, printDirection(edge, mystery)));
      article = await appendRow(article, row, () =>
        cardFragment(card, state, false),
      );
    }
    if (card.image) {
      const row = el("p", "print-reference-row");
      row.append(
        reference(
          "image",
          card.id,
          `Großes Bild zu Karte ${cardNumber(mystery, card.id)}`,
        ),
      );
      await appendRow(article, row, () => cardFragment(card, state, false));
    }
  }
  for (const card of mystery.cards.filter((c) => c.image)) {
    await pause();
    const page = createPage("images");
    page.node.id = `image-${card.id}`;
    page.node.dataset.imageCard = String(card.id);
    const caption = el(
      "p",
      "print-image-caption",
      `Karte ${cardNumber(mystery, card.id)}: ${card.title}. ${card.imageAlt || ""}`,
    );
    const back = el("p", "print-image-caption");
    back.append(
      reference(
        "card",
        card.id,
        `Karte ${cardNumber(mystery, card.id)}: Text und Beziehungen`,
      ),
    );
    const image = el("img", "print-card-image");
    image.dataset.cardImage = String(card.id);
    image.alt = card.imageAlt || card.title;
    page.body.append(caption, back);
    image.src = card.image!;
    await image.decode().catch(() => {
      throw new Error(
        `Das Bild von Karte ${cardNumber(mystery, card.id)} konnte nicht für den Druck geladen werden.`,
      );
    });
    ensureActive();
    const bodyBox = page.body.getBoundingClientRect(),
      used = back.getBoundingClientRect().bottom - bodyBox.top;
    const availableHeight = bodyBox.height - used - 24;
    if (availableHeight <= 0)
      throw new Error(
        "Die Bildbeschreibung ist für diese Papiergröße zu lang. Bitte verwendet A3.",
      );
    const ratio = Math.min(
      bodyBox.width / image.naturalWidth,
      availableHeight / image.naturalHeight,
    );
    image.style.width = `${image.naturalWidth * ratio}px`;
    image.style.height = `${image.naturalHeight * ratio}px`;
    page.body.append(image);
    // Decode one embedded asset at a time; reuse its cached source in the overview.
    const overviewImage = svg.querySelector<SVGImageElement>(
      `[data-overview-image="${card.id}"]`,
    );
    if (overviewImage) {
      const box = fitImage(image.naturalWidth, image.naturalHeight, {
        x: Number(overviewImage.getAttribute("x")),
        y: Number(overviewImage.getAttribute("y")),
        width: Number(overviewImage.getAttribute("width")),
        height: Number(overviewImage.getAttribute("height")),
      });
      for (const [name, value] of Object.entries(box))
        overviewImage.setAttribute(name, String(value));
      overviewImage.setAttribute("href", card.image!);
    }
  }
  startSection("relations");
  if (!work.edges.length)
    column.append(
      el("p", undefined, "Es wurden noch keine Verbindungen angelegt."),
    );
  for (const edge of work.edges) {
    await pause();
    await appendText(
      edge.label,
      (first) => {
        const article = el("article", "print-item");
        article.dataset.edgePart = String(edge.id);
        if (first) {
          article.dataset.edgeId = String(edge.id);
          article.id = `edge-${edge.id}`;
          article.dataset.from = String(edge.from);
          article.dataset.to = String(edge.to);
          article.dataset.direction = String(edge.direction);
        }
        article.append(
          el(
            "h3",
            "print-edge-title",
            `Verbindung ${printDirection(edge, mystery)}${first ? "" : " (Fortsetzung)"}`,
          ),
        );
        const endpoints = el("p", "print-reference-row");
        endpoints.append(
          reference(
            "card",
            edge.from,
            `Karte ${cardNumber(mystery, edge.from)}`,
          ),
          doc.createTextNode(" · "),
          reference("card", edge.to, `Karte ${cardNumber(mystery, edge.to)}`),
        );
        article.append(endpoints);
        if (!edge.label)
          article.append(el("p", "print-empty-label", "Ohne Beschriftung."));
        return article;
      },
      "edgeLabel",
      edge.id,
    );
  }
  for (const ref of references) {
    if (!ref.link.isConnected) continue;
    const destination = doc
      .getElementById(ref.target)
      ?.closest<HTMLElement>(".print-page");
    if (!destination) {
      // Binary-search candidates that were moved before placement are detached.
      if (!ref.link.isConnected) continue;
      throw new Error(
        "Ein Seitenverweis konnte nicht vollständig erzeugt werden.",
      );
    }
    ref.page.textContent = `Seite ${destination.dataset.page}`;
    ref.link.dataset.targetPage = destination.dataset.page;
  }
  for (const page of pages) {
    page.node.querySelector(".print-page-number")!.textContent =
      `Seite ${page.node.dataset.page} von ${pages.length}`;
    const bodyBox = page.body.getBoundingClientRect();
    for (const item of page.body.querySelectorAll<HTMLElement>(
      ".print-item, .print-card-image",
    )) {
      const box = item.getBoundingClientRect();
      if (
        box.bottom > bodyBox.bottom + 0.5 ||
        box.top < bodyBox.top - 0.5 ||
        box.left < bodyBox.left - 0.5 ||
        box.right > bodyBox.right + 0.5
      )
        throw new Error(
          "Die Druckfassung passt nicht vollständig auf die Seiten. Bitte verwendet A3.",
        );
    }
  }
  ensureActive();
  doc.body.dataset.printReady = "true";
  doc.body.dataset.pageCount = String(pages.length);
  return { pageCount: pages.length };
}
