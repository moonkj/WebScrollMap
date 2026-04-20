// D2: MutationObserver는 의미 컨테이너 우선, body 폴백.
// 500ms debounce + attribute/characterData false.
// H4 (SPA): pushState/replaceState monkey-patch + popstate.
// H12: AbortController로 일괄 해제, pageshow에서 재설치.

import type { Disposable } from '@core/types';
import { TUNING } from '@config/tuning';

export interface ObserverBus {
  onMutation(cb: () => void, opts?: { debounceMs?: number }): Disposable;
  onSpaNavigate(cb: (url: string) => void): Disposable;
  onVisualViewportChange(cb: () => void): Disposable;
  disposeAll(): void;
}

function pickSemanticContainer(doc: Document): Element {
  const candidates: Element[] = [];
  const sel = 'main, article, [role="main"]';
  doc.querySelectorAll(sel).forEach((el) => candidates.push(el));
  if (candidates.length === 0) return doc.body ?? doc.documentElement;
  let best = candidates[0]!;
  let bestHeight = (best as HTMLElement).scrollHeight ?? 0;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const h = (c as HTMLElement).scrollHeight ?? 0;
    if (h > bestHeight) {
      best = c;
      bestHeight = h;
    }
  }
  return best;
}

export function createObserverBus(doc: Document = document): ObserverBus {
  const disposables: Disposable[] = [];

  const onMutation = (cb: () => void, opts?: { debounceMs?: number }): Disposable => {
    const target = pickSemanticContainer(doc);
    const normalMs = opts?.debounceMs ?? TUNING.mutationDebounceMs;
    const liteMs = TUNING.mutationDebounceLiteMs;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // hidden 중 suppressed 된 mutation 존재 여부 — visibility 복귀 시 fire.
    let pendingSuppressed = false;
    // Adaptive: 탭 숨김 / 페이지 blur 상태에서는 긴 debounce (배터리 ↓)
    const currentDebounce = () =>
      (typeof document !== 'undefined' && document.hidden) ? liteMs : normalMs;
    const obs = new MutationObserver(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        // hidden 상태 — 플래그만 세우고 실제 cb는 visibility 복귀 시 실행
        if (typeof document !== 'undefined' && document.hidden) {
          pendingSuppressed = true;
          return;
        }
        pendingSuppressed = false;
        cb();
      }, currentDebounce());
    });
    obs.observe(target, { childList: true, subtree: true, attributes: false, characterData: false });
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden && pendingSuppressed) {
        pendingSuppressed = false;
        cb();
      }
    };
    doc.addEventListener('visibilitychange', onVis);
    const d: Disposable = {
      dispose() {
        if (timer !== null) clearTimeout(timer);
        obs.disconnect();
        doc.removeEventListener('visibilitychange', onVis);
      },
    };
    disposables.push(d);
    return d;
  };

  const onSpaNavigate = (cb: (url: string) => void): Disposable => {
    let lastUrl = location.href;
    const fire = () => {
      const cur = location.href;
      if (cur !== lastUrl) {
        lastUrl = cur;
        cb(cur);
      }
    };

    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const patchedPush: typeof history.pushState = function (...args) {
      const r = origPush.apply(history, args as Parameters<typeof origPush>);
      fire();
      return r;
    };
    const patchedReplace: typeof history.replaceState = function (...args) {
      const r = origReplace.apply(history, args as Parameters<typeof origReplace>);
      fire();
      return r;
    };
    history.pushState = patchedPush;
    history.replaceState = patchedReplace;
    const onPop = () => fire();
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);

    const d: Disposable = {
      dispose() {
        // Sev1 fix: 다른 스크립트가 우리 뒤에 또 patch 했다면 원본 복원이 체인을 깬다.
        // 우리가 set한 함수가 여전히 현재 값일 때만 복원.
        if (history.pushState === patchedPush) history.pushState = origPush;
        if (history.replaceState === patchedReplace) history.replaceState = origReplace;
        window.removeEventListener('popstate', onPop);
        window.removeEventListener('hashchange', onPop);
      },
    };
    disposables.push(d);
    return d;
  };

  const onVisualViewportChange = (cb: () => void): Disposable => {
    const vv = window.visualViewport;
    if (!vv) return { dispose() {} };
    vv.addEventListener('resize', cb);
    vv.addEventListener('scroll', cb);
    const d: Disposable = {
      dispose() {
        vv.removeEventListener('resize', cb);
        vv.removeEventListener('scroll', cb);
      },
    };
    disposables.push(d);
    return d;
  };

  return {
    onMutation,
    onSpaNavigate,
    onVisualViewportChange,
    disposeAll() {
      for (const d of disposables.splice(0)) d.dispose();
    },
  };
}
