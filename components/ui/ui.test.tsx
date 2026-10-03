import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button, OtpInput, StatusChip, Stepper, Toggle } from "@/components/ui";

describe("Button", () => {
  it("renders a link when href is given", () => {
    render(<Button href="/book/branch">Book</Button>);
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/book/branch");
  });
  it("renders a real button otherwise", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
});

describe("StatusChip", () => {
  it("uses the human label for each status", () => {
    render(<StatusChip status="PENDING_FEE" />);
    expect(screen.getByText("Fee pending")).toBeInTheDocument();
  });
});

describe("OtpInput", () => {
  it("renders four labelled boxes and reports typed digits", () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Digit 1 of 4"), { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith("4");
  });
  it("spreads a pasted code across the boxes", () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Digit 1 of 4"), { target: { value: "4815" } });
    expect(onChange).toHaveBeenCalledWith("4815");
  });
});

describe("Toggle", () => {
  it("exposes switch state and toggles", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Bookings open" />);
    const sw = screen.getByRole("switch", { name: "Bookings open" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Stepper", () => {
  it("marks the current step", () => {
    render(<Stepper current={2} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveAttribute("aria-current", "step");
  });
});
