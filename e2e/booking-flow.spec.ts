import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";

const tomorrow = () => addDays(new Date(), 1);

async function fresh(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" }));
  });
}

/** Read-modify-write the mock database in localStorage (like a developer poking at the backend). */
async function editDb(page: Page, fn: string) {
  // The database is created the first time a page asks the mock API for data.
  await page.waitForFunction(() => !!localStorage.getItem("barbr-demo-v1"));
  await page.evaluate((src) => {
    const db = JSON.parse(localStorage.getItem("barbr-demo-v1")!);
    new Function("db", src)(db);
    localStorage.setItem("barbr-demo-v1", JSON.stringify(db));
  }, fn);
}
const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barbr-demo-v1")!));

/** Opens step 3 with tomorrow's first open slot chosen. */
async function toDetails(page: Page, query = "branch=main-street&service=hot-towel-shave") {
  await fresh(page);
  return gotoDetails(page, query);
}
async function gotoDetails(page: Page, query: string) {
  await page.goto(`/book/slot?${query}`);
  const d = tomorrow();
  await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
  await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
  await page.getByRole("link", { name: /^(Continue|Book a barber)$/ }).click();
  await expect(page).toHaveURL(/\/book\/details/);
  await expect(page.getByLabel("Full name")).toBeVisible();
}

const confirmButton = (page: Page) => page.getByRole("button", { name: /^(Confirm & [Pp]ay ₹\d+|Verify & hold slot)/ });

async function fillDetails(page: Page, o: { name?: string; phone?: string; upi?: string } = {}) {
  await page.getByLabel("Full name").fill(o.name ?? "Asha Rao");
  await page.getByLabel("Mobile number").fill(o.phone ?? "9811122233");
  if (o.upi !== "") {
    const upi = page.getByLabel("UPI ID");
    if (await upi.isVisible()) await upi.fill(o.upi ?? "asha@okbank");
  }
  await page.getByRole("checkbox").check();
}

test.describe("fee path", () => {
  test("validates, pays in the fake checkout and lands on the confirmation", async ({ page }) => {
    await toDetails(page);
    // Empty form: errors, and nothing is held.
    await confirmButton(page).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Enter a valid 10-digit mobile number")).toBeVisible();
    await expect(page.getByText("Enter a UPI ID like name@bank")).toBeVisible();
    await expect(page.getByText("Please accept the cancellation policy")).toBeVisible();
    expect((await readDb(page)).bookings.filter((b: { status: string; customer: { name: string } }) => b.status === "PENDING_FEE" && b.customer.name === "Asha Rao")).toHaveLength(0);

    await page.getByLabel("Mobile number").fill("12345");
    await page.getByLabel("Mobile number").blur();
    await expect(page.getByText("Enter a valid 10-digit mobile number")).toBeVisible();

    await fillDetails(page);
    await confirmButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Secure checkout" });
    await expect(dialog).toContainText("₹99");
    await expect(dialog).toContainText("UPI · asha@okbank");
    await expect(page.getByRole("timer").first()).toContainText(/^(9:[0-5]\d|10:00)$/); // the 10-minute hold is counting down
    await dialog.getByRole("button", { name: "Pay ₹99" }).click();

    await expect(page).toHaveURL(/\/book\/confirmed\/BR-\d+/);
    await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
    await expect(page.getByText("Confirmed · ₹99 paid")).toBeVisible();
    const ref = (await page.getByTestId("booking-ref").innerText()).trim();
    // It is in the shared mock store, so the admin panel will list it.
    const b = (await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref);
    expect(b).toMatchObject({ status: "CONFIRMED", holdMethod: "FEE", feeInr: 99, customer: { name: "Asha Rao", phone: "9811122233" } });
    // The wizard is cleared, so going back to step 3 starts over.
    await page.goto("/book/details");
    await expect(page).toHaveURL(/\/book\/branch/);
  });

  test("card and netbanking need their own details", async ({ page }) => {
    await toDetails(page);
    await fillDetails(page, { upi: "" });
    await page.getByRole("tab", { name: "Card" }).click();
    await confirmButton(page).click();
    await expect(page.getByText("Enter the 16-digit card number")).toBeVisible();
    await page.getByLabel("Card number").fill("4111 1111 1111 1111");
    await page.getByLabel("Expiry").fill("12/29");
    await page.getByLabel("CVV").fill("123");
    await page.getByRole("tab", { name: "Netbanking" }).click();
    await confirmButton(page).click();
    await expect(page.locator("#bank-err")).toHaveText("Choose your bank");
    await page.getByLabel("Bank").selectOption("HDFC Bank");
    await confirmButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("Netbanking · HDFC Bank");
  });

  test("a failed payment keeps the hold and can be retried", async ({ page }) => {
    await toDetails(page);
    await fillDetails(page);
    await page.evaluate(() => localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "payment" })));
    await confirmButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Secure checkout" });
    await dialog.getByRole("button", { name: "Pay ₹99" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Your slot is still held");
    expect((await readDb(page)).bookings.some((b: { status: string; customer: { name: string } }) => b.status === "PENDING_FEE" && b.customer.name === "Asha Rao")).toBe(true);

    await page.evaluate(() => localStorage.setItem("barbr-dev", JSON.stringify({ delay: false, errorMode: "off" })));
    await dialog.getByRole("button", { name: /Try again/ }).click();
    await expect(page).toHaveURL(/\/book\/confirmed/);
    await expect(page.getByText("Confirmed · ₹99 paid")).toBeVisible();
  });

  test("a refresh picks the hold up again and locks the form", async ({ page }) => {
    await toDetails(page);
    await fillDetails(page);
    await confirmButton(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Release hold and edit" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Asha Rao");
    await expect(page.getByLabel("Full name")).toBeDisabled();
    await expect(page.getByRole("timer").first()).toBeVisible();
    // Releasing frees the slot and unlocks the form.
    await page.getByRole("button", { name: "Release hold and edit" }).click();
    await expect(page.getByLabel("Full name")).toBeEnabled();
    expect((await readDb(page)).bookings.some((b: { status: string; customer: { name: string } }) => b.status === "PENDING_FEE" && b.customer.name === "Asha Rao")).toBe(false);
  });

  test("when the 10-minute hold runs out you go back to step 2 with a message and your choices", async ({ page }) => {
    await page.clock.install();
    await toDetails(page);
    await fillDetails(page);
    await confirmButton(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await page.clock.fastForward("10:05");
    await expect(page).toHaveURL(/\/book\/slot/);
    await expect(page.getByRole("alert").filter({ hasText: "Your hold ran out" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your booking" }).or(page.getByRole("heading", { level: 1 })).first()).toBeVisible();
    // Branch and service are still chosen.
    const store = await page.evaluate(() => JSON.parse(sessionStorage.getItem("barbr-wizard-v1")!).state);
    expect(store).toMatchObject({ branchId: "main-street", serviceId: "hot-towel-shave", holdRef: null });
  });
});

test.describe("OTP path", () => {
  async function chooseOtp(page: Page) {
    await page.getByRole("radio", { name: /Verify my number/ }).click();
    await expect(confirmButton(page)).toContainText("Verify & hold slot");
  }

  test("verify with 4815, hold the slot for free", async ({ page }) => {
    await toDetails(page);
    await fillDetails(page, { upi: "" });
    await chooseOtp(page);
    await expect(page.getByLabel("UPI ID")).toHaveCount(0);
    // Not verified yet.
    await confirmButton(page).click();
    await expect(page.getByText("Verify your number with the code first.")).toBeVisible();

    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByText(/Resend in 0:/)).toBeVisible();
    await page.getByLabel("Digit 1 of 4").fill("4815");
    await expect(page.getByText("✓ Number verified")).toBeVisible();
    await confirmButton(page).click();

    await expect(page).toHaveURL(/\/book\/confirmed/);
    await expect(page.getByText("Confirmed · OTP verified")).toBeVisible();
    const ref = (await page.getByTestId("booking-ref").innerText()).trim();
    const b = (await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref);
    expect(b).toMatchObject({ status: "CONFIRMED", holdMethod: "OTP", feeInr: 0 });
  });

  test("the summary follows the choice: pay now ₹0 for OTP, ₹99 for the fee", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Desktop summary card");
    await toDetails(page);
    const summary = page.getByRole("region", { name: "Your booking" });
    await expect(summary).toContainText("₹99");
    await expect(summary.getByRole("button", { name: "Confirm & pay ₹99" })).toBeVisible();
    await chooseOtp(page);
    await expect(summary).toContainText("Free (OTP)");
    await expect(summary.getByRole("button", { name: "Verify & hold slot" })).toBeVisible();
    await expect(summary.getByText("Pay now").locator("..")).toContainText("₹0");
  });

  test("a wrong code says how many tries are left, and 3 wrong codes lock the input", async ({ page }) => {
    await toDetails(page);
    await fillDetails(page, { upi: "" });
    await chooseOtp(page);
    const box = page.getByLabel("Digit 1 of 4");
    await box.fill("1111");
    await expect(page.getByText("That code is not right. 2 tries left.")).toBeVisible();
    await box.fill("2222");
    await expect(page.getByText("That code is not right. 1 try left.")).toBeVisible();
    await box.fill("3333");
    await expect(page.getByText(/Too many wrong codes. Try again in \d+ seconds/)).toBeVisible();
    await expect(box).toBeDisabled();
    await expect(page.getByText(/Locked for \d+s/)).toBeVisible();
  });
});

test.describe("hold rules", () => {
  test("a number with 2 earlier no-shows must pay the fee, with a friendly explanation", async ({ page }) => {
    await toDetails(page);
    await page.getByLabel("Full name").fill("Test Repeat");
    await page.getByLabel("Mobile number").fill("9000000001");
    await expect(page.getByText(/Because of earlier missed bookings/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toHaveAttribute("aria-checked", "true");
  });

  test("Fee only hides the OTP option; OTP only hides the fee option", async ({ page }) => {
    await fresh(page);
    await page.goto("/");
    await editDb(page, 'db.settings.holdMode = "FEE_ONLY"');
    await gotoDetails(page, "branch=main-street&service=hot-towel-shave");
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send OTP" })).toHaveCount(0);

    await editDb(page, 'db.settings.holdMode = "OTP_ONLY"');
    await page.goto("/book/details");
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Verify my number/ })).toBeVisible();
    await expect(confirmButton(page)).toContainText("Verify & hold slot");
  });

  test("a fee change in admin settings changes the checkout", async ({ page }) => {
    await fresh(page);
    await page.goto("/");
    await editDb(page, "db.settings.feeInr = 150");
    await gotoDetails(page, "branch=main-street&service=hot-towel-shave");
    await expect(page.getByRole("radio", { name: /Pay booking fee/ })).toContainText("₹150");
    await expect(confirmButton(page)).toContainText("₹150");
  });
});

test.describe("confirmation page", () => {
  async function booked(page: Page) {
    await toDetails(page);
    await fillDetails(page);
    await confirmButton(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Pay ₹99" }).click();
    await expect(page).toHaveURL(/\/book\/confirmed/);
    await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
    return (await page.getByTestId("booking-ref").innerText()).trim();
  }

  test("add to calendar downloads a real .ics file; directions open a maps search", async ({ page }) => {
    const ref = await booked(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Add to calendar" }).click()]);
    expect(download.suggestedFilename()).toBe(`barbr-${ref}.ics`);
    const text = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain(`UID:${ref}@barbr.demo`);
    expect(text).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    await expect(page.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Barbr%20Main%20Street/);
  });

  test("cancelling well ahead refunds the fee", async ({ page }) => {
    await booked(page);
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByTestId("refund-line")).toContainText("₹99 fee will be refunded");
    await page.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
    await expect(page.getByText("Cancelled · ₹99 refunded", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
  });

  test("cancelling inside 3 hours says there is no refund", async ({ page }) => {
    const ref = await booked(page);
    const soon = new Date(Date.now() + 2 * 3600_000).toISOString();
    const end = new Date(Date.now() + 3 * 3600_000).toISOString();
    await editDb(page, `const b = db.bookings.find(x => x.ref === "${ref}"); b.startsAt = "${soon}"; b.endsAt = "${end}";`);
    await page.reload();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByTestId("refund-line")).toContainText("within 3 hours of your slot");
    await page.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(page.getByText(/^Cancelled$/)).toBeVisible();
  });

  test("reschedule goes back to step 2 for this booking and moves it", async ({ page }) => {
    const ref = await booked(page);
    const before = await page.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d+ \w+ · \d+:\d\d (AM|PM)$/).first().innerText();
    await page.getByRole("button", { name: "Reschedule" }).click();
    await expect(page).toHaveURL(/\/book\/slot/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const d = addDays(new Date(), 2);
    await page.getByRole("button", { name: new RegExp(`^${format(d, "EEE")} ${d.getDate()},`) }).click();
    await page.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasText: /^\d{1,2}:\d\d (AM|PM)$/ }).first().click();
    await page.getByRole("button", { name: "Confirm new time" }).click();
    await expect(page).toHaveURL(new RegExp(`/book/confirmed/${ref}`));
    await expect(page.getByText(format(d, "EEE, d MMM"), { exact: false }).first()).toBeVisible();
    const after = await page.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d+ \w+ · \d+:\d\d (AM|PM)$/).first().innerText();
    expect(after).not.toBe(before);
    expect((await readDb(page)).bookings.find((x: { ref: string }) => x.ref === ref).events.some((e: { type: string }) => e.type === "RESCHEDULED")).toBe(true);
  });

  test("an unknown reference shows a friendly error", async ({ page }) => {
    await fresh(page);
    await page.goto("/book/confirmed/BR-00000");
    await expect(page.getByRole("heading", { name: "We could not find that booking" })).toBeVisible();
  });
});

test("step 3 without a chosen slot goes back", async ({ page }) => {
  await fresh(page);
  await page.goto("/book/details");
  await expect(page).toHaveURL(/\/book\/(branch|slot)/);
});

test("phone: order summary, sticky Cancel and Confirm bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone only");
  await toDetails(page);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.getByText("Date and time")).toBeVisible();
  await expect(page.getByText("Service type")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(confirmButton(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);
});
