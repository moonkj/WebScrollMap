import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createMagnifier } from '@ui/magnifier';
import { createSearchPanel } from '@ui/searchPanel';
import { createSectionBadge } from '@ui/sectionBadge';
import { createFloatingPins } from '@ui/floatingPins';
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
import { isWsmMessage, type PageStatus, type PinSummary, type Settings, type WsmMessage, type WsmResponse } from '@core/messages';
import { shouldActivate } from './shouldActivate';
import { TUNING } from '@config/tuning';
import type { ContainerTarget, Disposable, ViewportRect } from '@core/types';

const WSM_Z_INDEX = 2_147_483_000;
const TRAIL_SAMPLE_MS = 250;
const SLIM_WIDTH_PX = 44;

function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
}

async function bootstrap(): Promise<void> {
  await domReady();

  const browserApi = getBrowserApi();
  let settings: Settings = await loadSettings(browserApi.storage.local);

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

  // shouldActivate는 런타임 평가로 전환 — 페이지가 짧다가 길어지는 경우(SPA/지연 로딩)
  // 대응. bootstrap 조기 return 제거.
  let isActivatable = shouldActivate(document, window);

  function applyPositionStyle() {
    const s = host.host.style;
    const visible = settings.enabled && isActivatable;
    s.setProperty('display', visible ? 'block' : 'none', 'important');
    s.setProperty('width', `${SLIM_WIDTH_PX}px`, 'important');
    if (settings.side === 'right') {
      s.setProperty('right', `${settings.marginPx}px`, 'important');
      s.setProperty('left', 'auto', 'important');
    } else {
      s.setProperty('left', `${settings.marginPx}px`, 'important');
      s.setProperty('right', 'auto', 'important');
    }
    host.host.classList.toggle('wsm-side-left', settings.side === 'left');
    host.host.classList.toggle('wsm-side-right', settings.side === 'right');
  }
  applyPositionStyle();

  const colorScheme = detectTheme(document, window);
  const renderer = createRenderer(host.root, {
    width: SLIM_WIDTH_PX,
    height: container.getHeight(),
    dpr: window.devicePixelRatio || 1,
    colorScheme,
    side: settings.side,
    onPinTap: (pin) => {
      // 핀 탭 → 저장된 정확한 스크롤 위치로 복귀 (오프셋 없음)
      container.setScrollY(pin.y);
    },
  });
  renderer.mount();

  const magnifier = createMagnifier(host.root, colorScheme, settings.side);
  const sectionBadge = createSectionBadge(host.root, settings.side);

  // 검색 인덱스는 최초 스캔 시점에 지연 빌드.
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

  const floatingPins = createFloatingPins(host.root, {
    side: settings.side,
    scheme: colorScheme,
    onJump: (pin) => container.setScrollY(pin.y),
    onDelete: (pinId) => {
      pinStore.remove(pinId);
      renderer.setPins(pinStore.list());
      floatingPins.update(pinStore.list(), container.getDocHeight());
    },
  });

  function currentScanRoot(): Element {
    return container.kind === 'element' && container.el ? container.el : document.body;
  }

  let lastResult = scanner.scan(currentScanRoot());
  renderer.update(lastResult);
  renderer.setPins(pinStore.list());
  renderer.setTrail(trailStore.list());
  floatingPins.update(pinStore.list(), container.getDocHeight());

  const vp = (): ViewportRect => ({
    scrollY: container.getScrollY(),
    height: container.getHeight(),
    docHeight: container.getDocHeight(),
  });
  renderer.highlight('slim', vp());
  sectionBadge.update(container.getScrollY(), lastResult.anchors);

  let scrollTicking = false;
  let lastTrailSampleAt = 0;
  let lastTrailY = container.getScrollY();
  let scrollTarget: EventTarget = container.kind === 'element' && container.el ? container.el : window;
  let isScrubbing = false;
  let badgeHideTimer: ReturnType<typeof setTimeout> | null = null;

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
      sectionBadge.update(container.getScrollY(), lastResult.anchors);
      scrollTicking = false;
    });
  }
  scrollTarget.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);

  function rebindScrollTarget(next: EventTarget) {
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    scrollTarget = next;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
  }

  function reevaluateActivation() {
    const next = shouldActivate(document, window);
    if (next !== isActivatable) {
      isActivatable = next;
      applyPositionStyle();
    }
  }

  const hostEl = host.host;
  const scrubber = createScrubber(hostEl, {
    scrollTo: (y) => container.setScrollY(y),
    snapCandidates: () => lastResult.anchors.map((a) => a.y),
    getDocHeight: () => container.getDocHeight(),
    getViewportHeight: () => container.getHeight(),
    onLongPress: (_barY) => {
      // 핀 = "여기가 중요해 — 여기로 돌아오고 싶어" → 현재 스크롤 위치를 북마크
      const currentScroll = container.getScrollY();
      const added = pinStore.add({ y: currentScroll });
      if (added) {
        renderer.setPins(pinStore.list());
        floatingPins.update(pinStore.list(), container.getDocHeight());
      }
    },
    onStateChange: (state) => {
      isScrubbing = state === 'scrubbing';
      if (isScrubbing) {
        host.host.classList.add('wsm-expanded');
        sectionBadge.show();
        if (badgeHideTimer !== null) {
          clearTimeout(badgeHideTimer);
          badgeHideTimer = null;
        }
      } else {
        host.host.classList.remove('wsm-expanded');
        magnifier.hide();
        // 배지는 스크럽 끝난 뒤 잠깐 유지 후 페이드 (UX 친절)
        badgeHideTimer = setTimeout(() => {
          sectionBadge.hide();
          badgeHideTimer = null;
        }, 900);
      }
    },
    onMagnify: (clientY, docY) => {
      magnifier.show(clientY, docY, lastResult);
      sectionBadge.update(docY, lastResult.anchors);
    },
    onDoubleTap: () => {
      // iPhone에서 검색 패널 진입 (Cmd+Shift+F 대체)
      if (searchPanel.isOpen()) searchPanel.close();
      else searchPanel.open();
    },
  });

  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      lastResult = scanner.scan(currentScanRoot());
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
      invalidateSearchIndex();
      reevaluateActivation();
      sectionBadge.update(container.getScrollY(), lastResult.anchors);
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
    magnifier.hide();
    sectionBadge.hide();
    floatingPins.update([], container.getDocHeight());
    reevaluateActivation();
  });

  const vvDisposable = bus.onVisualViewportChange(() => {
    renderer.highlight('slim', vp());
  });

  // 수동 피커
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
        reevaluateActivation();
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
          activatable: isActivatable,
          anchorCount: lastResult.anchors.length,
          docHeight: lastResult.docHeight,
          containerKind: isActivatable ? container.kind : 'none',
          pinCount: pinStore.list().length,
        };
        sendResponse({ ok: true, status } satisfies WsmResponse);
        return false;
      }
      case 'settings-changed': {
        settings = msg.settings;
        applyPositionStyle();
        floatingPins.setSide(settings.side);
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'clear-pins': {
        pinStore.clear();
        renderer.setPins([]);
        floatingPins.update([], container.getDocHeight());
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'clear-trail': {
        trailStore.clear();
        renderer.setTrail([]);
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'get-pins': {
        const docH = container.getDocHeight() || 1;
        const pins: PinSummary[] = pinStore.list().map((p) => ({
          id: p.id,
          y: p.y,
          pct: Math.round((p.y / docH) * 100),
          ...(p.color ? { color: p.color } : {}),
        }));
        sendResponse({ ok: true, pins } satisfies WsmResponse);
        return false;
      }
      case 'jump-to-pin': {
        const found = pinStore.list().find((p) => p.id === msg.pinId);
        if (found) container.setScrollY(found.y);
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'delete-pin': {
        pinStore.remove(msg.pinId);
        renderer.setPins(pinStore.list());
        floatingPins.update(pinStore.list(), container.getDocHeight());
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      default:
        return false;
    }
  };
  browserApi.runtime.onMessage.addListener(onMessage);

  function isEditableTarget(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  function onGlobalKey(e: KeyboardEvent) {
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

  // window resize시 activation 재평가
  const onResize = () => reevaluateActivation();
  window.addEventListener('resize', onResize, { passive: true });

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable, searchPanel, sectionBadge, floatingPins];
  let tornDown = false;
  function teardown() {
    if (tornDown) return;
    tornDown = true;
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    document.removeEventListener('keydown', onGlobalKey);
    window.removeEventListener('resize', onResize);
    if (badgeHideTimer !== null) clearTimeout(badgeHideTimer);
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
