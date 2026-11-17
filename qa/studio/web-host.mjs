import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
export async function host(output) {
  const root = process.cwd();
  const server = createServer(async (req, res) => {
    try {
      const input = decodeURIComponent(req.url.split("?")[0]);
      const base = input.startsWith("/qa-evidence/") ? output : root;
      const path = resolve(
        base,
        input.startsWith("/qa-evidence/")
          ? input.slice("/qa-evidence/".length)
          : "." + input,
      );
      if (!path.startsWith(base + "/")) throw Error();
      const b = await readFile(path);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
        }[extname(path)] || "application/octet-stream",
      );
      if (path.includes("/studio/dist/studio/"))
        res.setHeader(
          "Content-Security-Policy",
          JSON.parse(await readFile("studio/dist/studio/security.json")).csp,
        );
      res.end(b);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
  };
}
