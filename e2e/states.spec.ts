import { test, expect, type Page } from "@playwright/test";

const setErrors = (page: Page, mode: "off" | "payment" | "all") =>
  page.evaluate((m) => localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: m })), mode);

async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
    localStorage.setItem("barbr-admin-session", JSON.stringify({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" }));
  });
}

test.describe("offline", () => {
  test("a notice appears while the connection is down and goes away when it is back", async ({ page, context }) => {
    await fresh(page);
    await page.goto("/");
    await expect(page.getByText(/You're offline/)).toHaveCount(0);
    await context.setOffline(true);
    const notice = page.getByRole("status").filter({ hasText: "You're offline" });
    await expect(notice).toBeVisible();
    await context.setOffline(false);
    await expect(notice).toHaveCount(0);
  });
});

test.describe("when loading fails, people get a retry, not a dead end", () => {
  test("times on step 2", async ({ page }) => {
    await fresh(page);
    await page.goto("/book/slot?branch=main-street&service=hot-towel-shave");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(600);
    await setErrors(page, "all");
    await page.goto("/book/slot");
    const alert = page.getByRole("alert").filter({ hasText: "Could not load the times" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Nothing you picked was lost");
    await setErrors(page, "off");
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^\d{1,2}:\d\d (AM|PM)/ }).first()).toBeVisible();
  });

  test("the booking confirmation", async ({ page }) => {
    await fresh(page);
    await page.goto("/");
    await page.waitForTimeout(600);
    await setErrors(page, "all");
    await page.goto("/book/confirmed/BR-20481");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await setErrors(page, "off");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
  });

  test("a link into the booking flow does not hang when the data is down", async ({ page }) => {
    await fresh(page);
    await page.goto("/");
    await page.waitForTimeout(600);
    await setErrors(page, "all");
    await page.goto("/book/slot?branch=main-street&service=hot-towel-shave");
    // It finishes loading (and falls back to step 1) instead of showing a skeleton forever.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading your booking" })).toHaveCount(0);
  });

  test("the dashboard, bookings, calendar and branches", async ({ page }) => {
    await fresh(page);
    await page.goto("/admin");
    await expect(page.getByTestId("kpi-bookings")).toBeVisible();
    await setErrors(page, "all");
    for (const [path, message] of [
      ["/admin", "Could not load the dashboard"],
      ["/admin/bookings?range=month", "Could not load bookings."],
      ["/admin/calendar", "Could not load the calendar."],
      ["/admin/branches", "Could not load the branches."],
    ] as const) {
      await page.goto(path);
      const alert = page.getByRole("alert").filter({ hasText: message });
      await expect(alert).toBeVisible();
      await setErrors(page, "off");
      await alert.getByRole("button", { name: "Try again" }).click();
      await expect(alert).toHaveCount(0);
      await setErrors(page, "all");
    }
  });
});

test.describe("a paused branch", () => {
  test("a link to it explains and falls back to an open branch", async ({ page }) => {
    await fresh(page);
    await page.goto("/book/branch?branch=city-mall&service=hot-towel-shave");
    const note = page.getByRole("alert").filter({ hasText: "City Mall is not taking bookings right now" });
    await expect(note).toBeVisible();
    await expect(page.getByLabel("Choose a branch")).toHaveValue("main-street");
    await note.getByRole("button", { name: "Dismiss message" }).click();
    await expect(note).toHaveCount(0);
  });

  test("a branch paused after it was chosen is replaced, with a message", async ({ page }) => {
    await fresh(page);
    await page.goto("/book/branch");
    await page.getByLabel("Choose a branch").selectOption({ label: "Lake View" });
    await expect(page.getByLabel("Choose a branch")).toHaveValue("lake-view");
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
      db.branches.find((b: { id: string }) => b.id === "lake-view").paused = true;
      localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
    });
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "not taking bookings right now, so we picked another one" })).toBeVisible();
    await expect(page.getByLabel("Choose a branch")).not.toHaveValue("lake-view");
  });

  test("the landing page shows it as paused and cannot be booked", async ({ page }) => {
    await fresh(page);
    await page.goto("/");
    const card = page.locator("#branches article", { hasText: "City Mall" });
    await expect(card).toContainText("Paused");
    await expect(card.getByRole("button", { name: "Book here" })).toBeDisabled();
  });
});

test.describe("keyboard and screen readers", () => {
  test("focus rings are yellow on dark green and orange on cream", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Keyboard focus is checked on desktop");
    await fresh(page);
    await page.goto("/");
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // the logo, inside the dark green hero
    const ring = async () => {
      await page.waitForTimeout(350); // buttons fade their outline in
      return page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { color: s.outlineColor, width: s.outlineWidth, style: s.outlineStyle };
      });
    };
    expect(await ring()).toEqual({ color: "rgb(248, 220, 85)", width: "3px", style: "solid" });
    await page.goto("/book/branch");
    await page.getByRole("button", { name: /Classic Haircut/ }).waitFor();
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /Classic Haircut/ }).focus();
    expect(await ring()).toEqual({ color: "rgb(232, 115, 42)", width: "3px", style: "solid" });
    // The admin sidebar is dark green too.
    await page.goto("/admin");
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Bookings" }).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect((await ring()).color).toBe("rgb(248, 220, 85)");
  });

  test("a skip link jumps to the content", async ({ page }) => {
    await fresh(page);
    await page.goto("/book/branch");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("every icon-only button has a name and the toast is announced politely", async ({ page, isMobile }) => {
    await fresh(page);
    await page.goto("/admin/branches");
    await page.getByRole("switch", { name: "Bookings open at Lake View" }).click();
    const live = page.locator('[aria-live="polite"][role="status"]').filter({ hasText: /Lake View paused/ });
    await expect(live).toBeVisible();
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .filter((el) => !(el.textContent ?? "").trim() && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.querySelector("img[alt]:not([alt=''])"))
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
    void isMobile;
  });

  test("reduced motion switches animation off", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await fresh(page);
    await page.goto("/admin/branches");
    // The loading skeletons pulse normally; with reduced motion their animation is effectively instant.
    await page.evaluate(() => { const d = document.createElement("div"); d.className = "animate-pulse"; d.id = "probe"; document.body.appendChild(d); });
    const duration = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("probe")!).animationDuration));
    expect(duration).toBeLessThan(0.001);
    await ctx.close();
  });
});
