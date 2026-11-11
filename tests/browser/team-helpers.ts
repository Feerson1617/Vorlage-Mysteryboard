import type { Page } from "@playwright/test";

// Explicit UI input used by regression tests, never an application fallback.
export const TEST_TEAM = "Testgruppe";
export async function fillTeam(page: Page, name = TEST_TEAM) {
  await page.getByLabel("Teamname oder Vornamen", { exact: true }).fill(name);
}

// Legacy saves remain teamless on import. Only when a test actually requests a
// new student export do we complete the application's visible name prompt.
export async function completeExportTeam(
  page: Page,
  { touch = false, name = TEST_TEAM }: { touch?: boolean; name?: string } = {},
) {
  const prompt = page.getByRole("dialog", {
    name: "Teamname ändern",
    exact: true,
  });
  if (!(await prompt.isVisible())) return false;
  await fillTeam(page, name);
  const submit = prompt.getByRole("button", {
    name: "Übernehmen",
    exact: true,
  });
  if (touch) await submit.tap();
  else await submit.click();
  return true;
}
