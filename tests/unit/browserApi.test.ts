import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBrowserApi } from '@platform/browserApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFakeBrowser(name: string) {
  const listeners = new Set<unknown>();
  return {
    __tag: name,
    storage: {
      local: {
        async get() {
          return {};
        },
        async set() {},
        async remove() {},
      },
    },
    runtime: {
      async sendMessage() {
        return { ok: true } as unknown;
      },
      onMessage: {
        addListener(cb: unknown) {
          listeners.add(cb);
        },
        removeListener(cb: unknown) {
          listeners.delete(cb);
        },
      },
    },
  };
}

describe('getBrowserApi', () => {
  it('returns native browser global when present with runtime.onMessage', () => {
    const fake = makeFakeBrowser('browser');
    vi.stubGlobal('browser', fake);
    const api = getBrowserApi() as unknown as { __tag?: string };
    expect(api.__tag).toBe('browser');
  });

  it('returns native chrome global when browser is absent', () => {
    const fake = makeFakeBrowser('chrome');
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', fake);
    const api = getBrowserApi() as unknown as { __tag?: string };
    expect(api.__tag).toBe('chrome');
  });

  it('prefers browser over chrome when both are present', () => {
    vi.stubGlobal('browser', makeFakeBrowser('browser'));
    vi.stubGlobal('chrome', makeFakeBrowser('chrome'));
    const api = getBrowserApi() as unknown as { __tag?: string };
    expect(api.__tag).toBe('browser');
  });

  it('falls back to stub when globals are missing', () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    expect(api.storage).toBeDefined();
    expect(api.storage.local).toBeDefined();
    expect(api.runtime).toBeDefined();
    expect(api.runtime.onMessage).toBeDefined();
  });

  it('falls back when browser exists but lacks runtime.onMessage', () => {
    vi.stubGlobal('browser', { storage: {}, runtime: {} });
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    expect((api as unknown as { __tag?: string }).__tag).toBeUndefined();
    expect(api.storage.local).toBeDefined();
  });

  it('fallback runtime.sendMessage rejects with explanatory error', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    await expect(api.runtime.sendMessage({})).rejects.toThrow(/unavailable/i);
  });

  it('fallback onMessage addListener/removeListener are no-ops', () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    const cb = () => {};
    expect(() => api.runtime.onMessage.addListener(cb)).not.toThrow();
    expect(() => api.runtime.onMessage.removeListener(cb)).not.toThrow();
  });

  it('fallback storage.local round-trips get/set/remove', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    const { local } = api.storage;
    await local.set({ a: 1, b: 'two' });
    const got = await local.get(['a', 'b']);
    expect(got).toEqual({ a: 1, b: 'two' });
    await local.remove('a');
    const after = await local.get(['a', 'b']);
    expect(after).toEqual({ b: 'two' });
  });

  it('fallback storage.local returns all entries when keys = null', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    await api.storage.local.set({ x: 1, y: 2 });
    const all = await api.storage.local.get(null);
    expect(all).toEqual({ x: 1, y: 2 });
  });

  it('fallback storage.local omits absent keys from result', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    await api.storage.local.set({ present: 'yes' });
    const got = await api.storage.local.get(['present', 'missing']);
    expect(got).toEqual({ present: 'yes' });
    expect('missing' in got).toBe(false);
  });

  it('fallback storage.local supports single-string key for get/remove', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    await api.storage.local.set({ solo: 42 });
    expect(await api.storage.local.get('solo')).toEqual({ solo: 42 });
    await api.storage.local.remove('solo');
    expect(await api.storage.local.get('solo')).toEqual({});
  });

  it('fallback provides a session storage area with the same contract', async () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    const api = getBrowserApi();
    expect(api.storage.session).toBeDefined();
    await api.storage.session!.set({ s: 1 });
    expect(await api.storage.session!.get('s')).toEqual({ s: 1 });
  });
});
