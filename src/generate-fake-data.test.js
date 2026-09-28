import { describe, it, expect } from "vitest";
import generateFakeData from "./generate-fake-data";

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

describe("generateFakeData", () => {
  it.each(Array.from({ length: 20 }, (_, i) => i))("run %i produces valid, non-overlapping data", () => {
    const { items } = generateFakeData();

    for (const item of items) {
      expect(item.start).toBeLessThan(item.end);

      const title = item.title.trim();
      expect(title.length).toBeGreaterThanOrEqual(5);
      expect(title.length).toBeLessThanOrEqual(35);
    }

    const byGroup = new Map();
    for (const item of items) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, []);
      byGroup.get(item.group).push(item);
    }

    for (const groupItems of byGroup.values()) {
      for (let i = 0; i < groupItems.length; i++) {
        for (let j = i + 1; j < groupItems.length; j++) {
          expect(overlaps(groupItems[i], groupItems[j])).toBe(false);
        }
      }
    }
  });
});
