import { describe, expect, it } from 'vitest';
import { snapToAnchor } from '@core/snap';

describe('snapToAnchor', () => {
  it('snaps when within threshold', () => {
    const anchors = [100, 200, 300, 400];
    const r = snapToAnchor(298, anchors, 12);
    expect(r.snapped).toBe(true);
    expect(r.y).toBe(300);
    expect(r.anchorIndex).toBe(2);
  });

  it('does not snap when outside threshold', () => {
    const anchors = [100, 500, 900];
    const r = snapToAnchor(250, anchors, 12);
    expect(r.snapped).toBe(false);
    expect(r.y).toBe(250);
  });

  it('handles empty array', () => {
    const r = snapToAnchor(42, [], 12);
    expect(r.snapped).toBe(false);
    expect(r.y).toBe(42);
    expect(r.anchorIndex).toBe(-1);
  });

  it('picks closest when between two anchors', () => {
    const anchors = [100, 200];
    const r = snapToAnchor(195, anchors, 12);
    expect(r.snapped).toBe(true);
    expect(r.y).toBe(200);
  });

  it('respects custom threshold', () => {
    const anchors = [100];
    expect(snapToAnchor(115, anchors, 10).snapped).toBe(false);
    expect(snapToAnchor(115, anchors, 20).snapped).toBe(true);
  });
});
