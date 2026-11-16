// Keep names meaningful on macOS/iPadOS and common exchange filesystems.
// The 200-byte UTF-8 budget includes the separator and .png extension.
const clean = (name: string) =>
  name
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/u, "")
    .trim();
const bytes = (name: string) => new TextEncoder().encode(name).length;
function shorten(name: string, budget: number) {
  let result = "";
  for (const char of name) {
    if (bytes(result + char) > budget) break;
    result += char;
  }
  return result.replace(/[. ]+$/u, "");
}
export function backupFilename(team: string, title: string): string {
  const cleanedTeam = clean(team),
    cleanedTitle = clean(title);
  if (!cleanedTeam)
    throw new Error(
      "Bitte ergänzt euren Teamnamen um sichtbare, für Dateinamen geeignete Zeichen.",
    );
  if (!cleanedTitle)
    throw new Error(
      "Der Mystery-Titel enthält keine für Dateinamen geeigneten Zeichen. Bittet eure Lehrkraft, den Titel anzupassen.",
    );
  const namedTeam = shorten(cleanedTeam, 96),
    namedTitle = shorten(cleanedTitle, 195 - bytes(namedTeam));
  return `${namedTeam}_${namedTitle}.png`;
}
