// 현재 스크롤 위치 바로 위의 가장 높은 레벨 heading을 표시.
// 스크럽/스크롤 중 '현재: 챕터 X' 감각.

import type { AnchorPoint, Disposable } from '@core/types';
import { AnchorKind } from '@core/types';

export interface SectionBadgeApi {
  show(): void;
  hide(): void;
  update(scrollY: number, anchors: ReadonlyArray<AnchorPoint>): void;
  destroy(): void;
}

function labelPrefix(kind: AnchorKind): string {
  switch (kind) {
    case AnchorKind.Heading1: return 'H1';
    case AnchorKind.Heading2: return 'H2';
    case AnchorKind.Heading3: return 'H3';
    default: return '';
  }
}

function isHeading(kind: AnchorKind): boolean {
  return (
    kind === AnchorKind.Heading1 ||
    kind === AnchorKind.Heading2 ||
    kind === AnchorKind.Heading3
  );
}

export function createSectionBadge(
  root: ShadowRoot,
  side: 'left' | 'right',
): SectionBadgeApi & Disposable {
  const doc = root.ownerDocument ?? document;
  const el = doc.createElement('div');
  el.className = 'wsm-section-badge';
  if (side === 'right') {
    el.style.right = '56px';
    el.style.left = '';
  } else {
    el.style.left = '56px';
    el.style.right = '';
  }
  root.appendChild(el);

  let lastText = '';

  function findCurrent(
    scrollY: number,
    anchors: ReadonlyArray<AnchorPoint>,
  ): AnchorPoint | null {
    let best: AnchorPoint | null = null;
    // anchors는 y 오름차순 정렬 가정. 스크롤 위치 ≤ anchor.y 바로 이전 heading.
    for (const a of anchors) {
      if (a.y > scrollY + 40) break; // 여유 40px
      if (isHeading(a.type) && a.snippet) best = a;
    }
    return best;
  }

  return {
    show() {
      el.classList.add('wsm-visible');
    },
    hide() {
      el.classList.remove('wsm-visible');
    },
    update(scrollY, anchors) {
      const cur = findCurrent(scrollY, anchors);
      const text = cur ? `${labelPrefix(cur.type)} · ${cur.snippet}` : '';
      if (text === lastText) return;
      lastText = text;
      if (!text) {
        el.classList.remove('wsm-visible');
        return;
      }
      el.textContent = text;
    },
    destroy() {
      el.remove();
    },
    dispose() {
      el.remove();
    },
  };
}
