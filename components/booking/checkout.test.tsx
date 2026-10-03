import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCountdown, HoldTimer } from "./HoldTimer";
import { PaymentSheet } from "./PaymentSheet";

describe("formatCountdown", () => {
  it("formats m:ss and never goes negative", () => {
    expect(formatCountdown(600_000)).toBe("10:00");
    expect(formatCountdown(61_000)).toBe("1:01");
    expect(formatCountdown(500)).toBe("0:01");
    expect(formatCountdown(-5000)).toBe("0:00");
  });
});

describe("HoldTimer", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 2, 10, 0, 0) }));
  afterEach(() => vi.useRealTimers());

  it("counts down and calls onExpire exactly once", () => {
    const onExpire = vi.fn();
    render(<HoldTimer expiresAt={new Date(2026, 9, 2, 10, 0, 3).toISOString()} onExpire={onExpire} />);
    expect(screen.getByRole("timer")).toHaveTextContent("0:03");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("timer")).toHaveTextContent("0:01");
    expect(onExpire).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it("warns screen readers in the last minute", () => {
    render(<HoldTimer expiresAt={new Date(2026, 9, 2, 10, 0, 30).toISOString()} onExpire={() => {}} />);
    expect(screen.getByText("Less than a minute left on your hold")).toBeInTheDocument();
  });
});

describe("PaymentSheet", () => {
  const props = { amountInr: 99, payLine: "UPI · asha@okbank", description: "Hot Towel Shave · Sat, 3 Oct · 2:30 PM", onClose: () => {} };

  it("offers a Pay button that calls onPay", () => {
    const onPay = vi.fn();
    render(<PaymentSheet {...props} phase="idle" onPay={onPay} />);
    expect(screen.getByText("Demo payment · no money moves")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹99" }));
    expect(onPay).toHaveBeenCalled();
  });
  it("shows progress without a pay button while processing", () => {
    render(<PaymentSheet {...props} phase="processing" onPay={() => {}} />);
    expect(screen.getByText("Processing payment…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay ₹99/ })).toBeNull();
  });
  it("shows success", () => {
    render(<PaymentSheet {...props} phase="success" onPay={() => {}} />);
    expect(screen.getByText(/Payment received/)).toBeInTheDocument();
  });
  it("on failure says the slot is still held and offers a retry", () => {
    const onPay = vi.fn();
    render(<PaymentSheet {...props} phase="failed" error="Simulated failure" onPay={onPay} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your slot is still held");
    fireEvent.click(screen.getByRole("button", { name: "Try again · Pay ₹99" }));
    expect(onPay).toHaveBeenCalled();
  });
});
