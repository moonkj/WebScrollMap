import { beforeEach, describe, expect, it } from 'vitest';
import { shouldActivate } from '@content/shouldActivate';

function mockDoc(scrollHeight: number, writingMode = 'horizontal-tb'): Document {
  const doc = document.implementation.createHTMLDocument('t');
  Object.defineProperty(doc.documentElement, 'scrollHeight', { value: scrollHeight, configurable: true });
  return doc;
}

function mockWin(innerHeight: number, writingMode = 'horizontal-tb'): Window {
  return {
    innerHeight,
    getComputedStyle: () => ({ writingMode } as CSSStyleDeclaration),
  } as unknown as Window;
}

describe('shouldActivate', () => {
  it('returns false for short pages', () => {
    const doc = mockDoc(800);
    const win = mockWin(1000);
    expect(shouldActivate(doc, win)).toBe(false);
  });

  it('returns true for long pages', () => {
    const doc = mockDoc(5000);
    const win = mockWin(1000);
    expect(shouldActivate(doc, win)).toBe(true);
  });

  it('returns false for vertical writing mode', () => {
    const doc = mockDoc(5000);
    const win = mockWin(1000, 'vertical-rl');
    expect(shouldActivate(doc, win)).toBe(false);
  });
});
