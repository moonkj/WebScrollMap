import { beforeEach, describe, expect, it } from 'vitest';
import { buildSearchIndex, searchIndex } from '@core/searchIndex';

function setOffset(el: HTMLElement, top: number) {
  Object.defineProperty(el, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
}

describe('buildSearchIndex', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns an array without throwing on empty doc', () => {
    const idx = buildSearchIndex(document.body);
    expect(Array.isArray(idx)).toBe(true);
  });

  it('handles root with children', () => {
    document.body.innerHTML = `<p>hello</p>`;
    const idx = buildSearchIndex(document.body);
    expect(Array.isArray(idx)).toBe(true);
    // happy-dom TreeWalker 필터 지원은 환경 의존적이므로 실사이트 동작은 E2E에서 검증.
  });
});

describe('searchIndex', () => {
  it('finds matches (case insensitive)', () => {
    const entries = [
      { y: 100, textLower: 'hello world' },
      { y: 200, textLower: 'goodbye' },
      { y: 300, textLower: 'hello again' },
    ];
    const hits = searchIndex(entries, 'HELLO');
    expect(hits).toHaveLength(2);
    expect(hits[0]!.y).toBe(100);
    expect(hits[1]!.y).toBe(300);
  });

  it('returns empty for queries shorter than 2 chars', () => {
    const entries = [{ y: 1, textLower: 'a b c' }];
    expect(searchIndex(entries, 'a')).toHaveLength(0);
    expect(searchIndex(entries, '')).toHaveLength(0);
  });

  it('dedupes near-adjacent hits', () => {
    const entries = [
      { y: 100, textLower: 'foo' },
      { y: 101, textLower: 'foo bar' },
      { y: 200, textLower: 'foo' },
    ];
    const hits = searchIndex(entries, 'foo');
    expect(hits).toHaveLength(2); // 100, 200 (101 merged into 100)
  });

  it('returns sorted by y', () => {
    const entries = [
      { y: 500, textLower: 'foo' },
      { y: 100, textLower: 'foo' },
      { y: 300, textLower: 'foo' },
    ];
    const hits = searchIndex(entries, 'foo');
    expect(hits.map((h) => h.y)).toEqual([100, 300, 500]);
  });
});
