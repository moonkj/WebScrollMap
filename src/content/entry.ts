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
import { paletteForTheme } from '@ui/palette';
import { createSignedStorage } from '@core/storage';
import { createPinStore } from '@core/pins';
import { createTrailStore } from '@core/trail';
import { loadSettings } from '@core/settings';
import { getBrowserApi } from '@platform/browserApi';
import { playHaptic } from '@platform/iapBridge';
import { DEFAULT_SETTINGS, isWsmMessage, type PageStatus, type PinSummary, type Settings, type WsmMessage, type WsmResponse } from '@core/messages';
import { applySmartFilter } from '@core/smartFilter';
import { shouldActivate } from './shouldActivate';
import { TUNING } from '@config/tuning';
import { AnchorKind, type ContainerTarget, type Disposable, type ViewportRect, type AnchorPoint } from '@core/types';

/** 주어진 doc Y 위로 가장 가까운 heading snippet을 반환. 없으면 undefined. */
function findNearestHeadingLabel(docY: number, anchors: ReadonlyArray<AnchorPoint>): string | undefined {
  let best: AnchorPoint | null = null;
  for (const a of anchors) {
    if (a.y > docY + 20) break;
    if (!a.snippet) continue;
    if (
      a.type === AnchorKind.Heading1 ||
      a.type === AnchorKind.Heading2 ||
      a.type === AnchorKind.Heading3 ||
      a.type === AnchorKind.StrongText
    ) {
      best = a;
    }
  }
  return best?.snippet;
}

const WSM_Z_INDEX = 2_147_483_000;
const TRAIL_SAMPLE_MS = 250;
const SLIM_WIDTH_PX = 44;

function domReady(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
}

async function bootstrap(): Promise<void> {
  await domReady();

  // 중복 주입 방지 — iOS Safari가 SPA/frame 등으로 content script를 두 번 로드하는
  // 케이스에서 두 개의 shadow host / 플로팅 메모장이 겹치는 버그를 차단.
  interface WsmGlobal { __WEB_SCROLL_MAP_LOADED__?: boolean; }
  const w = window as unknown as WsmGlobal;
  if (w.__WEB_SCROLL_MAP_LOADED__) return;
  w.__WEB_SCROLL_MAP_LOADED__ = true;

  // H6: 페이지 CSS가 scroll-behavior:smooth면 우리 scrollTop=y 할당이
  // 애니메이션으로 해석돼 연속 스크럽이 fight. 우리만 auto로 강제.
  // 주석: inline style은 !important 없이도 대부분 페이지 CSS보다 우선.
  // 단, 페이지 CSS에 !important가 있을 수 있어 style attr에 직접 주입.
  try {
    const htmlEl = document.documentElement;
    const prev = htmlEl.style.scrollBehavior;
    if (prev !== 'auto') htmlEl.style.setProperty('scroll-behavior', 'auto', 'important');
    if (document.body) document.body.style.setProperty('scroll-behavior', 'auto', 'important');
  } catch {
    // noop
  }

  const browserApi = getBrowserApi();
  let settings: Settings = await loadSettings(browserApi.storage.local).catch(() => ({ ...DEFAULT_SETTINGS }));

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
  // 과거 주입에서 남은 host 잔존 제거 (side 전환 누적 버그 복구)
  document.querySelectorAll('[data-wsm="1"]').forEach((el) => el.remove());
  const host = mountShadowHost(document, WSM_Z_INDEX, deps.random);

  // shouldActivate는 런타임 평가로 전환 — 페이지가 짧다가 길어지는 경우(SPA/지연 로딩)
  // 대응. bootstrap 조기 return 제거.
  let isActivatable = shouldActivate(document, window);

  function applyPositionStyle() {
    const s = host.host.style;
    const visible = settings.enabled && isActivatable;
    s.setProperty('display', visible ? 'block' : 'none', 'important');
    s.setProperty('width', `${SLIM_WIDTH_PX}px`, 'important');
    // 바 두께 CSS 변수 — Shadow 내부 .wsm-track의 clip-path가 이걸로 시각 두께 결정
    s.setProperty('--wsm-visible', `${settings.barWidthPx}px`);
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
      // 핀 탭 → 핀 doc 위치를 viewport 중앙에 맞춰 복귀 (찍은 시점과 일치).
      container.setScrollY(Math.max(0, pin.y - container.getHeight() / 2));
    },
  });
  renderer.mount();

  const magnifier = createMagnifier(host.root, colorScheme, settings.side);
  const sectionBadge = createSectionBadge(host.root, settings.side);

  // 검색 인덱스는 지연 빌드 + idle 선빌드. 첫 검색 패널 오픈 시 5~15ms freeze 예방.
  let searchCache: ReadonlyArray<SearchIndexEntry> | null = null;
  let idleBuildScheduled = false;
  function ensureSearchIndex(): ReadonlyArray<SearchIndexEntry> {
    if (searchCache) return searchCache;
    searchCache = buildSearchIndex(currentScanRoot());
    return searchCache;
  }
  function invalidateSearchIndex() {
    searchCache = null;
    idleBuildScheduled = false;
  }
  function scheduleIdleSearchBuild() {
    if (searchCache || idleBuildScheduled) return;
    idleBuildScheduled = true;
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback;
    const run = () => {
      if (searchCache) return; // 이미 ensureSearchIndex로 빌드됨
      if (document.hidden) { idleBuildScheduled = false; return; } // 배터리: hidden 시 미빌드
      searchCache = buildSearchIndex(currentScanRoot());
    };
    if (typeof ric === 'function') ric(run, { timeout: 3000 });
    else setTimeout(run, 1500); // iOS Safari 미지원 fallback
  }

  const searchPanel = createSearchPanel(host.root, colorScheme, {
    search: (q) => searchIndex(ensureSearchIndex(), q),
    onNavigate: (y) => container.setScrollY(Math.max(0, y - container.getHeight() / 3)),
    onHitsChanged: (hits) => renderer.setSearchHits(hits.map((h) => ({ y: h.y }))),
    onClose: () => renderer.setSearchHits([]),
  });

  // v2: 64bit 합성 서명 도입. 이전 v1 레코드는 자동 파기 → 세션 단위라 영향 미미.
  const signedStorage = createSignedStorage(window.sessionStorage, { version: 2 });
  const pinStore = createPinStore(signedStorage, location.pathname, deps.random);
  const trailStore = createTrailStore(signedStorage, location.pathname);

  const floatingPins = createFloatingPins(host.root, {
    side: settings.side,
    scheme: colorScheme,
    onJump: (pin) => container.setScrollY(Math.max(0, pin.y - container.getHeight() / 2)),
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
    if (settings.smartFilter === 'all') return raw;
    return {
      ...raw,
      anchors: applySmartFilter(raw.anchors, settings.smartFilter) as typeof raw.anchors,
    };
  }

  let lastResult = scanWithFilter();
  renderer.update(lastResult);
  scheduleIdleSearchBuild();
  renderer.setPins(pinStore.list());
  renderer.setTrail(trailStore.list());
  floatingPins.update(pinStore.list(), container.getDocHeight());

  // 스크럽 중 indicator는 finger 위치(onScrubMove)로 직접 갱신, 아니면 실제 scrollY 반영.
  // 종료 시 즉시 null 리셋 — onScroll이 자연스럽게 실제 위치 반영.
  let scrubCommandY: number | null = null;
  const vp = (): ViewportRect => ({
    scrollY: scrubCommandY !== null ? scrubCommandY : container.getScrollY(),
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
  // 터치 종료 후 바 확장 유지 타이머 — 사용자가 연속 탭/드래그할 시간을 주기 위함.
  let expandHoldTimer: ReturnType<typeof setTimeout> | null = null;
  const EXPAND_HOLD_MS = 2000;

  function sampleTrail() {
    if (document.hidden) return; // Page Visibility: 숨김 상태 샘플링 스킵
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
    if (document.hidden) return;
    if (isScrubbing) return;
    // scrubCommandY는 unclamped(바 경계에서 음수/초과 가능)이므로 clamp 후 비교.
    if (scrubCommandY !== null) {
      const actual = container.getScrollY();
      const maxScroll = Math.max(0, container.getDocHeight() - container.getHeight());
      const expected = Math.max(0, Math.min(maxScroll, scrubCommandY));
      if (Math.abs(actual - expected) <= 100) {
        scrubCommandY = null;
      }
    }
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
    scrollTo: (y) => {
      // 페이지 scroll은 EMA+rounded 값으로 (스크럽 중 잔 oscillation 방지).
      container.setScrollY(y);
    },
    // 스크럽 중 indicator는 finger 원위치를 즉시 따라감 (EMA/round/scroll-feedback 우회).
    onScrubMove: (rawY) => {
      if (!isScrubbing) return;
      scrubCommandY = rawY;
      renderer.highlight('slim', vp());
    },
    snapCandidates: () => lastResult.anchors.map((a) => a.y),
    getDocHeight: () => container.getDocHeight(),
    getViewportHeight: () => container.getHeight(),
    onHaptic: (kind) => {
      playHaptic(kind);
    },
    onLongPress: (barDocY) => {
      // 꾹 누른 바 위치(doc Y)에 핀 — 화면 이동 없음. 손가락 위치 = 핀 위치.
      const label = findNearestHeadingLabel(barDocY, lastResult.anchors);
      const added = pinStore.add(label ? { y: barDocY, label } : { y: barDocY });
      if (added) {
        renderer.setPins(pinStore.list());
        floatingPins.update(pinStore.list(), container.getDocHeight());
        playHaptic('pin');
      }
      // long-press fire 이후 scrubCommandY를 실제 scroll로 되돌려 indicator가 stuck 방지.
      // (터치 초기 onScrubMove로 finger 위치에 이동했지만 스크롤은 gated였음.)
      scrubCommandY = null;
      renderer.highlight('slim', vp());
    },
    onStateChange: (state) => {
      isScrubbing = state === 'scrubbing';
      if (isScrubbing) {
        scrubCommandY = null;
        host.host.classList.add('wsm-expanded');
        sectionBadge.show();
        if (badgeHideTimer !== null) {
          clearTimeout(badgeHideTimer);
          badgeHideTimer = null;
        }
        if (expandHoldTimer !== null) {
          clearTimeout(expandHoldTimer);
          expandHoldTimer = null;
        }
      } else {
        // 스크럽 종료 — EXPAND_HOLD_MS(2초) 동안 바 확장 유지 (연속 탭 대응).
        // scrubCommandY는 유지 — 다음 onScroll이 자연스럽게 이어감 (tap 직후
        // stale scrollY 읽혀 indicator가 원위치로 점프하는 것 방지).
        magnifier.hide();
        if (expandHoldTimer !== null) clearTimeout(expandHoldTimer);
        expandHoldTimer = setTimeout(() => {
          host.host.classList.remove('wsm-expanded');
          expandHoldTimer = null;
        }, EXPAND_HOLD_MS);
        badgeHideTimer = setTimeout(() => {
          sectionBadge.hide();
          badgeHideTimer = null;
        }, EXPAND_HOLD_MS + 200);
      }
    },
    onMagnify: (clientY, docY) => {
      magnifier.show(clientY, docY, lastResult);
      sectionBadge.update(docY, lastResult.anchors);
    },
    onDoubleTap: () => {
      if (searchPanel.isOpen()) searchPanel.close();
      else searchPanel.open();
    },
  });

  const bus = createObserverBus(document);
  const muteDisposable = bus.onMutation(
    () => {
      // H4 + H-REL-3: scrubCommandY override 살아있으면 stale scrollY로 렌더링 위험 — 스킵.
      if (isScrubbing || scrubCommandY !== null) return;
      lastResult = scanWithFilter();
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
      invalidateSearchIndex();
      reevaluateActivation();
      sectionBadge.update(container.getScrollY(), lastResult.anchors);
    },
    { debounceMs: TUNING.mutationDebounceMs },
  );

  const spaDisposable = bus.onSpaNavigate(() => {
    if (isScrubbing || scrubCommandY !== null) return;
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
    // H4: 스크럽 중이면 스킵. H-REL-3: scrub 종료 직후 scrubCommandY가 아직 설정된
    // 상태에서 vv change가 발화하면 stale container.getScrollY()로 렌더 → 상단 점프.
    if (isScrubbing || scrubCommandY !== null) return;
    renderer.highlight('slim', vp());
  });

  let activePicker: Disposable | null = null;
  function startManualPicker() {
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
        // H2: 스크럽 중이면 host 위치 변경이 cachedRect를 stale로 만들므로 defer.
        // 스크럽 종료 후 다음 settings-changed 또는 mutation에서 반영됨.
        if (isScrubbing) {
          sendResponse({ ok: true } satisfies WsmResponse);
          return false;
        }
        settings = { ...settings, ...msg.settings };
        applyPositionStyle();
        // side 변경 시 모든 side-aware UI 업데이트 (매그니파이/섹션 배지/플로팅 패널 방향)
        renderer.setSide(settings.side);
        magnifier.setSide(settings.side);
        sectionBadge.setSide(settings.side);
        floatingPins.setSide(settings.side);
        floatingPins.setOpacity(settings.floatingOpacity);
        renderer.setPalette(paletteForTheme(colorScheme, settings.theme));
        lastResult = scanWithFilter();
        renderer.update(lastResult);
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
          ...(p.label ? { label: p.label } : {}),
        }));
        sendResponse({ ok: true, pins } satisfies WsmResponse);
        return false;
      }
      case 'get-entitlement': {
        // 레거시 호환 — tier 제거됐으므로 항상 pro 반환 (UI는 모두 unlocked).
        sendResponse({ ok: true, entitlement: null, tier: 'pro' } satisfies WsmResponse);
        return false;
      }
      case 'jump-to-pin': {
        const found = pinStore.list().find((p) => p.id === msg.pinId);
        if (found) container.setScrollY(Math.max(0, found.y - container.getHeight() / 2));
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

  // Page Visibility: 탭 재노출 시 전체 재동기화 — hidden 중 DOM 변경/스크롤 반영.
  // observerBus가 hidden 동안 mutation callback을 스킵했으므로 수동 재스캔 필수.
  const onVisibilityChange = () => {
    // H-REL-3: 스크럽 중 또는 scrubCommandY override가 살아있으면 스킵 (상단 점프 방지).
    if (isScrubbing || scrubCommandY !== null) return;
    if (!document.hidden) {
      lastResult = scanWithFilter();
      renderer.update(lastResult);
      renderer.highlight('slim', vp());
      sectionBadge.update(container.getScrollY(), lastResult.anchors);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const disposables: Disposable[] = [scrubber, muteDisposable, spaDisposable, vvDisposable, searchPanel, sectionBadge, floatingPins];
  let tornDown = false;
  function teardown() {
    if (tornDown) return;
    tornDown = true;
    scrollTarget.removeEventListener('scroll', onScroll as EventListener);
    document.removeEventListener('keydown', onGlobalKey);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', onResize);
    if (badgeHideTimer !== null) clearTimeout(badgeHideTimer);
    if (expandHoldTimer !== null) clearTimeout(expandHoldTimer);
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
