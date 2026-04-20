import { TUNING } from '@config/tuning';

// DEV-only 경고 훅. 프로덕션에서 esbuild drop + 콘솔 제거로 제거됨.
export function warnSlowScan(elapsedMs: number): void {
  if (elapsedMs > TUNING.scanWarnMs) {
    console.warn(`[WebScrollMap] slow scan: ${elapsedMs.toFixed(1)}ms`);
  }
}

export function warnSlowFrame(ms: number): void {
  if (ms > TUNING.drawWarnMs) {
    console.warn(`[WebScrollMap] slow frame: ${ms.toFixed(1)}ms`);
  }
}
