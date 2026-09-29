// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import EventForm from "./EventForm";

afterEach(cleanup);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

function pad(n) {
  return String(n).padStart(2, "0");
}

// Matches EventForm's own datetime-local format; since the form reads
// these as local time, this depends on TZ, hence: always run via `npm test`.
function toDatetimeLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const GROUPS = [
  { id: "1", title: "Alice", rightTitle: "Smith" },
  { id: "2", title: "Bob", rightTitle: "Jones" }
];

function baseProps(overrides = {}) {
  return {
    open: true,
    mode: "add",
    groups: GROUPS,
    items: [],
    initialValues: {
      title: "",
      group: "1",
      start: NOW + HOUR,
      end: NOW + 2 * HOUR
    },
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

describe("EventForm", () => {
  it("renders 'New event' in add mode and prefills the driver from initialValues", () => {
    const { getByText, getByLabelText } = render(<EventForm {...baseProps()} />);
    expect(getByText("New event")).toBeTruthy();
    expect(getByLabelText("Driver").value).toBe("1");
  });

  it("renders 'Edit event' in edit mode", () => {
    const props = baseProps({
      mode: "edit",
      initialValues: { id: "5", title: "Existing", group: "1", start: NOW + HOUR, end: NOW + 2 * HOUR }
    });
    const { getByText } = render(<EventForm {...props} />);
    expect(getByText("Edit event")).toBeTruthy();
  });

  it("autofocuses the title input when opened", () => {
    const { getByLabelText } = render(<EventForm {...baseProps()} />);
    expect(document.activeElement).toBe(getByLabelText("Title"));
  });

  it("shows a specific message instead of a NaN-derived one when a date field is cleared", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <EventForm {...baseProps({ onSave })} />
    );
    fireEvent.change(getByLabelText("Start"), { target: { value: "" } });
    fireEvent.click(getByText("Save"));
    expect(getByText("Start and end are required.")).toBeTruthy();
    expect(queryByText("End must be after start.")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a title-length error and does not save when the title is too short", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(<EventForm {...baseProps({ onSave })} />);
    fireEvent.change(getByLabelText("Title"), { target: { value: "abc" } });
    fireEvent.click(getByText("Save"));
    expect(getByText("Title must be between 5 and 35 characters.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("trims the title before saving", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(<EventForm {...baseProps({ onSave })} />);
    fireEvent.change(getByLabelText("Title"), { target: { value: "  Pickup run  " } });
    fireEvent.click(getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].title).toBe("Pickup run");
  });

  it("shows an overlap error and does not save when the new time conflicts with an existing event for the same driver", () => {
    const onSave = vi.fn();
    const existing = {
      id: "20",
      group: "1",
      title: "Existing run",
      start: NOW + HOUR,
      end: NOW + 3 * HOUR
    };
    const props = baseProps({ onSave, items: [existing] });
    const { getByLabelText, getByText } = render(<EventForm {...props} />);
    fireEvent.change(getByLabelText("Title"), { target: { value: "Overlapping run" } });
    fireEvent.change(getByLabelText("Start"), {
      target: { value: toDatetimeLocal(existing.start + HOUR) }
    });
    fireEvent.change(getByLabelText("End"), {
      target: { value: toDatetimeLocal(existing.end + HOUR) }
    });
    fireEvent.click(getByText("Save"));
    expect(getByText("This user already has an event at that time.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows a duration error and does not save when the event exceeds 24 hours", () => {
    const onSave = vi.fn();
    const props = baseProps({ onSave });
    const { getByLabelText, getByText } = render(<EventForm {...props} />);
    fireEvent.change(getByLabelText("Title"), { target: { value: "Long haul run" } });
    const start = NOW + HOUR;
    fireEvent.change(getByLabelText("Start"), { target: { value: toDatetimeLocal(start) } });
    fireEvent.change(getByLabelText("End"), {
      target: { value: toDatetimeLocal(start + DAY + HOUR) }
    });
    fireEvent.click(getByText("Save"));
    expect(getByText("Event cannot exceed 24 hours.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders multiple errors at once (short title, overlap, and over-24h duration)", () => {
    const onSave = vi.fn();
    const existing = {
      id: "21",
      group: "1",
      title: "Existing run",
      start: NOW + HOUR,
      end: NOW + 3 * HOUR
    };
    const props = baseProps({ onSave, items: [existing] });
    const { getByLabelText, getByText } = render(<EventForm {...props} />);
    fireEvent.change(getByLabelText("Title"), { target: { value: "abc" } });
    fireEvent.change(getByLabelText("Start"), {
      target: { value: toDatetimeLocal(existing.start) }
    });
    fireEvent.change(getByLabelText("End"), {
      target: { value: toDatetimeLocal(existing.start + DAY + HOUR) }
    });
    fireEvent.click(getByText("Save"));
    expect(getByText("Title must be between 5 and 35 characters.")).toBeTruthy();
    expect(getByText("Event cannot exceed 24 hours.")).toBeTruthy();
    expect(getByText("This user already has an event at that time.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the locked banner and disables Save for an already-started event, but keeps Delete enabled", () => {
    const lockedItem = {
      id: "9",
      group: "1",
      title: "Active run",
      start: NOW - HOUR,
      end: NOW + HOUR
    };
    const onDelete = vi.fn();
    const props = baseProps({
      mode: "edit",
      items: [lockedItem],
      initialValues: {
        id: "9",
        title: "Active run",
        group: "1",
        start: lockedItem.start,
        end: lockedItem.end
      },
      onDelete
    });
    const { getByText, getByLabelText } = render(<EventForm {...props} />);
    expect(getByText("This event has started and can't be edited.")).toBeTruthy();
    expect(getByText("Save").disabled).toBe(true);
    expect(getByLabelText("Title").disabled).toBe(true);
    fireEvent.click(getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("9");
  });

  it("lets Delete succeed on a locked event even though its title would fail validation", () => {
    const lockedItem = {
      id: "30",
      group: "1",
      title: "ab",
      start: NOW - HOUR,
      end: NOW + HOUR
    };
    const onDelete = vi.fn();
    const props = baseProps({
      mode: "edit",
      items: [lockedItem],
      initialValues: {
        id: "30",
        title: lockedItem.title,
        group: "1",
        start: lockedItem.start,
        end: lockedItem.end
      },
      onDelete
    });
    const { getByText, queryByText } = render(<EventForm {...props} />);
    fireEvent.click(getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("30");
    expect(queryByText("Title must be between 5 and 35 characters.")).toBeNull();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<EventForm {...baseProps({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when clicking the overlay but not when clicking inside the dialog", () => {
    const onClose = vi.fn();
    const { getByText, container } = render(<EventForm {...baseProps({ onClose })} />);
    fireEvent.click(getByText("New event"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".event-form-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
