import { describe, expect, it } from 'vitest';
import { djb2, fnv1a, sign64 } from '@core/hash';

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

describe('fnv1a', () => {
  it('is deterministic + returns u32', () => {
    const h1 = fnv1a('hello world');
    const h2 = fnv1a('hello world');
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThanOrEqual(0xffffffff);
  });
  it('differs from djb2 for same input', () => {
    expect(fnv1a('abc')).not.toBe(djb2('abc'));
  });
});

describe('sign64', () => {
  it('produces hyphenated hex string', () => {
    const s = sign64('payload', 0x12345678);
    expect(s).toMatch(/^[0-9a-f]+-[0-9a-f]+$/);
  });
  it('is deterministic for same input', () => {
    expect(sign64('a', 1)).toBe(sign64('a', 1));
  });
  it('differs with different salt', () => {
    expect(sign64('x', 1)).not.toBe(sign64('x', 2));
  });
  it('differs with different body', () => {
    expect(sign64('a', 1)).not.toBe(sign64('b', 1));
  });
});
