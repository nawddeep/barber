import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";
import { readFile } from "node:fs/promises";

const tomorrow = () => addDays(new Date(), 1);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));

async function open(page: Page, path = "/admin/bookings") {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
  await page.goto(path);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("li", { hasText: "Owner:" }).getByRole("button", { name: "Fill in" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
}

/** Adds a walk-in for tomorrow through the real dialog. Leaves the new booking open in the panel. */
async function createWalkIn(page: Page, o: { name?: string; phone?: string; fee?: "COLLECTED" | "NONE" } = {}) {
  await page.getByRole("button", { name: "+ New booking" }).click();
  const dialog = page.getByRole("dialog", { name: "New booking" });
  await dialog.getByLabel("Date").fill(iso(tomorrow()));
  await dialog.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
  await dialog.getByLabel("Customer name").fill(o.name ?? "Walk In Customer");
  await dialog.getByLabel("Mobile number").fill(o.phone ?? "9833344455");
  if (o.fee === "NONE") await dialog.getByLabel("No fee").check();
  await dialog.getByRole("button", { name: "Create booking" }).click();
  const toast = page.getByText(/^Booking BR-\d+ created$/);
  await expect(toast).toBeVisible();
  const ref = (await toast.innerText()).match(/BR-\d+/)![0];
  // Wait for this booking's own panel, not the list's preview of another one.
  const panel = page.getByRole("article", { name: `Booking ${ref}` });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("filters and the URL", () => {
  test("search, tabs and counts work, and the view lives in the URL", async ({ page }) => {
    await open(page, "/admin/bookings?range=month");
    const all = page.getByRole("group", { name: "Filter by status" });
    const num = async (label: string) => Number(((await all.getByRole("button", { name: new RegExp(`^${label} \\d+$`) }).innerText()).match(/\d+$/) ?? ["0"])[0]);
    const total = await num("All");
    // The tabs add up to All (Confirmed includes in-service).
    const parts = (await Promise.all(["Confirmed", "Fee pending", "Completed", "Cancelled", "No-show"].map(num))).reduce((a, b) => a + b, 0);
    expect(parts).toBe(total);
    await expect(page.getByText(new RegExp(`^${total} bookings this month across 4 branches$`))).toBeVisible();

    await all.getByRole("button", { name: /^Completed/ }).click();
    await expect(page).toHaveURL(/status=COMPLETED/);
    await expect(all.getByRole("button", { name: /^Completed/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Completed \d+$/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByLabel("Search name, phone or booking ref").fill("BR-20481");
    await expect(page).toHaveURL(/q=BR-20481/);
    await all.getByRole("button", { name: /^All/ }).click();
    const aarav = page.getByRole("button", { name: /Aarav Mehta/ });
    await expect(aarav).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^All 1$/ })).toBeVisible();
    // Search also finds by name and by phone.
    await page.getByLabel("Search name, phone or booking ref").fill("aarav mehta");
    await expect(aarav).toHaveCount(1);
    await page.getByLabel("Search name, phone or booking ref").fill("9876543210");
    await expect(aarav).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^All 1$/ })).toBeVisible();
  });

  test("a bookmarked URL restores every filter", async ({ page }) => {
    await open(page, `/admin/bookings?branch=lake-view&range=custom&from=${iso(addDays(new Date(), -7))}&to=${iso(addDays(new Date(), 7))}&status=COMPLETED&sort=desc&q=a`);
    await expect(page.getByLabel("Branch")).toHaveValue("lake-view");
    await expect(page.getByLabel("Date range")).toHaveValue("custom");
    await expect(page.getByLabel("From")).toHaveValue(iso(addDays(new Date(), -7)));
    await expect(page.getByRole("button", { name: /^Completed/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Search name, phone or booking ref")).toHaveValue("a");
    await expect(page.getByText(/bookings in this range at Lake View|booking in this range at Lake View/)).toBeVisible();
    // Junk in the URL falls back to the defaults.
    await page.goto("/admin/bookings?range=forever&status=LOL&page=-3");
    await expect(page.getByLabel("Date range")).toHaveValue("today");
    await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the branch filter and date ranges change the list", async ({ page }) => {
    await open(page, "/admin/bookings?range=month");
    const db = await readDb(page);
    const lake = db.bookings.filter((b: { branchId: string; startsAt: string }) => b.branchId === "lake-view" && b.startsAt.slice(0, 7) === iso(new Date()).slice(0, 7)).length;
    await page.getByLabel("Branch").selectOption({ label: "Lake View" });
    await expect(page.getByRole("button", { name: /^All \d+$/ })).toHaveText(`All ${lake}`);
    await page.getByLabel("Branch").selectOption({ label: "All branches" });
    await page.getByLabel("Date range").selectOption("today");
    await expect(page.getByText(/ today across 4 branches$/)).toBeVisible();
    await page.getByLabel("Date range").selectOption("week");
    await expect(page.getByText(/ this week across 4 branches$/)).toBeVisible();
  });

  test("shows an empty state, and signing in keeps the query", async ({ page }) => {
    await open(page, "/admin/bookings?range=week&q=zzzzzz");
    await expect(page).toHaveURL(/range=week/);
    await expect(page.getByText("No bookings match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Show this month" }).click();
    await expect(page).toHaveURL(/range=month/);
  });
});

test.describe("table", () => {
  test("sorts by time, paginates 25 per page and marks the selected row", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Desktop table");
    await open(page, "/admin/bookings?range=month");
    const table = page.getByRole("table");
    const when = table.getByRole("columnheader", { name: /When/ });
    await expect(when).toHaveAttribute("aria-sort", "ascending");
    const firstAsc = await table.locator("tbody tr").first().innerText();
    await page.getByRole("button", { name: /^When, sorted/ }).click();
    await expect(page).toHaveURL(/sort=desc/);
    await expect(when).toHaveAttribute("aria-sort", "descending");
    expect(await table.locator("tbody tr").first().innerText()).not.toBe(firstAsc);

    const db = await readDb(page);
    const inMonth = db.bookings.filter((b: { startsAt: string }) => b.startsAt.slice(0, 7) === iso(new Date()).slice(0, 7)).length;
    if (inMonth > 25) {
      await expect(table.locator("tbody tr")).toHaveCount(25);
      await expect(page.getByText(`Showing 1–25 of ${inMonth}`)).toBeVisible();
      await page.getByRole("button", { name: "Page 2" }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByText(new RegExp(`Showing 26–${Math.min(50, inMonth)} of ${inMonth}`))).toBeVisible();
      await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    }
  });

  test("rows select with the mouse and the keyboard, and the panel follows", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Desktop table");
    await open(page, "/admin/bookings?range=month");
    const rows = page.getByRole("table").locator("tbody tr");
    const second = rows.nth(1).getByRole("button");
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/ref=BR-\d+/);
    await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");
    const ref = new URL(page.url()).searchParams.get("ref")!;
    await expect(page.getByTestId("panel-ref")).toHaveText(ref);
    await rows.nth(3).click();
    await expect(rows.nth(3)).toHaveAttribute("data-selected", "true");
    await expect(rows.nth(1)).not.toHaveAttribute("data-selected", "true");
  });
});

test.describe("new booking", () => {
  test("validates, then creates a confirmed walk-in that the whole app sees", async ({ page, isMobile }) => {
    await open(page);
    await page.getByRole("button", { name: "+ New booking" }).click();
    const dialog = page.getByRole("dialog", { name: "New booking" });
    await dialog.getByRole("button", { name: "Create booking" }).click();
    await expect(dialog.getByText("Enter the customer's name")).toBeVisible();
    await expect(dialog.getByText("Enter a valid 10-digit mobile number")).toBeVisible();
    await expect(dialog.getByText("Pick a time")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page).not.toHaveURL(/new=1/);

    const panel = await createWalkIn(page, { name: "Priya Nair", phone: "9833344455", fee: "COLLECTED" });
    await expect(panel).toContainText("Priya Nair");
    await expect(panel).toContainText("Cash");
    await expect(panel).toContainText("₹99 paid");
    await expect(panel).toContainText("Booking added by the salon");
    const ref = (await panel.getByTestId("panel-ref").innerText()).trim();
    const b = (await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref);
    expect(b).toMatchObject({ status: "CONFIRMED", holdMethod: "FEE", customer: { name: "Priya Nair" } });
    // It blocks the barber's calendar: the public flow shows that slot as taken.
    await page.goto(`/book/slot?branch=${b.branchId}&service=${b.serviceId}`);
    const d = tomorrow();
    await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
    await page.getByRole("button", { name: new RegExp(`^${b.barberId.split("-")[0].replace(/^./, (c: string) => c.toUpperCase())}`) }).click();
    await expect(page.getByRole("button", { name: new RegExp(`${format(new Date(b.startsAt), "h:mm a")}, unavailable`) })).toBeDisabled();
    void isMobile;
  });

  test("no-fee walk-ins say so; ?new=1 opens the dialog from the dashboard link", async ({ page }) => {
    await open(page, "/admin/bookings?new=1");
    await expect(page.getByRole("dialog", { name: "New booking" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).not.toHaveURL(/new=1/);
    const panel = await createWalkIn(page, { fee: "NONE" });
    await expect(panel).toContainText("Walk-in");
    await expect(panel).toContainText("No fee");
  });
});

test.describe("status changes", () => {
  test("no-show with Undo, and final bookings cannot be changed", async ({ page }) => {
    await open(page);
    const panel = await createWalkIn(page, { fee: "NONE" });
    await panel.getByRole("button", { name: "Mark no-show" }).click();
    await expect(panel.getByText("No-show", { exact: true })).toBeVisible();
    await expect(page.getByText("Marked as no-show", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Change undone")).toBeVisible();
    await expect(panel.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(panel).not.toContainText("Marked as no-show");

    await panel.getByRole("button", { name: "Start service" }).click();
    await expect(panel.getByText("In service", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Mark completed" }).click();
    await expect(panel.getByText("Completed", { exact: true })).toBeVisible();
    // A completed booking offers no way back to confirmed, cancelled or no-show.
    for (const name of ["Mark no-show", "Cancel booking", "Start service", "Mark completed", "Reschedule"]) {
      await expect(panel.getByRole("button", { name })).toHaveCount(0);
    }
    await expect(panel).toContainText("This booking is completed, so it can't be changed.");
    const ref = (await panel.getByTestId("panel-ref").innerText()).trim();
    const db = await readDb(page);
    expect(db.bookings.find((x: { ref: string }) => x.ref === ref).status).toBe("COMPLETED");
  });

  test("the undo toast lasts about 5 seconds", async ({ page }) => {
    await page.clock.install();
    await open(page);
    const panel = await createWalkIn(page, { fee: "NONE" });
    await panel.getByRole("button", { name: "Mark no-show" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await page.clock.fastForward("00:06");
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });

  test("cancelling asks first, leaves a refund to send, and can be undone", async ({ page }) => {
    await open(page);
    const panel = await createWalkIn(page, { fee: "COLLECTED" });
    await panel.getByRole("button", { name: "Cancel booking" }).click();
    const confirm = page.getByRole("dialog", { name: "Cancel this booking?" });
    await expect(confirm).toContainText("The ₹99 fee becomes a refund you can send from here.");
    await confirm.getByRole("button", { name: "Keep booking" }).click();
    await expect(panel.getByText("Confirmed", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Cancel booking" }).click();
    await confirm.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(panel.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(panel).toContainText("₹99 refund due");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(panel.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(panel).toContainText("₹99 paid");

    await panel.getByRole("button", { name: "Cancel booking" }).click();
    await confirm.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(panel.getByRole("button", { name: "Refund ₹99" })).toBeVisible();
    await panel.getByRole("button", { name: "Refund ₹99" }).click();
    await expect(page.getByText("₹99 refunded (simulated)")).toBeVisible();
    await expect(panel).toContainText("₹99 refunded");
    await expect(panel.getByRole("button", { name: /^Refund/ })).toHaveCount(0);
  });

  test("a hold awaiting its fee can be marked as paid at the salon", async ({ page }) => {
    await open(page);
    // Make a customer hold through the public flow's API shape, straight into the store.
    const ref = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
      const start = new Date();
      start.setDate(start.getDate() + 2);
      start.setHours(15, 0, 0, 0);
      const booking = {
        ref: "BR-77777", branchId: "main-street", serviceId: "classic-haircut", barberId: "dev-main-street",
        customer: { name: "Slow Payer", phone: "9844455566" }, startsAt: start.toISOString(), endsAt: new Date(+start + 1800000).toISOString(),
        status: "PENDING_FEE", holdMethod: "FEE", holdExpiresAt: new Date(Date.now() + 8 * 60000).toISOString(), priceInr: 299, feeInr: 99,
        createdAt: new Date().toISOString(), events: [{ at: new Date().toISOString(), type: "CREATED", note: "Booking created on website" }],
      };
      db.bookings = db.bookings.filter((b: { barberId: string; startsAt: string }) => !(b.barberId === "dev-main-street" && b.startsAt === booking.startsAt));
      db.bookings.push(booking);
      localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
      return booking.ref;
    });
    await page.goto(`/admin/bookings?ref=${ref}`);
    const panel = page.getByRole("article", { name: `Booking ${ref}` });
    await expect(panel).toContainText("₹99 pending");
    await panel.getByRole("button", { name: "Fee received" }).click();
    await expect(panel.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(panel).toContainText("Cash");
    await expect(panel).toContainText("₹99 paid");
  });

  test("reschedule moves the booking, with Undo", async ({ page }) => {
    await open(page);
    const panel = await createWalkIn(page, { fee: "NONE" });
    const before = await panel.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d+ \w+ · \d+:\d\d (AM|PM)$/).innerText();
    await panel.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: /^Reschedule BR-/ });
    const d = addDays(new Date(), 3);
    await dialog.getByLabel("Date").fill(iso(d));
    await dialog.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
    await dialog.getByRole("button", { name: "Move booking" }).click();
    await expect(page.getByText(/^Moved to /)).toBeVisible();
    const after = await panel.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d+ \w+ · \d+:\d\d (AM|PM)$/).innerText();
    expect(after).not.toBe(before);
    expect(after).toContain(format(d, "EEE, d MMM"));
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Move undone")).toBeVisible();
    await expect(panel.getByText(before)).toBeVisible();
  });

  test("Call and WhatsApp are real links", async ({ page }) => {
    await open(page);
    const panel = await createWalkIn(page, { phone: "9833344455", fee: "NONE" });
    await expect(panel.getByRole("link", { name: /^Call/ })).toHaveAttribute("href", "tel:+919833344455");
    await expect(panel.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute("href", "https://wa.me/919833344455");
  });
});

test.describe("CSV export", () => {
  test("downloads exactly the filtered bookings", async ({ page }) => {
    await open(page, "/admin/bookings?range=month&status=COMPLETED");
    const db = await readDb(page);
    const month = iso(new Date()).slice(0, 7);
    const expected = db.bookings.filter((b: { status: string; startsAt: string }) => b.status === "COMPLETED" && b.startsAt.slice(0, 7) === month);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toBe(`barbr-bookings-${iso(new Date())}.csv`);
    const text = await readFile((await download.path())!, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads ₹ and names correctly
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe("Ref,Customer,Phone,Service,Barber,Branch,Date,Time,Status,Hold method,Price (INR),Fee (INR),Fee payment");
    expect(lines).toHaveLength(expected.length + 1);
    expect(lines.slice(1).every((l) => l.includes(",COMPLETED,"))).toBe(true);
    await expect(page.getByText(new RegExp(`^Exported ${expected.length} bookings?$`))).toBeVisible();
  });

  test("ignores pagination and respects the search", async ({ page }) => {
    await open(page, "/admin/bookings?range=month&q=BR-20481");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    const lines = (await readFile((await download.path())!, "utf8")).slice(1).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("BR-20481,Aarav Mehta,9876543210,Hot Towel Shave,Jhon Abraham,Main Street");
  });
});

test("phones: cards instead of a table, and a full-screen sheet for details", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone only");
  await open(page, "/admin/bookings?range=month");
  await expect(page.getByRole("table")).toBeHidden();
  const cards = page.locator("ul button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await cards.nth(1).click();
  const sheet = page.getByRole("dialog", { name: "Booking details" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("article")).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(385); // full width
  expect(box!.height).toBeGreaterThanOrEqual(840); // full height
  await sheet.getByRole("button", { name: "Close booking details" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).not.toHaveURL(/ref=/);
});
