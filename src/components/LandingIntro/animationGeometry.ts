export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SignatureTransform {
  x: number;
  y: number;
  scale: number;
}

export interface PathScheduleItem {
  at: number;
  duration: number;
}

function assertValidRect(rect: RectLike, name: string): void {
  const measurements = [rect.left, rect.top, rect.width, rect.height];

  if (measurements.some((measurement) => !Number.isFinite(measurement))) {
    throw new RangeError(`${name} rectangle measurements must be finite`);
  }
}

export function calculateSignatureTransform(
  from: RectLike,
  to: RectLike,
): SignatureTransform {
  assertValidRect(from, "Source");
  assertValidRect(to, "Target");

  if (from.width <= 0) {
    throw new RangeError("Source rectangle width must be greater than zero");
  }

  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: to.width / from.width,
  };
}

export function calculatePathSchedule(
  lengths: readonly number[],
  totalDuration: number,
  overlap: number,
): PathScheduleItem[] {
  if (!Number.isFinite(totalDuration) || totalDuration < 0) {
    throw new RangeError("Total duration must be a finite nonnegative number");
  }

  if (!Number.isFinite(overlap) || overlap < 0 || overlap > totalDuration) {
    throw new RangeError(
      "Overlap must be finite, nonnegative, and no greater than total duration",
    );
  }

  if (lengths.some((length) => !Number.isFinite(length) || length < 0)) {
    throw new RangeError("Path lengths must be finite nonnegative numbers");
  }

  if (lengths.length === 0) {
    return [];
  }

  const maxLength = lengths.reduce((maximum, length) =>
    Math.max(maximum, length),
  );

  if (maxLength === 0) {
    return lengths.map(() => ({ at: 0, duration: 0 }));
  }

  const normalizedLengths = lengths.map((length) => length / maxLength);
  const normalizedTotal = normalizedLengths.reduce(
    (sum, length) => sum + length,
    0,
  );
  const proportionalDuration = totalDuration - overlap;
  const durations = normalizedLengths.map((length) =>
    length === 0
      ? 0
      : overlap + proportionalDuration * (length / normalizedTotal),
  );

  let cursor = 0;

  return durations.map((duration, index) => {
    const at = cursor;

    if (lengths[index] !== 0) {
      cursor += duration - overlap;
    }

    return { at, duration };
  });
}
