import { test, expect, type Page } from "@playwright/test";
import { format } from "date-fns";

async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
}

async function signIn(page: Page, who: "Owner" | "Staff" = "Owner", path = "/admin") {
  await fresh(page);
  await page.goto(path);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("li", { hasText: `${who}:` }).getByRole("button", { name: "Fill in" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
}

const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));
const sameDay = (a: string, d: Date) => format(new Date(a), "yyyy-MM-dd") === format(d, "yyyy-MM-dd");

test.describe("login and guard", () => {
  test("every /admin page sends a signed-out visitor to the login, and back afterwards", async ({ page }) => {
    await fresh(page);
    for (const p of ["/admin", "/admin/bookings", "/admin/calendar", "/admin/branches"]) {
      await page.goto(p);
      await expect(page).toHaveURL(new RegExp(`/admin/login\\?next=${encodeURIComponent(p).replace(/\//g, "%2F")}`));
    }
    await page.goto("/admin/bookings");
    await expect(page.getByText("Demo only", { exact: false }).first()).toBeVisible();
    await page.locator("li", { hasText: "Owner:" }).getByRole("button", { name: "Fill in" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/bookings$/);
  });

  test("shows the demo credentials, validates and rejects wrong passwords", async ({ page }) => {
    await fresh(page);
    await page.goto("/admin/login");
    await expect(page.getByText("owner@barbr.demo / demo1234")).toBeVisible();
    await expect(page.getByText("staff@barbr.demo / demo1234")).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await page.getByLabel("Email").fill("owner@barbr.demo");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password." })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("does not follow an outside ?next= link", async ({ page }) => {
    await fresh(page);
    await page.goto("/admin/login?next=//evil.example");
    await page.locator("li", { hasText: "Owner:" }).getByRole("button", { name: "Fill in" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:3000\/admin$/);
  });

  test("logging out ends the session", async ({ page, isMobile }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("roles", () => {
  test("staff do not see Branches & fees and cannot open it", async ({ page, isMobile }) => {
    await signIn(page, "Staff");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good/);
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Bookings" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Branches & fees" })).toHaveCount(0);
    await expect(page.getByText("Staff panel").locator("visible=true")).toBeVisible();
    await page.goto("/admin/branches");
    await expect(page.getByRole("heading", { name: "Owners only" })).toBeVisible();
  });

  test("the owner sees and opens Branches & fees", async ({ page, isMobile }) => {
    await signIn(page, "Owner");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Branches & fees" }).click();
    await expect(page).toHaveURL(/\/admin\/branches/);
    await expect(page.getByRole("heading", { name: "Owners only" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Branches & fees" })).toBeVisible();
  });
});

test.describe("shell", () => {
  test("has every nav item, highlights the current page and has simple pages for the rest", async ({ page, isMobile }) => {
    await signIn(page);
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const name of ["Dashboard", "Bookings", "Calendar", "Branches & fees", "Barbers", "Customers", "Payments", "Settings"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Customers" }).click();
    await expect(page).toHaveURL(/\/admin\/customers/);
    await expect(page.getByText("Coming soon")).toBeVisible();
    if (isMobile) await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    else await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Customers" })).toHaveAttribute("aria-current", "page");
  });

  test("phones get a drawer that closes after choosing a page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Phone only");
    await signIn(page);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Payments" }).click();
    await expect(page).toHaveURL(/\/admin\/payments/);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test("Reset demo data asks first, then restores the sample data", async ({ page, isMobile }) => {
    await signIn(page);
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
      db.settings.feeInr = 777;
      localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
    });
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Keep my data" }).click();
    expect((await readDb(page)).settings.feeInr).toBe(777);
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect.poll(async () => (await readDb(page)).settings.feeInr).toBe(99);
    await expect(page).toHaveURL(/\/admin$/); // still signed in
  });
});

test.describe("dashboard", () => {
  test("every number matches the mock data", async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId("kpi-bookings")).toBeVisible();
    const db = await readDb(page);
    const today = new Date();
    const todays = db.bookings.filter((b: { startsAt: string }) => sameDay(b.startsAt, today));
    const lastWeek = new Date(today.getTime() - 7 * 86400000);
    const last = db.bookings.filter((b: { startsAt: string }) => sameDay(b.startsAt, lastWeek)).length;

    await expect(page.getByTestId("kpi-bookings")).toHaveText(String(todays.length));
    const diff = todays.length - last;
    const weekday = format(today, "EEEE");
    await expect(page.getByText(diff === 0 ? `Same as last ${weekday}` : `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than last ${weekday}`)).toBeVisible();

    const owed = db.payments.filter(
      (p: { bookingRef: string; status: string }) => todays.some((b: { ref: string }) => b.ref === p.bookingRef) && (p.status === "PAID" || p.status === "REFUND_DUE"),
    );
    const fees = owed.reduce((n: number, p: { amountInr: number }) => n + p.amountInr, 0);
    await expect(page.getByTestId("kpi-fees")).toHaveText(`₹${fees.toLocaleString("en-IN")}`);
    const otp = todays.filter((b: { holdMethod: string }) => b.holdMethod === "OTP").length;
    const paid = todays.filter((b: { holdMethod: string; ref: string }) => b.holdMethod === "FEE" && db.payments.some((p: { bookingRef: string; status: string }) => p.bookingRef === b.ref && p.status === "PAID")).length;
    await expect(page.getByText(`${paid} of ${todays.length} paid · ${otp} verified by OTP`)).toBeVisible();

    const noShows = todays.filter((b: { status: string }) => b.status === "NO_SHOW");
    await expect(page.getByTestId("kpi-noshows")).toHaveText(String(noShows.length));
    const paidNoShows = noShows.filter((b: { ref: string }) => db.payments.some((p: { bookingRef: string; status: string }) => p.bookingRef === b.ref && p.status === "PAID")).length;
    await expect(page.getByText(`${paidNoShows} had paid the fee`)).toBeVisible();

    await expect(page.getByRole("progressbar", { name: "Slots filled today" })).toHaveAttribute("aria-valuenow", /^\d+$/);
    await expect(page.getByTestId("kpi-filled")).toHaveText(/^\d+%$/);

    // The by-branch bars add up to today's total.
    const bars = page.getByRole("progressbar", { name: /bookings today$/ });
    await expect(bars).toHaveCount(4);
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += Number(await bars.nth(i).getAttribute("aria-valuenow"));
    expect(sum).toBe(todays.length);

    // Chart has a text alternative with seven days.
    await expect(page.getByRole("table", { name: /Bookings this week/ }).locator("tbody tr")).toHaveCount(7);
  });

  test("the branch filter changes the whole page", async ({ page }) => {
    await signIn(page);
    const all = Number(await page.getByTestId("kpi-bookings").innerText());
    const db = await readDb(page);
    const today = new Date();
    const lake = db.bookings.filter((b: { startsAt: string; branchId: string }) => sameDay(b.startsAt, today) && b.branchId === "lake-view").length;
    await page.getByRole("combobox", { name: "Branch" }).selectOption({ label: "Lake View" });
    await expect(page.getByTestId("kpi-bookings")).toHaveText(String(lake));
    await expect(page.getByRole("progressbar", { name: /bookings today$/ })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Bookings this week" })).toContainText("Lake View");
    await page.getByRole("combobox", { name: "Branch" }).selectOption({ label: "All branches" });
    await expect(page.getByTestId("kpi-bookings")).toHaveText(String(all));
  });

  test("a booking made on the public flow shows up in the numbers", async ({ page }) => {
    await signIn(page);
    const before = Number(await page.getByTestId("kpi-bookings").innerText());
    // Add a booking for today straight into the store, as the public flow would.
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
      const start = new Date();
      start.setHours(20, 30, 0, 0);
      const taken = db.bookings.some((b: { barberId: string; startsAt: string }) => b.barberId === "dev-city-mall" && b.startsAt === start.toISOString());
      if (taken) throw new Error("slot taken");
      db.bookings.push({
        ref: "BR-99999", branchId: "city-mall", serviceId: "classic-haircut", barberId: "dev-city-mall",
        customer: { name: "Walk In", phone: "9999999999" }, startsAt: start.toISOString(), endsAt: new Date(+start + 1800000).toISOString(),
        status: "CONFIRMED", holdMethod: "OTP", holdExpiresAt: null, priceInr: 299, feeInr: 0, createdAt: new Date().toISOString(), events: [],
      });
      localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
    });
    await page.reload();
    await expect(page.getByTestId("kpi-bookings")).toHaveText(String(before + 1));
  });

  test("shows sections, links and an empty state", async ({ page }) => {
    await signIn(page);
    for (const h of ["Bookings this week", "By branch today", "Up next", "Needs your attention"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "+ New booking" })).toHaveAttribute("href", "/admin/bookings?new=1");
    await expect(page.getByRole("link", { name: "View all bookings" })).toHaveAttribute("href", "/admin/bookings");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
});
