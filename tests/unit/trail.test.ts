import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedStorage } from '@core/storage';
import { createTrailStore, MAX_TRAIL_SEGMENTS } from '@core/trail';

function makeBackend() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('createTrailStore', () => {
  let storage: ReturnType<typeof createSignedStorage>;
  beforeEach(() => {
    storage = createSignedStorage(makeBackend());
    vi.useFakeTimers();
  });

  it('merges adjacent segments', () => {
    const t = createTrailStore(storage, '/a');
    t.record(0, 100, 1);
    t.record(120, 200, 2); // gap 20 < MERGE_GAP (48) → merge
    const list = t.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.yStart).toBe(0);
    expect(list[0]!.yEnd).toBe(200);
  });

  it('keeps non-adjacent segments separate', () => {
    const t = createTrailStore(storage, '/a');
    t.record(0, 50, 1);
    t.record(500, 600, 2);
    expect(t.list()).toHaveLength(2);
  });

  it('ignores zero-width segments', () => {
    const t = createTrailStore(storage, '/a');
    t.record(100, 100, 1);
    t.record(100, 50, 2);
    expect(t.list()).toHaveLength(0);
  });

  it('keeps list sorted by yStart', () => {
    const t = createTrailStore(storage, '/a');
    t.record(500, 600, 2);
    t.record(100, 200, 1);
    t.record(1000, 1100, 3);
    const list = t.list();
    expect(list[0]!.yStart).toBeLessThan(list[1]!.yStart);
    expect(list[1]!.yStart).toBeLessThan(list[2]!.yStart);
  });

  it('caps at MAX_TRAIL_SEGMENTS', () => {
    const t = createTrailStore(storage, '/a');
    // create MAX+10 non-overlapping segments with visitedAt ascending
    for (let i = 0; i < MAX_TRAIL_SEGMENTS + 10; i++) {
      t.record(i * 1000, i * 1000 + 10, i);
    }
    expect(t.list().length).toBe(MAX_TRAIL_SEGMENTS);
  });

  it('flushes to storage after timer', () => {
    const t = createTrailStore(storage, '/a');
    t.record(0, 100, 1);
    vi.advanceTimersByTime(1100);
    const t2 = createTrailStore(storage, '/a');
    expect(t2.list()).toHaveLength(1);
  });
});
