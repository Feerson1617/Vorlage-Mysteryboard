import type { HelpCategory, Mystery } from "./model";
export const DEFAULT_METHOD_HELP =
  "Sucht euch eine Beobachtung aus, die ihr erklären möchtet. Welche Karten enthalten Informationen, die euch dabei helfen könnten?";
export function helpForCard(
  m: Mystery,
  id: number,
  active: boolean,
): HelpCategory | undefined {
  return active
    ? m.help?.categories?.find((category) => category.cardIds.includes(id))
    : undefined;
}
export function numberTextColor(background: string): "#000000" | "#ffffff" {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(background.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
