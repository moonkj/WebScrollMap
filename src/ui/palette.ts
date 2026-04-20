export interface Palette {
  track: string;
  indicator: string;
  heading1: string;
  heading2: string;
  heading3: string;
  media: string;
  link: string;
  trail: string;
  searchGlow: string;
  pin: string;
  [key: string]: string;
}

export type ThemeName = 'default' | 'sunset' | 'ocean' | 'forest' | 'mono';

export function paletteFor(scheme: 'light' | 'dark'): Palette {
  if (scheme === 'dark') {
    return {
      track: 'rgba(255,255,255,0.06)',
      indicator: 'rgba(180,220,255,0.35)',
      heading1: 'rgba(255,255,255,0.9)',
      heading2: 'rgba(220,220,220,0.75)',
      heading3: 'rgba(200,200,200,0.55)',
      media: 'rgba(100,200,255,0.8)',
      link: 'rgba(150,180,255,0.5)',
      trail: 'rgba(200,200,200,0.2)',
      searchGlow: 'rgba(34,211,238,0.9)',
      pin: 'rgba(251,146,60,1)', // 앰버 오렌지 — 검색 발광과 구분
    };
  }
  return {
    track: 'rgba(0,0,0,0.04)',
    indicator: 'rgba(0,90,200,0.18)',
    heading1: 'rgba(0,0,0,0.82)',
    heading2: 'rgba(0,0,0,0.6)',
    heading3: 'rgba(0,0,0,0.42)',
    media: 'rgba(0,120,200,0.7)',
    link: 'rgba(90,90,120,0.45)',
    trail: 'rgba(0,0,0,0.12)',
    searchGlow: 'rgba(8,145,178,0.85)',
    pin: 'rgba(249,115,22,1)', // 오렌지 500
  };
}

// Pro 테마: 기존 default 팔레트 위에 accent 색상만 덮어쓴 변형.
// light/dark 모두 유효하도록 scheme 인자 받음.
export function paletteForTheme(scheme: 'light' | 'dark', theme: ThemeName): Palette {
  const base = paletteFor(scheme);
  if (theme === 'default') return base;
  switch (theme) {
    case 'sunset':
      return {
        ...base,
        indicator: scheme === 'dark' ? 'rgba(251,113,133,0.32)' : 'rgba(239,68,68,0.18)',
        pin: 'rgba(251,113,133,1)',
        searchGlow: 'rgba(251,146,60,0.9)',
      };
    case 'ocean':
      return {
        ...base,
        indicator: scheme === 'dark' ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.18)',
        pin: 'rgba(56,189,248,1)',
        searchGlow: 'rgba(34,211,238,0.9)',
      };
    case 'forest':
      return {
        ...base,
        indicator: scheme === 'dark' ? 'rgba(134,239,172,0.28)' : 'rgba(22,163,74,0.2)',
        pin: 'rgba(74,222,128,1)',
        searchGlow: 'rgba(134,239,172,0.9)',
      };
    case 'mono':
      return {
        ...base,
        indicator: scheme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)',
        pin: scheme === 'dark' ? 'rgba(229,231,235,1)' : 'rgba(15,23,42,1)',
        searchGlow: scheme === 'dark' ? 'rgba(229,231,235,0.9)' : 'rgba(71,85,105,0.9)',
      };
    default:
      return base;
  }
}
