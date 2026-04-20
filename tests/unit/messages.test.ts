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
});

describe('DEFAULT_SETTINGS', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.side).toBe('right');
    expect([0, 16, 24]).toContain(DEFAULT_SETTINGS.marginPx);
    expect(DEFAULT_SETTINGS.telemetryOptIn).toBe(false);
  });
});
