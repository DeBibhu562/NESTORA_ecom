// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Accordion, Stepper } from "./index";

afterEach(cleanup);

it("Stepper respects min/max and reports changes", async () => {
  const onChange = vi.fn();
  render(<Stepper value={1} min={1} max={2} onChange={onChange} />);
  expect((screen.getByLabelText("Decrease quantity") as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByLabelText("Increase quantity"));
  expect(onChange).toHaveBeenCalledWith(2);
});

it("Accordion toggles content", async () => {
  render(<Accordion items={[{ id: "a", title: "Specs", content: "SS 304" }]} />);
  expect(screen.queryByText("SS 304")).toBeNull();
  await userEvent.click(screen.getByText("Specs"));
  expect(screen.getByText("SS 304")).toBeTruthy();
});
