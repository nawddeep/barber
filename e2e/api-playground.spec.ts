import { test, expect } from "@playwright/test";

test("mock API playground shows seeded data and books with a fee", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/dev/api");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Branch" })).toContainText("City Mall (paused)");
  await expect(page.getByText("Next free slot:")).toBeVisible();
  await page.getByRole("button", { name: "Book with fee" }).click();
  await expect(page.getByText("OK    confirmBooking")).toBeVisible();
  await expect(page.getByText(/Last booking: BR-\d+ · CONFIRMED/)).toBeVisible();
  expect(errors).toEqual([]);
});
