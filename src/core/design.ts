import { numberTextColor, relativeLuminance } from "./help.ts";

export type Design = {
  font?: "sans" | "serif";
  fontSize?: number;
  textColor?: string;
  cardColor?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  spacing?: number;
  background?: string;
  edgeColor?: string;
  edgeWidth?: number;
  edgeDash?: boolean;
  arrowHead?: "triangle" | "open";
  direction?: 0 | 1 | 2;
  labelSize?: number;
  labelBackground?: string;
};
export const DEFAULT_DESIGN: Required<Design> = {
  font: "sans",
  fontSize: 16,
  textColor: "#343f38",
  cardColor: "#ffffff",
  borderColor: "#bcc8c0",
  borderWidth: 1.3,
  radius: 10,
  spacing: 80,
  background: "#edf1ed",
  edgeColor: "#526558",
  edgeWidth: 2,
  edgeDash: false,
  arrowHead: "triangle",
  direction: 1,
  labelSize: 14,
  labelBackground: "#f7f8f7",
};
export const designOf = (m: { design?: Design }) => ({
  ...DEFAULT_DESIGN,
  ...m.design,
});
export function cardAppearance(
  card: { backgroundColor?: string },
  design: Required<Design>,
  mark?: string,
) {
  const background = mark ?? card.backgroundColor ?? design.cardColor;
  if (!card.backgroundColor) return { background, text: design.textColor };
  const backgroundLuminance = relativeLuminance(background);
  const textLuminance = relativeLuminance(design.textColor);
  const contrast =
    (Math.max(backgroundLuminance, textLuminance) + 0.05) /
    (Math.min(backgroundLuminance, textLuminance) + 0.05);
  return {
    background,
    text: contrast >= 4.5 ? design.textColor : numberTextColor(background),
  };
}
export const designFont = (d: Design | undefined) =>
  d?.font === "serif"
    ? 'Georgia, "Times New Roman", serif'
    : "Arial, Helvetica, sans-serif";
export const DESIGN_LIMITS = {
  fontSize: [14, 22],
  borderWidth: [1, 4],
  radius: [0, 22],
  spacing: [40, 160],
  edgeWidth: [1, 6],
  labelSize: [12, 20],
} as const;
export function validateDesign(v: unknown): asserts v is Design {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Ungültige Gestaltung.");
  for (const [k, x] of Object.entries(v)) {
    if (!Object.hasOwn(DEFAULT_DESIGN, k))
      throw Error("Unbekannte Gestaltungseinstellung.");
    if (k in DESIGN_LIMITS) {
      const [min, max] = DESIGN_LIMITS[k as keyof typeof DESIGN_LIMITS];
      if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
        throw Error("Ungültige Gestaltungsgröße.");
    } else if (k === "font") {
      if (!["sans", "serif"].includes(String(x)))
        throw Error("Ungültige Schrift.");
    } else if (k === "arrowHead") {
      if (!["triangle", "open"].includes(String(x)))
        throw Error("Ungültige Pfeilspitze.");
    } else if (k === "direction") {
      if (![0, 1, 2].includes(x as number))
        throw Error("Ungültige Pfeilrichtung.");
    } else if (k === "edgeDash") {
      if (typeof x !== "boolean") throw Error("Ungültiger Linienstil.");
    } else if (typeof x !== "string" || !/^#[0-9a-fA-F]{6}$/.test(x))
      throw Error("Ungültige Gestaltungsfarbe.");
  }
}
