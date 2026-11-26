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
  let base = project;
  const trimBoundary = (value: string, repeated: string) => {
    // Remove whole components only, so "Basis" never shortens "Basiswissen".
    const v = key(value),
      r = key(repeated);
    if (v.startsWith(r) && /^[._-]/.test(value.slice(repeated.length)))
      return value.slice(repeated.length).replace(/^[._-]+/, "");
    if (v.endsWith(r) && /[._-]$/.test(value.slice(0, -repeated.length)))
      return value.slice(0, -repeated.length).replace(/[._-]+$/, "");
    return value;
  };
  if (label) {
    if (key(label) === key(project)) label = "";
    else {
      label = trimBoundary(label, project);
      base = trimBoundary(base, label);
    }
  }
  const suffix = all ? "_alle_Niveaus" : label ? "_" + shorten(label, 65) : "";
  return shorten(base, 120) + "_SCORM" + suffix + ".zip";
}
