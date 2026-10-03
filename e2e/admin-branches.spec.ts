import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const tomorrow = () => addDays(new Date(), 1);
const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));

async function open(page: Page, path = "/admin/branches") {
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
  await expect(page.getByRole("heading", { level: 1, name: "Branches & fees" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Main Street" })).toBeVisible();
}

/** Read-modify-write the mock database, like a developer poking at the backend. */
async function editDb(page: Page, fn: string) {
  await page.evaluate((src) => {
    const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
    new Function("db", src)(db);
    localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
  }, fn);
}

const rules = (page: Page) => page.getByRole("form", { name: "Booking fee rules" });
const save = (page: Page) => rules(page).getByRole("button", { name: "Save changes" });
const feeBox = (page: Page) => rules(page).getByLabel("Booking fee", { exact: true });

/** Public booking flow as a customer: tomorrow's first slot, then step 3 (details). */
async function publicDetails(page: Page, query = "branch=main-street&service=hot-towel-shave") {
  await page.goto(`/book/slot?${query}`);
  const d = tomorrow();
  await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
  await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
  await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
  await expect(page).toHaveURL(/\/book\/details/);
  await expect(page.getByLabel("Full name")).toBeVisible();
}

test.describe("branch cards", () => {
  test("show every branch with today's numbers from the same data as the dashboard", async ({ page }) => {
    await open(page);
    const db = await readDb(page);
    const today = iso(new Date());
    for (const b of db.branches) {
      const mine = db.bookings.filter((x: { branchId: string; startsAt: string }) => x.branchId === b.id && iso(new Date(x.startsAt)) === today);
      const fees = db.payments
        .filter((p: { bookingRef: string; status: string }) => mine.some((x: { ref: string }) => x.ref === p.bookingRef) && (p.status === "PAID" || p.status === "REFUND_DUE"))
        .reduce((n: number, p: { amountInr: number }) => n + p.amountInr, 0);
      await expect(page.getByTestId(`today-${b.id}`)).toHaveText(String(mine.length));
      await expect(page.getByTestId(`fees-${b.id}`)).toHaveText(`₹${fees.toLocaleString("en-IN")}`);
    }
    await expect(page.getByRole("article", { name: "Main Street" })).toContainText("10 AM – 9 PM · 4 barbers");
    await expect(page.getByRole("article", { name: "City Mall" })).toContainText("11 AM – 10 PM · 2 barbers · paused");
    await expect(page.getByRole("article", { name: "Main Street" })).toHaveAttribute("data-active", "true");
    await expect(page.getByRole("switch", { name: "Bookings open at City Mall" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: "Bookings open at Lake View" })).toHaveAttribute("aria-checked", "true");
    // The dashboard shows the same total.
    await page.goto("/admin");
    const total = db.bookings.filter((x: { startsAt: string }) => iso(new Date(x.startsAt)) === today).length;
    await expect(page.getByTestId("kpi-bookings")).toHaveText(String(total));
  });

  test("the switch pauses a branch: it leaves the public dropdown, existing bookings stay, and Undo works", async ({ page }) => {
    await open(page);
    const bookingsBefore = (await readDb(page)).bookings.filter((b: { branchId: string }) => b.branchId === "lake-view").length;
    await page.getByRole("switch", { name: "Bookings open at Lake View" }).click();
    await expect(page.getByText(/^Lake View paused/)).toBeVisible();
    await expect(page.getByRole("article", { name: "Lake View" })).toContainText("paused");
    expect((await readDb(page)).branches.find((b: { id: string }) => b.id === "lake-view").paused).toBe(true);

    // Customers no longer see it...
    await page.goto("/book/branch");
    await expect(page.getByLabel("Choose a branch")).not.toContainText("Lake View");
    expect(await page.getByLabel("Choose a branch").locator("option").allInnerTexts()).toEqual(["Main Street", "Station Road"]);
    await page.goto("/");
    const quick = page.getByRole("form", { name: "Quick booking" });
    if (await quick.isVisible()) await expect(quick.getByLabel("Branch")).not.toContainText("Lake View");
    // ...but its bookings are untouched, and the owner can still find them.
    expect((await readDb(page)).bookings.filter((b: { branchId: string }) => b.branchId === "lake-view")).toHaveLength(bookingsBefore);
    await page.goto("/admin/bookings?range=month&branch=lake-view");
    await expect(page.getByRole("button", { name: /^All \d+$/ })).toHaveText(`All ${(await readDb(page)).bookings.filter((b: { branchId: string; startsAt: string }) => b.branchId === "lake-view" && b.startsAt.slice(0, 7) === iso(new Date()).slice(0, 7)).length}`);

    await page.goto("/admin/branches");
    await page.getByRole("switch", { name: "Bookings open at Lake View" }).click();
    await expect(page.getByText("Lake View is open for bookings")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Bookings open at Lake View" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: "Bookings open at Lake View" }).click(); // pause again
    await page.getByRole("button", { name: "Undo" }).last().click();
    await expect(page.getByRole("switch", { name: "Bookings open at Lake View" })).toHaveAttribute("aria-checked", "true");
    await page.goto("/book/branch");
    await expect(page.getByLabel("Choose a branch")).toContainText("Lake View");
  });

  test("a paused branch cannot take a booking, even from a saved link", async ({ page }) => {
    await open(page);
    await page.getByRole("switch", { name: "Bookings open at Station Road" }).click();
    await expect(page.getByRole("article", { name: "Station Road" })).toContainText("paused");
    await page.goto("/book/slot?branch=station-road&service=classic-haircut");
    // The wizard falls back to an open branch instead of showing the paused one.
    await expect(page.getByRole("region", { name: "Your booking" }).or(page.getByRole("heading", { level: 1 })).first()).toBeVisible();
    const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem("barbr-wizard-v1") ?? "{}").state);
    expect(state?.branchId).not.toBe("station-road");
  });
});

test.describe("booking fee rules", () => {
  test("show the saved values, with Save off until something changes", async ({ page }) => {
    await open(page);
    await expect(rules(page).getByRole("radio", { name: "Customer chooses" })).toHaveAttribute("aria-checked", "true");
    await expect(feeBox(page)).toHaveValue("99");
    await expect(rules(page).getByRole("switch", { name: "Adjust fee in final bill" })).toHaveAttribute("aria-checked", "true");
    await expect(rules(page).getByRole("switch", { name: "Refund on early cancellation" })).toHaveAttribute("aria-checked", "true");
    await expect(rules(page).getByLabel("Hours before the slot")).toHaveValue("3");
    await expect(rules(page).getByRole("switch", { name: "Require fee after repeated no-shows" })).toHaveAttribute("aria-checked", "true");
    await expect(rules(page).getByLabel("Number of no-shows")).toHaveValue("2");
    await expect(rules(page).getByLabel("Hold unpaid slots")).toHaveValue("10");
    await expect(save(page)).toBeDisabled();
    await expect(rules(page)).toContainText("Applies to new bookings only");
    await feeBox(page).fill("100");
    await expect(save(page)).toBeEnabled();
    await feeBox(page).fill("99");
    await expect(save(page)).toBeDisabled();
  });

  test("validates the fee, the refund window and the no-show count with clear messages", async ({ page }) => {
    await open(page);
    for (const [value, message] of [["2001", "Maximum ₹2,000"], ["-1", "Minimum ₹0"], ["99.5", "Whole rupees only"], ["", "Enter a whole number"]] as const) {
      await feeBox(page).fill(value);
      await expect(rules(page).getByRole("alert").filter({ hasText: message })).toBeVisible();
      await save(page).click();
    }
    expect((await readDb(page)).settings.feeInr).toBe(99);
    await feeBox(page).fill("2000");
    await expect(rules(page).getByRole("alert")).toHaveCount(0);
    await feeBox(page).fill("0");
    await expect(rules(page).getByRole("alert")).toHaveCount(0);
    await feeBox(page).fill("99");

    const hours = rules(page).getByLabel("Hours before the slot");
    for (const [value, message] of [["73", "Maximum 72 hours"], ["1.5", "Whole hours only"], ["-2", "Minimum 0 hours"], ["", "Enter the number of hours"]] as const) {
      await hours.fill(value);
      await expect(rules(page).getByRole("alert").filter({ hasText: message })).toBeVisible();
    }
    const noShows = rules(page).getByLabel("Number of no-shows");
    for (const [value, message] of [["0", "At least 1"], ["11", "At most 10"], ["2.5", "Whole numbers only"]] as const) {
      await noShows.fill(value);
      await expect(rules(page).getByRole("alert").filter({ hasText: message })).toBeVisible();
    }
    await save(page).click();
    expect((await readDb(page)).settings).toMatchObject({ feeInr: 99, refundWindowHours: 3, requireFeeAfterNoShows: 2 });
  });

  test("a number box that is switched off is not checked, and keeps its saved value", async ({ page }) => {
    await open(page);
    await rules(page).getByLabel("Hours before the slot").fill("");
    await expect(rules(page).getByRole("alert").filter({ hasText: "Enter the number of hours" })).toBeVisible();
    await rules(page).getByRole("switch", { name: "Refund on early cancellation" }).click();
    await expect(rules(page).getByLabel("Hours before the slot")).toHaveCount(0);
    await expect(rules(page).getByRole("alert")).toHaveCount(0);
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    expect((await readDb(page)).settings).toMatchObject({ refundOnEarlyCancel: false, refundWindowHours: 3 });
  });

  test("saving shows a toast, persists, and applies to the public flow: Fee only, then OTP only, then both", async ({ page }) => {
    await open(page);
    await rules(page).getByRole("radio", { name: "Fee only" }).click();
    await feeBox(page).fill("150");
    await rules(page).getByLabel("Hold unpaid slots").selectOption("15");
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await expect(save(page)).toBeDisabled();
    expect((await readDb(page)).settings).toMatchObject({ holdMode: "FEE_ONLY", feeInr: 150, unpaidHoldMinutes: 15 });
    await page.reload();
    await expect(feeBox(page)).toHaveValue("150");
    await expect(rules(page).getByRole("radio", { name: "Fee only" })).toHaveAttribute("aria-checked", "true");

    // Customers: a changed fee changes the summary; Fee only hides the OTP option.
    await page.goto("/book/branch");
    const summary = page.getByRole("region", { name: "Your booking" });
    const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
    if (!mobile) {
      await expect(summary).toContainText("₹150");
      await expect(summary).toContainText("₹349 at the salon");
    }
    await publicDetails(page);
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toContainText("₹150");
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send OTP" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Confirm & pay ₹150/ })).toBeVisible();

    // OTP only.
    await page.goto("/admin/branches");
    await rules(page).getByRole("radio", { name: "Phone OTP only" }).click();
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await publicDetails(page);
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toContainText("15 minutes");
    await expect(page.getByRole("button", { name: "Verify & hold slot" })).toBeVisible();

    // Customer chooses again.
    await page.goto("/admin/branches");
    await rules(page).getByRole("radio", { name: "Customer chooses" }).click();
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await publicDetails(page);
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toBeVisible();
  });

  test("the bill, refund window and no-show switches change what customers see", async ({ page }) => {
    await open(page);
    await rules(page).getByRole("switch", { name: "Adjust fee in final bill" }).click();
    await rules(page).getByLabel("Hours before the slot").fill("6");
    await rules(page).getByLabel("Number of no-shows").fill("3");
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await publicDetails(page);
    await expect(page.getByText(/free cancellation up to 6 hours before the slot/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).not.toContainText("Adjusted");
    // Two earlier no-shows no longer force the fee when the limit is 3.
    await page.getByLabel("Full name").fill("Test Repeat");
    await page.getByLabel("Mobile number").fill("9000000001");
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toBeVisible();
    await expect(page.getByText(/Because of earlier missed bookings/)).toHaveCount(0);

    // Back to 2: now that phone must pay.
    await page.goto("/admin/branches");
    await rules(page).getByLabel("Number of no-shows").fill("2");
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await publicDetails(page);
    await page.getByLabel("Full name").fill("Test Repeat");
    await page.getByLabel("Mobile number").fill("9000000001");
    await expect(page.getByText(/Because of earlier missed bookings/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toHaveCount(0);

    // Switching the rule off removes the force entirely.
    await page.goto("/admin/branches");
    await rules(page).getByRole("switch", { name: "Require fee after repeated no-shows" }).click();
    await save(page).click();
    await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
    await publicDetails(page);
    await page.getByLabel("Full name").fill("Test Repeat");
    await page.getByLabel("Mobile number").fill("9000000001");
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toBeVisible();
  });
});

test.describe("manage branch drawer", () => {
  test("edits name, hours, services, prices and team, and the public flow follows", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Manage Station Road" }).click();
    const drawer = page.getByRole("dialog", { name: "Manage branch" });
    await expect(drawer.getByLabel("Branch name")).toHaveValue("Station Road");
    await drawer.getByLabel("Branch name").fill("Station Road East");
    await drawer.getByLabel("Sunday open", { exact: true }).uncheck();
    await drawer.getByLabel("Offer Kids Haircut").uncheck();
    await drawer.getByLabel("Beard Trim price at this branch").fill("249");
    await drawer.getByRole("button", { name: "+ Add barber" }).click();
    await drawer.getByLabel("Name").last().fill("Zoya Khan");
    await drawer.getByLabel("Specialty").last().fill("Fades");
    await drawer.getByLabel("Zoya Khan break 1 starts").fill("15:00");
    await drawer.getByLabel("Zoya Khan break 1 ends").fill("15:30");
    await drawer.getByRole("button", { name: "Save branch" }).click();

    await expect(page.getByText("Station Road East saved")).toBeVisible();
    const card = page.getByRole("article", { name: "Station Road East" });
    await expect(card).toContainText("4 barbers");
    await expect(card).toHaveAttribute("data-active", "true");
    const db = await readDb(page);
    const branch = db.branches.find((b: { id: string }) => b.id === "station-road");
    expect(branch.name).toBe("Station Road East");
    expect(branch.weekHours[0]).toBeNull();
    expect(db.branchServices.some((bs: { branchId: string; serviceId: string }) => bs.branchId === "station-road" && bs.serviceId === "kids-haircut")).toBe(false);
    expect(db.branchServices.find((bs: { branchId: string; serviceId: string }) => bs.branchId === "station-road" && bs.serviceId === "beard-trim").priceOverrideInr).toBe(249);
    const zoya = db.barbers.find((b: { name: string }) => b.name === "Zoya Khan");
    expect(zoya).toMatchObject({ branchId: "station-road", id: "zoya-station-road" });
    expect(db.breaks.find((k: { barberId: string }) => k.barberId === zoya.id)).toMatchObject({ startMin: 900, endMin: 930 });

    // Customers see the renamed branch, no Kids Haircut, the override price, and the new barber.
    await page.goto("/book/branch?branch=station-road");
    await expect(page.getByLabel("Choose a branch")).toContainText("Station Road East");
    await expect(page.getByRole("button", { name: /Kids Haircut/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Beard Trim/ })).toContainText("₹249");
    await page.goto(`/book/slot?branch=station-road&service=classic-haircut`);
    await expect(page.getByRole("button", { name: /^Zoya Khan/ })).toBeVisible();
    // And Sundays are closed.
    const sunday = addDays(new Date(), (7 - new Date().getDay()) % 7 || 7);
    await page.goto(`/book/slot?branch=station-road&service=classic-haircut&date=${iso(sunday)}`);
    await expect(page.getByText(/No slots left/)).toBeVisible();
    // The owner's calendar has a column for Zoya.
    await page.goto("/admin/calendar?branch=station-road");
    await expect(page.getByTestId("day-grid").getByText("Zoya Khan", { exact: true })).toBeVisible();
  });

  test("checks every field before saving and says what to fix", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Manage Station Road" }).click();
    const d = page.getByRole("dialog", { name: "Manage branch" });
    await d.getByLabel("Branch name").fill("");
    await d.getByLabel("Address").fill("");
    await d.getByLabel("Phone").fill("abc");
    await d.getByLabel("Monday opens at").fill("21:00");
    await d.getByLabel("Monday closes at").fill("10:00");
    await d.getByLabel("Tuesday opens at").fill("10:15");
    for (const name of ["Hot Towel Shave", "Classic Haircut", "Fade & Styling", "Beard Trim", "Haircut + Beard", "Kids Haircut"]) await d.getByLabel(`Offer ${name}`).uncheck();
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(d.getByText(/^Please fix \d+ things below/)).toBeVisible();
    for (const m of ["Enter the branch name", "Enter the address", "Enter a valid phone number", "Monday: Closing time must be after opening time", "Tuesday: Use whole or half hours", "Offer at least one service"]) {
      await expect(d.getByText(m, { exact: false }).first()).toBeVisible();
    }
    expect((await readDb(page)).branches.find((b: { id: string }) => b.id === "station-road").name).toBe("Station Road");

    // Fix them one by one: the drawer only closes once everything is valid.
    await d.getByLabel("Branch name").fill("Station Road");
    await d.getByLabel("Address").fill("4 Station Road");
    await d.getByLabel("Phone").fill("+91 80000 10002");
    await d.getByLabel("Monday opens at").fill("10:00");
    await d.getByLabel("Monday closes at").fill("21:00");
    await d.getByLabel("Tuesday opens at").fill("10:00");
    await d.getByLabel("Offer Classic Haircut").check();
    await d.getByLabel("Classic Haircut price at this branch").fill("0");
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(d.getByText("Classic Haircut: Minimum ₹1")).toBeVisible();
    await d.getByLabel("Classic Haircut price at this branch").fill("");
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(page.getByText("Station Road saved")).toBeVisible();
  });

  test("a break must end after it starts; all days closed is refused", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Manage Station Road" }).click();
    const d = page.getByRole("dialog", { name: "Manage branch" });
    await d.getByLabel("Arjun Mehta break 1 starts").fill("14:00");
    await d.getByLabel("Arjun Mehta break 1 ends").fill("13:30");
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(d.getByText("A break must end after it starts")).toBeVisible();
    await d.getByLabel("Arjun Mehta break 1 ends").fill("14:30");
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) await d.getByLabel(`${day} open`, { exact: true }).uncheck();
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(d.getByText("Open at least one day")).toBeVisible();
  });

  test("a barber with upcoming bookings cannot be removed; one without can", async ({ page }) => {
    await open(page);
    await editDb(page, `
      const day = (h) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
      db.bookings = db.bookings.filter(b => !(["kabir-main-street","dev-main-street"].includes(b.barberId) && new Date(b.startsAt) >= new Date()));
      const s = day(11);
      db.bookings.push({ ref: "BR-80001", branchId: "main-street", serviceId: "classic-haircut", barberId: "kabir-main-street", customer: { name: "Kabir Client", phone: "9811100000" },
        startsAt: s.toISOString(), endsAt: new Date(+s + 1800000).toISOString(), status: "CONFIRMED", holdMethod: "OTP", holdExpiresAt: null, priceInr: 299, feeInr: 0, createdAt: new Date().toISOString(), events: [] });
    `);
    await page.getByRole("button", { name: "Manage Main Street" }).click();
    const d = page.getByRole("dialog", { name: "Manage branch" });
    await d.getByRole("button", { name: "Remove Kabir" }).click();
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(d.getByRole("alert").filter({ hasText: "Kabir Khan has 1 upcoming booking" })).toBeVisible();
    await expect(d).toBeVisible();
    expect((await readDb(page)).barbers.find((b: { id: string }) => b.id === "kabir-main-street").retired).toBeFalsy();

    // Put Kabir back (cancel and reopen), remove Dev instead.
    await d.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Manage Main Street" }).click();
    await d.getByRole("button", { name: "Remove Dev" }).click();
    await d.getByRole("button", { name: "Save branch" }).click();
    await expect(page.getByText("Main Street saved")).toBeVisible();
    await expect(page.getByRole("article", { name: "Main Street" })).toContainText("3 barbers");
    await page.goto("/admin/calendar");
    await expect(page.getByTestId("day-grid").getByText("Dev Sharma", { exact: true })).toHaveCount(0);
    expect((await readDb(page)).barbers.find((b: { id: string }) => b.id === "dev-main-street").retired).toBe(true);
  });
});

test.describe("add branch", () => {
  test("creates a branch that customers and the calendar can use straight away", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "+ Add branch" }).click();
    const d = page.getByRole("dialog", { name: "Add branch" });
    await expect(d.getByLabel("Offer Kids Haircut")).toBeChecked();
    await d.getByRole("button", { name: "Add branch" }).click();
    await expect(d.getByText("Enter the branch name")).toBeVisible();
    await d.getByLabel("Branch name").fill("Harbour Point");
    await d.getByLabel("Address").fill("9 Harbour Road");
    await d.getByLabel("Phone").fill("+91 80000 10009");
    await d.getByRole("button", { name: "+ Add barber" }).click();
    await d.getByLabel("Name").last().fill("Zoya Khan");
    await d.getByRole("button", { name: "Add branch" }).click();

    await expect(page.getByText("Harbour Point added")).toBeVisible();
    const card = page.getByRole("article", { name: "Harbour Point" });
    await expect(card).toContainText("10 AM – 9 PM · 1 barber");
    await expect(card).toHaveAttribute("data-active", "true");
    await expect(page.getByRole("article")).toHaveCount(5);

    await page.goto("/book/branch");
    await expect(page.getByLabel("Choose a branch")).toContainText("Harbour Point");
    await page.getByLabel("Choose a branch").selectOption({ label: "Harbour Point" });
    await expect(page.getByRole("button", { name: /Hot Towel Shave/ })).toBeVisible();
    await publicDetails(page, "branch=harbour-point&service=classic-haircut");
    await page.goto("/admin/calendar?branch=harbour-point");
    await expect(page.getByTestId("day-grid").getByText("Zoya Khan", { exact: true })).toBeVisible();
  });
});

test("phones: cards stack, the rules panel fits, and the drawer is a full-width sheet", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone only");
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(rules(page)).toBeVisible();
  await page.getByRole("button", { name: "Manage Lake View" }).click();
  const d = page.getByRole("dialog", { name: "Manage branch" });
  const box = await d.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(385);
  await expect(d.getByRole("button", { name: "Save branch" })).toBeInViewport();
  await d.getByRole("button", { name: "Cancel" }).click();
  await expect(d).toBeHidden();
});
