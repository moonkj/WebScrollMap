import { describe, expect, it } from 'vitest';
import { detectTheme } from '@ui/theme';

type MM = (q: string) => MediaQueryList;

function makeWin(opts: {
  matchMedia?: MM | null;
  bg?: string;
}): Window {
  const getComputedStyle = (_el: Element) =>
    ({ backgroundColor: opts.bg ?? 'rgb(255, 255, 255)' }) as CSSStyleDeclaration;
  const base: Partial<Window> = {
    getComputedStyle: getComputedStyle as Window['getComputedStyle'],
  };
  if (opts.matchMedia !== null && opts.matchMedia !== undefined) {
    (base as unknown as { matchMedia?: MM }).matchMedia = opts.matchMedia;
  }
  return base as Window;
}

function makeDoc(hasBody: boolean): Document {
  if (!hasBody) {
    return { body: null } as unknown as Document;
  }
  const d = document.implementation.createHTMLDocument('t');
  return d;
}

function mmMatches(matches: boolean): MM {
  return (_q: string) =>
    ({
      matches,
      media: '',
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
      onchange: null,
    }) as unknown as MediaQueryList;
}

describe('detectTheme', () => {
  it('returns dark when body background is very dark (lum < 128)', () => {
    const doc = makeDoc(true);
    const win = makeWin({ bg: 'rgb(10, 10, 10)', matchMedia: mmMatches(false) });
    expect(detectTheme(doc, win)).toBe('dark');
  });

  it('returns light when body background is very light (lum > 200)', () => {
    const doc = makeDoc(true);
    const win = makeWin({ bg: 'rgb(250, 250, 250)', matchMedia: mmMatches(true) });
    // bg is bright enough to short-circuit to light regardless of prefersDark
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('falls back to prefers-color-scheme when bg is mid-luminance (dark preferred)', () => {
    const doc = makeDoc(true);
    // rgb(160,160,160): YIQ ≈ 160 — between 128 and 200
    const win = makeWin({ bg: 'rgb(160, 160, 160)', matchMedia: mmMatches(true) });
    expect(detectTheme(doc, win)).toBe('dark');
  });

  it('falls back to prefers-color-scheme when bg is mid-luminance (light preferred)', () => {
    const doc = makeDoc(true);
    const win = makeWin({ bg: 'rgb(160, 160, 160)', matchMedia: mmMatches(false) });
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('returns light when body is missing and prefers-dark is false', () => {
    const doc = makeDoc(false);
    const win = makeWin({ bg: 'rgb(0,0,0)', matchMedia: mmMatches(false) });
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('returns dark when body is missing and prefers-dark is true', () => {
    const doc = makeDoc(false);
    const win = makeWin({ bg: 'rgb(0,0,0)', matchMedia: mmMatches(true) });
    expect(detectTheme(doc, win)).toBe('dark');
  });

  it('handles matchMedia throwing gracefully (treats as not dark)', () => {
    const doc = makeDoc(true);
    const throwing: MM = () => {
      throw new Error('not supported');
    };
    const win = makeWin({ bg: 'rgb(160,160,160)', matchMedia: throwing });
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('handles matchMedia being undefined', () => {
    const doc = makeDoc(true);
    // Explicitly omit matchMedia
    const win = { getComputedStyle: () => ({ backgroundColor: 'rgb(160,160,160)' }) as CSSStyleDeclaration } as unknown as Window;
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('handles unparseable background color (fallback lum = 255 → light branch)', () => {
    const doc = makeDoc(true);
    // 'transparent' has no digits — luminanceYIQ returns 255 → bright → light
    const win = makeWin({ bg: 'transparent', matchMedia: mmMatches(true) });
    expect(detectTheme(doc, win)).toBe('light');
  });

  it('works with default document/window arguments', () => {
    // Just ensure the call does not throw in happy-dom
    const result = detectTheme();
    expect(result === 'light' || result === 'dark').toBe(true);
  });
});
