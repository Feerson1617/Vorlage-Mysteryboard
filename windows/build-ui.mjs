// Vite uses slash-normalized module IDs on Windows. Normalize only the build
// process's cwd so the frozen license/boundary audit sees the same relative IDs.
const cwd = process.cwd();
process.cwd = () => cwd.replaceAll('\\', '/');
await import('../scripts/studio/build.mjs');
