import type { Mystery } from "./model";
import { validateContent, type Content } from "./documents";
import { inspectDataImage } from "./media";

// Only called for trusted build-time content, never for an imported SVG file.
// Old built-in SVG illustrations become passive raster media in portable files.
export async function portableBuiltin(m: Mystery): Promise<Content> {
  const cards = [];
  for (const original of m.cards) {
    const card = { ...original, group: original.group ?? "required" };
    if (card.image?.startsWith("data:image/svg+xml;base64,")) {
      const image = new Image();
      image.src = card.image;
      await image.decode();
      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > 4_000_000 ||
        Math.max(image.naturalWidth, image.naturalHeight) > 4096
      )
        throw new Error(
          "Dieses eingebaute Bild muss vor dem Autorenimport verkleinert werden.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Bildumwandlung nicht verfügbar.");
        ctx.drawImage(image, 0, 0);
        card.image = canvas.toDataURL("image/png");
        inspectDataImage(card.image);
      } finally {
        canvas.width = canvas.height = 1;
      }
    }
    cards.push(card);
  }
  return validateContent({
    ...m,
    cards,
    cardGroups: {
      required: { label: "Pflichtkarte", prefix: "" },
      extension: { label: "Vertiefungskarte", prefix: "V" },
      ...m.cardGroups,
    },
    startLayout: { mode: "ordered" },
    initial: undefined,
  });
}
