import { describe, expect, it } from 'vitest';
import { createTelemetry } from '@core/telemetry';

describe('telemetry', () => {
  it('records nothing when disabled (default)', () => {
    const t = createTelemetry();
    t.record({ kind: 'scan_slow', n: 120 });
    expect(t.snapshot()).toHaveLength(0);
  });

  it('records when enabled', () => {
    const t = createTelemetry({ now: () => 1 });
    t.setEnabled(true);
    t.record({ kind: 'pin_added' });
    const snap = t.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]!.kind).toBe('pin_added');
    expect(snap[0]!.ts).toBe(1);
  });

  it('caps at ring size', () => {
    const t = createTelemetry({ size: 5 });
    t.setEnabled(true);
    for (let i = 0; i < 10; i++) t.record({ kind: 'frame_slow', n: i });
    expect(t.snapshot()).toHaveLength(5);
    expect(t.snapshot()[0]!.n).toBe(5);
  });

  it('drain empties buffer', () => {
    const t = createTelemetry();
    t.setEnabled(true);
    t.record({ kind: 'mode_switch', tag: 'canvas' });
    expect(t.drain()).toHaveLength(1);
    expect(t.snapshot()).toHaveLength(0);
  });

  it('purges buffer on disable (privacy)', () => {
    const t = createTelemetry();
    t.setEnabled(true);
    t.record({ kind: 'pin_added' });
    t.setEnabled(false);
    expect(t.snapshot()).toHaveLength(0);
  });
});
