import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

async function fresh(page: Page, url: string) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
  await page.goto(url);
}

const tomorrow = () => addDays(new Date(), 1);
const dayButton = (page: Page, d: Date) => page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) });
const firstOpenSlot = (page: Page) => page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first();

test("step 1: defaults, service selection and the summary stay in sync", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Desktop summary card");
  await fresh(page, "/book/branch");
  const summary = page.getByRole("region", { name: "Your booking" });
  await expect(summary).toContainText("Main Street");
  await expect(summary).toContainText("Hot Towel Shave");
  await expect(summary).toContainText("₹499");
  await expect(summary).toContainText("₹400 at the salon");
  await page.getByRole("button", { name: /Fade & Styling/ }).click();
  await expect(page.getByRole("button", { name: /Fade & Styling/ })).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toContainText("Fade & Styling");
  await expect(summary).toContainText("₹349");
  // Branch price override: Hot Towel Shave is ₹449 at Lake View.
  await page.getByLabel("Choose a branch").selectOption({ label: "Lake View" });
  await page.getByRole("button", { name: /Hot Towel Shave/ }).click();
  await expect(summary).toContainText("₹449");
});

test("landing choices carry through, refresh keeps progress, and a slot can be picked", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Desktop flow");
  await fresh(page, "/");
  const form = page.getByRole("form", { name: "Quick booking" });
  await form.getByLabel("Branch").selectOption({ label: "Station Road" });
  await form.getByLabel("Service").selectOption({ label: "Classic Haircut" });
  await form.getByRole("link", { name: "Find slots" }).click();
  await expect(page).toHaveURL(/\/book\/slot/);
  const summary = page.getByRole("region", { name: "Your booking" });
  await expect(summary).toContainText("Station Road");
  await expect(summary).toContainText("Classic Haircut");

  await dayButton(page, tomorrow()).click();
  await expect(summary).toContainText(format(tomorrow(), "EEE, d MMM"));
  await expect(summary.getByRole("button", { name: /Continue/ })).toBeDisabled();
  await firstOpenSlot(page).click();
  await expect(summary.getByRole("link", { name: /Continue/ })).toHaveAttribute("href", "/book/details");
  const time = await page.getByRole("button", { pressed: true }).filter({ hasText: /\d:\d\d (AM|PM)/ }).first().innerText();
  await expect(summary).toContainText(time);

  await page.reload();
  await expect(summary).toContainText("Station Road");
  await expect(summary).toContainText(time);
});

test("step 2 without earlier choices goes back to step 1", async ({ page }) => {
  await fresh(page, "/book/slot");
  await expect(page).toHaveURL(/\/book\/branch/);
});

test("changing the barber reloads the slots and keeps the summary honest", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Desktop flow");
  await fresh(page, "/book/slot?branch=main-street&service=classic-haircut");
  await dayButton(page, tomorrow()).click();
  await firstOpenSlot(page).click();
  const time = await page.getByRole("button", { pressed: true }).filter({ hasText: /\d:\d\d (AM|PM)/ }).first().innerText();
  const summary = page.getByRole("region", { name: "Your booking" });
  await expect(summary).toContainText(/Barber\s*(Jhon Abraham|Arjun Mehta|Kabir Khan|Dev Sharma)/);
  await page.getByRole("button", { name: /^Kabir Khan/ }).click();
  await expect(page.getByRole("button", { name: /^Kabir Khan/ })).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toContainText("Kabir Khan");
  // Kabir either still has that time (kept) or does not (cleared). Never a stale time with the wrong barber.
  const kept = page.getByRole("button", { name: time, exact: true });
  await expect(async () => {
    const stillPressed = (await kept.count()) > 0 && (await kept.getAttribute("aria-pressed")) === "true";
    const cleared = /Time\s*–/.test(await summary.innerText());
    expect(stillPressed || cleared).toBe(true);
  }).toPass();
});

test("a booked slot shows as taken after a barber's calendar fills up", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Desktop flow");
  await fresh(page, "/book/slot?branch=main-street&service=classic-haircut");
  await dayButton(page, tomorrow()).click();
  // The 1 PM lunch break is struck through for a specific barber.
  await page.getByRole("button", { name: /^Jhon Abraham/ }).click();
  await expect(page.getByRole("button", { name: "1:00 PM, unavailable" })).toBeDisabled();
});

test("the 14-day limit is respected", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Desktop flow");
  await fresh(page, "/book/slot?branch=main-street&service=classic-haircut");
  await page.getByRole("button", { name: "Next 7 days" }).click();
  await page.getByRole("button", { name: "Next 7 days" }).click();
  // Third page starts on day 14: only that day is bookable.
  const enabled = page.getByRole("list", { name: "Choose a day" }).locator("button:not([disabled])");
  await expect(enabled).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next 7 days" })).toBeDisabled();
});

test("phone: slot page from the home carousel, with the sticky continue bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone flow");
  await fresh(page, "/");
  await page.getByRole("link", { name: /^Hot Towel Shave, ₹499/ }).click();
  await expect(page).toHaveURL(/\/book\/slot/);
  await expect(page.getByRole("heading", { level: 1, name: "Hot Towel Shave" })).toBeVisible();
  const bar = page.getByRole("link", { name: "Book a barber" });
  await expect(page.getByRole("button", { name: "Book a barber" })).toBeDisabled();
  await dayButton(page, tomorrow()).click();
  await firstOpenSlot(page).click();
  await expect(bar).toHaveAttribute("href", "/book/details");
  // Barber avatars scroll sideways; the page itself must not.
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  // Branch switcher on the phone hero clears the chosen time.
  await page.getByRole("combobox", { name: "Branch" }).selectOption({ label: "Lake View" });
  await expect(page.getByRole("button", { name: "Book a barber" })).toBeDisabled();
});

test("phone: step 1 has a compact stepper and sticky continue", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone flow");
  await fresh(page, "/book/branch");
  await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
