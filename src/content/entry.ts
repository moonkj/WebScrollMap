import { createScanner, type ScannerDeps } from '@core/scanner';
import { mountShadowHost } from '@ui/shadowHost';
import { createRenderer } from '@ui/renderer';
import { createScrubber } from '@ui/scrubber';
import { createMagnifier } from '@ui/magnifier';
import { createSearchPanel } from '@ui/searchPanel';
import { createSectionBadge } from '@ui/sectionBadge';
import { createFloatingPins } from '@ui/floatingPins';
import { createUpgradeToast } from '@ui/upgradeToast';
import { buildSearchIndex, searchIndex, type SearchIndexEntry } from '@core/searchIndex';
import { createObserverBus } from '@platform/observerBus';
import { detectScrollContainer, elementTarget } from '@platform/container';
import { createManualPicker } from '@platform/manualPicker';
import { detectTheme } from '@ui/theme';
import { paletteForTheme } from '@ui/palette';
import { createSignedStorage } from '@core/storage';
import { createPinStore } from '@core/pins';
import { createTrailStore } from '@core/trail';
import { loadSettings } from '@core/settings';
import { getBrowserApi } from '@platform/browserApi';
import { fetchEntitlement, playHaptic } from '@platform/iapBridge';
import { isWsmMessage, type PageStatus, type PinSummary, type Settings, type WsmMessage, type WsmResponse } from '@core/messages';
import { verifyEntitlement, type Entitlement, type Tier } from '@core/entitlement';
import { applyTierConstraints, isFeatureAvailable, lockToastMessage } from '@core/featureGate';
import { applySmartFilter } from '@core/smartFilter';
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

  // Entitlement 로드 (native 연결 안 되면 free). Device ID는 storage.local에 고정 저장.
  const DEVICE_KEY = 'wsm:device-id:v1';
  let deviceId: string;
  try {
    const rec = await browserApi.storage.local.get(DEVICE_KEY);
    const existing = rec[DEVICE_KEY] as string | undefined;
    if (existing) deviceId = existing;
    else {
      deviceId = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
      await browserApi.storage.local.set({ [DEVICE_KEY]: deviceId });
    }
  } catch {
    deviceId = 'anon';
  }

  let entitlement: Entitlement | null = null;
  let tier: Tier = 'free';
  try {
    entitlement = await fetchEntitlement();
    tier = verifyEntitlement(entitlement, Date.now(), deviceId);
  } catch {
    tier = 'free';
  }

  // Free tier는 settings 강제 제약 (우측/큰 여백/테마/필터 모두 차단)
  settings = applyTierConstraints(tier, settings);

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
    palette: paletteForTheme(colorScheme, settings.theme),
    onPinTap: (pin) => {
      // 핀 탭 → 저장된 정확한 스크롤 위치로 복귀 (오프셋 없음)
      container.setScrollY(pin.y);
    },
  });
  renderer.mount();

  // Pro 기능 UI는 항상 mount (tier 변경 시 즉시 반응). 실제 노출은 tier gate.
  const magnifier = createMagnifier(host.root, colorScheme, settings.side);
  const sectionBadge = createSectionBadge(host.root, settings.side);
  const upgradeToast = createUpgradeToast(host.root, colorScheme);

  function showLock(feature: Parameters<typeof lockToastMessage>[0]) {
    upgradeToast.show(lockToastMessage(feature));
  }

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
  floatingPins.setOpacity(settings.floatingOpacity);

  function currentScanRoot(): Element {
    return container.kind === 'element' && container.el ? container.el : document.body;
  }

  function scanWithFilter(): import('@core/types').ScannerResult {
    const raw = scanner.scan(currentScanRoot());
    if (!isFeatureAvailable(tier, 'smart-filter') || settings.smartFilter === 'all') return raw;
    return {
      ...raw,
      anchors: applySmartFilter(raw.anchors, settings.smartFilter) as typeof raw.anchors,
    };
  }

  let lastResult = scanWithFilter();
  renderer.update(lastResult);
  if (isFeatureAvailable(tier, 'pin-jump')) renderer.setPins(pinStore.list());
  if (isFeatureAvailable(tier, 'trail')) renderer.setTrail(trailStore.list());
  if (isFeatureAvailable(tier, 'floating-panel'))
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
    if (!isFeatureAvailable(tier, 'trail')) return;
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
      if (isFeatureAvailable(tier, 'section-badge')) {
        sectionBadge.update(container.getScrollY(), lastResult.anchors);
      }
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
      if (!isFeatureAvailable(tier, 'pin-drop')) {
        showLock('pin-drop');
        return;
      }
      const currentScroll = container.getScrollY();
      const added = pinStore.add({ y: currentScroll });
      if (added) {
        renderer.setPins(pinStore.list());
        floatingPins.update(pinStore.list(), container.getDocHeight());
        playHaptic('pin'); // Pro 햅틱 (native 연결 시)
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
      if (!isFeatureAvailable(tier, 'magnifier')) return;
      magnifier.show(clientY, docY, lastResult);
      if (isFeatureAvailable(tier, 'section-badge')) {
        sectionBadge.update(docY, lastResult.anchors);
      }
    },
    onDoubleTap: () => {
      if (!isFeatureAvailable(tier, 'search')) {
        showLock('search');
        return;
      }
      if (searchPanel.isOpen()) searchPanel.close();
      else searchPanel.open();
    },
  });

  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      lastResult = scanWithFilter();
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
      invalidateSearchIndex();
      reevaluateActivation();
      if (isFeatureAvailable(tier, 'section-badge')) {
        sectionBadge.update(container.getScrollY(), lastResult.anchors);
      }
    },
    { debounceMs: TUNING.mutationDebounceMs },
  );

  const spaDisposable = bus.onSpaNavigate(() => {
    lastResult = scanWithFilter();
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

  // 수동 피커 (Pro 전용)
  let activePicker: Disposable | null = null;
  function startManualPicker() {
    if (!isFeatureAvailable(tier, 'manual-picker')) {
      showLock('manual-picker');
      return;
    }
    activePicker?.dispose();
    activePicker = createManualPicker({
      onPicked(el) {
        container = elementTarget(el);
        rebindScrollTarget(el);
        lastTrailY = container.getScrollY();
        lastResult = scanWithFilter();
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
        // tier 제약 재적용 — free는 대부분 무시됨
        settings = applyTierConstraints(tier, msg.settings);
        applyPositionStyle();
        floatingPins.setSide(settings.side);
        floatingPins.setOpacity(settings.floatingOpacity);
        // 테마 변경 → 렌더러 palette 갱신
        renderer.setPalette(paletteForTheme(colorScheme, settings.theme));
        // smart filter 변경 → 재스캔 결과 갱신
        lastResult = scanWithFilter();
        renderer.update(lastResult);
        renderer.highlight('slim', vp());
        sendResponse({ ok: true } satisfies WsmResponse);
        return false;
      }
      case 'entitlement-changed': {
        // 네이티브 → 확장: tier 변경. 모든 게이트 재평가.
        entitlement = msg.entitlement;
        tier = msg.tier;
        // tier 상승(free→pro): 기존에 잠겨있던 pro 초기 상태들 활성화
        // tier 하락(pro→free): UI 일부 숨김 (정교한 cleanup은 다음 사이클)
        settings = applyTierConstraints(tier, settings);
        applyPositionStyle();
        renderer.setPalette(paletteForTheme(colorScheme, settings.theme));
        lastResult = scanWithFilter();
        renderer.update(lastResult);
        if (isFeatureAvailable(tier, 'pin-jump')) renderer.setPins(pinStore.list());
        else renderer.setPins([]);
        if (isFeatureAvailable(tier, 'trail')) renderer.setTrail(trailStore.list());
        else renderer.setTrail([]);
        if (isFeatureAvailable(tier, 'floating-panel')) {
          floatingPins.update(pinStore.list(), container.getDocHeight());
        } else {
          floatingPins.update([], container.getDocHeight());
        }
        renderer.highlight('slim', vp());
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
      case 'get-entitlement': {
        sendResponse({ ok: true, entitlement, tier } satisfies WsmResponse);
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

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable, searchPanel, sectionBadge, floatingPins, upgradeToast];
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
