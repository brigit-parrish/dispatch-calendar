const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

export default function validateEvent(candidate, items, now) {
  const errors = [];

  const title = String(candidate.title ?? "").trim();
  if (title.length < 5 || title.length > 35) {
    errors.push({ field: "title", message: "Title must be between 5 and 35 characters." });
  }

  if (candidate.group === undefined || candidate.group === null) {
    errors.push({ field: "group", message: "Event must be assigned to a user." });
  }

  if (!(candidate.end > candidate.start)) {
    errors.push({ field: "duration", message: "End must be after start." });
  } else if (candidate.end - candidate.start > DAY) {
    errors.push({ field: "duration", message: "Event cannot exceed 24 hours." });
  }

  const conflict = items.some(
    item =>
      item.id !== candidate.id &&
      item.group === candidate.group &&
      overlaps(candidate, item)
  );
  if (conflict) {
    errors.push({ field: "overlap", message: "This user already has an event at that time." });
  }

  const original =
    candidate.id !== undefined ? items.find(item => item.id === candidate.id) : undefined;
  const isLockedOriginal = original !== undefined && original.start <= now;

  if (isLockedOriginal) {
    errors.push({
      field: "locked",
      message: "This event has already started and can't be edited."
    });
  } else if (candidate.start <= now) {
    errors.push({ field: "start", message: "Cannot schedule an event to start in the past." });
  }

  return errors;
}
