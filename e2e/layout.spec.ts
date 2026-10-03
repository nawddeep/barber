import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

// Runs once (desktop project); each test sets its own window size.
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "Sizes are set per test"));

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

async function boot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
}
const signIn = (page: Page) => page.evaluate(() => localStorage.setItem("barbr-admin-session", JSON.stringify({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" })));

/** Anything wider than the window, and anything a thumb could miss (under 44px), with known exceptions. */
async function problems(page: Page) {
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const out: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${innerWidth})`);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    for (const el of document.querySelectorAll('a[href], button, select, textarea, input:not([type=hidden]), [role=switch], [role=radio], [role=tab]')) {
      if (!visible(el) || el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      if (el.closest("dialog:not([open])")) continue;
      // Calendar blocks are drawn to the clock (72px an hour), so a 30 minute booking is 34px tall. Reschedule and
      // the booking panel are the roomy alternatives, and the block is still wider than 44px.
      if (el.hasAttribute("data-block")) continue;
      // A checkbox is operated through its label, which is full height.
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        const label = el.closest("label");
        if (label && label.getBoundingClientRect().height >= 44) continue;
      }
      if (el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 30);
        out.push(`${el.tagName.toLowerCase()} "${label}" is ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)];
  });
}

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("public pages: nothing overflows and everything is easy to tap", async ({ page }) => {
      await boot(page);
      for (const [name, path] of [["landing", "/"], ["step 1", "/book/branch"], ["step 2", "/book/slot?branch=main-street&service=hot-towel-shave"]] as const) {
        await page.goto(path);
        expect(await problems(page), name).toEqual([]);
      }
      const d = addDays(new Date(), 1);
      await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
      await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
      await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
      await page.getByLabel("Full name").waitFor();
      expect(await problems(page), "step 3").toEqual([]);
      await page.goto("/book/confirmed/BR-20481");
      await page.getByRole("heading", { name: "You're booked!" }).waitFor();
      expect(await problems(page), "confirmation").toEqual([]);
    });

    test("owner panel: nothing overflows and everything is easy to tap", async ({ page }) => {
      await boot(page);
      await page.goto("/admin/login");
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      expect(await problems(page), "login").toEqual([]);
      await signIn(page);
      for (const [name, path] of [
        ["dashboard", "/admin"],
        ["bookings", "/admin/bookings?range=month"],
        ["bookings with details", "/admin/bookings?range=month&ref=BR-20481"],
        ["calendar", "/admin/calendar"],
        ["calendar week", "/admin/calendar?view=week"],
        ["branches", "/admin/branches"],
        ["coming soon", "/admin/customers"],
      ] as const) {
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).first().waitFor();
        expect(await problems(page), name).toEqual([]);
      }
    });
  });
}

test.describe("bookings and calendar details adapt to the window", () => {
  const open = async (page: Page, path: string) => {
    await boot(page);
    await signIn(page);
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
  };

  test("1440px: details sit beside the list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/admin/bookings?range=month&ref=BR-20481");
    await expect(page.getByRole("complementary", { name: "Booking details" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Booking details" })).toBeHidden();
    const table = await page.getByRole("table").boundingBox();
    expect(table!.width).toBeGreaterThan(600);
    for (const h of ["Customer", "Service · Barber", "Branch", "When", "Status"]) await expect(page.getByRole("columnheader", { name: new RegExp(h) })).toBeInViewport();
  });

  test("1024px: the list gets the whole width and details open as a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, "/admin/bookings?range=month");
    for (const h of ["Customer", "Service · Barber", "Branch", "When", "Status"]) await expect(page.getByRole("columnheader", { name: new RegExp(h) })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole("table").locator("tbody tr").first().getByRole("button").click();
    const drawer = page.getByRole("dialog", { name: "Booking details" });
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box!.width).toBeGreaterThan(430);
    expect(box!.width).toBeLessThan(480);
    expect(box!.x + box!.width).toBeCloseTo(1024, 0); // docked to the right edge
    await expect(page.getByRole("complementary", { name: "Booking details" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Close booking details" }).click();
    await expect(drawer).toBeHidden();
  });

  test("768px: cards instead of a table, details fill the screen", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, "/admin/bookings?range=month");
    await expect(page.getByRole("table")).toBeHidden();
    await page.locator("ul button[aria-pressed]").first().click();
    const sheet = page.getByRole("dialog", { name: "Booking details" });
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(766);
    expect(box!.height).toBeGreaterThanOrEqual(1020);
  });

  test("calendar details follow the same rule: beside the grid at 1440px, a drawer at 1024px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/admin/calendar");
    await page.locator("[data-block]").first().click();
    await expect(page.getByRole("complementary", { name: "Booking details" })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByRole("dialog", { name: "Booking details" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Booking details" })).toHaveCount(0);
  });
});
