import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

async function boot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
}

async function signIn(page: Page) {
  await page.evaluate(() => localStorage.setItem("barbr-admin-session", JSON.stringify({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" })));
}

async function scan(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n   ")}`);
  expect(summary, `${name} has accessibility problems`).toEqual([]);
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  test("public pages", async ({ page }) => {
    await boot(page);
    for (const [name, path] of [["landing", "/"], ["step 1", "/book/branch"], ["step 2", "/book/slot?branch=main-street&service=hot-towel-shave"]] as const) {
      await page.goto(path);
      await page.waitForTimeout(900);
      await scan(page, name);
    }
    // Step 3 and the confirmation need a slot.
    const d = addDays(new Date(), 1);
    await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
    await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
    await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
    await page.getByLabel("Full name").waitFor();
    await page.waitForTimeout(500);
    await scan(page, "step 3");
    await page.getByLabel("Full name").fill("Asha Rao");
    await page.getByLabel("Mobile number").fill("9811122233");
    await page.getByLabel("UPI ID").fill("asha@okbank");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Confirm & pay/ }).click();
    await page.getByRole("dialog", { name: "Secure checkout" }).waitFor();
    await scan(page, "payment sheet");
    await page.getByRole("button", { name: /^Pay ₹99/ }).click();
    await page.waitForURL(/confirmed/);
    await page.getByRole("heading", { name: "You're booked!" }).waitFor();
    await scan(page, "confirmation");
  });

  test("owner panel", async ({ page }) => {
    await boot(page);
    await page.goto("/admin/login");
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    await scan(page, "admin login");
    await signIn(page);
    for (const [name, path, ready] of [
      ["dashboard", "/admin", "Good"],
      ["bookings", "/admin/bookings?range=month&ref=BR-20481", "Bookings"],
      ["calendar", "/admin/calendar", "Calendar"],
      ["branches", "/admin/branches", "Branches & fees"],
      ["coming soon", "/admin/customers", "Customers"],
    ] as const) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1, name: new RegExp(ready) }).waitFor();
      await page.waitForTimeout(900);
      await scan(page, name);
    }
    await page.goto("/admin/branches");
    await page.getByRole("button", { name: "Manage Station Road" }).click();
    await page.getByRole("dialog", { name: "Manage branch" }).waitFor();
    await scan(page, "manage branch drawer");
  });
});
