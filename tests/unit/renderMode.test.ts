import { describe, expect, it } from 'vitest';
import { initialRenderMode, pickRenderMode } from '@core/renderMode';
import { TUNING } from '@config/tuning';

describe('pickRenderMode (hysteresis + cooldown)', () => {
  it('initialRenderMode: dom below threshold', () => {
    const s = initialRenderMode(500, 0);
    expect(s.mode).toBe('dom');
  });

  it('initialRenderMode: canvas at threshold', () => {
    const s = initialRenderMode(TUNING.renderModeEnterCanvas, 0);
    expect(s.mode).toBe('canvas');
  });

  it('stays in dom when just under enter threshold', () => {
    const prev = { mode: 'dom' as const, lastSwitchAt: 0 };
    const next = pickRenderMode(prev, TUNING.renderModeEnterCanvas - 1, 5000);
    expect(next.mode).toBe('dom');
  });

  it('enters canvas at enter threshold when cooldown elapsed', () => {
    const prev = { mode: 'dom' as const, lastSwitchAt: 0 };
    const next = pickRenderMode(prev, TUNING.renderModeEnterCanvas, 5000);
    expect(next.mode).toBe('canvas');
    expect(next.lastSwitchAt).toBe(5000);
  });

  it('holds mode during cooldown', () => {
    const prev = { mode: 'dom' as const, lastSwitchAt: 1000 };
    const midCooldown = 1000 + TUNING.renderModeSwitchCooldownMs - 1;
    const next = pickRenderMode(prev, 5000, midCooldown);
    expect(next.mode).toBe('dom');
  });

  it('exits canvas only at exit threshold (hysteresis)', () => {
    const prev = { mode: 'canvas' as const, lastSwitchAt: 0 };
    // Between exit and enter (550..599): should stay canvas
    const hold = pickRenderMode(prev, TUNING.renderModeExitCanvas + 5, 5000);
    expect(hold.mode).toBe('canvas');
    // At exit threshold: switch to dom
    const flip = pickRenderMode(prev, TUNING.renderModeExitCanvas, 5000);
    expect(flip.mode).toBe('dom');
  });
});
