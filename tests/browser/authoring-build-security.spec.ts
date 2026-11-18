import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { relative } from "node:path";
import source from "../../examples/universal/content.json" with { type: "json" };

test("Spezifischer Build behandelt auch gemischte Script-Endtags im Inhalt ausschließlich als Text", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const input = info.outputPath("inhalt.json"),
    output = info.outputPath("MysteryBoard-Textpruefung.html");
  const content = structuredClone(source);
  const literal =
    '</ScRiPt><script>window.MYSTERY_INJECTED=true</script><img src="https://example.invalid/unerwuenscht" onerror="window.MYSTERY_INJECTED=true">';
  content.cards[0].text = literal;
  await mkdir(info.outputPath(), { recursive: true });
  await writeFile(input, JSON.stringify(content));
  const log = execFileSync(
    process.execPath,
    ["scripts/mystery-tools.mjs", "build", input, output],
    { encoding: "utf8" },
  );
  await info.attach("cli-build", { body: log, contentType: "text/plain" });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      requests.push(r.url());
  });
  await page.goto("http://localhost:5174/" + relative(process.cwd(), output));
  await page.context().setOffline(true);
  await expect(
    page.getByRole("heading", { name: source.title, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Textprüfung");
  await page.getByRole("button", { name: "Beginnen", exact: true }).click();
  await page.locator('[data-number="1"]').click();
  await expect(page.locator(".reading > p").first()).toHaveText(literal);
  expect(
    await page.evaluate(() => (window as any).MYSTERY_INJECTED),
  ).toBeUndefined();
  expect(requests).toEqual([]);
  expect((await readFile(output)).length).toBeLessThan(10_000_000);
});
