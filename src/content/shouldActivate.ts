import { TUNING } from '@config/tuning';

// 짧은 페이지 자동 비활성. H11 RTL/vertical도 여기서 스킵.
export function shouldActivate(doc: Document = document, win: Window = window): boolean {
  const scrollEl = doc.scrollingElement ?? doc.documentElement;
  const docHeight = scrollEl.scrollHeight;
  if (docHeight < win.innerHeight * TUNING.minDocHeightRatio) return false;

  const style = win.getComputedStyle(doc.documentElement);
  const wm = style.writingMode;
  if (wm && wm !== 'horizontal-tb') return false;

  return true;
}
