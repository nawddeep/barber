import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const tomorrow = () => addDays(new Date(), 1);
const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));

async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
}

/** The owner is signed in (the login screen has its own tests). */
const signInOwner = (page: Page) =>
  page.evaluate(() => localStorage.setItem("barbr-admin-session", JSON.stringify({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" })));

/** A customer books tomorrow's first open slot with Jhon at Main Street, paying the fee or verifying by OTP. Returns the ref. */
async function bookAsCustomer(page: Page, how: "FEE" | "OTP", name = "Asha Rao", phone = "9811122233") {
  await page.goto("/book/slot?branch=main-street&service=classic-haircut");
  const d = tomorrow();
  await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
  await page.getByRole("button", { name: /^Jhon Abraham/ }).click();
  await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
  await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("checkbox").check();
  if (how === "FEE") {
    await page.getByLabel("UPI ID").fill("asha@okbank");
    await page.getByRole("button", { name: /^Confirm & pay/ }).click();
    await page.getByRole("dialog", { name: "Secure checkout" }).getByRole("button", { name: "Pay ₹99" }).click();
  } else {
    await page.getByRole("radio", { name: /Verify my number/ }).click();
    await page.getByRole("button", { name: "Send OTP" }).click();
    await page.getByLabel("Digit 1 of 4").fill("4815");
    await expect(page.getByText("✓ Number verified")).toBeVisible();
    await page.getByRole("button", { name: "Verify & hold slot" }).click();
  }
  await expect(page).toHaveURL(/\/book\/confirmed\/BR-\d+/);
  await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
  return (await page.getByTestId("booking-ref").innerText()).trim();
}

const adminBooking = async (page: Page, ref: string) => {
  await page.goto(`/admin/bookings?range=month&q=${ref}&ref=${ref}`);
  const panel = page.getByRole("article", { name: `Booking ${ref}` });
  await expect(panel).toBeVisible();
  return panel;
};

test("journey 1: a customer books with the fee, and the owner sees it everywhere", async ({ page }) => {
  await fresh(page);
  const ref = await bookAsCustomer(page, "FEE");
  await expect(page.getByText("Confirmed · ₹99 paid")).toBeVisible();

  await signInOwner(page);
  // Bookings list: found by ref, name and status.
  await page.goto(`/admin/bookings?range=month&q=${ref}`);
  await expect(page.getByRole("button", { name: /Asha Rao/ })).toHaveCount(1);
  const panel = await adminBooking(page, ref);
  await expect(panel).toContainText("Asha Rao");
  await expect(panel).toContainText("Confirmed");
  await expect(panel).toContainText("Booking fee · UPI");
  await expect(panel).toContainText("₹99 paid");
  await expect(panel).toContainText("Booking created on website");
  await expect(panel).toContainText("₹99 fee received");
  // Calendar: a block in Jhon's column on the right day.
  await page.goto(`/admin/calendar?date=${iso(tomorrow())}`);
  await expect(page.locator(`[data-column="jhon-main-street"] [data-ref="${ref}"]`)).toBeVisible();
  // Dashboard: the week chart counts it (tomorrow is part of the week unless it is Monday).
  const db = await readDb(page);
  expect(db.payments.find((p: { bookingRef: string }) => p.bookingRef === ref)).toMatchObject({ status: "PAID", amountInr: 99, method: "UPI" });
});

test("journey 2: a customer books with a phone code, no fee", async ({ page }) => {
  await fresh(page);
  const ref = await bookAsCustomer(page, "OTP", "Rohan Das", "9822211144");
  await expect(page.getByText("Confirmed · OTP verified")).toBeVisible();
  await signInOwner(page);
  const panel = await adminBooking(page, ref);
  await expect(panel).toContainText("Rohan Das");
  await expect(panel).toContainText("Verified by OTP");
  await expect(panel).toContainText("No fee");
  await expect(panel).toContainText("Phone verified by OTP");
  const b = (await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref);
  expect(b).toMatchObject({ status: "CONFIRMED", holdMethod: "OTP", feeInr: 0 });
});

test("journey 3: a customer cancels inside the refund window, and the slot is free again", async ({ page }) => {
  await fresh(page);
  const ref = await bookAsCustomer(page, "FEE");
  const booking = (await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref);
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByTestId("refund-line")).toContainText("₹99 fee will be refunded");
  await page.getByRole("button", { name: "Yes, cancel booking" }).click();
  await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
  await expect(page.getByText("Cancelled · ₹99 refunded", { exact: true })).toBeVisible();

  await signInOwner(page);
  const panel = await adminBooking(page, ref);
  await expect(panel).toContainText("Cancelled");
  await expect(panel).toContainText("₹99 refunded");
  await expect(panel.getByRole("button", { name: /^Refund/ })).toHaveCount(0);
  await page.goto(`/admin/calendar?date=${iso(tomorrow())}`);
  await expect(page.locator(`[data-ref="${ref}"]`)).toHaveCount(0);

  // The slot is bookable again on the public flow.
  await page.goto("/book/slot?branch=main-street&service=classic-haircut");
  const d = tomorrow();
  await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
  await page.getByRole("button", { name: /^Jhon Abraham/ }).click();
  const when = format(new Date(booking.startsAt), "h:mm a");
  await expect(page.getByRole("button", { name: when, exact: true })).toBeEnabled();
});

test("journey 4: the owner moves a booking through its life, and the customer's page follows", async ({ page }) => {
  await fresh(page);
  const ref = await bookAsCustomer(page, "FEE");
  await signInOwner(page);
  let panel = await adminBooking(page, ref);
  await panel.getByRole("button", { name: "Start service" }).click();
  await expect(panel.getByText("In service", { exact: true })).toBeVisible();
  await page.goto(`/book/confirmed/${ref}`);
  await expect(page.getByRole("heading", { name: "Your visit is under way" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);

  panel = await adminBooking(page, ref);
  await panel.getByRole("button", { name: "Mark completed" }).click();
  await expect(panel.getByText("Completed", { exact: true })).toBeVisible();
  await page.goto(`/book/confirmed/${ref}`);
  await expect(page.getByRole("heading", { name: "Thanks for visiting!" })).toBeVisible();

  // A second customer who does not turn up.
  await page.goto("/");
  const ref2 = await bookAsCustomer(page, "OTP", "Late Larry", "9833300055");
  panel = await adminBooking(page, ref2);
  await panel.getByRole("button", { name: "Mark no-show" }).click();
  await expect(panel.getByText("No-show", { exact: true })).toBeVisible();
  await page.goto(`/book/confirmed/${ref2}`);
  await expect(page.getByRole("heading", { name: "We missed you" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book again" })).toBeVisible();
  // The owner's dashboard counts the no-show for the day it was booked.
  const db = await readDb(page);
  expect(db.bookings.find((b: { ref: string }) => b.ref === ref2).status).toBe("NO_SHOW");
});

test("journey 5: the owner changes the fee rules and the next customer sees them", async ({ page }) => {
  await fresh(page);
  await page.goto("/");
  await signInOwner(page);
  await page.goto("/admin/branches");
  const rules = page.getByRole("form", { name: "Booking fee rules" });
  await rules.getByRole("radio", { name: "Fee only" }).click();
  await rules.getByLabel("Booking fee", { exact: true }).fill("249");
  await rules.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();

  await page.goto("/book/slot?branch=main-street&service=classic-haircut");
  const d = tomorrow();
  await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
  await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
  await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
  await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toContainText("₹249");
  await expect(page.getByRole("radio", { name: /Verify my number/ })).toHaveCount(0);
  await page.getByLabel("Full name").fill("Fee Payer");
  await page.getByLabel("Mobile number").fill("9844400066");
  await page.getByLabel("UPI ID").fill("fee@okbank");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Confirm & pay ₹249/ }).click();
  await page.getByRole("dialog", { name: "Secure checkout" }).getByRole("button", { name: "Pay ₹249" }).click();
  await expect(page).toHaveURL(/\/book\/confirmed/);
  await expect(page.getByText("Confirmed · ₹249 paid")).toBeVisible();
  const ref = (await page.getByTestId("booking-ref").innerText()).trim();
  // The owner sees the fee that was actually charged at the time.
  const panel = await adminBooking(page, ref);
  await expect(panel).toContainText("₹249 paid");
  // Changing the rules again does not rewrite history.
  await page.goto("/admin/branches");
  await rules.getByLabel("Booking fee", { exact: true }).fill("50");
  await rules.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Fee rules saved. They apply to new bookings only.")).toBeVisible();
  await expect((await adminBooking(page, ref))).toContainText("₹249 paid");
});
