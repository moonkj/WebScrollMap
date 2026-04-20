// R2-5: 매직 넘버 격리. 사이트별 프로파일 훅 자리 예약.

export const TUNING = {
  // D2: MutationObserver debounce
  mutationDebounceMs: 500,
  mutationDebounceLiteMs: 1000,

  // D1: Canvas/DOM 하이브리드 히스테리시스 (R2-2)
  renderModeEnterCanvas: 600,
  renderModeExitCanvas: 550,
  renderModeSwitchCooldownMs: 1000,

  // 스크러빙/스냅
  snapThresholdPx: 12,
  edgeMarginPx: 16,

  // 활성화 조건
  minDocHeightRatio: 1.5, // viewport × 1.5 미만은 비활성

  // 성능 예산 (perf-budget.json과 동기화)
  scanWarnMs: 50,
  drawWarnMs: 4,
  maxAnchors: 5000,
  scanTimeBudgetMs: 50,

  // Quality mode
  qualityMode: {
    balancedBatteryLevel: 0.3,
    liteBatteryLevel: 0.15,
    modeChangeCooldownMs: 10_000,
  },

  // 텔레메트리 링 버퍼 (R2+ opt-in)
  telemetryRingSize: 100,
} as const;

export type TuningConfig = typeof TUNING;
