// R2-3: PlatformCapabilities 단일 관문. iOS/macOS 분기 산재 금지.

export interface PlatformCapabilities {
  isIOS: boolean;
  hasHaptics: boolean;
  prefersReducedMotion: boolean;
  pointerType: 'touch' | 'mouse' | 'mixed';
  safeAreaInsets(): { top: number; right: number; bottom: number; left: number };
}

function detectIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
}

export function getPlatform(): PlatformCapabilities {
  const ua = navigator.userAgent;
  const isIOS = detectIOS(ua);
  const touch = matchMedia('(pointer: coarse)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  return {
    isIOS,
    hasHaptics: isIOS, // iOS Safari의 Taptic은 직접 API 없음 — 향후 native messaging 또는 vibrate 폴백
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    pointerType: touch && fine ? 'mixed' : touch ? 'touch' : 'mouse',
    safeAreaInsets() {
      const cs = getComputedStyle(document.documentElement);
      const parse = (s: string) => parseFloat(s.replace('px', '')) || 0;
      return {
        top: parse(cs.getPropertyValue('--sat') || cs.getPropertyValue('safe-area-inset-top')),
        right: parse(cs.getPropertyValue('--sar') || cs.getPropertyValue('safe-area-inset-right')),
        bottom: parse(cs.getPropertyValue('--sab') || cs.getPropertyValue('safe-area-inset-bottom')),
        left: parse(cs.getPropertyValue('--sal') || cs.getPropertyValue('safe-area-inset-left')),
      };
    },
  };
}
