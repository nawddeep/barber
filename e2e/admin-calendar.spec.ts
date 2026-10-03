import { test, expect, type Locator, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const tomorrow = () => addDays(new Date(), 1);
const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));
const HOUR = 72;
const OPEN = 600; // Main Street opens at 10 AM

async function open(page: Page, path = "/admin/calendar", clock?: Date) {
  if (clock) await page.clock.install({ time: clock });
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
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
}

/** Replaces tomorrow's Main Street bookings with exactly the ones given (30 minute haircuts), then reloads. */
async function seedTomorrow(page: Page, rows: Array<{ ref: string; barber: string; h: number; m?: number; name?: string }>) {
  await page.waitForFunction(() => !!localStorage.getItem("barbr-demo-v1"));
  await page.evaluate((rowsArg) => {
    const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
    const day = (h: number, m: number) => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const dayStr = day(0, 0).toDateString();
    db.bookings = db.bookings.filter((b: { branchId: string; startsAt: string }) => !(b.branchId === "main-street" && new Date(b.startsAt).toDateString() === dayStr));
    for (const r of rowsArg) {
      const s = day(r.h, r.m ?? 0);
      db.bookings.push({
        ref: r.ref, branchId: "main-street", serviceId: "classic-haircut", barberId: `${r.barber}-main-street`,
        customer: { name: r.name ?? "Test Customer", phone: "9811100000" }, startsAt: s.toISOString(), endsAt: new Date(+s + 1800000).toISOString(),
        status: "CONFIRMED", holdMethod: "OTP", holdExpiresAt: null, priceInr: 299, feeInr: 0, createdAt: new Date().toISOString(),
        events: [{ at: new Date().toISOString(), type: "CREATED", note: "Booking created on website" }],
      });
    }
    localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
  }, rows);
  await page.goto(`/admin/calendar?date=${iso(tomorrow())}`);
  await expect(page.getByTestId("day-grid")).toBeVisible();
}

const block = (page: Page, ref: string) => page.locator(`[data-block][data-ref="${ref}"]`);
const column = (page: Page, barber: string) => page.locator(`[data-column="${barber}-main-street"]`);

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error("not visible");
  return b;
}

/** Mouse drag from the middle of a block so its top lands at `toMin` in `toBarber`'s column. */
async function drag(page: Page, ref: string, toBarber: string, toMin: number, { release = true } = {}) {
  const b = await box(block(page, ref));
  const col = await box(column(page, toBarber));
  const grab = 14; // pixels below the block's top edge
  await page.mouse.move(b.x + b.width / 2, b.y + grab);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + grab + 12, { steps: 3 });
  const targetY = col.y + ((toMin - OPEN) / 60) * HOUR + grab;
  await page.mouse.move(col.x + col.width / 2, targetY, { steps: 8 });
  if (release) await page.mouse.up();
}

/** Brings a barber's column into view (phones scroll the grid sideways), then measures it. */
async function colBox(page: Page, barber: string) {
  await column(page, barber).scrollIntoViewIfNeeded();
  return box(column(page, barber));
}

/** First 30-minute start (minutes after midnight) in [from, to) with nothing booked and no break, for a barber on a day. */
async function freeMinute(page: Page, barber: string, day: string, from: number, to: number) {
  const db = await readDb(page);
  const busy = db.bookings.filter((b: { barberId: string; startsAt: string; status: string }) => b.barberId === barber && iso(new Date(b.startsAt)) === day && !["CANCELLED", "NO_SHOW"].includes(b.status));
  for (let m = from; m < to; m += 30) {
    if (m >= 780 && m < 840) continue;
    if (!busy.some((b: { startsAt: string; endsAt: string }) => minOf(b.startsAt) < m + 30 && m < minOf(b.endsAt))) return m;
  }
  throw new Error("no free slot");
}

const bookingOf = async (page: Page, ref: string) => (await readDb(page)).bookings.find((b: { ref: string }) => b.ref === ref);
const minOf = (iso: string) => new Date(iso).getHours() * 60 + new Date(iso).getMinutes();

test.describe("the day view", () => {
  test("has a column per barber, the time axis, legend and lunch breaks", async ({ page }) => {
    await open(page);
    for (const n of ["Jhon Abraham", "Arjun Mehta", "Kabir Khan", "Dev Sharma"]) await expect(page.getByTestId("day-grid").getByText(n, { exact: true })).toBeVisible();
    for (const label of ["10 AM", "12 PM", "1 PM", "9 PM"]) await expect(page.getByTestId("day-grid").getByText(label, { exact: true })).toBeVisible();
    for (const l of ["Confirmed", "Fee pending", "In service", "Completed", "Break"]) await expect(page.getByRole("list", { name: "Colour key" }).getByText(l)).toBeVisible();
    const breaks = page.getByTestId("day-grid").locator("[data-break]");
    await expect(breaks).toHaveCount(4);
    await expect(breaks.first()).toHaveAttribute("aria-label", /is on break 1 PM to 2 PM/);
    await expect(page.getByText(/^Main Street · \w+day, \d+ \w+$/)).toBeVisible();
  });

  test("every block lines up exactly with its booking's time and length", async ({ page }) => {
    await open(page, "/admin/calendar", new Date(new Date().setHours(9, 0, 0, 0)));
    const db = await readDb(page);
    const today = iso(new Date());
    const shown = db.bookings.filter((b: { branchId: string; startsAt: string; status: string }) => b.branchId === "main-street" && iso(new Date(b.startsAt)) === today && !["CANCELLED", "NO_SHOW"].includes(b.status));
    expect(shown.length).toBeGreaterThan(2);
    await expect(page.locator("[data-block]")).toHaveCount(shown.length);
    for (const b of shown) {
      const start = minOf(b.startsAt);
      const minutes = (+new Date(b.endsAt) - +new Date(b.startsAt)) / 60000;
      const el = block(page, b.ref);
      await expect(el).toHaveAttribute("data-top", String(((start - OPEN) / 60) * HOUR));
      await expect(el).toHaveAttribute("data-height", String((minutes / 60) * HOUR));
      // And on screen: inside the right barber's column, at the right offset from its top (1px inset each side).
      const col = await box(column(page, b.barberId.replace("-main-street", "")));
      const r = await box(el);
      expect(r.x).toBeGreaterThanOrEqual(col.x - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(col.x + col.width + 1);
      expect(Math.abs(r.y - (col.y + ((start - OPEN) / 60) * HOUR + 1))).toBeLessThan(1.5);
      expect(Math.abs(r.height - ((minutes / 60) * HOUR - 2))).toBeLessThan(1.5);
    }
    // Cancelled and no-show bookings leave the calendar.
    const hidden = db.bookings.filter((b: { branchId: string; startsAt: string; status: string }) => b.branchId === "main-street" && iso(new Date(b.startsAt)) === today && ["CANCELLED", "NO_SHOW"].includes(b.status));
    for (const b of hidden) await expect(block(page, b.ref)).toHaveCount(0);
  });

  test("blocks are coloured by status", async ({ page }) => {
    await open(page, "/admin/calendar", new Date(new Date().setHours(15, 22, 0, 0)));
    const db = await readDb(page);
    const today = iso(new Date());
    const cls = { CONFIRMED: "bg-status-confirmed", PENDING_FEE: "bg-butter", IN_SERVICE: "bg-status-service", COMPLETED: "bg-status-done" } as const;
    for (const b of db.bookings.filter((x: { branchId: string; startsAt: string; status: string }) => x.branchId === "main-street" && iso(new Date(x.startsAt)) === today && x.status in cls)) {
      await expect(block(page, b.ref)).toHaveClass(new RegExp(cls[b.status as keyof typeof cls]));
    }
  });

  test("the orange now line sits at the current time and moves every minute", async ({ page }) => {
    await open(page, "/admin/calendar", new Date(new Date().setHours(15, 22, 0, 0)));
    const line = page.getByTestId("now-line");
    await expect(line).toBeVisible();
    await expect(page.getByTestId("now-label")).toHaveText("3:22 PM");
    expect(Number(await line.getAttribute("data-top"))).toBeCloseTo(((15 * 60 + 22 - OPEN) / 60) * HOUR, 0);
    await page.clock.runFor("01:05");
    await expect(page.getByTestId("now-label")).toHaveText("3:23 PM");
    expect(Number(await line.getAttribute("data-top"))).toBeCloseTo(((15 * 60 + 23 - OPEN) / 60) * HOUR, 0);
    // Not on other days.
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByTestId("now-line")).toHaveCount(0);
  });

  test("no now line before opening or after closing", async ({ page }) => {
    await open(page, "/admin/calendar", new Date(new Date().setHours(8, 0, 0, 0)));
    await expect(page.getByTestId("day-grid")).toBeVisible();
    await expect(page.getByTestId("now-line")).toHaveCount(0);
  });
});

test.describe("navigation", () => {
  test("previous, next and Today move the day and the URL", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${iso(tomorrow())}`));
    await expect(page.getByText(format(tomorrow(), "EEEE, d MMM"))).toBeVisible();
    // Two quick clicks move two days.
    await page.getByRole("button", { name: "Previous day" }).dblclick();
    await expect(page.getByText(format(addDays(new Date(), -1), "EEEE, d MMM"))).toBeVisible();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page).not.toHaveURL(/date=/);
    await expect(page.getByText(format(new Date(), "EEEE, d MMM"))).toBeVisible();
  });

  test("switching branch changes the columns", async ({ page }) => {
    await open(page);
    await page.getByLabel("Branch").selectOption({ label: "Lake View" });
    await expect(page.locator("[data-column]")).toHaveCount(3);
    await expect(page.getByTestId("day-grid").getByText("Dev Sharma", { exact: true })).toBeVisible();
    await expect(page.getByTestId("day-grid").getByText("Jhon Abraham", { exact: true })).toHaveCount(0);
    await page.getByLabel("Branch").selectOption({ label: "City Mall (paused)" });
    await expect(page.locator("[data-column]")).toHaveCount(2);
    await expect(page.getByTestId("day-grid").getByText("11 AM", { exact: true })).toBeVisible(); // City Mall opens at 11
    await expect(page.getByTestId("day-grid").getByText("10 AM", { exact: true })).toHaveCount(0);
  });

  test("a bookmarked URL restores branch, day and open booking", async ({ page }) => {
    await open(page, `/admin/calendar?branch=station-road&date=${iso(tomorrow())}&ref=BR-20481`);
    await expect(page.getByLabel("Branch")).toHaveValue("station-road");
    await expect(page.getByText(format(tomorrow(), "EEEE, d MMM"))).toBeVisible();
  });
});

test.describe("details and new bookings from the calendar", () => {
  test("clicking a block opens the same detail panel as the bookings page", async ({ page }) => {
    await open(page);
    const b = block(page, "BR-20481");
    await b.click();
    await expect(page).toHaveURL(/ref=BR-20481/);
    await expect(b).toHaveAttribute("aria-pressed", "true");
    const panel = page.getByRole("article", { name: "Booking BR-20481" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Aarav Mehta");
    await expect(panel.getByRole("link", { name: /^Call/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Reschedule" })).toBeVisible();
  });

  test("clicking an empty slot opens New booking with that barber and time chosen", async ({ page }) => {
    await open(page);
    await seedTomorrow(page, [{ ref: "BR-70001", barber: "jhon", h: 11 }]);
    const col = await colBox(page, "kabir");
    const min = 15 * 60; // 3 PM, free
    // The click picks the slot whose row the pointer is in (a quarter hour of slack above the line).
    await page.mouse.click(col.x + col.width / 2, col.y + ((min - OPEN) / 60) * HOUR + HOUR / 4 + 2);
    const dialog = page.getByRole("dialog", { name: "New booking" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Date")).toHaveValue(iso(tomorrow()));
    await expect(dialog.getByLabel("Barber")).toHaveValue("kabir-main-street");
    await expect(dialog.getByRole("button", { name: "3:00 PM", pressed: true })).toBeVisible();
    await dialog.getByLabel("Customer name").fill("Calendar Click");
    await dialog.getByLabel("Mobile number").fill("9822200000");
    await dialog.getByLabel("No fee").check();
    await dialog.getByRole("button", { name: "Create booking" }).click();
    const toast = page.getByText(/^Booking BR-\d+ created$/);
    await expect(toast).toBeVisible();
    const ref = (await toast.innerText()).match(/BR-\d+/)![0];
    const created = block(page, ref);
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("data-top", String(((min - OPEN) / 60) * HOUR));
    expect((await bookingOf(page, ref)).barberId).toBe("kabir-main-street");
  });

  test("clicking a break or a time that has passed does nothing useful, and says so", async ({ page }) => {
    await open(page, "/admin/calendar", new Date(new Date().setHours(15, 22, 0, 0)));
    const min = await freeMinute(page, "kabir-main-street", iso(new Date()), 10 * 60, 15 * 60);
    const col = await colBox(page, "kabir");
    await page.mouse.click(col.x + col.width / 2, col.y + ((min - OPEN) / 60) * HOUR + HOUR / 4 + 2); // a free time earlier today
    await expect(page.getByText("That time has already passed.")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "New booking" })).toHaveCount(0);
    await page.locator('[data-column="kabir-main-street"] [data-break]').scrollIntoViewIfNeeded();
    const lunch = await box(page.locator('[data-column="kabir-main-street"] [data-break]'));
    await page.mouse.click(lunch.x + lunch.width / 2, lunch.y + lunch.height / 2);
    await expect(page.getByRole("dialog", { name: "New booking" })).toHaveCount(0);
  });

  test("Reschedule in the panel moves the block", async ({ page }) => {
    await open(page);
    await seedTomorrow(page, [{ ref: "BR-70002", barber: "jhon", h: 11, name: "Moveable Mo" }]);
    await block(page, "BR-70002").click();
    await page.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: /^Reschedule/ });
    await dialog.getByRole("button", { name: "4:00 PM" }).click();
    await dialog.getByRole("button", { name: "Move booking" }).click();
    await expect(page.getByText(/^Moved to /)).toBeVisible();
    await expect(block(page, "BR-70002")).toHaveAttribute("data-top", String(((16 * 60 - OPEN) / 60) * HOUR));
  });
});

test.describe("drag to reschedule", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Mouse drag is for desktop; phones and keyboards use Reschedule or Alt+arrows");
    await open(page);
    await seedTomorrow(page, [
      { ref: "BR-71001", barber: "jhon", h: 11, name: "Drag Me" },
      { ref: "BR-71002", barber: "jhon", h: 15, name: "Blocker One" },
      { ref: "BR-71003", barber: "arjun", h: 17, name: "Blocker Two" },
    ]);
  });

  test("moving to a free time works, shows a toast with Undo, and Undo puts it back", async ({ page }) => {
    await drag(page, "BR-71001", "jhon", 16 * 60, { release: false });
    await expect(page.getByTestId("drag-ghost")).toHaveAttribute("data-ok", "true");
    await expect(page.getByTestId("drag-ghost")).toContainText("4 PM");
    await page.mouse.up();
    await expect(page.getByText("Moved Drag M. to 4 PM · Jhon")).toBeVisible();
    await expect(block(page, "BR-71001")).toHaveAttribute("data-top", String(((16 * 60 - OPEN) / 60) * HOUR));
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(16 * 60);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Move undone")).toBeVisible();
    await expect(block(page, "BR-71001")).toHaveAttribute("data-top", String(((11 * 60 - OPEN) / 60) * HOUR));
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(11 * 60);
  });

  test("dragging to another barber changes the barber", async ({ page }) => {
    await drag(page, "BR-71001", "kabir", 12 * 60);
    await expect(page.getByText("Moved Drag M. to 12 PM · Kabir")).toBeVisible();
    const b = await bookingOf(page, "BR-71001");
    expect(b.barberId).toBe("kabir-main-street");
    expect(minOf(b.startsAt)).toBe(12 * 60);
    const col = await box(column(page, "kabir"));
    const r = await box(block(page, "BR-71001"));
    expect(r.x).toBeGreaterThanOrEqual(col.x - 1);
    expect(r.x + r.width).toBeLessThanOrEqual(col.x + col.width + 1);
  });

  test("a move that would overlap is refused, and the booking stays put", async ({ page }) => {
    await drag(page, "BR-71001", "jhon", 15 * 60, { release: false });
    await expect(page.getByTestId("drag-ghost")).toHaveAttribute("data-ok", "false");
    await expect(page.getByTestId("drag-ghost")).toContainText("not possible");
    await page.mouse.up();
    await expect(page.getByText("That time overlaps another booking.")).toBeVisible();
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(11 * 60);
    await expect(block(page, "BR-71001")).toHaveAttribute("data-top", String(((11 * 60 - OPEN) / 60) * HOUR));
    // Back to back is fine: a 30 minute booking at 2:30 PM ends exactly when the 3 PM one starts.
    await drag(page, "BR-71001", "jhon", 14 * 60 + 30);
    await expect(page.getByText("Moved Drag M. to 2:30 PM · Jhon")).toBeVisible();
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(14 * 60 + 30);
  });

  test("refuses a barber's lunch break and the other barber's busy time", async ({ page }) => {
    await drag(page, "BR-71001", "jhon", 13 * 60);
    await expect(page.getByText("That falls in the barber's break.")).toBeVisible();
    await drag(page, "BR-71001", "arjun", 17 * 60);
    await expect(page.getByText("That time overlaps another booking.")).toBeVisible();
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(11 * 60);
    expect((await bookingOf(page, "BR-71001")).barberId).toBe("jhon-main-street");
  });

  test("Escape cancels a drag, and a plain click still opens the details", async ({ page }) => {
    await drag(page, "BR-71001", "jhon", 16 * 60, { release: false });
    await expect(page.getByTestId("drag-ghost")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
    expect(minOf((await bookingOf(page, "BR-71001")).startsAt)).toBe(11 * 60);
    await block(page, "BR-71001").click();
    await expect(page).toHaveURL(/ref=BR-71001/);
  });

  test("a drag never opens the details, and many moves never create an overlap", async ({ page }) => {
    await drag(page, "BR-71001", "jhon", 12 * 60);
    await expect(page).not.toHaveURL(/ref=/);
    for (const [barber, min] of [["arjun", 12 * 60], ["kabir", 14 * 60], ["jhon", 15 * 60], ["dev", 18 * 60], ["jhon", 16 * 60]] as const) {
      await drag(page, "BR-71001", barber, min);
      await page.waitForTimeout(150);
    }
    const db = await readDb(page);
    const tomorrowStr = iso(tomorrow());
    const live = db.bookings.filter((b: { branchId: string; startsAt: string; status: string }) => b.branchId === "main-street" && iso(new Date(b.startsAt)) === tomorrowStr && b.status === "CONFIRMED");
    for (const a of live) for (const c of live) {
      if (a.ref >= c.ref || a.barberId !== c.barberId) continue;
      expect(+new Date(a.startsAt) < +new Date(c.endsAt) && +new Date(c.startsAt) < +new Date(a.endsAt), `${a.ref} overlaps ${c.ref}`).toBe(false);
    }
  });
});

test.describe("keyboard: Alt plus arrows moves a booking", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await seedTomorrow(page, [
      { ref: "BR-72001", barber: "jhon", h: 11, name: "Key Board" },
      { ref: "BR-72002", barber: "jhon", h: 12, name: "Neighbour" },
    ]);
  });

  test("Alt+Down moves 30 minutes, Alt+Right changes barber, a blocked move is explained", async ({ page }) => {
    const b = block(page, "BR-72001");
    await b.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(page.getByText("Moved Key B. to 10:30 AM · Jhon")).toBeVisible();
    expect(minOf((await bookingOf(page, "BR-72001")).startsAt)).toBe(10 * 60 + 30);
    await b.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(page.getByText("Moved Key B. to 10 AM · Jhon")).toBeVisible();
    await b.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(page.getByText("That is outside opening hours.")).toBeVisible(); // can't go above 10 AM
    await b.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page.getByText(/Moved Key B\. to 10 AM · Arjun/)).toBeVisible();
    expect((await bookingOf(page, "BR-72001")).barberId).toBe("arjun-main-street");
    // Moving into the neighbour's slot is refused.
    await b.focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page.getByText(/Moved Key B\. to 10 AM · Jhon/).last()).toBeVisible();
  });

  test("Alt+Down onto a neighbour is refused; Enter opens the details", async ({ page }) => {
    const b = block(page, "BR-72001");
    await b.focus();
    await page.keyboard.press("Alt+ArrowDown"); // 11:30 overlaps the 12:00 booking? no: 11:30-12:00 touches
    await expect(page.getByText("Moved Key B. to 11:30 AM · Jhon")).toBeVisible();
    await b.focus();
    await page.keyboard.press("Alt+ArrowDown"); // 12:00 is taken
    await expect(page.getByText("That time overlaps another booking.")).toBeVisible();
    expect(minOf((await bookingOf(page, "BR-72001")).startsAt)).toBe(11 * 60 + 30);
    await b.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/ref=BR-72001/);
    await expect(page.getByRole("article", { name: "Booking BR-72001" })).toBeVisible();
  });

  test("blocks are reachable by Tab and describe how to move them", async ({ page }) => {
    await expect(block(page, "BR-72001")).toHaveAttribute("aria-describedby", "move-hint");
    await expect(page.locator("#move-hint")).toContainText("Alt");
    await page.locator("[data-block]").first().focus();
    await expect(page.locator("[data-block]").first()).toBeFocused();
  });
});

test.describe("the week view", () => {
  test("shows seven days for one barber and matches the data", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    const grid = page.getByTestId("week-grid");
    await expect(grid).toBeVisible();
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) await expect(grid.getByText(d, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Barber")).toHaveValue("jhon-main-street");
    const db = await readDb(page);
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => iso(addDays(monday, i)));
    const count = (barber: string) => db.bookings.filter((b: { barberId: string; startsAt: string; status: string }) => b.barberId === barber && days.includes(iso(new Date(b.startsAt))) && !["CANCELLED", "NO_SHOW"].includes(b.status)).length;
    await expect(grid.locator("[data-block]")).toHaveCount(count("jhon-main-street"));
    await page.getByLabel("Barber").selectOption({ label: "Kabir Khan" });
    await expect(page).toHaveURL(/barber=kabir-main-street/);
    await expect(grid.locator("[data-block]")).toHaveCount(count("kabir-main-street"));
    // Every block sits inside the day column it belongs to.
    for (const el of await grid.locator("[data-block]").all()) {
      const ref = await el.getAttribute("data-ref");
      const b = db.bookings.find((x: { ref: string }) => x.ref === ref);
      const dayCol = grid.locator(`[data-day="${iso(new Date(b.startsAt))}"]`);
      await expect(dayCol.locator(`[data-ref="${ref}"]`)).toHaveCount(1);
    }
  });

  test("steps by a week, and a day header opens that day", async ({ page }) => {
    await open(page, "/admin/calendar?view=week");
    const label = async () => (await page.locator("header p").first().innerText()).trim();
    const first = await label();
    await page.getByRole("button", { name: "Next week" }).click();
    await expect.poll(label).not.toBe(first);
    await page.getByRole("button", { name: "Previous week" }).click();
    await expect.poll(label).toBe(first);
    await page.getByRole("button", { name: /^Open \w+day \d+ \w+$/ }).nth(2).click();
    await expect(page).not.toHaveURL(/view=week/);
    await expect(page.getByTestId("day-grid")).toBeVisible();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page).not.toHaveURL(/date=/);
  });

  test("clicking an empty slot in the week view books that barber on that day", async ({ page }) => {
    await open(page, `/admin/calendar?view=week&date=${iso(addDays(new Date(), 8))}`);
    const day = page.locator(`[data-day="${iso(addDays(new Date(), 8))}"]`);
    await day.scrollIntoViewIfNeeded();
    const b = await box(day);
    await page.mouse.click(b.x + b.width / 2, b.y + ((11 * 60 - OPEN) / 60) * HOUR + HOUR / 4 + 2);
    const dialog = page.getByRole("dialog", { name: "New booking" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Date")).toHaveValue(iso(addDays(new Date(), 8)));
    await expect(dialog.getByLabel("Barber")).toHaveValue("jhon-main-street");
  });
});

test("phones: the grid scrolls sideways, the time axis stays, a tap opens a full-screen sheet", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone only");
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const grid = page.getByTestId("day-grid");
  await grid.evaluate((el) => (el.scrollLeft = 600));
  await expect(grid.getByText("12 PM", { exact: true })).toBeInViewport(); // the axis is sticky
  await grid.evaluate((el) => (el.scrollLeft = 0));
  await block(page, "BR-20481").click();
  const sheet = page.getByRole("dialog", { name: "Booking details" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("article", { name: "Booking BR-20481" })).toBeVisible();
  await sheet.getByRole("button", { name: "Close booking details" }).click();
  await expect(sheet).toBeHidden();
});
