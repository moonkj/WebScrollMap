import { describe, expect, it } from 'vitest';
import { isWsmMessage, DEFAULT_SETTINGS } from '@core/messages';

describe('isWsmMessage', () => {
  it('accepts typed messages', () => {
    expect(isWsmMessage({ type: 'get-settings' })).toBe(true);
    expect(isWsmMessage({ type: 'set-settings', settings: {} })).toBe(true);
    expect(isWsmMessage({ type: 'ping' })).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isWsmMessage(null)).toBe(false);
    expect(isWsmMessage('string')).toBe(false);
    expect(isWsmMessage(42)).toBe(false);
  });

  it('rejects missing type', () => {
    expect(isWsmMessage({})).toBe(false);
    expect(isWsmMessage({ foo: 'bar' })).toBe(false);
  });

  it('rejects unknown message type', () => {
    expect(isWsmMessage({ type: 'something-else' })).toBe(false);
  });

  it('rejects non-string type field', () => {
    expect(isWsmMessage({ type: 42 })).toBe(false);
    expect(isWsmMessage({ type: null })).toBe(false);
  });

  describe('set-settings payload', () => {
    it('accepts object settings', () => {
      expect(isWsmMessage({ type: 'set-settings', settings: { enabled: true } })).toBe(true);
    });
    it('rejects non-object settings', () => {
      expect(isWsmMessage({ type: 'set-settings' })).toBe(false);
      expect(isWsmMessage({ type: 'set-settings', settings: null })).toBe(false);
      expect(isWsmMessage({ type: 'set-settings', settings: 'bad' })).toBe(false);
    });
  });

  describe('jump-to-pin / delete-pin pinId', () => {
    it('accepts reasonable id', () => {
      expect(isWsmMessage({ type: 'jump-to-pin', pinId: 'pin-1' })).toBe(true);
      expect(isWsmMessage({ type: 'delete-pin', pinId: 'x' })).toBe(true);
    });
    it('rejects empty pinId', () => {
      expect(isWsmMessage({ type: 'jump-to-pin', pinId: '' })).toBe(false);
      expect(isWsmMessage({ type: 'delete-pin', pinId: '' })).toBe(false);
    });
    it('rejects pinId >= 128 chars', () => {
      const huge = 'a'.repeat(128);
      expect(isWsmMessage({ type: 'jump-to-pin', pinId: huge })).toBe(false);
      expect(isWsmMessage({ type: 'delete-pin', pinId: huge })).toBe(false);
    });
    it('accepts pinId up to 127 chars', () => {
      const ok = 'a'.repeat(127);
      expect(isWsmMessage({ type: 'jump-to-pin', pinId: ok })).toBe(true);
    });
    it('rejects non-string pinId', () => {
      expect(isWsmMessage({ type: 'jump-to-pin', pinId: 42 })).toBe(false);
      expect(isWsmMessage({ type: 'delete-pin' })).toBe(false);
    });
  });

  describe('settings-changed payload', () => {
    it('accepts object settings', () => {
      expect(isWsmMessage({ type: 'settings-changed', settings: {} })).toBe(true);
    });
    it('rejects null/missing settings', () => {
      expect(isWsmMessage({ type: 'settings-changed' })).toBe(false);
      expect(isWsmMessage({ type: 'settings-changed', settings: null })).toBe(false);
    });
  });

  describe('payload-less messages', () => {
    it('accepts all no-payload variants', () => {
      const noPayload = [
        'get-settings',
        'get-status',
        'clear-pins',
        'clear-trail',
        'get-pins',
        'get-entitlement',
        'telemetry-flush',
        'ping',
      ];
      for (const t of noPayload) expect(isWsmMessage({ type: t })).toBe(true);
    });
  });

  describe('removed message types are rejected', () => {
    it('rejects legacy tier/purchase/admin messages', () => {
      for (const t of ['set-admin-override', 'reset-admin-stats', 'admin-override-changed', 'entitlement-changed', 'purchase-pro', 'restore-purchases', 'get-admin-config', 'set-admin-enabled']) {
        expect(isWsmMessage({ type: t })).toBe(false);
      }
    });
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.side).toBe('right');
    expect([0, 16, 24]).toContain(DEFAULT_SETTINGS.marginPx);
    expect(DEFAULT_SETTINGS.telemetryOptIn).toBe(false);
  });
});
