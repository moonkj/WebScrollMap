import { beforeEach, describe, expect, it } from 'vitest';
import { createSignedStorage } from '@core/storage';
import { createPinStore, MAX_PINS } from '@core/pins';

function makeMemoryBackend() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('createPinStore', () => {
  let storage: ReturnType<typeof createSignedStorage>;
  beforeEach(() => {
    storage = createSignedStorage(makeMemoryBackend());
  });

  it('adds pins with generated ids', () => {
    let i = 0;
    const store = createPinStore(storage, '/a', () => i++ / 10);
    const p = store.add({ y: 100 });
    expect(p).not.toBeNull();
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]!.y).toBe(100);
  });

  it('rejects add past MAX_PINS', () => {
    const store = createPinStore(storage, '/a');
    for (let i = 0; i < MAX_PINS; i++) store.add({ y: i });
    expect(store.add({ y: 999 })).toBeNull();
    expect(store.list()).toHaveLength(MAX_PINS);
  });

  it('removes by id', () => {
    const store = createPinStore(storage, '/a');
    const p = store.add({ y: 50 })!;
    store.remove(p.id);
    expect(store.list()).toHaveLength(0);
  });

  it('persists across instances for same pathname', () => {
    const a = createPinStore(storage, '/foo');
    a.add({ y: 100 });
    const b = createPinStore(storage, '/foo');
    expect(b.list()).toHaveLength(1);
    expect(b.list()[0]!.y).toBe(100);
  });

  it('isolates by pathname', () => {
    const a = createPinStore(storage, '/foo');
    a.add({ y: 100 });
    const b = createPinStore(storage, '/bar');
    expect(b.list()).toHaveLength(0);
  });

  it('clear removes all', () => {
    const store = createPinStore(storage, '/a');
    store.add({ y: 1 });
    store.add({ y: 2 });
    store.clear();
    expect(store.list()).toHaveLength(0);
  });
});
