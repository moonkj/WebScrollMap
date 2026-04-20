import { describe, expect, it } from 'vitest';
import { djb2 } from '@core/hash';

describe('djb2', () => {
  it('is deterministic', () => {
    expect(djb2('hello')).toBe(djb2('hello'));
  });

  it('differs for different inputs', () => {
    expect(djb2('hello')).not.toBe(djb2('world'));
  });

  it('returns u32', () => {
    const h = djb2('any text here with long content');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('handles empty string', () => {
    expect(djb2('')).toBe(5381);
  });
});
