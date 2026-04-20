import { TUNING } from '@config/tuning';
import type { RenderMode } from './types';

export interface RenderModeState {
  mode: RenderMode;
  lastSwitchAt: number;
}

// R2-2: 히스테리시스 + 쿨다운. 경계에서 토글 폭주 방지.
export function pickRenderMode(
  prev: RenderModeState,
  anchorCount: number,
  now: number,
): RenderModeState {
  const cooldown = now - prev.lastSwitchAt < TUNING.renderModeSwitchCooldownMs;
  if (cooldown) return prev;

  if (prev.mode === 'dom' && anchorCount >= TUNING.renderModeEnterCanvas) {
    return { mode: 'canvas', lastSwitchAt: now };
  }
  if (prev.mode === 'canvas' && anchorCount <= TUNING.renderModeExitCanvas) {
    return { mode: 'dom', lastSwitchAt: now };
  }
  return prev;
}

// 초기 결정 (히스테리시스 없음)
export function initialRenderMode(anchorCount: number, now: number): RenderModeState {
  const mode: RenderMode = anchorCount >= TUNING.renderModeEnterCanvas ? 'canvas' : 'dom';
  return { mode, lastSwitchAt: now };
}
