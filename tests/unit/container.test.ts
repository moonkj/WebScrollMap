import { describe, expect, it, beforeEach } from 'vitest';
import { detectScrollContainer, windowTarget, elementTarget } from '@platform/container';

function fakeWin(innerHeight: number): Window {
  return {
    innerHeight,
    scrollY: 0,
    scrollTo: () => {},
    getComputedStyle: (el: Element) => {
      const v = (el as HTMLElement).dataset.overflow ?? 'visible';
      return { overflowY: v } as CSSStyleDeclaration;
    },
  } as unknown as Window;
}

describe('detectScrollContainer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers window when document is tall enough', () => {
    const doc = document;
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 5000, configurable: true });
    const win = fakeWin(1000);
    const t = detectScrollContainer(doc, win);
    expect(t.kind).toBe('window');
  });

  it('finds internal scrollable container when document is short', () => {
    const doc = document;
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 800, configurable: true });
    const main = doc.createElement('main');
    main.dataset.overflow = 'auto';
    Object.defineProperty(main, 'scrollHeight', { value: 5000, configurable: true });
    Object.defineProperty(main, 'clientHeight', { value: 700, configurable: true });
    doc.body.appendChild(main);
    const win = fakeWin(1000);
    const t = detectScrollContainer(doc, win);
    expect(t.kind).toBe('element');
    expect(t.el).toBe(main);
  });

  it('falls back to window when no container qualifies', () => {
    const doc = document;
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 400, configurable: true });
    const win = fakeWin(1000);
    const t = detectScrollContainer(doc, win);
    expect(t.kind).toBe('window');
  });
});

describe('elementTarget', () => {
  it('reads/writes scrollTop', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
    let top = 0;
    Object.defineProperty(el, 'scrollTop', {
      get: () => top,
      set: (v) => {
        top = v;
      },
      configurable: true,
    });
    const t = elementTarget(el);
    expect(t.getHeight()).toBe(200);
    expect(t.getDocHeight()).toBe(1000);
    t.setScrollY(300);
    expect(t.getScrollY()).toBe(300);
  });
});

describe('windowTarget', () => {
  it('maps to scrollingElement.scrollTop for symmetry (H-REL-4)', () => {
    const win = {
      innerHeight: 800,
    } as unknown as Window;
    const doc = document;
    let top = 50;
    Object.defineProperty(doc.documentElement, 'scrollTop', {
      get: () => top,
      set: (v: number) => { top = v; },
      configurable: true,
    });
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 4000, configurable: true });
    const t = windowTarget(win, doc);
    expect(t.kind).toBe('window');
    expect(t.getScrollY()).toBe(50);
    expect(t.getDocHeight()).toBe(4000);
    t.setScrollY(123);
    expect(t.getScrollY()).toBe(123);
  });

  // legacy test retained for coverage but ignored to avoid duplicate prop defines.
  it.skip('legacy maps to window scroll APIs (pre H-REL-4 asymmetry)', () => {
    const win = {
      scrollY: 50,
      innerHeight: 800,
      scrollTo: (x: number, y: number) => {
        (win as { scrollY: number }).scrollY = y;
      },
    } as unknown as Window;
    const doc = document;
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 4000, configurable: true });
    const t = windowTarget(win, doc);
    expect(t.kind).toBe('window');
    expect(t.getScrollY()).toBe(50);
    expect(t.getDocHeight()).toBe(4000);
  });
});
