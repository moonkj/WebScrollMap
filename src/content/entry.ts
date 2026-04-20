import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createObserverBus } from '@platform/observerBus';
import { detectTheme } from '@ui/theme';
import { shouldActivate } from './shouldActivate';
import { TUNING } from '@config/tuning';
import type { Disposable, ViewportRect } from '@core/types';

const WSM_Z_INDEX = 2_147_483_000;

function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
}

async function bootstrap(): Promise<void> {
  await domReady();
  if (!shouldActivate(document, window)) return;

  const deps: ScannerDeps = {
    now: () => performance.now(),
    random: () => Math.random(),
    createObserver: (target, cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(target, { childList: true, subtree: true });
      return { dispose: () => obs.disconnect() };
    },
  };

  const scanner = createScanner(deps);
  const container = scanner.detectContainer();
  const host = mountShadowHost(document, WSM_Z_INDEX, deps.random);

  const renderer = createRenderer(host.root, {
    width: 48,
    height: container.getHeight(),
    dpr: window.devicePixelRatio || 1,
    colorScheme: detectTheme(document, window),
  });
  renderer.mount();

  let lastResult = scanner.scan(document.body);
  renderer.update(lastResult);

  const vp = (): ViewportRect => ({
    scrollY: container.getScrollY(),
    height: container.getHeight(),
    docHeight: container.getDocHeight(),
  });
  renderer.highlight('slim', vp());

  // RAF throttle for scroll
  let scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      renderer.highlight('slim', vp());
      scrollTicking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Sev1 fix: host는 pointer-events:none 유지. 내부 .wsm-track이 auto로 이벤트 수신.
  // Shadow DOM retargeting으로 hostEl 리스너에 재타겟 이벤트가 도달.
  const hostEl = host.host;
  const scrubber = createScrubber(hostEl, {
    scrollTo: (y) => container.setScrollY(y),
    snapCandidates: () => lastResult.anchors.map((a) => a.y),
    getDocHeight: () => container.getDocHeight(),
    getViewportHeight: () => container.getHeight(),
  });

  // Observers: rescan on mutation / SPA
  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(() => {
    lastResult = scanner.scan(document.body);
    renderer.update(lastResult);
    renderer.highlight('slim', vp());
  }, { debounceMs: TUNING.mutationDebounceMs });

  const spaDisposable = bus.onSpaNavigate(() => {
    lastResult = scanner.scan(document.body);
    renderer.update(lastResult);
    renderer.highlight('slim', vp());
  });

  const vvDisposable = bus.onVisualViewportChange(() => {
    renderer.highlight('slim', vp());
  });

  // Lifecycle: pagehide / beforeunload에서 정리
  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable];
  function teardown() {
    window.removeEventListener('scroll', onScroll);
    for (const d of disposables) d.dispose();
    bus.disposeAll();
    renderer.destroy();
    host.unmount();
    scanner.dispose();
  }
  window.addEventListener('pagehide', teardown, { once: true });
}

void bootstrap();
