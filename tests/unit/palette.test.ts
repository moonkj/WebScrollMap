import { describe, expect, it } from 'vitest';
import { paletteFor, paletteForTheme, type Palette, type ThemeName } from '@ui/palette';

const REQUIRED_KEYS: Array<keyof Palette> = [
  'track',
  'indicator',
  'heading1',
  'heading2',
  'heading3',
  'media',
  'link',
  'trail',
  'searchGlow',
  'pin',
];

function expectCompletePalette(p: Palette) {
  for (const k of REQUIRED_KEYS) {
    expect(typeof p[k as string]).toBe('string');
    expect((p[k as string] as string).length).toBeGreaterThan(0);
  }
}

describe('paletteFor', () => {
  it('returns complete light palette with expected tokens', () => {
    const p = paletteFor('light');
    expectCompletePalette(p);
    // light-specific sentinel values
    expect(p.track).toBe('rgba(0,0,0,0.04)');
    expect(p.indicator).toBe('rgba(0,90,200,0.18)');
    expect(p.pin).toBe('rgba(249,115,22,1)');
  });

  it('returns complete dark palette with expected tokens', () => {
    const p = paletteFor('dark');
    expectCompletePalette(p);
    expect(p.track).toBe('rgba(255,255,255,0.06)');
    expect(p.indicator).toBe('rgba(180,220,255,0.35)');
    expect(p.pin).toBe('rgba(251,146,60,1)');
  });

  it('light and dark palettes are distinct', () => {
    const l = paletteFor('light');
    const d = paletteFor('dark');
    for (const k of REQUIRED_KEYS) {
      expect(l[k as string]).not.toBe(d[k as string]);
    }
  });

  it('returns a fresh object each call (no shared mutation)', () => {
    const a = paletteFor('light');
    const b = paletteFor('light');
    expect(a).not.toBe(b);
    a.pin = 'mutated';
    expect(b.pin).not.toBe('mutated');
  });
});

describe('paletteForTheme', () => {
  it('default theme returns base palette identical to paletteFor', () => {
    const baseLight = paletteFor('light');
    const theme = paletteForTheme('light', 'default');
    expect(theme).toEqual(baseLight);
  });

  it('default theme dark returns base dark palette', () => {
    const baseDark = paletteFor('dark');
    const theme = paletteForTheme('dark', 'default');
    expect(theme).toEqual(baseDark);
  });

  it('sunset theme overrides indicator/pin/searchGlow for light', () => {
    const base = paletteFor('light');
    const t = paletteForTheme('light', 'sunset');
    expect(t.indicator).toBe('rgba(239,68,68,0.18)');
    expect(t.pin).toBe('rgba(251,113,133,1)');
    expect(t.searchGlow).toBe('rgba(251,146,60,0.9)');
    // non-overridden keys preserved
    expect(t.track).toBe(base.track);
    expect(t.heading1).toBe(base.heading1);
  });

  it('sunset theme overrides indicator for dark', () => {
    const t = paletteForTheme('dark', 'sunset');
    expect(t.indicator).toBe('rgba(251,113,133,0.32)');
    expect(t.pin).toBe('rgba(251,113,133,1)');
  });

  it('ocean theme overrides accents for light', () => {
    const t = paletteForTheme('light', 'ocean');
    expect(t.indicator).toBe('rgba(2,132,199,0.18)');
    expect(t.pin).toBe('rgba(56,189,248,1)');
    expect(t.searchGlow).toBe('rgba(34,211,238,0.9)');
  });

  it('ocean theme overrides accents for dark', () => {
    const t = paletteForTheme('dark', 'ocean');
    expect(t.indicator).toBe('rgba(56,189,248,0.3)');
  });

  it('forest theme overrides accents for light and dark', () => {
    const tl = paletteForTheme('light', 'forest');
    expect(tl.indicator).toBe('rgba(22,163,74,0.2)');
    expect(tl.pin).toBe('rgba(74,222,128,1)');
    expect(tl.searchGlow).toBe('rgba(134,239,172,0.9)');

    const td = paletteForTheme('dark', 'forest');
    expect(td.indicator).toBe('rgba(134,239,172,0.28)');
  });

  it('mono theme overrides pin/searchGlow differently per scheme', () => {
    const tl = paletteForTheme('light', 'mono');
    expect(tl.indicator).toBe('rgba(15,23,42,0.18)');
    expect(tl.pin).toBe('rgba(15,23,42,1)');
    expect(tl.searchGlow).toBe('rgba(71,85,105,0.9)');

    const td = paletteForTheme('dark', 'mono');
    expect(td.indicator).toBe('rgba(255,255,255,0.22)');
    expect(td.pin).toBe('rgba(229,231,235,1)');
    expect(td.searchGlow).toBe('rgba(229,231,235,0.9)');
  });

  it('unknown theme falls back to base (default branch)', () => {
    // cast to escape type narrowing for exhaustive check
    const t = paletteForTheme('light', 'nonsense' as unknown as ThemeName);
    expect(t).toEqual(paletteFor('light'));
  });

  it('all named themes produce complete palettes', () => {
    const names: ThemeName[] = ['default', 'sunset', 'ocean', 'forest', 'mono'];
    for (const n of names) {
      for (const s of ['light', 'dark'] as const) {
        expectCompletePalette(paletteForTheme(s, n));
      }
    }
  });

  it('does not mutate base palette when building themed variant', () => {
    const base = paletteFor('light');
    const before = { ...base };
    paletteForTheme('light', 'sunset');
    paletteForTheme('light', 'mono');
    // re-fetch and compare structural equivalence
    expect(paletteFor('light')).toEqual(before);
  });
});
