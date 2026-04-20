import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTelemetrySender } from '@core/telemetrySender';
import type { Telemetry, TelemetryEvent } from '@core/telemetry';

function mkTelemetry(overrides: Partial<Telemetry> = {}): Telemetry {
  const events: TelemetryEvent[] = [];
  return {
    enabled: vi.fn(() => true),
    record: vi.fn((e: TelemetryEvent) => { events.push(e); }),
    drain: vi.fn(() => events.splice(0, events.length)),
    setEnabled: vi.fn(),
    ...overrides,
  } as Telemetry;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('telemetrySender', () => {
  it('start/stop is idempotent', () => {
    vi.useFakeTimers();
    try {
      const t = mkTelemetry({ enabled: () => false });
      const s = createTelemetrySender(t, '/api', 'dev1');
      s.start();
      s.start(); // duplicate start — no-op
      s.stop();
      s.stop(); // duplicate stop — no-op
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushNow skips when disabled', async () => {
    const t = mkTelemetry({ enabled: () => false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const s = createTelemetrySender(t, '/api', 'dev1');
    await s.flushNow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flushNow skips when no events', async () => {
    const t = mkTelemetry();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const s = createTelemetrySender(t, '/api', 'dev1');
    await s.flushNow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flushNow POSTs events to endpoint', async () => {
    const events: TelemetryEvent[] = [
      { ts: 1, name: 'test', data: { a: 1 } } as unknown as TelemetryEvent,
    ];
    const t = mkTelemetry({ drain: () => events });
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
    const s = createTelemetrySender(t, 'https://api.example/collect', 'device-abc');
    await s.flushNow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example/collect');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.deviceId).toBe('device-abc');
    expect(body.events.length).toBe(1);
  });

  it('flushNow silently handles fetch rejection', async () => {
    const events: TelemetryEvent[] = [{ ts: 1, name: 'x', data: {} } as unknown as TelemetryEvent];
    const t = mkTelemetry({ drain: () => events });
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const s = createTelemetrySender(t, '/api', 'dev1');
    // must not throw
    await expect(s.flushNow()).resolves.toBeUndefined();
  });

  it('start() schedules setInterval with FLUSH_INTERVAL_MS=30s', () => {
    vi.useFakeTimers();
    try {
      const events: TelemetryEvent[] = [{ ts: 1, name: 'x', data: {} } as unknown as TelemetryEvent];
      const t = mkTelemetry({ drain: () => events });
      const fetchMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('fetch', fetchMock);
      const s = createTelemetrySender(t, '/api', 'dev1');
      s.start();
      vi.advanceTimersByTime(30_000);
      expect(fetchMock).toHaveBeenCalled();
      s.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
