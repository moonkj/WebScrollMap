import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createObserverBus } from '@platform/observerBus';
import { detectScrollContainer, elementTarget } from '@platform/container';
import { createManualPicker } from '@platform/manualPicker';
import { detectTheme } from '@ui/theme';
import { createSignedStorage } from '@core/storage';
import { createPinStore } from '@core/pins';
import { createTrailStore } from '@core/trail';
import { loadSettings } from '@core/settings';
import { getBrowserApi } from '@platform/browserApi';
import { isWsmMessage, type PageStatus, type Settings, type WsmMessage, type WsmResponse } from '@core/messages';
import { shouldActivate } from './shouldActivate';
import { TUNING } from '@config/tuning';
import type { ContainerTarget, Disposable, ViewportRect } from '@core/types';

const WSM_Z_INDEX = 2_147_483_000;
const TRAIL_SAMPLE_MS = 250;

function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
}

async function bootstrap(): Promise<void> {
  await domReady();
  if (!shouldActivate(document, window)) return;

  const browserApi = getBrowserApi();
  let settings: Settings = await loadSettings(browserApi.storage.local);
  // Sev2 fix: off 상태여도 bootstrap은 하되 host display:none — 토글 왕복 지원.

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
  let container: ContainerTarget = detectScrollContainer(document, window);
  const host = mountShadowHost(document, WSM_Z_INDEX, deps.random);

  // Settings → host 스타일 적용 (enabled/side/margin)
  function applyPositionStyle() {
    host.host.style.top = '0';
    host.host.style.bottom = '';
    host.host.style.display = settings.enabled ? '' : 'none';
    if (settings.side === 'right') {
      host.host.style.right = `${settings.marginPx}px`;
      host.host.style.left = '';
    } else {
      host.host.style.left = `${settings.marginPx}px`;
      host.host.style.right = '';
    }
  }
  applyPositionStyle();

  const renderer = createRenderer(host.root, {
    width: 48,
    height: container.getHeight(),
    dpr: window.devicePixelRatio || 1,
    colorScheme: detectTheme(document, window),
  });
  renderer.mount();

  const signedStorage = createSignedStorage(window.sessionStorage, { version: 1 });
  const pinStore = createPinStore(signedStorage, location.pathname, deps.random);
  const trailStore = createTrailStore(signedStorage, location.pathname);

  function currentScanRoot(): Element {
    return container.kind === 'element' && container.el ? container.el : document.body;
  }

  let lastResult = scanner.scan(currentScanRoot());
  renderer.update(lastResult);
  renderer.setPins(pinStore.list());
  renderer.setTrail(trailStore.list());

  const vp = (): ViewportRect => ({
    scrollY: container.getScrollY(),
    height: container.getHeight(),
    docHeight: container.getDocHeight(),
  });
  renderer.highlight('slim', vp());

  let scrollTicking = false;
  let lastTrailSampleAt = 0;
  let lastTrailY = container.getScrollY();
  let scrollTarget: EventTarget = container.kind === 'element' && container.el ? container.el : window;

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
  scrollTarget.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);

  function rebindScrollTarget(next: EventTarget) {
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    scrollTarget = next;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
  }

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

  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      lastResult = scanner.scan(currentScanRoot());
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
    },
    { debounceMs: TUNING.mutationDebounceMs },
  );

  const spaDisposable = bus.onSpaNavigate(() => {
    lastResult = scanner.scan(currentScanRoot());
    renderer.update(lastResult);
    renderer.setPins([]);
    renderer.setTrail([]);
    renderer.highlight('slim', vp());
  });

  const vvDisposable = bus.onVisualViewportChange(() => {
    renderer.highlight('slim', vp());
  });

  // 수동 피커 (활성 Disposable 1개만 유지)
  let activePicker: Disposable | null = null;
  function startManualPicker() {
    activePicker?.dispose();
    activePicker = createManualPicker({
      onPicked(el) {
        container = elementTarget(el);
        rebindScrollTarget(el);
        lastTrailY = container.getScrollY();
        lastResult = scanner.scan(currentScanRoot());
        renderer.update(lastResult);
        renderer.highlight('slim', vp());
        activePicker = null;
      },
    });
  }

  // 메시지 리스너
  const onMessage = (raw: unknown, _sender: unknown, sendResponse: (r: unknown) => void): boolean => {
    if (!isWsmMessage(raw)) {
      sendResponse({ ok: false, error: 'invalid message' } satisfies WsmResponse);
      return false;
    }
    const msg = raw as WsmMessage;
    switch (msg.type) {
      case 'get-status': {
        const status: PageStatus = {
          activatable: true,
          anchorCount: lastResult.anchors.length,
          docHeight: lastResult.docHeight,
          containerKind: container.kind,
          pinCount: pinStore.list().length,
        };
        sendResponse({ ok: true, status } satisfies WsmResponse);
        return false;
      }
      case 'settings-changed': {
        // Sev2 fix: teardown 대신 host hide — enabled 토글 왕복 시 재bootstrap 불필요.
        settings = msg.settings;
        applyPositionStyle();
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'clear-pins': {
        pinStore.clear();
        renderer.setPins([]);
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'clear-trail': {
        trailStore.clear();
        renderer.setTrail([]);
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      default:
        return false;
    }
  };
  browserApi.runtime.onMessage.addListener(onMessage);

  // Alt+Shift+M: 수동 피커 진입 단축키
  function onGlobalKey(e: KeyboardEvent) {
    if (e.altKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      startManualPicker();
    }
  }
  document.addEventListener('keydown', onGlobalKey);

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable];
  let tornDown = false;
  function teardown() {
    if (tornDown) return;
    tornDown = true;
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    document.removeEventListener('keydown', onGlobalKey);
    activePicker?.dispose();
    activePicker = null;
    for (const d of disposables) d.dispose();
    bus.disposeAll();
    renderer.destroy();
    host.unmount();
    scanner.dispose();
    try {
      browserApi.runtime.onMessage.removeListener(onMessage);
    } catch {
      // noop
    }
  }
  window.addEventListener('pagehide', teardown, { once: true });
}

void bootstrap();
