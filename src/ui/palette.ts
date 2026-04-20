export interface Palette {
  track: string;
  indicator: string;
  heading1: string;
  heading2: string;
  heading3: string;
  media: string;
  link: string;
  trail: string;
}

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
  };
}
