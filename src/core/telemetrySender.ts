// Pro opt-in 원격 텔레메트리 전송. idle callback에 30s 배치.
// 1인 개발자 운영 기준 — 서버는 단순 POST 엔드포인트로 가정.
// 실패는 silent. IndexedDB 큐는 과잉 (ROI).

import type { Telemetry, TelemetryEvent } from './telemetry';

const FLUSH_INTERVAL_MS = 30_000;

export interface TelemetrySenderApi {
  start(): void;
  stop(): void;
  flushNow(): Promise<void>;
}

export function createTelemetrySender(
  telemetry: Telemetry,
  endpointUrl: string,
  deviceId: string,
): TelemetrySenderApi {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function flush(): Promise<void> {
    if (!telemetry.enabled()) return;
    const events = telemetry.drain();
    if (events.length === 0) return;
    const body: { deviceId: string; events: TelemetryEvent[] } = { deviceId, events };
    try {
      await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // CORS / CSP 실패 시 조용히 실패
        credentials: 'omit',
        keepalive: true,
      });
    } catch {
      // 실패 시 events는 이미 drain됨 — 1회 손실 허용 (ROI)
    }
  }

  return {
    start() {
      if (timer !== null) return;
      timer = setInterval(() => {
        void flush();
      }, FLUSH_INTERVAL_MS);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    flushNow() {
      return flush();
    },
  };
}
