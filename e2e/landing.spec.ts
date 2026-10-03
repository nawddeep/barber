import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
  await page.reload();
}

test("landing renders its sections with live mock data", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Book your next grooming");
  await expect(page.getByRole("heading", { name: "Three taps to your chair" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find your branch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hold your slot your way" })).toBeVisible();
  // Branch cards show a status chip and next slot from the mock API.
  const cards = page.locator("#branches article");
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toContainText(/Open now|Busy today|Closed now/);
  await expect(cards.first()).toContainText(/Next slot \d{1,2}:\d{2} (AM|PM)/);
  await expect(cards.last()).toContainText("Paused");
  await expect(cards.last().getByRole("button", { name: "Book here" })).toBeDisabled();
});

test("quick-book card carries its choices into the flow", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "The quick-book card is desktop only; phones use the home carousel");
  await open(page);
  const form = page.getByRole("form", { name: "Quick booking" });
  await expect(form.getByLabel("Date")).not.toHaveValue("");
  await form.getByLabel("Branch").selectOption({ label: "Station Road" });
  await form.getByLabel("Service").selectOption({ label: "Fade & Styling" });
  await form.getByLabel("Date").fill("2026-10-05");
  const href = await form.getByRole("link", { name: "Find slots" }).getAttribute("href");
  expect(href).toBe("/book/slot?branch=station-road&service=fade-styling&date=2026-10-05");
});

test("service cards and branch buttons preselect their choice", async ({ page, isMobile }) => {
  await open(page);
  if (!isMobile) {
    await expect(page.getByRole("link", { name: /^Classic Haircut, ₹299/ })).toHaveAttribute("href", "/book/branch?service=classic-haircut");
  }
  await expect(page.locator("#branches").getByRole("link", { name: "Book here" }).nth(1)).toHaveAttribute("href", "/book/branch?branch=station-road");
});

test("phone layout: branch selector, service carousel and bottom nav", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone layout only");
  await open(page);
  await expect(page.getByRole("combobox", { name: "Branch" })).toBeVisible();
  await page.getByRole("combobox", { name: "Branch" }).selectOption({ label: "Lake View" });
  const first = page.getByRole("link", { name: /^Hot Towel Shave, ₹449/ }); // Lake View price override
  await expect(first).toHaveAttribute("href", "/book/slot?branch=lake-view&service=hot-towel-shave");
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("no horizontal overflow", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
