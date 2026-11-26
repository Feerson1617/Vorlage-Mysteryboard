function component(value: string) {
  return value
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}.-]+/gu, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
}
// Leave room for the extension and level suffix on byte-limited filesystems.
function shorten(value: string, limit: number) {
  const encoder = new TextEncoder();
  let result = "",
    bytes = 0;
  for (const char of value) {
    bytes += encoder.encode(char).length;
    if (bytes > limit) break;
    result += char;
  }
  return result.replace(/[._-]+$/, "");
}
export function scormName(title: string, level?: string, all = false) {
  const project = component(title) || "Mystery";
  let label = component(level ?? "");
  const key = (s: string) => s.toLocaleLowerCase("de");
  if (label && key(label).startsWith(key(project) + "_"))
    label = label.slice(project.length + 1);
  let base = project;
  if (label && key(base).endsWith("_" + key(label)))
    base = base.slice(0, -label.length - 1);
  const suffix = all
    ? "_alle_Niveaus"
    : level
      ? "_" + shorten(label || "Niveau", 65)
      : "";
  return shorten(base, 120) + "_SCORM" + suffix + ".zip";
}
