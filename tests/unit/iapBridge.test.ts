import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BrowserLike = {
  runtime: {
    sendMessage?: (msg: unknown) => Promise<unknown>;
    sendNativeMessage?: (appId: string, msg: unknown) => Promise<unknown>;
    onMessage: { addListener: () => void; removeListener: () => void };
  };
  storage: { local: unknown; session: unknown };
};

function setBrowser(b: BrowserLike | undefined): void {
  vi.stubGlobal('browser', b);
  vi.stubGlobal('chrome', undefined);
}

async function importFresh() {
  vi.resetModules();
  return await import('@platform/iapBridge');
}

describe('iapBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchEntitlement', () => {
    it('returns entitlement from native response', async () => {
      const ent = {
        tier: 'pro',
        purchasedAt: 1,
        validUntil: 2,
        deviceId: 'd',
        signature: 's',
      };
      const sendNative = vi.fn().mockResolvedValue({ entitlement: ent });
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: sendNative,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      const r = await mod.fetchEntitlement();
      expect(r).toEqual(ent);
      expect(sendNative).toHaveBeenCalledWith(
        'com.kjmoon.WebScrollMap',
        { type: 'get-entitlement' },
      );
    });

    it('returns null when native unavailable', async () => {
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(await mod.fetchEntitlement()).toBeNull();
    });

    it('returns null on native rejection (swallowed)', async () => {
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: vi.fn().mockRejectedValue(new Error('boom')),
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(await mod.fetchEntitlement()).toBeNull();
    });

    it('returns null when response has no entitlement field', async () => {
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: vi.fn().mockResolvedValue({}),
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(await mod.fetchEntitlement()).toBeNull();
    });
  });

  describe('purchasePro', () => {
    it('sends purchase-pro type', async () => {
      const sendNative = vi
        .fn()
        .mockResolvedValue({ entitlement: { tier: 'pro' } });
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: sendNative,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      const r = await mod.purchasePro();
      expect(sendNative).toHaveBeenCalledWith(expect.any(String), { type: 'purchase-pro' });
      expect(r).toEqual({ tier: 'pro' });
    });
  });

  describe('restorePurchases', () => {
    it('sends restore-purchases type', async () => {
      const sendNative = vi
        .fn()
        .mockResolvedValue({ entitlement: { tier: 'pro' } });
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: sendNative,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      await mod.restorePurchases();
      expect(sendNative).toHaveBeenCalledWith(expect.any(String), { type: 'restore-purchases' });
    });
  });

  describe('playHaptic', () => {
    it('sends via background sendMessage always', async () => {
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      setBrowser({
        runtime: {
          sendMessage,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      mod.playHaptic('snap');
      expect(sendMessage).toHaveBeenCalledWith({ type: 'haptic', kind: 'snap' });
    });

    it('also sends native when available', async () => {
      const sendNative = vi.fn().mockResolvedValue(undefined);
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      setBrowser({
        runtime: {
          sendMessage,
          sendNativeMessage: sendNative,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      mod.playHaptic('pin');
      expect(sendMessage).toHaveBeenCalled();
      expect(sendNative).toHaveBeenCalledWith(expect.any(String), { type: 'haptic', kind: 'pin' });
    });

    it('does not throw when sendMessage rejects', async () => {
      const sendMessage = vi.fn(() => {
        throw new Error('no runtime');
      });
      setBrowser({
        runtime: {
          sendMessage,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(() => mod.playHaptic('edge')).not.toThrow();
    });

    it('accepts all three kinds', async () => {
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      setBrowser({
        runtime: {
          sendMessage,
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      mod.playHaptic('snap');
      mod.playHaptic('pin');
      mod.playHaptic('edge');
      expect(sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('isNativeHostAvailable', () => {
    it('true when sendNativeMessage defined', async () => {
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          sendNativeMessage: vi.fn(),
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(mod.isNativeHostAvailable()).toBe(true);
    });

    it('false when not present', async () => {
      setBrowser({
        runtime: {
          sendMessage: vi.fn(),
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
        storage: { local: {}, session: {} },
      });
      const mod = await importFresh();
      expect(mod.isNativeHostAvailable()).toBe(false);
    });
  });
});
