import { describe, expect, it } from "vitest";

import {
  calculatePathSchedule,
  calculateSignatureTransform,
  type RectLike,
} from "./animationGeometry";

describe("calculateSignatureTransform", () => {
  it("calculates center-to-center translation and width scale", () => {
    const from: RectLike = { left: 100, top: 200, width: 400, height: 120 };
    const to: RectLike = { left: 40, top: 32, width: 200, height: 60 };

    expect(calculateSignatureTransform(from, to)).toEqual({
      x: -160,
      y: -198,
      scale: 0.5,
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an unusable source width of %s",
    (width) => {
      expect(() =>
        calculateSignatureTransform(
          { left: 0, top: 0, width, height: 20 },
          { left: 10, top: 10, width: 10, height: 10 },
        ),
      ).toThrow(RangeError);
    },
  );

  it("rejects non-finite rectangle measurements", () => {
    expect(() =>
      calculateSignatureTransform(
        { left: Number.NaN, top: 0, width: 10, height: 10 },
        { left: 0, top: 0, width: 10, height: 10 },
      ),
    ).toThrow(RangeError);
  });
});

describe("calculatePathSchedule", () => {
  it("allocates duration proportionally and overlaps adjacent paths", () => {
    const schedule = calculatePathSchedule([100, 200], 2.1, 0.08);

    expect(schedule[0]).toEqual({
      at: 0,
      duration: expect.closeTo(0.08 + 2.02 / 3),
    });
    expect(schedule[1]).toEqual({
      at: expect.closeTo(2.02 / 3),
      duration: expect.closeTo(0.08 + (2.02 * 2) / 3),
    });
    expect(Math.max(...schedule.map(({ at, duration }) => at + duration)))
      .toBeCloseTo(2.1);
  });

  it("keeps all-zero paths aligned without reserving draw time", () => {
    expect(calculatePathSchedule([0, 0], 2, 0.25)).toEqual([
      { at: 0, duration: 0 },
      { at: 0, duration: 0 },
    ]);
  });

  it("does not apply overlap or cursor movement for zero-length paths", () => {
    expect(calculatePathSchedule([1, 0, 1], 2, 0.25)).toEqual([
      { at: 0, duration: 1.125 },
      { at: 0.875, duration: 0 },
      { at: 0.875, duration: 1.125 },
    ]);
  });

  it("normalizes multiple extreme finite lengths without overflow", () => {
    expect(
      calculatePathSchedule(
        [Number.MAX_VALUE, Number.MAX_VALUE],
        2,
        0,
      ),
    ).toEqual([
      { at: 0, duration: 1 },
      { at: 1, duration: 1 },
    ]);
  });

  it("allocates the full duration to one extreme finite length", () => {
    expect(calculatePathSchedule([Number.MAX_VALUE], 2, 0)).toEqual([
      { at: 0, duration: 2 },
    ]);
  });

  it("returns an empty schedule for no paths", () => {
    expect(calculatePathSchedule([], 2, 0.1)).toEqual([]);
  });

  it("keeps starts monotonic and finishes on target with many uneven strokes", () => {
    const totalDuration = 2.1;
    const schedule = calculatePathSchedule(
      [780, 310, 655, 690, 680, 720, 640, 490, 430, 550, 550, 430, 390, 3, 550, 680],
      totalDuration,
      0.08,
    );

    expect(schedule.every((item, index) =>
      index === 0 || item.at >= schedule[index - 1].at,
    )).toBe(true);
    expect(schedule[13].duration).toBeGreaterThanOrEqual(0.08);
    expect(Math.max(...schedule.map(({ at, duration }) => at + duration)))
      .toBeCloseTo(totalDuration);
  });

  it("gives one active path the full requested duration", () => {
    expect(calculatePathSchedule([100], 2.1, 0.08)).toEqual([
      { at: 0, duration: 2.1 },
    ]);
  });

  it.each([
    [[1, -1], 1, 0],
    [[1, Number.NaN], 1, 0],
    [[1], -1, 0],
    [[1], Number.NaN, 0],
    [[1], 1, -1],
    [[1], 1, 1.01],
    [[1], 1, Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid inputs %#", (lengths, totalDuration, overlap) => {
    expect(() =>
      calculatePathSchedule([...lengths], totalDuration, overlap),
    ).toThrow(RangeError);
  });
});
