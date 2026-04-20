// Pro 기능 게이팅 규칙. 한 곳에 모아 일관성 유지.
// Free tier 제공: 좌측 바 + 앵커 마커 + viewport indicator만.

import type { Tier } from './entitlement';
import type { Settings } from './messages';

export type ProFeature =
  | 'pin-drop'        // 롱프레스 북마크
  | 'pin-jump'        // 바 핀 마커 탭
  | 'trail'           // Progress Trail
  | 'magnifier'       // 스크럽 매그니파이
  | 'section-badge'   // 현재 섹션 배지
  | 'search'          // 커스텀 검색 패널 + 발광
  | 'floating-panel'  // 플로팅 메모장
  | 'manual-picker'   // 수동 컨테이너 피커
  | 'right-side'      // 바 우측 배치
  | 'margin-custom'   // 16 이외 margin
  | 'bar-width'       // 기본 6 이외 폭
  | 'opacity'         // 메모장 투명도 조절
  | 'theme'           // 커스텀 테마
  | 'smart-filter'    // 태그 필터
  | 'haptic'          // 핀/스냅 햅틱
  | 'telemetry';      // opt-in 텔레메트리 전송

export function isFeatureAvailable(tier: Tier, feature: ProFeature): boolean {
  if (tier === 'pro') return true;
  // Free 전용 허용 목록 없음 — Pro 기능은 전부 잠김.
  return false;
}

/** Free 사용자용으로 settings를 강제 제약. Pro가 아니면 오른쪽/마진/폭/투명도/필터/테마 전부 기본값 강제. */
export function applyTierConstraints(tier: Tier, settings: Settings): Settings {
  if (tier === 'pro') return settings;
  return {
    ...settings,
    side: 'left',
    marginPx: 16,
    barWidthPx: 10,
    floatingOpacity: 100,
    smartFilter: 'all',
    theme: 'default',
    telemetryOptIn: false,
  };
}

export const UPGRADE_PRICE_USD = '$0.99';
export const UPGRADE_PRICE_KRW = '₩1,400';

export function lockToastMessage(feature: ProFeature): string {
  switch (feature) {
    case 'pin-drop':
    case 'pin-jump':
    case 'floating-panel':
      return `Pro 전용: 핀 북마크 · ${UPGRADE_PRICE_USD}`;
    case 'search':
      return `Pro 전용: 페이지 내 검색 · ${UPGRADE_PRICE_USD}`;
    case 'magnifier':
    case 'section-badge':
      return `Pro 전용: 스크럽 프리뷰 · ${UPGRADE_PRICE_USD}`;
    case 'trail':
      return `Pro 전용: 읽은 구간 표시 · ${UPGRADE_PRICE_USD}`;
    case 'manual-picker':
      return `Pro 전용: 수동 영역 선택 · ${UPGRADE_PRICE_USD}`;
    case 'right-side':
    case 'margin-custom':
    case 'bar-width':
    case 'opacity':
      return `Pro 전용: 레이아웃 커스텀 · ${UPGRADE_PRICE_USD}`;
    case 'theme':
      return `Pro 전용: 테마 · ${UPGRADE_PRICE_USD}`;
    case 'smart-filter':
      return `Pro 전용: 태그 필터 · ${UPGRADE_PRICE_USD}`;
    case 'haptic':
      return `Pro 전용: 햅틱 · ${UPGRADE_PRICE_USD}`;
    case 'telemetry':
      return `Pro 전용`;
  }
}
