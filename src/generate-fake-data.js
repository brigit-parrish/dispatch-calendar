import { faker } from "@faker-js/faker";
import randomColor from "randomcolor";
import moment from "moment";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 5 * 60;
const GUARANTEED_ACTIVE_GROUPS = 3;

function randomTitle() {
  const action = faker.helpers.arrayElement([
    "Pickup",
    "Delivery",
    "Drop-off",
    "Route check",
    "Load transfer",
    "Return run"
  ]);
  const title = `${action} at ${faker.location.streetAddress()}`;
  return title.length > 35 ? title.slice(0, 35).trim() : title;
}

function makeItem(id, group, start, end) {
  const title = randomTitle();
  return {
    id: `${id}`,
    group,
    title,
    start,
    end,
    className: [0, 6].includes(moment(start).day()) ? "item-weekend" : "",
    itemProps: {
      "data-tip": title
    }
  };
}

function randomStep(minStepMinutes, maxStepMinutes) {
  const stepMinutes = faker.number.int({ min: minStepMinutes, max: maxStepMinutes });
  const durationMinutes = faker.number.int({
    min: MIN_DURATION_MINUTES,
    max: MAX_DURATION_MINUTES
  });
  const gapMinutes = Math.max(5, stepMinutes - durationMinutes);
  return { gapMinutes, durationMinutes };
}

// `daysInPast` sizes the window symmetrically around now, so it also
// controls how far events are generated into the future.
export default function(groupCount = 30, itemCount = 1000, daysInPast = 30) {
  const randomSeed = Math.floor(Math.random() * 1000);
  const groups = [];
  for (let i = 0; i < groupCount; i++) {
    groups.push({
      id: `${i + 1}`,
      title: faker.person.firstName(),
      rightTitle: faker.person.lastName(),
      bgColor: randomColor({ luminosity: "light", seed: randomSeed + i })
    });
  }

  const now = Date.now();
  const windowStart = now - daysInPast * DAY;
  const windowEnd = now + daysInPast * DAY;
  const windowMinutes = (windowEnd - windowStart) / MINUTE;
  const targetItemsPerGroup = Math.max(1, itemCount / groupCount);
  const idealStepMinutes = windowMinutes / targetItemsPerGroup;
  const minStepMinutes = Math.max(MAX_DURATION_MINUTES + 5, idealStepMinutes * 0.5);
  const maxStepMinutes = Math.max(minStepMinutes + 1, idealStepMinutes * 1.5);

  const items = [];
  let nextId = 0;

  groups.forEach((group, groupIndex) => {
    let cursor = windowStart;

    // The first few groups always get an event spanning `now`, so a
    // locked/active item is guaranteed to be on screen for demoing.
    if (groupIndex < GUARANTEED_ACTIVE_GROUPS) {
      const activeDurationMinutes = faker.number.int({
        min: MIN_DURATION_MINUTES,
        max: MAX_DURATION_MINUTES
      });
      const activeStart = now - faker.number.int({ min: 0, max: activeDurationMinutes - 1 }) * MINUTE;
      const activeEnd = activeStart + activeDurationMinutes * MINUTE;

      let backCursor = activeStart;
      while (true) {
        const { gapMinutes, durationMinutes } = randomStep(minStepMinutes, maxStepMinutes);
        const end = backCursor - gapMinutes * MINUTE;
        const start = end - durationMinutes * MINUTE;
        if (start < windowStart) break;
        items.push(makeItem(nextId++, group.id, start, end));
        backCursor = start;
      }

      items.push(makeItem(nextId++, group.id, activeStart, activeEnd));
      cursor = activeEnd;
    }

    while (true) {
      const { gapMinutes, durationMinutes } = randomStep(minStepMinutes, maxStepMinutes);
      const start = cursor + gapMinutes * MINUTE;
      const end = start + durationMinutes * MINUTE;
      if (start > windowEnd) break;
      items.push(makeItem(nextId++, group.id, start, end));
      cursor = end;
    }
  });

  items.sort((a, b) => a.start - b.start);

  return { groups, items };
}
