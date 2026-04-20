import { beforeEach, describe, expect, it } from 'vitest';
import { createSignedStorage } from '@core/storage';

function makeMemoryBackend() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    raw: data,
  };
}

describe('createSignedStorage', () => {
  let backend: ReturnType<typeof makeMemoryBackend>;
  beforeEach(() => {
    backend = makeMemoryBackend();
  });

  it('round-trips data through HMAC wrap', () => {
    const s = createSignedStorage(backend);
    s.write('k', { a: 1, b: 'hello' });
    expect(s.read('k')).toEqual({ a: 1, b: 'hello' });
  });

  it('rejects tampered payloads (S6)', () => {
    const s = createSignedStorage(backend);
    s.write('k', { pin: 42 });
    // simulate external tamper: mutate `d` without updating HMAC
    const raw = backend.raw.get('k')!;
    const parsed = JSON.parse(raw);
    parsed.d = { pin: 999 }; // attacker injects
    backend.raw.set('k', JSON.stringify(parsed));
    expect(s.read('k')).toBeNull();
    expect(backend.raw.has('k')).toBe(false);
  });

  it('rejects malformed json', () => {
    const s = createSignedStorage(backend);
    backend.raw.set('k', '{not json');
    expect(s.read('k')).toBeNull();
  });

  it('rejects version mismatch', () => {
    const s1 = createSignedStorage(backend, { version: 1 });
    s1.write('k', 'v1-data');
    const s2 = createSignedStorage(backend, { version: 2 });
    expect(s2.read('k')).toBeNull();
  });

  it('returns null for missing keys', () => {
    const s = createSignedStorage(backend);
    expect(s.read('missing')).toBeNull();
  });

  it('remove clears data', () => {
    const s = createSignedStorage(backend);
    s.write('k', 1);
    s.remove('k');
    expect(s.read('k')).toBeNull();
  });
});
