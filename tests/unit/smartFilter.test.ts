import { describe, expect, it } from 'vitest';
import { applySmartFilter } from '@core/smartFilter';
import { AnchorKind, type AnchorPoint } from '@core/types';

function a(y: number, type: AnchorKind): AnchorPoint {
  return { y, type, weight: 1, textHash: 0, snippet: '' };
}

const fixture: AnchorPoint[] = [
  a(100, AnchorKind.Heading1),
  a(200, AnchorKind.Image),
  a(300, AnchorKind.Heading2),
  a(400, AnchorKind.StrongText),
  a(500, AnchorKind.Video),
  a(600, AnchorKind.LinkCluster),
];

describe('smartFilter', () => {
  it('all: returns everything unchanged', () => {
    expect(applySmartFilter(fixture, 'all')).toEqual(fixture);
  });

  it('headings: only h1/h2/h3', () => {
    const out = applySmartFilter(fixture, 'headings');
    expect(out).toHaveLength(2);
    expect(out.every((a) =>
      a.type === AnchorKind.Heading1 ||
      a.type === AnchorKind.Heading2 ||
      a.type === AnchorKind.Heading3,
    )).toBe(true);
  });

  it('media: only images and videos', () => {
    const out = applySmartFilter(fixture, 'media');
    expect(out).toHaveLength(2);
    expect(out.every((a) => a.type === AnchorKind.Image || a.type === AnchorKind.Video)).toBe(true);
  });
});
