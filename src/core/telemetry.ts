// R2+ / D9: 텔레메트리는 opt-in. 기본 off.
// 수집 데이터는 로컬 링 버퍼에만 누적 (100개 cap). 사용자가 명시 승인 + "리포트 보내기" 눌러야 전송.
// MVP: 전송 경로는 의도적으로 미구현 (S9/S12 회피). drain()만 노출.
// PII 금지 — URL, selector, DOM 텍스트 어느 것도 포함하지 말 것.

import { TUNING } from '@config/tuning';

export type TelemetryEventKind =
  | 'scan_slow'
  | 'frame_slow'
  | 'mode_switch'
  | 'container_picked_manual'
  | 'pin_added'
  | 'pin_cleared'
  | 'trail_cleared';

export interface TelemetryEvent {
  kind: TelemetryEventKind;
  ts: number;
  // 수치/카운트만 허용. 문자열은 enum으로 제약.
  n?: number;
  tag?: 'dom' | 'canvas' | 'window' | 'element' | 'none';
}

export interface Telemetry {
  enabled(): boolean;
  setEnabled(on: boolean): void;
  record(ev: Omit<TelemetryEvent, 'ts'>): void;
  snapshot(): ReadonlyArray<TelemetryEvent>;
  drain(): TelemetryEvent[];
  clear(): void;
}

export function createTelemetry(opts?: { now?: () => number; size?: number }): Telemetry {
  const now = opts?.now ?? (() => Date.now());
  const size = opts?.size ?? TUNING.telemetryRingSize;
  const buf: TelemetryEvent[] = [];
  let on = false;

  return {
    enabled: () => on,
    setEnabled: (v) => {
      on = !!v;
      if (!on) buf.length = 0; // off로 전환 시 즉시 파기 (D9 프라이버시)
    },
    record(ev) {
      if (!on) return;
      buf.push({ ts: now(), ...ev });
      if (buf.length > size) buf.splice(0, buf.length - size);
    },
    snapshot() {
      return buf.slice();
    },
    drain() {
      const out = buf.slice();
      buf.length = 0;
      return out;
    },
    clear() {
      buf.length = 0;
    },
  };
}
