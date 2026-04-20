// S5 방어: 랜덤 태그명으로 호스트 엘리먼트 생성. 외부 변조 감지용 MutationObserver는 entry에서 부착.
// S13: 외부 CDN 금지. 모든 스타일 인라인.

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
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 0',
    'right: 0',
    'width: 48px',
    'height: 100%',
    `z-index: ${zIndex}`,
    'pointer-events: none', // 기본은 투명 통과, 내부 요소가 개별로 활성화
  ].join(';');

  const root = host.attachShadow({ mode: 'closed' });

  // 셰도우 내부 리셋 + 기본 스타일
  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .wsm-container { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; }
    .wsm-track { position: absolute; top: 0; right: 0; bottom: 0; pointer-events: auto; }
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
