import { describe, it, expect } from "vitest";
import validateEvent from "./validateEvent";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();

function hasField(errors, field) {
  return errors.some(e => e.field === field);
}

function baseCandidate(overrides = {}) {
  return {
    group: "1",
    title: "Deliver pallet to warehouse",
    start: NOW + DAY,
    end: NOW + DAY + HOUR,
    ...overrides
  };
}

describe("validateEvent - title length", () => {
  it.each([
    ["a".repeat(4), false],
    ["a".repeat(5), true],
    ["a".repeat(35), true],
    ["a".repeat(36), false],
    ["  hi  ", false],
    ["  Pickup run  ", true]
  ])("title %j is valid=%s", (title, expectedValid) => {
    const errors = validateEvent(baseCandidate({ title }), [], NOW);
    expect(!hasField(errors, "title")).toBe(expectedValid);
  });
});

describe("validateEvent - duration", () => {
  it("rejects end === start", () => {
    const start = NOW + DAY;
    const errors = validateEvent(baseCandidate({ start, end: start }), [], NOW);
    expect(hasField(errors, "duration")).toBe(true);
  });

  it("rejects end < start", () => {
    const start = NOW + DAY;
    const errors = validateEvent(baseCandidate({ start, end: start - HOUR }), [], NOW);
    expect(hasField(errors, "duration")).toBe(true);
  });

  it("accepts exactly 24h", () => {
    const start = NOW + DAY;
    const errors = validateEvent(baseCandidate({ start, end: start + DAY }), [], NOW);
    expect(hasField(errors, "duration")).toBe(false);
  });

  it("rejects 24h + 1ms", () => {
    const start = NOW + DAY;
    const errors = validateEvent(baseCandidate({ start, end: start + DAY + 1 }), [], NOW);
    expect(hasField(errors, "duration")).toBe(true);
  });

  it("accepts a window that crosses midnight but stays under 24h", () => {
    const start = new Date(2026, 6, 10, 23, 0, 0).getTime();
    const end = new Date(2026, 6, 11, 6, 0, 0).getTime();
    const errors = validateEvent(baseCandidate({ start, end }), [], NOW);
    expect(hasField(errors, "duration")).toBe(false);
  });

  it("rejects 6PM Oct 31 -> 6PM Nov 1 2026 as 25 elapsed hours across the US fall-back DST change (requires TZ=America/Chicago)", () => {
    const start = new Date(2026, 9, 31, 18, 0, 0).getTime();
    const end = new Date(2026, 10, 1, 18, 0, 0).getTime();
    expect(end - start).toBe(25 * HOUR);
    const errors = validateEvent(baseCandidate({ start, end }), [], NOW);
    expect(hasField(errors, "duration")).toBe(true);
  });
});

describe("validateEvent - overlap (same group only, self excluded)", () => {
  const existing = {
    id: "existing",
    group: "1",
    title: "Existing scheduled run",
    start: NOW + DAY,
    end: NOW + DAY + 2 * HOUR
  };

  it("allows back-to-back events (touching is not overlapping)", () => {
    const candidate = baseCandidate({ start: existing.end, end: existing.end + HOUR });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(false);
  });

  it("rejects a 1ms overlap", () => {
    const candidate = baseCandidate({ start: existing.end - 1, end: existing.end + HOUR });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(true);
  });

  it("rejects one event fully inside another", () => {
    const candidate = baseCandidate({
      start: existing.start + 10 * 60 * 1000,
      end: existing.end - 10 * 60 * 1000
    });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(true);
  });

  it("rejects identical start/end times", () => {
    const candidate = baseCandidate({ start: existing.start, end: existing.end });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(true);
  });

  it("does not conflict with itself when editing", () => {
    const candidate = { ...existing, title: "Existing scheduled run, updated" };
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(false);
  });

  it("does not conflict with the same time range in a different group", () => {
    const candidate = baseCandidate({
      group: "2",
      start: existing.start,
      end: existing.end
    });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "overlap")).toBe(false);
  });

  it("checks overlap against the destination group when moving to a new user", () => {
    const conflictInGroup2 = {
      id: "other",
      group: "2",
      title: "Someone else's run",
      start: existing.start,
      end: existing.end
    };
    const candidate = { ...existing, group: "2" };
    const errors = validateEvent(candidate, [existing, conflictInGroup2], NOW);
    expect(hasField(errors, "overlap")).toBe(true);
  });

  it("rejects a new event overlapping a currently-active (locked) event for the same user", () => {
    const activeItem = {
      id: "active1",
      group: "1",
      title: "Active delivery run",
      start: NOW - HOUR,
      end: NOW + 2 * HOUR
    };
    const candidate = baseCandidate({
      start: NOW + HOUR,
      end: NOW + 3 * HOUR
    });
    const errors = validateEvent(candidate, [activeItem], NOW);
    expect(hasField(errors, "overlap")).toBe(true);
  });
});

describe("validateEvent - locked / past-start rule", () => {
  it("rejects a new event starting in the past", () => {
    const errors = validateEvent(
      baseCandidate({ start: NOW - HOUR, end: NOW }),
      [],
      NOW
    );
    expect(hasField(errors, "start")).toBe(true);
  });

  it("accepts a new event starting in the future", () => {
    const errors = validateEvent(baseCandidate(), [], NOW);
    expect(hasField(errors, "start")).toBe(false);
  });

  it("rejects start === now exactly (inclusive boundary)", () => {
    const errors = validateEvent(
      baseCandidate({ start: NOW, end: NOW + HOUR }),
      [],
      NOW
    );
    expect(hasField(errors, "start")).toBe(true);
  });

  it("treats an id that doesn't match any stored item as a new event (no locked-original check)", () => {
    const candidate = baseCandidate({ id: "does-not-exist" });
    const errors = validateEvent(candidate, [], NOW);
    expect(errors).toEqual([]);
  });
});

describe("validateEvent - locked-original checks (editing an already-locked event)", () => {
  const lockedItem = {
    id: "locked1",
    group: "2",
    title: "Active delivery run",
    start: NOW - HOUR,
    end: NOW + HOUR
  };

  it("rejects moving a locked item to a new future start/group, with a distinct 'locked' field", () => {
    const candidate = {
      ...lockedItem,
      group: "3",
      start: NOW + 2 * HOUR,
      end: NOW + 3 * HOUR
    };
    const errors = validateEvent(candidate, [lockedItem], NOW);
    expect(hasField(errors, "locked")).toBe(true);
    expect(hasField(errors, "start")).toBe(false);
  });

  it("rejects resizing a locked item's right edge", () => {
    const candidate = { ...lockedItem, end: lockedItem.end + HOUR };
    const errors = validateEvent(candidate, [lockedItem], NOW);
    expect(hasField(errors, "locked")).toBe(true);
  });

  it("rejects resizing a locked item's left edge into the future, with a distinct 'locked' field", () => {
    const candidate = { ...lockedItem, start: NOW + HOUR };
    const errors = validateEvent(candidate, [lockedItem], NOW);
    expect(hasField(errors, "locked")).toBe(true);
    expect(hasField(errors, "start")).toBe(false);
  });

  it("rejects a title-only edit on an active event as 'locked', not 'start' (start never changed)", () => {
    const candidate = { ...lockedItem, title: "Active delivery run, renamed" };
    const errors = validateEvent(candidate, [lockedItem], NOW);
    expect(hasField(errors, "locked")).toBe(true);
    expect(hasField(errors, "start")).toBe(false);
  });

  it("rejects any edit when the stored start === now exactly", () => {
    const boundaryItem = { ...lockedItem, id: "locked2", start: NOW, end: NOW + HOUR };
    const candidate = { ...boundaryItem, title: "Renamed at the boundary" };
    const errors = validateEvent(candidate, [boundaryItem], NOW);
    expect(hasField(errors, "locked")).toBe(true);
  });

  it("allows editing an event that has not started yet", () => {
    const futureItem = {
      id: "future1",
      group: "2",
      title: "Upcoming delivery run",
      start: NOW + DAY,
      end: NOW + DAY + HOUR
    };
    const candidate = {
      ...futureItem,
      end: futureItem.end + HOUR,
      title: "Upcoming delivery run, extended"
    };
    const errors = validateEvent(candidate, [futureItem], NOW);
    expect(errors).toEqual([]);
  });
});

describe("validateEvent - combined behavior", () => {
  it("returns every applicable error, not just the first", () => {
    const existing = {
      id: "existing",
      group: "1",
      title: "Existing scheduled run",
      start: NOW + DAY,
      end: NOW + DAY + 2 * HOUR
    };
    const candidate = baseCandidate({
      title: "abc",
      start: existing.start,
      end: existing.end
    });
    const errors = validateEvent(candidate, [existing], NOW);
    expect(hasField(errors, "title")).toBe(true);
    expect(hasField(errors, "overlap")).toBe(true);
  });

  it("returns an empty array for a fully valid candidate", () => {
    const errors = validateEvent(baseCandidate(), [], NOW);
    expect(errors).toEqual([]);
  });
});

describe("validateEvent - invalid input types", () => {
  it.each([
    { desc: "empty title", overrides: { title: "" }, field: "title" },
    { desc: "NaN start", overrides: { start: NaN }, field: "duration" },
    { desc: "NaN end", overrides: { end: NaN }, field: "duration" },
    { desc: "missing group", overrides: { group: undefined }, field: "group" }
  ])("$desc -> error on $field", ({ overrides, field }) => {
    const errors = validateEvent(baseCandidate(overrides), [], NOW);
    expect(hasField(errors, field)).toBe(true);
  });
});
