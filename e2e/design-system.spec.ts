import { test, expect } from "@playwright/test";

test("design system page renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/design-system");
  await expect(page.getByRole("heading", { name: "Design system", level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
