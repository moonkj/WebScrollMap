import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createMagnifier } from '@ui/magnifier';
import { createSearchPanel } from '@ui/searchPanel';
import { buildSearchIndex, searchIndex, type SearchIndexEntry } from '@core/searchIndex';
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
  // !important로 호스트 페이지 CSS 승리 보장.
  const SLIM_WIDTH_PX = 24;
  function applyPositionStyle() {
    const s = host.host.style;
    s.setProperty('display', settings.enabled ? 'block' : 'none', 'important');
    s.setProperty('width', `${SLIM_WIDTH_PX}px`, 'important');
    if (settings.side === 'right') {
      s.setProperty('right', `${settings.marginPx}px`, 'important');
      s.setProperty('left', 'auto', 'important');
    } else {
      s.setProperty('left', `${settings.marginPx}px`, 'important');
      s.setProperty('right', 'auto', 'important');
    }
  }
  applyPositionStyle();

  const colorScheme = detectTheme(document, window);
  const renderer = createRenderer(host.root, {
    width: SLIM_WIDTH_PX,
    height: container.getHeight(),
    dpr: window.devicePixelRatio || 1,
    colorScheme,
  });
  renderer.mount();

  const magnifier = createMagnifier(host.root, colorScheme, settings.side);

  // 검색 인덱스는 최초 스캔 시점에 지연 빌드 (비용 큼). 첫 검색 시 1회 생성.
  let searchCache: ReadonlyArray<SearchIndexEntry> | null = null;
  function ensureSearchIndex(): ReadonlyArray<SearchIndexEntry> {
    if (searchCache) return searchCache;
    searchCache = buildSearchIndex(currentScanRoot());
    return searchCache;
  }
  function invalidateSearchIndex() {
    searchCache = null;
  }

  const searchPanel = createSearchPanel(host.root, colorScheme, {
    search: (q) => searchIndex(ensureSearchIndex(), q),
    onNavigate: (y) => container.setScrollY(Math.max(0, y - container.getHeight() / 3)),
    onHitsChanged: (hits) => renderer.setSearchHits(hits.map((h) => ({ y: h.y }))),
    onClose: () => renderer.setSearchHits([]),
  });

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
    onStateChange: (state) => {
      // 슬림 ↔ 확장 전환: shadow host 클래스로 CSS opacity 전환 (폭은 유지, UX는 투명도로 표현)
      if (state === 'scrubbing') host.host.classList.add('wsm-expanded');
      else host.host.classList.remove('wsm-expanded');
      if (state === 'idle') magnifier.hide();
    },
    onMagnify: (clientY, docY) => magnifier.show(clientY, docY, lastResult),
  });

  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      lastResult = scanner.scan(currentScanRoot());
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
      invalidateSearchIndex();
    },
    { debounceMs: TUNING.mutationDebounceMs },
  );

  const spaDisposable = bus.onSpaNavigate(() => {
    lastResult = scanner.scan(currentScanRoot());
    renderer.update(lastResult);
    renderer.setPins([]);
    renderer.setTrail([]);
    renderer.setSearchHits([]);
    renderer.highlight('slim', vp());
    invalidateSearchIndex();
    searchPanel.close();
    magnifier.hide(); // Sev2 fix: SPA nav 시 잔상 제거
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

  // Global shortcuts: Alt+Shift+M (picker), Cmd/Ctrl+Shift+F (custom search panel — S7)
  function isEditableTarget(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  function onGlobalKey(e: KeyboardEvent) {
    // Sev1 fix: editable 포커스 중엔 단축키 스킵 (타이핑 방해 금지).
    if (isEditableTarget(e.target)) return;
    if (e.altKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      startManualPicker();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      if (searchPanel.isOpen()) searchPanel.close();
      else searchPanel.open();
    }
  }
  document.addEventListener('keydown', onGlobalKey);

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable, searchPanel];
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
    magnifier.destroy();
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
