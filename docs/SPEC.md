# WebScrollMap — Technical Specification (목차)

> 실구현 사이클에서 각 섹션을 채운다. v2 설계 기준.

1. Overview & Goals
2. Target Platforms (iOS Safari / macOS Safari)
3. Skeleton Extraction Rules (`h1~h3`, `img`, `video`, `strong`, `a`, snippet 40자)
4. Rendering Pipeline — Canvas + DOM Hybrid (히스테리시스 600/550, 쿨다운 1s)
5. Shadow DOM Isolation Model (open mode, `all: initial`, 랜덤 태그명)
6. Interaction Spec (Pull Handle, Tap, Scrub, Long-press, Double-tap, Anchor Snap ±12px)
7. Feature Specs
   - 7.1 Pin Drop (sessionStorage, max 5, 현재 scrollY 저장)
   - 7.2 Progress Trail (1px line, pathname 키)
   - 7.3 Magnifier Preview (±15%, heading 40자)
   - 7.4 Search Glow (Cmd+Shift+F, 바 더블탭, 시안 1.5Hz × 3)
   - 7.5 Section Badge (스크럽 중 floating "H2 · 제목")
   - 7.6 Floating Pin Panel (드래그 이동, 최소화 버블, 투명도 40/70/100%)
   - 7.7 Viewport Indicator (min 15% height)
   - 7.8 Smart Tag Filter (Pro — all/headings/media)
   - 7.9 Theme Store (Pro — default/sunset/ocean/forest/mono)
   - 7.10 Layout Custom (Pro — margin 0/8/16/24/32, barWidth 3/6/12)
   - 7.11 CoreHaptics (Pro — snap/pin/edge patterns via native)
   - 7.12 Telemetry Remote (Pro opt-in — 30s idle batch POST)
8. Pro Tier Gating (docs/PRO_TIER.md 참조)
   - 8.1 StoreKit 2 integration
   - 8.2 Entitlement HMAC + 14일 grace
   - 8.3 Feature Gate table (pro-feature-map)
   - 8.4 Lock toast UX (bottom center, 2.4s fade)
   - 8.5 Upgrade + Restore flows
9. Performance Budget & Measurement (`perf-budget.json`, Playwright+performance.mark)
10. Accessibility (WCAG, ARIA `role="scrollbar"`, prefers-reduced-motion, 색각)
11. Settings, Persistence & Sync (`browser.storage.local`, tier constraints 적용)
12. Failure Modes (CSP, Reader Mode, SPA, iframe, 가상 스크롤, RTL/vertical, 오프라인 Pro)
13. PlatformCapabilities Adapter (iOS vs macOS 단일 관문)
14. Native Messaging Protocol (get-entitlement / purchase-pro / restore-purchases / haptic)
15. Versioning & Release Criteria
