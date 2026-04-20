// S5 방어: 랜덤 태그명으로 호스트 엘리먼트 생성.
// S13: 외부 CDN 금지. 모든 스타일 인라인.
//
// CRITICAL: `:host { all: initial }`는 외부 inline style을 리셋시킴 (cascade).
// 따라서 shadow 내부 reset은 자식에만, host는 inline style로만 제어.

export interface ShadowMount {
  root: ShadowRoot;
  host: HTMLElement;
  unmount(): void;
}

function randomTagName(random: () => number): string {
  const suffix = Math.floor(random() * 1e9).toString(36);
  return `wsm-root-${suffix}`;
}

export function mountShadowHost(
  doc: Document,
  zIndex: number,
  random: () => number = Math.random,
): ShadowMount {
  const tag = randomTagName(random);
  const host = doc.createElement(tag);
  host.setAttribute('data-wsm', '1');
  // Inline style — `!important`로 호스트 페이지 CSS 승리 보장 (iOS Safari 일부 사이트 대응).
  // all: initial 금지 — display/position 리셋 사고 방지.
  host.style.cssText = [
    'position: fixed !important',
    'top: 0 !important',
    'right: 0 !important',
    'left: auto !important',
    'bottom: 0 !important',
    'width: 24px !important', // slim 기본 폭
    'height: 100vh !important',
    'margin: 0 !important',
    'padding: 0 !important',
    'border: 0 !important',
    'box-shadow: none !important',
    'background: transparent !important',
    'display: block !important',
    `z-index: ${zIndex} !important`,
    'pointer-events: none !important',
    'transition: width 120ms ease-out, background 120ms ease-out !important',
  ].join(';');

  const root = host.attachShadow({ mode: 'closed' });

  // Shadow 내부 리셋 — 자식에만 적용 (:host에 all: initial 쓰지 말 것).
  const style = doc.createElement('style');
  style.textContent = `
    :host { pointer-events: none; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .wsm-container { position: absolute; inset: 0; pointer-events: none; }
    .wsm-track {
      position: absolute; top: 0; right: 0; bottom: 0; width: 100%;
      pointer-events: auto;
      opacity: 0.25;
      transition: opacity 140ms ease-out;
    }
    :host(:hover) .wsm-track,
    :host(.wsm-expanded) .wsm-track { opacity: 0.95; }
  `;
  root.appendChild(style);

  (doc.body ?? doc.documentElement).appendChild(host);

  return {
    root,
    host,
    unmount() {
      host.remove();
    },
  };
}
