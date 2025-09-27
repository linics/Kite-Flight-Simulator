import { describe, expect, it } from 'vitest';
import { computeLift, isStable, PHYSICS_CONSTANTS } from '../src/physics';

describe('computeLift', () => {
  it('should increase between 0 and stall angle', () => {
    const wind = 5;
    let last = computeLift(wind, 0);
    for (let alpha = 2; alpha <= PHYSICS_CONSTANTS.stallAlpha; alpha += 2) {
      const current = computeLift(wind, alpha);
      expect(current).toBeGreaterThanOrEqual(last);
      last = current;
    }
  });

  it('should decrease after stall angle', () => {
    const wind = 5;
    let last = computeLift(wind, PHYSICS_CONSTANTS.stallAlpha);
    for (let alpha = PHYSICS_CONSTANTS.stallAlpha + 2; alpha <= PHYSICS_CONSTANTS.maxAlpha; alpha += 2) {
      const current = computeLift(wind, alpha);
      expect(current).toBeLessThanOrEqual(last + 1e-6);
      last = current;
    }
  });
});

describe('isStable', () => {
  it('returns true for stable configuration', () => {
    const gravity = PHYSICS_CONSTANTS.gravity;
    expect(isStable(gravity + 0.2, gravity, 0, 0.05)).toBe(true);
  });

  it('is robust to slight disturbances', () => {
    const gravity = PHYSICS_CONSTANTS.gravity;
    expect(isStable(gravity + 0.1, gravity, 4.5, -0.1)).toBe(true);
    expect(isStable(gravity + 0.05, gravity, 6, 0.14)).toBe(false);
  });
});
