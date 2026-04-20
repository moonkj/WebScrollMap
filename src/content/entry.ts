import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createObserverBus } from '@platform/observerBus';
import { detectScrollContainer } from '@platform/container';
import { detectTheme } from '@ui/theme';
import { createSignedStorage } from '@core/storage';
import { createPinStore } from '@core/pins';
import { createTrailStore } from '@core/trail';
import { shouldActivate } from './shouldActivate';
import { TUNING } from '@config/tuning';
import type { Disposable, ViewportRect } from '@core/types';

const WSM_Z_INDEX = 2_147_483_000;
const TRAIL_SAMPLE_MS = 250;

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
  const container = detectScrollContainer(document, window);
  const host = mountShadowHost(document, WSM_Z_INDEX, deps.random);

  const renderer = createRenderer(host.root, {
    width: 48,
    height: container.getHeight(),
    dpr: window.devicePixelRatio || 1,
    colorScheme: detectTheme(document, window),
  });
  renderer.mount();

  // Storage: Pin + Trail (S6 HMAC-signed)
  const signedStorage = createSignedStorage(window.sessionStorage, { version: 1 });
  const pinStore = createPinStore(signedStorage, location.pathname, deps.random);
  const trailStore = createTrailStore(signedStorage, location.pathname);

  // Scan target: 내부 컨테이너면 그 안, 아니면 body
  const scanRoot = container.kind === 'element' && container.el ? container.el : document.body;
  let lastResult = scanner.scan(scanRoot);
  renderer.update(lastResult);
  renderer.setPins(pinStore.list());
  renderer.setTrail(trailStore.list());

  const vp = (): ViewportRect => ({
    scrollY: container.getScrollY(),
    height: container.getHeight(),
    docHeight: container.getDocHeight(),
  });
  renderer.highlight('slim', vp());

  // RAF throttled scroll — also samples Trail
  let scrollTicking = false;
  let lastTrailSampleAt = 0;
  let lastTrailY = container.getScrollY();

  function sampleTrail() {
    const nowMs = performance.now();
    if (nowMs - lastTrailSampleAt < TRAIL_SAMPLE_MS) return;
    lastTrailSampleAt = nowMs;
    const y0 = Math.min(lastTrailY, container.getScrollY());
    const y1 = Math.max(lastTrailY, container.getScrollY()) + container.getHeight();
    if (y1 > y0) trailStore.record(y0, y1, Date.now());
    lastTrailY = container.getScrollY();
    renderer.setTrail(trailStore.list());
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      renderer.highlight('slim', vp());
      sampleTrail();
      scrollTicking = false;
    });
  }

  const scrollTarget: EventTarget = container.kind === 'element' && container.el ? container.el : window;
  scrollTarget.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);

  // Scrubber wires to shadow host element; shadow retargeting delivers events
  const hostEl = host.host;
  const scrubber = createScrubber(hostEl, {
    scrollTo: (y) => container.setScrollY(y),
    snapCandidates: () => lastResult.anchors.map((a) => a.y),
    getDocHeight: () => container.getDocHeight(),
    getViewportHeight: () => container.getHeight(),
    onLongPress: (y) => {
      const added = pinStore.add({ y });
      if (added) renderer.setPins(pinStore.list());
    },
  });

  // Mutation / SPA / VisualViewport
  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      lastResult = scanner.scan(scanRoot);
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
    },
    { debounceMs: TUNING.mutationDebounceMs },
  );

  const spaDisposable = bus.onSpaNavigate(() => {
    lastResult = scanner.scan(scanRoot);
    renderer.update(lastResult);
    // Pin/Trail are path-scoped — stale on path change. Simplest: clear rendered layers.
    renderer.setPins([]);
    renderer.setTrail([]);
    renderer.highlight('slim', vp());
  });

  const vvDisposable = bus.onVisualViewportChange(() => {
    renderer.highlight('slim', vp());
  });

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable];
  function teardown() {
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    for (const d of disposables) d.dispose();
    bus.disposeAll();
    renderer.destroy();
    host.unmount();
    scanner.dispose();
  }
  window.addEventListener('pagehide', teardown, { once: true });
}

void bootstrap();
