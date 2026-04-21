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
  // Inline style — `!important`로 호스트 페이지 CSS 승리 보장.
  // 폭은 44px (iOS HIG 터치 타겟 최소치). 시각적 슬림은 내부 track CSS로 표현.
  host.style.cssText = [
    'position: fixed !important',
    'top: 0 !important',
    'right: 0 !important',
    'left: auto !important',
    'bottom: 0 !important',
    'width: 44px !important',
    'height: 100vh !important',
    'margin: 0 !important',
    'padding: 0 !important',
    'border: 0 !important',
    'box-shadow: none !important',
    'background: transparent !important',
    'display: block !important',
    `z-index: ${zIndex} !important`,
    // iOS: touch를 scroll로 해석하지 않도록 none. 스크러빙 제스처를 우리가 직접 처리.
    'touch-action: none !important',
    // host 자체는 터치 수신 — 내부 track이 시각만 담당.
    'pointer-events: auto !important',
  ].join(';');

  // Open shadow — closed 모드는 host 밖에서 composedPath()가 shadow 내부 노드를 잘라내
  // scrubber의 isTrackEvent 가드가 false를 반환하는 문제가 있었음.
  // S5 방어(다른 확장이 우리 tree 조작)는 랜덤 태그명으로 탐지 난이도를 유지.
  const root = host.attachShadow({ mode: 'open' });

  // Shadow 내부 리셋 — 자식에만 적용.
  // 히트 영역: 44px 전체. 시각: 외곽 6px만 노출 (clip-path).
  // 확장 시 clip 해제 + opacity 상승.
  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .wsm-track {
      position: absolute; top: 0; right: 0; bottom: 0; width: 100%;
      pointer-events: auto;
      touch-action: none;
      -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
      opacity: 0.7;
      transition: opacity 140ms ease-out, clip-path 140ms ease-out, -webkit-clip-path 140ms ease-out;
      /* host에 --wsm-visible 변수로 동적 제어. 기본 6px 노출, 44px 히트영역 중 외곽만 */
      -webkit-clip-path: inset(0 0 0 calc(100% - var(--wsm-visible, 6px)));
      clip-path: inset(0 0 0 calc(100% - var(--wsm-visible, 6px)));
    }
    /* 접근성 + 배터리: reduce-motion / 화면 미노출 시 GPU 트랜지션 비활성화 */
    @media (prefers-reduced-motion: reduce) {
      .wsm-track { transition: none; }
    }
    :host(.wsm-side-left) .wsm-track {
      -webkit-clip-path: inset(0 calc(100% - var(--wsm-visible, 6px)) 0 0);
      clip-path: inset(0 calc(100% - var(--wsm-visible, 6px)) 0 0);
    }
    /* :active는 iOS 터치 중에만 활성 (release 즉시 해제) — :hover보다 안정적.
       wsm-expanded는 onPointerDown 시 JS에서 명시 추가, 해제 시 제거. */
    :host(:active) .wsm-track,
    :host(.wsm-expanded) .wsm-track {
      opacity: 0.95;
      -webkit-clip-path: inset(0);
      clip-path: inset(0);
    }
    /* H7: 스크럽 중(.wsm-expanded) clip-path transition 제거 — 140ms 애니메이션이
       indicator 시각적 위치를 교란하는 부작용 차단. 이미 확장 완료 상태. */
    :host(.wsm-expanded) .wsm-track {
      transition: none;
    }
    @keyframes wsm-pin-pulse {
      0% { transform: translateY(-50%) scale(2); opacity: 0.2; }
      40% { transform: translateY(-50%) scale(1.3); opacity: 1; }
      100% { transform: translateY(-50%) scale(1); opacity: 1; }
    }
    .wsm-section-badge {
      position: absolute;
      top: 12px;
      padding: 4px 8px;
      border-radius: 6px;
      font: 600 11px/1.2 -apple-system, system-ui, sans-serif;
      color: #fff;
      background: rgba(15,23,42,0.92);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease-out;
    }
    .wsm-section-badge.wsm-visible { opacity: 1; }
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
